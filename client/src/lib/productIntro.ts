export const PRODUCT_INTRO_PATH = "/faro";

export const productStages = [
  {
    eyebrow: "01 · Sense",
    title: "Turn a clear brief into a focused signal field.",
    description: "Faro AI reads one precise request at a time and checks the live public X source only when you ask it to.",
    chip: "Live, on demand",
    color: "terracotta",
  },
  {
    eyebrow: "02 · Qualify",
    title: "Find service need, not just familiar words.",
    description: "Intent-first ranking favors people seeking capable providers and suppresses promotion, jobs, communities, and generic chatter.",
    chip: "Intent before keywords",
    color: "gold",
  },
  {
    eyebrow: "03 · Decide",
    title: "Review the whole signal with judgment intact.",
    description: "Open the full post, inspect why it surfaced, and keep or dismiss it. Faro AI never sends outreach for you.",
    chip: "Human stays in control",
    color: "sage",
  },
] as const;

export function getProductStage(index: number) {
  return productStages[Math.max(0, Math.min(index, productStages.length - 1))];
}
