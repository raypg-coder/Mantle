# Mantle

> Skill manager for Claude Code (and future AI coding assistants).

A small, safe, transparent desktop app to manage the skills that get loaded into your AI assistant's context.

---

## Why

随着 `~/.claude/skills/` 下越攒越多（uipro / fireworks / 第三方 marketplaces…），出现 3 类问题：

1. **看不到全貌** — 哪些已装？哪个吃磁盘？哪个最近没用过？
2. **看不到风险** — 每个 skill 都是 markdown + 可能跑代码，但你不可能挨个 grep
3. **没法快速关停** — 想临时禁用某个 skill 测试 Claude 默认行为，只能手动 `mv` 文件夹

Mantle 把这 3 个事做扎实。

---

## Core Principles

| 原则 | 做法 |
|---|---|
| **Safe by default** | 装一个新 skill 之前，先跑 audit，红黄绿三色等级，用户明示同意才激活 |
| **Transparent** | 每个 skill 一键看完整 SKILL.md + 全部 script 文件 + 文件树 + 行为画像 |
| **Reversible** | 「禁用」≠ 删除：只把目录改名 `<skill>.disabled`，一键复活 |
| **Multi-tool ready** | v0.1 只管 `~/.claude/skills/`，v0.2 起也读 Cursor / Codex / Copilot 等 |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Tauri 2 Window (macOS / Windows / Linux)                       │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  React + TypeScript + Tailwind v4                        │   │
│  │  ├─ Zustand store                                        │   │
│  │  ├─ SkillList / SkillDetail / AuditBadge / TopBar        │   │
│  │  └─ Editorial Modernist 设计语言 (复用 MarkFlow v7)        │   │
│  └────────────────────────┬─────────────────────────────────┘   │
│                           │ invoke                              │
│  ┌────────────────────────┴─────────────────────────────────┐   │
│  │  Rust backend (src-tauri/src/lib.rs)                     │   │
│  │  ├─ scan_skills(roots)           → SkillEntry[]          │   │
│  │  ├─ read_skill_md(path)          → { frontmatter, body } │   │
│  │  ├─ list_skill_files(path)       → FileNode[] (tree)     │   │
│  │  ├─ audit_skill(path)            → AuditResult           │   │
│  │  ├─ toggle_skill(path, enabled)  → ok                    │   │
│  │  ├─ delete_skill(path)           → ok                    │   │
│  │  └─ install_from_zip(path, dest) → SkillEntry (v0.2)     │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 复用 MarkFlow 现成基础设施

- **Apple Developer ID 证书** — 同套 `.env.signing` 即可签名公证
- **`scripts/build-signed-dmg.sh`** — 直接拷过来改个 `productName`
- **Tauri updater + minisign** — 同套密钥
- **NSVisualEffectView vibrancy** — 同款玻璃 chrome
- **设计 token**（Editorial Modernist 调色板 / 字体 / spacing） — 复制 CSS 变量

预估总冷启代码 **30%** 是 MarkFlow 的副本，**70%** 是 Mantle 专属。

---

## Data Model

```typescript
type SkillSource = "claude-global" | "claude-project" | "cursor" | "codex";

interface Skill {
  id: string;                    // hash(path)
  source: SkillSource;
  path: string;                  // absolute path to skill dir
  name: string;                  // from SKILL.md frontmatter, fallback to dirname
  description: string;
  version?: string;
  enabled: boolean;              // false = dir has .disabled suffix
  sizeBytes: number;
  modifiedAt: string;            // ISO 8601
  fileCount: number;
  hasScripts: boolean;           // contains .py / .js / .sh
  audit?: AuditResult;
}

interface AuditResult {
  level: "safe" | "caution" | "risk";
  findings: AuditFinding[];
  scannedAt: string;
}

interface AuditFinding {
  pattern: string;               // e.g. "subprocess.run"
  file: string;                  // relative path
  line: number;
  severity: "info" | "warning" | "danger";
  context: string;               // ±2 lines of code
}
```

---

## Risk Audit · Pattern Library

行为类别 + 模式，每类红黄绿：

| Pattern | 等级 | 说明 |
|---|---|---|
| `subprocess.run` / `os.system` / `child_process.exec` | 🔴 danger | 任意命令执行 |
| `eval(` / `exec(` / `Function(` | 🔴 danger | 动态代码执行 |
| `requests.` / `urllib.` / `fetch(` / `http.` | 🟡 warning | 网络请求 |
| `open(...'w')` / `writeFile` / `fs.write` | 🟡 warning | 写文件系统 |
| `chmod` / `os.unlink` / `rm -` | 🟡 warning | 文件操作 |
| `BS4` / `bs4` / `lxml` / `html parsing` | 🟢 info | 解析（一般安全） |
| `csv.read` / `json.load` / `yaml.safe_load` | 🟢 info | 数据读取 |
| `hashlib` / `crypto` | 🟢 info | 哈希（一般安全） |

最终 level = max(findings.severity)。

---

## UI · 三栏布局

```
┌──────────────┬──────────────────────────────┬──────────────────┐
│ Sources      │ Skills List                  │ Detail / Audit   │
│              │                              │                  │
│ ⌂ Global     │ ▸ ui-ux-pro-max    668K  🟢  │ # SKILL.md       │
│   18 skills  │ ▸ fireworks-graph  5.8M  🟢  │                  │
│              │ ▸ karpathy-guide     4K  🟢  │ [Files] [Audit]  │
│ ⌂ ~/MarkFlow │ ▸ ...                        │                  │
│   0 skills   │                              │ ## 风险报告       │
│              │                              │ 🟢 0 danger      │
│ ⌂ Cursor     │                              │ 🟡 2 warning     │
│ ⌂ Codex      │                              │ 🟢 1 info        │
│              │                              │                  │
│ ➕ 添加来源   │ + 安装 skill                  │ [禁用] [卸载]    │
└──────────────┴──────────────────────────────┴──────────────────┘
```

视觉沿用 MarkFlow v7 的 **Editorial Modernist** 语言（暖奶油 / 哑光夜 + Instrument Serif italic 标题 + burnt sienna 单 accent）。

---

## Roadmap

### v0.1 MVP — 1 天
- [x] 项目初始化（Tauri 2 + React 19 + Vite 7 + TS）
- [x] Rust: `list_sources` + `scan_skills` + `read_skill_md` + `list_skill_files` + `audit_skill` + `toggle_skill` + `delete_skill`
- [x] Frontend: 三栏布局 / Sidebar / SkillList / SkillDetail（**Glass** 设计语言）
- [x] YAML frontmatter 解析（name / description / version / license / repo / author）
- [x] 禁用 = 重命名 `.disabled` 后缀（带 target-exists 守卫）
- [x] 删除 confirm modal（删除前校验目录含 SKILL.md，防误删）
- [x] 文件浏览器：detail 面板「概览 / 文件」双 tab，文件树 + 内容预览（`read_file` 带大小/二进制守卫）
- [x] 浏览器 dev-mock 回退（非 Tauri 环境用样例数据，便于设计迭代）
- [x] 本地未签名构建：`npm run tauri build` → `Mantle.app` + `Mantle_0.1.0_aarch64.dmg`（ad-hoc 签名，本机可直接跑）
- [x] **签名 + 公证 + staple** DMG：`bash scripts/build-signed-dmg.sh`（复用 MarkFlow 的 Developer ID 证书 + `.env.signing`）。产物 Gatekeeper `Notarized Developer ID`，可分发到任意 Mac
- [x] 自定义 app 图标：玻璃砖 + 发光地幔核心（地幔剖面意象）。源文件 `assets/icon.svg`，`tauri icon` 生成整套

> **设计语言**：从 5 个风格方向（见 `ui-gallery.html`：Editorial / Terminal / Glass / Swiss / Aurora）中选定 **Glass**（macOS 通透）。皮肤以手写 CSS（`src/index.css`，CSS 变量 + 组件类）实现，未引入 Tailwind —— 玻璃叠层/渐变/backdrop-filter 用原生 CSS 还原度更高、依赖更少。需要时可后续叠加 Tailwind。

### v0.2 — 2-3 天
- [x] Audit · 风险扫描器 + 红黄绿等级 + Trust Score（已在 v0.1 提前落地）
- [x] 搜索 / 筛选（全部·已启用·已禁用·有警告）
- [x] 添加任意目录作为来源（文件夹选择对话框）
- [x] **项目级 skill 扫描**：选项目根目录自动识别 `<root>/.claude/skills`（或直接选 skills 目录），作为「项目来源」入栏，带项目名 + 独立配色 + 可移除，localStorage 持久化
- [ ] 按 source 分组的多来源同时浏览
- [ ] 从本地 `.zip` 导入
- [ ] 从 GitHub repo URL 导入
- [ ] Auto-update (minisign + GitHub releases)

### v0.3 — 1 周
- [ ] 多 AI 工具支持（Cursor / Codex / Copilot 的 skill 目录）
- [ ] Skill 市场聚合 browser（pull from known marketplaces）
- [ ] Version check & 一键升级
- [ ] Skill profile 导出 / 导入（团队同步）

### v0.4+
- [ ] Sandboxed audit · 用 Tauri sidecar 跑 isolated python 检测
- [ ] Skill usage analytics（Claude 调用频次，需要 Claude Code 端集成）
- [ ] Cloud 同步 / 多机器

---

## Naming · 为什么叫 Mantle

- **mantle** 名词 = 「外套 / 披风」 — 给 skill 们一个收纳的「外衣」
- 也是地质学的「**地幔**」 — Claude 是地壳，skill 是地幔，underground but essential
- 短、单音节、好打、google 起来没撞名（github 上有几个无关项目）

---

## Status

🛠️ **v0.1 可运行**。`npm install && npm run tauri dev` 即可启动，扫描本机 `~/.claude/skills`。
浏览器预览（无需 Tauri）：`npm run dev` → http://localhost:1420 （用样例数据）。

---

## Tech Stack 详单

```jsonc
{
  "frontend": {
    "tauri": "2.x",
    "react": "18.x",
    "typescript": "5.x",
    "tailwindcss": "4.x",
    "zustand": "5.x",
    "lucide-react": "*"
  },
  "backend": {
    "rust": "1.x",
    "tauri": "2.x",
    "tauri-plugin-fs": "*",
    "tauri-plugin-dialog": "*",
    "tauri-plugin-updater": "*",
    "serde": "*",
    "serde_yaml": "*",
    "walkdir": "*"
  },
  "macos": {
    "window-vibrancy": "0.6"
  }
}
```

---

*by raypg-coder · Same toolchain as [MarkFlow](https://github.com/raypg-coder/MarkFlow)*
