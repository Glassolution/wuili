import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import TikTokIcon from "@/components/dashboard/TikTokIcon";
import DashboardPageHeader from "@/components/dashboard/DashboardPageHeader";
import AICharacterCreator, { useCharacterLibrary, type AICharacter } from "@/components/dashboard/AICharacterCreator";
import { Loader2, Library, Wand2, Video, X } from "lucide-react";

const TikTokPage = () => {
  const navigate = useNavigate();
  const { characters, urls, loading, addCharacter } = useCharacterLibrary();
  const [tab, setTab] = useState<"criar" | "biblioteca">("criar");
  const [detail, setDetail] = useState<AICharacter | null>(null);
  const reduceMotion = useReducedMotion();

  return (
    <div
      className="-m-5 min-h-[calc(100%+2.5rem)] w-[calc(100%+2.5rem)] overflow-visible bg-white p-5 text-[#101114] sm:-m-6 sm:min-h-[calc(100%+3rem)] sm:w-[calc(100%+3rem)] sm:p-6 lg:-m-7 lg:min-h-[calc(100%+3.5rem)] lg:w-[calc(100%+3.5rem)] lg:p-7"
      style={{ fontFamily: '"Plus Jakarta Sans", Inter, ui-sans-serif, system-ui, sans-serif' }}
    >
      <div className="space-y-5">
        <DashboardPageHeader title="TikTok" className="mb-0 md:mb-0" />
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8E8E87]">
              <span className="grid h-7 w-7 place-items-center rounded-full border border-black/[0.08] bg-white shadow-[0_8px_18px_rgba(17,17,17,0.035)]">
                <TikTokIcon size={12} />
              </span>
              Influencers
            </div>
            <h2 className="mt-2 text-[22px] font-semibold tracking-[-0.04em] text-[#101114] sm:text-[24px]">
              Crie seu influencer de IA
            </h2>
            <p className="mt-1 max-w-2xl text-[13px] leading-[1.45] text-[#777771]">
              Personalize cada detalhe — aparência, estilo e personalidade. O influencer será usado nas suas gerações de
              imagem e vídeo com produtos do catálogo.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1 rounded-full border border-black/[0.08] bg-white p-1 shadow-[0_8px_18px_rgba(17,17,17,0.035)]">
            {([
              { id: "criar" as const, label: "Criar", icon: Wand2 },
              { id: "biblioteca" as const, label: "Biblioteca", icon: Library },
            ]).map(({ id, label, icon: Icon }) => {
              const ativa = tab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={`relative flex h-8 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#2563EB]/30 ${
                    ativa ? "text-white" : "text-[#777771] hover:text-[#101114]"
                  }`}
                >
                  {ativa ? (
                    <motion.span
                      layoutId="tiktok-tab-pill"
                      className="absolute inset-0 rounded-full bg-[#2563EB]"
                      transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }}
                    />
                  ) : null}
                  <Icon size={13} className="relative z-10" />
                  <span className="relative z-10">{label}</span>
                  {id === "biblioteca" && characters.length > 0 ? (
                    <span
                      className={`relative z-10 rounded-full px-1.5 text-[10px] font-bold ${
                        ativa ? "bg-white/20 text-white" : "bg-[#EFEFEB] text-[#6A6A64]"
                      }`}
                    >
                      {characters.length}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </header>

        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
            transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            {tab === "criar" ? (
              <AICharacterCreator onCreated={addCharacter} />
            ) : loading ? (
              <div className="flex items-center gap-2 text-[13.5px] text-black/50">
                <Loader2 size={15} className="animate-spin" /> Carregando...
              </div>
            ) : characters.length === 0 ? (
              <div className="flex h-48 flex-col items-center justify-center rounded-2xl border border-[#E5E7EB] bg-[#F7F7F8]/45 p-6 text-center">
                <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-white text-[#9CA3AF] shadow-[0_10px_24px_rgba(17,17,17,0.06)]">
                  <Library size={18} />
                </span>
                <p className="mt-4 text-[14px] font-semibold tracking-[-0.03em] text-[#101114]">Nenhum personagem ainda</p>
                <p className="mx-auto mt-1 max-w-[320px] text-[12px] font-medium leading-[1.45] text-[#777771]">
                  Crie o primeiro na aba "Criar" — ele fica salvo aqui para reutilizar depois.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
                {characters.map((c, index) => (
                  <motion.button
                    key={c.id}
                    type="button"
                    onClick={() => setDetail(c)}
                    initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: reduceMotion ? 0 : index * 0.04, duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                    className="group overflow-hidden rounded-[3px] bg-transparent text-left outline-none transition duration-200 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-[#2563EB]/30"
                  >
                    <div className="aspect-[3/4] overflow-hidden rounded-[3px] bg-[#EFEFEC]">
                      {c.image_url && urls[c.image_url] ? (
                        <img
                          src={urls[c.image_url]}
                          alt={c.name}
                          loading="lazy"
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                        />
                      ) : null}
                    </div>
                    <div className="pt-2.5">
                      <p className="truncate text-[13px] font-semibold tracking-[-0.03em] text-[#101114]">{c.name}</p>
                      <p className="mt-0.5 text-[11px] font-medium text-[#777771]">
                        {c.mode === "photo" || c.mode === "preset" ? "Modelo pronto" : "Personalização completa"}
                      </p>
                    </div>
                  </motion.button>
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {detail ? (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.18 }}
            onClick={() => setDetail(null)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              initial={reduceMotion ? false : { opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, scale: 0.97, y: 8 }}
              transition={{ duration: reduceMotion ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="relative w-full max-w-3xl overflow-hidden rounded-[20px] border border-black/[0.07] bg-white p-5 shadow-[0_30px_80px_rgba(10,10,10,0.24)]"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setDetail(null)}
                className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full text-black/45 transition hover:bg-black/[0.05] hover:text-[#101114]"
                aria-label="Fechar"
              >
                <X size={18} />
              </button>

              <div className="grid gap-5 md:grid-cols-[minmax(0,280px)_1fr]">
                <div className="overflow-hidden rounded-[16px] border border-black/[0.07] bg-[#F1F1EF]">
                  {detail.image_url && urls[detail.image_url] ? (
                    <img
                      src={urls[detail.image_url]}
                      alt={detail.name}
                      className="aspect-[3/4] w-full object-cover object-top"
                    />
                  ) : (
                    <div className="flex aspect-[3/4] items-center justify-center px-2 text-center text-[12px] text-black/40">
                      Pré-visualização indisponível
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-4">
                  <div>
                    <h3 className="text-[24px] font-semibold leading-tight tracking-[-0.03em] text-[#101114]">
                      {detail.name}
                    </h3>
                    <p className="mt-1 text-[13px] text-black/45">
                      {detail.mode === "photo" || detail.mode === "preset"
                        ? "Modelo pronto"
                        : "Personalização completa"}
                      {detail.created_at
                        ? ` · criado em ${new Date(detail.created_at).toLocaleDateString("pt-BR")}`
                        : ""}
                    </p>
                  </div>

                  <dl className="space-y-2 rounded-[14px] border border-black/[0.06] bg-[#FAFAF9] p-4 text-[13.5px]">
                    {[
                      ["Cabelo", [detail.attributes?.hairStyle, detail.attributes?.hairColor].filter(Boolean).join(" · ")],
                      ["Olhos", detail.attributes?.eyeColor],
                      ["Estilo", detail.attributes?.style],
                      [
                        "Produto",
                        detail.attributes?.productTitle
                          ? `${detail.attributes.productTitle}${
                              detail.attributes?.productUse === "vestir" ? " (vestindo)" : ""
                            }`
                          : "",
                      ],
                    ]
                      .filter(([, value]) => Boolean(value))
                      .map(([label, value]) => (
                        <div key={String(label)} className="flex gap-2">
                          <dt className="w-16 shrink-0 text-black/45">{label}</dt>
                          <dd className="line-clamp-2 font-medium text-[#101114]">{value}</dd>
                        </div>
                      ))}
                    <div className="flex gap-2">
                      <dt className="w-16 shrink-0 text-black/45">Vídeo</dt>
                      <dd className="font-medium text-[#101114]">Prompt UGC pronto para o Google Flow</dd>
                    </div>
                  </dl>

                  <div className="mt-auto flex flex-col gap-2">
                    <Button
                      type="button"
                      onClick={() =>
                        navigate("/dashboard/personagem-video", {
                          state: {
                            character_name: detail.name,
                            character_image: detail.image_url ? urls[detail.image_url] ?? "" : "",
                            hair: [detail.attributes?.hairStyle, detail.attributes?.hairColor]
                              .filter(Boolean)
                              .join(", "),
                            eyes: detail.attributes?.eyeColor,
                            product_use: detail.attributes?.productUse,
                            product_title: detail.attributes?.productTitle,
                            product_image: detail.attributes?.productImageUrl,
                          },
                        })
                      }
                    >
                      <Video size={15} /> Criar vídeo
                    </Button>
                    {detail.image_url && urls[detail.image_url] ? (
                      <Button asChild variant="outline">
                        <a href={urls[detail.image_url]} download={`${detail.name}.png`}>
                          Baixar imagem
                        </a>
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};

export default TikTokPage;
