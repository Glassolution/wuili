import { supabase } from "@/integrations/supabase/client";

export type AdminUserIdentity = {
  user_id: string;
  name: string | null;
  email: string | null;
};

type PageResult<T> = { data: T[] | null; error: unknown };

/**
 * Busca todas as linhas de uma consulta paginada, várias páginas por vez.
 * Antes as páginas eram pedidas uma depois da outra, o que somava ~1s por página.
 */
export const fetchAllPages = async <T,>(
  fetchPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
  { pageSize = 1000, concurrency = 4 }: { pageSize?: number; concurrency?: number } = {},
): Promise<T[]> => {
  const rows: T[] = [];
  for (let start = 0; ; start += pageSize * concurrency) {
    const results = await Promise.all(
      Array.from({ length: concurrency }, (_, index) => {
        const from = start + index * pageSize;
        return fetchPage(from, from + pageSize - 1);
      }),
    );
    for (const { data, error } of results) {
      if (error) throw error;
      const page = data ?? [];
      rows.push(...page);
      if (page.length < pageSize) return rows;
    }
  }
};

const withTimeout = async <T,>(promise: PromiseLike<T>, ms: number, fallback: T): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } catch {
    return fallback;
  } finally {
    if (timer) clearTimeout(timer);
  }
};

// URLs do PostgREST estouram com milhares de ids em .in(); 150 por lote é seguro.
const ID_CHUNK = 150;
// admin-users resolve cada id no auth individualmente; limitamos o fallback.
const MAX_AUTH_FALLBACK_IDS = 200;

/**
 * Nome e e-mail só dos usuários que aparecem na tela. Antes o painel baixava a
 * tabela profiles inteira (16 mil+ linhas) a cada 30s só para achar esses nomes.
 */
export const fetchUserIdentities = async (userIds: string[]): Promise<AdminUserIdentity[]> => {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return [];

  const chunks: string[][] = [];
  for (let index = 0; index < ids.length; index += ID_CHUNK) chunks.push(ids.slice(index, index + ID_CHUNK));

  const profileResults = await Promise.all(
    chunks.map((chunk) =>
      supabase.from("profiles").select("user_id,display_name,email").in("user_id", chunk),
    ),
  );

  const identities = new Map<string, AdminUserIdentity>();
  for (const { data } of profileResults) {
    for (const profile of data ?? []) {
      identities.set(profile.user_id, {
        user_id: profile.user_id,
        name: profile.display_name,
        email: profile.email,
      });
    }
  }

  // Quem não tem e-mail no perfil é completado pelo auth, via admin-users.
  const missing = ids.filter((id) => !identities.get(id)?.email).slice(0, MAX_AUTH_FALLBACK_IDS);
  if (missing.length > 0) {
    const { data } = await withTimeout(
      supabase.functions.invoke("admin-users", { body: { user_ids: missing } }) as Promise<{
        data: AdminUserIdentity[] | null;
        error: unknown;
      }>,
      8_000,
      { data: null, error: null },
    );
    if (Array.isArray(data)) data.forEach((user) => identities.set(user.user_id, user));
  }

  return [...identities.values()];
};
