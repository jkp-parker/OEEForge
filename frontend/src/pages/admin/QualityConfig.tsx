import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { qualityConfigsApi, machinesApi, productsApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
      <h1 className="text-2xl font-bold">Quality Configuration</h1>

      <Card>
        <CardHeader>
          <CardTitle>Add Quality Config</CardTitle>
          <CardDescription>Configure OPC-UA tags or manual entry mode for reject tracking</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Machine *</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.machine_id} onChange={(e) => setForm({ ...form, machine_id: e.target.value })}>
                <option value="">Select machine</option>
                {machines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Product (optional)</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })}>
                <option value="">— All Products —</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Good Parts OPC-UA Tag</Label>
              <Input value={form.good_parts_tag} onChange={(e) => setForm({ ...form, good_parts_tag: e.target.value })}
                placeholder="ns=2;s=Machine.GoodCount" disabled={form.manual_reject_entry} />
            </div>
            <div className="space-y-1">
              <Label>Reject Parts OPC-UA Tag</Label>
              <Input value={form.reject_parts_tag} onChange={(e) => setForm({ ...form, reject_parts_tag: e.target.value })}
                placeholder="ns=2;s=Machine.RejectCount" disabled={form.manual_reject_entry} />
            </div>
            <div className="space-y-1">
              <Label>Quality Target (0–1)</Label>
              <Input type="number" step="0.01" min="0" max="1" value={form.quality_target}
                onChange={(e) => setForm({ ...form, quality_target: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Cost per Reject Unit ($, optional)</Label>
              <Input type="number" step="0.01" value={form.cost_per_unit}
                onChange={(e) => setForm({ ...form, cost_per_unit: e.target.value })} />
            </div>
            <div className="flex items-center gap-2 md:col-span-2">
              <input type="checkbox" id="manual" checked={form.manual_reject_entry}
                onChange={(e) => setForm({ ...form, manual_reject_entry: e.target.checked })} />
              <label htmlFor="manual" className="text-sm font-medium">
                Manual reject entry (operators log rejects in the portal instead of reading from OPC-UA)
              </label>
            </div>
            <div className="md:col-span-2">
              <Button onClick={() => createMutation.mutate()} disabled={!form.machine_id}>
                <Plus className="h-4 w-4 mr-2" /> Add Config
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="text-left p-3">Machine</th>
                <th className="text-left p-3">Product</th>
                <th className="text-left p-3">Mode</th>
                <th className="text-left p-3">Target</th>
                <th className="text-left p-3">Cost/Unit</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {configs.map((c) => {
                const m = machines.find((x) => x.id === c.machine_id);
                const p = products.find((x) => x.id === c.product_id);
                return (
                  <tr key={c.id} className="border-b hover:bg-muted/30">
                    <td className="p-3 font-medium">{m?.name}</td>
                    <td className="p-3">{p?.name ?? "All"}</td>
                    <td className="p-3">
                      <Badge variant={c.manual_reject_entry ? "secondary" : "outline"}>
                        {c.manual_reject_entry ? "Manual" : "OPC-UA"}
                      </Badge>
                    </td>
                    <td className="p-3">{pct(c.quality_target)}</td>
                    <td className="p-3">{c.cost_per_unit ? `$${c.cost_per_unit}` : "—"}</td>
                    <td className="p-3 text-right">
                      <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(c.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
