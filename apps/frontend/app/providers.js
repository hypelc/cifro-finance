"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { clearApiCache } from "../lib/api";
import { getSupabaseBrowserClient } from "../lib/supabase";

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState("");
  const [sessionGeneration, setSessionGeneration] = useState(0);

  useEffect(() => {
    let mounted = true;
    let supabase;
    let lastUserId = null;

    function applySession(nextSession) {
      if (!mounted) return;
      const nextUserId = nextSession?.user?.id || null;
      if (nextUserId !== lastUserId) {
        clearApiCache();
        lastUserId = nextUserId;
        setSessionGeneration((current) => current + 1);
      }
      setSession(nextSession);
      setAuthReady(true);
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
  }, []);

  return (
    <SessionContext.Provider value={{ session, authReady, authError, sessionGeneration }}>
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
