import { Outlet } from "react-router-dom";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import DashboardTopbar from "@/components/dashboard/DashboardTopbar";

const DashboardLayout = () => (
  <div className="flex h-screen min-h-0 w-full max-w-full overflow-x-hidden bg-background">
    <style>{`
      @keyframes sidebarEntry {
        from { opacity: 0; transform: translateX(-100%); }
        to { opacity: 1; transform: translateX(0); }
      }
      @keyframes topbarEntry {
        from { opacity: 0; transform: translateY(-20px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `}</style>
    <div className="hidden h-full min-h-0 shrink-0 md:block" style={{ animation: "sidebarEntry 0.9s cubic-bezier(0.16,1,0.3,1) 0.3s both" }}>
      <DashboardSidebar />
    </div>
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div style={{ animation: "topbarEntry 0.8s cubic-bezier(0.16,1,0.3,1) 0.5s both" }}>
        <DashboardTopbar />
      </div>
      <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-8">
        <Outlet />
      </main>
    </div>
  </div>
);

export default DashboardLayout;
