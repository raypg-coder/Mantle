// Browser dev fallback: sample data used when the app runs outside the Tauri
// shell (plain `npm run dev`). Lets the UI render & be iterated without the
// native window. Inside Tauri, the real invoke-backed api is used instead.
import type { AuditResult, FileNode, FilePreview, SkillEntry, SkillMd, SourceInfo } from "../types";

const day = 86_400_000;
const now = Date.now();
const ROOT = "/Users/you/.claude/skills";

const sources: SourceInfo[] = [
  { id: "claude-global", label: "Claude · Global", kind: "claude-global", path: ROOT, exists: true, skillCount: 5, sizeBytes: 8_650_000 },
  { id: "cursor", label: "Cursor", kind: "cursor", path: "/Users/you/.cursor/skills", exists: false, skillCount: 0, sizeBytes: 0 },
  { id: "codex", label: "Codex", kind: "codex", path: "/Users/you/.codex/skills", exists: false, skillCount: 0, sizeBytes: 0 },
];

const skills: SkillEntry[] = [
  { id: "1", sourceId: "claude-global", path: `${ROOT}/ui-ux-pro-max`, name: "ui-ux-pro-max", description: "UI/UX 设计智能体。67 风格、96 配色、57 字体配对，覆盖 13 主流前端栈。在你触发 plan / build / design / review 关键词时自动激活。", version: "2.2.3", enabled: true, sizeBytes: 668_000, modifiedMs: now - 3 * day, fileCount: 24, hasScripts: true },
  { id: "2", sourceId: "claude-global", path: `${ROOT}/fireworks-tech-graph`, name: "fireworks-tech-graph", description: "技术架构图 · 数据流 · 流程图 · 时序图 · concept map 一键生成", version: "1.4.0", enabled: true, sizeBytes: 5_800_000, modifiedMs: now - 25 * day, fileCount: 88, hasScripts: true },
  { id: "3", sourceId: "claude-global", path: `${ROOT}/karpathy-guidelines`, name: "karpathy-guidelines", description: "Behavioral guidelines to reduce common LLM coding mistakes", version: undefined, enabled: true, sizeBytes: 4_000, modifiedMs: now - 60 * day, fileCount: 2, hasScripts: false },
  { id: "4", sourceId: "claude-global", path: `${ROOT}/three-js-experimental.disabled`, name: "three-js-experimental", description: "实验性 3D scene 生成 · 含 subprocess 调用", version: "0.2.0", enabled: false, sizeBytes: 2_100_000, modifiedMs: now - 7 * day, fileCount: 41, hasScripts: true },
  { id: "5", sourceId: "claude-global", path: `${ROOT}/modern-web-design`, name: "modern-web-design", description: "Meta-skill: glassmorphism · brutalism · dark mode · responsive layouts", version: "1.0.1", enabled: true, sizeBytes: 42_000, modifiedMs: now - 7 * day, fileCount: 6, hasScripts: false },
];

const audits: Record<string, AuditResult> = {
  [`${ROOT}/ui-ux-pro-max`]: {
    level: "caution",
    trustScore: 92,
    scannedFiles: 3,
    findings: [
      { pattern: "open(…, 'w')", file: "scripts/search.py", line: 42, severity: "warning", context: "with open(file, 'w') as f: f.write(json.dumps(result))" },
      { pattern: "os.makedirs", file: "scripts/design_system.py", line: 17, severity: "warning", context: "os.makedirs(output_dir, exist_ok=True)" },
    ],
  },
  [`${ROOT}/fireworks-tech-graph`]: {
    level: "caution",
    trustScore: 80,
    scannedFiles: 12,
    findings: [
      { pattern: "requests.*", file: "scripts/fetch_icons.py", line: 31, severity: "warning", context: "resp = requests.get(url, timeout=10)" },
      { pattern: "writeFile", file: "render/export.js", line: 88, severity: "warning", context: "fs.writeFileSync(out, svg)" },
      { pattern: "json.load", file: "scripts/graph.py", line: 9, severity: "info", context: "spec = json.load(open(path))" },
    ],
  },
  [`${ROOT}/karpathy-guidelines`]: { level: "safe", trustScore: 100, scannedFiles: 0, findings: [] },
  [`${ROOT}/three-js-experimental.disabled`]: {
    level: "risk",
    trustScore: 48,
    scannedFiles: 9,
    findings: [
      { pattern: "subprocess", file: "scripts/render_headless.py", line: 14, severity: "danger", context: "subprocess.run([\"node\", \"render.js\", scene], check=True)" },
      { pattern: "child_process", file: "build/bundle.js", line: 52, severity: "danger", context: "const { exec } = require('child_process')" },
      { pattern: "fetch()", file: "src/loader.ts", line: 20, severity: "warning", context: "const data = await fetch(remoteModelUrl)" },
    ],
  },
  [`${ROOT}/modern-web-design`]: { level: "safe", trustScore: 99, scannedFiles: 1, findings: [{ pattern: "json.load", file: "palette.py", line: 4, severity: "info", context: "palettes = json.load(f)" }] },
};

const mds: Record<string, SkillMd> = {
  [`${ROOT}/ui-ux-pro-max`]: { name: "ui-ux-pro-max", description: "UI/UX design intelligence. 67 styles, 96 palettes, 57 font pairings, 25 charts, 13 stacks — React, Vue, Svelte, SwiftUI, Flutter, Tailwind, shadcn/ui.", version: "2.2.3", license: "MIT", repository: "github.com/nextlevelbuilder/ui-ux-pro-max", author: "nextlevelbuilder", body: "", raw: "" },
};

function md(path: string): SkillMd {
  return mds[path] ?? { body: "", raw: "", description: skills.find((s) => s.path === path)?.description ?? null };
}

function f(name: string, parent: string, size: number): FileNode {
  return { name, path: `${parent}/${name}`, isDir: false, sizeBytes: size, children: [] };
}
function d(name: string, parent: string, children: (p: string) => FileNode[]): FileNode {
  const path = `${parent}/${name}`;
  return { name, path, isDir: true, sizeBytes: 0, children: children(path) };
}

function sampleTree(root: string): FileNode[] {
  return [
    f("SKILL.md", root, 6420),
    d("scripts", root, (p) => [f("search.py", p, 3180), f("design_system.py", p, 2470)]),
    d("references", root, (p) => [f("styles.csv", p, 188_000), f("palettes.csv", p, 96_400)]),
    f("README.md", root, 2100),
    f("icon.png", root, 18_900),
  ];
}

const fileContents: Record<string, string> = {
  "SKILL.md": `---\nname: ui-ux-pro-max\ndescription: UI/UX design intelligence. 67 styles, 96 palettes...\nversion: 2.2.3\nlicense: MIT\n---\n\n# UI/UX Pro Max\n\nComprehensive design guide. Search 67 styles, 96 palettes, 57 font pairings...\n`,
  "search.py": `import json, os\n\ndef save(result, file):\n    with open(file, 'w') as f:        # <- flagged: file write\n        f.write(json.dumps(result))\n\ndef ensure(output_dir):\n    os.makedirs(output_dir, exist_ok=True)  # <- flagged\n`,
  "design_system.py": `import csv\n\ndef load_palettes(path):\n    with open(path) as f:\n        return list(csv.DictReader(f))\n`,
  "README.md": `# ui-ux-pro-max\n\nDesign intelligence skill for Claude Code.\n`,
  "styles.csv": `category,keywords,colors\nGlassmorphism,"frosted,blur",rgba(255,255,255,0.15)\nBrutalism,"raw,stark",#FF0000\n`,
  "palettes.csv": `name,primary,bg\nMac Blue,#0A84FF,#F3EEF7\n`,
};

const preview = (path: string): FilePreview => {
  const base = path.split("/").pop() ?? "";
  if (base.endsWith(".png")) {
    return { path, content: "", truncated: false, binary: true, sizeBytes: 18_900 };
  }
  const content = fileContents[base] ?? `// ${base}\n（样例数据：此文件无预览内容）\n`;
  return { path, content, truncated: false, binary: false, sizeBytes: content.length };
};

const wait = <T>(v: T, ms = 120): Promise<T> => new Promise((r) => setTimeout(() => r(v), ms));

export const mockApi = {
  listSources: () => wait(sources, 80),
  scanSkills: (_root: string, sourceId: string) =>
    wait(
      sourceId.startsWith("claude-project") || sourceId.startsWith("custom")
        ? skills.slice(0, 2).map((s) => ({ ...s, sourceId }))
        : skills,
    ),
  readSkillMd: (path: string) => wait(md(path), 60),
  inspectPath: (path: string) => {
    const name = path.split("/").filter(Boolean).pop() || path;
    const src: SourceInfo = {
      id: `claude-project:${path}/.claude/skills`,
      label: name,
      kind: "claude-project",
      path: `${path}/.claude/skills`,
      exists: true,
      skillCount: 2,
      sizeBytes: 120_000,
    };
    return wait(src, 100);
  },
  listSkillFiles: (path: string) => wait(sampleTree(path), 140),
  readFile: (path: string) => wait(preview(path), 90),
  auditSkill: (path: string) => wait(audits[path] ?? { level: "safe" as const, trustScore: 100, scannedFiles: 0, findings: [] }, 200),
  toggleSkill: (path: string, enable: boolean) =>
    wait(enable ? path.replace(/\.disabled$/, "") : `${path}.disabled`),
  moveSkill: (path: string, destRoot: string) =>
    wait(`${destRoot}/${path.split("/").pop()}`),
  installFromGithub: (_o: string, _r: string, _ref: string, subpath: string, destRoot: string) =>
    wait(`${destRoot}/${subpath.split("/").pop()}`, 700),
  installRepoSkills: (_o: string, repo: string, _destRoot: string) => wait([repo], 800),
  deleteSkill: (_path: string) => wait(undefined as unknown as void),
};
