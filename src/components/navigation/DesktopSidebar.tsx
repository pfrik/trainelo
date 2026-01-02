import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Zap,
  LayoutDashboard,
  ClipboardList,
  Dumbbell,
  TrendingUp,
  Activity,
  Brain,
  Target
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/training-plan", label: "Training Plan", icon: ClipboardList },
  { to: "/workouts", label: "Workouts", icon: Dumbbell },
  { to: "/progress", label: "Progress", icon: TrendingUp },
  { to: "/recovery", label: "Recovery", icon: Activity },
];

const insightItems = [
  { to: "/ai-coach", label: "AI Coach", icon: Brain },
  { to: "/goals", label: "Goals", icon: Target },
];

export function DesktopSidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col h-screen border-r border-gray-200 bg-white transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div className="flex items-center justify-between h-14 px-4 border-b border-gray-200">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-700 rounded-full flex items-center justify-center">
              <span className="text-white font-semibold text-sm">T</span>
            </div>
            <h1 className="text-lg font-semibold text-gray-900">Trainelo</h1>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="text-gray-600 hover:bg-gray-100 ml-auto"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      <nav className="flex-1 py-4 overflow-y-auto">
        <div className="space-y-6">
          {/* Main Navigation */}
          <ul className="space-y-1 px-2">
            {navItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors",
                      isActive
                        ? "bg-emerald-50 text-emerald-700"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    )
                  }
                >
                  <item.icon className="h-5 w-5 flex-shrink-0" />
                  {!collapsed && (
                    <span className="text-sm font-medium">{item.label}</span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>

          {/* Insights Section */}
          {!collapsed && (
            <div className="px-4">
              <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                Insights
              </h3>
              <ul className="space-y-1">
                {insightItems.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors",
                          isActive
                            ? "bg-emerald-50 text-emerald-700"
                            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                        )
                      }
                    >
                      <item.icon className="h-5 w-5 flex-shrink-0" />
                      <span className="text-sm font-medium">{item.label}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </nav>
    </aside>
  );
}
