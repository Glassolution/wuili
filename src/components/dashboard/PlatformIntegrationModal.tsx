import { useState } from "react";
import { X, Network } from "lucide-react";
import { toast } from "sonner";

type Platform = {
  name: string;
  subtitle: string;
  logo: string;
  connected: boolean;
  section: "integrated" | "explore";
};

const initialPlatforms: Platform[] = [
  { name: "AliExpress", subtitle: "Platform Integration", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/AliExpress_logo.svg/200px-AliExpress_logo.svg.png", connected: true, section: "integrated" },
  { name: "Amazon", subtitle: "Platform Integration", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Amazon_logo.svg/200px-Amazon_logo.svg.png", connected: true, section: "integrated" },
  { name: "Tokopedia", subtitle: "Platform Integration", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/eb/Tokopedia_New_Logo_2020.svg/200px-Tokopedia_New_Logo_2020.svg.png", connected: false, section: "integrated" },
  { name: "eBay", subtitle: "Platform Integration", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/EBay_logo.svg/200px-EBay_logo.svg.png", connected: true, section: "integrated" },
  { name: "Shopee", subtitle: "Platform Integration", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fe/Shopee.svg/200px-Shopee.svg.png", connected: false, section: "integrated" },
  { name: "Lazada", subtitle: "Platform Integration", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9f/Lazada_Logo.svg/200px-Lazada_Logo.svg.png", connected: false, section: "explore" },
  { name: "Rakuten", subtitle: "Platform Integration", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Rakuten_Global_Brand_Logo.svg/200px-Rakuten_Global_Brand_Logo.svg.png", connected: false, section: "explore" },
  { name: "Etsy", subtitle: "Platform Integration", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/Etsy_logo.svg/200px-Etsy_logo.svg.png", connected: false, section: "explore" },
  { name: "BigCommerce", subtitle: "Platform Integration", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/BigCommerce-logo.svg/200px-BigCommerce-logo.svg.png", connected: false, section: "explore" },
  { name: "WooCommerce", subtitle: "Platform Integration", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/WooCommerce_logo.svg/200px-WooCommerce_logo.svg.png", connected: false, section: "explore" },
  { name: "Shopee", subtitle: "Platform Integration", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fe/Shopee.svg/200px-Shopee.svg.png", connected: false, section: "explore" },
];

const Toggle = ({ on, onChange }: { on: boolean; onChange: () => void }) => (
  <button
    onClick={onChange}
    className={`relative h-6 w-11 rounded-full transition-colors ${on ? "bg-green-500" : "bg-gray-200"}`}
  >
    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-5" : "left-0.5"}`} />
  </button>
);

const PlatformLogo = ({ src, name }: { src: string; name: string }) => (
  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-white p-1.5 overflow-hidden">
    <img src={src} alt={name} className="h-full w-full object-contain" onError={(e) => {
      (e.target as HTMLImageElement).style.display = "none";
      (e.target as HTMLImageElement).parentElement!.innerHTML = `<span class="text-xs font-bold text-foreground">${name[0]}</span>`;
    }} />
  </div>
);

type Props = { open: boolean; onClose: () => void };

const PlatformIntegrationModal = ({ open, onClose }: Props) => {
  const [platforms, setPlatforms] = useState(initialPlatforms);

  const toggle = (name: string) => {
    setPlatforms(prev => prev.map(p => {
      if (p.name === name && p.section === "integrated") {
        const nowConnected = !p.connected;
        if (nowConnected) {
          toast.success(`${name} foi integrada com sucesso 🔗`);
        }
        return { ...p, connected: nowConnected };
      }
      return p;
    }));
  };

  if (!open) return null;

  const integrated = platforms.filter(p => p.section === "integrated");
  const explore = platforms.filter(p => p.section === "explore");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-2xl bg-background shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
              <Network size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Integração de Plataformas</h2>
              <p className="text-xs text-muted-foreground">Conecte suas plataformas de venda.</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 pb-6 space-y-5 max-h-[70vh] overflow-y-auto" style={{ scrollbarWidth: "none" }}>
          {/* Integrated */}
          <div>
            <p className="text-sm font-bold text-foreground mb-3">Integradas</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {integrated.map((p) => (
                <div key={p.name + p.section} className="flex items-center justify-between rounded-xl border border-border p-3">
                  <div className="flex items-center gap-2.5">
                    <PlatformLogo src={p.logo} name={p.name} />
                    <div>
                      <p className="text-sm font-semibold text-foreground">{p.name}</p>
                      <p className="text-[10px] text-muted-foreground">{p.subtitle}</p>
                    </div>
                  </div>
                  <Toggle on={p.connected} onChange={() => toggle(p.name)} />
                </div>
              ))}
            </div>
          </div>

          {/* Explore */}
          <div>
            <p className="text-sm font-bold text-foreground mb-3">Explorar</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {explore.map((p, i) => (
                <div key={p.name + i} className="flex items-center justify-between rounded-xl border border-border p-3">
                  <div className="flex items-center gap-2.5">
                    <PlatformLogo src={p.logo} name={p.name} />
                    <div>
                      <p className="text-sm font-semibold text-foreground">{p.name}</p>
                      <p className="text-[10px] text-muted-foreground">{p.subtitle}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      toast.success(`${p.name} foi integrada com sucesso 🔗`);
                    }}
                    className="text-xs font-semibold text-foreground underline hover:text-primary transition-colors"
                  >
                    Conectar
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-6 py-4">
          <p className="text-xs text-muted-foreground">
            Saiba mais sobre{" "}
            <a href="#" className="text-primary hover:underline">Plataformas</a>
          </p>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="text-sm font-medium text-foreground underline hover:text-muted-foreground transition-colors">
              Cancelar
            </button>
            <button onClick={() => { toast.success("Integrações salvas com sucesso 🔗"); onClose(); }} className="btn-primary btn-primary--md">
              Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlatformIntegrationModal;
