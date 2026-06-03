import { Plus, Settings, Moon, Sun, X } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { useStore } from "../store";

const HOME = "~";
const BUILTIN = new Set(["claude-global", "cursor", "codex"]);
const AVATAR_KINDS = ["claude-global", "cursor", "codex", "claude-project", "custom"];

function prettyPath(p: string): string {
  const m = p.match(/^(\/Users\/[^/]+|\/home\/[^/]+)(\/.*)?$/);
  return m ? HOME + (m[2] ?? "") : p;
}

export function Sidebar() {
  const sources = useStore((s) => s.sources);
  const activeSourceId = useStore((s) => s.activeSourceId);
  const selectSource = useStore((s) => s.selectSource);
  const addSource = useStore((s) => s.addSource);
  const removeSource = useStore((s) => s.removeSource);
  const theme = useStore((s) => s.theme);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);

  const active = sources.find((s) => s.id === activeSourceId);

  async function pickDir() {
    const picked = await open({
      directory: true,
      multiple: false,
      title: "选择项目根目录或 skills 目录",
    });
    if (typeof picked === "string") await addSource(picked);
  }

  return (
    <aside className="col-sources" data-tauri-drag-region>
      <div className="brand" data-tauri-drag-region>
        <div className="brand-mark">M</div>
        <div className="brand-meta">
          <div className="brand-name">Mantle</div>
          <div className="brand-tag">skill manager</div>
        </div>
      </div>

      <div className="s-label">
        <span>来源</span>
        <span className="ct">{sources.length}</span>
      </div>

      {sources.map((s) => {
        const isActive = s.id === activeSourceId;
        const avaClass = AVATAR_KINDS.includes(s.kind) ? s.kind : "custom";
        const removable = !BUILTIN.has(s.kind);
        return (
          <div key={s.id}>
            <div
              className={`src${isActive ? " active" : ""}${!s.exists ? " missing" : ""}`}
              onClick={() => selectSource(s.id)}
              role="button"
              tabIndex={0}
            >
              <span className={`src-ava ${avaClass}`}>{s.label[0]?.toUpperCase() ?? "?"}</span>
              <span className="src-name">{s.label}</span>
              {removable ? (
                <>
                  <span className="src-count with-x">{s.exists ? s.skillCount : "—"}</span>
                  <button
                    className="src-x"
                    title="移除来源"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeSource(s.id);
                    }}
                  >
                    <X size={12} strokeWidth={2} />
                  </button>
                </>
              ) : (
                <span className="src-count">{s.exists ? s.skillCount : "—"}</span>
              )}
            </div>
            {isActive && active && <div className="src-path">{prettyPath(active.path)}</div>}
          </div>
        );
      })}

      <button className="add-src" onClick={pickDir}>
        <Plus size={12} strokeWidth={2.4} />
        添加项目 / 目录
      </button>

      <div className="s-foot">
        <button className="fbtn" title="设置" onClick={() => setSettingsOpen(true)}>
          <Settings size={15} strokeWidth={1.7} />
        </button>
        <button className="fbtn" title="切换主题" onClick={toggleTheme}>
          {theme === "dark" ? <Sun size={15} strokeWidth={1.7} /> : <Moon size={15} strokeWidth={1.7} />}
        </button>
        <span className="ver">v0.1.4</span>
      </div>
    </aside>
  );
}
