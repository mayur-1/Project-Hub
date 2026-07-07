import streamlit as st
import sqlite3
import pandas as pd
from datetime import datetime, date, timedelta
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "tracker.db")


def get_conn():
    return sqlite3.connect(DB_PATH, check_same_thread=False)


def init_db():
    conn = get_conn()
    c = conn.cursor()
    c.executescript("""
        CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            description TEXT DEFAULT '',
            tech_stack TEXT DEFAULT '',
            status TEXT DEFAULT 'Active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
    """)
    conn.commit()
    conn.close()


def add_project(name, desc, tech, status):
    conn = get_conn()
    try:
        conn.execute(
            "INSERT INTO projects (name, description, tech_stack, status) VALUES (?, ?, ?, ?)",
            (name, desc, tech, status),
        )
        conn.commit()
        return True, "Project added!"
    except sqlite3.IntegrityError:
        return False, "Project name already exists."
    finally:
        conn.close()


def update_project(pid, name, desc, tech, status):
    conn = get_conn()
    conn.execute(
        "UPDATE projects SET name=?, description=?, tech_stack=?, status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
        (name, desc, tech, status, pid),
    )
    conn.commit()
    conn.close()


def delete_project(pid):
    conn = get_conn()
    conn.execute("DELETE FROM work_logs WHERE project_id=?", (pid,))
    conn.execute("DELETE FROM projects WHERE id=?", (pid,))
    conn.commit()
    conn.close()


def get_projects():
    conn = get_conn()
    df = pd.read_sql("SELECT * FROM projects ORDER BY updated_at DESC", conn)
    conn.close()
    return df


def add_log(pid, desc, wdate, hours):
    conn = get_conn()
    conn.execute(
        "INSERT INTO work_logs (project_id, description, work_date, hours_spent) VALUES (?, ?, ?, ?)",
        (pid, desc, wdate, hours),
    )
    conn.execute(
        "UPDATE projects SET updated_at=CURRENT_TIMESTAMP WHERE id=?", (pid,)
    )
    conn.commit()
    conn.close()


def get_logs(pid=None, from_date=None, to_date=None):
    conn = get_conn()
    query = """
        SELECT w.id, p.name AS project, w.description, w.work_date, w.hours_spent, w.created_at
        FROM work_logs w
        JOIN projects p ON w.project_id = p.id
        WHERE 1=1
    """
    params = []
    if pid:
        query += " AND w.project_id=?"
        params.append(pid)
    if from_date:
        query += " AND w.work_date>=?"
        params.append(from_date)
    if to_date:
        query += " AND w.work_date<=?"
        params.append(to_date)
    query += " ORDER BY w.created_at DESC"
    df = pd.read_sql(query, conn, params=params)
    conn.close()
    return df


STATUS_COLORS = {
    "Active": "#00d4aa",
    "On Hold": "#ffa726",
    "Completed": "#7c4dff",
    "Archived": "#78909c",
}

STATUS_ICONS = {
    "Active": "●",
    "On Hold": "◷",
    "Completed": "✓",
    "Archived": "◻",
}

PAGE_ICONS = {
    "Dashboard": "📊",
    "Projects": "📁",
    "Work Log": "📝",
    "Analytics": "📈",
}

st.set_page_config(
    page_title="Projects Dashboard",
    page_icon="🚀",
    layout="wide",
)

init_db()

CUSTOM_CSS = """
<style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

    * { font-family: 'Inter', sans-serif; }

    /* ---- Animated Gradient Background ---- */
    .stApp {
        background: linear-gradient(-45deg, #0f0c29, #1a1a3e, #16213e, #0f3460, #1a1a3e, #0f0c29);
        background-size: 400% 400%;
        animation: gradientShift 20s ease infinite;
    }

    @keyframes gradientShift {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
    }

    /* floating orbs */
    .stApp::before {
        content: '';
        position: fixed;
        width: 600px; height: 600px;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(0,212,170,0.08), transparent 70%);
        top: -200px; right: -200px;
        pointer-events: none;
        animation: float 15s ease-in-out infinite;
    }
    .stApp::after {
        content: '';
        position: fixed;
        width: 500px; height: 500px;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(124,77,255,0.08), transparent 70%);
        bottom: -150px; left: -150px;
        pointer-events: none;
        animation: float 20s ease-in-out infinite reverse;
    }

    @keyframes float {
        0%, 100% { transform: translate(0, 0) scale(1); }
        33% { transform: translate(30px, -30px) scale(1.05); }
        66% { transform: translate(-20px, 20px) scale(0.95); }
    }

    /* ---- Glass-morphism Cards ---- */
    div[data-testid="stExpander"], div.stTextInput, div.stTextArea, div.stSelectbox, div.stNumberInput, div.stDateInput {
        backdrop-filter: blur(12px);
        background: rgba(255,255,255,0.06) !important;
        border: 1px solid rgba(255,255,255,0.08) !important;
        border-radius: 16px !important;
        box-shadow: 0 8px 32px rgba(0,0,0,0.2) !important;
    }

    div[data-testid="stExpander"] {
        padding: 4px;
    }

    div[data-testid="stExpander"] > div[data-testid="stExpanderContent"] {
        background: rgba(255,255,255,0.04);
        border-radius: 0 0 16px 16px;
    }

    div.stTextInput input, div.stTextArea textarea, div.stSelectbox div, div.stNumberInput input {
        background: rgba(255,255,255,0.05) !important;
        border: none !important;
        color: white !important;
        border-radius: 12px !important;
    }

    div.stTextInput label, div.stTextArea label, div.stSelectbox label, div.stNumberInput label, div.stDateInput label {
        color: rgba(255,255,255,0.7) !important;
        font-weight: 500 !important;
        font-size: 0.85rem !important;
    }

    /* ---- Metric Cards ---- */
    div[data-testid="metric-container"] {
        backdrop-filter: blur(12px);
        background: linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02));
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 20px;
        padding: 20px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.15);
        transition: transform 0.3s ease, box-shadow 0.3s ease;
    }
    div[data-testid="metric-container"]:hover {
        transform: translateY(-4px);
        box-shadow: 0 12px 40px rgba(0,0,0,0.25);
    }
    div[data-testid="metric-container"] label {
        color: rgba(255,255,255,0.7) !important;
        font-weight: 500 !important;
    }
    div[data-testid="metric-container"] div[data-testid="metric-value"] {
        color: white !important;
        font-weight: 800 !important;
        font-size: 2rem !important;
    }

    /* ---- Sidebar ---- */
    section[data-testid="stSidebar"] {
        background: rgba(15,12,41,0.95) !important;
        backdrop-filter: blur(20px);
        border-right: 1px solid rgba(255,255,255,0.06);
    }
    section[data-testid="stSidebar"] .stSidebarNav {
        padding-top: 20px;
    }

    /* ---- Titles & Text ---- */
    h1, h2, h3, h4, h5, h6, .stMarkdown, p, li, span, .stCaption {
        color: white !important;
    }

    h1 {
        font-weight: 800 !important;
        background: linear-gradient(135deg, #00d4aa, #7c4dff);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        font-size: 2.5rem !important;
        margin-bottom: 1.5rem !important;
    }

    h2, h3 {
        font-weight: 700 !important;
    }

    /* ---- Status Badges ---- */
    .status-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 14px;
        border-radius: 20px;
        font-size: 0.8rem;
        font-weight: 600;
        letter-spacing: 0.3px;
    }

    /* ---- Buttons ---- */
    .stButton button {
        border-radius: 12px !important;
        font-weight: 600 !important;
        border: none !important;
        padding: 8px 24px !important;
        transition: all 0.3s ease !important;
        background: linear-gradient(135deg, #00d4aa, #7c4dff) !important;
        color: white !important;
        box-shadow: 0 4px 15px rgba(0,212,170,0.3) !important;
    }
    .stButton button:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 25px rgba(0,212,170,0.4) !important;
    }
    .stButton button[kind="secondary"] {
        background: rgba(255,255,255,0.08) !important;
        box-shadow: none !important;
    }

    /* ---- DataFrame ---- */
    div[data-testid="stDataFrame"] {
        backdrop-filter: blur(12px);
        background: rgba(255,255,255,0.04);
        border-radius: 16px;
        border: 1px solid rgba(255,255,255,0.08);
        overflow: hidden;
    }
    div[data-testid="stDataFrame"] table {
        color: white !important;
    }
    div[data-testid="stDataFrame"] th {
        background: rgba(0,212,170,0.15) !important;
        color: #00d4aa !important;
        font-weight: 600 !important;
    }
    div[data-testid="stDataFrame"] td {
        background: rgba(255,255,255,0.02) !important;
        color: rgba(255,255,255,0.9) !important;
        border-bottom: 1px solid rgba(255,255,255,0.05) !important;
    }

    /* ---- Radio (sidebar) ---- */
    div[data-testid="stSidebar"] .stRadio label {
        color: rgba(255,255,255,0.7) !important;
        font-weight: 500 !important;
        padding: 8px 16px !important;
        border-radius: 12px !important;
        transition: all 0.2s ease !important;
    }
    div[data-testid="stSidebar"] .stRadio label:hover {
        background: rgba(255,255,255,0.06) !important;
        color: white !important;
    }
    div[data-testid="stSidebar"] .stRadio div[data-testid="stRadioSelected"] label {
        background: linear-gradient(135deg, rgba(0,212,170,0.15), rgba(124,77,255,0.15)) !important;
        color: white !important;
        border: 1px solid rgba(0,212,170,0.2) !important;
    }

    /* ---- Alerts ---- */
    div.stAlert {
        backdrop-filter: blur(12px);
        border-radius: 16px !important;
        border: 1px solid rgba(255,255,255,0.1) !important;
    }
    div[data-testid="stSuccessMessage"] { background: rgba(0,212,170,0.15) !important; }
    div[data-testid="stErrorMessage"] { background: rgba(255,77,77,0.15) !important; }
    div[data-testid="stWarningMessage"] { background: rgba(255,167,38,0.15) !important; }
    div[data-testid="stInfoMessage"] { background: rgba(124,77,255,0.15) !important; }

    /* ---- Dividers ---- */
    hr {
        border-color: rgba(255,255,255,0.08) !important;
    }

    /* ---- Expanders ---- */
    div[data-testid="stExpander"] summary {
        font-weight: 600 !important;
        color: rgba(255,255,255,0.9) !important;
    }

    /* ---- Containers (project cards) ---- */
    div.stContainer {
        backdrop-filter: blur(12px);
        background: linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02)) !important;
        border: 1px solid rgba(255,255,255,0.08) !important;
        border-radius: 20px !important;
        padding: 20px !important;
        box-shadow: 0 8px 32px rgba(0,0,0,0.15);
        transition: transform 0.3s ease;
    }
    div.stContainer:hover {
        transform: translateY(-2px);
    }

    /* ---- Date Input ---- */
    div.stDateInput input {
        color-scheme: dark;
    }

    /* ---- Scrollbar ---- */
    ::-webkit-scrollbar {
        width: 6px;
    }
    ::-webkit-scrollbar-track {
        background: rgba(255,255,255,0.02);
    }
    ::-webkit-scrollbar-thumb {
        background: rgba(255,255,255,0.15);
        border-radius: 3px;
    }

    /* caption style */
    .work-caption {
        padding: 10px 16px;
        background: rgba(255,255,255,0.04);
        border-radius: 12px;
        border-left: 3px solid #00d4aa;
        margin: 4px 0;
        font-size: 0.9rem;
        color: rgba(255,255,255,0.85);
    }
</style>
"""


def status_badge_html(status):
    color = STATUS_COLORS.get(status, "#78909c")
    icon = STATUS_ICONS.get(status, "●")
    return f'<span class="status-badge" style="background:{color}22; color:{color}; border:1px solid {color}44;">{icon} {status}</span>'


def render_sidebar():
    with st.sidebar:
        st.markdown(
            """
            <div style="text-align:center; padding: 20px 0 10px;">
                <div style="font-size:3rem; margin-bottom:8px;">🚀</div>
                <div style="font-size:1.3rem; font-weight:800; background:linear-gradient(135deg,#00d4aa,#7c4dff); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text;">Project Hub</div>
                <div style="font-size:0.75rem; color:rgba(255,255,255,0.4); margin-top:4px;">Multi-Project Tracker</div>
            </div>
            <hr style="margin: 12px 0 20px;">
            """,
            unsafe_allow_html=True,
        )
        page = st.radio(
            "Navigate",
            list(PAGE_ICONS.keys()),
            format_func=lambda x: f"{PAGE_ICONS[x]}  {x}",
            label_visibility="collapsed",
        )
        st.markdown(
            """
            <hr style="margin: 20px 0 10px;">
            <div style="text-align:center; font-size:0.7rem; color:rgba(255,255,255,0.25);">
                Built with ❤️ using Streamlit
            </div>
            """,
            unsafe_allow_html=True,
        )
        return page


def render_dashboard():
    st.title("📊 Projects Dashboard")
    projects = get_projects()

    total = len(projects)
    active = len(projects[projects["status"] == "Active"]) if not projects.empty else 0
    on_hold = len(projects[projects["status"] == "On Hold"]) if not projects.empty else 0
    completed = len(projects[projects["status"] == "Completed"]) if not projects.empty else 0

    cols = st.columns(4)
    metrics = [
        ("📦 Total Projects", total, "All projects"),
        ("● Active", active, "Currently in progress"),
        ("◷ On Hold", on_hold, "Paused / waiting"),
        ("✓ Completed", completed, "Finished projects"),
    ]
    for col, (label, val, help_text) in zip(cols, metrics):
        col.metric(label, val, help=help_text)

    st.divider()

    if not projects.empty:
        for _, row in projects.iterrows():
            with st.expander(f"🚀 {row['name']}"):
                st.markdown(f"Status: {row['status']}")
                cols_detail = st.columns([1, 1])
                with cols_detail[0]:
                    st.markdown(f"**📄 Description**  \n{row['description'] or '—'}")
                with cols_detail[1]:
                    st.markdown(f"**🛠 Tech Stack**  \n{row['tech_stack'] or '—'}")

                st.markdown(f"**📅 Created:** {row['created_at']}  \n**🔄 Updated:** {row['updated_at']}")

                logs = get_logs(pid=row["id"])
                if not logs.empty:
                    st.markdown("---")
                    st.markdown("**📋 Recent Work**")
                    for _, lr in logs.head(5).iterrows():
                        st.markdown(
                            f'<div class="work-caption">📅 {lr["work_date"]}  &nbsp;|&nbsp;  ⏱ {lr["hours_spent"]}h  &nbsp;|&nbsp;  {lr["description"]}</div>',
                            unsafe_allow_html=True,
                        )
    else:
        st.info("🚀 No projects yet — head over to **Projects** to add your first one!")


def render_projects():
    st.title("📁 Manage Projects")

    with st.expander("✨ Add New Project", expanded=False):
        with st.form("add_project", clear_on_submit=True):
            col1, col2 = st.columns([2, 1])
            with col1:
                pname = st.text_input("Project Name *", placeholder="e.g. E-commerce App")
            with col2:
                pstatus = st.selectbox("Status", ["Active", "On Hold", "Completed", "Archived"])
            pdesc = st.text_area("Description", placeholder="Brief description of the project...")
            ptech = st.text_input("Tech Stack", placeholder="e.g. Python, React, PostgreSQL")
            if st.form_submit_button("➕ Add Project", use_container_width=True):
                if pname.strip():
                    ok, msg = add_project(pname.strip(), pdesc, ptech, pstatus)
                    if ok:
                        st.success(msg)
                        st.rerun()
                    else:
                        st.error(msg)
                else:
                    st.error("Project name is required.")

    st.divider()

    projects = get_projects()
    if projects.empty:
        st.info("📂 No projects yet — click above to add one.")
    else:
        for _, row in projects.iterrows():
            badge = status_badge_html(row["status"])
            st.markdown(
                f"""
                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">
                    <div>
                        <span style="font-size:1.3rem; font-weight:700; color:white;">🚀 {row['name']}</span>
                    </div>
                    <div>
                        {badge}
                    </div>
                </div>
                """,
                unsafe_allow_html=True,
            )

            with st.container():
                c1, c2 = st.columns([4, 1])
                with c1:
                    st.markdown(f"🛠 **Tech:** {row['tech_stack'] or '—'}  &nbsp;|&nbsp;  📅 **Updated:** {row['updated_at']}")
                with c2:
                    if st.button("🗑 Delete", key=f"del_{row['id']}", type="secondary", use_container_width=True):
                        delete_project(row["id"])
                        st.rerun()

                with st.expander("✏️ Edit Details"):
                    with st.form(f"edit_{row['id']}"):
                        ename = st.text_input("Name", value=row["name"], key=f"en_{row['id']}")
                        edesc = st.text_area("Description", value=row["description"], key=f"ed_{row['id']}")
                        etech = st.text_input("Tech Stack", value=row["tech_stack"], key=f"et_{row['id']}")
                        estatus = st.selectbox(
                            "Status",
                            ["Active", "On Hold", "Completed", "Archived"],
                            index=["Active", "On Hold", "Completed", "Archived"].index(row["status"]),
                            key=f"es_{row['id']}",
                        )
                        if st.form_submit_button("💾 Save Changes", use_container_width=True):
                            update_project(row["id"], ename, edesc, etech, estatus)
                            st.success("Project updated!")
                            st.rerun()

            st.markdown("<br>", unsafe_allow_html=True)


def render_work_log():
    st.title("📝 Work Log")

    projects = get_projects()
    if projects.empty:
        st.warning("📦 Add a project first before logging any work.")
        st.stop()

    with st.expander("➕ Log New Entry", expanded=True):
        with st.form("add_log", clear_on_submit=True):
            col1, col2 = st.columns(2)
            with col1:
                pid = st.selectbox(
                    "Project",
                    options=projects["id"].tolist(),
                    format_func=lambda x: f"🚀 {projects[projects['id'] == x]['name'].values[0]}",
                )
                wdate = st.date_input("Date", value=date.today())
            with col2:
                hours = st.number_input("Hours Spent", min_value=0.0, max_value=24.0, step=0.5, value=1.0)
            desc = st.text_area("What did you do?", placeholder="Describe your work in detail...")
            if st.form_submit_button("✅ Log Entry", use_container_width=True):
                if desc.strip():
                    add_log(pid, desc.strip(), wdate, hours)
                    st.success("Work logged successfully!")
                    st.rerun()
                else:
                    st.error("Please enter a description.")

    st.divider()

    with st.expander("🔍 Filter Logs", expanded=False):
        colf1, colf2, colf3 = st.columns(3)
        with colf1:
            f_pid = st.selectbox(
                "Project",
                options=["All"] + projects["id"].tolist(),
                format_func=lambda x: "All Projects" if x == "All" else projects[projects["id"] == x]["name"].values[0],
            )
        with colf2:
            f_from = st.date_input("From", value=None)
        with colf3:
            f_to = st.date_input("To", value=None)

    params = {}
    if f_pid != "All":
        params["pid"] = f_pid
    if f_from:
        params["from_date"] = f_from
    if f_to:
        params["to_date"] = f_to

    logs = get_logs(**params)
    if logs.empty:
        st.info("📭 No work logs found matching your criteria.")
    else:
        total_hours = logs["hours_spent"].sum()
        st.markdown(
            f'<div style="padding:12px 20px; background:rgba(255,255,255,0.04); border-radius:12px; margin-bottom:16px; display:flex; justify-content:space-between;">'
            f'<span>📋 <strong>{len(logs)}</strong> entries found</span>'
            f'<span>⏱ Total: <strong>{total_hours:.1f}</strong> hours</span>'
            f'</div>',
            unsafe_allow_html=True,
        )
        display_df = logs.drop(columns=["id"])
        display_df.columns = ["Project", "Description", "Date", "Hours", "Logged At"]
        st.dataframe(display_df, use_container_width=True, hide_index=True)


def render_analytics():
    st.title("📈 Analytics")

    logs = get_logs()
    if logs.empty:
        st.info("📊 No data yet — start logging work to see analytics!")
        st.stop()

    logs["work_date"] = pd.to_datetime(logs["work_date"])

    col1, col2 = st.columns(2)

    with col1:
        st.markdown("##### ⏱ Hours per Project")
        hours_by_project = logs.groupby("project")["hours_spent"].sum().sort_values(ascending=False)
        st.bar_chart(hours_by_project, color="#00d4aa")

    with col2:
        st.markdown("##### 📅 Last 30 Days")
        cutoff = date.today()
        recent = logs[logs["work_date"] >= pd.Timestamp(cutoff - timedelta(days=30))]
        if not recent.empty:
            daily = recent.groupby("work_date")["hours_spent"].sum()
            st.line_chart(daily, color="#7c4dff")
        else:
            st.info("No work logged in the last 30 days.")

    st.divider()

    st.markdown("##### 📋 All Logs")
    display_df = logs.drop(columns=["id"])
    display_df.columns = ["Project", "Description", "Date", "Hours", "Logged At"]
    st.dataframe(display_df, use_container_width=True, hide_index=True)


# =========================== MAIN ===========================
st.markdown(CUSTOM_CSS, unsafe_allow_html=True)

page = render_sidebar()

pages = {
    "Dashboard": render_dashboard,
    "Projects": render_projects,
    "Work Log": render_work_log,
    "Analytics": render_analytics,
}

pages[page]()
