import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { oeeTargetsApi, machinesApi, linesApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      <h1 className="text-2xl font-bold">OEE Targets</h1>

      <Card>
        <CardHeader><CardTitle>New Target</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1 col-span-2 md:col-span-1">
              <Label>Machine (optional)</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.machine_id} onChange={(e) => setForm({ ...form, machine_id: e.target.value, line_id: "" })}>
                <option value="">— All —</option>
                {machines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div className="space-y-1 col-span-2 md:col-span-1">
              <Label>Line (optional)</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.line_id} onChange={(e) => setForm({ ...form, line_id: e.target.value, machine_id: "" })}>
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
              <div key={key} className="space-y-1">
                <Label>{label} Target (0–1)</Label>
                <Input
                  type="number" step="0.01" min="0" max="1"
                  value={(form as any)[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
              </div>
            ))}
            <div className="col-span-2 md:col-span-4">
              <Button onClick={() => createMutation.mutate()}>
                <Plus className="h-4 w-4 mr-2" /> Add Target
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
                <th className="text-left p-3">Scope</th>
                <th className="text-left p-3">Availability</th>
                <th className="text-left p-3">Performance</th>
                <th className="text-left p-3">Quality</th>
                <th className="text-left p-3">OEE</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {targets.map((t) => {
                const machine = machines.find((m) => m.id === t.machine_id);
                const line = lines.find((l) => l.id === t.line_id);
                return (
                  <tr key={t.id} className="border-b hover:bg-muted/30">
                    <td className="p-3 font-medium">{machine?.name ?? line?.name ?? "Global"}</td>
                    <td className="p-3">{pct(t.availability_target)}</td>
                    <td className="p-3">{pct(t.performance_target)}</td>
                    <td className="p-3">{pct(t.quality_target)}</td>
                    <td className="p-3">{pct(t.oee_target)}</td>
                    <td className="p-3 text-right">
                      <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(t.id)}>
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
