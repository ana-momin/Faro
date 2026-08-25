import { MonitorManager, SavedOrganizer } from "@/pages/Profile";
import { ProviderSetup } from "@/pages/ProfileProviderSetup";
import { trpc } from "@/lib/trpc";
import { ArrowRight, Bookmark, History, PlugZap, Settings2, WandSparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";

type SettingsSection = "provider" | "monitors" | "saved";

const settingsItems: Array<{ id: SettingsSection; label: string; description: string; icon: typeof PlugZap }> = [
  { id: "provider", label: "Provider", description: "Data connection", icon: PlugZap },
  { id: "monitors", label: "History", description: "Saved result sets", icon: History },
  { id: "saved", label: "Saved", description: "Private requests", icon: Bookmark },
];

function resolveSection(location: string): SettingsSection {
  const [path, query] = location.split("?");
  if (path === "/saved") return "saved";
  if (path === "/monitors") return "monitors";
  if (path === "/provider") return "provider";
  const requested = new URLSearchParams(query ?? "").get("section");
  return requested === "saved" || requested === "monitors" || requested === "provider" ? requested : "provider";
}

export default function Settings() {
  const [location, setLocation] = useLocation();
  const [section, setSection] = useState<SettingsSection>(() => resolveSection(location));
  const saved = trpc.monitoring.saved.useQuery();
  const overview = trpc.monitoring.overview.useQuery();
  const providerSetup = trpc.monitoring.providerSetup.useQuery();
  const selected = settingsItems.find(item => item.id === section)!;
  useEffect(() => setSection(resolveSection(location)), [location]);
  const selectSection = (next: SettingsSection) => { setSection(next); setLocation(`/settings?section=${next}`); };

  return <div className="mx-auto max-w-6xl pb-10 pt-7 sm:pt-10">
    <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]"><aside className="self-start rounded-[26px] border border-[#eadfd2] bg-white p-2.5 shadow-[0_12px_28px_rgba(99,59,31,0.045)]"><nav className="flex gap-1 overflow-x-auto lg:flex-col">{settingsItems.map(item => { const Icon = item.icon; const active = item.id === section; return <button key={item.id} onClick={() => selectSection(item.id)} className={`flex min-w-[150px] items-center gap-3 rounded-2xl px-3 py-3 text-left transition lg:min-w-0 ${active ? "bg-[#f8e8d9] text-[#8f4e38] shadow-[inset_0_0_0_1px_rgba(185,105,77,0.1)]" : "text-[#755e4e] hover:bg-[#fff8f1]"}`}><span className={`grid h-8 w-8 place-items-center rounded-xl ${active ? "bg-white text-[#9c563e] shadow-sm" : "bg-[#fbf2e5] text-[#a27761]"}`}><Icon className="h-3.5 w-3.5" /></span><span className="min-w-0"><span className="block text-[11px] font-extrabold">{item.label}</span><span className="mt-0.5 block truncate text-[9px] text-[#a08370]">{item.description}</span></span></button>; })}</nav></aside><section className="min-w-0"><div className="mb-4 flex items-center gap-2 lg:hidden"><selected.icon className="h-4 w-4 text-[#a45a42]" /><span className="text-xs font-extrabold text-[#503629]">{selected.label}</span></div>{section === "provider" ? <ProviderSetup setup={providerSetup.data} loading={providerSetup.isLoading} /> : section === "monitors" ? <><SearchHistoryPanel rows={overview.data?.monitors ?? []} loading={overview.isLoading} onOpen={monitorId => setLocation(`/search?history=${monitorId}`)} /><details className="group mt-6 border-t border-[#eadfd2] pt-5"><summary className="flex cursor-pointer list-none items-center justify-between rounded-xl border border-[#eadfd2] bg-white px-4 py-3 text-[11px] font-extrabold text-[#79503c] transition hover:bg-[#fffaf5]">Manage searches <ArrowRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" /></summary><MonitorManager rows={overview.data?.monitors ?? []} loading={overview.isLoading} /></details></> : <SavedOrganizer rows={saved.data ?? []} loading={saved.isLoading} onFeed={() => setLocation("/")} />}</section></div>
  </div>;
}

function SearchHistoryPanel({ rows, loading, onOpen }: { rows: any[]; loading: boolean; onOpen: (monitorId: number) => void }) {
  if (loading) return <section className="mt-5 grid min-h-40 place-items-center rounded-[28px] border border-[#eadfd2] bg-white text-xs font-bold text-[#9a7d68]">Loading saved searches…</section>;
  return <section className="mt-5"><div><p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#a25d47]">Saved result sets</p><h2 className="mt-1 text-2xl font-extrabold tracking-[-0.05em] text-[#432b1e]">Search history</h2><p className="mt-2 text-[11px] text-[#9a7c68]">Open stored results again without using a provider request.</p></div>{rows.length ? <div className="mt-4 space-y-2">{rows.slice(0, 5).map(({ monitor }) => <button key={monitor.id} type="button" onClick={() => onOpen(monitor.id)} className="flex w-full items-center gap-3 rounded-2xl border border-[#eadfd2] bg-white p-3 text-left transition hover:border-[#dfbda3] hover:bg-[#fffaf5]" aria-label={`Open results for ${monitor.name}`}><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#f8eee5] text-[#9b715b]"><WandSparkles className="h-3.5 w-3.5" /></span><span className="min-w-0 flex-1"><span className="block truncate text-[11px] font-extrabold text-[#563a2b]">{monitor.name}</span><span className="mt-0.5 block truncate text-[10px] text-[#9a7c68]">{monitor.goal}</span></span><span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-extrabold text-[#9a523b]">Open <ArrowRight className="h-3 w-3" /></span></button>)}</div> : <div className="mt-4 rounded-[24px] border border-dashed border-[#ead7c5] bg-[#fffdfa] p-6 text-center text-[11px] text-[#9a7c68]">Run a Search to create a saved result set.</div>}</section>;
}
