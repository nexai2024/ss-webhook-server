import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    include: ["app/**/*.spec.ts", "app/**/*.spec.tsx"],
    exclude: ["node_modules", "tests/**/*"],
  },
});
