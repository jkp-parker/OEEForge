import { useQuery } from "@tanstack/react-query";
import { machinesApi, oeeMetricsApi } from "@/lib/api";
import { OEEGauge } from "@/components/OEEGauge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { pct } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

export default function AdminDashboard() {
  const { data: machines = [] } = useQuery({
    queryKey: ["machines"],
    queryFn: () => machinesApi.list().then((r) => r.data),
  });

  const machineIds = machines.map((m) => String(m.id));

  const { data: oeeData = [] } = useQuery({
    queryKey: ["oee-metrics", "oee"],
    queryFn: () => oeeMetricsApi.oee({ limit: 200 }).then((r) => r.data),
    refetchInterval: 60_000,
  });

  // Latest metric per machine
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
      <h1 className="text-2xl font-bold">OEE Dashboard</h1>

      {/* Per-machine gauges */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {machines.map((machine) => {
          const metric = latestByMachine[String(machine.id)];
          return (
            <Card key={machine.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{machine.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2">
                  <OEEGauge label="OEE" value={metric?.oee} size="sm" />
                  <OEEGauge label="Avail" value={metric?.availability} size="sm" />
                  <OEEGauge label="Perf" value={metric?.performance} size="sm" />
                  <OEEGauge label="Qual" value={metric?.quality} size="sm" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Bar chart comparison */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>OEE Component Comparison (Latest)</CardTitle>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      )}
    </div>
  );
}
