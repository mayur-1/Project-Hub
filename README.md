# Project-Hub
Project Hub is an all-in-one project management and productivity hub designed to streamline your workflow. Effortlessly manage multiple projects, track daily tasks, log work hours, and centralize your documentation in one place. Powered by built-in AI analytics, it automatically analyzes your work patterns to deliver smart, actionable insights into your productivity.

# Project Hub — Multi-Tenant Project Work Tracker

An AI-powered project work tracking dashboard with user authentication, per-user data isolation, document management, and enterprise-level UX.

Built with **FastAPI** (Python) backend and **vanilla HTML/CSS/JS** frontend — no React, no Vue, no Svelte.

---

## Features

- **User Authentication** — Register and login with per-user project/work-log isolation
- **Project Management** — Full CRUD with status tracking, tech stack, workspace path
- **Work Logs** — Track hours, descriptions, dates per project
- **AI Features** — Health scoring, summarization, category suggestions, time estimates, natural language queries
- **Document Management** — Upload/download/preview documents per project (.pdf, .docx, .txt, .md, images, etc.)
- **Analytics Dashboard** — Charts and stats for projects, logs, hours
- **CSV Export** — Export projects and work logs
- **Command Palette** — Ctrl+K / Search button for quick navigation
- **Theme Toggle** — Dark and light mode
- **Keyboard Shortcuts** — Alt+1-5 for quick page navigation

---

## Screenshots

| Auth Page | Dashboard |
|-----------|-----------|
| Glassmorphism login with AI avatar, neural particles, floating orbs | Project cards with health bars, metrics, charts |

---

## Prerequisites

- **Python 3.10+**
- **pip** (Python package manager)
- **Git** (optional, for version control)

---

## Installation & Setup

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd projects_dashboard
```

### 2. Create a virtual environment (recommended)

```bash
python -m venv venv
```

- **Windows:** `venv\Scripts\activate`
- **macOS/Linux:** `source venv/bin/activate`

### 3. Install dependencies

```bash
pip install fastapi uvicorn pandas pydantic
```

### 4. Run the application

```bash
python -m uvicorn server:app --host 0.0.0.0 --port 8501 --reload
```

### 5. Open in browser

```
http://localhost:8501
```

---

## First-Time Setup (with dummy data)

The app creates the SQLite database (`tracker.db`) automatically on first run.

To seed demo data (3 projects, 27 work logs, documents):

```bash
python seed_dummy.py
```

This creates a user:

| Username | Password |
|----------|----------|
| `mayur.shrirao@datafortune.com` | `test123` |

---

## Quick Start (no dummy data needed)

1. Start the server
2. Open `http://localhost:8501`
3. Click **"Create an account"**
4. Fill in username, password, and confirm
5. Sign in with your new credentials
6. Start creating projects and logging work

---

## Project Structure

```
projects_dashboard/
├── server.py              # FastAPI backend (API, auth, AI, documents)
├── seed_dummy.py          # Demo data seeder
├── seed_data.py           # Alternative demo seeder
├── tracker.db             # SQLite database (auto-created)
├── uploads/               # Uploaded documents
│   └── ...                # Document files
├── static/
│   ├── index.html         # Frontend (auth + dashboard shell)
│   ├── style.css          # All styles (dark/light theme)
│   ├── script.js          # All frontend logic
│   ├── avatar.mp4         # AI avatar video (auth page)
│   └── gemini-bg.png      # Auth page background
└── README.md
```

---

## API Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/health` | Health check | No |
| POST | `/api/register` | Create account | No |
| POST | `/api/login` | Sign in | No |
| GET | `/api/projects` | List projects | Yes |
| POST | `/api/projects` | Create project | Yes |
| GET | `/api/stats` | Dashboard stats | Yes |
| GET | `/api/analytics` | Detailed analytics | Yes |
| GET | `/api/logs` | List work logs | Yes |
| POST | `/api/logs` | Create work log | Yes |
| GET | `/api/projects/{id}/documents` | List project documents | Yes |
| POST | `/api/projects/{id}/documents` | Upload document | Yes |
| GET | `/api/documents/{id}` | Get document info | Yes |
| GET | `/api/documents/{id}/content` | View document content | Yes |
| DELETE | `/api/documents/{id}` | Delete document | Yes |
| POST | `/api/projects/{id}/open-workspace` | Open workspace folder | Yes |
| GET | `/api/ai/health` | AI health (all projects) | Yes |
| GET | `/api/ai/health/{id}` | AI health (single project) | Yes |
| POST | `/api/ai/summarize` | AI work summary | Yes |
| POST | `/api/ai/categorize` | Categorize work log | Yes |
| GET | `/api/ai/estimate` | AI time estimate | Yes |
| POST | `/api/ai/insights` | AI project insights | Yes |
| POST | `/api/ai/query` | Natural language query | Yes |
| GET | `/api/export/csv/projects` | Export projects CSV | Yes |
| GET | `/api/export/csv/logs` | Export work logs CSV | Yes |

---

## Tech Stack

- **Backend:** Python, FastAPI, SQLite (via pandas + sqlite3)
- **Frontend:** Vanilla HTML5, CSS3 (custom properties, glassmorphism), JavaScript (ES6+)
- **Animations:** GSAP (GreenSock Animation Platform)
- **Icons:** Font Awesome 6
- **Charts:** Chart.js
- **AI Features:** Rule-based scoring + Google Gemini API integration (`/api/ai/query`)
- **Authentication:** Token-based (SHA-256 password hashing, random hex tokens)

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Alt+1` | Dashboard |
| `Alt+2` | Projects |
| `Alt+3` | Work Logs |
| `Alt+4` | Analytics |
| `Alt+5` | AI Insights |
| `Ctrl+K` | Command Palette |
| `Esc` | Close modal/palette |

---

## Theme

Toggle between **dark** and **light** mode using the moon/sun button in the sidebar. The preference is saved to localStorage.

---

## License

Mayur Shrirao
