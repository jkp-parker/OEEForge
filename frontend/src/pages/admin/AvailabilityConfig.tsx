import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { availabilityConfigsApi, machinesApi, downtimeCategoriesApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Plus, Pencil, Save } from "lucide-react";

export default function AdminAvailabilityConfig() {
  const qc = useQueryClient();
  const { data: machines = [] } = useQuery({ queryKey: ["machines"], queryFn: () => machinesApi.list().then((r) => r.data) });
  const { data: configs = [] } = useQuery({
    queryKey: ["availability-configs"],
    queryFn: () => availabilityConfigsApi.list().then((r) => r.data),
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["downtime-categories"],
    queryFn: () => downtimeCategoriesApi.list().then((r) => r.data),
  });

  const [selectedMachine, setSelectedMachine] = useState<number | "">("");
  const [form, setForm] = useState({
    state_tag: "", running_value: "running", stopped_value: "stopped",
    faulted_value: "faulted", idle_value: "idle",
    changeover_value: "changeover", planned_downtime_value: "planned_downtime",
    excluded_category_ids: [] as number[],
    planned_production_time_seconds: "",
  });

  const existingConfig = configs.find((c) => c.machine_id === Number(selectedMachine));

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        machine_id: Number(selectedMachine),
        ...form,
        planned_production_time_seconds: form.planned_production_time_seconds
          ? Number(form.planned_production_time_seconds) : undefined,
      };
      return existingConfig
        ? availabilityConfigsApi.update(existingConfig.id, payload)
        : availabilityConfigsApi.create(payload);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["availability-configs"] }),
  });

  const loadConfig = (machineId: number) => {
    setSelectedMachine(machineId);
    const c = configs.find((cfg) => cfg.machine_id === machineId);
    if (c) {
      setForm({
        state_tag: c.state_tag ?? "",
        running_value: c.running_value ?? "running",
        stopped_value: c.stopped_value ?? "stopped",
        faulted_value: c.faulted_value ?? "faulted",
        idle_value: c.idle_value ?? "idle",
        changeover_value: c.changeover_value ?? "changeover",
        planned_downtime_value: c.planned_downtime_value ?? "planned_downtime",
        excluded_category_ids: c.excluded_category_ids ?? [],
        planned_production_time_seconds: c.planned_production_time_seconds ? String(c.planned_production_time_seconds) : "",
      });
    }
  };

  const toggleExcluded = (id: number) => {
    setForm((f) => ({
      ...f,
      excluded_category_ids: f.excluded_category_ids.includes(id)
        ? f.excluded_category_ids.filter((x) => x !== id)
        : [...f.excluded_category_ids, id],
    }));
  };

  const stateFields = [
    { key: "state_tag", label: "State OPC-UA Tag" },
    { key: "running_value", label: "Running Value" },
    { key: "stopped_value", label: "Stopped Value" },
    { key: "faulted_value", label: "Faulted Value" },
    { key: "idle_value", label: "Idle Value" },
    { key: "changeover_value", label: "Changeover Value" },
    { key: "planned_downtime_value", label: "Planned Downtime Value" },
  ] as const;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Availability Configuration</h1>

      <Card>
        <CardHeader>
          <CardTitle>Select Machine</CardTitle>
          <CardDescription>Configure state mappings and planned production time per machine</CardDescription>
        </CardHeader>
        <CardContent>
          <select
            className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm w-64"
            value={selectedMachine}
            onChange={(e) => e.target.value ? loadConfig(Number(e.target.value)) : setSelectedMachine("")}
          >
            <option value="">Select a machine…</option>
            {machines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </CardContent>
      </Card>

      {selectedMachine && (
        <Card>
          <CardHeader>
            <CardTitle>
              {machines.find((m) => m.id === selectedMachine)?.name} — Availability Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {stateFields.map(({ key, label }) => (
                <div key={key} className="space-y-1">
                  <Label>{label}</Label>
                  <Input
                    value={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    placeholder={key === "state_tag" ? "ns=2;s=Machine.State" : label.toLowerCase()}
                  />
                </div>
              ))}
              <div className="space-y-1">
                <Label>Planned Production Time / Shift (seconds, optional)</Label>
                <Input
                  type="number"
                  value={form.planned_production_time_seconds}
                  onChange={(e) => setForm({ ...form, planned_production_time_seconds: e.target.value })}
                  placeholder="e.g. 28800 for 8 hours"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Excluded Downtime Categories (do NOT count against availability)</Label>
              <div className="flex gap-2 flex-wrap">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => toggleExcluded(cat.id)}
                    className={`px-3 py-1 rounded text-sm border transition-colors ${
                      form.excluded_category_ids.includes(cat.id)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-input"
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>

            <Button onClick={() => saveMutation.mutate()}>
              <Save className="h-4 w-4 mr-2" /> {existingConfig ? "Update" : "Save"} Config
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
