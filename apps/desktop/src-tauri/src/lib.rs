// Tauri commands for Open-Code-RenPy-UI.
//
// All filesystem operations are scoped to the project root that the user
// picks. Attempts to escape the root (via `..` or absolute paths) are
// rejected — see `resolve_within`.

use std::fs;
use std::path::{Component, Path, PathBuf};
use std::sync::Mutex;
use std::time::Duration;

use notify::RecursiveMode;
use notify_debouncer_mini::new_debouncer;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::{Emitter, State};
use tauri_plugin_dialog::DialogExt;

#[derive(Default)]
struct ProjectRoot(Mutex<Option<PathBuf>>);

/// Holds the active filesystem watcher (if any). We hand the debouncer to
/// `Mutex` so we can replace it when the user opens a different project.
type Debouncer = notify_debouncer_mini::Debouncer<notify::RecommendedWatcher>;

#[derive(Default)]
struct WatcherSlot(Mutex<Option<Debouncer>>);

#[derive(Serialize, Deserialize)]
struct GeneratedFile {
    path: String,
    contents: String,
}

#[tauri::command]
fn ping() -> &'static str {
    "pong"
}

#[tauri::command]
fn app_version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

/// Show the system folder picker. On accept, register the chosen directory
/// as the active project root and return its absolute path. Returns `null`
/// if the user cancels.
#[tauri::command]
async fn project_open(
    app: tauri::AppHandle,
    state: State<'_, ProjectRoot>,
) -> Result<Option<String>, String> {
    let (tx, rx) = tokio::sync::oneshot::channel::<Option<PathBuf>>();
    app.dialog().file().pick_folder(move |selected| {
        let _ = tx.send(selected.and_then(|p| p.into_path().ok()));
    });
    let chosen = rx.await.map_err(|e| e.to_string())?;
    match chosen {
        Some(path) => {
            *state.0.lock().unwrap() = Some(path.clone());
            Ok(Some(path.to_string_lossy().into_owned()))
        }
        None => Ok(None),
    }
}

/// Create a new project at `location/name` (or pick a parent if `location`
/// is None) and seed it with a minimal spec.
#[tauri::command]
async fn project_create(
    app: tauri::AppHandle,
    state: State<'_, ProjectRoot>,
    name: String,
    renpy_package: String,
    location: Option<String>,
) -> Result<String, String> {
    let parent = match location {
        Some(loc) => PathBuf::from(loc),
        None => {
            let (tx, rx) = tokio::sync::oneshot::channel::<Option<PathBuf>>();
            app.dialog().file().pick_folder(move |selected| {
                let _ = tx.send(selected.and_then(|p| p.into_path().ok()));
            });
            rx.await.map_err(|e| e.to_string())?.ok_or_else(|| "no folder selected".to_string())?
        }
    };

    let root = parent.join(&name);
    fs::create_dir_all(root.join(".renpy-ui").join("scenes")).map_err(stringify)?;
    fs::create_dir_all(root.join(".renpy-ui").join("screens")).map_err(stringify)?;

    write_seed_file(&root, ".renpy-ui/project.json", &project_seed(&name, &renpy_package))?;
    write_seed_file(&root, ".renpy-ui/characters.json", CHARACTERS_SEED)?;
    write_seed_file(&root, ".renpy-ui/variables.json", VARIABLES_SEED)?;
    write_seed_file(&root, ".renpy-ui/assets.json", ASSETS_SEED)?;
    write_seed_file(&root, ".renpy-ui/scenes/start.json", START_SCENE_SEED)?;

    *state.0.lock().unwrap() = Some(root.clone());
    Ok(root.to_string_lossy().into_owned())
}

#[tauri::command]
fn spec_read(state: State<'_, ProjectRoot>, rel_path: String) -> Result<Option<String>, String> {
    let root = current_root(&state)?;
    let abs = resolve_within(&root, &rel_path)?;
    if !abs.exists() {
        return Ok(None);
    }
    fs::read_to_string(&abs).map(Some).map_err(stringify)
}

#[tauri::command]
fn spec_write(
    state: State<'_, ProjectRoot>,
    rel_path: String,
    contents: String,
) -> Result<(), String> {
    let root = current_root(&state)?;
    let abs = resolve_within(&root, &rel_path)?;
    if let Some(parent) = abs.parent() {
        fs::create_dir_all(parent).map_err(stringify)?;
    }
    write_atomic(&abs, &contents)
}

#[tauri::command]
fn spec_list_dir(state: State<'_, ProjectRoot>, rel_dir: String) -> Result<Vec<String>, String> {
    let root = current_root(&state)?;
    let abs = resolve_within(&root, &rel_dir)?;
    if !abs.exists() {
        return Ok(Vec::new());
    }
    let mut out = Vec::new();
    let entries = fs::read_dir(&abs).map_err(stringify)?;
    for entry in entries {
        let e = entry.map_err(stringify)?;
        if e.file_type().map_err(stringify)?.is_file() {
            let p = e.path();
            // Return paths relative to the project root.
            if let Ok(rel) = p.strip_prefix(&root) {
                out.push(rel.to_string_lossy().replace('\\', "/"));
            }
        }
    }
    out.sort();
    Ok(out)
}

#[derive(Serialize)]
struct ImportedAsset {
    ref_path: String,
    kind: String,
    size_bytes: u64,
    hash: String,
}

// Manual rename for a serde-friendly field name.
impl ImportedAsset {
    fn into_json(self) -> serde_json::Value {
        serde_json::json!({
            "ref": self.ref_path,
            "kind": self.kind,
            "sizeBytes": self.size_bytes,
            "hash": self.hash,
        })
    }
}

#[tauri::command]
async fn asset_import(
    app: tauri::AppHandle,
    state: State<'_, ProjectRoot>,
    kind_hint: Option<String>,
) -> Result<Vec<serde_json::Value>, String> {
    let root = current_root(&state)?;

    let (tx, rx) = tokio::sync::oneshot::channel::<Option<Vec<PathBuf>>>();
    let mut builder = app.dialog().file();
    if let Some(ref hint) = kind_hint {
        match hint.as_str() {
            "image" => builder = builder.add_filter("Images", &["png", "jpg", "jpeg", "webp"]),
            "audio" => builder = builder.add_filter("Audio", &["ogg", "wav", "mp3", "opus"]),
            "video" => builder = builder.add_filter("Video", &["webm", "mp4", "mkv"]),
            "font" => builder = builder.add_filter("Fonts", &["ttf", "otf", "woff", "woff2"]),
            _ => {}
        }
    }
    builder.pick_files(move |selected| {
        let paths: Option<Vec<PathBuf>> = selected.map(|files| {
            files.into_iter().filter_map(|f| f.into_path().ok()).collect()
        });
        let _ = tx.send(paths);
    });
    let chosen = rx.await.map_err(|e| e.to_string())?.unwrap_or_default();

    let mut out = Vec::with_capacity(chosen.len());
    for src in chosen {
        let ext = src
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| e.to_lowercase())
            .unwrap_or_default();
        let kind = classify_kind(&ext, kind_hint.as_deref());
        let subdir = subdir_for_kind(&kind, &ext);
        let file_name = src
            .file_name()
            .ok_or_else(|| "missing file name".to_string())?
            .to_string_lossy()
            .into_owned();

        // Resolve destination, ensuring uniqueness if a file with the same
        // name already exists.
        let mut rel = format!("{subdir}/{file_name}");
        let mut counter = 1u32;
        while root.join(&rel).exists() {
            rel = numbered_name(subdir, &file_name, counter);
            counter += 1;
        }
        let dest = root.join(&rel);
        if let Some(parent) = dest.parent() {
            fs::create_dir_all(parent).map_err(stringify)?;
        }
        fs::copy(&src, &dest).map_err(stringify)?;

        let meta = fs::metadata(&dest).map_err(stringify)?;
        let bytes = fs::read(&dest).map_err(stringify)?;
        let mut hasher = Sha256::new();
        hasher.update(&bytes);
        let hash = format!("{:x}", hasher.finalize());

        let asset = ImportedAsset {
            ref_path: rel,
            kind,
            size_bytes: meta.len(),
            hash,
        };
        out.push(asset.into_json());
    }

    Ok(out)
}

fn classify_kind(ext: &str, hint: Option<&str>) -> String {
    match hint {
        Some("image") | Some("audio") | Some("video") | Some("font") => return hint.unwrap().to_string(),
        _ => {}
    }
    match ext {
        "png" | "jpg" | "jpeg" | "webp" | "gif" => "image".to_string(),
        "ogg" | "wav" | "mp3" | "opus" | "flac" => "audio".to_string(),
        "webm" | "mp4" | "mkv" | "mov" => "video".to_string(),
        "ttf" | "otf" | "woff" | "woff2" => "font".to_string(),
        _ => "other".to_string(),
    }
}

fn subdir_for_kind(kind: &str, _ext: &str) -> &'static str {
    match kind {
        "image" => "images",
        "audio" => "audio",
        "video" => "video",
        "font" => "fonts",
        _ => "assets",
    }
}

fn numbered_name(subdir: &str, file_name: &str, counter: u32) -> String {
    if let Some((stem, ext)) = file_name.rsplit_once('.') {
        format!("{subdir}/{stem}-{counter}.{ext}")
    } else {
        format!("{subdir}/{file_name}-{counter}")
    }
}

/// Return the subset of `refs` that exist on disk relative to the project root.
#[tauri::command]
fn asset_check_exists(
    state: State<'_, ProjectRoot>,
    refs: Vec<String>,
) -> Result<Vec<String>, String> {
    let root = current_root(&state)?;
    let mut out = Vec::with_capacity(refs.len());
    for r in refs {
        let abs = match resolve_within(&root, &r) {
            Ok(p) => p,
            Err(_) => continue,
        };
        if abs.exists() {
            out.push(r);
        }
    }
    Ok(out)
}

/// Compute SHA-256 hashes for each ref. Files that don't exist are skipped
/// silently — caller pairs this with `asset_check_exists` for completeness.
#[tauri::command]
fn asset_hash_files(
    state: State<'_, ProjectRoot>,
    refs: Vec<String>,
) -> Result<Vec<(String, String)>, String> {
    let root = current_root(&state)?;
    let mut out = Vec::with_capacity(refs.len());
    for r in refs {
        let abs = match resolve_within(&root, &r) {
            Ok(p) => p,
            Err(_) => continue,
        };
        if !abs.exists() {
            continue;
        }
        let bytes = match fs::read(&abs) {
            Ok(b) => b,
            Err(_) => continue,
        };
        let mut hasher = Sha256::new();
        hasher.update(&bytes);
        out.push((r, format!("{:x}", hasher.finalize())));
    }
    Ok(out)
}

/// Start watching the project's spec directory and emit `spec-changed` events
/// when files outside our own writes change. The watcher lives for the rest
/// of the process; the previous one is dropped if a new project is opened.
///
/// Returns immediately. Events are debounced by 300ms.
#[tauri::command]
fn watch_start(
    app: tauri::AppHandle,
    state: State<'_, ProjectRoot>,
    watcher_state: State<'_, WatcherSlot>,
) -> Result<(), String> {
    let root = current_root(&state)?;
    let spec_dir = root.join(".renpy-ui");
    if !spec_dir.exists() {
        return Err(format!("spec dir does not exist: {}", spec_dir.display()));
    }
    let app_handle = app.clone();
    let mut debouncer = new_debouncer(Duration::from_millis(300), move |result: notify_debouncer_mini::DebounceEventResult| {
        if let Ok(events) = result {
            let paths: Vec<String> = events
                .iter()
                .map(|e| e.path.to_string_lossy().into_owned())
                .collect();
            let _ = app_handle.emit("spec-changed", &paths);
        }
    })
    .map_err(stringify)?;

    debouncer
        .watcher()
        .watch(&spec_dir, RecursiveMode::Recursive)
        .map_err(stringify)?;

    *watcher_state.0.lock().unwrap() = Some(debouncer);
    Ok(())
}

#[tauri::command]
fn watch_stop(watcher_state: State<'_, WatcherSlot>) -> Result<(), String> {
    *watcher_state.0.lock().unwrap() = None;
    Ok(())
}

#[tauri::command]
fn generated_write(
    state: State<'_, ProjectRoot>,
    files: Vec<GeneratedFile>,
) -> Result<(), String> {
    let root = current_root(&state)?;
    for file in files {
        let abs = resolve_within(&root, &file.path)?;
        if let Some(parent) = abs.parent() {
            fs::create_dir_all(parent).map_err(stringify)?;
        }
        // Skip writes when content is unchanged so Ren'Py's mtime cache
        // doesn't invalidate every save.
        if let Ok(existing) = fs::read_to_string(&abs) {
            if existing == file.contents {
                continue;
            }
        }
        write_atomic(&abs, &file.contents)?;
    }
    Ok(())
}

// ---------- helpers ----------

fn current_root(state: &State<'_, ProjectRoot>) -> Result<PathBuf, String> {
    state
        .0
        .lock()
        .unwrap()
        .clone()
        .ok_or_else(|| "no project opened".to_string())
}

/// Resolve `rel_path` against `root`, ensuring the result stays under `root`.
fn resolve_within(root: &Path, rel_path: &str) -> Result<PathBuf, String> {
    let rel = PathBuf::from(rel_path);
    if rel.is_absolute() {
        return Err(format!("path must be relative: {}", rel_path));
    }
    for c in rel.components() {
        if matches!(c, Component::ParentDir) {
            return Err(format!("path must not contain '..': {}", rel_path));
        }
    }
    Ok(root.join(rel))
}

fn write_atomic(path: &Path, contents: &str) -> Result<(), String> {
    let parent = path.parent().ok_or_else(|| "missing parent dir".to_string())?;
    let file_name = path
        .file_name()
        .ok_or_else(|| "missing file name".to_string())?
        .to_string_lossy()
        .into_owned();
    let tmp = parent.join(format!(".{}.tmp", file_name));
    fs::write(&tmp, contents).map_err(stringify)?;
    fs::rename(&tmp, path).map_err(stringify)?;
    Ok(())
}

fn write_seed_file(root: &Path, rel: &str, contents: &str) -> Result<(), String> {
    let abs = root.join(rel);
    if let Some(parent) = abs.parent() {
        fs::create_dir_all(parent).map_err(stringify)?;
    }
    fs::write(abs, contents).map_err(stringify)
}

fn stringify<E: std::fmt::Display>(e: E) -> String {
    e.to_string()
}

fn project_seed(name: &str, package: &str) -> String {
    format!(
        r#"{{
  "specVersion": "1.0.0",
  "id": "{id}",
  "name": "{name}",
  "renpyPackage": "{package}",
  "version": "0.1.0",
  "authors": [],
  "startLabel": "start",
  "locales": ["en"],
  "paths": {{
    "specDir": ".renpy-ui",
    "generatedDir": "game/generated",
    "assetsDir": "game"
  }},
  "renpy": {{
    "minVersion": "8.2.0",
    "buildWindows": true,
    "buildMac": true,
    "buildLinux": true,
    "buildWeb": false
  }},
  "scenes": [
    {{ "id": "01HYZSCENE_START", "label": "start", "file": "scenes/start.json" }}
  ],
  "screens": []
}}
"#,
        id = "01HYZPROJECT_NEW",
        name = name.replace('"', "\\\""),
        package = package,
    )
}

const CHARACTERS_SEED: &str = r#"{
  "specVersion": "1.0.0",
  "characters": []
}
"#;

const VARIABLES_SEED: &str = r#"{
  "specVersion": "1.0.0",
  "variables": []
}
"#;

const ASSETS_SEED: &str = r#"{
  "specVersion": "1.0.0",
  "assets": []
}
"#;

const START_SCENE_SEED: &str = r#"{
  "specVersion": "1.0.0",
  "id": "01HYZSCENE_START",
  "label": "start",
  "title": "Start",
  "entryNodeId": "n_start",
  "nodes": [
    { "id": "n_start", "type": "start", "position": { "x": 40, "y": 40 } },
    { "id": "n_end", "type": "end", "position": { "x": 280, "y": 40 } }
  ],
  "edges": [
    { "id": "e1", "source": "n_start", "target": "n_end" }
  ]
}
"#;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(ProjectRoot::default())
        .manage(WatcherSlot::default())
        .invoke_handler(tauri::generate_handler![
            ping,
            app_version,
            project_open,
            project_create,
            spec_read,
            spec_write,
            spec_list_dir,
            generated_write,
            asset_import,
            asset_check_exists,
            asset_hash_files,
            watch_start,
            watch_stop,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
