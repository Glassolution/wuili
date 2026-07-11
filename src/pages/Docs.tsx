import { useState } from "react";
import {
  Activity,
  ChevronDown,
  GalleryHorizontalEnd,
  Heart,
  Image,
  BookOpen,
  MessageCircle,
  Search,
  Send,
  UserRound,
  Users,
  Zap,
} from "lucide-react";

type FeedPost = {
  id: string;
  author: string;
  time: string;
  avatar: string;
  badge?: string;
  body: string;
  image?: string;
  likes: number;
  comments: number;
};

const posts: FeedPost[] = [
  {
    id: "shopkit",
    author: "Tanishq Gautam",
    time: "Now",
    avatar: "https://i.pravatar.cc/96?img=12",
    badge: "Pro Expert",
    body: "Hey everyone! 👋\n\nI’ve built ShopKit, a Framer × Shopify plugin, and I’m currently looking for someone interested in acquiring it.\n\nI’d love to continue building and growing it, but due to time constraints, I’m not able to give it the attention it deserves right now. Rather than letting the project sit idle, I’d prefer",
    likes: 0,
    comments: 0,
  },
  {
    id: "elara",
    author: "Divine Samuel",
    time: "8m",
    avatar: "https://api.dicebear.com/9.x/notionists/svg?seed=Divine&backgroundColor=c0a96b",
    body: "Building Lightfall A photography portfolio template Rich imagery, Thoughtful typography.\nStill refining the details, but it's coming together nicely.",
    image: "/community-elara-voss.png",
    likes: 0,
    comments: 0,
  },
];

const suggestions = [
  { name: "N!nh™ Studio", handle: "@ninhstudio", avatar: "n2" },
  { name: "Muhammed Farouk", handle: "@muhammed-farouk", avatar: "https://i.pravatar.cc/80?img=11" },
  { name: "Andreu", handle: "@andreu", avatar: "https://i.pravatar.cc/80?img=68" },
  { name: "Mara Furqaan", handle: "@factortheme", avatar: "https://i.pravatar.cc/80?img=53" },
  { name: "Michael Andreuzza", handle: "@michael-andreuzza", avatar: "https://i.pravatar.cc/80?img=5" },
];

const navGroups = [
  {
    title: "Explore",
    items: [
      { label: "Feed", icon: Zap, active: true },
      { label: "Tutorial", icon: BookOpen },
      { label: "Activity", icon: Activity },
    ],
  },
  {
    title: "Community",
    items: [
      { label: "Marketplace", icon: GalleryHorizontalEnd },
      { label: "Gallery", icon: Image },
      { label: "Members", icon: Users },
    ],
  },
];

function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen w-[368px] shrink-0 border-r border-white/[0.08] bg-[#0d0d0e] px-[14px] py-3 lg:block">
      <button className="flex h-[54px] w-full items-center gap-3 text-left">
        <span className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-white/10 bg-[#2b2b2d] text-[#a5a5a9]">
          <UserRound className="h-[19px] w-[19px]" strokeWidth={1.6} />
        </span>
        <span className="min-w-0 flex-1 truncate text-[17px] font-semibold text-[#f2f2f3]">Felipe Xavier</span>
        <ChevronDown className="h-4 w-4 text-[#8b8b90]" />
      </button>

      <div className="mt-1 border-t border-white/[0.08] pt-[14px]">
        <label className="relative block">
          <Search className="absolute left-[15px] top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-[#aaaab0]" />
          <input disabled placeholder="Search..." className="h-[43px] w-full rounded-[9px] border-0 bg-[#242425] pl-[46px] pr-3 text-[16px] text-white outline-none placeholder:text-[#8d8d92]" />
        </label>
      </div>

      <nav className="mt-[14px] border-t border-white/[0.08] pt-[20px]">
        {navGroups.map((group, groupIndex) => (
          <section key={group.title} className={groupIndex ? "mt-[29px] border-t border-white/[0.08] pt-[22px]" : ""}>
            <h2 className="mb-[12px] px-[7px] text-[16px] font-semibold text-white">{group.title}</h2>
            <div className="space-y-[4px]">
              {group.items.map(({ label, icon: Icon, active }) => (
                <button key={label} className={`flex h-[43px] w-full items-center gap-[14px] rounded-[9px] px-[13px] text-[16px] font-medium transition ${active ? "bg-[#272728] text-white" : "text-[#89898f] hover:bg-white/[0.04] hover:text-white"}`}>
                  <Icon className="h-[18px] w-[18px]" strokeWidth={1.7} />
                  {label}
                </button>
              ))}
            </div>
          </section>
        ))}
      </nav>
    </aside>
  );
}

function Post({ post }: { post: FeedPost }) {
  const [liked, setLiked] = useState(false);
  return (
    <article className="border-b border-white/[0.08] py-[24px]">
      <div className="flex gap-[18px]">
        <img src={post.avatar} alt="" className="h-[42px] w-[42px] shrink-0 rounded-[10px] border border-white/10 bg-[#29292b] object-cover" />
        <div className="min-w-0 flex-1">
          <header className="flex flex-wrap items-center gap-[8px]">
            <strong className="text-[17px] font-semibold leading-none text-white">{post.author}</strong>
            {post.badge && <span className="rounded-[6px] border border-white/10 bg-[#202021] px-[8px] py-[3px] text-[13px] font-medium text-[#929298]">{post.badge}</span>}
            <span className="text-[16px] font-medium text-[#67676c]">{post.time}</span>
          </header>
          <p className="mt-[12px] whitespace-pre-line text-[17px] font-medium leading-[1.58] text-[#c8c8cb]">{post.body}</p>
          {post.id === "shopkit" && <button className="mt-[2px] text-[17px] font-medium text-[#626267]">Read more</button>}

          {post.image && (
            <div className="relative mt-[20px] aspect-[1.57/1] overflow-hidden rounded-[15px] border border-white/10">
              <img src={post.image} alt="Elara Voss wedding portfolio" className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-black/10" />
              <div className="absolute left-[24px] right-[24px] top-[18px] flex items-center justify-between text-[11px] font-semibold text-white">
                <span>ELARA VOSS</span>
                <span className="flex gap-4 text-[9px] font-medium"><span>Portfolio</span><span>About</span><span>Services</span><span>Gallery</span><span>Contact</span></span>
              </div>
              <p className="absolute bottom-[37%] left-[35px] max-w-[340px] text-[9px] leading-[1.35] text-white">Elara Voss is a New York-based photographer/videographer composing cinematic imagery for weddings, fashion houses, and the world’s most considered hotels.</p>
              <div className="absolute bottom-[35px] left-[28px] right-[28px] flex items-end justify-between">
                <span className="text-[76px] font-semibold leading-[0.82] tracking-[-0.07em] text-white">ELARA VOSS</span>
              </div>
              <div className="absolute bottom-[13px] left-[34px] right-[34px] flex justify-between text-[8px] font-medium text-white"><span>Photography</span><span>Videography</span><span>10+ Years</span><span>New York&nbsp;&nbsp;17:09:04</span></div>
            </div>
          )}

          <div className="mt-[19px] flex items-center gap-[25px]">
            <button onClick={() => setLiked((value) => !value)} aria-label="Curtir" className="text-[#85858a] transition hover:text-white">
              <Heart className={`h-[21px] w-[21px] ${liked ? "fill-white text-white" : ""}`} strokeWidth={1.7} />
            </button>
            <button aria-label="Comentar" className="text-[#85858a] transition hover:text-white"><MessageCircle className="h-[21px] w-[21px]" strokeWidth={1.7} /></button>
          </div>
        </div>
      </div>
    </article>
  );
}

function RightRail() {
  return (
    <aside className="sticky top-0 hidden h-screen w-[428px] shrink-0 overflow-y-auto bg-[#0d0d0e] pb-10 pt-[87px] xl:block">
      <section className="rounded-[27px] border border-white/[0.08] bg-[#19191a] p-[21px]">
        <h2 className="text-[17px] font-semibold text-white">Welcome back</h2>
        <p className="mt-[12px] text-[16px] font-medium leading-[1.5] text-[#9b9ba1]">Know someone who’d love this community?<br />Share your invite link and get them in.</p>
        <div className="mt-[20px] grid grid-cols-2 gap-[12px]">
          <button className="h-[43px] rounded-[10px] bg-[#159ff2] text-[16px] font-semibold text-white">Copy Invite</button>
          <button className="h-[43px] rounded-[10px] bg-[#272728] text-[16px] font-semibold text-white">Open Framer</button>
        </div>
      </section>

      <section className="mt-[21px] rounded-[27px] border border-white/[0.08] bg-[#19191a] p-[21px]">
        <h2 className="text-[17px] font-semibold text-white">Suggested for you</h2>
        <div className="mt-[20px] space-y-[13px]">
          {suggestions.map((person) => (
            <div key={person.handle} className="flex items-center gap-[13px]">
              {person.avatar.startsWith("http") ? <img src={person.avatar} alt="" className="h-[42px] w-[42px] shrink-0 rounded-[10px] object-cover" /> : <span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[10px] bg-[#29292b] text-[12px] font-bold text-white">{person.avatar}</span>}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[16px] font-semibold leading-none text-white">{person.name}</p>
                <p className="mt-[5px] truncate text-[15px] font-medium text-[#9a9aa0]">{person.handle}</p>
              </div>
              <button className="h-[42px] rounded-[10px] bg-[#272728] px-[16px] text-[15px] font-semibold text-white">Follow</button>
            </div>
          ))}
        </div>
      </section>
    </aside>
  );
}

export default function Docs() {
  return (
    <div
      className="min-h-screen overflow-x-hidden bg-[#0d0d0e] font-['Inter_Variable','Inter',ui-sans-serif,system-ui,sans-serif] text-white"
      style={{
        zoom: 0.71,
      }}
    >
      <div className="mx-auto flex min-h-screen max-w-[2048px]">
        <Sidebar />
        <main className="min-h-screen min-w-0 flex-1 bg-[#0d0d0e] xl:w-[1040px] xl:flex-none">
          <header className="sticky top-0 z-30 flex h-[66px] w-[calc(140.845071vw-368px)] items-center justify-between border-b border-white/[0.08] bg-[#0d0d0e]/95 px-[14px] backdrop-blur">
            <div className="flex items-center gap-[18px]">
              <button className="rounded-[9px] bg-[#28282a] px-[16px] py-[11px] text-[16px] font-semibold">For You</button>
              <button className="py-[11px] text-[16px] font-medium text-[#737378]">Following</button>
            </div>
            <button className="rounded-[10px] bg-[#159ff2] px-[19px] py-[11px] text-[16px] font-semibold">Post</button>
          </header>

          <div className="pb-[20px] pl-[158px] pr-[28px] pt-[20px]">
            <div className="flex items-center gap-[20px]">
              <span className="flex h-[42px] w-[42px] items-center justify-center rounded-[10px] border border-white/10 bg-[#29292b] text-[#9b9ba0]"><UserRound className="h-[20px] w-[20px]" /></span>
              <div className="h-[42px] flex-1 border-b border-white/[0.08] text-[16px] font-medium leading-[42px] text-[#626267]">Share something...</div>
            </div>
          </div>

          <div className="relative ml-[158px] mr-[28px]">
            <button className="absolute left-1/2 top-[23px] z-20 flex -translate-x-1/2 items-center gap-2 rounded-[11px] border border-white/20 bg-[#252526] px-[15px] py-[10px] text-[15px] font-semibold shadow-xl"><Send className="h-4 w-4 -rotate-45" /> 4 new posts</button>
            {posts.map((post) => <Post key={post.id} post={post} />)}
          </div>
        </main>
        <div className="hidden w-[56px] shrink-0 xl:block" />
        <RightRail />
        <div className="hidden w-[20px] shrink-0 xl:block" />
      </div>
    </div>
  );
}
