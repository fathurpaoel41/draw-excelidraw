import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const excalidrawProdEntry = new URL(
  "./node_modules/@excalidraw/excalidraw/dist/prod/index.js",
  import.meta.url,
).pathname;

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: [
        {
          find: /^@excalidraw\/excalidraw$/,
          replacement: excalidrawProdEntry,
        },
      ],
    },
    define: {
      "process.env.IS_PREACT": JSON.stringify("false"),
    },
    server: {
      port: 5001,
      proxy: {
        "/api": {
          target: env.VITE_API_TARGET || "http://localhost:6000",
          changeOrigin: true,
        },
      },
    },
  };
});
