import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { downtimeCategoriesApi, downtimeCodesApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      <h1 className="text-2xl font-bold">Downtime Reason Codes</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Categories</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2 items-center">
              <Input placeholder="Category name" value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} />
              <label className="flex items-center gap-1 text-sm whitespace-nowrap">
                <input type="checkbox" checked={catForm.counts_against_availability}
                  onChange={(e) => setCatForm({ ...catForm, counts_against_availability: e.target.checked })} />
                Counts vs Avail
              </label>
              <Button size="sm" onClick={() => createCat.mutate()} disabled={!catForm.name}><Plus className="h-4 w-4" /></Button>
            </div>
            <div className="space-y-1">
              {categories.map((c) => (
                <div key={c.id} className="flex items-center justify-between py-1 px-2 rounded hover:bg-muted/50 text-sm">
                  <span className="flex items-center gap-2">
                    {c.name}
                    <Badge variant={c.counts_against_availability ? "destructive" : "secondary"} className="text-xs">
                      {c.counts_against_availability ? "Counts" : "Excluded"}
                    </Badge>
                  </span>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteCat.mutate(c.id)}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Reason Codes</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <select className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm w-36"
                value={codeForm.category_id} onChange={(e) => setCodeForm({ ...codeForm, category_id: e.target.value })}>
                <option value="">Category</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <Input placeholder="Code name" value={codeForm.name} onChange={(e) => setCodeForm({ ...codeForm, name: e.target.value })} />
              <Button size="sm" onClick={() => createCode.mutate()} disabled={!codeForm.category_id || !codeForm.name}><Plus className="h-4 w-4" /></Button>
            </div>
            <div className="space-y-1">
              {codes.map((c) => {
                const cat = categories.find((cat) => cat.id === c.category_id);
                return (
                  <div key={c.id} className="flex items-center justify-between py-1 px-2 rounded hover:bg-muted/50 text-sm">
                    <span>{c.name} <span className="text-muted-foreground text-xs">({cat?.name})</span></span>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteCode.mutate(c.id)}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
