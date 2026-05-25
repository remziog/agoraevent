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
