# API Endpoints Reference

## Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login

## Projects
- `GET /api/projects` - List all projects
- `POST /api/projects` - Create project
- `GET /api/projects/:id` - Get project details
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project

## Work Logs
- `GET /api/logs` - List work logs (filterable)
- `POST /api/logs` - Create work log entry

## Analytics
- `GET /api/stats` - Dashboard statistics
- `GET /api/analytics` - Detailed analytics

## AI Features
- `POST /api/ai/summarize` - AI work summary
- `GET /api/ai/health/:pid` - Project health score
- `POST /api/ai/query` - Natural language query
- `GET /api/ai/estimate` - Time estimate suggestion

## Export
- `GET /api/export/csv/logs` - Export logs as CSV
- `GET /api/export/csv/projects` - Export projects as CSV
