import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFile } from "node:fs/promises";
export default defineConfig({
  base: "./",
  plugins: [
    react(),
    {
      name: "serve-runtime-manifest-in-development",
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (req.url?.split("?")[0] !== "/imd-deployment.json") return next();
          try {
            const content = await readFile(
              new URL("../dist/imd-deployment.json", import.meta.url),
            );
            res.setHeader("Content-Type", "application/json");
            res.end(content);
          } catch {
            res.statusCode = 503;
            res.end("Build the static export first.");
          }
        });
      },
    },
  ],
  build: { outDir: "../dist", emptyOutDir: true, chunkSizeWarningLimit: 1500 },
});
