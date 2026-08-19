import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, ArrowRight, ArrowUp, Plus, MessageSquare, PackageSearch, Trash2, ArrowLeft } from "lucide-react";
import AtlasAvatarIcon from "@/components/dashboard/AtlasAvatarIcon";
import AtlasMessageText from "@/components/dashboard/AtlasMessageText";
import AtlasThinkingText from "@/components/dashboard/AtlasThinkingText";
import { useAuth } from "@/contexts/AuthContext";
import { useAtlasNavegacao } from "@/contexts/AtlasChatContext";
import { supabase } from "@/integrations/supabase/client";
import AtlasPublishMlButton from "@/components/dashboard/AtlasPublishMlButton";
import { startMercadoLivreOAuth } from "@/lib/mercadoLivreOAuth";
import { salvarRetornoMl } from "@/lib/mlOauthRetorno";
import { veloToast } from "@/components/ui/velo-toast";

type ThreadRow = { id: string; title: string; updated_at: string };
type MessageRow = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  product_data?: AtlasMessageData | null;
};

type AtlasNavigationAction = {
  type: "navigation";
  label: string;
  route: string;
  /** "primary" usa o Botão Pilot (fundo escuro sólido). */
  variant?: "primary";
};

type AtlasProductCardAction = {
  type: "product_card";
  product_id: string;
  product?: {
    id?: string;
    title?: string;
    image_url?: string | null;
    margin_percent?: number | null;
    suggested_price?: number | null;
    route?: string;
  };
};

type AtlasQuickReplyAction = {
  type: "quick_reply";
  label: string;
  message: string;
};

type AtlasConnectMlAction = {
  type: "connect_ml";
  label: string;
};

type AtlasPublishMlAction = {
  type: "publish_ml";
  label: string;
  product_id: string;
  variant?: "primary";
};

type AtlasAction =
  | AtlasNavigationAction
  | AtlasPublishMlAction
  | AtlasProductCardAction
  | AtlasQuickReplyAction
  | AtlasConnectMlAction;

type AtlasMessageData = {
  actions?: AtlasAction[];
};

type AtlasFunctionResponse = {
  message?: string;
  error?: string;
  actions?: AtlasAction[];
};

const isAtlasAction = (action: unknown): action is AtlasAction => {
  if (!action || typeof action !== "object") return false;
  const candidate = action as Record<string, unknown>;
  if (candidate.type === "navigation") {
    return typeof candidate.label === "string" && typeof candidate.route === "string";
  }
  if (candidate.type === "product_card") {
    return typeof candidate.product_id === "string";
  }
  if (candidate.type === "quick_reply") {
    return typeof candidate.label === "string" && typeof candidate.message === "string";
  }
  if (candidate.type === "connect_ml") {
    return typeof candidate.label === "string";
  }
  return false;
};

const normalizeAtlasActions = (value: unknown): AtlasAction[] => {
  if (!Array.isArray(value)) return [];
  return value.filter(isAtlasAction).slice(0, 3);
};

const formatMargin = (margin?: number | null) => {
  if (typeof margin !== "number" || !Number.isFinite(margin)) return "Margem a verificar";
  return `${Math.round(margin)}% de margem`;
};

const formatPrice = (price?: number | null) => {
  if (typeof price !== "number" || !Number.isFinite(price)) return null;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price);
};

const AtlasAvatar = ({ size = 28 }: { size?: number }) => (
  <AtlasAvatarIcon size={size} style={{ display: "block" }} />
);

const AtlasChatPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  // Botões de "ir para a página": preservam a conversa no painel lateral e
  // disparam a pergunta automática da tela de destino.
  const navegarPeloAtlas = useAtlasNavegacao();
  const params = useParams<{ threadId?: string }>();
  const threadId = params.threadId ?? null;
  const queryClient = useQueryClient();
  const [conectandoMl, setConectandoMl] = useState(false);
  // Inicia o OAuth do Mercado Livre a partir do próprio chat. O helper só
  // redireciona para auth.mercadolivre.com, então uma resposta adulterada da
  // função não consegue mandar o usuário para outro domínio.
  const conectarMercadoLivre = async () => {
    if (conectandoMl) return;
    setConectandoMl(true);
    try {
      // Mesma aba: ao voltar do Mercado Livre, a conversa é reaberta no mesmo ponto.
      salvarRetornoMl({
        origem: "atlas",
        rota: `${window.location.pathname}${window.location.search}`,
        threadId,
      });
      await startMercadoLivreOAuth({ novaAba: false });
      setConectandoMl(false);
    } catch (erro) {
      setConectandoMl(false);
      veloToast.error(erro instanceof Error ? erro.message : "Não foi possível abrir a conexão com o Mercado Livre");
    }
  };

  const [input, setInput] = useState("");
  const [pendingFirstMessage, setPendingFirstMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Read ?first=... once and stash so we can send right after thread loads
  useEffect(() => {
    const url = new URL(window.location.href);
    const first = url.searchParams.get("first");
    if (first) {
      setPendingFirstMessage(first);
      url.searchParams.delete("first");
      window.history.replaceState({}, "", url.toString());
    }
  }, [threadId]);

  // If no threadId, create a new thread and navigate
  useEffect(() => {
    if (!user?.id || threadId) return;
    (async () => {
      const { data, error } = await supabase
        .from("atlas_threads" as never)
        .insert({ user_id: user.id, title: "Nova conversa" })
        .select("id")
        .single();
      if (error || !data) {
        veloToast.error("Não foi possível criar conversa");
        return;
      }
      navigate(`/dashboard/atlas/${(data as { id: string }).id}${window.location.search}`, {
        replace: true,
      });
    })();
  }, [user?.id, threadId, navigate]);

  const threadsQuery = useQuery({
    queryKey: ["atlas-threads", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async (): Promise<ThreadRow[]> => {
      const { data, error } = await supabase
        .from("atlas_threads" as never)
        .select("id, title, updated_at")
        .eq("user_id", user!.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data as ThreadRow[]) ?? [];
    },
  });

  const messagesQuery = useQuery({
    queryKey: ["atlas-messages", threadId],
    enabled: Boolean(threadId && user?.id),
    queryFn: async (): Promise<MessageRow[]> => {
      const { data, error } = await supabase
        .from("atlas_messages" as never)
        .select("id, role, content, created_at, product_data")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data as MessageRow[]) ?? [];
    },
  });

  const sendMutation = useMutation({
    mutationFn: async (text: string) => {
      if (!user?.id || !threadId) throw new Error("Sem sessão ou thread");
      // 1) insere mensagem do usuário
      const { data: userMsg, error: insertErr } = await supabase
        .from("atlas_messages" as never)
        .insert({ thread_id: threadId, user_id: user.id, role: "user", content: text })
        .select("id, role, content, created_at, product_data")
        .single();
      if (insertErr) throw insertErr;

      // refresh local
      queryClient.setQueryData<MessageRow[]>(["atlas-messages", threadId], (prev) => [
        ...(prev ?? []),
        userMsg as MessageRow,
      ]);

      // 2) chama edge function
      const prior = (queryClient.getQueryData<MessageRow[]>(["atlas-messages", threadId]) ?? [])
        .map((m) => ({ role: m.role, content: m.content, product_data: m.product_data }));
      const { data, error } = await supabase.functions.invoke("atlas-chat", {
        body: { messages: prior },
      });
      if (error) throw new Error(error.message || "Falha no Atlas");
      const atlasResponse = data as AtlasFunctionResponse | null;
      const reply = atlasResponse?.message;
      const actions = normalizeAtlasActions(atlasResponse?.actions);
      if (!reply) throw new Error(atlasResponse?.error || "Resposta vazia");

      // 3) insere resposta
      const { data: aiMsg, error: aiErr } = await supabase
        .from("atlas_messages" as never)
        .insert({
          thread_id: threadId,
          user_id: user.id,
          role: "assistant",
          content: reply,
          product_data: actions.length > 0 ? { actions } : null,
        })
        .select("id, role, content, created_at, product_data")
        .single();
      if (aiErr) throw aiErr;

      // 4) se for a primeira mensagem do usuário, usa o texto como título
      const allMessages = queryClient.getQueryData<MessageRow[]>(["atlas-messages", threadId]) ?? [];
      if (allMessages.filter((m) => m.role === "user").length <= 1) {
        const title = text.length > 50 ? `${text.slice(0, 50)}…` : text;
        await supabase
          .from("atlas_threads" as never)
          .update({ title, updated_at: new Date().toISOString() })
          .eq("id", threadId);
      } else {
        await supabase
          .from("atlas_threads" as never)
          .update({ updated_at: new Date().toISOString() })
          .eq("id", threadId);
      }

      return aiMsg as MessageRow;
    },
    onSuccess: (aiMsg) => {
      queryClient.setQueryData<MessageRow[]>(["atlas-messages", threadId], (prev) => [
        ...(prev ?? []),
        aiMsg,
      ]);
      queryClient.invalidateQueries({ queryKey: ["atlas-threads", user?.id] });
    },
    onError: (err: Error) => {
      veloToast.error(err.message || "Não foi possível enviar a mensagem");
    },
  });

  // Auto-envia pendingFirstMessage assim que thread estiver carregada
  useEffect(() => {
    if (!threadId || !pendingFirstMessage) return;
    if (messagesQuery.isLoading) return;
    if ((messagesQuery.data ?? []).length > 0) {
      setPendingFirstMessage(null);
      return;
    }
    const text = pendingFirstMessage;
    setPendingFirstMessage(null);
    sendMutation.mutate(text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId, pendingFirstMessage, messagesQuery.isLoading, messagesQuery.data]);

  // autoscroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messagesQuery.data, sendMutation.isPending]);

  // foco no input
  useEffect(() => {
    inputRef.current?.focus();
  }, [threadId, sendMutation.isPending]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || sendMutation.isPending) return;
    setInput("");
    sendMutation.mutate(text);
  };

  const handleNewThread = async () => {
    if (!user?.id) return;
    const { data, error } = await supabase
      .from("atlas_threads" as never)
      .insert({ user_id: user.id, title: "Nova conversa" })
      .select("id")
      .single();
    if (error || !data) {
      veloToast.error("Não foi possível criar conversa");
      return;
    }
    navigate(`/dashboard/atlas/${(data as { id: string }).id}`);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from("atlas_threads" as never).delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["atlas-threads", user?.id] });
    if (id === threadId) navigate("/dashboard/atlas");
  };

  const messages = messagesQuery.data ?? [];
  const threads = threadsQuery.data ?? [];
  const isThinking = sendMutation.isPending;
  const hasMessages = messages.length > 0;

  const fontStyle = useMemo(() => ({ fontFamily: '"Plus Jakarta Sans", sans-serif' }), []);
  const renderAtlasActions = (message: MessageRow) => {
    const actions = normalizeAtlasActions(message.product_data?.actions);
    if (actions.length === 0) return null;

    // Mesmo tratamento do painel do dashboard: sugestões em linha que quebra,
    // separadas das ações largas que continuam empilhadas.
    const sugestoes = actions.filter(
      (action): action is AtlasQuickReplyAction => action.type === "quick_reply",
    );
    // Atalhos de categoria (variant "primary") também saem da coluna: seis botões
    // escuros empilhados pesam tanto quanto os chips soltos que corrigimos antes.
    const atalhos = actions.filter(
      (action): action is AtlasNavigationAction =>
        action.type === "navigation" && action.variant === "primary",
    );
    const demais = actions.filter(
      (action): action is Exclude<AtlasAction, AtlasQuickReplyAction> =>
        action.type !== "quick_reply" && !(action.type === "navigation" && action.variant === "primary"),
    );

    return (
      <div className="mt-3 flex flex-col gap-2">
        {demais.map((action, index) => {
          if (action.type === "navigation") {
            return (
              <button
                key={`${action.type}-${action.route}-${index}`}
                type="button"
                onClick={() => void navegarPeloAtlas(action.route)}
                className="inline-flex w-fit max-w-full items-center gap-2 rounded-full border border-black/[0.08] bg-white px-3 py-1.5 text-left text-[12px] font-semibold text-neutral-700 shadow-[0_4px_14px_rgba(0,0,0,0.04)] transition-colors hover:bg-neutral-50"
              >
                <ArrowRight className="h-3.5 w-3.5 text-[#351078]" />
                <span className="truncate">{action.label}</span>
              </button>
            );
          }

          if (action.type === "publish_ml") {
            return (
              <AtlasPublishMlButton
                key={`publish-${action.product_id}-${index}`}
                produtoId={action.product_id}
                label={action.label}
              />
            );
          }

          if (action.type === "connect_ml") {
            return (
              <button
                key={`${action.type}-${index}`}
                type="button"
                onClick={() => void conectarMercadoLivre()}
                disabled={conectandoMl}
                className="inline-flex w-fit max-w-full items-center gap-2 rounded-full bg-[#2563EB] px-3 py-1.5 text-left text-[12px] font-semibold text-white transition-colors hover:bg-[#1D4ED8] disabled:cursor-wait disabled:opacity-60"
              >
                <span className="truncate">{conectandoMl ? "Abrindo o Mercado Livre…" : action.label}</span>
              </button>
            );
          }

          const product = action.product;
          const title = product?.title ?? "Produto do catálogo Velo";
          const route = product?.route ?? `/dashboard/catalogo/${action.product_id}`;
          const price = formatPrice(product?.suggested_price);

          return (
            <div
              key={`${action.type}-${action.product_id}-${index}`}
              className="flex max-w-[420px] items-center gap-3 rounded-lg border border-black/[0.08] bg-white p-2.5 shadow-[0_6px_18px_rgba(0,0,0,0.045)]"
            >
              <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-md bg-neutral-100">
                {product?.image_url ? (
                  <img src={product.image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <PackageSearch className="h-5 w-5 text-neutral-400" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-[12.5px] font-semibold leading-5 text-neutral-800">{title}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">
                    {formatMargin(product?.margin_percent)}
                  </span>
                  {price ? <span className="text-neutral-400">{price}</span> : null}
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate(route)}
                className="shrink-0 rounded-full bg-[#2563EB] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#1D4ED8]"
              >
                Ver produto
              </button>
            </div>
          );
        })}

        {atalhos.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pb-0.5">
            {atalhos.map((action, index) => (
              <button
                key={`atalho-${action.route}-${index}`}
                type="button"
                onClick={() => void navegarPeloAtlas(action.route)}
                className="inline-flex max-w-full items-center gap-1.5 rounded-full border !border-[#D8E4FB] bg-[#F0F5FF] px-2.5 py-[6px] text-[12px] font-medium tracking-[-0.01em] text-[#1D4ED8] transition-[background-color,border-color,transform] duration-200 hover:-translate-y-px hover:!border-[#B9CFF8] hover:bg-[#E4EDFF]"
              >
                <ArrowUpRight className="h-3 w-3 shrink-0 text-[#2563EB]/70" strokeWidth={2.2} aria-hidden />
                <span className="truncate">{action.label}</span>
              </button>
            ))}
          </div>
        )}

        {sugestoes.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            {sugestoes.map((action, index) => (
              <button
                key={`quick-${action.message}-${index}`}
                type="button"
                onClick={() => sendMutation.mutate(action.message)}
                disabled={sendMutation.isPending}
                className="inline-flex max-w-full items-center rounded-full border !border-[#DCE3F0] bg-white px-3 py-[6px] text-[12px] font-medium tracking-[-0.01em] text-[#1E3A8A] shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-[border-color,background-color,color,transform] duration-200 hover:-translate-y-px hover:!border-[#93B4F5] hover:bg-[#F5F8FF] hover:text-[#1D4ED8] disabled:cursor-wait disabled:opacity-45 disabled:hover:translate-y-0"
              >
                <span className="truncate">{action.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <main
      data-atlas-chat
      className="min-h-full w-full bg-[#f4f4f4] text-[#111111] flex"
      style={fontStyle}
    >
      {/* Sidebar de threads */}
      <aside className="hidden md:flex w-[260px] shrink-0 flex-col border-r border-black/[0.06] bg-white">
        <div className="p-3 border-b border-black/[0.06]">
          <button
            onClick={handleNewThread}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#2563EB] text-white text-[13px] font-semibold py-2.5 hover:bg-[#1D4ED8] transition-opacity"
          >
            <Plus className="h-4 w-4" /> Nova conversa
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {threads.length === 0 && (
            <p className="text-[12px] text-neutral-400 px-3 py-4 text-center">
              Suas conversas com o Atlas aparecerão aqui.
            </p>
          )}
          {threads.map((t) => {
            const active = t.id === threadId;
            return (
              <div
                key={t.id}
                onClick={() => navigate(`/dashboard/atlas/${t.id}`)}
                className={`group flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer text-[13px] transition-colors ${
                  active ? "bg-neutral-100 text-neutral-900 font-semibold" : "text-neutral-600 hover:bg-neutral-50"
                }`}
              >
                <MessageSquare className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
                <span className="flex-1 truncate">{t.title}</span>
                <button
                  type="button"
                  onClick={(e) => handleDelete(t.id, e)}
                  className="opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-rose-500 transition-colors"
                  aria-label="Excluir conversa"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </aside>

      {/* Coluna do chat */}
      <section className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between px-6 py-4 border-b border-black/[0.06] bg-white">
          <button
            onClick={() => navigate("/dashboard")}
            className="md:hidden inline-flex items-center gap-1.5 text-[13px] text-neutral-600"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar
          </button>
          <div className="flex items-center gap-2.5">
            <AtlasAvatar size={28} />
            <div>
              <div className="text-[14px] font-bold text-neutral-900 leading-none">Atlas</div>
              <div className="text-[11px] text-neutral-500 mt-0.5">Seu agente de vendas</div>
            </div>
          </div>
          <button
            onClick={handleNewThread}
            aria-label="Nova conversa"
            className="md:hidden inline-flex items-center gap-1 text-[13px] font-semibold text-neutral-700"
          >
            <Plus className="h-4 w-4" />
          </button>
          <div className="hidden md:block" />
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-8 py-6">
          <div className="mx-auto max-w-[760px] flex flex-col gap-6">
            {!hasMessages && !isThinking && (
              <div className="flex flex-col items-center text-center pt-10 gap-3">
                <AtlasAvatar size={56} />
                <h2 className="text-[20px] font-bold text-neutral-900">Olá, eu sou o Atlas</h2>
                <p className="text-[14px] text-neutral-500 max-w-[420px]">
                  Sou seu agente de vendas: posso ajudar a encontrar produtos, conectar o Mercado Livre e tirar dúvidas. Por onde quer começar?
                </p>
              </div>
            )}

            {messages.map((m) => (
              <div key={m.id} className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.role === "assistant" && <AtlasAvatar size={28} />}
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed ${
                    m.role === "user"
                      ? "bg-[#111111] text-white"
                      : "text-neutral-800"
                  }`}
                >
                  {m.role === "assistant" ? (
                    <>
                      <AtlasMessageText
                        content={m.content}
                        className="prose prose-sm max-w-none prose-p:my-1.5 prose-li:my-0.5 prose-headings:my-2"
                      />
                      {renderAtlasActions(m)}
                    </>
                  ) : (
                    <span className="whitespace-pre-wrap">{m.content}</span>
                  )}
                </div>
              </div>
            ))}

            {isThinking && <AtlasThinkingText className="text-[15px]" />}
          </div>
        </div>

        {/* Sem borda superior: a barra do chat encosta na conversa sem risco separando. */}
        <div className="bg-white px-4 sm:px-8 py-4">
          <form
            onSubmit={handleSubmit}
            className="mx-auto max-w-[760px] flex items-end gap-2 bg-white border border-neutral-200 rounded-2xl p-2.5 pl-4 shadow-[0_4px_16px_rgba(0,0,0,0.03)] focus-within:border-neutral-400 transition-colors"
          >
            <AtlasAvatar size={24} />
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              rows={1}
              placeholder="Pergunte ao Atlas…"
              className="flex-1 bg-transparent resize-none outline-none text-[14px] text-neutral-800 placeholder:text-neutral-400 max-h-[160px] py-1"
              disabled={isThinking}
            />
            <button
              type="submit"
              disabled={!input.trim() || isThinking}
              className="h-9 w-9 rounded-xl bg-[#2563EB] text-white grid place-items-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#1D4ED8] transition-colors"
              aria-label="Enviar"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          </form>
        </div>
      </section>
    </main>
  );
};

export default AtlasChatPage;
