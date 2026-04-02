import { useState } from "react";
import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="text-2xl font-black tracking-tight text-foreground">
          Wuili
        </Link>

        <div className="hidden md:flex items-center gap-8">
          <a href="#produtos" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Produtos</a>
          <a href="#solucoes" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Soluções</a>
          <a href="#precos" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Plano de preços</a>
          <a href="#como-funciona" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Desenvolvedores</a>
        </div>

        <div className="hidden md:flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/dashboard">Entrar</Link>
          </Button>
          <Button size="sm" className="bg-primary text-primary-foreground shadow-wuili-primary hover:opacity-90 transition-all" asChild>
            <Link to="/dashboard">Comece já ›</Link>
          </Button>
        </div>

        <button className="md:hidden" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden bg-background border-b border-border px-6 py-4 space-y-3">
          <a href="#produtos" className="block text-sm font-medium text-muted-foreground">Produtos</a>
          <a href="#solucoes" className="block text-sm font-medium text-muted-foreground">Soluções</a>
          <a href="#precos" className="block text-sm font-medium text-muted-foreground">Plano de preços</a>
          <div className="flex gap-2 pt-2">
            <Button variant="ghost" size="sm" asChild><Link to="/dashboard">Entrar</Link></Button>
            <Button size="sm" className="bg-primary text-primary-foreground" asChild><Link to="/dashboard">Comece já ›</Link></Button>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
