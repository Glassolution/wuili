import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowLeft,
  BadgeCheck,
  BookOpen,
  ChevronDown,
  GalleryHorizontalEnd,
  Heart,
  Image as ImageIcon,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Search,
  Trash2,
  UserRound,
  Users,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/lib/profileContext";
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
      <span className="text-white font-semibold">{text.slice(idx, idx + q.length)}</span>
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
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/70 px-4 pt-[10vh] backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[720px] overflow-hidden rounded-[16px] bg-[#141416] shadow-[0_30px_80px_rgba(0,0,0,0.5)]"
      >
        <div className="flex items-center gap-[14px] border-b border-white/[0.06] px-[22px]">
          <Search className="h-[20px] w-[20px] text-[#8b8b90]" strokeWidth={1.7} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar em toda a Central de ajuda..."
            className="h-[64px] flex-1 bg-transparent text-[18px] text-white outline-none placeholder:text-[#67676c]"
          />
        </div>

        <div className="max-h-[480px] overflow-y-auto py-[10px]">
          {results.length === 0 ? (
            <p className="px-[22px] py-[28px] text-center text-[15px] text-[#67676c]">
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
                        active ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"
                      }`}
                    >
                      <span className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-[10px] bg-white/[0.05] text-white">
                        <Icon className="h-[18px] w-[18px]" strokeWidth={1.7} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[16px] font-medium text-[#d5d5d8]">
                          {highlight(r.item.title, query)}
                        </p>
                        <p className="mt-[3px] truncate text-[13px] text-[#67676c]">
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

        <div className="flex items-center justify-between border-t border-white/[0.06] px-[22px] py-[10px] text-[12px] text-[#67676c]">
          <div className="flex items-center gap-[16px]">
            <span className="flex items-center gap-[6px]">
              <kbd className="rounded-[5px] bg-white/[0.06] px-[6px] py-[2px] font-medium text-[#a5a5aa]">↑↓</kbd>
              Select
            </span>
            <span className="flex items-center gap-[6px]">
              <kbd className="rounded-[5px] bg-white/[0.06] px-[6px] py-[2px] font-medium text-[#a5a5aa]">↵</kbd>
              Open
            </span>
          </div>
          <span className="flex items-center gap-[6px]">
            <kbd className="rounded-[5px] bg-white/[0.06] px-[6px] py-[2px] font-medium text-[#a5a5aa]">esc</kbd>
            Close
          </span>
        </div>
      </div>
    </div>
  );
}


const suggestions = [
  { name: "N!nh™ Studio", handle: "@ninhstudio", avatar: "n2" },
  { name: "Muhammed Farouk", handle: "@muhammed-farouk", avatar: "https://i.pravatar.cc/80?img=11" },
  { name: "Andreu", handle: "@andreu", avatar: "https://i.pravatar.cc/80?img=68" },
  { name: "Mara Furqaan", handle: "@factortheme", avatar: "https://i.pravatar.cc/80?img=53" },
  { name: "Michael Andreuzza", handle: "@michael-andreuzza", avatar: "https://i.pravatar.cc/80?img=5" },
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

function Sidebar({
  tab,
  onTab,
  displayName,
  avatar,
  onOpenPalette,
}: {
  tab: TabKey;
  onTab: (t: TabKey) => void;
  displayName: string;
  avatar: string | null;
  onOpenPalette: () => void;
}) {
  const navGroups: Array<{
    title: string;
    items: Array<{ label: string; icon: LucideIcon; active?: boolean; onClick?: () => void }>;
  }> = [
    {
      title: "Explore",
      items: [
        { label: "Feed", icon: Zap, active: tab === "feed", onClick: () => onTab("feed") },
        { label: "Tutorial", icon: BookOpen, active: tab === "tutorial", onClick: () => onTab("tutorial") },
        { label: "Anúncios", icon: Activity, active: tab === "anuncios", onClick: () => onTab("anuncios") },
      ],
    },
    {
      title: "Ajuda",
      items: [
        { label: "Publicação", icon: GalleryHorizontalEnd, active: tab === "publicacao", onClick: () => onTab("publicacao") },
        { label: "Pagamentos", icon: ImageIcon, active: tab === "pagamentos", onClick: () => onTab("pagamentos") },
        { label: "Conta & suporte", icon: Users, active: tab === "conta", onClick: () => onTab("conta") },
      ],
    },
  ];




  return (
    <aside className="sticky top-0 hidden h-[140.845071vh] w-[368px] shrink-0 flex-col self-start overflow-y-auto border-r border-white/[0.08] bg-[#0d0d0e] px-[14px] py-3 lg:flex">
      <button className="flex h-[54px] w-full items-center gap-3 text-left">
        <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-[10px] border border-white/10 bg-[#2b2b2d] text-[#a5a5a9]">
          {avatar ? (
            <img src={avatar} alt="" className="h-full w-full object-cover" />
          ) : (
            <UserRound className="h-[19px] w-[19px]" strokeWidth={1.6} />
          )}
        </span>
        <span className="min-w-0 flex-1 truncate text-[17px] font-semibold text-[#f2f2f3]">{displayName}</span>
        <ChevronDown className="h-4 w-4 text-[#8b8b90]" />
      </button>


      <div className="mt-1 border-t border-white/[0.08] pt-[14px]">
        <button
          onClick={onOpenPalette}
          className="relative flex h-[43px] w-full items-center rounded-[9px] bg-[#242425] pl-[46px] pr-[10px] text-left text-[16px] text-[#8d8d92] transition hover:bg-[#2a2a2c]"
        >
          <Search className="absolute left-[15px] top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-[#aaaab0]" />
          <span className="flex-1">Search...</span>
          <kbd className="rounded-[6px] bg-white/[0.06] px-[8px] py-[3px] text-[12px] font-medium text-[#aaaab0]">Ctrl K</kbd>
        </button>
      </div>

      <nav className="mt-[14px] border-t border-white/[0.08] pt-[20px]">
        {navGroups.map((group, groupIndex) => (
          <section
            key={group.title}
            className={groupIndex ? "mt-[29px] border-t border-white/[0.08] pt-[22px]" : ""}
          >
            <h2 className="mb-[12px] px-[7px] text-[16px] font-semibold text-white">{group.title}</h2>
            <div className="space-y-[4px]">
              {group.items.map(({ label, icon: Icon, active, onClick }) => (
                <button
                  key={label}
                  onClick={onClick}
                  className={`flex h-[43px] w-full items-center gap-[14px] rounded-[9px] px-[13px] text-[16px] font-medium transition ${
                    active ? "bg-[#272728] text-white" : "text-[#89898f] hover:bg-white/[0.04] hover:text-white"
                  }`}
                >
                  <Icon className="h-[18px] w-[18px]" strokeWidth={1.7} />
                  {label}
                </button>
              ))}
            </div>
          </section>
        ))}
      </nav>

      <div className="mt-auto border-t border-white/[0.08] pt-[14px]">
        <Link
          to="/dashboard"
          className="flex h-[43px] w-full items-center gap-[14px] rounded-[9px] px-[13px] text-[15px] font-medium text-[#89898f] transition hover:bg-white/[0.04] hover:text-white"
        >
          <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={1.7} />
          Voltar para o dashboard
        </Link>
      </div>
    </aside>
  );
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
    <div className="mt-[16px] rounded-[14px] border border-white/[0.06] bg-[#141416] p-[16px]">
      {loading ? (
        <p className="text-[15px] text-[#67676c]">Carregando comentários…</p>
      ) : comments.length === 0 ? (
        <p className="text-[15px] text-[#67676c]">Seja o primeiro a comentar.</p>
      ) : (
        <ul className="space-y-[14px]">
          {comments.map((c) => (
            <li key={c.id} className="flex gap-[12px]">
              <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center overflow-hidden rounded-[9px] border border-white/10 bg-[#29292b] text-[#a5a5a9]">
                {c.author_avatar ? (
                  <img src={c.author_avatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  <UserRound className="h-4 w-4" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-[8px]">
                  <strong className="text-[15px] font-semibold text-white">{c.author_name}</strong>
                  <span className="text-[14px] text-[#67676c]">{timeAgo(c.created_at)}</span>
                </div>
                <p className="mt-[4px] whitespace-pre-line text-[15px] leading-[1.5] text-[#c8c8cb]">{c.content}</p>
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
            className="min-h-[42px] flex-1 resize-none rounded-[9px] border-0 bg-[#242425] px-[14px] py-[10px] text-[15px] text-white outline-none placeholder:text-[#8d8d92]"
            rows={1}
          />
          <button
            onClick={submit}
            disabled={sending || !draft.trim()}
            className="h-[42px] rounded-[10px] bg-[#159ff2] px-[16px] text-[15px] font-semibold text-white disabled:opacity-50"
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
    <article className="border-b border-white/[0.08] py-[24px]">
      <div className="flex gap-[18px]">
        <span className="h-[42px] w-[42px] shrink-0 overflow-hidden rounded-[10px] border border-white/10 bg-[#29292b]">
          {post.author_avatar ? (
            <img src={post.author_avatar} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-[#a5a5a9]">
              <UserRound className="h-5 w-5" />
            </span>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <header className="relative flex flex-wrap items-center gap-[8px]">
            <strong className="text-[18px] font-semibold leading-none text-white">{post.author_name}</strong>
            <BadgeCheck className="h-[20px] w-[20px] fill-white text-[#0d0d0e]" strokeWidth={2.2} aria-label="Conta verificada" />
            <span className="text-[16.5px] font-medium text-[#67676c]">{timeAgo(post.created_at)}</span>
            {isAdmin && (
              <div className="relative ml-auto">
                <button
                  onClick={() => setShowAdminMenu((value) => !value)}
                  aria-label="Opções da publicação"
                  className="flex h-[30px] w-[30px] items-center justify-center rounded-full text-[#85858a] transition hover:bg-white/[0.06] hover:text-white"
                >
                  <MoreHorizontal className="h-[19px] w-[19px]" />
                </button>
                {showAdminMenu && (
                  <div className="absolute right-0 top-[34px] z-30 w-[150px] overflow-hidden rounded-[10px] border border-white/10 bg-[#202021] p-[5px] shadow-2xl">
                    {confirmingDelete ? (
                      <div className="p-[7px]">
                        <p className="text-[12px] font-medium leading-[1.35] text-white">Excluir esta publicação?</p>
                        <p className="mt-[3px] text-[11px] leading-[1.35] text-[#929298]">Esta ação não pode ser desfeita.</p>
                        <div className="mt-[9px] flex gap-[6px]">
                          <button
                            onClick={() => setConfirmingDelete(false)}
                            disabled={saving}
                            className="flex-1 rounded-[6px] bg-white/[0.06] px-[7px] py-[6px] text-[11px] font-semibold text-white disabled:opacity-50"
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
                          className="flex w-full items-center gap-[9px] rounded-[7px] px-[10px] py-[8px] text-left text-[14px] font-medium text-white hover:bg-white/[0.06]"
                        >
                          <Pencil className="h-[15px] w-[15px]" /> Editar
                        </button>
                        <button
                          onClick={() => setConfirmingDelete(true)}
                          disabled={saving}
                          className="flex w-full items-center gap-[9px] rounded-[7px] px-[10px] py-[8px] text-left text-[14px] font-medium text-red-400 hover:bg-red-500/10 disabled:opacity-50"
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
                className="min-h-[96px] w-full resize-y rounded-[10px] border border-white/10 bg-[#1b1b1d] px-[13px] py-[11px] text-[16px] leading-[1.5] text-white outline-none focus:border-white/20"
              />
              <div className="mt-[9px] flex justify-end gap-[8px]">
                <button onClick={() => { setEditing(false); setEditDraft(post.content); }} className="rounded-[8px] bg-[#272728] px-[13px] py-[8px] text-[14px] font-semibold text-white">Cancelar</button>
                <button onClick={saveEdit} disabled={saving || !editDraft.trim()} className="rounded-[8px] bg-[#159ff2] px-[13px] py-[8px] text-[14px] font-semibold text-white disabled:opacity-50">{saving ? "Salvando…" : "Salvar"}</button>
              </div>
            </div>
          ) : post.content && (
            <p className="mt-[12px] whitespace-pre-line text-[17px] font-medium leading-[1.58] text-[#c8c8cb]">
              {post.content}
            </p>
          )}

          {post.image_signed_url && (
            <div className="relative mt-[16px] overflow-hidden rounded-[14px] border border-white/10">
              <img src={post.image_signed_url} alt="" className="block w-full max-h-[560px] object-cover" />
            </div>
          )}


          <div className="mt-[19px] flex items-center gap-[25px]">
            <button
              onClick={() => canInteract && onLike(post.id)}
              disabled={!canInteract}
              aria-label="Curtir"
              className="flex items-center gap-[8px] text-[#85858a] transition hover:text-white disabled:opacity-60"
            >
              <Heart
                className={`h-[21px] w-[21px] ${post.liked_by_me ? "fill-white text-white" : ""}`}
                strokeWidth={1.7}
              />
              <span className="text-[15px] font-medium">{post.likes_count}</span>
            </button>
            <button
              onClick={() => setShowComments((v) => !v)}
              aria-label="Comentar"
              className="flex items-center gap-[8px] text-[#85858a] transition hover:text-white"
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
        <span className="flex h-[42px] w-[42px] items-center justify-center rounded-[10px] border border-white/10 bg-[#29292b] text-[#9b9ba0]">
          <UserRound className="h-[20px] w-[20px]" />
        </span>
        <div className="flex-1">
          <textarea
            value={text}
            maxLength={2000}
            onChange={(e) => setText(e.target.value)}
            placeholder="Compartilhe algo com a comunidade..."
            className="w-full resize-none border-b border-white/[0.08] bg-transparent pb-[10px] text-[16px] font-medium leading-[1.55] text-white outline-none placeholder:text-[#626267]"
            rows={2}
          />
          {preview && (
            <div className="mt-[14px] relative inline-block">
              <img
                src={preview}
                alt=""
                className="max-h-[240px] rounded-[12px] border border-white/[0.08] object-cover"
              />
              <button
                onClick={() => pick(null)}
                className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-[#252526] text-white shadow"
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
              className="flex items-center gap-[8px] rounded-[9px] bg-[#242425] px-[14px] py-[9px] text-[15px] font-medium text-[#c8c8cb]"
            >
              <ImageIcon className="h-4 w-4" /> {file ? "Trocar imagem" : "Adicionar imagem"}
            </button>
            <div className="ml-auto flex items-center gap-[10px]">
              <span className="text-[13px] text-[#67676c]">{text.length}/2000</span>
              <button
                onClick={submit}
                disabled={busy || (!text.trim() && !file)}
                className="rounded-[10px] bg-[#159ff2] px-[19px] py-[10px] text-[15px] font-semibold text-white disabled:opacity-50"
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
    <div className="mb-[24px] rounded-[16px] border border-white/[0.08] bg-[#19191a] p-[18px]">
      <h3 className="text-[16px] font-semibold text-white">Novo tutorial</h3>
      <input
        value={title}
        maxLength={160}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Título"
        className="mt-[12px] h-[42px] w-full rounded-[9px] border-0 bg-[#242425] px-[14px] text-[15px] text-white outline-none placeholder:text-[#8d8d92]"
      />
      <textarea
        value={body}
        maxLength={8000}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Conteúdo (Markdown suportado)"
        className="mt-[10px] min-h-[120px] w-full resize-none rounded-[9px] border-0 bg-[#242425] px-[14px] py-[10px] text-[15px] text-white outline-none placeholder:text-[#8d8d92]"
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
          className="rounded-[10px] bg-[#159ff2] px-[19px] py-[10px] text-[15px] font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Publicando…" : "Publicar tutorial"}
        </button>
      </div>
    </div>
  );
}

function TutorialList({ tutorials }: { tutorials: HelpFeedTutorial[] }) {
  if (tutorials.length === 0) {
    return <p className="py-[40px] text-center text-[15px] text-[#67676c]">Nenhum tutorial publicado ainda.</p>;
  }
  return (
    <ul className="space-y-[16px]">
      {tutorials.map((t) => (
        <li key={t.id} className="rounded-[16px] border border-white/[0.08] bg-[#19191a] p-[20px]">
          <h3 className="text-[18px] font-semibold text-white">{t.title}</h3>
          <p className="mt-[10px] whitespace-pre-line text-[15px] leading-[1.6] text-[#c8c8cb]">{t.body_md}</p>
          <p className="mt-[10px] text-[13px] text-[#67676c]">{timeAgo(t.created_at)} atrás</p>
        </li>
      ))}
    </ul>
  );
}

function RightRail() {
  return (
    <aside className="sticky top-0 hidden h-screen w-[428px] shrink-0 overflow-y-auto bg-[#0d0d0e] pb-10 pt-[87px] xl:block">
      <section className="rounded-[27px] border border-white/[0.08] bg-[#19191a] p-[21px]">
        <h2 className="text-[17px] font-semibold text-white">Bem-vindo(a)</h2>
        <p className="mt-[12px] text-[16px] font-medium leading-[1.5] text-[#9b9ba1]">
          Conhece alguém que curtiria a comunidade?
          <br />
          Compartilhe seu link de convite.
        </p>
        <div className="mt-[20px] grid grid-cols-2 gap-[12px]">
          <button className="h-[43px] rounded-[10px] bg-[#159ff2] text-[16px] font-semibold text-white">
            Copiar convite
          </button>
          <button className="h-[43px] rounded-[10px] bg-[#272728] text-[16px] font-semibold text-white">
            Abrir Velo
          </button>
        </div>
      </section>

      <section className="mt-[21px] rounded-[27px] border border-white/[0.08] bg-[#19191a] p-[21px]">
        <h2 className="text-[17px] font-semibold text-white">Sugestões</h2>
        <div className="mt-[20px] space-y-[13px]">
          {suggestions.map((person) => (
            <div key={person.handle} className="flex items-center gap-[13px]">
              {person.avatar.startsWith("http") ? (
                <img src={person.avatar} alt="" className="h-[42px] w-[42px] shrink-0 rounded-[10px] object-cover" />
              ) : (
                <span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[10px] bg-[#29292b] text-[12px] font-bold text-white">
                  {person.avatar}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[16px] font-semibold leading-none text-white">{person.name}</p>
                <p className="mt-[5px] truncate text-[15px] font-medium text-[#9a9aa0]">{person.handle}</p>
              </div>
              <button className="h-[42px] rounded-[10px] bg-[#272728] px-[16px] text-[15px] font-semibold text-white">
                Seguir
              </button>
            </div>
          ))}
        </div>
      </section>
    </aside>
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
          className="mb-[28px] flex items-center gap-[8px] text-[18px] font-medium text-[#8b8b90] transition hover:text-white"
        >
          <ChevronDown className="h-[18px] w-[18px] rotate-90" />
          Voltar para {section.label}
        </button>

        <div className="mx-auto max-w-[900px]">
          <div className="flex items-center gap-[14px]">
            <span className="flex h-[64px] w-[64px] items-center justify-center rounded-[16px] bg-white/[0.04] text-white">
              <Icon className="h-[30px] w-[30px]" strokeWidth={1.7} />
            </span>
            <span className="text-[14px] font-semibold uppercase tracking-[0.16em] text-[#9b9ba1]">
              {section.label}
            </span>
          </div>

          <h1 className="mt-[26px] text-[52px] font-semibold leading-[1.05] tracking-[-0.02em] text-white">
            {active.title}
          </h1>
          <p className="mt-[18px] text-[22px] leading-[1.55] text-[#a5a5aa]">{active.summary}</p>

          <div className="mt-[44px]">
            <h2 className="text-[16px] font-semibold uppercase tracking-[0.16em] text-[#67676c]">
              Passo a passo
            </h2>
            <ol className="mt-[20px] space-y-[16px]">
              {active.steps.map((step, i) => (
                <li key={i} className="flex gap-[20px] rounded-[16px] bg-[#141416] px-[22px] py-[20px]">
                  <span className="flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-full bg-white text-[16px] font-bold text-black">
                    {i + 1}
                  </span>
                  <p className="text-[19px] leading-[1.6] text-[#d5d5d8]">{step}</p>
                </li>
              ))}
            </ol>
          </div>

          {active.tip && (
            <div className="mt-[32px] rounded-[16px] bg-[#141416] p-[22px]">
              <p className="text-[14px] font-semibold uppercase tracking-[0.14em] text-white/70">Dica</p>
              <p className="mt-[10px] text-[19px] leading-[1.6] text-[#d5d5d8]">{active.tip}</p>
            </div>
          )}

          <div className="mt-[44px] flex flex-col gap-[14px] rounded-[18px] bg-[#141416] p-[26px] sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[20px] font-semibold text-white">Ainda com dúvida?</p>
              <p className="mt-[6px] text-[17px] text-[#8b8b90]">Fale com o suporte humano em Suporte → Novo chamado.</p>
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
          <span className="inline-flex items-center gap-[8px] text-[14px] font-semibold uppercase tracking-[0.18em] text-[#8b8b90]">
            Central de ajuda · {section.label}
          </span>
          <h1 className="mt-[24px] text-[62px] font-semibold leading-[1.02] tracking-[-0.025em] text-white sm:text-[72px]">
            {section.headline ?? "Como podemos te ajudar?"}
          </h1>
          <p className="mx-auto mt-[22px] max-w-[640px] text-[21px] leading-[1.55] text-[#9b9ba1]">
            {section.intro}
          </p>

          <label className="relative mx-auto mt-[36px] block max-w-[640px]">
            <Search className="absolute left-[22px] top-1/2 h-[22px] w-[22px] -translate-y-1/2 text-[#7a7a80]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Descreva o problema..."
              className="h-[64px] w-full rounded-[16px] bg-[#141416] pl-[58px] pr-[18px] text-[19px] text-white outline-none transition placeholder:text-[#67676c] focus:bg-[#18181a]"
            />
          </label>

          {section.quickTopics && section.quickTopics.length > 0 && (
            <div className="mt-[22px] flex flex-wrap justify-center gap-[10px]">
              {section.quickTopics.map((t) => (
                <button
                  key={t}
                  onClick={() => setQuery(t)}
                  className="rounded-full bg-white/[0.04] px-[18px] py-[9px] text-[15px] font-medium text-[#a5a5aa] transition hover:bg-white/[0.08] hover:text-white"
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
          <h2 className="text-[17px] font-semibold uppercase tracking-[0.16em] text-[#67676c]">
            {query.trim() ? "Resultados" : "Guias populares"}
          </h2>
          <span className="text-[15px] text-[#67676c]">{filtered.length} guias</span>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-[18px] bg-[#141416] p-[40px] text-center">
            <p className="text-[19px] font-semibold text-white">Nada encontrado para "{query}"</p>
            <p className="mt-[10px] text-[16px] text-[#8b8b90]">
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
                  className="group relative overflow-hidden rounded-[18px] bg-[#141416] p-[26px] text-left transition hover:bg-[#18181a]"
                >
                  <span className="mb-[18px] flex h-[44px] w-[44px] items-center justify-center rounded-[12px] bg-white/[0.05] text-white">
                    <Icon className="h-[22px] w-[22px]" strokeWidth={1.7} />
                  </span>
                  <h3 className="text-[20px] font-semibold leading-[1.3] text-white">{item.title}</h3>
                  <p className="mt-[10px] text-[16px] leading-[1.55] text-[#8b8b90]">{item.summary}</p>
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
  const { nome, foto } = useProfile();
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
  const accountName = useMemo(() => {
    if (nome && nome !== "Usuario") return nome;
    const metadataName = user?.user_metadata?.full_name || user?.user_metadata?.name;
    if (typeof metadataName === "string" && metadataName.trim()) return metadataName.trim();
    return user?.email?.split("@")[0] || "Usuario";
  }, [nome, user]);
  const [emailHash, setEmailHash] = useState<string | null>(null);
  useEffect(() => {
    const email = user?.email?.trim().toLowerCase();
    if (!email || !globalThis.crypto?.subtle) { setEmailHash(null); return; }
    let cancelled = false;
    globalThis.crypto.subtle
      .digest("SHA-256", new TextEncoder().encode(email))
      .then((buf) => {
        if (cancelled) return;
        const hex = Array.from(new Uint8Array(buf))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
        setEmailHash(hex);
      })
      .catch(() => setEmailHash(null));
    return () => { cancelled = true; };
  }, [user?.email]);
  const gravatarUrl = emailHash ? `https://www.gravatar.com/avatar/${emailHash}?d=identicon&s=120` : null;
  const accountAvatar = foto || (typeof user?.user_metadata?.avatar_url === "string" ? user.user_metadata.avatar_url : null) || gravatarUrl;

  const [showComposer, setShowComposer] = useState(false);

  return (
    <div
      className="min-h-screen overflow-x-hidden bg-[#0d0d0e] font-['Inter_Variable','Inter',ui-sans-serif,system-ui,sans-serif] text-white"
      style={{ zoom: 0.71, minHeight: "140.845071vh" }}
    >
      <div className="flex min-h-screen w-full">
        <Sidebar tab={tab} onTab={(t) => { setTab(t); setActiveGuideId(null); }} displayName={accountName} avatar={accountAvatar} onOpenPalette={() => setPaletteOpen(true)} />
        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-[72px] items-center border-b border-white/[0.06] bg-[#0d0d0e]/95 px-[28px] backdrop-blur">
            <div className="flex items-center gap-[20px]">
              <button
                onClick={() => setTab("feed")}
                className={`rounded-[10px] px-[18px] py-[12px] text-[17px] font-semibold ${
                  tab === "feed" ? "bg-[#28282a] text-white" : "text-[#737378]"
                }`}
              >
                Feed
              </button>
              <button
                onClick={() => setTab("tutorial")}
                className={`rounded-[10px] px-[18px] py-[12px] text-[17px] font-semibold ${
                  tab === "tutorial" ? "bg-[#28282a] text-white" : "text-[#737378]"
                }`}
              >
                Tutorial
              </button>
            </div>
          </header>
          {isAdmin && tab === "feed" && (
            <button
              onClick={() => setShowComposer((v) => !v)}
              className="fixed right-[24px] top-[14px] z-40 rounded-[10px] bg-[#159ff2] px-[20px] py-[9px] text-[15px] font-semibold text-white transition hover:opacity-90"
            >
              {showComposer ? "Fechar" : "Post"}
            </button>
          )}

          <div className="flex flex-1 min-h-0 w-full">
            <div className="hidden flex-1 shrink xl:block" />
            <main className="min-h-screen w-full min-w-0 max-w-[780px] shrink-0 bg-[#0d0d0e]">
              {tab === "feed" && isAdmin && showComposer && <Composer onSubmit={async (opts) => { await createPost(opts); setShowComposer(false); }} />}

              <div className="relative mx-auto max-w-[720px] px-[24px]">
                {tab === "feed" && (
                  <>
                    {loading ? (
                      <p className="py-[40px] text-center text-[15px] text-[#67676c]">Carregando feed…</p>
                    ) : error ? (
                      <p className="py-[40px] text-center text-[15px] text-red-400">{error}</p>
                    ) : posts.length === 0 ? (
                      <p className="py-[40px] text-center text-[15px] text-[#67676c]">
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

              {tab !== "feed" && tab !== "tutorial" && (
                <GuidesView sectionKey={tab} activeId={activeGuideId} setActiveId={setActiveGuideId} />
              )}

            </main>
            {(tab === "feed" || tab === "tutorial") && (
              <>
                <div className="hidden w-[8px] shrink-0 xl:block" />
                <RightRail />
                <div className="hidden flex-1 shrink xl:block" />
              </>
            )}
          </div>
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
