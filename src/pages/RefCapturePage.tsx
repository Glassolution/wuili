import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { recordAffiliateVisit, setReferralCode } from "@/lib/affiliateFunnel";

const RefCapturePage = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (!code) {
      navigate("/", { replace: true });
      return;
    }
    const maxAge = 60 * 60 * 24 * 90; // 90 days
    document.cookie = `velo_ref=${encodeURIComponent(code)}; Max-Age=${maxAge}; Path=/; SameSite=Lax`;
    setReferralCode(code);
    void recordAffiliateVisit(code);
    navigate("/", { replace: true });
  }, [code, navigate]);

  return null;
};

export default RefCapturePage;
