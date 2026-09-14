import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, Megaphone } from "lucide-react";
import { supabase, isSupabaseEnabled } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";



// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tipos auto-gerados podem estar defasados
const sb = supabase as any;

type Announcement = {
  id: string;
  content: string;
  created_at: string;
};

const MAX_AGE_DAYS = 14;
const storageKey = (userId: string | undefined, postId: string) =>
  `velo:community-announcement:${userId ?? "anon"}:${postId}`;

const CommunityAnnouncementModal = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [post, setPost] = useState<Announcement | null>(null);

  useEffect(() => {
    if (!isSupabaseEnabled) return;
    let cancelled = false;

    (async () => {
      const { data, error } = await sb
        .from("help_feed_posts")
        .select("id, content, created_at")
        .order("created_at", { ascending: false })
        .limit(1);
      if (cancelled || error) return;

      const latest = (data ?? [])[0] as Announcement | undefined;
      if (!latest?.content?.trim()) return;

      const ageDays = (Date.now() - new Date(latest.created_at).getTime()) / 86_400_000;
      if (ageDays > MAX_AGE_DAYS) return;

      try {
        if (localStorage.getItem(storageKey(user?.id, latest.id))) return;
      } catch {
        // localStorage indisponível — mostra mesmo assim
      }

      setPost(latest);
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const dismiss = () => {
    if (post) {
      try {
        localStorage.setItem(storageKey(user?.id, post.id), "1");
      } catch {
        // ignora
      }
    }
    setPost(null);
  };

  if (!post) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-6 py-4">
          <span className="inline-flex items-center gap-2 text-base font-semibold text-zinc-900">
            <Megaphone size={16} /> Comunidade Velo
          </span>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Fechar aviso"
            className="rounded-full p-1.5 text-zinc-400 transition hover:bg-zinc-200/70 hover:text-zinc-700"
          >
            <X size={18} />
          </button>
        </div>

        {/* Corpo */}
        <div className="px-6 py-5">
          <h2 className="text-lg font-semibold text-zinc-900">
            Já viu a novidade de hoje?
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">
            Acabamos de publicar um comunicado importante na comunidade. Veja abaixo.
          </p>

          <div className="mt-4 max-h-[340px] overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950 p-4">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-100">
              {post.content}
            </p>
          </div>
        </div>

        {/* Rodapé */}
        <div className="flex justify-end gap-3 border-t border-zinc-200 px-6 py-4">
          <button
            type="button"
            onClick={dismiss}
            className="rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
          >
            Agora não
          </button>
          <button
            type="button"
            onClick={() => {
              dismiss();
              navigate("/dashboard/comunidade");
            }}
            className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800"
          >
            Ver na comunidade
          </button>
        </div>

      </div>
    </div>
  );
};

export default CommunityAnnouncementModal;
