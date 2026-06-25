import { ReactNode } from "react";
import { Sidebar } from "./redesign/Sidebar";
import { Header } from "./redesign/Header";

interface DashboardLayoutNewProps {
  children: ReactNode;
}

export function DashboardLayoutNew({ children }: DashboardLayoutNewProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <Header />
      <main className="ml-64 mt-16 p-8">
        {children}
      </main>
    </div>
  );
}
