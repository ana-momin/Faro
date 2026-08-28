import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

/** Faro-styled replacement for window.confirm, used for every destructive confirmation in the app. */
export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel = "Delete", cancelLabel = "Cancel", destructive = true, pending = false, onConfirm }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  pending?: boolean;
  onConfirm: () => void;
}) {
  return <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContent className="rounded-[26px] border-[#eadfd2] bg-[#fffdfa] p-6">
      <AlertDialogHeader>
        <AlertDialogTitle className="text-base font-extrabold tracking-[-0.03em] text-[#3d2e23]">{title}</AlertDialogTitle>
        <AlertDialogDescription className="text-[12px] leading-5 text-[#8e7463]">{description}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel className="h-9 rounded-xl border-[#eadfd2] bg-white text-xs font-bold text-[#755e4e] hover:bg-[#fff8f1]">{cancelLabel}</AlertDialogCancel>
        <AlertDialogAction disabled={pending} onClick={event => { event.preventDefault(); onConfirm(); onOpenChange(false); }} className={`h-9 rounded-xl px-4 text-xs font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-60 ${destructive ? "bg-[#c2554a] hover:bg-[#a8483f]" : "bg-[#b85f45] hover:bg-[#9e4e37]"}`}>{pending ? "Working…" : confirmLabel}</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}
