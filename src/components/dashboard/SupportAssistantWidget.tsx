import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { LifeBuoy, Loader2, RotateCcw, Send, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type Msg = { id: string; role: "user" | "assistant" | "admin"; content: string };

const BOAS_VINDAS =
  "Oi! Sou o assistente da Velo. Posso verificar sua conta do Mercado Livre e tirar dúvidas sobre a plataforma. Como posso ajudar?";

export default function SupportAssistantWidget() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const carregar = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("support_ai_messages")
      .select("id, role, content")
      .eq("user_id", user.id)
      .eq("archived", false)
      .order("created_at", { ascending: true })
      .limit(200);
    setMsgs((data ?? []) as Msg[]);
  };

  useEffect(() => {
    if (open) void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user?.id]);

  // Respostas da equipe chegam em tempo real enquanto o chat está aberto.
  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => void carregar(), 20000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user?.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, sending]);

  useEffect(() => {
    if (open && !sending) inputRef.current?.focus();
  }, [open, sending]);

  const enviar = async () => {
    const m = text.trim();
    if (!m || sending) return;
    setText("");
    setMsgs((p) => [...p, { id: `tmp-${Date.now()}`, role: "user", content: m }]);
    setSending(true);
    const { data, error } = await supabase.functions.invoke("support-assistant", {
      body: { action: "send", message: m },
    });
    setSending(false);
    if (error || data?.error) {
      let msg = data?.error as string | undefined;
      if (!msg && error && "context" in error) {
        try { msg = (await (error as { context: Response }).context.json())?.error; } catch { /* sem corpo */ }
      }
      setMsgs((p) => [...p, { id: `err-${Date.now()}`, role: "assistant", content: msg ?? "Não consegui responder agora. Tente de novo em instantes." }]);
      return;
    }
    await carregar();
  };

  const novaConversa = async () => {
    if (!user) return;
    await supabase.from("support_ai_messages").update({ archived: true }).eq("user_id", user.id).eq("archived", false);
    setMsgs([]);
  };

  if (!user) return null;

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-[#1E3A8A] px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-[#2563EB]"
          aria-label="Abrir ajuda"
        >
          <LifeBuoy size={18} /> Ajuda
        </button>
      )}
      {open && (
        <div className="fixed inset-x-2 bottom-2 z-50 flex h-[75vh] flex-col overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-2xl sm:inset-x-auto sm:right-5 sm:bottom-5 sm:h-[560px] sm:w-[380px] dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center gap-3 bg-[#1E3A8A] px-4 py-3 text-white">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15"><LifeBuoy size={18} /></div>
            <div className="flex-1">
              <p className="text-sm font-semibold">Suporte Velo</p>
              <p className="text-[11px] text-white/70">Respostas na hora sobre sua conta e o Mercado Livre</p>
            </div>
            <button onClick={novaConversa} title="Nova conversa" className="rounded-full p-1.5 hover:bg-white/15"><RotateCcw size={16} /></button>
            <button onClick={() => setOpen(false)} aria-label="Fechar" className="rounded-full p-1.5 hover:bg-white/15"><X size={18} /></button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4 text-sm">
            <Bolha role="assistant" content={BOAS_VINDAS} />
            {msgs.map((m) => <Bolha key={m.id} role={m.role} content={m.content} />)}
            {sending && (
              <div className="flex items-center gap-2 text-[#6B7280]"><Loader2 size={14} className="animate-spin" /> Verificando…</div>
            )}
            <div ref={endRef} />
          </div>

          <div className="flex items-end gap-2 border-t border-[#E5E7EB] p-3 dark:border-zinc-800">
            <textarea
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void enviar(); } }}
              rows={1}
              placeholder="Escreva sua dúvida…"
              className="max-h-28 min-h-[40px] flex-1 resize-none rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2 text-sm outline-none focus:border-[#2563EB] dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            />
            <button
              onClick={() => void enviar()}
              disabled={!text.trim() || sending}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#2563EB] text-white disabled:opacity-40"
              aria-label="Enviar"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function Bolha({ role, content }: { role: Msg["role"]; content: string }) {
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-[#2563EB] px-3 py-2 text-white">{content}</div>
      </div>
    );
  }
  return (
    <div className="max-w-[92%]">
      {role === "admin" && <p className="mb-1 text-[11px] font-semibold text-[#1E3A8A] dark:text-blue-300">Equipe Velo</p>}
      <div className={`prose prose-sm max-w-none text-[#111827] dark:prose-invert dark:text-zinc-100 [&_a]:text-[#2563EB] ${role === "admin" ? "rounded-2xl border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-2 dark:border-blue-900 dark:bg-blue-950/40" : ""}`}>
        <ReactMarkdown components={{ a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer">{children}</a> }}>{content}</ReactMarkdown>
      </div>
    </div>
  );
}
