import { getSupabaseBrowserClient } from "./supabase";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const CACHE_STALE_TIME_MS = 15_000;
const CACHE_GC_TIME_MS = 60_000;
const MAX_RETRY_AFTER_MS = 3_000;

const responseCache = new Map();
const userGenerations = new Map();
let refreshPromise = null;

export class ApiError extends Error {
  constructor(message, { status = 0, code = "unknown", requestId = null, retryAfterMs = 0, cause } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.retryAfterMs = retryAfterMs;
    this.cause = cause;
  }
}

export function formatApiError(body, fallback) {
  const detail = body?.detail ?? body?.message;
  if (typeof detail === "string" && detail.trim()) return detail;

  if (Array.isArray(detail)) {
    const messages = detail.map((item) => {
      if (typeof item === "string") return item;
      if (!item || typeof item !== "object") return "";
      const field = Array.isArray(item.loc) ? item.loc[item.loc.length - 1] : null;
      const label = field === "description" ? "A descrição" : field === "notes" ? "As observações" : "Este campo";
      if (item.type === "string_too_long") return `${label} pode ter no máximo ${item.ctx?.max_length || 160} caracteres.`;
      if (item.type === "string_too_short") return `${label} precisa ser preenchido.`;
      if (item.type === "value_error" && field === "description") return "Informe uma descrição com pelo menos um caractere válido.";
      return typeof item.message === "string" ? item.message : "Revise os dados informados.";
    }).filter(Boolean);
    if (messages.length > 0) return messages.join(" · ");
  }

  if (detail && typeof detail === "object" && typeof detail.message === "string") return detail.message;
  return fallback;
}

function validatePath(path) {
  if (typeof path !== "string" || !path.startsWith("/api/v1/") || path.includes("//")) {
    throw new ApiError("Destino de API inválido.", { code: "invalid_destination" });
  }
}

function userCacheKey(session, path) {
  const userId = session?.user?.id;
  if (!userId) throw new ApiError("Sessão indisponível.", { code: "missing_session" });
  return `cifro:${userId}:${path}`;
}

function abortError(message, code, cause) {
  return new ApiError(message, { code, cause });
}

function retryAfterMs(response) {
  const value = Number(response.headers.get("Retry-After"));
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.min(MAX_RETRY_AFTER_MS, value * 1000);
}

function isTransient(error) {
  return error instanceof ApiError && ["network", "timeout", "service_unavailable", "rate_limited"].includes(error.code);
}

function wait(ms, signal) {
  if (!ms) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(resolve, ms);
    if (!signal) return;
    const cancel = () => {
      window.clearTimeout(timer);
      reject(abortError("Atualização cancelada.", "canceled"));
    };
    if (signal.aborted) cancel();
    else signal.addEventListener("abort", cancel, { once: true });
  });
}

async function readResponse(response, responseType = "json") {
  if (response.status === 204) return null;
  if (responseType === "blob") return response.blob();
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new ApiError("A API respondeu em um formato inesperado.", {
      status: response.status,
      code: "invalid_response",
      requestId: response.headers.get("X-Request-ID"),
    });
  }
  return response.json();
}

function combineSignals(externalSignal, timeoutMs) {
  const controller = new AbortController();
  let timedOut = false;
  const timer = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const abort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) abort();
    else externalSignal.addEventListener("abort", abort, { once: true });
  }
  return {
    signal: controller.signal,
    didTimeout: () => timedOut,
    cleanup: () => {
      window.clearTimeout(timer);
      externalSignal?.removeEventListener("abort", abort);
    },
  };
}

async function refreshSessionOnce() {
  if (!refreshPromise) {
    refreshPromise = getSupabaseBrowserClient().auth.refreshSession()
      .then(({ data, error }) => (error ? null : data.session))
      .finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

async function requestOnce(path, session, options, timeoutMs) {
  const method = (options.method || "GET").toUpperCase();
  const combined = combineSignals(options.signal, timeoutMs);
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      body: options.body,
      cache: "no-store",
      signal: combined.signal,
      headers: {
        ...(options.body && !(typeof FormData !== "undefined" && options.body instanceof FormData)
          ? { "Content-Type": "application/json" }
          : {}),
        Authorization: `Bearer ${session.access_token}`,
        ...(options.headers || {}),
      },
    });
  } catch (error) {
    combined.cleanup();
    if (options.signal?.aborted) throw abortError("Atualização cancelada.", "canceled", error);
    if (combined.didTimeout()) throw abortError("A API demorou demais para responder.", "timeout", error);
    throw abortError("Não foi possível conectar à API. Tente novamente.", "network", error);
  }
  combined.cleanup();

  const requestId = response.headers.get("X-Request-ID");
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const status = response.status;
    const code = status === 401 ? "unauthorized"
      : status === 403 ? "forbidden"
        : status === 422 ? "validation"
          : status === 429 ? "rate_limited"
            : status >= 500 ? "service_unavailable" : "http_error";
    const fallback = status === 401 ? "Sua sessão expirou. Entre novamente."
      : status === 403 ? "Você não tem permissão para esta ação."
        : status === 429 ? "Muitas tentativas. Aguarde um pouco."
          : status >= 500 ? "O serviço está temporariamente indisponível."
            : "Não foi possível falar com a API.";
    throw new ApiError(formatApiError(body, fallback), {
      status,
      code,
      requestId,
      retryAfterMs: retryAfterMs(response),
    });
  }
  return { data: await readResponse(response, options.responseType), requestId };
}

export function clearApiCache(userId = null) {
  if (!userId) {
    for (const currentUserId of userGenerations.keys()) {
      userGenerations.set(currentUserId, userGenerations.get(currentUserId) + 1);
    }
    responseCache.clear();
    return;
  }
  userGenerations.set(userId, (userGenerations.get(userId) || 0) + 1);
  for (const key of responseCache.keys()) {
    if (key.startsWith(`cifro:${userId}:`)) responseCache.delete(key);
  }
}

export function invalidateApiCache(session, paths = []) {
  const userId = session?.user?.id;
  if (!userId) return;
  if (!paths.length) {
    clearApiCache(userId);
    return;
  }
  for (const key of responseCache.keys()) {
    if (key.startsWith(`cifro:${userId}:`) && paths.some((path) => key.endsWith(`:${path}`))) responseCache.delete(key);
  }
}

export async function apiRequest(path, session, options = {}) {
  validatePath(path);
  if (!session?.access_token || !session?.user?.id) {
    throw new ApiError("Sessão indisponível.", { code: "missing_session" });
  }

  const method = (options.method || "GET").toUpperCase();
  const isRead = method === "GET";
  const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : 15_000;
  const cacheKey = isRead ? userCacheKey(session, path) : null;
  const userId = session.user.id;
  const requestGeneration = userGenerations.get(userId) || 0;
  if (isRead && !options.skipCache) {
    const cached = responseCache.get(cacheKey);
    if (cached) {
      if (cached.data !== undefined && cached.expiresAt > Date.now()) return cached.data;
      if (cached.promise) return cached.promise;
      if (cached.gcAt <= Date.now()) responseCache.delete(cacheKey);
    }
  }

  const run = async () => {
    let activeSession = session;
    let refreshed = false;
    for (let attempt = 0; attempt <= 1; attempt += 1) {
      try {
        const result = await requestOnce(path, activeSession, options, timeoutMs);
        if (!isRead) clearApiCache(session.user.id);
        return result.data;
      } catch (error) {
        if (error?.code === "unauthorized" && !refreshed && !options.signal?.aborted) {
          refreshed = true;
          const nextSession = await refreshSessionOnce();
          if (nextSession?.access_token && nextSession.access_token !== activeSession.access_token) {
            activeSession = nextSession;
            continue;
          }
        }
        const canRetry = isRead && attempt === 0 && isTransient(error) && !options.signal?.aborted;
        if (canRetry) {
          await wait(error.retryAfterMs || 250, options.signal);
          continue;
        }
        throw error;
      }
    }
    throw new ApiError("Não foi possível completar a requisição.");
  };

  if (!isRead || options.skipCache) return run();
  const pending = run();
  responseCache.set(cacheKey, {
    promise: pending,
    expiresAt: 0,
    gcAt: Date.now() + CACHE_GC_TIME_MS,
  });
  try {
    const data = await pending;
    if (userGenerations.get(userId) === requestGeneration) {
      responseCache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_STALE_TIME_MS, gcAt: Date.now() + CACHE_GC_TIME_MS });
    }
    return data;
  } catch (error) {
    responseCache.delete(cacheKey);
    throw error;
  }
}
