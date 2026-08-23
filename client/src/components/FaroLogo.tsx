type FaroLogoProps = {
  compact?: boolean;
  className?: string;
};

export default function FaroLogo({ compact = false, className = "" }: FaroLogoProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`} aria-label="Faro">
      <svg aria-hidden="true" viewBox="0 0 28 28" className="h-7 w-7 shrink-0">
        <rect x="2" y="2" width="24" height="24" rx="7" fill="#111214" />
        <path d="M8 19 14 7l6 12M10.1 15h7.8" fill="none" stroke="#fff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.15" />
      </svg>
      {!compact && <span className="text-[17px] font-extrabold lowercase tracking-[-0.075em] text-[#111214]">faro</span>}
    </div>
  );
}
