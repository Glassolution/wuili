import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import {
  fetchPublicProject,
  fetchPublicStoreProducts,
  getProjectAccent,
  getProjectCopyVariant,
  getProjectAiDescription,
  getProjectDescription,
  getProjectFont,
  getProjectHeroCtaUrl,
  getProjectHeroImage,
  getProjectLogoImage,
  getProjectOverrides,
  getProjectProductIds,
  getProjectStoreName,
  getProjectTemplate,
  resolveProjectPrice,
  type PublicStoreProduct,
  type UserProject,
} from "@/lib/userProjects";
import { applyOverridesToRoot } from "@/lib/storeOverrides";
import { renderStoreIcon } from "@/lib/storeIcons";
import { AI_DESCRIPTION_PLACEHOLDER, resolveProductTemplate } from "@/components/store-templates/productTemplateRegistry";
import StorefrontLojaTemplate from "@/components/store-templates/StorefrontLojaTemplate";
import StorefrontLojaTemplate2 from "@/components/store-templates/StorefrontLojaTemplate2";
import PreviewPage from "@/pages/PreviewPage";
import SectionRenderer from "@/components/store-sections/SectionRenderer";
import { parseSections, parseTheme } from "@/lib/storeSections/types";

const DEFAULT_HERO_IMAGE = "/hero-pasted-image-2.png";

// Mapa de fontes (espelha fontOptions do editor) para aplicar a mesma tipografia.
const FONT_STACKS: Record<string, string> = {
  Geist: '"Geist", "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif',
  "Plus Jakarta Sans": '"Plus Jakarta Sans", Inter, ui-sans-serif, system-ui, sans-serif',
  Inter: "Inter, ui-sans-serif, system-ui, sans-serif",
  "Helvetica Neue": '"Helvetica Neue", Helvetica, sans-serif',
  Georgia: "Georgia, serif",
};

const fontStackFor = (name: string) => FONT_STACKS[name] || FONT_STACKS.Geist;

// Os templates de página de produto ficam num registro único
// (productTemplateRegistry), compartilhado com o editor. Antes esta tela tinha
// a própria lista e ela ficou para trás: templates que existiam no editor caíam
// no fallback ao publicar, e o lojista via um layout diferente do que escolheu.

/** Renderiza a página de produto publicada usando o mesmo template do editor,
 *  e reaplica as customizações (cor, fonte e edições por elemento) salvas. */
const PublishedProductPage = ({ project }: { project: UserProject }) => {
  const [product, setProduct] = useState<PublicStoreProduct | null>(null);
  const [related, setRelated] = useState<PublicStoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const rootRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { slug } = useParams();

  useEffect(() => {
    let active = true;
    setLoading(true);
    void (async () => {
      try {
        const list = await fetchPublicStoreProducts(getProjectProductIds(project));
        if (active) {
          setProduct(list[0] ?? null);
          // Os demais produtos do projeto alimentam "Você também pode gostar".
          setRelated(list.slice(1));
        }
      } catch {
        if (active) {
          setProduct(null);
          setRelated([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [project]);

  const { Component, descFallback } = resolveProductTemplate(getProjectTemplate(project));
  const brand = getProjectStoreName(project) || project.nome;
  // O preço editado no canvas vale para a página inteira — bundles e "economize"
  // derivam daqui. Antes só o catálogo alimentava isso, e o override de texto
  // trocava apenas o número do topo.
  const price = resolveProjectPrice(project, product?.price || 149.9);
  const accent = getProjectAccent(project);
  const overrides = getProjectOverrides(project);
  const fontStack = fontStackFor(getProjectFont(project));

  // Reaplica os overrides por elemento depois que o template renderizou.
  useEffect(() => {
    if (loading) return;
    applyOverridesToRoot(rootRef.current, overrides, renderStoreIcon);
  }, [loading, product, overrides]);

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-white">
        <Loader2 className="animate-spin text-slate-400" />
      </div>
    );
  }

  // Click delegation: qualquer botão/link dentro do template cujo texto ou
  // aria-label indique intenção de compra ("adicionar ao carrinho", "comprar",
  // "comprar agora") leva o cliente para a próxima tela do fluxo (carrinho).
  const handleTemplateClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = (event.target as HTMLElement).closest("button, a");
    if (!target) return;
    const text = (target.textContent || "").trim().toLowerCase();
    const aria = (target.getAttribute("aria-label") || "").toLowerCase();
    if (/adicionar ao carrinho|comprar|carrinho/.test(text + " " + aria)) {
      event.preventDefault();
      if (slug) navigate(`/loja/${slug}/carrinho`);
    }
  };

  return (
    <div ref={rootRef} style={{ fontFamily: fontStack }} onClick={handleTemplateClick}>
      <Component
        brand={brand}
        title={product?.title || brand}
        // Só o texto curto da IA. metadata.descricao guarda o ângulo de copy
        // do wizard ("Benefício principal") e product.description é a ficha
        // técnica raspada — nenhum dos dois é texto de venda.
        description={getProjectAiDescription(project) || AI_DESCRIPTION_PLACEHOLDER}
        price={price}
        // Só o desconto real do fornecedor. Antes, na ausência dele, a página
        // fabricava um preço riscado (price * originalMultiplier) — preço de
        // referência falso é publicidade enganosa (CDC art. 37).
        originalPrice={product?.originalPrice && product.originalPrice > price ? product.originalPrice : null}
        image={product?.imageUrl || ""}
        images={product?.imageUrls}
        productId={product?.id}
        projectId={project.id}
        accent={accent}
        mobile={false}
        variants={product?.variants ?? []}
        relatedProducts={related.map((item) => ({
          id: item.id,
          title: item.title,
          price: item.price,
          originalPrice: item.originalPrice,
          imageUrl: item.imageUrl,
        }))}
      />
    </div>
  );
};

/** Renderiza a loja completa publicada usando o mesmo template do editor. */
const PublishedLojaPage = ({ project }: { project: UserProject }) => {
  const [products, setProducts] = useState<PublicStoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const rootRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { slug } = useParams();

  useEffect(() => {
    let active = true;
    setLoading(true);
    void (async () => {
      try {
        const list = await fetchPublicStoreProducts(getProjectProductIds(project));
        if (active) setProducts(list);
      } catch {
        if (active) setProducts([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [project]);

  const overrides = getProjectOverrides(project);
  const fontStack = fontStackFor(getProjectFont(project));

  useEffect(() => {
    if (loading) return;
    applyOverridesToRoot(rootRef.current, overrides, renderStoreIcon);
  }, [loading, products, overrides]);

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-white">
        <Loader2 className="animate-spin text-slate-400" />
      </div>
    );
  }

  // Mesma delegação de clique do template de produto: qualquer botão/link
  // com intenção de compra abre o carrinho.
  const handleTemplateClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = (event.target as HTMLElement).closest("a, button") as HTMLElement | null;
    if (!target) return;
    const text = (target.textContent || "").trim().toLowerCase();
    const aria = (target.getAttribute("aria-label") || "").toLowerCase();
    const href = target.getAttribute("href") || "";
    // Links do template para o catálogo apontam para "/catalogo" (raiz). Dentro
    // de uma loja publicada eles precisam entrar no catálogo escopado pelo slug.
    if (slug && /^\/catalogo(?:$|[/?#])/.test(href)) {
      event.preventDefault();
      const suffix = href.replace(/^\/catalogo/, "");
      navigate(`/loja/${slug}/catalogo${suffix}`);
      return;
    }
    if (/adicionar ao carrinho|comprar|carrinho/.test(text + " " + aria)) {
      event.preventDefault();
      if (slug) navigate(`/loja/${slug}/carrinho`);
    }
  };

  const templateId = getProjectTemplate(project);
  const isTemplate2 = templateId === "loja-2";
  const mappedProducts = products.map((product) => ({
    id: product.id,
    title: product.title,
    price: product.price,
    imageUrl: product.imageUrl,
    category: product.category,
    originalPrice: product.originalPrice,
  }));

  return (
    <div ref={rootRef} className="bg-white text-[#111]" style={{ fontFamily: fontStack }} onClick={handleTemplateClick}>
      {isTemplate2 ? (
        <StorefrontLojaTemplate2
          storeName={getProjectStoreName(project) || project.nome}
          heroImage={getProjectHeroImage(project) || DEFAULT_HERO_IMAGE}
          logoImage={getProjectLogoImage(project)}
          salesAngle={getProjectDescription(project)}
          heroCtaUrl={getProjectHeroCtaUrl(project)}
          products={mappedProducts}
          mobile={false}
          projectId={project.id}
        />
      ) : (
        <StorefrontLojaTemplate
          storeName={getProjectStoreName(project) || project.nome}
          accent={getProjectAccent(project)}
          heroImage={getProjectHeroImage(project) || DEFAULT_HERO_IMAGE}
          logoImage={getProjectLogoImage(project)}
          salesAngle={getProjectDescription(project)}
          heroCtaUrl={getProjectHeroCtaUrl(project)}
          copyVariant={getProjectCopyVariant(project)}
          products={mappedProducts}
          mobile={false}
          projectId={project.id}
        />
      )}
    </div>
  );
};

const PublicStorePage = () => {
  const { slug } = useParams();
  const [project, setProject] = useState<UserProject | null>(null);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    if (!slug) {
      setResolved(true);
      return;
    }
    let active = true;
    setResolved(false);
    void (async () => {
      try {
        const found = await fetchPublicProject(slug);
        if (active) setProject(found);
      } catch {
        if (active) setProject(null);
      } finally {
        if (active) setResolved(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [slug]);

  if (!resolved) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50">
        <Loader2 className="animate-spin text-slate-400" />
      </div>
    );
  }

  if (project) {
    // Compat layer (Fase 1 do novo template): se a loja já foi migrada para o
    // sistema de blocos modulares (metadata.sections presente e não vazio),
    // renderiza via SectionRenderer. Senão, mantém o template monolítico antigo
    // para não quebrar lojas existentes.
    const meta = (project.metadata && typeof project.metadata === "object" && !Array.isArray(project.metadata))
      ? (project.metadata as Record<string, unknown>)
      : {};
    const parsedSections = parseSections(meta.sections);
    if (parsedSections.length > 0) {
      const parsedTheme = parseTheme(meta.theme);
      return (
        <div style={{ minHeight: "100vh", background: parsedTheme.background }}>
          <SectionRenderer sections={parsedSections} theme={parsedTheme} />
        </div>
      );
    }
    // Renderiza o mesmo template do editor (idêntico ao que o usuário editou):
    // página de produto ou loja completa, conforme o template salvo.
    if (getProjectTemplate(project).startsWith("produto")) {
      return <PublishedProductPage project={project} />;
    }
    return <PublishedLojaPage project={project} />;
  }

  // Sem projeto publicado com esse slug: cai no renderizador de páginas de venda legado.
  return <PreviewPage />;
};

export default PublicStorePage;
