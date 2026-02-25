import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { qualityConfigsApi, machinesApi, productsApi } from "@/lib/api";
import { Plus, Trash2 } from "lucide-react";
import { pct } from "@/lib/utils";

export default function AdminQualityConfig() {
  const qc = useQueryClient();
  const { data: machines = [] } = useQuery({ queryKey: ["machines"], queryFn: () => machinesApi.list().then((r) => r.data) });
  const { data: products = [] } = useQuery({ queryKey: ["products"], queryFn: () => productsApi.list().then((r) => r.data) });
  const { data: configs = [] } = useQuery({
    queryKey: ["quality-configs"],
    queryFn: () => qualityConfigsApi.list().then((r) => r.data),
  });

  const [form, setForm] = useState({
    machine_id: "", product_id: "",
    good_parts_tag: "", reject_parts_tag: "",
    manual_reject_entry: false, cost_per_unit: "",
    quality_target: "0.99",
  });

  const createMutation = useMutation({
    mutationFn: () =>
      qualityConfigsApi.create({
        machine_id: Number(form.machine_id),
        product_id: form.product_id ? Number(form.product_id) : undefined,
        good_parts_tag: form.good_parts_tag || undefined,
        reject_parts_tag: form.reject_parts_tag || undefined,
        manual_reject_entry: form.manual_reject_entry,
        cost_per_unit: form.cost_per_unit ? Number(form.cost_per_unit) : undefined,
        quality_target: Number(form.quality_target),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quality-configs"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => qualityConfigsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quality-configs"] }),
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Quality Configuration</h1>

      <div className="card">
        <div className="px-6 pt-6 pb-4">
          <h3 className="text-base font-semibold text-gray-900">Add Quality Config</h3>
          <p className="text-sm text-gray-500 mt-1">Configure OPC-UA tags or manual entry mode for reject tracking</p>
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
              <label className="label">Product (optional)</label>
              <select className="input" value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })}>
                <option value="">— All Products —</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Good Parts OPC-UA Tag</label>
              <input className="input" value={form.good_parts_tag} onChange={(e) => setForm({ ...form, good_parts_tag: e.target.value })}
                placeholder="ns=2;s=Machine.GoodCount" disabled={form.manual_reject_entry} />
            </div>
            <div>
              <label className="label">Reject Parts OPC-UA Tag</label>
              <input className="input" value={form.reject_parts_tag} onChange={(e) => setForm({ ...form, reject_parts_tag: e.target.value })}
                placeholder="ns=2;s=Machine.RejectCount" disabled={form.manual_reject_entry} />
            </div>
            <div>
              <label className="label">Quality Target (0–1)</label>
              <input type="number" step="0.01" min="0" max="1" className="input" value={form.quality_target}
                onChange={(e) => setForm({ ...form, quality_target: e.target.value })} />
            </div>
            <div>
              <label className="label">Cost per Reject Unit ($, optional)</label>
              <input type="number" step="0.01" className="input" value={form.cost_per_unit}
                onChange={(e) => setForm({ ...form, cost_per_unit: e.target.value })} />
            </div>
            <div className="flex items-center gap-2 md:col-span-2">
              <input type="checkbox" id="manual" checked={form.manual_reject_entry}
                onChange={(e) => setForm({ ...form, manual_reject_entry: e.target.checked })} />
              <label htmlFor="manual" className="text-sm font-medium text-gray-700">
                Manual reject entry (operators log rejects in the portal instead of reading from OPC-UA)
              </label>
            </div>
            <div className="md:col-span-2">
              <button className="btn-primary" onClick={() => createMutation.mutate()} disabled={!form.machine_id}>
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
                <th className="table-th">Mode</th>
                <th className="table-th">Target</th>
                <th className="table-th">Cost/Unit</th>
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
                    <td className="table-td">
                      <span className={c.manual_reject_entry ? "badge-gray" : "badge-blue"}>
                        {c.manual_reject_entry ? "Manual" : "OPC-UA"}
                      </span>
                    </td>
                    <td className="table-td">{pct(c.quality_target)}</td>
                    <td className="table-td">{c.cost_per_unit ? `$${c.cost_per_unit}` : "—"}</td>
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
