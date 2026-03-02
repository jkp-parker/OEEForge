import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { machinesApi, oeeMetricsApi, downtimeEventsApi, downtimeCodesApi, type OEEMetric } from "@/lib/api";
import { OEEDonutChart } from "@/components/charts/OEEDonutChart";
import { DowntimeStackedChart } from "@/components/charts/DowntimeStackedChart";
import { RefreshCw } from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────

function toLocalDT(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

const PRESETS = [
  { label: "Last 24 Hrs", hours: 24 },
  { label: "Last 7 Days", hours: 24 * 7 },
  { label: "Last 30 Days", hours: 24 * 30 },
] as const;

const now = new Date();
const DEFAULT_FROM   = toLocalDT(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
const DEFAULT_TO     = toLocalDT(now);
const DEFAULT_PRESET = "Last 7 Days";

const avg = (arr: number[]) =>
  arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

function aggregateByMachine(data: OEEMetric[]) {
  const groups: Record<string, OEEMetric[]> = {};
  for (const row of data) {
    const mid = String(row.machine_id ?? "");
    if (!mid) continue;
    if (!groups[mid]) groups[mid] = [];
    groups[mid].push(row);
  }
  const numAvg = (vals: (number | null | undefined)[]) => {
    const clean = vals.filter((v): v is number => v != null);
    return clean.length ? clean.reduce((a, b) => a + b, 0) / clean.length : undefined;
  };
  return Object.values(groups).map((rows) => ({
    ...rows[0],
    oee:          numAvg(rows.map((r) => r.oee)),
    availability: numAvg(rows.map((r) => r.availability)),
    performance:  numAvg(rows.map((r) => r.performance)),
    quality:      numAvg(rows.map((r) => r.quality)),
    total_parts:  rows.reduce((s, r) => s + (r.total_parts ?? 0), 0),
    good_parts:   rows.reduce((s, r) => s + (r.good_parts  ?? 0), 0),
  } as OEEMetric));
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  isPercent = true,
  sub,
}: {
  label: string;
  value: number | null;
  isPercent?: boolean;
  sub?: string;
}) {
  const text =
    value == null ? "—" : isPercent ? `${value.toFixed(1)}%` : value.toLocaleString();
  const color =
    value == null || !isPercent
      ? "text-gray-800 dark:text-gray-200"
      : value >= 85
      ? "text-emerald-600"
      : value >= 60
      ? "text-amber-500"
      : "text-red-500";

  return (
    <div className="card px-5 py-4">
      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
        {label}
      </div>
      <div className={`text-3xl font-bold leading-none ${color}`}>{text}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [fromDate,     setFromDate]     = useState(DEFAULT_FROM);
  const [toDate,       setToDate]       = useState(DEFAULT_TO);
  const [activePreset, setActivePreset] = useState<string>(DEFAULT_PRESET);
  const [selectedMachine, setSelectedMachine] = useState("");

  function applyPreset(hours: number, label: string) {
    const to   = new Date();
    const from = new Date(to.getTime() - hours * 60 * 60 * 1000);
    setToDate(toLocalDT(to));
    setFromDate(toLocalDT(from));
    setActivePreset(label);
  }

  const queryParams = {
    from_time: new Date(fromDate).toISOString(),
    to_time:   new Date(toDate).toISOString(),
    machine_id: selectedMachine || undefined,
    limit: 5000,
  };

  // ── Queries ───────────────────────────────────────────────────────────────────

  const { data: machines = [] } = useQuery({
    queryKey: ["machines"],
    queryFn: () => machinesApi.list().then((r) => r.data),
  });

  const allMachineParams = {
    from_time: new Date(fromDate).toISOString(),
    to_time:   new Date(toDate).toISOString(),
    limit: 5000,
  };

  const {
    data: oeeData = [],
    isFetching,
    dataUpdatedAt,
    refetch,
  } = useQuery({
    queryKey: ["oee-metrics", "oee", fromDate, toDate, selectedMachine],
    queryFn: () => oeeMetricsApi.oee(queryParams).then((r) => r.data),
    refetchInterval: 60_000,
  });

  // Unfiltered OEE data so the Machine Summary table always shows all machines
  const { data: allOeeData = [] } = useQuery({
    queryKey: ["oee-metrics", "oee", fromDate, toDate, "all"],
    queryFn: () => oeeMetricsApi.oee(allMachineParams).then((r) => r.data),
    refetchInterval: 60_000,
  });

  const { data: downtimeEvents = [] } = useQuery({
    queryKey: ["downtime-events", fromDate, toDate, selectedMachine],
    queryFn: () =>
      downtimeEventsApi
        .list({
          from_time:  new Date(fromDate).toISOString(),
          to_time:    new Date(toDate).toISOString(),
          machine_id: selectedMachine ? Number(selectedMachine) : undefined,
        })
        .then((r) => r.data),
    refetchInterval: 60_000,
  });

  const { data: downtimeCodes = [] } = useQuery({
    queryKey: ["downtime-codes"],
    queryFn: () => downtimeCodesApi.list().then((r) => r.data),
  });

  // ── Derived data ──────────────────────────────────────────────────────────────
  // Average all snapshots in the selected period per machine so KPIs reflect
  // the full period, not just the latest snapshot.

  const latestByMachine = useMemo(() => aggregateByMachine(oeeData), [oeeData]);

  // Always show all machines in the summary table regardless of filter
  const allMachinesSummary = useMemo(() => aggregateByMachine(allOeeData), [allOeeData]);

  const kpi = useMemo(() => {
    if (!latestByMachine.length) return null;
    return {
      oee:          avg(latestByMachine.map((r) => (r.oee          ?? 0) * 100)),
      availability: avg(latestByMachine.map((r) => (r.availability ?? 0) * 100)),
      performance:  avg(latestByMachine.map((r) => (r.performance  ?? 0) * 100)),
      quality:      avg(latestByMachine.map((r) => (r.quality       ?? 0) * 100)),
      totalParts:   latestByMachine.reduce((s, r) => s + (r.total_parts ?? 0), 0),
      goodParts:    latestByMachine.reduce((s, r) => s + (r.good_parts  ?? 0), 0),
      rejects:      latestByMachine.reduce(
        (s, r) => s + Math.max(0, (r.total_parts ?? 0) - (r.good_parts ?? 0)),
        0
      ),
    };
  }, [latestByMachine]);

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString()
    : null;

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Plant OEE Overview</h1>
          {lastUpdated && (
            <p className="text-xs text-gray-400 mt-0.5">
              Updated {lastUpdated} · auto-refreshes every 60s
            </p>
          )}
        </div>
        <button
          className="btn-ghost p-2"
          onClick={() => refetch()}
          title="Refresh now"
        >
          <RefreshCw
            className={`h-4 w-4 text-gray-500 ${isFetching ? "animate-spin" : ""}`}
          />
        </button>
      </div>

      {/* ── Filter bar ── */}
      <div className="card px-4 py-3 flex items-center gap-4 flex-wrap">

        {/* Preset quick-select */}
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 flex-shrink-0">
          {PRESETS.map(({ label, hours }) => (
            <button
              key={label}
              onClick={() => applyPreset(hours, label)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                activePreset === label
                  ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 flex-shrink-0" />

        {/* From */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">
            From
          </span>
          <input
            type="datetime-local"
            value={fromDate}
            onChange={(e) => { setFromDate(e.target.value); setActivePreset(""); }}
            style={{ width: "13rem" }}
            className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* To */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">
            To
          </span>
          <input
            type="datetime-local"
            value={toDate}
            onChange={(e) => { setToDate(e.target.value); setActivePreset(""); }}
            style={{ width: "13rem" }}
            className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Machine */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">
            Machine
          </span>
          <select
            style={{ width: "11rem" }}
            className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            value={selectedMachine}
            onChange={(e) => setSelectedMachine(e.target.value)}
          >
            <option value="">All machines</option>
            {machines.map((m) => (
              <option key={m.id} value={String(m.id)}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard label="Plant OEE"   value={kpi?.oee          ?? null} />
        <KpiCard label="Availability" value={kpi?.availability ?? null} />
        <KpiCard label="Performance"  value={kpi?.performance  ?? null} />
        <KpiCard label="Quality"      value={kpi?.quality       ?? null} />
        <KpiCard
          label="Good Parts"
          value={kpi?.goodParts ?? null}
          isPercent={false}
          sub={kpi ? `of ${kpi.totalParts.toLocaleString()} total` : undefined}
        />
        <KpiCard
          label="Rejects"
          value={kpi?.rejects ?? null}
          isPercent={false}
          sub="in selected period"
        />
      </div>

      {/* ── OEE Breakdown (¼) + Machine Summary (¾) side by side ── */}
      <div className="grid grid-cols-4 gap-4 items-start">

        {/* OEE Donut — 1 column */}
        <div className="card col-span-1">
          <div className="px-5 pt-5 pb-2">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">OEE Breakdown</h3>
            <p className="text-xs text-gray-400 mt-0.5">Plant average</p>
          </div>
          <div className="px-4 pb-5 flex items-center justify-center min-h-[260px]">
            {kpi ? (
              <OEEDonutChart
                availability={kpi.availability}
                performance={kpi.performance}
                quality={kpi.quality}
                oee={kpi.oee}
                size={220}
              />
            ) : (
              <div className="text-sm text-gray-400 text-center px-2">
                {isFetching ? "Loading…" : "No data for selected period."}
              </div>
            )}
          </div>
        </div>

        {/* Machine Summary — 3 columns */}
        <div className="card col-span-3">
          <div className="px-6 pt-5 pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Machine Summary</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Click a row to filter the dashboard · click again to clear
              </p>
            </div>
            {selectedMachine && (
              <button
                onClick={() => setSelectedMachine("")}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                Clear filter
              </button>
            )}
          </div>
          {allMachinesSummary.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700">
                    <th className="table-th text-left pl-6 py-2">Machine</th>
                    <th className="table-th text-right py-2">OEE</th>
                    <th className="table-th text-right py-2">Availability</th>
                    <th className="table-th text-right py-2">Performance</th>
                    <th className="table-th text-right py-2 pr-6">Quality</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {allMachinesSummary.map((row) => {
                    const mid = String(row.machine_id);
                    const machine = machines.find(
                      (m) => String(m.id) === mid
                    );
                    const pct = (v?: number) =>
                      v != null ? `${(v * 100).toFixed(1)}%` : "—";
                    const oeeVal = (row.oee ?? 0) * 100;
                    const oeeColor =
                      oeeVal >= 85
                        ? "text-emerald-600"
                        : oeeVal >= 60
                        ? "text-amber-500"
                        : "text-red-500";
                    const isSelected = selectedMachine === mid;
                    return (
                      <tr
                        key={mid}
                        onClick={() => setSelectedMachine(isSelected ? "" : mid)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50"
                            : "hover:bg-gray-50 dark:hover:bg-gray-800"
                        }`}
                      >
                        <td className="table-td pl-6 py-2 font-medium text-gray-900 dark:text-gray-100">
                          {machine?.name ?? `Machine ${row.machine_id}`}
                        </td>
                        <td className={`table-td text-right py-2 font-semibold ${oeeColor}`}>
                          {pct(row.oee)}
                        </td>
                        <td className="table-td text-right py-2 text-gray-600 dark:text-gray-400">
                          {pct(row.availability)}
                        </td>
                        <td className="table-td text-right py-2 text-gray-600 dark:text-gray-400">
                          {pct(row.performance)}
                        </td>
                        <td className="table-td text-right py-2 pr-6 text-gray-600 dark:text-gray-400">
                          {pct(row.quality)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-6 py-8 text-sm text-gray-400 text-center">
              No machine data available for the selected period.
            </div>
          )}

        </div>
      </div>

      {/* ── Downtime by Code (stacked bar) ── */}
      <div className="card">
        <div className="px-6 pt-5 pb-3">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Downtime by Code</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Cumulative elapsed time per downtime code · selected period · stacked by top 5 machines
          </p>
        </div>
        <div className="px-6 pb-5">
          <DowntimeStackedChart
            events={downtimeEvents}
            codes={downtimeCodes}
            machines={machines}
            height={300}
          />
        </div>
      </div>
    </div>
  );
}
