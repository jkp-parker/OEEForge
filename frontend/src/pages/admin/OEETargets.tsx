import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { oeeTargetsApi, machinesApi, linesApi } from "@/lib/api";
import { Plus, Trash2 } from "lucide-react";
import { pct } from "@/lib/utils";

export default function AdminOEETargets() {
  const qc = useQueryClient();
  const { data: targets = [] } = useQuery({ queryKey: ["oee-targets"], queryFn: () => oeeTargetsApi.list().then((r) => r.data) });
  const { data: machines = [] } = useQuery({ queryKey: ["machines"], queryFn: () => machinesApi.list().then((r) => r.data) });
  const { data: lines = [] } = useQuery({ queryKey: ["lines"], queryFn: () => linesApi.list().then((r) => r.data) });

  const [form, setForm] = useState({
    machine_id: "", line_id: "",
    availability_target: "0.90", performance_target: "0.95",
    quality_target: "0.99", oee_target: "0.85",
  });

  const createMutation = useMutation({
    mutationFn: () =>
      oeeTargetsApi.create({
        machine_id: form.machine_id ? Number(form.machine_id) : undefined,
        line_id: form.line_id ? Number(form.line_id) : undefined,
        availability_target: Number(form.availability_target),
        performance_target: Number(form.performance_target),
        quality_target: Number(form.quality_target),
        oee_target: Number(form.oee_target),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["oee-targets"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => oeeTargetsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["oee-targets"] }),
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">OEE Targets</h1>

      <div className="card">
        <div className="px-6 pt-6 pb-4"><h3 className="text-base font-semibold text-gray-900">New Target</h3></div>
        <div className="px-6 pb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="col-span-2 md:col-span-1">
              <label className="label">Machine (optional)</label>
              <select className="input" value={form.machine_id} onChange={(e) => setForm({ ...form, machine_id: e.target.value, line_id: "" })}>
                <option value="">— All —</option>
                {machines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div className="col-span-2 md:col-span-1">
              <label className="label">Line (optional)</label>
              <select className="input" value={form.line_id} onChange={(e) => setForm({ ...form, line_id: e.target.value, machine_id: "" })}>
                <option value="">— All —</option>
                {lines.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            {[
              { key: "availability_target", label: "Availability" },
              { key: "performance_target", label: "Performance" },
              { key: "quality_target", label: "Quality" },
              { key: "oee_target", label: "OEE" },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="label">{label} Target (0–1)</label>
                <input
                  type="number" step="0.01" min="0" max="1"
                  className="input"
                  value={(form as any)[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
              </div>
            ))}
            <div className="col-span-2 md:col-span-4">
              <button className="btn-primary" onClick={() => createMutation.mutate()}>
                <Plus className="h-4 w-4" /> Add Target
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="table-th">Scope</th>
                <th className="table-th">Availability</th>
                <th className="table-th">Performance</th>
                <th className="table-th">Quality</th>
                <th className="table-th">OEE</th>
                <th className="table-th"></th>
              </tr>
            </thead>
            <tbody>
              {targets.map((t) => {
                const machine = machines.find((m) => m.id === t.machine_id);
                const line = lines.find((l) => l.id === t.line_id);
                return (
                  <tr key={t.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="table-td font-medium">{machine?.name ?? line?.name ?? "Global"}</td>
                    <td className="table-td">{pct(t.availability_target)}</td>
                    <td className="table-td">{pct(t.performance_target)}</td>
                    <td className="table-td">{pct(t.quality_target)}</td>
                    <td className="table-td">{pct(t.oee_target)}</td>
                    <td className="table-td text-right">
                      <button className="btn-ghost p-1.5" onClick={() => deleteMutation.mutate(t.id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
