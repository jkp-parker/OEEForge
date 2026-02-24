import { cn, oeeColor, pct } from "@/lib/utils";

interface OEEGaugeProps {
  label: string;
  value: number | null | undefined;
  target?: number | null;
  size?: "sm" | "md" | "lg";
}

export function OEEGauge({ label, value, target, size = "md" }: OEEGaugeProps) {
  const pctVal = value != null ? Math.round(value * 100) : null;
  const radius = size === "lg" ? 54 : size === "sm" ? 36 : 45;
  const stroke = size === "lg" ? 8 : size === "sm" ? 6 : 7;
  const svgSize = (radius + stroke) * 2 + 4;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = value != null ? circumference * (1 - Math.min(value, 1)) : circumference;

  const color =
    value == null ? "#94a3b8"
    : value >= 0.85 ? "#16a34a"
    : value >= 0.6 ? "#ca8a04"
    : "#dc2626";

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={svgSize} height={svgSize} className="-rotate-90">
        <circle
          cx={svgSize / 2}
          cy={svgSize / 2}
          r={radius}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={stroke}
        />
        <circle
          cx={svgSize / 2}
          cy={svgSize / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.5s ease" }}
        />
      </svg>
      <div className="text-center -mt-1" style={{ marginTop: -(svgSize / 2 + 8) }}>
        <div className={cn("font-bold", size === "lg" ? "text-3xl" : size === "sm" ? "text-lg" : "text-2xl", oeeColor(value))}>
          {pct(value)}
        </div>
        {target != null && (
          <div className="text-xs text-muted-foreground">Target: {pct(target)}</div>
        )}
      </div>
      <div className="text-sm font-medium text-center mt-1">{label}</div>
    </div>
  );
}
