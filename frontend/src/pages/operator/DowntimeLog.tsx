import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { machinesApi, downtimeCodesApi, downtimeCategoriesApi, downtimeEventsApi, shiftInstancesApi } from "@/lib/api";
import { Plus } from "lucide-react";

export default function OperatorDowntime() {
  const { user } = useAuth();
  const qc = useQueryClient();

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

  const [form, setForm] = useState({
    machine_id: machines[0]?.id ? String(machines[0].id) : "",
    start_time: new Date().toISOString().slice(0, 16),
    end_time: "",
    reason_code_id: "",
    comments: "",
  });

  const { data: events = [] } = useQuery({
    queryKey: ["downtime-events", form.machine_id],
    queryFn: () =>
      form.machine_id
        ? downtimeEventsApi.list({ machine_id: Number(form.machine_id) }).then((r) => r.data)
        : Promise.resolve([]),
    enabled: !!form.machine_id,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      downtimeEventsApi.create({
        machine_id: Number(form.machine_id),
        start_time: new Date(form.start_time).toISOString(),
        end_time: form.end_time ? new Date(form.end_time).toISOString() : undefined,
        reason_code_id: form.reason_code_id ? Number(form.reason_code_id) : undefined,
        comments: form.comments || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["downtime-events"] });
      setForm({ ...form, start_time: new Date().toISOString().slice(0, 16), end_time: "", reason_code_id: "", comments: "" });
    },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Log Downtime Event</h1>

      <div className="card">
        <div className="px-6 pt-6 pb-4"><h3 className="text-base font-semibold text-gray-900">New Downtime Event</h3></div>
        <div className="px-6 pb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Machine</label>
              <select className="input" value={form.machine_id} onChange={(e) => setForm({ ...form, machine_id: e.target.value })}>
                <option value="">Select machine</option>
                {machines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Reason Code</label>
              <select className="input" value={form.reason_code_id} onChange={(e) => setForm({ ...form, reason_code_id: e.target.value })}>
                <option value="">Select reason code</option>
                {categories.map((cat) => (
                  <optgroup key={cat.id} label={cat.name}>
                    {codes.filter((c) => c.category_id === cat.id).map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Start Time</label>
              <input type="datetime-local" className="input" value={form.start_time}
                onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
            </div>
            <div>
              <label className="label">End Time (optional)</label>
              <input type="datetime-local" className="input" value={form.end_time}
                onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <label className="label">Comments</label>
              <input className="input" value={form.comments} onChange={(e) => setForm({ ...form, comments: e.target.value })}
                placeholder="Optional notes about this downtime event" />
            </div>
            <div className="md:col-span-2">
              <button className="btn-primary" onClick={() => createMutation.mutate()} disabled={!form.machine_id || !form.start_time}>
                <Plus className="h-4 w-4" /> Log Downtime
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Recent events */}
      <div className="card">
        <div className="px-6 pt-6 pb-4"><h3 className="text-base font-semibold text-gray-900">Recent Downtime Events</h3></div>
        <div className="divide-y divide-gray-100">
          {events.slice(0, 20).map((e) => {
            const code = codes.find((c) => c.id === e.reason_code_id);
            const cat = categories.find((c) => c.id === code?.category_id);
            const duration = e.end_time
              ? Math.round((new Date(e.end_time).getTime() - new Date(e.start_time).getTime()) / 60000)
              : null;
            return (
              <div key={e.id} className="px-6 py-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-gray-900">{code?.name ?? "Unknown"}</span>
                  <div className="flex items-center gap-2">
                    {cat && <span className={cat.counts_against_availability ? "badge-red" : "badge-gray"}>{cat.name}</span>}
                    {duration != null && <span className="text-gray-400">{duration}m</span>}
                    {!e.end_time && <span className="badge-yellow">Ongoing</span>}
                  </div>
                </div>
                <div className="text-gray-400 text-xs mt-1">
                  {new Date(e.start_time).toLocaleString()}
                  {e.comments && ` — ${e.comments}`}
                </div>
              </div>
            );
          })}
          {events.length === 0 && (
            <p className="px-6 py-4 text-sm text-gray-400 text-center">No downtime events recorded yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
