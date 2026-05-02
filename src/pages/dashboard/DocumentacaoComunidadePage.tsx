import { useMemo, useState } from "react";
import {
  BookOpen,
  Search,
  Rocket,
  Lightbulb,
  Flame,
  Sparkles,
  Wrench,
  Megaphone,
  Bug,
  ArrowRight,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

type DocGroup = {
  title: string;
  items: Array<{
    id: string;
    title: string;
    content: string;
  }>;
};

type ChangelogItem = {
  title: string;
  date: string;
  description: string;
  tag: "Novo" | "Melhorado" | "Correção";
};

type CommunityPost = {
  title: string;
  content: string;
  date: string;
  author: string;
};

const docGroups: DocGroup[] = [
  {
    title: "Começar",
    items: [
      {
        id: "intro",
        title: "Introdução à plataforma",
        content:
          "A Velo foi criada para acelerar a operação de quem vende online. Em poucos cliques você escolhe produtos, gera criativos com IA e transforma ideias em campanhas.",
      },
      {
        id: "como-funciona",
        title: "Como funciona",
        content:
          "O fluxo é simples: selecione um produto, gere o prompt, refine a mensagem e publique criativos com foco em conversão. Você concentra descoberta, execução e aprendizado em um só lugar.",
      },
      {
        id: "primeiro-video",
        title: "Primeiro vídeo gerado",
        content:
          "Escolha um produto do catálogo, clique em Criar vídeo, gere o prompt e use no RunwayML. Em menos de 5 minutos você sai com um vídeo vertical pronto para testes.",
      },
    ],
  },
  {
    title: "Guias",
    items: [
      {
        id: "videos-ia",
        title: "Como gerar vídeos com IA",
        content:
          "Comece com um gancho forte em até 3 segundos, destaque dor/benefício e finalize com CTA direto. Priorize cenas curtas e texto legível para retenção no feed.",
      },
      {
        id: "produtos-vencedores",
        title: "Como escolher produtos vencedores",
        content:
          "Busque produtos com apelo visual forte, ticket acessível e percepção clara de valor. Itens que mostram transformação tendem a performar melhor em vídeo curto.",
      },
      {
        id: "anuncios-convertem",
        title: "Como criar anúncios que convertem",
        content:
          "Use estrutura: dor -> solução -> prova -> oferta -> urgência. Evite texto genérico e use linguagem objetiva com benefício explícito já no início do criativo.",
      },
      {
        id: "tiktok-ads",
        title: "Estratégias para TikTok Ads",
        content:
          "Teste 3 a 5 variações por criativo, com ganchos diferentes e mesma oferta. Escale anúncios com CTR alto e retenção forte nos primeiros segundos.",
      },
    ],
  },
  {
    title: "Features",
    items: [
      {
        id: "feature-criar-video",
        title: "Criar vídeo com IA",
        content:
          "A feature de Criar vídeo gera um prompt pronto para execução em ferramentas externas. O objetivo é reduzir tempo de produção e manter consistência de mensagem.",
      },
      {
        id: "feature-gerar-prompt",
        title: "Gerar prompt",
        content:
          "O prompt é contextualizado com título, descrição e preço do produto para gerar um roteiro mais assertivo. Você pode copiar com um clique e reaproveitar em fluxo rápido.",
      },
      {
        id: "feature-integracoes",
        title: "Integrações (futuro)",
        content:
          "Em breve, integrações nativas com TikTok, Shopify e outros canais para publicar criativos e acompanhar performance sem trocar de plataforma.",
      },
    ],
  },
  {
    title: "API (futuro)",
    items: [
      {
        id: "api-intro",
        title: "Introdução à API",
        content:
          "A API vai permitir automações de geração, publicação e coleta de dados de performance para operações que precisam de escala programática.",
      },
      {
        id: "api-auth",
        title: "Autenticação",
        content:
          "A autenticação seguirá padrão por token para manter segurança e controle por workspace. A documentação trará exemplos prontos para integração rápida.",
      },
      {
        id: "api-endpoints",
        title: "Endpoints",
        content:
          "Os endpoints incluirão recursos para produtos, prompts, criativos e status de processamento, com convenções simples de paginação e filtros.",
      },
      {
        id: "api-exemplos",
        title: "Exemplos",
        content:
          "Você terá snippets para os fluxos mais usados, com exemplos de request/response para acelerar implementação em backoffice ou app próprio.",
      },
    ],
  },
];

const changelog: ChangelogItem[] = [
  {
    title: "Nova geração de vídeos mais rápida",
    date: "20 abr 2026",
    description: "Melhoramos o tempo de resposta da geração de prompts para acelerar o workflow criativo.",
    tag: "Melhorado",
  },
  {
    title: "Hub de Documentação + Comunidade",
    date: "20 abr 2026",
    description: "Nova área central com guias, atualizações do produto e feed de conteúdo da comunidade.",
    tag: "Novo",
  },
  {
    title: "Correção no fluxo de copiar prompt",
    date: "19 abr 2026",
    description: "Ajustamos o comportamento do botão Copiar para aparecer apenas após gerar o prompt.",
    tag: "Correção",
  },
];

const communityPosts: CommunityPost[] = [
  {
    title: "3 hooks que aumentaram nosso CTR",
    content:
      "Testamos criativos com abertura forte em até 2 segundos e tivemos aumento de cliques em campanhas frias. O melhor formato foi dor + resultado rápido.",
    date: "20 abr 2026",
    author: "Equipe Velo",
  },
  {
    title: "Checklist para criativos de alta conversão",
    content:
      "Antes de subir: gancho claro, benefício visível, prova social e CTA objetivo. Pequenos ajustes no texto em cena mudaram muito o desempenho.",
    date: "18 abr 2026",
    author: "Camila, Growth",
  },
  {
    title: "Caso real: de 0 a 27 vendas no teste inicial",
    content:
      "Uma loja de nicho fitness usou 5 variações de vídeo com o mesmo produto e encontrou um criativo vencedor em 48h, mantendo CPA saudável.",
    date: "16 abr 2026",
    author: "Rafael, Comunidade",
  },
];

const tabBaseClass =
  "rounded-lg border px-3 py-2 text-sm font-semibold transition-all duration-200 ease-in-out";

export default function DocumentacaoComunidadePage() {
  const [activeTab, setActiveTab] = useState<"docs" | "updates" | "community">("docs");
  const [search, setSearch] = useState("");
  const [selectedDocId, setSelectedDocId] = useState(docGroups[0].items[0].id);

  const filteredGroups = useMemo(() => {
    if (!search.trim()) return docGroups;
    const term = search.toLowerCase();
    return docGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => item.title.toLowerCase().includes(term)),
      }))
      .filter((group) => group.items.length > 0);
  }, [search]);

  const selectedDoc = useMemo(() => {
    for (const group of docGroups) {
      const found = group.items.find((item) => item.id === selectedDocId);
      if (found) return found;
    }
    return docGroups[0].items[0];
  }, [selectedDocId]);

  const getTagStyle = (tag: ChangelogItem["tag"]) => {
    if (tag === "Novo") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
    if (tag === "Melhorado") return "border-blue-500/30 bg-blue-500/10 text-blue-300";
    return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  };

  return (
    <div className="mx-auto w-full max-w-[1280px]">
      <div className="rounded-2xl border border-border bg-[#0B0B0F] text-white shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
        <div className="border-b border-white/10 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/60">Hub de conhecimento</p>
              <h1 className="mt-2 text-2xl font-black tracking-tight">Documentação + Comunidade</h1>
              <p className="mt-2 max-w-3xl text-sm text-white/70">
                Aprenda, acompanhe novidades e evolua sua operação com boas práticas em vídeo, anúncios e performance.
              </p>
            </div>
            <div className="relative w-full max-w-sm">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/45" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar na documentação..."
                className="w-full rounded-xl border border-white/15 bg-white/5 py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-white/45 outline-none transition-all duration-200 focus:border-white/35"
              />
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3.5">
              <p className="flex items-center gap-2 text-sm font-semibold"><Flame size={15} /> 🔥 Comece aqui</p>
              <p className="mt-1 text-xs text-white/65">Guia rápido para gerar seu primeiro vídeo com IA.</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3.5">
              <p className="flex items-center gap-2 text-sm font-semibold"><Rocket size={15} /> 🚀 Novidades</p>
              <p className="mt-1 text-xs text-white/65">Acompanhe as melhorias mais recentes da plataforma.</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3.5">
              <p className="flex items-center gap-2 text-sm font-semibold"><Lightbulb size={15} /> 💡 Dicas</p>
              <p className="mt-1 text-xs text-white/65">Boas práticas para criativos e anúncios de alta conversão.</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row">
          <aside className="top-0 w-full shrink-0 border-b border-white/10 p-4 lg:sticky lg:h-[calc(100vh-190px)] lg:w-[290px] lg:border-b-0 lg:border-r lg:p-5">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-white/80">
              <BookOpen size={15} />
              Navegação
            </div>
            <div className="space-y-1">
              <button
                onClick={() => setActiveTab("docs")}
                className={cn(tabBaseClass, activeTab === "docs" ? "border-white/20 bg-white/10 text-white" : "border-white/10 bg-transparent text-white/70 hover:bg-white/5")}
              >
                Documentação
              </button>
              <button
                onClick={() => setActiveTab("updates")}
                className={cn(tabBaseClass, activeTab === "updates" ? "border-white/20 bg-white/10 text-white" : "border-white/10 bg-transparent text-white/70 hover:bg-white/5")}
              >
                Atualizações
              </button>
              <button
                onClick={() => setActiveTab("community")}
                className={cn(tabBaseClass, activeTab === "community" ? "border-white/20 bg-white/10 text-white" : "border-white/10 bg-transparent text-white/70 hover:bg-white/5")}
              >
                Comunidade
              </button>
            </div>

            {activeTab === "docs" && (
              <div className="mt-5 space-y-4 overflow-y-auto pr-1 lg:max-h-[calc(100vh-350px)]">
                {filteredGroups.map((group) => (
                  <div key={group.title}>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">{group.title}</p>
                    <div className="space-y-1">
                      {group.items.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => setSelectedDocId(item.id)}
                          className={cn(
                            "w-full rounded-lg border px-3 py-2 text-left text-sm transition-all duration-200 ease-in-out",
                            selectedDocId === item.id
                              ? "border-white/20 bg-white/10 text-white"
                              : "border-transparent text-white/70 hover:border-white/10 hover:bg-white/5 hover:text-white",
                          )}
                        >
                          {item.title}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                {filteredGroups.length === 0 && (
                  <p className="rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-white/60">
                    Nenhum item encontrado para sua busca.
                  </p>
                )}
              </div>
            )}
          </aside>

          <section className="min-w-0 flex-1 p-5 lg:p-8">
            {activeTab === "docs" && (
              <div className="mx-auto max-w-3xl space-y-6">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
                  <div className="mb-3 flex items-center gap-2 text-white/80">
                    <Sparkles size={15} />
                    <span className="text-xs font-semibold uppercase tracking-[0.12em]">Documentação</span>
                  </div>
                  <h2 className="text-2xl font-extrabold tracking-tight">{selectedDoc.title}</h2>
                  <p className="mt-3 text-[15px] leading-7 text-white/75">{selectedDoc.content}</p>
                  <div className="mt-5 rounded-lg border border-white/10 bg-black/30 p-3 font-mono text-xs text-white/70">
                    Dica rápida: combine 3 variações de gancho + 1 CTA claro para encontrar o criativo vencedor mais cedo.
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-sm font-semibold">Próximo passo recomendado</p>
                    <p className="mt-2 text-xs text-white/65">Aplique este conteúdo no fluxo de criação e teste pelo menos 3 variações.</p>
                    <button className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-white/85 transition-colors hover:text-white">
                      Ir para Criar Vídeo <ArrowRight size={12} />
                    </button>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-sm font-semibold">Boas práticas</p>
                    <p className="mt-2 text-xs text-white/65">Use linguagem direta, benefício concreto e prova visual nos primeiros segundos do vídeo.</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "updates" && (
              <div className="mx-auto max-w-3xl">
                <h2 className="text-xl font-extrabold tracking-tight">Atualizações</h2>
                <p className="mt-1 text-sm text-white/65">Timeline de melhorias e novidades do produto.</p>
                <div className="mt-6 space-y-5">
                  {changelog.map((item, index) => (
                    <div key={`${item.title}-${item.date}`} className="relative pl-8">
                      {index !== changelog.length - 1 && (
                        <span className="absolute left-2.5 top-6 h-[calc(100%+14px)] w-px bg-white/15" />
                      )}
                      <span className="absolute left-0 top-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/25 bg-[#121218]">
                        {item.tag === "Novo" ? <Sparkles size={10} /> : item.tag === "Melhorado" ? <Wrench size={10} /> : <Bug size={10} />}
                      </span>
                      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-semibold">{item.title}</h3>
                          <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", getTagStyle(item.tag))}>
                            {item.tag}
                          </span>
                          <span className="text-xs text-white/45">{item.date}</span>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-white/70">{item.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "community" && (
              <div className="mx-auto max-w-3xl">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-extrabold tracking-tight">Comunidade</h2>
                    <p className="mt-1 text-sm text-white/65">Dicas de criativos, estratégias e casos reais da comunidade.</p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-xs text-white/70">
                    <Users size={12} />
                    Feed
                  </span>
                </div>

                <div className="space-y-4">
                  {communityPosts.map((post) => (
                    <article
                      key={`${post.title}-${post.date}`}
                      className="rounded-xl border border-white/10 bg-white/[0.03] p-4 transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.05]"
                    >
                      <div className="flex flex-wrap items-center gap-2 text-xs text-white/50">
                        <span className="inline-flex items-center gap-1"><Megaphone size={11} /> {post.author}</span>
                        <span>•</span>
                        <span>{post.date}</span>
                      </div>
                      <h3 className="mt-2 text-base font-semibold">{post.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-white/70">{post.content}</p>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
