import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { sitesApi, areasApi, linesApi, machinesApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, ChevronRight } from "lucide-react";

export default function AdminOrganization() {
  const qc = useQueryClient();
  const { data: sites = [] } = useQuery({ queryKey: ["sites"], queryFn: () => sitesApi.list().then((r) => r.data) });
  const { data: areas = [] } = useQuery({ queryKey: ["areas"], queryFn: () => areasApi.list().then((r) => r.data) });
  const { data: lines = [] } = useQuery({ queryKey: ["lines"], queryFn: () => linesApi.list().then((r) => r.data) });
  const { data: machines = [] } = useQuery({ queryKey: ["machines"], queryFn: () => machinesApi.list().then((r) => r.data) });

  // Site form
  const [siteName, setSiteName] = useState("");
  const [siteTz, setSiteTz] = useState("UTC");
  const createSite = useMutation({
    mutationFn: () => sitesApi.create({ name: siteName, timezone: siteTz }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sites"] }); setSiteName(""); },
  });

  // Area form
  const [areaSiteId, setAreaSiteId] = useState<number | "">("");
  const [areaName, setAreaName] = useState("");
  const createArea = useMutation({
    mutationFn: () => areasApi.create({ site_id: Number(areaSiteId), name: areaName }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["areas"] }); setAreaName(""); },
  });

  // Line form
  const [lineAreaId, setLineAreaId] = useState<number | "">("");
  const [lineName, setLineName] = useState("");
  const createLine = useMutation({
    mutationFn: () => linesApi.create({ area_id: Number(lineAreaId), name: lineName }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["lines"] }); setLineName(""); },
  });

  // Machine form
  const [machineLineId, setMachineLineId] = useState<number | "">("");
  const [machineName, setMachineName] = useState("");
  const [machineOpcua, setMachineOpcua] = useState("");
  const createMachine = useMutation({
    mutationFn: () => machinesApi.create({ line_id: Number(machineLineId), name: machineName, opcua_node_id: machineOpcua || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["machines"] }); setMachineName(""); setMachineOpcua(""); },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Organization</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Sites */}
        <Card>
          <CardHeader><CardTitle>Sites</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input placeholder="Site name" value={siteName} onChange={(e) => setSiteName(e.target.value)} />
              <Input placeholder="Timezone" value={siteTz} onChange={(e) => setSiteTz(e.target.value)} className="w-28" />
              <Button size="sm" onClick={() => createSite.mutate()} disabled={!siteName}><Plus className="h-4 w-4" /></Button>
            </div>
            <div className="space-y-1">
              {sites.map((s) => (
                <div key={s.id} className="flex items-center justify-between py-1 px-2 rounded hover:bg-muted/50 text-sm">
                  <span>{s.name} <span className="text-muted-foreground text-xs">({s.timezone})</span></span>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => sitesApi.delete(s.id).then(() => qc.invalidateQueries({ queryKey: ["sites"] }))}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Areas */}
        <Card>
          <CardHeader><CardTitle>Areas</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <select className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm w-32"
                value={areaSiteId} onChange={(e) => setAreaSiteId(e.target.value ? Number(e.target.value) : "")}>
                <option value="">Site</option>
                {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <Input placeholder="Area name" value={areaName} onChange={(e) => setAreaName(e.target.value)} />
              <Button size="sm" onClick={() => createArea.mutate()} disabled={!areaSiteId || !areaName}><Plus className="h-4 w-4" /></Button>
            </div>
            <div className="space-y-1">
              {areas.map((a) => (
                <div key={a.id} className="flex items-center justify-between py-1 px-2 rounded hover:bg-muted/50 text-sm">
                  <span className="flex items-center gap-1">
                    <span className="text-muted-foreground text-xs">{sites.find((s) => s.id === a.site_id)?.name}</span>
                    <ChevronRight className="h-3 w-3" />
                    {a.name}
                  </span>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => areasApi.delete(a.id).then(() => qc.invalidateQueries({ queryKey: ["areas"] }))}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Lines */}
        <Card>
          <CardHeader><CardTitle>Lines</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <select className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm w-32"
                value={lineAreaId} onChange={(e) => setLineAreaId(e.target.value ? Number(e.target.value) : "")}>
                <option value="">Area</option>
                {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <Input placeholder="Line name" value={lineName} onChange={(e) => setLineName(e.target.value)} />
              <Button size="sm" onClick={() => createLine.mutate()} disabled={!lineAreaId || !lineName}><Plus className="h-4 w-4" /></Button>
            </div>
            <div className="space-y-1">
              {lines.map((l) => (
                <div key={l.id} className="flex items-center justify-between py-1 px-2 rounded hover:bg-muted/50 text-sm">
                  <span>{l.name}</span>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => linesApi.delete(l.id).then(() => qc.invalidateQueries({ queryKey: ["lines"] }))}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Machines */}
        <Card>
          <CardHeader><CardTitle>Machines</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2 flex-wrap">
              <select className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm w-28"
                value={machineLineId} onChange={(e) => setMachineLineId(e.target.value ? Number(e.target.value) : "")}>
                <option value="">Line</option>
                {lines.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
              <Input placeholder="Machine name" value={machineName} onChange={(e) => setMachineName(e.target.value)} className="flex-1 min-w-24" />
              <Input placeholder="OPC-UA Node ID" value={machineOpcua} onChange={(e) => setMachineOpcua(e.target.value)} className="flex-1 min-w-24" />
              <Button size="sm" onClick={() => createMachine.mutate()} disabled={!machineLineId || !machineName}><Plus className="h-4 w-4" /></Button>
            </div>
            <div className="space-y-1">
              {machines.map((m) => (
                <div key={m.id} className="flex items-center justify-between py-1 px-2 rounded hover:bg-muted/50 text-sm">
                  <div>
                    <span>{m.name}</span>
                    {m.opcua_node_id && <span className="text-xs text-muted-foreground ml-2">{m.opcua_node_id}</span>}
                  </div>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => machinesApi.delete(m.id).then(() => qc.invalidateQueries({ queryKey: ["machines"] }))}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
