import { useEffect, useState } from "react";
import { FolderOpen, Trash2, Check, ShieldQuestion, ArrowLeftRight } from "lucide-react";
import { revealItemInDir, openUrl } from "@tauri-apps/plugin-opener";
import { useStore } from "../store";
import { FileBrowser } from "./FileBrowser";
import { api } from "../lib/api";
import { initial, relativeTime, trustBreakdown, trustVerdict } from "../lib/format";
import type { AuditResult, SkillMd } from "../types";

function Dots({ on }: { on: number }) {
  return (
    <span className="dots">
      {[0, 1, 2, 3, 4].map((i) => (
        <i key={i} className={`d${i < on ? " on" : ""}`} />
      ))}
    </span>
  );
}

export function SkillDetail() {
  const skill = useStore((s) => s.skills.find((x) => x.id === s.selectedId));
  const storeAudit = useStore((s) => (skill ? s.audits[skill.path] : undefined));
  const requestDelete = useStore((s) => s.requestDelete);
  const requestMove = useStore((s) => s.requestMove);

  const [md, setMd] = useState<SkillMd | null>(null);
  const [localAudit, setLocalAudit] = useState<AuditResult | null>(null);
  const [tab, setTab] = useState<"overview" | "files">("overview");
  const audit = storeAudit ?? localAudit ?? undefined;

  useEffect(() => {
    setMd(null);
    setLocalAudit(null);
    setTab("overview");
    if (!skill) return;
    let cancelled = false;
    api.readSkillMd(skill.path).then((m) => !cancelled && setMd(m)).catch(() => {});
    if (!storeAudit) {
      api.auditSkill(skill.path).then((a) => !cancelled && setLocalAudit(a)).catch(() => {});
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skill?.path]);

  if (!skill) {
    return (
      <aside className="col-detail">
        <div className="empty">
          <ShieldQuestion size={36} strokeWidth={1.4} />
          <div className="et">选择一个技能</div>
          <div className="es">点击左侧列表查看它的 SKILL.md、风险审查和来源信息。</div>
        </div>
      </aside>
    );
  }

  const safe = audit?.level === "safe";
  const verdict = audit ? trustVerdict(audit.trustScore) : null;
  const breakdown = audit
    ? trustBreakdown({
        score: audit.trustScore,
        hasScripts: skill.hasScripts,
        scannedFiles: audit.scannedFiles,
        modifiedMs: skill.modifiedMs,
      })
    : [];

  const repo = md?.repository ?? null;
  const isUrl = repo ? /^https?:\/\//.test(repo) || repo.includes("github.com") : false;

  return (
    <aside className="col-detail">
      <div className="dscroll">
        <div className="phead" data-tauri-drag-region>
          <div className={`pico${safe ? " has-check" : ""}`}>{initial(skill.name)}</div>
          <h1 className="pname" data-tauri-drag-region>{skill.name}</h1>
          <div className="pmeta">
            {skill.version && <span className="pver">v{skill.version}</span>}
            {skill.version && <span className="sep">·</span>}
            {safe ? (
              <span className="verified">
                <Check size={9} strokeWidth={3} />
                已验证
              </span>
            ) : audit ? (
              <span className={`audit ${audit.level}`}>{audit.level === "risk" ? "高风险" : "需留意"}</span>
            ) : null}
            {md?.author && <span className="sep">·</span>}
            {md?.author && <span className="repo">{md.author}</span>}
          </div>
        </div>

        <div className="pdesc">{skill.description || md?.description || "（这个技能没有提供描述）"}</div>

        <div className="tabs">
          <button className={`tab${tab === "overview" ? " on" : ""}`} onClick={() => setTab("overview")}>
            概览
          </button>
          <button className={`tab${tab === "files" ? " on" : ""}`} onClick={() => setTab("files")}>
            文件{skill.fileCount ? ` · ${skill.fileCount}` : ""}
          </button>
        </div>

        {tab === "files" && <FileBrowser skillPath={skill.path} />}

        {tab === "overview" && (
          <>
            {/* Trust score */}
        {audit ? (
          <div className="trust anim-up">
            <div className="trust-top">
              <div className="trust-score">
                {audit.trustScore}
                <span className="ofx">/100</span>
              </div>
              <div className="trust-sum">
                <div className="lbl">Trust Score</div>
                <div className="verdict">
                  <em>{verdict!.tag}</em> · {verdict!.rest}
                </div>
              </div>
            </div>
            <div className="trust-break">
              {breakdown.map((b) => (
                <div className="trow" key={b.nm}>
                  <span className="nm">{b.nm}</span>
                  <Dots on={b.on} />
                  <span className="vl">{b.on}/5</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="trust">
            <div className="skel" style={{ height: 96, margin: 0 }} />
          </div>
        )}

        {/* Findings */}
        <div className="divider">
          <span>审查发现</span>
          <span className="line" />
          {audit && <span className="n">{audit.findings.length}</span>}
        </div>
        <div className="findings">
          {!audit ? (
            <div className="skel" />
          ) : audit.findings.length === 0 ? (
            <div className="empty" style={{ padding: "10px 0", alignItems: "flex-start" }}>
              <div className="es" style={{ textAlign: "left" }}>
                未发现网络、命令执行或文件写入等敏感调用。已扫描 {audit.scannedFiles} 个脚本文件。
              </div>
            </div>
          ) : (
            audit.findings.map((f, i) => (
              <div className={`finding ${f.severity}`} key={i}>
                <div className="cap" />
                <div className="f-body">
                  <div className="f-top">
                    <span className="f-pat">{f.pattern}</span>
                    <span className="f-sev">{f.severity}</span>
                  </div>
                  <div className="f-file">
                    {f.file} · L{f.line}
                  </div>
                  <div className="f-ctx">{f.context}</div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Provenance */}
        <div className="divider">
          <span>来源信息</span>
          <span className="line" />
        </div>
        <div className="prov">
          {repo && (
            <div className="prow">
              <span className="k">仓库</span>
              <span className="v">
                {isUrl ? (
                  <a onClick={() => openUrl(repo.startsWith("http") ? repo : `https://${repo}`)}>{repo}</a>
                ) : (
                  repo
                )}
              </span>
            </div>
          )}
          {md?.author && (
            <div className="prow">
              <span className="k">作者</span>
              <span className="v">{md.author}</span>
            </div>
          )}
          {md?.license && (
            <div className="prow">
              <span className="k">License</span>
              <span className="v">{md.license}</span>
            </div>
          )}
          <div className="prow">
            <span className="k">路径</span>
            <span className="v">{skill.path.replace(/^\/Users\/[^/]+/, "~").replace(/^\/home\/[^/]+/, "~")}</span>
          </div>
          <div className="prow">
            <span className="k">更新于</span>
            <span className="v">{relativeTime(skill.modifiedMs)}</span>
          </div>
          <div className="prow">
            <span className="k">文件</span>
            <span className="v">
              {skill.fileCount} 个{skill.hasScripts ? " · 含脚本" : ""}
            </span>
          </div>
        </div>
          </>
        )}
      </div>

      <div className="actions">
        <button className="abtn" onClick={() => requestMove(skill)} title="移动到其他来源（全局 ↔ 项目）">
          <ArrowLeftRight size={12} strokeWidth={1.7} />
          移动
        </button>
        <button className="abtn" onClick={() => revealItemInDir(skill.path).catch(() => {})}>
          <FolderOpen size={12} strokeWidth={1.7} />
          打开目录
        </button>
        <span style={{ flex: 1 }} />
        <button className="abtn danger" onClick={() => requestDelete(skill)}>
          <Trash2 size={12} strokeWidth={1.7} />
          卸载
        </button>
      </div>
    </aside>
  );
}
