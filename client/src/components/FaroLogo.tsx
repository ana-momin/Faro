type FaroLogoProps = {
  compact?: boolean;
  className?: string;
};

const FARO_MASCOT_URL = "/faro-mascot.png";

export default function FaroLogo({ compact = false, className = "" }: FaroLogoProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`} aria-label="Faro AI">
      <span className="h-7 w-7 shrink-0 overflow-hidden rounded-[9px] bg-[#bd5e45]">
        <img src={FARO_MASCOT_URL} alt="" loading="eager" decoding="sync" className="h-full w-full object-contain" />
      </span>
      {!compact && <span className="text-[17px] font-extrabold tracking-[-0.075em] text-[#111214]">Faro AI</span>}
    </div>
  );
}
