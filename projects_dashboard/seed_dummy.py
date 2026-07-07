import sqlite3, os, hashlib, secrets
from datetime import date, timedelta

DB = r'C:\Users\MayurShrirao\projects_dashboard\tracker.db'
UPLOADS = r'C:\Users\MayurShrirao\projects_dashboard\uploads'
os.makedirs(UPLOADS, exist_ok=True)

conn = sqlite3.connect(DB)
USER_ID = 1  # mayur.shrirao@datafortune.com
today = date.today()

# ── 1. Projects ──────────────────────────────────────────────

notesight_desc = (
    "AI-powered study and learning platform with multi-tier architecture.\n\n"
    "=== FRONTEND ===\n"
    "Next.js hosted on Vercel CDN. Front-end workflow includes user authentication, "
    "content browsing, study sessions, assessments, and profile management. "
    "Vercel handles redundancy and auto-scaling.\n\n"
    "=== API BACKEND (NestJS - AWS EC2 t2.large) ===\n"
    "REST API handling user requests, file uploads, and backend business logic. "
    "Uses Docker Compose for containerization.\n\n"
    "Tech Stack: NestJS, Redis, Kafka, PostgreSQL RDS\n"
    "Infrastructure: Single EC2 instance with Docker Swarm (single-node)\n\n"
    "Key Challenges & Improvements:\n"
    "- Jenkins pipeline for CI/CD (build Docker image -> push to ECR -> SSH deploy)\n"
    "- No autoscaling currently (Redis/Mongo/Kafka inside EC2 blocks ASG+ALB)\n"
    "- Planned: Move Redis to ElastiCache, Kafka to MSK, PostgreSQL to RDS\n"
    "- Planned: Add CloudWatch/Grafana/Prometheus monitoring with Email/Slack alerts\n"
    "- Planned: Switch from Docker Swarm to ECS Fargate for automatic scaling\n"
    "- Planned: Configure AWS Load Balancer + Auto Scaling Group\n"
    "- Planned: Enable automated EC2/EBS snapshot backups with DR procedures\n\n"
    "=== GEN-AI BACKEND (Python - AWS EC2/ECS) ===\n"
    "LLM engine for AI-powered study guide, flashcard, and tutor generation. "
    "Uses Google Gemini LLM with FastAPI server.\n\n"
    "Tech Stack: FastAPI, Celery Workers, MongoDB, Redis, Google Gemini LLM\n"
    "AI Agents: Profiling Agent, Planner Agent, Content Agent\n"
    "Network: Custom Docker network (ns-ai-network)\n"
    "Infrastructure: 2 EC2 instances (Dev & Prod), Docker Compose, manual deployment\n\n"
    "Current State:\n"
    "- 100% manual deployment (SSH -> git pull -> docker build -> docker compose up)\n"
    "- No CI/CD pipeline in place\n"
    "- No container health monitoring or auto-restart\n"
    "- No alerts on container crashes\n\n"
    "Planned Improvements:\n"
    "- GitHub Actions CI/CD for automated deployment (push-to-main triggers deploy)\n"
    "- Container health monitoring with auto-recovery\n"
    "- Automated old image cleanup\n"
    "- Slack/email alerts on deploy failures\n"
    "- Potential migration to ECS Fargate with autoscaling (0-10 tasks)\n\n"
    "=== DOCUMENT PROCESSING (AWS ECS) ===\n"
    "Separate Gen-AI backend for document processing and content generation:\n"
    "- Resume scanning and parsing (Lambda-based)\n"
    "- Content extraction and processing pipeline\n"
    "- Study guide and flashcard generation\n"
    "- Tutor content upload and management\n"
    "- File upload pipeline with validation\n\n"
    "=== KAFKA INTEGRATION ===\n"
    "Used for high-performance streaming analytics and data integration between "
    "backend API and GEN-AI services. Planned improvements include dedicated "
    "Kafka infrastructure with backup and monitoring.\n\n"
    "=== DEPLOYMENT & INFRASTRUCTURE ===\n"
    "Current: AWS with Jenkins-based deployments, single-server for API, 2 EC2 for GEN-AI\n"
    "Planned: Full CI/CD (Jenkins + GitHub Actions), CloudWatch/Grafana/Prometheus monitoring, "
    "ALB + ASG for high availability, ECS Fargate for auto-scaling, "
    "automated backups with DR, centralized logging\n\n"
    "=== OTHER FEATURES ===\n"
    "- Apple App Store and Google Play Subscription integration\n"
    "- Push notifications system\n"
    "- Rate limiter implementation\n"
    "- Content management system with versioning\n"
    "- B2B instantiation support\n"
    "- Study planner and assessment engine\n"
    "- Strength/weakness analysis (V2)\n"
    "- Visual guidance features"
)

notesight_tech = (
    "Next.js (Vercel), NestJS (AWS EC2 t2.large), Python FastAPI (AWS EC2/ECS), "
    "Google Gemini LLM, Celery Workers, Redis / ElastiCache, Kafka / MSK, "
    "PostgreSQL RDS, MongoDB, Docker Compose, Docker Swarm, AWS ECS Fargate, "
    "AWS EC2, AWS ALB, AWS ECR, Jenkins CI/CD, GitHub Actions CI/CD, "
    "CloudWatch, Grafana, Prometheus, SQS Workers, Lambda"
)

notesight_wp = (
    r"C:\Users\MayurShrirao\OneDrive - Datafortune Software Solutions Pvt. Ltd\Documents\Workspace\Notesight"
)

projects_data = [
    ("Notesight", notesight_desc, notesight_tech, "Active", notesight_wp),
    (
        "E-Commerce Platform",
        "Full-stack e-commerce platform with payment processing, inventory management, "
        "and real-time order tracking.\n\n"
        "Features:\n"
        "- Product catalog with search and filtering\n"
        "- Shopping cart and checkout flow\n"
        "- Stripe payment integration\n"
        "- Admin dashboard for inventory management\n"
        "- Order tracking with real-time updates\n"
        "- User reviews and ratings\n"
        "- Email notifications (order confirmations, shipping updates)",
        "Next.js, TypeScript, Stripe API, PostgreSQL, Prisma, Redis, "
        "Docker, AWS EC2, GitHub Actions, Tailwind CSS",
        "Active",
        ""
    ),
    (
        "DevOps Pipeline Automation",
        "Automated CI/CD pipeline and infrastructure-as-code project.\n\n"
        "Features:\n"
        "- Multi-stage Docker builds with caching\n"
        "- Kubernetes deployment manifests\n"
        "- Terraform modules for AWS infrastructure\n"
        "- GitHub Actions workflows for CI/CD\n"
        "- Automated testing (unit, integration, e2e)\n"
        "- SonarQube code quality analysis\n"
        "- Slack notifications for pipeline status\n"
        "- Blue-green deployment strategy",
        "Docker, Kubernetes, Terraform, GitHub Actions, AWS (EKS, ECR, RDS), "
        "Helm, SonarQube, Prometheus, Grafana, ArgoCD",
        "Active",
        ""
    ),
]

print("Adding projects...")
project_ids = []
for name, desc, tech, status, wp in projects_data:
    existing = conn.execute(
        "SELECT id FROM projects WHERE user_id=? AND name=?", (USER_ID, name)
    ).fetchone()
    if existing:
        pid = existing[0]
        conn.execute(
            "UPDATE projects SET description=?, tech_stack=?, status=?, workspace_path=?, "
            "updated_at=CURRENT_TIMESTAMP WHERE id=?",
            (desc, tech, status, wp, pid),
        )
        print(f"  Updated: {name} (ID {pid})")
    else:
        c = conn.execute(
            "INSERT INTO projects (user_id, name, description, tech_stack, status, workspace_path) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (USER_ID, name, desc, tech, status, wp),
        )
        pid = c.lastrowid
        print(f"  Created: {name} (ID {pid})")
    project_ids.append(pid)

# ── 2. Work Logs ─────────────────────────────────────────────

log_entries = [
    # Notesight logs
    (project_ids[0], "Set up CI/CD pipeline with GitHub Actions for GEN-AI deployment", 3.5, today - timedelta(days=21)),
    (project_ids[0], "Migrated Redis to ElastiCache cluster configuration", 4.0, today - timedelta(days=20)),
    (project_ids[0], "Configured CloudWatch dashboards for API monitoring", 2.5, today - timedelta(days=19)),
    (project_ids[0], "Implemented container health checks and auto-recovery", 3.0, today - timedelta(days=18)),
    (project_ids[0], "Drafted infrastructure improvement proposal document", 2.0, today - timedelta(days=17)),
    (project_ids[0], "Deployed GEN-AI agents to ECS Fargate (Profiling, Planner, Content)", 5.0, today - timedelta(days=14)),
    (project_ids[0], "Set up Kafka MSK cluster and migrated topics", 4.5, today - timedelta(days=13)),
    (project_ids[0], "Created automated backup strategy with 7-day retention", 1.5, today - timedelta(days=12)),
    (project_ids[0], "Implemented rate limiter for API endpoints", 2.0, today - timedelta(days=10)),
    (project_ids[0], "Added Slack alerts for container failures and deploy status", 1.5, today - timedelta(days=9)),
    (project_ids[0], "Optimized Celery worker configuration for document processing", 3.0, today - timedelta(days=7)),
    (project_ids[0], "Configured ALB + target groups for API backend", 3.5, today - timedelta(days=5)),
    # E-Commerce logs
    (project_ids[1], "Designed database schema for products, orders, and users", 3.0, today - timedelta(days=16)),
    (project_ids[1], "Implemented Stripe checkout session integration", 4.0, today - timedelta(days=15)),
    (project_ids[1], "Built admin dashboard for inventory management", 3.5, today - timedelta(days=11)),
    (project_ids[1], "Added product search with Elasticsearch", 2.5, today - timedelta(days=8)),
    (project_ids[1], "Set up email notifications via SendGrid", 1.5, today - timedelta(days=6)),
    (project_ids[1], "Implemented order tracking with WebSocket updates", 3.0, today - timedelta(days=4)),
    (project_ids[1], "Wrote unit tests for cart and checkout flow", 2.0, today - timedelta(days=3)),
    # DevOps logs
    (project_ids[2], "Created Terraform modules for VPC, EKS, and RDS", 4.0, today - timedelta(days=19)),
    (project_ids[2], "Set up GitHub Actions workflow for multi-stage Docker builds", 2.5, today - timedelta(days=17)),
    (project_ids[2], "Configured ArgoCD for GitOps deployment", 3.0, today - timedelta(days=15)),
    (project_ids[2], "Implemented blue-green deployment strategy for EKS", 3.5, today - timedelta(days=12)),
    (project_ids[2], "Set up Prometheus + Grafana monitoring stack", 2.5, today - timedelta(days=10)),
    (project_ids[2], "Configured SonarQube code quality gates in pipeline", 1.5, today - timedelta(days=7)),
    (project_ids[2], "Created Helm charts for microservices deployment", 3.0, today - timedelta(days=5)),
    (project_ids[2], "Documented disaster recovery procedures and runbooks", 2.0, today - timedelta(days=3)),
]

# Delete existing logs for this user's projects
for pid in project_ids:
    conn.execute("DELETE FROM work_logs WHERE project_id=?", (pid,))

print("\nAdding work logs...")
for pid, desc, hours, wdate in log_entries:
    conn.execute(
        "INSERT INTO work_logs (project_id, description, work_date, hours_spent) VALUES (?, ?, ?, ?)",
        (pid, desc, wdate.isoformat(), hours),
    )
print(f"  Added {len(log_entries)} work log entries")

# ── 3. Documents ─────────────────────────────────────────────

doc_contents = {
    "architecture-overview.md": (
        "# Notesight Architecture Overview\n\n"
        "## System Components\n"
        "- **Frontend**: Next.js on Vercel CDN\n"
        "- **API Backend**: NestJS on AWS EC2\n"
        "- **GEN-AI Engine**: Python FastAPI on ECS Fargate\n"
        "- **Database Layer**: PostgreSQL RDS + MongoDB\n"
        "- **Message Queue**: Kafka + Redis\n\n"
        "## Deployment Flow\n"
        "1. Developer pushes to GitHub\n"
        "2. GitHub Actions / Jenkins builds & tests\n"
        "3. Docker image pushed to ECR\n"
        "4. ECS Fargate / EC2 pulls and deploys\n\n"
        "## Monitoring Stack\n"
        "- CloudWatch for metrics\n"
        "- Grafana dashboards\n"
        "- Prometheus for alerting\n"
        "- Slack notifications on failures\n\n"
        "## Backup Strategy\n"
        "- PostgreSQL RDS: automated snapshots (7-day retention)\n"
        "- MongoDB: daily backup to S3\n"
        "- EBS snapshots for EC2 instances\n"
        "- DR runbook documented in Wiki\n"
    ),
    "api-endpoints.md": (
        "# API Endpoints Reference\n\n"
        "## Authentication\n"
        "- `POST /api/auth/register` - User registration\n"
        "- `POST /api/auth/login` - User login\n\n"
        "## Projects\n"
        "- `GET /api/projects` - List all projects\n"
        "- `POST /api/projects` - Create project\n"
        "- `GET /api/projects/:id` - Get project details\n"
        "- `PUT /api/projects/:id` - Update project\n"
        "- `DELETE /api/projects/:id` - Delete project\n\n"
        "## Work Logs\n"
        "- `GET /api/logs` - List work logs (filterable)\n"
        "- `POST /api/logs` - Create work log entry\n\n"
        "## Analytics\n"
        "- `GET /api/stats` - Dashboard statistics\n"
        "- `GET /api/analytics` - Detailed analytics\n\n"
        "## AI Features\n"
        "- `POST /api/ai/summarize` - AI work summary\n"
        "- `GET /api/ai/health/:pid` - Project health score\n"
        "- `POST /api/ai/query` - Natural language query\n"
        "- `GET /api/ai/estimate` - Time estimate suggestion\n\n"
        "## Export\n"
        "- `GET /api/export/csv/logs` - Export logs as CSV\n"
        "- `GET /api/export/csv/projects` - Export projects as CSV\n"
    ),
    "devops-runbook.md": (
        "# DevOps Runbook\n\n"
        "## Common Operations\n\n"
        "### Restart API Service\n"
        "```bash\n"
        "kubectl rollout restart deployment/api-deployment -n notesight\n"
        "```\n\n"
        "### Scale GEN-AI Workers\n"
        "```bash\n"
        "kubectl scale deployment/celery-worker --replicas=5 -n notesight\n"
        "```\n\n"
        "### View Logs\n"
        "```bash\n"
        "kubectl logs -f deployment/api-deployment -n notesight\n"
        "```\n\n"
        "## Incident Response\n\n"
        "1. Check CloudWatch alarms\n"
        "2. Verify Grafana dashboards\n"
        "3. Check pod status: `kubectl get pods -n notesight`\n"
        "4. Check logs for error patterns\n"
        "5. Restart service if needed\n"
        "6. Notify team via Slack\n\n"
        "## Backup Verification\n"
        "- RDS backups run daily at 02:00 UTC\n"
        "- MongoDB backups to S3 every 6 hours\n"
        "- Verify backup integrity weekly\n"
        "- Test restore procedure monthly\n"
    ),
}

from datetime import datetime

print("\nAdding documents...")
for filename, content in doc_contents.items():
    content_bytes = content.encode("utf-8")
    unique = f"{secrets.token_hex(8)}_{filename}"
    fpath = os.path.join(UPLOADS, unique)
    with open(fpath, "wb") as f:
        f.write(content_bytes)

    # Add to Notesight project only
    conn.execute(
        "INSERT INTO documents (project_id, filename, original_filename, file_size, uploaded_at) "
        "VALUES (?, ?, ?, ?, ?)",
        (project_ids[0], unique, filename, len(content_bytes), datetime.now().isoformat()),
    )
    print(f"  Added: {filename} ({len(content_bytes)} bytes)")

conn.commit()
conn.close()

print("\n=== SEED COMPLETE ===")
print(f"Projects: {len(project_ids)}")
print(f"Work Logs: {len(log_entries)}")
print(f"Documents: {len(doc_contents)}")
print(f"\nLogin at http://localhost:8501 with:")
print(f"  Username: mayur.shrirao@datafortune.com")
print(f"  Password: test123")
