import react from "@vitejs/plugin-react";
import { createServer } from "vite";

function readArg(flag, fallback) {
  const index = process.argv.indexOf(flag);
  if (index >= 0 && process.argv[index + 1]) {
    return process.argv[index + 1];
  }
  return fallback;
}

const host = readArg("--host", "127.0.0.1");
const port = Number(readArg("--port", "5173"));

const server = await createServer({
  configFile: false,
  cacheDir: ".vite-cache",
  plugins: [react()],
  server: {
    host,
    port,
  },
});

await server.listen();
server.printUrls();
