import { useMemo, useState } from "react";
import { Check, ChevronLeft, Globe2, Search, Store } from "lucide-react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import type { ExampleProduct } from "@/pages/StartChoicePage";

type LanguageOption = { name: string; flag: string };

const featuredLanguages: LanguageOption[] = [
  { name: "Português (Brasil)", flag: "🇧🇷" },
  { name: "Português (Portugal)", flag: "🇵🇹" },
  { name: "Inglês", flag: "🇺🇸" },
  { name: "Espanhol", flag: "🇪🇸" },
  { name: "Francês", flag: "🇫🇷" },
  { name: "Alemão", flag: "🇩🇪" },
];

const otherLanguages: LanguageOption[] = [
  { name: "Africâner", flag: "🇿🇦" }, { name: "Árabe", flag: "🇸🇦" },
  { name: "Bengali", flag: "🇧🇩" }, { name: "Búlgaro", flag: "🇧🇬" },
  { name: "Catalão", flag: "🏳️" }, { name: "Chinês", flag: "🇨🇳" },
  { name: "Coreano", flag: "🇰🇷" }, { name: "Croata", flag: "🇭🇷" },
  { name: "Dinamarquês", flag: "🇩🇰" }, { name: "Eslovaco", flag: "🇸🇰" },
  { name: "Finlandês", flag: "🇫🇮" }, { name: "Grego", flag: "🇬🇷" },
  { name: "Hebraico", flag: "🇮🇱" }, { name: "Hindi", flag: "🇮🇳" },
  { name: "Holandês", flag: "🇳🇱" }, { name: "Húngaro", flag: "🇭🇺" },
  { name: "Indonésio", flag: "🇮🇩" }, { name: "Italiano", flag: "🇮🇹" },
  { name: "Japonês", flag: "🇯🇵" }, { name: "Norueguês", flag: "🇳🇴" },
  { name: "Polonês", flag: "🇵🇱" }, { name: "Romeno", flag: "🇷🇴" },
  { name: "Sueco", flag: "🇸🇪" }, { name: "Tailandês", flag: "🇹🇭" },
  { name: "Turco", flag: "🇹🇷" }, { name: "Ucraniano", flag: "🇺🇦" },
];

const StoreLanguagePage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const product = useMemo(() => {
    const fromState = (location.state as { product?: ExampleProduct } | null)?.product;
    if (fromState) return fromState;
    try {
      const stored = sessionStorage.getItem("velo-example-product");
      return stored ? (JSON.parse(stored) as ExampleProduct) : null;
    } catch {
      return null;
    }
  }, [location.state]);
  const [selectedLanguage, setSelectedLanguage] = useState("Português");
  const [showOtherLanguages, setShowOtherLanguages] = useState(false);
  const [search, setSearch] = useState("");

  const filteredLanguages = otherLanguages.filter((language) =>
    language.name.toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR")),
  );

  if (!product) return <Navigate to="/comecar" replace />;

  const chooseLanguage = (name: string) => {
    setSelectedLanguage(name);
    if (otherLanguages.some((language) => language.name === name)) setShowOtherLanguages(true);
  };

  const handleContinue = () => {
    const flowState = { product, language: selectedLanguage };
    sessionStorage.setItem("velo-store-language", selectedLanguage);
    navigate("/onboarding/persona", { state: flowState });
  };

  return (
    <main className="min-h-screen bg-black text-white" style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
      <div className="grid min-h-screen lg:grid-cols-[55%_45%]">
        <section className="relative flex min-h-screen flex-col overflow-hidden px-7 py-7 sm:px-10 lg:px-16 lg:py-10 xl:px-24">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_38%_45%,rgba(255,255,255,0.045),transparent_38%)]" />
          <header className="relative z-10 flex items-center justify-between">
            <Link to="/onboarding/preparando-produto" state={{ product }} className="inline-flex items-center gap-2 text-[12px] font-medium text-white/45 transition hover:text-white">
              <ChevronLeft size={16} /> Voltar
            </Link>
            <div className="w-[42%] max-w-[310px]">
              <div className="h-[4px] overflow-hidden rounded-full bg-white/[0.09]">
                <div className="h-full w-[68%] rounded-full bg-white/35" />
              </div>
            </div>
          </header>

          <div className="relative z-10 my-auto w-full max-w-[620px] py-14">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/38">Personalize sua loja</p>
            <h1 className="mt-4 text-[40px] font-normal leading-[1.04] tracking-[-0.055em] sm:text-[52px]">Que idioma falam seus clientes?</h1>
            <p className="mt-4 text-[15px] leading-relaxed text-white/52">Isso define o idioma da loja que você vai vender.</p>

            <div className="mt-8 grid gap-2 sm:grid-cols-2">
              {featuredLanguages.map((language, index) => {
                const selected = selectedLanguage === language.name;
                return (
                  <button key={language.name} type="button" onClick={() => chooseLanguage(language.name)} className={`flex h-[54px] items-center gap-3 rounded-[6px] px-4 text-left outline-none transition hover:bg-white/[0.07] focus-visible:ring-2 focus-visible:ring-white/70 ${selected ? "bg-white/[0.1] shadow-[inset_3px_0_0_rgba(243,239,232,0.7)]" : "bg-white/[0.04]"} ${index === featuredLanguages.length - 1 ? "sm:col-span-2" : ""}`}>
                    <span className="text-[20px] leading-none" aria-hidden="true">{language.flag}</span>
                    <span className={`flex-1 text-[13px] font-medium ${selected ? "text-white" : "text-white/68"}`}>{language.name}</span>
                    {selected ? <Check size={15} className="text-white/80" /> : null}
                  </button>
                );
              })}
            </div>

            <div className="my-6 h-px bg-white/[0.07]" />
            <button type="button" onClick={() => setShowOtherLanguages((current) => !current)} aria-expanded={showOtherLanguages} className={`flex w-full items-center gap-3 rounded-[6px] p-4 text-left transition hover:bg-white/[0.055] ${showOtherLanguages ? "bg-white/[0.05]" : "bg-white/[0.025]"}`}>
              <Globe2 size={18} className="text-white/50" />
              <span className="flex-1"><span className="block text-[13px] font-medium text-white/75">Outro idioma</span><span className="mt-1 block text-[11px] text-white/35">Pesquisar entre mais idiomas</span></span>
              {otherLanguages.some((language) => language.name === selectedLanguage) ? <Check size={15} /> : null}
            </button>

            {showOtherLanguages ? (
              <div className="mt-2 rounded-[6px] bg-[#0a0a0a] p-3 shadow-[0_20px_50px_rgba(0,0,0,0.45)]">
                <label className="flex h-10 items-center gap-2 rounded-[5px] bg-white/[0.04] px-3 focus-within:bg-white/[0.07]">
                  <Search size={15} className="text-white/35" />
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar idioma" className="min-w-0 flex-1 bg-transparent text-[12px] text-white outline-none placeholder:text-white/25" autoFocus />
                </label>
                <div className="mt-2 max-h-[150px] overflow-y-auto">
                  {filteredLanguages.map((language) => (
                    <button key={language.name} type="button" onClick={() => chooseLanguage(language.name)} className={`flex w-full items-center gap-3 rounded-[4px] px-3 py-2 text-left text-[12px] transition hover:bg-white/[0.06] ${selectedLanguage === language.name ? "bg-white/[0.08] text-white" : "text-white/55"}`}>
                      <span className="text-[16px]">{language.flag}</span><span className="flex-1">{language.name}</span>{selectedLanguage === language.name ? <Check size={13} /> : null}
                    </button>
                  ))}
                  {filteredLanguages.length === 0 ? <p className="px-3 py-5 text-center text-[11px] text-white/30">Nenhum idioma encontrado.</p> : null}
                </div>
              </div>
            ) : null}

            <button type="button" onClick={handleContinue} disabled={!selectedLanguage} className="mt-7 inline-flex h-11 w-full items-center justify-center rounded-[5px] bg-[#f3efe8] text-[13px] font-semibold text-black transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40">Continuar</button>
          </div>
        </section>

        <aside className="relative hidden min-h-screen items-center justify-center overflow-hidden bg-[#010101] p-12 lg:flex">
          <div className="absolute inset-0 [background-image:radial-gradient(circle,rgba(255,255,255,0.16)_1px,transparent_1.2px)] [background-position:2px_2px] [background-size:32px_32px]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(37,99,235,0.08),transparent_38%,rgba(0,0,0,0.45)_78%)]" />
          <div className="relative z-10 flex min-h-[330px] w-full max-w-[340px] flex-col items-center justify-center rounded-[9px] bg-[#111]/90 p-8 text-center shadow-[0_30px_90px_rgba(0,0,0,0.65)]">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.045] text-white/32"><Store size={24} strokeWidth={1.5} /></span>
            <p className="mt-6 text-[16px] font-medium tracking-[-0.025em] text-white/55">Prévia da loja</p>
            <p className="mt-2 max-w-[220px] text-[12px] leading-relaxed text-white/27">Sua loja ganhará forma nas próximas etapas.</p>
          </div>
        </aside>
      </div>
    </main>
  );
};

export default StoreLanguagePage;
