type AlphaXLogoProps = {
  compact?: boolean;
  className?: string;
};

export default function AlphaXLogo({ compact = false, className = "" }: AlphaXLogoProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`} aria-label="Alpha X">
      <span className="relative grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-[10px] bg-[#111a24] shadow-[0_6px_16px_rgba(29,72,104,0.18)]">
        <span className="absolute h-[13px] w-[13px] rotate-45 border border-[#b7e3fb]" />
        <span className="absolute h-1.5 w-1.5 rounded-full bg-[#f2c7d1]" />
      </span>
      {!compact && <span className="text-[15px] font-extrabold uppercase tracking-[-0.07em] text-[#111a24]">Alpha <span className="text-[#4e8aad]">X</span></span>}
    </div>
  );
}
