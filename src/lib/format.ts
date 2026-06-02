import type { AuditLevel } from "../types";

export function formatBytes(n: number): string {
  if (n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1);
  const v = n / Math.pow(1024, i);
  return `${v >= 100 || i === 0 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}

export function relativeTime(ms: number): string {
  if (!ms) return "—";
  const diff = Date.now() - ms;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "刚刚";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} 分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小时前`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} 天前`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo} 个月前`;
  return `${Math.floor(mo / 12)} 年前`;
}

/** Short relative for the dense list rows: 25d / 2mo / 1y */
export function relativeShort(ms: number): string {
  if (!ms) return "—";
  const day = Math.floor((Date.now() - ms) / 86_400_000);
  if (day < 1) return "今天";
  if (day < 30) return `${day}d`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo`;
  return `${Math.floor(mo / 12)}y`;
}

export function initial(name: string): string {
  const c = name.trim()[0];
  return c ? c.toUpperCase() : "?";
}

export const AUDIT_LABEL: Record<AuditLevel, string> = {
  safe: "SAFE",
  caution: "CAUTION",
  risk: "RISK",
};

export function trustVerdict(score: number): { tag: string; rest: string } {
  if (score >= 85) return { tag: "低风险", rest: "安心使用，建议保持启用" };
  if (score >= 60) return { tag: "中等风险", rest: "建议先看一眼审查发现" };
  if (score >= 35) return { tag: "较高风险", rest: "谨慎启用，确认行为后再用" };
  return { tag: "高风险", rest: "包含危险调用，建议禁用或卸载" };
}

/** 0–5 dot breakdown derived from real signals. */
export function trustBreakdown(opts: {
  score: number;
  hasScripts: boolean;
  scannedFiles: number;
  modifiedMs: number;
}): { nm: string; on: number }[] {
  const codeSafety = Math.max(1, Math.round(opts.score / 20));
  const provenance = 4; // local install; refined once we track origin
  const maintenance = opts.scannedFiles > 0 || opts.hasScripts ? 4 : 5;
  const days = opts.modifiedMs ? (Date.now() - opts.modifiedMs) / 86_400_000 : 999;
  const recency = days < 14 ? 5 : days < 60 ? 4 : days < 180 ? 3 : days < 365 ? 2 : 1;
  return [
    { nm: "代码安全", on: Math.min(5, codeSafety) },
    { nm: "来源可信", on: provenance },
    { nm: "活跃维护", on: maintenance },
    { nm: "近期更新", on: recency },
  ];
}
