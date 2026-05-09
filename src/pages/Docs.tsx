import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Search, Rocket, Lightbulb, Flame, Sparkles,
  Wrench, Megaphone, Bug, ArrowRight, Users,
  BookOpen, Zap, Code2, Package, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { VeloLogo } from "@/components/VeloLogo";

// ── Types ─────────────────────────────────────────────────────────────────────

type DocGroup = {
  title: string;
  items: Array<{ id: string; title: string; content: string }>;
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

// ── Data ──────────────────────────────────────────────────────────────────────

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
          "Use estrutura: dor → solução → prova → oferta → urgência. Evite texto genérico e use linguagem objetiva com benefício explícito já no início do criativo.",
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
    description:
      "Melhoramos o tempo de resposta da geração de prompts para acelerar o workflow criativo.",
    tag: "Melhorado",
  },
  {
    title: "Hub de Documentação + Comunidade",
    date: "20 abr 2026",
    description:
      "Nova área central com guias, atualizações do produto e feed de conteúdo da comunidade.",
    tag: "Novo",
  },
  {
    title: "Correção no fluxo de copiar prompt",
    date: "19 abr 2026",
    description:
      "Ajustamos o comportamento do botão Copiar para aparecer apenas após gerar o prompt.",
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

// ── Helpers ───────────────────────────────────────────────────────────────────

const tagStyle: Record<ChangelogItem["tag"], string> = {
  Novo: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  Melhorado: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  Correção: "bg-amber-500/10 text-amber-400 border-amber-500/20",
};

const groupIcon: Record<string, React.ReactNode> = {
  "Começar": <Flame size={18} className="text-orange-400" />,
  "Guias":   <Lightbulb size={18} className="text-yellow-400" />,
  "Features": <Zap size={18} className="text-violet-400" />,
  "API (futuro)": <Code2 size={18} className="text-sky-400" />,
};

type Tab = "docs" | "guias" | "updates" | "community";

const TABS: { id: Tab; label: string }[] = [
  { id: "docs",      label: "Documentação" },
  { id: "guias",     label: "Guias" },
  { id: "updates",   label: "Atualizações" },
  { id: "community", label: "Comunidade" },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function Docs() {
  const [activeTab, setActiveTab] = useState<Tab>("docs");
  const [search, setSearch] = useState("");
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  // For docs tab: filter all items across groups
  const allDocItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return docGroups;
    return docGroups
      .map((g) => ({
        ...g,
        items: g.items.filter((i) => i.title.toLowerCase().includes(term) || i.content.toLowerCase().includes(term)),
      }))
      .filter((g) => g.items.length > 0);
  }, [search]);

  const selectedDoc = useMemo(() => {
    if (!selectedDocId) return null;
    for (const g of docGroups) {
      const found = g.items.find((i) => i.id === selectedDocId);
      if (found) return found;
    }
    return null;
  }, [selectedDocId]);

  // Guide items (merged)
  const guideGroup = docGroups.find((g) => g.title === "Guias");

  return (
    <div className="min-h-screen bg-[#F7F7F7] font-['Inter',system-ui,sans-serif] text-[#0A0A0A]">

      {/* ── Navbar ──────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0A0A0A]">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-4 md:px-8">
          <Link to="/" className="flex items-center">
            <VeloLogo size="md" variant="light" />
          </Link>

          {/* Horizontal section tabs */}
          <nav className="hidden items-center gap-1 md:flex">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setSelectedDocId(null); }}
                className={cn(
                  "rounded-lg px-4 py-2 text-[13px] font-medium transition-all",
                  activeTab === tab.id
                    ? "bg-white/10 text-white"
                    : "text-white/50 hover:bg-white/5 hover:text-white/80"
                )}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="hidden text-[13px] font-medium text-white/50 transition hover:text-white md:inline-flex"
            >
              Entrar
            </Link>
            <Link
              to="/cadastro"
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-[#0A0A0A] transition hover:bg-white/90"
            >
              Criar conta
            </Link>
          </div>
        </div>

        {/* Mobile tabs */}
        <div className="flex gap-1 overflow-x-auto px-4 pb-3 md:hidden">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setSelectedDocId(null); }}
              className={cn(
                "shrink-0 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all",
                activeTab === tab.id
                  ? "bg-white/15 text-white"
                  : "text-white/40 hover:text-white/70"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section className="bg-[#0A0A0A] px-6 pb-16 pt-14 text-center md:px-8 md:pb-20 md:pt-20">
        <div className="mx-auto max-w-[720px]">
          <span className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-white/40">
            <BookOpen size={10} />
            Central de ajuda
          </span>
          <h1 className="mt-3 text-4xl font-black leading-tight tracking-tight text-white md:text-5xl">
            Como podemos<br />te ajudar?
          </h1>
          <p className="mx-auto mt-4 max-w-md text-[15px] leading-7 text-white/50">
            Encontre guias, tutoriais e tudo que você precisa para usar a Velo com confiança.
          </p>

          {/* Search */}
          <div className="relative mx-auto mt-8 max-w-md">
            <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setSelectedDocId(null); if (e.target.value) setActiveTab("docs"); }}
              placeholder="Buscar na documentação..."
              className="w-full rounded-2xl border border-white/10 bg-white/5 py-3.5 pl-11 pr-4 text-[14px] text-white placeholder:text-white/30 outline-none transition focus:border-white/20 focus:bg-white/8"
            />
          </div>

          {/* Quick links */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            {["Primeiro vídeo", "Criar anúncio", "Integrações", "TikTok Ads"].map((label) => (
              <button
                key={label}
                onClick={() => { setSearch(label); setActiveTab("docs"); setSelectedDocId(null); }}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[12px] text-white/50 transition hover:border-white/20 hover:text-white/80"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <main className="mx-auto max-w-[1200px] px-6 py-12 md:px-8">

        {/* ── DOCS tab ──────────────────────────────────────────────────────── */}
        {activeTab === "docs" && !selectedDocId && (
          <div>
            {(search.trim() ? allDocItems : docGroups).map((group) => (
              <section key={group.title} className="mb-12">
                <div className="mb-5 flex items-center gap-2">
                  {groupIcon[group.title] ?? <Package size={18} className="text-[#A3A3A3]" />}
                  <h2 className="text-[17px] font-bold text-[#0A0A0A]">{group.title}</h2>
                  <span className="ml-1 rounded-full bg-[#E5E5E5] px-2 py-0.5 text-[11px] font-semibold text-[#737373]">
                    {group.items.length}
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {group.items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setSelectedDocId(item.id)}
                      className="group rounded-2xl border border-[#E5E5E5] bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-[#D4D4D4] hover:shadow-md"
                    >
                      <p className="font-semibold text-[#0A0A0A] text-[14px] leading-snug">{item.title}</p>
                      <p className="mt-2 line-clamp-2 text-[13px] leading-5 text-[#737373]">{item.content}</p>
                      <span className="mt-4 flex items-center gap-1 text-[12px] font-semibold text-[#0A0A0A] opacity-0 transition-all group-hover:opacity-100">
                        Ler mais <ArrowRight size={11} />
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            ))}

            {allDocItems.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-[#E5E5E5] bg-white py-16 text-center">
                <Search size={22} className="text-[#A3A3A3]" />
                <p className="text-[15px] font-semibold text-[#0A0A0A]">Nenhum resultado encontrado</p>
                <p className="text-[13px] text-[#737373]">Tente outros termos de busca.</p>
              </div>
            )}
          </div>
        )}

        {/* ── DOCS: article detail ──────────────────────────────────────────── */}
        {activeTab === "docs" && selectedDocId && selectedDoc && (
          <div className="mx-auto max-w-2xl">
            <button
              onClick={() => setSelectedDocId(null)}
              className="mb-6 flex items-center gap-1.5 text-[13px] text-[#737373] transition hover:text-[#0A0A0A]"
            >
              ← Voltar
            </button>
            <div className="rounded-2xl border border-[#E5E5E5] bg-white p-8">
              <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-[#A3A3A3]">
                <Sparkles size={11} />
                Documentação
              </div>
              <h2 className="text-2xl font-extrabold tracking-tight text-[#0A0A0A]">{selectedDoc.title}</h2>
              <p className="mt-4 text-[15px] leading-7 text-[#525252]">{selectedDoc.content}</p>
              <div className="mt-6 rounded-xl border border-[#E5E5E5] bg-[#F7F7F7] p-4 font-mono text-[12px] text-[#737373]">
                💡 Dica rápida: combine 3 variações de gancho + 1 CTA claro para encontrar o criativo vencedor mais cedo.
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-[#E5E5E5] bg-white p-5">
                <p className="text-[14px] font-semibold text-[#0A0A0A]">Próximo passo</p>
                <p className="mt-1.5 text-[13px] text-[#737373]">Aplique este conteúdo e teste pelo menos 3 variações no seu fluxo.</p>
                <Link to="/cadastro" className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#0A0A0A] hover:opacity-70 transition">
                  Criar minha loja <ArrowRight size={12} />
                </Link>
              </div>
              <div className="rounded-2xl border border-[#E5E5E5] bg-white p-5">
                <p className="text-[14px] font-semibold text-[#0A0A0A]">Boas práticas</p>
                <p className="mt-1.5 text-[13px] text-[#737373]">Use linguagem direta, benefício concreto e prova visual nos primeiros segundos.</p>
              </div>
            </div>
          </div>
        )}

        {/* ── GUIAS tab ─────────────────────────────────────────────────────── */}
        {activeTab === "guias" && (
          <div>
            <div className="mb-8">
              <h2 className="text-2xl font-extrabold text-[#0A0A0A]">Guias práticos</h2>
              <p className="mt-2 text-[14px] text-[#737373]">Passo a passo para dominar cada etapa da sua operação.</p>
            </div>

            {/* Featured card */}
            <div className="mb-6 rounded-2xl border border-[#E5E5E5] bg-[#0A0A0A] p-6 text-white sm:p-8">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-widest text-white/60">
                <Flame size={10} /> Em destaque
              </span>
              <h3 className="mt-3 text-xl font-extrabold">Como gerar vídeos que vendem</h3>
              <p className="mt-2 max-w-lg text-[14px] leading-6 text-white/60">
                Do gancho aos primeiros segundos: aprenda a estrutura completa de um criativo de alta conversão para TikTok e Instagram Reels.
              </p>
              <button
                onClick={() => { setSelectedDocId("videos-ia"); setActiveTab("docs"); }}
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-[13px] font-semibold text-[#0A0A0A] transition hover:bg-white/90"
              >
                Ler guia <ArrowRight size={13} />
              </button>
            </div>

            {/* Guide grid */}
            {guideGroup && (
              <div className="grid gap-3 sm:grid-cols-2">
                {guideGroup.items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => { setSelectedDocId(item.id); setActiveTab("docs"); }}
                    className="group flex items-start gap-4 rounded-2xl border border-[#E5E5E5] bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-[#D4D4D4] hover:shadow-md"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F0F0F0]">
                      <Lightbulb size={16} className="text-[#525252]" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-[14px] text-[#0A0A0A]">{item.title}</p>
                      <p className="mt-1 line-clamp-2 text-[13px] text-[#737373]">{item.content}</p>
                    </div>
                    <ChevronRight size={15} className="mt-0.5 shrink-0 text-[#C0C0C0] transition group-hover:text-[#0A0A0A]" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── UPDATES tab ───────────────────────────────────────────────────── */}
        {activeTab === "updates" && (
          <div>
            <div className="mb-8">
              <h2 className="text-2xl font-extrabold text-[#0A0A0A]">Atualizações</h2>
              <p className="mt-2 text-[14px] text-[#737373]">Novidades, melhorias e correções da plataforma.</p>
            </div>

            <div className="space-y-4">
              {changelog.map((item, i) => (
                <div
                  key={`${item.title}-${i}`}
                  className="flex gap-5 rounded-2xl border border-[#E5E5E5] bg-white p-6"
                >
                  {/* Icon */}
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#E5E5E5] bg-[#F7F7F7]">
                    {item.tag === "Novo"
                      ? <Sparkles size={16} className="text-emerald-500" />
                      : item.tag === "Melhorado"
                      ? <Wrench size={16} className="text-blue-500" />
                      : <Bug size={16} className="text-amber-500" />}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[15px] font-bold text-[#0A0A0A]">{item.title}</h3>
                      <span className={cn(
                        "rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                        tagStyle[item.tag]
                      )}>
                        {item.tag}
                      </span>
                    </div>
                    <p className="mt-1 text-[13px] text-[#A3A3A3]">{item.date}</p>
                    <p className="mt-2 text-[14px] leading-6 text-[#525252]">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── COMMUNITY tab ─────────────────────────────────────────────────── */}
        {activeTab === "community" && (
          <div>
            <div className="mb-8 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-extrabold text-[#0A0A0A]">Comunidade</h2>
                <p className="mt-2 text-[14px] text-[#737373]">Dicas, estratégias e casos reais de quem usa a Velo.</p>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#E5E5E5] bg-white px-3 py-1.5 text-[12px] font-medium text-[#525252]">
                <Users size={13} />
                Feed da comunidade
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {communityPosts.map((post, i) => (
                <article
                  key={`${post.title}-${i}`}
                  className="flex flex-col rounded-2xl border border-[#E5E5E5] bg-white p-6 transition hover:-translate-y-0.5 hover:border-[#D4D4D4] hover:shadow-md"
                >
                  <div className="flex items-center gap-2 text-[12px] text-[#A3A3A3]">
                    <span className="flex items-center gap-1">
                      <Megaphone size={11} /> {post.author}
                    </span>
                    <span>·</span>
                    <span>{post.date}</span>
                  </div>
                  <h3 className="mt-3 text-[15px] font-bold text-[#0A0A0A] leading-snug">{post.title}</h3>
                  <p className="mt-2 flex-1 text-[13px] leading-5 text-[#525252]">{post.content}</p>
                </article>
              ))}
            </div>

            {/* CTA */}
            <div className="mt-8 rounded-2xl border border-[#E5E5E5] bg-white p-8 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F0F0F0]">
                <Rocket size={20} className="text-[#525252]" />
              </div>
              <h3 className="mt-4 text-[17px] font-extrabold text-[#0A0A0A]">Faça parte da comunidade</h3>
              <p className="mt-2 text-[14px] text-[#737373]">Compartilhe resultados, aprenda com outros vendedores e cresça junto.</p>
              <Link
                to="/cadastro"
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#0A0A0A] px-6 py-3 text-[13px] font-semibold text-white transition hover:bg-[#1a1a1a]"
              >
                Criar workspace gratuito <ArrowRight size={13} />
              </Link>
            </div>
          </div>
        )}
      </main>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="border-t border-[#E5E5E5] bg-white py-8">
        <div className="mx-auto flex max-w-[1200px] flex-col items-center justify-between gap-4 px-6 text-[13px] text-[#A3A3A3] sm:flex-row md:px-8">
          <Link to="/" className="flex items-center">
            <VeloLogo size="sm" variant="dark" />
          </Link>
          <p>© 2026 Velo. Todos os direitos reservados.</p>
          <div className="flex gap-5">
            <Link to="/" className="transition hover:text-[#0A0A0A]">Produto</Link>
            <Link to="/login" className="transition hover:text-[#0A0A0A]">Login</Link>
            <Link to="/cadastro" className="transition hover:text-[#0A0A0A]">Cadastro</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
