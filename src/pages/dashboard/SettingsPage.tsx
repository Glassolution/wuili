import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Bell, Camera, CheckCircle2, CreditCard, Loader2, Lock, MessageCircle, Plug, Shield, Store, User } from "lucide-react";
import { useProfile } from "@/lib/profileContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import PlanBadge from "@/components/PlanBadge";
import PlatformLogo from "@/components/dashboard/PlatformLogo";
import { usePlan } from "@/hooks/usePlan";
import SupportTab from "@/components/dashboard/SupportTab";
import UpgradeLimitModal from "@/components/UpgradeLimitModal";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import {
  MAX_STORES_PER_USER,
  readUserStores,
  START_STORE_ONBOARDING_EVENT,
  STORES_CHANGED_EVENT,
  type VeloStore,
} from "@/components/dashboard/FirstStoreOnboarding";
import { veloToast } from "@/components/ui/velo-toast";
import { startMercadoLivreOAuth } from "@/lib/mercadoLivreOAuth";

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

const MOBILE_NAV = NAV.filter((item) => item.id !== "Suporte");

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
      {/* Sidebar 240px */}
      <aside className="hidden w-[240px] shrink-0 flex-col bg-white border-r border-[#E5E5E5] dark:bg-[#0f0f0f] dark:border-white/10">
        <div className="p-5 border-b border-[#F0F0F0] dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-black text-white flex items-center justify-center text-base font-semibold overflow-hidden">
              {foto ? <img src={foto} alt="" className="w-full h-full object-cover" /> : iniciais}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold text-[#0A0A0A] dark:text-white truncate">{nome || "Usuário"}</p>
              <div className="mt-1"><PlanBadge size="sm" /></div>
            </div>
          </div>
        </div>

        <nav className="p-3 space-y-1">
          {NAV.map((item) => {
            const active = tab === item.id;
            const Icon = item.icon;
            return (
              <div key={item.id}>
                {item.separatorBefore && <div className="my-2 border-t border-[#F0F0F0] dark:border-white/10" />}
                <button
                  onClick={() => setTab(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-[14px] transition-colors ${
                    active
                      ? "bg-[#F0F0F0] text-[#0A0A0A] font-medium dark:bg-white/10 dark:text-white"
                      : "text-[#737373] hover:bg-[#F5F5F5] dark:text-zinc-400 dark:hover:bg-white/5"
                  }`}
                >
                  <Icon size={16} strokeWidth={active ? 2.2 : 1.8} />
                  {item.id}
                </button>
              </div>
            );
          })}
        </nav>
      </aside>

      {/* Main */}
      <div className={isSupportTab ? "min-w-0 flex-1 overflow-x-hidden px-0 py-0 md:px-0 md:py-6" : "min-w-0 flex-1 overflow-x-hidden px-3 py-4 md:px-0 md:py-6"}>
        <div className={`mb-4 rounded-2xl border border-[#E5E5E5] bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 ${isSupportTab ? "hidden md:block" : ""}`}>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-black text-base font-semibold text-white dark:bg-white dark:text-black">
              {foto ? <img src={foto} alt="" className="h-full w-full object-cover" /> : iniciais}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[16px] font-semibold text-[#0A0A0A] dark:text-white">{nome || "Usuário"}</p>
              <div className="mt-1"><PlanBadge size="sm" /></div>
            </div>
          </div>
        </div>

        {/* Mobile tab pills */}
        <div className={`-mx-3 mb-5 overflow-x-auto px-3 pb-2 pt-1 md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden ${isSupportTab ? "hidden md:block" : ""}`} style={{ scrollbarWidth: "none" }}>
          <div className="flex w-max min-w-full items-center gap-2">
            {MOBILE_NAV.map((item) => {
              const active = tab === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  ref={(node) => { mobileTabRefs.current[item.id] = node; }}
                  onClick={() => setTab(item.id)}
                  className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-[13px] font-semibold whitespace-nowrap transition-all ${
                    active
                      ? "border-[#0A0A0A] bg-[#0A0A0A] text-white shadow-[0_10px_24px_rgba(0,0,0,0.22)]"
                      : "border-black/[0.07] bg-white text-[#525252] shadow-[0_6px_18px_rgba(15,23,42,0.06)] hover:border-black/[0.14] hover:text-[#0A0A0A]"
                  }`}
                >
                  <span className={`grid h-6 w-6 place-items-center rounded-full ${
                    active ? "bg-white/12 text-white" : "bg-[#F5F5F5] text-[#0A0A0A]"
                  }`}>
                    <Icon size={13.5} />
                  </span>
                  {item.id}
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
const labelCls = "block text-[12px] font-normal text-[#737373] dark:text-zinc-400 uppercase tracking-[0.05em] mb-2";
const inputCls =
  "w-full h-11 px-3.5 rounded-[10px] border border-[#E5E5E5] bg-white text-[15px] text-[#0A0A0A] placeholder:text-[#A3A3A3] outline-none transition focus:border-black focus:shadow-[0_0_0_3px_rgba(0,0,0,0.06)] dark:border-white/10 dark:bg-[#0f0f0f] dark:text-white dark:placeholder:text-zinc-500 dark:focus:border-white dark:focus:shadow-[0_0_0_3px_rgba(255,255,255,0.14)]";
const primaryBtn =
  "inline-flex items-center justify-center px-7 py-3 rounded-full bg-black text-white text-[14px] font-medium hover:opacity-85 transition-opacity dark:bg-white dark:text-black";
const secondaryBtn =
  "inline-flex items-center justify-center px-5 py-2.5 rounded-full border border-black text-[14px] font-medium text-black bg-transparent hover:bg-black hover:text-white transition-colors dark:border-white dark:text-white dark:hover:bg-white dark:hover:text-black";
const divider = "my-6 border-t border-[#F0F0F0] dark:border-white/10";

/* ══ Profile ════════════════════════════════════════════ */
const ProfileTab = () => {
  const { nome, foto, setNome, setFoto } = useProfile();
  const { user } = useAuth();
  const [nomeEditado, setNomeEditado] = useState(nome);
  const [telefone, setTelefone] = useState("");
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
        if (data?.whatsapp) setTelefone(data.whatsapp);
      });
  }, [user?.id]);

  const handleSalvar = async () => {
    const toastId = veloToast.loading("Salvando configurações...");
    try {
      if (user?.id) {
        const profilePayload = {
          display_name: nomeEditado,
          whatsapp: telefone,
          ...(fotoFile ? { avatar_url: fotoFile } : {}),
        };

        const { error, count } = await supabase
          .from("profiles")
          .update(profilePayload)
          .eq("user_id", user.id)
          .select("user_id", { count: "exact", head: true });

        if (error) throw error;

        if (!count) {
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
    <div>
      {/* Avatar header */}
      <div className="flex flex-col items-center text-center pb-2">
        <div className="relative">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-[72px] h-[72px] rounded-full bg-black text-white flex items-center justify-center text-[24px] font-semibold overflow-hidden transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2"
            aria-label="Trocar foto de perfil"
          >
            {avatarSrc ? <img src={avatarSrc} alt="Foto de perfil" className="w-full h-full object-cover" /> : iniciais}
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
      <div className="space-y-5">
        <div>
          <label className={labelCls}>Nome</label>
          <input className={inputCls} value={nomeEditado} onChange={(e) => setNomeEditado(e.target.value)} />
        </div>

        <div>
          <label className={labelCls}>Email</label>
          <div className="relative">
            <input
              readOnly
              value={user?.email ?? ""}
              className={`${inputCls} pr-10 bg-[#FAFAFA] text-[#737373] cursor-not-allowed dark:bg-zinc-950 dark:text-zinc-400`}
            />
            <Lock size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#A3A3A3]" />
          </div>
        </div>

        <div>
          <label className={labelCls}>Telefone</label>
          <input className={inputCls} value={telefone} onChange={(e) => setTelefone(e.target.value)} />
        </div>

        <div>
          <label className={labelCls}>CPF/CNPJ</label>
          <input className={inputCls} defaultValue="" placeholder="000.000.000-00" />
        </div>
      </div>

      <div className={divider} />

      <div className="flex justify-end">
        <button onClick={handleSalvar} className={primaryBtn}>Salvar alterações</button>
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
          Nenhuma loja criada ainda. Ao entrar pela primeira vez, o fluxo inicial vai coletar os dados para criar a primeira loja.
        </div>
      )}

      <button
        className={stores.length >= MAX_STORES_PER_USER ? `${secondaryBtn} cursor-not-allowed opacity-45` : secondaryBtn}
        disabled={stores.length >= MAX_STORES_PER_USER}
        onClick={() => window.dispatchEvent(new Event(START_STORE_ONBOARDING_EVENT))}
      >
        {stores.length >= MAX_STORES_PER_USER ? "Limite de 2 lojas atingido" : "+ Nova loja"}
      </button>
    </div>
  );
};

type Integration = { platform: string; label: string; connected: boolean; loading?: boolean; comingSoon?: boolean };

const IntegrationsTab = () => {
  const { user } = useAuth();
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
      <p className="text-[13px] text-[#737373] dark:text-zinc-400 mb-5">Conecte suas plataformas de venda.</p>

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
    price: "R$99,90",
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
    price: "R$149,90",
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
                  if (p.id !== "gratis") navigate(`/checkout?plan=${p.id === "business" ? "business" : "pro"}`);
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
const SecurityTab = () => (
  <div className="space-y-7">
    <div>
      <h2 className="text-[18px] font-semibold text-[#0A0A0A] dark:text-white mb-1">Alterar senha</h2>
      <p className="text-[13px] text-[#737373] dark:text-zinc-400 mb-4">Use uma senha forte que você não usa em outros lugares.</p>
      <div className="space-y-4">
        {["Senha atual", "Nova senha", "Confirmar nova senha"].map((l) => (
          <div key={l}>
            <label className={labelCls}>{l}</label>
            <input type="password" className={inputCls} />
          </div>
        ))}
      </div>
      <div className="mt-5">
        <button className={primaryBtn}>Atualizar senha</button>
      </div>
    </div>

    <div className={divider} />

    <div>
      <h3 className="text-[14px] font-semibold text-[#0A0A0A] dark:text-white mb-3">Autenticação de dois fatores</h3>
      <div className="flex items-center justify-between p-3.5 rounded-xl border border-[#E5E5E5] dark:border-zinc-800 dark:bg-zinc-950">
        <span className="text-[14px] text-[#0A0A0A] dark:text-white">2FA ativado</span>
        <div className="w-11 h-6 rounded-full bg-[#E5E5E5] dark:bg-zinc-700 relative">
          <div className="absolute top-1 left-1 w-4 h-4 rounded-full bg-white" />
        </div>
      </div>
    </div>

    <div className={divider} />

    <div>
      <h3 className="text-[14px] font-semibold text-[#0A0A0A] dark:text-white mb-3">Sessões ativas</h3>
      <div className="space-y-2">
        {[
          { device: "Chrome — São Paulo", active: true },
          { device: "Safari — iPhone",    active: false },
        ].map((s) => (
          <div key={s.device} className="flex items-center justify-between p-3.5 rounded-xl border border-[#E5E5E5] dark:border-zinc-800 dark:bg-zinc-950">
            <span className="text-[14px] text-[#0A0A0A] dark:text-white">{s.device}</span>
            {s.active ? (
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-black text-white font-semibold dark:bg-white dark:text-black">Atual</span>
            ) : (
              <button className="text-[12px] text-[#0A0A0A] dark:text-white font-medium underline underline-offset-2 hover:opacity-70">Encerrar</button>
            )}
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default SettingsPage;
