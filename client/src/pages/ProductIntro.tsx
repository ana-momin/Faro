import FaroLogo from "@/components/FaroLogo";
import { Button } from "@/components/ui/button";
import { PRODUCT_INTRO_PATH, productStages } from "@/lib/productIntro";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, ChevronDown, Eye, Lock, Radar, ShieldCheck, Sparkles, type LucideIcon } from "lucide-react";
import { useLocation } from "wouter";

const STAGE_STYLE: Record<string, { icon: LucideIcon; ring: string; iconWrap: string; chip: string }> = {
  terracotta: { icon: Radar, ring: "group-hover:border-[#e0ad8c]", iconWrap: "bg-[#f7e6d7] text-[#a65a40]", chip: "bg-[#fdf0e4] text-[#9a593f]" },
  gold: { icon: Eye, ring: "group-hover:border-[#e3c589]", iconWrap: "bg-[#f7ecd7] text-[#9c7a30]", chip: "bg-[#fbf3e2] text-[#8f6d28]" },
  sage: { icon: ShieldCheck, ring: "group-hover:border-[#a9d0b3]", iconWrap: "bg-[#e2f0e5] text-[#3f7757]", chip: "bg-[#eaf6ec] text-[#397657]" },
};

const heroStats = [
  { icon: Radar, label: "Real-time X search", detail: "Live public posts, checked on demand" },
  { icon: Sparkles, label: "LLM-powered intent", detail: "Not keyword matching - actual understanding" },
  { icon: ShieldCheck, label: "Zero auto-outreach", detail: "Faro never messages anyone for you" },
];

const trustPoints = [
  { icon: Lock, text: "Your provider key is encrypted server-side and never shown again after saving." },
  { icon: Eye, text: "Every post you see includes why it matched, not just a bare link." },
  { icon: ShieldCheck, text: "No auto-replies, no auto-follows, no auto-anything. You approve every action." },
];

/** Subtle fractal-noise grain, applied at very low opacity for tactile depth without visual noise. */
const NOISE_TEXTURE = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

export default function ProductIntro() {
  const [, setLocation] = useLocation();
  const reduceMotion = useReducedMotion();
  const fadeUp = reduceMotion ? {} : { opacity: 1, y: 0 };

  // snap-proximity, not snap-mandatory: mandatory snapping fights every wheel/trackpad gesture and
  // is what made this feel jerky. Proximity still settles each section into place but lets a scroll
  // travel naturally first. `overscroll-contain` stops the snap from bouncing the page behind it.
  return <main className="relative h-dvh snap-y snap-proximity overflow-y-auto overscroll-contain scroll-smooth text-[#35241a]">
    <nav className="pointer-events-none fixed inset-x-0 top-0 z-30 flex items-center justify-between px-6 py-5 sm:px-8">
      <button onClick={() => setLocation("/")} className="pointer-events-auto rounded-xl outline-none transition hover:scale-[1.03] active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-[#bb654a]" aria-label="Open Faro AI workspace">
        <FaroLogo className="[&>span:first-child]:h-9 [&>span:first-child]:w-9 [&>span:first-child]:rounded-xl [&>span:last-child]:text-[19px]" />
      </button>
      <Button onClick={() => setLocation("/")} variant="outline" className="group pointer-events-auto h-9 rounded-xl border-[#e5d3bd] bg-white/85 px-4 text-xs font-bold text-[#7c4d38] backdrop-blur transition hover:border-[#d9a97f] hover:bg-white">Open Feed <ArrowRight className="ml-1.5 h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" /></Button>
    </nav>

    <section className="relative flex h-dvh snap-start flex-col items-center justify-center overflow-hidden bg-[#fffaf2] px-6 sm:px-8">
      <div className="pointer-events-none absolute inset-0 opacity-[0.035] mix-blend-multiply" style={{ backgroundImage: NOISE_TEXTURE }} />
      <div className="pointer-events-none absolute -top-40 right-[-12rem] h-[34rem] w-[34rem] rounded-full bg-[radial-gradient(circle,rgba(184,95,69,0.16),transparent_68%)] blur-2xl" />
      <div className="pointer-events-none absolute left-[-14rem] bottom-[-8rem] h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(circle,rgba(95,154,113,0.14),transparent_68%)] blur-2xl" />

      <div className="relative mx-auto max-w-3xl text-center">
        <motion.p initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={fadeUp} transition={{ duration: 0.4 }} className="inline-flex items-center gap-2 rounded-full border border-[#e7cfba] bg-white/80 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#9a593f] backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-[#bb6348]" />Faro AI
        </motion.p>
        <motion.h1 initial={reduceMotion ? false : { opacity: 0, y: 12 }} animate={fadeUp} transition={{ duration: 0.45, delay: 0.05 }} className="mt-6 text-4xl font-extrabold leading-[1.05] tracking-[-0.05em] sm:text-6xl">
          Find the people <span className="text-[#b85f45]">already asking.</span>
        </motion.h1>
        <motion.p initial={reduceMotion ? false : { opacity: 0, y: 12 }} animate={fadeUp} transition={{ duration: 0.45, delay: 0.1 }} className="mx-auto mt-5 max-w-xl text-[15px] leading-7 text-[#725d4e]">
          Faro reads public X posts for real service demand — AI agents, automation, development, content, video — and surfaces only the signal, not the noise.
        </motion.p>
        <motion.div initial={reduceMotion ? false : { opacity: 0, y: 12 }} animate={fadeUp} transition={{ duration: 0.45, delay: 0.15 }} className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Button onClick={() => setLocation("/")} className="group h-11 rounded-xl bg-[#b85f45] px-5 text-xs font-extrabold text-white shadow-[0_10px_22px_rgba(161,80,55,0.2)] transition hover:-translate-y-0.5 hover:bg-[#9e4e37] hover:shadow-[0_14px_28px_rgba(161,80,55,0.28)]">Enter your signal desk <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" /></Button>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#80644f]"><Check className="h-4 w-4 text-[#5a9770]" />No automated outreach, ever</span>
        </motion.div>
        <motion.div initial={reduceMotion ? false : { opacity: 0, y: 12 }} whileInView={fadeUp} viewport={{ once: true }} transition={{ duration: 0.45, delay: 0.2 }} className="mx-auto mt-12 grid max-w-2xl gap-3 sm:grid-cols-3">
          {heroStats.map(stat => <div key={stat.label} className="rounded-2xl border border-[#eadfd2] bg-white/70 p-3.5 text-left backdrop-blur"><stat.icon className="h-4 w-4 text-[#a45a42]" /><p className="mt-2 text-[11px] font-extrabold text-[#3d2e23]">{stat.label}</p><p className="mt-0.5 text-[10px] leading-4 text-[#8c745f]">{stat.detail}</p></div>)}
        </motion.div>
      </div>
      <motion.button onClick={event => (event.currentTarget.closest("main") as HTMLElement)?.querySelector("#how-it-works")?.scrollIntoView({ behavior: "smooth" })} initial={reduceMotion ? false : { opacity: 0 }} animate={reduceMotion ? {} : { opacity: 1, y: [0, 6, 0] }} transition={{ opacity: { delay: 0.5 }, y: { duration: 1.6, repeat: Infinity, ease: "easeInOut" } }} className="absolute bottom-7 grid h-9 w-9 place-items-center rounded-full border border-[#e7cfba] bg-white/70 text-[#9a593f] backdrop-blur transition hover:bg-white" aria-label="Scroll to how it works">
        <ChevronDown className="h-4 w-4" />
      </motion.button>
    </section>

    <section id="how-it-works" className="relative flex h-dvh snap-start flex-col items-center justify-center overflow-hidden bg-[#fffdf9] px-6 sm:px-8">
      <div className="pointer-events-none absolute right-[-10rem] top-1/3 h-[26rem] w-[26rem] rounded-full bg-[radial-gradient(circle,rgba(201,146,69,0.1),transparent_70%)] blur-2xl" />
      <div className="relative mx-auto w-full max-w-5xl">
        <div className="text-center"><p className="text-[10px] font-extrabold uppercase tracking-[0.17em] text-[#a25d47]">Keep it simple</p><h2 className="mt-3 text-3xl font-extrabold tracking-[-0.065em] sm:text-4xl">A quiet path to the right request.</h2><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#887365]">Three deliberate steps, no background scraping, no surprises.</p></div>
        <div className="mt-9 grid gap-4 md:grid-cols-3">
          {productStages.map((stage, index) => { const style = STAGE_STYLE[stage.color]; const Icon = style.icon; return <motion.div key={stage.eyebrow} initial={reduceMotion ? false : { opacity: 0, y: 14 }} whileInView={fadeUp} viewport={{ once: true, amount: 0.4 }} transition={{ duration: 0.35, delay: index * 0.06 }} className={`group relative overflow-hidden rounded-[24px] border border-[#eadfd2] bg-white p-6 shadow-[0_10px_28px_rgba(95,57,32,0.045)] transition hover:-translate-y-1 hover:shadow-[0_18px_36px_rgba(95,57,32,0.09)] ${style.ring}`}>
            <span className="pointer-events-none absolute -right-3 -top-5 text-6xl font-extrabold text-[#f2e6d6]">0{index + 1}</span>
            <span className={`relative grid h-11 w-11 place-items-center rounded-2xl ${style.iconWrap}`}><Icon className="h-5 w-5" /></span>
            <h3 className="relative mt-5 text-base font-extrabold leading-snug tracking-[-0.03em] text-[#3d2e23]">{stage.title}</h3>
            <p className="relative mt-2 text-[12px] leading-5 text-[#8c745f]">{stage.description}</p>
            <span className={`relative mt-4 inline-block rounded-full px-2.5 py-1 text-[10px] font-extrabold ${style.chip}`}>{stage.chip}</span>
          </motion.div>; })}
        </div>
      </div>
    </section>

    <section className="relative flex h-dvh snap-start flex-col items-center justify-center overflow-hidden bg-[#38261d] px-6 text-white sm:px-8">
      <div className="pointer-events-none absolute -left-24 top-[-6rem] h-[26rem] w-[26rem] rounded-full bg-[#d17452]/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-[-8rem] h-[24rem] w-[24rem] rounded-full bg-[#6a8f77]/20 blur-3xl" />
      <div className="relative mx-auto w-full max-w-3xl text-center">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.17em] text-[#efb797]">Human judgment stays first</p>
        <h2 className="mt-3 text-3xl font-extrabold tracking-[-0.05em] sm:text-5xl">Your next signal is waiting.</h2>
        <p className="mx-auto mt-4 max-w-lg text-sm leading-6 text-white/65">Faro surfaces the request. You decide what happens next — every time, on your terms.</p>
        <div className="mx-auto mt-9 grid max-w-xl gap-3 text-left sm:grid-cols-1">
          {trustPoints.map(point => <div key={point.text} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3"><point.icon className="mt-0.5 h-4 w-4 shrink-0 text-[#f2bc9c]" /><p className="text-[12px] leading-5 text-white/75">{point.text}</p></div>)}
        </div>
        <Button onClick={() => setLocation("/")} className="mt-9 h-11 rounded-xl bg-[#f5c9a9] px-5 text-xs font-extrabold text-[#4a2c1e] transition hover:-translate-y-0.5 hover:bg-[#ffe0c7]">Open Feed <ArrowRight className="ml-2 h-4 w-4" /></Button>
      </div>
    </section>
  </main>;
}

export { PRODUCT_INTRO_PATH };
