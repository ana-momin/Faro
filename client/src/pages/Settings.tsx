import { MonitorManager, SavedOrganizer } from "@/pages/Profile";
import { ProviderSetup } from "@/pages/ProfileProviderSetup";
import { trpc } from "@/lib/trpc";
import { Bookmark, PlugZap, Settings2, SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";

type SettingsSection = "provider" | "monitors" | "saved";

const settingsItems: Array<{ id: SettingsSection; label: string; description: string; icon: typeof PlugZap }> = [
  { id: "provider", label: "Provider", description: "Data connection", icon: PlugZap },
  { id: "monitors", label: "Monitors", description: "Collection controls", icon: SlidersHorizontal },
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

  return <div className="mx-auto max-w-6xl pb-10">
    <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]"><aside className="rounded-[24px] border border-[#eadfd2] bg-white p-2 shadow-[0_8px_18px_rgba(99,59,31,0.035)]"><nav className="flex gap-1 overflow-x-auto lg:flex-col">{settingsItems.map(item => { const Icon = item.icon; const active = item.id === section; return <button key={item.id} onClick={() => selectSection(item.id)} className={`flex min-w-[150px] items-center gap-3 rounded-2xl px-3 py-3 text-left transition lg:min-w-0 ${active ? "bg-[#f8e8d9] text-[#8f4e38]" : "text-[#755e4e] hover:bg-[#fff8f1]"}`}><span className={`grid h-8 w-8 place-items-center rounded-xl ${active ? "bg-white text-[#9c563e]" : "bg-[#fbf2e5] text-[#a27761]"}`}><Icon className="h-3.5 w-3.5" /></span><span className="min-w-0"><span className="block text-[11px] font-extrabold">{item.label}</span><span className="mt-0.5 block truncate text-[9px] text-[#a08370]">{item.description}</span></span></button>; })}</nav></aside><section className="min-w-0"><div className="mb-4 flex items-center gap-2 lg:hidden"><selected.icon className="h-4 w-4 text-[#a45a42]" /><span className="text-xs font-extrabold text-[#503629]">{selected.label}</span></div>{section === "provider" ? <ProviderSetup setup={providerSetup.data} loading={providerSetup.isLoading} /> : section === "monitors" ? <MonitorManager rows={overview.data?.monitors ?? []} loading={overview.isLoading} /> : <SavedOrganizer rows={saved.data ?? []} loading={saved.isLoading} onFeed={() => setLocation("/")} />}</section></div>
  </div>;
}
