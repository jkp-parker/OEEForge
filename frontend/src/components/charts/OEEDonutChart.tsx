import { useEffect, useRef } from "react";
import * as d3 from "d3";

interface Segment {
  key: string;
  label: string;
  color: string;
  value: number; // 0–100
}

interface Props {
  availability: number | null;
  performance: number | null;
  quality: number | null;
  oee: number | null;
  size?: number;
}

function oeeColor(v: number | null): string {
  if (v == null) return "#374151";
  if (v >= 85) return "#059669";
  if (v >= 60) return "#d97706";
  return "#dc2626";
}

export function OEEDonutChart({ availability, performance, quality, oee, size = 300 }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  const segments: Segment[] = [
    { key: "availability", label: "Availability", color: "#3b82f6", value: availability ?? 0 },
    { key: "performance",  label: "Performance",  color: "#10b981", value: performance ?? 0 },
    { key: "quality",      label: "Quality",      color: "#f59e0b", value: quality ?? 0 },
  ];

  useEffect(() => {
    if (!svgRef.current) return;

    const outerR = size * 0.42;
    const innerR = size * 0.27;
    const cx = size / 2;
    const cy = size / 2;

    const svg = d3.select(svgRef.current).attr("viewBox", `0 0 ${size} ${size}`);

    let g = svg.select<SVGGElement>("g.donut-root");
    if (g.empty()) {
      g = svg.append("g")
        .attr("class", "donut-root")
        .attr("transform", `translate(${cx},${cy})`);
    }

    const pie = d3
      .pie<Segment>()
      // floor at 1 so a zero-value slice stays visible as a thin arc
      .value((d) => Math.max(d.value, 1))
      .sort(null)
      .padAngle(0.028);

    const arcGen = d3
      .arc<d3.PieArcDatum<Segment>>()
      .innerRadius(innerR)
      .outerRadius(outerR)
      .cornerRadius(6);

    const arcHover = d3
      .arc<d3.PieArcDatum<Segment>>()
      .innerRadius(innerR - 4)
      .outerRadius(outerR + 10)
      .cornerRadius(6);

    const pieData = pie(segments);

    const paths = g
      .selectAll<SVGPathElement, d3.PieArcDatum<Segment>>("path.arc-slice")
      .data(pieData, (d) => d.data.key);

    // Enter: seed _current with a zero-width arc at the start angle so the
    // first transition grows from nothing (matching the Observable pattern).
    const entered = paths
      .enter()
      .append("path")
      .attr("class", "arc-slice")
      .attr("fill", (d) => d.data.color)
      .attr("opacity", 0.88)
      .each(function (d) {
        (this as any)._current = { ...d, endAngle: d.startAngle };
      });

    const merged = paths.merge(entered);

    // Hover expand/contract
    merged
      .on("mouseenter", function (_, d) {
        d3.select(this)
          .raise()
          .transition().duration(130)
          .attr("d", arcHover(d) ?? "")
          .attr("opacity", 1);
      })
      .on("mouseleave", function (_, d) {
        d3.select(this)
          .transition().duration(130)
          .attr("d", arcGen(d) ?? "")
          .attr("opacity", 0.88);
      });

    // Animated update — interpolate from stored angles (_current) to new angles.
    // Store the new angle in _current so the next update can pick it up.
    merged
      .transition().duration(750).ease(d3.easeCubicInOut)
      .attr("fill", (d) => d.data.color)
      .attrTween("d", function (d) {
        const prev: d3.PieArcDatum<Segment> =
          (this as any)._current ?? { ...d, endAngle: d.startAngle };
        const interp = d3.interpolate(prev, d);
        (this as any)._current = d;
        return (t: number) => arcGen(interp(t)) ?? "";
      });

    // Exit: collapse to zero-width before removing
    paths
      .exit()
      .transition().duration(350)
      .attrTween("d", function (d) {
        const typed = d as d3.PieArcDatum<Segment>;
        const interp = d3.interpolate(typed, { ...typed, endAngle: typed.startAngle });
        return (t: number) => arcGen(interp(t)) ?? "";
      })
      .remove();
  }, [availability, performance, quality, size]);

  const oeeText = oee != null ? `${oee.toFixed(1)}%` : "—";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 52,
        flexWrap: "wrap",
        padding: "8px 0",
      }}
    >
      {/* Donut SVG with absolute-positioned center label */}
      <div style={{ position: "relative", flexShrink: 0 }}>
        <svg ref={svgRef} width={size} height={size} />
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            textAlign: "center",
            pointerEvents: "none",
            userSelect: "none",
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: "#9ca3af",
              textTransform: "uppercase",
              letterSpacing: "0.07em",
              marginBottom: 4,
            }}
          >
            Plant OEE
          </div>
          <div
            style={{
              fontSize: 44,
              fontWeight: 800,
              lineHeight: 1,
              color: oeeColor(oee),
              letterSpacing: "-0.02em",
            }}
          >
            {oeeText}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        {segments.map((s) => (
          <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: s.color,
                flexShrink: 0,
                boxShadow: `0 0 0 3px ${s.color}28`,
              }}
            />
            <div>
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.3 }}>{s.label}</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#111827", lineHeight: 1.2 }}>
                {s.value > 0 ? `${s.value.toFixed(1)}%` : "—"}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
