import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase, isSupabaseEnabled } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type ProfileContextType = {
  nome: string;
  foto: string | null;
  setNome: (v: string) => void;
  setFoto: (v: string | null) => void;
};

const ProfileContext = createContext<ProfileContextType>({
  nome: "Usuario",
  foto: null,
  setNome: () => {},
  setFoto: () => {},
});

const getMetadataName = (user: ReturnType<typeof useAuth>["user"]) =>
  user?.user_metadata?.full_name ||
  user?.user_metadata?.name ||
  (user?.email ? user.email.split("@")[0] : "Usuario");

// Não usamos avatares do provedor OAuth (Google/etc) como fallback,
// pois eles retornam imagens padrão genéricas que não são realmente
// "foto do usuário". Só consideramos a foto explicitamente enviada em profiles.avatar_url.
const getMetadataAvatar = (_user: ReturnType<typeof useAuth>["user"]): string | null => null;

export const ProfileProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [nome, setNome] = useState("Usuario");
  const [foto, setFoto] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setNome("Usuario");
      setFoto(null);
      return;
    }

    let cancelled = false;
    const metadataName = getMetadataName(user);
    const metadataAvatar = getMetadataAvatar(user);

    setNome(metadataName);
    setFoto(metadataAvatar);

    const loadProfile = async () => {
      const profileResult = isSupabaseEnabled
        ? await supabase
            .from("profiles")
            .select("display_name, avatar_url")
            .eq("user_id", user.id)
            .maybeSingle()
        : { data: null, error: null };

      if (cancelled) return;

      const displayName = profileResult.error
        ? metadataName
        : profileResult.data?.display_name || metadataName;
      const avatar = profileResult.error
        ? metadataAvatar
        : profileResult.data?.avatar_url || metadataAvatar;

      setNome(displayName);
      setFoto(avatar ?? null);
    };

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const value = useMemo(() => ({ nome, foto, setNome, setFoto }), [nome, foto]);

  return (
    <ProfileContext.Provider value={value}>
      {children}
    </ProfileContext.Provider>
  );
};

export const useProfile = () => useContext(ProfileContext);
