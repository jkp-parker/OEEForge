import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { machinesApi, downtimeCategoriesApi, downtimeTagConfigsApi, type DowntimeTagConfig } from "@/lib/api";
import { Plus, Trash2, Pencil, Check, X } from "lucide-react";

const ANALOG_OPERATORS = [">", ">=", "<", "<=", "=="];

function emptyForm(): Omit<DowntimeTagConfig, "id"> {
  return {
    machine_id: 0,
    measurement_name: "",
    tag_field: "",
    tag_type: "digital",
    digital_downtime_value: "",
    analog_operator: ">",
    analog_threshold: undefined,
    downtime_category_id: undefined,
    description: "",
    is_enabled: true,
  };
}

export default function AdminTagConfigs() {
  const qc = useQueryClient();

  const { data: machines = [] } = useQuery({
    queryKey: ["machines"],
    queryFn: () => machinesApi.list().then((r) => r.data),
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["downtime-categories"],
    queryFn: () => downtimeCategoriesApi.list().then((r) => r.data),
  });

  const [selectedMachineId, setSelectedMachineId] = useState<string>("");
  const [form, setForm] = useState<Omit<DowntimeTagConfig, "id">>(emptyForm());
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<DowntimeTagConfig>>({});

  const { data: configs = [] } = useQuery({
    queryKey: ["downtime-tag-configs", selectedMachineId],
    queryFn: () =>
      downtimeTagConfigsApi
        .list(selectedMachineId ? Number(selectedMachineId) : undefined)
        .then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: () => downtimeTagConfigsApi.create({ ...form, machine_id: Number(form.machine_id) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["downtime-tag-configs"] });
      setForm(emptyForm());
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<DowntimeTagConfig> }) =>
      downtimeTagConfigsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["downtime-tag-configs"] });
      setEditId(null);
      setEditForm({});
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => downtimeTagConfigsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["downtime-tag-configs"] }),
  });

  const startEdit = (cfg: DowntimeTagConfig) => {
    setEditId(cfg.id);
    setEditForm({ ...cfg });
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditForm({});
  };

  const isFormValid =
    form.machine_id &&
    form.measurement_name &&
    form.tag_field &&
    (form.tag_type === "digital" ? form.digital_downtime_value : form.analog_operator && form.analog_threshold != null);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">InfluxDB Tag Configs</h1>
      <p className="text-sm text-gray-500">
        Configure InfluxDB measurement fields that automatically open and close downtime events.
      </p>

      {/* Create Form */}
      <div className="card">
        <div className="px-6 pt-6 pb-4">
          <h3 className="text-base font-semibold text-gray-900">Add Tag Config</h3>
        </div>
        <div className="px-6 pb-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Machine</label>
              <select
                className="input"
                value={form.machine_id || ""}
                onChange={(e) => setForm({ ...form, machine_id: Number(e.target.value) })}
              >
                <option value="">Select machine</option>
                {machines.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Measurement Name</label>
              <input
                className="input"
                placeholder="e.g. machine_state"
                value={form.measurement_name}
                onChange={(e) => setForm({ ...form, measurement_name: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Tag Field</label>
              <input
                className="input"
                placeholder="e.g. status"
                value={form.tag_field}
                onChange={(e) => setForm({ ...form, tag_field: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Tag Type</label>
              <select
                className="input"
                value={form.tag_type}
                onChange={(e) => setForm({ ...form, tag_type: e.target.value as "digital" | "analog" })}
              >
                <option value="digital">Digital</option>
                <option value="analog">Analog</option>
              </select>
            </div>
            {form.tag_type === "digital" ? (
              <div>
                <label className="label">Downtime Value</label>
                <input
                  className="input"
                  placeholder="e.g. 0 or false or STOPPED"
                  value={form.digital_downtime_value ?? ""}
                  onChange={(e) => setForm({ ...form, digital_downtime_value: e.target.value })}
                />
              </div>
            ) : (
              <>
                <div>
                  <label className="label">Operator</label>
                  <select
                    className="input"
                    value={form.analog_operator ?? ">"}
                    onChange={(e) => setForm({ ...form, analog_operator: e.target.value })}
                  >
                    {ANALOG_OPERATORS.map((op) => (
                      <option key={op} value={op}>{op}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Threshold</label>
                  <input
                    className="input"
                    type="number"
                    placeholder="e.g. 100"
                    value={form.analog_threshold ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, analog_threshold: e.target.value ? Number(e.target.value) : undefined })
                    }
                  />
                </div>
              </>
            )}
            <div>
              <label className="label">Default Category (optional)</label>
              <select
                className="input"
                value={form.downtime_category_id ?? ""}
                onChange={(e) =>
                  setForm({ ...form, downtime_category_id: e.target.value ? Number(e.target.value) : undefined })
                }
              >
                <option value="">None</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="label">Description (optional)</label>
              <input
                className="input"
                placeholder="What this config detects"
                value={form.description ?? ""}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_enabled"
                checked={form.is_enabled}
                onChange={(e) => setForm({ ...form, is_enabled: e.target.checked })}
              />
              <label htmlFor="is_enabled" className="text-sm text-gray-700">Enabled</label>
            </div>
          </div>
          <button
            className="btn-primary"
            onClick={() => createMutation.mutate()}
            disabled={!isFormValid || createMutation.isPending}
          >
            <Plus className="h-4 w-4" /> Add Config
          </button>
        </div>
      </div>

      {/* Config List */}
      <div className="card">
        <div className="px-6 pt-6 pb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">Existing Configs</h3>
          <select
            className="input w-48"
            value={selectedMachineId}
            onChange={(e) => setSelectedMachineId(e.target.value)}
          >
            <option value="">All machines</option>
            {machines.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
        <div className="divide-y divide-gray-100">
          {configs.length === 0 && (
            <p className="px-6 py-4 text-sm text-gray-400 text-center">No tag configs configured yet.</p>
          )}
          {configs.map((cfg) => {
            const machine = machines.find((m) => m.id === cfg.machine_id);
            const cat = categories.find((c) => c.id === cfg.downtime_category_id);
            if (editId === cfg.id) {
              return (
                <div key={cfg.id} className="px-6 py-3 space-y-2 bg-gray-50">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      className="input"
                      placeholder="Measurement"
                      value={editForm.measurement_name ?? ""}
                      onChange={(e) => setEditForm({ ...editForm, measurement_name: e.target.value })}
                    />
                    <input
                      className="input"
                      placeholder="Tag field"
                      value={editForm.tag_field ?? ""}
                      onChange={(e) => setEditForm({ ...editForm, tag_field: e.target.value })}
                    />
                    {editForm.tag_type === "digital" ? (
                      <input
                        className="input"
                        placeholder="Downtime value"
                        value={editForm.digital_downtime_value ?? ""}
                        onChange={(e) => setEditForm({ ...editForm, digital_downtime_value: e.target.value })}
                      />
                    ) : (
                      <>
                        <select
                          className="input"
                          value={editForm.analog_operator ?? ">"}
                          onChange={(e) => setEditForm({ ...editForm, analog_operator: e.target.value })}
                        >
                          {ANALOG_OPERATORS.map((op) => <option key={op} value={op}>{op}</option>)}
                        </select>
                        <input
                          className="input"
                          type="number"
                          placeholder="Threshold"
                          value={editForm.analog_threshold ?? ""}
                          onChange={(e) =>
                            setEditForm({ ...editForm, analog_threshold: e.target.value ? Number(e.target.value) : undefined })
                          }
                        />
                      </>
                    )}
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={editForm.is_enabled ?? true}
                        onChange={(e) => setEditForm({ ...editForm, is_enabled: e.target.checked })}
                      />
                      <span className="text-sm text-gray-700">Enabled</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="btn-primary px-2"
                      onClick={() => updateMutation.mutate({ id: cfg.id, data: editForm })}
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button className="btn-ghost px-2" onClick={cancelEdit}>
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            }
            return (
              <div key={cfg.id} className="px-6 py-3 flex items-center justify-between text-sm">
                <div>
                  <div className="font-medium text-gray-900">
                    {machine?.name ?? `Machine ${cfg.machine_id}`} — {cfg.measurement_name}.{cfg.tag_field}
                  </div>
                  <div className="text-gray-400 text-xs mt-0.5">
                    {cfg.tag_type === "digital"
                      ? `value == "${cfg.digital_downtime_value}"`
                      : `value ${cfg.analog_operator} ${cfg.analog_threshold}`}
                    {cat && ` · Category: ${cat.name}`}
                    {cfg.description && ` · ${cfg.description}`}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cfg.is_enabled ? "badge-green" : "badge-gray"}>
                    {cfg.is_enabled ? "Enabled" : "Disabled"}
                  </span>
                  <button className="btn-ghost p-1" onClick={() => startEdit(cfg)}>
                    <Pencil className="h-3 w-3 text-gray-500" />
                  </button>
                  <button className="btn-ghost p-1" onClick={() => deleteMutation.mutate(cfg.id)}>
                    <Trash2 className="h-3 w-3 text-red-500" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
