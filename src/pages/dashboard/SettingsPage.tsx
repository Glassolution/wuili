import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Bell, Camera, CheckCircle2, CreditCard, Loader2, Lock, MessageCircle, Plug, Shield, Store, Trash2, User } from "lucide-react";
import { useProfile } from "@/lib/profileContext";
import { useAuth } from "@/contexts/AuthContext";
import { isAdminEmail } from "@/lib/adminAccess";
import { supabase } from "@/integrations/supabase/client";
import PlanBadge from "@/components/PlanBadge";
import PlatformLogo from "@/components/dashboard/PlatformLogo";
import { usePlan } from "@/hooks/usePlan";
import { useUpgradeModal } from "@/components/PlansUpgradeModal";
import SupportTab from "@/components/dashboard/SupportTab";
import UpgradeLimitModal from "@/components/UpgradeLimitModal";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import {
  readUserStores,
  STORES_CHANGED_EVENT,
  type VeloStore,
} from "@/components/dashboard/FirstStoreOnboarding";
import { veloToast } from "@/components/ui/velo-toast";
import { startMercadoLivreOAuth } from "@/lib/mercadoLivreOAuth";
import MercadoPagoIntegrationCard from "@/components/dashboard/MercadoPagoIntegrationCard";
import ShopifyIntegrationCard from "@/components/dashboard/ShopifyIntegrationCard";
import defaultAvatar from "@/assets/default-avatar.png.asset.json";

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
  const isSupportTab = tab === "Suporte";
  useEffect(() => {
    const t = searchParams.get("tab") as TabId | null;
    if (t && t !== tab) setTab(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);
  const mobileTabRefs = useRef<Partial<Record<TabId, HTMLButtonElement | null>>>({});
  const { nome, foto } = useProfile();
  const { user } = useAuth();

  const iniciais = (nome || user?.email || "U")
    .split(/[\s@]/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();

  useEffect(() => {
    mobileTabRefs.current[tab]?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [tab]);

  return (
    <div className="mx-auto w-full max-w-[760px]" style={{ minHeight: 'calc(100vh - 56px - 4rem)' }}>
      {/* Main */}
      <div className={isSupportTab ? "min-w-0 flex-1 overflow-x-hidden px-0 py-0 md:px-0 md:py-6" : "min-w-0 flex-1 overflow-x-hidden px-3 py-4 md:px-0 md:py-6"}>
        <div className={`mb-4 rounded-2xl border border-[#E5E5E5] bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 ${isSupportTab ? "hidden md:block" : ""}`}>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-black text-base font-semibold text-white dark:bg-white dark:text-black">
              <img src={foto || defaultAvatar.url} alt="" className="h-full w-full object-cover" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[16px] font-semibold text-[#0A0A0A] dark:text-white">{nome || "Usuário"}</p>
              <div className="mt-1"><PlanBadge size="sm" /></div>
            </div>
          </div>
        </div>

        {/* Abas de configuração (estilo sublinhado) */}
        <div className={`mb-6 border-b border-black/[0.14] dark:border-white/15 ${isSupportTab ? "hidden md:block" : ""}`}>
          <div className="flex items-center justify-between gap-6 overflow-x-auto [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: "none" }}>
            {NAV.map((item) => {
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  ref={(node) => { mobileTabRefs.current[item.id] = node; }}
                  onClick={() => setTab(item.id)}
                  className={`relative shrink-0 whitespace-nowrap pb-3 pt-1 text-[14px] transition-colors ${
                    active
                      ? "font-semibold text-[#0A0A0A] dark:text-white"
                      : "font-medium text-[#737373] hover:text-[#0A0A0A] dark:text-zinc-400 dark:hover:text-white"
                  }`}
                >
                  {item.id}
                  {active && <span className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-[#0A0A0A] dark:bg-white" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className={isSupportTab ? "mx-auto w-full max-w-[760px] bg-white dark:bg-zinc-900 md:rounded-2xl md:border md:border-[#EFEFEF] md:p-6 md:shadow-[0_1px_3px_rgba(0,0,0,0.08)] md:dark:border-zinc-800" : "mx-auto w-full max-w-[760px] rounded-2xl border border-[#EFEFEF] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.08)] dark:border-zinc-800 dark:bg-zinc-900 sm:p-5 md:p-6"}>
          {tab === "Perfil"        && <ProfileTab />}
          {tab === "Minhas Lojas"  && <StoresTab />}
          {tab === "Integrações"   && <IntegrationsTab />}
          {tab === "Plano"         && <PlanTab />}
          {tab === "Notificações"  && <NotificationsTab />}
          {tab === "Segurança"     && <SecurityTab />}
          {tab === "Suporte"       && <SupportTab />}
        </div>
      </div>
    </div>
  );
};

/* ──── shared field styles ──── */
const primaryBtn =
  "inline-flex items-center justify-center px-7 py-3 rounded-full bg-black text-white text-[14px] font-medium hover:opacity-85 transition-opacity dark:bg-white dark:text-black";
const secondaryBtn =
  "inline-flex items-center justify-center px-5 py-2.5 rounded-full border border-black text-[14px] font-medium text-black bg-transparent hover:bg-black hover:text-white transition-colors dark:border-white dark:text-white dark:hover:bg-white dark:hover:text-black";
const divider = "my-6 border-t border-[#F0F0F0] dark:border-white/10";

/* ──── mockup profile: underline fields + solid/outline buttons ──── */
const fieldLabel = "block text-[13px] font-bold text-[#111113] mb-2 dark:text-white";
const underlineInput =
  "w-full h-10 bg-transparent border-0 border-b border-[#E2E2E2] px-0 text-[15px] text-[#0A0A0A] placeholder:text-[#B3B3B3] outline-none transition focus:border-black dark:border-white/15 dark:text-white dark:placeholder:text-zinc-500 dark:focus:border-white";
const saveBtn =
  "inline-flex items-center justify-center rounded-[10px] bg-black px-10 py-3 text-[14px] font-semibold text-white transition hover:opacity-85 dark:bg-white dark:text-black";
const cancelBtn =
  "inline-flex items-center justify-center rounded-[10px] border border-[#E0E0E0] bg-white px-10 py-3 text-[14px] font-semibold text-[#0A0A0A] transition hover:border-black dark:border-white/20 dark:bg-transparent dark:text-white dark:hover:border-white";

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
  const inputRef = useRef<HTMLInputElement>(null);

  const iniciais = (nomeEditado || user?.email || "U")
    .split(/[\s@]/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();

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
    };
    reader.readAsDataURL(file);
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
  };

  const handleSalvar = async () => {
    const toastId = veloToast.loading("Salvando configurações...");
    try {
      if (user?.id) {
        const profilePayload = {
          display_name: nomeEditado,
          whatsapp: telefone,
          ...(fotoFile ? { avatar_url: fotoFile } : {}),
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
      if (fotoFile) setFoto(fotoFile);
      veloToast.success("Configurações salvas com sucesso.", { id: toastId });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível salvar as configurações.";
      veloToast.error(message, { id: toastId });
    }
  };

  const avatarSrc = fotoPreview ?? foto;

  return (
      <div data-dashboard-tour="configuracoes-perfil">
      {/* Avatar header */}
      <div className="flex flex-col items-center text-center pb-2">
        <div className="relative">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-[72px] h-[72px] rounded-full bg-black text-white flex items-center justify-center text-[24px] font-semibold overflow-hidden transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2"
            aria-label="Trocar foto de perfil"
          >
            <img src={avatarSrc || defaultAvatar.url} alt="Foto de perfil" className="w-full h-full object-cover" />
          </button>
          <button
            onClick={() => inputRef.current?.click()}
            className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-black text-white shadow-md hover:opacity-90"
            aria-label="Trocar foto"
          >
            <Camera size={13} />
          </button>
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFoto} />
        </div>
        <button
          onClick={() => inputRef.current?.click()}
          className="mt-3 text-[13px] text-[#737373] underline underline-offset-2 hover:text-black dark:text-zinc-400 dark:hover:text-white"
        >
          Trocar foto
        </button>
        <div className="mt-3 flex items-center gap-2.5">
          <p className="text-[20px] font-semibold text-[#0A0A0A] dark:text-white">{nome || "Usuário"}</p>
          <PlanBadge size="sm" />
        </div>
      </div>

      <div className={divider} />

      {/* Form */}
      <div className="space-y-6">
        <div>
          <label className={fieldLabel}>Nome</label>
          <input
            className={underlineInput}
            placeholder="Seu nome"
            value={nomeEditado}
            onChange={(e) => setNomeEditado(e.target.value)}
          />
        </div>

        <div>
          <label className={fieldLabel}>Telefone</label>
          <input
            className={underlineInput}
            placeholder="(00) 00000-0000"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
          />
        </div>

        <div>
          <label className={fieldLabel}>CPF/CNPJ</label>
          <input
            className={underlineInput}
            placeholder="000.000.000-00"
            value={cpfCnpj}
            onChange={(e) => setCpfCnpj(e.target.value)}
          />
        </div>

        <div>
          <label className={fieldLabel}>Email</label>
          <div className="relative">
            <input
              readOnly
              value={user?.email ?? ""}
              className={`${underlineInput} pr-8 text-[#737373] cursor-not-allowed dark:text-zinc-400`}
            />
            <Lock size={14} className="absolute right-1 top-1/2 -translate-y-1/2 text-[#B3B3B3]" />
          </div>
        </div>
      </div>

      <div className="mt-8 flex items-center gap-3">
        <button onClick={handleSalvar} className={saveBtn}>Salvar</button>
        <button onClick={handleCancelar} className={cancelBtn}>Cancelar</button>
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
const StoresTab = () => {
  const [stores, setStores] = useState<VeloStore[]>(() => readUserStores());

  useEffect(() => {
    const syncStores = () => setStores(readUserStores());
    syncStores();
    window.addEventListener(STORES_CHANGED_EVENT, syncStores);
    window.addEventListener("storage", syncStores);
    return () => {
      window.removeEventListener(STORES_CHANGED_EVENT, syncStores);
      window.removeEventListener("storage", syncStores);
    };
  }, []);

  return (
    <div className="space-y-4">
      <h2 className="mb-1 text-[18px] font-semibold text-[#0A0A0A] dark:text-white">Minhas lojas</h2>
      <p className="mb-4 text-[13px] text-[#737373] dark:text-zinc-400">Gerencie as lojas criadas pela sua conta.</p>

      {stores.length > 0 ? (
        stores.map((store, index) => (
          <div key={store.id} className="rounded-2xl border border-[#E5E5E5] p-4 dark:border-zinc-800 dark:bg-zinc-950 sm:p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <p className="font-normal text-[#0A0A0A] dark:text-white">{store.name}</p>
                {index === 0 && (
                  <span className="rounded-full bg-black px-2.5 py-0.5 text-[11px] font-semibold text-white dark:bg-white dark:text-black">
                    Ativa
                  </span>
                )}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-sm sm:gap-4">
              <div><p className="text-xs uppercase tracking-wider text-[#A3A3A3] dark:text-zinc-500">Tipo</p><p className="mt-0.5 font-medium text-[#0A0A0A] dark:text-white">{store.businessType}</p></div>
              <div><p className="text-xs uppercase tracking-wider text-[#A3A3A3] dark:text-zinc-500">Objetivo</p><p className="mt-0.5 font-medium text-[#0A0A0A] dark:text-white">{store.goal}</p></div>
              <div><p className="text-xs uppercase tracking-wider text-[#A3A3A3] dark:text-zinc-500">Produtos</p><p className="mt-0.5 font-medium text-[#0A0A0A] dark:text-white">{store.publishedProducts}/{store.productLimit}</p></div>
            </div>
          </div>
        ))
      ) : (
        <div className="rounded-2xl border border-dashed border-[#D8DEE9] bg-[#F8FAFC] p-5 text-[14px] text-[#697386] dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
          Nenhuma loja criada ainda.
        </div>
      )}
    </div>
  );
};

type Integration = { platform: string; label: string; connected: boolean; loading?: boolean; comingSoon?: boolean };

const IntegrationsTab = () => {
  const { user, role } = useAuth();
  const isAdmin = role === "admin" || isAdminEmail(user?.email);
  const planLimits = usePlanLimits();
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
                <span className="flex min-w-0 items-center gap-1.5 rounded-full bg-black px-2.5 py-1 text-[11px] font-semibold text-white dark:bg-white dark:text-black">
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
                className="w-full rounded-full bg-black px-3.5 py-1.5 text-[12px] font-medium text-white transition-opacity hover:opacity-85 dark:bg-white dark:text-black sm:w-auto"
              >
                Conectar +
              </button>
            )}
          </div>
        ))}
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
  const navigate = useNavigate();
  const upgradeModal = useUpgradeModal();
  const { plan } = usePlan();
  const current = PLAN_DATA.find((p) => p.id === plan) ?? PLAN_DATA[0];

  return (
    <div>
      <h2 className="text-[18px] font-semibold text-[#0A0A0A] dark:text-white mb-1">Seu plano</h2>
      <p className="text-[13px] text-[#737373] dark:text-zinc-400 mb-5">Gerencie sua assinatura e veja os planos disponíveis.</p>

      {/* Current plan card */}
      <div className="rounded-2xl border-[1.5px] border-black p-4 mb-6 dark:border-white dark:bg-zinc-950 sm:p-6">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2.5">
              <h3 className="text-[18px] font-semibold text-[#0A0A0A] dark:text-white">Plano {current.name}</h3>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-black text-white font-semibold dark:bg-white dark:text-black">Ativo</span>
            </div>
            <p className="text-[13px] text-[#737373] dark:text-zinc-400 mt-1">Renovação em 15 dias</p>
          </div>
          <p className="text-[24px] font-semibold text-[#0A0A0A] dark:text-white leading-none">
            {current.price}<span className="text-[13px] text-[#737373] dark:text-zinc-400 font-normal">{current.period}</span>
          </p>
        </div>
        <p className="text-[13px] text-[#525252] dark:text-zinc-300 mb-4 max-w-xl">{current.description}</p>
        <ul className="space-y-2 mb-5">
          {current.features.map((f) => (
            <li key={f} className="flex items-center gap-2 text-[13px] text-[#0A0A0A] dark:text-white">
              <CheckCircle2 size={14} className="text-black dark:text-white" /> {f}
            </li>
          ))}
        </ul>
        <button className={primaryBtn}>
          {plan === "pro" ? "Gerenciar assinatura" : "Fazer upgrade"}
        </button>
      </div>

      {/* Available plans */}
      <h3 className="text-[14px] font-semibold text-[#0A0A0A] dark:text-white mb-3">Outros planos</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {PLAN_DATA.map((p) => {
          const isCurrent = p.id === plan;
          const isSelectable = !isCurrent && p.id !== "gratis";
          return (
            <div
              key={p.id}
              className={`rounded-xl p-4 ${
                isCurrent
                  ? "border-2 border-black bg-[#FAFAFA] dark:border-white dark:bg-zinc-950"
                  : p.id === "business"
                    ? "border border-black bg-white shadow-[0_16px_45px_rgba(0,0,0,0.08)] dark:border-white dark:bg-zinc-950"
                    : "border border-[#E5E5E5] dark:border-zinc-800 dark:bg-zinc-950"
              }`}
            >
              <p className="text-[13px] font-normal text-[#0A0A0A] dark:text-white">{p.name}</p>
              <p className="text-[20px] font-semibold text-[#0A0A0A] dark:text-white mt-1">
                {p.price}<span className="text-[11px] text-[#737373] dark:text-zinc-400 font-normal">{p.period}</span>
              </p>
              <p className="mt-2 text-[11.5px] leading-relaxed text-[#737373] dark:text-zinc-400 line-clamp-3">{p.description}</p>
              <ul className="mt-3 space-y-1.5">
                {p.features.slice(0, 4).map((f) => (
                  <li key={f} className="text-[11px] text-[#525252] dark:text-zinc-300 flex items-start gap-1.5">
                    <CheckCircle2 size={11} className="text-black dark:text-white mt-0.5 shrink-0" /> <span>{f}</span>
                  </li>
                ))}
              </ul>
              <button
                disabled={!isSelectable}
                onClick={() => {
                  if (p.id !== "gratis") upgradeModal.open({ defaultPlan: p.id === "business" ? "business" : "pro" });
                }}
                className={`mt-4 w-full py-2 rounded-full text-[12px] font-medium ${
                  !isSelectable
                    ? "bg-[#F0F0F0] text-[#A3A3A3] cursor-not-allowed dark:bg-zinc-800 dark:text-zinc-500"
                    : "bg-black text-white hover:opacity-85 transition-opacity dark:bg-white dark:text-black"
                }`}
              >
                {isCurrent ? "Plano atual" : p.id === "gratis" ? "Modo teste" : "Fazer upgrade"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ══ Notifications ═══════════════════════════════════════ */
const NotificationsTab = () => {
  const [toggles, setToggles] = useState([true, true, true, false, true]);
  const labels = ["Nova venda", "Produto publicado", "Erro de publicação", "Pedido em trânsito", "Relatório semanal"];

  return (
    <div>
      <h2 className="text-[18px] font-semibold text-[#0A0A0A] dark:text-white mb-1">Notificações</h2>
      <p className="text-[13px] text-[#737373] dark:text-zinc-400 mb-5">Escolha quando quer ser avisado.</p>

      <div className="space-y-2.5">
        {labels.map((l, i) => (
          <div key={l} className="flex items-center justify-between p-3.5 rounded-xl border border-[#E5E5E5] dark:border-zinc-800 dark:bg-zinc-950">
            <span className="text-[14px] font-normal text-[#0A0A0A] dark:text-white">{l}</span>
            <button
              onClick={() => setToggles((prev) => prev.map((v, j) => (j === i ? !v : v)))}
              className={`w-11 h-6 rounded-full transition-colors relative ${toggles[i] ? "bg-black dark:bg-white" : "bg-[#E5E5E5] dark:bg-zinc-700"}`}
              aria-label={`Toggle ${l}`}
            >
              <div className={`absolute top-1 w-4 h-4 rounded-full transition-all ${toggles[i] ? "left-6 bg-white dark:bg-black" : "left-1 bg-white dark:bg-zinc-300"}`} />
            </button>
          </div>
        ))}
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
