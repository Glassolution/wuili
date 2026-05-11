// NÃO MODIFIQUE ESTE ARQUIVO — qualquer alteração quebra a autenticação global
import { createContext, useContext, useEffect, useState } from "react";
import { supabase, isSupabaseEnabled } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

type AuthContextType = {
  user: User | null;
  role: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  loading: true,
  signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Modo DEV sem Supabase: permite navegar no dashboard para visualizar a UI.
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

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (!mounted) return;
        setUser(session?.user ?? null);
        setLoading(false);
      })
      .catch(() => {
        if (!mounted) return;
        setUser(null);
        setLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!mounted) return;
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Safety net: never stay loading more than 3s
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

    (supabase as any)
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()
      .then(({ data }: { data?: { role?: string } }) => setRole(data?.role ?? "user"));
  }, [user]);

  const signOut = async () => {
    if (!isSupabaseEnabled) {
      setUser(null);
      setRole(null);
      return;
    }
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, role, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
