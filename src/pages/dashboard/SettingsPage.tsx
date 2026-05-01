import { useEffect, useRef, useState } from "react";
import { Bell, Camera, CheckCircle2, CreditCard, Loader2, Lock, MessageCircle, Plug, Shield, Store, User } from "lucide-react";
import { useProfile } from "@/lib/profileContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import PlanBadge from "@/components/PlanBadge";
import { usePlan } from "@/hooks/usePlan";
import SupportTab from "@/components/dashboard/SupportTab";

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
  const [tab, setTab] = useState<TabId>("Perfil");
  const { nome, foto } = useProfile();
  const { user } = useAuth();

  const iniciais = (nome || user?.email || "U")
    .split(/[\s@]/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();

  return (
    <div className="flex overflow-hidden rounded-2xl border border-[#EBEBEB] bg-[#F5F5F5]" style={{ minHeight: 'calc(100vh - 56px - 4rem)' }}>
      {/* Sidebar 240px */}
      <aside className="hidden md:flex w-[240px] shrink-0 flex-col bg-white border-r border-[#E5E5E5]">
        <div className="p-5 border-b border-[#F0F0F0]">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-black text-white flex items-center justify-center text-base font-bold overflow-hidden">
              {foto ? <img src={foto} alt="" className="w-full h-full object-cover" /> : iniciais}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-bold text-[#0A0A0A] truncate">{nome || "Usuário"}</p>
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
                {item.separatorBefore && <div className="my-2 border-t border-[#F0F0F0]" />}
                <button
                  onClick={() => setTab(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-[14px] transition-colors ${
                    active
                      ? "bg-[#F0F0F0] text-[#0A0A0A] font-medium"
                      : "text-[#737373] hover:bg-[#F5F5F5]"
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
      <div className="flex-1 min-w-0 p-6 md:p-8 overflow-x-hidden">
        {/* Mobile tab pills */}
        <div className="md:hidden mb-5 flex gap-2 overflow-x-auto pb-1">
          {NAV.map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`px-3.5 py-1.5 rounded-lg text-[13px] font-medium whitespace-nowrap ${
                tab === item.id ? "bg-black text-white" : "bg-white text-[#737373] border border-[#E5E5E5]"
              }`}
            >
              {item.id}
            </button>
          ))}
        </div>

        <div className={`mx-auto ${tab === "Suporte" ? "max-w-[760px]" : "max-w-[600px]"} bg-white rounded-2xl p-6 md:p-8 shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-[#EFEFEF]`}>
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
const labelCls = "block text-[12px] font-medium text-[#737373] uppercase tracking-[0.05em] mb-2";
const inputCls =
  "w-full h-11 px-3.5 rounded-[10px] border border-[#E5E5E5] bg-white text-[15px] text-[#0A0A0A] placeholder:text-[#A3A3A3] outline-none transition focus:border-black focus:shadow-[0_0_0_3px_rgba(0,0,0,0.06)]";
const primaryBtn =
  "inline-flex items-center justify-center px-7 py-3 rounded-full bg-black text-white text-[14px] font-medium hover:opacity-85 transition-opacity";
const secondaryBtn =
  "inline-flex items-center justify-center px-5 py-2.5 rounded-full border border-black text-[14px] font-medium text-black bg-transparent hover:bg-black hover:text-white transition-colors";
const divider = "my-6 border-t border-[#F0F0F0]";

/* ══ Profile ════════════════════════════════════════════ */
const ProfileTab = () => {
  const { nome, foto, setNome, setFoto } = useProfile();
  const { user } = useAuth();
  const [nomeEditado, setNomeEditado] = useState(nome);
  const [fotoPreview, setFotoPreview] = useState<string | null>(foto);
  const [fotoFile, setFotoFile] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const iniciais = (nomeEditado || user?.email || "U")
    .split(/[\s@]/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();

  const handleFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setFotoPreview(url);
    setFotoFile(url);
  };

  const handleSalvar = () => {
    setNome(nomeEditado);
    if (fotoFile) setFoto(fotoFile);
  };

  const avatarSrc = fotoPreview ?? foto;

  return (
    <div>
      {/* Avatar header */}
      <div className="flex flex-col items-center text-center pb-2">
        <div className="relative">
          <div className="w-[72px] h-[72px] rounded-full bg-black text-white flex items-center justify-center text-[24px] font-bold overflow-hidden">
            {avatarSrc ? <img src={avatarSrc} alt="Foto de perfil" className="w-full h-full object-cover" /> : iniciais}
          </div>
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
          className="mt-3 text-[13px] text-[#737373] underline underline-offset-2 hover:text-black"
        >
          Trocar foto
        </button>
        <div className="mt-3 flex items-center gap-2.5">
          <p className="text-[20px] font-bold text-[#0A0A0A]">{nome || "Usuário"}</p>
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
              className={`${inputCls} pr-10 bg-[#FAFAFA] text-[#737373] cursor-not-allowed`}
            />
            <Lock size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#A3A3A3]" />
          </div>
        </div>

        <div>
          <label className={labelCls}>Telefone</label>
          <input className={inputCls} defaultValue="(11) 98765-4321" />
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
const StoresTab = () => (
  <div className="space-y-4">
    <h2 className="text-[18px] font-bold text-[#0A0A0A] mb-1">Minhas lojas</h2>
    <p className="text-[13px] text-[#737373] mb-4">Gerencie as lojas conectadas à sua conta.</p>

    <div className="p-5 rounded-2xl border border-[#E5E5E5]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <p className="font-bold text-[#0A0A0A]">Velo</p>
          <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-black text-white font-semibold">Ativa</span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div><p className="text-[#A3A3A3] text-xs uppercase tracking-wider">Template</p><p className="font-medium text-[#0A0A0A] mt-0.5">Moderno</p></div>
        <div><p className="text-[#A3A3A3] text-xs uppercase tracking-wider">Produtos</p><p className="font-medium text-[#0A0A0A] mt-0.5">8</p></div>
        <div><p className="text-[#A3A3A3] text-xs uppercase tracking-wider">Vendas</p><p className="font-medium text-[#0A0A0A] mt-0.5">23</p></div>
      </div>
    </div>
    <button className={secondaryBtn}>+ Nova loja</button>
  </div>
);

/* ══ Integrations ════════════════════════════════════════ */
type Integration = { platform: string; label: string; connected: boolean; loading?: boolean };

const IntegrationsTab = () => {
  const { user } = useAuth();
  const [integrations, setIntegrations] = useState<Integration[]>([
    { platform: "mercadolivre", label: "Mercado Livre", connected: false, loading: true },
    { platform: "shopee",       label: "Shopee",        connected: false },
    { platform: "aliexpress",   label: "AliExpress",    connected: false },
    { platform: "shopify",      label: "Shopify",       connected: false },
    { platform: "stripe",       label: "Stripe",        connected: false },
    { platform: "pix",          label: "Pix",           connected: false },
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
          prev.map((i) => ({ ...i, connected: connected.has(i.platform), loading: false }))
        );
      });
  }, [user]);

  const handleConnect = async (platform: string) => {
    if (platform === "mercadolivre" && user) {
      const { data, error } = await supabase.functions.invoke("ml-connect");
      if (error || !data?.auth_url) {
        console.error("ml-connect error:", error);
        return;
      }
      window.location.href = data.auth_url;
    }
  };

  return (
    <div>
      <h2 className="text-[18px] font-bold text-[#0A0A0A] mb-1">Integrações</h2>
      <p className="text-[13px] text-[#737373] mb-5">Conecte suas plataformas de venda.</p>

      <div className="space-y-2.5">
        {integrations.map((i) => (
          <div key={i.platform} className="flex items-center justify-between p-4 rounded-xl border border-[#E5E5E5]">
            <span className="text-[14px] font-medium text-[#0A0A0A]">{i.label}</span>
            {i.loading ? (
              <Loader2 size={16} className="animate-spin text-[#A3A3A3]" />
            ) : i.connected ? (
              <span className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full bg-black text-white font-semibold">
                <CheckCircle2 size={12} /> Conectado
              </span>
            ) : (
              <button
                onClick={() => handleConnect(i.platform)}
                className="text-[12px] px-3.5 py-1.5 rounded-full bg-black text-white font-medium hover:opacity-85 transition-opacity"
              >
                Conectar +
              </button>
            )}
          </div>
        ))}
      </div>

      <p className="mt-4 text-[11px] text-[#A3A3A3]">
        Clique em "Conectar +" para autorizar sua conta do Mercado Livre.
      </p>
    </div>
  );
};

/* ══ Plan ════════════════════════════════════════════════ */
const PLAN_DATA = [
  { id: "gratis", name: "Free", price: "R$0", period: "/mês", features: ["Até 10 produtos", "1 loja conectada", "Suporte por email"] },
  { id: "plus",   name: "Plus", price: "R$59", period: "/mês", features: ["Produtos ilimitados", "3 lojas conectadas", "IA para descrições", "Suporte prioritário"] },
  { id: "pro",    name: "Pro",  price: "R$129", period: "/mês", features: ["Tudo do Plus", "Lojas ilimitadas", "Automação completa", "Suporte dedicado"] },
];

const PlanTab = () => {
  const { plan } = usePlan();
  const current = PLAN_DATA.find((p) => p.id === plan) ?? PLAN_DATA[0];

  return (
    <div>
      <h2 className="text-[18px] font-bold text-[#0A0A0A] mb-1">Seu plano</h2>
      <p className="text-[13px] text-[#737373] mb-5">Gerencie sua assinatura e veja os planos disponíveis.</p>

      {/* Current plan card */}
      <div className="rounded-2xl border-[1.5px] border-black p-6 mb-6">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2.5">
              <h3 className="text-[18px] font-bold text-[#0A0A0A]">Plano {current.name}</h3>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-black text-white font-semibold">Ativo</span>
            </div>
            <p className="text-[13px] text-[#737373] mt-1">Renovação em 15 dias</p>
          </div>
          <p className="text-[24px] font-black text-[#0A0A0A] leading-none">
            {current.price}<span className="text-[13px] text-[#737373] font-normal">{current.period}</span>
          </p>
        </div>
        <ul className="space-y-2 mb-5">
          {current.features.map((f) => (
            <li key={f} className="flex items-center gap-2 text-[13px] text-[#0A0A0A]">
              <CheckCircle2 size={14} className="text-black" /> {f}
            </li>
          ))}
        </ul>
        <button className={primaryBtn}>
          {plan === "pro" ? "Gerenciar assinatura" : "Fazer upgrade"}
        </button>
      </div>

      {/* Available plans */}
      <h3 className="text-[14px] font-bold text-[#0A0A0A] mb-3">Outros planos</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {PLAN_DATA.map((p) => {
          const isCurrent = p.id === plan;
          return (
            <div
              key={p.id}
              className={`rounded-xl p-4 ${isCurrent ? "border-2 border-black bg-[#FAFAFA]" : "border border-[#E5E5E5]"}`}
            >
              <p className="text-[13px] font-bold text-[#0A0A0A]">{p.name}</p>
              <p className="text-[20px] font-black text-[#0A0A0A] mt-1">
                {p.price}<span className="text-[11px] text-[#737373] font-normal">{p.period}</span>
              </p>
              <ul className="mt-3 space-y-1.5">
                {p.features.slice(0, 3).map((f) => (
                  <li key={f} className="text-[11px] text-[#737373] flex items-start gap-1.5">
                    <CheckCircle2 size={11} className="text-black mt-0.5 shrink-0" /> <span>{f}</span>
                  </li>
                ))}
              </ul>
              <button
                disabled={isCurrent}
                className={`mt-4 w-full py-2 rounded-full text-[12px] font-medium ${
                  isCurrent
                    ? "bg-[#F0F0F0] text-[#A3A3A3] cursor-not-allowed"
                    : "bg-black text-white hover:opacity-85 transition-opacity"
                }`}
              >
                {isCurrent ? "Plano atual" : "Selecionar"}
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
      <h2 className="text-[18px] font-bold text-[#0A0A0A] mb-1">Notificações</h2>
      <p className="text-[13px] text-[#737373] mb-5">Escolha quando quer ser avisado.</p>

      <div className="space-y-2.5">
        {labels.map((l, i) => (
          <div key={l} className="flex items-center justify-between p-3.5 rounded-xl border border-[#E5E5E5]">
            <span className="text-[14px] font-medium text-[#0A0A0A]">{l}</span>
            <button
              onClick={() => setToggles((prev) => prev.map((v, j) => (j === i ? !v : v)))}
              className={`w-11 h-6 rounded-full transition-colors relative ${toggles[i] ? "bg-black" : "bg-[#E5E5E5]"}`}
              aria-label={`Toggle ${l}`}
            >
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${toggles[i] ? "left-6" : "left-1"}`} />
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
      <h2 className="text-[18px] font-bold text-[#0A0A0A] mb-1">Alterar senha</h2>
      <p className="text-[13px] text-[#737373] mb-4">Use uma senha forte que você não usa em outros lugares.</p>
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
      <h3 className="text-[14px] font-bold text-[#0A0A0A] mb-3">Autenticação de dois fatores</h3>
      <div className="flex items-center justify-between p-3.5 rounded-xl border border-[#E5E5E5]">
        <span className="text-[14px] text-[#0A0A0A]">2FA ativado</span>
        <div className="w-11 h-6 rounded-full bg-[#E5E5E5] relative">
          <div className="absolute top-1 left-1 w-4 h-4 rounded-full bg-white" />
        </div>
      </div>
    </div>

    <div className={divider} />

    <div>
      <h3 className="text-[14px] font-bold text-[#0A0A0A] mb-3">Sessões ativas</h3>
      <div className="space-y-2">
        {[
          { device: "Chrome — São Paulo", active: true },
          { device: "Safari — iPhone",    active: false },
        ].map((s) => (
          <div key={s.device} className="flex items-center justify-between p-3.5 rounded-xl border border-[#E5E5E5]">
            <span className="text-[14px] text-[#0A0A0A]">{s.device}</span>
            {s.active ? (
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-black text-white font-semibold">Atual</span>
            ) : (
              <button className="text-[12px] text-[#0A0A0A] font-medium underline underline-offset-2 hover:opacity-70">Encerrar</button>
            )}
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default SettingsPage;
