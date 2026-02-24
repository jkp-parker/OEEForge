import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { logout } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Activity, Settings, Users, Factory, Clock, Package,
  AlertTriangle, Target, LogOut, BarChart3, Gauge,
  Shield, Wrench, Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";

const adminNav = [
  { label: "Dashboard", href: "/admin", icon: BarChart3 },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Organization", href: "/admin/organization", icon: Factory },
  { label: "Shift Schedules", href: "/admin/shifts", icon: Clock },
  { label: "Products", href: "/admin/products", icon: Package },
  { label: "Downtime Codes", href: "/admin/downtime-codes", icon: AlertTriangle },
  { label: "OEE Targets", href: "/admin/oee-targets", icon: Target },
  { label: "Availability", href: "/admin/availability-config", icon: Shield },
  { label: "Performance", href: "/admin/performance-config", icon: Gauge },
  { label: "Quality", href: "/admin/quality-config", icon: Eye },
];

const operatorNav = [
  { label: "Dashboard", href: "/operator", icon: BarChart3 },
  { label: "Log Downtime", href: "/operator/downtime", icon: AlertTriangle },
  { label: "Log Rejects", href: "/operator/rejects", icon: Package },
];

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user, isAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const nav = isAdmin ? adminNav : operatorNav;

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col hidden md:flex">
        <div className="p-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Activity className="h-6 w-6 text-blue-400" />
            <span className="font-bold text-lg">OEEForge</span>
          </div>
          <div className="mt-1 text-xs text-slate-400">
            {isAdmin ? "Admin Portal" : "Operator Portal"}
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {nav.map(({ label, href, icon: Icon }) => {
            const active = location.pathname === href;
            return (
              <Link
                key={href}
                to={href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  active
                    ? "bg-blue-600 text-white"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-700">
          <div className="text-xs text-slate-400 mb-2">{user?.email}</div>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="w-full text-slate-300 hover:text-white">
            <LogOut className="h-4 w-4 mr-2" />
            Sign out
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="p-4 md:p-6">{children}</div>
      </main>
    </div>
  );
}
