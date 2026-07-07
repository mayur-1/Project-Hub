import sqlite3, os, hashlib
from datetime import datetime, timedelta
import random

DB_PATH = os.path.join(os.path.dirname(__file__), "tracker.db")
conn = sqlite3.connect(DB_PATH)
c = conn.cursor()

# Ensure demo user exists
salt = "project_hub_salt_2024"
demo_hash = hashlib.sha256(("demo1234" + salt).encode()).hexdigest()
c.execute("INSERT OR IGNORE INTO users (username, password_hash) VALUES (?, ?)", ("demo", demo_hash))
c.execute("SELECT id FROM users WHERE username='demo'")
user_id = c.fetchone()[0]

c.executescript("DELETE FROM work_logs; DELETE FROM documents; DELETE FROM projects;")

projects = [
    ("E-Commerce Platform", "Building a full-stack online store with payment gateway, cart, and admin panel", "React, Node.js, PostgreSQL, Stripe", "Active"),
    ("AI Chatbot", "Customer support chatbot using GPT-4 with context memory and analytics dashboard", "Python, FastAPI, OpenAI, Redis", "Active"),
    ("Portfolio Website", "Personal portfolio with blog, project showcase, and contact form", "Next.js, Tailwind CSS, Sanity CMS", "Completed"),
    ("Mobile Expense Tracker", "Cross-platform expense tracking app with OCR receipt scanning", "Flutter, Firebase, Google ML Kit", "On Hold"),
    ("DevOps Pipeline", "CI/CD pipeline setup with automated testing, Docker, and k8s deployment", "Docker, Kubernetes, GitHub Actions, Terraform", "Active"),
    ("Data Analytics Dashboard", "Real-time dashboard for business metrics with drill-down reports", "Python, Streamlit, Snowflake, dbt", "Completed"),
]

c.executemany(
    "INSERT INTO projects (user_id, name, description, tech_stack, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [(user_id, n, d, t, s, datetime.now() - timedelta(days=random.randint(10, 90)), datetime.now() - timedelta(days=random.randint(0, 5))) for n, d, t, s in projects],
)

work_logs = [
    (1, "Set up PostgreSQL schema for products and users", "2026-06-20", 2.5),
    (1, "Implemented Stripe payment integration", "2026-06-21", 4.0),
    (1, "Built shopping cart API endpoints", "2026-06-22", 3.0),
    (1, "Created admin panel UI for product management", "2026-06-23", 3.5),
    (1, "Fixed cart quantity update bug", "2026-06-24", 1.5),
    (1, "Added order confirmation email flow", "2026-06-25", 2.0),
    (2, "Integrated GPT-4 API with streaming responses", "2026-06-18", 3.0),
    (2, "Designed conversation context memory system", "2026-06-19", 4.5),
    (2, "Built analytics dashboard for conversation metrics", "2026-06-20", 3.5),
    (2, "Added support for multi-language responses", "2026-06-22", 2.0),
    (2, "Optimized token usage and cost tracking", "2026-06-24", 2.5),
    (2, "Created fallback responses for edge cases", "2026-06-25", 1.5),
    (3, "Designed and built responsive landing page", "2026-06-01", 5.0),
    (3, "Added blog CMS integration with Sanity", "2026-06-03", 3.0),
    (3, "Implemented dark/light mode toggle", "2026-06-04", 1.5),
    (3, "Set up contact form with email notifications", "2026-06-05", 2.0),
    (3, "Deployed to Vercel with custom domain", "2026-06-06", 1.0),
    (4, "Set up Flutter project structure and routing", "2026-06-10", 3.0),
    (4, "Implemented Firebase Auth for user login", "2026-06-12", 4.0),
    (4, "Built expense list UI with categories", "2026-06-14", 3.5),
    (4, "Started OCR receipt scanning integration", "2026-06-16", 2.0),
    (5, "Created Docker Compose for microservices", "2026-06-19", 3.0),
    (5, "Set up GitHub Actions workflow for tests", "2026-06-20", 2.5),
    (5, "Configured Kubernetes deployment manifests", "2026-06-21", 4.0),
    (5, "Implemented Terraform for cloud infrastructure", "2026-06-23", 3.5),
    (5, "Added health check monitoring with alerts", "2026-06-25", 2.0),
    (6, "Designed Snowflake schema for sales data", "2026-06-02", 3.5),
    (6, "Built dbt models for data transformation", "2026-06-04", 4.0),
    (6, "Created real-time Streamlit dashboard", "2026-06-05", 3.0),
    (6, "Added drill-down reports with drill-through", "2026-06-07", 2.5),
]

c.executemany(
    "INSERT INTO work_logs (project_id, description, work_date, hours_spent, created_at) VALUES (?, ?, ?, ?, ?)",
    [(pid, desc, wdate, hours, f"{wdate} 18:00:00") for pid, desc, wdate, hours in work_logs],
)

conn.commit()
conn.close()

print(f"Demo user: demo / demo1234")
print(f"Seeded {len(projects)} projects with {len(work_logs)} work log entries!")
