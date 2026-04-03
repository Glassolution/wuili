import { useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, RefreshCcw, Search, Store } from "lucide-react";

type ChannelStatus = "published" | "publishing" | "error" | "none";

type Publication = {
  name: string;
  sku: string;
  category: string;
  price: string;
  updatedAt: string;
  ml: ChannelStatus;
  shopee: ChannelStatus;
  loja: ChannelStatus;
};

const publications: Publication[] = [
  { name: "Fone TWS", sku: "AUD-4821", category: "Eletrônicos", price: "R$ 189,00", updatedAt: "Hoje, 14:32", ml: "published", shopee: "published", loja: "published" },
  { name: "Tênis Casual", sku: "MOD-4820", category: "Moda", price: "R$ 127,00", updatedAt: "Hoje, 11:15", ml: "published", shopee: "publishing", loja: "published" },
  { name: "Kit Skincare", sku: "BEL-4819", category: "Beleza", price: "R$ 89,00", updatedAt: "Ontem, 18:40", ml: "published", shopee: "published", loja: "error" },
  { name: "Relógio Smart", sku: "TEC-4818", category: "Eletrônicos", price: "R$ 234,00", updatedAt: "Ontem, 09:22", ml: "published", shopee: "published", loja: "published" },
  { name: "Mochila Urbana", sku: "MOD-4817", category: "Moda", price: "R$ 156,00", updatedAt: "2 dias atrás", ml: "publishing", shopee: "none", loja: "published" },
  { name: "Óculos Retrô", sku: "MOD-4816", category: "Moda", price: "R$ 78,00", updatedAt: "2 dias atrás", ml: "published", shopee: "published", loja: "none" },
  { name: "Mouse Sem Fio", sku: "TEC-4815", category: "Eletrônicos", price: "R$ 67,00", updatedAt: "3 dias atrás", ml: "published", shopee: "error", loja: "published" },
  { name: "Capa iPhone", sku: "TEC-4814", category: "Eletrônicos", price: "R$ 39,00", updatedAt: "3 dias atrás", ml: "published", shopee: "published", loja: "published" },
];

const statusBadge: Record<ChannelStatus, { label: string; cls: string }> = {
  published: { label: "Publicado", cls: "bg-success-light text-success" },
  publishing: { label: "Publicando", cls: "bg-warning/10 text-warning" },
  error: { label: "Erro", cls: "bg-destructive/10 text-destructive" },
  none: { label: "Não publicado", cls: "bg-muted text-muted-foreground" },
};

const filterOptions = ["Todos", "Ativos", "Publicando", "Com erro", "Não publicados"];

const getProductInitials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

const getPublicationState = (publication: Publication) => {
  const statuses = [publication.ml, publication.shopee, publication.loja];

  if (statuses.includes("error")) {
    return "Com erro";
  }

  if (statuses.includes("publishing")) {
    return "Publicando";
  }

  if (statuses.every((status) => status === "none")) {
    return "Não publicados";
  }

  return "Ativos";
};

const getChecklist = (publication: Publication) => [
  { label: "Título revisado", done: true },
  { label: "Preço sincronizado", done: publication.ml !== "error" && publication.shopee !== "error" && publication.loja !== "error" },
  { label: "Estoque publicado em todos os canais", done: ![publication.ml, publication.shopee, publication.loja].includes("none") },
];

const PublicationsPage = () => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("Todos");

  const filteredPublications = useMemo(() => {
    return publications.filter((publication) => {
      const matchesSearch =
        publication.name.toLowerCase().includes(search.toLowerCase()) ||
        publication.sku.toLowerCase().includes(search.toLowerCase());
      const publicationState = getPublicationState(publication);
      const matchesFilter = filter === "Todos" || publicationState === filter;

      return matchesSearch && matchesFilter;
    });
  }, [filter, search]);

  const selectedPublication = filteredPublications[selectedIndex] || filteredPublications[0];

  const summary = {
    active: publications.filter((publication) => getPublicationState(publication) === "Ativos").length,
    publishing: publications.filter((publication) => getPublicationState(publication) === "Publicando").length,
    errors: publications.filter((publication) => getPublicationState(publication) === "Com erro").length,
  };

  return (
    <div className="space-y-6">
      <div className="card-wuili p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-foreground">Publicações</h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Acompanhe o que já foi publicado, o que ainda está em fila e quais anúncios precisam de correção.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button className="rounded-xl bg-muted px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted/80">
              Sincronizar canais
            </button>
            <button className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90">
              Nova publicação
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="card-wuili p-5">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-success-light text-success">
            <CheckCircle2 size={18} />
          </div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground/80">Publicações ativas</p>
          <p className="mt-2 text-2xl font-black text-foreground">{summary.active}</p>
          <p className="mt-1 text-xs text-muted-foreground">Anúncios disponíveis em pelo menos um canal</p>
        </div>
        <div className="card-wuili p-5">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-warning/10 text-warning">
            <RefreshCcw size={18} />
          </div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground/80">Em publicação</p>
          <p className="mt-2 text-2xl font-black text-foreground">{summary.publishing}</p>
          <p className="mt-1 text-xs text-muted-foreground">Itens aguardando sincronização ou processamento</p>
        </div>
        <div className="card-wuili p-5">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <AlertCircle size={18} />
          </div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground/80">Com atenção</p>
          <p className="mt-2 text-2xl font-black text-foreground">{summary.errors}</p>
          <p className="mt-1 text-xs text-muted-foreground">Precisam de ajuste antes da próxima sincronização</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            className="w-full rounded-xl border border-border bg-background py-2.5 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            placeholder="Buscar por nome ou SKU..."
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setSelectedIndex(0);
            }}
          />
        </div>
        <div className="flex gap-2 overflow-x-auto">
          {filterOptions.map((option) => (
            <button
              key={option}
              onClick={() => {
                setFilter(option);
                setSelectedIndex(0);
              }}
              className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                filter === option ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <div className="card-wuili overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] table-fixed">
              <colgroup>
                <col className="w-[42%]" />
                <col className="w-[14%]" />
                <col className="w-[14%]" />
                <col className="w-[14%]" />
                <col className="w-[16%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-border text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground/80">
                  <th className="px-5 py-4 text-left">Produto</th>
                  <th className="px-4 py-4 text-left">Mercado Livre</th>
                  <th className="px-4 py-4 text-left">Shopee</th>
                  <th className="px-4 py-4 text-left">Loja</th>
                  <th className="px-4 py-4 text-left">Atualizado</th>
                </tr>
              </thead>
              <tbody>
                {filteredPublications.map((publication, index) => {
                  const isSelected = selectedPublication?.sku === publication.sku;

                  return (
                    <tr
                      key={publication.sku}
                      onClick={() => setSelectedIndex(index)}
                      className={`cursor-pointer border-b border-border transition-colors last:border-0 ${
                        isSelected ? "bg-accent/60" : "hover:bg-muted/30"
                      }`}
                    >
                      <td className="px-5 py-4 align-middle">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-muted text-xs font-bold tracking-[0.16em] text-foreground">
                            {getProductInitials(publication.name)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">{publication.name}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {publication.sku} · {publication.category} · {publication.price}
                            </p>
                          </div>
                        </div>
                      </td>
                      {(["ml", "shopee", "loja"] as const).map((channel) => (
                        <td key={channel} className="px-4 py-4 align-middle">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadge[publication[channel]].cls}`}>
                            {statusBadge[publication[channel]].label}
                          </span>
                        </td>
                      ))}
                      <td className="px-4 py-4 align-middle text-xs text-muted-foreground">{publication.updatedAt}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredPublications.length === 0 && (
            <div className="px-5 py-10 text-center">
              <p className="text-sm font-medium text-foreground">Nenhuma publicação encontrada</p>
              <p className="mt-1 text-xs text-muted-foreground">Ajuste a busca ou troque o filtro para ver outros itens.</p>
            </div>
          )}
        </div>

        <div className="card-wuili p-5">
          {selectedPublication ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-sm font-bold tracking-[0.16em] text-foreground">
                    {getProductInitials(selectedPublication.name)}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-foreground">{selectedPublication.name}</h3>
                    <p className="text-xs text-muted-foreground">{selectedPublication.sku}</p>
                  </div>
                </div>
                <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                  {selectedPublication.category}
                </span>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-muted/50 px-4 py-3">
                  <p className="text-xs text-muted-foreground">Preço atual</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{selectedPublication.price}</p>
                </div>
                <div className="rounded-xl bg-muted/50 px-4 py-3">
                  <p className="text-xs text-muted-foreground">Última atualização</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{selectedPublication.updatedAt}</p>
                </div>
              </div>

              <div className="mt-6">
                <h4 className="text-sm font-bold text-foreground">Canais</h4>
                <div className="mt-3 space-y-3">
                  {([
                    ["Mercado Livre", selectedPublication.ml],
                    ["Shopee", selectedPublication.shopee],
                    ["Loja própria", selectedPublication.loja],
                  ] as const).map(([name, status]) => (
                    <div key={name} className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                          <Store size={16} />
                        </div>
                        <span className="text-sm font-medium text-foreground">{name}</span>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadge[status].cls}`}>
                        {statusBadge[status].label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6">
                <h4 className="text-sm font-bold text-foreground">Checklist de publicação</h4>
                <div className="mt-3 space-y-2">
                  {getChecklist(selectedPublication).map((item) => (
                    <div key={item.label} className="flex items-center justify-between rounded-xl bg-muted/40 px-4 py-3">
                      <span className="text-sm text-foreground">{item.label}</span>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.done ? "bg-success-light text-success" : "bg-muted text-muted-foreground"}`}>
                        {item.done ? "Ok" : "Pendente"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 flex gap-2">
                <button className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90">
                  Publicar novamente
                </button>
                <button className="flex-1 rounded-xl bg-muted py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted/80">
                  Editar anúncio
                </button>
              </div>
            </>
          ) : (
            <div className="flex min-h-72 items-center justify-center text-center">
              <div>
                <p className="text-sm font-medium text-foreground">Nenhum item selecionado</p>
                <p className="mt-1 text-xs text-muted-foreground">Escolha uma publicação na lista para ver os detalhes.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PublicationsPage;
