import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { machinesApi, downtimeCodesApi, downtimeCategoriesApi, rejectEventsApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      <h1 className="text-2xl font-bold">Log Reject Event</h1>

      <Card>
        <CardHeader><CardTitle>New Reject Entry</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Machine</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.machine_id}
                onChange={(e) => setForm({ ...form, machine_id: e.target.value })}
              >
                <option value="">Select machine</option>
                {machines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Reject Count</Label>
              <Input
                type="number" min="1" value={form.reject_count}
                onChange={(e) => setForm({ ...form, reject_count: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Timestamp</Label>
              <Input type="datetime-local" value={form.timestamp}
                onChange={(e) => setForm({ ...form, timestamp: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Reject Reason Code</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.reason_code_id}
                onChange={(e) => setForm({ ...form, reason_code_id: e.target.value })}
              >
                <option value="">Select reason</option>
                {categories.map((cat) => (
                  <optgroup key={cat.id} label={cat.name}>
                    {codes.filter((c) => c.category_id === cat.id).map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label>Comments</Label>
              <Input value={form.comments} onChange={(e) => setForm({ ...form, comments: e.target.value })}
                placeholder="Optional notes" />
            </div>
            <div className="md:col-span-2">
              <Button onClick={() => createMutation.mutate()} disabled={!form.machine_id || !form.reject_count}>
                <Plus className="h-4 w-4 mr-2" /> Log Rejects
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent events */}
      <Card>
        <CardHeader><CardTitle>Recent Reject Events</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {events.slice(0, 20).map((e) => {
              const code = codes.find((c) => c.id === e.reason_code_id);
              return (
                <div key={e.id} className="p-3 text-sm flex items-center justify-between">
                  <div>
                    <span className="font-medium">{e.reject_count} reject(s)</span>
                    {code && <span className="text-muted-foreground ml-2">— {code.name}</span>}
                    {e.comments && <span className="text-muted-foreground text-xs ml-2">{e.comments}</span>}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(e.timestamp).toLocaleString()}
                  </span>
                </div>
              );
            })}
            {events.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground text-center">No reject events recorded yet.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
