import { Link } from "react-router-dom";

const cols = [
  { title: "Produtos", links: ["Loja Online", "Catálogo", "Publicação Automática", "Dashboard"] },
  { title: "Soluções", links: ["Dropshipping", "E-commerce", "Marketplace", "Atacado"] },
  { title: "Recursos", links: ["Central de Ajuda", "Blog", "Comunidade", "API Docs"] },
  { title: "Empresa", links: ["Sobre", "Carreiras", "Contato", "Imprensa"] },
];

const Footer = () => (
  <footer className="bg-dark pt-16 pb-8">
    <div className="max-w-7xl mx-auto px-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
        <div className="col-span-2 md:col-span-1">
          <Link to="/" className="text-2xl font-black text-primary-foreground">Wuili</Link>
          <p className="text-sm text-primary-foreground/40 mt-2">Dropshipping simplificado para todos.</p>
        </div>
        {cols.map((col) => (
          <div key={col.title}>
            <p className="text-sm font-bold text-primary-foreground/60 mb-3">{col.title}</p>
            <ul className="space-y-2">
              {col.links.map((l) => (
                <li key={l}>
                  <a href="#" className="text-sm text-primary-foreground/40 hover:text-primary-foreground transition-colors">{l}</a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-primary-foreground/10 pt-6 flex flex-wrap items-center justify-between gap-4">
        <p className="text-xs text-primary-foreground/30">© 2024 Wuili. CNPJ 00.000.000/0001-00</p>
        <div className="flex gap-4">
          {["Privacidade", "Termos", "Cookies"].map((l) => (
            <a key={l} href="#" className="text-xs text-primary-foreground/30 hover:text-primary-foreground/60 transition-colors">{l}</a>
          ))}
        </div>
      </div>
    </div>
  </footer>
);

export default Footer;
