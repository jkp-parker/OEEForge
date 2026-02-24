import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { productsApi, machinesApi, api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2 } from "lucide-react";

export default function AdminProducts() {
  const qc = useQueryClient();
  const { data: products = [] } = useQuery({ queryKey: ["products"], queryFn: () => productsApi.list().then((r) => r.data) });
  const { data: machines = [] } = useQuery({ queryKey: ["machines"], queryFn: () => machinesApi.list().then((r) => r.data) });
  const { data: mpcConfigs = [] } = useQuery({
    queryKey: ["machine-product-configs"],
    queryFn: () => api.get("/machine-product-configs").then((r) => r.data),
  });

  const [pForm, setPForm] = useState({ name: "", sku: "", description: "" });
  const [mpcForm, setMpcForm] = useState({ machine_id: "", product_id: "", ideal_cycle_time_seconds: "" });

  const createProduct = useMutation({
    mutationFn: () => productsApi.create(pForm),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["products"] }); setPForm({ name: "", sku: "", description: "" }); },
  });

  const deleteProduct = useMutation({
    mutationFn: (id: number) => productsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });

  const createMpc = useMutation({
    mutationFn: () =>
      api.post("/machine-product-configs", {
        machine_id: Number(mpcForm.machine_id),
        product_id: Number(mpcForm.product_id),
        ideal_cycle_time_seconds: Number(mpcForm.ideal_cycle_time_seconds),
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["machine-product-configs"] }); },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Products & Cycle Times</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Products</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input placeholder="Name" value={pForm.name} onChange={(e) => setPForm({ ...pForm, name: e.target.value })} />
              <Input placeholder="SKU" value={pForm.sku} onChange={(e) => setPForm({ ...pForm, sku: e.target.value })} className="w-24" />
              <Button size="sm" onClick={() => createProduct.mutate()} disabled={!pForm.name || !pForm.sku}><Plus className="h-4 w-4" /></Button>
            </div>
            <div className="space-y-1">
              {products.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-1 px-2 rounded hover:bg-muted/50 text-sm">
                  <span>{p.name} <span className="text-muted-foreground">({p.sku})</span></span>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteProduct.mutate(p.id)}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Ideal Cycle Times</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <select className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={mpcForm.machine_id} onChange={(e) => setMpcForm({ ...mpcForm, machine_id: e.target.value })}>
                <option value="">Machine</option>
                {machines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <select className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={mpcForm.product_id} onChange={(e) => setMpcForm({ ...mpcForm, product_id: e.target.value })}>
                <option value="">Product</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <Input
                type="number"
                placeholder="Cycle time (s)"
                value={mpcForm.ideal_cycle_time_seconds}
                onChange={(e) => setMpcForm({ ...mpcForm, ideal_cycle_time_seconds: e.target.value })}
                className="col-span-2"
              />
              <Button onClick={() => createMpc.mutate()} disabled={!mpcForm.machine_id || !mpcForm.product_id || !mpcForm.ideal_cycle_time_seconds} className="col-span-2">
                <Plus className="h-4 w-4 mr-2" /> Add Config
              </Button>
            </div>
            <div className="space-y-1">
              {(mpcConfigs as any[]).map((c: any) => {
                const machine = machines.find((m) => m.id === c.machine_id);
                const product = products.find((p) => p.id === c.product_id);
                return (
                  <div key={c.id} className="flex items-center justify-between py-1 px-2 rounded hover:bg-muted/50 text-sm">
                    <span>{machine?.name} × {product?.name}: <strong>{c.ideal_cycle_time_seconds}s</strong></span>
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
