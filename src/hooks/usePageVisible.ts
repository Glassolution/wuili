import { useEffect, useState } from "react";

/** true enquanto a aba do navegador está visível; usado para pausar atualizações automáticas. */
export const usePageVisible = () => {
  const [visible, setVisible] = useState(() => typeof document === "undefined" || document.visibilityState !== "hidden");
  useEffect(() => {
    const update = () => setVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return visible;
};
