import react from "@vitejs/plugin-react";
import { build } from "vite";

await build({
  configFile: false,
  cacheDir: ".vite-cache",
  plugins: [react()],
  server: {
    port: 5173,
  },
});
