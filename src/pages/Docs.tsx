import { useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeCheck,
  ChevronDown,
  Heart,
  Image as ImageIcon,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Search,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  useHelpFeed,
  type HelpFeedComment,
  type HelpFeedPost,
  type HelpFeedTutorial,
} from "@/hooks/useHelpFeed";
import { guideSections, type GuideSection } from "@/pages/help/guides";

type TabKey = "feed" | "tutorial" | GuideSection["key"];
type PaletteResult = {
  sectionKey: GuideSection["key"];
  sectionLabel: string;
  item: GuideSection["items"][number];
};

function highlight(text: string, query: string) {
  if (!query.trim()) return text;
  const q = query.trim();
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <span className="text-[#0A0A0A] font-semibold">{text.slice(idx, idx + q.length)}</span>
      {text.slice(idx + q.length)}
    </>
  );
}

function SearchPalette({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (sectionKey: GuideSection["key"], itemId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo<PaletteResult[]>(() => {
    const all: PaletteResult[] = [];
    for (const s of guideSections) {
      for (const item of s.items) {
        all.push({ sectionKey: s.key, sectionLabel: s.label, item });
      }
    }
    const q = query.trim().toLowerCase();
    if (!q) return all.slice(0, 8);
    return all
      .filter(
        (r) =>
          r.item.title.toLowerCase().includes(q) ||
          r.item.summary.toLowerCase().includes(q) ||
          r.sectionLabel.toLowerCase().includes(q) ||
          r.item.steps.some((step) => step.toLowerCase().includes(q)),
      )
      .slice(0, 10);
  }, [query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setCursor(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  useEffect(() => {
    setCursor(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowDown") {
        e.preventDefault();
        setCursor((c) => Math.min(c + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setCursor((c) => Math.max(c - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const r = results[cursor];
        if (r) onSelect(r.sectionKey, r.item.id);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, results, cursor, onClose, onSelect]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/40 px-4 pt-[10vh] backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[720px] overflow-hidden rounded-[16px] bg-[#FFFFFF] shadow-[0_30px_80px_rgba(0,0,0,0.5)]"
      >
        <div className="flex items-center gap-[14px] border-b border-black/[0.06] px-[22px]">
          <Search className="h-[20px] w-[20px] text-[#8A8A8A]" strokeWidth={1.7} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar em toda a Central de ajuda..."
            className="h-[64px] flex-1 bg-transparent text-[18px] text-[#0A0A0A] outline-none placeholder:text-[#8A8A8A]"
          />
        </div>

        <div className="max-h-[480px] overflow-y-auto py-[10px]">
          {results.length === 0 ? (
            <p className="px-[22px] py-[28px] text-center text-[15px] text-[#8A8A8A]">
              Nada encontrado para "{query}".
            </p>
          ) : (
            <ul>
              {results.map((r, i) => {
                const Icon = r.item.icon;
                const active = i === cursor;
                return (
                  <li key={`${r.sectionKey}-${r.item.id}`}>
                    <button
                      onMouseEnter={() => setCursor(i)}
                      onClick={() => onSelect(r.sectionKey, r.item.id)}
                      className={`flex w-full items-center gap-[16px] px-[22px] py-[12px] text-left transition ${
                        active ? "bg-black/[0.05]" : "hover:bg-black/[0.03]"
                      }`}
                    >
                      <span className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-[10px] bg-black/[0.04] text-[#0A0A0A]">
                        <Icon className="h-[18px] w-[18px]" strokeWidth={1.7} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[16px] font-medium text-[#3A3A36]">
                          {highlight(r.item.title, query)}
                        </p>
                        <p className="mt-[3px] truncate text-[13px] text-[#8A8A8A]">
                          {r.sectionLabel} <span className="mx-[6px]">›</span> {r.item.title}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-black/[0.06] px-[22px] py-[10px] text-[12px] text-[#8A8A8A]">
          <div className="flex items-center gap-[16px]">
            <span className="flex items-center gap-[6px]">
              <kbd className="rounded-[5px] bg-black/[0.05] px-[6px] py-[2px] font-medium text-[#6B6B66]">↑↓</kbd>
              Select
            </span>
            <span className="flex items-center gap-[6px]">
              <kbd className="rounded-[5px] bg-black/[0.05] px-[6px] py-[2px] font-medium text-[#6B6B66]">↵</kbd>
              Open
            </span>
          </div>
          <span className="flex items-center gap-[6px]">
            <kbd className="rounded-[5px] bg-black/[0.05] px-[6px] py-[2px] font-medium text-[#6B6B66]">esc</kbd>
            Close
          </span>
        </div>
      </div>
    </div>
  );
}


/**
 * Abas da área de Comunidade e Ajuda.
 *
 * Antes eram dois grupos numa sidebar própria ("Explore" e "Ajuda"). Viraram
 * uma fileira só de abas: são seis destinos, e uma segunda barra lateral
 * dentro do painel fazia a área parecer outro produto.
 */
const SECOES: Array<{ key: TabKey; label: string }> = [
  { key: "feed", label: "Novidades" },
  { key: "tutorial", label: "Tutoriais" },
  { key: "anuncios", label: "Anúncios" },
  { key: "publicacao", label: "Publicação" },
  { key: "pagamentos", label: "Pagamentos" },
  { key: "conta", label: "Conta e suporte" },
];

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.max(1, Math.round(diff / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  return `${d}d`;
}



function CommentsSection({
  post,
  canPost,
  loadComments,
  addComment,
}: {
  post: HelpFeedPost;
  canPost: boolean;
  loadComments: (postId: string) => Promise<HelpFeedComment[]>;
  addComment: (postId: string, content: string) => Promise<void>;
}) {

  const [comments, setComments] = useState<HelpFeedComment[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadComments(post.id)
      .then((rows) => {
        if (!cancelled) setComments(rows);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [post.id, loadComments, post.comments_count]);

  const submit = async () => {
    if (!draft.trim() || sending) return;
    setSending(true);
    try {
      await addComment(post.id, draft);
      setDraft("");
      const rows = await loadComments(post.id);
      setComments(rows);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao comentar");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mt-[16px] rounded-[14px] border border-black/[0.06] bg-[#FFFFFF] p-[16px]">
      {loading ? (
        <p className="text-[15px] text-[#8A8A8A]">Carregando comentários…</p>
      ) : comments.length === 0 ? (
        <p className="text-[15px] text-[#8A8A8A]">Seja o primeiro a comentar.</p>
      ) : (
        <ul className="space-y-[14px]">
          {comments.map((c) => (
            <li key={c.id} className="flex gap-[12px]">
              <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center overflow-hidden rounded-[9px] border border-black/[0.08] bg-[#EDEDEA] text-[#6B6B66]">
                {c.author_avatar ? (
                  <img src={c.author_avatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  <UserRound className="h-4 w-4" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-[8px]">
                  <strong className="text-[15px] font-semibold text-[#0A0A0A]">{c.author_name}</strong>
                  <span className="text-[14px] text-[#8A8A8A]">{timeAgo(c.created_at)}</span>
                </div>
                <p className="mt-[4px] whitespace-pre-line text-[15px] leading-[1.5] text-[#4B4B46]">{c.content}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {canPost && (
        <div className="mt-[14px] flex items-start gap-[10px]">
          <textarea
            value={draft}
            maxLength={500}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Escreva um comentário…"
            className="min-h-[42px] flex-1 resize-none rounded-[9px] border-0 bg-[#F1F1EE] px-[14px] py-[10px] text-[15px] text-[#0A0A0A] outline-none placeholder:text-[#8A8A8A]"
            rows={1}
          />
          <button
            onClick={submit}
            disabled={sending || !draft.trim()}
            className="h-[42px] rounded-[10px] bg-[#2563EB] px-[16px] text-[15px] font-semibold text-[#0A0A0A] disabled:opacity-50"
          >
            {sending ? "Enviando…" : "Enviar"}
          </button>
        </div>
      )}
    </div>
  );
}

function Post({
  post,
  canInteract,
  isAdmin,
  onLike,
  loadComments,
  addComment,
  updatePost,
  deletePost,
}: {
  post: HelpFeedPost;
  canInteract: boolean;
  isAdmin: boolean;
  onLike: (id: string) => void;
  loadComments: (postId: string) => Promise<HelpFeedComment[]>;
  addComment: (postId: string, content: string) => Promise<void>;
  updatePost: (postId: string, content: string) => Promise<void>;
  deletePost: (postId: string) => Promise<void>;
}) {
  const [showComments, setShowComments] = useState(false);
  const [showAdminMenu, setShowAdminMenu] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState(post.content);
  const [saving, setSaving] = useState(false);

  const saveEdit = async () => {
    if (!editDraft.trim() || saving) return;
    setSaving(true);
    try {
      await updatePost(post.id, editDraft);
      setEditing(false);
      setShowAdminMenu(false);
      toast.success("Publicação atualizada.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao editar publicação");
    } finally {
      setSaving(false);
    }
  };

  const removePost = async () => {
    setSaving(true);
    try {
      await deletePost(post.id);
      toast.success("Publicação excluída.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao excluir publicação");
      setSaving(false);
    }
  };

  return (
    <article className="border-b border-black/[0.07] py-[24px]">
      <div className="flex gap-[18px]">
        <span className="h-[42px] w-[42px] shrink-0 overflow-hidden rounded-[10px] border border-black/[0.08] bg-[#EDEDEA]">
          {post.author_avatar ? (
            <img src={post.author_avatar} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-[#6B6B66]">
              <UserRound className="h-5 w-5" />
            </span>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <header className="relative flex flex-wrap items-center gap-[8px]">
            <strong className="text-[18px] font-semibold leading-none text-[#0A0A0A]">{post.author_name}</strong>
            <BadgeCheck className="h-[20px] w-[20px] fill-white text-[#FBFBFA]" strokeWidth={2.2} aria-label="Conta verificada" />
            <span className="text-[16.5px] font-medium text-[#8A8A8A]">{timeAgo(post.created_at)}</span>
            {isAdmin && (
              <div className="relative ml-auto">
                <button
                  onClick={() => setShowAdminMenu((value) => !value)}
                  aria-label="Opções da publicação"
                  className="flex h-[30px] w-[30px] items-center justify-center rounded-full text-[#8A8A8A] transition hover:bg-black/[0.05] hover:text-[#0A0A0A]"
                >
                  <MoreHorizontal className="h-[19px] w-[19px]" />
                </button>
                {showAdminMenu && (
                  <div className="absolute right-0 top-[34px] z-30 w-[150px] overflow-hidden rounded-[10px] border border-black/[0.08] bg-[#F5F5F2] p-[5px] shadow-2xl">
                    {confirmingDelete ? (
                      <div className="p-[7px]">
                        <p className="text-[12px] font-medium leading-[1.35] text-[#0A0A0A]">Excluir esta publicação?</p>
                        <p className="mt-[3px] text-[11px] leading-[1.35] text-[#6B6B66]">Esta ação não pode ser desfeita.</p>
                        <div className="mt-[9px] flex gap-[6px]">
                          <button
                            onClick={() => setConfirmingDelete(false)}
                            disabled={saving}
                            className="flex-1 rounded-[6px] bg-black/[0.05] px-[7px] py-[6px] text-[11px] font-semibold text-[#0A0A0A] disabled:opacity-50"
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={removePost}
                            disabled={saving}
                            className="flex-1 rounded-[6px] bg-red-500 px-[7px] py-[6px] text-[11px] font-semibold text-[#0A0A0A] disabled:opacity-50"
                          >
                            {saving ? "Excluindo…" : "Excluir"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => { setEditing(true); setShowAdminMenu(false); }}
                          className="flex w-full items-center gap-[9px] rounded-[7px] px-[10px] py-[8px] text-left text-[14px] font-medium text-[#0A0A0A] hover:bg-black/[0.05]"
                        >
                          <Pencil className="h-[15px] w-[15px]" /> Editar
                        </button>
                        <button
                          onClick={() => setConfirmingDelete(true)}
                          disabled={saving}
                          className="flex w-full items-center gap-[9px] rounded-[7px] px-[10px] py-[8px] text-left text-[14px] font-medium text-red-600 hover:bg-red-500/10 disabled:opacity-50"
                        >
                          <Trash2 className="h-[15px] w-[15px]" /> Excluir
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </header>
          {editing ? (
            <div className="mt-[12px]">
              <textarea
                value={editDraft}
                maxLength={2000}
                onChange={(event) => setEditDraft(event.target.value)}
                className="min-h-[96px] w-full resize-y rounded-[10px] border border-black/[0.08] bg-[#FFFFFF] px-[13px] py-[11px] text-[16px] leading-[1.5] text-[#0A0A0A] outline-none focus:border-white/20"
              />
              <div className="mt-[9px] flex justify-end gap-[8px]">
                <button onClick={() => { setEditing(false); setEditDraft(post.content); }} className="rounded-[8px] bg-[#EDEDEA] px-[13px] py-[8px] text-[14px] font-semibold text-[#0A0A0A]">Cancelar</button>
                <button onClick={saveEdit} disabled={saving || !editDraft.trim()} className="rounded-[8px] bg-[#2563EB] px-[13px] py-[8px] text-[14px] font-semibold text-[#0A0A0A] disabled:opacity-50">{saving ? "Salvando…" : "Salvar"}</button>
              </div>
            </div>
          ) : post.content && (
            <p className="mt-[12px] whitespace-pre-line text-[18px] font-medium leading-[1.6] text-[#4B4B46]">
              {post.content}
            </p>
          )}

          {post.image_signed_url && (
            <div className="relative mt-[16px] overflow-hidden rounded-[14px] border border-black/[0.08]">
              <img src={post.image_signed_url} alt="" className="block w-full max-h-[560px] object-cover" />
            </div>
          )}


          <div className="mt-[19px] flex items-center gap-[25px]">
            <button
              onClick={() => canInteract && onLike(post.id)}
              disabled={!canInteract}
              aria-label="Curtir"
              className="flex items-center gap-[8px] text-[#8A8A8A] transition hover:text-[#0A0A0A] disabled:opacity-60"
            >
              <Heart
                className={`h-[21px] w-[21px] ${post.liked_by_me ? "fill-white text-[#0A0A0A]" : ""}`}
                strokeWidth={1.7}
              />
              <span className="text-[15px] font-medium">{post.likes_count}</span>
            </button>
            <button
              onClick={() => setShowComments((v) => !v)}
              aria-label="Comentar"
              className="flex items-center gap-[8px] text-[#8A8A8A] transition hover:text-[#0A0A0A]"
            >
              <MessageCircle className="h-[21px] w-[21px]" strokeWidth={1.7} />
              <span className="text-[15px] font-medium">{post.comments_count}</span>
            </button>
          </div>

          {showComments && (
            <CommentsSection
              post={post}
              canPost={canInteract}
              loadComments={loadComments}
              addComment={addComment}
            />
          )}
        </div>
      </div>
    </article>
  );
}

function Composer({
  onSubmit,
}: {
  onSubmit: (opts: { content: string; file?: File | null }) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = (f: File | null) => {
    if (!f) {
      setFile(null);
      setPreview(null);
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) {
      toast.error("Formato inválido. Use JPEG, PNG ou WebP.");
      return;
    }
    if (f.size > 8 * 1024 * 1024) {
      toast.error("Imagem acima de 8 MB.");
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const submit = async () => {
    if (busy) return;
    if (!text.trim() && !file) {
      toast.error("Escreva algo ou anexe uma imagem.");
      return;
    }
    setBusy(true);
    try {
      await onSubmit({ content: text, file });
      setText("");
      setFile(null);
      if (preview) URL.revokeObjectURL(preview);
      setPreview(null);
      toast.success("Publicado!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao publicar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pb-[20px] pl-[158px] pr-[28px] pt-[20px]">
      <div className="flex items-start gap-[20px]">
        <span className="flex h-[42px] w-[42px] items-center justify-center rounded-[10px] border border-black/[0.08] bg-[#EDEDEA] text-[#6B6B66]">
          <UserRound className="h-[20px] w-[20px]" />
        </span>
        <div className="flex-1">
          <textarea
            value={text}
            maxLength={2000}
            onChange={(e) => setText(e.target.value)}
            placeholder="Compartilhe algo com a comunidade..."
            className="w-full resize-none border-b border-black/[0.07] bg-transparent pb-[10px] text-[16px] font-medium leading-[1.55] text-[#0A0A0A] outline-none placeholder:text-[#8A8A8A]"
            rows={2}
          />
          {preview && (
            <div className="mt-[14px] relative inline-block">
              <img
                src={preview}
                alt=""
                className="max-h-[240px] rounded-[12px] border border-black/[0.07] object-cover"
              />
              <button
                onClick={() => pick(null)}
                className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-[#F1F1EE] text-[#0A0A0A] shadow"
                aria-label="Remover imagem"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          <div className="mt-[14px] flex items-center gap-[12px]">
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => pick(e.target.files?.[0] ?? null)}
            />
            <button
              onClick={() => inputRef.current?.click()}
              className="flex items-center gap-[8px] rounded-[9px] bg-[#F1F1EE] px-[14px] py-[9px] text-[15px] font-medium text-[#4B4B46]"
            >
              <ImageIcon className="h-4 w-4" /> {file ? "Trocar imagem" : "Adicionar imagem"}
            </button>
            <div className="ml-auto flex items-center gap-[10px]">
              <span className="text-[13px] text-[#8A8A8A]">{text.length}/2000</span>
              <button
                onClick={submit}
                disabled={busy || (!text.trim() && !file)}
                className="rounded-[10px] bg-[#2563EB] px-[19px] py-[10px] text-[15px] font-semibold text-[#0A0A0A] disabled:opacity-50"
              >
                {busy ? "Publicando…" : "Publicar"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TutorialAdminForm({
  onSubmit,
}: {
  onSubmit: (title: string, body: string) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="mb-[24px] rounded-[16px] border border-black/[0.07] bg-[#FFFFFF] p-[18px]">
      <h3 className="text-[16px] font-semibold text-[#0A0A0A]">Novo tutorial</h3>
      <input
        value={title}
        maxLength={160}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Título"
        className="mt-[12px] h-[42px] w-full rounded-[9px] border-0 bg-[#F1F1EE] px-[14px] text-[15px] text-[#0A0A0A] outline-none placeholder:text-[#8A8A8A]"
      />
      <textarea
        value={body}
        maxLength={8000}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Conteúdo (Markdown suportado)"
        className="mt-[10px] min-h-[120px] w-full resize-none rounded-[9px] border-0 bg-[#F1F1EE] px-[14px] py-[10px] text-[15px] text-[#0A0A0A] outline-none placeholder:text-[#8A8A8A]"
      />
      <div className="mt-[12px] flex justify-end">
        <button
          onClick={async () => {
            if (busy) return;
            setBusy(true);
            try {
              await onSubmit(title, body);
              setTitle("");
              setBody("");
              toast.success("Tutorial publicado!");
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Erro ao publicar");
            } finally {
              setBusy(false);
            }
          }}
          disabled={busy || !title.trim() || !body.trim()}
          className="rounded-[10px] bg-[#2563EB] px-[19px] py-[10px] text-[15px] font-semibold text-[#0A0A0A] disabled:opacity-50"
        >
          {busy ? "Publicando…" : "Publicar tutorial"}
        </button>
      </div>
    </div>
  );
}

function TutorialList({ tutorials }: { tutorials: HelpFeedTutorial[] }) {
  if (tutorials.length === 0) {
    return <p className="py-[40px] text-center text-[15px] text-[#8A8A8A]">Nenhum tutorial publicado ainda.</p>;
  }
  return (
    <ul className="space-y-[16px]">
      {tutorials.map((t) => (
        <li key={t.id} className="rounded-[16px] border border-black/[0.07] bg-[#FFFFFF] p-[20px]">
          <h3 className="text-[18px] font-semibold text-[#0A0A0A]">{t.title}</h3>
          <p className="mt-[10px] whitespace-pre-line text-[15px] leading-[1.6] text-[#4B4B46]">{t.body_md}</p>
          <p className="mt-[10px] text-[13px] text-[#8A8A8A]">{timeAgo(t.created_at)} atrás</p>
        </li>
      ))}
    </ul>
  );
}


function GuidesView({
  sectionKey,
  activeId,
  setActiveId,
}: {
  sectionKey: TabKey;
  activeId: string | null;
  setActiveId: (id: string | null) => void;
}) {
  const section = guideSections.find((s) => s.key === sectionKey);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!section) return [];
    const q = query.trim().toLowerCase();
    if (!q) return section.items;
    return section.items.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.summary.toLowerCase().includes(q) ||
        item.steps.some((s) => s.toLowerCase().includes(q)),
    );
  }, [section, query]);

  const active = useMemo(
    () => (activeId ? section?.items.find((i) => i.id === activeId) ?? null : null),
    [section, activeId],
  );

  if (!section) return null;

  if (active) {
    const Icon = active.icon;
    return (
      <div className="pb-[80px] pt-[36px]">
        <button
          onClick={() => setActiveId(null)}
          className="mb-[28px] flex items-center gap-[8px] text-[18px] font-medium text-[#8A8A8A] transition hover:text-[#0A0A0A]"
        >
          <ChevronDown className="h-[18px] w-[18px] rotate-90" />
          Voltar para {section.label}
        </button>

        <div className="mx-auto max-w-[900px]">
          <div className="flex items-center gap-[14px]">
            <span className="flex h-[64px] w-[64px] items-center justify-center rounded-[16px] bg-black/[0.035] text-[#0A0A0A]">
              <Icon className="h-[30px] w-[30px]" strokeWidth={1.7} />
            </span>
            <span className="text-[14px] font-semibold uppercase tracking-[0.16em] text-[#6B6B66]">
              {section.label}
            </span>
          </div>

          <h1 className="mt-[26px] text-[52px] font-semibold leading-[1.05] tracking-[-0.02em] text-[#0A0A0A]">
            {active.title}
          </h1>
          <p className="mt-[18px] text-[22px] leading-[1.55] text-[#6B6B66]">{active.summary}</p>

          <div className="mt-[44px]">
            <h2 className="text-[16px] font-semibold uppercase tracking-[0.16em] text-[#8A8A8A]">
              Passo a passo
            </h2>
            <ol className="mt-[20px] space-y-[16px]">
              {active.steps.map((step, i) => (
                <li key={i} className="flex gap-[20px] rounded-[16px] bg-[#FFFFFF] px-[22px] py-[20px]">
                  <span className="flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-full bg-white text-[16px] font-bold text-black">
                    {i + 1}
                  </span>
                  <p className="text-[19px] leading-[1.6] text-[#3A3A36]">{step}</p>
                </li>
              ))}
            </ol>
          </div>

          {active.tip && (
            <div className="mt-[32px] rounded-[16px] bg-[#FFFFFF] p-[22px]">
              <p className="text-[14px] font-semibold uppercase tracking-[0.14em] text-[#0A0A0A]/70">Dica</p>
              <p className="mt-[10px] text-[19px] leading-[1.6] text-[#3A3A36]">{active.tip}</p>
            </div>
          )}

          <div className="mt-[44px] flex flex-col gap-[14px] rounded-[18px] bg-[#FFFFFF] p-[26px] sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[20px] font-semibold text-[#0A0A0A]">Ainda com dúvida?</p>
              <p className="mt-[6px] text-[17px] text-[#8A8A8A]">Fale com o suporte humano em Suporte → Novo chamado.</p>
            </div>
            <button
              onClick={() => setActiveId(null)}
              className="rounded-[10px] bg-white px-[22px] py-[12px] text-[17px] font-semibold text-black transition hover:opacity-90"
            >
              Ver outros guias
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-[80px]">
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[420px] opacity-60"
          style={{
            background:
              "radial-gradient(ellipse 60% 80% at 50% 0%, rgba(255,255,255,0.08), rgba(255,255,255,0) 60%)",
          }}
        />
        <div className="relative mx-auto max-w-[960px] px-[24px] pb-[64px] pt-[72px] text-center">
          <span className="inline-flex items-center gap-[8px] text-[14px] font-semibold uppercase tracking-[0.18em] text-[#8A8A8A]">
            Central de ajuda · {section.label}
          </span>
          <h1 className="mt-[24px] text-[62px] font-semibold leading-[1.02] tracking-[-0.025em] text-[#0A0A0A] sm:text-[72px]">
            {section.headline ?? "Como podemos te ajudar?"}
          </h1>
          <p className="mx-auto mt-[22px] max-w-[640px] text-[21px] leading-[1.55] text-[#6B6B66]">
            {section.intro}
          </p>

          <label className="relative mx-auto mt-[36px] block max-w-[640px]">
            <Search className="absolute left-[22px] top-1/2 h-[22px] w-[22px] -translate-y-1/2 text-[#8A8A8A]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Descreva o problema..."
              className="h-[64px] w-full rounded-[16px] bg-[#FFFFFF] pl-[58px] pr-[18px] text-[19px] text-[#0A0A0A] outline-none transition placeholder:text-[#8A8A8A] focus:bg-[#FFFFFF]"
            />
          </label>

          {section.quickTopics && section.quickTopics.length > 0 && (
            <div className="mt-[22px] flex flex-wrap justify-center gap-[10px]">
              {section.quickTopics.map((t) => (
                <button
                  key={t}
                  onClick={() => setQuery(t)}
                  className="rounded-full bg-black/[0.035] px-[18px] py-[9px] text-[15px] font-medium text-[#6B6B66] transition hover:bg-black/[0.06] hover:text-[#0A0A0A]"
                >
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-[1080px] px-[24px] pt-[24px]">
        <div className="mb-[24px] flex items-baseline justify-between">
          <h2 className="text-[17px] font-semibold uppercase tracking-[0.16em] text-[#8A8A8A]">
            {query.trim() ? "Resultados" : "Guias populares"}
          </h2>
          <span className="text-[15px] text-[#8A8A8A]">{filtered.length} guias</span>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-[18px] bg-[#FFFFFF] p-[40px] text-center">
            <p className="text-[19px] font-semibold text-[#0A0A0A]">Nada encontrado para "{query}"</p>
            <p className="mt-[10px] text-[16px] text-[#8A8A8A]">
              Tente outra palavra ou abra um chamado no Suporte — respondemos em algumas horas.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-[16px] sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveId(item.id)}
                  className="group relative overflow-hidden rounded-[18px] bg-[#FFFFFF] p-[26px] text-left transition hover:bg-[#FFFFFF]"
                >
                  <span className="mb-[18px] flex h-[44px] w-[44px] items-center justify-center rounded-[12px] bg-black/[0.04] text-[#0A0A0A]">
                    <Icon className="h-[22px] w-[22px]" strokeWidth={1.7} />
                  </span>
                  <h3 className="text-[20px] font-semibold leading-[1.3] text-[#0A0A0A]">{item.title}</h3>
                  <p className="mt-[10px] text-[16px] leading-[1.55] text-[#8A8A8A]">{item.summary}</p>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}


export default function Docs() {

  const { user } = useAuth();
  const {
    isAdmin,
    posts,
    tutorials,
    loading,
    error,
    toggleLike,
    loadComments,
    addComment,
    createPost,
    updatePost,
    deletePost,
    createTutorial,
  } = useHelpFeed();
  const [tab, setTab] = useState<TabKey>("feed");
  const [activeGuideId, setActiveGuideId] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const canInteract = useMemo(() => Boolean(user), [user]);

  const [showComposer, setShowComposer] = useState(false);


  return (
    // Sem shell próprio: a página vive dentro do layout do dashboard, então a
    // sidebar da Velo, o cabeçalho e a conta continuam sendo os de sempre. O
    // `zoom: 0.71` e a altura em `140.845071vh` saíram junto — eram gambiarra
    // para encaixar um layout que não era o da Velo.
    <div className="min-h-full text-[#0A0A0A]">
      <div className="mx-auto w-full max-w-[860px] px-1 pb-16 sm:px-4">
        <header className="pt-1">
          <h1 className="text-[22px] font-bold tracking-[-0.03em] text-[#0A0A0A]">Comunidade e Ajuda</h1>
          <p className="mt-1 text-[13.5px] leading-[19px] text-[#6B6B66]">
            Avisos da equipe, tutoriais e respostas para as dúvidas mais comuns.
          </p>

          {/* Navegação em abas no topo, no lugar da segunda sidebar. Uma
              sidebar dentro de outra fazia a área parecer um site à parte. */}
          <div className="mt-4 flex items-center gap-2 overflow-x-auto border-b border-black/[0.07] pb-px velo-scroll-oculto">
            {SECOES.map((secao) => {
              const ativa = tab === secao.key;
              return (
                <button
                  key={secao.key}
                  type="button"
                  onClick={() => {
                    setTab(secao.key);
                    setActiveGuideId(null);
                  }}
                  className={`-mb-px shrink-0 whitespace-nowrap border-b-2 px-2.5 pb-2.5 pt-1 text-[13px] font-semibold transition-colors ${
                    ativa
                      ? "border-[#2563EB] text-[#0A0A0A]"
                      : "border-transparent text-[#8A8A8A] hover:text-[#0A0A0A]"
                  }`}
                >
                  {secao.label}
                </button>
              );
            })}
            <div className="ml-auto flex shrink-0 items-center gap-2 pb-1.5">
              <button
                type="button"
                onClick={() => setPaletteOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.08] bg-white px-3 py-1.5 text-[12px] font-medium text-[#6B6B66] transition-colors hover:bg-[#F7F7F5]"
              >
                <Search className="h-3.5 w-3.5" strokeWidth={2} />
                Buscar
                <kbd className="rounded bg-black/[0.05] px-1.5 py-0.5 text-[10.5px] font-medium">Ctrl K</kbd>
              </button>
              {isAdmin && tab === "feed" && (
                <button
                  type="button"
                  onClick={() => setShowComposer((v) => !v)}
                  className="rounded-full bg-[#2563EB] px-3.5 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-[#1D4ED8]"
                >
                  {showComposer ? "Fechar" : "Publicar"}
                </button>
              )}
            </div>
          </div>
        </header>

          <div className="flex flex-1 min-h-0 w-full">
            {(tab === "feed" || tab === "tutorial") ? (
              <>
                <main className="w-full min-w-0">
                  {tab === "feed" && isAdmin && showComposer && <Composer onSubmit={async (opts) => { await createPost(opts); setShowComposer(false); }} />}

                  <div className="relative mx-auto max-w-[720px] px-[24px]">
                    {tab === "feed" && (
                      <>
                        {loading ? (
                          <p className="py-[40px] text-center text-[15px] text-[#8A8A8A]">Carregando feed…</p>
                        ) : error ? (
                          <p className="py-[40px] text-center text-[15px] text-red-600">{error}</p>
                        ) : posts.length === 0 ? (
                          <p className="py-[40px] text-center text-[15px] text-[#8A8A8A]">
                            Ainda não há publicações. {isAdmin ? "Seja o primeiro a publicar!" : "Volte em breve."}
                          </p>
                        ) : (
                          posts.map((p) => (
                            <Post
                              key={p.id}
                              post={p}
                              canInteract={canInteract}
                              isAdmin={isAdmin}
                              onLike={toggleLike}
                              loadComments={loadComments}
                              addComment={addComment}
                              updatePost={updatePost}
                              deletePost={deletePost}
                            />
                          ))
                        )}
                      </>
                    )}

                    {tab === "tutorial" && (
                      <div className="py-[24px]">
                        {isAdmin && <TutorialAdminForm onSubmit={createTutorial} />}
                        <TutorialList tutorials={tutorials} />
                      </div>
                    )}
                  </div>
                </main>
              </>
            ) : (
              <main className="w-full min-w-0 flex-1">
                <GuidesView sectionKey={tab} activeId={activeGuideId} setActiveId={setActiveGuideId} />
              </main>
            )}
          </div>
      </div>

      <SearchPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onSelect={(sectionKey, itemId) => {
          setTab(sectionKey);
          setActiveGuideId(itemId);
          setPaletteOpen(false);
        }}
      />
    </div>
  );
}
