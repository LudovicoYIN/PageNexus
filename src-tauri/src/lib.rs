use std::{
    cmp::Reverse,
    collections::HashMap,
    fs,
    io::{BufRead, BufReader, Write},
    path::{Path, PathBuf},
    process::{Child, ChildStdin, Command, Stdio},
    sync::{mpsc, Arc, Mutex},
    time::Duration,
};

use chrono::Utc;
use reqwest::StatusCode;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::{path::BaseDirectory, AppHandle, Emitter, Manager, State};
use uuid::Uuid;

const PACKY_API_BASE_URL: &str = "https://www.packyapi.com/v1";
const PACKY_MODEL_ID: &str = "gpt-5.4-low";

#[derive(Clone)]
struct AppState {
    data_dir: PathBuf,
    db_path: PathBuf,
    agents: Arc<Mutex<HashMap<String, AgentProcess>>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(default)]
struct AppSettings {
    packy_api_key: String,
    packy_api_base_url: String,
    packy_model_id: String,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            packy_api_key: String::new(),
            packy_api_base_url: PACKY_API_BASE_URL.to_string(),
            packy_model_id: PACKY_MODEL_ID.to_string(),
        }
    }
}

struct AgentProcess {
    child: Arc<Mutex<Child>>,
    stdin: Arc<Mutex<ChildStdin>>,
    pending: Arc<Mutex<HashMap<String, mpsc::Sender<serde_json::Value>>>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct KnowledgeBase {
    id: String,
    name: String,
    theme: String,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct DocumentRecord {
    id: String,
    kb_id: String,
    file_name: String,
    source_path: String,
    page_count: i64,
    status: String,
    error_message: Option<String>,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ParsedPage {
    page_number: i64,
    text: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct SearchMatch {
    doc_id: String,
    doc_name: String,
    page_number: i64,
    snippet: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct ReadPagesResult {
    doc_id: String,
    file_name: String,
    page_count: i64,
    start_page: i64,
    end_page: i64,
    continuation: Option<i64>,
    pages: Vec<ParsedPage>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct PagePreview {
    doc_id: String,
    file_name: String,
    page_count: i64,
    page_number: i64,
    text: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct ModelHealth {
    backend_status: String,
    model_status: String,
    detail: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct ChatSessionPayload {
    title: String,
    messages: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ParsedDocumentFile {
    doc_id: String,
    file_name: String,
    page_count: i64,
    pages: Vec<ParsedPage>,
}

#[derive(Debug, Serialize, Deserialize)]
struct ParserSummary {
    page_count: i64,
    empty_pages: i64,
}

#[derive(Debug, Deserialize)]
struct ModelsEnvelope {
    data: Vec<ModelItem>,
}

#[derive(Debug, Deserialize)]
struct ModelItem {
    id: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct CodingAgentBootstrap {
    state: serde_json::Value,
    messages: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct CodingAgentEventEnvelope {
    kb_id: String,
    payload: serde_json::Value,
}

fn now() -> String {
    Utc::now().to_rfc3339()
}

fn db_connection(db_path: &Path) -> Result<Connection, String> {
    Connection::open(db_path).map_err(|error| error.to_string())
}

fn init_schema(db_path: &Path) -> Result<(), String> {
    let connection = db_connection(db_path)?;
    connection
        .execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS knowledge_bases (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              theme TEXT NOT NULL,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS documents (
              id TEXT PRIMARY KEY,
              kb_id TEXT NOT NULL,
              file_name TEXT NOT NULL,
              source_path TEXT NOT NULL,
              page_count INTEGER NOT NULL DEFAULT 0,
              status TEXT NOT NULL,
              error_message TEXT,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              FOREIGN KEY(kb_id) REFERENCES knowledge_bases(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS chat_sessions (
              id TEXT PRIMARY KEY,
              kb_id TEXT NOT NULL UNIQUE,
              title TEXT NOT NULL,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              FOREIGN KEY(kb_id) REFERENCES knowledge_bases(id) ON DELETE CASCADE
            );
        "#,
        )
        .map_err(|error| error.to_string())
}

fn row_to_knowledge_base(row: &rusqlite::Row<'_>) -> rusqlite::Result<KnowledgeBase> {
    Ok(KnowledgeBase {
        id: row.get(0)?,
        name: row.get(1)?,
        theme: row.get(2)?,
        created_at: row.get(3)?,
        updated_at: row.get(4)?,
    })
}

fn row_to_document(row: &rusqlite::Row<'_>) -> rusqlite::Result<DocumentRecord> {
    Ok(DocumentRecord {
        id: row.get(0)?,
        kb_id: row.get(1)?,
        file_name: row.get(2)?,
        source_path: row.get(3)?,
        page_count: row.get(4)?,
        status: row.get(5)?,
        error_message: row.get(6)?,
        created_at: row.get(7)?,
        updated_at: row.get(8)?,
    })
}

fn knowledge_base_dir(state: &AppState, kb_id: &str) -> PathBuf {
    state.data_dir.join("kbs").join(kb_id)
}

fn documents_dir(state: &AppState, kb_id: &str) -> PathBuf {
    knowledge_base_dir(state, kb_id).join("docs")
}

fn document_dir(state: &AppState, kb_id: &str, doc_id: &str) -> PathBuf {
    documents_dir(state, kb_id).join(doc_id)
}

fn session_file_path(state: &AppState, kb_id: &str) -> PathBuf {
    knowledge_base_dir(state, kb_id).join("session.json")
}

fn settings_file_path(state: &AppState) -> PathBuf {
    state.data_dir.join("settings.json")
}

fn load_app_settings(state: &AppState) -> Result<AppSettings, String> {
    let path = settings_file_path(state);
    if !path.exists() {
        return Ok(AppSettings::default());
    }

    let contents = fs::read_to_string(&path).map_err(|error| error.to_string())?;
    serde_json::from_str::<AppSettings>(&contents).map_err(|error| error.to_string())
}

fn save_app_settings_file(state: &AppState, settings: &AppSettings) -> Result<(), String> {
    let path = settings_file_path(state);
    let contents = serde_json::to_string_pretty(settings).map_err(|error| error.to_string())?;
    fs::write(path, contents).map_err(|error| error.to_string())
}

fn parser_script_path(app: &AppHandle) -> PathBuf {
    let local = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../python/parse_pdf.py");
    if local.exists() {
        return local;
    }

    app.path()
        .resolve("python/parse_pdf.py", BaseDirectory::Resource)
        .ok()
        .filter(|path| path.exists())
        .unwrap_or(local)
}

fn python_binary_path(app: &AppHandle) -> PathBuf {
    if let Ok(explicit) = std::env::var("PAGENEXUS_PYTHON_BIN") {
        return PathBuf::from(explicit);
    }

    let local_runtime = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../python-runtime/bin/python3");
    if local_runtime.exists() {
        return local_runtime;
    }

    let local_windows_runtime = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../python-runtime/Scripts/python.exe");
    if local_windows_runtime.exists() {
        return local_windows_runtime;
    }

    let candidates = [
        app.path()
            .resolve("python-runtime/bin/python3", BaseDirectory::Resource)
            .ok(),
        app.path()
            .resolve("python-runtime/python.exe", BaseDirectory::Resource)
            .ok(),
        app.path()
            .resolve("python-runtime/Scripts/python.exe", BaseDirectory::Resource)
            .ok(),
    ];

    candidates
        .into_iter()
        .flatten()
        .find(|path| path.exists())
        .unwrap_or_else(|| PathBuf::from("python3"))
}

fn node_binary_path() -> PathBuf {
    if let Ok(explicit) = std::env::var("PAGENEXUS_NODE_BIN") {
        return PathBuf::from(explicit);
    }
    PathBuf::from("node")
}

fn coding_agent_script_path(app: &AppHandle) -> PathBuf {
    let local = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../node/coding-agent-rpc.mjs");
    if local.exists() {
        return local;
    }

    app.path()
        .resolve("node/coding-agent-rpc.mjs", BaseDirectory::Resource)
        .ok()
        .filter(|path| path.exists())
        .unwrap_or(local)
}

fn coding_agent_home_dir(state: &AppState, kb_id: &str) -> PathBuf {
    knowledge_base_dir(state, kb_id).join(".pagenexus-agent")
}

fn rpc_error_message(response: &serde_json::Value) -> String {
    response
        .get("error")
        .and_then(|value| value.as_str())
        .unwrap_or("coding agent request failed")
        .to_string()
}

fn send_rpc_request(
    process: &AgentProcess,
    mut command: serde_json::Value,
    timeout: Duration,
) -> Result<serde_json::Value, String> {
    let request_id = Uuid::new_v4().to_string();
    command["id"] = json!(request_id);

    let (sender, receiver) = mpsc::channel();
    process
        .pending
        .lock()
        .map_err(|_| "coding agent pending-map lock poisoned".to_string())?
        .insert(request_id.clone(), sender);

    let line = format!(
        "{}\n",
        serde_json::to_string(&command).map_err(|error| error.to_string())?
    );

    let write_result = (|| -> Result<(), String> {
        let mut stdin = process
            .stdin
            .lock()
            .map_err(|_| "coding agent stdin lock poisoned".to_string())?;
        stdin
            .write_all(line.as_bytes())
            .map_err(|error| error.to_string())?;
        stdin.flush().map_err(|error| error.to_string())
    })();

    if let Err(error) = write_result {
        let _ = process
            .pending
            .lock()
            .map(|mut pending| pending.remove(&request_id));
        return Err(error);
    }

    receiver
        .recv_timeout(timeout)
        .map_err(|_| format!("coding agent request timed out: {}", command["type"]))
}

fn agent_is_running(process: &AgentProcess) -> bool {
    process
        .child
        .lock()
        .ok()
        .and_then(|mut child| child.try_wait().ok())
        .flatten()
        .is_none()
}

fn spawn_coding_agent(app: &AppHandle, state: &AppState, kb_id: &str) -> Result<AgentProcess, String> {
    let kb_dir = knowledge_base_dir(state, kb_id);
    fs::create_dir_all(&kb_dir).map_err(|error| error.to_string())?;

    let agent_home = coding_agent_home_dir(state, kb_id);
    fs::create_dir_all(&agent_home).map_err(|error| error.to_string())?;

    let script = coding_agent_script_path(app);
    let node = node_binary_path();
    let settings = load_app_settings(state)?;
    let api_key = settings.packy_api_key.trim();
    if api_key.is_empty() {
        return Err("未配置 PackyAPI API Key，请先到设置页保存。".to_string());
    }

    let mut child = Command::new(node)
        .arg(script)
        .arg(&kb_dir)
        .arg(&agent_home)
        .current_dir(&kb_dir)
        .env("PACKY_API_KEY", api_key)
        .env("PACKY_API_BASE_URL", &settings.packy_api_base_url)
        .env("PACKY_MODEL_ID", &settings.packy_model_id)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| format!("无法启动 pi coding agent：{error}"))?;

    let stdin = child
        .stdin
        .take()
        .ok_or_else(|| "coding agent stdin unavailable".to_string())?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "coding agent stdout unavailable".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "coding agent stderr unavailable".to_string())?;

    let child = Arc::new(Mutex::new(child));
    let stdin = Arc::new(Mutex::new(stdin));
    let pending = Arc::new(Mutex::new(HashMap::<String, mpsc::Sender<serde_json::Value>>::new()));
    let stderr_buffer = Arc::new(Mutex::new(Vec::<String>::new()));

    {
        let pending = Arc::clone(&pending);
        let app = app.clone();
        let kb_id = kb_id.to_string();
        std::thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines() {
                let Ok(line) = line else { break };
                if line.trim().is_empty() {
                    continue;
                }

                let payload = serde_json::from_str::<serde_json::Value>(&line)
                    .unwrap_or_else(|_| json!({ "type": "raw", "line": line }));

                if payload.get("type").and_then(|value| value.as_str()) == Some("response") {
                    if let Some(id) = payload.get("id").and_then(|value| value.as_str()) {
                        if let Ok(mut waiters) = pending.lock() {
                            if let Some(sender) = waiters.remove(id) {
                                let _ = sender.send(payload.clone());
                            }
                        }
                    }
                }

                let _ = app.emit(
                    "coding-agent-event",
                    CodingAgentEventEnvelope {
                        kb_id: kb_id.clone(),
                        payload,
                    },
                );
            }

            let _ = app.emit(
                "coding-agent-event",
                CodingAgentEventEnvelope {
                    kb_id,
                    payload: json!({ "type": "process_exit" }),
                },
            );
        });
    }

    {
        let app = app.clone();
        let kb_id = kb_id.to_string();
        let stderr_buffer = Arc::clone(&stderr_buffer);
        std::thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines() {
                let Ok(line) = line else { break };
                if line.trim().is_empty() {
                    continue;
                }
                if let Ok(mut buffer) = stderr_buffer.lock() {
                    buffer.push(line.clone());
                    if buffer.len() > 200 {
                        buffer.remove(0);
                    }
                }
                let _ = app.emit(
                    "coding-agent-event",
                    CodingAgentEventEnvelope {
                        kb_id: kb_id.clone(),
                        payload: json!({ "type": "stderr", "line": line }),
                    },
                );
            }
        });
    }

    Ok(AgentProcess {
        child,
        stdin,
        pending,
    })
}

fn get_or_start_agent<'a>(
    app: &AppHandle,
    state: &'a AppState,
    kb_id: &str,
) -> Result<std::sync::MutexGuard<'a, HashMap<String, AgentProcess>>, String> {
    let mut agents = state
        .agents
        .lock()
        .map_err(|_| "coding agent map lock poisoned".to_string())?;

    let should_spawn = agents
        .get(kb_id)
        .map(|process| !agent_is_running(process))
        .unwrap_or(true);

    if should_spawn {
        agents.remove(kb_id);
        let process = spawn_coding_agent(app, state, kb_id)?;
        agents.insert(kb_id.to_string(), process);
    }

    Ok(agents)
}

fn coding_agent_bootstrap(process: &AgentProcess) -> Result<CodingAgentBootstrap, String> {
    let state_response = send_rpc_request(process, json!({ "type": "get_state" }), Duration::from_secs(20))?;
    if !state_response
        .get("success")
        .and_then(|value| value.as_bool())
        .unwrap_or(false)
    {
        return Err(rpc_error_message(&state_response));
    }

    let messages_response =
        send_rpc_request(process, json!({ "type": "get_messages" }), Duration::from_secs(20))?;
    if !messages_response
        .get("success")
        .and_then(|value| value.as_bool())
        .unwrap_or(false)
    {
        return Err(rpc_error_message(&messages_response));
    }

    Ok(CodingAgentBootstrap {
        state: state_response.get("data").cloned().unwrap_or_else(|| json!({})),
        messages: messages_response
            .get("data")
            .and_then(|data| data.get("messages"))
            .cloned()
            .unwrap_or_else(|| json!([])),
    })
}

fn stop_agent_process(process: AgentProcess) -> Result<(), String> {
    if let Ok(mut child) = process.child.lock() {
        child.kill().map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn read_parsed_document(state: &AppState, doc_id: &str) -> Result<(DocumentRecord, ParsedDocumentFile), String> {
    let connection = db_connection(&state.db_path)?;
    let document = connection
        .query_row(
            "SELECT id, kb_id, file_name, source_path, page_count, status, error_message, created_at, updated_at FROM documents WHERE id = ?1",
            [doc_id],
            row_to_document,
        )
        .map_err(|error| error.to_string())?;

    let pages_path = document_dir(state, &document.kb_id, &document.id).join("pages.json");
    let content = fs::read_to_string(&pages_path).map_err(|error| error.to_string())?;
    let parsed: ParsedDocumentFile = serde_json::from_str(&content).map_err(|error| error.to_string())?;

    Ok((document, parsed))
}

fn trimmed_line(line: &str, query: &str, terms: &[String]) -> Option<String> {
    let normalized = line.trim();
    if normalized.is_empty() {
        return None;
    }

    let lower = normalized.to_lowercase();
    if lower.contains(query) || terms.iter().any(|term| lower.contains(term)) {
        let shortened = if normalized.chars().count() > 220 {
            let mut snippet = normalized.chars().take(220).collect::<String>();
            snippet.push('…');
            snippet
        } else {
            normalized.to_string()
        };
        return Some(shortened);
    }

    None
}

fn score_page(text: &str, query: &str, terms: &[String]) -> (i64, Option<String>) {
    let lower = text.to_lowercase();
    let exact_count = lower.matches(query).count() as i64;
    let term_hits = terms.iter().filter(|term| lower.contains(term.as_str())).count() as i64;
    let score = exact_count * 100 + term_hits * 10;

    if score == 0 {
        return (0, None);
    }

    let snippet = text
        .lines()
        .find_map(|line| trimmed_line(line, query, terms))
        .or_else(|| {
            let compact = text.split_whitespace().collect::<Vec<_>>().join(" ");
            if compact.is_empty() {
                None
            } else {
                let snippet = compact.chars().take(220).collect::<String>();
                Some(if compact.chars().count() > 220 {
                    format!("{snippet}…")
                } else {
                    snippet
                })
            }
        });

    (score, snippet)
}

fn ensure_pdf(file_path: &str) -> Result<(), String> {
    if !file_path.to_lowercase().ends_with(".pdf") {
        return Err("当前仅支持 PDF 文件。".to_string());
    }
    Ok(())
}

fn random_theme(count: i64) -> &'static str {
    match count % 4 {
        0 => "green",
        1 => "yellow",
        2 => "blue",
        _ => "rose",
    }
}

#[tauri::command]
fn create_knowledge_base(name: String, state: State<'_, AppState>) -> Result<KnowledgeBase, String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err("知识库名称不能为空。".to_string());
    }

    let connection = db_connection(&state.db_path)?;
    let count: i64 = connection
        .query_row("SELECT COUNT(*) FROM knowledge_bases", [], |row| row.get(0))
        .map_err(|error| error.to_string())?;

    let kb = KnowledgeBase {
        id: Uuid::new_v4().to_string(),
        name: trimmed.to_string(),
        theme: random_theme(count).to_string(),
        created_at: now(),
        updated_at: now(),
    };

    connection
        .execute(
            "INSERT INTO knowledge_bases (id, name, theme, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![kb.id, kb.name, kb.theme, kb.created_at, kb.updated_at],
        )
        .map_err(|error| error.to_string())?;

    fs::create_dir_all(documents_dir(&state, &kb.id)).map_err(|error| error.to_string())?;

    Ok(kb)
}

#[tauri::command]
fn list_knowledge_bases(state: State<'_, AppState>) -> Result<Vec<KnowledgeBase>, String> {
    let connection = db_connection(&state.db_path)?;
    let mut statement = connection
        .prepare(
            "SELECT id, name, theme, created_at, updated_at FROM knowledge_bases ORDER BY updated_at DESC, created_at DESC",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], row_to_knowledge_base)
        .map_err(|error| error.to_string())?;

    rows.into_iter()
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn upload_pdf(
    kb_id: String,
    file_path: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<DocumentRecord, String> {
    ensure_pdf(&file_path)?;

    let source = PathBuf::from(&file_path);
    if !source.exists() {
        return Err("待上传的 PDF 不存在。".to_string());
    }

    let file_name = source
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "无法识别文件名。".to_string())?
        .to_string();

    let doc_id = Uuid::new_v4().to_string();
    let created_at = now();
    let doc_dir = document_dir(&state, &kb_id, &doc_id);
    fs::create_dir_all(&doc_dir).map_err(|error| error.to_string())?;

    let stored_pdf = doc_dir.join("source.pdf");
    fs::copy(&source, &stored_pdf).map_err(|error| error.to_string())?;

    let initial = DocumentRecord {
        id: doc_id.clone(),
        kb_id: kb_id.clone(),
        file_name,
        source_path: stored_pdf.to_string_lossy().to_string(),
        page_count: 0,
        status: "queued".to_string(),
        error_message: None,
        created_at: created_at.clone(),
        updated_at: created_at.clone(),
    };

    let connection = db_connection(&state.db_path)?;
    connection
        .execute(
            "INSERT INTO documents (id, kb_id, file_name, source_path, page_count, status, error_message, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                initial.id,
                initial.kb_id,
                initial.file_name,
                initial.source_path,
                initial.page_count,
                initial.status,
                initial.error_message,
                initial.created_at,
                initial.updated_at
            ],
        )
        .map_err(|error| error.to_string())?;

    connection
        .execute(
            "UPDATE documents SET status = 'parsing', updated_at = ?2 WHERE id = ?1",
            params![doc_id, now()],
        )
        .map_err(|error| error.to_string())?;

    let pages_json = doc_dir.join("pages.json");
    let fulltext = doc_dir.join("fulltext.txt");
    let python = python_binary_path(&app);
    let parser_script = parser_script_path(&app);

    let output = Command::new(&python)
        .arg(parser_script)
        .arg(&stored_pdf)
        .arg(&pages_json)
        .arg(&fulltext)
        .output()
        .map_err(|error| {
            format!(
                "无法调用 PDF 解析器。请确认 python3 和 PyMuPDF 可用，或配置内嵌运行时。{}",
                error
            )
        })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let message = if stderr.is_empty() {
            "PDF 解析失败。".to_string()
        } else {
            stderr
        };

        let connection = db_connection(&state.db_path)?;
        connection
            .execute(
                "UPDATE documents SET status = 'failed', error_message = ?2, updated_at = ?3 WHERE id = ?1",
                params![doc_id, message, now()],
            )
            .map_err(|error| error.to_string())?;

        return connection
            .query_row(
                "SELECT id, kb_id, file_name, source_path, page_count, status, error_message, created_at, updated_at FROM documents WHERE id = ?1",
                [doc_id],
                row_to_document,
            )
            .map_err(|error| error.to_string());
    }

    let summary: ParserSummary = serde_json::from_slice(&output.stdout).map_err(|error| error.to_string())?;

    let connection = db_connection(&state.db_path)?;
    connection
        .execute(
            "UPDATE documents SET status = 'parsed', page_count = ?2, error_message = NULL, updated_at = ?3 WHERE id = ?1",
            params![doc_id, summary.page_count, now()],
        )
        .map_err(|error| error.to_string())?;
    connection
        .execute(
            "UPDATE knowledge_bases SET updated_at = ?2 WHERE id = ?1",
            params![kb_id, now()],
        )
        .map_err(|error| error.to_string())?;

    connection
        .query_row(
            "SELECT id, kb_id, file_name, source_path, page_count, status, error_message, created_at, updated_at FROM documents WHERE id = ?1",
            [doc_id],
            row_to_document,
        )
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn list_documents(kb_id: String, state: State<'_, AppState>) -> Result<Vec<DocumentRecord>, String> {
    let connection = db_connection(&state.db_path)?;
    let mut statement = connection
        .prepare(
            "SELECT id, kb_id, file_name, source_path, page_count, status, error_message, created_at, updated_at
             FROM documents WHERE kb_id = ?1 ORDER BY updated_at DESC, created_at DESC",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([kb_id], row_to_document)
        .map_err(|error| error.to_string())?;

    rows.into_iter()
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn search_text(
    kb_id: String,
    query: String,
    document_ids: Option<Vec<String>>,
    limit: Option<usize>,
    state: State<'_, AppState>,
) -> Result<Vec<SearchMatch>, String> {
    let normalized_query = query.trim().to_lowercase();
    if normalized_query.is_empty() {
        return Ok(Vec::new());
    }

    let terms = normalized_query
        .split_whitespace()
        .filter(|term| !term.is_empty())
        .map(str::to_string)
        .collect::<Vec<_>>();

    let effective_terms = if terms.is_empty() {
        vec![normalized_query.clone()]
    } else {
        terms
    };

    let connection = db_connection(&state.db_path)?;
    let mut statement = connection
        .prepare(
            "SELECT id, kb_id, file_name, source_path, page_count, status, error_message, created_at, updated_at
             FROM documents WHERE kb_id = ?1 AND status = 'parsed'",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([kb_id], row_to_document)
        .map_err(|error| error.to_string())?;
    let documents = rows
        .into_iter()
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;

    let allowed = document_ids.unwrap_or_default();
    let filter_ids = !allowed.is_empty();
    let max_results = limit.unwrap_or(20);

    let mut scored = Vec::<(i64, SearchMatch)>::new();
    for document in documents {
        if filter_ids && !allowed.iter().any(|candidate| candidate == &document.id) {
            continue;
        }

        let (_, parsed) = read_parsed_document(&state, &document.id)?;
        for page in parsed.pages {
            let (score, snippet) = score_page(&page.text, &normalized_query, &effective_terms);
            if score == 0 {
                continue;
            }

            if let Some(snippet) = snippet {
                scored.push((
                    score,
                    SearchMatch {
                        doc_id: document.id.clone(),
                        doc_name: document.file_name.clone(),
                        page_number: page.page_number,
                        snippet,
                    },
                ));
            }
        }
    }

    scored.sort_by_key(|(score, item)| {
        (
            Reverse(*score),
            item.doc_name.clone(),
            item.page_number,
        )
    });

    Ok(scored
        .into_iter()
        .take(max_results)
        .map(|(_, item)| item)
        .collect())
}

#[tauri::command]
fn read_pages(
    doc_id: String,
    start_page: i64,
    end_page: i64,
    state: State<'_, AppState>,
) -> Result<ReadPagesResult, String> {
    let (document, parsed) = read_parsed_document(&state, &doc_id)?;
    let start = start_page.max(1);
    let end = end_page.max(start);

    let pages = parsed
        .pages
        .into_iter()
        .filter(|page| page.page_number >= start && page.page_number <= end)
        .collect::<Vec<_>>();

    if pages.is_empty() {
        return Err("指定页码范围没有可读内容。".to_string());
    }

    let continuation = if end < document.page_count {
        Some(end + 1)
    } else {
        None
    };

    Ok(ReadPagesResult {
        doc_id: document.id,
        file_name: document.file_name,
        page_count: document.page_count,
        start_page: start,
        end_page: end,
        continuation,
        pages,
    })
}

#[tauri::command]
fn get_document_page(doc_id: String, page_number: i64, state: State<'_, AppState>) -> Result<PagePreview, String> {
    let (document, parsed) = read_parsed_document(&state, &doc_id)?;
    let page = parsed
        .pages
        .into_iter()
        .find(|page| page.page_number == page_number)
        .ok_or_else(|| "指定页码不存在。".to_string())?;

    Ok(PagePreview {
        doc_id: document.id,
        file_name: document.file_name,
        page_count: document.page_count,
        page_number,
        text: page.text,
    })
}

#[tauri::command]
fn delete_document(doc_id: String, state: State<'_, AppState>) -> Result<(), String> {
    let connection = db_connection(&state.db_path)?;
    let document = connection
        .query_row(
            "SELECT id, kb_id, file_name, source_path, page_count, status, error_message, created_at, updated_at FROM documents WHERE id = ?1",
            [doc_id.clone()],
            row_to_document,
        )
        .optional()
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "文档不存在。".to_string())?;

    let target_dir = document_dir(&state, &document.kb_id, &document.id);
    if target_dir.exists() {
        fs::remove_dir_all(target_dir).map_err(|error| error.to_string())?;
    }

    connection
        .execute("DELETE FROM documents WHERE id = ?1", [doc_id])
        .map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn save_chat_session(
    kb_id: String,
    payload: ChatSessionPayload,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let session_path = session_file_path(&state, &kb_id);
    if let Some(parent) = session_path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    let encoded = serde_json::to_string_pretty(&payload).map_err(|error| error.to_string())?;
    fs::write(&session_path, encoded).map_err(|error| error.to_string())?;

    let connection = db_connection(&state.db_path)?;
    let created_at = now();
    connection
        .execute(
            "INSERT INTO chat_sessions (id, kb_id, title, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(kb_id) DO UPDATE SET title = excluded.title, updated_at = excluded.updated_at",
            params![Uuid::new_v4().to_string(), kb_id, payload.title, created_at, now()],
        )
        .map_err(|error| error.to_string())?;

    Ok(())
}

#[tauri::command]
fn load_chat_session(kb_id: String, state: State<'_, AppState>) -> Result<Option<ChatSessionPayload>, String> {
    let session_path = session_file_path(&state, &kb_id);
    if !session_path.exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(&session_path).map_err(|error| error.to_string())?;
    let payload = serde_json::from_str::<ChatSessionPayload>(&content).map_err(|error| error.to_string())?;
    Ok(Some(payload))
}

#[tauri::command]
fn start_coding_agent(
    kb_id: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<CodingAgentBootstrap, String> {
    let agents = get_or_start_agent(&app, &state, &kb_id)?;
    let process = agents
        .get(&kb_id)
        .ok_or_else(|| "coding agent did not start".to_string())?;
    coding_agent_bootstrap(process)
}

#[tauri::command]
fn prompt_coding_agent(
    kb_id: String,
    message: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let agents = get_or_start_agent(&app, &state, &kb_id)?;
    let process = agents
        .get(&kb_id)
        .ok_or_else(|| "coding agent unavailable".to_string())?;

    let response = send_rpc_request(
        process,
        json!({
            "type": "prompt",
            "message": message,
        }),
        Duration::from_secs(20),
    )?;

    if response
        .get("success")
        .and_then(|value| value.as_bool())
        .unwrap_or(false)
    {
        Ok(())
    } else {
        Err(rpc_error_message(&response))
    }
}

#[tauri::command]
fn get_app_settings(state: State<'_, AppState>) -> Result<AppSettings, String> {
    load_app_settings(&state)
}

#[tauri::command]
fn save_app_settings(settings: AppSettings, state: State<'_, AppState>) -> Result<(), String> {
    save_app_settings_file(&state, &settings)
}

#[tauri::command]
fn abort_coding_agent(kb_id: String, state: State<'_, AppState>) -> Result<(), String> {
    let agents = state
        .agents
        .lock()
        .map_err(|_| "coding agent map lock poisoned".to_string())?;
    let process = agents
        .get(&kb_id)
        .ok_or_else(|| "coding agent unavailable".to_string())?;

    let response = send_rpc_request(process, json!({ "type": "abort" }), Duration::from_secs(10))?;
    if response
        .get("success")
        .and_then(|value| value.as_bool())
        .unwrap_or(false)
    {
        Ok(())
    } else {
        Err(rpc_error_message(&response))
    }
}

#[tauri::command]
fn stop_coding_agent(kb_id: String, state: State<'_, AppState>) -> Result<(), String> {
    let process = state
        .agents
        .lock()
        .map_err(|_| "coding agent map lock poisoned".to_string())?
        .remove(&kb_id)
        .ok_or_else(|| "coding agent unavailable".to_string())?;

    stop_agent_process(process)
}

#[tauri::command]
async fn check_model_health(state: State<'_, AppState>) -> Result<ModelHealth, String> {
    let settings = load_app_settings(&state)?;
    let api_key = settings.packy_api_key.trim().to_string();
    if api_key.is_empty() {
        return Ok(ModelHealth {
            backend_status: "online".to_string(),
            model_status: "unavailable".to_string(),
            detail: "未配置 PackyAPI API Key，请到设置页填写。".to_string(),
        });
    }

    let client = reqwest::Client::new();
    let response = client
        .get(format!("{}/models", settings.packy_api_base_url))
        .bearer_auth(api_key)
        .send()
        .await;

    match response {
        Ok(response) => {
            if response.status() == StatusCode::UNAUTHORIZED || response.status() == StatusCode::FORBIDDEN {
                return Ok(ModelHealth {
                    backend_status: "online".to_string(),
                    model_status: "unavailable".to_string(),
                    detail: "PackyAPI 返回鉴权失败，请检查设置页里的 API Key。".to_string(),
                });
            }

            if !response.status().is_success() {
                return Ok(ModelHealth {
                    backend_status: "offline".to_string(),
                    model_status: "unavailable".to_string(),
                    detail: format!("PackyAPI 响应异常：{}", response.status()),
                });
            }

            let envelope = response.json::<ModelsEnvelope>().await.map_err(|error| error.to_string())?;
            let found = envelope.data.iter().any(|model| model.id == settings.packy_model_id);

            Ok(ModelHealth {
                backend_status: "online".to_string(),
                model_status: if found { "ready" } else { "unavailable" }.to_string(),
                detail: if found {
                    format!("模型 {} 可用。", settings.packy_model_id)
                } else {
                    format!("PackyAPI 已连通，但未发现模型 {}。", settings.packy_model_id)
                },
            })
        }
        Err(error) => Ok(ModelHealth {
            backend_status: "offline".to_string(),
            model_status: "unavailable".to_string(),
            detail: format!("无法连接 PackyAPI：{error}"),
        }),
    }
}

fn prepare_state(app: &AppHandle) -> Result<AppState, String> {
    let data_dir = app.path().app_data_dir().map_err(|error| error.to_string())?;
    fs::create_dir_all(data_dir.join("kbs")).map_err(|error| error.to_string())?;
    let db_path = data_dir.join("pagenexus.sqlite3");
    init_schema(&db_path)?;

    Ok(AppState {
        data_dir,
        db_path,
        agents: Arc::new(Mutex::new(HashMap::new())),
    })
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let state = prepare_state(app.handle())?;
            app.manage(state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            create_knowledge_base,
            list_knowledge_bases,
            upload_pdf,
            list_documents,
            search_text,
            read_pages,
            get_document_page,
            delete_document,
            save_chat_session,
            load_chat_session,
            start_coding_agent,
            prompt_coding_agent,
            get_app_settings,
            save_app_settings,
            abort_coding_agent,
            stop_coding_agent,
            check_model_health
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::{score_page, ParsedPage};

    #[test]
    fn score_page_prefers_exact_hits() {
        let text = "量子计算可以利用叠加态。\n第二段继续解释量子计算。";
        let (score, snippet) = score_page(text, "量子计算", &["量子计算".to_string()]);
        assert!(score >= 100);
        assert!(snippet.unwrap().contains("量子计算"));
    }

    #[test]
    fn parsed_page_serializes_with_camel_case() {
        let page = ParsedPage {
            page_number: 3,
            text: "hello".to_string(),
        };
        let value = serde_json::to_value(page).unwrap();
        assert_eq!(value["pageNumber"], 3);
        assert_eq!(value["text"], "hello");
    }
}
