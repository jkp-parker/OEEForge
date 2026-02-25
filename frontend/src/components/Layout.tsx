import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { logout } from "@/lib/auth";
import {
  Activity, BarChart3, Users, Factory, Clock, Package,
  AlertTriangle, Target, LogOut, Gauge, Shield, Eye,
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
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-gray-900 flex flex-col hidden md:flex">
        <div className="flex items-center gap-2 px-4 py-4 border-b border-gray-700">
          <Activity size={22} className="text-blue-400" />
          <div>
            <span className="text-white font-semibold text-sm leading-tight">OEEForge</span>
            <div className="text-xs text-gray-400">{isAdmin ? "Admin Portal" : "Operator Portal"}</div>
          </div>
        </div>

        <nav className="flex-1 py-4 space-y-0.5 px-2 overflow-y-auto">
          {nav.map(({ label, href, icon: Icon }) => {
            const active = location.pathname === href;
            return (
              <Link
                key={href}
                to={href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                  active
                    ? "bg-blue-600 text-white"
                    : "text-gray-300 hover:bg-gray-800 hover:text-white"
                )}
              >
                <Icon size={16} className="shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="px-4 py-3 border-t border-gray-700">
          <div className="text-xs text-gray-400 mb-2">{user?.email}</div>
          <button
            onClick={handleLogout}
            className="btn-ghost w-full justify-start text-gray-300 hover:text-white text-xs"
          >
            <LogOut size={14} />
            Sign out
          </button>
          <div className="mt-2 text-xs text-gray-500">OEEForge · OEE Platform</div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
