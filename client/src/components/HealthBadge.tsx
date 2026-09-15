interface Props { score: number; size?: "sm" | "lg" }

export default function HealthBadge({ score, size = "sm" }: Props) {
  const color  = score >= 70 ? "var(--green)" : score >= 40 ? "var(--yellow)" : "var(--red)";
  const label  = score >= 70 ? "Healthy"       : score >= 40 ? "Fair"          : "Inactive";
  const fSize  = size === "lg" ? "22px" : "13px";
  const pad    = size === "lg" ? "6px 14px" : "2px 8px";

  return (
    <span style={{
      display:      "inline-flex",
      alignItems:   "center",
      gap:          "6px",
      padding:      pad,
      borderRadius: "20px",
      border:       `1px solid ${color}`,
      color,
      fontSize:     fSize,
      fontWeight:   600,
      whiteSpace:   "nowrap",
    }}>
      <span style={{ fontSize: size === "lg" ? "14px" : "10px" }}>●</span>
      {size === "lg" ? `${score}/100 · ${label}` : score}
    </span>
  );
}
