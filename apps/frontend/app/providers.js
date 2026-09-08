"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { clearApiCache } from "../lib/api";
import { getSupabaseBrowserClient } from "../lib/supabase";

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState("");
  const [sessionGeneration, setSessionGeneration] = useState(0);
  const [mfaStatus, setMfaStatus] = useState({
    ready: false,
    enrolled: false,
    required: false,
    level: null,
    error: "",
  });
  const mfaRequestRef = useRef(0);

  const refreshMfaStatus = useCallback(async (knownSession) => {
    const requestId = ++mfaRequestRef.current;
    setMfaStatus((current) => ({ ...current, ready: false, error: "" }));

    try {
      const supabase = getSupabaseBrowserClient();
      let activeSession = knownSession;
      if (activeSession === undefined) {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        activeSession = data.session;
      }

      if (!activeSession) {
        if (requestId === mfaRequestRef.current) {
          setMfaStatus({ ready: true, enrolled: false, required: false, level: null, error: "" });
        }
        return;
      }

      const [assuranceResult, factorsResult] = await Promise.all([
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(activeSession.access_token),
        supabase.auth.mfa.listFactors(),
      ]);
      if (assuranceResult.error) throw assuranceResult.error;
      if (factorsResult.error) throw factorsResult.error;

      const verifiedFactors = factorsResult.data.all.filter((factor) => factor.status === "verified");
      const currentLevel = assuranceResult.data.currentLevel;
      if (requestId === mfaRequestRef.current) {
        setMfaStatus({
          ready: true,
          enrolled: verifiedFactors.length > 0,
          required: verifiedFactors.length > 0 && currentLevel !== "aal2",
          level: currentLevel,
          error: "",
        });
      }
    } catch {
      if (requestId === mfaRequestRef.current) {
        setMfaStatus({
          ready: true,
          enrolled: false,
          required: false,
          level: null,
          error: "Não foi possível verificar a segurança da sessão.",
        });
      }
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    let supabase;
    let lastUserId = null;
    let lastAccessToken = null;

    function applySession(nextSession) {
      if (!mounted) return;
      const nextUserId = nextSession?.user?.id || null;
      const nextAccessToken = nextSession?.access_token || null;
      if (nextUserId !== lastUserId || nextAccessToken !== lastAccessToken) {
        clearApiCache();
        lastUserId = nextUserId;
        lastAccessToken = nextAccessToken;
        setSessionGeneration((current) => current + 1);
      }
      setSession(nextSession);
      setAuthReady(true);
      void refreshMfaStatus(nextSession);
    }

    try {
      supabase = getSupabaseBrowserClient();
    } catch (error) {
      setAuthError(error.message);
      setAuthReady(true);
      return undefined;
    }

    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) {
        setAuthError(error.message);
      } else {
        applySession(data.session);
      }
      setAuthReady(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      applySession(nextSession);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [refreshMfaStatus]);

  return (
    <SessionContext.Provider value={{
      session,
      authReady,
      authError,
      sessionGeneration,
      mfaReady: mfaStatus.ready,
      mfaEnrolled: mfaStatus.enrolled,
      mfaRequired: mfaStatus.required,
      mfaLevel: mfaStatus.level,
      mfaError: mfaStatus.error,
      refreshMfaStatus,
    }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession precisa estar dentro de SessionProvider.");
  }
  return context;
}
