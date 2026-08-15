import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, Upload, Loader2, Trash2, Package } from "lucide-react";
import { veloToast } from "@/components/ui/velo-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type OwnProduct = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  images: string[];
  price: number;
  cost_price: number | null;
  weight: number | null;
  length_cm: number | null;
  width_cm: number | null;
  height_cm: number | null;
  category: string | null;
  brand: string | null;
  model: string | null;
  sku: string | null;
  stock_quantity: number;
  status: string;
  created_at: string;
};

const CATEGORIES = [
  "Beleza e Cuidados Pessoais",
  "Casa e Jardim",
  "Eletrônicos e Gadgets",
  "Moda Feminina",
  "Moda Masculina",
  "Esporte e Lazer",
  "Pet",
  "Bebês e Crianças",
  "Organização e Utilidades",
  "Outros",
];

const MIN_IMAGES = 3;

const inputClass =
  "h-9 w-full rounded-lg border border-black/[0.08] bg-white px-3 text-[13px] text-foreground placeholder:text-muted-foreground focus:border-black/[0.2] focus:outline-none focus:ring-0";
const labelClass = "mb-1.5 block text-[12px] font-medium text-muted-foreground";

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  product?: OwnProduct | null;
};

const OwnProductFormModal = ({ open, onClose, onSaved, product }: Props) => {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [price, setPrice] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [weight, setWeight] = useState("");
  const [length, setLength] = useState("");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [brand, setBrand] = useState("");
  const [sku, setSku] = useState("");
  const [stock, setStock] = useState("10");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(product?.title ?? "");
    setDescription(product?.description ?? "");
    setImages(Array.isArray(product?.images) ? (product!.images as string[]) : []);
    setPrice(product?.price ? String(product.price) : "");
    setCostPrice(product?.cost_price ? String(product.cost_price) : "");
    setWeight(product?.weight ? String(product.weight) : "");
    setLength(product?.length_cm ? String(product.length_cm) : "");
    setWidth(product?.width_cm ? String(product.width_cm) : "");
    setHeight(product?.height_cm ? String(product.height_cm) : "");
    setCategory(product?.category ?? CATEGORIES[0]);
    setBrand(product?.brand ?? "");
    setSku(product?.sku ?? "");
    setStock(product?.stock_quantity ? String(product.stock_quantity) : "10");
  }, [open, product]);

  if (!open) return null;

  const num = (v: string) => {
    const n = Number(String(v).replace(",", "."));
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length || !user) return;
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files).slice(0, 8)) {
        if (!file.type.startsWith("image/")) continue;
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${user.id}/own/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage
          .from("product-images")
          .upload(path, file, { cacheControl: "3600", upsert: false });
        if (error) throw error;
        const { data } = supabase.storage.from("product-images").getPublicUrl(path);
        uploaded.push(data.publicUrl);
      }
      setImages((prev) => [...prev, ...uploaded].slice(0, 10));
    } catch (err) {
      console.error("[own-product] upload:", err);
      veloToast.error("Não foi possível enviar as fotos. Tente novamente.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleSave = async () => {
    if (!user) return;
    if (title.trim().length < 5) return veloToast.error("Informe um nome de produto com pelo menos 5 caracteres.");
    if (description.trim().length < 20) return veloToast.error("Escreva uma descrição com pelo menos 20 caracteres.");
    if (images.length < MIN_IMAGES) return veloToast.error(`Adicione no mínimo ${MIN_IMAGES} fotos do produto.`);
    if (!num(price)) return veloToast.error("Informe um preço de venda válido.");
    if (!num(weight)) return veloToast.error("Informe o peso do produto em kg (usado no cálculo do frete).");

    setSaving(true);
    const payload = {
      user_id: user.id,
      title: title.trim(),
      description: description.trim(),
      images,
      price: num(price),
      cost_price: num(costPrice),
      weight: num(weight),
      length_cm: num(length),
      width_cm: num(width),
      height_cm: num(height),
      category,
      brand: brand.trim() || null,
      sku: sku.trim() || null,
      stock_quantity: Number(stock) > 0 ? Number(stock) : 10,
    };

    const { error } = product
      ? await supabase.from("user_products" as any).update(payload).eq("id", product.id)
      : await supabase.from("user_products" as any).insert(payload);

    setSaving(false);
    if (error) {
      console.error("[own-product] save:", error);
      veloToast.error("Não foi possível salvar o produto.");
      return;
    }
    veloToast.success(product ? "Produto atualizado." : "Produto cadastrado.");
    onSaved();
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}>
      <div className="flex max-h-[92vh] w-full max-w-[720px] flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-black/[0.06] px-5 py-4">
          <div>
            <h2 className="text-[15px] font-semibold text-foreground" style={{ letterSpacing: "-0.01em" }}>
              {product ? "Editar produto próprio" : "Adicionar produto próprio"}
            </h2>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              Produtos seus, fora do catálogo de fornecedores.
            </p>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 transition-colors hover:bg-black/[0.04]">
            <X size={16} strokeWidth={1.5} className="text-muted-foreground" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className={labelClass}>Nome do produto</label>
              <input className={inputClass} value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Luminária de mesa articulada LED" />
            </div>

            <div>
              <label className={labelClass}>Descrição</label>
              <textarea
                className="min-h-[96px] w-full rounded-lg border border-black/[0.08] bg-white p-3 text-[13px] text-foreground placeholder:text-muted-foreground focus:border-black/[0.2] focus:outline-none"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Características, materiais, medidas e o que acompanha."
              />
            </div>

            {/* Fotos */}
            <div>
              <label className={labelClass}>Fotos (mínimo {MIN_IMAGES})</label>
              <div className="flex flex-wrap gap-2">
                {images.map((url) => (
                  <div key={url} className="group relative h-20 w-20 overflow-hidden rounded-lg border border-black/[0.06] bg-gray-50">
                    <img src={url} alt="Foto do produto" className="h-full w-full object-cover" />
                    <button
                      onClick={() => setImages((prev) => prev.filter((u) => u !== url))}
                      className="absolute right-1 top-1 rounded-md bg-white/90 p-1 opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <Trash2 size={12} strokeWidth={1.5} className="text-foreground" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-black/[0.15] text-muted-foreground transition-colors hover:bg-black/[0.02]"
                >
                  {uploading ? <Loader2 size={16} strokeWidth={1.5} className="animate-spin" /> : <Upload size={16} strokeWidth={1.5} />}
                  <span className="text-[11px]">Enviar</span>
                </button>
              </div>
              <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => handleUpload(e.target.files)} />
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Use fotos limpas, sem marca d'água ou texto promocional — o Mercado Livre recusa esse tipo de imagem.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Preço de venda (R$)</label>
                <input className={inputClass} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="129,90" inputMode="decimal" />
              </div>
              <div>
                <label className={labelClass}>Custo (opcional)</label>
                <input className={inputClass} value={costPrice} onChange={(e) => setCostPrice(e.target.value)} placeholder="60,00" inputMode="decimal" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <label className={labelClass}>Peso (kg)</label>
                <input className={inputClass} value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="0,4" inputMode="decimal" />
              </div>
              <div>
                <label className={labelClass}>Compr. (cm)</label>
                <input className={inputClass} value={length} onChange={(e) => setLength(e.target.value)} placeholder="25" inputMode="numeric" />
              </div>
              <div>
                <label className={labelClass}>Largura (cm)</label>
                <input className={inputClass} value={width} onChange={(e) => setWidth(e.target.value)} placeholder="20" inputMode="numeric" />
              </div>
              <div>
                <label className={labelClass}>Altura (cm)</label>
                <input className={inputClass} value={height} onChange={(e) => setHeight(e.target.value)} placeholder="10" inputMode="numeric" />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className={labelClass}>Categoria</label>
                <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)}>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Marca (opcional)</label>
                <input className={inputClass} value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Genérica" />
              </div>
              <div>
                <label className={labelClass}>Estoque</label>
                <input className={inputClass} value={stock} onChange={(e) => setStock(e.target.value)} inputMode="numeric" />
              </div>
            </div>

            <div>
              <label className={labelClass}>SKU (opcional)</label>
              <input className={inputClass} value={sku} onChange={(e) => setSku(e.target.value)} placeholder="MEU-SKU-001" />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-black/[0.06] px-5 py-3">
          <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <Package size={14} strokeWidth={1.5} />
            {images.length}/{MIN_IMAGES} fotos
          </span>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="h-9 rounded-lg border border-black/[0.08] px-4 text-[13px] font-medium text-foreground transition-colors hover:bg-black/[0.02]">
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex h-9 items-center gap-2 rounded-lg bg-black px-4 text-[13px] font-medium text-white transition-colors hover:bg-black/90 disabled:opacity-60"
            >
              {saving && <Loader2 size={14} strokeWidth={1.5} className="animate-spin" />}
              {product ? "Salvar alterações" : "Cadastrar produto"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default OwnProductFormModal;
