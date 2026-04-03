import { createContext, useContext, useState } from "react";

type ProfileContextType = {
  nome: string;
  foto: string | null;
  setNome: (v: string) => void;
  setFoto: (v: string | null) => void;
};

const ProfileContext = createContext<ProfileContextType>({
  nome: "TrendStore BR",
  foto: null,
  setNome: () => {},
  setFoto: () => {},
});

export const ProfileProvider = ({ children }: { children: React.ReactNode }) => {
  const [nome, setNome] = useState("TrendStore BR");
  const [foto, setFoto] = useState<string | null>(null);
  return (
    <ProfileContext.Provider value={{ nome, foto, setNome, setFoto }}>
      {children}
    </ProfileContext.Provider>
  );
};

export const useProfile = () => useContext(ProfileContext);
