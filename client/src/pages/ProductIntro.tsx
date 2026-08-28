import FaroLogo from "@/components/FaroLogo";
import { Button } from "@/components/ui/button";
import { PRODUCT_INTRO_PATH, productStages } from "@/lib/productIntro";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import { useLocation } from "wouter";

const STAGE_ACCENT: Record<string, string> = {
  terracotta: "bg-[#b85f45]",
  gold: "bg-[#c99245]",
  sage: "bg-[#5f9a71]",
};

export default function ProductIntro() {
  const [, setLocation] = useLocation();
  const reduceMotion = useReducedMotion();
  const fadeUp = reduceMotion ? {} : { opacity: 1, y: 0 };

  return <main className="min-h-screen bg-[#fffaf2] text-[#35241a]">
    <nav className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6 sm:px-8">
      <button onClick={() => setLocation("/")} className="rounded-xl outline-none transition active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-[#bb654a]" aria-label="Open Faro AI workspace">
        <FaroLogo className="[&>span:first-child]:h-9 [&>span:first-child]:w-9 [&>span:first-child]:rounded-xl [&>span:last-child]:text-[19px]" />
      </button>
      <Button onClick={() => setLocation("/")} variant="outline" className="h-9 rounded-xl border-[#e5d3bd] bg-white px-4 text-xs font-bold text-[#7c4d38] hover:bg-[#fff4e8]">Open Feed <ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Button>
    </nav>

    <section className="mx-auto max-w-3xl px-6 py-20 text-center sm:px-8 sm:py-28">
      <motion.p initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={fadeUp} transition={{ duration: 0.4 }} className="inline-flex items-center gap-2 rounded-full border border-[#e7cfba] bg-white px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#9a593f]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#bb6348]" />Faro AI
      </motion.p>
      <motion.h1 initial={reduceMotion ? false : { opacity: 0, y: 12 }} animate={fadeUp} transition={{ duration: 0.45, delay: 0.05 }} className="mt-6 text-4xl font-extrabold leading-[1.05] tracking-[-0.05em] sm:text-6xl">
        Find the people <span className="text-[#b85f45]">already asking.</span>
      </motion.h1>
      <motion.p initial={reduceMotion ? false : { opacity: 0, y: 12 }} animate={fadeUp} transition={{ duration: 0.45, delay: 0.1 }} className="mx-auto mt-5 max-w-xl text-[15px] leading-7 text-[#725d4e]">
        Faro reads public X posts for real service demand — AI agents, automation, development, content, video — and surfaces only the signal, not the noise.
      </motion.p>
      <motion.div initial={reduceMotion ? false : { opacity: 0, y: 12 }} animate={fadeUp} transition={{ duration: 0.45, delay: 0.15 }} className="mt-8 flex flex-wrap items-center justify-center gap-4">
        <Button onClick={() => setLocation("/")} className="h-11 rounded-xl bg-[#b85f45] px-5 text-xs font-extrabold text-white shadow-[0_10px_22px_rgba(161,80,55,0.2)] hover:bg-[#9e4e37]">Enter your signal desk <ArrowRight className="ml-2 h-4 w-4" /></Button>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#80644f]"><Check className="h-4 w-4 text-[#5a9770]" />No automated outreach, ever</span>
      </motion.div>
    </section>

    <section className="border-t border-[#eddfd2]">
      <div className="mx-auto grid max-w-5xl gap-px overflow-hidden rounded-[28px] border border-[#eadfd2] bg-[#eadfd2] px-6 sm:px-8 md:my-16 md:grid-cols-3 md:gap-0 md:p-0">
        {productStages.map((stage, index) => <motion.div key={stage.eyebrow} initial={reduceMotion ? false : { opacity: 0, y: 14 }} whileInView={fadeUp} viewport={{ once: true, amount: 0.4 }} transition={{ duration: 0.35, delay: index * 0.06 }} className="bg-[#fffaf2] p-7 first:pt-10 last:pb-10 md:bg-white md:p-8">
          <span className={`inline-block h-1.5 w-8 rounded-full ${STAGE_ACCENT[stage.color]}`} />
          <p className="mt-4 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#a08b7a]">{stage.eyebrow}</p>
          <h3 className="mt-2 text-lg font-extrabold leading-snug tracking-[-0.03em] text-[#3d2e23]">{stage.title}</h3>
          <p className="mt-3 text-[13px] leading-6 text-[#83705f]">{stage.description}</p>
          <p className="mt-4 text-[10px] font-bold text-[#a25d47]">{stage.chip}</p>
        </motion.div>)}
      </div>
    </section>

    <section className="mx-6 mb-8 mt-4 overflow-hidden rounded-[28px] bg-[#38261d] sm:mx-8 md:mx-auto md:max-w-5xl">
      <div className="flex flex-col items-start justify-between gap-6 px-7 py-10 sm:flex-row sm:items-center sm:px-10">
        <div><p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#efb797]">Human judgment stays first</p><h2 className="mt-3 text-2xl font-extrabold tracking-[-0.04em] text-white sm:text-3xl">Your next signal is waiting.</h2></div>
        <Button onClick={() => setLocation("/")} className="h-11 shrink-0 rounded-xl bg-[#f5c9a9] px-5 text-xs font-extrabold text-[#4a2c1e] hover:bg-[#ffe0c7]">Open Feed <ArrowRight className="ml-2 h-4 w-4" /></Button>
      </div>
    </section>
  </main>;
}

export { PRODUCT_INTRO_PATH };
