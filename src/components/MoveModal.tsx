import { ArrowRight } from "lucide-react";
import { useStore } from "../store";

const MOVABLE_KINDS = ["claude-global", "claude-project", "custom"];
const AVATAR_KINDS = ["claude-global", "cursor", "codex", "claude-project", "custom"];

export function MoveModal() {
  const skill = useStore((s) => s.pendingMove);
  const sources = useStore((s) => s.sources);
  const cancel = useStore((s) => s.requestMove);
  const move = useStore((s) => s.moveSkill);
  if (!skill) return null;

  const dests = sources.filter((s) => s.id !== skill.sourceId && MOVABLE_KINDS.includes(s.kind));

  return (
    <div className="scrim" onClick={() => cancel(null)}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>移动「{skill.name}」</h3>
        <p>把它的目录搬到另一个来源（全局 ↔ 项目）。文件会真实移动，启用/禁用状态保留。</p>
        {dests.length === 0 ? (
          <div className="move-empty">
            还没有其他可用来源。先在左栏用「添加项目 / 目录」加一个目标，再回来移动。
          </div>
        ) : (
          <div className="move-list">
            {dests.map((d) => {
              const ava = AVATAR_KINDS.includes(d.kind) ? d.kind : "custom";
              return (
                <button key={d.id} className="move-dest" onClick={() => move(skill, d.id)}>
                  <span className={`src-ava ${ava}`}>{d.label[0]?.toUpperCase() ?? "?"}</span>
                  <span className="move-dest-meta">
                    <span className="move-dest-name">{d.label}</span>
                    <span className="move-dest-path">
                      {d.path.replace(/^\/Users\/[^/]+/, "~").replace(/^\/home\/[^/]+/, "~")}
                    </span>
                  </span>
                  <ArrowRight size={15} strokeWidth={1.8} />
                </button>
              );
            })}
          </div>
        )}
        <div className="modal-actions">
          <button className="abtn" onClick={() => cancel(null)}>
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
