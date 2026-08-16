import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ChevronDown,
  Lightbulb,
  MessageSquare,
  Search,
  Send,
  Sparkles,
  ThumbsUp,
  X,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { usePlan } from "@/hooks/usePlan";
import { useUpgradeModal } from "@/components/PlansUpgradeModal";
import { veloToast } from "@/components/ui/velo-toast";

type SuggestionRow = Database["public"]["Tables"]["feature_suggestions"]["Row"];
type SuggestionStatus = SuggestionRow["status"];
type SuggestionCategory = SuggestionRow["category"];

const paidPlans = new Set(["base", "pro", "business"]);

const statusColumns = [
  { id: "pending", label: "Pendentes", tone: "bg-[#E9EBEF] text-[#101827]" },
  { id: "approved", label: "Aprovadas", tone: "bg-[#E8F2FF] text-[#0F3B74]" },
  { id: "ongoing", label: "Em andamento", tone: "bg-[#FFE8C2] text-[#5A3712]" },
  { id: "completed", label: "Concluídas", tone: "bg-[#D7F8DF] text-[#125B2B]" },
  { id: "rejected", label: "Rejeitadas", tone: "bg-[#FFE2E2] text-[#7A2020]" },
] satisfies Array<{ id: SuggestionStatus; label: string; tone: string }>;

const categoryLabels = {
  geral: "Geral",
  catalogo: "Catálogo",
  paginas_ia: "Páginas com IA",
  integracoes: "Integrações",
  atlas: "Atlas",
  checkout: "Checkout",
  templates: "Templates",
} satisfies Record<SuggestionCategory, string>;

const categoryOptions = Object.entries(categoryLabels) as Array<[SuggestionCategory, string]>;

const sortOptions = [
  { value: "recent", label: "Mais recentes" },
  { value: "voted", label: "Mais votadas" },
] as const;

const formatDate = (date: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
  }).format(new Date(date));

const emptySuggestion = {
  title: "",
  description: "",
  category: "geral" as SuggestionCategory,
};

const SelectShell = ({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) => (
  <label className="relative block min-w-[160px]">
    <span className="sr-only">{label}</span>
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-10 w-full appearance-none rounded-[10px] border border-[#DDE2EA] bg-white px-4 pr-10 text-[14px] font-semibold text-[#111827] shadow-[0_1px_2px_rgba(15,23,42,0.06)] outline-none transition focus:border-[#2563EB] focus:ring-4 focus:ring-[#2563EB]/10"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
    <ChevronDown
      size={16}
      strokeWidth={2}
      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#8A94A6]"
      aria-hidden="true"
    />
  </label>
);

export default function SugestoesPage() {
  const { user } = useAuth();
  const { plan, loading: planLoading } = usePlan();
  const upgradeModal = useUpgradeModal();
  const [suggestions, setSuggestions] = useState<SuggestionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sort, setSort] = useState<(typeof sortOptions)[number]["value"]>("voted");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptySuggestion);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = paidPlans.has(plan);

  useEffect(() => {
    let active = true;

    const loadSuggestions = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("feature_suggestions")
        .select("*")
        .order("created_at", { ascending: false });

      if (!active) return;

      if (error) {
        setSuggestions([]);
        veloToast.error("Não foi possível carregar as sugestões agora.");
      } else {
        setSuggestions(data ?? []);
      }

      setLoading(false);
    };

    void loadSuggestions();

    return () => {
      active = false;
    };
  }, []);

  const filteredSuggestions = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return suggestions
      .filter((suggestion) => {
        const matchesCategory = categoryFilter === "all" || suggestion.category === categoryFilter;
        const matchesSearch =
          !normalizedSearch ||
          suggestion.title.toLowerCase().includes(normalizedSearch) ||
          suggestion.description.toLowerCase().includes(normalizedSearch);

        return matchesCategory && matchesSearch;
      })
      .sort((a, b) => {
        if (sort === "voted") {
          return b.votes_count - a.votes_count || new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }

        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [categoryFilter, search, sort, suggestions]);

  const suggestionsByStatus = useMemo(() => {
    return statusColumns.reduce(
      (acc, column) => {
        acc[column.id] = filteredSuggestions.filter((suggestion) => suggestion.status === column.id);
        return acc;
      },
      {} as Record<SuggestionStatus, SuggestionRow[]>,
    );
  }, [filteredSuggestions]);

  const handleOpenSubmit = () => {
    if (planLoading) return;

    if (!canSubmit) {
      veloToast.info("Enviar sugestões está disponível a partir do plano Base.");
      upgradeModal.open({ defaultPlan: "base" });
      return;
    }

    setModalOpen(true);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!user) {
      veloToast.error("Entre na sua conta para enviar uma sugestão.");
      return;
    }

    if (!canSubmit) {
      veloToast.info("Faça upgrade para o plano Base para enviar sugestões.");
      upgradeModal.open({ defaultPlan: "base" });
      return;
    }

    const title = form.title.trim();
    const description = form.description.trim();

    if (title.length < 3 || description.length < 10) {
      veloToast.error("Preencha um título e uma descrição um pouco mais completos.");
      return;
    }

    setSubmitting(true);
    const { data, error } = await supabase
      .from("feature_suggestions")
      .insert({
        user_id: user.id,
        title,
        description,
        category: form.category,
        status: "pending",
      })
      .select("*")
      .single();

    setSubmitting(false);

    if (error) {
      veloToast.error("Não foi possível enviar sua sugestão. Verifique seu plano e tente novamente.");
      return;
    }

    setSuggestions((current) => [data, ...current]);
    setForm(emptySuggestion);
    setModalOpen(false);
    veloToast.success("Sugestão enviada. Obrigado por ajudar a melhorar a Velo.");
  };

  return (
    <section className="mx-auto flex min-h-full w-full max-w-[1680px] flex-col gap-5 px-5 py-5 text-[#0A0A0A] sm:px-6 lg:px-7">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-[24px] font-extrabold leading-tight tracking-[-0.04em] text-[#0A0A0A] sm:text-[28px]">
            Sugestões
          </h1>
          <p className="mt-1 text-[15px] font-medium leading-6 text-[#6B7280]">
            Envie ideias, vote mentalmente no que faz sentido e acompanhe o que pode entrar na plataforma.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenSubmit}
          disabled={planLoading}
          className="velo-prime-button velo-prime-button--blue h-10 px-5 text-[14px] disabled:cursor-not-allowed disabled:opacity-70"
        >
          <Lightbulb size={18} strokeWidth={2.25} aria-hidden="true" />
          Enviar ideia
        </button>
      </header>

      <div className="flex flex-col gap-3 lg:flex-row">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Buscar sugestões</span>
          <Search
            size={20}
            strokeWidth={2}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#758197]"
            aria-hidden="true"
          />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-12 w-full rounded-[10px] border border-[#DDE2EA] bg-white pl-12 pr-4 text-[15px] font-medium text-[#111827] shadow-[0_1px_2px_rgba(15,23,42,0.06)] outline-none transition placeholder:text-[#8A94A6] focus:border-[#2563EB] focus:ring-4 focus:ring-[#2563EB]/10"
            placeholder="Buscar sugestões..."
          />
        </label>

        <div className="flex flex-col gap-3 sm:flex-row">
          <SelectShell
            label="Filtrar por categoria"
            value={categoryFilter}
            onChange={setCategoryFilter}
            options={[
              { value: "all", label: "Todas as categorias" },
              ...categoryOptions.map(([value, label]) => ({ value, label })),
            ]}
          />
          <SelectShell label="Ordenar sugestões" value={sort} onChange={(value) => setSort(value as typeof sort)} options={[...sortOptions]} />
        </div>
      </div>

      <div className="overflow-x-auto pb-3">
        <div className="grid min-w-[1120px] grid-cols-5 gap-4">
          {statusColumns.map((column) => {
            const columnSuggestions = suggestionsByStatus[column.id];

            return (
              <section
                key={column.id}
                className="rounded-[16px] bg-[#F4F5F7] p-1 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.04)]"
                aria-label={column.label}
              >
                <div className={`mb-3 flex h-10 items-center justify-between rounded-[12px] px-4 ${column.tone}`}>
                  <h2 className="text-[15px] font-extrabold tracking-[-0.03em]">{column.label}</h2>
                  <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-white px-2 text-[14px] font-extrabold">
                    {columnSuggestions.length}
                  </span>
                </div>

                <div className="space-y-3">
                  {loading ? (
                    <div className="rounded-[14px] border border-dashed border-[#DDE2EA] bg-white/70 p-5 text-center text-[14px] font-semibold text-[#6B7280]">
                      Carregando...
                    </div>
                  ) : columnSuggestions.length === 0 ? (
                    <div className="rounded-[14px] border border-dashed border-[#DDE2EA] bg-white/65 p-5 text-center text-[14px] font-semibold text-[#6B7280]">
                      Nenhuma ideia aqui ainda
                    </div>
                  ) : (
                    columnSuggestions.map((suggestion) => (
                      <article
                        key={suggestion.id}
                        className="rounded-[14px] border border-[#E2E7EF] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
                      >
                        <div className="mb-2 flex items-start gap-2">
                          <span className="shrink-0 rounded-full border border-[#DDE2EA] bg-white px-2 py-1 text-[11px] font-extrabold text-[#111827]">
                            {categoryLabels[suggestion.category]}
                          </span>
                          <h3 className="min-w-0 text-[16px] font-extrabold leading-5 tracking-[-0.035em] text-[#111827]">
                            {suggestion.title}
                          </h3>
                        </div>
                        <p
                          className="text-[14px] font-medium leading-5 text-[#697386]"
                          style={{
                            display: "-webkit-box",
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                        >
                          {suggestion.description}
                        </p>
                        <div className="mt-4 flex items-center justify-between gap-3 text-[13px] font-semibold text-[#697386]">
                          <span>{suggestion.user_id === user?.id ? "Você" : "Usuário Velo"}</span>
                          <span>{formatDate(suggestion.created_at)}</span>
                        </div>
                        <div className="mt-3 flex items-center gap-2 text-[13px] font-bold text-[#111827]">
                          <span className="inline-flex items-center gap-1 rounded-[9px] border border-[#E2E7EF] px-2 py-1">
                            <MessageSquare size={15} strokeWidth={2} aria-hidden="true" />
                            {suggestion.comments_count}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-[9px] border border-[#E2E7EF] px-2 py-1">
                            <ThumbsUp size={15} strokeWidth={2} aria-hidden="true" />
                            {suggestion.votes_count}
                          </span>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0A0A0A]/35 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-[560px] rounded-[20px] border border-[#E2E7EF] bg-white p-5 shadow-[0_24px_70px_rgba(15,23,42,0.24)]"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-[13px] bg-[#EAF1FF] text-[#2563EB]">
                  <Sparkles size={22} strokeWidth={2.25} aria-hidden="true" />
                </div>
                <h2 className="text-[22px] font-extrabold leading-tight tracking-[-0.04em]">Enviar ideia</h2>
                <p className="mt-1 text-[14px] font-medium text-[#697386]">
                  Disponível a partir do plano Base. Conte o que deixaria a Velo melhor.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-[#697386] transition hover:bg-[#F3F4F6] hover:text-[#111827]"
                aria-label="Fechar"
              >
                <X size={20} strokeWidth={2} />
              </button>
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-[13px] font-extrabold uppercase tracking-[0.04em] text-[#4B5563]">
                  Título
                </span>
                <input
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  maxLength={140}
                  className="h-11 w-full rounded-[11px] border border-[#DDE2EA] bg-white px-4 text-[15px] font-semibold outline-none transition placeholder:text-[#A0A8B6] focus:border-[#2563EB] focus:ring-4 focus:ring-[#2563EB]/10"
                  placeholder="Ex.: Integração com fornecedor nacional"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[13px] font-extrabold uppercase tracking-[0.04em] text-[#4B5563]">
                  Categoria
                </span>
                <select
                  value={form.category}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, category: event.target.value as SuggestionCategory }))
                  }
                  className="h-11 w-full rounded-[11px] border border-[#DDE2EA] bg-white px-4 text-[15px] font-semibold outline-none transition focus:border-[#2563EB] focus:ring-4 focus:ring-[#2563EB]/10"
                >
                  {categoryOptions.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[13px] font-extrabold uppercase tracking-[0.04em] text-[#4B5563]">
                  Descrição
                </span>
                <textarea
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  maxLength={1200}
                  className="min-h-[140px] w-full resize-none rounded-[11px] border border-[#DDE2EA] bg-white px-4 py-3 text-[15px] font-medium leading-6 outline-none transition placeholder:text-[#A0A8B6] focus:border-[#2563EB] focus:ring-4 focus:ring-[#2563EB]/10"
                  placeholder="Explique a ideia, por que ela ajudaria e em qual parte da plataforma ela deveria aparecer."
                />
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="h-10 rounded-[10px] border border-[#DDE2EA] bg-white px-4 text-[14px] font-extrabold text-[#111827] shadow-[0_1px_2px_rgba(15,23,42,0.06)] transition hover:bg-[#F9FAFB]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="velo-prime-button velo-prime-button--blue h-10 px-5 text-[14px] disabled:cursor-not-allowed disabled:opacity-70"
              >
                <Send size={17} strokeWidth={2.25} aria-hidden="true" />
                {submitting ? "Enviando..." : "Enviar sugestão"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
