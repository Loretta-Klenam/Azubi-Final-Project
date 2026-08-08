import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  // amazon-cognito-identity-js expects Node's `global`; polyfill it for the browser
  define: {
    global: "globalThis",
  },
  server: {
    port: 5173,
  },
});
