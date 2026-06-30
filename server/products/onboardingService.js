import { getProductCurationSupabase } from "./productCurationService.js";
import { invalidateUserRecommendations } from "./personalizedProductService.js";

const OBJECTIVE_TO_EXPERIENCE = {
  "Quero minha primeira renda extra": "beginner",
  "Já vendo e quero escalar": "intermediate",
  "Quero automatizar o que já faço": "intermediate",
  first_income: "beginner",
  scale_sales: "intermediate",
  automate_operation: "intermediate",
};

const VALID_AVAILABILITY = new Set(["Menos de 2h", "2 a 5h", "Mais de 5h", "less_than_2h", "2_to_5h", "more_than_5h"]);
const MAX_CATEGORIES = 3;

export class OnboardingError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "OnboardingError";
    this.status = status;
  }
}

function safeArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }
}

function normalizeProfile(profile = {}) {
  return {
    experienceLevel: profile.experienceLevel ?? profile.experience_level ?? "beginner",
    preferredCategories: safeArray(profile.preferredCategories ?? profile.preferred_categories),
    weeklyAvailability: profile.weeklyAvailability ?? profile.weekly_availability ?? null,
    onboardingCompleted: Boolean(profile.onboardingCompleted ?? profile.onboarding_completed),
    onboardingStep: Number(profile.onboardingStep ?? profile.onboarding_step ?? 1),
    objective: profile.onboardingObjective ?? profile.onboarding_objective ?? null,
  };
}

function profilePatch(patch) {
  const result = {};

  if (patch.experienceLevel !== undefined) result.experience_level = patch.experienceLevel;
  if (patch.preferredCategories !== undefined) result.preferred_categories = patch.preferredCategories;
  if (patch.weeklyAvailability !== undefined) result.weekly_availability = patch.weeklyAvailability;
  if (patch.onboardingCompleted !== undefined) result.onboarding_completed = patch.onboardingCompleted;
  if (patch.onboardingStep !== undefined) result.onboarding_step = patch.onboardingStep;
  if (patch.objective !== undefined) result.onboarding_objective = patch.objective;

  result.updated_at = new Date().toISOString();
  return result;
}

function userProfilePatch(patch) {
  return {
    ...(patch.weeklyAvailability !== undefined ? { weekly_availability: patch.weeklyAvailability } : {}),
    ...(patch.onboardingStep !== undefined ? { onboarding_step: patch.onboardingStep } : {}),
    ...(patch.onboardingCompleted !== undefined ? { onboarding_completed: patch.onboardingCompleted } : {}),
    ...(patch.objective !== undefined ? { onboarding_objective: patch.objective } : {}),
    updated_at: new Date().toISOString(),
  };
}

async function getProfile(userId) {
  const supabase = getProductCurationSupabase();
  if (!supabase) throw new OnboardingError("Supabase não configurado.", 500);

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new OnboardingError(`Não foi possível carregar o perfil: ${error.message}`, 500);
  return data ?? {};
}

async function updateProfile(userId, patch) {
  const supabase = getProductCurationSupabase();
  if (!supabase) throw new OnboardingError("Supabase não configurado.", 500);

  const normalizedPatch = profilePatch(patch);
  const { error } = await supabase
    .from("profiles")
    .update(normalizedPatch)
    .eq("user_id", userId);

  if (error) throw new OnboardingError(`Não foi possível salvar o onboarding: ${error.message}`, 500);

  const userProfilePayload = {
    user_id: userId,
    ...userProfilePatch(patch),
  };

  const { error: userProfileError } = await supabase
    .from("user_profiles")
    .upsert(userProfilePayload, { onConflict: "user_id" });

  if (userProfileError) {
    console.warn("[onboarding] user_profiles indisponível; perfil principal foi atualizado:", userProfileError.message);
  }
}

async function fetchAvailableCategories() {
  const supabase = getProductCurationSupabase();
  if (!supabase) return [];

  const fromCategories = await supabase
    .from("categories")
    .select("id, name, slug")
    .order("name", { ascending: true });

  if (!fromCategories.error && fromCategories.data?.length) {
    return fromCategories.data.map((category) => ({
      id: category.id ?? category.slug ?? category.name,
      name: category.name ?? category.slug,
      slug: category.slug ?? category.name,
    }));
  }

  if (fromCategories.error) {
    console.warn("[onboarding] tabela categories indisponível; usando catalog_products:", fromCategories.error.message);
  }

  const fromCatalog = await supabase
    .from("catalog_products")
    .select("category")
    .eq("source", "c7drop")
    .eq("is_active", true)
    .not("category", "is", null)
    .limit(500);

  if (fromCatalog.error) {
    console.warn("[onboarding] não foi possível carregar categorias do catálogo:", fromCatalog.error.message);
    return [];
  }

  return Array.from(new Set((fromCatalog.data ?? []).map((item) => item.category).filter(Boolean)))
    .sort((a, b) => String(a).localeCompare(String(b), "pt-BR"))
    .map((category) => ({ id: category, name: category, slug: category }));
}

function validateStepOrder(profile, step) {
  if (profile.onboardingCompleted) return;

  const currentStep = Math.max(Number(profile.onboardingStep ?? 1), 1);
  if (step > currentStep) {
    throw new OnboardingError(`Complete a etapa ${currentStep} antes de avançar para a etapa ${step}.`, 400);
  }
}

function parseStepPatch(step, data = {}) {
  if (step === 1) {
    const objective = data.objective ?? data.goal;
    const experienceLevel = OBJECTIVE_TO_EXPERIENCE[objective];
    if (!experienceLevel) {
      throw new OnboardingError("Objetivo inválido. Escolha uma das opções de onboarding.", 400);
    }
    return { objective, experienceLevel, onboardingStep: 2 };
  }

  if (step === 2) {
    const categories = safeArray(data.preferredCategories ?? data.categories);
    if (!categories.length) throw new OnboardingError("Selecione pelo menos 1 categoria de interesse.", 400);
    if (categories.length > MAX_CATEGORIES) throw new OnboardingError("Selecione no máximo 3 categorias de interesse.", 400);
    return { preferredCategories: categories, onboardingStep: 3 };
  }

  if (step === 3) {
    const weeklyAvailability = data.weeklyAvailability ?? data.weekly_availability;
    if (!VALID_AVAILABILITY.has(weeklyAvailability)) {
      throw new OnboardingError("Disponibilidade inválida. Escolha: Menos de 2h, 2 a 5h ou Mais de 5h.", 400);
    }
    return { weeklyAvailability, onboardingStep: 4 };
  }

  throw new OnboardingError("Etapa inválida. Use as etapas 1, 2 ou 3.", 400);
}

export async function getOnboardingStatus(userId) {
  if (!userId) throw new OnboardingError("userId é obrigatório.", 400);

  const profile = normalizeProfile(await getProfile(userId));
  const categories = await fetchAvailableCategories();
  const currentStep = profile.onboardingCompleted ? "complete" : Math.max(profile.onboardingStep, 1);

  return {
    completed: profile.onboardingCompleted,
    currentStep,
    profile,
    categories,
  };
}

export async function saveOnboardingStep(userId, step, data = {}) {
  if (!userId) throw new OnboardingError("userId é obrigatório.", 400);

  const stepNumber = Number(step);
  if (!Number.isInteger(stepNumber)) throw new OnboardingError("Número da etapa inválido.", 400);

  const profile = normalizeProfile(await getProfile(userId));
  if (profile.onboardingCompleted) {
    return getOnboardingStatus(userId);
  }

  validateStepOrder(profile, stepNumber);
  const patch = parseStepPatch(stepNumber, data);
  await updateProfile(userId, patch);
  return getOnboardingStatus(userId);
}

export async function completeOnboarding(userId) {
  if (!userId) throw new OnboardingError("userId é obrigatório.", 400);

  const profile = normalizeProfile(await getProfile(userId));
  if (profile.onboardingCompleted) {
    return getOnboardingStatus(userId);
  }

  if (!profile.experienceLevel) throw new OnboardingError("Complete a etapa 1 antes de finalizar.", 400);
  if (!profile.preferredCategories.length) throw new OnboardingError("Complete a etapa 2 antes de finalizar.", 400);
  if (!profile.weeklyAvailability) throw new OnboardingError("Complete a etapa 3 antes de finalizar.", 400);

  await updateProfile(userId, {
    onboardingCompleted: true,
    onboardingStep: 4,
  });
  await invalidateUserRecommendations(userId);

  console.log("[onboarding] onboarding concluído", {
    userId,
    completedAt: new Date().toISOString(),
  });

  return getOnboardingStatus(userId);
}
