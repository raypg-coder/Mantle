import { useEffect, useState } from "react";
import { X, Download, Check, RefreshCw, FileText, ExternalLink, Package } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { fetchEntryDetail, type MarketEntry, type EntryDetail } from "../lib/marketplace";
import { renderMarkdown } from "../lib/markdown";
import { initial } from "../lib/format";

type St = "idle" | "installing" | "done" | "error";

export function MarketDetail({
  entry,
  status,
  onInstall,
  onClose,
}: {
  entry: MarketEntry;
  status: St;
  onInstall: (e: MarketEntry) => void;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<EntryDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setDetail(null);
    fetchEntryDetail(entry)
      .then((d) => !cancelled && (setDetail(d), setLoading(false)))
      .catch(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [entry.id]);

  function onBodyClick(e: React.MouseEvent) {
    const a = (e.target as HTMLElement).closest("[data-href]") as HTMLElement | null;
    if (a?.dataset.href) {
      e.preventDefault();
      openUrl(a.dataset.href).catch(() => {});
    }
  }

  const repoUrl = detail?.repoUrl || `https://github.com/${entry.owner}/${entry.repo}`;

  return (
    <div className="scrim" onClick={onClose}>
      <div className="market-detail" onClick={(e) => e.stopPropagation()}>
        <button className="set-x" onClick={onClose} title="关闭">
          <X size={16} />
        </button>

        <div className="md-head">
          <div className="md-ico">{initial(entry.name)}</div>
          <div className="md-head-meta">
            <div className="md-name">
              {entry.name}
              {entry.kind === "plugin" && (
                <span className="mcard-tag">
                  <Package size={9} strokeWidth={2.2} />插件
                </span>
              )}
            </div>
            <div className="md-sub">
              {entry.marketplace} · {entry.owner}/{entry.repo}
            </div>
          </div>
        </div>

        {detail && entry.kind === "skill" && (detail.version || detail.license || detail.author) && (
          <div className="md-chips">
            {detail.version && <span className="md-chip">v{detail.version}</span>}
            {detail.license && <span className="md-chip">{detail.license}</span>}
            {detail.author && <span className="md-chip">{detail.author}</span>}
          </div>
        )}

        <div className="md-scroll">
          {loading ? (
            <>
              <div className="skel" style={{ height: 16, marginBottom: 8 }} />
              <div className="skel" style={{ height: 16, marginBottom: 8 }} />
              <div className="skel" style={{ height: 140 }} />
            </>
          ) : entry.kind === "skill" ? (
            <>
              {detail?.files?.length ? (
                <div className="md-files">
                  {detail.files.map((f) => (
                    <span className="md-file" key={f}>
                      <FileText size={11} strokeWidth={1.7} />
                      {f}
                    </span>
                  ))}
                </div>
              ) : null}
              <div
                className="md-body"
                onClick={onBodyClick}
                dangerouslySetInnerHTML={{
                  __html: renderMarkdown(detail?.body || entry.description || "（没有 SKILL.md 内容）"),
                }}
              />
            </>
          ) : (
            <>
              {detail?.skills?.length ? (
                <div className="md-section">
                  <div className="md-label">包含 {detail.skills.length} 个技能</div>
                  <div className="md-files">
                    {detail.skills.map((s) => (
                      <span className="md-file" key={s.path}>
                        <FileText size={11} strokeWidth={1.7} />
                        {s.name}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              <div
                className="md-body"
                onClick={onBodyClick}
                dangerouslySetInnerHTML={{
                  __html: renderMarkdown(detail?.readme || entry.description || "（没有说明）"),
                }}
              />
            </>
          )}
        </div>

        <div className="md-foot">
          <button className="abtn" onClick={() => openUrl(repoUrl).catch(() => {})}>
            <ExternalLink size={12} strokeWidth={1.7} />
            在 GitHub 查看
          </button>
          <span style={{ flex: 1 }} />
          {status === "done" ? (
            <span className="mcard-done">
              <Check size={14} strokeWidth={2.4} />
              已安装
            </span>
          ) : status === "installing" ? (
            <button className="set-btn primary" disabled>
              <RefreshCw size={13} className="spin-i" />
              安装中
            </button>
          ) : (
            <button className="set-btn primary" onClick={() => onInstall(entry)}>
              <Download size={13} strokeWidth={2} />
              安装到所选来源
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
