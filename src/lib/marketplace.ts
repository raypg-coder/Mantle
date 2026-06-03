// Skill marketplace catalog. Pulls live from public GitHub repos following the
// Claude Code `.claude-plugin/marketplace.json` standard.
//
// Two shapes are handled:
//   • in-repo skills  — plugin source "./" with a `skills:[paths]` array (the
//     skills live in the marketplace repo itself, e.g. anthropics/skills).
//     → one "skill" entry per path, installed by subpath.
//   • external plugins — plugin source { source:"github", repo:"owner/name" }
//     (community markets like netresearch / xiaolai). The referenced repo
//     bundles one or more skills. → one "plugin" entry, installed by pulling
//     every SKILL.md out of that repo.

export interface Marketplace {
  label: string;
  owner: string;
  repo: string;
  ref: string;
}

export interface MarketEntry {
  id: string;
  kind: "skill" | "plugin";
  marketplace: string;
  name: string;
  description: string;
  category?: string;
  owner: string; // skill: marketplace repo · plugin: referenced repo
  repo: string;
  ref: string; // skill kind only
  subpath: string; // skill kind only
}

// Curated, verified marketplaces.
export const MARKETPLACES: Marketplace[] = [
  { label: "Anthropic 官方", owner: "anthropics", repo: "skills", ref: "main" },
  { label: "Netresearch", owner: "netresearch", repo: "claude-code-marketplace", ref: "main" },
  { label: "xiaolai", owner: "xiaolai", repo: "claude-plugin-marketplace", ref: "main" },
];

const raw = (owner: string, repo: string, ref: string, path: string) =>
  `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${path}`;

function parseDescription(md: string): string {
  const fm = md.match(/^﻿?---\s*\n([\s\S]*?)\n---/);
  const body = fm ? fm[1] : md;
  const line = body.split("\n").find((l) => /^description\s*:/i.test(l.trim()));
  if (!line) return "";
  return line.replace(/^[^:]*:/, "").trim().replace(/^["']|["']$/g, "");
}

async function fetchMarketplace(m: Marketplace): Promise<MarketEntry[]> {
  const mf = await fetch(raw(m.owner, m.repo, m.ref, ".claude-plugin/marketplace.json")).then((r) => {
    if (!r.ok) throw new Error(`${m.owner}/${m.repo}: HTTP ${r.status}`);
    return r.json();
  });

  const entries: MarketEntry[] = [];
  for (const p of mf.plugins ?? []) {
    const src = p.source;
    if (typeof src === "string") {
      const rel = src.replace(/^\.\/?/, "").replace(/\/$/, "");
      if (rel !== "") continue; // relpath subdir plugins (single-file md skills) — skip for now
      for (const sp of p.skills ?? []) {
        const subpath = String(sp).replace(/^\.\//, "").replace(/\/$/, "");
        if (!subpath || subpath.endsWith(".md")) continue; // only SKILL.md directories
        entries.push({
          id: `${m.owner}/${m.repo}/${subpath}`,
          kind: "skill",
          marketplace: m.label,
          name: subpath.split("/").pop() || subpath,
          description: "",
          owner: m.owner,
          repo: m.repo,
          ref: m.ref,
          subpath,
        });
      }
    } else if (src && typeof src === "object" && typeof src.repo === "string") {
      const [o, r] = src.repo.split("/");
      if (!o || !r) continue;
      entries.push({
        id: `plugin:${o}/${r}`,
        kind: "plugin",
        marketplace: m.label,
        name: p.name || r,
        description: p.description || "",
        category: p.category,
        owner: o,
        repo: r,
        ref: "",
        subpath: "",
      });
    }
  }

  // fill descriptions for in-repo skill entries from their SKILL.md
  await Promise.all(
    entries
      .filter((e) => e.kind === "skill" && !e.description)
      .map(async (e) => {
        try {
          const md = await fetch(raw(e.owner, e.repo, e.ref, `${e.subpath}/SKILL.md`)).then((r) =>
            r.ok ? r.text() : "",
          );
          e.description = parseDescription(md);
        } catch {
          /* leave blank */
        }
      }),
  );

  return entries;
}

export async function fetchCatalog(): Promise<MarketEntry[]> {
  const results = await Promise.all(
    MARKETPLACES.map((m) => fetchMarketplace(m).catch(() => [] as MarketEntry[])),
  );
  // de-dupe by id, then sort
  const seen = new Set<string>();
  return results
    .flat()
    .filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)))
    .sort((a, b) => a.name.localeCompare(b.name));
}
