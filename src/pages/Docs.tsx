import { useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeCheck,
  Heart,
  Image as ImageIcon,
  MessageCircle,
  MoreHorizontal,
  Pencil,
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
} from "@/hooks/useHelpFeed";

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


/** Data curta para o feed: relativa na primeira semana, depois "8 de ago.". */
function postDate(iso: string): string {
  const date = new Date(iso);
  const days = (Date.now() - date.getTime()) / 86_400_000;
  if (days < 7) {
    const rel = timeAgo(iso);
    return rel.endsWith("s") ? "agora" : `há ${rel}`;
  }
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString("pt-BR", { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) });
}

/**
 * Os avisos costumam abrir com uma linha de título ("📢 Atualização Velo…").
 * Quando a primeira linha é curta e há texto depois, ela vira o título do card.
 */
function splitPost(content: string): { titulo: string | null; corpo: string } {
  const trimmed = content.trim();
  const quebra = trimmed.indexOf("\n");
  if (quebra === -1) return { titulo: null, corpo: trimmed };
  const primeira = trimmed.slice(0, quebra).trim();
  const resto = trimmed.slice(quebra + 1).trim();
  if (!resto || primeira.length > 120) return { titulo: null, corpo: trimmed };
  return { titulo: primeira, corpo: resto };
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
    <div className="mt-[12px] border-t border-black/[0.06] pt-[12px]">
      {loading ? (
        <p className="text-[13px] text-[#8A8A8A]">Carregando comentários…</p>
      ) : comments.length === 0 ? (
        <p className="text-[13px] text-[#8A8A8A]">Seja o primeiro a comentar.</p>
      ) : (
        <ul className="space-y-[12px]">
          {comments.map((c) => (
            <li key={c.id} className="flex gap-[10px]">
              <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center overflow-hidden rounded-full border border-black/[0.08] bg-[#EDEDEA] text-[#6B6B66]">
                {c.author_avatar ? (
                  <img src={c.author_avatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  <UserRound className="h-3.5 w-3.5" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-[6px]">
                  <strong className="text-[13px] font-semibold text-[#0A0A0A]">{c.author_name}</strong>
                  <span className="text-[12px] text-[#9A9A94]">{timeAgo(c.created_at)}</span>
                </div>
                <p className="mt-[2px] whitespace-pre-line text-[13.5px] leading-[1.55] text-[#4B4B46]">{c.content}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {canPost && (
        <div className="mt-[12px] flex items-start gap-[8px]">
          <textarea
            value={draft}
            maxLength={500}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Escreva um comentário…"
            className="min-h-[36px] flex-1 resize-none rounded-[9px] border border-transparent bg-black/[0.04] px-[12px] py-[8px] text-[13.5px] text-[#0A0A0A] outline-none transition-colors placeholder:text-[#8A8A8A] focus:border-[#2563EB]/40"
            rows={1}
          />
          <button
            onClick={submit}
            disabled={sending || !draft.trim()}
            className="h-[36px] rounded-[9px] bg-[#2563EB] px-[14px] text-[13px] font-semibold text-white transition-colors hover:bg-[#1D4ED8] disabled:opacity-50"
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
  const [expanded, setExpanded] = useState(false);

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

  const { titulo, corpo } = splitPost(post.content ?? "");
  const paragrafos = corpo.split(/\n\s*\n/).filter((t) => t.trim());
  const longo = corpo.length > 280 || paragrafos.length > 3;

  return (
    <article className="border-b border-black/[0.07] pb-[10px] pt-[18px] last:border-b-0">
      <header className="relative flex items-center gap-[10px]">
        <span className="h-[32px] w-[32px] shrink-0 overflow-hidden rounded-full border border-black/[0.08] bg-[#EDEDEA]">
          {post.author_avatar ? (
            <img src={post.author_avatar} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-[#6B6B66]">
              <UserRound className="h-4 w-4" />
            </span>
          )}
        </span>
        <div className="flex min-w-0 items-center gap-[5px]">
          <strong className="truncate text-[13.5px] font-semibold text-[#0A0A0A]">{post.author_name}</strong>
          <BadgeCheck className="h-[15px] w-[15px] shrink-0 fill-[#2563EB] text-white" strokeWidth={2.2} aria-label="Conta verificada" />
          <span className="text-[12.5px] text-[#9A9A94]" aria-hidden>·</span>
          <time
            dateTime={post.created_at}
            title={new Date(post.created_at).toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short" })}
            className="shrink-0 text-[12.5px] text-[#9A9A94]"
          >
            {postDate(post.created_at)}
          </time>
        </div>
        {isAdmin && (
          <div className="relative ml-auto">
            <button
              onClick={() => setShowAdminMenu((value) => !value)}
              aria-label="Opções da publicação"
              className="flex h-[28px] w-[28px] items-center justify-center rounded-full text-[#8A8A8A] transition hover:bg-black/[0.05] hover:text-[#0A0A0A]"
            >
              <MoreHorizontal className="h-[17px] w-[17px]" />
            </button>
            {showAdminMenu && (
              <div className="absolute right-0 top-[32px] z-30 w-[150px] overflow-hidden rounded-[10px] border border-black/[0.08] bg-white p-[5px] shadow-[0_12px_32px_rgba(0,0,0,0.12)]">
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
                        className="flex-1 rounded-[6px] bg-red-500 px-[7px] py-[6px] text-[11px] font-semibold text-white disabled:opacity-50"
                      >
                        {saving ? "Excluindo…" : "Excluir"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => { setEditing(true); setShowAdminMenu(false); }}
                      className="flex w-full items-center gap-[9px] rounded-[7px] px-[10px] py-[7px] text-left text-[13px] font-medium text-[#0A0A0A] hover:bg-black/[0.05]"
                    >
                      <Pencil className="h-[14px] w-[14px]" /> Editar
                    </button>
                    <button
                      onClick={() => setConfirmingDelete(true)}
                      disabled={saving}
                      className="flex w-full items-center gap-[9px] rounded-[7px] px-[10px] py-[7px] text-left text-[13px] font-medium text-red-600 hover:bg-red-500/10 disabled:opacity-50"
                    >
                      <Trash2 className="h-[14px] w-[14px]" /> Excluir
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
            className="min-h-[96px] w-full resize-y rounded-[10px] border border-transparent bg-black/[0.04] px-[12px] py-[10px] text-[14px] leading-[1.55] text-[#0A0A0A] outline-none focus:border-[#2563EB]/40"
          />
          <div className="mt-[8px] flex justify-end gap-[8px]">
            <button onClick={() => { setEditing(false); setEditDraft(post.content); }} className="rounded-[8px] bg-black/[0.05] px-[12px] py-[7px] text-[13px] font-semibold text-[#0A0A0A]">Cancelar</button>
            <button onClick={saveEdit} disabled={saving || !editDraft.trim()} className="rounded-[8px] bg-[#2563EB] px-[12px] py-[7px] text-[13px] font-semibold text-white disabled:opacity-50">{saving ? "Salvando…" : "Salvar"}</button>
          </div>
        </div>
      ) : post.content && (
        <div className="mt-[12px]">
          {titulo && (
            <h2 className="text-[15px] font-semibold leading-[1.4] tracking-[-0.01em] text-[#0A0A0A]">{titulo}</h2>
          )}
          {corpo && (
            <div
              className={`space-y-[8px] text-[14px] leading-[1.6] text-[#52524D] ${titulo ? "mt-[6px]" : ""} ${
                longo && !expanded ? "max-h-[90px] overflow-hidden" : ""
              }`}
              style={
                longo && !expanded
                  ? { maskImage: "linear-gradient(to bottom, #000 55%, transparent)", WebkitMaskImage: "linear-gradient(to bottom, #000 55%, transparent)" }
                  : undefined
              }
            >
              {paragrafos.map((paragrafo, i) => (
                <p key={i} className="whitespace-pre-line">{paragrafo}</p>
              ))}
            </div>
          )}
          {longo && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="mt-[4px] text-[13px] font-semibold text-[#2563EB] hover:text-[#1D4ED8]"
            >
              {expanded ? "Ver menos" : "Ver mais"}
            </button>
          )}
        </div>
      )}

      {post.image_signed_url && (
        <div className="mt-[12px] overflow-hidden rounded-[10px] border border-black/[0.06]">
          <img src={post.image_signed_url} alt="" loading="lazy" className="block max-h-[380px] w-full object-cover" />
        </div>
      )}

      <div className="-ml-[8px] mt-[8px] flex items-center gap-[2px]">
        <button
          onClick={() => canInteract && onLike(post.id)}
          disabled={!canInteract}
          aria-label="Curtir"
          aria-pressed={post.liked_by_me}
          className={`flex h-[30px] items-center gap-[6px] rounded-full px-[8px] transition-colors hover:bg-black/[0.04] disabled:opacity-60 ${
            post.liked_by_me ? "text-[#EF4444]" : "text-[#8A8A8A] hover:text-[#0A0A0A]"
          }`}
        >
          <Heart className={`h-[16px] w-[16px] ${post.liked_by_me ? "fill-[#EF4444]" : ""}`} strokeWidth={1.8} />
          <span className="text-[12.5px] font-medium tabular-nums">{post.likes_count}</span>
        </button>
        <button
          onClick={() => setShowComments((v) => !v)}
          aria-label="Comentar"
          aria-expanded={showComments}
          className={`flex h-[30px] items-center gap-[6px] rounded-full px-[8px] transition-colors hover:bg-black/[0.04] ${
            showComments ? "text-[#0A0A0A]" : "text-[#8A8A8A] hover:text-[#0A0A0A]"
          }`}
        >
          <MessageCircle className="h-[16px] w-[16px]" strokeWidth={1.8} />
          <span className="text-[12.5px] font-medium tabular-nums">{post.comments_count}</span>
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

export default function Docs() {
  const { user } = useAuth();
  const {
    isAdmin,
    posts,
    loading,
    error,
    toggleLike,
    loadComments,
    addComment,
    createPost,
    updatePost,
    deletePost,
  } = useHelpFeed();
  const canInteract = useMemo(() => Boolean(user), [user]);
  const [showComposer, setShowComposer] = useState(false);

  return (
    // Sem shell próprio: a página vive dentro do layout do dashboard, então a
    // sidebar da Velo, o cabeçalho e a conta continuam sendo os de sempre.
    // A página mostra só as publicações da equipe; tutoriais e guias saíram.
    <div className="min-h-full text-[#0A0A0A]">
      <div className="mx-auto w-full max-w-[680px] px-1 pb-16 sm:px-4">
        <header className="flex items-end justify-between gap-4 border-b border-black/[0.07] pb-4 pt-1">
          <div>
            <h1 className="text-[22px] font-bold tracking-[-0.03em] text-[#0A0A0A]">Comunidade</h1>
            <p className="mt-1 text-[13.5px] leading-[19px] text-[#6B6B66]">Avisos e novidades da equipe Velo.</p>
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setShowComposer((v) => !v)}
              className="shrink-0 rounded-full bg-[#2563EB] px-3.5 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-[#1D4ED8]"
            >
              {showComposer ? "Fechar" : "Publicar"}
            </button>
          )}
        </header>

        <main className="w-full min-w-0">
          {isAdmin && showComposer && (
            <Composer onSubmit={async (opts) => { await createPost(opts); setShowComposer(false); }} />
          )}

          <div className="flex flex-col pb-[20px] pt-[4px]">
            {loading ? (
              <p className="py-[40px] text-center text-[13.5px] text-[#8A8A8A]">Carregando feed…</p>
            ) : error ? (
              <p className="py-[40px] text-center text-[13.5px] text-red-600">{error}</p>
            ) : posts.length === 0 ? (
              <p className="py-[40px] text-center text-[13.5px] text-[#8A8A8A]">
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
          </div>
        </main>
      </div>
    </div>
  );
}
