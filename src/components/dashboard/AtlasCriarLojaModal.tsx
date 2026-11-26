import { useEffect, useRef, useState, type FormEvent } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ImagePlus, X } from "lucide-react";

import { veloToast } from "@/components/ui/velo-toast";
import {
  ROTULO_DO_TIPO,
  corPrincipal,
  descreverProdutos,
  type BriefingDaLoja,
  type PedidoDeLoja,
  type TipoDeLoja,
} from "@/lib/briefingDaLoja";

/**
 * Modal "Criar meu site": o que a conversa não pergunta (logo, nome, produtos).
 * Ao confirmar, o chat mostra a construção passo a passo (AtlasConstrucaoDaLoja).
 */

const EXEMPLO_DE_PRODUTOS: Record<TipoDeLoja, string> = {
  fisico: "Ex.:\nKit de potes herméticos\nOrganizador de gaveta",
  infoproduto: "Ex.:\nE-book de receitas fit\nPlanilha de cardápio semanal",
  curso: "Ex.:\nViolão do zero\nHarmonia para iniciantes",
  jogo: "Ex.:\n100 diamantes\nPasse de elite",
  servico: "Ex.:\nLimpeza e profilaxia\nClareamento dental",
};

/** Reduz a logo para no máximo 256px (vai no metadata da loja). SVG fica como veio. */
async function lerLogo(arquivo: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result));
    leitor.onerror = () => reject(new Error("Não consegui ler a imagem"));
    leitor.readAsDataURL(arquivo);
  });
  if (arquivo.type === "image/svg+xml") return dataUrl;
  const imagem = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Imagem inválida"));
    img.src = dataUrl;
  });
  const escala = Math.min(1, 256 / Math.max(imagem.width, imagem.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(imagem.width * escala));
  canvas.height = Math.max(1, Math.round(imagem.height * escala));
  canvas.getContext("2d")?.drawImage(imagem, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}

type Props = {
  briefing: BriefingDaLoja | null;
  onFechar: () => void;
  onCriar: (pedido: PedidoDeLoja) => void;
};

const AtlasCriarLojaModal = ({ briefing, onFechar, onCriar }: Props) => {
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [produtos, setProdutos] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [lendoLogo, setLendoLogo] = useState(false);
  const arquivoRef = useRef<HTMLInputElement>(null);

  // Cada briefing novo começa com o formulário limpo.
  useEffect(() => {
    if (!briefing) return;
    setNome("");
    setDescricao("");
    setProdutos("");
    setLogo(null);
  }, [briefing]);

  const escolherLogo = async (arquivo: File | undefined) => {
    if (!arquivo) return;
    if (!arquivo.type.startsWith("image/")) {
      veloToast.error("Envie uma imagem (PNG, JPG, WEBP ou SVG)");
      return;
    }
    if (arquivo.size > 5 * 1024 * 1024) {
      veloToast.error("A logo pode ter até 5 MB");
      return;
    }
    setLendoLogo(true);
    try {
      setLogo(await lerLogo(arquivo));
    } catch (e) {
      veloToast.error(e instanceof Error ? e.message : "Não consegui usar essa imagem");
    } finally {
      setLendoLogo(false);
    }
  };

  const criar = (evento: FormEvent) => {
    evento.preventDefault();
    if (!briefing || !nome.trim()) return;
    onCriar({
      briefing,
      nome: nome.trim().slice(0, 60),
      logo,
      descricao: descricao.trim().slice(0, 160),
      produtosPlanejados: produtos
        .split("\n")
        .map((p) => p.trim())
        .filter(Boolean)
        .slice(0, 30),
    });
  };

  const cor = corPrincipal(briefing?.cores);

  return (
    <DialogPrimitive.Root open={!!briefing} onOpenChange={(aberto) => !aberto && onFechar()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[80] bg-black/30 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          // Desliga o relevo global dos botões escuros (index.css).
          data-velo-flat-buttons
          className="fixed left-1/2 top-1/2 z-[81] max-h-[calc(100svh-32px)] w-[calc(100vw-32px)] max-w-[480px] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[16px] border border-black/[0.08] bg-white shadow-[0_24px_64px_-16px_rgba(16,24,40,0.28)] focus:outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98]"
        >
          {briefing && (
            <form onSubmit={criar}>
              <div className="flex items-start justify-between gap-4 px-6 pb-2 pt-5">
                <div>
                  <DialogPrimitive.Title className="text-[17px] font-semibold tracking-[-0.015em] text-[#0A0A0A]">
                    Criar meu site
                  </DialogPrimitive.Title>
                  <DialogPrimitive.Description className="mt-1 text-[13px] leading-5 text-[#6B6B6B]">
                    Últimos detalhes. Você muda tudo depois no editor.
                  </DialogPrimitive.Description>
                </div>
                <DialogPrimitive.Close
                  className="-mr-2 grid h-8 w-8 shrink-0 place-items-center rounded-[8px] text-[#6B6B6B] transition-colors hover:bg-black/[0.05] hover:text-[#1F1F1F]"
                  aria-label="Fechar"
                >
                  <X className="h-[18px] w-[18px]" strokeWidth={1.8} />
                </DialogPrimitive.Close>
              </div>

              {/* O que a conversa já decidiu. */}
              <div className="mx-6 mt-2 flex flex-wrap gap-1.5">
                {[
                  `Loja de ${briefing.nicho}`,
                  ROTULO_DO_TIPO[briefing.tipo],
                  briefing.estilo,
                  briefing.marca?.fonte ? `Fonte ${briefing.marca.fonte}` : null,
                ]
                  .filter(Boolean)
                  .map((item) => (
                    <span key={item} className="rounded-[6px] bg-[#F3F3F1] px-2 py-1 text-[12px] text-[#3A3A3A]">
                      {item}
                    </span>
                  ))}
                {briefing.cores && (
                  <span className="inline-flex items-center gap-1.5 rounded-[6px] bg-[#F3F3F1] px-2 py-1 text-[12px] text-[#3A3A3A]">
                    <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: cor.hex }} />
                    {briefing.cores}
                  </span>
                )}
              </div>

              <div className="space-y-5 px-6 pb-2 pt-5">
                <div>
                  <span className="text-[13px] font-medium text-[#1F1F1F]">{briefing.marca?.tem ? "Logo da sua marca" : "Logo da marca"}</span>
                  <span className="ml-1.5 text-[12px] text-[#9A9A9A]">{briefing.marca?.tem ? "a loja usa a sua" : "opcional"}</span>
                  <div className="mt-2 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => arquivoRef.current?.click()}
                      className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-[12px] border border-dashed border-black/[0.16] bg-[#FAFAF9] text-[#8A8A8A] transition-colors hover:border-black/[0.3] hover:text-[#3A3A3A]"
                      aria-label={logo ? "Trocar a logo" : "Enviar a logo"}
                    >
                      {logo ? (
                        <img src={logo} alt="Logo enviada" className="h-full w-full object-contain p-1.5" />
                      ) : (
                        <ImagePlus className="h-5 w-5" strokeWidth={1.6} />
                      )}
                    </button>
                    <div className="text-[12.5px] leading-5 text-[#6B6B6B]">
                      {lendoLogo ? (
                        "Preparando a imagem..."
                      ) : logo ? (
                        <>
                          <button type="button" onClick={() => arquivoRef.current?.click()} className="font-medium text-[#1F1F1F] hover:underline">
                            Trocar
                          </button>
                          <span className="mx-1.5 text-[#C4C4C4]">·</span>
                          <button type="button" onClick={() => setLogo(null)} className="font-medium text-[#1F1F1F] hover:underline">
                            Remover
                          </button>
                        </>
                      ) : (
                        <>
                          PNG, JPG ou SVG, até 5 MB.
                          <br />
                          Sem logo, a loja usa o nome.
                        </>
                      )}
                    </div>
                    <input
                      ref={arquivoRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      className="hidden"
                      onChange={(e) => {
                        void escolherLogo(e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                  </div>
                </div>

                <label className="block">
                  <span className="text-[13px] font-medium text-[#1F1F1F]">Nome da loja ou marca</span>
                  <input
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    maxLength={60}
                    required
                    autoFocus
                    placeholder="Como sua loja vai se chamar?"
                    className="mt-2 block h-10 w-full rounded-[10px] border border-black/[0.12] bg-white px-3 text-[14px] text-[#1F1F1F] outline-none transition-colors placeholder:text-[#A3A3A3] focus:border-black/[0.35]"
                  />
                </label>

                <label className="block">
                  <span className="text-[13px] font-medium text-[#1F1F1F]">Uma frase sobre a loja</span>
                  <span className="ml-1.5 text-[12px] text-[#9A9A9A]">opcional</span>
                  <input
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    maxLength={160}
                    placeholder={`Ex.: ${briefing.nicho} com atendimento de verdade`}
                    className="mt-2 block h-10 w-full rounded-[10px] border border-black/[0.12] bg-white px-3 text-[14px] text-[#1F1F1F] outline-none transition-colors placeholder:text-[#A3A3A3] focus:border-black/[0.35]"
                  />
                </label>

                <label className="block">
                  <span className="text-[13px] font-medium text-[#1F1F1F]">
                    {briefing.tipo === "servico" ? "Serviços" : "Produtos"} que você quer na loja
                  </span>
                  <span className="ml-1.5 text-[12px] text-[#9A9A9A]">opcional, um por linha</span>
                  <textarea
                    value={produtos}
                    onChange={(e) => setProdutos(e.target.value)}
                    rows={3}
                    placeholder={EXEMPLO_DE_PRODUTOS[briefing.tipo]}
                    className="mt-2 block w-full resize-none rounded-[10px] border border-black/[0.12] bg-white px-3 py-2.5 text-[14px] leading-[1.5] text-[#1F1F1F] outline-none transition-colors placeholder:text-[#A3A3A3] focus:border-black/[0.35]"
                  />
                  <span className="mt-1.5 block text-[12px] text-[#8A8A8A]">{descreverProdutos(briefing)}.</span>
                </label>
              </div>

              <div className="mt-3 flex items-center justify-end gap-2 border-t border-black/[0.06] px-6 py-4">
                <DialogPrimitive.Close className="h-9 rounded-[9px] px-3.5 text-[13.5px] font-medium text-[#3A3A3A] transition-colors hover:bg-black/[0.05]">
                  Cancelar
                </DialogPrimitive.Close>
                <button
                  type="submit"
                  disabled={!nome.trim() || lendoLogo}
                  className="h-9 rounded-[9px] bg-[#0A0A0A] px-4 text-[13.5px] font-medium text-white transition-colors hover:bg-[#262626] disabled:bg-[#EDEDEB] disabled:text-black/30"
                >
                  Criar meu site
                </button>
              </div>
            </form>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

export default AtlasCriarLojaModal;
