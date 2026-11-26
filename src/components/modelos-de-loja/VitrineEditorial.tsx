import { useEffect, type CSSProperties, type ReactNode } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Heart, ImageIcon, Search, ShoppingBag, User } from "lucide-react";

import { progressoDaTroca, textoDaTroca, type Montagem, type SecaoDaVitrine } from "@/lib/montagemDaVitrine";
import type { DadosDoPalco } from "@/lib/palcoDoSite";

/**
 * Modelo "Vitrine editorial" (catálogo em src/lib/modelosDeLoja.ts).
 *
 * Layout de loja de moda: topo transparente sobre a capa (menu à esquerda,
 * marca em serifa no centro, ícones à direita), capa grande com foto, grade
 * "Novidades" com abas e cartões cinza-claros, mosaico de destaques.
 *
 * Loja de moda (`dados.moda`): o desenho fica exatamente como o modelo; muda
 * só imagem, texto e produtos. Outros nichos: a fonte dos títulos e a cor de
 * destaque também seguem a escolha da pessoa.
 *
 * Desenhado em `largura` px (mínimo LARGURA_DA_VITRINE) e escalado por quem
 * usa. `data-alvo` marca onde os cursores da montagem trabalham.
 */

export const LARGURA_DA_VITRINE = 1200;

const FONTES: Record<string, string> = {
  Geist: "Geist, Inter, system-ui, sans-serif",
  Inter: "Inter, system-ui, sans-serif",
  "Plus Jakarta Sans": '"Plus Jakarta Sans", Inter, system-ui, sans-serif',
  "Helvetica Neue": '"Helvetica Neue", Helvetica, Arial, sans-serif',
  Georgia: 'Georgia, "Times New Roman", serif',
};
const SANS = 'Outfit, "Helvetica Neue", Arial, sans-serif';
const SERIFA = '"Playfair Display", Georgia, serif';
const CINZA_DO_CARTAO = "#F1F1F1";
const CINZA_DO_MODELO = "#E6E6E3";
const AZUL_DO_MOSAICO = "#5B7CA6";
const preco = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** Carrega as fontes do modelo (Outfit e Playfair Display) uma vez. */
function useFontesDoModelo() {
  useEffect(() => {
    const id = "velo-fontes-vitrine-editorial";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600&family=Playfair+Display:wght@700;800&display=swap";
    document.head.appendChild(link);
  }, []);
}

const textoSobre = (hex: string) => {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  if (Number.isNaN(n)) return "#FFFFFF";
  const luz = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return luz > 0.62 ? "#111111" : "#FFFFFF";
};

const Caret = () => <span className="ml-[2px] inline-block h-[0.9em] w-[2px] animate-pulse bg-[#2563EB] align-[-0.08em]" />;

const Foto = ({ src, mostrar, className = "", style, icone = true }: { src: string | null; mostrar: number; className?: string; style?: CSSProperties; icone?: boolean }) => (
  <>
    {icone && (
      <span className="absolute inset-0 grid place-items-center text-black/[0.13]" style={{ opacity: 1 - mostrar }}>
        <ImageIcon className="h-10 w-10" strokeWidth={1.2} />
      </span>
    )}
    {src && mostrar > 0 && (
      <img
        src={src}
        alt=""
        className={`absolute ${className}`}
        style={{ opacity: mostrar, transform: `scale(${1.05 - 0.05 * mostrar})`, ...style }}
      />
    )}
  </>
);

const BotaoBranco = ({ children, alvo, className = "" }: { children: ReactNode; alvo?: string; className?: string }) => (
  <span
    data-alvo={alvo}
    className={`inline-flex items-center rounded-[3px] bg-white font-medium text-[#141414] shadow-[0_1px_2px_rgba(0,0,0,0.06)] ${className}`}
  >
    {children}
  </span>
);

const VitrineEditorial = ({
  dados,
  montagem,
  t,
  largura = LARGURA_DA_VITRINE,
}: {
  dados: DadosDoPalco;
  montagem: Montagem;
  t: number;
  /** Largura do desenho (no mínimo LARGURA_DA_VITRINE; maior em tela larga). */
  largura?: number;
}) => {
  useFontesDoModelo();
  const m = montagem;
  const p = (campo: string) => progressoDaTroca(m, campo, t);
  const txt = (campo: string, doModelo: string, final: string): ReactNode => {
    const { texto, digitando } = textoDaTroca(m, campo, t, doModelo, final);
    return (
      <>
        {texto}
        {digitando && <Caret />}
      </>
    );
  };
  const apareceu = (secao: SecaoDaVitrine) => Math.min(1, Math.max(0, (t - m.secoes[secao]) / 450));

  // Medidas do modelo, proporcionais à largura.
  const L = largura;
  const margem = Math.round(L * 0.065);
  const alturaDaCapa = Math.round(Math.min(Math.max(L * 0.56, 620), 860));
  const linhaDoMosaico = Math.round((L - 2 * margem) * 0.26);

  // Personalização de fonte e cor só fora da moda.
  const moda = !!dados.moda;
  const fonteDosTitulos = !moda && p("fonte") > 0.5 ? FONTES[dados.fonte] ?? SANS : SANS;
  const coresAplicadas = !moda && p("cores") > 0.5;
  const corDoPreco = coresAplicadas ? dados.destaque : "#7A7A7A";
  const corDoMosaico = coresAplicadas ? dados.destaque : AZUL_DO_MOSAICO;

  const capa = p("capa.imagem");
  const capaComFoto = capa > 0.5 && !!dados.capa;
  const corNaCapa = capaComFoto || capa > 0.5 ? "#FFFFFF" : "#1F1F1F";

  // Grade: 8 vagas no modelo; depois, os itens da pessoa (ou 4 vagas para completar no editor).
  const itens = dados.itens.slice(0, 8);
  const ultimaTroca = itens.length > 0 ? m.trocas[`produto.${itens.length - 1}`] : m.trocas["secao.titulo"];
  const gradeFeita = ultimaTroca ? t >= ultimaTroca.t0 + ultimaTroca.dur : false;
  const vagas = gradeFeita ? (itens.length > 0 ? itens.length : 4) : 8;
  const categorias = [...new Set(itens.map((i) => i.categoria).filter((c): c is string => !!c))].slice(0, 4);
  const abasFinais = moda && categorias.length === 0 ? ["Feminino", "Masculino", "Calçados", "Bolsas", "Acessórios"] : ["Todos", ...categorias];
  const abas = p("secao.abas") > 0.5 ? abasFinais : ["Categoria", "Categoria", "Categoria", "Categoria", "Categoria"];

  const d = (i: number) => p(`destaque.${i}`) > 0.5;
  const tamanhoDoNome = dados.nome.length > 14 ? 48 : dados.nome.length > 9 ? 62 : 78;

  return (
    <div className="bg-white text-[#1F1F1F]" style={{ width: L, fontFamily: SANS }}>
      {/* Capa, com o topo transparente por cima */}
      <section data-secao="capa" className="relative overflow-hidden" style={{ height: alturaDaCapa, opacity: apareceu("capa"), background: CINZA_DO_MODELO }}>
        {!dados.capa && <div className="absolute inset-0" style={{ background: AZUL_DO_MOSAICO, opacity: capa }} />}
        <div data-alvo="capa-foto" className="absolute inset-y-0 right-0 w-1/2" />
        {/* Pessoa à direita e cabeça sem corte: corta mais embaixo que em cima. */}
        <Foto src={dados.capa} mostrar={dados.capa ? capa : 0} className="inset-0 h-full w-full object-cover" style={{ objectPosition: "68% 22%" }} icone={false} />
        {capaComFoto && <div className="absolute inset-0 bg-gradient-to-r from-black/30 via-black/5 to-transparent" style={{ opacity: capa }} />}
        {capa < 0.5 && (
          <span className="absolute right-[22%] top-1/2 grid -translate-y-1/2 place-items-center text-black/[0.12]">
            <ImageIcon className="h-16 w-16" strokeWidth={1} />
          </span>
        )}

        <span className="absolute left-5 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white text-[#1F1F1F] shadow-sm">
          <ChevronLeft className="h-4 w-4" strokeWidth={2} />
        </span>
        <span className="absolute right-5 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white text-[#1F1F1F] shadow-sm">
          <ChevronRight className="h-4 w-4" strokeWidth={2} />
        </span>

        <div className="absolute transition-colors duration-500" style={{ left: margem, top: alturaDaCapa * 0.37, width: Math.min(620, L * 0.4), color: corNaCapa }}>
          <p data-alvo="capa-etiqueta" className="inline-block text-[12px] font-medium uppercase tracking-[0.06em]">
            {txt("capa.etiqueta", "Coleção", dados.etiqueta)}
          </p>
          <h1 data-alvo="capa-titulo" className="mt-3 line-clamp-3 text-[58px] font-semibold leading-[1.08] tracking-[-0.01em]" style={{ fontFamily: fonteDosTitulos }}>
            {txt("capa.titulo", "Título da sua coleção", dados.subtitulo)}
          </h1>
          <BotaoBranco alvo="capa-botao" className="mt-9 h-[52px] px-8 text-[14px]">
            {txt("capa.botao", "Ver agora", dados.botao)}
          </BotaoBranco>
        </div>

        {/* Topo */}
        <div data-secao="topo" className="absolute inset-x-0 top-0 h-[96px] transition-colors duration-500" style={{ opacity: apareceu("topo"), color: corNaCapa }}>
          <nav className="absolute top-1/2 flex -translate-y-1/2 items-center gap-8 text-[13.5px] font-medium" style={{ left: margem }}>
            {dados.menu.map((item, i) => (
              <span key={i} data-alvo={`menu-${i}`} className="inline-flex items-center gap-1">
                {txt(`menu.${i}`, ["Início", "Loja", "Páginas", "Contato"][i] ?? "Página", item)}
                {i < dados.menu.length - 1 && <ChevronDown className="h-3 w-3 opacity-80" strokeWidth={2.2} />}
              </span>
            ))}
          </nav>
          <div data-alvo="marca" className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2.5">
            {dados.logo && p("marca.logo") > 0 && (
              <img
                src={dados.logo}
                alt=""
                className="h-10 w-10 rounded-[8px] bg-white object-contain p-0.5"
                style={{ opacity: p("marca.logo"), transform: `scale(${0.6 + 0.4 * p("marca.logo")})` }}
              />
            )}
            <span className="whitespace-nowrap text-[32px] font-bold tracking-[-0.01em]" style={{ fontFamily: SERIFA }}>
              {txt("marca.nome", "Sua marca", dados.nome)}
            </span>
          </div>
          <div className="absolute top-1/2 flex -translate-y-1/2 items-center gap-5" style={{ right: margem }}>
            <User className="h-[20px] w-[20px]" strokeWidth={1.6} />
            <Search className="h-[20px] w-[20px]" strokeWidth={1.6} />
            <Heart className="h-[20px] w-[20px]" strokeWidth={1.6} />
            <span className="relative">
              <ShoppingBag className="h-[20px] w-[20px]" strokeWidth={1.6} />
              <span className="absolute -right-2 -top-1.5 grid h-4 w-4 place-items-center rounded-full bg-[#141414] text-[9px] font-semibold text-white">0</span>
            </span>
          </div>
        </div>
      </section>

      {/* Novidades */}
      <section data-secao="novidades" className="pb-24 pt-[92px]" style={{ opacity: apareceu("novidades"), paddingLeft: margem, paddingRight: margem }}>
        <h2 data-alvo="secao-titulo" className="text-center text-[40px] font-normal tracking-[-0.01em] text-[#1A1A1A]" style={{ fontFamily: fonteDosTitulos }}>
          {txt("secao.titulo", "Novidades", dados.tituloDaSecao)}
        </h2>
        <div data-alvo="abas" className="mx-auto mt-8 flex w-fit justify-center gap-10 text-[12px] font-medium uppercase tracking-[0.04em]">
          {abas.map((aba, i) => (
            <span key={`${aba}-${i}`} className={i === 0 ? "text-[#141414]" : "text-[#B0B0B0]"}>
              {aba}
            </span>
          ))}
        </div>
        <div className="mt-14 grid grid-cols-4 gap-x-[6px] gap-y-12">
          {Array.from({ length: vagas }, (_, i) => {
            const item = itens[i];
            const foto = item ? p(`produto.${i}`) : 0;
            if (!item && gradeFeita)
              return (
                <div key={i} className="grid aspect-square place-items-center border-[1.5px] border-dashed border-black/[0.14] text-center text-[13px] text-[#8A8A8A]">
                  <span>
                    <span className="mx-auto mb-1.5 grid h-8 w-8 place-items-center rounded-full bg-black/[0.05] text-[20px] leading-none">+</span>
                    Adicionar no editor
                  </span>
                </div>
              );
            return (
              <div key={i}>
                <div data-alvo={`produto-${i}`} className="relative aspect-square overflow-hidden" style={{ background: CINZA_DO_CARTAO }}>
                  {item?.imagem ? (
                    <Foto src={item.imagem} mostrar={foto} className="inset-0 h-full w-full object-contain p-[12%] mix-blend-multiply" />
                  ) : item && foto > 0.5 ? (
                    <span className="absolute inset-0 grid place-items-center text-black/25">
                      <ShoppingBag className="h-10 w-10" strokeWidth={1.2} />
                    </span>
                  ) : (
                    <Foto src={null} mostrar={0} />
                  )}
                </div>
                <p className="mt-4 text-[10px] uppercase tracking-[0.04em] text-[#9A9A9A]">
                  {item && foto > 0.5 ? item.categoria ?? dados.tituloDaSecao : "Categoria"}
                </p>
                <p className="mt-1 line-clamp-2 text-[13px] text-[#222]">{item && foto > 0 ? item.titulo : "Nome do produto"}</p>
                <p data-alvo={`preco-${i}`} className="mt-1 text-[13px] transition-colors duration-500" style={{ color: corDoPreco }}>
                  {item?.preco != null && p(`preco.${i}`) > 0 ? preco.format(item.preco) : item && foto > 0 ? "" : "R$ 00,00"}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Destaques: um alto à esquerda; à direita, um largo em cima e dois embaixo */}
      <section data-secao="destaques" className="pb-24" style={{ opacity: apareceu("destaques"), paddingLeft: margem, paddingRight: margem }}>
        <div className="grid gap-[5px]" style={{ gridTemplateColumns: "0.4fr 0.3fr 0.3fr", gridTemplateRows: `${linhaDoMosaico}px ${linhaDoMosaico}px` }}>
          {/* A: alto */}
          <div data-alvo="destaque-0" className="relative row-span-2 overflow-hidden" style={{ background: d(0) ? "#E4E8EE" : CINZA_DO_MODELO }}>
            <Foto src={dados.capa} mostrar={dados.capa ? p("destaque.0") : 0} className="inset-0 h-full w-full object-cover object-[72%_center]" />
            {dados.capa && <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/40 to-transparent" style={{ opacity: p("destaque.0") }} />}
            <div className="absolute left-7 top-7">
              <p className="text-[11px] uppercase tracking-[0.04em] text-[#5E5E5E]">{d(0) ? dados.etiqueta : "Etiqueta"}</p>
              <p className="mt-2 max-w-[260px] text-[27px] font-medium leading-[1.15] text-[#1A1A1A]" style={{ fontFamily: fonteDosTitulos }}>
                {d(0) ? `Coleção ${dados.nome}` : "Título do destaque"}
              </p>
              <BotaoBranco className="mt-6 h-10 px-5 text-[12.5px]">{d(0) ? dados.botao : "Ver agora"}</BotaoBranco>
            </div>
          </div>
          {/* B: largo em cima */}
          <div data-alvo="destaque-1" className="relative col-span-2 overflow-hidden" style={{ background: d(1) ? "#E9ECF1" : CINZA_DO_MODELO }}>
            <Foto
              src={itens[0]?.imagem ?? dados.capa}
              mostrar={(itens[0]?.imagem ?? dados.capa) ? p("destaque.1") : 0}
              className={`inset-y-0 right-0 h-full w-1/2 ${itens[0]?.imagem ? "object-contain p-6 mix-blend-multiply" : "object-cover"}`}
            />
            <div className="absolute left-7 top-7">
              <p className="text-[11px] uppercase tracking-[0.04em] text-[#5E5E5E]">{d(1) ? itens[0]?.categoria ?? "Destaque" : "Etiqueta"}</p>
              <p className="mt-2 line-clamp-2 max-w-[300px] text-[27px] font-medium leading-[1.15] text-[#1A1A1A]" style={{ fontFamily: fonteDosTitulos }}>
                {d(1) ? itens[0]?.titulo ?? dados.tituloDaSecao : "Título do destaque"}
              </p>
              <BotaoBranco className="mt-6 h-10 px-5 text-[12.5px]">{d(1) ? "Comprar" : "Ver agora"}</BotaoBranco>
            </div>
          </div>
          {/* C: embaixo, à esquerda */}
          <div data-alvo="destaque-2" className="relative overflow-hidden" style={{ background: d(2) ? "#ECEEF1" : CINZA_DO_MODELO }}>
            <Foto
              src={itens[1]?.imagem ?? null}
              mostrar={itens[1]?.imagem ? p("destaque.2") : 0}
              className="bottom-0 left-0 h-[62%] w-[75%] object-contain p-4 mix-blend-multiply"
            />
            <div className="absolute right-6 top-6 text-right">
              <p className="text-[11px] uppercase tracking-[0.04em] text-[#5E5E5E]">{d(2) ? itens[1]?.categoria ?? "Novidades" : "Etiqueta"}</p>
              <p className="ml-auto mt-2 line-clamp-2 max-w-[220px] text-[23px] font-medium leading-[1.15] text-[#1A1A1A]" style={{ fontFamily: fonteDosTitulos }}>
                {d(2) ? itens[1]?.titulo ?? "Novidades" : "Título do destaque"}
              </p>
              <BotaoBranco className="mt-5 h-10 px-5 text-[12.5px]">{d(2) ? "Comprar" : "Ver agora"}</BotaoBranco>
            </div>
          </div>
          {/* D: azul, com o nome grande */}
          <div
            data-alvo="destaque-3"
            className="relative flex flex-col items-center justify-center overflow-hidden px-6 text-center transition-colors duration-500"
            style={{ background: d(3) ? corDoMosaico : CINZA_DO_MODELO, color: d(3) ? textoSobre(corDoMosaico) : "#1F1F1F" }}
          >
            <p className="text-[21px] font-medium" style={{ fontFamily: fonteDosTitulos }}>{d(3) ? "Conheça a loja" : "Título do destaque"}</p>
            <p className="mt-1 max-w-full truncate font-extrabold leading-none" style={{ fontFamily: SERIFA, fontSize: d(3) ? tamanhoDoNome : 78 }}>
              {d(3) ? dados.nome : "Texto"}
            </p>
            <BotaoBranco className="mt-6 h-10 px-5 text-[12.5px]">{d(3) ? "Ver tudo" : "Ver agora"}</BotaoBranco>
          </div>
        </div>
      </section>
    </div>
  );
};

export default VitrineEditorial;
