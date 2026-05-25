type Props = { className?: string; showWordmark?: boolean };

export function Logo({ className, showWordmark = true }: Props) {
  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <LogoMark className="h-8 w-8 text-primary" />
      {showWordmark && (
        <span className="font-display text-2xl font-semibold tracking-tight text-foreground">
          Agora
        </span>
      )}
    </div>
  );
}

export function LogoMark({ className }: { className?: string }) {
  // Circle of dots gathering around a center, with a thin column beneath.
  const dots = Array.from({ length: 8 }, (_, i) => {
    const angle = (i / 8) * Math.PI * 2 - Math.PI / 2;
    return { x: 16 + Math.cos(angle) * 10, y: 14 + Math.sin(angle) * 10 };
  });
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden>
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r="1.6" fill="currentColor" />
      ))}
      <circle cx="16" cy="14" r="2.4" fill="currentColor" />
      <rect x="15.25" y="24" width="1.5" height="6" rx="0.4" fill="currentColor" opacity="0.7" />
      <rect x="13" y="29.5" width="6" height="1.2" rx="0.4" fill="currentColor" opacity="0.7" />
    </svg>
  );
}
