export interface SegmentConfig {
  segment: string;
  priority?: number;
  color?: string;
  [option: string]: unknown;
}

export interface LineConfig {
  left: SegmentConfig[];
  right: SegmentConfig[];
}

export interface Config {
  enabled: boolean;
  lines: LineConfig[];
}
