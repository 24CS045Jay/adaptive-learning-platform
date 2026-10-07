import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  Check,
  ChevronLeft,
  ChevronRight,
  Cog,
  Database,
  FileText,
  Globe,
  Play,
  Network,
  Brain,
  Code2,
  BookOpen,
  Sparkles,
  Users,
  Zap,
  ShieldCheck,
  HelpCircle,
  MessageCircle,
  ListChecks,
  TrendingUp,
  Star,
  X,
} from "lucide-react";
import { Logo, Sparkle, ThemeToggle } from "@/components/brand";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AI Tutor · Your Personal AI Study Partner" },
      {
        name: "description",
        content:
          "AI Tutor is a RAG-powered study partner for CSPIT CSE — clear explanations, summaries, quizzes and personalised learning from your own syllabus.",
      },
      { property: "og:title", content: "AI Tutor · Your Personal AI Study Partner" },
    ],
  }),
  component: LandingPage,
});

const NAV = [
  { id: "home", label: "Home" },
  { id: "features", label: "Features" },
  { id: "subjects", label: "Subjects" },
  { id: "how", label: "How it Works" },
  { id: "about", label: "About" },
];

const SUBJECTS = [
  { icon: BarChart3, name: "Data Structures", desc: "Learn algorithms with step-by-step explanations", tone: "text-violet bg-violet/12", arrow: "bg-violet" },
  { icon: Database, name: "DBMS", desc: "Concepts, queries and real-world examples", tone: "text-emerald-500 bg-emerald-500/12", arrow: "bg-emerald-500" },
  { icon: Cog, name: "Operating System", desc: "Process, memory, file systems and more", tone: "text-blue-500 bg-blue-500/12", arrow: "bg-blue-500" },
  { icon: Network, name: "Computer Networks", desc: "Visualize concepts with diagrams", tone: "text-rose-500 bg-rose-500/12", arrow: "bg-rose-500" },
  { icon: Brain, name: "Machine Learning", desc: "From basics to advanced models", tone: "text-indigo-500 bg-indigo-500/12", arrow: "bg-indigo-500" },
  { icon: Code2, name: "Web Development", desc: "Build projects and learn modern tools", tone: "text-orange-500 bg-orange-500/12", arrow: "bg-orange-500" },
];

const STEPS = [
  { icon: HelpCircle, title: "Ask Your Doubt", desc: "Type your question or upload content", color: "from-violet-500 to-indigo-500" },
  { icon: MessageCircle, title: "Get AI Explanation", desc: "Receive clear, step-by-step answers", color: "from-sky-400 to-cyan-500" },
  { icon: ListChecks, title: "Practice & Learn", desc: "Solve questions and test your knowledge", color: "from-fuchsia-500 to-purple-500" },
  { icon: TrendingUp, title: "Track Progress", desc: "Improve with personalized recommendations", color: "from-emerald-400 to-teal-500" },
];

const TESTIMONIALS = [
  { name: "Priya Sharma", role: "CSE Student", img: "/assets/ui/av0.png", text: "AI Tutor explains concepts in such a simple way. It saves me so much time!" },
  { name: "Jay Ladva", role: "CSE Student", img: "/assets/ui/av1.png", text: "The summaries and practice questions are super helpful for exam preparation." },
  { name: "Manav Lakhani", role: "CSE Student", img: "/assets/ui/av2.png", text: "I love the step-by-step explanations. It's like having a personal teacher 24/7." },
  { name: "Riya Patel", role: "CSE Student", img: "/assets/ui/av0.png", text: "Answers come straight from our syllabus, so I never waste time on irrelevant material." },
];

const FLOAT_CHIPS = [
  { icon: BookOpen, label: "Explain Concepts", cls: "right-[0%] top-[4%]", rot: 4, c: "text-violet bg-violet/12" },
  { icon: FileText, label: "Summarize Notes", cls: "right-[-2%] top-[22%]", rot: 3, c: "text-emerald-500 bg-emerald-500/12" },
  { icon: Code2, label: "Solve Doubts", cls: "right-[0%] top-[40%]", rot: 3, c: "text-indigo-500 bg-indigo-500/12" },
  { icon: Brain, label: "Generate Quizzes", cls: "right-[2%] top-[58%]", rot: 2, c: "text-fuchsia-500 bg-fuchsia-500/12" },
];

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function LandingPage() {
  const [active, setActive] = useState("home");
  const [scrolled, setScrolled] = useState(false);
  const [slide, setSlide] = useState(0);
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 10);
      let cur = "home";
      for (const n of NAV) {
        const el = document.getElementById(n.id);
        if (el && el.getBoundingClientRect().top < window.innerHeight * 0.35) cur = n.id;
      }
      setActive(cur);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const visible = [0, 1, 2].map((i) => TESTIMONIALS[(slide + i) % TESTIMONIALS.length]);

  return (
    <div className="relative min-h-screen overflow-x-hidden font-sans text-foreground">
      {/* ───────── NAV ───────── */}
      <header className={cn("fixed inset-x-0 top-0 z-50 transition-all", scrolled ? "py-2" : "py-4")}>
        <div className="glass mx-auto flex max-w-[1320px] items-center justify-between gap-4 rounded-full border border-border px-5 py-2.5 shadow-[var(--card-shadow)]">
          <button onClick={() => scrollToId("home")} aria-label="AI Tutor home">
            <Logo size="sm" />
          </button>
          <nav className="hidden items-center gap-8 md:flex">
            {NAV.map((n) => (
              <button
                key={n.id}
                onClick={() => scrollToId(n.id)}
                className={cn(
                  "relative py-1 text-sm font-semibold transition-colors hover:text-violet",
                  active === n.id ? "text-violet" : "text-foreground/80",
                )}
              >
                {n.label}
                {active === n.id && <span className="absolute -bottom-1 left-0 right-0 h-0.5 rounded-full bg-violet" />}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <ThemeToggle className="hidden sm:inline-flex" />
            <Link to="/login" className="btn-pill-ghost !px-6 !py-2.5">
              Login
            </Link>
            <Link to="/login" className="btn-pill !px-6 !py-2.5">
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* ───────── HERO ───────── */}
      <section id="home" className="relative isolate pb-24 pt-32 lg:pt-36">
        <HeroBackdrop />
        <div className="mx-auto grid max-w-[1320px] items-center gap-10 px-6 lg:grid-cols-[1fr_1.05fr]">
          <div>
            <motion.span
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-4 py-1.5 text-xs font-bold text-violet"
            >
              <Sparkles className="h-3.5 w-3.5" /> Powered by RAG + AI
            </motion.span>
            <motion.h1
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="mt-5 text-[2.9rem] font-extrabold leading-[1.05] tracking-tight sm:text-[3.7rem] lg:text-[4.1rem]"
            >
              Your Personal
              <br />
              <span className="gradient-word">AI Study Partner</span>
            </motion.h1>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="mt-5 max-w-md text-lg leading-relaxed text-muted-foreground">
              Learn smarter, faster and deeper with AI-powered explanations, summaries, practice questions and more.
            </motion.p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link to="/login" className="btn-pill !px-8 !py-3.5 text-base">
                Get Started <ArrowRight className="h-4 w-4" />
              </Link>
              <button onClick={() => setDemo(true)} className="btn-pill-ghost !px-7 !py-3.5 text-base">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-violet text-white">
                  <Play className="h-3 w-3 fill-current" />
                </span>
                Watch Demo
              </button>
            </div>
            <div className="mt-9 flex items-center gap-3">
              <div className="flex -space-x-3">
                {["/assets/ui/av0.png", "/assets/ui/av1.png", "/assets/ui/av2.png", "/assets/ui/av0.png"].map((a, i) => (
                  <img key={i} src={a} alt="" className="h-10 w-10 rounded-full border-2 border-background object-cover" />
                ))}
              </div>
              <div className="text-sm leading-tight">
                <div className="font-extrabold">1000+ students</div>
                <div className="text-muted-foreground">are already learning smarter</div>
              </div>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[680px]">
            <div className="absolute inset-x-[8%] bottom-[8%] top-[10%] rounded-full bg-violet/25 blur-3xl" />
            <img src="/assets/ui/landing-hero.png" alt="Student studying with the AI Tutor robot" className="relative w-[66%] drop-shadow-[0_30px_40px_rgba(50,30,140,.3)] [mask-image:linear-gradient(to_bottom,#000_88%,transparent)]" />
            <Sparkle className="left-[48%] top-[2%] h-5 w-5 text-violet" />
            <Sparkle className="left-[84%] top-[2%] h-3 w-3 text-violet" delay={1} />
            {FLOAT_CHIPS.map((c, i) => (
              <motion.div
                key={c.label}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.1 }}
                style={{ rotate: c.rot }}
                className={cn("glass absolute hidden items-center gap-3 rounded-2xl border border-border px-4 py-3 shadow-[var(--card-shadow)] sm:flex", c.cls)}
              >
                <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", c.c)}>
                  <c.icon className="h-4.5 w-4.5" />
                </span>
                <span className="whitespace-nowrap text-sm font-bold">{c.label}</span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Stats strip */}
        <div id="features" className="mx-auto mt-6 max-w-[1220px] scroll-mt-28 px-6">
          <div className="glass grid grid-cols-2 gap-y-6 rounded-[2rem] border border-border px-4 py-6 shadow-[var(--card-shadow)] md:grid-cols-4 md:divide-x md:divide-border">
            {[
              { icon: Users, big: "1000+", small: "Students Learning", c: "text-violet bg-violet/12" },
              { icon: FileText, big: "50+", small: "Subjects Covered", c: "text-emerald-500 bg-emerald-500/12" },
              { icon: Zap, big: "Instant", small: "AI-Powered Answers", c: "text-amber-500 bg-amber-500/14" },
              { icon: ShieldCheck, big: "99%", small: "Accurate Results", c: "text-blue-500 bg-blue-500/12" },
            ].map((s) => (
              <div key={s.small} className="flex items-center justify-center gap-4 px-4">
                <span className={cn("flex h-14 w-14 items-center justify-center rounded-full", s.c)}>
                  <s.icon className="h-6 w-6" />
                </span>
                <div className="leading-tight">
                  <div className="text-2xl font-extrabold">{s.big}</div>
                  <div className="text-sm text-muted-foreground">{s.small}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── SUBJECTS ───────── */}
      <section id="subjects" className="relative scroll-mt-20 pb-24 pt-6">
        <div className="mx-auto max-w-[1320px] px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-violet/12 px-3.5 py-1 text-xs font-bold text-violet">
                <Sparkles className="h-3 w-3" /> Explore Knowledge
              </span>
              <h2 className="mt-3 text-4xl font-extrabold tracking-tight">
                Wide Range of <span className="gradient-word">Subjects</span>
              </h2>
              <p className="mt-2 text-muted-foreground">Get AI-powered help across all your academic subjects</p>
            </div>
            <Link to="/login" className="inline-flex items-center gap-2 text-sm font-bold text-violet hover:underline">
              View All Subjects <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {SUBJECTS.map((s, i) => (
              <motion.div
                key={s.name}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                whileHover={{ y: -6 }}
                className="group relative flex min-h-[15rem] flex-col rounded-[1.7rem] border border-border bg-card p-6 shadow-[var(--card-shadow)]"
              >
                <span className={cn("flex h-14 w-14 items-center justify-center rounded-2xl", s.tone)}>
                  <s.icon className="h-7 w-7" />
                </span>
                <h3 className="mt-5 text-[1.05rem] font-extrabold">{s.name}</h3>
                <p className="mt-1.5 text-sm leading-snug text-muted-foreground">{s.desc}</p>
                <Link
                  to="/login"
                  aria-label={`Open ${s.name}`}
                  className={cn("mt-auto flex h-10 w-10 items-center justify-center self-center rounded-full text-white shadow-lg transition-transform group-hover:translate-x-1", s.arrow)}
                >
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── HOW IT WORKS (dark wave) ───────── */}
      <section id="how" className="relative scroll-mt-16 text-white">
        <svg className="absolute -top-px left-0 h-16 w-full text-background" viewBox="0 0 1440 80" preserveAspectRatio="none" aria-hidden>
          <path d="M0 0h1440v30C1200 90 960 0 720 28S240 80 0 30z" fill="currentColor" />
        </svg>
        <div className="bg-[linear-gradient(135deg,#0b0d33_0%,#1b1470_55%,#2b1a8f_100%)] pb-28 pt-28">
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
            <div className="absolute -left-20 top-24 h-80 w-80 rounded-full bg-indigo-500/25 blur-3xl" />
            <div className="absolute right-0 top-10 h-96 w-96 rounded-full bg-fuchsia-500/20 blur-3xl" />
            {Array.from({ length: 16 }).map((_, i) => (
              <span key={i} className="twinkle absolute h-1 w-1 rounded-full bg-white" style={{ left: `${(i * 37) % 100}%`, top: `${(i * 53) % 80 + 8}%`, animationDelay: `${i * 0.3}s` }} />
            ))}
          </div>
          <div className="relative mx-auto grid max-w-[1320px] items-center gap-12 px-6 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3.5 py-1 text-xs font-bold">
                <Sparkles className="h-3 w-3" /> How it Works
              </span>
              <h2 className="mt-4 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
                Your Learning Journey
                <br />
                Made <span className="bg-gradient-to-r from-violet-300 to-fuchsia-300 bg-clip-text text-transparent">Simple</span>
              </h2>
              <p className="mt-4 text-white/70">Start learning in just a few steps and unlock the power of AI.</p>

              <div className="relative mt-12 grid gap-8 sm:grid-cols-4">
                <div className="absolute left-[10%] right-[10%] top-8 hidden border-t-2 border-dashed border-white/20 sm:block" />
                {STEPS.map((s, i) => (
                  <motion.div key={s.title} initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="relative">
                    <div className="relative">
                      <span className={cn("flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br shadow-[0_0_30px_-4px_rgba(139,123,255,.8)]", s.color)}>
                        <s.icon className="h-7 w-7" />
                      </span>
                      <span className="absolute -left-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold ring-2 ring-[#12125a]">{i + 1}</span>
                    </div>
                    <h3 className="mt-4 text-sm font-extrabold">{s.title}</h3>
                    <p className="mt-1 text-sm leading-snug text-white/65">{s.desc}</p>
                  </motion.div>
                ))}
              </div>
            </div>

            <div className="relative mx-auto h-[22rem] w-full max-w-[34rem]">
              <img src="/assets/ui/robot.png" alt="" className="bob absolute left-0 top-10 w-[42%] drop-shadow-[0_18px_30px_rgba(99,102,241,.6)]" />
              <div className="absolute right-0 top-4 w-[62%] rotate-[3deg] rounded-[1.8rem] border border-white/25 bg-white/10 p-6 shadow-2xl backdrop-blur-xl">
                {["Ask Questions", "Get Explanations", "Practice", "Track Progress"].map((t) => (
                  <div key={t} className="flex items-center gap-3 py-2.5 text-[0.95rem] font-semibold">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-400/90">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                    {t}
                  </div>
                ))}
              </div>
              <div className="hand-note absolute bottom-2 right-6 !text-violet-300 text-[1.6rem]" style={{ transform: "rotate(-8deg)" }}>
                Learn
                <br />
                Step by Step
              </div>
            </div>
          </div>
        </div>
        <svg className="absolute -bottom-px left-0 h-16 w-full text-background" viewBox="0 0 1440 80" preserveAspectRatio="none" aria-hidden>
          <path d="M0 80h1440V40C1200 -10 960 70 720 40S240 0 0 50z" fill="currentColor" />
        </svg>
      </section>

      {/* ───────── TESTIMONIALS ───────── */}
      <section id="about" className="scroll-mt-16 py-20">
        <div className="mx-auto max-w-[1320px] px-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-violet/12 px-3.5 py-1 text-xs font-bold text-violet">
                <Sparkles className="h-3 w-3" /> What Students Say
              </span>
              <h2 className="mt-3 text-4xl font-extrabold tracking-tight">
                Loved by <span className="gradient-word">Learners</span>
              </h2>
              <p className="mt-2 text-muted-foreground">Real experiences from students who are learning smarter with AI Tutor.</p>
            </div>
            <div className="relative flex items-center gap-3">
              <div className="hand-note absolute -top-14 right-20 hidden w-28 !text-[1.15rem] md:block" style={{ transform: "rotate(-8deg)" }}>
                Smarter Students Brighter Futures
              </div>
              <button onClick={() => setSlide((s) => (s - 1 + TESTIMONIALS.length) % TESTIMONIALS.length)} aria-label="Previous" className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-[var(--card-shadow)] transition hover:text-violet">
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button onClick={() => setSlide((s) => (s + 1) % TESTIMONIALS.length)} aria-label="Next" className="btn-grad flex h-12 w-12 items-center justify-center rounded-full text-white shadow-lg">
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {visible.map((t, i) => (
              <motion.figure
                key={`${slide}-${t.name}-${i}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className="rounded-[1.7rem] border border-border bg-card p-7 shadow-[var(--card-shadow)]"
              >
                <div className="text-5xl font-black leading-none text-violet/70">“</div>
                <blockquote className="-mt-1 min-h-[4.5rem] text-[0.98rem] leading-relaxed">{t.text}</blockquote>
                <figcaption className="mt-5 flex items-center gap-3">
                  <img src={t.img} alt="" className="h-12 w-12 rounded-full object-cover ring-2 ring-violet/25" />
                  <div className="leading-tight">
                    <div className="text-sm font-extrabold">{t.name}</div>
                    <div className="text-xs text-muted-foreground">{t.role}</div>
                  </div>
                  <div className="ml-auto flex text-amber-400">
                    {Array.from({ length: 5 }).map((_, k) => (
                      <Star key={k} className="h-4 w-4 fill-current" />
                    ))}
                  </div>
                </figcaption>
              </motion.figure>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── CTA ───────── */}
      <section className="px-6 pb-16">
        <div className="relative mx-auto flex max-w-[1320px] flex-col items-center gap-6 overflow-hidden rounded-[2.4rem] bg-[linear-gradient(120deg,#17126b_0%,#3a22b8_55%,#6c4ff0_100%)] px-8 py-10 text-white shadow-[0_30px_70px_-30px_rgba(60,40,200,.7)] md:flex-row md:px-12">
          <div className="pointer-events-none absolute inset-0 opacity-50">
            <Sparkle className="left-[22%] top-6 h-4 w-4" />
            <Sparkle className="left-[6%] top-1/2 h-3 w-3" delay={1} />
            <Sparkle className="right-[30%] bottom-6 h-3 w-3" delay={0.6} />
          </div>
          <div className="relative -mb-10 -ml-4 shrink-0 self-end md:-mb-10">
            <div className="absolute inset-0 rounded-full bg-indigo-300/30 blur-2xl" />
            <img src="/assets/ui/cta-boy.png" alt="" className="relative h-44 w-auto drop-shadow-2xl md:h-52" />
          </div>
          <div className="relative flex-1 text-center md:text-left">
            <h2 className="text-3xl font-extrabold md:text-4xl">Ready to Learn Smarter?</h2>
            <p className="mt-2 text-white/75">Join thousands of students and experience the power of AI in education.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3 md:justify-start">
              <Link to="/login" className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3 text-sm font-bold text-violet shadow-xl transition hover:-translate-y-0.5">
                Get Started <ArrowRight className="h-4 w-4" />
              </Link>
              <button onClick={() => setDemo(true)} className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-7 py-3 text-sm font-bold backdrop-blur transition hover:bg-white/20">
                <Play className="h-3.5 w-3.5 fill-current" /> Watch Demo
              </button>
            </div>
          </div>
          <div className="hand-note relative hidden !text-white/90 text-[1.35rem] lg:block" style={{ transform: "rotate(-9deg)" }}>
            “Same Syllabus
            <br />
            Better Learning
            <br />
            with AI!”
          </div>
        </div>
        <footer className="mx-auto mt-10 flex max-w-[1320px] flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
          <Logo size="sm" subtitle="" />
          <span>© {new Date().getFullYear()} AI Tutor · CSPIT CSE · RAG-powered learning platform</span>
        </footer>
      </section>

      {/* ───────── DEMO MODAL ───────── */}
      {demo && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setDemo(false)}>
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} onClick={(e) => e.stopPropagation()} className="relative w-full max-w-lg rounded-[2rem] border border-border bg-card p-8 shadow-2xl">
            <button onClick={() => setDemo(false)} aria-label="Close" className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
            <h3 className="text-2xl font-extrabold">
              Try the <span className="gradient-word">live demo</span>
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">Demo accounts are pre-filled on the sign-in page — pick a role and click Login to explore every portal.</p>
            <div className="mt-6 grid grid-cols-3 gap-3 text-center text-sm font-bold">
              {["Student", "Faculty", "Admin"].map((r) => (
                <div key={r} className="rounded-2xl bg-violet/10 py-3 text-violet">{r}</div>
              ))}
            </div>
            <Link to="/login" className="btn-pill mt-6 w-full">
              Open sign in <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function HeroBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#edf1ff_0%,#f4f1ff_60%,transparent_100%)] dark:bg-[linear-gradient(180deg,#0b0f36_0%,#0a0c27_70%,transparent_100%)]" />
      <div className="absolute -left-20 top-24 h-96 w-96 rounded-full bg-sky-300/35 blur-3xl dark:bg-indigo-600/25" />
      <div className="absolute right-[10%] top-0 h-[34rem] w-[34rem] rounded-full bg-violet-300/40 blur-3xl dark:bg-violet-700/25" />
      <div className="absolute inset-x-0 top-0 h-full opacity-60 [background-image:radial-gradient(circle,rgba(255,255,255,.8)_1px,transparent_1.5px)] [background-size:36px_36px] dark:opacity-10" />
    </div>
  );
}
