import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

type AuthContextType = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
});

// Clear any corrupted Supabase auth tokens from localStorage.
// This prevents the client from getting stuck trying to refresh a dead token.
const clearCorruptedAuthStorage = () => {
  try {
    const keys = Object.keys(localStorage);
    keys.forEach((key) => {
      if (key.startsWith("sb-") && key.includes("-auth-token")) {
        const raw = localStorage.getItem(key);
        if (!raw) return;
        try {
          const parsed = JSON.parse(raw);
          // A valid session must have an access_token AND a refresh_token
          if (!parsed?.access_token || !parsed?.refresh_token) {
            localStorage.removeItem(key);
          }
        } catch {
          localStorage.removeItem(key);
        }
      }
    });
  } catch {
    // ignore (SSR / private mode)
  }
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let resolved = false;
    const finishLoading = () => {
      if (!resolved) {
        resolved = true;
        setLoading(false);
      }
    };

    // Sweep corrupted tokens before initializing
    clearCorruptedAuthStorage();

    // Listener BEFORE getSession to avoid race conditions
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      finishLoading();
    });

    supabase.auth.getSession()
      .then(({ data: { session: currentSession }, error }) => {
        if (error) {
          // Invalid refresh token, missing session, etc — clean and continue
          console.warn("Auth init error, clearing session:", error.message);
          supabase.auth.signOut().catch(() => {});
          try {
            Object.keys(localStorage)
              .filter((k) => k.startsWith("sb-") && k.includes("-auth-token"))
              .forEach((k) => localStorage.removeItem(k));
          } catch {}
          setSession(null);
          setUser(null);
        } else {
          setSession(currentSession);
          setUser(currentSession?.user ?? null);
        }
        finishLoading();
      })
      .catch((err) => {
        console.warn("getSession failed:", err);
        setSession(null);
        setUser(null);
        finishLoading();
      });

    // Safety net: never stay loading more than 3s
    const timeout = window.setTimeout(finishLoading, 3000);

    return () => {
      window.clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
