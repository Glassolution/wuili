import { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

type ProfileContextType = {
  nome: string;
  foto: string | null;
  setNome: (v: string) => void;
  setFoto: (v: string | null) => void;
};

const ProfileContext = createContext<ProfileContextType>({
  nome: "Usuário",
  foto: null,
  setNome: () => {},
  setFoto: () => {},
});

/** Gera URL do Gravatar usando SHA-256 do e-mail (novo padrão Gravatar) */
async function gravatarUrl(email: string): Promise<string> {
  const normalized = email.trim().toLowerCase();
  const data = new TextEncoder().encode(normalized);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashHex = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  // d=404 → retorna 404 se não há foto cadastrada no Gravatar
  return `https://gravatar.com/avatar/${hashHex}?s=96&d=404`;
}

export const ProfileProvider = ({ children }: { children: React.ReactNode }) => {
  const [nome, setNome] = useState("Usuário");
  const [foto, setFoto] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      const email = user.email ?? "";

      /* ── Nome ──────────────────────────────────────── */
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", user.id)
        .single();

      const displayName =
        profile?.display_name ||
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        (email ? email.split("@")[0] : "Usuário");

      if (!cancelled) setNome(displayName);

      /* ── Foto ──────────────────────────────────────── */
      // 1) Avatar do OAuth (Google, GitHub, etc.)
      const oauthAvatar =
        user.user_metadata?.avatar_url ||
        user.user_metadata?.picture ||
        null;

      if (oauthAvatar) {
        if (!cancelled) setFoto(oauthAvatar);
        return;
      }

      // 2) Gravatar via SHA-256 do e-mail
      if (email) {
        try {
          const gUrl = await gravatarUrl(email);
          const res = await fetch(gUrl, { method: "HEAD" });
          if (res.ok && !cancelled) setFoto(gUrl);
          // 404 → mantém null → mostra iniciais
        } catch {
          // sem rede ou bloqueio de CORS → ignora, mostra iniciais
        }
      }
    };

    load();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      load();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <ProfileContext.Provider value={{ nome, foto, setNome, setFoto }}>
      {children}
    </ProfileContext.Provider>
  );
};

export const useProfile = () => useContext(ProfileContext);
