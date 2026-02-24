import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { shiftSchedulesApi, sitesApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
        <h1 className="text-2xl font-bold">Shift Schedules</h1>
        <Button onClick={() => setShowForm(!showForm)}><Plus className="h-4 w-4 mr-2" />New Schedule</Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle>New Shift Schedule</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Site</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.site_id} onChange={(e) => setForm({ ...form, site_id: e.target.value })}>
                  <option value="">Select site</option>
                  {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Day Shift" />
              </div>
              <div className="space-y-1">
                <Label>Start Time</Label>
                <Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>End Time</Label>
                <Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label>Days of Week</Label>
                <div className="flex gap-2 flex-wrap">
                  {DAYS.map((d, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => toggleDay(i)}
                      className={`px-3 py-1 rounded text-sm border transition-colors ${form.days_of_week.includes(i) ? "bg-primary text-primary-foreground border-primary" : "border-input"}`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 md:col-span-2">
                <Button onClick={() => createMutation.mutate()} disabled={!form.site_id || !form.name}>Create</Button>
                <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="text-left p-3">Name</th>
                <th className="text-left p-3">Hours</th>
                <th className="text-left p-3">Days</th>
                <th className="text-left p-3">Status</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {schedules.map((s) => (
                <tr key={s.id} className="border-b hover:bg-muted/30">
                  <td className="p-3 font-medium">{s.name}</td>
                  <td className="p-3">{s.start_time} – {s.end_time}</td>
                  <td className="p-3">
                    <div className="flex gap-1">
                      {s.days_of_week.map((d) => <Badge key={d} variant="outline" className="text-xs">{DAYS[d]}</Badge>)}
                    </div>
                  </td>
                  <td className="p-3">
                    <Badge variant={s.is_active ? "success" : "secondary"}>{s.is_active ? "Active" : "Inactive"}</Badge>
                  </td>
                  <td className="p-3 text-right">
                    <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(s.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
