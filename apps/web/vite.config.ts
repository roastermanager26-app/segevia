import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Declaración para tipar process.env sin requerir dependencias de Node en el cliente
declare const process: { env?: Record<string, string | undefined> };

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // En Vercel busca en la raíz de apps/web; en monorepo local busca dos niveles arriba
  envDir: typeof process !== "undefined" && process?.env?.VERCEL ? "." : "../../",
  server: { port: 5173 },
});
