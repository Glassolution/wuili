function normalizeCode(raw) {
  if (typeof raw !== "string") return null;
  const code = raw.trim().toUpperCase();
  if (!code) return null;
  if (!/^[A-Z0-9]{4,32}$/.test(code)) return null;
  return code;
}

function buildAffiliateCookie(code, req) {
  const proto = String(req?.headers?.["x-forwarded-proto"] ?? "").toLowerCase();
  const isHttps = proto === "https";

  // 90 dias
  const maxAge = 60 * 60 * 24 * 90;
  const parts = [
    `velo_ref=${encodeURIComponent(code)}`,
    "Path=/",
    `Max-Age=${maxAge}`,
    "SameSite=Lax",
  ];

  // Evita Secure em HTTP (dev/local). Em produção (Vercel) normalmente é HTTPS.
  if (isHttps || process.env.NODE_ENV === "production") parts.push("Secure");

  return parts.join("; ");
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.statusCode = 405;
    return res.end("Method Not Allowed");
  }

  const code = normalizeCode(req?.query?.code);
  res.statusCode = 302;
  res.setHeader("Location", "/");

  if (code) {
    res.setHeader("Set-Cookie", buildAffiliateCookie(code, req));
  }

  return res.end();
}

