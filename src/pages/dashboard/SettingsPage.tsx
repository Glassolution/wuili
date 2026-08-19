import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { BadgeCheck, Bell, CheckCircle2, CreditCard, Loader2, Lock, MessageCircle, Plug, Shield, Sparkles, Store, Trash2, User, Zap } from "lucide-react";
import { useProfile } from "@/lib/profileContext";
import { useAuth } from "@/contexts/AuthContext";
import { isAdminEmail } from "@/lib/adminAccess";
import { supabase } from "@/integrations/supabase/client";
import PlatformLogo from "@/components/dashboard/PlatformLogo";
import { usePlan } from "@/hooks/usePlan";
import { PlanBadgeIcon, useUpgradeModal } from "@/components/PlansUpgradeModal";
import { PremiumActionButton } from "@/components/PremiumActionButton";
import RefundSection from "@/components/dashboard/RefundSection";
import SupportTab from "@/components/dashboard/SupportTab";
import UpgradeLimitModal from "@/components/UpgradeLimitModal";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { fetchUserProjects, type UserProject } from "@/lib/userProjects";
import { veloToast } from "@/components/ui/velo-toast";
import { startMercadoLivreOAuth } from "@/lib/mercadoLivreOAuth";
import MercadoPagoIntegrationCard from "@/components/dashboard/MercadoPagoIntegrationCard";
import ShopifyIntegrationCard from "@/components/dashboard/ShopifyIntegrationCard";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  NOTIFICATION_PREFERENCE_OPTIONS,
  fetchNotificationPreferences,
  saveNotificationPreferences,
  type NotificationPreferenceKey,
  type NotificationPreferences,
} from "@/lib/notifications";

type TabId = "Perfil" | "Minhas Lojas" | "Integrações" | "Plano" | "Notificações" | "Segurança" | "Suporte";

const NAV: { id: TabId; icon: typeof User; separatorBefore?: boolean }[] = [
  { id: "Perfil", icon: User },
  { id: "Minhas Lojas", icon: Store },
  { id: "Integrações", icon: Plug },
  { id: "Plano", icon: CreditCard },
  { id: "Notificações", icon: Bell },
  { id: "Segurança", icon: Shield },
  { id: "Suporte", icon: MessageCircle, separatorBefore: true },
];

const SettingsPage = () => {
  const [searchParams] = useSearchParams();
  const initialTab = (searchParams.get("tab") as TabId) || "Perfil";
  const [tab, setTab] = useState<TabId>(initialTab);
  useEffect(() => {
    const t = searchParams.get("tab") as TabId | null;
    if (t && t !== tab) setTab(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);
  const mobileTabRefs = useRef<Partial<Record<TabId, HTMLButtonElement | null>>>({});

  useEffect(() => {
    mobileTabRefs.current[tab]?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [tab]);

  // Largura única para toda a tela. Antes o Plano usava 980 e as demais abas
  // 720, e como a classe ficava no wrapper externo, trocar de aba mexia no
  // título e na barra de abas junto. A régua da página não pode depender da
  // aba aberta.
  const contentMaxWidth = "max-w-[720px]";

  return (
    <div className={`mx-auto w-full ${contentMaxWidth}`} style={{ minHeight: 'calc(100vh - 56px - 4rem)' }}>
      {/* Main */}
      <div className="min-w-0 flex-1 overflow-x-hidden px-3 py-4 md:px-0 md:py-6">
        <div className="mb-4">
          <h1 className="text-[19px] font-semibold tracking-[-0.015em] text-[#111113] dark:text-white sm:text-[20px]">
            Configurações
          </h1>
          <p className="mt-0.5 text-[12.5px] text-[#9A9A9A] dark:text-zinc-400">
            Gerencie seu perfil, lojas e preferências da conta.
          </p>
        </div>

        {/* Abas de configuração (estilo sublinhado) */}
        <div className="mb-6 border-b border-[#EDEDED] dark:border-white/10">
          <div className="flex w-full items-center justify-between gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: "none" }}>
            {NAV.map((item) => {
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  ref={(node) => { mobileTabRefs.current[item.id] = node; }}
                  onClick={() => setTab(item.id)}
                  className={`relative min-w-max flex-1 whitespace-nowrap px-1 pb-2 pt-1 text-center text-[12.5px] transition-colors ${
                    active
                      ? "font-semibold text-[#111113] dark:text-white"
                      : "font-normal text-[#9A9A9A] hover:text-[#111113] dark:text-zinc-500 dark:hover:text-white"
                  }`}
                >
                  {item.id}
                  {active && <span className="absolute inset-x-0 -bottom-px h-[2px] bg-[#111113] dark:bg-white" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="w-full">
          {tab === "Perfil"        && <ProfileTab />}
          {tab === "Minhas Lojas"  && <StoresTab />}
          {tab === "Integrações"   && <IntegrationsTab />}
          {tab === "Plano"         && <PlanTab />}
          {tab === "Notificações"  && <NotificationsTab />}
          {tab === "Segurança"     && <SecurityTab />}
          {tab === "Suporte"       && (
            <div className="space-y-6">
              <SupportTab />
              <RefundSection />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ──── shared field styles ──── */
const secondaryBtn =
  "inline-flex items-center justify-center px-5 py-2.5 rounded-full border border-black text-[14px] font-medium text-black bg-transparent hover:bg-black hover:text-white transition-colors dark:border-white dark:text-white dark:hover:bg-white dark:hover:text-black";
const divider = "my-6 border-t border-[#F0F0F0] dark:border-white/10";

/* ──── mockup profile: underline fields + solid/outline buttons ──── */
const fieldLabel = "block text-[13px] font-bold text-[#111113] mb-2 dark:text-white";
const underlineInput =
  "w-full h-10 bg-transparent border-0 border-b border-[#E2E2E2] px-0 text-[15px] text-[#0A0A0A] placeholder:text-[#B3B3B3] outline-none transition focus:border-[#2563EB] dark:border-white/15 dark:text-white dark:placeholder:text-zinc-500 dark:focus:border-[#60A5FA]";
const saveBtn =
  "inline-flex items-center justify-center rounded-[6px] bg-[#2563EB] px-6 py-2 text-[13px] font-medium text-white transition hover:bg-[#1D4ED8] dark:bg-[#2563EB] dark:text-white dark:hover:bg-[#1D4ED8]";
const cancelBtn =
  "inline-flex items-center justify-center rounded-[6px] border border-[#DFDFDF] bg-white px-6 py-2 text-[13px] font-medium text-[#111113] transition hover:border-[#111113] dark:border-white/20 dark:bg-transparent dark:text-white dark:hover:border-white";

/* ──── enterprise settings: linhas de duas colunas + input com borda ──── */
const rowDivider = "border-t border-[#EDEDED] dark:border-white/10";
const enterpriseInput =
  "w-full h-[38px] rounded-[9px] border border-[#E6E6E6] bg-white px-3 text-[13px] text-[#111113] shadow-[0_1px_2px_rgba(0,0,0,0.03)] placeholder:text-[#B5B5B5] outline-none transition focus:border-[#2563EB] dark:border-white/15 dark:bg-transparent dark:text-white dark:placeholder:text-zinc-500 dark:focus:border-[#60A5FA]";
const inputLabel = "mb-1.5 block text-[12px] font-medium tracking-[-0.005em] text-[#4A4A4A] dark:text-zinc-400";
const photoUploadBtn =
  "inline-flex items-center justify-center rounded-[9px] bg-[#2563EB] px-3.5 py-[7px] text-[12.5px] font-medium text-white transition hover:bg-[#1D4ED8] dark:bg-[#2563EB] dark:text-white dark:hover:bg-[#1D4ED8]";
const photoRemoveBtn =
  "inline-flex items-center justify-center rounded-[9px] border border-[#E6E6E6] bg-white px-3.5 py-[7px] text-[12.5px] font-medium text-[#111113] shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition hover:border-[#111113] dark:border-white/20 dark:bg-transparent dark:text-white dark:hover:border-white";

/* Linha de configuração: rótulo (semibold) + descrição em cinza à esquerda,
   campo com micro-label à direita. Empilha no mobile. */
const FieldRow = ({
  label,
  desc,
  fieldLabel: fieldLabelText,
  children,
}: {
  label: string;
  desc: string;
  fieldLabel?: string;
  children: React.ReactNode;
}) => (
  <div className="flex flex-col gap-2.5 py-5 md:flex-row md:items-center md:justify-between md:gap-10">
    <div className="md:max-w-[330px]">
      <p className="text-[13px] font-semibold tracking-[-0.005em] text-[#111113] dark:text-white">{label}</p>
      <p className="mt-0.5 text-[12px] leading-[1.45] text-[#9A9A9A] dark:text-zinc-400">{desc}</p>
    </div>
    <div className="w-full md:w-[300px] md:shrink-0">
      {fieldLabelText && <label className={inputLabel}>{fieldLabelText}</label>}
      {children}
    </div>
  </div>
);

/* Selo do plano exibido ao lado do nome. Assinantes ganham o selo colorido do
   plano; quem não tem assinatura vê apenas o texto "Gratuito". */
const PLAN_BADGE: Record<string, { label: string; className: string }> = {
  go: {
    label: "Go",
    className:
      "border-white/85 bg-gradient-to-br from-[#fbfbfa] via-[#ececea] to-[#c8c8c4] text-[#383835] shadow-[inset_0_1px_0_rgba(255,255,255,0.95)]",
  },
  base: {
    label: "Base",
    className:
      "border-white/85 bg-gradient-to-br from-[#fbfbfa] via-[#ececea] to-[#c8c8c4] text-[#383835] shadow-[inset_0_1px_0_rgba(255,255,255,0.95)]",
  },
  pro: {
    label: "Pro",
    className:
      "border-white/75 bg-gradient-to-br from-[#9287ff] via-[#6953ef] to-[#4925df] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.38)]",
  },
  business: {
    label: "Business",
    className:
      "border-white/70 bg-gradient-to-br from-[#313131] via-[#181818] to-[#050505] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]",
  },
};

const PlanSeal = () => {
  const { plan, status, loading } = usePlan();
  if (loading) return null;

  const badge = status === "active" ? PLAN_BADGE[plan] : undefined;

  if (!badge) {
    return (
      <span className="text-[12px] font-medium text-[#9A9A9A] dark:text-zinc-400">Gratuito</span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-[3px] text-[11px] font-semibold leading-none ${badge.className}`}
    >
      <BadgeCheck size={11} strokeWidth={2.5} />
      {badge.label}
    </span>
  );
};

/* ══ Profile ════════════════════════════════════════════ */
const ProfileTab = () => {
  const { nome, foto, setNome, setFoto } = useProfile();
  const { user } = useAuth();
  const [nomeEditado, setNomeEditado] = useState(nome);
  const [telefone, setTelefone] = useState("");
  const [telefoneOriginal, setTelefoneOriginal] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [fotoPreview, setFotoPreview] = useState<string | null>(foto);
  const [fotoFile, setFotoFile] = useState<string | null>(null);
  const [fotoRemovida, setFotoRemovida] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 900_000) {
      veloToast.error("Escolha uma imagem menor que 900 KB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result || "");
      setFotoPreview(url);
      setFotoFile(url);
      setFotoRemovida(false);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoverFoto = () => {
    setFotoPreview(null);
    setFotoFile(null);
    setFotoRemovida(true);
    if (inputRef.current) inputRef.current.value = "";
  };

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from("profiles")
      .select("whatsapp")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.whatsapp) {
          setTelefone(data.whatsapp);
          setTelefoneOriginal(data.whatsapp);
        }
      });
  }, [user?.id]);

  const handleCancelar = () => {
    setNomeEditado(nome);
    setTelefone(telefoneOriginal);
    setFotoPreview(foto);
    setFotoFile(null);
    setFotoRemovida(false);
  };

  const handleSalvar = async () => {
    const toastId = veloToast.loading("Salvando configurações...");
    try {
      if (user?.id) {
        const profilePayload = {
          display_name: nomeEditado,
          whatsapp: telefone,
          ...(fotoRemovida ? { avatar_url: null } : fotoFile ? { avatar_url: fotoFile } : {}),
        };

        const { data: updated, error } = await supabase
          .from("profiles")
          .update(profilePayload)
          .eq("user_id", user.id)
          .select("user_id");

        if (error) throw error;

        if (!updated || updated.length === 0) {
          const { error: insertError } = await supabase.from("profiles").insert({
            user_id: user.id,
            ...profilePayload,
          });

          if (insertError) throw insertError;
        }
      }

      setNome(nomeEditado);
      if (fotoRemovida) setFoto("");
      else if (fotoFile) setFoto(fotoFile);
      setFotoRemovida(false);
      setFotoFile(null);
      veloToast.success("Configurações salvas com sucesso.", { id: toastId });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível salvar as configurações.";
      veloToast.error(message, { id: toastId });
    }
  };

  const avatarSrc = fotoRemovida ? null : (fotoPreview ?? foto);
  // Fallback de iniciais quando não há foto (evita imagem padrão externa quebrada).
  const iniciais = (nome || user?.email || "U")
    .split(/[\s@]/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();

  return (
    <div data-dashboard-tour="configuracoes-perfil">
      {/* Identidade: foto + nome com selo do plano ao lado; ações de foto abaixo */}
      <div className="pb-5">
        <div className="flex items-center gap-3.5">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#2F2F2F] text-[16px] font-semibold text-white dark:bg-white dark:text-black">
            {avatarSrc ? <img src={avatarSrc} alt="Foto de perfil" className="h-full w-full object-cover" /> : iniciais}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-[15px] font-semibold tracking-[-0.01em] text-[#111113] dark:text-white">
                {nomeEditado || nome || (user?.email?.split("@")[0] ?? "Sua conta")}
              </p>
              <PlanSeal />
            </div>
            <p className="mt-0.5 truncate text-[12px] text-[#9A9A9A] dark:text-zinc-400">{user?.email ?? ""}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => inputRef.current?.click()} className={photoUploadBtn}>
            Enviar foto
          </button>
          <button type="button" onClick={handleRemoverFoto} className={photoRemoveBtn}>
            Remover
          </button>
        </div>
        <p className="mt-1.5 text-[11.5px] text-[#9A9A9A] dark:text-zinc-400">Formato quadrado (1:1), até 900 KB.</p>

        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFoto} />
      </div>

      <div className={rowDivider} />

      {/* Linhas de duas colunas */}
      <FieldRow label="Nome" desc="Como você aparece na sua conta e nas suas lojas." fieldLabel="Nome completo">
        <input
          className={enterpriseInput}
          placeholder="Seu nome"
          value={nomeEditado}
          onChange={(e) => setNomeEditado(e.target.value)}
        />
      </FieldRow>

      <div className={rowDivider} />

      <FieldRow label="Telefone" desc="Usado para contato e recuperação da sua conta." fieldLabel="Telefone">
        <input
          className={enterpriseInput}
          placeholder="(00) 00000-0000"
          value={telefone}
          onChange={(e) => setTelefone(e.target.value)}
        />
      </FieldRow>

      <div className={rowDivider} />

      <FieldRow label="CPF/CNPJ" desc="Necessário para emissão de notas fiscais e repasses." fieldLabel="Documento">
        <input
          className={enterpriseInput}
          placeholder="000.000.000-00"
          value={cpfCnpj}
          onChange={(e) => setCpfCnpj(e.target.value)}
        />
      </FieldRow>

      <div className={rowDivider} />

      <FieldRow label="E-mail" desc="Endereço de login da conta. Não pode ser alterado por aqui." fieldLabel="E-mail">
        <div className="relative">
          <input
            readOnly
            value={user?.email ?? ""}
            className={`${enterpriseInput} cursor-not-allowed pr-8 text-[#8A8A8A] dark:text-zinc-400`}
          />
          <Lock size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#B5B5B5]" />
        </div>
      </FieldRow>

      <div className={rowDivider} />

      {/* Ações */}
      <div className="mt-6 flex items-center justify-end gap-2.5">
        <button onClick={handleCancelar} className={cancelBtn}>Cancelar</button>
        <button onClick={handleSalvar} className={saveBtn}>Salvar alterações</button>
      </div>
    </div>
  );
};

/* ══ Stores ═════════════════════════════════════════════ */
const LegacyStoresTab = () => (
  <div className="space-y-4">
    <h2 className="text-[18px] font-semibold text-[#0A0A0A] dark:text-white mb-1">Minhas lojas</h2>
    <p className="text-[13px] text-[#737373] dark:text-zinc-400 mb-4">Gerencie as lojas conectadas à sua conta.</p>

    <div className="p-4 rounded-2xl border border-[#E5E5E5] dark:border-zinc-800 dark:bg-zinc-950 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <p className="font-normal text-[#0A0A0A] dark:text-white">Velo</p>
          <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-black text-white font-semibold dark:bg-white dark:text-black">Ativa</span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-sm sm:gap-4">
        <div><p className="text-[#A3A3A3] dark:text-zinc-500 text-xs uppercase tracking-wider">Template</p><p className="font-medium text-[#0A0A0A] dark:text-white mt-0.5">Moderno</p></div>
        <div><p className="text-[#A3A3A3] dark:text-zinc-500 text-xs uppercase tracking-wider">Produtos</p><p className="font-medium text-[#0A0A0A] dark:text-white mt-0.5">8</p></div>
        <div><p className="text-[#A3A3A3] dark:text-zinc-500 text-xs uppercase tracking-wider">Vendas</p><p className="font-medium text-[#0A0A0A] dark:text-white mt-0.5">23</p></div>
      </div>
    </div>
    <button className={secondaryBtn}>+ Nova loja</button>
  </div>
);

/* ══ Integrations ════════════════════════════════════════ */
const formatProjectDate = (value: string) =>
  new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

/* Os projetos (lojas completas e páginas de venda) moram no Supabase, em
   user_projects. Antes esta aba lia uma lista do localStorage escrita pelo
   onboarding, então quem criava página com IA continuava vendo "nenhuma loja". */
const StoresTab = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [projects, setProjects] = useState<UserProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setProjects([]);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setErro(null);

    void (async () => {
      try {
        const data = await fetchUserProjects();
        if (!active) return;
        setProjects(
          [...data].sort(
            (a, b) => new Date(b.last_edited_at).getTime() - new Date(a.last_edited_at).getTime(),
          ),
        );
      } catch (error) {
        console.error("Falha ao carregar projetos:", error);
        if (active) setErro("Não foi possível carregar suas lojas agora.");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [user?.id]);

  return (
    <div>
      <h2 className="text-[18px] font-semibold text-[#0A0A0A] dark:text-white">Minhas lojas</h2>
      <p className="mt-1 text-[13px] text-[#737373] dark:text-zinc-400">
        Lojas completas e páginas de venda criadas pela sua conta.
      </p>

      <div className="mt-5 space-y-2.5">
        {loading ? (
          <div className="flex items-center gap-2 py-10 text-[13px] text-[#9A9A9A]">
            <Loader2 size={14} className="animate-spin" />
            Carregando suas lojas...
          </div>
        ) : erro ? (
          <div className="rounded-2xl border border-[#F0D2D2] bg-[#FEF6F6] p-5 text-[13px] text-[#B42318] dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
            {erro}
          </div>
        ) : projects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#D8DEE9] bg-[#F8FAFC] p-6 text-center dark:border-zinc-800 dark:bg-zinc-950">
            <p className="text-[13px] font-medium text-[#111113] dark:text-white">Nenhuma loja criada ainda.</p>
            <p className="mt-1 text-[12.5px] text-[#697386] dark:text-zinc-400">
              Crie uma loja completa ou uma página de venda com IA para ela aparecer aqui.
            </p>
            <button
              type="button"
              onClick={() => navigate("/dashboard/minha-loja")}
              className="mt-4 inline-flex h-9 items-center justify-center rounded-[9px] bg-[#2563EB] px-4 text-[12.5px] font-medium text-white transition hover:bg-[#1D4ED8] dark:bg-[#2563EB] dark:text-white dark:hover:bg-[#1D4ED8]"
            >
              Criar projeto
            </button>
          </div>
        ) : (
          projects.map((project) => {
            const isLoja = project.tipo_projeto === "loja_completa";
            const publicado = project.status === "publicado";
            return (
              <button
                key={project.id}
                type="button"
                onClick={() =>
                  navigate(`/minha-loja/editor/${project.id}`, {
                    state: { projectId: project.id, sourceId: project.source_id },
                  })
                }
                className="flex w-full items-center gap-3 rounded-2xl border border-[#E5E5E5] p-4 text-left transition hover:border-[#111113] dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-white/40 sm:p-5"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-[#F4F4F5] text-[#6B6B70] dark:bg-white/5 dark:text-zinc-300">
                  {isLoja ? <Store size={17} /> : <Sparkles size={17} />}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium text-[#0A0A0A] dark:text-white">
                    {project.nome || (isLoja ? "Minha loja" : "Página de venda")}
                  </span>
                  <span className="mt-0.5 block truncate text-[11.5px] text-[#9A9A9A] dark:text-zinc-500">
                    {isLoja ? "Loja completa" : "Página de venda"} · editada em{" "}
                    {formatProjectDate(project.last_edited_at)}
                  </span>
                </span>

                <span
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    publicado
                      ? "bg-[#ECFDF3] text-[#15803D] dark:bg-emerald-500/15 dark:text-emerald-300"
                      : "bg-[#F4F4F5] text-[#6B6B70] dark:bg-white/10 dark:text-zinc-300"
                  }`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {publicado ? "Publicada" : "Rascunho"}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

type Integration = { platform: string; label: string; connected: boolean; loading?: boolean; comingSoon?: boolean };

const IntegrationsTab = () => {
  const { user, role } = useAuth();
  const isAdmin = role === "admin" || isAdminEmail(user?.email);
  const planLimits = usePlanLimits();
  // Integrações ficam liberadas em todos os planos, inclusive no gratuito.
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [integrations, setIntegrations] = useState<Integration[]>([
    { platform: "mercadolivre", label: "Mercado Livre", connected: false, loading: true },
    { platform: "shopee",       label: "Shopee",        connected: false, comingSoon: true },
    { platform: "amazon",       label: "Amazon",        connected: false, comingSoon: true },
    { platform: "shopify",      label: "Shopify",       connected: false, comingSoon: true },
  ]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_integrations")
      .select("platform")
      .eq("user_id", user.id)
      .then(({ data }) => {
        const connected = new Set((data ?? []).map((r: { platform: string }) => r.platform));
        setIntegrations((prev) =>
          prev.map((i) => ({
            ...i,
            connected: i.platform === "mercadolivre" ? connected.has(i.platform) : false,
            loading: false,
          }))
        );
      });
  }, [user]);

  const handleConnect = async (platform: string) => {
    if (platform === "mercadolivre" && user) {
      const toastId = veloToast.loading("Conectando com o Mercado Livre...");
      try {
        await startMercadoLivreOAuth();
        veloToast.dismiss(toastId);
      } catch (err) {
        veloToast.error("Não foi possível iniciar a conexão com o Mercado Livre", { id: toastId });
        return;
      }
      return;
    }

    if (platform !== "mercadolivre") {
      if (planLimits.loading) return;

      if (!planLimits.canConnectMarketplace) {
        setUpgradeModalOpen(true);
      }
    }
  };

  const handleDisconnect = async (platform: string) => {
    if (platform !== "mercadolivre" || !user) return;

    setIntegrations((prev) =>
      prev.map((item) => (item.platform === platform ? { ...item, loading: true } : item))
    );
    const toastId = veloToast.loading("Desconectando Mercado Livre...");
    const { error } = await supabase
      .from("user_integrations")
      .delete()
      .eq("user_id", user.id)
      .eq("platform", platform);

    if (error) {
      veloToast.error("Não foi possível desconectar o Mercado Livre", { id: toastId });
      setIntegrations((prev) =>
        prev.map((item) => (item.platform === platform ? { ...item, loading: false } : item))
      );
      return;
    }

    veloToast.success("Mercado Livre desconectado", { id: toastId });
    setIntegrations((prev) =>
      prev.map((item) => (item.platform === platform ? { ...item, connected: false, loading: false } : item))
    );
  };
  const marketplaceUpgradeTargetPlan: "pro" | "business" = planLimits.plan === "pro" ? "business" : "pro";
  const marketplaceUpgradeBenefits = marketplaceUpgradeTargetPlan === "business"
    ? ["Marketplaces ilimitados", "Produtos ilimitados", "Analytics premium", "Processamento prioritário"]
    : ["Até 2 marketplaces", "Publicação automática", "Monitoramento básico 24h", "Suporte prioritário"];

  return (
    <div>
      <h2 className="text-[18px] font-semibold text-[#0A0A0A] dark:text-white mb-1">Integrações</h2>
      <p className="text-[13px] text-[#737373] dark:text-zinc-400 mb-5">Conecte suas plataformas de venda e recebimento.</p>

      {isAdmin && (
        <div className="mb-4">
          <h3 className="mb-2 text-[13px] font-semibold text-[#0A0A0A] dark:text-white">Pagamentos</h3>
          <MercadoPagoIntegrationCard />
        </div>
      )}

      {isAdmin && (
        <div className="mb-4">
          <h3 className="mb-2 text-[13px] font-semibold text-[#0A0A0A] dark:text-white">Loja</h3>
          <ShopifyIntegrationCard />
        </div>
      )}

      <h3 className="mb-2 text-[13px] font-semibold text-[#0A0A0A] dark:text-white">Marketplaces</h3>

      <div className="relative">
      <div className="space-y-2.5">
        {integrations.map((i) => (
          <div
            key={i.platform}
            title={i.comingSoon ? "Disponível em breve" : undefined}
            className={`flex flex-col gap-3 rounded-xl border border-[#E5E5E5] p-4 dark:border-zinc-800 dark:bg-zinc-950 sm:flex-row sm:items-center sm:justify-between ${
              i.comingSoon ? "bg-[#F7F7F7] dark:bg-zinc-900" : ""
            }`}
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#E5E5E5] bg-white p-1 dark:border-white/10 dark:bg-white">
                <PlatformLogo platform={i.label} size={38} />
              </span>
              <span className="min-w-0 truncate text-[14px] font-normal text-[#0A0A0A] dark:text-white">{i.label}</span>
            </div>
            {i.loading ? (
              <Loader2 size={16} className="animate-spin text-[#A3A3A3] dark:text-zinc-400" />
            ) : i.comingSoon ? (
              <span className="flex w-fit items-center gap-1.5 rounded-full bg-[#E5E5E5] px-2.5 py-1 text-[11px] font-normal text-[#737373] dark:bg-zinc-800 dark:text-zinc-400">
                Em breve
              </span>
            ) : i.connected ? (
              <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
                <span className="flex min-w-0 items-center gap-1.5 rounded-full bg-[#2563EB] px-2.5 py-1 text-[11px] font-semibold text-white dark:bg-[#2563EB] dark:text-white">
                  <CheckCircle2 size={12} /> Conectado
                </span>
                <button
                  type="button"
                  onClick={() => handleDisconnect(i.platform)}
                  className="shrink-0 rounded-full border border-[#E5E5E5] bg-white px-3 py-1 text-[11px] font-semibold text-[#0A0A0A] transition hover:border-[#0A0A0A] dark:border-white/10 dark:bg-zinc-950 dark:text-white dark:hover:border-white"
                >
                  Desconectar
                </button>
              </div>
            ) : (
              <button
                onClick={() => handleConnect(i.platform)}
                className="w-full rounded-full bg-[#2563EB] px-3.5 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-[#1D4ED8] dark:bg-[#2563EB] dark:text-white dark:hover:bg-[#1D4ED8] sm:w-auto"
              >
                Conectar +
              </button>
            )}
          </div>
        ))}
      </div>
      </div>

      <p className="mt-4 text-[11px] text-[#A3A3A3] dark:text-zinc-400">
        Mercado Livre é a única integração disponível agora. Shopee, Amazon e Shopify chegam em breve.
      </p>

      <UpgradeLimitModal
        open={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        title="Limite de marketplaces atingido"
        message="Seu plano atual não permite conectar outro marketplace. Faça upgrade para liberar mais integrações."
        cta={marketplaceUpgradeTargetPlan === "business" ? "Upgrade Business" : "Desbloquear operação completa"}
        targetPlan={marketplaceUpgradeTargetPlan}
        benefits={marketplaceUpgradeBenefits}
      />
    </div>
  );
};

/* ══ Plan ════════════════════════════════════════════════ */
const PLAN_DATA = [
  {
    id: "gratis",
    name: "Grátis",
    price: "R$0",
    period: "/mês",
    description: "Para explorar a Velo sem compromisso antes de começar a vender.",
    features: ["Exploração do catálogo", "Dashboard demonstrativo", "IA básica de teste"],
  },
  {
    id: "base",
    name: "Base",
    price: "R$39,90",
    period: "/mês",
    description: "Pra quem quer começar a vender sem travar no operacional.",
    features: [
      "Até 50 produtos publicados",
      "1 marketplace conectado",
      "1 página de vendas por IA",
      "Catálogo validado completo",
      "Analytics básico",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "R$79,80",
    period: "/mês",
    description: "Para validar produtos, publicar com segurança e operar com IA sem complexidade.",
    features: [
      "Até 30 produtos publicados",
      "Até 2 marketplaces conectados",
      "Até 3 agentes IA",
      "Automações limitadas",
      "Analytics básico",
    ],
  },
  {
    id: "business",
    name: "Business",
    price: "R$159,60",
    period: "/mês",
    description: "Para quem quer escalar catálogo, automações e análise avançada sem limites.",
    features: [
      "Produtos ilimitados",
      "Marketplaces ilimitados",
      "Agentes IA ilimitados",
      "Automações ilimitadas",
      "IA estratégica avançada",
    ],
  },
];

const PlanTab = () => {
  const upgradeModal = useUpgradeModal();
  const { plan } = usePlan();
  const normalizedPlan = plan;
  const paidPlans = PLAN_DATA.filter((p) => p.id === "base" || p.id === "pro" || p.id === "business");

  const openUpgrade = (planId: string) => {
    upgradeModal.open({ defaultPlan: planId === "business" ? "business" : planId === "base" ? "base" : "pro" });
  };

  return (
    <div className="pb-10">
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-[19px] font-semibold tracking-[-0.02em] text-[#111113] dark:text-white">
            Escolha seu plano
          </h2>
          <p className="mt-1 max-w-[520px] text-[13px] leading-relaxed text-[#737373] dark:text-zinc-400">
            Compare os três planos atuais da Velo e escolha o nível ideal para sua operação.
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[#E8E8E8] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#3F3F46] shadow-[0_10px_24px_rgba(15,15,15,0.04)] dark:border-white/10 dark:bg-zinc-950 dark:text-zinc-200">
          <Zap size={12} fill="currentColor" />
          Planos atuais
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {paidPlans.map((p) => {
          const isCurrent = p.id === normalizedPlan;
          const isPro = p.id === "pro";
          return (
            <article
              key={p.id}
              className={`relative flex min-h-[440px] flex-col rounded-[24px] border bg-white p-5 shadow-[0_18px_54px_rgba(15,15,15,0.055)] transition duration-200 dark:bg-zinc-950 ${
                isPro
                  ? "border-[#111113] ring-1 ring-black/10"
                  : isCurrent
                    ? "border-[#111113] dark:border-white"
                    : "border-[#E8E8E8] dark:border-white/10"
              }`}
            >
              {isPro ? (
                <span aria-hidden="true" className="absolute inset-x-5 top-0 h-[3px] rounded-b-full bg-[#111113]" />
              ) : null}

              <div className="flex items-start justify-between gap-3">
                <div>
                  {/* Mesmo selo do modal de planos, importado de lá para os dois
                      não divergirem. */}
                  <PlanBadgeIcon variant={p.id as "base" | "pro" | "business"} />
                  <h3 className="mt-5 text-[19px] font-semibold tracking-[-0.02em] text-[#111113] dark:text-white">
                    {p.name}
                  </h3>
                </div>
                {isCurrent ? (
                  <span className="rounded-full bg-[#111113] px-2.5 py-1 text-[10px] font-semibold text-white dark:bg-white dark:text-black">
                    Atual
                  </span>
                ) : isPro ? (
                  <span className="rounded-full bg-[#F2F2F2] px-2.5 py-1 text-[10px] font-semibold text-[#111113] dark:bg-white/10 dark:text-white">
                    Mais escolhido
                  </span>
                ) : null}
              </div>

              <p className="mt-4 min-h-[54px] text-[13px] leading-relaxed text-[#737373] dark:text-zinc-400">
                {p.description}
              </p>

              <div className="mt-5 flex items-end gap-1 text-[#111113] dark:text-white">
                <span className="text-[34px] font-semibold leading-none tracking-[-0.045em]">{p.price}</span>
                <span className="pb-1 text-[12px] text-[#737373] dark:text-zinc-400">{p.period}</span>
              </div>

              <PremiumActionButton
                type="button"
                disabled={isCurrent}
                onClick={() => openUpgrade(p.id)}
                background="linear-gradient(180deg,#1F2633 0%,#111722 52%,#0B101A 100%)"
                className="mt-5 h-10 w-full rounded-[10px] px-4 text-[12.5px] disabled:cursor-default disabled:bg-[#EFEFEF] disabled:text-[#A3A3A3] disabled:shadow-none disabled:hover:translate-y-0 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
              >
                {isCurrent ? "Plano atual" : "Fazer upgrade"}
              </PremiumActionButton>

              <ul className="mt-5 flex-1 space-y-3">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[12px] leading-snug text-[#27272A] dark:text-zinc-200">
                    <BadgeCheck size={14} className="mt-0.5 shrink-0 text-[#111113] dark:text-white" fill="currentColor" strokeWidth={1.8} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>
    </div>
  );
};

/* ══ Notifications ═══════════════════════════════════════ */
const NotificationsTab = () => {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<NotificationPreferenceKey | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    fetchNotificationPreferences(user.id)
      .then((prefs) => {
        if (!cancelled) setPreferences(prefs);
      })
      .catch((error) => {
        console.warn("[notifications] nao foi possivel carregar preferencias:", error);
        if (!cancelled) veloToast.error("Nao foi possivel carregar suas preferencias.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const togglePreference = async (key: NotificationPreferenceKey) => {
    if (!user?.id || savingKey) return;
    const next = { ...preferences, [key]: !preferences[key] };
    const previous = preferences;
    setPreferences(next);
    setSavingKey(key);
    try {
      await saveNotificationPreferences(user.id, next);
    } catch (error) {
      console.warn("[notifications] nao foi possivel salvar preferencias:", error);
      setPreferences(previous);
      veloToast.error("Nao foi possivel salvar essa preferencia.");
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[18px] font-semibold text-[#0A0A0A] dark:text-white mb-1">Notificações</h2>
          <p className="text-[13px] text-[#737373] dark:text-zinc-400">Escolha quando quer ser avisado.</p>
        </div>
        {loading && <Loader2 size={17} className="mt-1 animate-spin text-[#9A9A9A]" />}
      </div>

      <div className="space-y-2.5">
        {NOTIFICATION_PREFERENCE_OPTIONS.map((option) => {
          const checked = preferences[option.key];
          const isSaving = savingKey === option.key;
          return (
          <div key={option.key} className="flex items-center justify-between gap-5 rounded-xl border border-[#E5E5E5] p-3.5 dark:border-zinc-800 dark:bg-zinc-950">
            <span className="min-w-0">
              <span className="block text-[14px] font-medium text-[#0A0A0A] dark:text-white">{option.label}</span>
              <span className="mt-0.5 block text-[12px] leading-snug text-[#8A8A8A] dark:text-zinc-500">{option.description}</span>
            </span>
            <button
              type="button"
              disabled={loading || Boolean(savingKey)}
              onClick={() => void togglePreference(option.key)}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:cursor-wait disabled:opacity-60 ${
                checked ? "bg-[#2563EB] dark:bg-[#2563EB]" : "bg-[#E5E5E5] dark:bg-zinc-700"
              }`}
              aria-pressed={checked}
              aria-label={`Alternar ${option.label}`}
            >
              <span
                className={`absolute top-1 h-4 w-4 rounded-full transition-all ${
                  checked ? "left-6 bg-white dark:bg-white" : "left-1 bg-white dark:bg-zinc-300"
                } ${isSaving ? "scale-90" : ""}`}
              />
            </button>
          </div>
          );
        })}
      </div>
    </div>
  );
};

/* ══ Security ════════════════════════════════════════════ */
const sectionTitle = "text-[16px] font-bold text-[#111113] dark:text-white";

const SecurityTab = () => {
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);

  const handleExcluirConta = async () => {
    if (deleting) return;
    if (!window.confirm("Tem certeza? Essa acao nao pode ser desfeita. Sua conta e todos os dados serao excluidos permanentemente.")) return;
    if (!window.confirm("Confirmacao final: excluir sua conta agora?")) return;
    setDeleting(true);
    try {
      const { error } = await supabase.functions.invoke("delete-account", { body: {} });
      if (error) throw error;
      await supabase.auth.signOut();
      veloToast.success("Sua conta foi excluida.");
      navigate("/", { replace: true });
    } catch (e) {
      console.error("[delete-account] falha", e);
      veloToast.error("Nao foi possivel excluir a conta. Tente novamente.");
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Alterar senha */}
      <div>
        <h2 className={sectionTitle}>Alterar senha</h2>
        <p className="mt-1 text-[13px] text-[#737373] dark:text-zinc-400">Use uma senha forte que voce nao usa em outros lugares.</p>
        <div className="mt-6 space-y-6">
          {["Senha atual", "Nova senha", "Confirmar nova senha"].map((l) => (
            <div key={l}>
              <label className={fieldLabel}>{l}</label>
              <input type="password" placeholder="••••••••" className={underlineInput} />
            </div>
          ))}
        </div>
        <div className="mt-7">
          <button className={saveBtn}>Salvar</button>
        </div>
      </div>

      <div className={divider} />

      {/* 2FA */}
      <div>
        <h3 className={sectionTitle}>Autenticacao de dois fatores</h3>
        <div className="mt-4 flex items-center justify-between border-b border-black/[0.08] pb-4 dark:border-white/10">
          <span className="text-[14px] text-[#171717] dark:text-white">2FA ativado</span>
          <div className="relative h-6 w-11 rounded-full bg-[#E5E5E5] dark:bg-zinc-700">
            <div className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white" />
          </div>
        </div>
      </div>

      <div className={divider} />

      {/* Excluir conta */}
      <div>
        <h3 className={sectionTitle}>Excluir conta</h3>
        <p className="mt-1 max-w-[520px] text-[13px] leading-relaxed text-[#737373] dark:text-zinc-400">
          Ao excluir sua conta, todos os seus dados serao removidos permanentemente. Esta acao nao pode ser desfeita.
        </p>
        <button
          type="button"
          onClick={handleExcluirConta}
          disabled={deleting}
          className="mt-5 inline-flex items-center gap-2 rounded-[10px] border border-[#ef4444]/55 bg-white px-7 py-3 text-[14px] font-semibold text-[#ef4444] transition hover:bg-[#ef4444] hover:text-white disabled:opacity-60 dark:bg-transparent"
        >
          <Trash2 size={16} /> {deleting ? "Excluindo..." : "Excluir conta"}
        </button>
      </div>
    </div>
  );
};

export default SettingsPage;
