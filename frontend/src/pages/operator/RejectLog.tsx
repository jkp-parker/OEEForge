import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { machinesApi, downtimeCodesApi, downtimeCategoriesApi, rejectEventsApi } from "@/lib/api";
import { Plus } from "lucide-react";

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
const DEFAULT_FROM   = toLocalDT(new Date(now.getTime() - 24 * 60 * 60 * 1000));
const DEFAULT_TO     = toLocalDT(now);
const DEFAULT_PRESET = "Last 24 Hrs";

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function OperatorRejects() {
  const { user } = useAuth();
  const qc = useQueryClient();

  // ── Filter bar state ──────────────────────────────────────────────────────
  const [fromDate,      setFromDate]      = useState(DEFAULT_FROM);
  const [toDate,        setToDate]        = useState(DEFAULT_TO);
  const [activePreset,  setActivePreset]  = useState<string>(DEFAULT_PRESET);
  const [filterMachine, setFilterMachine] = useState("");

  function applyPreset(hours: number, label: string) {
    const to   = new Date();
    const from = new Date(to.getTime() - hours * 60 * 60 * 1000);
    setToDate(toLocalDT(to));
    setFromDate(toLocalDT(from));
    setActivePreset(label);
  }

  // ── Create-form state ─────────────────────────────────────────────────────
  const [form, setForm] = useState({
    machine_id: "",
    timestamp: new Date().toISOString().slice(0, 16),
    reject_count: "1",
    reason_code_id: "",
    comments: "",
  });

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: machines = [] } = useQuery({
    queryKey: ["machines", user?.line_id],
    queryFn: () => machinesApi.list(user?.line_id ?? undefined).then((r) => r.data),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["downtime-categories"],
    queryFn: () => downtimeCategoriesApi.list().then((r) => r.data),
  });

  const { data: codes = [] } = useQuery({
    queryKey: ["downtime-codes"],
    queryFn: () => downtimeCodesApi.list().then((r) => r.data),
  });

  const { data: events = [] } = useQuery({
    queryKey: ["reject-events", fromDate, toDate, filterMachine],
    queryFn: () =>
      rejectEventsApi.list({
        machine_id: filterMachine ? Number(filterMachine) : undefined,
        from_time:  new Date(fromDate).toISOString(),
        to_time:    new Date(toDate).toISOString(),
      }).then((r) => r.data),
    refetchInterval: 30_000,
  });

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: () =>
      rejectEventsApi.create({
        machine_id: Number(form.machine_id),
        timestamp: new Date(form.timestamp).toISOString(),
        reject_count: Number(form.reject_count),
        reason_code_id: form.reason_code_id ? Number(form.reason_code_id) : undefined,
        comments: form.comments || undefined,
        is_manual: true,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reject-events"] });
      setForm({ ...form, reject_count: "1", reason_code_id: "", comments: "" });
    },
  });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Log Reject Events</h1>

      {/* New Event Form */}
      <div className="card">
        <div className="px-6 pt-6 pb-4">
          <h3 className="text-base font-semibold text-gray-900">New Reject Entry</h3>
        </div>
        <div className="px-6 pb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Machine</label>
              <select className="input" value={form.machine_id}
                onChange={(e) => setForm({ ...form, machine_id: e.target.value })}>
                <option value="">Select machine</option>
                {machines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Reject Count</label>
              <input type="number" min="1" className="input" value={form.reject_count}
                onChange={(e) => setForm({ ...form, reject_count: e.target.value })} />
            </div>
            <div>
              <label className="label">Timestamp</label>
              <input type="datetime-local" className="input" value={form.timestamp}
                onChange={(e) => setForm({ ...form, timestamp: e.target.value })} />
            </div>
            <div>
              <label className="label">Reject Reason Code</label>
              <select className="input" value={form.reason_code_id}
                onChange={(e) => setForm({ ...form, reason_code_id: e.target.value })}>
                <option value="">Select reason</option>
                {categories.map((cat) => (
                  <optgroup key={cat.id} label={cat.name}>
                    {codes.filter((c) => c.secondary_category_id === cat.id).map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="label">Comments</label>
              <input className="input" value={form.comments}
                onChange={(e) => setForm({ ...form, comments: e.target.value })}
                placeholder="Optional notes" />
            </div>
            <div className="md:col-span-2">
              <button className="btn-primary" onClick={() => createMutation.mutate()}
                disabled={!form.machine_id || !form.reject_count || createMutation.isPending}>
                <Plus className="h-4 w-4" /> Log Rejects
              </button>
            </div>
          </div>
        </div>
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
            {machines.map((m) => (
              <option key={m.id} value={String(m.id)}>{m.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Events list */}
      <div className="card">
        <div className="px-6 pt-5 pb-3 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Reject Events</h3>
            <p className="text-xs text-gray-400 mt-0.5">Showing events in selected time range</p>
          </div>
          <span className="text-xs text-gray-400">{events.length} event{events.length !== 1 ? "s" : ""}</span>
        </div>
        <div className="divide-y divide-gray-100">
          {events.map((e) => {
            const code    = codes.find((c) => c.id === e.reason_code_id);
            const machine = machines.find((m) => m.id === e.machine_id);
            return (
              <div key={e.id} className="px-6 py-3 text-sm flex items-center justify-between">
                <div className="min-w-0">
                  <span className="font-medium text-gray-900">{e.reject_count} reject{e.reject_count !== 1 ? "s" : ""}</span>
                  {machine && <span className="text-gray-400 ml-2">· {machine.name}</span>}
                  {code && <span className="text-gray-400 ml-2">— {code.name}</span>}
                  {e.comments && <span className="text-gray-400 text-xs ml-2">{e.comments}</span>}
                </div>
                <span className="text-xs text-gray-400 flex-shrink-0 ml-4">
                  {new Date(e.timestamp).toLocaleString()}
                </span>
              </div>
            );
          })}
          {events.length === 0 && (
            <p className="px-6 py-8 text-sm text-gray-400 text-center">
              No reject events in the selected period.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
