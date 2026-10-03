import type { ThemeColor } from "@earendil-works/pi-coding-agent";
import { type TSchema, Type } from "typebox";
import type { TLocalizedValidationError } from "typebox/error";
import { Value } from "typebox/value";
import { CATALOG, type Segment } from "../segments/index.ts";
import type { Config, SegmentConfig } from "./types.ts";

export interface Issue {
  /** JSON pointer to the field that fails, as `/lines/0/left/1/color`. */
  path: string;
  message: string;
}

export type Result<T> = { ok: true; value: T } | { ok: false; issues: Issue[] };

/** Every foreground token of the pi theme. `theme.fg` throws on any other name. */
const THEME_COLORS: Record<ThemeColor, true> = {
  accent: true,
  border: true,
  borderAccent: true,
  borderMuted: true,
  success: true,
  error: true,
  warning: true,
  muted: true,
  dim: true,
  text: true,
  thinkingText: true,
  scrollbarTrack: true,
  scrollbarThumb: true,
  searchMatchText: true,
  userMessageText: true,
  customMessageText: true,
  customMessageLabel: true,
  toolTitle: true,
  toolOutput: true,
  mdHeading: true,
  mdLink: true,
  mdLinkUrl: true,
  mdCode: true,
  mdCodeBlock: true,
  mdCodeBlockBorder: true,
  mdQuote: true,
  mdQuoteBorder: true,
  mdHr: true,
  mdListBullet: true,
  toolDiffAdded: true,
  toolDiffRemoved: true,
  toolDiffContext: true,
  syntaxComment: true,
  syntaxKeyword: true,
  syntaxFunction: true,
  syntaxVariable: true,
  syntaxString: true,
  syntaxNumber: true,
  syntaxType: true,
  syntaxOperator: true,
  syntaxPunctuation: true,
  thinkingOff: true,
  thinkingMinimal: true,
  thinkingLow: true,
  thinkingMedium: true,
  thinkingHigh: true,
  thinkingXhigh: true,
  thinkingMax: true,
  bashMode: true,
};

export const COLOR_TOKENS = Object.keys(THEME_COLORS);

const COLOR_MESSAGE = "must be a theme color token or a #rrggbb hex";

/** Options that every segment accepts besides its own. */
export const COMMON_OPTIONS = {
  priority: Type.Optional(
    Type.Number({ description: "Segments with a lower priority hide first when the line does not fit." }),
  ),
  color: Type.Optional(
    Type.String({
      pattern: `^(#[0-9a-fA-F]{6}|${COLOR_TOKENS.join("|")})$`,
      description: "Theme color token or #rrggbb hex.",
    }),
  ),
};

function segmentSchema(segment: Segment): TSchema {
  return Type.Object(
    { segment: Type.Literal(segment.id), ...COMMON_OPTIONS, ...segment.options },
    { additionalProperties: false },
  );
}

/** What the agent prompt says about each segment: the catalog entry and the JSON schema of its options. */
export interface SegmentDoc {
  id: string;
  summary: string;
  options: Record<string, unknown>;
}

export const SEGMENT_DOCS: readonly SegmentDoc[] = CATALOG.map((segment) => ({
  id: segment.id,
  summary: segment.summary,
  options: segment.options,
}));

const SEGMENT_SCHEMAS = new Map(CATALOG.map((segment) => [segment.id, segmentSchema(segment)]));

const SEGMENT_IDS = CATALOG.map((segment) => segment.id);

/** The config with each segment checked only by its id. Each segment's options are checked apart. */
const SHAPE = Type.Object(
  {
    enabled: Type.Boolean({ default: true }),
    lines: Type.Array(
      Type.Object(
        {
          left: Type.Array(Type.Object({ segment: Type.Enum(SEGMENT_IDS) }), { default: [] }),
          right: Type.Array(Type.Object({ segment: Type.Enum(SEGMENT_IDS) }), { default: [] }),
        },
        { additionalProperties: false },
      ),
    ),
  },
  { additionalProperties: false },
);

const MESSAGES: Record<string, (error: TLocalizedValidationError) => string> = {
  pattern: () => COLOR_MESSAGE,
  enum: (error) =>
    `must be one of: ${(error.params as { allowedValues: unknown[] }).allowedValues.join(", ")}`,
};

const messageOf = (error: TLocalizedValidationError) => MESSAGES[error.keyword]?.(error) ?? error.message;

function issuesOf(schema: TSchema, value: unknown, prefix: string): Issue[] {
  const seen = new Set<string>();
  return Value.Errors(schema, value)
    .map((error) => ({
      path: prefix + error.instancePath,
      message: messageOf(error),
    }))
    .filter((issue) => !seen.has(issue.path) && seen.add(issue.path));
}

/** Fills the option defaults of one segment in place and returns what still fails. */
function segmentIssues(spec: SegmentConfig, path: string): Issue[] {
  const schema = SEGMENT_SCHEMAS.get(spec.segment) as TSchema;
  Value.Default(schema, spec);
  return issuesOf(schema, spec, path);
}

function lineIssues(config: Config): Issue[] {
  return config.lines.flatMap((line, index) => [
    ...line.left.flatMap((spec, at) => segmentIssues(spec, `/lines/${index}/left/${at}`)),
    ...line.right.flatMap((spec, at) => segmentIssues(spec, `/lines/${index}/right/${at}`)),
  ]);
}

/** Checks a raw config against the catalog and returns it with the defaults filled in. */
export function validate(raw: unknown): Result<Config> {
  const value = Value.Default(SHAPE, structuredClone(raw));
  const shapeIssues = issuesOf(SHAPE, value, "");
  if (shapeIssues.length > 0) return { ok: false, issues: shapeIssues };
  const issues = lineIssues(value as Config);
  return issues.length > 0 ? { ok: false, issues } : { ok: true, value: value as Config };
}

export function describeIssues(issues: readonly Issue[]): string {
  return issues.map((issue) => `${issue.path || "/"}: ${issue.message}`).join("\n");
}
