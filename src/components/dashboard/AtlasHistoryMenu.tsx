import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { History, MessageSquare, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { veloToast } from "@/components/ui/velo-toast";
import {
  atlasMessagesQueryKey,
  atlasThreadsQueryKey,
  type AtlasThreadSummary,
} from "@/lib/atlasHistory";

type AtlasHistoryMenuProps = {
  userId: string | null | undefined;
  activeThreadId: string | null;
  onSelectThread: (threadId: string) => void | Promise<void>;
  onThreadDeleted: (threadId: string) => void;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const MENU_MAX_WIDTH = 320;
const MENU_VIEWPORT_MARGIN = 16;

const formatThreadDate = (isoDate: string) => {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "";

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfThreadDay = new Date(date);
  startOfThreadDay.setHours(0, 0, 0, 0);
  const daysAgo = Math.round((startOfToday.getTime() - startOfThreadDay.getTime()) / DAY_MS);

  if (daysAgo <= 0) {
    return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(date);
  }
  if (daysAgo === 1) return "Ontem";
  if (daysAgo < 7) return `${daysAgo} dias atrás`;
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(date);
};

const AtlasHistoryMenu = ({
  userId,
  activeThreadId,
  onSelectThread,
  onThreadDeleted,
}: AtlasHistoryMenuProps) => {
  const reduceMotion = useReducedMotion();
  const queryClient = useQueryClient();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<AtlasThreadSummary | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number; width: number } | null>(
    null,
  );

  const threadsQuery = useQuery({
    queryKey: atlasThreadsQueryKey(userId),
    enabled: Boolean(userId) && open,
    queryFn: async (): Promise<AtlasThreadSummary[]> => {
      const { data, error } = await supabase
        .from("atlas_threads")
        .select("id, title, updated_at")
        .eq("user_id", userId!)
        .order("updated_at", { ascending: false });

      if (error) throw new Error(error.message);
      return (data as AtlasThreadSummary[]) ?? [];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (thread: AtlasThreadSummary) => {
      // As mensagens saem primeiro para não depender do ON DELETE CASCADE do banco.
      const { error: messagesError } = await supabase
        .from("atlas_messages")
        .delete()
        .eq("thread_id", thread.id);
      if (messagesError) throw new Error(messagesError.message);

      const { error: threadError } = await supabase
        .from("atlas_threads")
        .delete()
        .eq("id", thread.id);
      if (threadError) throw new Error(threadError.message);

      return thread;
    },
    onSuccess: (thread) => {
      queryClient.setQueryData<AtlasThreadSummary[]>(atlasThreadsQueryKey(userId), (current) =>
        (current ?? []).filter((item) => item.id !== thread.id),
      );
      queryClient.removeQueries({ queryKey: atlasMessagesQueryKey(thread.id) });
      setPendingDelete(null);
      onThreadDeleted(thread.id);
      veloToast.success("Conversa apagada");
    },
    onError: (error: Error) => {
      veloToast.error(error.message || "Não foi possível apagar a conversa");
    },
  });

  // O gatilho é o primeiro ícone do grupo de ações, então alinhar o menu apenas pela direita
  // dele estouraria a viewport no painel compacto. Aqui a posição é presa à viewport.
  useLayoutEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const width = Math.min(MENU_MAX_WIDTH, window.innerWidth - MENU_VIEWPORT_MARGIN * 2);
      const maxLeft = window.innerWidth - width - MENU_VIEWPORT_MARGIN;
      const left = Math.min(Math.max(MENU_VIEWPORT_MARGIN, rect.right - width), maxLeft);

      setMenuPosition({ top: rect.bottom + 8, left, width });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  // Fecha ao clicar fora — exceto quando o diálogo de confirmação está aberto.
  useEffect(() => {
    if (!open || pendingDelete) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (containerRef.current?.contains(target)) return;
      setOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, pendingDelete]);

  const threads = threadsQuery.data ?? [];
  const isLoading = threadsQuery.isLoading && threads.length === 0;

  const handleSelect = (threadId: string) => {
    setOpen(false);
    void onSelectThread(threadId);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`grid h-9 w-9 place-items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4A0FA6]/20 ${
          open ? "bg-black/[0.06] text-[#303030]" : "hover:bg-black/[0.045]"
        }`}
        aria-label="Histórico de conversas"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <History className="h-[18px] w-[18px]" strokeWidth={1.8} />
      </button>

      <AnimatePresence>
        {open && menuPosition && (
          <motion.div
            role="menu"
            aria-label="Conversas anteriores"
            initial={reduceMotion ? false : { opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: reduceMotion ? 0 : 0.18, ease: [0.22, 1, 0.36, 1] }}
            style={{ top: menuPosition.top, left: menuPosition.left, width: menuPosition.width }}
            className="fixed z-50 origin-top-right overflow-hidden rounded-2xl border border-black/[0.08] bg-white shadow-[0_12px_38px_rgba(35,39,54,0.13),0_2px_8px_rgba(15,23,42,0.05)]"
          >
            <div className="border-b border-black/[0.05] px-4 py-3">
              <p className="text-[13px] font-semibold tracking-[-0.01em] text-[#303030]">Conversas anteriores</p>
            </div>

            <div className="max-h-[min(360px,50vh)] overflow-y-auto overscroll-contain py-1.5">
              {isLoading && (
                <p className="px-4 py-6 text-center text-[12.5px] text-[#8A8A8A]">Carregando conversas…</p>
              )}

              {!isLoading && threadsQuery.isError && (
                <p className="px-4 py-6 text-center text-[12.5px] text-rose-600">
                  Não foi possível carregar seu histórico.
                </p>
              )}

              {!isLoading && !threadsQuery.isError && threads.length === 0 && (
                <p className="px-4 py-6 text-center text-[12.5px] leading-5 text-[#8A8A8A]">
                  Suas conversas com o Atlas aparecerão aqui.
                </p>
              )}

              {threads.map((thread) => {
                const isActive = thread.id === activeThreadId;
                return (
                  <div
                    key={thread.id}
                    className={`group mx-1.5 flex items-center gap-2 rounded-xl transition-colors ${
                      isActive ? "bg-[#F5F1FF]" : "hover:bg-black/[0.035]"
                    }`}
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => handleSelect(thread.id)}
                      className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4A0FA6]/20"
                    >
                      <MessageSquare
                        className={`h-4 w-4 shrink-0 ${isActive ? "text-[#351078]" : "text-[#9A9A9A]"}`}
                        strokeWidth={1.8}
                      />
                      <span className="min-w-0 flex-1">
                        <span
                          className={`block truncate text-[13px] leading-5 ${
                            isActive ? "font-semibold text-[#351078]" : "text-[#303030]"
                          }`}
                        >
                          {thread.title || "Nova conversa"}
                        </span>
                        <span className="block text-[11px] leading-4 text-[#9A9A9A]">
                          {formatThreadDate(thread.updated_at)}
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDelete(thread)}
                      className="mr-1.5 grid h-8 w-8 shrink-0 place-items-center rounded-full text-[#9A9A9A] opacity-0 transition-[opacity,color,background-color] hover:bg-rose-50 hover:text-rose-600 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4A0FA6]/20 group-hover:opacity-100"
                      aria-label={`Apagar conversa ${thread.title || "sem título"}`}
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={1.8} />
                    </button>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !deleteMutation.isPending) setPendingDelete(null);
        }}
      >
        <AlertDialogContent className="max-w-[420px] rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[16px] text-[#252525]">Apagar esta conversa?</AlertDialogTitle>
            <AlertDialogDescription className="text-[13.5px] leading-6 text-[#6A6A6A]">
              “{pendingDelete?.title || "Nova conversa"}” e todas as mensagens dela serão removidas
              definitivamente. Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending} className="rounded-full">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (pendingDelete) deleteMutation.mutate(pendingDelete);
              }}
              className="rounded-full bg-rose-600 text-white hover:bg-rose-700"
            >
              {deleteMutation.isPending ? "Apagando…" : "Apagar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AtlasHistoryMenu;
