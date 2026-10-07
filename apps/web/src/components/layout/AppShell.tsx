import { Outlet } from "react-router";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function AppShell() {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="pl-64">
        <Topbar />
        <main className="min-h-screen w-full pt-16">
          <div className="flex w-full flex-col gap-space-xl px-margin py-space-lg">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
