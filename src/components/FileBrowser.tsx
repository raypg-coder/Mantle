import { useEffect, useState } from "react";
import {
  ChevronRight,
  Folder,
  FolderOpen,
  FileText,
  FileCode,
  Image as ImageIcon,
  File as FileIcon,
} from "lucide-react";
import { api } from "../lib/api";
import { formatBytes } from "../lib/format";
import type { FileNode, FilePreview } from "../types";

const CODE_EXT = ["py", "js", "ts", "tsx", "jsx", "mjs", "cjs", "sh", "bash", "rb", "pl", "json", "yaml", "yml", "toml", "css"];
const TEXT_EXT = ["md", "txt", "csv", "rst", "log"];
const IMG_EXT = ["png", "jpg", "jpeg", "gif", "svg", "webp", "ico"];

function ext(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

function FileGlyph({ name }: { name: string }) {
  const e = ext(name);
  if (CODE_EXT.includes(e)) return <FileCode size={13} strokeWidth={1.7} />;
  if (TEXT_EXT.includes(e)) return <FileText size={13} strokeWidth={1.7} />;
  if (IMG_EXT.includes(e)) return <ImageIcon size={13} strokeWidth={1.7} />;
  return <FileIcon size={13} strokeWidth={1.7} />;
}

function TreeNode({
  node,
  depth,
  expanded,
  toggle,
  selected,
  onSelect,
}: {
  node: FileNode;
  depth: number;
  expanded: Set<string>;
  toggle: (p: string) => void;
  selected: string | null;
  onSelect: (n: FileNode) => void;
}) {
  const isOpen = expanded.has(node.path);
  if (node.isDir) {
    return (
      <>
        <button className="trow2" style={{ paddingLeft: 10 + depth * 14 }} onClick={() => toggle(node.path)}>
          <ChevronRight size={12} className={`tchev${isOpen ? " open" : ""}`} />
          {isOpen ? <FolderOpen size={13} strokeWidth={1.7} /> : <Folder size={13} strokeWidth={1.7} />}
          <span className="tname">{node.name}</span>
        </button>
        {isOpen &&
          node.children.map((c) => (
            <TreeNode
              key={c.path}
              node={c}
              depth={depth + 1}
              expanded={expanded}
              toggle={toggle}
              selected={selected}
              onSelect={onSelect}
            />
          ))}
      </>
    );
  }
  return (
    <button
      className={`trow2${selected === node.path ? " on" : ""}`}
      style={{ paddingLeft: 10 + depth * 14 + 12 }}
      onClick={() => onSelect(node)}
    >
      <FileGlyph name={node.name} />
      <span className="tname">{node.name}</span>
      <span className="tsize">{formatBytes(node.sizeBytes)}</span>
    </button>
  );
}

export function FileBrowser({ skillPath }: { skillPath: string }) {
  const [tree, setTree] = useState<FileNode[] | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string | null>(null);
  const [preview, setPreview] = useState<FilePreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setTree(null);
    setSelected(null);
    setPreview(null);
    api
      .listSkillFiles(skillPath)
      .then((t) => {
        if (cancelled) return;
        setTree(t);
        // auto-select SKILL.md if present at top level
        const md = t.find((n) => !n.isDir && n.name === "SKILL.md");
        if (md) selectFile(md);
      })
      .catch(() => !cancelled && setTree([]));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skillPath]);

  function toggle(p: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(p) ? next.delete(p) : next.add(p);
      return next;
    });
  }

  function selectFile(n: FileNode) {
    setSelected(n.path);
    setLoadingPreview(true);
    setPreview(null);
    api
      .readFile(n.path)
      .then(setPreview)
      .catch(() => setPreview(null))
      .finally(() => setLoadingPreview(false));
  }

  const rel = selected ? selected.slice(skillPath.length).replace(/^\//, "") : "";

  return (
    <div className="filebrowser">
      <div className="tree">
        {tree === null ? (
          <>
            <div className="skel" style={{ height: 22 }} />
            <div className="skel" style={{ height: 22 }} />
            <div className="skel" style={{ height: 22 }} />
          </>
        ) : tree.length === 0 ? (
          <div className="es" style={{ padding: 12 }}>这个目录是空的。</div>
        ) : (
          tree.map((n) => (
            <TreeNode
              key={n.path}
              node={n}
              depth={0}
              expanded={expanded}
              toggle={toggle}
              selected={selected}
              onSelect={selectFile}
            />
          ))
        )}
      </div>

      {selected && (
        <div className="fileview">
          <div className="fileview-head">
            <span className="fv-path">{rel}</span>
            {preview && <span className="fv-size">{formatBytes(preview.sizeBytes)}</span>}
          </div>
          {loadingPreview ? (
            <div className="skel" style={{ height: 80, margin: "8px 0 0" }} />
          ) : preview?.binary ? (
            <div className="fv-note">二进制文件，不予预览。</div>
          ) : preview ? (
            <pre className="fileview-body">
              {preview.content}
              {preview.truncated && "\n\n… 文件过大，仅显示前 500 KB"}
            </pre>
          ) : (
            <div className="fv-note">无法读取该文件。</div>
          )}
        </div>
      )}
    </div>
  );
}
