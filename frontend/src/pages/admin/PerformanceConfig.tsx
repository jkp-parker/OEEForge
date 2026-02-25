import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { performanceConfigsApi, machinesApi, productsApi } from "@/lib/api";
import { Plus, Trash2 } from "lucide-react";

export default function AdminPerformanceConfig() {
  const qc = useQueryClient();
  const { data: machines = [] } = useQuery({ queryKey: ["machines"], queryFn: () => machinesApi.list().then((r) => r.data) });
  const { data: products = [] } = useQuery({ queryKey: ["products"], queryFn: () => productsApi.list().then((r) => r.data) });
  const { data: configs = [] } = useQuery({
    queryKey: ["performance-configs"],
    queryFn: () => performanceConfigsApi.list().then((r) => r.data),
  });

  const [form, setForm] = useState({
    machine_id: "", product_id: "",
    ideal_cycle_time_seconds: "", rated_speed: "",
    cycle_count_tag: "", minor_stoppage_threshold_seconds: "120",
  });

  const createMutation = useMutation({
    mutationFn: () =>
      performanceConfigsApi.create({
        machine_id: Number(form.machine_id),
        product_id: form.product_id ? Number(form.product_id) : undefined,
        ideal_cycle_time_seconds: Number(form.ideal_cycle_time_seconds),
        rated_speed: form.rated_speed ? Number(form.rated_speed) : undefined,
        cycle_count_tag: form.cycle_count_tag || undefined,
        minor_stoppage_threshold_seconds: Number(form.minor_stoppage_threshold_seconds),
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["performance-configs"] }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => performanceConfigsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["performance-configs"] }),
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Performance Configuration</h1>

      <div className="card">
        <div className="px-6 pt-6 pb-4">
          <h3 className="text-base font-semibold text-gray-900">Add Performance Config</h3>
          <p className="text-sm text-gray-500 mt-1">Configure ideal cycle time and part count tags per machine / product</p>
        </div>
        <div className="px-6 pb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Machine *</label>
              <select className="input" value={form.machine_id} onChange={(e) => setForm({ ...form, machine_id: e.target.value })}>
                <option value="">Select machine</option>
                {machines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Product (optional — applies to all if blank)</label>
              <select className="input" value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })}>
                <option value="">— All Products —</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Ideal Cycle Time (seconds) *</label>
              <input type="number" step="0.1" className="input" value={form.ideal_cycle_time_seconds}
                onChange={(e) => setForm({ ...form, ideal_cycle_time_seconds: e.target.value })} placeholder="e.g. 5.5" />
            </div>
            <div>
              <label className="label">Rated Speed (parts/hour, optional)</label>
              <input type="number" className="input" value={form.rated_speed}
                onChange={(e) => setForm({ ...form, rated_speed: e.target.value })} />
            </div>
            <div>
              <label className="label">Cycle Count OPC-UA Tag</label>
              <input className="input" value={form.cycle_count_tag} onChange={(e) => setForm({ ...form, cycle_count_tag: e.target.value })}
                placeholder="ns=2;s=Machine.PartCount" />
            </div>
            <div>
              <label className="label">Minor Stoppage Threshold (seconds)</label>
              <input type="number" className="input" value={form.minor_stoppage_threshold_seconds}
                onChange={(e) => setForm({ ...form, minor_stoppage_threshold_seconds: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <button className="btn-primary" onClick={() => createMutation.mutate()} disabled={!form.machine_id || !form.ideal_cycle_time_seconds}>
                <Plus className="h-4 w-4" /> Add Config
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
                <th className="table-th">Machine</th>
                <th className="table-th">Product</th>
                <th className="table-th">Ideal Cycle (s)</th>
                <th className="table-th">Rated Speed</th>
                <th className="table-th">Count Tag</th>
                <th className="table-th"></th>
              </tr>
            </thead>
            <tbody>
              {configs.map((c) => {
                const m = machines.find((x) => x.id === c.machine_id);
                const p = products.find((x) => x.id === c.product_id);
                return (
                  <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="table-td font-medium">{m?.name}</td>
                    <td className="table-td">{p?.name ?? "All"}</td>
                    <td className="table-td">{c.ideal_cycle_time_seconds}s</td>
                    <td className="table-td">{c.rated_speed ?? "—"}</td>
                    <td className="table-td text-xs text-gray-400">{c.cycle_count_tag ?? "—"}</td>
                    <td className="table-td text-right">
                      <button className="btn-ghost p-1.5" onClick={() => deleteMutation.mutate(c.id)}>
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
