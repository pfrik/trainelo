import { useNavigate, useLocation } from "react-router-dom";
import { useProfile } from "@/hooks/useProfile";

const NAV_ITEMS = [
  { path: "/dashboard", icon: "dashboard", label: "Dashboard" },
  { path: "/goals", icon: "flag", label: "Goals" },
  { path: "/calendar", icon: "calendar_month", label: "Calendar" },
];

export function AppSidebar() {
  const { displayName } = useProfile();
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <aside className="w-64 bg-light-surface dark:bg-dark-base border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between flex-shrink-0 z-20 hidden lg:flex">
      <div className="p-6">
        {/* User Profile */}
        <div className="flex items-center space-x-3 mb-8">
          <div className="relative">
            <div className="w-12 h-12 rounded-full bg-slate-200 border-2 border-primary overflow-hidden">
              <img
                alt={displayName}
                className="w-full h-full object-cover"
                src="https://i.pravatar.cc/150?img=9"
              />
            </div>
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-light-surface dark:border-dark-base rounded-full"></div>
          </div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white">{displayName}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Pro Plan Member</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="space-y-2">
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all w-full group ${
                  isActive
                    ? "bg-primary text-white shadow-lg shadow-green-500/20"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-dark-surface"
                }`}
              >
                <span
                  className={`material-symbols-outlined ${!isActive && "group-hover:text-primary transition-colors"}`}
                  style={{ fontVariationSettings: '"FILL" 1' }}
                >
                  {item.icon}
                </span>
                <span className="font-medium">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="p-6 border-t border-slate-200 dark:border-slate-800">
        <button
          onClick={() => navigate("/settings")}
          className="flex items-center space-x-3 text-slate-600 dark:text-slate-400 hover:text-primary dark:hover:text-primary transition-colors w-full"
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: '"FILL" 1' }}>settings</span>
          <span className="font-medium">Settings</span>
        </button>
      </div>
    </aside>
  );
}
