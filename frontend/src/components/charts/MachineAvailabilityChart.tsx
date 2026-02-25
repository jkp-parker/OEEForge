import { useRef, useState, useEffect, useMemo } from "react";
import * as d3 from "d3";

export interface MachineBarDatum {
  machineId: string;
  machineName: string;
  availability: number; // 0-100
  performance: number;
  quality: number;
  oee: number;
}

interface Props {
  data: MachineBarDatum[];
}

const MARGIN = { top: 10, right: 56, bottom: 36, left: 96 };
const BAR_HEIGHT = 26;
const BAR_PADDING = 0.38;

function barColor(value: number): string {
  if (value >= 85) return "#10b981";
  if (value >= 60) return "#f59e0b";
  return "#ef4444";
}

function useContainerWidth(ref: React.RefObject<HTMLDivElement | null>): number {
  const [width, setWidth] = useState(400);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [ref]);
  return width;
}

export function MachineAvailabilityChart({ data }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const xAxisRef = useRef<SVGGElement>(null);
  const yAxisRef = useRef<SVGGElement>(null);
  const containerWidth = useContainerWidth(containerRef);

  const sorted = useMemo(
    () => [...data].sort((a, b) => b.availability - a.availability),
    [data]
  );

  const innerWidth = containerWidth - MARGIN.left - MARGIN.right;
  const innerHeight = Math.max(
    sorted.length * (BAR_HEIGHT / (1 - BAR_PADDING)),
    60
  );
  const totalHeight = innerHeight + MARGIN.top + MARGIN.bottom;

  const xScale = useMemo(
    () => d3.scaleLinear().domain([0, 100]).range([0, innerWidth]),
    [innerWidth]
  );

  const yScale = useMemo(
    () =>
      d3
        .scaleBand()
        .domain(sorted.map((d) => d.machineName))
        .range([0, innerHeight])
        .padding(BAR_PADDING),
    [sorted, innerHeight]
  );

  useEffect(() => {
    if (!xAxisRef.current) return;
    d3.select(xAxisRef.current)
      .call(
        d3
          .axisBottom(xScale)
          .ticks(5)
          .tickFormat((d) => `${d}%`)
      )
      .call((g) => g.select(".domain").attr("stroke", "#e5e7eb"))
      .call((g) => g.selectAll(".tick line").attr("stroke", "#e5e7eb"))
      .call((g) =>
        g
          .selectAll<SVGTextElement, unknown>(".tick text")
          .attr("fill", "#9ca3af")
          .attr("font-size", "11")
      );
  }, [xScale]);

  useEffect(() => {
    if (!yAxisRef.current) return;
    d3.select(yAxisRef.current)
      .call(d3.axisLeft(yScale).tickSize(0))
      .call((g) => g.select(".domain").remove())
      .call((g) =>
        g
          .selectAll<SVGTextElement, unknown>(".tick text")
          .attr("fill", "#374151")
          .attr("font-size", "12")
          .attr("dx", "-4")
      );
  }, [yScale]);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-gray-400">
        No machine data available.
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full">
      <svg width={containerWidth} height={totalHeight}>
        <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
          {/* Grid lines */}
          {xScale.ticks(5).map((tick) => (
            <line
              key={tick}
              x1={xScale(tick)}
              y1={0}
              x2={xScale(tick)}
              y2={innerHeight}
              stroke="#f3f4f6"
              strokeWidth={1}
            />
          ))}

          {/* 85% target */}
          <line
            x1={xScale(85)}
            y1={0}
            x2={xScale(85)}
            y2={innerHeight}
            stroke="#10b981"
            strokeDasharray="5 4"
            strokeWidth={1.5}
            opacity={0.6}
          />

          {/* Bars */}
          {sorted.map((d) => {
            const y = yScale(d.machineName) ?? 0;
            const bh = yScale.bandwidth();
            const bw = xScale(d.availability);
            const color = barColor(d.availability);
            const labelInside = bw > 52;

            return (
              <g key={d.machineId}>
                {/* Track */}
                <rect
                  x={0}
                  y={y}
                  width={innerWidth}
                  height={bh}
                  fill="#f9fafb"
                  rx={4}
                />
                {/* Bar */}
                <rect
                  x={0}
                  y={y}
                  width={Math.max(bw, 4)}
                  height={bh}
                  fill={color}
                  rx={4}
                  opacity={0.85}
                />
                {/* Value label */}
                <text
                  x={labelInside ? bw - 6 : bw + 6}
                  y={y + bh / 2}
                  dominantBaseline="middle"
                  textAnchor={labelInside ? "end" : "start"}
                  fontSize={11}
                  fontWeight={600}
                  fill={labelInside ? "#fff" : "#374151"}
                >
                  {d.availability.toFixed(1)}%
                </text>

                {/* OEE sublabel */}
                <text
                  x={innerWidth + 4}
                  y={y + bh / 2}
                  dominantBaseline="middle"
                  fontSize={10}
                  fill="#9ca3af"
                >
                  OEE {d.oee.toFixed(0)}%
                </text>
              </g>
            );
          })}

          {/* X Axis */}
          <g ref={xAxisRef} transform={`translate(0,${innerHeight})`} />
          {/* Y Axis */}
          <g ref={yAxisRef} />
        </g>
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-2 px-1 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-emerald-500 opacity-85 inline-block" /> ≥85%
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-amber-400 opacity-85 inline-block" /> 60–84%
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-red-500 opacity-85 inline-block" /> &lt;60%
        </span>
      </div>
    </div>
  );
}
