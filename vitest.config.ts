import { defineConfig } from "vitest/config";

// Reset dates follow the system locale. ICU reads the locale once at process start, so the config pins it
// here, before vitest forks the test workers, together with the time zone.
process.env.LC_ALL = "es_AR.UTF-8";
process.env.LANG = "es_AR.UTF-8";
process.env.TZ = "UTC";

export default defineConfig({
  test: { include: ["test/**/*.test.ts"] },
});
