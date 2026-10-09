import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowCircleLeft, MagnifyingGlass, Moon, SignOut, Sun } from "@phosphor-icons/react";
import { AdminNotificationsBell } from "@/components/admin/AdminSaleNotifications";
import type { AdminTheme } from "@/components/admin/AdminShell";
import { useAuth } from "@/contexts/AuthContext";

const initialsOf = (name: string) =>
  name
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "VA";

/**
 * Barra superior do admin no desenho da Shopify: faixa escura com a marca,
 * busca central (⌘K), sino com os tickets em aberto e o menu da conta.
 */
export const AdminTopBar = ({
  onOpenSearch,
  theme,
  onToggleTheme,
}: {
  onOpenSearch: () => void;
  theme: AdminTheme;
  onToggleTheme: () => void;
}) => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  const profileName =
    (user?.user_metadata?.full_name as string | undefined) ||
    (user?.user_metadata?.name as string | undefined) ||
    (user?.email ? user.email.split("@")[0] : "Administrador");

  // ⌘K / Ctrl+K abre a busca
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenSearch();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onOpenSearch]);

  // fecha o menu da conta ao clicar fora ou apertar Esc
  useEffect(() => {
    if (!accountOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!accountRef.current?.contains(event.target as Node)) setAccountOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAccountOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [accountOpen]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <header className="admin-topbar hidden h-14 shrink-0 items-center gap-4 px-4 md:flex" data-admin-native>
      <Link to="/admin/painel" className="admin-topbar-brand" aria-label="Velo Admin — Início">
        <img src="/logo-branco.png" alt="" />
        <span>Velo Admin</span>
      </Link>

      <div className="flex min-w-0 flex-1 justify-center">
        <button type="button" onClick={onOpenSearch} className="admin-topbar-search">
          <MagnifyingGlass aria-hidden="true" weight="regular" />
          <span className="min-w-0 flex-1 truncate text-left">Buscar</span>
          <kbd>⌘ K</kbd>
        </button>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onToggleTheme}
          className="admin-topbar-icon admin-topbar-theme"
          aria-label={theme === "dark" ? "Mudar para a versão padrão" : "Mudar para a versão noturna"}
          aria-pressed={theme === "dark"}
          title={theme === "dark" ? "Versão padrão" : "Versão noturna"}
        >
          <span key={theme} className="admin-topbar-theme-icon">
            {theme === "dark" ? <Sun aria-hidden="true" weight="fill" /> : <Moon aria-hidden="true" weight="fill" />}
          </span>
        </button>
        <AdminNotificationsBell />

        <div ref={accountRef} className="relative">
          <button
            type="button"
            onClick={() => setAccountOpen((open) => !open)}
            aria-expanded={accountOpen}
            aria-haspopup="menu"
            className="admin-topbar-account"
          >
            <span className="max-w-[160px] truncate">Velo Admin</span>
            <span className="admin-topbar-avatar" aria-hidden="true">
              {initialsOf(profileName)}
            </span>
          </button>

          {accountOpen ? (
            <div role="menu" className="admin-topbar-menu">
              <div className="admin-account-menu-head">
                <p className="truncate text-[13px] font-medium text-[#1a1a1a]">{profileName}</p>
                <p className="truncate text-[12px] text-[#8c8f93]">{user?.email ?? "Administrador"}</p>
              </div>
              <button
                type="button"
                role="menuitem"
                className="admin-account-menu-item"
                onClick={() => {
                  setAccountOpen(false);
                  navigate("/dashboard");
                }}
              >
                <ArrowCircleLeft aria-hidden="true" weight="fill" />
                Voltar à Velo
              </button>
              <button type="button" role="menuitem" className="admin-account-menu-item" onClick={() => void handleSignOut()}>
                <SignOut aria-hidden="true" weight="fill" />
                Sair
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
};

export default AdminTopBar;
