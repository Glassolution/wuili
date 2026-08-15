import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export type SocialEntry = { platform?: string; url?: string };
export type PixEntry = { type?: string; value?: string };

export type ApplicationRow = {
  full_name: string | null;
  email: string | null;
  phone: string | null;
  cpf: string | null;
  socials: SocialEntry[] | null;
  audience_range: string | null;
  content_niche: string | null;
  pix_keys: PixEntry[] | null;
  promotion_plan: string | null;
  created_at: string | null;
};

const Field = ({ label, value }: { label: string; value?: string | null }) => (
  <div>
    <p className="text-[11px] uppercase tracking-[0.12em] text-white/35">{label}</p>
    <p className="mt-1 break-words text-[13px] text-white/85">{value?.trim() ? value : "—"}</p>
  </div>
);

/**
 * Mostra o formulário enviado pelo afiliado (dados pessoais, canais, Pix e plano de divulgação).
 *
 * Dois modos: com `application` renderiza o que já veio de fora (aba de solicitações,
 * que recebe tudo de rpc_admin_affiliate_applications); sem ela, busca por user_id/código
 * (aba "Por afiliado", que só conhece o afiliado).
 */
const AffiliateApplicationCard = ({
  userId,
  code,
  application,
}: {
  userId?: string | null;
  code?: string | null;
  application?: ApplicationRow | null;
}) => {
  const query = useQuery({
    queryKey: ["affiliate-application", userId ?? "", code ?? ""],
    enabled: Boolean(!application && (userId || code)),
    queryFn: async () => {
      let builder = (supabase as any)
        .from("affiliate_applications")
        .select(
          "full_name,email,phone,cpf,socials,audience_range,content_niche,pix_keys,promotion_plan,created_at",
        );
      builder = userId ? builder.eq("user_id", userId) : builder.ilike("affiliate_code", code ?? "");
      const { data, error } = await builder.maybeSingle();
      if (error) throw error;
      return (data ?? null) as ApplicationRow | null;
    },
  });

  if (!application && query.isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-[13px] text-white/50">
        <Loader2 size={14} className="animate-spin" /> Carregando cadastro…
      </div>
    );
  }

  const app = application ?? query.data;

  if (!app) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-[13px] text-white/45">
        Este afiliado ainda não enviou o formulário de cadastro.
      </div>
    );
  }

  const socials = Array.isArray(app.socials) ? app.socials : [];
  const pixKeys = Array.isArray(app.pix_keys) ? app.pix_keys : [];

  return (
    <div className="space-y-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome completo" value={app.full_name} />
        <Field label="E-mail" value={app.email} />
        <Field label="Telefone/WhatsApp" value={app.phone} />
        <Field label="CPF" value={app.cpf} />
        <Field label="Audiência" value={app.audience_range} />
        <Field label="Nicho de conteúdo" value={app.content_niche} />
      </div>

      <div>
        <p className="text-[11px] uppercase tracking-[0.12em] text-white/35">Canais de divulgação</p>
        {socials.length === 0 ? (
          <p className="mt-1 text-[13px] text-white/45">—</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {socials.map((item, index) => (
              <li key={`${item.url}-${index}`} className="flex flex-wrap items-center gap-2 text-[13px]">
                <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[11px] text-white/60">
                  {item.platform ?? "Rede"}
                </span>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all text-white/80 underline-offset-2 hover:underline"
                >
                  {item.url}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <p className="text-[11px] uppercase tracking-[0.12em] text-white/35">Chaves Pix</p>
        {pixKeys.length === 0 ? (
          <p className="mt-1 text-[13px] text-white/45">—</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {pixKeys.map((item, index) => (
              <li key={`${item.value}-${index}`} className="flex flex-wrap items-center gap-2 text-[13px]">
                <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[11px] text-white/60">
                  {item.type ?? "Pix"}
                </span>
                <span className="break-all font-mono text-white/80">{item.value}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Field label="Plano de divulgação" value={app.promotion_plan} />
    </div>
  );
};

export default AffiliateApplicationCard;
