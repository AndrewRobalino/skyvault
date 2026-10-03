import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Run every test in a non-UTC zone with DST. CI machines default to UTC,
// where "local" and "UTC" bugs are invisible (the UTC-toggle bug was one).
process.env.TZ = "America/New_York";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/__tests__/setup.js"],
    css: false,
    passWithNoTests: true,
  },
});
