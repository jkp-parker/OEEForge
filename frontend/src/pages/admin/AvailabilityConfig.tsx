import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { availabilityConfigsApi, machinesApi, downtimeCategoriesApi } from "@/lib/api";
import { Save } from "lucide-react";

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
      <h1 className="text-2xl font-bold text-gray-900">Availability Configuration</h1>

      <div className="card">
        <div className="px-6 pt-6 pb-4">
          <h3 className="text-base font-semibold text-gray-900">Select Machine</h3>
          <p className="text-sm text-gray-500 mt-1">Configure state mappings and planned production time per machine</p>
        </div>
        <div className="px-6 pb-6">
          <select
            className="input w-64"
            value={selectedMachine}
            onChange={(e) => e.target.value ? loadConfig(Number(e.target.value)) : setSelectedMachine("")}
          >
            <option value="">Select a machine…</option>
            {machines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
      </div>

      {selectedMachine && (
        <div className="card">
          <div className="px-6 pt-6 pb-4">
            <h3 className="text-base font-semibold text-gray-900">
              {machines.find((m) => m.id === selectedMachine)?.name} — Availability Settings
            </h3>
          </div>
          <div className="px-6 pb-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {stateFields.map(({ key, label }) => (
                <div key={key}>
                  <label className="label">{label}</label>
                  <input
                    className="input"
                    value={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    placeholder={key === "state_tag" ? "ns=2;s=Machine.State" : label.toLowerCase()}
                  />
                </div>
              ))}
              <div>
                <label className="label">Planned Production Time / Shift (seconds, optional)</label>
                <input
                  type="number"
                  className="input"
                  value={form.planned_production_time_seconds}
                  onChange={(e) => setForm({ ...form, planned_production_time_seconds: e.target.value })}
                  placeholder="e.g. 28800 for 8 hours"
                />
              </div>
            </div>

            <div>
              <label className="label">Excluded Downtime Categories (do NOT count against availability)</label>
              <div className="flex gap-2 flex-wrap mt-1">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => toggleExcluded(cat.id)}
                    className={`px-3 py-1 rounded text-sm border transition-colors ${
                      form.excluded_category_ids.includes(cat.id)
                        ? "bg-blue-600 text-white border-blue-600"
                        : "border-gray-300 text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>

            <button className="btn-primary" onClick={() => saveMutation.mutate()}>
              <Save className="h-4 w-4" /> {existingConfig ? "Update" : "Save"} Config
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
