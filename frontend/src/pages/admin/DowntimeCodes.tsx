import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  downtimeCategoriesApi,
  downtimeSecondaryCategoriesApi,
  downtimeCodesApi,
} from "@/lib/api";
import { Plus, Trash2 } from "lucide-react";

export default function AdminDowntimeCodes() {
  const qc = useQueryClient();

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

  const [selectedPrimaryId, setSelectedPrimaryId] = useState<number | null>(null);
  const [selectedSecondaryId, setSelectedSecondaryId] = useState<number | null>(null);

  const [catForm, setCatForm] = useState({ name: "", counts_against_availability: true });
  const [secForm, setSecForm] = useState({ name: "" });
  const [codeForm, setCodeForm] = useState({ name: "" });

  // ── Primary Category mutations ─────────────────────────────────────────────
  const createCat = useMutation({
    mutationFn: () => downtimeCategoriesApi.create(catForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["downtime-categories"] });
      setCatForm({ name: "", counts_against_availability: true });
    },
  });

  const deleteCat = useMutation({
    mutationFn: (id: number) => downtimeCategoriesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["downtime-categories"] });
      qc.invalidateQueries({ queryKey: ["downtime-secondary-categories"] });
      qc.invalidateQueries({ queryKey: ["downtime-codes"] });
      setSelectedPrimaryId(null);
      setSelectedSecondaryId(null);
    },
  });

  // ── Secondary Category mutations ───────────────────────────────────────────
  const createSec = useMutation({
    mutationFn: () =>
      downtimeSecondaryCategoriesApi.create({
        primary_category_id: selectedPrimaryId!,
        name: secForm.name,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["downtime-secondary-categories"] });
      setSecForm({ name: "" });
    },
  });

  const deleteSec = useMutation({
    mutationFn: (id: number) => downtimeSecondaryCategoriesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["downtime-secondary-categories"] });
      qc.invalidateQueries({ queryKey: ["downtime-codes"] });
      setSelectedSecondaryId(null);
    },
  });

  // ── Code mutations ─────────────────────────────────────────────────────────
  const createCode = useMutation({
    mutationFn: () =>
      downtimeCodesApi.create({
        secondary_category_id: selectedSecondaryId!,
        name: codeForm.name,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["downtime-codes"] });
      setCodeForm({ name: "" });
    },
  });

  const deleteCode = useMutation({
    mutationFn: (id: number) => downtimeCodesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["downtime-codes"] }),
  });

  const filteredSecondaries = selectedPrimaryId
    ? secondaries.filter((s) => s.primary_category_id === selectedPrimaryId)
    : [];

  const filteredCodes = selectedSecondaryId
    ? codes.filter((c) => c.secondary_category_id === selectedSecondaryId)
    : [];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Downtime Reason Codes</h1>
      <p className="text-sm text-gray-500">
        Three-level hierarchy: Primary Category → Secondary Category → Reason Code. Click a row to drill down.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Column 1: Primary Categories */}
        <div className="card">
          <div className="px-4 pt-4 pb-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">Primary Categories</h3>
          </div>
          <div className="px-4 py-3 border-b border-gray-100 space-y-2">
            <div className="flex gap-2 items-center">
              <input
                className="input flex-1 text-sm"
                placeholder="Category name"
                value={catForm.name}
                onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
              />
              <button
                className="btn-primary px-2"
                onClick={() => createCat.mutate()}
                disabled={!catForm.name}
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>
            <label className="flex items-center gap-1 text-xs text-gray-600">
              <input
                type="checkbox"
                checked={catForm.counts_against_availability}
                onChange={(e) => setCatForm({ ...catForm, counts_against_availability: e.target.checked })}
              />
              Counts against availability
            </label>
          </div>
          <div className="divide-y divide-gray-50">
            {categories.map((c) => (
              <div
                key={c.id}
                className={`flex items-center justify-between px-4 py-2 cursor-pointer text-sm transition-colors ${
                  selectedPrimaryId === c.id ? "bg-blue-50 border-l-2 border-blue-500" : "hover:bg-gray-50"
                }`}
                onClick={() => {
                  setSelectedPrimaryId(c.id);
                  setSelectedSecondaryId(null);
                }}
              >
                <span className="flex items-center gap-2 truncate min-w-0">
                  <span className="truncate">{c.name}</span>
                  <span
                    className={c.counts_against_availability ? "badge-red" : "badge-gray"}
                    style={{ fontSize: "10px" }}
                  >
                    {c.counts_against_availability ? "Counts" : "Excl"}
                  </span>
                </span>
                <button
                  className="btn-ghost p-1 ml-1 flex-shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteCat.mutate(c.id);
                  }}
                >
                  <Trash2 className="h-3 w-3 text-red-400" />
                </button>
              </div>
            ))}
            {categories.length === 0 && (
              <p className="px-4 py-3 text-xs text-gray-400">No categories yet.</p>
            )}
          </div>
        </div>

        {/* Column 2: Secondary Categories */}
        <div className="card">
          <div className="px-4 pt-4 pb-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">
              Secondary Categories
              {selectedPrimaryId && (
                <span className="ml-1 text-gray-400 font-normal text-xs">
                  ({categories.find((c) => c.id === selectedPrimaryId)?.name})
                </span>
              )}
            </h3>
          </div>
          {selectedPrimaryId ? (
            <>
              <div className="px-4 py-3 border-b border-gray-100">
                <div className="flex gap-2">
                  <input
                    className="input flex-1 text-sm"
                    placeholder="Secondary name"
                    value={secForm.name}
                    onChange={(e) => setSecForm({ name: e.target.value })}
                  />
                  <button
                    className="btn-primary px-2"
                    onClick={() => createSec.mutate()}
                    disabled={!secForm.name}
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              </div>
              <div className="divide-y divide-gray-50">
                {filteredSecondaries.map((s) => (
                  <div
                    key={s.id}
                    className={`flex items-center justify-between px-4 py-2 cursor-pointer text-sm transition-colors ${
                      selectedSecondaryId === s.id ? "bg-blue-50 border-l-2 border-blue-500" : "hover:bg-gray-50"
                    }`}
                    onClick={() => setSelectedSecondaryId(s.id)}
                  >
                    <span className="truncate">{s.name}</span>
                    <button
                      className="btn-ghost p-1 ml-1 flex-shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSec.mutate(s.id);
                      }}
                    >
                      <Trash2 className="h-3 w-3 text-red-400" />
                    </button>
                  </div>
                ))}
                {filteredSecondaries.length === 0 && (
                  <p className="px-4 py-3 text-xs text-gray-400">No secondary categories yet.</p>
                )}
              </div>
            </>
          ) : (
            <p className="px-4 py-6 text-xs text-gray-400 text-center">
              Select a primary category first.
            </p>
          )}
        </div>

        {/* Column 3: Reason Codes */}
        <div className="card">
          <div className="px-4 pt-4 pb-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">
              Reason Codes
              {selectedSecondaryId && (
                <span className="ml-1 text-gray-400 font-normal text-xs">
                  ({secondaries.find((s) => s.id === selectedSecondaryId)?.name})
                </span>
              )}
            </h3>
          </div>
          {selectedSecondaryId ? (
            <>
              <div className="px-4 py-3 border-b border-gray-100">
                <div className="flex gap-2">
                  <input
                    className="input flex-1 text-sm"
                    placeholder="Code name"
                    value={codeForm.name}
                    onChange={(e) => setCodeForm({ name: e.target.value })}
                  />
                  <button
                    className="btn-primary px-2"
                    onClick={() => createCode.mutate()}
                    disabled={!codeForm.name}
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              </div>
              <div className="divide-y divide-gray-50">
                {filteredCodes.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between px-4 py-2 text-sm hover:bg-gray-50"
                  >
                    <span className="truncate">{c.name}</span>
                    <button
                      className="btn-ghost p-1 ml-1 flex-shrink-0"
                      onClick={() => deleteCode.mutate(c.id)}
                    >
                      <Trash2 className="h-3 w-3 text-red-400" />
                    </button>
                  </div>
                ))}
                {filteredCodes.length === 0 && (
                  <p className="px-4 py-3 text-xs text-gray-400">No reason codes yet.</p>
                )}
              </div>
            </>
          ) : (
            <p className="px-4 py-6 text-xs text-gray-400 text-center">
              Select a secondary category first.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
