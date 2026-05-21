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

const getMetadataAvatar = (user: ReturnType<typeof useAuth>["user"]) =>
  user?.user_metadata?.avatar_url || user?.user_metadata?.picture || null;

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

    setNome(getMetadataName(user));
    setFoto(getMetadataAvatar(user));

    if (!isSupabaseEnabled) return;

    let cancelled = false;

    const loadProfile = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled || error) return;

      const displayName = data?.display_name || getMetadataName(user);
      const avatar = data?.avatar_url || getMetadataAvatar(user);

      setNome(displayName);
      setFoto(avatar);
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
