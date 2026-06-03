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

function fmValue(fmBlock: string, key: string): string | undefined {
  const line = fmBlock.split("\n").find((l) => new RegExp(`^${key}\\s*:`, "i").test(l.trim()));
  if (!line) return undefined;
  const v = line.replace(/^[^:]*:/, "").trim().replace(/^["']|["']$/g, "");
  return v || undefined;
}

function splitFrontmatter(md: string): { fm: string; body: string } {
  const m = md.match(/^﻿?---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  return m ? { fm: m[1], body: m[2] } : { fm: "", body: md };
}

function parseDescription(md: string): string {
  return fmValue(splitFrontmatter(md).fm, "description") ?? "";
}

export interface EntryDetail {
  repoUrl: string;
  version?: string;
  license?: string;
  author?: string;
  description?: string;
  body?: string; // skill: SKILL.md markdown body
  files?: string[]; // skill: top-level files
  skills?: { name: string; path: string }[]; // plugin: bundled skills
  readme?: string; // plugin: README markdown
}

const decodeB64 = (s: string) => {
  try {
    return decodeURIComponent(escape(atob(s.replace(/\n/g, ""))));
  } catch {
    return "";
  }
};

export async function fetchEntryDetail(e: MarketEntry): Promise<EntryDetail> {
  const repoUrl = `https://github.com/${e.owner}/${e.repo}`;

  if (e.kind === "skill") {
    const md = await fetch(raw(e.owner, e.repo, e.ref, `${e.subpath}/SKILL.md`)).then((r) =>
      r.ok ? r.text() : "",
    );
    const { fm, body } = splitFrontmatter(md);
    let files: string[] = [];
    try {
      const list = await fetch(
        `https://api.github.com/repos/${e.owner}/${e.repo}/contents/${e.subpath}?ref=${e.ref}`,
      ).then((r) => (r.ok ? r.json() : []));
      if (Array.isArray(list)) {
        files = list
          .map((f: any) => (f.type === "dir" ? `${f.name}/` : f.name))
          .sort((a, b) => (a.endsWith("/") === b.endsWith("/") ? a.localeCompare(b) : a.endsWith("/") ? -1 : 1));
      }
    } catch {
      /* rate-limited or offline — show without file list */
    }
    return {
      repoUrl,
      version: fmValue(fm, "version"),
      license: fmValue(fm, "license"),
      author: fmValue(fm, "author") ?? fmValue(fm, "authors"),
      description: fmValue(fm, "description"),
      body: body.trim(),
      files,
    };
  }

  // plugin: enumerate bundled skills from the referenced repo + its README
  const skills: { name: string; path: string }[] = [];
  let readme = "";
  try {
    const tree = await fetch(
      `https://api.github.com/repos/${e.owner}/${e.repo}/git/trees/HEAD?recursive=1`,
    ).then((r) => (r.ok ? r.json() : { tree: [] }));
    for (const t of tree.tree ?? []) {
      if (t.type === "blob" && /(^|\/)SKILL\.md$/.test(t.path)) {
        const dir = t.path.replace(/\/SKILL\.md$/, "");
        skills.push({ name: dir.split("/").pop() || dir, path: dir });
      }
    }
  } catch {
    /* ignore */
  }
  try {
    const rd = await fetch(`https://api.github.com/repos/${e.owner}/${e.repo}/readme`).then((r) =>
      r.ok ? r.json() : null,
    );
    if (rd?.content) readme = decodeB64(rd.content);
  } catch {
    /* ignore */
  }
  return { repoUrl, description: e.description, skills, readme };
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
