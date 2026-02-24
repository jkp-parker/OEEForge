import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { isAuthenticated } from "@/lib/auth";

interface PrivateRouteProps {
  children: React.ReactNode;
  requireRole?: "admin" | "operator";
}

export default function PrivateRoute({ children, requireRole }: PrivateRouteProps) {
  const { user, isLoading } = useAuth();

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requireRole && user.role !== requireRole) {
    return <Navigate to={user.role === "admin" ? "/admin" : "/operator"} replace />;
  }

  return <>{children}</>;
}
