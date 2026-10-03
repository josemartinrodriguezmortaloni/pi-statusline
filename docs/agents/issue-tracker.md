# Issue tracker: Linear

Issues and specs for this repo live in Linear, workspace `bytesbricks`, team **BytesBricks** (key `BYT`), project **pi-statusline** (id `727e96d5-b46d-4b7b-b5e4-e2826fd6b594`, https://linear.app/bytesbricks/project/pi-statusline-a8b641cf6aab). Use the Pi Linear tools (`mcp__pi__linear_*` under Claude Code, `linear_*` inside Pi). Load them with `ToolSearch` before first use.

The team `BYT` also holds other projects (`SimPlantFront`, `SimPlantBack`, `SielcBack`, `pretraining`). Always scope reads and writes to project `pi-statusline`.

## Conventions

- **Create an issue**: `linear_create_issue` with `teamKey: "BYT"`, `projectId` (above), `title`, `description` (Markdown, literal newlines), `labelIds`. New issues start in state `Backlog`.
- **Read an issue**: `linear_get_issue` with the identifier (`BYT-<n>`), then `linear_list_comments` for its comments.
- **List issues**: `linear_list_issues` filtered by project, plus label / state filters.
- **Comment on an issue**: `linear_create_comment` with the issue id and `body`.
- **Apply / remove labels**: `linear_update_issue` with the issue id and `labelIds`. Labels are team-scoped to `BYT`; resolve ids with `linear_list_issue_labels`.
- **Close**: comment first, then `linear_update_issue` with the `Done` (actioned) or `Canceled` (not actioned) state id. Resolve state ids with `linear_list_issue_statuses`.
- **Blocking edges**: `linear_create_issue_relation` with type `blocks`.

Workflow states in `BYT`: `Backlog`, `Todo`, `In Progress`, `In Review`, `Done`, `Canceled`, `Duplicate`.

## Pull requests as a triage surface

**PRs as a request surface: no.** _(Set to `yes` if this repo treats external PRs as feature requests; `/triage` reads this flag.)_

The repo has no GitHub remote yet. Once it exists, link a PR to its Linear issue by putting the identifier (`BYT-<n>`) in the branch name or PR title.

## When a skill says "publish to the issue tracker"

Create a Linear issue in team `BYT`, project `pi-statusline`.

## When a skill says "fetch the relevant ticket"

Run `linear_get_issue` with `BYT-<n>`, then `linear_list_comments`.
