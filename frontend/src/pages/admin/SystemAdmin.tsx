import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { systemApi, type ServiceStatus } from "@/lib/api";
import { RefreshCw, Database, ChevronDown, ChevronRight, ExternalLink } from "lucide-react";

// ── Status helpers ───────────────────────────────────────────────────────────

function StatusDot({ status }: { status: ServiceStatus["status"] }) {
  const cls =
    status === "ok"
      ? "bg-emerald-500"
      : status === "error"
      ? "bg-red-500"
      : "bg-gray-400";
  return (
    <span
      className={`inline-block w-2.5 h-2.5 rounded-full ${cls}`}
      title={status}
    />
  );
}

function statusLabel(s: ServiceStatus["status"]) {
  if (s === "ok") return "Healthy";
  if (s === "error") return "Unreachable";
  return "No health check";
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function SystemAdmin() {
  const qc = useQueryClient();
  const [output, setOutput] = useState<string | null>(null);
  const [outputExpanded, setOutputExpanded] = useState(false);

  // Service health
  const {
    data: healthData,
    isFetching: healthFetching,
    refetch: refetchHealth,
  } = useQuery({
    queryKey: ["system-health"],
    queryFn: () => systemApi.health().then((r) => r.data),
  });

  // Sample data status
  const {
    data: sampleStatus,
    isFetching: statusFetching,
  } = useQuery({
    queryKey: ["sample-data-status"],
    queryFn: () => systemApi.sampleDataStatus().then((r) => r.data),
  });

  // Load sample data
  const loadMutation = useMutation({
    mutationFn: () => systemApi.loadSampleData().then((r) => r.data),
    onSuccess: (data) => {
      setOutput(data.output);
      setOutputExpanded(true);
      qc.invalidateQueries({ queryKey: ["sample-data-status"] });
    },
  });

  // Clear sample data
  const clearMutation = useMutation({
    mutationFn: () => systemApi.clearSampleData().then((r) => r.data),
    onSuccess: (data) => {
      setOutput(data.output);
      setOutputExpanded(true);
      qc.invalidateQueries({ queryKey: ["sample-data-status"] });
    },
  });

  const services = healthData?.services ?? [];
  const isMutating = loadMutation.isPending || clearMutation.isPending;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">System Administration</h1>

      {/* ── Service Architecture ── */}
      <div className="card">
        <div className="px-6 pt-5 pb-3 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Service Architecture
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Health status of all OEEForge services
            </p>
          </div>
          <button
            className="btn-ghost p-2"
            onClick={() => refetchHealth()}
            title="Refresh health checks"
          >
            <RefreshCw
              className={`h-4 w-4 text-gray-500 ${
                healthFetching ? "animate-spin" : ""
              }`}
            />
          </button>
        </div>

        <div className="px-6 pb-5">
          {services.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {services.map((svc) => (
                <div
                  key={svc.name}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {svc.name}
                    </span>
                    <StatusDot status={svc.status} />
                  </div>
                  <p className="text-xs text-gray-500">{svc.description}</p>
                  {svc.version && (
                    <span className="text-[11px] text-gray-400 font-mono">
                      v{svc.version}
                    </span>
                  )}
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-gray-400">
                      {svc.port ? `:${svc.port}` : "\u00A0"}
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-medium ${
                          svc.status === "ok"
                            ? "text-emerald-600"
                            : svc.status === "error"
                            ? "text-red-500"
                            : "text-gray-400"
                        }`}
                      >
                        {statusLabel(svc.status)}
                      </span>
                      {svc.url && (
                        <a
                          href={`http://${window.location.hostname}:${svc.port}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:text-blue-700"
                          title={`Open ${svc.name}`}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">
              {healthFetching ? "Checking services..." : "No data available."}
            </p>
          )}
        </div>
      </div>

      {/* ── Sample Data ── */}
      <div className="card">
        <div className="px-6 pt-5 pb-3">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Sample Data
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Load or clear the WidgetCo Manufacturing demo dataset
          </p>
        </div>

        <div className="px-6 pb-5 space-y-4">
          {/* Status indicator */}
          <div className="flex items-center gap-3">
            <Database className="h-5 w-5 text-gray-400" />
            {statusFetching ? (
              <span className="text-sm text-gray-400">Checking...</span>
            ) : sampleStatus?.loaded ? (
              <span className="text-sm text-emerald-600 font-medium">
                Sample data is loaded
              </span>
            ) : (
              <span className="text-sm text-gray-500">
                No sample data loaded
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              disabled={isMutating}
              onClick={() => {
                if (!window.confirm("This will populate the database with WidgetCo Manufacturing demo data (machines, shifts, downtime events, and 7 days of OEE metrics).\n\nProceed?")) return;
                loadMutation.mutate();
              }}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loadMutation.isPending ? "Loading..." : "Load Sample Data"}
            </button>
            <button
              disabled={isMutating}
              onClick={() => {
                if (!window.confirm("This will permanently delete all WidgetCo sample data from PostgreSQL and InfluxDB.\n\nProceed?")) return;
                clearMutation.mutate();
              }}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {clearMutation.isPending
                ? "Clearing..."
                : "Clear Sample Data"}
            </button>
          </div>

          {/* Script output */}
          {output && (
            <div>
              <button
                onClick={() => setOutputExpanded(!outputExpanded)}
                className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700"
              >
                {outputExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
                Script output
              </button>
              {outputExpanded && (
                <pre className="mt-2 p-3 bg-gray-900 text-gray-200 text-xs rounded-lg overflow-x-auto max-h-64 overflow-y-auto">
                  {output}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
