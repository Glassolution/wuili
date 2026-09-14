import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Sparkles, ArrowLeft, ArrowRight, Check, Video, ChevronDown, Search, UserRound } from "lucide-react";
import model297 from "@/assets/models/model-297w.png.asset.json";
import model298 from "@/assets/models/model-298w.png.asset.json";
import model299 from "@/assets/models/model-299w.png.asset.json";
import model300 from "@/assets/models/model-300w.png.asset.json";
import model301 from "@/assets/models/model-301w.png.asset.json";
import model302 from "@/assets/models/model-302w.png.asset.json";
import model303 from "@/assets/models/model-303w.png.asset.json";
import model304 from "@/assets/models/model-304w.png.asset.json";
import ugc307 from "@/assets/models/ugc-image-307.png.asset.json";
import ugc308 from "@/assets/models/ugc-image-308.png.asset.json";
import ugc309 from "@/assets/models/ugc-image-309.png.asset.json";
import ugc311 from "@/assets/models/ugc-image-311.png.asset.json";
import ugcBlonde from "@/assets/models/ugc-blonde.png.asset.json";
import ugcBrunette from "@/assets/models/ugc-brunette.png.asset.json";
import ugcM318 from "@/assets/models/ugc-m-image-318.png.asset.json";
import ugcM319 from "@/assets/models/ugc-m-image-319.png.asset.json";
import ugcM320 from "@/assets/models/ugc-m-image-320.png.asset.json";
import ugcM321 from "@/assets/models/ugc-m-image-321.png.asset.json";
import ugcM322 from "@/assets/models/ugc-m-image-322.png.asset.json";
import ugcM323 from "@/assets/models/ugc-m-image-323.png.asset.json";
import card_u1 from "@/assets/models/u1-card.jpg.asset.json";
import card_u2 from "@/assets/models/u2-card.jpg.asset.json";
import card_u3 from "@/assets/models/u3-card.jpg.asset.json";
import card_u4 from "@/assets/models/u4-card.jpg.asset.json";
import card_u5 from "@/assets/models/u5-card.jpg.asset.json";
import card_u6 from "@/assets/models/u6-card.jpg.asset.json";
import card_m1 from "@/assets/models/m1-card.jpg.asset.json";
import card_m2 from "@/assets/models/m2-card.jpg.asset.json";
import card_m3 from "@/assets/models/m3-card.jpg.asset.json";
import card_m4 from "@/assets/models/m4-card.jpg.asset.json";
import card_m5 from "@/assets/models/m5-card.jpg.asset.json";
import card_m6 from "@/assets/models/m6-card.jpg.asset.json";
import card_m7 from "@/assets/models/m7-card.jpg.asset.json";
import card_m8 from "@/assets/models/m8-card.jpg.asset.json";
import card_um1 from "@/assets/models/um1-card.jpg.asset.json";
import card_um2 from "@/assets/models/um2-card.jpg.asset.json";
import card_um3 from "@/assets/models/um3-card.jpg.asset.json";
import card_um4 from "@/assets/models/um4-card.jpg.asset.json";
import card_um5 from "@/assets/models/um5-card.jpg.asset.json";
import card_um6 from "@/assets/models/um6-card.jpg.asset.json";
// kind: "produtos" = estilo UGC segurando/apresentando produtos (tablet, liquidificador...)
//       "roupas"   = modelos de catálogo para vestir peças de roupa
type ModelKind = "produtos" | "roupas";
type ModelGender = "feminino" | "masculino";

const PRESET_MODELS: {
  id: string;
  label: string;
  info: string;
  url: string;
  thumb: string;
  kind: ModelKind;
  gender: ModelGender;
}[] = [
  { id: "u1", label: "Manu", info: "UGC · selfie no carro", url: ugc307.url, thumb: card_u1.url, kind: "produtos", gender: "feminino" },
  { id: "u2", label: "Lia", info: "UGC · selfie em casa", url: ugc308.url, thumb: card_u2.url, kind: "produtos", gender: "feminino" },
  { id: "u3", label: "Rafa", info: "UGC · ruiva close", url: ugc309.url, thumb: card_u3.url, kind: "produtos", gender: "feminino" },
  { id: "u4", label: "Bia", info: "UGC · espelho cacheada", url: ugc311.url, thumb: card_u4.url, kind: "produtos", gender: "feminino" },
  { id: "u5", label: "Nina", info: "UGC · loira no quarto", url: ugcBlonde.url, thumb: card_u5.url, kind: "produtos", gender: "feminino" },
  { id: "u6", label: "Sofia", info: "UGC · morena na cozinha", url: ugcBrunette.url, thumb: card_u6.url, kind: "produtos", gender: "feminino" },
  { id: "m1", label: "Ana", info: "Roupas · fitness cinza", url: model297.url, thumb: card_m1.url, kind: "roupas", gender: "feminino" },
  { id: "m2", label: "Bruna", info: "Roupas · fitness vinho", url: model298.url, thumb: card_m2.url, kind: "roupas", gender: "feminino" },
  { id: "m3", label: "Clara", info: "Roupas · fitness rosa", url: model299.url, thumb: card_m3.url, kind: "roupas", gender: "feminino" },
  { id: "m4", label: "Duda", info: "Roupas · fitness azul", url: model300.url, thumb: card_m4.url, kind: "roupas", gender: "feminino" },
  { id: "m5", label: "Enzo", info: "Roupas · camiseta branca", url: model301.url, thumb: card_m5.url, kind: "roupas", gender: "masculino" },
  { id: "m6", label: "Felipe", info: "Roupas · short verde", url: model302.url, thumb: card_m6.url, kind: "roupas", gender: "masculino" },
  { id: "m7", label: "Gabriel", info: "Roupas · regata azul", url: model303.url, thumb: card_m7.url, kind: "roupas", gender: "masculino" },
  { id: "m8", label: "Heitor", info: "Roupas · look preto", url: model304.url, thumb: card_m8.url, kind: "roupas", gender: "masculino" },
  { id: "um1", label: "Théo", info: "UGC · espelho polo cinza", url: ugcM318.url, thumb: card_um1.url, kind: "produtos", gender: "masculino" },
  { id: "um2", label: "Caio", info: "UGC · espelho no quarto", url: ugcM319.url, thumb: card_um2.url, kind: "produtos", gender: "masculino" },
  { id: "um3", label: "Léo", info: "UGC · selfie noturna", url: ugcM320.url, thumb: card_um3.url, kind: "produtos", gender: "masculino" },
  { id: "um4", label: "Davi", info: "UGC · ao ar livre", url: ugcM321.url, thumb: card_um4.url, kind: "produtos", gender: "masculino" },
  { id: "um5", label: "Pedro", info: "UGC · elevador", url: ugcM322.url, thumb: card_um5.url, kind: "produtos", gender: "masculino" },
  { id: "um6", label: "Vitor", info: "UGC · cacheado sorrindo", url: ugcM323.url, thumb: card_um6.url, kind: "produtos", gender: "masculino" },
];

const GENDERS: { id: ModelGender; label: string }[] = [
  { id: "feminino", label: "Feminino" },
  { id: "masculino", label: "Masculino" },
];

const KINDS: { id: ModelKind; label: string; hint: string }[] = [
  { id: "produtos", label: "UGC · Produtos", hint: "Estilo selfie/UGC para apresentar produtos (eletrônicos, casa, beleza...)" },
  { id: "roupas", label: "Roupas", hint: "Modelos de catálogo para vestir peças de roupa" },
];


const urlToDataUrl = async (url: string) => {
  const res = await fetch(url);
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Falha ao carregar o modelo"));
    reader.readAsDataURL(blob);
  });
};

export type AICharacter = {
  id: string;
  name: string;
  mode: string;
  image_url: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- atributos livres por rota de criação
  attributes: any;
  created_at: string;
};

const HAIR_STYLES = ["Manter do modelo", "Liso longo", "Liso curto", "Ondulado", "Cacheado", "Crespo", "Coque", "Rabo de cavalo"];
const HAIR_COLORS = ["Manter do modelo", "Preto", "Castanho", "Loiro", "Ruivo", "Platinado"];
const EYE_COLORS = ["Manter do modelo", "Castanhos", "Pretos", "Verdes", "Azuis", "Mel"];
type CatalogPick = { id: string; title: string; image: string; price?: number };


const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-2.5">
    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8E8E87]">{label}</p>
    {children}
  </div>
);

const AttributeSelect = ({
  label,
  value,
  options,
  onChange,
  open,
  onToggle,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  open: boolean;
  onToggle: () => void;
}) => (
  <div className="relative">
    <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8E8E87]">
      {label}
    </span>
    <button
      type="button"
      onClick={onToggle}
      className={`flex h-10 w-full items-center justify-between gap-3 rounded-full border bg-white px-4 text-left text-[13px] font-semibold text-[#111111] outline-none transition ${
        open ? "border-[#2563EB] ring-2 ring-[#2563EB]/10" : "border-black/[0.08] hover:bg-[#F7F7F8]"
      }`}
      aria-haspopup="listbox"
      aria-expanded={open}
    >
      <span className="truncate">{value}</span>
      <ChevronDown
        size={14}
        strokeWidth={1.9}
        className={`shrink-0 text-[#8E8E87] transition-transform ${open ? "rotate-180" : ""}`}
      />
    </button>

    {open ? (
      <div
        role="listbox"
        className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white p-1.5 shadow-[0_18px_44px_rgba(17,24,39,0.14)]"
      >
        {options.map((option) => {
          const active = option === value;
          return (
            <button
              key={option}
              type="button"
              role="option"
              aria-selected={active}
              onClick={() => {
                onChange(option);
                onToggle();
              }}
              className={`flex h-9 w-full items-center justify-between gap-2 rounded-xl px-3 text-left text-[12px] font-semibold transition-colors ${
                active ? "bg-[#EFF6FF] text-[#2563EB]" : "text-[#111111] hover:bg-[#F7F7F8]"
              }`}
            >
              <span className="truncate">{option}</span>
              {active ? <Check size={13} strokeWidth={2.1} /> : null}
            </button>
          );
        })}
      </div>
    ) : null}
  </div>
);

const PhonePreview = ({
  resultUrl,
  loading,
  name,
}: {
  resultUrl: string | null;
  loading: boolean;
  name: string;
}) => {
  const previewName = name || "Influenciador";

  return (
    <aside className="hidden lg:flex min-h-[520px] items-center justify-center rounded-2xl border border-[#E5E7EB] bg-[#F7F7F8]/55 p-6">
      <div className="relative">
        <div className="absolute -inset-5 rounded-[42px] bg-[#2563EB]/8 blur-2xl" />
        <div className="relative w-[270px] rounded-[38px] border-[7px] border-[#111111] bg-[#111111] p-2 shadow-[0_28px_70px_rgba(17,24,39,0.22)]">
          <div className="relative aspect-[9/19] overflow-hidden rounded-[30px] bg-white">
            <div className="absolute left-1/2 top-2 z-20 h-5 w-24 -translate-x-1/2 rounded-full bg-[#111111]" />

            {resultUrl ? (
              <img
                src={resultUrl}
                alt={`Influencer de IA ${previewName}`}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-[#F7F7F8] px-8 text-center">
                <div className="space-y-4">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#F0F0EF] text-[#111111]">
                    <UserRound size={24} strokeWidth={1.9} />
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-[15px] font-semibold tracking-[-0.03em] text-[#111111]">
                      Prévia do influenciador
                    </p>
                    <p className="text-[12px] font-medium leading-5 text-[#777771]">
                      A imagem gerada aparecerá aqui após criar.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {loading ? (
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-white/88 backdrop-blur-sm">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#EFF6FF] text-[#2563EB]">
                  <Loader2 size={22} className="animate-spin" />
                </div>
                <div className="text-center">
                  <p className="text-[13px] font-semibold text-[#111111]">Criando influenciador</p>
                  <p className="text-[11px] font-medium text-[#777771]">Preparando a imagem</p>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </aside>
  );
};

const STEPS = ["Modelo", "Aparência", "Produto", "Renderização"];

const AICharacterCreator = ({ onCreated }: { onCreated: (c: AICharacter) => void }) => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ character: AICharacter; url: string | null } | null>(null);


  const [gender, setGender] = useState<ModelGender>("feminino");
  const [kindTab, setKindTab] = useState<ModelKind>("produtos");
  const [presetId, setPresetId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [hairStyle, setHairStyle] = useState(HAIR_STYLES[0]);
  const [hairColor, setHairColor] = useState(HAIR_COLORS[0]);
  const [eyeColor, setEyeColor] = useState(EYE_COLORS[0]);
  const [openAttribute, setOpenAttribute] = useState<"hairStyle" | "hairColor" | "eyeColor" | null>(null);
  const [catalogPick, setCatalogPick] = useState<CatalogPick | null>(null);
  const [catalogItems, setCatalogItems] = useState<CatalogPick[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState("");

  const selected = PRESET_MODELS.find((m) => m.id === presetId) ?? null;
  const kind: ModelKind = selected?.kind ?? kindTab;
  // O estilo do modelo define o uso: UGC apresenta produtos, modelos de roupa vestem a peça.
  const productUse: "apresentar" | "vestir" = kind === "roupas" ? "vestir" : "apresentar";
  

  const loadCatalog = useCallback(async (term: string) => {
    setCatalogLoading(true);
    let query = supabase
      .from("catalog_products")
      .select("id,title,images,suggested_price")
      .eq("is_active", true)
      .eq("is_blocked", false)
      .neq("source", "aliexpress")
      .order("orders_count", { ascending: false, nullsFirst: false });
    if (term.trim()) query = query.ilike("title", `%${term.trim()}%`);
    const { data } = await query;
    const items = (data ?? [])
      .map((p) => {
        const imgs = Array.isArray(p.images) ? (p.images as unknown[]) : [];
        const first = imgs.find((i) => typeof i === "string") as string | undefined;
        return first
          ? {
              id: p.id as string,
              title: (p.title as string) ?? "Produto",
              image: first,
              price: Number((p as { suggested_price?: number }).suggested_price ?? 0) || undefined,
            }
          : null;
      })
      .filter(Boolean) as CatalogPick[];
    setCatalogItems(items);
    setCatalogLoading(false);
  }, []);

  useEffect(() => {
    if (step !== 2) return;
    const searchTimer = window.setTimeout(() => {
      void loadCatalog(catalogSearch);
    }, 220);
    return () => window.clearTimeout(searchTimer);
  }, [catalogSearch, loadCatalog, step]);


  const reset = () => {
    setStep(0);
    setPresetId(null);
    setName("");
    setHairStyle(HAIR_STYLES[0]);
    setHairColor(HAIR_COLORS[0]);
    setEyeColor(EYE_COLORS[0]);
    setOpenAttribute(null);
    setGender("feminino");
    setKindTab("produtos");
    setCatalogPick(null);
  };

  const keep = (v: string) => !v.startsWith("Manter");

  const generate = async () => {
    if (!selected) {
      toast.error("Escolha um modelo para começar.");
      setStep(0);
      return;
    }
    if (!catalogPick) {
      toast.error("Escolha um produto do catálogo Velo.");
      setStep(2);
      return;
    }
    // Nome é opcional: usamos o nome do modelo escolhido quando vazio.
    const finalName = name.trim() || selected.label;
    if (!name.trim()) setName(finalName);
    setLoading(true);
    try {
      const photoDataUrl = await urlToDataUrl(selected.url);
      const { data, error } = await supabase.functions.invoke("generate-ai-character", {
        body: {
          name: finalName,
          mode: "preset",
          presetId: selected.id,
          photoDataUrl,
          hairStyle: keep(hairStyle) ? hairStyle : undefined,
          hairColor: keep(hairColor) ? hairColor : undefined,
          eyeColor: keep(eyeColor) ? eyeColor : undefined,
          presetLabel: `${selected.label} — ${selected.info}`,
          productUse,
          productTitle: catalogPick.title,
          productImageUrl: catalogPick.image,
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      const character = data.character as AICharacter;
      let preview: string | null = null;
      if (character.image_url) {
        const { data: signed } = await supabase.storage
          .from("ai-characters")
          .createSignedUrl(character.image_url, 60 * 60);
        preview = signed?.signedUrl ?? null;
      }
      onCreated(character);
      setResult({ character, url: preview });
    } catch (e) {
      toast.error((e as Error).message || "Não foi possível gerar o personagem agora.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`grid gap-4 ${step === 3 ? "lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start" : ""}`}>
      <div className="space-y-4">


        {step === 0 && (
          <div className="inline-flex rounded-full border border-black/[0.08] bg-white p-1 shadow-[0_8px_18px_rgba(17,17,17,0.035)]">
            {GENDERS.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => {
                  setGender(g.id);
                  setPresetId(null);
                  setCatalogPick(null);
                  setCatalogItems([]);
                }}
                className={`relative h-8 rounded-full px-4 text-[12px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#2563EB]/30 ${
                  gender === g.id ? "text-white" : "text-[#777771] hover:text-[#101114]"
                }`}
              >
                {gender === g.id ? (
                  <motion.span
                    layoutId="creator-gender-pill"
                    className="absolute inset-0 rounded-full bg-[#2563EB]"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                ) : null}
                <span className="relative z-10">{g.label}</span>
              </button>
            ))}
          </div>
        )}

        <div className="space-y-5 rounded-2xl border border-[#E5E7EB] bg-white p-4">
          {step === 0 && (
            <>
              <Field label="Nome do personagem">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={60}
                  placeholder="Ex: Aurora, Marcus, Luna..."
                  className="h-10 w-full rounded-full border border-black/[0.08] bg-white px-4 text-[13px] font-medium text-[#101114] outline-none transition placeholder:text-[#A3A3A3] focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/10"
                />
              </Field>

              {KINDS.map((k) => {
                const models = PRESET_MODELS.filter((m) => m.kind === k.id && m.gender === gender);
                if (models.length === 0) return null;
                return (
                  <Field key={k.id} label={k.label}>
                    <p className="-mt-1 text-[12px] font-medium text-[#777771]">{k.hint}</p>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
                      {models.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            setPresetId(m.id);
                            setKindTab(m.kind);
                            setCatalogPick(null);
                            setCatalogItems([]);
                          }}
                          className={`group relative overflow-hidden rounded-[3px] bg-transparent text-left outline-none transition-all focus-visible:ring-2 focus-visible:ring-[#2563EB]/30 ${
                            presetId === m.id
                              ? "ring-2 ring-[#2563EB] ring-offset-2"
                              : "hover:-translate-y-0.5"
                          }`}
                        >
                          <div className="relative aspect-[3/4] w-full overflow-hidden rounded-[3px] bg-[#EFEFEC]">
                            <img
                              src={m.thumb}
                              alt={m.label}
                              loading="lazy"
                              decoding="async"
                              width={800}
                              height={1000}
                              className="h-full w-full object-cover object-center transition duration-500 group-hover:scale-[1.035]"
                            />
                          </div>
                          {presetId === m.id && (
                            <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[#2563EB] text-white shadow-[0_8px_18px_rgba(37,99,235,0.22)]">
                              <Check size={13} />
                            </span>
                          )}
                          <div className="pt-2.5">
                            <p className="truncate text-[13px] font-semibold tracking-[-0.03em] text-[#111111]">{m.label}</p>
                            <p className="truncate text-[11px] font-medium text-[#777771]">{m.info}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </Field>
                );
              })}


            </>
          )}


          {step === 1 && (
            <>
              <div className="grid gap-3 md:grid-cols-3">
                <AttributeSelect
                  label="Cabelo"
                  value={hairStyle}
                  options={HAIR_STYLES}
                  onChange={setHairStyle}
                  open={openAttribute === "hairStyle"}
                  onToggle={() => setOpenAttribute((current) => (current === "hairStyle" ? null : "hairStyle"))}
                />
                <AttributeSelect
                  label="Cor"
                  value={hairColor}
                  options={HAIR_COLORS}
                  onChange={setHairColor}
                  open={openAttribute === "hairColor"}
                  onToggle={() => setOpenAttribute((current) => (current === "hairColor" ? null : "hairColor"))}
                />
                <AttributeSelect
                  label="Olhos"
                  value={eyeColor}
                  options={EYE_COLORS}
                  onChange={setEyeColor}
                  open={openAttribute === "eyeColor"}
                  onToggle={() => setOpenAttribute((current) => (current === "eyeColor" ? null : "eyeColor"))}
                />
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <Field label="Produtos Velo">
                <div className="space-y-4">
                  <div className="relative">
                    <Search
                      size={16}
                      strokeWidth={1.9}
                      className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#8E8E87]"
                    />
                  <input
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    placeholder="Buscar no catálogo Velo"
                    className="h-11 w-full rounded-full border border-black/[0.08] bg-white pl-10 pr-4 text-[13px] font-medium text-[#101114] outline-none transition placeholder:text-[#A3A3A3] focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/10"
                  />
                  </div>
                  {catalogLoading ? (
                    <div className="grid max-h-[430px] grid-cols-2 gap-3 overflow-hidden sm:grid-cols-4 xl:grid-cols-6">
                      {Array.from({ length: 12 }).map((_, index) => (
                        <div key={index} className="animate-pulse">
                          <div className="aspect-square rounded-[3px] bg-[#EFEFEC]" />
                          <div className="mt-2 h-3 w-5/6 rounded-full bg-[#EFEFEC]" />
                          <div className="mt-1.5 h-3 w-3/5 rounded-full bg-[#EFEFEC]" />
                        </div>
                      ))}
                    </div>
                  ) : catalogItems.length === 0 ? (
                    <p className="py-10 text-center text-[13px] font-medium text-[#777771]">Nenhum produto encontrado.</p>
                  ) : (
                    <div className="grid max-h-[430px] grid-cols-2 gap-x-3 gap-y-5 overflow-y-auto pr-1 sm:grid-cols-4 xl:grid-cols-6">
                      {catalogItems.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setCatalogPick(p)}
                          className={`overflow-hidden rounded-[3px] text-left transition-all ${
                            catalogPick?.id === p.id ? "ring-2 ring-[#2563EB] ring-offset-2" : "hover:-translate-y-0.5"
                          }`}
                        >
                          <div className="aspect-square w-full rounded-[3px] bg-[#EFEFEC]">
                            <img src={p.image} alt={p.title} loading="lazy" className="h-full w-full object-contain p-2 mix-blend-multiply" />
                          </div>
                          <p className="line-clamp-2 pt-2 text-[11px] font-medium leading-4 text-[#111111]">{p.title}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </Field>
            </>
          )}

          {step === 3 && (
            <div className="space-y-4">
              {result ? (
                <div className="inline-flex items-center gap-2 rounded-full bg-[#EFF6FF] px-3 py-1 text-[11px] font-semibold text-[#2563EB]">
                  <Check size={13} /> Influencer criado
                </div>
              ) : (
                <p className="text-[14px] font-semibold tracking-[-0.03em] text-[#111111]">Criar influenciador</p>
              )}

              <Field label="Nome do personagem">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={60}
                  placeholder={selected ? selected.label : "Ex: Aurora, Marcus, Luna..."}
                  className="h-10 w-full rounded-full border border-black/[0.08] bg-white px-4 text-[13px] font-medium text-[#101114] outline-none transition placeholder:text-[#A3A3A3] focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/10"
                />
              </Field>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-[#E5E7EB] bg-[#F7F7F8]/55 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8E8E87]">Modelo</p>
                  <p className="mt-1 line-clamp-1 text-[13px] font-semibold text-[#111111]">
                    {selected ? `${selected.label} — ${selected.info}` : "Nenhum selecionado"}
                  </p>
                </div>
                <div className="rounded-2xl border border-[#E5E7EB] bg-[#F7F7F8]/55 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8E8E87]">Produto</p>
                  <p className="mt-1 line-clamp-1 text-[13px] font-semibold text-[#111111]">
                    {catalogPick?.title ?? "Nenhum selecionado"}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 border-t border-[#EFEFEB] pt-4">
            {!result ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={step === 0 || loading}
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                className="rounded-full text-[12px]"
              >
                <ArrowLeft size={15} /> Anterior
              </Button>
            ) : null}

            {result ? (
              <div className="flex w-full flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setResult(null);
                    reset();
                  }}
                  className="inline-flex h-9 items-center justify-center rounded-full border border-black/[0.08] bg-white px-4 text-[12px] font-semibold text-[#101114] transition-colors hover:bg-[#F7F7F8]"
                >
                  Criar outro
                </button>
                <div className="flex flex-wrap gap-2">
                  {result.url ? (
                    <a
                      href={result.url}
                      download={`${result.character.name}.png`}
                      className="inline-flex h-9 items-center justify-center rounded-full border border-black/[0.08] bg-white px-4 text-[12px] font-semibold text-[#101114] transition-colors hover:bg-[#F7F7F8]"
                    >
                      Baixar imagem
                    </a>
                  ) : null}
                  <button
                    type="button"
                    onClick={() =>
                      navigate("/dashboard/personagem-video", {
                        state: {
                          character_name: result.character.name,
                          character_image: result.url ?? "",
                          model_label: selected?.label ?? "",
                          hair: `${hairStyle}, ${hairColor}`,
                          eyes: eyeColor,
                          product_use: productUse,
                          product_title: catalogPick?.title,
                          product_image: catalogPick?.image,
                          product_price: catalogPick?.price,
                        },
                      })
                    }
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-full bg-[#2563EB] px-4 text-[12px] font-semibold text-white transition-colors hover:bg-[#1D4ED8]"
                  >
                    <Video size={15} /> Criar vídeo
                  </button>
                </div>
              </div>
            ) : step < STEPS.length - 1 ? (
              <button
                type="button"
                disabled={!selected || (step === 2 && !catalogPick)}
                onClick={() => setStep((s) => s + 1)}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-full bg-[#2563EB] px-4 text-[12px] font-semibold text-white transition-colors hover:bg-[#1D4ED8] disabled:pointer-events-none disabled:opacity-40"
              >
                Próximo <ArrowRight size={15} />
              </button>
            ) : (
              <button
                type="button"
                onClick={generate}
                disabled={loading}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-full bg-[#2563EB] px-4 text-[12px] font-semibold text-white transition-colors hover:bg-[#1D4ED8] disabled:pointer-events-none disabled:opacity-40"
              >
                {loading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                {loading ? "Criando..." : "Criar influenciador"}
              </button>
            )}
          </div>
        </div>
      </div>
      {step === 3 ? (
        <PhonePreview
          resultUrl={result?.url ?? null}
          loading={loading}
          name={name.trim() || selected?.label || ""}
        />
      ) : null}
    </div>
  );

};

export const useCharacterLibrary = () => {
  const [characters, setCharacters] = useState<AICharacter[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const signAll = useCallback(async (list: AICharacter[]) => {
    const paths = list.map((c) => c.image_url).filter(Boolean) as string[];
    if (!paths.length) return;
    const { data } = await supabase.storage.from("ai-characters").createSignedUrls(paths, 60 * 60);
    if (!data) return;
    setUrls((prev) => {
      const next = { ...prev };
      data.forEach((d) => {
        if (d.path && d.signedUrl) next[d.path] = d.signedUrl;
      });
      return next;
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("ai_characters")
      .select("id, name, mode, image_url, attributes, created_at")
      .order("created_at", { ascending: false });
    const list = (data ?? []) as AICharacter[];
    setCharacters(list);
    await signAll(list);
    setLoading(false);
  }, [signAll]);

  useEffect(() => {
    void load();
  }, [load]);

  const addCharacter = useCallback(
    (c: AICharacter) => {
      setCharacters((prev) => [c, ...prev]);
      void signAll([c]);
    },
    [signAll],
  );

  return useMemo(() => ({ characters, urls, loading, addCharacter, reload: load }), [characters, urls, loading, addCharacter, load]);
};

export default AICharacterCreator;
