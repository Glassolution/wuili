import { useState } from "react";

const tabs = ["Perfil", "Minhas Lojas", "Integrações", "Plano", "Notificações", "Segurança"];

const SettingsPage = () => {
  const [tab, setTab] = useState("Perfil");

  return (
    <div className="space-y-6">
      <div className="flex gap-2 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
              tab === t ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="card-wuili p-6">
        {tab === "Perfil" && <ProfileTab />}
        {tab === "Minhas Lojas" && <StoresTab />}
        {tab === "Integrações" && <IntegrationsTab />}
        {tab === "Plano" && <PlanTab />}
        {tab === "Notificações" && <NotificationsTab />}
        {tab === "Segurança" && <SecurityTab />}
      </div>
    </div>
  );
};

const ProfileTab = () => (
  <div className="max-w-md space-y-6">
    <div className="flex items-center gap-4">
      <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-xl font-bold text-primary-foreground">TD</div>
      <div>
        <p className="font-bold">TrendStore BR</p>
        <p className="text-sm text-muted-foreground">Plano Pro</p>
      </div>
    </div>
    {[
      { label: "Nome", value: "TrendStore BR" },
      { label: "Email", value: "contato@trendstore.com.br" },
      { label: "Telefone", value: "(11) 98765-4321" },
      { label: "CPF/CNPJ", value: "12.345.678/0001-90" },
    ].map((f) => (
      <div key={f.label}>
        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{f.label}</label>
        <input
          className="w-full mt-1 px-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          defaultValue={f.value}
        />
      </div>
    ))}
    <button className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-all">
      Salvar alterações
    </button>
  </div>
);

const StoresTab = () => (
  <div className="space-y-4">
    <div className="p-5 rounded-2xl border border-border">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="font-bold">TrendStore BR</p>
          <span className="text-xs px-2.5 py-1 rounded-full bg-success-light text-success font-semibold">Ativa</span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div><p className="text-muted-foreground text-xs">Template</p><p className="font-medium">Moderno</p></div>
        <div><p className="text-muted-foreground text-xs">Produtos</p><p className="font-medium">8</p></div>
        <div><p className="text-muted-foreground text-xs">Vendas</p><p className="font-medium">23</p></div>
      </div>
    </div>
    <button className="px-4 py-2.5 rounded-xl border border-border text-sm font-semibold hover:bg-muted transition-all">
      + Nova Loja
    </button>
  </div>
);

const IntegrationsTab = () => {
  const integrations = [
    { name: "Mercado Livre", connected: true },
    { name: "Shopee", connected: true },
    { name: "AliExpress", connected: false },
    { name: "Shopify", connected: false },
    { name: "Stripe", connected: true },
    { name: "Pix", connected: true, label: "Ativo" },
  ];

  return (
    <div className="space-y-3 max-w-md">
      {integrations.map((i) => (
        <div key={i.name} className="flex items-center justify-between p-4 rounded-2xl border border-border">
          <span className="text-sm font-medium">{i.name}</span>
          {i.connected ? (
            <span className="text-xs px-2.5 py-1 rounded-full bg-success-light text-success font-semibold">
              ✓ {i.label || "Conectado"}
            </span>
          ) : (
            <button className="text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-all">
              Conectar +
            </button>
          )}
        </div>
      ))}
    </div>
  );
};

const PlanTab = () => (
  <div className="max-w-md">
    <div className="p-5 rounded-2xl border-2 border-primary">
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-accent text-accent-foreground font-bold">Plano atual</span>
          <h3 className="text-xl font-bold mt-2">Pro</h3>
        </div>
        <p className="text-2xl font-black text-primary">R$59<span className="text-sm text-muted-foreground font-normal">/mês</span></p>
      </div>
      <p className="text-sm text-muted-foreground mb-4">Renovação automática em 15 dias</p>
      <button className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-all">
        Fazer upgrade para Negócio
      </button>
    </div>
  </div>
);

const NotificationsTab = () => {
  const [toggles, setToggles] = useState([true, true, true, false, true]);
  const labels = ["Nova venda", "Produto publicado", "Erro de publicação", "Pedido em trânsito", "Relatório semanal"];

  return (
    <div className="max-w-md space-y-4">
      {labels.map((l, i) => (
        <div key={l} className="flex items-center justify-between p-3 rounded-xl border border-border">
          <span className="text-sm font-medium">{l}</span>
          <button
            onClick={() => setToggles((prev) => prev.map((v, j) => (j === i ? !v : v)))}
            className={`w-11 h-6 rounded-full transition-all relative ${toggles[i] ? "bg-primary" : "bg-muted"}`}
          >
            <div className={`absolute top-1 w-4 h-4 rounded-full bg-primary-foreground transition-all ${toggles[i] ? "left-6" : "left-1"}`} />
          </button>
        </div>
      ))}
    </div>
  );
};

const SecurityTab = () => (
  <div className="max-w-md space-y-6">
    <div>
      <h3 className="text-sm font-bold mb-3">Alterar senha</h3>
      {["Senha atual", "Nova senha", "Confirmar nova senha"].map((l) => (
        <div key={l} className="mb-3">
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{l}</label>
          <input type="password" className="w-full mt-1 px-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
        </div>
      ))}
      <button className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-all">
        Atualizar senha
      </button>
    </div>

    <div>
      <h3 className="text-sm font-bold mb-3">Autenticação de dois fatores</h3>
      <div className="flex items-center justify-between p-3 rounded-xl border border-border">
        <span className="text-sm">2FA ativado</span>
        <div className="w-11 h-6 rounded-full bg-muted relative">
          <div className="absolute top-1 left-1 w-4 h-4 rounded-full bg-primary-foreground" />
        </div>
      </div>
    </div>

    <div>
      <h3 className="text-sm font-bold mb-3">Sessões ativas</h3>
      <div className="space-y-2">
        {[
          { device: "Chrome — São Paulo", active: true },
          { device: "Safari — iPhone", active: false },
        ].map((s) => (
          <div key={s.device} className="flex items-center justify-between p-3 rounded-xl border border-border">
            <span className="text-sm">{s.device}</span>
            {s.active ? (
              <span className="text-xs px-2.5 py-1 rounded-full bg-success-light text-success font-semibold">Atual</span>
            ) : (
              <button className="text-xs text-destructive font-semibold hover:underline">Encerrar</button>
            )}
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default SettingsPage;
