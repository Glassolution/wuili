import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUp, Plus, MessageSquare, Trash2, ArrowLeft } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { veloToast } from "@/components/ui/velo-toast";

type ThreadRow = { id: string; title: string; updated_at: string };
type MessageRow = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

const AtlasAvatar = ({ size = 28 }: { size?: number }) => (
  <div
    style={{ width: size, height: size }}
    className="shrink-0 rounded-full bg-gradient-to-br from-violet-500 via-fuchsia-500 to-indigo-500 grid place-items-center text-white text-[12px] font-bold shadow-sm"
  >
    A
  </div>
);

const AtlasChatPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const params = useParams<{ threadId?: string }>();
  const threadId = params.threadId ?? null;
  const queryClient = useQueryClient();
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
        .select("id, role, content, created_at")
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
        .select("id, role, content, created_at")
        .single();
      if (insertErr) throw insertErr;

      // refresh local
      queryClient.setQueryData<MessageRow[]>(["atlas-messages", threadId], (prev) => [
        ...(prev ?? []),
        userMsg as MessageRow,
      ]);

      // 2) chama edge function
      const prior = (queryClient.getQueryData<MessageRow[]>(["atlas-messages", threadId]) ?? [])
        .map((m) => ({ role: m.role, content: m.content }));
      const { data, error } = await supabase.functions.invoke("atlas-chat", {
        body: { messages: prior },
      });
      if (error) throw new Error(error.message || "Falha no Atlas");
      const reply = (data as { message?: string; error?: string })?.message;
      if (!reply) throw new Error((data as { error?: string })?.error || "Resposta vazia");

      // 3) insere resposta
      const { data: aiMsg, error: aiErr } = await supabase
        .from("atlas_messages" as never)
        .insert({ thread_id: threadId, user_id: user.id, role: "assistant", content: reply })
        .select("id, role, content, created_at")
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

  return (
    <main
      className="min-h-full w-full bg-[#f4f4f4] text-[#111111] flex"
      style={fontStyle}
    >
      {/* Sidebar de threads */}
      <aside className="hidden md:flex w-[260px] shrink-0 flex-col border-r border-black/[0.06] bg-white">
        <div className="p-3 border-b border-black/[0.06]">
          <button
            onClick={handleNewThread}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#111111] text-white text-[13px] font-semibold py-2.5 hover:opacity-90 transition-opacity"
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
              <div className="text-[11px] text-neutral-500 mt-0.5">Assistente da Velo</div>
            </div>
          </div>
          <button
            onClick={handleNewThread}
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
                  Posso te ajudar a usar a Velo, conectar o Mercado Livre, encontrar produtos e tirar dúvidas. Por onde quer começar?
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
                    <div className="prose prose-sm max-w-none prose-p:my-1.5 prose-li:my-0.5 prose-headings:my-2">
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <span className="whitespace-pre-wrap">{m.content}</span>
                  )}
                </div>
              </div>
            ))}

            {isThinking && (
              <div className="flex gap-3 justify-start">
                <AtlasAvatar size={28} />
                <div className="text-[13px] text-neutral-400 italic pt-1">Atlas está pensando…</div>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-black/[0.06] bg-white px-4 sm:px-8 py-4">
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
              className="h-9 w-9 rounded-xl bg-neutral-900 text-white grid place-items-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-neutral-800 transition-colors"
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
