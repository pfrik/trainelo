import { Outlet } from "react-router-dom";
import { MobileHeader } from "@/components/navigation/MobileHeader";
import { MobileBottomNav } from "@/components/navigation/MobileBottomNav";
import { DesktopSidebar } from "@/components/navigation/DesktopSidebar";

export function AppLayout() {
  return (
    <div className="flex min-h-screen w-full bg-background">
      <DesktopSidebar />
      <div className="flex flex-col flex-1 min-h-screen">
        <MobileHeader />
        <main className="flex-1 pb-16 md:pb-0">
          <Outlet />
        </main>
        <MobileBottomNav />
      </div>
    </div>
  );
}
