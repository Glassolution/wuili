import { useEffect, type CSSProperties, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Heart, ImageIcon, Search, ShoppingBag, Star, User } from "lucide-react";

import { progressoDaTroca, textoDaTroca, textosDaVitrineModa, type Montagem } from "@/lib/montagemDaVitrine";
import type { DadosDoPalco } from "@/lib/palcoDoSite";
import { categoriaDoProduto, variacoesDaVitrine } from "@/lib/variacoesDaVitrine";

/**
 * Modelo "Vitrine moda" (catálogo em src/lib/modelosDeLoja.ts), para loja de
 * roupa, calçado e acessório. Estrutura de loja de moda brasileira: faixa de
 * aviso, topo escuro com o menu, capa larga, carrossel de categorias, faixa
 * escura de chamada, duas vitrines de 4 produtos (Novidades e Essenciais),
 * três atalhos com foto, avaliações, frase da marca, newsletter e rodapé escuro.
 *
 * Tudo que aparece vem da pessoa: nome, logo, cores, capa, produtos e preços do
 * catálogo ou da lista dela. Nada de foto, texto ou avaliação de outra loja;
 * avaliações só aparecem quando existirem (até lá, um aviso honesto).
 *
 * Desenhado em `largura` px (mínimo LARGURA_DA_VITRINE em VitrineEditorial) e
 * escalado por quem usa. `data-alvo` marca onde os cursores da montagem
 * trabalham; `data-secao`, as seções que o Atlas desenha.
 */

const SANS = 'Archivo, "Helvetica Neue", Arial, sans-serif';
const CONDENSADA = '"Roboto Condensed", "Arial Narrow", Arial, sans-serif';
/* Fontes das capas: cada variação tem a sua. */
const GEOMETRICA = 'Outfit, "Helvetica Neue", Arial, sans-serif';
const SERIFA = '"Playfair Display", Georgia, serif';
const SERIFA_FINA = '"Cormorant Garamond", Georgia, serif';
const CINZA = "#F4F4F4";
const CINZA_DA_FOTO = "#ECECEC";
const ESCURO_DO_MODELO = "#212121";
const preco = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function useFontesDoModelo() {
  useEffect(() => {
    const id = "velo-fontes-vitrine-moda-2";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700&family=Roboto+Condensed:wght@400;500;600;700&family=Outfit:wght@500;600;700&family=Playfair+Display:wght@400;700&family=Cormorant+Garamond:wght@500;600&display=swap";
    document.head.appendChild(link);
  }, []);
}

/** Mistura um pouco da cor da pessoa no preto do modelo (sem exagero). */
function escuroComCor(hex: string, quanto = 0.2) {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  if (Number.isNaN(n)) return ESCURO_DO_MODELO;
  const base = [0x17, 0x17, 0x17];
  const cor = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const mix = base.map((b, i) => Math.round(b + (cor[i] - b) * quanto));
  return `#${mix.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

const Caret = () => <span className="ml-[2px] inline-block h-[0.9em] w-[2px] animate-pulse bg-[#2563EB] align-[-0.08em]" />;

const Foto = ({ src, mostrar, className = "", style }: { src: string | null; mostrar: number; className?: string; style?: CSSProperties }) => (
  <>
    <span className="absolute inset-0 grid place-items-center text-black/[0.14]" style={{ opacity: 1 - (src ? mostrar : 0) }}>
      <ImageIcon className="h-9 w-9" strokeWidth={1.2} />
    </span>
    {src && mostrar > 0 && (
      <img src={src} alt="" className={`absolute ${className}`} style={{ opacity: mostrar, transform: `scale(${1.05 - 0.05 * mostrar})`, ...style }} />
    )}
  </>
);

const Pilula = ({ children, alvo, fundo, cor, className = "" }: { children: ReactNode; alvo?: string; fundo: string; cor: string; className?: string }) => (
  <span data-alvo={alvo} className={`inline-flex items-center justify-center rounded-full font-semibold transition-colors duration-500 ${className}`} style={{ background: fundo, color: cor }}>
    {children}
  </span>
);

const Vaga = ({ texto }: { texto: string }) => (
  <div className="grid h-full w-full place-items-center border-[1.5px] border-dashed border-black/[0.15] text-center text-[13px] text-[#8A8A8A]">
    <span>
      <span className="mx-auto mb-1.5 grid h-8 w-8 place-items-center rounded-full bg-black/[0.05] text-[20px] leading-none">+</span>
      {texto}
    </span>
  </div>
);

const VitrineModa = ({ dados, montagem, t, largura }: { dados: DadosDoPalco; montagem: Montagem; t: number; largura: number }) => {
  useFontesDoModelo();
  const m = montagem;
  const textos = textosDaVitrineModa(dados);
  const variacoes = variacoesDaVitrine(dados);
  const p = (campo: string) => progressoDaTroca(m, campo, t);
  const comecou = (campo: string) => p(campo) > 0;
  const txt = (campo: string, doModelo: string, final: string): ReactNode => {
    const { texto, digitando } = textoDaTroca(m, campo, t, doModelo, final);
    return (
      <>
        {texto}
        {digitando && <Caret />}
      </>
    );
  };
  const apareceu = (secao: string) => Math.min(1, Math.max(0, (t - (m.secoes[secao] ?? 0)) / 450));

  const L = largura;
  const margem = Math.round(L * 0.045);
  const alturaDaCapa = Math.round(Math.min(Math.max(L * 0.42, 500), 760));
  const escuro = p("cores") > 0.5 ? escuroComCor(dados.destaque) : ESCURO_DO_MODELO;
  const itens = dados.itens.slice(0, 8);
  const capa = p("capa.imagem");

  // Funções (não componentes): o modelo redesenha a cada quadro e não pode remontar as fotos.
  const titulo = ({ campo, doModelo, final, sub, subFinal }: { campo: string; doModelo: string; final: string; sub: string; subFinal: string }) => (
    <div className="text-center">
      <h2 data-alvo={campo.replace(".", "-")} className="text-[34px] font-semibold uppercase leading-none tracking-[0.01em] text-[#1A1A1A]" style={{ fontFamily: CONDENSADA }}>
        {txt(campo, doModelo, final)}
      </h2>
      <p className="mt-2 text-[14.5px] text-[#4A4A4A]">{comecou(campo) ? subFinal : sub}</p>
    </div>
  );

  const vitrine = ({ secao, campo, nome, sub, de }: { secao: string; campo: string; nome: string; sub: string; de: number }) => {
    const daVez = itens.slice(de, de + 4);
    const pronta = p(campo) >= 1;
    return (
      <section data-secao={secao} className="pt-[72px]" style={{ opacity: apareceu(secao), paddingLeft: margem, paddingRight: margem }}>
        {titulo({ campo, doModelo: "Título da vitrine", final: nome, sub: "Uma frase curta sobre a vitrine", subFinal: sub })}
        <div className="mt-10 grid grid-cols-4 gap-6">
          {Array.from({ length: 4 }, (_, j) => {
            const i = de + j;
            const item = daVez[j];
            if (!item && pronta)
              return (
                <div key={i} className="aspect-[4/5]">
                  <Vaga texto="Adicionar no editor" />
                </div>
              );
            const foto = item ? p(`produto.${i}`) : 0;
            return (
              <div key={i}>
                <div data-alvo={`produto-${i}`} className="relative aspect-[4/5] overflow-hidden" style={{ background: CINZA_DA_FOTO }}>
                  {item && !item.imagem && foto > 0.5 ? (
                    <span className="absolute inset-0 grid place-items-center text-black/25">
                      <ShoppingBag className="h-10 w-10" strokeWidth={1.2} />
                    </span>
                  ) : (
                    <Foto src={item?.imagem ?? null} mostrar={foto} className="inset-0 h-full w-full object-contain p-[10%] mix-blend-multiply" />
                  )}
                </div>
                <p className="mt-3.5 line-clamp-2 text-[13px] uppercase tracking-[0.02em] text-[#1F1F1F]">{item && foto > 0 ? item.titulo : "Nome do produto"}</p>
                <p data-alvo={`preco-${i}`} className="mt-1.5 text-[16px] font-bold text-[#141414]">
                  {item?.preco != null && p(`preco.${i}`) > 0 ? preco.format(item.preco) : item && foto > 0 ? "" : "R$ 00,00"}
                </p>
              </div>
            );
          })}
        </div>
      </section>
    );
  };

  /* ----- Topo (4 variações) ----- */
  const marca = (estilo: "minusculo" | "espacado", cor: string) => (
    <div data-alvo="marca" className="flex shrink-0 items-center gap-3" style={{ color: cor }}>
      {dados.logo && p("marca.logo") > 0 && (
        <img
          src={dados.logo}
          alt=""
          className="h-11 w-11 rounded-[9px] bg-white object-contain p-0.5 shadow-[0_0_0_1px_rgba(0,0,0,0.06)]"
          style={{ opacity: p("marca.logo"), transform: `scale(${0.7 + 0.3 * p("marca.logo")})` }}
        />
      )}
      {estilo === "minusculo" ? (
        <span className="whitespace-nowrap text-[34px] font-bold lowercase leading-none tracking-[-0.045em]">{txt("marca.nome", "sua marca", dados.nome)}</span>
      ) : (
        <span className="whitespace-nowrap text-[25px] font-semibold uppercase leading-none tracking-[0.3em]" style={{ marginRight: "-0.3em" }}>
          {txt("marca.nome", "Sua marca", dados.nome)}
        </span>
      )}
    </div>
  );
  const menu = (className: string, ativo?: string) => (
    <nav className={`flex items-center ${className}`}>
      {dados.menu.map((item, i) => (
        <span key={i} data-alvo={`menu-${i}`} className="relative whitespace-nowrap py-1">
          {txt(`menu.${i}`, i === 0 ? "Todos os produtos" : "Categoria", item)}
          {ativo && i === 0 && <span className="absolute inset-x-0 -bottom-[5px] h-[2px] transition-colors duration-500" style={{ background: ativo }} />}
        </span>
      ))}
    </nav>
  );
  const icones = (cor: string, comBusca = true) => (
    <div className="flex shrink-0 items-center gap-7" style={{ color: cor }}>
      {comBusca && <Search className="h-[23px] w-[23px]" strokeWidth={1.35} />}
      <Heart className="h-[23px] w-[23px]" strokeWidth={1.35} />
      <User className="h-[23px] w-[23px]" strokeWidth={1.35} />
      <ShoppingBag className="h-[23px] w-[23px]" strokeWidth={1.35} />
    </div>
  );
  const busca = (cor: string, linha: string) => (
    <div className="flex w-[210px] items-center gap-2.5 border-b pb-1.5 text-[13px]" style={{ color: cor, borderColor: linha }}>
      <Search className="h-[18px] w-[18px]" strokeWidth={1.5} />
      Buscar
    </div>
  );
  const aviso = (fundo: string, cor: string, centro: boolean, maiusculo = false) => (
    <div
      className={`flex h-[36px] items-center transition-colors duration-500 ${centro ? "justify-center" : ""} ${maiusculo ? "text-[11.5px] uppercase tracking-[0.14em]" : "text-[12.5px] tracking-[0.01em]"}`}
      style={{ background: fundo, color: cor, paddingLeft: margem, paddingRight: margem }}
    >
      <span data-alvo="aviso">{txt("aviso", "Escreva aqui um aviso da loja", textos.aviso)}</span>
    </div>
  );
  const pad = { paddingLeft: margem, paddingRight: margem };
  const topo = () => {
    switch (variacoes.topo) {
      case "centralizado":
        return (
          <>
            {aviso(escuro, "rgba(255,255,255,0.85)", true, true)}
            <header data-alvo="topo" className="bg-white">
              <div className="grid h-[86px] grid-cols-[1fr_auto_1fr] items-center" style={pad}>
                {busca("#8A8A8A", "rgba(0,0,0,0.15)")}
                {marca("espacado", "#141414")}
                <div className="flex justify-end">{icones("#1F1F1F", false)}</div>
              </div>
              {menu("h-[48px] justify-center gap-11 border-y border-black/[0.08] text-[12px] uppercase tracking-[0.14em] text-[#2A2A2A]")}
            </header>
          </>
        );
      case "claro":
        return (
          <>
            {aviso(escuro, "rgba(255,255,255,0.85)", false)}
            <header data-alvo="topo" className="flex h-[80px] items-center gap-10 border-b border-black/[0.08] bg-white" style={pad}>
              {marca("minusculo", "#141414")}
              {menu("flex-1 justify-center gap-8 text-[14px] tracking-[0.02em] text-[#333]", escuro)}
              {icones("#1F1F1F")}
            </header>
          </>
        );
      case "escuro-centralizado":
        return (
          <>
            {aviso(CINZA, "#333", true)}
            <header data-alvo="topo" className="transition-colors duration-500" style={{ background: escuro }}>
              <div className="grid h-[84px] grid-cols-[1fr_auto_1fr] items-center" style={pad}>
                {busca("rgba(255,255,255,0.6)", "rgba(255,255,255,0.2)")}
                {marca("espacado", "#FFFFFF")}
                <div className="flex justify-end">{icones("rgba(255,255,255,0.9)", false)}</div>
              </div>
              {menu("h-[50px] justify-center gap-10 border-t border-white/10 text-[13.5px] tracking-[0.05em] text-white/75")}
            </header>
          </>
        );
      default:
        return (
          <>
            {aviso(CINZA, "#333", false)}
            <header data-alvo="topo" className="flex h-[78px] items-center gap-14 transition-colors duration-500" style={{ background: escuro, ...pad }}>
              {marca("minusculo", "#FFFFFF")}
              {menu("flex-1 gap-[30px] text-[14.5px] tracking-[0.03em] text-white/[0.82]")}
              {icones("rgba(255,255,255,0.9)")}
            </header>
          </>
        );
    }
  };

  /* ----- Capa (4 variações) ----- */
  const foto = (posicao: string) =>
    dados.capa ? (
      <Foto src={dados.capa} mostrar={capa} className="inset-0 h-full w-full object-cover" style={{ objectPosition: posicao }} />
    ) : (
      <div className="absolute inset-0 transition-colors duration-500" style={{ background: escuro, opacity: capa }} />
    );
  const alvoDaFoto = <div data-alvo="capa-foto" className="absolute inset-y-0 right-0 w-1/2" />;
  const etiquetaDaCapa = (className: string, style?: CSSProperties) => (
    <p data-alvo="capa-etiqueta" className={className} style={style}>
      {txt("capa.etiqueta", "Coleção", textos.capaEtiqueta)}
    </p>
  );
  const textoDaCapa = (className: string) => (
    <p data-alvo="capa-texto" className={className}>
      {txt("capa.texto", "Uma frase curta sobre a loja e o que ela vende.", textos.capaTexto)}
    </p>
  );
  /** Título em duas linhas (a 2ª mais forte), digitado como uma frase só. */
  const tituloEmLinhas = (classe1: string, classe2: string) => {
    const { texto, digitando } = textoDaTroca(m, "capa.titulo", t, "Título da coleção", textos.capaTitulo);
    const [l1, l2] = comecou("capa.titulo") ? [texto.slice(0, textos.capaLinhas[0].length), texto.slice(textos.capaLinhas[0].length + 1)] : ["Título da", "coleção"];
    return (
      <>
        <span className={`block ${classe1}`}>
          {l1}
          {digitando && !l2 && <Caret />}
        </span>
        <span className={`block ${classe2}`}>
          {l2 || "\u00a0"}
          {digitando && l2 && <Caret />}
        </span>
      </>
    );
  };
  const capaDaLoja = () => {
    const base = { opacity: apareceu("capa") };
    switch (textos.variacoes.capa) {
      // Estúdio claro: título em serifa (linha fina + linha forte), texto e dois botões.
      case "estudio":
        return (
          <section data-secao="capa" className="relative overflow-hidden" style={{ ...base, height: alturaDaCapa, background: "#EEECE7" }}>
            {alvoDaFoto}
            {foto("72% 30%")}
            <div className="absolute inset-y-0 left-0 w-[62%] bg-gradient-to-r from-[#EEECE7] via-[#EEECE7]/85 to-transparent" />
            <div className="absolute top-1/2 -translate-y-1/2 text-[#141414]" style={{ left: margem, maxWidth: Math.min(620, L * 0.46) }}>
              {etiquetaDaCapa("text-[12px] font-medium uppercase tracking-[0.22em] text-[#555]")}
              <h1 data-alvo="capa-titulo" className="mt-4 uppercase" style={{ fontFamily: SERIFA }}>
                {tituloEmLinhas("text-[58px] font-normal leading-[1.02]", "text-[66px] font-bold leading-[1.02]")}
              </h1>
              {textoDaCapa("mt-6 max-w-[400px] text-[17px] leading-[1.5] text-[#3A3A3A]")}
              <div className="mt-8 flex gap-4">
                <Pilula alvo="capa-botao" fundo={escuro} cor="#FFFFFF" className="h-12 px-7 text-[13px] uppercase tracking-[0.04em]">
                  {txt("capa.botao", "Botão", textos.botao)}
                </Pilula>
                <span data-alvo="capa-botao2" className="inline-flex h-12 items-center rounded-full border border-[#141414]/70 px-7 text-[13px] font-semibold uppercase tracking-[0.04em]">
                  {txt("capa.botao2", "Botão", textos.botao2)}
                </span>
              </div>
            </div>
          </section>
        );
      // Cartão editorial: capa dentro de um cartão arredondado, serifa fina, marcador 01-02-03.
      case "cartao":
        return (
          <section data-secao="capa" className="bg-white p-5" style={base}>
            <div className="relative overflow-hidden rounded-[22px]" style={{ height: alturaDaCapa - 40, background: "#CFC6BA" }}>
              {alvoDaFoto}
              {foto("60% 30%")}
              <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-black/10 to-transparent" style={{ opacity: Math.max(capa, 0.3) }} />
              <div className="absolute top-1/2 -translate-y-1/2 text-white" style={{ left: margem, maxWidth: Math.min(520, L * 0.4) }}>
                {etiquetaDaCapa("text-[11.5px] font-medium uppercase tracking-[0.2em] text-white/80")}
                <h1 data-alvo="capa-titulo" className="mt-5 text-[76px] font-medium leading-[0.98]" style={{ fontFamily: SERIFA_FINA }}>
                  {txt("capa.titulo", "Título da coleção", textos.capaTitulo)}
                </h1>
                {textoDaCapa("mt-6 max-w-[320px] text-[14.5px] leading-[1.6] text-white/80")}
                <span data-alvo="capa-botao" className="mt-8 inline-flex h-11 items-center rounded-[2px] px-6 text-[12px] font-semibold uppercase tracking-[0.1em] text-white transition-colors duration-500" style={{ background: escuro }}>
                  {txt("capa.botao", "Botão", textos.botao)}
                </span>
              </div>
              {/* Pílula escura: o marcador fica legível sobre foto clara ou escura. */}
              <div
                className="absolute top-1/2 flex -translate-y-1/2 flex-col items-center gap-3 rounded-full bg-black/30 px-2.5 py-4 text-[12px] text-white/70 backdrop-blur-sm"
                style={{ right: margem * 0.6 }}
              >
                <span className="font-semibold text-white">01</span>
                <span className="h-10 w-px bg-white/60" />
                <span>02</span>
                <span className="h-10 w-px bg-white/40" />
                <span>03</span>
              </div>
            </div>
          </section>
        );
      // Marca no centro: foto cheia e o nome grande no meio, sem título longo.
      case "marca":
        return (
          <section data-secao="capa" className="relative overflow-hidden" style={{ ...base, height: alturaDaCapa, background: "#D9D6D1" }}>
            {alvoDaFoto}
            {foto("50% 28%")}
            <div className="absolute inset-0 bg-black/15" style={{ opacity: capa }} />
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-white">
              {etiquetaDaCapa("text-[12px] font-medium uppercase tracking-[0.4em] text-white/85")}
              <p className="mt-3 whitespace-nowrap text-[104px] font-bold uppercase leading-none tracking-[0.12em] drop-shadow-[0_2px_18px_rgba(0,0,0,0.18)]" style={{ fontFamily: GEOMETRICA, marginRight: "-0.12em" }}>
                {comecou("marca.nome") ? dados.nome : "Sua marca"}
              </p>
              <h1 data-alvo="capa-titulo" className="mt-4 text-[14px] font-medium uppercase tracking-[0.45em] text-white/90" style={{ marginRight: "-0.45em" }}>
                {txt("capa.titulo", "Título da coleção", textos.capaTitulo)}
              </h1>
              <span data-alvo="capa-botao" className="mt-8 border-b border-white/80 pb-1 text-[13px] font-semibold uppercase tracking-[0.18em]">
                {txt("capa.botao", "Botão", textos.botao)}
              </span>
            </div>
            <div className="absolute bottom-7 flex gap-3" style={{ right: margem }}>
              {[ChevronLeft, ChevronRight].map((Seta, i) => (
                <span key={i} className="grid h-[52px] w-[52px] place-items-center border border-white/60 text-white">
                  <Seta className="h-5 w-5" strokeWidth={1.4} />
                </span>
              ))}
            </div>
          </section>
        );
      // Foto cheia: título forte em sans, botão branco pequeno, setas redondas.
      default:
        return (
          <section data-secao="capa" className="relative overflow-hidden" style={{ ...base, height: alturaDaCapa, background: "#CBD3DC" }}>
            {alvoDaFoto}
            {foto("66% 30%")}
            <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-black/5 to-transparent" style={{ opacity: Math.max(capa, 0.3) }} />
            <div className="absolute top-1/2 -translate-y-1/2 text-white" style={{ left: margem + 40, maxWidth: Math.min(600, L * 0.42) }}>
              {etiquetaDaCapa("text-[13px] font-medium uppercase tracking-[0.03em] text-white/90", { fontFamily: GEOMETRICA })}
              <h1 data-alvo="capa-titulo" className="mt-4 text-[64px] font-semibold leading-[1.06] tracking-[-0.01em]" style={{ fontFamily: GEOMETRICA }}>
                {txt("capa.titulo", "Título da coleção", textos.capaTitulo)}
              </h1>
              <span data-alvo="capa-botao" className="mt-9 inline-flex h-[52px] items-center rounded-[3px] bg-white px-8 text-[14px] font-medium text-[#141414]" style={{ fontFamily: GEOMETRICA }}>
                {txt("capa.botao", "Botão", textos.botao)}
              </span>
            </div>
            {[ChevronLeft, ChevronRight].map((Seta, i) => (
              <span key={i} className="absolute top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white text-[#141414] shadow-sm" style={i === 0 ? { left: 24 } : { right: 24 }}>
                <Seta className="h-4 w-4" strokeWidth={2} />
              </span>
            ))}
          </section>
        );
    }
  };

  const categoriasProntas = p("chamada.titulo") > 0;
  const fotoDaCategoria = (c: string) => itens.find((i) => (i.categoria || categoriaDoProduto(i.titulo)) === c && i.imagem)?.imagem ?? null;
  const fotosDosAtalhos = [dados.capa, itens[0]?.imagem ?? null, itens[1]?.imagem ?? null];
  const notas = [0, 1, 2, 3];

  return (
    <div className="bg-white text-[#1F1F1F]" style={{ width: L, fontFamily: SANS }}>
      {/* Aviso + topo */}
      {/* Aviso + topo: o desenho varia por loja (variacoesDaVitrine) */}
      <div data-secao="topo" style={{ opacity: apareceu("topo") }}>
        {topo()}
      </div>

      {/* Capa: 4 variações (foto, fonte, texto e botões mudam por loja) */}
      {capaDaLoja()}

      {/* Categorias */}
      <section data-secao="categorias" className="py-6" style={{ opacity: apareceu("categorias"), paddingLeft: margem, paddingRight: margem }}>
        {categoriasProntas && textos.categorias.length === 0 ? (
          <div className="h-[150px]">
            <Vaga texto="Crie as categorias da loja no editor" />
          </div>
        ) : (
          <div className="grid grid-cols-6 gap-4">
            {Array.from({ length: 6 }, (_, i) => {
              const nome = textos.categorias[i];
              if (categoriasProntas && !nome) return <div key={i} />;
              const pronto = nome ? p(`categoria.${i}`) : 0;
              const foto = nome ? fotoDaCategoria(nome) : null;
              return (
                <div key={i} data-alvo={`categoria-${i}`} className="relative flex aspect-[1.05] flex-col items-center justify-end pb-4" style={{ background: CINZA }}>
                  <div className="absolute inset-x-0 top-0 bottom-10">
                    <Foto src={foto} mostrar={pronto} className="inset-0 h-full w-full object-contain p-[16%] mix-blend-multiply" />
                  </div>
                  <span className="relative text-[11px] uppercase tracking-[0.08em] text-[#3A3A3A]">{nome && pronto > 0.3 ? nome : "Categoria"}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Chamada escura */}
      <section data-secao="chamada" className="py-[68px] text-center text-white transition-colors duration-500" style={{ opacity: apareceu("chamada"), background: escuro }}>
        <h2 data-alvo="chamada-titulo" className="text-[40px] font-bold uppercase leading-none" style={{ fontFamily: CONDENSADA }}>
          {txt("chamada.titulo", "Título da chamada", textos.chamadaTitulo)}
        </h2>
        <p data-alvo="chamada-texto" className="mx-auto mt-4 max-w-[420px] text-[15px] leading-snug text-white/80">
          {txt("chamada.texto", "Uma frase curta convidando para conhecer a loja.", textos.chamadaTexto)}
        </p>
        <Pilula alvo="chamada-botao" fundo="#FFFFFF" cor={escuro} className="mt-7 h-12 px-9 text-[14px] uppercase">
          {txt("chamada.botao", "Botão", dados.botao)}
        </Pilula>
      </section>

      {vitrine({ secao: "novidades", campo: "secao.titulo", nome: textos.novidades, sub: textos.novidadesSub, de: 0 })}
      {vitrine({ secao: "essenciais", campo: "secao2.titulo", nome: textos.essenciais, sub: textos.essenciaisSub, de: 4 })}

      {/* Atalhos */}
      <section data-secao="atalhos" className="mt-[80px] py-10" style={{ opacity: apareceu("atalhos"), background: CINZA, paddingLeft: margem, paddingRight: margem }}>
        <div className="grid grid-cols-3 gap-6">
          {textos.atalhos.map((atalho, i) => {
            const pronto = p(`destaque.${i}`);
            const foto = fotosDosAtalhos[i];
            const ehProduto = !!foto && foto !== dados.capa;
            return (
              <div key={i} className="bg-white p-3">
                <div
                  data-alvo={`destaque-${i}`}
                  className="relative aspect-[16/10] overflow-hidden transition-colors duration-500"
                  style={{ background: pronto > 0.5 ? (ehProduto ? CINZA_DA_FOTO : escuro) : "#DADADA" }}
                >
                  {/* Sem foto: fica a cor da loja (nada inventado no lugar). */}
                  {foto || pronto < 0.5 ? (
                    <Foto src={foto} mostrar={pronto} className={`inset-0 h-full w-full ${ehProduto ? "object-contain p-6 mix-blend-multiply" : "object-cover"}`} />
                  ) : null}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                  <div className="absolute bottom-5 left-5 text-white">
                    <p className="text-[11.5px] text-white/80">{pronto > 0.5 ? atalho.legenda : "Legenda"}</p>
                    <p className="mt-1 text-[24px] font-light uppercase tracking-[0.06em]" style={{ fontFamily: CONDENSADA }}>
                      {pronto > 0.5 ? atalho.titulo : "Título"}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Avaliações: só as de verdade; até existirem, um aviso */}
      <section data-secao="avaliacoes" className="py-[64px]" style={{ opacity: apareceu("avaliacoes"), paddingLeft: margem, paddingRight: margem }}>
        <h2 className="text-center text-[28px] text-[#1A1A1A]" style={{ fontFamily: CONDENSADA }}>
          Avaliações dos clientes
        </h2>
        <div data-alvo="avaliacoes" className="mx-auto mt-9 max-w-[980px]">
          {p("avaliacoes") > 0.5 ? (
            <div className="border border-black/[0.08] px-8 py-10 text-center" style={{ background: CINZA }}>
              <div className="flex justify-center gap-1 text-[#D4D4D4]">
                {[0, 1, 2, 3, 4].map((k) => (
                  <Star key={k} className="h-5 w-5 fill-current" />
                ))}
              </div>
              <p className="mt-3 text-[15px] text-[#3A3A3A]">As avaliações dos seus clientes aparecem aqui depois das primeiras compras.</p>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-4">
              {notas.map((k) => (
                <div key={k} className="px-5 py-6" style={{ background: CINZA }}>
                  <div className="flex gap-1 text-[#D4D4D4]">
                    {[0, 1, 2, 3, 4].map((e) => (
                      <Star key={e} className="h-4 w-4 fill-current" />
                    ))}
                  </div>
                  <div className="mt-4 h-2.5 w-[85%] rounded-full bg-black/[0.08]" />
                  <div className="mt-2 h-2.5 w-[60%] rounded-full bg-black/[0.08]" />
                  <p className="mt-5 text-[12.5px] text-[#9A9A9A]">Nome do cliente</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Frase da marca */}
      <section data-secao="frase" className="py-[60px] text-center" style={{ opacity: apareceu("frase"), background: CINZA }}>
        <div className="mx-auto mb-10 h-px bg-black/[0.12]" style={{ width: L - 2 * margem }} />
        <p data-alvo="frase" className="mx-auto max-w-[640px] text-[22px] leading-[1.45] text-[#1F1F1F]">
          {txt("frase", "Uma frase que diz quem é a sua marca e chama para a loja.", textos.frase)}
        </p>
        <Pilula alvo="frase-botao" fundo={escuro} cor="#FFFFFF" className="mt-7 h-11 px-7 text-[13.5px]">
          {txt("frase.botao", "Botão", dados.botao)}
        </Pilula>
      </section>

      {/* Newsletter */}
      <section data-secao="newsletter" className="flex items-center justify-between gap-10 py-[64px]" style={{ opacity: apareceu("newsletter"), paddingLeft: margem, paddingRight: margem }}>
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#777]">Newsletter</p>
          <p data-alvo="newsletter" className="mt-2 text-[30px] font-semibold uppercase leading-tight text-[#141414]" style={{ fontFamily: CONDENSADA }}>
            {txt("newsletter", "Receba as novidades", textos.newsletter)}
          </p>
        </div>
        <div className="w-[460px] shrink-0">
          <div className="flex h-12">
            <span className="flex flex-1 items-center border border-black/[0.15] px-4 text-[14px] text-[#9A9A9A]">Seu e-mail</span>
            <span className="grid w-[120px] place-items-center text-[14px] font-semibold text-white transition-colors duration-500" style={{ background: escuro }}>
              Enviar
            </span>
          </div>
          <p className="mt-2 text-[11.5px] text-[#9A9A9A]">Ao enviar, você concorda com a política de privacidade da loja.</p>
        </div>
      </section>

      {/* Rodapé */}
      <footer data-secao="rodape" className="pt-[56px] text-white transition-colors duration-500" style={{ opacity: apareceu("rodape"), background: escuro, paddingLeft: margem, paddingRight: margem }}>
        <div className="grid grid-cols-4 gap-10 pb-12">
          <div>
            <p className="text-[28px] font-bold lowercase leading-none tracking-[-0.03em]">{comecou("marca.nome") ? dados.nome : "sua marca"}</p>
            <p className="mt-3 text-[13px] text-white/60">{comecou("capa.etiqueta") ? dados.etiqueta : "O que a loja vende"}</p>
          </div>
          {[
            ["Institucional", ["Sobre", "Dúvidas frequentes"]],
            ["Sua conta", ["Minha conta", "Meus pedidos", "Meu carrinho", "Meus favoritos"]],
            ["Atendimento", ["Fale conosco"]],
          ].map(([titulo, links]) => (
            <div key={titulo as string}>
              <p className="text-[13px] font-semibold uppercase tracking-[0.1em]">{titulo as string}</p>
              <ul className="mt-4 space-y-2.5 text-[13.5px] text-white/65">
                {(links as string[]).map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-white/10 py-6 text-[12.5px] text-white/55">
          <span data-alvo="rodape">{txt("rodape", "© Sua marca. Todos os direitos reservados.", textos.rodape)}</span>
        </div>
      </footer>
    </div>
  );
};

export default VitrineModa;
