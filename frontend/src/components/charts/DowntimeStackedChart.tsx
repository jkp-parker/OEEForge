import { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { DowntimeEvent, DowntimeCode, Machine } from "@/lib/api";

interface Props {
  events: DowntimeEvent[];   // last-7-days events passed from parent
  codes: DowntimeCode[];     // all downtime codes for label lookup
  machines: Machine[];
  height?: number;
}

// 6 categorical colours: top-5 machines + "Other"
const PALETTE = ["#6366f1", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#d1d5db"];

export function DowntimeStackedChart({ events, codes, machines, height = 300 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef       = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const svgEl     = svgRef.current;
    if (!container || !svgEl) return;

    const width   = container.clientWidth || 600;
    const margin  = { top: 12, right: 148, bottom: 64, left: 60 };
    const innerW  = width - margin.left - margin.right;
    const innerH  = height - margin.top - margin.bottom;

    // ── 1. Only use events that have both a duration and a reason code ─────────
    const valid = events.filter((e) => e.start_time && e.end_time && e.reason_code_id != null);

    // ── 2. Duration per machine (minutes) — pick top 5 ───────────────────────
    const durByMid: Record<string, number> = {};
    for (const e of valid) {
      const dur = (new Date(e.end_time!).getTime() - new Date(e.start_time).getTime()) / 60_000;
      const mid = String(e.machine_id);
      durByMid[mid] = (durByMid[mid] ?? 0) + dur;
    }
    const top5Ids = Object.entries(durByMid)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([mid]) => mid);

    const machineName = (mid: string) => {
      const m = machines.find((m) => String(m.id) === mid);
      return m?.name ?? `Machine ${mid}`;
    };

    const seriesKeys = [...top5Ids.map(machineName), "Other"];

    // ── 3. Aggregate minutes per (code × machine) ─────────────────────────────
    // "No code" bucket for events without a code (shouldn't reach here but safe)
    const codeName = (id: number | undefined) => {
      if (id == null) return "No code";
      const c = codes.find((c) => c.id === id);
      return c?.name ?? `Code ${id}`;
    };

    type Row = { code: string } & Record<string, number>;
    const rowMap = new Map<string, Row>();

    for (const e of valid) {
      const label = codeName(e.reason_code_id);
      if (!rowMap.has(label)) {
        const r: Row = { code: label } as Row;
        for (const k of seriesKeys) r[k] = 0;
        rowMap.set(label, r);
      }
      const row = rowMap.get(label)!;
      const dur = (new Date(e.end_time!).getTime() - new Date(e.start_time).getTime()) / 60_000;
      const mid = String(e.machine_id);
      const key = top5Ids.includes(mid) ? machineName(mid) : "Other";
      row[key] = (row[key] ?? 0) + dur;
    }

    // Sort codes by total descending, keep only top 10
    const data = [...rowMap.values()]
      .sort(
        (a, b) =>
          seriesKeys.reduce((s, k) => s + (b[k] ?? 0), 0) -
          seriesKeys.reduce((s, k) => s + (a[k] ?? 0), 0)
      )
      .slice(0, 10);

    const codeLabels = data.map((d) => d.code);

    // ── 4. d3.stack ───────────────────────────────────────────────────────────
    const stack = d3.stack<Row>().keys(seriesKeys).value((d, k) => d[k] ?? 0);
    const series = stack(data);

    // ── 5. Scales ─────────────────────────────────────────────────────────────
    const xScale = d3.scaleBand().domain(codeLabels).range([0, innerW]).padding(0.28);

    const yMax = d3.max(series, (s) => d3.max(s, (d) => d[1])) ?? 0;
    const yScale = d3.scaleLinear().domain([0, yMax * 1.08]).range([innerH, 0]).nice();

    const color = d3.scaleOrdinal<string>().domain(seriesKeys).range(PALETTE);

    // ── 6. SVG scaffold ───────────────────────────────────────────────────────
    const svg = d3.select(svgEl).attr("width", width).attr("height", height);

    let root = svg.select<SVGGElement>("g.chart-root");
    if (root.empty()) root = svg.append("g").attr("class", "chart-root");
    root.attr("transform", `translate(${margin.left},${margin.top})`);

    // ── 7. Gridlines ──────────────────────────────────────────────────────────
    let gridG = root.select<SVGGElement>("g.grid");
    if (gridG.empty()) gridG = root.append("g").attr("class", "grid");
    gridG
      .call(d3.axisLeft(yScale).ticks(5).tickSize(-innerW).tickFormat(() => ""))
      .call((g) => g.select(".domain").remove())
      .call((g) =>
        g.selectAll(".tick line").attr("stroke", "#f3f4f6").attr("stroke-dasharray", "3,3")
      );

    // ── 8. Stacked layers ─────────────────────────────────────────────────────
    const layers = root
      .selectAll<SVGGElement, d3.Series<Row, string>>("g.layer")
      .data(series, (d) => d.key);

    const enteredLayers = layers.enter().append("g").attr("class", "layer");
    const allLayers = layers.merge(enteredLayers).attr("fill", (d) => color(d.key));
    layers.exit().remove();

    // Tooltip div (created once, reused)
    const tooltip = d3
      .select(container)
      .selectAll<HTMLDivElement, null>("div.chart-tooltip")
      .data([null])
      .join("div")
      .attr("class", "chart-tooltip")
      .style("position", "absolute")
      .style("background", "white")
      .style("border", "1px solid #e5e7eb")
      .style("border-radius", "6px")
      .style("padding", "6px 10px")
      .style("font-size", "12px")
      .style("pointer-events", "none")
      .style("box-shadow", "0 2px 8px rgba(0,0,0,0.08)")
      .style("opacity", 0)
      .style("z-index", "10");

    allLayers.each(function (seriesData) {
      const layer = d3.select<SVGGElement, d3.Series<Row, string>>(this);

      const rects = layer
        .selectAll<SVGRectElement, d3.SeriesPoint<Row>>("rect")
        .data(seriesData, (d) => d.data.code);

      const entered = rects
        .enter()
        .append("rect")
        .attr("rx", 2)
        .attr("x", (d) => xScale(d.data.code) ?? 0)
        .attr("width", xScale.bandwidth())
        .attr("y", innerH)
        .attr("height", 0);

      rects
        .merge(entered)
        .on("mouseenter", function (event, d) {
          const key = (
            d3.select(this.parentNode as Element).datum() as d3.Series<Row, string>
          ).key;
          const mins = Math.round(d[1] - d[0]);
          tooltip
            .style("opacity", 1)
            .html(
              `<strong>${key}</strong><br/>${d.data.code}<br/>${mins} min`
            );
        })
        .on("mousemove", (event) => {
          tooltip
            .style("left", `${event.offsetX + 14}px`)
            .style("top", `${event.offsetY - 32}px`);
        })
        .on("mouseleave", () => tooltip.style("opacity", 0))
        .transition()
        .duration(600)
        .ease(d3.easeCubicOut)
        .attr("x", (d) => xScale(d.data.code) ?? 0)
        .attr("width", xScale.bandwidth())
        .attr("y", (d) => yScale(d[1]))
        .attr("height", (d) => Math.max(0, yScale(d[0]) - yScale(d[1])));

      rects
        .exit()
        .transition()
        .duration(300)
        .attr("y", innerH)
        .attr("height", 0)
        .remove();
    });

    // ── 9. X axis ─────────────────────────────────────────────────────────────
    let xAxisG = root.select<SVGGElement>("g.x-axis");
    if (xAxisG.empty()) xAxisG = root.append("g").attr("class", "x-axis");
    xAxisG
      .attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(xScale))
      .call((g) => g.select(".domain").remove())
      .call((g) =>
        g
          .selectAll<SVGTextElement, string>("text")
          .attr("font-size", 11)
          .attr("fill", "#6b7280")
          .attr("transform", "rotate(-35)")
          .style("text-anchor", "end")
      );

    // ── 10. Y axis ────────────────────────────────────────────────────────────
    let yAxisG = root.select<SVGGElement>("g.y-axis");
    if (yAxisG.empty()) yAxisG = root.append("g").attr("class", "y-axis");
    yAxisG
      .call(d3.axisLeft(yScale).ticks(5).tickFormat((d) => `${d}m`))
      .call((g) => g.select(".domain").remove())
      .call((g) => g.selectAll("text").attr("font-size", 11).attr("fill", "#9ca3af"));

    // Y axis label
    let yLabel = svg.select<SVGTextElement>("text.y-label");
    if (yLabel.empty()) {
      yLabel = svg.append("text").attr("class", "y-label");
    }
    yLabel
      .attr("transform", `translate(14,${margin.top + innerH / 2}) rotate(-90)`)
      .attr("text-anchor", "middle")
      .attr("font-size", 11)
      .attr("fill", "#9ca3af")
      .text("Elapsed (min)");

    // ── 11. Legend ────────────────────────────────────────────────────────────
    let legendG = svg.select<SVGGElement>("g.legend");
    if (legendG.empty()) legendG = svg.append("g").attr("class", "legend");
    legendG.attr("transform", `translate(${margin.left + innerW + 12},${margin.top + 4})`);

    const legendItems = legendG
      .selectAll<SVGGElement, string>("g.legend-item")
      .data(seriesKeys, (d) => d);

    const enteredLegend = legendItems.enter().append("g").attr("class", "legend-item");
    enteredLegend.append("rect").attr("width", 10).attr("height", 10).attr("rx", 3);
    enteredLegend.append("text").attr("x", 14).attr("y", 9).attr("font-size", 11);

    legendItems
      .merge(enteredLegend)
      .attr("transform", (_, i) => `translate(0,${i * 20})`)
      .select("rect")
      .attr("fill", (d) => color(d));

    legendG
      .selectAll<SVGGElement, string>("g.legend-item")
      .select("text")
      .attr("fill", "#374151")
      .text((d) => d);

    legendItems.exit().remove();
  }, [events, codes, machines, height]);

  if (events.filter((e) => e.reason_code_id != null).length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-gray-400">
        No coded downtime events in the last 7 days.
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
      <svg ref={svgRef} />
    </div>
  );
}
