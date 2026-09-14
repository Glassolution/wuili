import { useEffect } from "react";
import { getReferralCode, recordAffiliateVisit, setReferralCode } from "@/lib/affiliateFunnel";

/**
 * O redirect de /ref/:code acontece no servidor (Vercel / middleware do Vite),
 * antes do React montar — então o clique precisa ser registrado aqui, a partir
 * do parâmetro ?ref= que o redirect repassa.
 */
const AffiliateVisitTracker = () => {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get("ref");
    const code = fromQuery ?? getReferralCode();
    if (!code) return;

    setReferralCode(code);
    void recordAffiliateVisit(code);

    if (fromQuery) {
      params.delete("ref");
      const query = params.toString();
      window.history.replaceState(
        {},
        "",
        `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`,
      );
    }
  }, []);

  return null;
};

export default AffiliateVisitTracker;
