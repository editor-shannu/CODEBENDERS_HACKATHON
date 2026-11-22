export type HouseState = "paid" | "promised" | "owed";

/** paid when nothing is due, promised when an open PayPromise exists, otherwise owed. */
export function houseStatusOf(balance: number, hasOpenPromise: boolean): HouseState {
  if (balance <= 0) return "paid";
  return hasOpenPromise ? "promised" : "owed";
}

const LABEL: Record<HouseState, string> = {
  paid: "Paid: window lit",
  promised: "Promised: window half lit",
  owed: "Owes: window dark",
};

/** A small flat house: tiled roof, one window, a door. The window shows the fee status. */
export function HouseStatus({ status, size = 28, className = "", label }: { status: HouseState; size?: number; className?: string; label?: string }) {
  const lamp = "var(--color-lamp)";
  const brick = "var(--color-brick)";
  const plaster = "var(--color-plaster)";
  const deep = "var(--color-dusk-deep)";
  const roof = "#9c4a32";
  return (
    <svg
      role="img"
      aria-label={label ?? LABEL[status]}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={`shrink-0 ${className}`}
    >
      <title>{label ?? LABEL[status]}</title>
      {/* walls */}
      <rect x="6" y="14" width="20" height="16" fill={plaster} stroke={deep} strokeOpacity="0.35" strokeWidth="1" />
      {/* tiled roof */}
      <path d="M3 15 L16 4 L29 15 Z" fill={roof} />
      <path d="M8 11.5 H24 M11 9 H21 M13.5 6.8 H18.5" stroke={deep} strokeOpacity="0.35" strokeWidth="0.8" />
      {/* window */}
      <rect x="9" y="17" width="7" height="6" fill={status === "paid" ? lamp : deep} />
      {status === "promised" && <rect x="9" y="20" width="7" height="3" fill={lamp} fillOpacity="0.75" />}
      <path d="M12.5 17 V23 M9 20 H16" stroke={deep} strokeOpacity={status === "owed" ? 0 : 0.5} strokeWidth="0.7" />
      {/* door */}
      <rect
        x="19"
        y="19"
        width="5"
        height="11"
        fill={status === "owed" ? "none" : "#6b4a33"}
        stroke={status === "owed" ? brick : "none"}
        strokeWidth="1.4"
      />
    </svg>
  );
}
