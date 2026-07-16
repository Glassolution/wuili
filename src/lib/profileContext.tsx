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

const getEmailAvatar = async (email?: string | null) => {
  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail || !globalThis.crypto?.subtle) return null;

  try {
    const digest = await globalThis.crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(normalizedEmail),
    );
    const hash = Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");

    return `https://www.gravatar.com/avatar/${hash}?d=identicon&s=160`;
  } catch {
    return null;
  }
};

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
      const emailAvatarPromise = getEmailAvatar(user.email);
      const profileResult = isSupabaseEnabled
        ? await supabase
            .from("profiles")
            .select("display_name, avatar_url")
            .eq("user_id", user.id)
            .maybeSingle()
        : { data: null, error: null };
      const emailAvatar = await emailAvatarPromise;

      if (cancelled) return;

      const displayName = profileResult.error
        ? metadataName
        : profileResult.data?.display_name || metadataName;
      const avatar = profileResult.error
        ? metadataAvatar || emailAvatar
        : profileResult.data?.avatar_url || metadataAvatar || emailAvatar;

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
