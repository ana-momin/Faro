import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MessageCircleHeart } from "lucide-react";

const DEV_NAME = "Momin";
const DEV_AVATAR = "/momin-avatar.png";
const DEV_X_URL = "https://x.com/ana_momin";

function XLogo({ className }: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>;
}

/** Icon-button entry point for the developer feedback dialog, sized for either sidebar state. */
export function DevFeedbackTrigger({ collapsed }: { collapsed: boolean }) {
  return <Dialog>
    <DialogTrigger asChild>
      <button type="button" aria-label="Send feedback to the developer" title="Feedback" className={`grid place-items-center rounded-xl border border-[#eadfd2] bg-white text-[#9b6b53] transition hover:border-[#d9a97f] hover:bg-[#fff4e8] hover:text-[#85533d] active:scale-[0.96] ${collapsed ? "h-11 w-11" : "h-9 w-9"}`}>
        <MessageCircleHeart className="h-4 w-4" />
      </button>
    </DialogTrigger>
    <DialogContent className="max-w-sm gap-0 overflow-hidden rounded-[28px] border-[#eadfd2] bg-[#fffdfa] p-0" showCloseButton>
      <DialogHeader className="sr-only"><DialogTitle>Feedback for {DEV_NAME}</DialogTitle><DialogDescription>Contact the developer of Faro AI</DialogDescription></DialogHeader>
      <div className="relative overflow-hidden bg-[linear-gradient(135deg,#fdf0e2_0%,#fbe4cf_100%)] px-6 pb-14 pt-8 text-center">
        <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-[#e7c5a7]/50 blur-2xl" />
        <div className="pointer-events-none absolute -left-10 bottom-[-3rem] h-28 w-28 rounded-full bg-[#d9ecdd]/60 blur-2xl" />
        <p className="relative text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#a25d47]">Faro AI</p>
        <h2 className="relative mt-1.5 text-lg font-extrabold tracking-[-0.03em] text-[#3d2e23]">Got feedback or an idea?</h2>
      </div>
      <div className="relative -mt-10 px-6 pb-7">
        <div className="flex flex-col items-center">
          <Avatar className="h-20 w-20 border-4 border-[#fffdfa] shadow-[0_10px_24px_rgba(99,59,31,0.15)]">
            <AvatarImage src={DEV_AVATAR} alt={DEV_NAME} />
            <AvatarFallback className="bg-[#b85f45] text-xl font-extrabold text-white">{DEV_NAME.charAt(0)}</AvatarFallback>
          </Avatar>
          <p className="mt-3 text-base font-extrabold tracking-[-0.03em] text-[#3d2e23]">{DEV_NAME}</p>
          <p className="mt-0.5 text-[11px] font-bold text-[#a25d47]">Builder of Faro AI</p>
        </div>
        <p className="mt-5 text-center text-[13px] leading-6 text-[#725d4e]">Want a new option, or ran into something that isn't working right? I'd love to hear about it directly.</p>
        <div className="mt-5 flex flex-col gap-2.5">
          <a href={DEV_X_URL} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-xl bg-[#1d1d1f] px-4 py-3 text-xs font-extrabold text-white transition hover:bg-black active:scale-[0.98]"><XLogo className="h-3.5 w-3.5" />DM me on X</a>
          <p className="text-center text-[10px] leading-5 text-[#9a7c68]">Or mention <span className="font-extrabold text-[#8c523d]">@{DEV_NAME}</span> in the Pond Discord server.</p>
        </div>
      </div>
    </DialogContent>
  </Dialog>;
}
