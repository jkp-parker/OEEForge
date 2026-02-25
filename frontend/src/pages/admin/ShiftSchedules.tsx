import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { shiftSchedulesApi, sitesApi } from "@/lib/api";
import { Plus, Trash2 } from "lucide-react";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function AdminShifts() {
  const qc = useQueryClient();
  const { data: schedules = [] } = useQuery({
    queryKey: ["shift-schedules"],
    queryFn: () => shiftSchedulesApi.list().then((r) => r.data),
  });
  const { data: sites = [] } = useQuery({ queryKey: ["sites"], queryFn: () => sitesApi.list().then((r) => r.data) });

  const [form, setForm] = useState({ site_id: "", name: "", start_time: "06:00", end_time: "14:00", days_of_week: [0, 1, 2, 3, 4] as number[] });
  const [showForm, setShowForm] = useState(false);

  const createMutation = useMutation({
    mutationFn: () =>
      shiftSchedulesApi.create({
        site_id: Number(form.site_id),
        name: form.name,
        start_time: form.start_time,
        end_time: form.end_time,
        days_of_week: form.days_of_week,
        is_active: true,
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["shift-schedules"] }); setShowForm(false); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => shiftSchedulesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shift-schedules"] }),
  });

  const toggleDay = (day: number) => {
    setForm((f) => ({
      ...f,
      days_of_week: f.days_of_week.includes(day) ? f.days_of_week.filter((d) => d !== day) : [...f.days_of_week, day],
    }));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Shift Schedules</h1>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}><Plus className="h-4 w-4" /> New Schedule</button>
      </div>

      {showForm && (
        <div className="card">
          <div className="px-6 pt-6 pb-4"><h3 className="text-base font-semibold text-gray-900">New Shift Schedule</h3></div>
          <div className="px-6 pb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Site</label>
                <select className="input" value={form.site_id} onChange={(e) => setForm({ ...form, site_id: e.target.value })}>
                  <option value="">Select site</option>
                  {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Name</label>
                <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Day Shift" />
              </div>
              <div>
                <label className="label">Start Time</label>
                <input type="time" className="input" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
              </div>
              <div>
                <label className="label">End Time</label>
                <input type="time" className="input" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <label className="label">Days of Week</label>
                <div className="flex gap-2 flex-wrap">
                  {DAYS.map((d, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => toggleDay(i)}
                      className={`px-3 py-1 rounded text-sm border transition-colors ${
                        form.days_of_week.includes(i)
                          ? "bg-blue-600 text-white border-blue-600"
                          : "border-gray-300 text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 md:col-span-2">
                <button className="btn-primary" onClick={() => createMutation.mutate()} disabled={!form.site_id || !form.name}>Create</button>
                <button className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="table-th">Name</th>
                <th className="table-th">Hours</th>
                <th className="table-th">Days</th>
                <th className="table-th">Status</th>
                <th className="table-th"></th>
              </tr>
            </thead>
            <tbody>
              {schedules.map((s) => (
                <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="table-td font-medium">{s.name}</td>
                  <td className="table-td">{s.start_time} – {s.end_time}</td>
                  <td className="table-td">
                    <div className="flex gap-1 flex-wrap">
                      {s.days_of_week.map((d) => <span key={d} className="badge-gray text-xs">{DAYS[d]}</span>)}
                    </div>
                  </td>
                  <td className="table-td">
                    <span className={s.is_active ? "badge-green" : "badge-gray"}>{s.is_active ? "Active" : "Inactive"}</span>
                  </td>
                  <td className="table-td text-right">
                    <button className="btn-ghost p-1.5" onClick={() => deleteMutation.mutate(s.id)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </button>
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
