import { supabase, withFreshSupabaseSession } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type ProjectType = "loja_completa" | "pagina_venda";
export type ProjectStatus = "rascunho" | "publicado";

export type UserProject = Omit<Tables<"user_projects">, "tipo_projeto" | "status"> & {
  tipo_projeto: ProjectType;
  status: ProjectStatus;
};

export async function fetchUserProjects(): Promise<UserProject[]> {
  const { data, error } = await withFreshSupabaseSession(() =>
    supabase.rpc("get_user_projects"),
  );

  if (error) throw error;
  return (data ?? []) as UserProject[];
}
