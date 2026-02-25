import { useQuery } from "@tanstack/react-query";
import { machinesApi, oeeMetricsApi } from "@/lib/api";
import { OEEGauge } from "@/components/OEEGauge";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

export default function AdminDashboard() {
  const { data: machines = [] } = useQuery({
    queryKey: ["machines"],
    queryFn: () => machinesApi.list().then((r) => r.data),
  });

  const { data: oeeData = [] } = useQuery({
    queryKey: ["oee-metrics", "oee"],
    queryFn: () => oeeMetricsApi.oee({ limit: 200 }).then((r) => r.data),
    refetchInterval: 60_000,
  });

  const latestByMachine: Record<string, typeof oeeData[0]> = {};
  for (const row of oeeData) {
    const mid = row.machine_id ?? "";
    if (!latestByMachine[mid]) latestByMachine[mid] = row;
  }

  const chartData = Object.entries(latestByMachine).map(([mid, row]) => {
    const machine = machines.find((m) => String(m.id) === mid);
    return {
      name: machine?.name ?? mid,
      Availability: row.availability ? +(row.availability * 100).toFixed(1) : 0,
      Performance: row.performance ? +(row.performance * 100).toFixed(1) : 0,
      Quality: row.quality ? +(row.quality * 100).toFixed(1) : 0,
      OEE: row.oee ? +(row.oee * 100).toFixed(1) : 0,
    };
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">OEE Dashboard</h1>

      {/* Per-machine gauges */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {machines.map((machine) => {
          const metric = latestByMachine[String(machine.id)];
          return (
            <div key={machine.id} className="card">
              <div className="px-4 pt-4 pb-2">
                <h3 className="text-sm font-semibold text-gray-900">{machine.name}</h3>
              </div>
              <div className="px-4 pb-4">
                <div className="grid grid-cols-2 gap-2">
                  <OEEGauge label="OEE" value={metric?.oee} size="sm" />
                  <OEEGauge label="Avail" value={metric?.availability} size="sm" />
                  <OEEGauge label="Perf" value={metric?.performance} size="sm" />
                  <OEEGauge label="Qual" value={metric?.quality} size="sm" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bar chart comparison */}
      {chartData.length > 0 && (
        <div className="card">
          <div className="px-6 pt-6 pb-4">
            <h3 className="text-base font-semibold text-gray-900">OEE Component Comparison (Latest)</h3>
          </div>
          <div className="px-6 pb-6">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis domain={[0, 100]} unit="%" />
                <Tooltip formatter={(v) => `${v}%`} />
                <Legend />
                <Bar dataKey="Availability" fill="#3b82f6" />
                <Bar dataKey="Performance" fill="#10b981" />
                <Bar dataKey="Quality" fill="#f59e0b" />
                <Bar dataKey="OEE" fill="#6366f1" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
