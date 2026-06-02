use crate::model::{FileNode, FilePreview, SkillEntry, SkillMd};
use std::collections::hash_map::DefaultHasher;
use std::fs;
use std::hash::{Hash, Hasher};
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;
use walkdir::WalkDir;

const SCRIPT_EXTS: &[&str] = &["py", "js", "ts", "mjs", "cjs", "sh", "bash", "rb", "pl"];
const SKILL_FILE: &str = "SKILL.md";

fn hash_path(p: &str) -> String {
    let mut h = DefaultHasher::new();
    p.hash(&mut h);
    format!("{:016x}", h.finish())
}

fn modified_ms(p: &Path) -> i64 {
    fs::metadata(p)
        .and_then(|m| m.modified())
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

/// A directory is a skill if it (or its `.disabled` twin) contains SKILL.md.
fn skill_md_path(dir: &Path) -> Option<PathBuf> {
    let p = dir.join(SKILL_FILE);
    if p.is_file() {
        Some(p)
    } else {
        None
    }
}

/// Strip a trailing `.disabled` from a directory name for display.
fn display_dirname(dirname: &str) -> &str {
    dirname.strip_suffix(".disabled").unwrap_or(dirname)
}

/// Parse the leading `---` YAML frontmatter block. Only flat scalar keys are read.
pub fn parse_frontmatter(raw: &str) -> SkillMd {
    let mut md = SkillMd {
        name: None,
        description: None,
        version: None,
        license: None,
        repository: None,
        author: None,
        body: String::new(),
        raw: raw.to_string(),
    };

    let trimmed = raw.trim_start_matches('\u{feff}');
    if let Some(rest) = trimmed.strip_prefix("---") {
        // find the closing delimiter line
        if let Some(end) = rest.find("\n---") {
            let fm = &rest[..end];
            let body_start = end + "\n---".len();
            // body is everything after the closing fence's line
            let body = rest[body_start..]
                .splitn(2, '\n')
                .nth(1)
                .unwrap_or("")
                .to_string();
            md.body = body;
            for line in fm.lines() {
                let line = line.trim();
                if line.is_empty() || line.starts_with('#') {
                    continue;
                }
                if let Some((k, v)) = line.split_once(':') {
                    let key = k.trim().to_lowercase();
                    let val = v.trim().trim_matches(|c| c == '"' || c == '\'').to_string();
                    if val.is_empty() {
                        continue;
                    }
                    match key.as_str() {
                        "name" => md.name = Some(val),
                        "description" => md.description = Some(val),
                        "version" => md.version = Some(val),
                        "license" => md.license = Some(val),
                        "repository" | "repo" | "homepage" => md.repository = Some(val),
                        "author" | "authors" => md.author = Some(val),
                        _ => {}
                    }
                }
            }
            return md;
        }
    }
    // no frontmatter: whole file is body
    md.body = raw.to_string();
    md
}

struct DirStats {
    size: u64,
    files: usize,
    has_scripts: bool,
}

fn dir_stats(dir: &Path) -> DirStats {
    let mut size = 0u64;
    let mut files = 0usize;
    let mut has_scripts = false;
    for entry in WalkDir::new(dir)
        .max_depth(8)
        .into_iter()
        .filter_entry(|e| e.file_name() != ".git" && e.file_name() != "node_modules")
        .filter_map(|e| e.ok())
    {
        if entry.file_type().is_file() {
            files += 1;
            if let Ok(m) = entry.metadata() {
                size += m.len();
            }
            if let Some(ext) = entry.path().extension().and_then(|e| e.to_str()) {
                if SCRIPT_EXTS.contains(&ext.to_lowercase().as_str()) {
                    has_scripts = true;
                }
            }
        }
    }
    DirStats {
        size,
        files,
        has_scripts,
    }
}

fn entry_from_dir(dir: &Path, source_id: &str) -> Option<SkillEntry> {
    let md_path = skill_md_path(dir)?;
    let dirname = dir.file_name()?.to_str()?.to_string();
    let enabled = !dirname.ends_with(".disabled");

    let raw = fs::read_to_string(&md_path).unwrap_or_default();
    let fm = parse_frontmatter(&raw);

    let name = fm
        .name
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| display_dirname(&dirname).to_string());
    let description = fm.description.unwrap_or_default();

    let stats = dir_stats(dir);
    let path = dir.to_string_lossy().to_string();

    Some(SkillEntry {
        id: hash_path(&path),
        source_id: source_id.to_string(),
        path,
        name,
        description,
        version: fm.version,
        enabled,
        size_bytes: stats.size,
        modified_ms: modified_ms(&md_path),
        file_count: stats.files,
        has_scripts: stats.has_scripts,
    })
}

/// Scan a root directory; each immediate subdir holding a SKILL.md is a skill.
pub fn scan(root: &str, source_id: &str) -> Result<Vec<SkillEntry>, String> {
    let root_path = Path::new(root);
    if !root_path.is_dir() {
        return Ok(vec![]);
    }
    let mut out = Vec::new();
    for entry in fs::read_dir(root_path).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let p = entry.path();
        if p.is_dir() {
            if let Some(skill) = entry_from_dir(&p, source_id) {
                out.push(skill);
            }
        }
    }
    out.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(out)
}

/// Quick count of skills under a root (for source list).
pub fn count(root: &str) -> (usize, u64) {
    let root_path = Path::new(root);
    if !root_path.is_dir() {
        return (0, 0);
    }
    let mut n = 0usize;
    let mut size = 0u64;
    if let Ok(rd) = fs::read_dir(root_path) {
        for entry in rd.flatten() {
            let p = entry.path();
            if p.is_dir() && skill_md_path(&p).is_some() {
                n += 1;
                size += dir_stats(&p).size;
            }
        }
    }
    (n, size)
}

pub fn read_md(skill_path: &str) -> Result<SkillMd, String> {
    let md_path = Path::new(skill_path).join(SKILL_FILE);
    let raw = fs::read_to_string(&md_path).map_err(|e| e.to_string())?;
    Ok(parse_frontmatter(&raw))
}

fn build_tree(dir: &Path, depth: usize) -> Vec<FileNode> {
    if depth == 0 {
        return vec![];
    }
    let mut nodes = Vec::new();
    if let Ok(rd) = fs::read_dir(dir) {
        let mut entries: Vec<_> = rd.flatten().collect();
        entries.sort_by_key(|e| {
            let p = e.path();
            (!p.is_dir(), e.file_name().to_string_lossy().to_lowercase())
        });
        for entry in entries {
            let name = entry.file_name().to_string_lossy().to_string();
            if name == ".git" || name == "node_modules" {
                continue;
            }
            let p = entry.path();
            let is_dir = p.is_dir();
            let size = if is_dir {
                0
            } else {
                fs::metadata(&p).map(|m| m.len()).unwrap_or(0)
            };
            nodes.push(FileNode {
                name,
                path: p.to_string_lossy().to_string(),
                is_dir,
                size_bytes: size,
                children: if is_dir {
                    build_tree(&p, depth - 1)
                } else {
                    vec![]
                },
            });
        }
    }
    nodes
}

pub fn list_files(skill_path: &str) -> Result<Vec<FileNode>, String> {
    let p = Path::new(skill_path);
    if !p.is_dir() {
        return Err("skill path is not a directory".into());
    }
    Ok(build_tree(p, 6))
}

const MAX_PREVIEW_BYTES: usize = 512_000;

/// Read a single file for preview. Guards against oversized & binary files.
pub fn read_file(path: &str) -> Result<FilePreview, String> {
    let p = Path::new(path);
    if !p.is_file() {
        return Err("not a file".into());
    }
    let size = fs::metadata(p).map(|m| m.len()).unwrap_or(0);
    let bytes = fs::read(p).map_err(|e| e.to_string())?;

    // binary heuristic: NUL byte in the first chunk
    let head = &bytes[..bytes.len().min(8000)];
    let binary = head.contains(&0);
    if binary {
        return Ok(FilePreview {
            path: path.to_string(),
            content: String::new(),
            truncated: false,
            binary: true,
            size_bytes: size,
        });
    }

    let truncated = bytes.len() > MAX_PREVIEW_BYTES;
    let slice = &bytes[..bytes.len().min(MAX_PREVIEW_BYTES)];
    let content = String::from_utf8_lossy(slice).to_string();

    Ok(FilePreview {
        path: path.to_string(),
        content,
        truncated,
        binary: false,
        size_bytes: size,
    })
}

/// Enable/disable by renaming the directory's `.disabled` suffix. Returns new path.
pub fn toggle(skill_path: &str, enable: bool) -> Result<String, String> {
    let p = Path::new(skill_path);
    let parent = p.parent().ok_or("no parent directory")?;
    let name = p
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or("invalid directory name")?;

    let is_disabled = name.ends_with(".disabled");
    let new_name = if enable {
        if !is_disabled {
            return Ok(skill_path.to_string()); // already enabled
        }
        name.trim_end_matches(".disabled").to_string()
    } else {
        if is_disabled {
            return Ok(skill_path.to_string()); // already disabled
        }
        format!("{name}.disabled")
    };

    let new_path = parent.join(&new_name);
    if new_path.exists() {
        return Err(format!("target already exists: {}", new_path.display()));
    }
    fs::rename(p, &new_path).map_err(|e| e.to_string())?;
    Ok(new_path.to_string_lossy().to_string())
}

fn copy_dir(src: &Path, dst: &Path) -> Result<(), String> {
    fs::create_dir_all(dst).map_err(|e| e.to_string())?;
    for entry in fs::read_dir(src).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let from = entry.path();
        let to = dst.join(entry.file_name());
        if from.is_dir() {
            copy_dir(&from, &to)?;
        } else {
            fs::copy(&from, &to).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

/// Relocate a skill directory into `dest_root` (e.g. global ↔ project).
/// Preserves the `.disabled` suffix. Returns the new path.
pub fn move_skill(skill_path: &str, dest_root: &str) -> Result<String, String> {
    let src = Path::new(skill_path);
    if skill_md_path(src).is_none() {
        return Err("源目录不是有效 skill（缺少 SKILL.md）".into());
    }
    let name = src
        .file_name()
        .ok_or("invalid skill directory name")?;
    let dest_dir = Path::new(dest_root);
    fs::create_dir_all(dest_dir).map_err(|e| e.to_string())?;
    let dest = dest_dir.join(name);

    if dest == src {
        return Ok(skill_path.to_string());
    }
    if dest.exists() {
        return Err(format!("目标已存在同名 skill：{}", dest.display()));
    }

    // try a fast rename; fall back to copy+remove across filesystems
    if fs::rename(src, &dest).is_err() {
        copy_dir(src, &dest)?;
        fs::remove_dir_all(src).map_err(|e| e.to_string())?;
    }
    Ok(dest.to_string_lossy().to_string())
}

pub fn delete(skill_path: &str) -> Result<(), String> {
    let p = Path::new(skill_path);
    if !p.is_dir() {
        return Err("skill path is not a directory".into());
    }
    // guard: must contain a SKILL.md so we never nuke an arbitrary folder
    if skill_md_path(p).is_none() {
        return Err("refusing to delete: no SKILL.md found in this directory".into());
    }
    fs::remove_dir_all(p).map_err(|e| e.to_string())
}
