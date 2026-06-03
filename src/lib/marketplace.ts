// Skill marketplace catalog. Pulls live from public GitHub repos that follow
// the Claude Code `.claude-plugin/marketplace.json` standard. We surface skills
// that live *in the marketplace repo itself* (plugin source "./"), which is the
// directly-installable case.

export interface Marketplace {
  label: string;
  owner: string;
  repo: string;
  ref: string;
}

export interface MarketSkill {
  id: string;
  marketplace: string;
  owner: string;
  repo: string;
  ref: string;
  subpath: string; // e.g. "skills/xlsx"
  name: string;
  description: string;
}

// Curated, verified marketplaces (each has in-repo SKILL.md skills).
export const MARKETPLACES: Marketplace[] = [
  { label: "Anthropic 官方", owner: "anthropics", repo: "skills", ref: "main" },
];

const raw = (m: Marketplace, path: string) =>
  `https://raw.githubusercontent.com/${m.owner}/${m.repo}/${m.ref}/${path}`;

function parseDescription(md: string): string {
  const fm = md.match(/^﻿?---\s*\n([\s\S]*?)\n---/);
  const body = fm ? fm[1] : md;
  const line = body.split("\n").find((l) => /^description\s*:/i.test(l.trim()));
  if (!line) return "";
  return line
    .replace(/^[^:]*:/, "")
    .trim()
    .replace(/^["']|["']$/g, "");
}

async function fetchMarketplace(m: Marketplace): Promise<MarketSkill[]> {
  const mf = await fetch(raw(m, ".claude-plugin/marketplace.json")).then((r) => {
    if (!r.ok) throw new Error(`${m.owner}/${m.repo}: HTTP ${r.status}`);
    return r.json();
  });

  // collect in-repo skill subpaths (source "./" or "." or omitted)
  const subpaths = new Set<string>();
  for (const p of mf.plugins ?? []) {
    const src = typeof p.source === "string" ? p.source.replace(/^\.\//, "").replace(/\/$/, "") : "ext";
    if (src !== "" && src !== ".") continue; // skip plugins sourced from other repos (v2)
    for (const sp of p.skills ?? []) {
      subpaths.add(String(sp).replace(/^\.\//, "").replace(/\/$/, ""));
    }
  }

  return Promise.all(
    [...subpaths].map(async (subpath) => {
      const name = subpath.split("/").pop() || subpath;
      let description = "";
      try {
        const md = await fetch(raw(m, `${subpath}/SKILL.md`)).then((r) => (r.ok ? r.text() : ""));
        description = parseDescription(md);
      } catch {
        /* leave blank */
      }
      return {
        id: `${m.owner}/${m.repo}/${subpath}`,
        marketplace: m.label,
        owner: m.owner,
        repo: m.repo,
        ref: m.ref,
        subpath,
        name,
        description,
      };
    }),
  );
}

export async function fetchCatalog(): Promise<MarketSkill[]> {
  const results = await Promise.all(
    MARKETPLACES.map((m) => fetchMarketplace(m).catch(() => [] as MarketSkill[])),
  );
  return results.flat().sort((a, b) => a.name.localeCompare(b.name));
}
