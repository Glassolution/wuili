import { useEffect, useMemo, useRef, useState, type CSSProperties, type ElementType } from "react";
import { useNavigate } from "react-router-dom";
import { Archive, BadgeCheck, ClipboardList, Copy, CreditCard, Home, Info, MessagesSquare, Search, Settings2, ShieldCheck, ShoppingCart, Sparkles, Users } from "lucide-react";

export type SearchItem = {
  label: string;
  hint?: string;
  to: string;
  icon: ElementType;
  keywords?: string[];
};

const defaultItems: SearchItem[] = [
  { label: "Início", to: "/dashboard", icon: Home, keywords: ["home", "dashboard", "painel"] },
  { label: "Catálogo", to: "/dashboard/catalogo", icon: ShoppingCart, keywords: ["produtos", "catalog"] },
  { label: "Publicações", to: "/dashboard/publicacoes", icon: Archive, keywords: ["anuncios", "ml", "mercado livre"] },
  { label: "Pedidos", to: "/dashboard/pedidos", icon: Copy, keywords: ["vendas", "orders"] },
  { label: "Relatórios", to: "/dashboard/relatorios", icon: ClipboardList, keywords: ["metricas", "analytics"] },
  { label: "Afiliados", to: "/dashboard/comissoes", icon: Users, keywords: ["comissoes", "indicacoes"] },
  { label: "Configurações", to: "/dashboard/configuracoes", icon: Settings2, keywords: ["ajustes", "conta"] },
  { label: "Assinatura", to: "/dashboard/assinatura", icon: CreditCard, keywords: ["plano", "billing", "pagamento"] },
  { label: "Ajuda & Central", to: "/docs", icon: Info, keywords: ["docs", "duvidas", "suporte"] },
  { label: "Suporte", to: "/dashboard/suporte", icon: MessagesSquare, keywords: ["ajuda", "contato"] },
];

const adminItems: SearchItem[] = [
  { label: "Admin · Usuários", to: "/admin/usuarios", icon: ShieldCheck, keywords: ["administracao", "users"] },
  { label: "Admin · Suporte", to: "/admin/suporte", icon: BadgeCheck, keywords: ["tickets"] },
  { label: "Admin · Painel", to: "/admin", icon: Sparkles, keywords: ["admin"] },
];

const norm = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.55)",
    backdropFilter: "blur(6px)",
    zIndex: 100,
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    padding: "12vh 16px 16px",
  } satisfies CSSProperties,
  panel: {
    width: "100%",
    maxWidth: 560,
    background: "#171714",
    border: "1px solid #2A2926",
    borderRadius: 14,
    boxShadow: "0 30px 80px rgba(0,0,0,0.55)",
    overflow: "hidden",
    color: "#FFFFFF",
  } satisfies CSSProperties,
  inputRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "12px 14px",
    borderBottom: "1px solid #26251F",
  } satisfies CSSProperties,
  input: {
    flex: 1,
    background: "transparent",
    border: 0,
    outline: "none",
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: 500,
    letterSpacing: "-0.02em",
  } satisfies CSSProperties,
  esc: {
    fontSize: 11,
    color: "rgba(255,255,255,0.55)",
    background: "#24231F",
    padding: "3px 8px",
    borderRadius: 6,
  } satisfies CSSProperties,
  list: { maxHeight: 380, overflowY: "auto", padding: 6 } satisfies CSSProperties,
  item: (active: boolean) =>
    ({
      display: "flex",
      alignItems: "center",
      gap: 10,
      width: "100%",
      padding: "10px 12px",
      borderRadius: 10,
      background: active ? "#24231F" : "transparent",
      color: "#FFFFFF",
      border: 0,
      textAlign: "left",
      cursor: "pointer",
      fontSize: 13.5,
      fontWeight: 500,
      letterSpacing: "-0.02em",
    }) satisfies CSSProperties,
  empty: {
    padding: "24px 16px",
    textAlign: "center",
    color: "rgba(255,255,255,0.55)",
    fontSize: 13,
  } satisfies CSSProperties,
};

export const SearchPalette = ({
  open,
  onClose,
  isAdmin,
}: {
  open: boolean;
  onClose: () => void;
  isAdmin: boolean;
}) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const items = useMemo(
    () => (isAdmin ? [...defaultItems, ...adminItems] : defaultItems),
    [isAdmin],
  );

  const filtered = useMemo(() => {
    const q = norm(query.trim());
    if (!q) return items;
    return items.filter((item) => {
      const haystack = norm([item.label, item.hint ?? "", ...(item.keywords ?? [])].join(" "));
      return haystack.includes(q);
    });
  }, [items, query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setIndex(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  useEffect(() => {
    setIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setIndex((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const chosen = filtered[index];
        if (chosen) {
          onClose();
          navigate(chosen.to);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, filtered, index, navigate, onClose]);

  if (!open) return null;

  return (
    <div style={styles.overlay} onMouseDown={onClose} role="dialog" aria-modal="true" aria-label="Busca rápida">
      <div style={styles.panel} onMouseDown={(e) => e.stopPropagation()}>
        <div style={styles.inputRow}>
          <Search size={16} strokeWidth={1.8} aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar páginas, seções, ferramentas…"
            style={styles.input}
            aria-label="Campo de busca"
          />
          <span style={styles.esc}>esc</span>
        </div>
        <div style={styles.list}>
          {filtered.length === 0 ? (
            <div style={styles.empty}>Nenhum resultado para “{query}”.</div>
          ) : (
            filtered.map((item, i) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.to}
                  type="button"
                  style={styles.item(i === index)}
                  onMouseEnter={() => setIndex(i)}
                  onClick={() => {
                    onClose();
                    navigate(item.to);
                  }}
                >
                  <Icon size={15} strokeWidth={1.7} aria-hidden="true" />
                  <span style={{ flex: 1 }}>{item.label}</span>
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>{item.to}</span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchPalette;
