export const ADMIN_EMAILS = new Set(["xavierluisfelipe12@gmail.com", "lucassrby@gmail.com"]);

export const isAdminEmail = (email?: string | null) => !!email && ADMIN_EMAILS.has(email.toLowerCase());
