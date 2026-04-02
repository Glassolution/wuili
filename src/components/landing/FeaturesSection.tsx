const FeaturesSection = () => (
  <div id="solucoes" style={{ background: "#f6f9fc", borderTop: "1px solid #e3e8ef" }}>
    <div style={{ position: "relative", maxWidth: "1280px", margin: "0 auto", padding: "88px 80px" }}>
      <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: "1px", background: "#e3e8ef" }} />
      <div style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: "1px", background: "#e3e8ef" }} />
      <p className="label-upper mb-3">Funcionalidades</p>
      <h2 className="text-3xl lg:text-4xl font-black mb-12" style={{ letterSpacing: "-1.5px" }}>
        Tudo que você precisa num só lugar
      </h2>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Wide card */}
        <div className="md:col-span-2 card-wuili p-8 flex flex-col lg:flex-row gap-8">
          <div className="flex-1 space-y-4">
            <h3 className="text-xl font-bold">Publique em qualquer plataforma com 1 clique</h3>
            <p className="text-muted-foreground">Selecione seus produtos e publique simultaneamente no Mercado Livre, Shopee e sua loja própria.</p>
            <div className="flex flex-wrap gap-2">
              {["🛒 Mercado Livre", "🧡 Shopee", "🏪 Minha Loja"].map((p) => (
                <span key={p} className="text-xs px-3 py-1.5 rounded-full bg-accent text-accent-foreground font-medium">{p}</span>
              ))}
            </div>
          </div>
          <div className="flex-1 space-y-2">
            {[
              { emoji: "🎧", name: "Fone TWS", price: "R$89", status: true },
              { emoji: "👟", name: "Tênis Casual", price: "R$127", status: true },
              { emoji: "💄", name: "Kit Skincare", price: "R$89", status: false },
            ].map((p) => (
              <div key={p.name} className="flex items-center justify-between p-3 rounded-xl border border-border">
                <div className="flex items-center gap-2">
                  <span>{p.emoji}</span>
                  <span className="text-sm font-medium">{p.name}</span>
                  <span className="text-xs text-muted-foreground">{p.price}</span>
                </div>
                {p.status ? (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-success-light text-success font-semibold">Publicado agora</span>
                ) : (
                  <button className="text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-all">
                    Publicar
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Medium card 1 */}
        <div className="card-wuili p-8">
          <h3 className="text-xl font-bold mb-2">Loja pronta, identidade sua</h3>
          <p className="text-muted-foreground text-sm mb-6">Escolha entre templates profissionais e personalize com sua marca.</p>
          <div className="flex gap-3">
            {["Minimalista", "Moderno", "Dark Bold"].map((t, i) => (
              <div key={t} className={`flex-1 h-24 rounded-xl border ${i === 1 ? "border-primary bg-accent" : "border-border bg-muted"} flex items-end p-2`}>
                <span className="text-xs font-medium">{t}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Medium card 2 */}
        <div className="card-wuili p-8">
          <h3 className="text-xl font-bold mb-2">Dashboard real</h3>
          <p className="text-muted-foreground text-sm mb-6">Métricas em tempo real para acompanhar seu negócio.</p>
          <div className="space-y-3">
            {[
              { label: "Lucro hoje", value: "R$ 284,00", change: "+24%" },
              { label: "Pedidos", value: "12", change: "+3 hoje" },
              { label: "Produto + vendido", value: "Fone TWS", change: "8 vendas" },
            ].map((m) => (
              <div key={m.label} className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                <div>
                  <p className="text-xs text-muted-foreground">{m.label}</p>
                  <p className="text-sm font-bold">{m.value}</p>
                </div>
                <span className="text-xs font-semibold text-success">{m.change}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default FeaturesSection;
