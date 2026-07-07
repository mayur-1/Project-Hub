from fastapi import FastAPI, HTTPException, Query, Header, Depends, UploadFile, File
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse
import sqlite3
import pandas as pd
from datetime import date, timedelta
from pydantic import BaseModel
from typing import Optional, List
import os, hashlib, secrets, shutil, io, csv, json, re
from collections import Counter

DB_PATH = os.path.join(os.path.dirname(__file__), "tracker.db")

app = FastAPI(title="Project Hub")

static_dir = os.path.join(os.path.dirname(__file__), "static")
uploads_dir = os.path.join(os.path.dirname(__file__), "uploads")
if os.path.isdir(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")
os.makedirs(uploads_dir, exist_ok=True)


def get_conn():
    return sqlite3.connect(DB_PATH, check_same_thread=False)


def init_db():
    conn = get_conn()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            email TEXT DEFAULT '',
            mobile TEXT DEFAULT '',
            email_verified INTEGER DEFAULT 0,
            email_code TEXT DEFAULT '',
            token TEXT
        );
        CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            description TEXT DEFAULT '',
            tech_stack TEXT DEFAULT '',
            status TEXT DEFAULT 'Active',
            workspace_path TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS work_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL,
            description TEXT NOT NULL,
            work_date DATE DEFAULT (date('now','localtime')),
            hours_spent REAL DEFAULT 0.0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL,
            filename TEXT NOT NULL,
            original_filename TEXT NOT NULL,
            file_size INTEGER DEFAULT 0,
            uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );
    """)
    # Migrate existing DBs that lack the user_id column
    try:
        conn.execute("ALTER TABLE projects ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1")
    except sqlite3.OperationalError:
        pass  # column already exists
    try:
        conn.execute("ALTER TABLE projects ADD COLUMN workspace_path TEXT DEFAULT ''")
    except sqlite3.OperationalError:
        pass  # column already exists
    try:
        conn.execute("ALTER TABLE users ADD COLUMN email TEXT DEFAULT ''")
    except sqlite3.OperationalError:
        pass
    try:
        conn.execute("ALTER TABLE users ADD COLUMN mobile TEXT DEFAULT ''")
    except sqlite3.OperationalError:
        pass
    try:
        conn.execute("ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0")
    except sqlite3.OperationalError:
        pass
    try:
        conn.execute("ALTER TABLE users ADD COLUMN email_code TEXT DEFAULT ''")
    except sqlite3.OperationalError:
        pass
    conn.commit()
    conn.close()

    # Ensure all existing users have email set to username and are auto-verified
    conn2 = get_conn()
    conn2.execute("UPDATE users SET email=username WHERE email=''")
    conn2.execute("UPDATE users SET email_verified=1 WHERE email_verified=0")
    conn2.commit()
    conn2.close()


init_db()


def hash_password(password: str) -> str:
    salt = "project_hub_salt_2024"
    return hashlib.sha256((password + salt).encode()).hexdigest()


def generate_token() -> str:
    return secrets.token_hex(32)


def get_user_by_token(token: str):
    conn = get_conn()
    df = pd.read_sql("SELECT id, username FROM users WHERE token=?", conn, params=[token])
    conn.close()
    return df.to_dict(orient="records")[0] if not df.empty else None


class AuthRegister(BaseModel):
    username: str
    email: str = ""
    mobile: str = ""
    password: str
    confirm_password: str = ""


class AuthLogin(BaseModel):
    username: str
    password: str


@app.post("/api/register")
def register(body: AuthRegister):
    if len(body.username.strip()) < 3:
        raise HTTPException(400, "Username must be at least 3 characters")
    if len(body.password) < 4:
        raise HTTPException(400, "Password must be at least 4 characters")
    if body.password != body.confirm_password:
        raise HTTPException(400, "Passwords do not match")
    conn = get_conn()
    try:
        h = hash_password(body.password)
        conn.execute(
            "INSERT INTO users (username, password_hash, email, mobile, email_verified) VALUES (?, ?, ?, ?, 1)",
            (body.username.strip(), h, body.email.strip(), body.mobile.strip()),
        )
        conn.commit()
        return {"ok": True, "message": "Registration successful! You can now log in."}
    except sqlite3.IntegrityError:
        raise HTTPException(400, "Username already exists")
    finally:
        conn.close()


@app.post("/api/login")
def login(body: AuthLogin):
    conn = get_conn()
    h = hash_password(body.password)
    df = pd.read_sql("SELECT id, username FROM users WHERE username=? AND password_hash=?", conn, params=[body.username.strip(), h])
    if df.empty:
        conn.close()
        raise HTTPException(401, "Invalid username or password")
    token = generate_token()
    conn.execute("UPDATE users SET token=? WHERE id=?", (token, int(df.iloc[0]["id"])))
    conn.commit()
    conn.close()
    return {"token": token, "username": df.iloc[0]["username"]}


async def require_auth(authorization: Optional[str] = Header(None), token: Optional[str] = Query(None)):
    tok = None
    if authorization:
        tok = authorization.replace("Bearer ", "") if authorization.startswith("Bearer ") else authorization
    elif token:
        tok = token
    if not tok:
        raise HTTPException(401, "Not authenticated")
    user = get_user_by_token(tok)
    if not user:
        raise HTTPException(401, "Invalid or expired token")
    return user


def verify_project_owner(pid: int, user_id: int, conn) -> dict:
    df = pd.read_sql("SELECT * FROM projects WHERE id=? AND user_id=?", conn, params=[pid, user_id])
    if df.empty:
        raise HTTPException(404, "Project not found")
    return df.to_dict(orient="records")[0]


class ProjectCreate(BaseModel):
    name: str
    description: str = ""
    tech_stack: str = ""
    status: str = "Active"


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    tech_stack: Optional[str] = None
    status: Optional[str] = None
    workspace_path: Optional[str] = None


class LogCreate(BaseModel):
    project_id: int
    description: str
    work_date: Optional[str] = None
    hours_spent: float = 0.0


@app.get("/")
def serve_index():
    return FileResponse(os.path.join(static_dir, "index.html"))


@app.get("/api/projects")
def list_projects(_user: dict = Depends(require_auth)):
    conn = get_conn()
    df = pd.read_sql("SELECT * FROM projects WHERE user_id=? ORDER BY updated_at DESC", conn, params=[_user["id"]])
    conn.close()
    return df.to_dict(orient="records")


@app.get("/api/projects/{pid}")
def get_project(pid: int, _user: dict = Depends(require_auth)):
    conn = get_conn()
    row = verify_project_owner(pid, _user["id"], conn)
    conn.close()
    return row


@app.post("/api/projects")
def create_project(body: ProjectCreate, _user: dict = Depends(require_auth)):
    if body.status and body.status not in VALID_STATUSES:
        raise HTTPException(400, f"Invalid status. Allowed: {', '.join(sorted(VALID_STATUSES))}")
    conn = get_conn()
    try:
        c = conn.execute(
            "INSERT INTO projects (user_id, name, description, tech_stack, status) VALUES (?, ?, ?, ?, ?)",
            (_user["id"], body.name, body.description, body.tech_stack, body.status),
        )
        conn.commit()
        pid = c.lastrowid
        df = pd.read_sql("SELECT * FROM projects WHERE id=?", conn, params=[pid])
        return df.to_dict(orient="records")[0]
    except sqlite3.IntegrityError:
        raise HTTPException(400, "Project name already exists")
    finally:
        conn.close()


@app.put("/api/projects/{pid}")
def update_project(pid: int, body: ProjectUpdate, _user: dict = Depends(require_auth)):
    if body.status is not None and body.status not in VALID_STATUSES:
        raise HTTPException(400, f"Invalid status. Allowed: {', '.join(sorted(VALID_STATUSES))}")
    conn = get_conn()
    row = verify_project_owner(pid, _user["id"], conn)
    updates = {
        "name": body.name if body.name is not None else row["name"],
        "description": body.description if body.description is not None else row["description"],
        "tech_stack": body.tech_stack if body.tech_stack is not None else row["tech_stack"],
        "status": body.status if body.status is not None else row["status"],
        "workspace_path": body.workspace_path if body.workspace_path is not None else row.get("workspace_path", ""),
    }
    conn.execute(
        "UPDATE projects SET name=?, description=?, tech_stack=?, status=?, workspace_path=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
        (updates["name"], updates["description"], updates["tech_stack"], updates["status"], updates["workspace_path"], pid),
    )
    conn.commit()
    df = pd.read_sql("SELECT * FROM projects WHERE id=?", conn, params=[pid])
    conn.close()
    return df.to_dict(orient="records")[0]


@app.delete("/api/projects/{pid}")
def delete_project(pid: int, _user: dict = Depends(require_auth)):
    conn = get_conn()
    verify_project_owner(pid, _user["id"], conn)
    docs = pd.read_sql("SELECT id, filename FROM documents WHERE project_id=?", conn, params=[pid])
    for _, d in docs.iterrows():
        fpath = os.path.join(uploads_dir, d["filename"])
        if os.path.isfile(fpath):
            os.remove(fpath)
    conn.execute("DELETE FROM documents WHERE project_id=?", (pid,))
    conn.execute("DELETE FROM work_logs WHERE project_id=?", (pid,))
    conn.execute("DELETE FROM projects WHERE id=?", (pid,))
    conn.commit()
    conn.close()
    return {"ok": True}


@app.get("/api/logs")
def list_logs(_user: dict = Depends(require_auth),
    project_id: Optional[int] = Query(None),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
):
    conn = get_conn()
    query = """
        SELECT w.id, p.name AS project, w.project_id, w.description, w.work_date, w.hours_spent, w.created_at
        FROM work_logs w
        JOIN projects p ON w.project_id = p.id
        WHERE p.user_id=?
    """
    params = [_user["id"]]
    if project_id:
        query += " AND w.project_id=?"
        params.append(project_id)
    if from_date:
        query += " AND w.work_date>=?"
        params.append(from_date)
    if to_date:
        query += " AND w.work_date<=?"
        params.append(to_date)
    query += " ORDER BY w.created_at DESC"
    df = pd.read_sql(query, conn, params=params)
    conn.close()
    return df.to_dict(orient="records")


@app.post("/api/logs")
def create_log(body: LogCreate, _user: dict = Depends(require_auth)):
    conn = get_conn()
    try:
        verify_project_owner(body.project_id, _user["id"], conn)
        wdate = body.work_date or str(date.today())
        c = conn.execute(
            "INSERT INTO work_logs (project_id, description, work_date, hours_spent) VALUES (?, ?, ?, ?)",
            (body.project_id, body.description, wdate, body.hours_spent),
        )
        conn.execute("UPDATE projects SET updated_at=CURRENT_TIMESTAMP WHERE id=?", (body.project_id,))
        conn.commit()
        log_id = c.lastrowid
        df = pd.read_sql("SELECT * FROM work_logs WHERE id=?", conn, params=[log_id])
        return df.to_dict(orient="records")[0]
    finally:
        conn.close()


@app.get("/api/stats")
def get_stats(_user: dict = Depends(require_auth)):
    conn = get_conn()
    projects_df = pd.read_sql("SELECT * FROM projects WHERE user_id=?", conn, params=[_user["id"]])
    if projects_df.empty:
        conn.close()
        return {"total_projects": 0, "active": 0, "on_hold": 0, "completed": 0, "total_hours": 0, "total_logs": 0, "today_logs": 0}
    pids = list(projects_df["id"].tolist())
    placeholders = ",".join("?" * len(pids))
    logs_df = pd.read_sql(f"SELECT * FROM work_logs WHERE project_id IN ({placeholders})", conn, params=pids)
    conn.close()

    total_projects = len(projects_df)
    active = len(projects_df[projects_df["status"] == "Active"]) if not projects_df.empty else 0
    on_hold = len(projects_df[projects_df["status"] == "On Hold"]) if not projects_df.empty else 0
    completed = len(projects_df[projects_df["status"] == "Completed"]) if not projects_df.empty else 0
    total_hours = float(logs_df["hours_spent"].sum()) if not logs_df.empty else 0
    total_logs = len(logs_df)

    today = date.today()
    today_logs = len(logs_df[pd.to_datetime(logs_df["work_date"]).dt.date == today]) if not logs_df.empty else 0

    return {
        "total_projects": total_projects,
        "active": active,
        "on_hold": on_hold,
        "completed": completed,
        "total_hours": round(total_hours, 1),
        "total_logs": total_logs,
        "today_logs": today_logs,
    }


@app.get("/api/analytics")
def get_analytics(_user: dict = Depends(require_auth)):
    conn = get_conn()
    logs_df = pd.read_sql(
        """SELECT p.name AS project, w.hours_spent, w.work_date
           FROM work_logs w JOIN projects p ON w.project_id = p.id
           WHERE p.user_id=?""",
        conn, params=[_user["id"]],
    )

    if logs_df.empty:
        df = pd.read_sql("SELECT status, COUNT(*) as count FROM projects WHERE user_id=? GROUP BY status", conn, params=[_user["id"]])
        status_counts = {}
        for _, r in df.iterrows():
            status_counts[r["status"]] = r["count"]
        conn.close()
        return {"hours_by_project": [], "daily_hours": [], "status_counts": status_counts}

    hours_by_project = (
        logs_df.groupby("project")["hours_spent"].sum().sort_values(ascending=False).reset_index()
    )
    hours_by_project.columns = ["name", "hours"]

    cutoff = date.today() - timedelta(days=30)
    recent = logs_df[pd.to_datetime(logs_df["work_date"]).dt.date >= cutoff]
    daily_hours = (
        recent.groupby("work_date")["hours_spent"].sum().reset_index()
        if not recent.empty
        else pd.DataFrame(columns=["work_date", "hours_spent"])
    )

    status_counts = {}
    df = pd.read_sql("SELECT status, COUNT(*) as count FROM projects WHERE user_id=? GROUP BY status", conn, params=[_user["id"]])
    for _, r in df.iterrows():
        status_counts[r["status"]] = r["count"]
    conn.close()

    return {
        "hours_by_project": hours_by_project.to_dict(orient="records"),
        "daily_hours": daily_hours.to_dict(orient="records"),
        "status_counts": status_counts,
    }


ALLOWED_EXTENSIONS = {".pdf", ".doc", ".docx", ".txt", ".md", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".xlsx", ".xls", ".csv", ".ppt", ".pptx"}
VALID_STATUSES = {"Active", "On Hold", "Completed", "Archived"}

@app.post("/api/projects/{pid}/documents")
async def upload_document(pid: int, file: UploadFile = File(...), _user: dict = Depends(require_auth)):
    conn = get_conn()
    verify_project_owner(pid, _user["id"], conn)
    conn.close()
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"File type '{ext}' not allowed")
    content = await file.read()
    if len(content) > 20 * 1024 * 1024:
        raise HTTPException(400, "File too large (max 20MB)")
    unique = f"{secrets.token_hex(8)}_{os.path.basename(file.filename)}"
    fpath = os.path.join(uploads_dir, unique)
    with open(fpath, "wb") as f:
        f.write(content)
    conn = get_conn()
    conn.execute(
        "INSERT INTO documents (project_id, filename, original_filename, file_size) VALUES (?, ?, ?, ?)",
        (pid, unique, file.filename, len(content)),
    )
    conn.commit()
    doc_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
    conn.close()
    return {"id": doc_id, "filename": file.filename, "file_size": len(content)}


@app.get("/api/projects/{pid}/documents")
def list_documents(pid: int, _user: dict = Depends(require_auth)):
    conn = get_conn()
    verify_project_owner(pid, _user["id"], conn)
    df = pd.read_sql("SELECT id, project_id, original_filename, file_size, uploaded_at FROM documents WHERE project_id=? ORDER BY uploaded_at DESC", conn, params=[pid])
    conn.close()
    return df.to_dict(orient="records")


@app.get("/api/documents/{did}")
def download_document(did: int, _user: dict = Depends(require_auth)):
    conn = get_conn()
    df = pd.read_sql("SELECT d.*, p.user_id FROM documents d JOIN projects p ON d.project_id = p.id WHERE d.id=?", conn, params=[did])
    if df.empty:
        conn.close()
        raise HTTPException(404, "Document not found")
    doc = df.to_dict(orient="records")[0]
    if doc["user_id"] != _user["id"]:
        conn.close()
        raise HTTPException(403, "Access denied")
    conn.close()
    fpath = os.path.join(uploads_dir, doc["filename"])
    if not os.path.isfile(fpath):
        raise HTTPException(404, "File not found on disk")
    return FileResponse(fpath, filename=doc["original_filename"])


@app.get("/api/documents/{did}/content")
def view_document_content(did: int, _user: dict = Depends(require_auth)):
    """Get document content for viewing (text files) or serve as inline."""
    conn = get_conn()
    df = pd.read_sql("SELECT d.*, p.user_id FROM documents d JOIN projects p ON d.project_id = p.id WHERE d.id=?", conn, params=[did])
    if df.empty:
        conn.close()
        raise HTTPException(404, "Document not found")
    doc = df.to_dict(orient="records")[0]
    if doc["user_id"] != _user["id"]:
        conn.close()
        raise HTTPException(403, "Access denied")
    conn.close()
    fpath = os.path.join(uploads_dir, doc["filename"])
    if not os.path.isfile(fpath):
        raise HTTPException(404, "File not found on disk")
    ext = os.path.splitext(doc["original_filename"])[1].lower()
    viewable_exts = {".txt", ".md", ".csv", ".json", ".xml", ".yaml", ".yml", ".log", ".ini", ".cfg", ".env", ".sh", ".bat", ".ps1", ".py", ".js", ".ts", ".html", ".css"}
    if ext in viewable_exts:
        try:
            with open(fpath, "r", encoding="utf-8", errors="replace") as f:
                content = f.read()
            return {"type": "text", "filename": doc["original_filename"], "content": content, "file_size": doc["file_size"]}
        except Exception:
            pass
    return {"type": "file", "filename": doc["original_filename"], "file_size": doc["file_size"], "download_url": f"/api/documents/{did}"}

@app.delete("/api/documents/{did}")
def delete_document(did: int, _user: dict = Depends(require_auth)):
    conn = get_conn()
    df = pd.read_sql("SELECT d.*, p.user_id FROM documents d JOIN projects p ON d.project_id = p.id WHERE d.id=?", conn, params=[did])
    if df.empty:
        conn.close()
        raise HTTPException(404, "Document not found")
    doc = df.to_dict(orient="records")[0]
    if doc["user_id"] != _user["id"]:
        conn.close()
        raise HTTPException(403, "Access denied")
    fpath = os.path.join(uploads_dir, doc["filename"])
    if os.path.isfile(fpath):
        os.remove(fpath)
    conn.execute("DELETE FROM documents WHERE id=?", (did,))
    conn.commit()
    conn.close()
    return {"ok": True}


# ─── AI Service ───────────────────────────────────────────────────────

CATEGORY_KEYWORDS = {
    "Development": ["code", "implement", "develop", "fix", "debug", "build", "feature", "api", "frontend", "backend", "refactor", "merge", "deploy", "migration", "testing", "unit test", "integration", "pull request", "commit"],
    "Design": ["design", "ui", "ux", "wireframe", "prototype", "mockup", "figma", "sketch", "layout", "component", "style", "theme", "css", "responsive", "illustration"],
    "Documentation": ["doc", "readme", "wiki", "confluence", "write", "update doc", "technical spec", "requirement", "spec", "manual", "guide", "changelog"],
    "Meeting": ["meeting", "standup", "sync", "review", "retro", "planning", "demo", "present", "call", "discussion", "brainstorm", "workshop"],
    "Research": ["research", "investigate", "explore", "learn", "study", "prototype", "proof of concept", "poc", "analyze", "evaluation", "compare", "benchmark"],
    "Management": ["plan", "manage", "organize", "prioritize", "sprint", "backlog", "board", "task", "ticket", "jira", "trello", "roadmap", "milestone"],
    "Support": ["support", "incident", "bug fix", "hotfix", "patch", "issue", "troubleshoot", "resolve", "escalation", "outage", "maintenance"],
    "DevOps": ["deploy", "ci/cd", "pipeline", "docker", "kubernetes", "infra", "terraform", "ansible", "monitor", "alert", "logging", "backup", "server", "cloud", "aws", "azure", "gcp"],
}


def ai_categorize_log(description: str) -> str:
    """Categorize a work log description using keyword matching."""
    desc_lower = description.lower()
    scores = {}
    for cat, keywords in CATEGORY_KEYWORDS.items():
        score = sum(1 for kw in keywords if kw in desc_lower)
        if score > 0:
            scores[cat] = score
    if not scores:
        return "General"
    return max(scores, key=scores.get)


def ai_generate_summary(logs: list) -> dict:
    """Generate an AI-powered summary of work logs."""
    if not logs:
        return {"summary": "No work logged yet.", "categories": {}, "topics": [], "productivity_score": 0}

    total_hours = sum(l.get("hours_spent", 0) for l in logs)
    log_count = len(logs)
    categories = Counter()
    for l in logs:
        cat = ai_categorize_log(l.get("description", ""))
        categories[cat] += 1

    total_days = len(set(l.get("work_date") for l in logs if l.get("work_date")))
    days_worked = total_days if total_days > 0 else 1
    daily_avg = round(total_hours / days_worked, 1) if days_worked else 0

    top_category = categories.most_common(1)
    primary_focus = top_category[0][0] if top_category else "General"

    # Productivity score: 0-100 based on consistency, volume, and recency
    consistency = min(100, (log_count / max(days_worked, 1)) * 20)
    volume_score = min(100, (total_hours / max(days_worked * 8, 1)) * 100)
    recency_bonus = min(20, log_count * 2)
    productivity_score = min(100, int(consistency * 0.4 + volume_score * 0.4 + recency_bonus * 0.2))

    # Extract topics (repeated meaningful words)
    words = re.findall(r'\b[a-zA-Z]{4,}\b', " ".join(l.get("description", "") for l in logs))
    word_freq = Counter(w.lower() for w in words if w.lower() not in {
        "this", "that", "with", "from", "have", "been", "were", "will", "would", "could",
        "should", "their", "they", "them", "then", "than", "what", "when", "where", "which",
        "into", "over", "also", "just", "more", "some", "work", "task", "done", "time"})
    topics = [w for w, _ in word_freq.most_common(5)]

    # Generate narrative summary
    top_3_cats = categories.most_common(3)
    cat_desc = ", ".join(f"{c[0]} ({c[1]} logs)" for c in top_3_cats)
    narrative = (
        f"Logged {total_hours}h across {log_count} entries over {total_days} day(s). "
        f"Primary focus: {primary_focus}. "
        f"Daily average: {daily_avg}h. "
        f"Categories: {cat_desc}."
    )

    return {
        "summary": narrative,
        "categories": dict(categories),
        "topics": topics,
        "productivity_score": productivity_score,
        "total_hours": total_hours,
        "log_count": log_count,
        "daily_average": daily_avg,
        "primary_focus": primary_focus,
    }


def ai_time_estimate(description: str, tech_stack: str = "") -> dict:
    """Suggest a time estimate based on description keywords."""
    desc_lower = description.lower()
    tech_lower = tech_stack.lower()

    # Complexity indicators
    complexity = 1
    if any(w in desc_lower for w in ["complex", "difficult", "large", "major", "multiple", "integrate", "migration"]):
        complexity = 3
    elif any(w in desc_lower for w in ["moderate", "medium", "several", "update", "refactor"]):
        complexity = 2

    # Tech stack factor
    tech_factor = 1.0
    if any(t in tech_lower for t in ["kubernetes", "docker", "microservice", "distributed", "machine learning"]):
        tech_factor = 1.5

    base_hours = 2 * complexity
    estimated = round(base_hours * tech_factor, 1)

    return {
        "estimated_hours": estimated,
        "complexity": "High" if complexity == 3 else "Medium" if complexity == 2 else "Low",
        "confidence": "High" if complexity == 1 else "Medium" if complexity == 2 else "Low",
    }


def ai_project_health(project: dict, logs: list) -> dict:
    """Calculate project health score and insights."""
    if not logs:
        return {
            "health_score": 50,
            "status": "Insufficient Data",
            "insight": "Start logging work to track project health.",
            "trend": "neutral",
            "suggestion": "Log at least 5 work entries for a health assessment."
        }

    total_hours = sum(l.get("hours_spent", 0) for l in logs)
    log_count = len(logs)
    days = sorted(set(l.get("work_date") for l in logs if l.get("work_date")), reverse=True)

    # Recency: score based on last activity
    if days:
        last_activity = days[0]
        try:
            days_since = (date.today() - pd.to_datetime(last_activity).date()).days
        except Exception:
            days_since = 0
    else:
        days_since = 999
    recency_score = max(0, 100 - days_since * 10)

    # Consistency: score based on average hours per active day
    consistency_score = min(100, (total_hours / max(len(days), 1)) * 15)

    # Volume: score based on total hours (diminishing returns after 40h)
    volume_score = min(100, (total_hours / 40) * 100)

    # Status weight
    status_map = {"Active": 80, "On Hold": 40, "Completed": 95, "Planning": 60}
    status_score = status_map.get(project.get("status", "Active"), 60)

    health_score = int(recency_score * 0.3 + consistency_score * 0.25 + volume_score * 0.2 + status_score * 0.25)
    health_score = max(0, min(100, health_score))

    # Trend (last 7 days vs previous 7)
    recent_7 = sum(l.get("hours_spent", 0) for l in logs if l.get("work_date", "") >= str(date.today() - timedelta(days=7)))
    prev_7 = sum(l.get("hours_spent", 0) for l in logs if str(date.today() - timedelta(days=14)) <= l.get("work_date", "") < str(date.today() - timedelta(days=7)))
    trend = "up" if recent_7 > prev_7 else "down" if recent_7 < prev_7 else "stable"

    # Insight generation
    if health_score >= 80:
        insight = "Project is on track. Great momentum!"
        suggestion = "Consider adding stretch goals or documenting progress."
    elif health_score >= 60:
        insight = "Project is progressing steadily."
        suggestion = "Review milestones and ensure alignment with deadlines."
    elif health_score >= 40:
        insight = "Project needs attention. Activity has slowed."
        suggestion = "Break down next tasks into smaller items and log consistently."
    else:
        insight = "Project is at risk. Significant activity drop detected."
        suggestion = "Re-evaluate scope, prioritize critical path, and restart logging."

    return {
        "health_score": health_score,
        "status": "Healthy" if health_score >= 70 else "Needs Attention" if health_score >= 40 else "At Risk",
        "insight": insight,
        "trend": trend,
        "suggestion": suggestion,
        "total_hours": round(total_hours, 1),
        "log_count": log_count,
        "last_activity": days[0] if days else None,
        "recency_score": recency_score,
        "consistency_score": consistency_score,
    }


def ai_natural_language_query(query: str, user_id: int) -> dict:
    """Parse natural language query and return relevant analytics."""
    q = query.lower().strip()

    if not q:
        return {"answer": "Please ask a question about your projects.", "data": []}

    conn = get_conn()
    try:
        # Determine intent
        if any(w in q for w in ["project", "projects"]):
            df = pd.read_sql("SELECT * FROM projects WHERE user_id=?", conn, params=[user_id])
            if df.empty:
                return {"answer": "You have no projects yet. Create one to get started!", "data": []}
            if "active" in q:
                filtered = df[df["status"] == "Active"]
                return {"answer": f"You have {len(filtered)} active project(s).", "data": filtered.to_dict(orient="records")}
            if "complete" in q or "done" in q:
                filtered = df[df["status"] == "Completed"]
                return {"answer": f"You have completed {len(filtered)} project(s).", "data": filtered.to_dict(orient="records")}
            if "count" in q or "how many" in q:
                return {"answer": f"You have {len(df)} project(s) in total.", "data": df.to_dict(orient="records")}
            return {"answer": f"Found {len(df)} project(s).", "data": df.to_dict(orient="records")}

        if any(w in q for w in ["hour", "time", "spent", "logged"]):
            logs_df = pd.read_sql(
                "SELECT p.name AS project, w.hours_spent, w.work_date, w.description "
                "FROM work_logs w JOIN projects p ON w.project_id = p.id WHERE p.user_id=?",
                conn, params=[user_id]
            )
            if logs_df.empty:
                return {"answer": "No time logged yet.", "data": []}
            total = logs_df["hours_spent"].sum()
            if "today" in q:
                tdy = logs_df[pd.to_datetime(logs_df["work_date"]).dt.date == date.today()]
                return {"answer": f"You logged {tdy['hours_spent'].sum():.1f}h today.", "data": tdy.to_dict(orient="records")}
            if "this week" in q or "week" in q:
                week_start = date.today() - timedelta(days=date.today().weekday())
                wk = logs_df[pd.to_datetime(logs_df["work_date"]).dt.date >= week_start]
                return {"answer": f"You logged {wk['hours_spent'].sum():.1f}h this week.", "data": wk.to_dict(orient="records")}
            if "this month" in q or "month" in q:
                mo = logs_df[pd.to_datetime(logs_df["work_date"]).dt.month == date.today().month]
                return {"answer": f"You logged {mo['hours_spent'].sum():.1f}h this month.", "data": mo.to_dict(orient="records")}
            by_project = logs_df.groupby("project")["hours_spent"].sum().sort_values(ascending=False)
            top = by_project.head(3)
            return {
                "answer": f"Total: {total:.1f}h logged. Most: {top.index[0]} ({top.iloc[0]:.1f}h)" if len(top) > 0 else f"Total: {total:.1f}h logged.",
                "data": logs_df.to_dict(orient="records")
            }

        if any(w in q for w in ["health", "healthy", "risk", "status"]):
            p_df = pd.read_sql("SELECT * FROM projects WHERE user_id=?", conn, params=[user_id])
            results = []
            for _, p in p_df.iterrows():
                l_df = pd.read_sql("SELECT * FROM work_logs WHERE project_id=?", conn, params=[int(p["id"])])
                health = ai_project_health(p.to_dict(), l_df.to_dict(orient="records"))
                results.append({"project": p["name"], **health})
            at_risk = [r for r in results if r["health_score"] < 40]
            if at_risk:
                return {"answer": f"{len(at_risk)} project(s) at risk!", "data": at_risk}
            if not results:
                return {"answer": "No projects to evaluate.", "data": []}
            return {"answer": f"All {len(results)} project(s) look healthy.", "data": results}

        # Default: summarise everything
        p_df = pd.read_sql("SELECT * FROM projects WHERE user_id=?", conn, params=[user_id])
        if p_df.empty:
            return {"answer": "Welcome! Start by creating a project.", "data": []}
        return {"answer": f"You have {len(p_df)} project(s). Use more specific queries like 'my hours this week', 'active projects', or 'project health'.", "data": p_df.to_dict(orient="records")}
    finally:
        conn.close()


# ─── AI Endpoints ─────────────────────────────────────────────────────


class AIQuery(BaseModel):
    query: str


class AISummarizeRequest(BaseModel):
    project_id: Optional[int] = None


@app.post("/api/ai/summarize")
def ai_summarize(body: AISummarizeRequest, _user: dict = Depends(require_auth)):
    """Generate AI summary of work logs (optionally filtered by project)."""
    conn = get_conn()
    if body.project_id:
        verify_project_owner(body.project_id, _user["id"], conn)
        logs_df = pd.read_sql(
            "SELECT w.description, w.hours_spent, w.work_date FROM work_logs w JOIN projects p ON w.project_id = p.id WHERE p.user_id=? AND w.project_id=?",
            conn, params=[_user["id"], body.project_id]
        )
    else:
        logs_df = pd.read_sql(
            "SELECT w.description, w.hours_spent, w.work_date FROM work_logs w JOIN projects p ON w.project_id = p.id WHERE p.user_id=?",
            conn, params=[_user["id"]]
        )
    conn.close()
    return ai_generate_summary(logs_df.to_dict(orient="records"))


@app.get("/api/ai/health/{pid}")
def ai_project_health_endpoint(pid: int, _user: dict = Depends(require_auth)):
    """Get AI-powered health score for a project."""
    conn = get_conn()
    project = verify_project_owner(pid, _user["id"], conn)
    logs_df = pd.read_sql("SELECT * FROM work_logs WHERE project_id=?", conn, params=[pid])
    conn.close()
    return ai_project_health(project, logs_df.to_dict(orient="records"))


@app.get("/api/ai/health")
def ai_all_projects_health(_user: dict = Depends(require_auth)):
    """Get AI health scores for all projects."""
    conn = get_conn()
    p_df = pd.read_sql("SELECT * FROM projects WHERE user_id=?", conn, params=[_user["id"]])
    results = []
    for _, p in p_df.iterrows():
        l_df = pd.read_sql("SELECT * FROM work_logs WHERE project_id=?", conn, params=[int(p["id"])])
        health = ai_project_health(p.to_dict(), l_df.to_dict(orient="records"))
        results.append({"project_id": p["id"], "project_name": p["name"], **health})
    conn.close()
    overall = round(sum(r["health_score"] for r in results) / len(results), 1) if results else 0
    return {"overall_health": overall, "projects": results}


@app.get("/api/ai/categorize")
def ai_categorize_logs(_user: dict = Depends(require_auth)):
    """Categorize all work logs by AI analysis."""
    conn = get_conn()
    logs_df = pd.read_sql(
        "SELECT w.id, p.name AS project, w.description, w.hours_spent, w.work_date FROM work_logs w JOIN projects p ON w.project_id = p.id WHERE p.user_id=? ORDER BY w.created_at DESC",
        conn, params=[_user["id"]]
    )
    conn.close()
    result = []
    for _, l in logs_df.iterrows():
        cat = ai_categorize_log(l["description"])
        result.append({"id": l["id"], "project": l["project"], "description": l["description"][:80],
                        "hours_spent": l["hours_spent"], "work_date": l["work_date"], "category": cat})
    return result


@app.get("/api/ai/estimate")
def ai_suggest_estimate(description: str = Query(...), tech_stack: str = Query(""), _user: dict = Depends(require_auth)):
    """Suggest a time estimate based on task description."""
    return ai_time_estimate(description, tech_stack)


@app.post("/api/ai/query")
def ai_nl_query(body: AIQuery, _user: dict = Depends(require_auth)):
    """Natural language query against your data."""
    return ai_natural_language_query(body.query, _user["id"])


@app.get("/api/ai/insights")
def ai_quick_insights(_user: dict = Depends(require_auth)):
    """Get quick AI-generated insights across all projects."""
    conn = get_conn()
    logs_df = pd.read_sql(
        "SELECT w.*, p.name AS project_name, p.tech_stack, p.status FROM work_logs w JOIN projects p ON w.project_id = p.id WHERE p.user_id=?",
        conn, params=[_user["id"]]
    )
    p_df = pd.read_sql("SELECT * FROM projects WHERE user_id=?", conn, params=[_user["id"]])
    conn.close()

    insights = []

    # 1. Most productive day
    if not logs_df.empty:
        day_hours = logs_df.groupby("work_date")["hours_spent"].sum()
        best_day = day_hours.idxmax() if not day_hours.empty else None
        if best_day:
            insights.append(f"Most productive day: {best_day} ({day_hours.max():.1f}h logged)")

        # 2. Top focus area
        categories = Counter()
        for _, l in logs_df.iterrows():
            cat = ai_categorize_log(l["description"])
            categories[cat] += 1
        if categories:
            top_cat = categories.most_common(1)[0]
            insights.append(f"Top focus area: {top_cat[0]} ({top_cat[1]} entries)")

        # 3. Idle projects
        for _, p in p_df.iterrows():
            project_logs = logs_df[logs_df["project_id"] == p["id"]]
            if project_logs.empty:
                insights.append(f"'{p['name']}' has no logs yet — consider logging progress")
            else:
                last_date = project_logs["work_date"].max()
                try:
                    days_idle = (date.today() - pd.to_datetime(last_date).date()).days
                    if days_idle > 14:
                        insights.append(f"'{p['name']}' idle for {days_idle} days")
                except Exception:
                    pass

    if not insights:
        insights.append("Start logging work to see AI insights!")

    return {"insights": insights}


# ─── Export Endpoints ─────────────────────────────────────────────────


@app.post("/api/projects/{pid}/open-workspace")
def open_project_workspace(pid: int, _user: dict = Depends(require_auth)):
    """Open the project workspace folder in File Explorer."""
    conn = get_conn()
    project = verify_project_owner(pid, _user["id"], conn)
    conn.close()
    wp = project.get("workspace_path", "")
    if not wp or not os.path.isdir(wp):
        raise HTTPException(404, "Workspace path not found or not set")
    try:
        os.startfile(wp)
        return {"ok": True, "path": wp}
    except Exception as e:
        raise HTTPException(500, f"Failed to open workspace: {str(e)}")

@app.get("/api/export/csv/logs")
def export_logs_csv(project_id: Optional[int] = Query(None), _user: dict = Depends(require_auth)):
    """Export work logs as CSV."""
    conn = get_conn()
    query = """
        SELECT w.id, p.name AS project, w.description, w.work_date, w.hours_spent, w.created_at
        FROM work_logs w JOIN projects p ON w.project_id = p.id
        WHERE p.user_id=?
    """
    params = [_user["id"]]
    if project_id:
        verify_project_owner(project_id, _user["id"], conn)
        query += " AND w.project_id=?"
        params.append(project_id)
    query += " ORDER BY w.work_date DESC, w.created_at DESC"
    df = pd.read_sql(query, conn, params=params)
    conn.close()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Project", "Description", "Date", "Hours Spent", "Created At"])
    for _, r in df.iterrows():
        writer.writerow([r["id"], r["project"], r["description"], r["work_date"], r["hours_spent"], r["created_at"]])
    output.seek(0)
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": "attachment; filename=work_logs_export.csv"})


@app.get("/api/export/csv/projects")
def export_projects_csv(_user: dict = Depends(require_auth)):
    """Export projects as CSV."""
    conn = get_conn()
    df = pd.read_sql("SELECT * FROM projects WHERE user_id=?", conn, params=[_user["id"]])
    conn.close()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Name", "Description", "Tech Stack", "Status", "Created At", "Updated At"])
    for _, r in df.iterrows():
        writer.writerow([r["id"], r["name"], r["description"], r["tech_stack"], r["status"], r["created_at"], r["updated_at"]])
    output.seek(0)
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": "attachment; filename=projects_export.csv"})


# ─── Health Check ─────────────────────────────────────────────────────


@app.get("/api/health")
def health_check():
    """API health check endpoint."""
    try:
        conn = get_conn()
        conn.execute("SELECT 1")
        conn.close()
        return {"status": "healthy", "version": "3.0.0"}
    except Exception as e:
        raise HTTPException(503, detail=f"Service unhealthy: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8501)
