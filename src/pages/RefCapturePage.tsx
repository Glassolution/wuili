import { useEffect } from "react";
import { Navigate, useParams } from "react-router-dom";

const RefCapturePage = () => {
  const { code } = useParams<{ code: string }>();

  useEffect(() => {
    if (!code) return;
    const maxAge = 60 * 60 * 24 * 90; // 90 days
    document.cookie = `velo_ref=${encodeURIComponent(code)}; Max-Age=${maxAge}; Path=/; SameSite=Lax`;
  }, [code]);

  return <Navigate to="/" replace />;
};

export default RefCapturePage;
