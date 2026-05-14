import { getAuthenticatedUserFromRequest } from "../../server/products/authMiddleware.js";
import { OnboardingError, getOnboardingStatus } from "../../server/products/onboardingService.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Método não permitido." });
  }

  try {
    const user = await getAuthenticatedUserFromRequest(req);
    if (!user) return res.status(401).json({ error: "Usuário autenticado é obrigatório." });

    return res.status(200).json(await getOnboardingStatus(user.id));
  } catch (error) {
    const status = error instanceof OnboardingError ? error.status : 500;
    console.error("[onboarding] erro na função status:", error);
    return res.status(status).json({ error: error.message ?? "Não foi possível carregar o onboarding." });
  }
}

