import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { downtimeCategoriesApi, downtimeCodesApi } from "@/lib/api";
import { Plus, Trash2 } from "lucide-react";

export default function AdminDowntimeCodes() {
  const qc = useQueryClient();
  const { data: categories = [] } = useQuery({
    queryKey: ["downtime-categories"],
    queryFn: () => downtimeCategoriesApi.list().then((r) => r.data),
  });
  const { data: codes = [] } = useQuery({
    queryKey: ["downtime-codes"],
    queryFn: () => downtimeCodesApi.list().then((r) => r.data),
  });

  const [catForm, setCatForm] = useState({ name: "", counts_against_availability: true });
  const [codeForm, setCodeForm] = useState({ category_id: "", name: "" });

  const createCat = useMutation({
    mutationFn: () => downtimeCategoriesApi.create(catForm),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["downtime-categories"] }); setCatForm({ name: "", counts_against_availability: true }); },
  });

  const deleteCat = useMutation({
    mutationFn: (id: number) => downtimeCategoriesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["downtime-categories"] }),
  });

  const createCode = useMutation({
    mutationFn: () => downtimeCodesApi.create({ category_id: Number(codeForm.category_id), name: codeForm.name }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["downtime-codes"] }); setCodeForm({ category_id: "", name: "" }); },
  });

  const deleteCode = useMutation({
    mutationFn: (id: number) => downtimeCodesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["downtime-codes"] }),
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Downtime Reason Codes</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <div className="px-6 pt-6 pb-4"><h3 className="text-base font-semibold text-gray-900">Categories</h3></div>
          <div className="px-6 pb-6 space-y-3">
            <div className="flex gap-2 items-center">
              <input className="input flex-1" placeholder="Category name" value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} />
              <label className="flex items-center gap-1 text-sm whitespace-nowrap text-gray-700">
                <input type="checkbox" checked={catForm.counts_against_availability}
                  onChange={(e) => setCatForm({ ...catForm, counts_against_availability: e.target.checked })} />
                Counts vs Avail
              </label>
              <button className="btn-primary px-2" onClick={() => createCat.mutate()} disabled={!catForm.name}><Plus className="h-4 w-4" /></button>
            </div>
            <div className="space-y-1">
              {categories.map((c) => (
                <div key={c.id} className="flex items-center justify-between py-1 px-2 rounded hover:bg-gray-50 text-sm">
                  <span className="flex items-center gap-2">
                    {c.name}
                    <span className={c.counts_against_availability ? "badge-red" : "badge-gray"}>
                      {c.counts_against_availability ? "Counts" : "Excluded"}
                    </span>
                  </span>
                  <button className="btn-ghost p-1" onClick={() => deleteCat.mutate(c.id)}>
                    <Trash2 className="h-3 w-3 text-red-500" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="px-6 pt-6 pb-4"><h3 className="text-base font-semibold text-gray-900">Reason Codes</h3></div>
          <div className="px-6 pb-6 space-y-3">
            <div className="flex gap-2">
              <select className="input w-36" value={codeForm.category_id} onChange={(e) => setCodeForm({ ...codeForm, category_id: e.target.value })}>
                <option value="">Category</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input className="input flex-1" placeholder="Code name" value={codeForm.name} onChange={(e) => setCodeForm({ ...codeForm, name: e.target.value })} />
              <button className="btn-primary px-2" onClick={() => createCode.mutate()} disabled={!codeForm.category_id || !codeForm.name}><Plus className="h-4 w-4" /></button>
            </div>
            <div className="space-y-1">
              {codes.map((c) => {
                const cat = categories.find((cat) => cat.id === c.category_id);
                return (
                  <div key={c.id} className="flex items-center justify-between py-1 px-2 rounded hover:bg-gray-50 text-sm">
                    <span>{c.name} <span className="text-gray-400 text-xs">({cat?.name})</span></span>
                    <button className="btn-ghost p-1" onClick={() => deleteCode.mutate(c.id)}>
                      <Trash2 className="h-3 w-3 text-red-500" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
