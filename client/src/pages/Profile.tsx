import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { getMembershipLabel, getProfileFirstName, getProfileInitials } from "@/lib/profile";
import { trpc } from "@/lib/trpc";
import { ArrowRight, BadgeCheck, Bot, Camera, Compass, LockKeyhole, LogOut, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { ChangeEvent, useRef } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function Profile() {
  const { user, logout } = useAuth();
  const utils = trpc.useUtils();
  const [, setLocation] = useLocation();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const firstName = getProfileFirstName(user?.name);
  const initials = getProfileInitials(user?.name);
  const membership = getMembershipLabel(user?.createdAt);
  const uploadPhoto = trpc.profile.uploadPhoto.useMutation({
    onSuccess: async () => { await utils.auth.me.invalidate(); toast.success("Profile photo updated."); },
    onError: error => toast.error(error.message),
  });
  const onPhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!/image\/(jpeg|png|webp)/.test(file.type)) { toast.error("Choose a JPG, PNG, or WebP image."); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error("Choose an image smaller than 2 MB."); return; }
    const reader = new FileReader();
    reader.onload = () => { if (typeof reader.result === "string") uploadPhoto.mutate({ dataUrl: reader.result }); };
    reader.readAsDataURL(file);
  };

  return <div className="mx-auto max-w-5xl pb-10">
    <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[#eadfd2] pb-6"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#f1d7b9] text-[#8f4e38]"><UserRound className="h-5 w-5" /></span><div><p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#a25d47]">Your Faro AI space</p><h1 className="mt-1 text-2xl font-extrabold tracking-[-0.06em]">Good to see you, {firstName}.</h1></div></div><span className="inline-flex items-center gap-2 rounded-full border border-[#ead9c4] bg-[#fffaf2] px-3 py-2 text-[10px] font-bold text-[#8e654e]"><span className="h-1.5 w-1.5 rounded-full bg-[#5f9774]" />Private workspace</span></header>

    <section className="relative mt-7 overflow-hidden rounded-[30px] border border-[#ead8c9] bg-[#fbf2e5] p-5 shadow-[0_16px_36px_rgba(99,59,31,0.07)] sm:p-8"><div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[#e7c5a7]/65 blur-3xl" /><div className="relative grid gap-7 md:grid-cols-[auto_1fr_auto] md:items-center"><div className="relative"><div className="absolute -inset-2 rounded-[28px] border border-[#e7c6ab]" /><Avatar className="relative h-24 w-24"><AvatarImage src={user?.avatarUrl || undefined} alt={user?.name || "Faro member"} /><AvatarFallback className="bg-[#b85f45] text-2xl font-extrabold text-white">{initials}</AvatarFallback></Avatar><input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onPhotoChange} /><button onClick={() => photoInputRef.current?.click()} disabled={uploadPhoto.isPending} className="absolute -bottom-2 -left-1 inline-flex h-8 items-center gap-1 rounded-full border-4 border-[#fbf2e5] bg-[#fffdf9] px-2 text-[9px] font-extrabold text-[#95513c] shadow-sm hover:bg-white disabled:opacity-60"><Camera className="h-3 w-3" />{uploadPhoto.isPending ? "Saving" : "Photo"}</button><span className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full border-4 border-[#fbf2e5] bg-[#e0f0e4] text-[#4b8664]"><BadgeCheck className="h-4 w-4" /></span></div><div className="min-w-0"><p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#a25d47]">Personal signal desk</p><h2 className="mt-2 truncate text-3xl font-extrabold tracking-[-0.065em] text-[#432b1e]">{user?.name || "Faro member"}</h2><p className="mt-2 truncate text-sm text-[#7e6351]">{user?.email || "Private Faro AI account"}</p><p className="mt-4 inline-flex items-center gap-1.5 text-[10px] font-bold text-[#9a725b]"><Sparkles className="h-3.5 w-3.5 text-[#b85f45]" />{membership}</p></div><div className="flex flex-wrap gap-2 md:justify-end"><Button onClick={() => setLocation("/")} className="h-11 rounded-2xl bg-[#b85f45] px-4 text-xs font-extrabold text-white shadow-[0_8px_18px_rgba(157,76,53,0.2)] hover:bg-[#9f4d36]">Open Discover <ArrowRight className="ml-2 h-3.5 w-3.5" /></Button></div></div></section>

    <section className="mt-6"><div className="flex items-end justify-between gap-4"><div><p className="text-sm font-extrabold tracking-[-0.03em]">How Faro works for you</p><p className="mt-1 text-[11px] text-[#9a8a7b]">Your workflow stays focused, private, and in your hands.</p></div></div><div className="mt-4 grid gap-3 sm:grid-cols-3"><ProfileMode icon={Bot} eyebrow="Agent pace" title="On demand" text="Faro checks the live public source only when you run it." tone="peach" /><ProfileMode icon={ShieldCheck} eyebrow="Decision style" title="Human-led" text="You decide what to keep. Faro never sends outreach." tone="sage" /><ProfileMode icon={LockKeyhole} eyebrow="Workspace" title="Private" text="Your brief and review process stay inside your account." tone="cream" /></div></section>

    <section className="mt-6 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]"><article className="relative overflow-hidden rounded-[28px] bg-[#38261d] p-6 text-white sm:p-7"><div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-[#d17452]/25 blur-3xl" /><div className="relative"><p className="text-[10px] font-extrabold uppercase tracking-[0.17em] text-[#f2bc9c]">Your review promise</p><h2 className="mt-4 max-w-md text-2xl font-extrabold leading-[1.02] tracking-[-0.06em]">Faro surfaces the signal. You keep the judgment.</h2><p className="mt-4 max-w-lg text-sm leading-6 text-white/65">Each qualified request opens with full context and reasons. Your next action is always a manual choice.</p><button onClick={() => setLocation("/")} className="mt-6 inline-flex items-center gap-2 text-xs font-extrabold text-[#f5c9a9] hover:text-[#ffe0c7]">Review qualified requests <ArrowRight className="h-3.5 w-3.5" /></button></div></article><article className="rounded-[28px] border border-[#eadfd2] bg-white p-6 sm:p-7"><div className="flex items-center justify-between"><div><p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#a25d47]">Account context</p><h2 className="mt-2 text-xl font-extrabold tracking-[-0.05em]">A calm, private desk.</h2></div><span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#fbf2e5] text-[#9c5a43]"><Compass className="h-4 w-4" /></span></div><div className="mt-6 space-y-3"><ProfileRow label="Email" value={user?.email || "Private account"} /><ProfileRow label="Membership" value={membership} /><ProfileRow label="External actions" value="Always manual" /></div></article></section>

    <section className="mt-4 rounded-[24px] border border-[#eadfd2] bg-white"><div className="flex flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-6"><div><p className="text-sm font-extrabold">Session control</p><p className="mt-1 text-[11px] text-[#9a8a7b]">Sign out of this Faro AI session on this device.</p></div><Button onClick={logout} variant="outline" className="h-10 rounded-xl border-[#eed5cc] px-4 text-xs font-bold text-[#a14941] hover:bg-[#fff4f0]"><LogOut className="mr-2 h-3.5 w-3.5" />Sign out</Button></div></section>
  </div>;
}

function ProfileMode({ icon: Icon, eyebrow, title, text, tone }: { icon: typeof Bot; eyebrow: string; title: string; text: string; tone: "peach" | "sage" | "cream" }) { const tones = { peach: "bg-[#f9e6d7] text-[#a85b40]", sage: "bg-[#e2eee4] text-[#4d8066]", cream: "bg-[#f8edcf] text-[#927020]" }; return <article className="rounded-[24px] border border-[#eadfd2] bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(98,59,34,0.06)]"><span className={`grid h-10 w-10 place-items-center rounded-2xl ${tones[tone]}`}><Icon className="h-4 w-4" /></span><p className="mt-5 text-[9px] font-extrabold uppercase tracking-[0.15em] text-[#9d8879]">{eyebrow}</p><h3 className="mt-1 text-base font-extrabold tracking-[-0.04em]">{title}</h3><p className="mt-2 text-[11px] leading-5 text-[#8a786a]">{text}</p></article>; }

function ProfileRow({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between gap-4 border-b border-[#f0e7df] pb-3 last:border-0 last:pb-0"><span className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#a28d7c]">{label}</span><span className="max-w-[60%] truncate text-right text-[11px] font-bold text-[#62483a]">{value}</span></div>; }
