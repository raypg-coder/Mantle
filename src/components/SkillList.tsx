import { Search, RefreshCw, Plus, Sparkles, ChevronRight, PackageOpen } from "lucide-react";
import { useStore, type FilterKey } from "../store";
import { AUDIT_LABEL, formatBytes, initial, relativeShort } from "../lib/format";
import type { AuditResult, SkillEntry } from "../types";

function AuditBadge({ audit }: { audit?: AuditResult }) {
  if (!audit) return <span className="audit pending">…</span>;
  return <span className={`audit ${audit.level}`}>{AUDIT_LABEL[audit.level]}</span>;
}

function Row({ skill, audit, active, onClick, onToggle }: {
  skill: SkillEntry;
  audit?: AuditResult;
  active: boolean;
  onClick: () => void;
  onToggle: () => void;
}) {
  return (
    <div className={`row${active ? " active" : ""}${skill.enabled ? "" : " off"}`} onClick={onClick}>
      <div className="row-ico">{initial(skill.name)}</div>
      <div className="row-info">
        <div className="row-name">
          {skill.name}
          {!skill.enabled && <span className="row-tag-off">已禁用</span>}
        </div>
        <div className="row-desc">{skill.description || "（无描述）"}</div>
      </div>
      <div className="row-stat">
        <AuditBadge audit={audit} />
        <div className="row-meta">
          <span>{formatBytes(skill.sizeBytes)}</span>
          <span className="sep">·</span>
          <span>{relativeShort(skill.modifiedMs)}</span>
        </div>
      </div>
      <button
        className={`sw${skill.enabled ? " on" : ""}`}
        title={skill.enabled ? "禁用" : "启用"}
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
      />
    </div>
  );
}

export function SkillList() {
  const skills = useStore((s) => s.skills);
  const audits = useStore((s) => s.audits);
  const selectedId = useStore((s) => s.selectedId);
  const filter = useStore((s) => s.filter);
  const query = useStore((s) => s.query);
  const loading = useStore((s) => s.loadingSkills);
  const refreshing = useStore((s) => s.refreshing);
  const sources = useStore((s) => s.sources);
  const activeSourceId = useStore((s) => s.activeSourceId);

  const selectSkill = useStore((s) => s.selectSkill);
  const setFilter = useStore((s) => s.setFilter);
  const setQuery = useStore((s) => s.setQuery);
  const toggle = useStore((s) => s.toggle);
  const refresh = useStore((s) => s.refresh);

  const source = sources.find((s) => s.id === activeSourceId);

  const counts = {
    all: skills.length,
    enabled: skills.filter((s) => s.enabled).length,
    disabled: skills.filter((s) => !s.enabled).length,
    warnings: skills.filter((s) => ["caution", "risk"].includes(audits[s.path]?.level)).length,
  };

  const q = query.trim().toLowerCase();
  const visible = skills.filter((s) => {
    if (filter === "enabled" && !s.enabled) return false;
    if (filter === "disabled" && s.enabled) return false;
    if (filter === "warnings" && !["caution", "risk"].includes(audits[s.path]?.level)) return false;
    if (q && !(`${s.name} ${s.description}`.toLowerCase().includes(q))) return false;
    return true;
  });

  const totalBytes = skills.reduce((a, s) => a + s.sizeBytes, 0);

  const chips: { key: FilterKey; label: string }[] = [
    { key: "all", label: "全部" },
    { key: "enabled", label: "已启用" },
    { key: "disabled", label: "已禁用" },
    { key: "warnings", label: "有警告" },
  ];

  return (
    <main className="col-list">
      <div className="topbar" data-tauri-drag-region>
        <div className="crumbs">
          <span className="crumb">
            <Sparkles size={12} strokeWidth={1.7} />
            {source?.kind === "claude-global" ? "Claude" : source?.label ?? "—"}
          </span>
          <ChevronRight className="crumb-sep" size={13} />
          <span className="crumb cur">{source?.kind === "claude-global" ? "Global" : "Skills"}</span>
          <label className="search">
            <Search size={11} strokeWidth={2} />
            <input
              value={query}
              placeholder="搜索"
              onChange={(e) => setQuery(e.target.value)}
            />
            <span className="kbd">⌘K</span>
          </label>
        </div>
        <button
          className={`iconbtn${refreshing ? " spin" : ""}`}
          title="刷新"
          onClick={refresh}
          disabled={refreshing}
        >
          <RefreshCw size={14} strokeWidth={1.7} />
        </button>
        <button className="install" title="安装新 skill（即将上线）">
          <Plus size={11} strokeWidth={2.6} />
          安装
        </button>
      </div>

      <div className="hero">
        <div className="hero-title">
          {counts.all > 0 ? (
            <>
              {counts.all} 个 <em>技能</em>，安静地等着被召唤。
            </>
          ) : (
            <>这个目录还没有 <em>技能</em>。</>
          )}
        </div>
        <div className="hero-sub">
          <span className="pill">{source?.label ?? "—"}</span>
          <span>{source ? source.path.replace(/^\/Users\/[^/]+/, "~").replace(/^\/home\/[^/]+/, "~") : ""}</span>
          {counts.all > 0 && (
            <span className="mono">
              {formatBytes(totalBytes)} · {counts.all} skills
            </span>
          )}
        </div>
      </div>

      <div className="chips">
        {chips.map((c) => (
          <button
            key={c.key}
            className={`chip${filter === c.key ? " on" : ""}`}
            onClick={() => setFilter(c.key)}
          >
            {c.label}
            <span className="b">{counts[c.key]}</span>
          </button>
        ))}
      </div>

      <div className="list">
        {loading ? (
          <>
            {[0, 1, 2, 3, 4].map((i) => (
              <div className="skel" key={i} />
            ))}
          </>
        ) : visible.length === 0 ? (
          <div className="empty">
            <PackageOpen size={36} strokeWidth={1.4} />
            <div className="et">{skills.length === 0 ? "没有找到技能" : "没有匹配的技能"}</div>
            <div className="es">
              {skills.length === 0
                ? "这个目录下没有包含 SKILL.md 的子目录。换个来源或添加目录试试。"
                : "调整筛选条件或清空搜索。"}
            </div>
          </div>
        ) : (
          visible.map((s) => (
            <Row
              key={s.id}
              skill={s}
              audit={audits[s.path]}
              active={s.id === selectedId}
              onClick={() => selectSkill(s.id)}
              onToggle={() => toggle(s)}
            />
          ))
        )}
      </div>
    </main>
  );
}
