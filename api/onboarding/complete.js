import { getAuthenticatedUserFromRequest } from "../../server/products/authMiddleware.js";
import { OnboardingError, completeOnboarding } from "../../server/products/onboardingService.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método não permitido." });
  }

  try {
    const user = await getAuthenticatedUserFromRequest(req);
    if (!user) return res.status(401).json({ error: "Usuário autenticado é obrigatório." });

    return res.status(200).json(await completeOnboarding(user.id));
  } catch (error) {
    const status = error instanceof OnboardingError ? error.status : 500;
    console.error("[onboarding] erro na função complete:", error);
    return res.status(status).json({ error: error.message ?? "Não foi possível concluir o onboarding." });
  }
}

