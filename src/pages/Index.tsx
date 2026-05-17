import { Link, useNavigate } from "react-router-dom";
import { useState, FormEvent } from "react";
import { useAuth } from "@/contexts/AuthContext";
import Footer from "@/components/landing/Footer";

const ACCENT = "#2563EB";

// Real product photos from Unsplash for the hero mosaic background.
const PRODUCT_IMAGES = [
  "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400",
  "https://images.unsplash.com/photo-1585386959984-a4155224a1ad?w=400",
  "https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=400",
  "https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=400",
  "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=400",
  "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=400",
  "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400",
  "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=400",
  "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400",
  "https://images.unsplash.com/photo-1560343090-f0409e92791a?w=400",
  "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400",
  "https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=400",
  "https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=400",
  "https://images.unsplash.com/photo-1581235720704-06d3acfcb36f?w=400",
  "https://images.unsplash.com/photo-1542219550-37153d387c27?w=400",
  "https://images.unsplash.com/photo-1583394838336-acd977736f90?w=400",
  "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=400",
  "https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=400",
  "https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=400",
  "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=400",
];

// Split into 4 columns, each shuffled differently.
const buildColumn = (offset: number) => {
  const arr = [...PRODUCT_IMAGES];
  return [...arr.slice(offset), ...arr.slice(0, offset)];
};
const COLUMNS = [buildColumn(0), buildColumn(5), buildColumn(10), buildColumn(15)];

const STEPS = [
  { n: "01", title: "Escolha um produto", desc: "Navegue por milhares de produtos prontos com alta margem de lucro.", emoji: "🛍️" },
  { n: "02", title: "Publique no Mercado Livre", desc: "Nossa IA cria título, fotos e descrição otimizadas em segundos.", emoji: "🚀" },
  { n: "03", title: "Receba e a gente envia", desc: "Quando vender, o fornecedor envia direto pro seu cliente. Você só recebe.", emoji: "💰" },
];

const Index = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");

  const handleEmailSubmit = (e: FormEvent) => {
    e.preventDefault();
    navigate("/cadastro", { state: { email } });
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-white text-[#0a0a0a]" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Keyframes for infinite vertical scroll */}
      <style>{`
        @keyframes velo-scroll-up {
          0% { transform: translateY(0); }
          100% { transform: translateY(-50%); }
        }
        @keyframes velo-scroll-down {
          0% { transform: translateY(-50%); }
          100% { transform: translateY(0); }
        }
      `}</style>

      <main>
        {/* ── HERO ── */}
        <section className="relative min-h-screen w-full overflow-hidden bg-[#1a1a1a]">
          {/* Mosaic background — 4 animated columns */}
          <div className="absolute inset-0 grid grid-cols-2 gap-3 p-3 md:grid-cols-4">
            {COLUMNS.map((col, colIdx) => {
              const goesUp = colIdx % 2 === 0;
              const duration = 50 + colIdx * 6; // 50s, 56s, 62s, 68s
              return (
                <div key={colIdx} className="relative h-full overflow-hidden">
                  <div
                    className="flex flex-col gap-3"
                    style={{
                      animation: `${goesUp ? "velo-scroll-up" : "velo-scroll-down"} ${duration}s linear infinite`,
                    }}
                  >
                    {/* Duplicate the column for seamless loop */}
                    {[...col, ...col].map((src, i) => (
                      <div
                        key={`${colIdx}-${i}`}
                        className="h-[260px] w-full shrink-0 overflow-hidden rounded-2xl bg-[#1a1a1a]"
                      >
                        <img
                          src={src}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Soft dark wash for legibility */}
          <div className="absolute inset-0 bg-black/20" />

          {/* Centered card */}
          <div className="relative mx-auto flex min-h-screen max-w-[1200px] items-center justify-center px-6 py-20">
            <div
              className="w-full max-w-[600px] rounded-[28px] bg-white p-10 text-center md:p-14"
              style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}
            >
              <h1 className="mb-5 font-bold leading-[1.05] tracking-[-0.035em] text-[#0a0a0a]" style={{ fontSize: "clamp(2.5rem, 5.5vw, 3.5rem)" }}>
                Sua renda extra<br />começa aqui
              </h1>

              <p className="mb-9 text-[16px] leading-[1.55] text-[#525252]">
                Venda no Mercado Livre sem ter estoque.<br />Comece grátis hoje.
              </p>

              <p className="mb-8 text-[15.5px] leading-[1.55] text-[#525252]">
                Venda no Mercado Livre sem ter estoque.<br />Comece grátis hoje.
              </p>

              <form
                onSubmit={handleEmailSubmit}
                className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-0 sm:rounded-full sm:border sm:border-[#0a0a0a]/15 sm:bg-white sm:p-1 sm:focus-within:border-[#0a0a0a]/40"
              >
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Digite seu email"
                  className="flex-1 rounded-full border border-[#0a0a0a]/15 bg-white px-5 py-3 text-[14.5px] text-[#0a0a0a] placeholder:text-[#a3a3a3] focus:outline-none sm:border-0 sm:py-2.5"
                />
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[#0a0a0a] px-6 py-3 text-[14px] font-semibold text-white transition hover:bg-[#1a1a1a] sm:py-2.5"
                >
                  Começar agora
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </form>

              <p className="mt-4 text-[12.5px] text-[#737373]">
                Sem cartão de crédito. Cancele quando quiser.
              </p>
            </div>
          </div>
        </section>

        {/* ── COMO FUNCIONA ── */}
        <section id="como-funciona" className="mx-auto max-w-[1200px] px-6 py-24 md:px-8 md:py-32">
          <div className="mb-14 text-center">
            <span
              className="inline-flex items-center rounded-full px-4 py-1.5 text-[12px] font-semibold uppercase tracking-wider text-white"
              style={{ background: ACCENT, borderRadius: 50 }}
            >
              Como funciona
            </span>
            <h2 className="mt-5 text-[clamp(2rem,4vw,3rem)] font-bold leading-[1.1] tracking-[-0.03em]">
              Três passos para sua<br />primeira venda
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {STEPS.map((step) => (
              <div
                key={step.n}
                className="rounded-[24px] border border-[#0a0a0a]/[0.08] bg-white p-8 transition hover:shadow-[0_20px_50px_-20px_rgba(0,0,0,0.15)]"
              >
                <div className="mb-6 flex items-center justify-between">
                  <div
                    className="flex h-12 w-12 items-center justify-center text-2xl"
                    style={{ background: "#F5F5F5", borderRadius: 50 }}
                  >
                    {step.emoji}
                  </div>
                  <span className="text-[13px] font-bold tracking-wider" style={{ color: ACCENT }}>
                    {step.n}
                  </span>
                </div>
                <h3 className="mb-2 text-[20px] font-bold tracking-[-0.02em] text-[#0a0a0a]">
                  {step.title}
                </h3>
                <p className="text-[14.5px] leading-[1.6] text-[#525252]">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-14 text-center">
            <Link
              to="/cadastro"
              className="inline-flex items-center gap-2 px-8 py-4 text-[15px] font-semibold text-white transition hover:brightness-110"
              style={{ background: ACCENT, borderRadius: 50 }}
            >
              Começar grátis agora
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>
        </section>

        <Footer />
      </main>
    </div>
  );
};

export default Index;
