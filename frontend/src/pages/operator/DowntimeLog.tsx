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
  type Machine,
  type DowntimeCategory,
  type DowntimeSecondaryCategory,
  type DowntimeCode,
} from "@/lib/api";
import { Plus, Scissors, X } from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────

function toLocalDT(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

function toLocalDatetimeValue(isoString: string): string {
  return toLocalDT(new Date(isoString));
}

function formatDuration(startIso: string, endIso: string): string {
  const mins = Math.round(
    (new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000
  );
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

const PRESETS = [
  { label: "Last 24 Hrs", hours: 24 },
  { label: "Last 7 Days", hours: 24 * 7 },
  { label: "Last 30 Days", hours: 24 * 30 },
] as const;

const now = new Date();
const DEFAULT_FROM   = toLocalDT(new Date(now.getTime() - 24 * 60 * 60 * 1000));
const DEFAULT_TO     = toLocalDT(now);
const DEFAULT_PRESET = "Last 24 Hrs";

const isIncomplete = (e: DowntimeEvent) => !e.end_time || !e.reason_code_id;

// ── Edit Modal ────────────────────────────────────────────────────────────────

function EditModal({
  event,
  machines,
  categories,
  secondaries,
  codes,
  isSaving,
  isSplitting,
  isUnsplitting,
  isInSplitChain,
  onClose,
  onSave,
  onSplit,
  onUnsplit,
}: {
  event: DowntimeEvent;
  machines: Machine[];
  categories: DowntimeCategory[];
  secondaries: DowntimeSecondaryCategory[];
  codes: DowntimeCode[];
  isSaving: boolean;
  isSplitting: boolean;
  isUnsplitting: boolean;
  isInSplitChain: boolean;
  onClose: () => void;
  onSave: (data: Partial<DowntimeEvent>) => void;
  onSplit: (splitTime: string) => void;
  onUnsplit: () => void;
}) {
  const initCode      = codes.find((c) => c.id === event.reason_code_id);
  const initSecondary = secondaries.find((s) => s.id === initCode?.secondary_category_id);

  const [primaryId,   setPrimaryId]   = useState(String(initSecondary?.primary_category_id ?? ""));
  const [secondaryId, setSecondaryId] = useState(String(initCode?.secondary_category_id ?? ""));
  const [codeId,      setCodeId]      = useState(String(event.reason_code_id ?? ""));
  const [startTime,   setStartTime]   = useState(toLocalDatetimeValue(event.start_time));
  const [endTime,     setEndTime]     = useState(event.end_time ? toLocalDatetimeValue(event.end_time) : "");
  const [comments,    setComments]    = useState(event.comments ?? "");
  const [showSplit,   setShowSplit]   = useState(false);
  const [showUnsplit, setShowUnsplit] = useState(false);

  // Split slider state — only meaningful when showSplit is true
  const startMs     = new Date(event.start_time).getTime();
  const endMs       = event.end_time ? new Date(event.end_time).getTime() : 0;
  const durationMin = event.end_time ? Math.round((endMs - startMs) / 60000) : 0;
  const [sliderMin, setSliderMin] = useState(Math.max(1, Math.floor(durationMin / 2)));
  const splitTime   = new Date(startMs + sliderMin * 60000);

  // Allow splitting any event with an end time (including already-split events)
  const canSplit   = !!event.end_time && durationMin > 1;
  const canUnsplit = isInSplitChain;

  const filteredSecondaries = primaryId
    ? secondaries.filter((s) => s.primary_category_id === Number(primaryId))
    : [];
  const filteredCodes = secondaryId
    ? codes.filter((c) => c.secondary_category_id === Number(secondaryId))
    : [];

  const machineName = machines.find((m) => m.id === event.machine_id)?.name
    ?? `Machine ${event.machine_id}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Edit Downtime Event</h2>
          <button className="btn-ghost p-1" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Fields */}
        <div className="grid grid-cols-2 gap-3">

          {/* Machine — read-only */}
          <div>
            <label className="label">Machine</label>
            <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500">
              {machineName}
            </div>
          </div>

          {/* Primary Category */}
          <div>
            <label className="label">Primary Category</label>
            <select
              className="input"
              value={primaryId}
              onChange={(e) => {
                setPrimaryId(e.target.value);
                setSecondaryId("");
                setCodeId("");
              }}
            >
              <option value="">Select category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Secondary Category */}
          <div>
            <label className="label">Secondary Category</label>
            <select
              className="input"
              value={secondaryId}
              disabled={!primaryId}
              onChange={(e) => { setSecondaryId(e.target.value); setCodeId(""); }}
            >
              <option value="">Select secondary</option>
              {filteredSecondaries.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Reason Code */}
          <div>
            <label className="label">Reason Code</label>
            <select
              className="input"
              value={codeId}
              disabled={!secondaryId}
              onChange={(e) => setCodeId(e.target.value)}
            >
              <option value="">Select reason code</option>
              {filteredCodes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Start Time */}
          <div>
            <label className="label">Start Time</label>
            <input
              type="datetime-local"
              className="input"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>

          {/* End Time */}
          <div>
            <label className="label">End Time</label>
            <input
              type="datetime-local"
              className="input"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>

          {/* Comments */}
          <div className="col-span-2">
            <label className="label">Comments</label>
            <input
              className="input"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Optional notes…"
            />
          </div>
        </div>

        {/* Split section */}
        {canSplit && (
          <div>
            <button
              className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700"
              onClick={() => setShowSplit((v: boolean) => !v)}
            >
              <Scissors className="h-3.5 w-3.5" />
              {showSplit ? "Hide split" : "Split this event"}
            </button>

            {showSplit && (
              <div className="mt-2 px-4 py-3 bg-blue-50 rounded-lg border border-blue-200 space-y-3">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="whitespace-nowrap">{new Date(event.start_time).toLocaleTimeString()}</span>
                  <div className="flex-1 h-3 bg-gray-200 rounded-full relative overflow-hidden">
                    <div
                      className="absolute left-0 top-0 h-full bg-blue-400 rounded-l-full"
                      style={{ width: `${(sliderMin / durationMin) * 100}%` }}
                    />
                    <div
                      className="absolute top-0 h-full bg-orange-400 rounded-r-full"
                      style={{ left: `${(sliderMin / durationMin) * 100}%`, right: 0 }}
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

                <button
                  className="btn-primary text-xs px-3 py-1"
                  disabled={isSplitting}
                  onClick={() => onSplit(splitTime.toISOString())}
                >
                  <Scissors className="h-3 w-3" />
                  {isSplitting ? "Splitting…" : "Confirm Split"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Unsplit section */}
        {canUnsplit && (
          <div>
            <button
              className="flex items-center gap-1.5 text-xs font-medium text-orange-600 hover:text-orange-700"
              onClick={() => setShowUnsplit((v: boolean) => !v)}
            >
              <Scissors className="h-3.5 w-3.5" />
              {showUnsplit ? "Hide unsplit" : "Unsplit entire chain"}
            </button>

            {showUnsplit && (
              <div className="mt-2 px-4 py-3 bg-orange-50 rounded-lg border border-orange-200 space-y-2">
                <p className="text-xs text-orange-800">
                  This will collapse all splits back into a single event, restoring the original end time.
                  This cannot be undone.
                </p>
                <button
                  className="text-xs px-3 py-1 rounded-md bg-orange-500 hover:bg-orange-600 text-white font-medium transition-colors disabled:opacity-50"
                  disabled={isUnsplitting}
                  onClick={onUnsplit}
                >
                  {isUnsplitting ? "Unsplitting…" : "Confirm Unsplit"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-1">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary"
            disabled={isSaving}
            onClick={() =>
              onSave({
                start_time:     new Date(startTime).toISOString(),
                end_time:       endTime ? new Date(endTime).toISOString() : undefined,
                reason_code_id: codeId ? Number(codeId) : undefined,
                comments:       comments || undefined,
              })
            }
          >
            {isSaving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Split Panel ───────────────────────────────────────────────────────────────

function SplitPanel({
  event,
  onClose,
  onSplit,
}: {
  event: DowntimeEvent;
  onClose: () => void;
  onSplit: (splitTime: string) => void;
}) {
  const startMs     = new Date(event.start_time).getTime();
  const endMs       = new Date(event.end_time!).getTime();
  const durationMin = Math.round((endMs - startMs) / 60000);
  const [sliderMin, setSliderMin] = useState(Math.floor(durationMin / 2));
  const splitTime = new Date(startMs + sliderMin * 60000);

  return (
    <div className="mt-2 px-4 py-3 bg-blue-50 rounded-lg border border-blue-200 space-y-3">
      <div className="text-xs font-medium text-blue-800">Split this event</div>

      <div className="flex items-center gap-2 text-xs text-gray-500">
        <span className="whitespace-nowrap">{new Date(event.start_time).toLocaleTimeString()}</span>
        <div className="flex-1 h-3 bg-gray-200 rounded-full relative overflow-hidden">
          <div
            className="absolute left-0 top-0 h-full bg-blue-400 rounded-l-full"
            style={{ width: `${(sliderMin / durationMin) * 100}%` }}
          />
          <div
            className="absolute top-0 h-full bg-orange-400 rounded-r-full"
            style={{ left: `${(sliderMin / durationMin) * 100}%`, right: 0 }}
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

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function OperatorDowntime() {
  const { user } = useAuth();
  const qc = useQueryClient();

  // ── Filter bar state ──────────────────────────────────────────────────────
  const [fromDate,      setFromDate]      = useState(DEFAULT_FROM);
  const [toDate,        setToDate]        = useState(DEFAULT_TO);
  const [activePreset,  setActivePreset]  = useState<string>(DEFAULT_PRESET);
  const [filterMachine, setFilterMachine] = useState("");

  function applyPreset(hours: number, label: string) {
    const to   = new Date();
    const from = new Date(to.getTime() - hours * 60 * 60 * 1000);
    setToDate(toLocalDT(to));
    setFromDate(toLocalDT(from));
    setActivePreset(label);
  }

  // ── Create-form state ─────────────────────────────────────────────────────
  const [form, setForm] = useState({
    machine_id:           "",
    primary_category_id:  "",
    secondary_category_id: "",
    reason_code_id:       "",
    start_time:           new Date().toISOString().slice(0, 16),
    end_time:             "",
    comments:             "",
  });

  // ── UI state ──────────────────────────────────────────────────────────────
  const [splitEventId, setSplitEventId] = useState<number | null>(null);
  const [editEventId,  setEditEventId]  = useState<number | null>(null);

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: machines    = [] } = useQuery({
    queryKey: ["machines", user?.line_id],
    queryFn:  () => machinesApi.list(user?.line_id ?? undefined).then((r) => r.data),
  });

  const { data: categories  = [] } = useQuery({
    queryKey: ["downtime-categories"],
    queryFn:  () => downtimeCategoriesApi.list().then((r) => r.data),
  });

  const { data: secondaries = [] } = useQuery({
    queryKey: ["downtime-secondary-categories"],
    queryFn:  () => downtimeSecondaryCategoriesApi.list().then((r) => r.data),
  });

  const { data: codes       = [] } = useQuery({
    queryKey: ["downtime-codes"],
    queryFn:  () => downtimeCodesApi.list().then((r) => r.data),
  });

  const { data: events = [] } = useQuery({
    queryKey: ["downtime-events", fromDate, toDate, filterMachine],
    queryFn:  () =>
      downtimeEventsApi
        .list({
          from_time:  new Date(fromDate).toISOString(),
          to_time:    new Date(toDate).toISOString(),
          machine_id: filterMachine ? Number(filterMachine) : undefined,
        })
        .then((r) => r.data),
    refetchInterval: 30_000,
  });

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: () =>
      downtimeEventsApi.create({
        machine_id:     Number(form.machine_id),
        start_time:     new Date(form.start_time).toISOString(),
        end_time:       form.end_time ? new Date(form.end_time).toISOString() : undefined,
        reason_code_id: form.reason_code_id ? Number(form.reason_code_id) : undefined,
        comments:       form.comments || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["downtime-events"] });
      setForm({
        ...form,
        start_time:            new Date().toISOString().slice(0, 16),
        end_time:              "",
        primary_category_id:  "",
        secondary_category_id: "",
        reason_code_id:        "",
        comments:              "",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<DowntimeEvent> }) =>
      downtimeEventsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["downtime-events"] });
      setEditEventId(null);
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

  const unsplitMutation = useMutation({
    mutationFn: (id: number) => downtimeEventsApi.unsplit(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["downtime-events"] });
      setEditEventId(null);
    },
  });

  // ── Derived ───────────────────────────────────────────────────────────────
  const formSecondaries = form.primary_category_id
    ? secondaries.filter((s) => s.primary_category_id === Number(form.primary_category_id))
    : [];
  const formCodes = form.secondary_category_id
    ? codes.filter((c) => c.secondary_category_id === Number(form.secondary_category_id))
    : [];

  const editEvent = editEventId != null ? events.find((e) => e.id === editEventId) ?? null : null;

  // An event is "in a split chain" if it is itself a split child OR has split children
  const editEventInChain = editEvent != null && (
    editEvent.is_split || events.some((e: DowntimeEvent) => e.parent_event_id === editEvent.id)
  );

  const incompleteCount = events.filter(isIncomplete).length;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Log Downtime Events</h1>
        {incompleteCount > 0 && (
          <p className="text-xs text-red-500 mt-0.5">
            {incompleteCount} event{incompleteCount !== 1 ? "s" : ""} with missing fields
          </p>
        )}
      </div>

      {/* New Event Form */}
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

            <div>
              <label className="label">Primary Category</label>
              <select
                className="input"
                value={form.primary_category_id}
                onChange={(e) =>
                  setForm({
                    ...form,
                    primary_category_id:  e.target.value,
                    secondary_category_id: "",
                    reason_code_id:        "",
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
                {formSecondaries.map((s) => (
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
                {formCodes.map((c) => (
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

      {/* Filter bar */}
      <div className="card px-4 py-3 flex items-center gap-4 flex-wrap">

        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 flex-shrink-0">
          {PRESETS.map(({ label, hours }) => (
            <button
              key={label}
              onClick={() => applyPreset(hours, label)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                activePreset === label
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="w-px h-6 bg-gray-200 flex-shrink-0" />

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">
            From
          </span>
          <input
            type="datetime-local"
            value={fromDate}
            onChange={(e) => { setFromDate(e.target.value); setActivePreset(""); }}
            style={{ width: "13rem" }}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">
            To
          </span>
          <input
            type="datetime-local"
            value={toDate}
            onChange={(e) => { setToDate(e.target.value); setActivePreset(""); }}
            style={{ width: "13rem" }}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">
            Machine
          </span>
          <select
            style={{ width: "11rem" }}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            value={filterMachine}
            onChange={(e) => setFilterMachine(e.target.value)}
          >
            <option value="">All machines</option>
            {machines.map((m) => (
              <option key={m.id} value={String(m.id)}>{m.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Events list */}
      <div className="card">
        <div className="px-6 pt-5 pb-3 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Downtime Events</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Click any row to edit · red rows have missing fields
            </p>
          </div>
          <span className="text-xs text-gray-400">{events.length} event{events.length !== 1 ? "s" : ""}</span>
        </div>

        <div className="divide-y divide-gray-100">
          {events.map((e) => {
            const code      = codes.find((c) => c.id === e.reason_code_id);
            const secondary = secondaries.find((s) => s.id === code?.secondary_category_id);
            const primary   = categories.find((c) => c.id === secondary?.primary_category_id);
            const machine   = machines.find((m) => m.id === e.machine_id);
            const isSplitting  = splitEventId === e.id;
            const incomplete   = isIncomplete(e);

            return (
              <div
                key={e.id}
                className={`px-6 py-3 text-sm cursor-pointer transition-colors ${
                  incomplete
                    ? "bg-red-50 border-l-4 border-l-red-400 hover:bg-red-100"
                    : "hover:bg-gray-50"
                }`}
                onClick={() => { if (!isSplitting) setEditEventId(e.id); }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex items-center gap-2">
                    <span className="font-medium text-gray-900">
                      {code?.name ?? <span className="text-red-500 italic">No code</span>}
                    </span>
                    {primary ? (
                      <span className="text-xs text-gray-400">
                        {primary.name}
                        {secondary && secondary.name !== "General" && ` › ${secondary.name}`}
                      </span>
                    ) : (
                      <span className="text-xs text-red-400 italic">Unclassified</span>
                    )}
                    {machine && (
                      <span className="text-xs text-gray-400">· {machine.name}</span>
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
                    {!e.end_time ? (
                      <span className="badge-yellow">Ongoing</span>
                    ) : (
                      <span className="text-gray-400">{formatDuration(e.start_time, e.end_time)}</span>
                    )}
                    {e.end_time && !e.is_split && (
                      <button
                        className="btn-ghost p-1"
                        title="Split event"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          setSplitEventId(isSplitting ? null : e.id);
                        }}
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
                    onSplit={(splitTime) => splitMutation.mutate({ id: e.id, splitTime })}
                  />
                )}
              </div>
            );
          })}

          {events.length === 0 && (
            <p className="px-6 py-8 text-sm text-gray-400 text-center">
              No downtime events in the selected period.
            </p>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {editEvent && (
        <EditModal
          event={editEvent}
          machines={machines}
          categories={categories}
          secondaries={secondaries}
          codes={codes}
          isSaving={updateMutation.isPending}
          isSplitting={splitMutation.isPending}
          isUnsplitting={unsplitMutation.isPending}
          isInSplitChain={editEventInChain}
          onClose={() => setEditEventId(null)}
          onSave={(data) => updateMutation.mutate({ id: editEvent.id, data })}
          onSplit={(splitTime) => splitMutation.mutate({ id: editEvent.id, splitTime })}
          onUnsplit={() => unsplitMutation.mutate(editEvent.id)}
        />
      )}
    </div>
  );
}
