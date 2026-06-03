import { useEffect, useMemo, useState } from "react";
import { X, Search, Download, Check, Store, RefreshCw, AlertCircle } from "lucide-react";
import { useStore } from "../store";
import { api } from "../lib/api";
import { fetchCatalog, type MarketSkill } from "../lib/marketplace";
import { initial } from "../lib/format";

type InstallState = "idle" | "installing" | "done" | "error";
const INSTALLABLE = ["claude-global", "claude-project", "custom"];

export function Market() {
  const open = useStore((s) => s.marketOpen);
  const setOpen = useStore((s) => s.setMarketOpen);
  const sources = useStore((s) => s.sources);
  const activeSourceId = useStore((s) => s.activeSourceId);
  const refresh = useStore((s) => s.refresh);

  const [catalog, setCatalog] = useState<MarketSkill[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [destId, setDestId] = useState("");
  const [status, setStatus] = useState<Record<string, InstallState>>({});
  const [errs, setErrs] = useState<Record<string, string>>({});

  const dests = useMemo(
    () => sources.filter((s) => s.exists && INSTALLABLE.includes(s.kind)),
    [sources],
  );

  function load() {
    setError(null);
    setCatalog(null);
    fetchCatalog()
      .then(setCatalog)
      .catch((e) => setError(String(e)));
  }

  useEffect(() => {
    if (!open) return;
    if (catalog === null && !error) load();
    setDestId((d) => (dests.some((s) => s.id === d) ? d : dests.find((s) => s.id === activeSourceId)?.id ?? dests[0]?.id ?? ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const q = query.trim().toLowerCase();
  const visible = (catalog ?? []).filter(
    (s) => !q || `${s.name} ${s.description}`.toLowerCase().includes(q),
  );
  const dest = dests.find((s) => s.id === destId);

  async function install(skill: MarketSkill) {
    if (!dest) {
      setStatus((s) => ({ ...s, [skill.id]: "error" }));
      setErrs((e) => ({ ...e, [skill.id]: "请先在右上角选择安装到的来源" }));
      return;
    }
    setStatus((s) => ({ ...s, [skill.id]: "installing" }));
    setErrs((e) => ({ ...e, [skill.id]: "" }));
    try {
      await api.installFromGithub(skill.owner, skill.repo, skill.ref, skill.subpath, dest.path);
      setStatus((s) => ({ ...s, [skill.id]: "done" }));
      await refresh();
    } catch (e) {
      setStatus((s) => ({ ...s, [skill.id]: "error" }));
      setErrs((er) => ({ ...er, [skill.id]: String(e) }));
    }
  }

  const marketplaces = [...new Set(visible.map((s) => s.marketplace))];

  return (
    <div className="market">
      <div className="market-top" data-tauri-drag-region>
        <div className="market-title">
          <Store size={17} strokeWidth={1.9} />
          技能市场
        </div>
        <label className="search market-search">
          <Search size={12} strokeWidth={2} />
          <input value={query} placeholder="搜索市场技能…" onChange={(e) => setQuery(e.target.value)} />
        </label>
        <span className="market-dest-label">安装到</span>
        <select className="market-dest" value={destId} onChange={(e) => setDestId(e.target.value)}>
          {dests.length === 0 && <option value="">无可用来源</option>}
          {dests.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <button className="iconbtn" onClick={() => setOpen(false)} title="关闭">
          <X size={18} strokeWidth={1.8} />
        </button>
      </div>

      <div className="market-body">
        {error ? (
          <div className="empty">
            <AlertCircle size={36} strokeWidth={1.4} />
            <div className="et">无法加载市场</div>
            <div className="es">{error}</div>
            <button className="set-btn" onClick={load}>
              <RefreshCw size={13} strokeWidth={1.9} />
              重试
            </button>
          </div>
        ) : catalog === null ? (
          <div className="market-grid">
            {Array.from({ length: 9 }).map((_, i) => (
              <div className="skel" style={{ height: 152 }} key={i} />
            ))}
          </div>
        ) : (
          <>
            <div className="market-count">
              {visible.length} 个技能 · 来自 {marketplaces.join(" · ") || "—"}
            </div>
            <div className="market-grid">
              {visible.map((s) => {
                const st = status[s.id] ?? "idle";
                return (
                  <div className="mcard" key={s.id}>
                    <div className="mcard-head">
                      <div className="mcard-ico">{initial(s.name)}</div>
                      <div className="mcard-meta">
                        <div className="mcard-name">{s.name}</div>
                        <div className="mcard-srcname">{s.marketplace}</div>
                      </div>
                    </div>
                    <div className="mcard-desc">{s.description || "（无描述）"}</div>
                    <div className="mcard-foot">
                      <span className="mcard-repo">
                        {s.owner}/{s.repo}
                      </span>
                      {st === "done" ? (
                        <span className="mcard-done">
                          <Check size={13} strokeWidth={2.4} />
                          已安装
                        </span>
                      ) : st === "installing" ? (
                        <button className="mcard-install" disabled>
                          <RefreshCw size={12} className="spin-i" />
                          安装中
                        </button>
                      ) : (
                        <button className="mcard-install" onClick={() => install(s)}>
                          <Download size={12} strokeWidth={2} />
                          安装
                        </button>
                      )}
                    </div>
                    {st === "error" && <div className="mcard-err">{errs[s.id]}</div>}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
