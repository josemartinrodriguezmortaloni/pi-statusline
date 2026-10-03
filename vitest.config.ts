import { defineConfig } from "vitest/config";

export default defineConfig({
  // Reset dates follow the system locale; tests pin it and the time zone so their text does not depend on the machine.
  test: { include: ["test/**/*.test.ts"], env: { LC_ALL: "", LANG: "es_AR.UTF-8", TZ: "UTC" } },
});
