import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { machinesApi, downtimeCodesApi, downtimeCategoriesApi, rejectEventsApi } from "@/lib/api";
import { Plus } from "lucide-react";

export default function OperatorRejects() {
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
    machine_id: "",
    timestamp: new Date().toISOString().slice(0, 16),
    reject_count: "1",
    reason_code_id: "",
    comments: "",
  });

  const { data: events = [] } = useQuery({
    queryKey: ["reject-events", form.machine_id],
    queryFn: () =>
      form.machine_id
        ? rejectEventsApi.list({ machine_id: Number(form.machine_id) }).then((r) => r.data)
        : Promise.resolve([]),
    enabled: !!form.machine_id,
  });

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

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Log Reject Event</h1>

      <div className="card">
        <div className="px-6 pt-6 pb-4"><h3 className="text-base font-semibold text-gray-900">New Reject Entry</h3></div>
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
              <select className="input" value={form.reason_code_id} onChange={(e) => setForm({ ...form, reason_code_id: e.target.value })}>
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
              <input className="input" value={form.comments} onChange={(e) => setForm({ ...form, comments: e.target.value })}
                placeholder="Optional notes" />
            </div>
            <div className="md:col-span-2">
              <button className="btn-primary" onClick={() => createMutation.mutate()} disabled={!form.machine_id || !form.reject_count}>
                <Plus className="h-4 w-4" /> Log Rejects
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Recent events */}
      <div className="card">
        <div className="px-6 pt-6 pb-4"><h3 className="text-base font-semibold text-gray-900">Recent Reject Events</h3></div>
        <div className="divide-y divide-gray-100">
          {events.slice(0, 20).map((e) => {
            const code = codes.find((c) => c.id === e.reason_code_id);
            return (
              <div key={e.id} className="px-6 py-3 text-sm flex items-center justify-between">
                <div>
                  <span className="font-medium text-gray-900">{e.reject_count} reject(s)</span>
                  {code && <span className="text-gray-400 ml-2">— {code.name}</span>}
                  {e.comments && <span className="text-gray-400 text-xs ml-2">{e.comments}</span>}
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(e.timestamp).toLocaleString()}
                </span>
              </div>
            );
          })}
          {events.length === 0 && (
            <p className="px-6 py-4 text-sm text-gray-400 text-center">No reject events recorded yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
