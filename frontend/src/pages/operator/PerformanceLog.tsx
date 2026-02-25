import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { machinesApi, oeeMetricsApi, type OEEMetric, type Machine } from "@/lib/api";

// ── Helpers ───────────────────────────────────────────────────────────────────

function toLocalDT(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

function fmtPct(v: number | undefined): string {
  if (v == null) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

function fmtSeconds(v: number | undefined): string {
  if (v == null) return "—";
  const h = Math.floor(v / 3600);
  const m = Math.floor((v % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function pctClass(v: number | undefined): string {
  if (v == null) return "text-gray-400";
  if (v >= 0.85) return "text-green-600 font-semibold";
  if (v >= 0.65) return "text-yellow-600 font-semibold";
  return "text-red-600 font-semibold";
}

const PRESETS = [
  { label: "Last 24 Hrs", hours: 24 },
  { label: "Last 7 Days", hours: 24 * 7 },
  { label: "Last 30 Days", hours: 24 * 30 },
] as const;

const now = new Date();
const DEFAULT_FROM   = toLocalDT(new Date(now.getTime() - 24 * 60 * 60 * 1000));
const DEFAULT_TO     = toLocalDT(now);
const DEFAULT_PRESET = "Last 24 Hrs";

// ── Row type ──────────────────────────────────────────────────────────────────

interface PerformanceRow {
  machineId: string;
  machineName: string;
  shiftId: string;
  time: string;
  performance: number | undefined;
  totalParts: number | undefined;
  idealCycleTime: number | undefined;
  actualRunTimeSeconds: number | undefined;
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PerformanceLog() {
  const { user } = useAuth();

  const [fromDate,     setFromDate]     = useState(DEFAULT_FROM);
  const [toDate,       setToDate]       = useState(DEFAULT_TO);
  const [activePreset, setActivePreset] = useState<string>(DEFAULT_PRESET);
  const [filterMachine, setFilterMachine] = useState("");

  function applyPreset(hours: number, label: string) {
    const to   = new Date();
    const from = new Date(to.getTime() - hours * 60 * 60 * 1000);
    setToDate(toLocalDT(to));
    setFromDate(toLocalDT(from));
    setActivePreset(label);
  }

  const { data: machines = [] } = useQuery({
    queryKey: ["machines", user?.line_id],
    queryFn:  () => machinesApi.list(user?.line_id ?? undefined).then((r) => r.data),
  });

  const machineMap = new Map<string, string>(
    machines.map((m: Machine) => [String(m.id), m.name])
  );

  const { data: rawMetrics = [], isLoading } = useQuery({
    queryKey: ["performance-metrics", fromDate, toDate, filterMachine],
    queryFn: () =>
      oeeMetricsApi.performance({
        machine_id: filterMachine || undefined,
        from_time:  new Date(fromDate).toISOString(),
        to_time:    new Date(toDate).toISOString(),
        limit:      2000,
      }).then((r) => r.data),
    refetchInterval: 60_000,
  });

  // Build rows: one per machine+shift combination (keep latest point per pair)
  const rowMap = new Map<string, PerformanceRow>();
  for (const m of rawMetrics as OEEMetric[]) {
    const mid = m.machine_id ?? "";
    const sid = m.shift_id ?? "";
    const key = `${mid}__${sid}`;
    const existing = rowMap.get(key);
    // keep the latest (data is DESC ordered, so first seen = latest)
    if (!existing) {
      rowMap.set(key, {
        machineId:            mid,
        machineName:          machineMap.get(mid) ?? `Machine ${mid}`,
        shiftId:              sid,
        time:                 m.time ?? "",
        performance:          m.value,
        totalParts:           m.total_parts,
        idealCycleTime:       m.ideal_cycle_time,
        actualRunTimeSeconds: m.actual_run_time_seconds,
      });
    }
  }

  const rows = Array.from(rowMap.values()).sort((a, b) => {
    if (a.machineName < b.machineName) return -1;
    if (a.machineName > b.machineName) return 1;
    return b.shiftId.localeCompare(a.shiftId);
  });

  return (
    <div className="space-y-4">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Performance Details</h1>
        <p className="text-sm text-gray-500 mt-0.5">One row per machine per calculation window</p>
      </div>

      {/* Filter bar */}
      <div className="card px-4 py-3 flex items-center gap-4 flex-wrap">

        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 flex-shrink-0">
          {PRESETS.map(({ label, hours }) => (
            <button
              key={label}
              onClick={() => applyPreset(hours, label)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                activePreset === label
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="w-px h-6 bg-gray-200 flex-shrink-0" />

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">
            From
          </span>
          <input
            type="datetime-local"
            value={fromDate}
            onChange={(e) => { setFromDate(e.target.value); setActivePreset(""); }}
            style={{ width: "13rem" }}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">
            To
          </span>
          <input
            type="datetime-local"
            value={toDate}
            onChange={(e) => { setToDate(e.target.value); setActivePreset(""); }}
            style={{ width: "13rem" }}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">
            Machine
          </span>
          <select
            style={{ width: "11rem" }}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            value={filterMachine}
            onChange={(e) => setFilterMachine(e.target.value)}
          >
            <option value="">All machines</option>
            {machines.map((m: Machine) => (
              <option key={m.id} value={String(m.id)}>{m.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="px-6 pt-5 pb-3 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Performance by Machine & Shift</h3>
            <p className="text-xs text-gray-400 mt-0.5">Latest snapshot per machine per shift window</p>
          </div>
          <span className="text-xs text-gray-400">{rows.length} row{rows.length !== 1 ? "s" : ""}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-t border-gray-100 bg-gray-50">
                <th className="px-6 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Machine
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Shift Window
                </th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Performance
                </th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Total Parts
                </th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Ideal Cycle
                </th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide pr-6">
                  Run Time
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-400">
                    Loading…
                  </td>
                </tr>
              )}
              {!isLoading && rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-400">
                    No performance data in the selected period.
                  </td>
                </tr>
              )}
              {rows.map((row) => (
                <tr key={`${row.machineId}__${row.shiftId}`} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-3 font-medium text-gray-900">{row.machineName}</td>
                  <td className="px-4 py-3 text-gray-500">
                    <div>{row.time ? new Date(row.time).toLocaleString() : "—"}</div>
                    <div className="text-xs text-gray-400">{row.shiftId || "—"}</div>
                  </td>
                  <td className={`px-4 py-3 text-right ${pctClass(row.performance)}`}>
                    {fmtPct(row.performance)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {row.totalParts != null ? row.totalParts.toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500">
                    {row.idealCycleTime != null ? `${row.idealCycleTime}s` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500 pr-6">
                    {fmtSeconds(row.actualRunTimeSeconds)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
