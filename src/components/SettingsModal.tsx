import { useEffect, useRef, useState } from "react";
import { X, RefreshCw, Check, Download, ArrowUpCircle } from "lucide-react";
import { useStore } from "../store";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
const FALLBACK_VERSION = "0.1.6";

type UpdState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "uptodate" }
  | { kind: "available"; version: string; notes?: string }
  | { kind: "downloading"; pct: number }
  | { kind: "ready" }
  | { kind: "error"; msg: string };

export function SettingsModal() {
  const open = useStore((s) => s.settingsOpen);
  const setOpen = useStore((s) => s.setSettingsOpen);
  const sources = useStore((s) => s.sources);
  const activeSourceId = useStore((s) => s.activeSourceId);
  const theme = useStore((s) => s.theme);
  const toggleTheme = useStore((s) => s.toggleTheme);

  const [version, setVersion] = useState(FALLBACK_VERSION);
  const [upd, setUpd] = useState<UpdState>({ kind: "idle" });
  const updateRef = useRef<any>(null);

  const active = sources.find((s) => s.id === activeSourceId);

  useEffect(() => {
    if (!open) return;
    setUpd({ kind: "idle" });
    if (isTauri) {
      import("@tauri-apps/api/app")
        .then((m) => m.getVersion())
        .then(setVersion)
        .catch(() => {});
    }
  }, [open]);

  if (!open) return null;

  async function checkUpdate() {
    if (!isTauri) {
      setUpd({ kind: "error", msg: "更新功能需在桌面应用内使用" });
      return;
    }
    setUpd({ kind: "checking" });
    try {
      const { check } = await import("@tauri-apps/plugin-updater");
      const update = await check();
      if (update) {
        updateRef.current = update;
        setUpd({ kind: "available", version: update.version, notes: update.body || undefined });
      } else {
        setUpd({ kind: "uptodate" });
      }
    } catch (e) {
      setUpd({ kind: "error", msg: String(e) });
    }
  }

  async function installUpdate() {
    const update = updateRef.current;
    if (!update) return;
    try {
      let total = 0;
      let got = 0;
      setUpd({ kind: "downloading", pct: 0 });
      await update.downloadAndInstall((ev: any) => {
        if (ev.event === "Started") total = ev.data?.contentLength ?? 0;
        else if (ev.event === "Progress") {
          got += ev.data?.chunkLength ?? 0;
          setUpd({ kind: "downloading", pct: total ? Math.round((got / total) * 100) : 0 });
        } else if (ev.event === "Finished") setUpd({ kind: "ready" });
      });
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    } catch (e) {
      setUpd({ kind: "error", msg: String(e) });
    }
  }

  return (
    <div className="scrim" onClick={() => setOpen(false)}>
      <div className="modal settings" onClick={(e) => e.stopPropagation()}>
        <button className="set-x" onClick={() => setOpen(false)} title="关闭">
          <X size={16} />
        </button>

        <div className="set-head">
          <div className="set-mark">M</div>
          <div>
            <h3>Mantle</h3>
            <div className="set-ver">版本 {version}</div>
          </div>
        </div>

        <div className="set-rows">
          <div className="set-row">
            <span className="set-k">主题</span>
            <button className="set-val-btn" onClick={toggleTheme}>
              {theme === "dark" ? "深色" : "浅色"}
            </button>
          </div>
          <div className="set-row">
            <span className="set-k">当前来源</span>
            <span className="set-val">{active?.label ?? "—"}</span>
          </div>
          <div className="set-row">
            <span className="set-k">目录</span>
            <span className="set-val mono">
              {active ? active.path.replace(/^\/Users\/[^/]+/, "~").replace(/^\/home\/[^/]+/, "~") : "—"}
            </span>
          </div>
        </div>

        <div className="set-update">
          {upd.kind === "idle" && (
            <button className="set-btn" onClick={checkUpdate}>
              <RefreshCw size={13} strokeWidth={1.9} />
              检查更新
            </button>
          )}
          {upd.kind === "checking" && (
            <div className="set-status">
              <RefreshCw size={14} className="spin-i" />
              正在检查…
            </div>
          )}
          {upd.kind === "uptodate" && (
            <div className="set-status ok">
              <Check size={14} strokeWidth={2.4} />
              已是最新版本（{version}）
            </div>
          )}
          {upd.kind === "available" && (
            <div className="set-avail">
              <div className="set-status hot">
                <ArrowUpCircle size={15} strokeWidth={2} />
                发现新版本 v{upd.version}
              </div>
              {upd.notes && <p className="set-notes">{upd.notes}</p>}
              <button className="set-btn primary" onClick={installUpdate}>
                <Download size={13} strokeWidth={2} />
                下载并安装，然后重启
              </button>
            </div>
          )}
          {upd.kind === "downloading" && (
            <div className="set-dl">
              <div className="set-status">正在下载… {upd.pct}%</div>
              <div className="set-bar">
                <span style={{ width: `${upd.pct}%` }} />
              </div>
            </div>
          )}
          {upd.kind === "ready" && <div className="set-status ok">安装完成，即将重启…</div>}
          {upd.kind === "error" && (
            <div className="set-err-wrap">
              <div className="set-status err">{upd.msg}</div>
              <button className="set-btn" onClick={checkUpdate}>
                <RefreshCw size={13} strokeWidth={1.9} />
                重试
              </button>
            </div>
          )}
        </div>

        <div className="set-foot">Skill manager for Claude Code · raypg-coder</div>
      </div>
    </div>
  );
}
