import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import PrivateRoute from "@/components/PrivateRoute";
import Layout from "@/components/Layout";

import Login from "@/pages/Login";

// Admin pages
import AdminDashboard from "@/pages/admin/Dashboard";
import AdminUsers from "@/pages/admin/Users";
import AdminOrganization from "@/pages/admin/Organization";
import AdminShifts from "@/pages/admin/ShiftSchedules";
import AdminProducts from "@/pages/admin/Products";
import AdminDowntimeCodes from "@/pages/admin/DowntimeCodes";
import AdminOEETargets from "@/pages/admin/OEETargets";
import AdminAvailabilityConfig from "@/pages/admin/AvailabilityConfig";
import AdminPerformanceConfig from "@/pages/admin/PerformanceConfig";
import AdminQualityConfig from "@/pages/admin/QualityConfig";
import AdminTagConfigs from "@/pages/admin/TagConfigs";
import AdminSystem from "@/pages/admin/SystemAdmin";

// Operator pages
import OperatorDashboard from "@/pages/operator/Dashboard";
import OperatorDowntime from "@/pages/operator/DowntimeLog";
import OperatorRejects from "@/pages/operator/RejectLog";
import OperatorPerformance from "@/pages/operator/PerformanceLog";

function RootRedirect() {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === "admin" ? "/admin" : "/operator"} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<RootRedirect />} />

        {/* Admin portal */}
        <Route
          path="/admin/*"
          element={
            <PrivateRoute requireRole="admin">
              <Layout>
                <Routes>
                  <Route index element={<AdminDashboard />} />
                  <Route path="users" element={<AdminUsers />} />
                  <Route path="organization" element={<AdminOrganization />} />
                  <Route path="shifts" element={<AdminShifts />} />
                  <Route path="products" element={<AdminProducts />} />
                  <Route path="downtime-codes" element={<AdminDowntimeCodes />} />
                  <Route path="oee-targets" element={<AdminOEETargets />} />
                  <Route path="availability-config" element={<AdminAvailabilityConfig />} />
                  <Route path="performance-config" element={<AdminPerformanceConfig />} />
                  <Route path="quality-config" element={<AdminQualityConfig />} />
                  <Route path="tag-configs" element={<AdminTagConfigs />} />
                  <Route path="system" element={<AdminSystem />} />
                  {/* Operator pages accessible to admins */}
                  <Route path="operator" element={<OperatorDashboard />} />
                  <Route path="operator/downtime" element={<OperatorDowntime />} />
                  <Route path="operator/rejects" element={<OperatorRejects />} />
                  <Route path="operator/performance" element={<OperatorPerformance />} />
                </Routes>
              </Layout>
            </PrivateRoute>
          }
        />

        {/* Operator portal */}
        <Route
          path="/operator/*"
          element={
            <PrivateRoute requireRole="operator">
              <Layout>
                <Routes>
                  <Route index element={<OperatorDashboard />} />
                  <Route path="downtime" element={<OperatorDowntime />} />
                  <Route path="rejects" element={<OperatorRejects />} />
                  <Route path="performance" element={<OperatorPerformance />} />
                </Routes>
              </Layout>
            </PrivateRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
