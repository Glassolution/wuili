// Cobre o contrato que faz a customização da vitrine funcionar de ponta a ponta:
// o que o editor grava tem que reaparecer igual na loja publicada, e loja antiga
// (sem as chaves novas) não pode mudar de aparência.
import { describe, expect, it } from "vitest";
import {
  applyOverrideToElement,
  applyOverridesToRoot,
  fontStackFor,
  getElementByPath,
  getElementPath,
  resetElementOverride,
  type ElementOverride,
} from "./storeOverrides";

const noopIcon = () => "<svg></svg>";

const buildRoot = () => {
  const root = document.createElement("div");
  root.innerHTML = `
    <section>
      <h2 class="title">Hits de venda</h2>
      <button type="button">Comprar agora</button>
    </section>
  `;
  document.body.append(root);
  return root;
};

describe("fontStackFor", () => {
  it("resolve o stack da fonte escolhida", () => {
    expect(fontStackFor("Georgia")).toBe("Georgia, serif");
  });

  it("cai na primeira fonte para nome desconhecido ou vazio", () => {
    // Loja salva antes de a fonte existir no catálogo não pode ficar sem tipografia.
    expect(fontStackFor("Fonte Que Nao Existe")).toContain("Geist");
    expect(fontStackFor("")).toContain("Geist");
    expect(fontStackFor(undefined)).toContain("Geist");
  });
});

describe("applyOverrideToElement", () => {
  it("aplica as propriedades de tipografia novas", () => {
    const element = document.createElement("h2");
    applyOverrideToElement(
      element,
      { fontFamily: "Georgia", fontSize: 32, lineHeight: 1.15, letterSpacing: -2, textTransform: "uppercase" },
      noopIcon,
    );
    expect(element.style.fontFamily).toBe("Georgia, serif");
    expect(element.style.fontSize).toBe("32px");
    expect(element.style.lineHeight).toBe("1.15");
    expect(element.style.letterSpacing).toBe("-2px");
    expect(element.style.textTransform).toBe("uppercase");
  });

  it("aplica caixa (largura, respiros e altura mínima)", () => {
    const element = document.createElement("div");
    applyOverrideToElement(
      element,
      { width: 420, paddingInline: 24, paddingBlock: 12, minHeight: 56 },
      noopIcon,
    );
    expect(element.style.width).toBe("420px");
    // Solta o teto do template, senão a largura escolhida não teria efeito.
    expect(element.style.maxWidth).toBe("100%");
    expect(element.style.paddingInline).toBe("24px");
    expect(element.style.paddingBlock).toBe("12px");
    expect(element.style.minHeight).toBe("56px");
  });

  it("width 0 devolve a largura original do template", () => {
    const element = document.createElement("div");
    element.style.width = "300px";
    element.style.maxWidth = "380px";
    applyOverrideToElement(element, { width: 500 }, noopIcon);
    expect(element.style.width).toBe("500px");
    applyOverrideToElement(element, { width: 0 }, noopIcon);
    expect(element.style.width).toBe("300px");
    expect(element.style.maxWidth).toBe("380px");
  });

  it("largura em texto inline passa a ter efeito visual", () => {
    const element = document.createElement("span");
    applyOverrideToElement(element, { width: 220 }, noopIcon);
    expect(element.style.width).toBe("220px");
    expect(element.style.display).toBe("inline-block");

    applyOverrideToElement(element, { width: 0 }, noopIcon);
    expect(element.style.width).toBe("");
    expect(element.style.display).toBe("");
  });

  it("borda aplica cor, espessura e estilo sólido", () => {
    const element = document.createElement("button");
    applyOverrideToElement(element, { borderColor: "#ff0000", borderWidth: 3 }, noopIcon);
    expect(element.style.borderColor).toBe("#ff0000");
    expect(element.style.borderWidth).toBe("3px");
    expect(element.style.borderStyle).toBe("solid");
  });

  it("permite editar o label do botão", () => {
    const element = document.createElement("button");
    element.append(document.createTextNode("Comprar agora"));
    applyOverrideToElement(element, { buttonTextContent: "Quero o meu" }, noopIcon);
    expect(element.textContent?.trim()).toBe("Quero o meu");
  });

  it("não mexe em nada que o override não declara", () => {
    // É isso que garante que uma loja criada antes das opções novas continue
    // idêntica: chave ausente = template manda.
    const element = document.createElement("p");
    element.style.fontSize = "13px";
    applyOverrideToElement(element, { color: "#123456" }, noopIcon);
    expect(element.style.fontSize).toBe("13px");
    expect(element.style.width).toBe("");
    expect(element.style.letterSpacing).toBe("");
    expect(element.style.textTransform).toBe("");
    expect(element.style.paddingBlock).toBe("");
  });
});

describe("isolamento da fonte por elemento", () => {
  const buildTitles = () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <section>
        <h2 class="a">Hits de venda</h2>
        <h2 class="b">Diferenciais da loja</h2>
        <p class="c">Os produtos mais desejados</p>
      </section>
    `;
    document.body.append(root);
    return root;
  };

  it("trocar a fonte de um título não afeta os irmãos do mesmo tipo", () => {
    const root = buildTitles();
    const first = root.querySelector(".a") as HTMLElement;
    const second = root.querySelector(".b") as HTMLElement;
    const paragraph = root.querySelector(".c") as HTMLElement;

    applyOverridesToRoot(root, { [getElementPath(first, root)]: { fontFamily: "Georgia" } }, noopIcon);

    expect(first.style.fontFamily).toBe("Georgia, serif");
    // Nada de seletor por tag/classe: o irmão <h2> continua intocado.
    expect(second.style.fontFamily).toBe("");
    expect(paragraph.style.fontFamily).toBe("");
  });

  it("dois elementos podem ter fontes diferentes ao mesmo tempo", () => {
    const root = buildTitles();
    const first = root.querySelector(".a") as HTMLElement;
    const second = root.querySelector(".b") as HTMLElement;

    applyOverridesToRoot(
      root,
      {
        [getElementPath(first, root)]: { fontFamily: "Georgia" },
        [getElementPath(second, root)]: { fontFamily: "Courier New" },
      },
      noopIcon,
    );

    expect(first.style.fontFamily).toBe("Georgia, serif");
    expect(second.style.fontFamily).toBe('"Courier New", Courier, monospace');
  });

  it("voltar para 'Padrão da loja' limpa só o elemento alvo", () => {
    const root = buildTitles();
    const first = root.querySelector(".a") as HTMLElement;
    const second = root.querySelector(".b") as HTMLElement;

    applyOverrideToElement(first, { fontFamily: "Georgia" }, noopIcon);
    applyOverrideToElement(second, { fontFamily: "Georgia" }, noopIcon);

    // É o que o editor faz ao escolher "Padrão da loja": reset + reaplica o resto.
    resetElementOverride(first);

    expect(first.style.fontFamily).toBe("");
    expect(second.style.fontFamily).toBe("Georgia, serif");
  });

  it("a fonte do elemento não escreve nada fora do próprio elemento", () => {
    // Guarda contra a raiz da vitrine (que carrega metadata.font) ser tocada.
    const root = buildTitles();
    root.style.fontFamily = "Inter, ui-sans-serif, system-ui, sans-serif";
    const first = root.querySelector(".a") as HTMLElement;
    const section = root.querySelector("section") as HTMLElement;

    applyOverridesToRoot(root, { [getElementPath(first, root)]: { fontFamily: "Georgia" } }, noopIcon);

    expect(root.style.fontFamily).toBe("Inter, ui-sans-serif, system-ui, sans-serif");
    expect(section.style.fontFamily).toBe("");
  });
});

describe("mover (offsetX/offsetY)", () => {
  it("aplica o deslocamento como translate", () => {
    const element = document.createElement("div");
    applyOverrideToElement(element, { offsetX: 40, offsetY: -12 }, noopIcon);
    expect(element.style.transform).toBe("translate(40px, -12px)");
  });

  it("um eixo só ainda produz translate completo", () => {
    // translate() precisa dos dois valores; o ausente vira 0.
    const element = document.createElement("div");
    applyOverrideToElement(element, { offsetX: 30 }, noopIcon);
    expect(element.style.transform).toBe("translate(30px, 0px)");
  });

  it("preserva o transform que o elemento já tinha inline", () => {
    const element = document.createElement("div");
    element.style.transform = "rotate(45deg)";
    applyOverrideToElement(element, { offsetX: 10, offsetY: 10 }, noopIcon);
    expect(element.style.transform).toContain("rotate(45deg)");
    expect(element.style.transform).toContain("translate(10px, 10px)");
  });

  it("reaplicar move a partir da base, não acumula", () => {
    // Cada mousemove reaplica o override; sem a base guardada os translates se
    // somariam e o elemento dispararia para longe do cursor.
    const element = document.createElement("div");
    applyOverrideToElement(element, { offsetX: 10, offsetY: 10 }, noopIcon);
    applyOverrideToElement(element, { offsetX: 20, offsetY: 20 }, noopIcon);
    applyOverrideToElement(element, { offsetX: 30, offsetY: 30 }, noopIcon);
    expect(element.style.transform).toBe("translate(30px, 30px)");
  });

  it("mover não mexe na posição dos vizinhos", () => {
    // translate não tira o elemento do fluxo — é por isso que foi escolhido
    // no lugar de position:absolute.
    const root = document.createElement("div");
    root.innerHTML = `<div><span class="a">A</span><span class="b">B</span></div>`;
    document.body.append(root);
    const a = root.querySelector(".a") as HTMLElement;
    const b = root.querySelector(".b") as HTMLElement;

    applyOverridesToRoot(root, { [getElementPath(a, root)]: { offsetX: 50, offsetY: 50 } }, noopIcon);
    expect(a.style.transform).toBe("translate(50px, 50px)");
    expect(b.style.transform).toBe("");
  });

  it("reset devolve o elemento à posição do template", () => {
    const element = document.createElement("div");
    element.style.transform = "rotate(45deg)";
    applyOverrideToElement(element, { offsetX: 80, offsetY: 80 }, noopIcon);
    resetElementOverride(element);
    expect(element.style.transform).toBe("rotate(45deg)");
    expect(element.dataset.editorBaseTransform).toBeUndefined();
  });

  it("loja antiga sem offset não ganha transform", () => {
    const element = document.createElement("div");
    applyOverrideToElement(element, { fontSize: 20 }, noopIcon);
    expect(element.style.transform).toBe("");
  });
});

describe("resetElementOverride", () => {
  it("desfaz todas as propriedades novas", () => {
    const element = document.createElement("h2");
    element.style.fontSize = "13px";
    const override: ElementOverride = {
      fontFamily: "Georgia",
      fontSize: 40,
      lineHeight: 2,
      letterSpacing: 4,
      textTransform: "uppercase",
      paddingBlock: 20,
      paddingInline: 20,
      width: 300,
      borderWidth: 2,
      borderColor: "#000000",
    };
    applyOverrideToElement(element, override, noopIcon);
    resetElementOverride(element);

    expect(element.style.fontFamily).toBe("");
    expect(element.style.fontSize).toBe("13px");
    expect(element.style.lineHeight).toBe("");
    expect(element.style.letterSpacing).toBe("");
    expect(element.style.textTransform).toBe("");
    expect(element.style.paddingBlock).toBe("");
    expect(element.style.width).toBe("");
  });
});

describe("redefinir devolve o conteúdo, não só o estilo", () => {
  it("restaura o texto original", () => {
    const element = document.createElement("h2");
    element.textContent = "Hits de venda";
    applyOverrideToElement(element, { textContent: "Mais vendidos", fontSize: 40 }, noopIcon);
    expect(element.textContent).toBe("Mais vendidos");

    resetElementOverride(element);
    // Antes, o reset devolvia o fontSize e deixava o texto editado na tela.
    expect(element.textContent).toBe("Hits de venda");
    expect(element.style.fontSize).toBe("");
  });

  it("restaura o rótulo do botão", () => {
    const element = document.createElement("button");
    element.append(document.createTextNode("Comprar agora"));
    applyOverrideToElement(element, { buttonTextContent: "Quero o meu" }, noopIcon);
    expect(element.textContent?.trim()).toBe("Quero o meu");

    resetElementOverride(element);
    expect(element.textContent?.trim()).toBe("Comprar agora");
  });

  it("restaura a imagem original", () => {
    const element = document.createElement("img");
    element.setAttribute("src", "/original.png");
    applyOverrideToElement(element, { imageSrc: "/trocada.png" }, noopIcon);
    expect(element.getAttribute("src")).toBe("/trocada.png");

    resetElementOverride(element);
    expect(element.getAttribute("src")).toBe("/original.png");
  });

  it("restaura o desenho do ícone", () => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", "16");
    svg.innerHTML = "<circle/>";
    applyOverrideToElement(svg, { iconName: "Heart", iconSize: 40 }, () => '<svg viewBox="0 0 32 32"><path/></svg>');
    expect(svg.innerHTML).toContain("path");

    resetElementOverride(svg);
    expect(svg.innerHTML).toContain("circle");
    expect(svg.getAttribute("viewBox")).toBe("0 0 24 24");
    expect(svg.getAttribute("width")).toBe("16");
  });

  it("capturar o original acontece uma vez só", () => {
    // Reaplicar durante a edição não pode sobrescrever o valor do template,
    // senão o "original" vira a última edição e o reset não volta a lugar nenhum.
    const element = document.createElement("p");
    element.textContent = "Texto do template";
    applyOverrideToElement(element, { textContent: "Primeira edição" }, noopIcon);
    applyOverrideToElement(element, { textContent: "Segunda edição" }, noopIcon);
    resetElementOverride(element);
    expect(element.textContent).toBe("Texto do template");
  });

  it("elemento sem override não é alterado pelo reset", () => {
    const element = document.createElement("p");
    element.textContent = "Intacto";
    element.style.fontSize = "13px";
    resetElementOverride(element);
    expect(element.textContent).toBe("Intacto");
    expect(element.style.fontSize).toBe("13px");
  });

  it("preserva estilo inline do template nas propriedades não customizadas", () => {
    // O h1 do hero do loja-1 nasce com fontSize inline no próprio JSX (lá é um
    // clamp(), que o jsdom não parseia — o que importa aqui é que uma
    // propriedade NÃO customizada sobreviva). Redefinir a COR não pode levar
    // o tamanho junto.
    const element = document.createElement("h1");
    element.style.fontSize = "68px";
    element.style.letterSpacing = "-0.02em";

    applyOverrideToElement(element, { color: "#ff0000" }, noopIcon);
    resetElementOverride(element);

    expect(element.style.fontSize).toBe("68px");
    expect(element.style.letterSpacing).toBe("-0.02em");
    expect(element.style.color).toBe("");
  });

  it("restaura o valor inline anterior quando havia um", () => {
    const element = document.createElement("p");
    element.style.fontSize = "13px";
    applyOverrideToElement(element, { fontSize: 40 }, noopIcon);
    expect(element.style.fontSize).toBe("40px");
    resetElementOverride(element);
    expect(element.style.fontSize).toBe("13px");
  });
});

describe("paridade editor ↔ loja publicada", () => {
  it("o path calculado no editor resolve o mesmo elemento na vitrine", () => {
    const root = buildRoot();
    const title = root.querySelector(".title") as HTMLElement;
    const path = getElementPath(title, root);
    expect(getElementByPath(root, path)).toBe(title);
  });

  it("marcar um CTA com data-editor-role não desloca nenhum path", () => {
    // O path é construído por índice em parent.children, então atributo não
    // entra na conta. Este teste trava esse contrato: se alguém trocar o
    // cálculo por algo sensível a atributos, os overrides de toda loja já
    // publicada passariam a apontar para o elemento errado.
    const build = (asButton: boolean) => {
      const root = document.createElement("div");
      root.innerHTML = `
        <header>
          <a href="/"><span>Marca</span></a>
          <nav><a href="#">Catálogo</a><a href="#">Ofertas</a></nav>
          <div>
            <a ${asButton ? 'data-editor-role="button"' : ""} href="/entrar">Entrar</a>
            <a ${asButton ? 'data-editor-role="button"' : ""} href="/carrinho">Carrinho</a>
          </div>
        </header>
      `;
      document.body.append(root);
      return root;
    };

    const plain = build(false);
    const marked = build(true);

    const collect = (root: HTMLElement) =>
      Array.from(root.querySelectorAll("a, span, nav, div, header")).map((element) =>
        getElementPath(element as HTMLElement, root),
      );

    expect(collect(marked)).toEqual(collect(plain));

    // E o elemento marcado continua alcançável pelo path que o editor gravaria.
    const cart = marked.querySelector('a[href="/carrinho"]') as HTMLElement;
    expect(getElementByPath(plain, getElementPath(cart, marked))?.getAttribute("href")).toBe("/carrinho");
  });

  it("override salvo em um CTA marcado aterrissa no mesmo CTA sem a marcação", () => {
    // Simula a assimetria real: editor e template público são arquivos
    // separados. Mesmo que um deles perdesse o atributo, o override tem que
    // continuar caindo no elemento certo.
    const editorRoot = document.createElement("div");
    editorRoot.innerHTML = `<div><a data-editor-role="button" href="#club">Tornar-se membro</a></div>`;
    document.body.append(editorRoot);
    const cta = editorRoot.querySelector("a") as HTMLElement;
    const path = getElementPath(cta, editorRoot);

    const publicRoot = document.createElement("div");
    publicRoot.innerHTML = `<div><a href="#club">Tornar-se membro</a></div>`;
    document.body.append(publicRoot);

    applyOverridesToRoot(publicRoot, { [path]: { backgroundColor: "#c8a24a", borderRadius: 999 } }, noopIcon);
    const publicCta = publicRoot.querySelector("a") as HTMLElement;
    expect(publicCta.style.backgroundColor).toBe("rgb(200, 162, 74)");
    expect(publicCta.style.borderRadius).toBe("999px");
  });

  it("reaplicar os overrides salvos reproduz a customização", () => {
    const editorRoot = buildRoot();
    const button = editorRoot.querySelector("button") as HTMLElement;
    const path = getElementPath(button, editorRoot);

    // O que o editor gravaria em metadata.elementOverrides.
    const saved: Record<string, ElementOverride> = {
      [path]: { borderRadius: 999, fontFamily: "Inter", width: 260, minHeight: 52, buttonTextContent: "Comprar já" },
    };

    // Vitrine publicada: mesma estrutura, render limpo.
    const publicRoot = buildRoot();
    applyOverridesToRoot(publicRoot, saved, noopIcon);

    const publicButton = publicRoot.querySelector("button") as HTMLElement;
    expect(publicButton.style.borderRadius).toBe("999px");
    expect(publicButton.style.fontFamily).toContain("Inter");
    expect(publicButton.style.width).toBe("260px");
    expect(publicButton.style.minHeight).toBe("52px");
    expect(publicButton.textContent?.trim()).toBe("Comprar já");
  });
});
