import { invoke } from "@tauri-apps/api/core";
import type { AuditResult, FileNode, FilePreview, SkillEntry, SkillMd, SourceInfo } from "../types";
import { mockApi } from "./mock";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const realApi = {
  listSources: () => invoke<SourceInfo[]>("list_sources"),
  scanSkills: (root: string, sourceId: string) =>
    invoke<SkillEntry[]>("scan_skills", { root, sourceId }),
  inspectPath: (path: string) => invoke<SourceInfo>("inspect_path", { path }),
  readSkillMd: (path: string) => invoke<SkillMd>("read_skill_md", { path }),
  listSkillFiles: (path: string) => invoke<FileNode[]>("list_skill_files", { path }),
  readFile: (path: string) => invoke<FilePreview>("read_file", { path }),
  auditSkill: (path: string) => invoke<AuditResult>("audit_skill", { path }),
  toggleSkill: (path: string, enable: boolean) =>
    invoke<string>("toggle_skill", { path, enable }),
  deleteSkill: (path: string) => invoke<void>("delete_skill", { path }),
};

export const api = isTauri ? realApi : mockApi;
