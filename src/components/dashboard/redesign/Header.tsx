import { Bell, Settings } from "lucide-react";

export function Header() {
  return (
    <header className="fixed left-[220px] right-0 top-0 z-30 flex h-[58px] items-center justify-between border-b border-slate-200/80 bg-[#f8f9fc]/90 px-5 backdrop-blur xl:px-6">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-slate-400">Painel</p>
        <h1 className="text-[26px] font-semibold leading-none text-slate-900">Dashboard</h1>
      </div>

      <div className="flex items-center gap-3">
        <button className="rounded-2xl p-2 transition-colors hover:bg-white" aria-label="Notificações">
          <Bell size={18} className="text-slate-600" />
        </button>
        <button className="rounded-2xl p-2 transition-colors hover:bg-white" aria-label="Configurações">
          <Settings size={18} className="text-slate-600" />
        </button>
        <button className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition-colors hover:bg-slate-900 hover:text-white">
          Ver Loja
        </button>
      </div>
    </header>
  );
}
