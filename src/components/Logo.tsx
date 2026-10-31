type Props = {
  className?: string;
  /** Kept for existing call sites; the AGORA wordmark is the whole logo. */
  showWordmark?: boolean;
  /** "night": white wordmark on the dark discovery field. */
  tone?: "ink" | "night";
};

/**
 * Agora's wordmark (design: Naz Paşalı, co-founder, Oct 2026): AGORA set
 * in geometric shapes. Black on transparent; inverted on the night field.
 */
export function Logo({ className, tone = "ink" }: Props) {
  return (
    <img
      src="/agora-logo.png"
      alt="Agora"
      width={720}
      height={157}
      draggable={false}
      className={`block h-6 w-auto select-none sm:h-7 ${tone === "night" ? "invert" : ""} ${className ?? ""}`}
    />
  );
}

export function LogoMark({ className }: { className?: string }) {
  // Circle of people gathering around a central point.
  const dots = Array.from({ length: 8 }, (_, i) => {
    const angle = (i / 8) * Math.PI * 2 - Math.PI / 2;
    return { x: 16 + Math.cos(angle) * 10, y: 16 + Math.sin(angle) * 10 };
  });
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden>
      <circle cx="16" cy="16" r="13" stroke="currentColor" strokeWidth="0.6" opacity="0.3" />
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r="1.6" fill="currentColor" />
      ))}
      <circle cx="16" cy="16" r="2.6" fill="currentColor" />
    </svg>
  );
}
