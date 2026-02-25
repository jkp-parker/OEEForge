import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import {
  machinesApi,
  downtimeCategoriesApi,
  downtimeSecondaryCategoriesApi,
  downtimeCodesApi,
  downtimeEventsApi,
  type DowntimeEvent,
} from "@/lib/api";
import { Plus, Scissors } from "lucide-react";

function formatDuration(startIso: string, endIso: string): string {
  const mins = Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function toLocalDatetimeValue(isoString: string): string {
  const d = new Date(isoString);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

function SplitPanel({
  event,
  onClose,
  onSplit,
}: {
  event: DowntimeEvent;
  onClose: () => void;
  onSplit: (splitTime: string) => void;
}) {
  const startMs = new Date(event.start_time).getTime();
  const endMs = new Date(event.end_time!).getTime();
  const durationMin = Math.round((endMs - startMs) / 60000);

  const [sliderMin, setSliderMin] = useState(Math.floor(durationMin / 2));

  const splitTime = new Date(startMs + sliderMin * 60000);

  return (
    <div className="mt-2 px-4 py-3 bg-blue-50 rounded-lg border border-blue-200 space-y-3">
      <div className="text-xs font-medium text-blue-800">Split this event</div>

      {/* Timeline bar */}
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <span className="whitespace-nowrap">{new Date(event.start_time).toLocaleTimeString()}</span>
        <div className="flex-1 h-3 bg-gray-200 rounded-full relative overflow-hidden">
          <div
            className="absolute left-0 top-0 h-full bg-blue-400 rounded-l-full"
            style={{ width: `${(sliderMin / durationMin) * 100}%` }}
          />
          <div
            className="absolute top-0 h-full bg-orange-400 rounded-r-full"
            style={{
              left: `${(sliderMin / durationMin) * 100}%`,
              right: 0,
            }}
          />
        </div>
        <span className="whitespace-nowrap">{new Date(event.end_time!).toLocaleTimeString()}</span>
      </div>

      <div className="space-y-1">
        <input
          type="range"
          min={1}
          max={durationMin - 1}
          value={sliderMin}
          onChange={(e) => setSliderMin(Number(e.target.value))}
          className="w-full accent-blue-600"
        />
        <div className="text-xs text-center text-gray-600">
          Split at: <span className="font-medium">{splitTime.toLocaleString()}</span>
          <span className="text-gray-400 ml-2">
            (+{sliderMin}m / {durationMin - sliderMin}m remaining)
          </span>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          className="btn-primary text-xs px-3 py-1"
          onClick={() => onSplit(splitTime.toISOString())}
        >
          <Scissors className="h-3 w-3" /> Confirm Split
        </button>
        <button className="btn-ghost text-xs px-3 py-1" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function OperatorDowntime() {
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

  const { data: secondaries = [] } = useQuery({
    queryKey: ["downtime-secondary-categories"],
    queryFn: () => downtimeSecondaryCategoriesApi.list().then((r) => r.data),
  });

  const { data: codes = [] } = useQuery({
    queryKey: ["downtime-codes"],
    queryFn: () => downtimeCodesApi.list().then((r) => r.data),
  });

  const [form, setForm] = useState({
    machine_id: "",
    primary_category_id: "",
    secondary_category_id: "",
    reason_code_id: "",
    start_time: new Date().toISOString().slice(0, 16),
    end_time: "",
    comments: "",
  });

  const [splitEventId, setSplitEventId] = useState<number | null>(null);

  const { data: events = [] } = useQuery({
    queryKey: ["downtime-events", form.machine_id],
    queryFn: () =>
      form.machine_id
        ? downtimeEventsApi.list({ machine_id: Number(form.machine_id) }).then((r) => r.data)
        : Promise.resolve([]),
    enabled: !!form.machine_id,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      downtimeEventsApi.create({
        machine_id: Number(form.machine_id),
        start_time: new Date(form.start_time).toISOString(),
        end_time: form.end_time ? new Date(form.end_time).toISOString() : undefined,
        reason_code_id: form.reason_code_id ? Number(form.reason_code_id) : undefined,
        comments: form.comments || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["downtime-events"] });
      setForm({
        ...form,
        start_time: new Date().toISOString().slice(0, 16),
        end_time: "",
        primary_category_id: "",
        secondary_category_id: "",
        reason_code_id: "",
        comments: "",
      });
    },
  });

  const splitMutation = useMutation({
    mutationFn: ({ id, splitTime }: { id: number; splitTime: string }) =>
      downtimeEventsApi.split(id, splitTime),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["downtime-events"] });
      setSplitEventId(null);
    },
  });

  const filteredSecondaries = form.primary_category_id
    ? secondaries.filter((s) => s.primary_category_id === Number(form.primary_category_id))
    : [];

  const filteredCodes = form.secondary_category_id
    ? codes.filter((c) => c.secondary_category_id === Number(form.secondary_category_id))
    : [];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Log Downtime Event</h1>

      <div className="card">
        <div className="px-6 pt-6 pb-4">
          <h3 className="text-base font-semibold text-gray-900">New Downtime Event</h3>
        </div>
        <div className="px-6 pb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Machine</label>
              <select
                className="input"
                value={form.machine_id}
                onChange={(e) => setForm({ ...form, machine_id: e.target.value })}
              >
                <option value="">Select machine</option>
                {machines.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>

            {/* 3-level cascading selects */}
            <div>
              <label className="label">Primary Category</label>
              <select
                className="input"
                value={form.primary_category_id}
                onChange={(e) =>
                  setForm({
                    ...form,
                    primary_category_id: e.target.value,
                    secondary_category_id: "",
                    reason_code_id: "",
                  })
                }
              >
                <option value="">Select category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Secondary Category</label>
              <select
                className="input"
                value={form.secondary_category_id}
                disabled={!form.primary_category_id}
                onChange={(e) =>
                  setForm({ ...form, secondary_category_id: e.target.value, reason_code_id: "" })
                }
              >
                <option value="">Select secondary</option>
                {filteredSecondaries.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Reason Code</label>
              <select
                className="input"
                value={form.reason_code_id}
                disabled={!form.secondary_category_id}
                onChange={(e) => setForm({ ...form, reason_code_id: e.target.value })}
              >
                <option value="">Select reason code</option>
                {filteredCodes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Start Time</label>
              <input
                type="datetime-local"
                className="input"
                value={form.start_time}
                onChange={(e) => setForm({ ...form, start_time: e.target.value })}
              />
            </div>
            <div>
              <label className="label">End Time (optional)</label>
              <input
                type="datetime-local"
                className="input"
                value={form.end_time}
                onChange={(e) => setForm({ ...form, end_time: e.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <label className="label">Comments</label>
              <input
                className="input"
                value={form.comments}
                onChange={(e) => setForm({ ...form, comments: e.target.value })}
                placeholder="Optional notes about this downtime event"
              />
            </div>
            <div className="md:col-span-2">
              <button
                className="btn-primary"
                onClick={() => createMutation.mutate()}
                disabled={!form.machine_id || !form.start_time || createMutation.isPending}
              >
                <Plus className="h-4 w-4" /> Log Downtime
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Recent events */}
      <div className="card">
        <div className="px-6 pt-6 pb-4">
          <h3 className="text-base font-semibold text-gray-900">Recent Downtime Events</h3>
        </div>
        <div className="divide-y divide-gray-100">
          {events.slice(0, 20).map((e) => {
            const code = codes.find((c) => c.id === e.reason_code_id);
            const secondary = secondaries.find((s) => s.id === code?.secondary_category_id);
            const primary = categories.find((c) => c.id === secondary?.primary_category_id);
            const isSplitting = splitEventId === e.id;

            return (
              <div key={e.id} className="px-6 py-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="font-medium text-gray-900">{code?.name ?? "Unclassified"}</span>
                    {primary && (
                      <span className="ml-2 text-xs text-gray-400">
                        {primary.name}
                        {secondary && secondary.name !== "General" && ` › ${secondary.name}`}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {primary && (
                      <span className={primary.counts_against_availability ? "badge-red" : "badge-gray"}>
                        {primary.counts_against_availability ? "Counts" : "Excluded"}
                      </span>
                    )}
                    {e.is_split && <span className="badge-blue">Split</span>}
                    {e.source_tag_config_id && <span className="badge-blue">Auto</span>}
                    {e.end_time
                      ? <span className="text-gray-400">{formatDuration(e.start_time, e.end_time)}</span>
                      : <span className="badge-yellow">Ongoing</span>}
                    {e.end_time && !e.is_split && (
                      <button
                        className="btn-ghost p-1"
                        title="Split event"
                        onClick={() => setSplitEventId(isSplitting ? null : e.id)}
                      >
                        <Scissors className="h-3 w-3 text-blue-500" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="text-gray-400 text-xs mt-1">
                  {new Date(e.start_time).toLocaleString()}
                  {e.end_time && ` → ${new Date(e.end_time).toLocaleTimeString()}`}
                  {e.comments && ` — ${e.comments}`}
                </div>

                {isSplitting && (
                  <SplitPanel
                    event={e}
                    onClose={() => setSplitEventId(null)}
                    onSplit={(splitTime) =>
                      splitMutation.mutate({ id: e.id, splitTime })
                    }
                  />
                )}
              </div>
            );
          })}
          {events.length === 0 && (
            <p className="px-6 py-4 text-sm text-gray-400 text-center">
              No downtime events recorded yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
