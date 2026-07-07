# Notesight Architecture Overview

## System Components
- **Frontend**: Next.js on Vercel CDN
- **API Backend**: NestJS on AWS EC2
- **GEN-AI Engine**: Python FastAPI on ECS Fargate
- **Database Layer**: PostgreSQL RDS + MongoDB
- **Message Queue**: Kafka + Redis

## Deployment Flow
1. Developer pushes to GitHub
2. GitHub Actions / Jenkins builds & tests
3. Docker image pushed to ECR
4. ECS Fargate / EC2 pulls and deploys

## Monitoring Stack
- CloudWatch for metrics
- Grafana dashboards
- Prometheus for alerting
- Slack notifications on failures

## Backup Strategy
- PostgreSQL RDS: automated snapshots (7-day retention)
- MongoDB: daily backup to S3
- EBS snapshots for EC2 instances
- DR runbook documented in Wiki
