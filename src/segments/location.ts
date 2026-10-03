import { defineSegment } from "./segment.ts";

export const cwd = defineSegment({
  id: "cwd",
  summary: "Working directory, with the home directory shown as ~.",
  options: {},
  render: (snapshot) => ({ text: snapshot.cwd }),
});

export const gitBranch = defineSegment({
  id: "git-branch",
  summary: "Current git branch in parentheses. Hidden outside a git repository.",
  options: {},
  render: (snapshot) => (snapshot.gitBranch ? { text: `(${snapshot.gitBranch})` } : undefined),
});

export const sessionName = defineSegment({
  id: "session-name",
  summary: "Session name after a bullet. Hidden when the session has no name.",
  options: {},
  render: (snapshot) => (snapshot.sessionName ? { text: `• ${snapshot.sessionName}` } : undefined),
});
