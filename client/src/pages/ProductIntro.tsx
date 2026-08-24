import FaroLogo from "@/components/FaroLogo";
import { Button } from "@/components/ui/button";
import { PRODUCT_INTRO_PATH } from "@/lib/productIntro";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, Compass, Eye, ShieldCheck } from "lucide-react";
import { useLocation } from "wouter";

const principles = [
  { icon: Compass, title: "Discover", text: "One clear brief." },
  { icon: Eye, title: "Qualify", text: "Need over noise." },
  { icon: ShieldCheck, title: "Decide", text: "Always human-led." },
];

export default function ProductIntro() {
  const [, setLocation] = useLocation();
  const reduceMotion = useReducedMotion();
  const fadeUp = reduceMotion ? {} : { opacity: 1, y: 0 };

  return <main className="min-h-screen overflow-hidden bg-[#fffaf2] text-[#35241a]">
    <section className="relative isolate flex min-h-[77vh] flex-col overflow-hidden border-b border-[#eddfd2]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_15%,rgba(245,204,170,0.72),transparent_34%),radial-gradient(circle_at_86%_22%,rgba(219,236,220,0.75),transparent_30%),radial-gradient(circle_at_48%_88%,rgba(246,221,194,0.7),transparent_38%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.32] [background-image:linear-gradient(rgba(147,90,59,0.10)_1px,transparent_1px),linear-gradient(90deg,rgba(147,90,59,0.10)_1px,transparent_1px)] [background-size:64px_64px]" />
      <div className="pointer-events-none absolute -left-28 bottom-[-16rem] h-[38rem] w-[38rem] rounded-full border border-[#d79c77]/30 bg-[#fffaf2]/25" />
      <div className="pointer-events-none absolute -right-32 top-[25%] h-[28rem] w-[28rem] rounded-full border border-[#b8d8bf]/50 bg-white/20" />

      <nav className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-10"><button onClick={() => setLocation("/")} className="rounded-xl outline-none transition active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-[#bb654a]" aria-label="Open Faro AI workspace"><FaroLogo className="[&>span:first-child]:h-10 [&>span:first-child]:w-10 [&>span:first-child]:rounded-[13px] [&>span:last-child]:text-[21px]" /></button><Button onClick={() => setLocation("/")} className="h-10 rounded-xl bg-[#b85f45] px-4 text-xs font-extrabold text-white shadow-[0_8px_20px_rgba(161,80,55,0.18)] hover:bg-[#9e4e37]">Open Discover <ArrowRight className="ml-2 h-3.5 w-3.5" /></Button></nav>

      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 items-center px-5 py-20 sm:px-8 lg:px-10"><div className="max-w-3xl"><motion.p initial={reduceMotion ? false : { opacity: 0, y: 10 }} animate={fadeUp} transition={{ duration: 0.42, ease: [0.23, 1, 0.32, 1] }} className="inline-flex items-center gap-2 rounded-full border border-[#e7cfba] bg-white/65 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#9a593f] backdrop-blur"><span className="h-1.5 w-1.5 rounded-full bg-[#bb6348]" />Faro AI · service demand on X</motion.p><motion.h1 initial={reduceMotion ? false : { opacity: 0, y: 16 }} animate={fadeUp} transition={{ duration: 0.52, delay: 0.06, ease: [0.23, 1, 0.32, 1] }} className="mt-7 text-5xl font-extrabold leading-[0.92] tracking-[-0.09em] sm:text-7xl lg:text-[88px]">Find the people<br /><span className="text-[#b85f45]">already asking.</span></motion.h1><motion.p initial={reduceMotion ? false : { opacity: 0, y: 16 }} animate={fadeUp} transition={{ duration: 0.52, delay: 0.12, ease: [0.23, 1, 0.32, 1] }} className="mt-6 max-w-md text-[15px] leading-7 text-[#725d4e] sm:text-base">Faro filters public X posts for real service demand—so you can review the signal, not the noise.</motion.p><motion.div initial={reduceMotion ? false : { opacity: 0, y: 16 }} animate={fadeUp} transition={{ duration: 0.52, delay: 0.18, ease: [0.23, 1, 0.32, 1] }} className="mt-8 flex flex-wrap items-center gap-3"><Button onClick={() => setLocation("/")} className="h-12 rounded-2xl bg-[#b85f45] px-5 text-xs font-extrabold text-white shadow-[0_12px_26px_rgba(161,80,55,0.22)] hover:bg-[#9e4e37]">Enter your signal desk <ArrowRight className="ml-2 h-4 w-4" /></Button><span className="inline-flex items-center gap-2 text-[11px] font-bold text-[#80644f]"><Check className="h-4 w-4 text-[#5a9770]" />No automated outreach</span></motion.div></div></div>
    </section>

    <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20 lg:px-10"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-[10px] font-extrabold uppercase tracking-[0.17em] text-[#a25d47]">Keep it simple</p><h2 className="mt-3 text-3xl font-extrabold tracking-[-0.065em] sm:text-4xl">A quiet path to the right request.</h2></div><p className="max-w-xs text-sm leading-6 text-[#887365]">Faro makes the next review clear without adding another noisy workspace.</p></div><div className="mt-8 grid gap-3 md:grid-cols-3">{principles.map((item, index) => { const Icon = item.icon; return <motion.article key={item.title} initial={reduceMotion ? false : { opacity: 0, y: 14 }} whileInView={fadeUp} viewport={{ once: true, amount: 0.25 }} transition={{ duration: 0.35, delay: index * 0.07, ease: [0.23, 1, 0.32, 1] }} className="rounded-[24px] border border-[#eadfd4] bg-white/80 p-5 shadow-[0_10px_26px_rgba(95,57,32,0.045)]"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#fbefe1] text-[#a45a42]"><Icon className="h-4 w-4" /></span><p className="mt-7 text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#a08b7a]">0{index + 1}</p><h3 className="mt-1 text-xl font-extrabold tracking-[-0.05em]">{item.title}</h3><p className="mt-2 text-sm text-[#806b5c]">{item.text}</p></motion.article>})}</div></section>

    <section className="mx-5 mb-5 overflow-hidden rounded-[30px] bg-[#38261d] sm:mx-8 lg:mx-auto lg:max-w-[calc(80rem-5rem)]"><div className="flex flex-col items-start justify-between gap-6 px-6 py-9 sm:flex-row sm:items-center sm:px-10 sm:py-10"><div><p className="text-[10px] font-extrabold uppercase tracking-[0.17em] text-[#efb797]">Human judgment stays first</p><h2 className="mt-3 text-3xl font-extrabold tracking-[-0.065em] text-white sm:text-4xl">Your next signal is waiting.</h2></div><Button onClick={() => setLocation("/")} className="h-11 shrink-0 rounded-2xl bg-[#f5c9a9] px-5 text-xs font-extrabold text-[#4a2c1e] hover:bg-[#ffe0c7]">Open Discover <ArrowRight className="ml-2 h-4 w-4" /></Button></div></section>
  </main>;
}

export { PRODUCT_INTRO_PATH };
