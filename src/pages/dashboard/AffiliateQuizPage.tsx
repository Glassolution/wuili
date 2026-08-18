import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  BadgePercent,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Globe2,
  Loader2,
  Plus,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

// As tabelas de afiliados ainda não constam nos tipos gerados do Supabase.
// Este adaptador concentra o escape temporário até a próxima geração do schema.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const affiliateDb = supabase as any;

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

// Avisa a sidebar (e quem mais precisar) que a solicitação acabou de ser enviada.
export const AFFILIATE_APPLICATION_EVENT = "velo:affiliate-application-sent";

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

const STEPS = ["Seus dados", "Divulgação", "Recebimento"];

const EASE = [0.22, 1, 0.36, 1] as const;

const inputClass =
  "h-[46px] w-full rounded-[14px] border border-black/[0.09] bg-[#F7F8FA] px-4 text-[13.5px] font-semibold text-[#0F1117] outline-none transition placeholder:font-medium placeholder:text-black/30 focus:border-[#2563EB]/60 focus:bg-white focus:ring-4 focus:ring-[#2563EB]/12";

const SOCIAL_PLATFORM_LOGOS: Partial<Record<SocialPlatform, string>> = {
  Instagram: "https://cdn.simpleicons.org/instagram/E4405F",
  TikTok: "https://cdn.simpleicons.org/tiktok/000000",
  Facebook: "https://cdn.simpleicons.org/facebook/1877F2",
  YouTube: "https://cdn.simpleicons.org/youtube/FF0000",
  "Twitter/X": "https://cdn.simpleicons.org/x/000000",
};

const FieldLabel = ({ children, optional = false }: { children: string; optional?: boolean }) => (
  <label className="mb-1.5 block text-[10.5px] font-black uppercase tracking-[0.11em] text-black/40">
    {children}
    {optional ? <span className="ml-1 font-bold text-black/25">opcional</span> : null}
  </label>
);

const SocialPlatformIcon = ({ platform, active = false }: { platform: string; active?: boolean }) => {
  const logoSrc = SOCIAL_PLATFORM_LOGOS[platform as SocialPlatform];

  return (
    <span
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
        active ? "border-white/20 bg-white" : "border-black/[0.06] bg-white"
      }`}
    >
      {logoSrc ? (
        <img src={logoSrc} alt="" className="h-3.5 w-3.5 object-contain" loading="lazy" referrerPolicy="no-referrer" />
      ) : (
        <Globe2 size={13} strokeWidth={2} className="text-black/45" />
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
        className="flex h-[46px] w-full items-center justify-between gap-3 rounded-[14px] border border-black/[0.09] bg-[#F7F8FA] px-4 text-left text-[13.5px] font-semibold text-[#0F1117] outline-none transition hover:border-black/[0.16] focus:border-[#2563EB]/60 focus:bg-white focus:ring-4 focus:ring-[#2563EB]/12"
      >
        <span className="flex min-w-0 items-center gap-2">
          {renderIcon ? renderIcon(selected.value) : null}
          <span className="truncate">{selected.label}</span>
        </span>
        <ChevronDown
          size={15}
          strokeWidth={2.2}
          className={`shrink-0 text-black/35 transition duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            role="listbox"
            aria-label={label}
            initial={{ opacity: 0, y: -6, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.985 }}
            transition={{ duration: 0.16, ease: EASE }}
            className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 overflow-hidden rounded-[16px] border border-black/[0.08] bg-white p-1 shadow-[0_18px_45px_rgba(15,17,23,0.16)]"
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
                  className={`flex h-10 w-full items-center gap-2 rounded-[12px] px-2.5 text-left text-[13px] font-bold transition ${
                    active ? "bg-[#2563EB] text-white" : "text-[#0F1117] hover:bg-black/[0.05]"
                  }`}
                >
                  {renderIcon ? renderIcon(option.value, active) : null}
                  <span className="truncate">{option.label}</span>
                </button>
              );
            })}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};

type AffiliateQuizContentProps = {
  onClose?: () => void;
  modal?: boolean;
};

export const AffiliateQuizContent = ({ onClose }: AffiliateQuizContentProps) => {
  const { user } = useAuth();
  const reduceMotion = useReducedMotion();
  const [submitted, setSubmitted] = useState(false);
  // Diferencia "acabei de enviar agora" de "reabri e já estava em análise".
  const [justSent, setJustSent] = useState(false);
  const [approved, setApproved] = useState(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
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
      const { data: row, error } = await affiliateDb
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
      const { data: affiliateRow } = await affiliateDb
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
      setJustSent(true);
      setSubmitted(true);
      return;
    }
    setSaving(true);
    try {
      const { data: affiliate } = await affiliateDb
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

      const { error } = await affiliateDb
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

      window.dispatchEvent(new Event(AFFILIATE_APPLICATION_EVENT));
      // A tela de envio concluído fica no lugar do formulário; quem fecha é o usuário.
      setJustSent(true);
      setSubmitted(true);
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

  const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const stepIsValid = step === 0
    ? fullName.trim().length > 1 && emailIsValid
    : step === 1
      ? socials.some((item) => item.url.trim().length > 2)
      : pixKeys.some((item) => item.value.trim().length > 2) && agreedToTerms;

  const goToStep = (next: number) => {
    setDirection(next > step ? 1 : -1);
    setStep(next);
  };

  const motionProps = (custom: number) => (reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.12 } }
    : {
      initial: { opacity: 0, x: custom * 26 },
      animate: { opacity: 1, x: 0 },
      exit: { opacity: 0, x: custom * -26 },
      transition: { duration: 0.26, ease: EASE },
    });

  if (approved) return null;

  // ---------------------------------------------------------------------------
  // Envio concluído / solicitação em análise
  // ---------------------------------------------------------------------------
  if (submitted) {
    return (
      <section className="relative overflow-hidden rounded-[26px] bg-white text-[#0F1117] shadow-[0_30px_90px_rgba(15,17,23,0.20)]">
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="absolute right-4 top-4 z-20 grid h-9 w-9 place-items-center rounded-full text-white/70 transition hover:bg-white/15 hover:text-white"
          >
            <X size={17} strokeWidth={2.2} />
          </button>
        ) : null}

        <div className="relative overflow-hidden bg-gradient-to-br from-[#3B7BFF] via-[#2563EB] to-[#1E3A8A] px-7 pb-9 pt-10 text-center text-white">
          <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full border border-white/15" />
          <div className="pointer-events-none absolute -left-20 -bottom-24 h-56 w-56 rounded-full border border-white/10" />

          <motion.span
            initial={reduceMotion ? false : { scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="relative mx-auto grid h-16 w-16 place-items-center rounded-[22px] bg-white/15 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] backdrop-blur"
          >
            {justSent ? <CheckCircle2 size={30} strokeWidth={2} /> : <Clock3 size={28} strokeWidth={2} />}
          </motion.span>

          <motion.h2
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, ease: EASE, delay: 0.08 }}
            className="relative mt-5 text-[25px] font-black leading-[1.15] tracking-[-0.04em]"
          >
            {justSent ? "Solicitação enviada!" : "Sua solicitação está em análise"}
          </motion.h2>
          <motion.p
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, ease: EASE, delay: 0.14 }}
            className="relative mx-auto mt-2.5 max-w-[380px] text-[13.5px] font-medium leading-6 text-white/75"
          >
            Nosso time revisa seu perfil e avisa por e-mail assim que o acesso ao programa for liberado.
          </motion.p>
        </div>

        <div className="px-7 py-6">
          <div className="grid gap-2">
            {[
              { label: "Cadastro recebido", done: true },
              { label: "Análise do time Velo", done: false },
              { label: "Resposta por e-mail", done: false },
            ].map((item, index) => (
              <motion.div
                key={item.label}
                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, ease: EASE, delay: 0.18 + index * 0.06 }}
                className="flex items-center gap-3 rounded-[16px] border border-black/[0.07] bg-[#FAFAFA] px-4 py-3"
              >
                <span
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-black ${
                    item.done ? "bg-[#2563EB] text-white" : "bg-white text-black/35 shadow-[0_1px_3px_rgba(15,17,23,0.1)]"
                  }`}
                >
                  {item.done ? <Check size={14} strokeWidth={3} /> : index + 1}
                </span>
                <span className="text-[13px] font-bold text-[#0F1117]">{item.label}</span>
              </motion.div>
            ))}
          </div>

          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() => {
                setJustSent(false);
                setSubmitted(false);
                setStep(0);
              }}
              className="text-[12.5px] font-bold text-black/45 transition hover:text-black"
            >
              Revisar meu cadastro
            </button>

            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-[46px] items-center justify-center rounded-full bg-[#0F1117] px-7 text-[13.5px] font-black text-white transition hover:bg-black/85"
              >
                Entendi
              </button>
            ) : null}
          </div>
        </div>
      </section>
    );
  }

  // ---------------------------------------------------------------------------
  // Formulário em 3 passos
  // ---------------------------------------------------------------------------
  return (
    <section className="relative overflow-hidden rounded-[26px] bg-white text-[#0F1117] shadow-[0_30px_90px_rgba(15,17,23,0.20)]">
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar formulário de afiliados"
          className="absolute right-4 top-4 z-20 grid h-9 w-9 place-items-center rounded-full text-white/70 transition hover:bg-white/15 hover:text-white"
        >
          <X size={17} strokeWidth={2.2} />
        </button>
      ) : null}

      <header className="relative overflow-hidden bg-gradient-to-br from-[#3B7BFF] via-[#2563EB] to-[#1E3A8A] px-7 pb-6 pt-7 text-white">
        <div className="pointer-events-none absolute -right-14 -top-20 h-48 w-48 rounded-full border border-white/15" />
        <div className="pointer-events-none absolute -right-28 -top-6 h-48 w-48 rounded-full border border-white/10" />

        <div className="relative flex items-center gap-3.5">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[15px] bg-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] backdrop-blur">
            <BadgePercent size={21} strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <p className="text-[10.5px] font-black uppercase tracking-[0.14em] text-white/65">Programa de afiliados</p>
            <h2 className="mt-1 text-[22px] font-black leading-[1.15] tracking-[-0.04em]">Torne-se um afiliado Velo</h2>
          </div>
        </div>

        <p className="relative mt-3.5 max-w-[440px] text-[13px] font-medium leading-[1.55] text-white/72">
          Indique a Velo e ganhe 30% na primeira venda de cada cliente que assinar pelo seu link.
        </p>

        <div className="relative mt-6 flex items-center gap-2.5">
          {STEPS.map((label, index) => (
            <div key={label} className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="h-[3px] w-full overflow-hidden rounded-full bg-white/20">
                <motion.div
                  className="h-full rounded-full bg-white"
                  initial={false}
                  animate={{ width: index <= step ? "100%" : "0%" }}
                  transition={{ duration: reduceMotion ? 0 : 0.4, ease: EASE }}
                />
              </div>
              <span className={`truncate text-[10.5px] font-black tracking-[-0.005em] transition ${index <= step ? "text-white" : "text-white/45"}`}>
                {label}
              </span>
            </div>
          ))}
        </div>
      </header>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (step < STEPS.length - 1) {
            if (stepIsValid) goToStep(step + 1);
            return;
          }
          void submitApplication();
        }}
      >
        <div className="max-h-[min(52vh,440px)] overflow-y-auto px-7 py-6 [scrollbar-width:thin]">
          <AnimatePresence mode="wait" custom={direction} initial={false}>
            {step === 0 ? (
              <motion.div key="step-0" {...motionProps(direction)} className="grid gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <FieldLabel>Nome completo</FieldLabel>
                    <input value={fullName} onChange={(event) => setFullName(event.target.value)} className={inputClass} placeholder="Seu nome" />
                  </div>
                  <div>
                    <FieldLabel>E-mail</FieldLabel>
                    <input value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass} placeholder="seu@email.com" />
                  </div>
                  <div>
                    <FieldLabel>Telefone / WhatsApp</FieldLabel>
                    <input value={phone} onChange={(event) => setPhone(event.target.value)} className={inputClass} placeholder="(00) 00000-0000" />
                  </div>
                  <div>
                    <FieldLabel optional>CPF</FieldLabel>
                    <input value={cpf} onChange={(event) => setCpf(event.target.value)} className={inputClass} placeholder="000.000.000-00" />
                  </div>
                </div>
              </motion.div>
            ) : null}

            {step === 1 ? (
              <motion.div key="step-1" {...motionProps(direction)} className="grid gap-5">
                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <FieldLabel>Canais de divulgação</FieldLabel>
                    <button
                      type="button"
                      onClick={addSocial}
                      className="inline-flex h-7 items-center gap-1.5 rounded-full border border-black/[0.1] bg-white px-3 text-[11.5px] font-black text-[#0F1117] transition hover:border-black/25 hover:bg-[#FAFAFA]"
                    >
                      <Plus size={13} strokeWidth={2.6} /> Adicionar
                    </button>
                  </div>

                  <div className="grid gap-2">
                    <AnimatePresence initial={false}>
                      {socials.map((item) => (
                        <motion.div
                          key={item.id}
                          layout={!reduceMotion}
                          initial={reduceMotion ? false : { opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
                          transition={{ duration: 0.2, ease: EASE }}
                          className="grid gap-2 sm:grid-cols-[168px_minmax(0,1fr)_auto] sm:items-center"
                        >
                          <FormDropdown
                            label="Rede social"
                            value={item.platform}
                            options={SOCIAL_PLATFORMS.map((platform) => ({ value: platform, label: platform }))}
                            onChange={(value) => updateSocial(item.id, { platform: value as SocialPlatform })}
                            renderIcon={(value, active) => <SocialPlatformIcon platform={value} active={active} />}
                          />
                          <input
                            value={item.url}
                            onChange={(event) => updateSocial(item.id, { url: event.target.value })}
                            className={inputClass}
                            placeholder="@seuperfil ou link"
                          />
                          <button
                            type="button"
                            onClick={() => removeSocial(item.id)}
                            disabled={socials.length === 1}
                            aria-label="Remover canal"
                            className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-[14px] border border-black/[0.09] bg-white text-black/40 transition hover:border-[#E11D48]/30 hover:text-[#E11D48] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-black/[0.09] disabled:hover:text-black/40"
                          >
                            <Trash2 size={16} strokeWidth={2} />
                          </button>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <FieldLabel>Tamanho da audiência</FieldLabel>
                    <FormDropdown
                      label="Tamanho da audiência"
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

                <div>
                  <FieldLabel optional>Como pretende divulgar a Velo</FieldLabel>
                  <textarea
                    value={promotionPlan}
                    onChange={(event) => setPromotionPlan(event.target.value)}
                    className="min-h-[92px] w-full resize-none rounded-[16px] border border-black/[0.09] bg-[#F7F8FA] px-4 py-3 text-[13.5px] font-semibold leading-6 text-[#0F1117] outline-none transition placeholder:font-medium placeholder:text-black/30 focus:border-[#2563EB]/60 focus:bg-white focus:ring-4 focus:ring-[#2563EB]/12"
                    placeholder="Ex: conteúdos no Instagram, vídeos curtos, comunidade de e-commerce..."
                  />
                </div>
              </motion.div>
            ) : null}

            {step === 2 ? (
              <motion.div key="step-2" {...motionProps(direction)} className="grid gap-5">
                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <FieldLabel>Chaves Pix para receber</FieldLabel>
                    <button
                      type="button"
                      onClick={addPixKey}
                      className="inline-flex h-7 items-center gap-1.5 rounded-full border border-black/[0.1] bg-white px-3 text-[11.5px] font-black text-[#0F1117] transition hover:border-black/25 hover:bg-[#FAFAFA]"
                    >
                      <Plus size={13} strokeWidth={2.6} /> Adicionar
                    </button>
                  </div>

                  <div className="grid gap-2">
                    <AnimatePresence initial={false}>
                      {pixKeys.map((item) => (
                        <motion.div
                          key={item.id}
                          layout={!reduceMotion}
                          initial={reduceMotion ? false : { opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
                          transition={{ duration: 0.2, ease: EASE }}
                          className="grid gap-2 sm:grid-cols-[168px_minmax(0,1fr)_auto] sm:items-center"
                        >
                          <FormDropdown
                            label="Tipo de chave"
                            value={item.type}
                            options={PIX_KEY_TYPES.map((type) => ({ value: type, label: type }))}
                            onChange={(value) => updatePixKey(item.id, { type: value as PixKeyType })}
                          />
                          <input
                            value={item.value}
                            onChange={(event) => updatePixKey(item.id, { value: event.target.value })}
                            className={inputClass}
                            placeholder="Sua chave Pix"
                          />
                          <button
                            type="button"
                            onClick={() => removePixKey(item.id)}
                            disabled={pixKeys.length === 1}
                            aria-label="Remover chave Pix"
                            className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-[14px] border border-black/[0.09] bg-white text-black/40 transition hover:border-[#E11D48]/30 hover:text-[#E11D48] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-black/[0.09] disabled:hover:text-black/40"
                          >
                            <Trash2 size={16} strokeWidth={2} />
                          </button>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>

                <label className="flex cursor-pointer items-center gap-3 rounded-[16px] border border-black/[0.08] bg-[#F7F8FA] px-4 py-3.5 transition hover:border-black/[0.14]">
                  <input
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(event) => setAgreedToTerms(event.target.checked)}
                    className="peer sr-only"
                  />
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-[7px] border border-black/15 bg-white text-white transition peer-checked:border-[#2563EB] peer-checked:bg-[#2563EB]">
                    <Check size={13} strokeWidth={3} />
                  </span>
                  <span className="text-[12.5px] font-bold leading-5 text-black/60">
                    Concordo com os termos do programa de afiliados
                  </span>
                </label>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-black/[0.07] bg-[#FAFAFB] px-7 py-4">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => goToStep(step - 1)}
              className="inline-flex h-[44px] items-center gap-1.5 rounded-full px-4 text-[13px] font-black text-black/50 transition hover:bg-black/[0.05] hover:text-[#0F1117]"
            >
              <ArrowLeft size={16} strokeWidth={2.3} /> Voltar
            </button>
          ) : (
            <span className="text-[12px] font-bold text-black/35">Passo {step + 1} de {STEPS.length}</span>
          )}

          <motion.button
            type="submit"
            disabled={!stepIsValid || saving}
            whileTap={reduceMotion || !stepIsValid ? undefined : { scale: 0.98 }}
            className="inline-flex h-[44px] items-center justify-center gap-2 rounded-full bg-[#2563EB] px-6 text-[13.5px] font-black text-white shadow-[0_10px_24px_rgba(37,99,235,0.28)] transition hover:bg-[#1D4FD8] disabled:cursor-not-allowed disabled:bg-black/15 disabled:text-white/70 disabled:shadow-none"
          >
            {step < STEPS.length - 1 ? (
              <>
                Continuar <ArrowRight size={16} strokeWidth={2.4} />
              </>
            ) : saving ? (
              <>
                <Loader2 size={16} strokeWidth={2.4} className="animate-spin" /> Enviando...
              </>
            ) : (
              <>
                <Send size={15} strokeWidth={2.3} /> Enviar solicitação
              </>
            )}
          </motion.button>
        </footer>
      </form>
    </section>
  );
};

export const AffiliateQuizModal = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (typeof document === "undefined") return null;

  /*
    Portal para o <body>: o modal é montado dentro da página da rota, e qualquer
    ancestral com transform/filter vira containing block de `position: fixed` — foi
    exatamente esse o bug (overlay cobrindo só a área de conteúdo). No body, o
    `fixed inset-0` sempre se refere à viewport, independente do que houver acima.
  */
  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Programa de afiliados"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: EASE }}
          className="fixed inset-0 z-[120] flex items-center justify-center bg-[#0B0D12]/55 p-4 backdrop-blur-[3px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
        >
          <motion.div
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.975 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.985 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="max-h-[calc(100vh-32px)] w-full max-w-[620px] overflow-y-auto rounded-[26px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <AffiliateQuizContent onClose={onClose} modal />
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
};

const AffiliateQuizPage = () => <AffiliateQuizContent />;

export default AffiliateQuizPage;
