// Minimal inline SVG icons (no icon dependency). Each takes a `color` prop.
export function AdvisorIcon({ name, color = "currentColor", size = 28 }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color,
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };
  if (name === "chart") {
    return (
      <svg {...common}>
        <line x1="3" y1="21" x2="21" y2="21" />
        <rect x="5" y="11" width="3" height="7" />
        <rect x="10.5" y="7" width="3" height="11" />
        <rect x="16" y="13" width="3" height="5" />
      </svg>
    );
  }
  if (name === "scale") {
    return (
      <svg {...common}>
        <path d="M12 3v18" />
        <path d="M7 7h10" />
        <path d="M7 7l-3 6a3 3 0 0 0 6 0z" />
        <path d="M17 7l-3 6a3 3 0 0 0 6 0z" />
        <path d="M8 21h8" />
      </svg>
    );
  }
  // trending
  return (
    <svg {...common}>
      <polyline points="3 17 9 11 13 15 21 7" />
      <polyline points="15 7 21 7 21 13" />
    </svg>
  );
}

export function ArrowIcon({ size = 18, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}
