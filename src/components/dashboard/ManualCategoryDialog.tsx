import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Suggestion = {
  category_id: string;
  category_name: string;
  path?: Array<{ id: string; name: string }>;
};

type MLCategoryResponse = {
  id: string;
  name: string;
  children_categories?: unknown[];
  attributes?: Array<{ id: string; tags?: Record<string, unknown>; values?: unknown[] }>;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialQuery?: string;
  predictedCategoryId?: string;
  predictedCategoryName?: string;
  onConfirm: (payload: { categoryId: string; sizeGridId?: string }) => Promise<void> | void;
};

// Debounce simples via ref para evitar disparos excessivos ao digitar.
function useDebounced<T>(value: T, delay = 350): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

export function ManualCategoryDialog({
  open, onOpenChange, initialQuery = "", predictedCategoryId, predictedCategoryName, onConfirm,
}: Props) {
  const [query, setQuery] = useState(initialQuery);
  const debounced = useDebounced(query, 400);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>(predictedCategoryId);
  const [selectedName, setSelectedName] = useState<string | undefined>(predictedCategoryName);
  const [requiresGrid, setRequiresGrid] = useState(false);
  const [checkingCat, setCheckingCat] = useState(false);
  const [sizeGridId, setSizeGridId] = useState("");
  const [confirming, setConfirming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Reset a cada abertura
  useEffect(() => {
    if (open) {
      setQuery(initialQuery);
      setSelectedId(predictedCategoryId);
      setSelectedName(predictedCategoryName);
      setSizeGridId("");
      setRequiresGrid(true); // assumimos que sim até termos a resposta
      setSuggestions([]);
    }
  }, [open, initialQuery, predictedCategoryId, predictedCategoryName]);

  // Busca sugestões de categoria pela ML domain_discovery (endpoint público).
  useEffect(() => {
    if (!open || !debounced.trim()) { setSuggestions([]); return; }
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    fetch(
      `https://api.mercadolibre.com/sites/MLB/domain_discovery/search?limit=8&q=${encodeURIComponent(debounced)}`,
      { signal: ctrl.signal },
    )
      .then((r) => r.ok ? r.json() : [])
      .then((data: Array<Record<string, unknown>>) => {
        if (!Array.isArray(data)) { setSuggestions([]); return; }
        setSuggestions(data.map((d) => ({
          category_id: String(d.category_id),
          category_name: String(d.category_name ?? ""),
          path: Array.isArray(d.path_from_root)
            ? (d.path_from_root as Array<Record<string, unknown>>).map((p) => ({
                id: String(p.id), name: String(p.name),
              }))
            : undefined,
        })));
      })
      .catch(() => { /* aborted */ })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [debounced, open]);

  // Verifica se a categoria selecionada exige SIZE_GRID_ID.
  useEffect(() => {
    if (!selectedId) { setRequiresGrid(false); return; }
    setCheckingCat(true);
    fetch(`https://api.mercadolibre.com/categories/${selectedId}/attributes`)
      .then((r) => r.ok ? r.json() : [])
      .then((attrs: Array<{ id: string; tags?: Record<string, unknown>; values?: unknown[] }>) => {
        const sg = attrs.find((a) => a.id === "SIZE_GRID_ID");
        if (!sg) { setRequiresGrid(false); return; }
        const tags = sg.tags ?? {};
        const values = sg.values ?? [];
        setRequiresGrid(values.length === 0 || Boolean(tags.required || tags.fixed));
      })
      .catch(() => setRequiresGrid(false))
      .finally(() => setCheckingCat(false));
  }, [selectedId]);

  const canConfirm = useMemo(() => {
    if (!selectedId) return false;
    if (requiresGrid && !sizeGridId.trim()) return false;
    return true;
  }, [selectedId, requiresGrid, sizeGridId]);

  const handleConfirm = async () => {
    if (!selectedId) return;
    setConfirming(true);
    try {
      await onConfirm({ categoryId: selectedId, sizeGridId: requiresGrid ? sizeGridId.trim() : undefined });
    } finally {
      setConfirming(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Selecionar categoria manualmente</DialogTitle>
          <DialogDescription>
            Não foi possível publicar automaticamente. Escolha a categoria correta do Mercado Livre para este produto.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cat-search">Buscar categoria</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="cat-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ex.: fone bluetooth"
                className="pl-9"
                autoFocus
              />
            </div>
            <div className="max-h-56 overflow-y-auto rounded-md border">
              {loading && (
                <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Buscando…
                </div>
              )}
              {!loading && suggestions.length === 0 && (
                <div className="p-3 text-sm text-muted-foreground">
                  Digite ao menos duas palavras para ver sugestões.
                </div>
              )}
              {!loading && suggestions.map((s) => {
                const active = s.category_id === selectedId;
                return (
                  <button
                    key={s.category_id}
                    type="button"
                    onClick={() => { setSelectedId(s.category_id); setSelectedName(s.category_name); }}
                    className={`block w-full px-3 py-2 text-left text-sm transition-colors ${active ? "bg-primary/10" : "hover:bg-muted"}`}
                  >
                    <div className="font-medium">{s.category_name}</div>
                    {s.path && (
                      <div className="text-xs text-muted-foreground truncate">
                        {s.path.map((p) => p.name).join(" › ")}
                      </div>
                    )}
                    <div className="text-[10px] text-muted-foreground">{s.category_id}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {selectedId && (
            <div className="rounded-md border p-3 text-sm">
              <div className="text-muted-foreground text-xs">Categoria selecionada</div>
              <div className="font-medium">{selectedName || selectedId}</div>
              <div className="text-xs text-muted-foreground">{selectedId}</div>
            </div>
          )}

          {checkingCat && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Verificando atributos da categoria…
            </div>
          )}

          {requiresGrid && !checkingCat && (
            <div className="space-y-1.5">
              <Label htmlFor="grid-id">ID da grade de tamanho (SIZE_GRID_ID)</Label>
              <Input
                id="grid-id"
                value={sizeGridId}
                onChange={(e) => setSizeGridId(e.target.value)}
                placeholder="Ex.: 123456"
              />
              <p className="text-xs text-muted-foreground">
                Esta categoria exige uma grade de tamanhos. Crie uma no Mercado Livre em <em>Minha conta › Grades de tamanho</em> e cole o ID aqui.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={confirming}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!canConfirm || confirming}>
            {confirming && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Publicar com esta categoria
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
