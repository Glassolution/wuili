import { useState } from "react";
import { X } from "lucide-react";

const publications = [
  { emoji: "🎧", name: "Fone TWS", ml: "published", shopee: "published", loja: "published" },
  { emoji: "👟", name: "Tênis Casual", ml: "published", shopee: "publishing", loja: "published" },
  { emoji: "💄", name: "Kit Skincare", ml: "published", shopee: "published", loja: "error" },
  { emoji: "⌚", name: "Relógio Smart", ml: "published", shopee: "published", loja: "published" },
  { emoji: "🎒", name: "Mochila Urbana", ml: "publishing", shopee: "none", loja: "published" },
  { emoji: "🕶️", name: "Óculos Retrô", ml: "published", shopee: "published", loja: "none" },
  { emoji: "🖱️", name: "Mouse Sem Fio", ml: "published", shopee: "error", loja: "published" },
  { emoji: "📱", name: "Capa iPhone", ml: "published", shopee: "published", loja: "published" },
  { emoji: "🌸", name: "Perfume Importado", ml: "publishing", shopee: "publishing", loja: "none" },
  { emoji: "👠", name: "Tênis Feminino", ml: "published", shopee: "published", loja: "published" },
  { emoji: "📷", name: "Câmera Seg.", ml: "published", shopee: "none", loja: "published" },
  { emoji: "💻", name: "Suporte Notebook", ml: "error", shopee: "published", loja: "published" },
];

const statusBadge: Record<string, { label: string; cls: string }> = {
  published: { label: "✓ Publicado", cls: "bg-success-light text-success" },
  publishing: { label: "⟳ Publicando", cls: "bg-warning/10 text-warning animate-pulse" },
  error: { label: "✗ Erro", cls: "bg-destructive/10 text-destructive" },
  none: { label: "— Não publicado", cls: "bg-muted text-muted-foreground" },
};

const PublicationsPage = () => {
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <div className="space-y-6 relative">
      <div className="flex items-center justify-between">
        <button className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-all">
          Nova Publicação +
        </button>
      </div>

      <div className="card-wuili overflow-hidden">
        {publications.map((p, i) => (
          <div
            key={i}
            className="flex items-center justify-between px-5 py-4 border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
            onClick={() => setSelected(i)}
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">{p.emoji}</span>
              <span className="text-sm font-medium">{p.name}</span>
            </div>
            <div className="flex gap-2">
              {(["ml", "shopee", "loja"] as const).map((platform) => {
                const st = statusBadge[p[platform]];
                return (
                  <span key={platform} className={`text-xs px-2.5 py-1 rounded-full font-semibold ${st.cls}`}>
                    {st.label}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Side panel */}
      {selected !== null && (
        <div className="fixed top-0 right-0 h-full w-96 max-w-full bg-background border-l border-border shadow-wuili-lg z-50 p-6 overflow-y-auto animate-[slide-in-right_0.3s_ease-out]">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold">Detalhes da Publicação</h3>
            <button onClick={() => setSelected(null)}>
              <X size={20} className="text-muted-foreground" />
            </button>
          </div>

          <div className="flex items-center gap-3 mb-6">
            <span className="text-4xl">{publications[selected].emoji}</span>
            <div>
              <p className="font-bold">{publications[selected].name}</p>
              <p className="text-sm text-muted-foreground">ID #{4821 - selected}</p>
            </div>
          </div>

          <div className="space-y-3 mb-6">
            <h4 className="text-sm font-bold">Status por plataforma</h4>
            {([
              ["Mercado Livre", publications[selected].ml],
              ["Shopee", publications[selected].shopee],
              ["Minha Loja", publications[selected].loja],
            ] as const).map(([name, status]) => {
              const st = statusBadge[status];
              return (
                <div key={name} className="flex items-center justify-between p-3 rounded-xl border border-border">
                  <span className="text-sm">{name}</span>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${st.cls}`}>{st.label}</span>
                </div>
              );
            })}
          </div>

          <div className="flex gap-2">
            <button className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-all">Republicar</button>
            <button className="flex-1 py-2.5 rounded-xl bg-muted text-foreground text-sm font-semibold hover:bg-muted/80 transition-all">Editar</button>
            <button className="py-2.5 px-4 rounded-xl bg-destructive/10 text-destructive text-sm font-semibold hover:bg-destructive/20 transition-all">Remover</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PublicationsPage;
