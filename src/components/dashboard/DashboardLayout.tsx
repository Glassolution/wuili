import { Outlet } from "react-router-dom";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import DashboardTopbar from "@/components/dashboard/DashboardTopbar";

const DashboardLayout = () => (
  <div className="min-h-screen bg-muted">
    <DashboardSidebar />
    <div className="md:ml-56 flex flex-col min-h-screen">
      <DashboardTopbar />
      <main className="flex-1 p-4 md:p-8">
        <Outlet />
      </main>
    </div>
  </div>
);

export default DashboardLayout;
