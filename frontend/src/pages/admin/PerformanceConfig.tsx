import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { performanceConfigsApi, machinesApi, productsApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Plus, Save, Trash2 } from "lucide-react";

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
      <h1 className="text-2xl font-bold">Performance Configuration</h1>

      <Card>
        <CardHeader>
          <CardTitle>Add Performance Config</CardTitle>
          <CardDescription>Configure ideal cycle time and part count tags per machine / product</CardDescription>
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
              <Label>Product (optional — applies to all if blank)</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })}>
                <option value="">— All Products —</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Ideal Cycle Time (seconds) *</Label>
              <Input type="number" step="0.1" value={form.ideal_cycle_time_seconds}
                onChange={(e) => setForm({ ...form, ideal_cycle_time_seconds: e.target.value })} placeholder="e.g. 5.5" />
            </div>
            <div className="space-y-1">
              <Label>Rated Speed (parts/hour, optional)</Label>
              <Input type="number" value={form.rated_speed}
                onChange={(e) => setForm({ ...form, rated_speed: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Cycle Count OPC-UA Tag</Label>
              <Input value={form.cycle_count_tag} onChange={(e) => setForm({ ...form, cycle_count_tag: e.target.value })}
                placeholder="ns=2;s=Machine.PartCount" />
            </div>
            <div className="space-y-1">
              <Label>Minor Stoppage Threshold (seconds)</Label>
              <Input type="number" value={form.minor_stoppage_threshold_seconds}
                onChange={(e) => setForm({ ...form, minor_stoppage_threshold_seconds: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <Button onClick={() => createMutation.mutate()} disabled={!form.machine_id || !form.ideal_cycle_time_seconds}>
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
                <th className="text-left p-3">Ideal Cycle (s)</th>
                <th className="text-left p-3">Rated Speed</th>
                <th className="text-left p-3">Count Tag</th>
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
                    <td className="p-3">{c.ideal_cycle_time_seconds}s</td>
                    <td className="p-3">{c.rated_speed ?? "—"}</td>
                    <td className="p-3 text-xs text-muted-foreground">{c.cycle_count_tag ?? "—"}</td>
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
