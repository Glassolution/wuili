// NÃO MODIFIQUE ESTE ARQUIVO — qualquer alteração quebra a autenticação global
import { createContext, useContext, useEffect, useState } from "react";
import { supabase, isSupabaseEnabled } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

type AuthContextType = {
  user: User | null;
  session: Session | null;
  role: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  role: null,
  loading: true,
  signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let initialSessionValidated = false;

    if (!isSupabaseEnabled) {
      setUser(
        ({
          id: "dev-user",
          email: "dev@local",
          app_metadata: {},
          user_metadata: {},
          aud: "authenticated",
          created_at: new Date().toISOString(),
        } as unknown) as User
      );
      setRole("admin");
      setLoading(false);
      return () => {
        mounted = false;
      };
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;

        // getSession may contain an expired token. Do not expose that stale user
        // while the initial server-side validation below is still running.
        if (!initialSessionValidated && event === "INITIAL_SESSION") return;

        setSession(session ?? null);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    const validateInitialSession = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const currentSession = sessionData.session;

        if (!currentSession) {
          if (!mounted) return;
          initialSessionValidated = true;
          setSession(null);
          setUser(null);
          setLoading(false);
          return;
        }

        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData.user) {
          await supabase.auth.signOut({ scope: "local" });
          if (!mounted) return;
          initialSessionValidated = true;
          setSession(null);
          setUser(null);
          setLoading(false);
          return;
        }

        const { data: refreshedSessionData } = await supabase.auth.getSession();
        if (!mounted) return;
        initialSessionValidated = true;
        setSession(refreshedSessionData.session ?? null);
        setUser(userData.user);
        setLoading(false);
      } catch {
        if (!mounted) return;
        initialSessionValidated = true;
        setSession(null);
        setUser(null);
        setLoading(false);
      }
    };

    void validateInitialSession();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => setLoading(false), 3000);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!user) {
      setRole(null);
      return;
    }

    if (!isSupabaseEnabled) {
      setRole("admin");
      return;
    }

    Promise.allSettled([
      (supabase as any).from("profiles").select("role").eq("user_id", user.id).maybeSingle(),
      (supabase as any).from("profiles").select("role").eq("id", user.id).maybeSingle(),
      (supabase as any).from("user_roles").select("role").eq("user_id", user.id).maybeSingle(),
    ]).then((results) => {
      const roles = results.flatMap((result) => {
        if (result.status !== "fulfilled" || !result.value?.data?.role) return [];
        return [String(result.value.data.role)];
      });
      setRole(roles.includes("admin") ? "admin" : roles[0] ?? "user");
    });
  }, [user]);

  const signOut = async () => {
    if (!isSupabaseEnabled) {
      setUser(null);
      setSession(null);
      setRole(null);
      return;
    }
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, role, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
