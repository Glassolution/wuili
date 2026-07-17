// Editor de blocos (Fase 1) — nova página, isolada do editor antigo.
// Rota: /minha-loja/blocos/:projectId
//
// Aqui o lojista:
//  - Vê a lista ordenada de seções da loja
//  - Adiciona/remove/toggle/reordena (setas ↑↓ na Fase 1; DnD na Fase 2)
//  - Edita cada seção via formulário estruturado (SectionEditorForm)
//  - Vê preview ao vivo à direita renderizado pelo SectionRenderer
//
// Persistência: metadata.sections + metadata.theme em user_projects, via
// saveProjectDraft. Autosave com debounce curto.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowDown, ArrowUp, Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { fetchUserProject, saveProjectDraft, type UserProject } from "@/lib/userProjects";
import {
  parseSections,
  parseTheme,
  type StoreSection,
  type ThemeTokens,
} from "@/lib/storeSections/types";
import { SECTION_REGISTRY, SECTION_TYPES } from "@/lib/storeSections/registry";
import SectionRenderer from "@/components/store-sections/SectionRenderer";
import SectionEditorForm from "@/components/store-sections/SectionEditorForm";
import { toast } from "@/hooks/use-toast";

function readMeta(project: UserProject | null): Record<string, unknown> {
  const meta = project?.metadata;
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return {};
  return meta as Record<string, unknown>;
}

const SectionsEditorPage = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<UserProject | null>(null);
  const [sections, setSections] = useState<StoreSection[]>([]);
  const [theme, setTheme] = useState<ThemeTokens>(parseTheme({}));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydrated = useRef(false);

  // Load project
  useEffect(() => {
    if (!projectId) return;
    (async () => {
      try {
        const p = await fetchUserProject(projectId);
        if (!p) {
          toast({ title: "Projeto não encontrado", variant: "destructive" });
          navigate("/dashboard");
          return;
        }
        setProject(p);
        const meta = readMeta(p);
        const initialSections = parseSections(meta.sections);
        setSections(initialSections);
        setTheme(parseTheme(meta.theme));
        setSelectedId(initialSections[0]?.id ?? null);
      } catch (err) {
        console.error("[SectionsEditor] load error", err);
        toast({ title: "Erro ao carregar projeto", variant: "destructive" });
      } finally {
        setLoading(false);
        hydrated.current = true;
      }
    })();
  }, [projectId, navigate]);

  // Autosave (debounced)
  useEffect(() => {
    if (!hydrated.current || !projectId) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveProjectDraft(projectId, { sections, theme }).catch((err) => {
        console.error("[SectionsEditor] save error", err);
      });
    }, 600);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [sections, theme, projectId]);

  const selected = useMemo(() => sections.find((s) => s.id === selectedId) ?? null, [sections, selectedId]);

  const updateSection = useCallback((next: StoreSection) => {
    setSections((list) => list.map((s) => (s.id === next.id ? next : s)));
  }, []);

  const addSection = (type: keyof typeof SECTION_REGISTRY) => {
    const s = SECTION_REGISTRY[type].createDefault();
    setSections((list) => [...list, s]);
    setSelectedId(s.id);
  };

  const removeSection = (id: string) => {
    setSections((list) => list.filter((s) => s.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const toggleEnabled = (id: string) => {
    setSections((list) => list.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)));
  };

  const move = (id: string, dir: -1 | 1) => {
    setSections((list) => {
      const idx = list.findIndex((s) => s.id === id);
      if (idx < 0) return list;
      const target = idx + dir;
      if (target < 0 || target >= list.length) return list;
      const copy = [...list];
      [copy[idx], copy[target]] = [copy[target], copy[idx]];
      return copy;
    });
  };

  if (loading) {
    return <div className="grid min-h-screen place-items-center bg-neutral-950 text-white">Carregando…</div>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-neutral-950 text-white">
      <header className="flex items-center justify-between border-b border-white/10 px-6 py-3">
        <div className="flex items-center gap-4">
          <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-[13px] text-white/60 hover:text-white">
            <ArrowLeft size={16} /> Dashboard
          </Link>
          <div className="h-5 w-px bg-white/10" />
          <h1 className="text-[14px] font-semibold">Blocos · {project?.nome ?? "Loja"}</h1>
          <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
            Novo template · Fase 1
          </span>
        </div>
        <div className="text-[12px] text-white/50">Salvamento automático</div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: section list + add */}
        <aside className="flex w-[260px] flex-col border-r border-white/10 bg-neutral-950">
          <div className="border-b border-white/10 p-3">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-white/40">
              Adicionar bloco
            </div>
            <div className="grid grid-cols-1 gap-1.5">
              {SECTION_TYPES.map((t) => (
                <button
                  key={t.type}
                  onClick={() => addSection(t.type)}
                  className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-left text-[12px] hover:border-white/25 hover:bg-white/[0.06]"
                >
                  <Plus size={13} /> {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-white/40">
              Seções ({sections.length})
            </div>
            {sections.length === 0 && (
              <p className="text-[12px] text-white/40">Nenhum bloco ainda. Adicione um acima.</p>
            )}
            <ul className="space-y-1.5">
              {sections.map((s, idx) => {
                const label = SECTION_REGISTRY[s.type]?.label ?? s.type;
                const active = s.id === selectedId;
                return (
                  <li
                    key={s.id}
                    className={`group rounded-md border ${active ? "border-emerald-400/60 bg-emerald-400/10" : "border-white/10 bg-white/[0.03]"} p-2`}
                  >
                    <button onClick={() => setSelectedId(s.id)} className="flex w-full items-center justify-between text-left">
                      <div>
                        <div className="text-[12px] font-semibold">{label}</div>
                        <div className="text-[10px] text-white/40">#{idx + 1}</div>
                      </div>
                    </button>
                    <div className="mt-1.5 flex items-center gap-1">
                      <button
                        onClick={() => move(s.id, -1)}
                        disabled={idx === 0}
                        className="rounded p-1 text-white/50 hover:bg-white/10 hover:text-white disabled:opacity-30"
                        aria-label="Mover para cima"
                      >
                        <ArrowUp size={13} />
                      </button>
                      <button
                        onClick={() => move(s.id, 1)}
                        disabled={idx === sections.length - 1}
                        className="rounded p-1 text-white/50 hover:bg-white/10 hover:text-white disabled:opacity-30"
                        aria-label="Mover para baixo"
                      >
                        <ArrowDown size={13} />
                      </button>
                      <button
                        onClick={() => toggleEnabled(s.id)}
                        className="rounded p-1 text-white/50 hover:bg-white/10 hover:text-white"
                        aria-label={s.enabled ? "Desativar bloco" : "Ativar bloco"}
                        title={s.enabled ? "Ativo" : "Oculto"}
                      >
                        {s.enabled ? <Eye size={13} /> : <EyeOff size={13} />}
                      </button>
                      <button
                        onClick={() => removeSection(s.id)}
                        className="ml-auto rounded p-1 text-white/40 hover:bg-red-500/20 hover:text-red-300"
                        aria-label="Remover bloco"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>

        {/* Middle: form */}
        <aside className="w-[340px] overflow-y-auto border-r border-white/10 bg-white text-neutral-900">
          {selected ? (
            <div className="p-4">
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                Editar · {SECTION_REGISTRY[selected.type].label}
              </div>
              <SectionEditorForm section={selected} onChange={updateSection} />
            </div>
          ) : (
            <div className="grid h-full place-items-center p-6 text-center text-sm text-neutral-500">
              Selecione um bloco para editar seus campos.
            </div>
          )}
        </aside>

        {/* Right: preview */}
        <main className="flex-1 overflow-y-auto bg-neutral-100">
          <div className="mx-auto max-w-[1200px]">
            <SectionRenderer sections={sections} theme={theme} showDisabled />
          </div>
        </main>
      </div>
    </div>
  );
};

export default SectionsEditorPage;
