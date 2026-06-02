export type Severity = "info" | "warning" | "danger";
export type AuditLevel = "safe" | "caution" | "risk";

export interface SkillEntry {
  id: string;
  sourceId: string;
  path: string;
  name: string;
  description: string;
  version?: string | null;
  enabled: boolean;
  sizeBytes: number;
  modifiedMs: number;
  fileCount: number;
  hasScripts: boolean;
}

export interface SourceInfo {
  id: string;
  label: string;
  kind: string;
  path: string;
  exists: boolean;
  skillCount: number;
  sizeBytes: number;
}

export interface SkillMd {
  name?: string | null;
  description?: string | null;
  version?: string | null;
  license?: string | null;
  repository?: string | null;
  author?: string | null;
  body: string;
  raw: string;
}

export interface FileNode {
  name: string;
  path: string;
  isDir: boolean;
  sizeBytes: number;
  children: FileNode[];
}

export interface FilePreview {
  path: string;
  content: string;
  truncated: boolean;
  binary: boolean;
  sizeBytes: number;
}

export interface AuditFinding {
  pattern: string;
  file: string;
  line: number;
  severity: Severity;
  context: string;
}

export interface AuditResult {
  level: AuditLevel;
  findings: AuditFinding[];
  trustScore: number;
  scannedFiles: number;
}
