interface Props { score: number; size?: "sm" | "lg" }

export default function HealthBadge({ score, size = "sm" }: Props) {
  const isHealthy = score >= 60;
  const isFair    = score >= 30;

  const borderColor = isHealthy ? "var(--good-border)" : isFair ? "var(--fair-border)" : "var(--bad-border)";
  const textColor   = isHealthy ? "var(--good-text)"   : isFair ? "var(--fair-text)"   : "var(--bad-text)";
  const bg          = isHealthy ? "var(--good-bg)"     : isFair ? "var(--fair-bg)"     : "var(--bad-bg)";
  const label       = isHealthy ? "Healthy"            : isFair ? "Fair"               : "Inactive";

  return (
    <span style={{
      display:       "inline-block",
      padding:       size === "lg" ? "4px 12px" : "3px 9px",
      border:        `1px solid ${borderColor}`,
      borderRadius:  "3px",
      color:         textColor,
      background:    bg,
      fontSize:      size === "lg" ? "14px" : "12px",
      fontWeight:    600,
      letterSpacing: "0.2px",
      whiteSpace:    "nowrap",
    }}>
      {score} · {label}
    </span>
  );
}
