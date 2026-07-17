import { useMemo, useState, type ComponentType } from "react";
import { Check, ChevronLeft, Globe2, Search, Store } from "lucide-react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  BD, BG, BR, CN, DE, DK, ES, FI, FR, GR, HR, HU, ID, IL, IN, IT, JP, KR,
  NL, NO, PL, PT, RO, SA, SE, SK, TH, TR, UA, US, ZA,
} from "country-flag-icons/react/3x2";
import type { ExampleProduct } from "@/pages/StartChoicePage";
import { saveProjectDraft } from "@/lib/userProjects";
import { readOnboardingProjectId } from "@/lib/onboardingProject";

// Emoji de bandeira não renderiza no Windows (a fonte do sistema não tem os
// indicadores regionais, e o Chrome cai para as letras "BR"/"PT"). Por isso as
// bandeiras vêm como SVG, que funciona igual em qualquer sistema.
type FlagComponent = ComponentType<{ className?: string; title?: string }>;
type LanguageOption = { name: string; Flag: FlagComponent };

// O catalão não é idioma de um país, então não tem bandeira própria.
const GenericFlag: FlagComponent = ({ className }) => (
  <Globe2 className={className} strokeWidth={1.6} />
);

const featuredLanguages: LanguageOption[] = [
  { name: "Português (Brasil)", Flag: BR },
  { name: "Português (Portugal)", Flag: PT },
  { name: "Inglês", Flag: US },
  { name: "Espanhol", Flag: ES },
  { name: "Francês", Flag: FR },
  { name: "Alemão", Flag: DE },
];

const otherLanguages: LanguageOption[] = [
  { name: "Africâner", Flag: ZA }, { name: "Árabe", Flag: SA },
  { name: "Bengali", Flag: BD }, { name: "Búlgaro", Flag: BG },
  { name: "Catalão", Flag: GenericFlag }, { name: "Chinês", Flag: CN },
  { name: "Coreano", Flag: KR }, { name: "Croata", Flag: HR },
  { name: "Dinamarquês", Flag: DK }, { name: "Eslovaco", Flag: SK },
  { name: "Finlandês", Flag: FI }, { name: "Grego", Flag: GR },
  { name: "Hebraico", Flag: IL }, { name: "Hindi", Flag: IN },
  { name: "Holandês", Flag: NL }, { name: "Húngaro", Flag: HU },
  { name: "Indonésio", Flag: ID }, { name: "Italiano", Flag: IT },
  { name: "Japonês", Flag: JP }, { name: "Norueguês", Flag: NO },
  { name: "Polonês", Flag: PL }, { name: "Romeno", Flag: RO },
  { name: "Sueco", Flag: SE }, { name: "Tailandês", Flag: TH },
  { name: "Turco", Flag: TR }, { name: "Ucraniano", Flag: UA },
];

// Bandeiras claras (Japão, Finlândia) somem no card branco sem o contorno.
const FLAG_CLASS = "h-[15px] w-[22px] shrink-0 rounded-[2px] object-cover ring-1 ring-black/10";

const StoreLanguagePage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const projectId =
    (location.state as { projectId?: string } | null)?.projectId ?? readOnboardingProjectId() ?? null;
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
  const [selectedLanguage, setSelectedLanguage] = useState("Português (Brasil)");
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
    const flowState = { product, language: selectedLanguage, projectId };
    sessionStorage.setItem("velo-store-language", selectedLanguage);
    // Persistência real: escolha é gravada no user_projects criado no passo anterior.
    // Falhas de rede não bloqueiam o wizard — sessionStorage é o cache de UI.
    if (projectId) {
      void saveProjectDraft(projectId, { language: selectedLanguage }).catch((err) => {
        console.error("saveProjectDraft (language) failed:", err);
      });
    }
    navigate("/onboarding/persona", { state: flowState });
  };

  return (
    <main className="min-h-screen bg-white text-[#101522]" style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
      <div className="grid min-h-screen lg:grid-cols-[55%_45%]">
        <section className="relative flex min-h-screen flex-col overflow-hidden px-7 py-7 sm:px-10 lg:px-16 lg:py-10 xl:px-24">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_38%_45%,rgba(15,23,42,0.04),transparent_38%)]" />
          <header className="relative z-10 flex items-center justify-between">
            <Link to="/onboarding/preparando-produto" state={{ product }} className="inline-flex items-center gap-2 text-[12px] font-medium text-[#111827]/45 transition hover:text-[#111827]">
              <ChevronLeft size={16} /> Voltar
            </Link>
            <div className="w-[42%] max-w-[310px]">
              <div className="h-[4px] overflow-hidden rounded-full bg-[#e4e7ef]">
                <div className="h-full w-[68%] rounded-full bg-black" />
              </div>
            </div>
          </header>

          <div className="relative z-10 my-auto w-full max-w-[620px] py-14">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#697083]">Personalize sua loja</p>
            <h1 className="mt-4 text-[40px] font-normal leading-[1.04] tracking-[-0.055em] text-[#101522] sm:text-[52px]">Que idioma falam seus clientes?</h1>
            <p className="mt-4 text-[15px] leading-relaxed text-[#687086]">Isso define o idioma da loja que você vai vender.</p>

            <div className="mt-8 grid gap-2 sm:grid-cols-2">
              {featuredLanguages.map((language, index) => {
                const selected = selectedLanguage === language.name;
                return (
                  <button key={language.name} type="button" onClick={() => chooseLanguage(language.name)} className={`flex h-[54px] items-center gap-3 rounded-[10px] border px-4 text-left outline-none transition hover:-translate-y-0.5 hover:border-black/30 hover:bg-white hover:shadow-[0_14px_34px_rgba(15,23,42,0.07)] focus-visible:ring-4 focus-visible:ring-black/10 ${selected ? "border-black bg-white shadow-[inset_3px_0_0_rgba(0,0,0,0.82),0_14px_34px_rgba(15,23,42,0.08)]" : "border-[#dfe4ef] bg-white"} ${index === featuredLanguages.length - 1 ? "sm:col-span-2" : ""}`}>
                    <language.Flag className={FLAG_CLASS} title={language.name} />
                    <span className={`flex-1 text-[13px] font-medium ${selected ? "text-[#101522]" : "text-[#697083]"}`}>{language.name}</span>
                    {selected ? <Check size={15} className="text-[#101522]" /> : null}
                  </button>
                );
              })}
            </div>

            <div className="my-6 h-px bg-[#e7ebf2]" />
            <button type="button" onClick={() => setShowOtherLanguages((current) => !current)} aria-expanded={showOtherLanguages} className={`flex w-full items-center gap-3 rounded-[10px] border p-4 text-left transition hover:-translate-y-0.5 hover:border-black/30 hover:shadow-[0_14px_34px_rgba(15,23,42,0.07)] ${showOtherLanguages ? "border-black bg-white" : "border-[#dfe4ef] bg-white"}`}>
              <Globe2 size={18} className="text-[#697083]" />
              <span className="flex-1"><span className="block text-[13px] font-medium text-[#101522]">Outro idioma</span><span className="mt-1 block text-[11px] text-[#8b94a6]">Pesquisar entre mais idiomas</span></span>
              {otherLanguages.some((language) => language.name === selectedLanguage) ? <Check size={15} /> : null}
            </button>

            {showOtherLanguages ? (
              <div className="mt-2 rounded-[10px] border border-[#dfe4ef] bg-white p-3 shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
                <label className="flex h-10 items-center gap-2 rounded-[8px] bg-[#f5f6f8] px-3 focus-within:bg-[#eef0f5]">
                  <Search size={15} className="text-[#8b94a6]" />
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar idioma" className="min-w-0 flex-1 bg-transparent text-[12px] text-[#101522] outline-none placeholder:text-[#8b94a6]" autoFocus />
                </label>
                <div className="mt-2 max-h-[150px] overflow-y-auto">
                  {filteredLanguages.map((language) => (
                    <button key={language.name} type="button" onClick={() => chooseLanguage(language.name)} className={`flex w-full items-center gap-3 rounded-[6px] px-3 py-2 text-left text-[12px] transition hover:bg-[#f5f6f8] ${selectedLanguage === language.name ? "bg-[#eef0f5] text-[#101522]" : "text-[#697083]"}`}>
                      <language.Flag className={FLAG_CLASS} title={language.name} /><span className="flex-1">{language.name}</span>{selectedLanguage === language.name ? <Check size={13} /> : null}
                    </button>
                  ))}
                  {filteredLanguages.length === 0 ? <p className="px-3 py-5 text-center text-[11px] text-[#8b94a6]">Nenhum idioma encontrado.</p> : null}
                </div>
              </div>
            ) : null}

            <button type="button" onClick={handleContinue} disabled={!selectedLanguage} className="mt-7 inline-flex h-11 w-full items-center justify-center rounded-[10px] bg-black text-[13px] font-semibold text-white shadow-[0_16px_34px_rgba(0,0,0,0.14)] transition hover:-translate-y-0.5 hover:bg-[#202020] disabled:cursor-not-allowed disabled:bg-[#d8dde8] disabled:text-[#8b94a6] disabled:shadow-none">Continuar</button>
          </div>
        </section>

        <aside className="relative hidden min-h-screen items-center justify-center overflow-hidden border-l border-[#edf0f5] bg-white p-12 lg:flex">
          <div className="absolute inset-0 opacity-80 [background-image:radial-gradient(circle,rgba(0,0,0,0.26)_1.8px,transparent_2px)] [background-position:2px_2px] [background-size:30px_30px]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.68),rgba(255,255,255,0.18)_42%,rgba(255,255,255,0.48)_78%)]" />
          <div className="relative z-10 flex min-h-[330px] w-full max-w-[340px] flex-col items-center justify-center rounded-[18px] border border-[#dfe4ef] bg-white p-8 text-center shadow-[0_28px_80px_rgba(15,23,42,0.08)]">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#f5f6f8] text-[#101522]"><Store size={24} strokeWidth={1.5} /></span>
            <p className="mt-6 text-[16px] font-medium tracking-[-0.025em] text-[#101522]">Prévia da loja</p>
            <p className="mt-2 max-w-[220px] text-[12px] leading-relaxed text-[#687086]">Sua loja ganhará forma nas próximas etapas.</p>
          </div>
        </aside>
      </div>
    </main>
  );
};

export default StoreLanguagePage;
