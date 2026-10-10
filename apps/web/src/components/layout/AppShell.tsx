import { Outlet } from "react-router";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { AppCopyright } from "../AppCopyright";

export function AppShell() {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="pl-64">
        <Topbar />
        <main className="min-h-screen w-full pt-16">
          <div className="flex w-full flex-col gap-space-xl px-margin py-space-lg">
            <Outlet />
            <footer className="mt-space-xl border-t border-hairline pt-space-lg text-center">
              <AppCopyright />
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}
