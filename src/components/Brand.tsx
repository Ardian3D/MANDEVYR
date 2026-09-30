export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`brand ${compact ? "brand-compact" : ""}`}>
      <span className="brand-symbol">
        <img src="/logo-remove-bg.png" alt="" width="32" height="32" />
      </span>
      {!compact && (
        <span>
          MANDEVYR<span className="brand-period">.</span>
        </span>
      )}
    </span>
  );
}
