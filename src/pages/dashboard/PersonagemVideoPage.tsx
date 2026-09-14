import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Bookmark, Copy, Download, ExternalLink, Package } from "lucide-react";
import { veloToast } from "@/components/ui/velo-toast";

const GOOGLE_FLOW_URL = "https://labs.google/fx/tools/flow";

type CharacterVideoState = {
  character_name?: string;
  character_image?: string;
  model_label?: string;
  hair?: string;
  eyes?: string;
  product_use?: "apresentar" | "vestir";
  product_title?: string;
  product_image?: string;
  product_price?: number;
};

const brl = (v?: number) =>
  typeof v === "number" && v > 0
    ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : null;

function buildMovementPrompt(s: CharacterVideoState) {
  const nome = s.character_name || "a personagem";
  const produto = s.product_title || "o produto";
  const preco = brl(s.product_price);
  const veste = s.product_use === "vestir";

  return `Vídeo UGC vertical (9:16), 8 segundos, gravado em celular, luz natural de ambiente real (quarto, sala ou espelho), sem estúdio.

PERSONAGEM (usar a imagem de referência anexada — manter rosto, fisionomia e identidade IDÊNTICOS):
${nome}${s.model_label ? ` — modelo base ${s.model_label}` : ""}. Cabelo: ${s.hair || "como na imagem"}. Olhos: ${s.eyes || "como na imagem"}. Mesma pele, mesmos traços, mesma idade aparente.

PRODUTO:
${produto}${preco ? ` — preço de venda ${preco}` : ""}. ${
    veste
      ? `${nome} está VESTINDO a peça; o caimento deve ser natural e realista, mostrando o tecido em movimento.`
      : `${nome} SEGURA e APRESENTA o produto para a câmera, sempre bem visível e em foco.`
  }

MOVIMENTO (0s → 8s):
0.0s–1.5s: plano médio, ${nome} olha direto para a câmera e começa a falar, expressão espontânea, leve tremor de câmera na mão.
1.5s–3.5s: ${veste ? "gira levemente o corpo mostrando a peça de outro ângulo" : "aproxima o produto da câmera, girando-o devagar para mostrar detalhes"}, pequeno zoom da câmera.
3.5s–6.0s: volta à posição inicial, gesticula com a mão livre enquanto fala do benefício${preco ? ` e do preço ${preco}` : ""}.
6.0s–8.0s: sorriso curto, leve inclinação da cabeça e aponta para baixo (CTA), câmera estabiliza.

ÁUDIO/FALA (pt-BR, tom natural de creator, sem locução publicitária):
"Gente, olha isso — ${produto}${preco ? `, e sai por só ${preco}` : ""}. Eu ${veste ? "tô usando e o caimento é perfeito" : "testei e valeu muito a pena"}. Corre que tá saindo rápido."

ESTILO: cores naturais, leve grão de câmera de celular, pele com textura real, sem texto na tela, sem logos, sem marca d'água, uma única pessoa em cena.`;
}

export default function PersonagemVideoPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state ?? {}) as CharacterVideoState;
  const [copied, setCopied] = useState(false);

  const prompt = useMemo(() => buildMovementPrompt(state), [state]);
  const preco = brl(state.product_price);

  const copy = () => {
    navigator.clipboard.writeText(prompt);
    setCopied(true);
    veloToast.success("Prompt copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  if (!state.character_name) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-[420px] flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
          <Package size={22} className="text-muted-foreground" />
        </div>
        <p className="text-[15px] font-semibold text-foreground">Nenhum personagem selecionado</p>
        <p className="text-[13px] text-muted-foreground">
          Gere um personagem de IA e clique em "Criar vídeo" para receber o prompt de movimento.
        </p>
        <button
          onClick={() => navigate("/dashboard/tiktok")}
          className="rounded-xl bg-foreground px-4 py-2 text-sm font-semibold text-background hover:opacity-90"
        >
          Ir para personagens
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1080px] px-4 py-6 sm:px-6 sm:py-10">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Vídeo UGC</p>
          <h1 className="mt-1 text-[22px] font-bold text-foreground sm:text-[26px]">
            Sua imagem e prompt estão prontos
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Baixe a imagem, copie o prompt de movimento e gere o vídeo no Google Flow.
          </p>
        </div>
        <button
          onClick={() => navigate(-1)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-[12px] font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={13} /> Voltar
        </button>
      </div>

      <div className="grid gap-5 md:grid-cols-[minmax(0,360px)_1fr]">
        {/* Imagem do personagem */}
        <div className="space-y-3">
          <div className="overflow-hidden rounded-2xl border border-border bg-muted">
            {state.character_image ? (
              <img
                src={state.character_image}
                alt={`Personagem de IA ${state.character_name}`}
                className="w-full object-cover"
              />
            ) : (
              <div className="flex aspect-[9/16] items-center justify-center text-sm text-muted-foreground">
                Pré-visualização indisponível
              </div>
            )}
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-[14px] font-semibold text-foreground">{state.character_name}</p>
            <ul className="mt-1.5 space-y-0.5 text-[12.5px] text-muted-foreground">
              {state.product_title && <li>Produto: {state.product_title}</li>}
              {preco && <li>Preço de venda: {preco}</li>}
              <li>{state.product_use === "vestir" ? "Vestindo a peça" : "Apresentando o produto"}</li>
            </ul>
          </div>
        </div>

        {/* Prompt */}
        <div className="space-y-3">
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Prompt de movimento
              </p>
              <button
                onClick={copy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground transition hover:border-foreground hover:text-foreground"
              >
                <Copy size={11} /> {copied ? "Copiado ✓" : "Copiar"}
              </button>
            </div>
            <p className="max-h-[440px] overflow-y-auto whitespace-pre-wrap text-[13.5px] leading-[1.65] text-foreground">
              {prompt}
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {state.character_image && (
              <a
                href={state.character_image}
                download={`${state.character_name}.png`}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-[13px] font-semibold text-foreground hover:bg-muted"
              >
                <Download size={14} /> Baixar imagem
              </a>
            )}
            <button
              onClick={() => navigate("/dashboard/tiktok")}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-[13px] font-semibold text-foreground hover:bg-muted"
            >
              <Bookmark size={14} /> Ver na biblioteca
            </button>
          </div>

          <button
            onClick={() => {
              navigator.clipboard.writeText(prompt);
              veloToast.success("Prompt copiado! Abrindo o Google Flow...");
              window.open(GOOGLE_FLOW_URL, "_blank", "noopener");
            }}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-foreground px-4 py-3 text-[13.5px] font-semibold text-background transition hover:opacity-90"
          >
            <ExternalLink size={15} /> Gerar vídeo no Google Flow
          </button>
          <p className="text-center text-[11.5px] text-muted-foreground">
            No Google Flow, envie a imagem do personagem e cole o prompt de movimento.
          </p>
        </div>
      </div>
    </div>
  );
}
