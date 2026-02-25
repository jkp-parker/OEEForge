import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { machinesApi, linesApi, oeeMetricsApi, type OEEMetric } from "@/lib/api";
import { OEETrendChart, type TrendMetric } from "@/components/charts/OEETrendChart";
import { MachineAvailabilityChart, type MachineBarDatum } from "@/components/charts/MachineAvailabilityChart";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend,
} from "recharts";
import { RefreshCw } from "lucide-react";

// ── Types / helpers ────────────────────────────────────────────────────────────

type TimeRange = "4h" | "8h" | "24h" | "7d";

const TIME_RANGES: { label: string; value: TimeRange }[] = [
  { label: "4h", value: "4h" },
  { label: "8h", value: "8h" },
  { label: "24h", value: "24h" },
  { label: "7d", value: "7d" },
];

const RANGE_HOURS: Record<TimeRange, number> = { "4h": 4, "8h": 8, "24h": 24, "7d": 168 };

function fromTimeISO(range: TimeRange) {
  return new Date(Date.now() - RANGE_HOURS[range] * 3_600_000).toISOString();
}

const avg = (arr: number[]) =>
  arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

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
  const text = value == null ? "—" : isPercent ? `${value.toFixed(1)}%` : value.toLocaleString();
  const color =
    value == null || !isPercent
      ? "text-gray-800"
      : value >= 85
      ? "text-emerald-600"
      : value >= 60
      ? "text-amber-500"
      : "text-red-500";

  return (
    <div className="card px-5 py-4">
      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</div>
      <div className={`text-3xl font-bold leading-none ${color}`}>{text}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [timeRange, setTimeRange] = useState<TimeRange>("8h");
  const [selectedMachine, setSelectedMachine] = useState("");
  const [trendMetric, setTrendMetric] = useState<TrendMetric>("oee");

  const fromTime = fromTimeISO(timeRange);
  const queryParams = { from_time: fromTime, machine_id: selectedMachine || undefined, limit: 5000 };

  // ── Queries ──────────────────────────────────────────────────────────────────

  const { data: machines = [] } = useQuery({
    queryKey: ["machines"],
    queryFn: () => machinesApi.list().then((r) => r.data),
  });

  const { data: lines = [] } = useQuery({
    queryKey: ["lines"],
    queryFn: () => linesApi.list().then((r) => r.data),
  });

  const {
    data: oeeData = [],
    isFetching,
    dataUpdatedAt,
    refetch,
  } = useQuery({
    queryKey: ["oee-metrics", "oee", timeRange, selectedMachine],
    queryFn: () => oeeMetricsApi.oee(queryParams).then((r) => r.data),
    refetchInterval: 60_000,
  });

  const { data: perfData = [] } = useQuery({
    queryKey: ["oee-metrics", "performance", timeRange, selectedMachine],
    queryFn: () => oeeMetricsApi.performance(queryParams).then((r) => r.data),
    refetchInterval: 60_000,
  });

  // ── Latest snapshot per machine ───────────────────────────────────────────────
  // OEE data is DESC so first record per machine = most recent

  const latestByMachine = useMemo(() => {
    const map: Record<string, OEEMetric> = {};
    for (const row of oeeData) {
      const mid = String(row.machine_id ?? "");
      if (mid && !map[mid]) map[mid] = row;
    }
    return Object.values(map);
  }, [oeeData]);

  // ── KPIs ──────────────────────────────────────────────────────────────────────

  const kpi = useMemo(() => {
    if (!latestByMachine.length) return null;
    return {
      oee: avg(latestByMachine.map((r) => (r.oee ?? 0) * 100)),
      availability: avg(latestByMachine.map((r) => (r.availability ?? 0) * 100)),
      performance: avg(latestByMachine.map((r) => (r.performance ?? 0) * 100)),
      quality: avg(latestByMachine.map((r) => (r.quality ?? 0) * 100)),
      totalParts: latestByMachine.reduce((s, r) => s + (r.total_parts ?? 0), 0),
      goodParts: latestByMachine.reduce((s, r) => s + (r.good_parts ?? 0), 0),
      rejects: latestByMachine.reduce(
        (s, r) => s + Math.max(0, (r.total_parts ?? 0) - (r.good_parts ?? 0)),
        0
      ),
    };
  }, [latestByMachine]);

  // ── Availability bar chart (D3) ───────────────────────────────────────────────

  const machineBarData: MachineBarDatum[] = useMemo(
    () =>
      latestByMachine.map((row) => {
        const m = machines.find((m) => String(m.id) === String(row.machine_id));
        return {
          machineId: String(row.machine_id),
          machineName: m?.name ?? `Machine ${row.machine_id}`,
          availability: (row.availability ?? 0) * 100,
          performance: (row.performance ?? 0) * 100,
          quality: (row.quality ?? 0) * 100,
          oee: (row.oee ?? 0) * 100,
        };
      }),
    [latestByMachine, machines]
  );

  // ── OEE Components recharts bar ───────────────────────────────────────────────

  const componentsData = useMemo(
    () =>
      latestByMachine.map((row) => {
        const m = machines.find((m) => String(m.id) === String(row.machine_id));
        return {
          name: m?.name ?? `M${row.machine_id}`,
          Availability: +((row.availability ?? 0) * 100).toFixed(1),
          Performance: +((row.performance ?? 0) * 100).toFixed(1),
          Quality: +((row.quality ?? 0) * 100).toFixed(1),
          OEE: +((row.oee ?? 0) * 100).toFixed(1),
        };
      }),
    [latestByMachine, machines]
  );

  // ── OEE by Line recharts bar ──────────────────────────────────────────────────

  const lineData = useMemo(() =>
    lines.map((line) => {
      const lineMachines = machines.filter((m) => m.line_id === line.id);
      const rows = latestByMachine.filter((r) =>
        lineMachines.some((m) => String(m.id) === String(r.machine_id))
      );
      return {
        name: line.name,
        Availability: rows.length ? +(avg(rows.map((r) => (r.availability ?? 0) * 100))!.toFixed(1)) : 0,
        OEE: rows.length ? +(avg(rows.map((r) => (r.oee ?? 0) * 100))!.toFixed(1)) : 0,
      };
    }),
    [lines, machines, latestByMachine]
  );

  // ── Production output over time ───────────────────────────────────────────────

  const productionData = useMemo(() => {
    const buckets: Record<string, { total: number; good: number }> = {};
    for (const row of perfData) {
      if (!row.time) continue;
      const t = new Date(row.time);
      t.setSeconds(0, 0);
      t.setMinutes(Math.floor(t.getMinutes() / 15) * 15);
      const key = t.toISOString();
      if (!buckets[key]) buckets[key] = { total: 0, good: 0 };
      buckets[key].total += row.total_parts ?? 0;
      buckets[key].good += row.good_parts ?? 0;
    }
    return Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([ts, v]) => ({
        time: new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        "Total Parts": v.total,
        "Good Parts": v.good,
      }));
  }, [perfData]);

  // ── Production by Shift ───────────────────────────────────────────────────────

  const shiftData = useMemo(() => {
    const map: Record<string, { total: number; good: number }> = {};
    for (const row of oeeData) {
      const key = row.shift_id ? String(row.shift_id) : "No Shift";
      if (!map[key]) map[key] = { total: 0, good: 0 };
      map[key].total += row.total_parts ?? 0;
      map[key].good += row.good_parts ?? 0;
    }
    return Object.entries(map).map(([shift, v]) => ({
      shift,
      "Total Parts": v.total,
      "Good Parts": v.good,
    }));
  }, [oeeData]);

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString()
    : null;

  // ── Render ─────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* ── Header + Filters ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900">Plant OEE Overview</h1>
          {lastUpdated && (
            <p className="text-xs text-gray-400 mt-0.5">Updated {lastUpdated} · auto-refreshes every 60s</p>
          )}
        </div>

        {/* Time range pills */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 flex-shrink-0">
          {TIME_RANGES.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setTimeRange(opt.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                timeRange === opt.value
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Machine filter */}
        <select
          className="input w-40 text-sm flex-shrink-0"
          value={selectedMachine}
          onChange={(e) => setSelectedMachine(e.target.value)}
        >
          <option value="">All machines</option>
          {machines.map((m) => (
            <option key={m.id} value={String(m.id)}>{m.name}</option>
          ))}
        </select>

        <button className="btn-ghost p-2 flex-shrink-0" onClick={() => refetch()} title="Refresh now">
          <RefreshCw className={`h-4 w-4 text-gray-500 ${isFetching ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard label="Plant OEE" value={kpi?.oee ?? null} />
        <KpiCard label="Availability" value={kpi?.availability ?? null} />
        <KpiCard label="Performance" value={kpi?.performance ?? null} />
        <KpiCard label="Quality" value={kpi?.quality ?? null} />
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

      {/* ── OEE Trend (D3 multi-line) ── */}
      <div className="card">
        <div className="px-6 pt-5 pb-3 flex items-center gap-3 flex-wrap">
          <div className="flex-1">
            <h3 className="text-base font-semibold text-gray-900">OEE Trend over Time</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Hover to inspect values · one line per machine
            </p>
          </div>
          {/* Metric tab switcher */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {(
              [
                { key: "oee", label: "OEE" },
                { key: "availability", label: "Avail" },
                { key: "performance", label: "Perf" },
                { key: "quality", label: "Qual" },
              ] as { key: TrendMetric; label: string }[]
            ).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTrendMetric(key)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  trendMetric === key
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="px-6 pb-5">
          <OEETrendChart
            data={oeeData}
            machines={machines}
            metric={trendMetric}
            height={280}
          />
        </div>
      </div>

      {/* ── Availability by Machine (D3) + OEE Components ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <div className="px-6 pt-5 pb-3">
            <h3 className="text-base font-semibold text-gray-900">Availability by Machine</h3>
            <p className="text-xs text-gray-400 mt-0.5">Latest snapshot · sorted descending</p>
          </div>
          <div className="px-6 pb-5">
            <MachineAvailabilityChart data={machineBarData} />
          </div>
        </div>

        <div className="card">
          <div className="px-6 pt-5 pb-3">
            <h3 className="text-base font-semibold text-gray-900">OEE Components (Latest)</h3>
            <p className="text-xs text-gray-400 mt-0.5">Availability · Performance · Quality · OEE</p>
          </div>
          <div className="px-6 pb-5">
            {componentsData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={componentsData} barCategoryGap="28%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9ca3af" }} />
                  <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11, fill: "#9ca3af" }} />
                  <Tooltip formatter={(v) => `${v}%`} contentStyle={{ fontSize: 12 }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Availability" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Performance" fill="#10b981" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Quality" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="OEE" fill="#6366f1" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-48 text-sm text-gray-400">
                No data yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── OEE by Line (horizontal bar) + Production Output ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <div className="px-6 pt-5 pb-3">
            <h3 className="text-base font-semibold text-gray-900">Performance by Production Line</h3>
            <p className="text-xs text-gray-400 mt-0.5">Average across machines per line</p>
          </div>
          <div className="px-6 pb-5">
            {lineData.length > 0 ? (
              <ResponsiveContainer width="100%" height={Math.max(lineData.length * 52, 160)}>
                <BarChart data={lineData} layout="vertical" barCategoryGap="28%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    unit="%"
                    tick={{ fontSize: 11, fill: "#9ca3af" }}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={84}
                    tick={{ fontSize: 11, fill: "#374151" }}
                  />
                  <Tooltip formatter={(v) => `${v}%`} contentStyle={{ fontSize: 12 }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Availability" fill="#3b82f6" radius={[0, 3, 3, 0]} />
                  <Bar dataKey="OEE" fill="#6366f1" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-40 text-sm text-gray-400">
                No line hierarchy configured.
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="px-6 pt-5 pb-3">
            <h3 className="text-base font-semibold text-gray-900">Production Output</h3>
            <p className="text-xs text-gray-400 mt-0.5">Total and good parts · 15-min buckets</p>
          </div>
          <div className="px-6 pb-5">
            {productionData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={productionData}>
                  <defs>
                    <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradGood" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: "#9ca3af" }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="Total Parts" stroke="#6366f1" strokeWidth={2} fill="url(#gradTotal)" />
                  <Area type="monotone" dataKey="Good Parts" stroke="#10b981" strokeWidth={2} fill="url(#gradGood)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-48 text-sm text-gray-400">
                No production data for this period.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Production by Shift + Machine Summary Table ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <div className="px-6 pt-5 pb-3">
            <h3 className="text-base font-semibold text-gray-900">Production by Shift</h3>
            <p className="text-xs text-gray-400 mt-0.5">Total and good parts grouped by shift ID</p>
          </div>
          <div className="px-6 pb-5">
            {shiftData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={shiftData} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="shift" tick={{ fontSize: 11, fill: "#9ca3af" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Total Parts" fill="#6366f1" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Good Parts" fill="#10b981" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-48 text-sm text-gray-400">
                No shift data for this period.
              </div>
            )}
          </div>
        </div>

        {/* Machine Summary Table */}
        <div className="card">
          <div className="px-6 pt-5 pb-3">
            <h3 className="text-base font-semibold text-gray-900">Machine Summary</h3>
            <p className="text-xs text-gray-400 mt-0.5">Latest OEE snapshot per machine</p>
          </div>
          {latestByMachine.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="table-th text-left pl-6 py-2">Machine</th>
                    <th className="table-th text-right py-2">OEE</th>
                    <th className="table-th text-right py-2">Avail</th>
                    <th className="table-th text-right py-2">Perf</th>
                    <th className="table-th text-right py-2 pr-6">Qual</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {latestByMachine.map((row) => {
                    const machine = machines.find((m) => String(m.id) === String(row.machine_id));
                    const pct = (v?: number) => v != null ? `${(v * 100).toFixed(1)}%` : "—";
                    const oeeVal = (row.oee ?? 0) * 100;
                    const oeeColor =
                      oeeVal >= 85 ? "text-emerald-600" : oeeVal >= 60 ? "text-amber-500" : "text-red-500";
                    return (
                      <tr key={String(row.machine_id)} className="hover:bg-gray-50">
                        <td className="table-td pl-6 py-2 font-medium text-gray-900">
                          {machine?.name ?? `Machine ${row.machine_id}`}
                        </td>
                        <td className={`table-td text-right py-2 font-semibold ${oeeColor}`}>{pct(row.oee)}</td>
                        <td className="table-td text-right py-2 text-gray-600">{pct(row.availability)}</td>
                        <td className="table-td text-right py-2 text-gray-600">{pct(row.performance)}</td>
                        <td className="table-td text-right py-2 pr-6 text-gray-600">{pct(row.quality)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-6 py-8 text-sm text-gray-400 text-center">
              No machine data available. Metrics are written during OEE calculation cycles.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
