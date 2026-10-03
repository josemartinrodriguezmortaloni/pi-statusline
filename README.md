# pi-statusline

pi-statusline is a [Pi](https://github.com/earendil-works/pi) extension that replaces the Pi footer with a statusline of segments. A JSON config declares the lines, the left and right groups, the order, the priority and the color of each segment. Without a config, a preset reproduces the default Pi footer and adds the session time.

Status: 0.1.0. Pins Pi 1.0.1.

## Install

The package is not on npm. Install it from its directory, like the other local Pi packages:

1. Clone the repository and install its dependencies:

   ```sh
   bun install
   ```

2. Add the path of the repository, relative to `~/.pi/agent`, to `packages` in `~/.pi/agent/settings.json`:

   ```json
   { "packages": ["../../Work/pp/ccp/pi-statusline"] }
   ```

3. Start a new Pi session. The footer shows the preset.

To try the extension without installing it, run `pi -e ./src/index.ts` from the repository.

## Design the statusline with the agent

```text
/statusline <description>
```

The command sends the agent a request built from the segment catalog: every segment, its options, the current config and your description. The agent writes the config only through the `statusline_apply` tool. The tool validates the config, writes it and returns a preview at the terminal width; an invalid config is not written.

| Command | Effect |
| --- | --- |
| `/statusline on` | Shows the statusline and saves `enabled: true`. |
| `/statusline off` | Restores the default Pi footer and saves `enabled: false`. New sessions keep it off. |
| `/statusline reset` | Replaces the config with the preset. |

## Config

The config is global: `~/.pi/agent/statusline.json`. Pi applies a saved edit at once, without a restart. An invalid edit keeps the last valid config and notifies the path of the failing field; an invalid config at start uses the preset.

```json
{
  "enabled": true,
  "lines": [
    {
      "left": [
        { "segment": "cwd", "color": "accent", "priority": 10 },
        { "segment": "git-branch", "color": "dim" }
      ],
      "right": [{ "segment": "model", "color": "#7aa2f7", "priority": 9 }]
    },
    {
      "left": [
        { "segment": "usage", "window": "5h", "thresholds": { "warning": 80 } },
        { "segment": "status", "key": "mcp" },
        { "segment": "statuses" }
      ],
      "right": [{ "segment": "session-time" }]
    }
  ]
}
```

- `priority`: when a line does not fit, segments hide by ascending priority. A line that still does not fit truncates with `...`.
- `color`: a token of the active theme, such as `accent` or `dim`, or a `#rrggbb` hex.
- A segment with no data hides itself. A line with no visible segment is left out.

### Segments

| Segment | Shows |
| --- | --- |
| `cwd`, `git-branch`, `session-name` | Working directory, branch and session name. |
| `tokens`, `cache`, `cost`, `context` | Session tokens, prompt cache, cost and context window use. |
| `model`, `thinking` | Provider and model, and the thinking level. |
| `session-time`, `turn-time` | Time since the session started, and the duration of the current or last agent turn. |
| `status { key }`, `statuses` | The status of one extension, and the statuses of the extensions not shown by `status`. |
| `usage { provider, window, thresholds }` | Subscription quota: `5h`, `7d` or `extra`. |

`usage` reads the quota of the provider of the active model (`"provider": "active"`, the default) or of a fixed provider. It turns to warning at 50 % and to error at 90 % unless `thresholds` says otherwise. The extension polls each provider that the config needs every 60 s.

| Provider | Credential |
| --- | --- |
| `claude-acp` | `~/.claude/.credentials.json`, the login of the `claude` binary. |
| `anthropic` | The Pi login. API keys have no quota. |
| `openai-codex` | The Pi login, or `~/.codex/auth.json` when Pi has none. |

## Development

| Command | Checks |
| --- | --- |
| `bun run test` | Tests through the extension entry, with the network, the file system and the clock injected. |
| `bun run smoke` | The real quota endpoints, with the credentials of this machine. |
| `bun run typecheck`, `bun run lint`, `bun run complexity`, `bun run deps` | Types, Biome, cyclomatic complexity below 4, and module boundaries. |
