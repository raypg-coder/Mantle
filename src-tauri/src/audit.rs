use crate::model::{AuditFinding, AuditResult};
use std::fs;
use std::path::Path;
use walkdir::WalkDir;

const SCANNABLE_EXTS: &[&str] = &["py", "js", "ts", "mjs", "cjs", "sh", "bash", "rb", "pl"];
const MAX_FINDINGS: usize = 120;
const MAX_FILE_BYTES: u64 = 2_000_000;

/// (needle, severity, label). Order matters only for display; severity drives the level.
const PATTERNS: &[(&str, &str, &str)] = &[
    // 🔴 arbitrary command / code execution
    ("subprocess", "danger", "subprocess"),
    ("os.system", "danger", "os.system"),
    ("os.popen", "danger", "os.popen"),
    ("child_process", "danger", "child_process"),
    ("shell=True", "danger", "shell=True"),
    ("eval(", "danger", "eval()"),
    ("exec(", "danger", "exec()"),
    ("Function(", "danger", "Function()"),
    ("pickle.load", "danger", "pickle.load"),
    ("rm -rf", "danger", "rm -rf"),
    // 🟡 network
    ("requests.", "warning", "requests.*"),
    ("urllib", "warning", "urllib"),
    ("httpx", "warning", "httpx"),
    ("socket.", "warning", "socket.*"),
    ("fetch(", "warning", "fetch()"),
    ("http.client", "warning", "http.client"),
    // 🟡 filesystem mutation
    ("writeFile", "warning", "writeFile"),
    ("fs.write", "warning", "fs.write"),
    ("os.makedirs", "warning", "os.makedirs"),
    ("os.mkdir", "warning", "os.mkdir"),
    ("os.remove", "warning", "os.remove"),
    ("os.unlink", "warning", "os.unlink"),
    ("shutil.", "warning", "shutil.*"),
    ("chmod", "warning", "chmod"),
    // 🟢 generally-safe data handling
    ("json.load", "info", "json.load"),
    ("yaml.safe_load", "info", "yaml.safe_load"),
    ("csv.", "info", "csv.*"),
    ("hashlib", "info", "hashlib"),
    ("BeautifulSoup", "info", "BeautifulSoup"),
];

fn sev_rank(s: &str) -> u8 {
    match s {
        "danger" => 3,
        "warning" => 2,
        "info" => 1,
        _ => 0,
    }
}

fn detect_open_write(line: &str) -> bool {
    line.contains("open(")
        && (line.contains("'w'")
            || line.contains("\"w\"")
            || line.contains("'a'")
            || line.contains("\"a\"")
            || line.contains("'wb'")
            || line.contains("\"wb\""))
}

pub fn audit(skill_path: &str) -> Result<AuditResult, String> {
    let root = Path::new(skill_path);
    if !root.is_dir() {
        return Err("skill path is not a directory".into());
    }

    let mut findings: Vec<AuditFinding> = Vec::new();
    let mut scanned_files = 0usize;

    'walk: for entry in WalkDir::new(root)
        .max_depth(8)
        .into_iter()
        .filter_entry(|e| e.file_name() != ".git" && e.file_name() != "node_modules")
        .filter_map(|e| e.ok())
    {
        if !entry.file_type().is_file() {
            continue;
        }
        let ext = match entry.path().extension().and_then(|e| e.to_str()) {
            Some(e) => e.to_lowercase(),
            None => continue,
        };
        if !SCANNABLE_EXTS.contains(&ext.as_str()) {
            continue;
        }
        if entry.metadata().map(|m| m.len()).unwrap_or(0) > MAX_FILE_BYTES {
            continue;
        }
        let content = match fs::read_to_string(entry.path()) {
            Ok(c) => c,
            Err(_) => continue,
        };
        scanned_files += 1;

        let rel = entry
            .path()
            .strip_prefix(root)
            .unwrap_or(entry.path())
            .to_string_lossy()
            .to_string();

        for (lineno, line) in content.lines().enumerate() {
            let context: String = line.trim().chars().take(160).collect();

            for (needle, sev, label) in PATTERNS {
                if line.contains(needle) {
                    findings.push(AuditFinding {
                        pattern: label.to_string(),
                        file: rel.clone(),
                        line: lineno + 1,
                        severity: sev.to_string(),
                        context: context.clone(),
                    });
                }
            }
            if detect_open_write(line) {
                findings.push(AuditFinding {
                    pattern: "open(…, 'w')".to_string(),
                    file: rel.clone(),
                    line: lineno + 1,
                    severity: "warning".to_string(),
                    context: context.clone(),
                });
            }

            if findings.len() >= MAX_FINDINGS {
                break 'walk;
            }
        }
    }

    // level = max severity
    let max_rank = findings.iter().map(|f| sev_rank(&f.severity)).max().unwrap_or(0);
    let level = match max_rank {
        3 => "risk",
        2 => "caution",
        _ => "safe",
    }
    .to_string();

    // trust score: 100 minus weighted findings, clamped
    let mut score: i32 = 100;
    for f in &findings {
        score -= match f.severity.as_str() {
            "danger" => 22,
            "warning" => 4,
            "info" => 1,
            _ => 0,
        };
    }
    let trust_score = score.clamp(0, 100) as u32;

    Ok(AuditResult {
        level,
        findings,
        trust_score,
        scanned_files,
    })
}
