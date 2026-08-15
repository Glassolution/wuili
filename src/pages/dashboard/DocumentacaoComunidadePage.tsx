import { useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Lock,
  Maximize2,
  MoreVertical,
  Play,
  Volume2,
} from "lucide-react";
import AtlasAvatarIcon from "@/components/dashboard/AtlasAvatarIcon";
import { cn } from "@/lib/utils";

type CourseLesson = {
  id: string;
  title: string;
  duration: string;
  description: string;
  locked?: boolean;
  videoSrc?: string;
};

const lessons: CourseLesson[] = [
  {
    id: "welcome",
    title: "Welcome to AI Dropshipping",
    duration: "03:03",
    description:
      "In this video, I'll introduce myself and my colleagues at PagePilot, and give you a quick overview of what you can expect from this course.",
  },
  {
    id: "store",
    title: "Build Your FREE AI Store",
    duration: "10:37",
    description:
      "Build the store foundation before moving into product research and publishing.",
    locked: true,
  },
  {
    id: "setup",
    title: "Setting Up Your Shopify Store",
    duration: "12:24",
    description:
      "Prepare theme, checkout, domain and the essential pages for the first visitors.",
    locked: true,
  },
  {
    id: "research",
    title: "Traditional Product Research",
    duration: "08:55",
    description:
      "Learn product validation, margin, visual appeal and market demand signals.",
    locked: true,
  },
  {
    id: "research-ai",
    title: "Product Research using PagePilot.ai",
    duration: "05:54",
    description:
      "Use AI research to find opportunities with less trial and error.",
    locked: true,
  },
  {
    id: "landing",
    title: "Product import and landing page creation using AI",
    duration: "20:53",
    description:
      "Turn a selected product into a page ready for testing.",
    locked: true,
  },
  {
    id: "creative",
    title: "Creating Winning Ads",
    duration: "14:18",
    description:
      "Create short scripts, strong hooks and clear CTAs for faster testing.",
    locked: true,
  },
  {
    id: "ads",
    title: "Launching Your First Campaigns",
    duration: "16:42",
    description:
      "Set budget, creatives, audiences and testing rules.",
    locked: true,
  },
  {
    id: "metrics",
    title: "Reading Your Metrics",
    duration: "09:36",
    description:
      "Understand CTR, CPC, CPA, margin and when to pause or scale.",
    locked: true,
  },
  {
    id: "support",
    title: "Support, Refunds and Post-sale",
    duration: "07:21",
    description:
      "Organize customer communication and reduce friction.",
    locked: true,
  },
  {
    id: "scale",
    title: "Scaling Safely",
    duration: "11:48",
    description:
      "Increase budgets and build a weekly optimization routine.",
    locked: true,
  },
  {
    id: "plan",
    title: "Your 30 Day Plan",
    duration: "06:35",
    description:
      "Close the course with a practical calendar for execution.",
    locked: true,
  },
];

const completedLessonIds = new Set<string>();

const instructor = {
  name: "Radu Dalas",
  role: "Dropshipping Expert",
};

export default function DocumentacaoComunidadePage() {
  const [selectedId, setSelectedId] = useState(lessons[0].id);
  const selectedLesson = lessons.find((lesson) => lesson.id === selectedId) ?? lessons[0];
  const completedCount = completedLessonIds.size;
  const progress = Math.round((completedCount / lessons.length) * 100);

  const selectedIndex = useMemo(
    () => Math.max(0, lessons.findIndex((lesson) => lesson.id === selectedLesson.id)),
    [selectedLesson.id],
  );

  return (
    <div className="mx-auto w-full max-w-[1660px] text-[#080B14]">
      <div className="w-full pb-6">
        <header className="mb-5 flex items-center gap-3">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[#080B14] transition hover:bg-[#EEF2FF]"
            aria-label="Voltar"
          >
            <ArrowLeft size={22} strokeWidth={2.5} />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-[23px] font-black leading-tight text-[#080B14] md:text-[25px]">
              $100K AI Dropshipping Blueprint
            </h1>
          </div>
        </header>

        <main className="grid gap-5 rounded-[22px] border border-[#D9DEE7] bg-white p-5 shadow-[0_12px_34px_rgba(15,23,42,0.06)] xl:grid-cols-[minmax(0,1fr)_470px] 2xl:grid-cols-[minmax(0,1fr)_510px]">
          <section className="min-w-0">
            <CoursePlayer lesson={selectedLesson} />

            <div className="mt-6 max-w-[900px]">
              <h2 className="text-[23px] font-black leading-tight text-[#080B14] md:text-[26px]">
                Welcome to AI Dropshipping
              </h2>
              <p className="mt-3 max-w-[900px] text-[15px] leading-[1.65] text-[#101828]">
                In this video, I'll introduce myself and my colleagues at PagePilot, and give you a quick overview of what
                you can expect from this course.
              </p>

              <div className="mt-8 flex items-center gap-4">
                <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-[12px] bg-[#EEF2FF] ring-1 ring-[#D9E2FF]">
                  <AtlasAvatarIcon size={32} animated={false} />
                </div>
                <div>
                  <p className="text-[16px] font-black text-[#080B14]">{instructor.name}</p>
                  <p className="text-[14px] font-semibold text-[#667085]">{instructor.role}</p>
                </div>
              </div>
            </div>
          </section>

          <aside className="min-w-0 rounded-[20px] border border-[#E4E7EC] bg-white p-5">
            <ProgressCard progress={progress} completed={completedCount} total={lessons.length} />

            <div className="mt-7 flex items-center justify-between">
              <h3 className="text-[18px] font-black text-[#080B14]">Chapters</h3>
              <span className="text-[18px] font-black text-[#080B14]">
                {completedCount}/{lessons.length}
              </span>
            </div>

            <div className="mt-4 max-h-[620px] space-y-3 overflow-y-auto pr-1">
              {lessons.map((lesson, index) => (
                <LessonButton
                  key={lesson.id}
                  lesson={lesson}
                  index={index}
                  active={lesson.id === selectedLesson.id}
                  completed={completedLessonIds.has(lesson.id)}
                  onSelect={() => {
                    if (!lesson.locked) setSelectedId(lesson.id);
                  }}
                />
              ))}
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
}

const CoursePlayer = ({ lesson }: { lesson: CourseLesson }) => {
  if (lesson.videoSrc) {
    return (
      <video
        src={lesson.videoSrc}
        controls
        className="aspect-video w-full rounded-[20px] bg-black object-cover shadow-[0_16px_38px_rgba(15,23,42,0.16)]"
      />
    );
  }

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-[20px] bg-[#05051B] shadow-[0_16px_38px_rgba(15,23,42,0.16)]">
      <div className="absolute inset-0 opacity-70 [background-image:radial-gradient(circle_at_12%_18%,rgba(255,255,255,0.55)_0_1px,transparent_1.5px),radial-gradient(circle_at_34%_10%,rgba(255,255,255,0.35)_0_1px,transparent_1.5px),radial-gradient(circle_at_70%_22%,rgba(255,255,255,0.42)_0_1px,transparent_1.5px),radial-gradient(circle_at_84%_42%,rgba(255,255,255,0.35)_0_1px,transparent_1.5px),radial-gradient(circle_at_22%_72%,rgba(255,255,255,0.35)_0_1px,transparent_1.5px)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_76%_52%,rgba(37,99,235,0.26),transparent_24%),radial-gradient(circle_at_44%_44%,rgba(37,99,235,0.18),transparent_35%)]" />

      <div className="absolute left-1/2 top-[21%] flex -translate-x-1/2 items-center gap-4">
        <span className="grid h-12 w-12 place-items-center rounded-[12px] bg-[#2563EB] shadow-[0_12px_28px_rgba(37,99,235,0.34)]">
          <AtlasAvatarIcon size={36} animated={false} />
        </span>
        <span className="text-[25px] font-black tracking-[-0.01em] text-white">
          PAGE<span className="font-medium text-white/80">PILOT</span>
        </span>
      </div>

      <div className="absolute inset-x-10 top-[40%] text-center">
        <p className="whitespace-nowrap text-[clamp(30px,3.35vw,54px)] font-black leading-none text-[#C7D7FE] drop-shadow-[0_6px_24px_rgba(147,197,253,0.28)]">
          $100K AI Dropshipping Blueprint
        </p>
        <p className="mt-5 text-[clamp(18px,1.9vw,31px)] font-bold text-white">
          From Zero to a $100k Store in 30 Days
        </p>
      </div>

      <div className="absolute bottom-[14%] right-[12%] h-[30%] w-[12%] rotate-[28deg] rounded-[70%_70%_45%_45%] border border-white/10 bg-[linear-gradient(140deg,rgba(255,255,255,0.16),rgba(37,99,235,0.04))] shadow-[0_0_60px_rgba(255,120,130,0.25)]">
        <span className="absolute left-1/2 top-[-18%] h-[54%] w-[54%] -translate-x-1/2 rounded-full border border-cyan-200/30 bg-cyan-300/10 blur-[1px]" />
        <span className="absolute bottom-[-18%] left-1/2 h-[34%] w-[48%] -translate-x-1/2 rounded-full bg-rose-400/30 blur-md" />
      </div>

      <div className="absolute inset-x-5 bottom-5">
        <div className="flex items-center gap-5 text-white">
          <Play size={22} fill="currentColor" />
          <span className="text-[18px] font-bold">0:00 / {lesson.duration}</span>
          <div className="ml-auto flex items-center gap-5">
            <Volume2 size={22} />
            <Maximize2 size={21} />
            <MoreVertical size={21} />
          </div>
        </div>
        <div className="mt-4 h-1.5 rounded-full bg-white/30">
          <div className="h-full w-[2%] rounded-full bg-white" />
        </div>
      </div>
    </div>
  );
};

const ProgressCard = ({ progress }: { progress: number; completed: number; total: number }) => (
  <div className="rounded-[18px] border border-[#E4E7EC] bg-white p-6">
    <p className="text-[17px] font-black text-[#080B14]">
      Your Progress <span className="text-[#2563EB]">{progress}%</span>
    </p>
    <div className="mt-7 h-5 rounded-full bg-[#E5E7EB]">
      <div className="h-full rounded-full bg-[#2563EB]" style={{ width: `${progress}%` }} />
    </div>
    <div className="mt-3 grid grid-cols-5 text-center text-[14px] font-bold text-[#667085]">
      <span>0%</span>
      <span>25%</span>
      <span>50%</span>
      <span>75%</span>
      <span>100%</span>
    </div>
    <div className="mt-7 rounded-[14px] border border-[#E4E7EC] bg-[#F8FAFC] p-5">
      <p className="text-[15px] font-bold leading-[1.55] text-[#475467]">
        🚀 You're taking the first steps toward your dropshipping success! Each lesson brings you closer to launching
        your profitable store.
      </p>
    </div>
  </div>
);

const LessonButton = ({
  lesson,
  index,
  active,
  completed,
  onSelect,
}: {
  lesson: CourseLesson;
  index: number;
  active: boolean;
  completed: boolean;
  onSelect: () => void;
}) => (
  <button
    type="button"
    onClick={onSelect}
    disabled={lesson.locked}
    className={cn(
      "group flex min-h-[72px] w-full items-center gap-4 rounded-[15px] border px-4 py-3 text-left transition",
      active
        ? "border-[#2563EB] bg-[#2563EB] text-white shadow-[0_14px_30px_rgba(37,99,235,0.28)]"
        : "border-[#E4E7EC] bg-white text-[#080B14] hover:border-[#CBD5E1] hover:bg-[#F8FAFC]",
      lesson.locked && "cursor-not-allowed opacity-95",
    )}
  >
    <span
      className={cn(
        "grid h-10 w-10 shrink-0 place-items-center rounded-full",
        active ? "bg-white text-[#2563EB]" : "bg-[#EFF6FF] text-[#2563EB]",
      )}
    >
      {completed ? <CheckCircle2 size={21} /> : <Play size={18} fill="currentColor" />}
    </span>
    <span className="min-w-0 flex-1">
      <span className={cn("block text-[14px] font-black leading-5", active ? "text-white" : "text-[#344054]")}>
        {lesson.title}
      </span>
      <span className={cn("mt-0.5 block text-[14px] font-bold", active ? "text-white/85" : "text-[#667085]")}>
        {lesson.duration}
      </span>
    </span>
    {active ? (
      <span className="rounded-[10px] bg-white px-3 py-2 text-[13px] font-black text-[#344054]">Next</span>
    ) : lesson.locked ? (
      <Lock size={21} className="shrink-0 text-[#2563EB]" />
    ) : (
      <ChevronRight size={20} className="shrink-0 text-[#98A2B3] transition group-hover:translate-x-0.5" />
    )}
  </button>
);
