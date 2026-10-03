/**
 * Each folder of src/ is a deep module: other code reaches it only through its index.ts.
 * The module graph is one-way: entry → host, config, quota, agent, statusline; agent → config,
 * statusline; statusline → segments; config → segments; segments → types of host and quota.
 */
const forbidModule = (from, to) => ({
  name: `${from}-not-to-${to.replace(/\|/g, "-")}`,
  severity: "error",
  from: { path: `^src/${from}/` },
  to: { path: `^src/(${to})/` },
});

module.exports = {
  forbidden: [
    { name: "no-circular", severity: "error", from: {}, to: { circular: true } },
    {
      name: "deep-module-from-module",
      comment: "A module imports another module only through its index.ts.",
      severity: "error",
      from: { path: "^src/([^/]+)/" },
      to: { path: "^src/[^/]+/", pathNot: ["^src/$1/", "^src/[^/]+/index\\.ts$"] },
    },
    {
      name: "deep-module-from-entry",
      comment: "The entry imports each module only through its index.ts.",
      severity: "error",
      from: { path: "^src/[^/]+\\.ts$" },
      to: { path: "^src/[^/]+/", pathNot: "^src/[^/]+/index\\.ts$" },
    },
    {
      name: "modules-not-to-entry",
      severity: "error",
      from: { path: "^src/[^/]+/" },
      to: { path: "^src/[^/]+\\.ts$" },
    },
    forbidModule("segments", "statusline|config|agent"),
    forbidModule("statusline", "config|agent|quota"),
    forbidModule("config", "statusline|agent|quota|host"),
    forbidModule("host", "segments|statusline|config|agent"),
    forbidModule("quota", "segments|statusline|config|agent|host"),
    forbidModule("agent", "quota|segments"),
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.json" },
  },
};
