import { useEffect, useState } from "react";
import { Check, FolderPlus, Loader2, Plus, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { veloToast } from "@/components/ui/velo-toast";
import {
  FAVORITES_COLLECTION_NAME,
  addProductToCollection,
  createCollection,
  getCollectionIdsForProduct,
  listCollectionsWithSummaries,
  removeProductFromCollection,
  type CollectionSummary,
} from "@/lib/collectionsApi";

type Props = {
  productId: string | null;
  onClose: () => void;
};

// Modal para adicionar/remover um produto de uma ou mais coleções, sem depender
// do coração de favoritar. Reutilizado no catálogo e na home.
const CollectionPickerModal = ({ productId, onClose }: Props) => {
  const { user } = useAuth();
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [showNewInput, setShowNewInput] = useState(false);

  useEffect(() => {
    if (!productId || !user?.id) return;
    let active = true;
    setLoading(true);
    setShowNewInput(false);
    setNewName("");
    (async () => {
      try {
        const [rows, ids] = await Promise.all([
          listCollectionsWithSummaries(user.id),
          getCollectionIdsForProduct(user.id, productId),
        ]);
        if (!active) return;
        // "Favoritos" não aparece aqui: ela só é alimentada pelo coração do produto.
        setCollections(rows.filter((c) => c.name !== FAVORITES_COLLECTION_NAME));
        setMemberIds(new Set(ids));
      } catch {
        if (active) veloToast.error("Não foi possível carregar suas coleções.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [productId, user?.id]);

  if (!productId) return null;

  const toggle = async (collectionId: string) => {
    if (togglingId) return;
    const isMember = memberIds.has(collectionId);
    setTogglingId(collectionId);
    // Otimista
    setMemberIds((current) => {
      const next = new Set(current);
      if (isMember) next.delete(collectionId);
      else next.add(collectionId);
      return next;
    });
    try {
      if (isMember) {
        await removeProductFromCollection(collectionId, productId);
      } else {
        await addProductToCollection(collectionId, productId);
      }
      setCollections((current) =>
        current.map((c) =>
          c.id === collectionId
            ? { ...c, productCount: Math.max(0, c.productCount + (isMember ? -1 : 1)) }
            : c,
        ),
      );
    } catch {
      // Reverte
      setMemberIds((current) => {
        const next = new Set(current);
        if (isMember) next.add(collectionId);
        else next.delete(collectionId);
        return next;
      });
      veloToast.error("Não foi possível atualizar a coleção.");
    } finally {
      setTogglingId(null);
    }
  };

  const createAndAdd = async () => {
    const name = newName.trim();
    if (!name || creating || !user?.id) return;
    setCreating(true);
    try {
      const created = await createCollection({ name, category: null, userId: user.id });
      await addProductToCollection(created.id, productId);
      setCollections((current) => [
        { ...created, productCount: 1, coverImage: null, thumbnails: [] },
        ...current,
      ]);
      setMemberIds((current) => new Set(current).add(created.id));
      setNewName("");
      setShowNewInput(false);
      veloToast.success("Coleção criada e produto adicionado.");
    } catch {
      veloToast.error("Não foi possível criar a coleção.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-3 md:items-center md:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[calc(100svh-24px)] w-full max-w-md flex-col overflow-hidden rounded-[24px] bg-white shadow-2xl dark:bg-[#141414]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#E5E5E5] p-4 dark:border-white/10">
          <div className="flex items-center gap-2">
            <FolderPlus size={18} className="text-[#111111] dark:text-white" />
            <h3 className="text-[15px] font-bold text-[#0A0A0A] dark:text-white">Adicionar à coleção</h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-full p-1 text-[#737373] transition hover:bg-[#F0F0F0] dark:text-zinc-400 dark:hover:bg-white/10"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-[#737373]" />
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {collections.map((collection) => {
                const isMember = memberIds.has(collection.id);
                return (
                  <button
                    key={collection.id}
                    type="button"
                    onClick={() => toggle(collection.id)}
                    disabled={togglingId === collection.id}
                    className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition ${
                      isMember
                        ? "border-[#0A0A0A] bg-[#0A0A0A]/[0.03] dark:border-white dark:bg-white/[0.06]"
                        : "border-[#E5E5E5] hover:border-[#0A0A0A] dark:border-white/10 dark:hover:border-white/40"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-semibold text-[#0A0A0A] dark:text-white">
                        {collection.name}
                      </p>
                      <p className="text-[11px] text-[#737373] dark:text-zinc-400">
                        {collection.productCount} produto{collection.productCount === 1 ? "" : "s"}
                      </p>
                    </div>
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                        isMember
                          ? "border-[#0A0A0A] bg-[#0A0A0A] text-white dark:border-white dark:bg-white dark:text-black"
                          : "border-[#D4D4D4] text-transparent dark:border-white/30"
                      }`}
                    >
                      {togglingId === collection.id ? (
                        <Loader2 size={12} className="animate-spin text-current" />
                      ) : (
                        <Check size={13} strokeWidth={3} />
                      )}
                    </span>
                  </button>
                );
              })}

              {collections.length === 0 && (
                <p className="py-6 text-center text-[13px] text-[#737373] dark:text-zinc-400">
                  Você ainda não tem coleções. Crie uma abaixo.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-[#E5E5E5] p-3 dark:border-white/10">
          {showNewInput ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void createAndAdd();
                }}
                placeholder="Nome da coleção"
                className="h-11 flex-1 rounded-full border border-[#E5E5E5] bg-white px-4 text-[14px] text-[#0A0A0A] outline-none placeholder:text-[#A3A3A3] focus:border-black dark:border-white/10 dark:bg-[#0f0f0f] dark:text-white"
              />
              <button
                onClick={() => void createAndAdd()}
                disabled={!newName.trim() || creating}
                className="inline-flex h-11 items-center justify-center rounded-full bg-black px-4 text-[13px] font-semibold text-white transition hover:bg-[#222] disabled:opacity-50 dark:bg-white dark:text-black"
              >
                {creating ? <Loader2 size={14} className="animate-spin" /> : "Criar"}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowNewInput(true)}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-[#E5E5E5] text-[13px] font-semibold text-[#0A0A0A] transition hover:bg-[#F5F5F5] dark:border-white/10 dark:text-white dark:hover:bg-white/5"
            >
              <Plus size={15} strokeWidth={2.4} />
              Nova coleção
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CollectionPickerModal;
