import { useState } from "react";
import { X, Star, Search, ChevronDown, MapPin } from "lucide-react";
import { toast } from "sonner";
import PlatformLogo from "@/components/dashboard/PlatformLogo";

type Product = {
  name: string;
  platform: string;
  platformColor: string;
  rating: number;
  reviews: number;
  priceMin: number;
  priceMax: number;
  minOrder: number;
  tags: string[];
  image: string;
};

type Supplier = {
  name: string;
  location: string;
  rating: number;
  reviews: number;
  color: string;
  abbr: string;
};

const suppliers: Supplier[] = [
  { name: "Martins Atacado", location: "Uberlândia, MG", rating: 4.8, reviews: 2341, color: "#E53935", abbr: "MA" },
  { name: "Cia Atacadista", location: "São Paulo, SP", rating: 4.7, reviews: 1876, color: "#1E88E5", abbr: "CA" },
  { name: "Brás Distribuidora", location: "São Paulo, SP", rating: 4.5, reviews: 1543, color: "#F57C00", abbr: "BD" },
  { name: "Makro Atacadista", location: "São Paulo, SP", rating: 4.6, reviews: 2102, color: "#43A047", abbr: "MK" },
  { name: "Atacadão Brasil", location: "Curitiba, PR", rating: 4.4, reviews: 1234, color: "#8E24AA", abbr: "AB" },
  { name: "TechImport BR", location: "Shenzhen via SP", rating: 4.9, reviews: 3210, color: "#00ACC1", abbr: "TI" },
  { name: "ModaFlex SP", location: "São Paulo, SP", rating: 4.3, reviews: 987, color: "#E91E63", abbr: "MF" },
  { name: "BeautyAsia BR", location: "Rio de Janeiro, RJ", rating: 4.7, reviews: 1654, color: "#7B1FA2", abbr: "BA" },
  { name: "UrbanBags", location: "Novo Hamburgo, RS", rating: 4.5, reviews: 1120, color: "#5D4037", abbr: "UB" },
  { name: "HomeDeco Brasil", location: "Belo Horizonte, MG", rating: 4.6, reviews: 1432, color: "#00897B", abbr: "HB" },
];

const steps = ["Fornecedor", "Descrição", "Revisão"];

const supplierFields = [
  "Nome do Produto", "Descrição", "Categoria",
  "Nome do Fornecedor", "Contato", "Preço de Custo",
  "Preço de Venda", "Preço de Estoque", "Nível de Estoque",
  "Métodos de Envio", "Custos de Envio",
];

const defaultMapped = [
  "Nome do Produto", "Descrição", "Categoria", "Custos de Envio",
];

type Props = {
  open: boolean;
  onClose: () => void;
  product: Product | null;
};

const ImportProductModal = ({ open, onClose, product }: Props) => {
  const [step, setStep] = useState(0);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [mapped, setMapped] = useState<string[]>(defaultMapped);

  const removeMapping = (field: string) => setMapped(prev => prev.filter(f => f !== field));
  const resetAll = () => setMapped([]);

  if (!open || !product) return null;

  const filtered = suppliers.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.location.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-3xl rounded-2xl bg-background shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

        {/* Steps header */}
        <div className="flex items-center gap-0 px-6 pt-5 pb-4 border-b border-border">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`flex items-center gap-2 ${i <= step ? "text-foreground" : "text-muted-foreground"}`}>
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                  i < step ? "bg-orange-500 text-white" :
                  i === step ? "bg-orange-500 text-white" :
                  "border border-border text-muted-foreground"
                }`}>{i + 1}</span>
                <span className={`text-sm font-medium ${i === step ? "text-foreground" : "text-muted-foreground"}`}>{s}</span>
              </div>
              {i < steps.length - 1 && (
                <div className={`mx-3 h-px w-16 ${i < step ? "bg-orange-500" : "bg-border"}`} />
              )}
            </div>
          ))}
          <button onClick={onClose} className="ml-auto text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Left content */}
          <div className="flex-1 flex flex-col min-h-0 p-5">

            {/* STEP 1 — Fornecedor */}
            {step === 0 && (<>
              <h3 className="text-base font-bold text-foreground mb-4">Selecionar Fornecedor</h3>
              <div className="flex items-center gap-2 mb-4">
                <div className="relative flex-1">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    className="w-full pl-8 pr-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Buscar"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
                {["Localização", "Avaliação"].map(f => (
                  <button key={f} className="flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-muted transition-colors">
                    {f} <ChevronDown size={11} />
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-y-auto grid grid-cols-2 gap-3 pr-1" style={{ scrollbarWidth: "none" }}>
                {filtered.map(s => (
                  <button
                    key={s.name}
                    onClick={() => setSelected(s.name)}
                    className={`flex flex-col gap-2 rounded-xl border p-3 text-left transition-all hover:border-orange-400 ${
                      selected === s.name ? "border-orange-500 bg-orange-50" : "border-border bg-background"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-black text-white" style={{ backgroundColor: s.color }}>
                        {s.abbr}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{s.name}</p>
                        <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <MapPin size={9} /> {s.location}
                          <span className="mx-1">·</span>
                          <Star size={9} fill="#F59E0B" className="text-amber-400" /> {s.rating} ({s.reviews.toLocaleString()})
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-primary hover:underline">Ver detalhes</span>
                  </button>
                ))}
              </div>
            </>)}

            {/* STEP 2 — Descrição */}
            {step === 1 && (<>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-foreground">Descrição de Campos</h3>
                <button onClick={resetAll} className="text-xs font-semibold text-foreground underline hover:text-muted-foreground">
                  Resetar tudo
                </button>
              </div>
              <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
                <div className="grid grid-cols-2 gap-4">
                  {/* Supplier fields — clicável para mover para direita */}
                  <div>
                    <p className="text-xs font-bold text-muted-foreground mb-3 uppercase tracking-wider">{selected}</p>
                    <div className="space-y-2">
                      {supplierFields.map(f => {
                        const isMapped = mapped.includes(f);
                        return (
                          <button
                            key={f}
                            onClick={() => !isMapped && setMapped(prev => [...prev, f])}
                            disabled={isMapped}
                            className={`w-full text-left rounded-xl border px-3 py-2.5 text-sm transition-all ${
                              isMapped
                                ? "border-border bg-muted/30 text-muted-foreground cursor-not-allowed opacity-50"
                                : "border-border bg-background text-foreground hover:border-orange-400 hover:bg-orange-50 cursor-pointer"
                            }`}
                          >
                            {f}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {/* Mapped fields — clicável para remover (mover para esquerda) */}
                  <div>
                    <p className="text-xs font-bold text-muted-foreground mb-3 uppercase tracking-wider">
                      Velo <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px]">{mapped.length}</span>
                    </p>
                    <div className="space-y-2">
                      {mapped.map(f => (
                        <div key={f} className="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground">
                          {f}
                          <button
                            onClick={() => removeMapping(f)}
                            className="text-muted-foreground hover:text-foreground ml-2 shrink-0"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ))}
                      <div className="rounded-xl border border-dashed border-border bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground">
                        Tags
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>)}

            {/* STEP 3 — Revisão */}
            {step === 2 && (<>
              <h3 className="text-base font-bold text-foreground mb-4">Revisão de Detalhes</h3>
              <div className="flex-1 overflow-y-auto space-y-3 pr-1" style={{ scrollbarWidth: "none" }}>
                <div className="rounded-xl border border-border bg-background overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 cursor-pointer">
                    <p className="text-sm font-bold text-foreground">Fornecedor</p>
                    <ChevronDown size={15} className="text-muted-foreground" />
                  </div>
                  <div className="px-4 pb-4 flex items-center gap-3 border-t border-border pt-3">
                    {(() => {
                      const s = suppliers.find(s => s.name === selected);
                      return s ? (
                        <>
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-black text-white" style={{ backgroundColor: s.color }}>{s.abbr}</span>
                          <div>
                            <p className="text-sm font-semibold text-foreground">{s.name}</p>
                            <p className="text-xs text-muted-foreground">{s.location} · Fornecedor verificado</p>
                          </div>
                        </>
                      ) : null;
                    })()}
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-background overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3">
                    <p className="text-sm font-bold text-foreground">Mapeamento de Dados</p>
                    <ChevronDown size={15} className="text-muted-foreground" />
                  </div>
                  <div className="px-4 pb-4 border-t border-border pt-3 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Nome do Produto</label>
                        <input defaultValue={product.name} className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Categoria</label>
                        <select className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm focus:outline-none">
                          {product.tags.map(t => <option key={t}>{t}</option>)}
                          <option>Eletrônicos</option>
                          <option>Moda</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Preço de Custo</label>
                        <input defaultValue={`${product.priceMin}`} className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Preço de Venda</label>
                        <input defaultValue={`${product.priceMax}`} className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Nível de Estoque</label>
                        <input defaultValue="50" className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Custo de Envio</label>
                        <input defaultValue="R$46" className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Tags</label>
                      <div className="flex flex-wrap gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2 min-h-[38px]">
                        {product.tags.map(t => (
                          <span key={t} className="flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                            {t} <X size={10} className="cursor-pointer text-muted-foreground hover:text-foreground" />
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Descrição do Produto</label>
                      <textarea
                        defaultValue="Produto de alta qualidade disponível para dropshipping. Entrega rápida e suporte ao vendedor incluídos."
                        rows={3}
                        className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </>)}

          </div>

          {/* Right — product details */}
          <div className="w-56 shrink-0 border-l border-border bg-muted/30 p-4 flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <img src={product.image} alt={product.name} className="h-12 w-12 rounded-xl object-cover shrink-0 border border-border" />
              <p className="text-sm font-bold text-foreground leading-snug">{product.name}</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Star size={13} fill="#F59E0B" className="text-amber-400" />
              <span className="text-xs font-semibold">{product.rating}</span>
              <span className="text-xs text-muted-foreground">({product.reviews.toLocaleString()})</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {product.tags.map(t => (
                <span key={t} className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{t}</span>
              ))}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs">Plataforma</span>
                <span className="flex items-center gap-1.5 text-xs font-semibold">
                  <PlatformLogo platform={product.platform} color={product.platformColor} />
                  {product.platform}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs">Preço</span>
                <span className="text-xs font-semibold">${product.priceMin}–${product.priceMax}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs">Pedido mín.</span>
                <span className="text-xs font-semibold">{product.minOrder} unid.</span>
              </div>
            </div>
            <div>
              <p className="text-xs font-bold text-foreground mb-1">Descrição</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Produto de alta qualidade disponível para dropshipping. Entrega rápida e suporte ao vendedor incluídos.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-6 py-4">
          <p className="text-xs text-muted-foreground">
            Saiba mais sobre{" "}
            <a href="#" className="text-primary hover:underline">Importar Produto</a>
          </p>
          <div className="flex items-center gap-3">
            {step > 0 && (
              <button onClick={() => setStep(s => s - 1)} className="text-sm font-medium text-foreground underline hover:text-muted-foreground transition-colors">
                Voltar
              </button>
            )}
            <button onClick={onClose} className="text-sm font-medium text-foreground underline hover:text-muted-foreground transition-colors">
              Cancelar
            </button>
            <button
              disabled={!selected}
              onClick={() => {
                if (step < steps.length - 1) {
                  setStep(s => s + 1);
                } else {
                  toast.success(`${product.name} importado com sucesso 🔗`);
                  onClose();
                  setStep(0);
                  setSelected(null);
                }
              }}
              className="rounded-xl bg-orange-500 px-6 py-2 text-sm font-semibold text-white hover:bg-orange-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {step === steps.length - 1 ? "Enviar" : "Próximo"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImportProductModal;
