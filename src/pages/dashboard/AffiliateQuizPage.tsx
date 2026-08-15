import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ChevronDown,
  Check,
  Clock3,
  Globe2,
  Link2,
  Plus,
  Send,
  Sparkles,
  Trash2,
  WalletCards,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

type SocialPlatform = "Instagram" | "TikTok" | "Facebook" | "YouTube" | "Twitter/X" | "Outro";
type AudienceRange = "menos de 1k" | "1k-10k" | "10k-50k" | "50k+";
type ContentNiche = "dropshipping" | "e-commerce" | "empreendedorismo" | "financas" | "geral/outro";
type PixKeyType = "CPF" | "E-mail" | "Telefone" | "Chave aleatória";

type SocialEntry = {
  id: number;
  platform: SocialPlatform;
  url: string;
};

type PixKeyEntry = {
  id: number;
  type: PixKeyType;
  value: string;
};

type AffiliateApplicationRow = {
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  cpf?: string | null;
  socials?: SocialEntry[] | null;
  audience_range?: string | null;
  content_niche?: string | null;
  pix_keys?: PixKeyEntry[] | null;
  promotion_plan?: string | null;
  agreed_terms?: boolean | null;
  status?: string | null;
};

const SOCIAL_PLATFORMS: SocialPlatform[] = ["Instagram", "TikTok", "Facebook", "YouTube", "Twitter/X", "Outro"];
const AUDIENCE_RANGES: AudienceRange[] = ["menos de 1k", "1k-10k", "10k-50k", "50k+"];
const PIX_KEY_TYPES: PixKeyType[] = ["CPF", "E-mail", "Telefone", "Chave aleatória"];
const CONTENT_NICHES: { value: ContentNiche; label: string }[] = [
  { value: "dropshipping", label: "Dropshipping" },
  { value: "e-commerce", label: "E-commerce" },
  { value: "empreendedorismo", label: "Empreendedorismo" },
  { value: "financas", label: "Finanças" },
  { value: "geral/outro", label: "Geral / outro" },
];

const FieldLabel = ({ children, optional = false }: { children: string; optional?: boolean }) => (
  <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.12em] text-black/45">
    {children}
    {optional ? <span className="ml-1 font-semibold text-black/35">opcional</span> : null}
  </label>
);

const SectionHeading = ({ children }: { children: string }) => (
  <div className="-mx-5 -mt-5 mb-5 border-b border-black/[0.06] bg-[#F4F5F7] px-5 py-3">
    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-black/42">{children}</p>
  </div>
);

const inputClass =
  "h-[52px] w-full rounded-full border border-black/10 bg-[#F9F9F7] px-5 text-[14px] font-bold text-black outline-none transition placeholder:text-black/32 focus:border-[#2F65FF] focus:bg-white focus:ring-4 focus:ring-[#2F65FF]/10";

const SOCIAL_PLATFORM_LOGOS: Partial<Record<SocialPlatform, string>> = {
  Instagram: "https://cdn.simpleicons.org/instagram/E4405F",
  TikTok: "https://cdn.simpleicons.org/tiktok/000000",
  Facebook: "https://cdn.simpleicons.org/facebook/1877F2",
  YouTube: "https://cdn.simpleicons.org/youtube/FF0000",
  "Twitter/X": "https://cdn.simpleicons.org/x/000000",
};

const SocialPlatformIcon = ({ platform, active = false }: { platform: string; active?: boolean }) => {
  const logoSrc = SOCIAL_PLATFORM_LOGOS[platform as SocialPlatform];

  return (
    <span
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
        active ? "border-white/20 bg-white" : "border-black/[0.06] bg-white"
      }`}
    >
      {logoSrc ? (
        <img src={logoSrc} alt="" className="h-4 w-4 object-contain" loading="lazy" referrerPolicy="no-referrer" />
      ) : (
        <Globe2 size={15} strokeWidth={2} className="text-black/45" />
      )}
    </span>
  );
};

type DropdownOption = {
  value: string;
  label: string;
};

const FormDropdown = ({
  label,
  value,
  options,
  onChange,
  renderIcon,
}: {
  label: string;
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  renderIcon?: (value: string, active?: boolean) => ReactNode;
}) => {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value) ?? options[0];

  return (
    <div className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex h-[52px] w-full items-center justify-between gap-3 rounded-full border border-black/10 bg-[#F9F9F7] px-5 text-left text-[14px] font-bold text-black outline-none transition hover:border-black/20 focus:border-[#2F65FF] focus:bg-white focus:ring-4 focus:ring-[#2F65FF]/10"
      >
        <span className="flex min-w-0 items-center gap-2">
          {renderIcon ? renderIcon(selected.value) : null}
          <span className="truncate">{selected.label}</span>
        </span>
        <ChevronDown
          size={16}
          strokeWidth={2}
          className={`shrink-0 text-black/40 transition ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label={label}
          className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 overflow-hidden rounded-[22px] border border-black/10 bg-white p-1 shadow-[0_18px_45px_rgba(0,0,0,0.14)]"
        >
          {options.map((option) => {
            const active = option.value === value;

            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`flex h-11 w-full items-center gap-2 rounded-2xl px-3 text-left text-[13px] font-bold transition ${
                  active ? "bg-black text-white" : "text-black hover:bg-black/[0.06]"
                }`}
              >
                {renderIcon ? renderIcon(option.value, active) : null}
                <span className="truncate">{option.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};

type AffiliateQuizContentProps = {
  onClose?: () => void;
  modal?: boolean;
};

export const AffiliateQuizContent = ({ onClose, modal = false }: AffiliateQuizContentProps) => {
  const { user } = useAuth();
  const [submitted, setSubmitted] = useState(false);
  const [approved, setApproved] = useState(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [cpf, setCpf] = useState("");
  const [promotionPlan, setPromotionPlan] = useState("");
  const [socials, setSocials] = useState<SocialEntry[]>([{ id: 1, platform: "Instagram", url: "" }]);
  const [audience, setAudience] = useState<AudienceRange>("1k-10k");
  const [contentNiche, setContentNiche] = useState<ContentNiche>("dropshipping");
  const [pixKeys, setPixKeys] = useState<PixKeyEntry[]>([{ id: 1, type: "CPF", value: "" }]);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // Pré-carrega a solicitação já enviada por este usuário (se houver).
  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    void (async () => {
      const { data: row, error } = await (supabase as any)
        .from("affiliate_applications")
        .select("full_name,email,phone,cpf,socials,audience_range,content_niche,pix_keys,promotion_plan,agreed_terms,status")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.warn("[AffiliateQuiz] falha ao carregar solicitacao", error);
        return;
      }

      const data = row as AffiliateApplicationRow | null;
      if (!active || !data) return;
      setFullName(data.full_name ?? "");
      setEmail(data.email ?? user.email ?? "");
      setPhone(data.phone ?? "");
      setCpf(data.cpf ?? "");
      setPromotionPlan(data.promotion_plan ?? "");
      if (Array.isArray(data.socials) && data.socials.length) {
        setSocials(data.socials.map((item: SocialEntry, index: number) => ({ id: index + 1, platform: item.platform, url: item.url })));
      }
      if (Array.isArray(data.pix_keys) && data.pix_keys.length) {
        setPixKeys(data.pix_keys.map((item: PixKeyEntry, index: number) => ({ id: index + 1, type: item.type, value: item.value })));
      }
      if (data.audience_range) setAudience(data.audience_range as AudienceRange);
      if (data.content_niche) setContentNiche(data.content_niche as ContentNiche);
      // Rejeitado pode reenviar: reabre o formulário em vez de mostrar "em análise".
      const applicationStatus = typeof data.status === "string" ? data.status : data.agreed_terms ? "pending" : null;

      // Já aprovado: nunca mostrar a tela de "em análise".
      const { data: affiliateRow } = await (supabase as any)
        .from("affiliates")
        .select("is_active")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!active) return;

      if (applicationStatus === "approved" || affiliateRow?.is_active === true) {
        setApproved(true);
        setSubmitted(false);
        onCloseRef.current?.();
        return;
      }

      if (data.agreed_terms && applicationStatus !== "rejected") {
        setAgreedToTerms(true);
        setSubmitted(true);
      } else if (applicationStatus === "rejected") {
        setAgreedToTerms(false);
        setSubmitted(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [user?.id, user?.email]);

  const submitApplication = async () => {
    if (!agreedToTerms || saving) return;
    if (!user?.id) {
      setSubmitted(true);
      return;
    }
    setSaving(true);
    try {
      const { data: affiliate } = await (supabase as any)
        .from("affiliates")
        .select("code")
        .eq("user_id", user.id)
        .maybeSingle();

      const payload = {
        user_id: user.id,
        affiliate_code: affiliate?.code ?? null,
        full_name: fullName.trim() || null,
        email: email.trim() || user.email || null,
        phone: phone.trim() || null,
        cpf: cpf.trim() || null,
        socials: socials.filter((item) => item.url.trim()).map(({ platform, url }) => ({ platform, url: url.trim() })),
        audience_range: audience,
        content_niche: contentNiche,
        pix_keys: pixKeys.filter((item) => item.value.trim()).map(({ type, value }) => ({ type, value: value.trim() })),
        promotion_plan: promotionPlan.trim() || null,
        agreed_terms: true,
        // Reenvio depois de uma rejeição volta a solicitação para a fila do admin.
        status: "pending",
      };

      const { error } = await (supabase as any)
        .from("affiliate_applications")
        .upsert(payload, { onConflict: "user_id" });

      if (error) {
        console.error("[AffiliateQuiz] falha ao salvar solicitação", error);
        toast({
          title: "Não foi possível enviar.",
          description: "Tente novamente em alguns instantes.",
          variant: "destructive",
        });
        return;
      }

      setSubmitted(true);
      onClose?.();
    } finally {
      setSaving(false);
    }
  };

  const nextSocialId = useMemo(() => Math.max(...socials.map((item) => item.id), 0) + 1, [socials]);
  const nextPixKeyId = useMemo(() => Math.max(...pixKeys.map((item) => item.id), 0) + 1, [pixKeys]);


  const updateSocial = (id: number, patch: Partial<Omit<SocialEntry, "id">>) => {
    setSocials((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const addSocial = () => {
    setSocials((current) => [...current, { id: nextSocialId, platform: "Instagram", url: "" }]);
  };

  const removeSocial = (id: number) => {
    setSocials((current) => (current.length === 1 ? current : current.filter((item) => item.id !== id)));
  };

  const updatePixKey = (id: number, patch: Partial<Omit<PixKeyEntry, "id">>) => {
    setPixKeys((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const addPixKey = () => {
    setPixKeys((current) => [...current, { id: nextPixKeyId, type: "CPF", value: "" }]);
  };

  const removePixKey = (id: number) => {
    setPixKeys((current) => (current.length === 1 ? current : current.filter((item) => item.id !== id)));
  };

  if (approved) return null;

  if (submitted) {
    return (
      <section className="relative rounded-[28px] border border-black/10 bg-white p-5 text-black shadow-[0_24px_80px_rgba(0,0,0,0.08)] sm:p-8 lg:p-10">
        <div className={`mx-auto flex max-w-3xl flex-col items-center justify-center text-center ${modal ? "min-h-[520px]" : "min-h-[620px]"}`}>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar formulário de afiliados"
              className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white text-black shadow-sm transition hover:border-black hover:bg-black hover:text-white"
            >
              <X size={17} strokeWidth={2} />
            </button>
          ) : null}
          <div className="relative flex h-24 w-24 items-center justify-center rounded-[32px] bg-black text-white shadow-[0_18px_45px_rgba(0,0,0,0.22)]">
            <Clock3 size={34} strokeWidth={1.8} />
            <span className="absolute -right-2 -top-2 flex h-9 w-9 items-center justify-center rounded-full border-4 border-white bg-white text-black shadow-sm">
              <Check size={17} strokeWidth={2.4} />
            </span>
          </div>

          <p className="mt-8 text-[12px] font-black uppercase tracking-[0.16em] text-black/45">Solicitação recebida</p>
          <h1 className="mt-4 max-w-xl text-[36px] font-black leading-[0.98] tracking-[-0.055em] text-black sm:text-[56px]">
            Sua solicitação está em análise
          </h1>
          <p className="mt-5 max-w-xl text-[15px] font-medium leading-7 text-black/55 sm:text-[16px]">
            Nosso time vai revisar suas informações e avisar por e-mail assim que o perfil for aprovado para o programa de afiliados Velo.
          </p>

          <div className="mt-9 grid w-full gap-3 sm:grid-cols-3">
            {["Perfil recebido", "Análise manual", "Retorno por e-mail"].map((item, index) => (
              <div key={item} className="rounded-3xl border border-black/10 bg-[#FAFAFA] px-5 py-4 text-left">
                <span className="text-[11px] font-black text-black/30">0{index + 1}</span>
                <p className="mt-2 text-[13px] font-bold text-black">{item}</p>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setSubmitted(false)}
            className="mt-8 rounded-full border border-black/15 bg-white px-6 py-3 text-[13px] font-bold text-black transition hover:border-black hover:bg-black hover:text-white"
          >
            Ver formulário
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="relative w-full overflow-visible rounded-[30px] bg-black text-black shadow-[0_24px_80px_rgba(0,0,0,0.10)]">
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar formulário de afiliados"
          className="absolute right-5 top-5 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white text-black shadow-sm transition hover:border-black hover:bg-black hover:text-white"
        >
          <X size={17} strokeWidth={2} />
        </button>
      ) : null}
      <div className="relative overflow-hidden rounded-t-[30px] bg-black">
        <div className="px-5 py-7 text-white sm:px-8 lg:px-10 lg:py-9">
          <div className="w-full">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-white/72">
              <Sparkles size={13} strokeWidth={1.9} />
              Programa de afiliados
            </div>
            <h1 className="mt-6 max-w-3xl text-[36px] font-black leading-[0.94] tracking-[-0.055em] text-white sm:text-[54px] lg:text-[64px]">
              Torne-se um afiliado Velo
            </h1>
            <p className="mt-4 max-w-2xl text-[15px] font-semibold leading-7 text-white/68">
              Indique a Velo para lojistas e criadores que querem vender online. Cada assinatura aprovada pela sua indicação vira comissão para você.
            </p>

          </div>
        </div>
      </div>

      <div className="border-b border-black/[0.06] bg-[#EFF1F4] px-5 py-6 sm:px-8 lg:px-10">
          <div className="w-full">
              <p className="text-[11px] font-black uppercase tracking-[0.12em] text-black/45">Fluxo após o envio</p>
              <div className="relative mt-4 w-full">
                <div className="absolute left-4 right-4 top-4 h-px bg-black/15" />
                <div className="relative grid grid-cols-4 gap-3">
                  {["Cadastro enviado", "Análise do perfil", "Resposta da Velo", "Comissão liberada"].map((item, index) => (
                    <div key={item} className="flex min-w-0 flex-col items-center text-center">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full border border-black/20 bg-white text-[11px] font-black text-black shadow-[0_4px_14px_rgba(0,0,0,0.08)]">
                        {index + 1}
                      </span>
                      <span className="mt-2 max-w-[120px] text-[10.5px] font-black leading-tight text-black/70 sm:text-[12px]">
                        {item}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
      </div>

      <div className="grid items-start gap-0 rounded-b-[30px] bg-[#EFF1F4]">
        <form
          className="space-y-5 px-5 py-5 sm:px-8 lg:px-10 lg:pb-8 lg:pt-7"
          onSubmit={(event) => {
            event.preventDefault();
            void submitApplication();
          }}
        >
          <div className="rounded-[28px] border border-black/10 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
            <SectionHeading>Dados do afiliado</SectionHeading>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <FieldLabel>Nome completo</FieldLabel>
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass} placeholder="Seu nome" />
              </div>
              <div>
                <FieldLabel>E-mail</FieldLabel>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="seu@email.com" />
              </div>
              <div>
                <FieldLabel>Telefone/WhatsApp</FieldLabel>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} placeholder="(00) 00000-0000" />
              </div>
              <div>
                <FieldLabel>CPF (opcional)</FieldLabel>
                <input inputMode="numeric" value={cpf} onChange={(e) => setCpf(e.target.value)} className={inputClass} placeholder="000.000.000-00" />
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-black/10 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
            <SectionHeading>Canais de divulgação</SectionHeading>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[15px] font-black tracking-[-0.02em] text-black">Redes sociais</p>
                <p className="mt-1 text-[12px] font-medium text-black/45">Adicione todos os canais em que você divulga conteúdo.</p>
              </div>
              <button
                type="button"
                onClick={addSocial}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-black px-4 text-[12px] font-bold text-white transition hover:bg-[#0A0A0A]/85"
              >
                <Plus size={15} strokeWidth={2.2} />
                Adicionar rede social
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {socials.map((social, index) => (
                <div key={social.id} className="grid gap-3 rounded-[24px] border border-black/10 bg-[#F7F8FA] p-3 sm:grid-cols-[180px_minmax(0,1fr)_44px]">
                  <div>
                    <FormDropdown
                      label={`Plataforma da rede social ${index + 1}`}
                      value={social.platform}
                      options={SOCIAL_PLATFORMS.map((platform) => ({ value: platform, label: platform }))}
                      onChange={(value) => updateSocial(social.id, { platform: value as SocialPlatform })}
                      renderIcon={(platform, active) => <SocialPlatformIcon platform={platform} active={active} />}
                    />
                  </div>
                  <div className="relative">
                    <Link2 className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-black/35" />
                    <input
                      value={social.url}
                      onChange={(event) => updateSocial(social.id, { url: event.target.value })}
                      className={`${inputClass} pl-10`}
                      placeholder="https://..."
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeSocial(social.id)}
                    disabled={socials.length === 1}
                    className="flex h-11 w-full items-center justify-center rounded-2xl border border-black/10 text-black transition hover:border-black hover:bg-black hover:text-white disabled:cursor-not-allowed disabled:opacity-35 sm:h-12 sm:w-11"
                    aria-label="Remover rede social"
                  >
                    <Trash2 size={16} strokeWidth={1.9} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border border-black/10 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
            <SectionHeading>Perfil de divulgação</SectionHeading>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <FieldLabel>Seguidores/audiência</FieldLabel>
                <FormDropdown
                  label="Seguidores/audiência"
                  value={audience}
                  options={AUDIENCE_RANGES.map((range) => ({ value: range, label: range }))}
                  onChange={(value) => setAudience(value as AudienceRange)}
                />
              </div>
              <div>
                <FieldLabel>Nicho de conteúdo</FieldLabel>
                <FormDropdown
                  label="Nicho de conteúdo"
                  value={contentNiche}
                  options={CONTENT_NICHES}
                  onChange={(value) => setContentNiche(value as ContentNiche)}
                />
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-black/10 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
            <SectionHeading>Pagamento</SectionHeading>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[15px] font-black text-black">Registrar chave Pix</p>
                <p className="mt-1 text-[12px] font-medium text-black/45">Adicione todas as chaves que você vai usa para receber as comissões.</p>
              </div>
              <button
                type="button"
                onClick={addPixKey}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-black px-4 text-[12px] font-bold text-white transition hover:bg-[#0A0A0A]/85"
              >
                <Plus size={15} strokeWidth={2.2} />
                Adicionar chave Pix
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {pixKeys.map((pixKey, index) => (
                <div key={pixKey.id} className="grid gap-3 rounded-[24px] border border-black/10 bg-[#F7F8FA] p-3 sm:grid-cols-[180px_minmax(0,1fr)_44px]">
                  <FormDropdown
                    label={`Tipo da chave Pix ${index + 1}`}
                    value={pixKey.type}
                    options={PIX_KEY_TYPES.map((type) => ({ value: type, label: type }))}
                    onChange={(value) => updatePixKey(pixKey.id, { type: value as PixKeyType })}
                  />
                  <div className="relative">
                    <WalletCards className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-black/35" />
                    <input
                      value={pixKey.value}
                      onChange={(event) => updatePixKey(pixKey.id, { value: event.target.value })}
                      className={`${inputClass} pl-10`}
                      placeholder={`Digite sua chave ${pixKey.type.toLowerCase()}`}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removePixKey(pixKey.id)}
                    disabled={pixKeys.length === 1}
                    className="flex h-11 w-full items-center justify-center rounded-2xl border border-black/10 text-black transition hover:border-black hover:bg-black hover:text-white disabled:cursor-not-allowed disabled:opacity-35 sm:h-12 sm:w-11"
                    aria-label="Remover chave Pix"
                  >
                    <Trash2 size={16} strokeWidth={1.9} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border border-black/10 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
            <SectionHeading>Plano de divulgação</SectionHeading>
            <FieldLabel optional>Conte como pretende divulgar a Velo</FieldLabel>
            <textarea
              value={promotionPlan}
              onChange={(event) => setPromotionPlan(event.target.value)}
              className="min-h-[136px] w-full resize-none rounded-[26px] border border-black/10 bg-[#F9F9F7] px-5 py-4 text-[14px] font-bold leading-6 text-black outline-none transition placeholder:text-black/32 focus:border-[#2F65FF] focus:bg-white focus:ring-4 focus:ring-[#2F65FF]/10"
              placeholder="Ex: conteúdos no Instagram, vídeos curtos, grupo de alunos, comunidade de e-commerce..."
            />
          </div>

          <div className="-mx-5 bg-[#EFF1F4] px-5 py-4 sm:-mx-8 sm:px-8 lg:-mx-10 lg:px-10">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <label className="flex min-h-[52px] min-w-0 cursor-pointer items-center gap-3 transition">
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(event) => setAgreedToTerms(event.target.checked)}
                  className="peer sr-only"
                />
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-black/15 bg-white text-white transition peer-checked:border-black peer-checked:bg-black">
                  <Check size={14} strokeWidth={2.6} />
                </span>
                <span className="text-[12.5px] font-bold leading-5 text-black/62">
                  Concordo com os termos do programa de afiliados
                </span>
              </label>

              <button
                type="submit"
                disabled={!agreedToTerms || saving}
                className="inline-flex h-[52px] w-full shrink-0 items-center justify-center gap-2 rounded-full bg-black px-6 text-[14px] font-black text-white shadow-[0_16px_36px_rgba(0,0,0,0.24)] transition hover:bg-black/85 disabled:cursor-not-allowed disabled:bg-black/20 disabled:text-white disabled:shadow-none sm:w-auto"
              >
                <Send size={16} strokeWidth={2.1} />
                {saving ? "Enviando..." : "Enviar solicitação"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </section>
  );
};

export const AffiliateQuizModal = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Programa de afiliados"
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="max-h-[calc(100vh-24px)] w-full max-w-6xl overflow-y-auto rounded-[30px] shadow-[0_32px_110px_rgba(0,0,0,0.35)] [scrollbar-width:none] sm:max-h-[calc(100vh-48px)] [&::-webkit-scrollbar]:hidden">
        <AffiliateQuizContent onClose={onClose} modal />
      </div>
    </div>
  );
};

const AffiliateQuizPage = () => <AffiliateQuizContent />;

export default AffiliateQuizPage;
