import { SavedOrganizer } from "@/pages/Profile";
import { ProviderSetup } from "@/pages/ProfileProviderSetup";
import { useHideAuthorPhotos } from "@/lib/authorPhotos";
import { trpc } from "@/lib/trpc";
import { Bookmark, Check, PlugZap, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";

type SettingsSection = "provider" | "saved" | "display";

const settingsItems: Array<{ id: SettingsSection; label: string; description: string; icon: typeof PlugZap }> = [
  { id: "provider", label: "Provider", description: "Data connection", icon: PlugZap },
  { id: "saved", label: "Saved", description: "Private requests", icon: Bookmark },
  { id: "display", label: "Display", description: "How posts look", icon: UserRound },
];

function resolveSection(location: string): SettingsSection {
  const [path, query] = location.split("?");
  if (path === "/saved") return "saved";
  if (path === "/provider") return "provider";
  const requested = new URLSearchParams(query ?? "").get("section");
  return requested === "saved" || requested === "provider" || requested === "display" ? requested : "provider";
}

function DisplaySettings() {
  const { hideAuthorPhotos, setHideAuthorPhotos } = useHideAuthorPhotos();
  return <section className="mt-5 max-w-2xl">
    <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#a25d47]">Feed appearance</p>
    <h2 className="mt-1 text-2xl font-extrabold tracking-[-0.05em] text-[#432b1e]">Display</h2>
    <p className="mt-2 max-w-md text-[12px] leading-5 text-[#8e7463]">These preferences are stored on this device only and change nothing about the posts Faro collects.</p>

    <div className="mt-6 rounded-[22px] border border-[#eadfd2] bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-extrabold text-[#56392a]">Hide profile photos on posts</p>
          <p className="mt-1.5 max-w-sm text-[11px] leading-5 text-[#8e7463]">Shows each author's initial instead of their photo, everywhere a post appears. The handle, text, and link to the original post are unchanged.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={hideAuthorPhotos}
          onClick={() => setHideAuthorPhotos(!hideAuthorPhotos)}
          className={`relative h-7 w-12 shrink-0 rounded-full transition ${hideAuthorPhotos ? "bg-[#477b5b]" : "bg-[#e3d5c5]"}`}
        >
          <span className="sr-only">Hide profile photos on posts</span>
          <span className={`absolute top-1 grid h-5 w-5 place-items-center rounded-full bg-white shadow transition-all ${hideAuthorPhotos ? "left-6" : "left-1"}`}>{hideAuthorPhotos ? <Check className="h-3 w-3 text-[#477b5b]" /> : null}</span>
        </button>
      </div>
      <p className="mt-4 border-t border-[#f1e6d9] pt-3 text-[10px] leading-4 text-[#a08370]">Applies to every author equally — Faro never tries to infer anything about the people behind the posts it shows you.</p>
    </div>
  </section>;
}

export default function Settings() {
  const [location, setLocation] = useLocation();
  const [section, setSection] = useState<SettingsSection>(() => resolveSection(location));
  const saved = trpc.monitoring.saved.useQuery();
  const providerSetup = trpc.monitoring.providerSetup.useQuery();
  const selected = settingsItems.find(item => item.id === section)!;
  useEffect(() => {
    if (location.split("?")[0] === "/monitors") {
      setLocation("/search");
      return;
    }
    setSection(resolveSection(location));
  }, [location, setLocation]);
  const selectSection = (next: SettingsSection) => { setSection(next); setLocation(`/settings?section=${next}`); };

  return <div className="mx-auto max-w-6xl pb-10 pt-7 sm:pt-10">
    <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]"><aside className="self-start rounded-[26px] border border-[#eadfd2] bg-white p-2.5 shadow-[0_12px_28px_rgba(99,59,31,0.045)]"><nav className="flex gap-1 overflow-x-auto lg:flex-col">{settingsItems.map(item => { const Icon = item.icon; const active = item.id === section; return <button key={item.id} onClick={() => selectSection(item.id)} className={`flex min-w-[150px] items-center gap-3 rounded-2xl px-3 py-3 text-left transition lg:min-w-0 ${active ? "bg-[#f8e8d9] text-[#8f4e38] shadow-[inset_0_0_0_1px_rgba(185,105,77,0.1)]" : "text-[#755e4e] hover:bg-[#fff8f1]"}`}><span className={`grid h-8 w-8 place-items-center rounded-xl ${active ? "bg-white text-[#9c563e] shadow-sm" : "bg-[#fbf2e5] text-[#a27761]"}`}><Icon className="h-3.5 w-3.5" /></span><span className="min-w-0"><span className="block text-[11px] font-extrabold">{item.label}</span><span className="mt-0.5 block truncate text-[9px] text-[#a08370]">{item.description}</span></span></button>; })}</nav></aside><section className="min-w-0"><div className="mb-4 flex items-center gap-2 lg:hidden"><selected.icon className="h-4 w-4 text-[#a45a42]" /><span className="text-xs font-extrabold text-[#503629]">{selected.label}</span></div>{section === "provider" ? <ProviderSetup setup={providerSetup.data} loading={providerSetup.isLoading} /> : section === "display" ? <DisplaySettings /> : <SavedOrganizer rows={saved.data ?? []} loading={saved.isLoading} onFeed={() => setLocation("/")} />}</section></div>
  </div>;
}
