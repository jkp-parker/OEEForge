import { useRef, useState, useEffect, useMemo } from "react";
import * as d3 from "d3";
import type { OEEMetric, Machine } from "@/lib/api";

export type TrendMetric = "oee" | "availability" | "performance" | "quality";

interface Props {
  data: OEEMetric[];
  machines: Machine[];
  metric: TrendMetric;
  height?: number;
}

const MACHINE_COLORS = [
  "#6366f1", "#3b82f6", "#10b981", "#f59e0b",
  "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6",
];

const MARGIN = { top: 24, right: 24, bottom: 44, left: 52 };

function useContainerWidth(ref: React.RefObject<HTMLDivElement | null>): number {
  const [width, setWidth] = useState(600);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [ref]);
  return width;
}

export function OEETrendChart({ data, machines, metric, height = 300 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const xAxisRef = useRef<SVGGElement>(null);
  const yAxisRef = useRef<SVGGElement>(null);
  const containerWidth = useContainerWidth(containerRef);

  const [tooltip, setTooltip] = useState<{
    x: number;
    items: { name: string; value: number; color: string }[];
  } | null>(null);

  const innerWidth = containerWidth - MARGIN.left - MARGIN.right;
  const innerHeight = height - MARGIN.top - MARGIN.bottom;

  // Parse and sort data, group by machine
  const byMachine = useMemo(() => {
    const groups: Record<string, { time: Date; value: number }[]> = {};
    for (const row of data) {
      if (!row.time || row.machine_id == null) continue;
      const val = row[metric] as number | undefined;
      if (val == null) continue;
      const mid = String(row.machine_id);
      if (!groups[mid]) groups[mid] = [];
      groups[mid].push({ time: new Date(row.time), value: val * 100 });
    }
    for (const mid of Object.keys(groups)) {
      groups[mid].sort((a, b) => a.time.getTime() - b.time.getTime());
    }
    return groups;
  }, [data, metric]);

  const machineIds = Object.keys(byMachine);

  const allTimes = useMemo(
    () => data.filter((d) => d.time).map((d) => new Date(d.time!)),
    [data]
  );

  const xScale = useMemo(() => {
    const ext = d3.extent(allTimes) as [Date, Date];
    if (!ext[0]) return d3.scaleTime().domain([new Date(), new Date()]).range([0, innerWidth]);
    return d3.scaleTime().domain(ext).range([0, innerWidth]);
  }, [allTimes, innerWidth]);

  const yScale = useMemo(
    () => d3.scaleLinear().domain([0, 100]).nice().range([innerHeight, 0]),
    [innerHeight]
  );

  // Draw axes
  useEffect(() => {
    if (!xAxisRef.current) return;
    const tickCount = containerWidth < 400 ? 4 : 6;
    d3.select(xAxisRef.current)
      .call(
        d3
          .axisBottom(xScale)
          .ticks(tickCount)
          .tickFormat((d) => d3.timeFormat("%H:%M")(d as Date))
      )
      .call((g) => g.select(".domain").attr("stroke", "#e5e7eb"))
      .call((g) => g.selectAll(".tick line").attr("stroke", "#e5e7eb"))
      .call((g) =>
        g
          .selectAll<SVGTextElement, unknown>(".tick text")
          .attr("fill", "#9ca3af")
          .attr("font-size", "11")
      );
  }, [xScale, containerWidth]);

  useEffect(() => {
    if (!yAxisRef.current) return;
    d3.select(yAxisRef.current)
      .call(
        d3
          .axisLeft(yScale)
          .ticks(5)
          .tickFormat((d) => `${d}%`)
      )
      .call((g) => g.select(".domain").remove())
      .call((g) =>
        g
          .selectAll(".tick line")
          .attr("stroke", "#f3f4f6")
          .attr("x2", innerWidth)
      )
      .call((g) =>
        g
          .selectAll<SVGTextElement, unknown>(".tick text")
          .attr("fill", "#9ca3af")
          .attr("font-size", "11")
      );
  }, [yScale, innerWidth]);

  // Line generator
  const lineGen = useMemo(
    () =>
      d3
        .line<{ time: Date; value: number }>()
        .x((d) => xScale(d.time))
        .y((d) => yScale(d.value))
        .curve(d3.curveMonotoneX),
    [xScale, yScale]
  );

  // Hover handling
  const handleMouseMove = (e: React.MouseEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const hoverDate = xScale.invert(mouseX);

    const bisect = d3.bisector<{ time: Date; value: number }, Date>((d) => d.time).left;
    const items: { name: string; value: number; color: string }[] = [];

    machineIds.forEach((mid, i) => {
      const pts = byMachine[mid];
      if (!pts.length) return;
      const idx = Math.min(bisect(pts, hoverDate), pts.length - 1);
      const pt = pts[idx];
      const machine = machines.find((m) => String(m.id) === mid);
      items.push({
        name: machine?.name ?? `Machine ${mid}`,
        value: +pt.value.toFixed(1),
        color: MACHINE_COLORS[i % MACHINE_COLORS.length],
      });
    });

    setTooltip({ x: mouseX, items });
  };

  const hasData = data.length > 0 && machineIds.length > 0;

  return (
    <div ref={containerRef} className="relative w-full">
      {!hasData ? (
        <div
          className="flex items-center justify-center text-sm text-gray-400"
          style={{ height }}
        >
          No data for this time range — metrics are written every OEE calculation interval.
        </div>
      ) : (
        <>
          <svg width={containerWidth} height={height} className="overflow-visible">
            <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
              {/* 85% target line */}
              <line
                x1={0}
                y1={yScale(85)}
                x2={innerWidth}
                y2={yScale(85)}
                stroke="#10b981"
                strokeDasharray="5 4"
                strokeWidth={1.5}
                opacity={0.5}
              />
              <text
                x={innerWidth + 3}
                y={yScale(85) + 4}
                fontSize={10}
                fill="#10b981"
                opacity={0.7}
              >
                85%
              </text>

              {/* Lines */}
              {machineIds.map((mid, i) => {
                const pts = byMachine[mid];
                const path = lineGen(pts) ?? "";
                return (
                  <path
                    key={mid}
                    d={path}
                    fill="none"
                    stroke={MACHINE_COLORS[i % MACHINE_COLORS.length]}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                );
              })}

              {/* X Axis */}
              <g ref={xAxisRef} transform={`translate(0,${innerHeight})`} />
              {/* Y Axis */}
              <g ref={yAxisRef} />

              {/* Invisible hover overlay */}
              <rect
                x={0}
                y={0}
                width={innerWidth}
                height={innerHeight}
                fill="transparent"
                onMouseMove={handleMouseMove}
                onMouseLeave={() => setTooltip(null)}
              />

              {/* Tooltip vertical line */}
              {tooltip && (
                <line
                  x1={tooltip.x}
                  y1={0}
                  x2={tooltip.x}
                  y2={innerHeight}
                  stroke="#d1d5db"
                  strokeWidth={1}
                  pointerEvents="none"
                />
              )}
            </g>
          </svg>

          {/* Legend */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 px-1">
            {machineIds.map((mid, i) => {
              const machine = machines.find((m) => String(m.id) === mid);
              return (
                <span key={mid} className="flex items-center gap-1.5 text-xs text-gray-500">
                  <span
                    className="inline-block w-3 h-0.5 rounded-full"
                    style={{ backgroundColor: MACHINE_COLORS[i % MACHINE_COLORS.length] }}
                  />
                  {machine?.name ?? `Machine ${mid}`}
                </span>
              );
            })}
          </div>

          {/* Tooltip popover */}
          {tooltip && (
            <div
              className="absolute bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs pointer-events-none z-10"
              style={{
                left: Math.min(
                  tooltip.x + MARGIN.left + 10,
                  containerWidth - 150
                ),
                top: MARGIN.top + 8,
              }}
            >
              {tooltip.items.map((item) => (
                <div key={item.name} className="flex items-center gap-2 py-0.5">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-gray-500 truncate max-w-24">{item.name}</span>
                  <span className="font-semibold ml-auto pl-2">{item.value}%</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
