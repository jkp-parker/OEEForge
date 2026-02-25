import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { sitesApi, areasApi, linesApi, machinesApi } from "@/lib/api";
import { Plus, Trash2, ChevronRight } from "lucide-react";

export default function AdminOrganization() {
  const qc = useQueryClient();
  const { data: sites = [] } = useQuery({ queryKey: ["sites"], queryFn: () => sitesApi.list().then((r) => r.data) });
  const { data: areas = [] } = useQuery({ queryKey: ["areas"], queryFn: () => areasApi.list().then((r) => r.data) });
  const { data: lines = [] } = useQuery({ queryKey: ["lines"], queryFn: () => linesApi.list().then((r) => r.data) });
  const { data: machines = [] } = useQuery({ queryKey: ["machines"], queryFn: () => machinesApi.list().then((r) => r.data) });

  const [siteName, setSiteName] = useState("");
  const [siteTz, setSiteTz] = useState("UTC");
  const createSite = useMutation({
    mutationFn: () => sitesApi.create({ name: siteName, timezone: siteTz }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sites"] }); setSiteName(""); },
  });

  const [areaSiteId, setAreaSiteId] = useState<number | "">("");
  const [areaName, setAreaName] = useState("");
  const createArea = useMutation({
    mutationFn: () => areasApi.create({ site_id: Number(areaSiteId), name: areaName }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["areas"] }); setAreaName(""); },
  });

  const [lineAreaId, setLineAreaId] = useState<number | "">("");
  const [lineName, setLineName] = useState("");
  const createLine = useMutation({
    mutationFn: () => linesApi.create({ area_id: Number(lineAreaId), name: lineName }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["lines"] }); setLineName(""); },
  });

  const [machineLineId, setMachineLineId] = useState<number | "">("");
  const [machineName, setMachineName] = useState("");
  const [machineOpcua, setMachineOpcua] = useState("");
  const createMachine = useMutation({
    mutationFn: () => machinesApi.create({ line_id: Number(machineLineId), name: machineName, opcua_node_id: machineOpcua || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["machines"] }); setMachineName(""); setMachineOpcua(""); },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Organization</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Sites */}
        <div className="card">
          <div className="px-6 pt-6 pb-4"><h3 className="text-base font-semibold text-gray-900">Sites</h3></div>
          <div className="px-6 pb-6 space-y-3">
            <div className="flex gap-2">
              <input className="input flex-1" placeholder="Site name" value={siteName} onChange={(e) => setSiteName(e.target.value)} />
              <input className="input w-28" placeholder="Timezone" value={siteTz} onChange={(e) => setSiteTz(e.target.value)} />
              <button className="btn-primary px-2" onClick={() => createSite.mutate()} disabled={!siteName}><Plus className="h-4 w-4" /></button>
            </div>
            <div className="space-y-1">
              {sites.map((s) => (
                <div key={s.id} className="flex items-center justify-between py-1 px-2 rounded hover:bg-gray-50 text-sm">
                  <span>{s.name} <span className="text-gray-400 text-xs">({s.timezone})</span></span>
                  <button className="btn-ghost p-1" onClick={() => sitesApi.delete(s.id).then(() => qc.invalidateQueries({ queryKey: ["sites"] }))}>
                    <Trash2 className="h-3 w-3 text-red-500" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Areas */}
        <div className="card">
          <div className="px-6 pt-6 pb-4"><h3 className="text-base font-semibold text-gray-900">Areas</h3></div>
          <div className="px-6 pb-6 space-y-3">
            <div className="flex gap-2">
              <select className="input w-32" value={areaSiteId} onChange={(e) => setAreaSiteId(e.target.value ? Number(e.target.value) : "")}>
                <option value="">Site</option>
                {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <input className="input flex-1" placeholder="Area name" value={areaName} onChange={(e) => setAreaName(e.target.value)} />
              <button className="btn-primary px-2" onClick={() => createArea.mutate()} disabled={!areaSiteId || !areaName}><Plus className="h-4 w-4" /></button>
            </div>
            <div className="space-y-1">
              {areas.map((a) => (
                <div key={a.id} className="flex items-center justify-between py-1 px-2 rounded hover:bg-gray-50 text-sm">
                  <span className="flex items-center gap-1">
                    <span className="text-gray-400 text-xs">{sites.find((s) => s.id === a.site_id)?.name}</span>
                    <ChevronRight className="h-3 w-3" />
                    {a.name}
                  </span>
                  <button className="btn-ghost p-1" onClick={() => areasApi.delete(a.id).then(() => qc.invalidateQueries({ queryKey: ["areas"] }))}>
                    <Trash2 className="h-3 w-3 text-red-500" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Lines */}
        <div className="card">
          <div className="px-6 pt-6 pb-4"><h3 className="text-base font-semibold text-gray-900">Lines</h3></div>
          <div className="px-6 pb-6 space-y-3">
            <div className="flex gap-2">
              <select className="input w-32" value={lineAreaId} onChange={(e) => setLineAreaId(e.target.value ? Number(e.target.value) : "")}>
                <option value="">Area</option>
                {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <input className="input flex-1" placeholder="Line name" value={lineName} onChange={(e) => setLineName(e.target.value)} />
              <button className="btn-primary px-2" onClick={() => createLine.mutate()} disabled={!lineAreaId || !lineName}><Plus className="h-4 w-4" /></button>
            </div>
            <div className="space-y-1">
              {lines.map((l) => (
                <div key={l.id} className="flex items-center justify-between py-1 px-2 rounded hover:bg-gray-50 text-sm">
                  <span>{l.name}</span>
                  <button className="btn-ghost p-1" onClick={() => linesApi.delete(l.id).then(() => qc.invalidateQueries({ queryKey: ["lines"] }))}>
                    <Trash2 className="h-3 w-3 text-red-500" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Machines */}
        <div className="card">
          <div className="px-6 pt-6 pb-4"><h3 className="text-base font-semibold text-gray-900">Machines</h3></div>
          <div className="px-6 pb-6 space-y-3">
            <div className="flex gap-2 flex-wrap">
              <select className="input w-28" value={machineLineId} onChange={(e) => setMachineLineId(e.target.value ? Number(e.target.value) : "")}>
                <option value="">Line</option>
                {lines.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
              <input className="input flex-1 min-w-24" placeholder="Machine name" value={machineName} onChange={(e) => setMachineName(e.target.value)} />
              <input className="input flex-1 min-w-24" placeholder="OPC-UA Node ID" value={machineOpcua} onChange={(e) => setMachineOpcua(e.target.value)} />
              <button className="btn-primary px-2" onClick={() => createMachine.mutate()} disabled={!machineLineId || !machineName}><Plus className="h-4 w-4" /></button>
            </div>
            <div className="space-y-1">
              {machines.map((m) => (
                <div key={m.id} className="flex items-center justify-between py-1 px-2 rounded hover:bg-gray-50 text-sm">
                  <div>
                    <span>{m.name}</span>
                    {m.opcua_node_id && <span className="text-xs text-gray-400 ml-2">{m.opcua_node_id}</span>}
                  </div>
                  <button className="btn-ghost p-1" onClick={() => machinesApi.delete(m.id).then(() => qc.invalidateQueries({ queryKey: ["machines"] }))}>
                    <Trash2 className="h-3 w-3 text-red-500" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
