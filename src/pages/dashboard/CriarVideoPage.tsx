import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Sparkles, Download, Copy, Check as CheckIcon } from "lucide-react";
import SelectProductModal from "@/components/dashboard/SelectProductModal";

const CriarVideoPage = () => {
  const [searchParams] = useSearchParams();
  const imageUrl = searchParams.get("imageUrl") || "";

  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [promptGerado, setPromptGerado] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [selectModalOpen, setSelectModalOpen] = useState(false);

  useEffect(() => {
    if (!imageUrl) return;
    // Usa a URL diretamente para exibir — sem depender do fetch
    setImageSrc(imageUrl);
    // Tenta também carregar como blob para o download
    fetch(imageUrl)
      .then((r) => r.blob())
      .then((blob) => setImageBlob(blob))
      .catch(() => {});
  }, [imageUrl]);

  const handleGerarPrompt = async () => {
    if (!prompt.trim()) {
      toast.error("Descreva sua ideia antes de gerar o prompt.");
      return;
    }
    setGenerating(true);
    await new Promise((r) => setTimeout(r, 1200));

    const input = prompt.trim();
    const isFashion = /tênis|sapato|roupa|vestido|camisa|calça|moda|fashion|sneaker|calçado/i.test(input);
    const isFood = /comida|alimento|bebida|café|chocolate|snack|food/i.test(input);
    const isElectronics = /celular|fone|headphone|eletrônico|gadget|tech|smartphone|notebook/i.test(input);
    const isFitness = /academia|fitness|treino|musculação|elástico|exercício|sport/i.test(input);
    const isToy = /brinquedo|lego|jogo|infantil|criança|toy/i.test(input);
    const isHome = /casa|organiz|cozinha|decoração|home|gaveta|armário/i.test(input);

    let style, mood, scene;

    if (isFashion) {
      style = "editorial de moda urbana, câmera lenta, close nos detalhes do material";
      mood = "confiante e moderno, música trap suave";
      scene = "ambiente urbano com luz natural dourada, modelo em movimento";
    } else if (isFood) {
      style = "cinematográfico gastronômico, macro shots, vapor e texturas";
      mood = "apetitoso e aconchegante, música lo-fi";
      scene = "mesa rústica com iluminação quente, ingredientes ao redor";
    } else if (isElectronics) {
      style = "tech minimalista, reflexos em superfície espelhada, zoom dramático";
      mood = "futurista e premium, música eletrônica";
      scene = "fundo escuro com partículas de luz, produto rotacionando 360°";
    } else if (isFitness) {
      style = "dinâmico e energético, cortes rápidos, câmera em movimento";
      mood = "motivacional e intenso, música eletrônica com batida forte";
      scene = "academia ou ambiente externo, atleta em ação com o produto";
    } else if (isToy) {
      style = "colorido e divertido, ângulos criativos, animação stop motion";
      mood = "alegre e lúdico, música infantil animada";
      scene = "ambiente iluminado e colorido, mãos de criança interagindo";
    } else if (isHome) {
      style = "lifestyle clean, plano aberto e close de detalhes, transições suaves";
      mood = "organizado e aconchegante, música ambiente relaxante";
      scene = "ambiente doméstico bem iluminado, produto em uso no cotidiano";
    } else {
      style = "comercial moderno, planos variados entre close e plano aberto";
      mood = "profissional e envolvente, trilha sonora dinâmica";
      scene = "fundo neutro com iluminação de estúdio, produto em destaque";
    }

    const enhanced = `Crie um vídeo comercial de produto com base nesta descrição: "${input}".

Estilo visual: ${style}.
Atmosfera: ${mood}.
Cenário: ${scene}.
Duração sugerida: 15 a 30 segundos.
Resolução: 4K, proporção 9:16 para redes sociais.
Destaque os benefícios do produto de forma visual, sem texto na tela. Finalize com o produto centralizado em fundo limpo.`;

    setPrompt(enhanced);
    setGenerating(false);
    setPromptGerado(true);
    toast.success("Prompt otimizado com IA!");
  };

  const handleSalvarImagem = () => {
    if (!imageBlob) { toast.error("Nenhuma imagem disponível."); return; }
    const ext = imageBlob.type.includes("png") ? "png" : "jpg";
    const url = URL.createObjectURL(imageBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `produto-video.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Imagem salva!");
  };

  return (
    <div className="min-h-screen bg-[#f9f9f9] text-[#1a1c1c] font-['Inter'] flex flex-col">
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12 max-w-5xl mx-auto w-full">
        <div className="text-center mb-16 space-y-4">
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-[#1a1c1c] leading-tight font-['Manrope']">
            Transforme sua <span className="text-[#777777]">imaginação</span>
            <br />em comandos precisos.
          </h1>
          <p className="text-[#474747] text-lg max-w-2xl mx-auto">
            Refine suas ideias com nossa IA editorial. Crie prompts otimizados para arte digital, design e escrita criativa em segundos.
          </p>
        </div>

        <div className="w-full bg-white p-8 md:p-12 rounded-xl shadow-sm border border-[#e8e8e8]">
          <div className="mb-6 flex justify-center">
            <div className="relative h-40 w-40 rounded-xl border border-[#e8e8e8] bg-white flex items-center justify-center shadow-sm overflow-hidden">
              {imageSrc ? (
                <img src={imageSrc} alt="Produto" className="h-full w-full object-cover" />
              ) : (
                <button
                  onClick={() => setSelectModalOpen(true)}
                  className="w-full h-full flex items-center justify-center hover:bg-gray-50 transition-colors"
                >
                  <span className="text-4xl font-light text-[#e8e8e8]">+</span>
                </button>
              )}
              <span className="absolute -top-2 -right-2 bg-[#000000] text-white text-xs px-3 py-1 rounded-full font-medium">Produto</span>
            </div>
          </div>

          <div className="relative">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full min-h-[240px] p-6 bg-[#f3f3f4] border-none focus:ring-0 focus:bg-[#e8e8e8] rounded-xl text-xl text-[#1a1c1c] placeholder:text-[#777777] transition-all resize-none outline-none"
              placeholder="Descreva sua ideia aqui com detalhes..."
            />
            <div className="absolute bottom-4 right-4 text-[#777777] text-xs uppercase tracking-widest">AI Editor Ready</div>
          </div>

          <div className="flex flex-col md:flex-row gap-4 mt-8 justify-center items-center flex-wrap">
            <button
              onClick={handleGerarPrompt}
              disabled={generating}
              className="bg-gradient-to-r from-[#000000] to-[#3b3b3b] text-white px-8 py-4 rounded-full font-semibold text-base flex items-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg w-full md:w-auto disabled:opacity-60"
            >
              <span>{generating ? "Gerando..." : "Gerar Prompt"}</span>
              <Sparkles size={16} />
            </button>

            {promptGerado && (
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(prompt);
                    setCopied(true);
                    toast.success("Prompt copiado!");
                    setTimeout(() => setCopied(false), 2000);
                  } catch {
                    toast.error("Não foi possível copiar.");
                  }
                }}
                className="bg-gradient-to-r from-[#000000] to-[#3b3b3b] text-white px-8 py-4 rounded-full font-semibold text-base flex items-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg w-full md:w-auto"
              >
                <span>{copied ? "Copiado!" : "Copiar Prompt"}</span>
                {copied ? <CheckIcon size={16} /> : <Copy size={16} />}
              </button>
            )}

            {promptGerado && (
              <button
                onClick={handleSalvarImagem}
                className="bg-[#000000] text-white px-8 py-4 rounded-full font-semibold text-base flex items-center gap-2 hover:bg-[#3b3b3b] active:scale-95 transition-all w-full md:w-auto"
              >
                <span>Salvar imagens necessárias para este prompt</span>
                <Download size={16} />
              </button>
            )}
          </div>
        </div>
      </main>

      <SelectProductModal
        open={selectModalOpen}
        onClose={() => setSelectModalOpen(false)}
        onSelect={(product) => {
          const getImg = (images: any): string => {
            try {
              const arr = typeof images === "string" ? JSON.parse(images) : images;
              return Array.isArray(arr) && arr.length > 0 ? arr[0] : "";
            } catch { return ""; }
          };
          const img = getImg(product.images);
          const formatted = img.includes('.webp') ? img.replace('.webp', '.jpg') : img;
          setImageSrc(formatted || null);
          fetch(formatted).then(r => r.blob()).then(b => setImageBlob(b)).catch(() => {});
        }}
      />
    </div>
  );
};

export default CriarVideoPage;
