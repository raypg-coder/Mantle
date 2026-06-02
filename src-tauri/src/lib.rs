mod audit;
mod model;
mod skills;

use model::{AuditResult, FileNode, FilePreview, SkillEntry, SkillMd, SourceInfo};
use std::path::PathBuf;

/// Candidate skill roots we know how to read. Existing ones get live counts.
fn candidate_sources() -> Vec<(String, String, String, PathBuf)> {
    let home = dirs::home_dir().unwrap_or_default();
    vec![
        (
            "claude-global".into(),
            "Claude · Global".into(),
            "claude-global".into(),
            home.join(".claude").join("skills"),
        ),
        (
            "cursor".into(),
            "Cursor".into(),
            "cursor".into(),
            home.join(".cursor").join("skills"),
        ),
        (
            "codex".into(),
            "Codex".into(),
            "codex".into(),
            home.join(".codex").join("skills"),
        ),
    ]
}

#[tauri::command]
fn list_sources() -> Vec<SourceInfo> {
    candidate_sources()
        .into_iter()
        .map(|(id, label, kind, path)| {
            let path_str = path.to_string_lossy().to_string();
            let exists = path.is_dir();
            let (skill_count, size_bytes) = if exists {
                skills::count(&path_str)
            } else {
                (0, 0)
            };
            SourceInfo {
                id,
                label,
                kind,
                path: path_str,
                exists,
                skill_count,
                size_bytes,
            }
        })
        .collect()
}

#[tauri::command]
fn scan_skills(root: String, source_id: String) -> Result<Vec<SkillEntry>, String> {
    skills::scan(&root, &source_id)
}

/// Resolve a user-picked folder into a skills source. Detects whether they
/// pointed at a project root (has `.claude/skills`), a `.claude/skills` dir
/// directly, or an arbitrary folder of skills.
#[tauri::command]
fn inspect_path(path: String) -> SourceInfo {
    let p = PathBuf::from(&path);
    let claude_skills = p.join(".claude").join("skills");

    let (root, kind): (PathBuf, &str) = if claude_skills.is_dir() {
        (claude_skills, "claude-project")
    } else if p.ends_with("skills") && p.parent().map(|pp| pp.ends_with(".claude")).unwrap_or(false) {
        (p.clone(), "claude-project")
    } else {
        (p.clone(), "custom")
    };

    let label = if kind == "claude-project" {
        // root = <project>/.claude/skills → project name is two levels up
        root.parent()
            .and_then(|c| c.parent())
            .and_then(|pr| pr.file_name())
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "Project".into())
    } else {
        p.file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| path.clone())
    };

    let root_str = root.to_string_lossy().to_string();
    let exists = root.is_dir();
    let (skill_count, size_bytes) = if exists { skills::count(&root_str) } else { (0, 0) };

    SourceInfo {
        id: format!("{kind}:{root_str}"),
        label,
        kind: kind.to_string(),
        path: root_str,
        exists,
        skill_count,
        size_bytes,
    }
}

#[tauri::command]
fn read_skill_md(path: String) -> Result<SkillMd, String> {
    skills::read_md(&path)
}

#[tauri::command]
fn list_skill_files(path: String) -> Result<Vec<FileNode>, String> {
    skills::list_files(&path)
}

#[tauri::command]
fn read_file(path: String) -> Result<FilePreview, String> {
    skills::read_file(&path)
}

#[tauri::command]
fn audit_skill(path: String) -> Result<AuditResult, String> {
    audit::audit(&path)
}

#[tauri::command]
fn toggle_skill(path: String, enable: bool) -> Result<String, String> {
    skills::toggle(&path, enable)
}

#[tauri::command]
fn delete_skill(path: String) -> Result<(), String> {
    skills::delete(&path)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            list_sources,
            scan_skills,
            inspect_path,
            read_skill_md,
            list_skill_files,
            read_file,
            audit_skill,
            toggle_skill,
            delete_skill
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
