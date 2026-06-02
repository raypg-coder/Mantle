use serde::Serialize;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SkillEntry {
    pub id: String,
    pub source_id: String,
    pub path: String,
    pub name: String,
    pub description: String,
    pub version: Option<String>,
    pub enabled: bool,
    pub size_bytes: u64,
    pub modified_ms: i64,
    pub file_count: usize,
    pub has_scripts: bool,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SourceInfo {
    pub id: String,
    pub label: String,
    pub kind: String,
    pub path: String,
    pub exists: bool,
    pub skill_count: usize,
    pub size_bytes: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillMd {
    pub name: Option<String>,
    pub description: Option<String>,
    pub version: Option<String>,
    pub license: Option<String>,
    pub repository: Option<String>,
    pub author: Option<String>,
    pub body: String,
    pub raw: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileNode {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size_bytes: u64,
    pub children: Vec<FileNode>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FilePreview {
    pub path: String,
    pub content: String,
    pub truncated: bool,
    pub binary: bool,
    pub size_bytes: u64,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AuditFinding {
    pub pattern: String,
    pub file: String,
    pub line: usize,
    pub severity: String, // info | warning | danger
    pub context: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuditResult {
    pub level: String, // safe | caution | risk
    pub findings: Vec<AuditFinding>,
    pub trust_score: u32,
    pub scanned_files: usize,
}
