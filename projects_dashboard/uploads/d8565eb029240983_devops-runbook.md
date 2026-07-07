# DevOps Runbook

## Common Operations

### Restart API Service
```bash
kubectl rollout restart deployment/api-deployment -n notesight
```

### Scale GEN-AI Workers
```bash
kubectl scale deployment/celery-worker --replicas=5 -n notesight
```

### View Logs
```bash
kubectl logs -f deployment/api-deployment -n notesight
```

## Incident Response

1. Check CloudWatch alarms
2. Verify Grafana dashboards
3. Check pod status: `kubectl get pods -n notesight`
4. Check logs for error patterns
5. Restart service if needed
6. Notify team via Slack

## Backup Verification
- RDS backups run daily at 02:00 UTC
- MongoDB backups to S3 every 6 hours
- Verify backup integrity weekly
- Test restore procedure monthly
