import { ATLAS_NAV_ITEMS } from "./atlas-knowledge.ts";

// Reuse the Atlas catalog, but expose only verified customer pages and settings tabs.
const PUBLIC_IDS = new Set(["inicio", "catalogo", "produtos-em-alta", "paginas-com-ia", "gerar-pagina", "modelos", "publicacoes", "pedidos", "imagens-ia", "avatares", "pagamentos", "planos", "configuracoes", "integracoes"]);
export const SUPPORT_PAGES = [
  ...ATLAS_NAV_ITEMS.filter((item) => PUBLIC_IDS.has(item.id)).map((item) => item.id === "integracoes"
    ? { ...item, route: "/dashboard/configuracoes?tab=Integra%C3%A7%C3%B5es", description: "Configurações → Integrações, para conectar o Mercado Livre." }
    : item),
  { id: "suporte", label: "Configurações → Suporte", route: "/dashboard/configuracoes?tab=Suporte", description: "Chamados e atendimento da Velo.", aliases: ["suporte", "chamado", "chamados", "atendimento"] },
  { id: "perfil", label: "Configurações → Perfil", route: "/dashboard/configuracoes?tab=Perfil", description: "Dados pessoais e alteração de e-mail.", aliases: ["perfil", "email", "e-mail"] },
  { id: "seguranca", label: "Configurações → Segurança", route: "/dashboard/configuracoes?tab=Seguran%C3%A7a", description: "Segurança da conta e senha.", aliases: ["seguranca", "segurança", "senha"] },
  { id: "assinatura", label: "Configurações → Perfil", route: "/dashboard/configuracoes?tab=Perfil#velo-reembolso", description: "Gerenciar assinatura: solicitação de reembolso dentro da garantia (some do Perfil depois dos 7 dias). Abrir esta página não cancela nada.", aliases: ["reembolso", "garantia"] },
  { id: "renovacao", label: "Configurações → Plano", route: "/dashboard/configuracoes?tab=Plano#velo-cancelar-renovacao", description: "Cancelar a renovação depois dos 7 dias da garantia. Abrir esta página não cancela nada.", aliases: ["cancelar renovacao", "cancelar renovação", "cancelar assinatura"] },
  { id: "ajuda", label: "Central de Ajuda", route: "/ajuda", description: "Artigos do FAQ.", aliases: ["faq", "central de ajuda"] },
];

// Telas de reembolso/cancelamento: a IA só diz onde ficam, nunca leva o cliente direto.
const SEM_LINK = new Set(["assinatura", "renovacao"]);

const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function supportNavigationReply(message: string): string | null {
  const text = normalize(message);
  // Only navigation, never diagnosis or a transaction request disguised as a question.
  if (!/\b(onde|qual pagina|qual aba|como (?:acesso|abro|entro|chego))\b/.test(text)) return null;
  if (/\b(erro|problema|nao consigo|nao funciona|nao aparece|sumiu|cancel|reembols|cobranc|paguei|fornecedora|c7)/.test(text)) return null;
  const words = ` ${text.replace(/[^a-z0-9]+/g, " ")} `;
  const ranked = SUPPORT_PAGES.map((page) => ({ page, score: Math.max(0, ...page.aliases.map((alias) => {
    const phrase = normalize(alias).replace(/[^a-z0-9]+/g, " ");
    return words.includes(` ${phrase} `) ? phrase.length : 0;
  })) })).filter((item) => item.score > 0).sort((a, b) => b.score - a.score);
  const match = ranked[0];
  if (!match || (ranked[1]?.score === match.score)) return null;
  if (SEM_LINK.has(match.page.id)) {
    return `No menu, vá em ${match.page.label} e desça até a seção "Gerenciar assinatura".`;
  }
  return `Você encontra em [${match.page.label}](${match.page.route}).`;
}

export const SUPPORT_NAVIGATION_PROMPT = `Páginas reais da Velo (use links markdown relativos, que abrem na própria Velo):
${SUPPORT_PAGES.map((page) => SEM_LINK.has(page.id)
  ? `- ${page.label} (só em texto, NUNCA com link): ${page.description}`
  : `- ${page.label}: ${page.route}. ${page.description}`).join("\n")}
Reembolso e cancelamento da assinatura: diga só onde fica (Configurações → Perfil, seção "Gerenciar assinatura"; ou Configurações → Plano, seção "Gerenciar assinatura"), sem link e sem atalho. O cliente vai até lá sozinho.
Perguntas apenas sobre onde fica uma página: responda diretamente com o link, salvo as telas indicadas acima como só em texto, sem verificar a conta do Mercado Livre, buscar artigos ou encaminhar a uma pessoa (use também o artigo onde-fica-cada-pagina da Central de Ajuda). Se o cliente disser que não encontrou, peça um print da tela e só então encaminhe para o suporte humano. No computador, Catálogo e Páginas com IA ficam no grupo Produtos. No celular o menu pode estar recolhido. Não invente botões, menus nem funções. A página de influencers se chama Avatares, nunca TikTok. Para conectar o Mercado Livre, use Configurações → Integrações. Abrir um formulário não confirma nenhuma ação.`;
