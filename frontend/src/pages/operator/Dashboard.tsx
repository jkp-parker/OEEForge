import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { machinesApi, oeeMetricsApi, oeeTargetsApi, shiftInstancesApi, type OEEMetric } from "@/lib/api";
import { OEEGauge } from "@/components/OEEGauge";
import { pct, oeeColor } from "@/lib/utils";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export default function OperatorDashboard() {
  const { user } = useAuth();

  const { data: machines = [] } = useQuery({
    queryKey: ["machines", user?.line_id],
    queryFn: () => machinesApi.list(user?.line_id ?? undefined).then((r) => r.data),
    enabled: !!user,
  });

  const { data: targets = [] } = useQuery({
    queryKey: ["oee-targets"],
    queryFn: () => oeeTargetsApi.list().then((r) => r.data),
  });

  const machineIds = machines.map((m) => String(m.id));

  const { data: oeeHistory = [] } = useQuery({
    queryKey: ["oee-metrics", "oee", machineIds],
    queryFn: () => oeeMetricsApi.oee({ limit: 100 }).then((r) => r.data),
    enabled: machineIds.length > 0,
    refetchInterval: 60_000,
  });

  const latestByMachine: Record<string, OEEMetric> = {};
  for (const row of oeeHistory) {
    if (row.machine_id && !latestByMachine[row.machine_id]) {
      latestByMachine[row.machine_id] = row;
    }
  }

  const chartData = oeeHistory
    .filter((r) => machines.length === 0 || machineIds.includes(r.machine_id ?? ""))
    .slice(0, 50)
    .reverse()
    .map((r) => ({
      time: r.time ? new Date(r.time).toLocaleTimeString() : "",
      OEE: r.oee != null ? +(r.oee * 100).toFixed(1) : null,
      Availability: r.availability != null ? +(r.availability * 100).toFixed(1) : null,
      Performance: r.performance != null ? +(r.performance * 100).toFixed(1) : null,
      Quality: r.quality != null ? +(r.quality * 100).toFixed(1) : null,
    }));

  const { data: currentShift } = useQuery({
    queryKey: ["shift-instances", "current", machines[0]?.id],
    queryFn: () =>
      machines[0]
        ? shiftInstancesApi.list(machines[0].id).then((r) => r.data[0])
        : Promise.resolve(undefined),
    enabled: machines.length > 0,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Shift OEE Summary</h1>
        {currentShift && (
          <span className={currentShift.is_confirmed ? "badge-green" : "badge-yellow"}>
            {currentShift.is_confirmed ? "Shift Confirmed" : "Shift Active"}
          </span>
        )}
      </div>

      {/* Machine gauges */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {machines.map((machine) => {
          const metric = latestByMachine[String(machine.id)];
          const target = targets.find((t) => t.machine_id === machine.id);
          return (
            <div key={machine.id} className="card">
              <div className="px-6 pt-6 pb-4">
                <h3 className="text-base font-semibold text-gray-900">{machine.name}</h3>
              </div>
              <div className="px-6 pb-6">
                <div className="grid grid-cols-4 gap-4">
                  <OEEGauge label="OEE" value={metric?.oee} target={target?.oee_target} size="md" />
                  <OEEGauge label="Availability" value={metric?.availability} target={target?.availability_target} size="md" />
                  <OEEGauge label="Performance" value={metric?.performance} target={target?.performance_target} size="md" />
                  <OEEGauge label="Quality" value={metric?.quality} target={target?.quality_target} size="md" />
                </div>
                {metric && (
                  <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-gray-500">
                    <div>Parts: <strong>{metric.total_parts ?? "—"}</strong></div>
                    <div>Good: <strong>{metric.good_parts ?? "—"}</strong></div>
                    <div>Reject: <strong>{metric.reject_parts ?? "—"}</strong></div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Trend chart */}
      {chartData.length > 1 && (
        <div className="card">
          <div className="px-6 pt-6 pb-4">
            <h3 className="text-base font-semibold text-gray-900">OEE Trend (Current Shift)</h3>
          </div>
          <div className="px-6 pb-6">
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} unit="%" />
                <Tooltip formatter={(v) => `${v}%`} />
                <Line type="monotone" dataKey="OEE" stroke="#6366f1" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Availability" stroke="#3b82f6" strokeWidth={1} dot={false} />
                <Line type="monotone" dataKey="Performance" stroke="#10b981" strokeWidth={1} dot={false} />
                <Line type="monotone" dataKey="Quality" stroke="#f59e0b" strokeWidth={1} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
