import { create } from "zustand";
import { api } from "./lib/api";
import type { AuditResult, SkillEntry, SourceInfo } from "./types";

export type FilterKey = "all" | "enabled" | "disabled" | "warnings";

let scanToken = 0; // guards the background audit loop against source switches

const BUILTIN_KINDS = new Set(["claude-global", "cursor", "codex"]);
const LS_KEY = "mantle.sources";

function loadExtraPaths(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(LS_KEY) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
function persistExtras(sources: SourceInfo[]) {
  const paths = sources.filter((s) => !BUILTIN_KINDS.has(s.kind)).map((s) => s.path);
  try {
    localStorage.setItem(LS_KEY, JSON.stringify([...new Set(paths)]));
  } catch {
    /* ignore */
  }
}
async function withExtras(builtins: SourceInfo[]): Promise<SourceInfo[]> {
  const extras = (
    await Promise.all(loadExtraPaths().map((p) => api.inspectPath(p).catch(() => null)))
  ).filter(Boolean) as SourceInfo[];
  const seen = new Set(builtins.map((s) => s.id));
  return [...builtins, ...extras.filter((s) => !seen.has(s.id))];
}

interface State {
  sources: SourceInfo[];
  activeSourceId: string | null;
  skills: SkillEntry[];
  selectedId: string | null;
  filter: FilterKey;
  query: string;
  audits: Record<string, AuditResult>;
  loadingSkills: boolean;
  refreshing: boolean;
  error: string | null;
  theme: "light" | "dark";
  pendingDelete: SkillEntry | null;
  pendingMove: SkillEntry | null;
  settingsOpen: boolean;
  marketOpen: boolean;

  init: () => Promise<void>;
  selectSource: (id: string) => Promise<void>;
  addSource: (path: string) => Promise<void>;
  removeSource: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
  selectSkill: (id: string) => void;
  setFilter: (f: FilterKey) => void;
  setQuery: (q: string) => void;
  toggle: (skill: SkillEntry) => Promise<void>;
  requestDelete: (skill: SkillEntry | null) => void;
  confirmDelete: () => Promise<void>;
  requestMove: (skill: SkillEntry | null) => void;
  moveSkill: (skill: SkillEntry, destSourceId: string) => Promise<void>;
  toggleTheme: () => void;
  setSettingsOpen: (open: boolean) => void;
  setMarketOpen: (open: boolean) => void;
}

async function loadSkillsFor(set: any, get: any, source: SourceInfo) {
  const token = ++scanToken;
  set({ loadingSkills: true, error: null, skills: [], selectedId: null });
  try {
    const skills = await api.scanSkills(source.path, source.id);
    if (token !== scanToken) return; // a newer scan superseded us
    set({
      skills,
      loadingSkills: false,
      selectedId: skills.length ? skills[0].id : null,
    });
    // progressively fill audit badges in the background
    for (const s of skills) {
      if (token !== scanToken) return;
      if (get().audits[s.path]) continue;
      try {
        const audit = await api.auditSkill(s.path);
        if (token !== scanToken) return;
        set((st: State) => ({ audits: { ...st.audits, [s.path]: audit } }));
      } catch {
        /* skip unreadable skill */
      }
    }
  } catch (e) {
    if (token !== scanToken) return;
    set({ loadingSkills: false, error: String(e) });
  }
}

export const useStore = create<State>((set, get) => ({
  sources: [],
  activeSourceId: null,
  skills: [],
  selectedId: null,
  filter: "all",
  query: "",
  audits: {},
  loadingSkills: false,
  refreshing: false,
  error: null,
  theme: "light",
  pendingDelete: null,
  pendingMove: null,
  settingsOpen: false,
  marketOpen: false,

  init: async () => {
    try {
      const sources = await withExtras(await api.listSources());
      const first =
        sources.find((s) => s.exists && s.skillCount > 0) ??
        sources.find((s) => s.exists) ??
        sources[0];
      set({ sources, activeSourceId: first?.id ?? null });
      if (first) await loadSkillsFor(set, get, first);
    } catch (e) {
      set({ error: String(e) });
    }
  },

  selectSource: async (id) => {
    const source = get().sources.find((s) => s.id === id);
    if (!source) return;
    set({ activeSourceId: id, query: "", filter: "all" });
    await loadSkillsFor(set, get, source);
  },

  addSource: async (path) => {
    const source = await api.inspectPath(path);
    const existing = get().sources.find((s) => s.id === source.id);
    if (existing) {
      await get().selectSource(existing.id);
      return;
    }
    set((st) => ({ sources: [...st.sources, source], activeSourceId: source.id }));
    persistExtras(get().sources);
    await loadSkillsFor(set, get, source);
  },

  removeSource: async (id) => {
    const wasActive = get().activeSourceId === id;
    set((st) => ({ sources: st.sources.filter((s) => s.id !== id) }));
    persistExtras(get().sources);
    if (wasActive) {
      const next = get().sources.find((s) => s.exists) ?? get().sources[0];
      if (next) await get().selectSource(next.id);
      else set({ activeSourceId: null, skills: [], selectedId: null });
    }
  },

  refresh: async () => {
    const { activeSourceId } = get();
    set({ refreshing: true });
    try {
      const merged = await withExtras(await api.listSources());
      set({ sources: merged, audits: {} });
      const source = merged.find((s) => s.id === activeSourceId) ?? merged.find((s) => s.exists);
      if (source) {
        set({ activeSourceId: source.id });
        await loadSkillsFor(set, get, source);
      }
    } finally {
      set({ refreshing: false });
    }
  },

  selectSkill: (id) => set({ selectedId: id }),
  setFilter: (filter) => set({ filter }),
  setQuery: (query) => set({ query }),

  toggle: async (skill) => {
    const enable = !skill.enabled;
    try {
      const newPath = await api.toggleSkill(skill.path, enable);
      set((st) => {
        const audits = { ...st.audits };
        if (audits[skill.path]) {
          audits[newPath] = audits[skill.path];
          delete audits[skill.path];
        }
        return {
          audits,
          skills: st.skills.map((s) =>
            s.id === skill.id ? { ...s, enabled: enable, path: newPath } : s,
          ),
        };
      });
    } catch (e) {
      set({ error: String(e) });
    }
  },

  requestDelete: (skill) => set({ pendingDelete: skill }),

  confirmDelete: async () => {
    const skill = get().pendingDelete;
    if (!skill) return;
    try {
      await api.deleteSkill(skill.path);
      set((st) => {
        const skills = st.skills.filter((s) => s.id !== skill.id);
        const audits = { ...st.audits };
        delete audits[skill.path];
        return {
          skills,
          audits,
          pendingDelete: null,
          selectedId: st.selectedId === skill.id ? (skills[0]?.id ?? null) : st.selectedId,
          sources: st.sources.map((s) =>
            s.id === skill.sourceId ? { ...s, skillCount: Math.max(0, s.skillCount - 1) } : s,
          ),
        };
      });
    } catch (e) {
      set({ error: String(e), pendingDelete: null });
    }
  },

  requestMove: (skill) => set({ pendingMove: skill }),

  moveSkill: async (skill, destSourceId) => {
    const dest = get().sources.find((s) => s.id === destSourceId);
    if (!dest) return;
    try {
      await api.moveSkill(skill.path, dest.path);
      set({ pendingMove: null });
      await get().refresh(); // re-scan: skill left the active source, counts update
    } catch (e) {
      set({ error: String(e), pendingMove: null });
    }
  },

  toggleTheme: () => {
    const next = get().theme === "dark" ? "light" : "dark";
    document.documentElement.classList.toggle("dark", next === "dark");
    set({ theme: next });
  },

  setSettingsOpen: (open) => set({ settingsOpen: open }),
  setMarketOpen: (open) => set({ marketOpen: open }),
}));
