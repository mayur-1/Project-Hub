const TOKEN_KEY = 'project_hub_token';
const USER_KEY = 'project_hub_user';

function getToken() { return localStorage.getItem(TOKEN_KEY); }
function setToken(t) { localStorage.setItem(TOKEN_KEY, t); }
function clearToken() { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); }
function getAuthHeaders() {
    const t = getToken();
    return t ? { 'Authorization': `Bearer ${t}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

const API = {
    async get(endpoint) {
        const r = await fetch(endpoint, { headers: getAuthHeaders() });
        if (r.status === 401) { clearToken(); showAuthPage(); throw new Error('Session expired'); }
        if (!r.ok) throw new Error((await r.json()).detail || r.statusText);
        return r.json();
    },
    async post(endpoint, data) {
        const r = await fetch(endpoint, {
            method: 'POST', headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });
        if (r.status === 401) { clearToken(); showAuthPage(); throw new Error('Session expired'); }
        if (!r.ok) throw new Error((await r.json()).detail || r.statusText);
        return r.json();
    },
    async put(endpoint, data) {
        const r = await fetch(endpoint, {
            method: 'PUT', headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });
        if (r.status === 401) { clearToken(); showAuthPage(); throw new Error('Session expired'); }
        if (!r.ok) throw new Error((await r.json()).detail || r.statusText);
        return r.json();
    },
    async del(endpoint) {
        const r = await fetch(endpoint, { method: 'DELETE', headers: getAuthHeaders() });
        if (r.status === 401) { clearToken(); showAuthPage(); throw new Error('Session expired'); }
        if (!r.ok) throw new Error((await r.json()).detail || r.statusText);
        return r.json();
    },
    async upload(endpoint, formData) {
        const t = getToken();
        const headers = t ? { 'Authorization': `Bearer ${t}` } : {};
        const r = await fetch(endpoint, { method: 'POST', headers, body: formData });
        if (r.status === 401) { clearToken(); showAuthPage(); throw new Error('Session expired'); }
        if (!r.ok) throw new Error((await r.json()).detail || r.statusText);
        return r.json();
    }
};

async function loginUser(username, password) {
    const r = await fetch('/api/login', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ username, password }) });
    if (!r.ok) throw new Error((await r.json()).detail || 'Login failed');
    const data = await r.json();
    setToken(data.token);
    localStorage.setItem(USER_KEY, data.username);
    return data;
}

async function registerUser(username, email, mobile, password, confirm_password) {
    const r = await fetch('/api/register', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ username, email, mobile, password, confirm_password }) });
    if (!r.ok) throw new Error((await r.json()).detail || 'Registration failed');
    return r.json();
}

function logoutUser() {
    clearToken();
    showAuthPage();
}

const STATUS_COLORS = {
    'Active': '#00d4aa', 'On Hold': '#ffa726',
    'Completed': '#7c4dff', 'Archived': '#78909c',
};
const STATUS_ICONS = {
    'Active': '●', 'On Hold': '◷', 'Completed': '✓', 'Archived': '◻',
};

function badge(status) {
    const c = STATUS_COLORS[status] || '#78909c';
    const i = STATUS_ICONS[status] || '●';
    return `<span class="status-badge" style="background:${c}22;color:${c};border:1px solid ${c}44">${i} ${status}</span>`;
}

// ── Theme Toggle ──
function toggleTheme() {
    const html = document.documentElement;
    const icon = document.getElementById('theme-icon');
    const label = document.getElementById('theme-label');
    if (html.getAttribute('data-theme') === 'light') {
        html.removeAttribute('data-theme');
        icon.className = 'fas fa-moon';
        label.textContent = 'Dark';
        localStorage.setItem('project_hub_theme', 'dark');
    } else {
        html.setAttribute('data-theme', 'light');
        icon.className = 'fas fa-sun';
        label.textContent = 'Light';
        localStorage.setItem('project_hub_theme', 'light');
    }
}

function initTheme() {
    const saved = localStorage.getItem('project_hub_theme');
    if (saved === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
        document.getElementById('theme-icon').className = 'fas fa-sun';
        document.getElementById('theme-label').textContent = 'Light';
    }
}

// ── Command Palette ──
const COMMANDS = [
    { id: 'nav-dashboard', icon: 'fa-th-large', label: 'Go to Dashboard', category: 'Navigation', action: () => navigate('dashboard') },
    { id: 'nav-projects', icon: 'fa-folder', label: 'Go to Projects', category: 'Navigation', action: () => navigate('projects') },
    { id: 'nav-worklog', icon: 'fa-clipboard-list', label: 'Go to Work Log', category: 'Navigation', action: () => navigate('worklog') },
    { id: 'nav-analytics', icon: 'fa-chart-line', label: 'Go to Analytics', category: 'Navigation', action: () => navigate('analytics') },
    { id: 'nav-ai', icon: 'fa-brain', label: 'Go to AI Insights', category: 'Navigation', action: () => navigate('ai-insights') },
    { id: 'action-new-project', icon: 'fa-plus', label: 'New Project', category: 'Actions', action: () => { closeCommandPalette(); setTimeout(showAddProject, 200); } },
    { id: 'action-log-work', icon: 'fa-clock', label: 'Log Work Entry', category: 'Actions', action: () => { closeCommandPalette(); API.get('/api/projects').then(ps => { openModalForLog(ps); }).catch(() => openModalForLog([])); } },
    { id: 'action-refresh', icon: 'fa-sync-alt', label: 'Refresh Page', category: 'Actions', action: () => { closeCommandPalette(); refreshData(); } },
    { id: 'action-export-csv', icon: 'fa-download', label: 'Export Logs to CSV', category: 'Export', action: () => { closeCommandPalette(); exportLogsCSV(); } },
    { id: 'action-export-projects', icon: 'fa-download', label: 'Export Projects to CSV', category: 'Export', action: () => { closeCommandPalette(); exportProjectsCSV(); } },
    { id: 'action-theme', icon: 'fa-palette', label: 'Toggle Theme', category: 'Settings', action: () => { closeCommandPalette(); toggleTheme(); } },
    { id: 'action-ai-ask', icon: 'fa-robot', label: 'Ask AI Assistant', category: 'AI', action: () => { closeCommandPalette(); setTimeout(openAIPanel, 200); } },
    { id: 'action-ai-health', icon: 'fa-heartbeat', label: 'Project Health Overview', category: 'AI', action: () => { closeCommandPalette(); navigate('ai-insights'); } },
    { id: 'action-ai-summarize', icon: 'fa-file-alt', label: 'Generate Work Summary', category: 'AI', action: () => { closeCommandPalette(); API.get('/api/ai/summarize').then(s => toast(`AI: ${s.summary}`, 'info')).catch(e => toast(e.message, 'error')); } },
];

function openCommandPalette() {
    document.getElementById('cmd-palette-overlay').classList.add('open');
    const input = document.getElementById('cmd-search');
    input.value = '';
    input.focus();
    renderCommands(COMMANDS);
}

function closeCommandPalette(e) {
    if (e && e.target !== e.currentTarget) return;
    document.getElementById('cmd-palette-overlay').classList.remove('open');
}

function renderCommands(commands, query) {
    const container = document.getElementById('cmd-results');
    if (!container) return;

    let filtered = commands;
    if (query) {
        const q = query.toLowerCase();
        filtered = commands.filter(c => c.label.toLowerCase().includes(q) || c.category.toLowerCase().includes(q));
    }

    if (filtered.length === 0) {
        container.innerHTML = `<div class="cmd-empty">No results for "${query}"</div>`;
        return;
    }

    let html = '';
    let lastCategory = '';
    filtered.forEach((cmd, i) => {
        if (cmd.category !== lastCategory) {
            html += `<div style="padding:6px 20px 2px;font-size:0.6rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.1em">${cmd.category}</div>`;
            lastCategory = cmd.category;
        }
        html += `<div class="cmd-item ${i === 0 ? 'active' : ''}" data-index="${i}" onclick="executeCommand('${cmd.id}')">
            <i class="fas ${cmd.icon}"></i>
            <span>${cmd.label}</span>
        </div>`;
    });

    container.innerHTML = html;
}

let cmdSelectedIndex = 0;

function executeCommand(id) {
    const cmd = COMMANDS.find(c => c.id === id);
    if (cmd) cmd.action();
}

function navigateCommands(direction) {
    const items = document.querySelectorAll('.cmd-item');
    const active = document.querySelector('.cmd-item.active');
    let idx = Array.from(items).indexOf(active);
    idx = (idx + direction + items.length) % items.length;
    items.forEach(i => i.classList.remove('active'));
    items[idx].classList.add('active');
    items[idx].scrollIntoView({ block: 'nearest' });
}

document.addEventListener('keydown', (e) => {
    // Ctrl+K / Cmd+K
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const palette = document.getElementById('cmd-palette-overlay');
        if (palette.classList.contains('open')) {
            closeCommandPalette();
        } else {
            openCommandPalette();
        }
    }

    // ESC to close modals/palettes
    if (e.key === 'Escape') {
        if (document.getElementById('cmd-palette-overlay').classList.contains('open')) {
            closeCommandPalette();
        } else if (document.getElementById('ai-panel-overlay').classList.contains('open')) {
            closeAIPanel();
        } else if (document.getElementById('modal-overlay').classList.contains('open')) {
            closeModal();
        }
    }

    // Command palette keyboard navigation
    if (document.getElementById('cmd-palette-overlay').classList.contains('open')) {
        if (e.key === 'ArrowDown') { e.preventDefault(); navigateCommands(1); }
        if (e.key === 'ArrowUp') { e.preventDefault(); navigateCommands(-1); }
        if (e.key === 'Enter') {
            e.preventDefault();
            const active = document.querySelector('.cmd-item.active');
            if (active) {
                const idx = parseInt(active.dataset.index);
                const filtered = getFilteredCommands();
                if (filtered[idx]) executeCommand(filtered[idx].id);
            }
        }
    }

    // Alt+number for page navigation
    if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const pages = ['dashboard', 'projects', 'worklog', 'analytics', 'ai-insights'];
        const num = parseInt(e.key);
        if (num >= 1 && num <= pages.length) {
            e.preventDefault();
            navigate(pages[num - 1]);
        }
    }
});

function getFilteredCommands() {
    const query = document.getElementById('cmd-search').value.trim();
    if (!query) return COMMANDS;
    const q = query.toLowerCase();
    return COMMANDS.filter(c => c.label.toLowerCase().includes(q) || c.category.toLowerCase().includes(q));
}

// Command palette search handler + AI query Enter key
document.addEventListener('DOMContentLoaded', () => {
    const cmdSearch = document.getElementById('cmd-search');
    if (cmdSearch) {
        cmdSearch.addEventListener('input', (e) => {
            const filtered = getFilteredCommands();
            renderCommands(filtered, e.target.value);
        });
        cmdSearch.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
                e.preventDefault();
            }
        });
    }

    // AI query Enter key support
    const aiQueryInput = document.getElementById('ai-query-input');
    if (aiQueryInput) {
        aiQueryInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                askAI();
            }
        });
    }
});

// ── AI Assistant Panel ──
function openAIPanel() {
    document.getElementById('ai-panel-overlay').classList.add('open');
    loadQuickInsights();
    setTimeout(() => {
        const input = document.getElementById('ai-query-input');
        if (input) input.focus();
    }, 300);
}

function closeAIPanel(e) {
    if (e && e.target !== e.currentTarget) return;
    document.getElementById('ai-panel-overlay').classList.remove('open');
}

async function loadQuickInsights() {
    const grid = document.getElementById('ai-insights-grid');
    try {
        const insights = await API.get('/api/ai/insights');
        const summary = await API.post('/api/ai/summarize', {});
        const health = await API.get('/api/ai/health');

        let html = `
        <div class="ai-insight-card">
            <span class="ai-insight-icon">📊</span>
            <div class="ai-insight-value">${summary.productivity_score || 0}%</div>
            <div class="ai-insight-label">Productivity Score</div>
            <div class="ai-insight-detail">${summary.log_count || 0} entries, ${summary.total_hours || 0}h total</div>
        </div>
        <div class="ai-insight-card">
            <span class="ai-insight-icon">🎯</span>
            <div class="ai-insight-value">${summary.primary_focus || 'N/A'}</div>
            <div class="ai-insight-label">Primary Focus</div>
            <div class="ai-insight-detail">${summary.daily_average || 0}h daily average</div>
        </div>
        <div class="ai-insight-card">
            <span class="ai-insight-icon">❤️</span>
            <div class="ai-insight-value">${health.overall_health || 0}%</div>
            <div class="ai-insight-label">Overall Health</div>
            <div class="ai-insight-detail">${health.projects ? health.projects.length + ' projects tracked' : 'No projects'}</div>
        </div>`;

        grid.innerHTML = html;
    } catch (e) {
        grid.innerHTML = `<div class="text-muted text-sm" style="grid-column:1/-1;text-align:center;padding:20px">${e.message}</div>`;
    }
}

async function askAI() {
    const input = document.getElementById('ai-query-input');
    const query = input.value.trim();
    if (!query) return;

    const response = document.getElementById('ai-response');
    const answer = document.getElementById('ai-answer');
    const dataContainer = document.getElementById('ai-response-data');
    response.style.display = 'none';

    try {
        answer.innerHTML = `<div class="ai-thinking"><span>Analyzing</span><div class="dot-pulse"><span></span><span></span><span></span></div></div>`;
        response.style.display = 'block';

        const result = await API.post('/api/ai/query', { query });
        answer.innerHTML = result.answer;

        if (result.data && result.data.length > 0) {
            const item = result.data[0];
            if (item.project_name || item.project) {
                dataContainer.innerHTML = `
                <div class="table-wrapper"><table><thead><tr>
                    ${item.project_name || item.project ? '<th>Project</th>' : ''}
                    ${item.health_score !== undefined ? '<th>Health</th><th>Status</th><th>Trend</th>' : ''}
                    ${item.hours_spent !== undefined ? '<th>Hours</th><th>Date</th>' : ''}
                    ${item.status !== undefined ? '<th>Status</th>' : ''}
                </tr></thead><tbody>
                ${result.data.map(d => {
                    const healthClass = d.health_score >= 70 ? 'healthy' : d.health_score >= 40 ? 'needs-attention' : 'at-risk';
                    return `<tr>
                        ${d.project_name || d.project ? `<td>${escapeHtml(d.project_name || d.project)}</td>` : ''}
                        ${d.health_score !== undefined ? `<td><div class="health-bar"><div class="health-bar-track"><div class="health-bar-fill ${healthClass}" style="width:${d.health_score}%"></div></div><span class="health-label ${healthClass}">${d.health_score}%</span></div></td>
                        <td><span class="ai-badge ${d.health_score >= 70 ? 'green' : d.health_score >= 40 ? 'amber' : ''}">${d.status || 'N/A'}</span></td>
                        <td><span class="ai-badge ${d.trend === 'up' ? 'green' : d.trend === 'down' ? '' : ''}">${d.trend || 'stable'}</span></td>` : ''}
                        ${d.hours_spent !== undefined ? `<td>${d.hours_spent}h</td><td>${d.work_date || ''}</td>` : ''}
                        ${d.status && d.health_score === undefined ? `<td>${badge(d.status)}</td>` : ''}
                    </tr>`;
                }).join('')}
                </tbody></table></div>`;
            } else {
                dataContainer.innerHTML = '';
            }
        } else {
            dataContainer.innerHTML = '';
        }
    } catch (e) {
        answer.innerHTML = `<span style="color:var(--danger)">Error: ${e.message}</span>`;
    }
}

// ── CSV Export ──
async function exportLogsCSV(projectId) {
    try {
        let url = '/api/export/csv/logs';
        if (projectId) url += `?project_id=${projectId}`;

        const token = getToken();
        const r = await fetch(url, { headers: token ? { 'Authorization': `Bearer ${token}` } : {} });
        if (!r.ok) throw new Error('Export failed');

        const blob = await r.blob();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'work_logs_export.csv';
        a.click();
        URL.revokeObjectURL(a.href);
        toast('Logs exported!', 'success');
    } catch (e) {
        toast(e.message, 'error');
    }
}

async function exportProjectsCSV() {
    try {
        const token = getToken();
        const r = await fetch('/api/export/csv/projects', { headers: token ? { 'Authorization': `Bearer ${token}` } : {} });
        if (!r.ok) throw new Error('Export failed');

        const blob = await r.blob();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'projects_export.csv';
        a.click();
        URL.revokeObjectURL(a.href);
        toast('Projects exported!', 'success');
    } catch (e) {
        toast(e.message, 'error');
    }
}

// ── Client-side AI Categorization (mirrors server) ──
const CATEGORY_KW = {
    "Development": ["code", "implement", "develop", "fix", "debug", "build", "feature", "api", "frontend", "backend", "refactor", "merge", "deploy", "migration", "testing", "unit test", "integration", "pull request", "commit"],
    "Design": ["design", "ui", "ux", "wireframe", "prototype", "mockup", "figma", "sketch", "layout", "component", "style", "theme", "css", "responsive", "illustration"],
    "Documentation": ["doc", "readme", "wiki", "confluence", "write", "update doc", "technical spec", "requirement", "spec", "manual", "guide", "changelog"],
    "Meeting": ["meeting", "standup", "sync", "review", "retro", "planning", "demo", "present", "call", "discussion", "brainstorm", "workshop"],
    "Research": ["research", "investigate", "explore", "learn", "study", "prototype", "proof of concept", "poc", "analyze", "evaluation", "compare", "benchmark"],
    "Management": ["plan", "manage", "organize", "prioritize", "sprint", "backlog", "board", "task", "ticket", "jira", "trello", "roadmap", "milestone"],
    "Support": ["support", "incident", "bug fix", "hotfix", "patch", "issue", "troubleshoot", "resolve", "escalation", "outage", "maintenance"],
    "DevOps": ["deploy", "ci/cd", "pipeline", "docker", "kubernetes", "infra", "terraform", "ansible", "monitor", "alert", "logging", "backup", "server", "cloud", "aws", "azure", "gcp"],
};

function categorizeWork(description) {
    const d = description.toLowerCase();
    let best = { cat: 'General', score: 0 };
    for (const [cat, kws] of Object.entries(CATEGORY_KW)) {
        const score = kws.filter(kw => d.includes(kw)).length;
        if (score > best.score) best = { cat, score };
    }
    return best.cat;
}

let suggestTimer = null;
function suggestEstimate(textarea) {
    clearTimeout(suggestTimer);
    const desc = textarea.value.trim();
    const suggestion = document.getElementById('ai-estimate-suggestion');
    if (desc.length < 10) {
        suggestion.innerHTML = '';
        return;
    }
    suggestTimer = setTimeout(async () => {
        const techStackEl = document.querySelector('select[name="project_id"]');
        let techStack = '';
        if (techStackEl && techStackEl.value) {
            try {
                const proj = await API.get(`/api/projects/${techStackEl.value}`);
                techStack = proj.tech_stack || '';
            } catch (e) {}
        }
        try {
            const result = await API.get(`/api/ai/estimate?description=${encodeURIComponent(desc)}&tech_stack=${encodeURIComponent(techStack)}`);
            suggestion.innerHTML = `<span class="ai-suggestion" onclick="applyEstimate(${result.estimated_hours})">
                <i class="fas fa-magic"></i> AI suggests ~${result.estimated_hours}h (${result.complexity} complexity, ${result.confidence} confidence) — click to apply
            </span>`;
        } catch (e) {
            suggestion.innerHTML = '';
        }
    }, 600);
}

function applyEstimate(hours) {
    const input = document.querySelector('input[name="hours_spent"]');
    if (input) input.value = hours;
    document.getElementById('ai-estimate-suggestion').innerHTML = `<span class="ai-suggestion" style="opacity:0.6">✓ Applied: ${hours}h</span>`;
}

function escapeHtml(text) {
    const d = document.createElement('div');
    d.textContent = text;
    return d.innerHTML;
}

// ---- Toast ----
function toast(message, type = 'info') {
    const icons = {success: 'fa-check-circle', error: 'fa-times-circle', info: 'fa-info-circle'};
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i><span>${message}</span>`;
    container.appendChild(el);
    setTimeout(() => {
        el.classList.add('removing');
        setTimeout(() => el.remove(), 300);
    }, 3000);
}

// ---- Modal ----
function openModal(html) {
    document.getElementById('modal-overlay').classList.add('open');
    document.getElementById('modal-body').innerHTML = html;
}
function closeModal(e) {
    if (e && e.target !== e.currentTarget) return;
    document.getElementById('modal-overlay').classList.remove('open');
}

// ---- Navigation ----
let currentPage = 'dashboard';

document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        const page = item.dataset.page;
        navigate(page);
    });
});

function navigate(page) {
    currentPage = page;
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelector(`.nav-item[data-page="${page}"]`).classList.add('active');

    const titles = {dashboard: 'Dashboard', projects: 'Projects', worklog: 'Work Log', analytics: 'Analytics', 'ai-insights': 'AI Insights'};
    const titleEl = document.getElementById('page-title');
    const contentEl = document.getElementById('page-content');

    if (typeof gsap !== 'undefined') {
        gsap.to(titleEl, { opacity: 0, y: -6, duration: 0.15, ease: 'power2.out', onComplete: () => {
            titleEl.textContent = titles[page] || 'Dashboard';
            gsap.to(titleEl, { opacity: 1, y: 0, duration: 0.3, ease: 'power3.out' });
        }});
        gsap.to(contentEl, { opacity: 0, y: 8, duration: 0.12, ease: 'power2.out', onComplete: () => {
            renderPage(page);
        }});
    } else {
        titleEl.textContent = titles[page] || 'Dashboard';
        renderPage(page);
    }
}

function animatePageIn() {
    const el = document.getElementById('page-content');
    if (typeof gsap !== 'undefined') {
        gsap.fromTo(el, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out' });
    }
}

function renderPage(page) {
    const content = document.getElementById('page-content');

    const skeletons = {
        dashboard: `
            <div class="loading-page">
                <div class="metrics-row">
                    <div class="skeleton skeleton-metric"></div>
                    <div class="skeleton skeleton-metric"></div>
                    <div class="skeleton skeleton-metric"></div>
                    <div class="skeleton skeleton-metric"></div>
                </div>
                <div class="cards-row">
                    <div class="skeleton skeleton-card"></div>
                    <div class="skeleton skeleton-card"></div>
                </div>
                <div class="skeleton skeleton-card" style="height:140px"></div>
            </div>`,
        projects: `
            <div class="skeleton skeleton-card" style="height:50px;width:160px"></div>
            <div class="loading-page mt-4">
                <div class="skeleton skeleton-card"></div>
                <div class="skeleton skeleton-card"></div>
                <div class="skeleton skeleton-card"></div>
            </div>`,
        worklog: `
            <div class="skeleton skeleton-card" style="height:50px;width:140px"></div>
            <div class="loading-page mt-4">
                <div class="skeleton skeleton-card" style="height:80px"></div>
                <div class="skeleton skeleton-table"></div>
            </div>`,
        analytics: `
            <div class="loading-page">
                <div class="cards-row">
                    <div class="skeleton skeleton-card"></div>
                    <div class="skeleton skeleton-card"></div>
                </div>
                <div class="skeleton skeleton-card" style="height:100px"></div>
                <div class="skeleton skeleton-table"></div>
            </div>`,
        'ai-insights': `
            <div class="loading-page">
                <div class="metrics-row" style="grid-template-columns:repeat(3,1fr)">
                    <div class="skeleton skeleton-metric"></div>
                    <div class="skeleton skeleton-metric"></div>
                    <div class="skeleton skeleton-metric"></div>
                </div>
                <div class="skeleton skeleton-card" style="height:100px"></div>
                <div class="skeleton skeleton-card" style="height:200px"></div>
            </div>`,
    };

    content.innerHTML = skeletons[page] || skeletons.dashboard;
    if (page === 'dashboard') renderDashboard();
    else if (page === 'projects') renderProjects();
    else if (page === 'worklog') renderWorkLog();
    else if (page === 'analytics') renderAnalytics();
    else if (page === 'ai-insights') renderAIInsights();
}

function refreshData() {
    const btn = document.querySelector('.page-heading .btn-glass');
    if (btn) {
        btn.disabled = true;
        const orig = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';
        setTimeout(() => { btn.disabled = false; btn.innerHTML = orig; }, 2000);
    }
    renderPage(currentPage);
}

// ============================================================
// DASHBOARD
// ============================================================
async function renderDashboard() {
    const el = document.getElementById('page-content');
    try {
        const [stats, projects] = await Promise.all([API.get('/api/stats'), API.get('/api/projects')]);

        let html = `
        <div class="metrics-grid">
            <div class="metric-card"><div class="metric-icon">📦</div><div class="metric-value">${stats.total_projects}</div><div class="metric-label">Total Projects</div></div>
            <div class="metric-card"><div class="metric-icon" style="color:#00d4aa">●</div><div class="metric-value">${stats.active}</div><div class="metric-label">Active</div></div>
            <div class="metric-card"><div class="metric-icon" style="color:#ffa726">◷</div><div class="metric-value">${stats.on_hold}</div><div class="metric-label">On Hold</div></div>
            <div class="metric-card"><div class="metric-icon" style="color:#7c4dff">✓</div><div class="metric-value">${stats.completed}</div><div class="metric-label">Completed</div></div>
        </div>
        <div class="grid-2">
            <div class="card">
                <div class="card-header"><span class="card-title">⏱ Logging Summary</span></div>
                <div class="card-body">
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:8px">
                        <div><div style="font-size:1.6rem;font-weight:800">${stats.total_hours}</div><div class="text-muted text-sm">Total Hours</div></div>
                        <div><div style="font-size:1.6rem;font-weight:800">${stats.total_logs}</div><div class="text-muted text-sm">Total Entries</div></div>
                        <div><div style="font-size:1.6rem;font-weight:800">${stats.today_logs}</div><div class="text-muted text-sm">Today's Logs</div></div>
                        <div><div style="font-size:1.6rem;font-weight:800">${projects.length}</div><div class="text-muted text-sm">Projects</div></div>
                    </div>
                </div>
            </div>
            <div class="card">
                <div class="card-header"><span class="card-title">🚀 Latest Projects</span></div>
                <div class="card-body">`;
        if (projects.length === 0) {
            html += `<div class="text-muted" style="margin-top:8px">No projects yet.</div>`;
        } else {
            html += `<div style="display:flex;flex-direction:column;gap:10px;margin-top:8px">`;
            projects.slice(0, 4).forEach(p => {
                html += `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:rgba(255,255,255,0.03);border-radius:10px">
                    <span style="font-weight:600">${escapeHtml(p.name)}</span>
                    ${badge(p.status)}
                </div>`;
            });
            html += `</div>`;
        }
        html += `
                </div>
            </div>
        </div>`;

        if (projects.length > 0) {
            html += `<div class="card mt-4"><div class="card-header"><span class="card-title">📋 Recent Work</span></div><div class="card-body">`;
            const logs = await API.get('/api/logs');
            if (logs.length === 0) {
                html += `<div class="text-muted">No work logged yet.</div>`;
            } else {
                logs.slice(0, 8).forEach(l => {
                    html += `<div class="work-caption">📅 ${l.work_date} &nbsp;|&nbsp; ⏱ ${l.hours_spent}h &nbsp;|&nbsp; <strong>${escapeHtml(l.project)}</strong> &nbsp;—&nbsp; ${escapeHtml(l.description)}</div>`;
                });
            }
            html += `</div></div>`;

            // AI Summary card
            try {
                const summary = await API.post('/api/ai/summarize', {});
                if (summary.summary && summary.summary !== 'No work logged yet.') {
                    html += `<div class="card mt-4">
                        <div class="card-header">
                            <span class="card-title">🧠 AI Insights</span>
                            <div style="display:flex;gap:6px">
                                <span class="ai-badge green">⚡ ${summary.productivity_score || 0}% productivity</span>
                                <span class="ai-badge purple">🎯 ${summary.primary_focus || 'N/A'}</span>
                            </div>
                        </div>
                        <div class="card-body">
                            <div style="display:flex;align-items:flex-start;gap:12px">
                                <i class="fas fa-robot" style="color:var(--accent-teal);font-size:1.3rem;margin-top:2px"></i>
                                <p style="color:var(--text-secondary);font-size:0.88rem;line-height:1.6">${summary.summary}</p>
                            </div>
                            ${summary.topics && summary.topics.length > 0 ? `
                            <div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:6px">
                                ${summary.topics.map(t => `<span class="category-badge">#${escapeHtml(t)}</span>`).join('')}
                            </div>` : ''}
                        </div>
                    </div>`;
                }
            } catch (e) {}
        }

        el.innerHTML = html;
        animatePageIn();
    } catch (e) {
        el.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><h3>Error Loading Dashboard</h3><p>${e.message}</p><button class="btn btn-sm" onclick="refreshData()">Retry</button></div>`;
    }
}

// ============================================================
// PROJECTS
// ============================================================
async function renderProjects() {
    const el = document.getElementById('page-content');
    try {
        const projects = await API.get('/api/projects');
        let html = `
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
            <button class="btn" onclick="showAddProject()"><i class="fas fa-plus"></i> New Project</button>
            <button class="btn btn-sm btn-export" onclick="exportProjectsCSV()"><i class="fas fa-download"></i> Export CSV</button>
        </div>
        <div class="mt-4">`;
        if (projects.length === 0) {
            html += `<div class="empty-state"><i class="fas fa-folder-open"></i><h3>No Projects</h3><p>Create your first project to get started.</p><button class="btn btn-sm" onclick="showAddProject()"><i class="fas fa-plus"></i> Create Project</button></div>`;
        } else {
            // Fetch health data for projects
            let healthData = {};
            try {
                const health = await API.get('/api/ai/health');
                if (health.projects) {
                    health.projects.forEach(p => { healthData[p.project_id] = p; });
                }
            } catch (e) {}

            html += `<div class="project-list">`;
            for (const p of projects) {
                const h = healthData[p.id];
                let healthBarHtml = '';
                if (h) {
                    const hClass = h.health_score >= 70 ? 'healthy' : h.health_score >= 40 ? 'needs-attention' : 'at-risk';
                    const trendIcon = h.trend === 'up' ? '📈' : h.trend === 'down' ? '📉' : '➡️';
                    healthBarHtml = `
                    <div style="margin-top:8px">
                        <div class="health-bar">
                            <div class="health-bar-track">
                                <div class="health-bar-fill ${hClass}" style="width:${h.health_score}%"></div>
                            </div>
                            <span class="health-label ${hClass}">${h.health_score}% ${trendIcon}</span>
                        </div>
                        <div class="text-muted text-sm" style="font-size:0.7rem;margin-top:2px">${h.insight || ''}</div>
                    </div>`;
                }
                html += `
                <div class="project-card">
                    <div class="project-card-top">
                        <div>
                            <div class="project-name">🚀 ${escapeHtml(p.name)}</div>
                            <div class="project-meta">
                                ${badge(p.status)}
                                <span>🛠 ${escapeHtml(p.tech_stack || '—')}</span>
                                <span>📅 ${p.updated_at}</span>
                                ${h ? `<span class="ai-badge">🧠 AI Health</span>` : ''}
                                ${p.workspace_path ? `<span class="workspace-badge" onclick="openWorkspace(${p.id})" title="Open workspace folder"><i class="fas fa-folder-open"></i> Workspace</span>` : ''}
                            </div>
                        </div>
                        <div class="project-actions">
                            <button class="btn btn-sm btn-ghost" onclick="showProjectDocs(${p.id})" title="Documents"><i class="fas fa-file-alt"></i></button>
                            <button class="btn btn-sm btn-ghost" onclick="showEditProject(${p.id})" title="Edit"><i class="fas fa-edit"></i></button>
                            <button class="btn btn-sm btn-ghost" onclick="deleteProject(${p.id})" title="Delete"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                    ${p.description ? `<div class="project-desc">${escapeHtml(p.description)}</div>` : ''}
                    ${healthBarHtml}
                </div>`;
            }
            html += `</div>`;
        }
        html += `</div>`;
        el.innerHTML = html;
        animatePageIn();
    } catch (e) {
        el.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><h3>Error</h3><p>${e.message}</p><button class="btn btn-sm" onclick="refreshData()">Retry</button></div>`;
    }
}

function showAddProject() {
    openModal(`
        <form id="projectForm" onsubmit="submitAddProject(event)">
            <div class="form-group">
                <label>Project Name *</label>
                <input class="form-control" name="name" placeholder="e.g. E-commerce App" required>
            </div>
            <div class="form-group">
                <label>Description</label>
                <textarea class="form-control" name="description" placeholder="Brief description..." rows="3"></textarea>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Tech Stack</label>
                    <input class="form-control" name="tech_stack" placeholder="e.g. Python, React">
                </div>
                <div class="form-group">
                    <label>Status</label>
                    <select class="form-control" name="status">
                        <option value="Active">Active</option>
                        <option value="On Hold">On Hold</option>
                        <option value="Completed">Completed</option>
                        <option value="Archived">Archived</option>
                    </select>
                </div>
            </div>
            <div class="form-group" style="margin-top:20px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.06)">
                <label style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
                    <i class="fas fa-file-alt" style="color:#00f2fe"></i> Documents <span class="text-muted text-sm" style="font-weight:400">(optional)</span>
                </label>
                <div style="border:1px dashed rgba(255,255,255,0.1);border-radius:10px;padding:16px;text-align:center;background:rgba(255,255,255,0.02);cursor:pointer" onclick="document.getElementById('doc-input').click()">
                    <i class="fas fa-cloud-upload-alt" style="font-size:1.5rem;color:#4facfe;display:block;margin-bottom:6px"></i>
                    <div class="text-muted text-sm">Click to select files</div>
                    <div class="text-muted text-sm" style="font-size:0.7rem;margin-top:2px">PDF, DOCX, images, spreadsheets — max 20MB each</div>
                    <input type="file" id="doc-input" multiple style="display:none" onchange="prependDocNames(this)">
                </div>
                <div id="doc-preview" style="margin-top:8px;display:flex;flex-direction:column;gap:4px"></div>
            </div>
            <div class="modal-box-footer" style="padding:0;padding-top:12px;border:none">
                <button type="button" class="btn btn-outline btn-sm" onclick="closeModal()">Cancel</button>
                <button type="submit" class="btn btn-sm" id="create-project-btn"><i class="fas fa-plus"></i> Create Project</button>
            </div>
        </form>
    `);
    document.getElementById('modal-title').textContent = '✨ New Project';
}

function prependDocNames(input) {
    const preview = document.getElementById('doc-preview');
    if (!input.files || input.files.length === 0) { preview.innerHTML = ''; return; }
    preview.innerHTML = Array.from(input.files).map(f => `
        <div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:rgba(0,242,254,0.05);border-radius:6px;border:1px solid rgba(0,242,254,0.08)">
            <i class="fas fa-file" style="color:#4facfe;font-size:0.8rem"></i>
            <span style="font-size:0.8rem;color:#e4e4f0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(f.name)}</span>
            <span class="text-muted text-sm" style="font-size:0.7rem;flex-shrink:0">${formatFileSize(f.size)}</span>
        </div>
    `).join('');
}

async function submitAddProject(e) {
    e.preventDefault();
    const btn = document.getElementById('create-project-btn');
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
    const fd = new FormData(e.target);
    const data = Object.fromEntries(fd.entries());
    try {
        const project = await API.post('/api/projects', data);
        const fileInput = document.getElementById('doc-input');
        if (fileInput && fileInput.files && fileInput.files.length > 0) {
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading docs...';
            for (const file of fileInput.files) {
                if (file.size > 20 * 1024 * 1024) {
                    toast(`Skipped ${file.name} (too large)`, 'error');
                    continue;
                }
                const uploadFd = new FormData();
                uploadFd.append('file', file);
                await API.upload(`/api/projects/${project.id}/documents`, uploadFd);
            }
        }
        closeModal();
        toast('Project created successfully!', 'success');
        renderProjects();
    } catch (err) {
        toast(err.message, 'error');
    }
    btn.disabled = false; btn.innerHTML = '<i class="fas fa-plus"></i> Create Project';
}

function showEditProject(id) {
    API.get(`/api/projects/${id}`).then(p => {
        openModal(`
            <form id="editForm" onsubmit="submitEditProject(event, ${id})">
                <div class="form-group">
                    <label>Project Name *</label>
                    <input class="form-control" name="name" value="${escapeHtml(p.name)}" required>
                </div>
                <div class="form-group">
                    <label>Description</label>
                    <textarea class="form-control" name="description" rows="3">${escapeHtml(p.description)}</textarea>
                </div>
                <div class="form-group">
                    <label>Workspace Path (optional)</label>
                    <input class="form-control" name="workspace_path" value="${escapeHtml(p.workspace_path || '')}" placeholder="e.g. C:\Users\...\Project">
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Tech Stack</label>
                        <input class="form-control" name="tech_stack" value="${escapeHtml(p.tech_stack)}">
                    </div>
                    <div class="form-group">
                        <label>Status</label>
                        <select class="form-control" name="status">
                            <option value="Active" ${p.status === 'Active' ? 'selected' : ''}>Active</option>
                            <option value="On Hold" ${p.status === 'On Hold' ? 'selected' : ''}>On Hold</option>
                            <option value="Completed" ${p.status === 'Completed' ? 'selected' : ''}>Completed</option>
                            <option value="Archived" ${p.status === 'Archived' ? 'selected' : ''}>Archived</option>
                        </select>
                    </div>
                </div>
                <div class="modal-box-footer" style="padding:0;padding-top:8px;border:none">
                    <button type="button" class="btn btn-outline btn-sm" onclick="closeModal()">Cancel</button>
                    <button type="submit" class="btn btn-sm"><i class="fas fa-save"></i> Save Changes</button>
                </div>
            </form>
        `);
        document.getElementById('modal-title').textContent = '✏️ Edit Project';
    });
}

async function submitEditProject(e, id) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = Object.fromEntries(fd.entries());
    try {
        await API.put(`/api/projects/${id}`, data);
        closeModal();
        toast('Project updated!', 'success');
        renderProjects();
    } catch (err) {
        toast(err.message, 'error');
    }
}

async function deleteProject(id) {
    openModal(`
        <div style="text-align:center;padding:16px 0">
            <i class="fas fa-exclamation-triangle" style="font-size:2.5rem;color:var(--warning);margin-bottom:16px;display:block"></i>
            <h4 style="margin-bottom:8px">Delete this project?</h4>
            <p class="text-muted text-sm" style="margin-bottom:20px">All work logs and documents will be permanently removed. This cannot be undone.</p>
            <div style="display:flex;gap:10px;justify-content:center">
                <button type="button" class="btn btn-outline btn-sm" onclick="closeModal()">Cancel</button>
                <button type="button" class="btn btn-sm" style="background:var(--danger);border-color:var(--danger)" id="confirm-delete-btn" onclick="confirmDeleteProject(${id})">
                    <i class="fas fa-trash"></i> Delete Permanently
                </button>
            </div>
        </div>
    `);
    document.getElementById('modal-title').textContent = '⚠️ Confirm Deletion';
}

async function confirmDeleteProject(id) {
    const btn = document.getElementById('confirm-delete-btn');
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';
    try {
        await API.del(`/api/projects/${id}`);
        closeModal();
        toast('Project deleted.', 'info');
        renderProjects();
    } catch (err) {
        toast(err.message, 'error');
    }
}

// ============================================================
// DOCUMENTS
// ============================================================
async function openWorkspace(projectId) {
    try {
        const res = await API.post(`/api/projects/${projectId}/open-workspace`, {});
        toast('Opened workspace folder', 'success');
    } catch (e) {
        toast('Failed to open workspace: ' + e.message, 'error');
    }
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
}

function showProjectDocs(projectId) {
    API.get(`/api/projects/${projectId}`).then(p => {
        const wsLink = p.workspace_path
            ? `<div style="margin-bottom:12px;padding:10px 14px;background:rgba(56,178,255,0.08);border-radius:8px;border:1px solid rgba(56,178,255,0.15);font-size:0.8rem;display:flex;align-items:center;justify-content:space-between">
                <span><i class="fas fa-folder-open" style="color:var(--accent-blue,#38b2ff)"></i> <span style="color:#6c6d80">Workspace:</span> ${escapeHtml(p.workspace_path)}</span>
                <button class="btn btn-sm" onclick="openWorkspace(${projectId});event.stopPropagation()" style="background:rgba(56,178,255,0.15);border:1px solid rgba(56,178,255,0.2)"><i class="fas fa-external-link-alt"></i> Open Folder</button>
              </div>`
            : '';
        openModal(`<div id="docs-container">
            ${wsLink}
            <div class="d-flex align-items-center justify-content-between mb-4">
                <h4 style="font-size:1rem;font-weight:700;margin:0">📄 Documents for <span style="color:#00f2fe">${escapeHtml(p.name)}</span></h4>
                <label class="btn btn-sm" style="cursor:pointer;margin:0">
                    <i class="fas fa-upload"></i> Upload
                    <input type="file" id="doc-upload-input" style="display:none" onchange="uploadDocument(${projectId})">
                </label>
            </div>
            <div id="doc-list" style="min-height:80px">
                <div class="text-muted text-sm" style="text-align:center;padding:30px 0"><i class="fas fa-spinner fa-spin"></i> Loading...</div>
            </div>
        </div>`);
        document.getElementById('modal-title').textContent = '📄 Project Documents';
        renderDocuments(projectId);
    });
}

async function renderDocuments(projectId) {
    const list = document.getElementById('doc-list');
    if (!list) return;
    try {
        const docs = await API.get(`/api/projects/${projectId}/documents`);
        if (docs.length === 0) {
            list.innerHTML = `<div class="text-muted text-sm" style="text-align:center;padding:30px 0"><i class="fas fa-folder-open" style="font-size:1.8rem;opacity:0.3;display:block;margin-bottom:8px"></i> No documents yet</div>`;
            return;
        }
        list.innerHTML = docs.map(d => {
            const ext = d.original_filename.split('.').pop().toLowerCase();
            const icon = ['png','jpg','jpeg','gif','webp'].includes(ext) ? 'fa-image' :
                         ['pdf'].includes(ext) ? 'fa-file-pdf' :
                         ['doc','docx'].includes(ext) ? 'fa-file-word' :
                         ['xls','xlsx'].includes(ext) ? 'fa-file-excel' :
                         ['txt','md','csv'].includes(ext) ? 'fa-file-alt' : 'fa-file';
            const token = getToken();
            return `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:rgba(255,255,255,0.03);border-radius:8px;margin-bottom:6px;border:1px solid rgba(255,255,255,0.04)">
                <div style="display:flex;align-items:center;gap:10px;min-width:0">
                    <i class="fas ${icon}" style="color:#4facfe;font-size:1.1rem;flex-shrink:0"></i>
                    <div style="min-width:0">
                        <div style="font-size:0.85rem;font-weight:600;color:#e4e4f0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(d.original_filename)}</div>
                        <div style="font-size:0.7rem;color:#6c6d80">${formatFileSize(d.file_size)}</div>
                    </div>
                </div>
                <div style="display:flex;gap:4px;flex-shrink:0">
                    <button class="btn btn-sm btn-ghost" onclick="viewDocument(${d.id})" title="View"><i class="fas fa-eye"></i></button>
                    <a href="/api/documents/${d.id}?token=${token}" target="_blank" class="btn btn-sm btn-ghost" title="Download" style="text-decoration:none"><i class="fas fa-download"></i></a>
                    <button class="btn btn-sm btn-ghost" onclick="deleteDocument(${d.id}, ${projectId})" title="Delete" style="color:#f3616f"><i class="fas fa-trash"></i></button>
                </div>
            </div>`;
        }).join('');
    } catch (e) {
        list.innerHTML = `<div class="text-muted text-sm" style="text-align:center;padding:30px 0;color:#f3616f">${e.message}</div>`;
    }
}

async function uploadDocument(projectId) {
    const input = document.getElementById('doc-upload-input');
    if (!input || !input.files || !input.files[0]) return;
    const file = input.files[0];
    if (file.size > 20 * 1024 * 1024) {
        toast('File too large (max 20MB)', 'error');
        return;
    }
    const fd = new FormData();
    fd.append('file', file);
    try {
        await API.upload(`/api/projects/${projectId}/documents`, fd);
        toast('Document uploaded!', 'success');
        renderDocuments(projectId);
    } catch (e) {
        toast(e.message, 'error');
    }
    input.value = '';
}

async function viewDocument(docId) {
    try {
        const data = await API.get(`/api/documents/${docId}/content`);
        const token = getToken();
        const ext = data.filename.split('.').pop().toLowerCase();
        const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
        if (imageExts.includes(ext)) {
            openModal(`
                <div style="text-align:center">
                    <div style="font-size:0.85rem;color:#6c6d80;margin-bottom:12px">${escapeHtml(data.filename)} (${formatFileSize(data.file_size)})</div>
                    <img src="/api/documents/${docId}?token=${token}" style="max-width:100%;max-height:65vh;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,0.3)" alt="${escapeHtml(data.filename)}">
                    <div style="margin-top:12px"><a href="/api/documents/${docId}?token=${token}" target="_blank" class="btn btn-sm"><i class="fas fa-download"></i> Download</a></div>
                </div>
            `);
        } else if (data.type === 'text') {
            openModal(`
                <div>
                    <div style="font-size:0.85rem;color:#6c6d80;margin-bottom:12px">${escapeHtml(data.filename)} (${formatFileSize(data.file_size)})</div>
                    <div style="background:rgba(0,0,0,0.3);border-radius:8px;padding:16px;max-height:55vh;overflow:auto;font-family:'Cascadia Code','Fira Code','Consolas',monospace;font-size:0.78rem;line-height:1.5;white-space:pre-wrap;word-break:break-all;color:#c0c0d0">${escapeHtml(data.content)}</div>
                    <div style="margin-top:12px"><a href="/api/documents/${docId}?token=${token}" target="_blank" class="btn btn-sm"><i class="fas fa-download"></i> Download</a></div>
                </div>
            `);
        } else {
            window.open(`/api/documents/${docId}?token=${token}`, '_blank');
            return;
        }
        document.getElementById('modal-title').textContent = `📄 ${escapeHtml(data.filename)}`;
    } catch (e) {
        toast('Failed to view document: ' + e.message, 'error');
    }
}

async function deleteDocument(docId, projectId) {
    openModal(`
        <div style="text-align:center;padding:16px 0">
            <i class="fas fa-exclamation-triangle" style="font-size:2.5rem;color:var(--warning);margin-bottom:16px;display:block"></i>
            <h4 style="margin-bottom:12px">Delete this document?</h4>
            <div style="display:flex;gap:10px;justify-content:center">
                <button type="button" class="btn btn-outline btn-sm" onclick="closeModal()">Cancel</button>
                <button type="button" class="btn btn-sm" style="background:var(--danger);border-color:var(--danger)" onclick="confirmDeleteDocument(${docId}, ${projectId})"><i class="fas fa-trash"></i> Delete</button>
            </div>
        </div>
    `);
    document.getElementById('modal-title').textContent = '⚠️ Confirm Deletion';
}

async function confirmDeleteDocument(docId, projectId) {
    try {
        await API.del(`/api/documents/${docId}`);
        closeModal();
        toast('Document deleted.', 'info');
        renderDocuments(projectId);
    } catch (e) {
        toast(e.message, 'error');
    }
}

// ============================================================
// WORK LOG
// ============================================================
async function renderWorkLog() {
    const el = document.getElementById('page-content');
    try {
        const [projects, logs] = await Promise.all([API.get('/api/projects'), API.get('/api/logs')]);
        let html = `
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
            <button class="btn" onclick="showAddLog(${JSON.stringify(projects).replace(/"/g, '&quot;')})"><i class="fas fa-plus"></i> Log Work</button>
            <button class="btn btn-sm btn-export" onclick="exportLogsCSV()"><i class="fas fa-download"></i> Export CSV</button>
            <button class="btn btn-sm btn-glass" onclick="showAISummaryModal()">
                <i class="fas fa-file-alt"></i> AI Summary
            </button>
        </div>
        <div class="filter-bar mt-4">
            <div class="form-group">
                <label>Project</label>
                <select class="form-control" id="filterProject" onchange="applyLogFilters()">
                    <option value="">All Projects</option>
                    ${projects.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>From</label>
                <input type="date" class="form-control" id="filterFrom" onchange="applyLogFilters()">
            </div>
            <div class="form-group">
                <label>To</label>
                <input type="date" class="form-control" id="filterTo" onchange="applyLogFilters()">
            </div>
        </div>
        <div id="logsContainer">`;
        if (logs.length === 0) {
            html += `<div class="empty-state"><i class="fas fa-clipboard"></i><h3>No Work Logs</h3><p>Start logging your work to track progress.</p></div>`;
        } else {
            const totalH = logs.reduce((s, l) => s + l.hours_spent, 0);
            html += `<div class="summary-bar"><span>📋 <strong>${logs.length}</strong> entries</span><span>⏱ Total: <strong>${totalH.toFixed(1)}</strong> hours</span></div>`;
            html += `<div class="table-wrapper"><table><thead><tr><th>Date</th><th>Project</th><th>Description</th><th>Hours</th><th>Category</th><th>Logged</th></tr></thead><tbody>`;
            logs.forEach(l => {
                const cat = categorizeWork(l.description);
                html += `<tr><td>${l.work_date}</td><td>${escapeHtml(l.project)}</td><td>${escapeHtml(l.description)}</td><td>${l.hours_spent}</td><td><span class="category-badge">${cat}</span></td><td class="text-muted text-sm">${l.created_at}</td></tr>`;
            });
            html += `</tbody></table></div>`;
        }
        html += `</div>`;
        el.innerHTML = html;
        animatePageIn();
    } catch (e) {
        el.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><h3>Error</h3><p>${e.message}</p></div>`;
    }
}

async function applyLogFilters() {
    const pid = document.getElementById('filterProject').value;
    const from = document.getElementById('filterFrom').value;
    const to = document.getElementById('filterTo').value;
    let url = '/api/logs?';
    const params = [];
    if (pid) params.push(`project_id=${pid}`);
    if (from) params.push(`from_date=${from}`);
    if (to) params.push(`to_date=${to}`);
    try {
        const logs = await API.get(url + params.join('&'));
        const container = document.getElementById('logsContainer');
        if (logs.length === 0) {
            container.innerHTML = `<div class="empty-state" style="padding:30px"><i class="fas fa-search"></i><h3>No Matching Logs</h3></div>`;
        } else {
            const totalH = logs.reduce((s, l) => s + l.hours_spent, 0);
            container.innerHTML = `<div class="summary-bar"><span>📋 <strong>${logs.length}</strong> entries</span><span>⏱ Total: <strong>${totalH.toFixed(1)}</strong> hours</span></div>` +
                `<div class="table-wrapper"><table><thead><tr><th>Date</th><th>Project</th><th>Description</th><th>Hours</th><th>Category</th><th>Logged</th></tr></thead><tbody>` +
                logs.map(l => `<tr><td>${l.work_date}</td><td>${escapeHtml(l.project)}</td><td>${escapeHtml(l.description)}</td><td>${l.hours_spent}</td><td><span class="category-badge">${categorizeWork(l.description)}</span></td><td class="text-muted text-sm">${l.created_at}</td></tr>`).join('') +
                `</tbody></table></div>`;
        }
    } catch (e) {
        toast(e.message, 'error');
    }
}

function openModalForLog(projectsArray) {
    showAddLog(projectsArray);
}

function showAddLog(projects) {
    const today = new Date().toISOString().split('T')[0];
    const projectOptions = projects && projects.length > 0
        ? projects.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('')
        : `<option value="" disabled selected>No projects yet — create one first</option>`;
    openModal(`
        <form id="logForm" onsubmit="submitLog(event)">
            <div class="form-group">
                <label>Project *</label>
                <select class="form-control" name="project_id" required>
                    ${projectOptions}
                </select>
                ${!projects || projects.length === 0 ? '<div class="text-muted text-sm" style="margin-top:6px"><a href="#" onclick="closeModal();setTimeout(showAddProject,200)" style="color:var(--accent-teal)">Create a project first</a></div>' : ''}
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Date</label>
                    <input type="date" class="form-control" name="work_date" value="${today}">
                </div>
                <div class="form-group">
                    <label>Hours Spent</label>
                    <input type="number" class="form-control" name="hours_spent" value="1" min="0" max="24" step="0.5">
                </div>
            </div>
            <div class="form-group">
                <label>What did you do? *</label>
                <textarea class="form-control" name="description" id="log-description" placeholder="Describe your work..." rows="4" required oninput="suggestEstimate(this)"></textarea>
                <div id="ai-estimate-suggestion" style="margin-top:6px"></div>
            </div>
            <div class="modal-box-footer" style="padding:0;padding-top:8px;border:none">
                <button type="button" class="btn btn-outline btn-sm" onclick="closeModal()">Cancel</button>
                <button type="submit" class="btn btn-sm"><i class="fas fa-check"></i> Log Entry</button>
            </div>
        </form>
    `);
    document.getElementById('modal-title').textContent = '📝 Log Work Entry';
}

async function showAISummaryModal() {
    try {
        const summary = await API.post('/api/ai/summarize', {});
        openModal(`
            <div style="padding:4px 0">
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
                    <span class="ai-badge green" style="font-size:0.85rem">⚡ ${summary.productivity_score || 0}% Productivity</span>
                    <span class="ai-badge purple" style="font-size:0.85rem">🎯 ${summary.primary_focus || 'N/A'}</span>
                </div>
                <p style="color:var(--text-secondary);line-height:1.7;font-size:0.88rem">${summary.summary || 'No work logged yet.'}</p>
                <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:16px">
                    <span class="category-badge">📊 ${summary.total_hours || 0}h total</span>
                    <span class="category-badge">📋 ${summary.log_count || 0} entries</span>
                    <span class="category-badge">📅 ${summary.daily_average || 0}h/day avg</span>
                </div>
                ${summary.topics && summary.topics.length > 0 ? `
                <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border-glass)">
                    <div class="text-muted text-sm" style="margin-bottom:6px">Topics</div>
                    <div style="display:flex;flex-wrap:wrap;gap:4px">
                        ${summary.topics.map(t => `<span class="category-badge">#${escapeHtml(t)}</span>`).join('')}
                    </div>
                </div>` : ''}
            </div>
        `);
        document.getElementById('modal-title').textContent = '🧠 AI Work Summary';
    } catch (e) {
        toast(e.message, 'error');
    }
}

async function submitLog(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = Object.fromEntries(fd.entries());
    data.hours_spent = parseFloat(data.hours_spent) || 0;
    data.project_id = parseInt(data.project_id);
    try {
        await API.post('/api/logs', data);
        closeModal();
        toast('Work logged successfully!', 'success');
        renderWorkLog();
    } catch (err) {
        toast(err.message, 'error');
    }
}

// ============================================================
// ANALYTICS
// ============================================================
let chartInstances = {};

async function renderAnalytics() {
    const el = document.getElementById('page-content');
    try {
        const data = await API.get('/api/analytics');
        let html = `<div class="grid-2">`;

        // Bar chart
        html += `<div class="chart-container"><h3 style="margin-bottom:16px;font-size:1rem">⏱ Hours per Project</h3><canvas id="chartProjects"></canvas></div>`;

        // Line chart
        html += `<div class="chart-container"><h3 style="margin-bottom:16px;font-size:1rem">📅 Last 30 Days</h3><canvas id="chartDaily"></canvas></div>`;

        // Status breakdown
        html += `</div><div class="card mt-4">
            <div class="card-header">
                <span class="card-title">📊 Status Breakdown</span>
                <div style="display:flex;gap:6px">
                    <button class="btn btn-sm btn-glass" onclick="exportLogsCSV()"><i class="fas fa-download"></i> Export Logs</button>
                    <button class="btn btn-sm btn-glass" onclick="exportProjectsCSV()"><i class="fas fa-download"></i> Export Projects</button>
                </div>
            </div>
            <div class="card-body"><div class="grid-3">`;
        const counts = data.status_counts || {};
        const statuses = ['Active', 'On Hold', 'Completed', 'Archived'];
        statuses.forEach(s => {
            const c = STATUS_COLORS[s] || '#78909c';
            const val = counts[s] || 0;
            html += `<div style="padding:16px;background:rgba(255,255,255,0.03);border-radius:12px;text-align:center">
                <div style="font-size:1.8rem;font-weight:800;color:${c}">${val}</div>
                <div class="text-muted text-sm">${s}</div>
            </div>`;
        });
        html += `</div></div></div>`;

        // Log table
        const logs = await API.get('/api/logs');
        if (logs.length > 0) {
            const totalH = logs.reduce((s, l) => s + l.hours_spent, 0);
            html += `<div class="card mt-4"><div class="card-header"><span class="card-title">📋 All Logs (${logs.length} entries, ${totalH.toFixed(1)} hours)</span></div><div class="card-body">
                <div class="table-wrapper"><table><thead><tr><th>Date</th><th>Project</th><th>Description</th><th>Hours</th></tr></thead><tbody>`;
            logs.slice(0, 50).forEach(l => {
                html += `<tr><td>${l.work_date}</td><td>${escapeHtml(l.project)}</td><td>${escapeHtml(l.description)}</td><td>${l.hours_spent}</td></tr>`;
            });
            html += `</tbody></table></div></div></div>`;
        }

        html += `<div class="mt-4 text-muted text-sm" style="text-align:center">Showing last 50 entries</div>`;
        el.innerHTML = html;

        // Render charts
        renderChartProjects(data.hours_by_project);
        renderChartDaily(data.daily_hours);
        animatePageIn();

        // Fade in chart containers
        if (typeof gsap !== 'undefined') {
            document.querySelectorAll('.chart-container').forEach((c, i) => {
                gsap.fromTo(c, { opacity: 0, scale: 0.95 }, { opacity: 1, scale: 1, duration: 0.5, delay: 0.1 * i, ease: 'power3.out' });
            });
        }
    } catch (e) {
        el.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><h3>Error</h3><p>${e.message}</p></div>`;
    }
}

function getChartTheme() {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    return {
        grid: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.05)',
        tick: isLight ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.5)',
    };
}

function renderChartProjects(data) {
    const canvas = document.getElementById('chartProjects');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (chartInstances.projects) chartInstances.projects.destroy();
    if (!data || data.length === 0) {
        canvas.parentElement.innerHTML += '<div class="text-muted text-sm" style="text-align:center;padding:20px">No data yet</div>';
        return;
    }
    const theme = getChartTheme();
    chartInstances.projects = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(d => d.name),
            datasets: [{
                label: 'Hours',
                data: data.map(d => d.hours),
                backgroundColor: data.map((_, i) => {
                    const colors = ['#00d4aa', '#7c4dff', '#ffa726', '#ff4757', '#54a0ff', '#5f27cd'];
                    return colors[i % colors.length] + '66';
                }),
                borderColor: data.map((_, i) => {
                    const colors = ['#00d4aa', '#7c4dff', '#ffa726', '#ff4757', '#54a0ff', '#5f27cd'];
                    return colors[i % colors.length];
                }),
                borderWidth: 2,
                borderRadius: 6,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { color: theme.grid }, ticks: { color: theme.tick } },
                x: { grid: { display: false }, ticks: { color: theme.tick } }
            }
        }
    });
}

function renderChartDaily(data) {
    const canvas = document.getElementById('chartDaily');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (chartInstances.daily) chartInstances.daily.destroy();
    if (!data || data.length === 0) {
        canvas.parentElement.innerHTML += '<div class="text-muted text-sm" style="text-align:center;padding:20px">No data in last 30 days</div>';
        return;
    }
        const theme = getChartTheme();
        chartInstances.daily = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.map(d => d.work_date),
                datasets: [{
                    label: 'Hours',
                    data: data.map(d => d.hours_spent),
                    borderColor: '#7c4dff',
                    backgroundColor: 'rgba(124,77,255,0.1)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 3,
                    pointBackgroundColor: '#7c4dff',
                    borderWidth: 2,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, grid: { color: theme.grid }, ticks: { color: theme.tick } },
                    x: { grid: { display: false }, ticks: { color: theme.tick, maxTicksLimit: 10 } }
                }
            }
        });
}

// ============================================================
// AI INSIGHTS PAGE
// ============================================================
async function renderAIInsights() {
    const el = document.getElementById('page-content');
    try {
        const [summary, health, categorizations, insights] = await Promise.all([
            API.post('/api/ai/summarize', {}),
            API.get('/api/ai/health'),
            API.get('/api/ai/categorize'),
            API.get('/api/ai/insights'),
        ]);

        let html = `
        <div class="metrics-grid" style="grid-template-columns:repeat(3,1fr)">
            <div class="metric-card">
                <div class="metric-icon">🧠</div>
                <div class="metric-value">${summary.productivity_score || 0}%</div>
                <div class="metric-label">Productivity Score</div>
            </div>
            <div class="metric-card">
                <div class="metric-icon">🎯</div>
                <div class="metric-value">${summary.primary_focus || 'N/A'}</div>
                <div class="metric-label">Primary Focus</div>
            </div>
            <div class="metric-card">
                <div class="metric-icon">❤️</div>
                <div class="metric-value">${health.overall_health || 0}%</div>
                <div class="metric-label">Overall Project Health</div>
            </div>
        </div>`;

        // AI Summary card
        html += `
        <div class="card mt-4">
            <div class="card-header"><span class="card-title">📝 AI Work Summary</span></div>
            <div class="card-body">
                <p style="color:var(--text-secondary);line-height:1.7;font-size:0.9rem">${summary.summary || 'No work logged yet.'}</p>
                <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:12px">
                    <span class="ai-badge green"><i class="fas fa-clock"></i> ${summary.total_hours || 0}h total</span>
                    <span class="ai-badge purple"><i class="fas fa-list"></i> ${summary.log_count || 0} entries</span>
                    <span class="ai-badge"><i class="fas fa-calendar-day"></i> ${summary.daily_average || 0}h/day avg</span>
                </div>
                ${summary.categories && Object.keys(summary.categories).length > 0 ? `
                <div style="margin-top:14px">
                    <div class="text-muted text-sm" style="margin-bottom:6px">Category Breakdown</div>
                    <div style="display:flex;flex-wrap:wrap;gap:6px">
                        ${Object.entries(summary.categories).map(([cat, count]) =>
                            `<span class="category-badge">${cat} (${count})</span>`
                        ).join('')}
                    </div>
                </div>` : ''}
            </div>
        </div>`;

        // Project Health section
        html += `
        <div class="card mt-4">
            <div class="card-header">
                <span class="card-title">🏥 Project Health Dashboard</span>
                <div style="display:flex;gap:6px">
                    <button class="btn btn-sm btn-glass" onclick="exportProjectsCSV()"><i class="fas fa-download"></i> Export</button>
                </div>
            </div>
            <div class="card-body">`;

        if (health.projects && health.projects.length > 0) {
            html += `<div class="table-wrapper"><table><thead><tr>
                <th>Project</th><th>Health</th><th>Status</th><th>Trend</th><th>Hours</th><th>Insight</th>
            </tr></thead><tbody>`;
            health.projects.forEach(p => {
                const hClass = p.health_score >= 70 ? 'healthy' : p.health_score >= 40 ? 'needs-attention' : 'at-risk';
                const trendIcon = p.trend === 'up' ? '📈' : p.trend === 'down' ? '📉' : '➡️';
                html += `<tr>
                    <td style="font-weight:600">${escapeHtml(p.project_name)}</td>
                    <td>
                        <div class="health-bar">
                            <div class="health-bar-track">
                                <div class="health-bar-fill ${hClass}" style="width:${p.health_score}%"></div>
                            </div>
                            <span class="health-label ${hClass}">${p.health_score}%</span>
                        </div>
                    </td>
                    <td><span class="ai-badge ${hClass === 'healthy' ? 'green' : hClass === 'needs-attention' ? 'amber' : ''}">${p.status || 'N/A'}</span></td>
                    <td>${trendIcon}</td>
                    <td>${p.total_hours || 0}h</td>
                    <td style="font-size:0.8rem;color:var(--text-muted);max-width:200px;white-space:normal">${p.insight || ''}</td>
                </tr>`;
            });
            html += `</tbody></table></div>`;
            // Suggestions
            html += `<div style="margin-top:12px;display:flex;flex-wrap:wrap;gap:8px">`;
            health.projects.forEach(p => {
                if (p.suggestion) {
                    html += `<div style="padding:8px 12px;background:rgba(255,255,255,0.03);border-radius:8px;font-size:0.8rem;color:var(--text-secondary);border-left:3px solid ${p.health_score >= 70 ? 'var(--success)' : p.health_score >= 40 ? 'var(--warning)' : 'var(--danger)'}">
                        <strong style="color:var(--text-primary)">${escapeHtml(p.project_name)}:</strong> ${p.suggestion}
                    </div>`;
                }
            });
            html += `</div>`;
        } else {
            html += `<div class="text-muted text-sm" style="text-align:center;padding:20px">No projects to evaluate</div>`;
        }
        html += `</div></div>`;

        // AI Insights
        html += `
        <div class="card mt-4">
            <div class="card-header"><span class="card-title">💡 Quick Insights</span></div>
            <div class="card-body">`;
        if (insights.insights && insights.insights.length > 0) {
            html += `<div style="display:flex;flex-direction:column;gap:8px">`;
            insights.insights.forEach(i => {
                html += `<div style="display:flex;align-items:flex-start;gap:10px;padding:10px 14px;background:rgba(255,255,255,0.02);border-radius:8px">
                    <i class="fas fa-lightbulb" style="color:var(--warning);margin-top:2px"></i>
                    <span style="color:var(--text-secondary);font-size:0.88rem">${i}</span>
                </div>`;
            });
            html += `</div>`;
        } else {
            html += `<div class="text-muted text-sm">Start logging work to see AI insights!</div>`;
        }

        // AI Query section inline
        html += `
            <div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border-glass)">
                <label style="font-size:0.85rem;font-weight:600;color:var(--text-secondary);display:block;margin-bottom:8px">
                    <i class="fas fa-robot" style="color:var(--accent-teal)"></i> Ask AI about your projects
                </label>
                <div style="display:flex;gap:8px">
                    <input type="text" id="ai-page-query" class="form-control" placeholder='Try "my hours this week" or "project health"' style="flex:1" onkeydown="if(event.key==='Enter'){event.preventDefault();askAIPageQuery();}">
                    <button class="btn btn-sm" onclick="askAIPageQuery()"><i class="fas fa-robot"></i> Ask</button>
                </div>
                <div id="ai-page-response" style="margin-top:10px"></div>
            </div>`;

        html += `</div></div>`;
        el.innerHTML = html;
        animatePageIn();
    } catch (e) {
        el.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><h3>Error Loading AI Insights</h3><p>${e.message}</p><button class="btn btn-sm" onclick="refreshData()">Retry</button></div>`;
    }
}

async function askAIPageQuery() {
    const input = document.getElementById('ai-page-query');
    const query = input.value.trim();
    if (!query) return;
    const response = document.getElementById('ai-page-response');
    response.innerHTML = `<div class="ai-thinking"><span>Analyzing</span><div class="dot-pulse"><span></span><span></span><span></span></div></div>`;
    try {
        const result = await API.post('/api/ai/query', { query });
        response.innerHTML = `<div style="background:rgba(0,242,254,0.05);border-radius:10px;padding:14px;border:1px solid rgba(0,242,254,0.1)">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
                <i class="fas fa-robot" style="color:#00f2fe"></i>
                <span style="font-weight:600;font-size:0.85rem">AI</span>
            </div>
            <div style="color:var(--text-secondary);font-size:0.88rem">${result.answer}</div>
        </div>`;
    } catch (e) {
        response.innerHTML = `<div style="color:var(--danger);font-size:0.85rem">${e.message}</div>`;
    }
}


// ============================================================
// AI-GENERATED ART — Neural Dreamscape Background
// ============================================================
(function initBackground() {
    const canvas = document.getElementById('bg-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let W, H, time = 0, nodes = [], filaments = [], crystals = [];
    let mouseX = -1000, mouseY = -1000;
    document.addEventListener('mousemove', (e) => { mouseX = e.clientX; mouseY = e.clientY; });
    const NODE_COUNT = 30;
    const FILAMENT_COUNT = 8;
    const CRYSTAL_COUNT = 12;
    const PALETTE = [
        [0, 212, 170], [124, 77, 255], [84, 160, 255], [255, 107, 157], [255, 167, 38],
    ];

    function resize() {
        W = canvas.width = window.innerWidth;
        H = canvas.height = window.innerHeight;
    }

    // ── Neural Network Nodes ──
    class Node {
        constructor() { this.reset(); }
        reset() {
            this.x = Math.random() * W;
            this.y = Math.random() * H;
            this.vx = (Math.random() - 0.5) * 0.2;
            this.vy = (Math.random() - 0.5) * 0.2;
            this.size = Math.random() * 6 + 4;
            this.pulse = Math.random() * Math.PI * 2;
            this.pulseSpeed = Math.random() * 0.02 + 0.01;
            this.c = PALETTE[Math.floor(Math.random() * PALETTE.length)];
            this.connections = [];
        }
        update() {
            this.x += this.vx; this.y += this.vy;
            this.pulse += this.pulseSpeed;

            // Mouse interaction — attract when held near, subtle repel on fast pass
            const dx = mouseX - this.x;
            const dy = mouseY - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 300) {
                const force = (1 - dist / 300) * 0.04;
                this.vx += dx * force;
                this.vy += dy * force;
            } else if (dist < 80) {
                const force = (1 - dist / 80) * -0.08;
                this.vx += dx * force;
                this.vy += dy * force;
            }

            if (this.x < -50 || this.x > W + 50) this.vx *= -1;
            if (this.y < -50 || this.y > H + 50) this.vy *= -1;
            this.x = Math.max(-50, Math.min(W + 50, this.x));
            this.y = Math.max(-50, Math.min(H + 50, this.y));
        }
        draw() {
            const glow = Math.sin(this.pulse) * 0.4 + 0.6;
            const r = this.size * (0.8 + Math.sin(this.pulse) * 0.2);
            const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, r * 3);
            grad.addColorStop(0, `rgba(${this.c[0]},${this.c[1]},${this.c[2]},${glow * 0.9})`);
            grad.addColorStop(0.3, `rgba(${this.c[0]},${this.c[1]},${this.c[2]},${glow * 0.3})`);
            grad.addColorStop(1, `rgba(${this.c[0]},${this.c[1]},${this.c[2]},0)`);
            ctx.beginPath();
            ctx.arc(this.x, this.y, r * 3, 0, Math.PI * 2);
            ctx.fillStyle = grad;
            ctx.fill();
            ctx.beginPath();
            ctx.arc(this.x, this.y, r * 0.6, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${this.c[0]},${this.c[1]},${this.c[2]},${glow})`;
            ctx.fill();
            ctx.beginPath();
            ctx.arc(this.x, this.y, r * 0.3, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255,255,255,${glow * 0.6})`;
            ctx.fill();
        }
    }

    // ── Glowing Filament Tendrils (organic AI-art feel) ──
    class Filament {
        constructor() {
            this.points = [];
            const startX = Math.random() * W;
            const startY = Math.random() * H;
            for (let i = 0; i < 50; i++) {
                this.points.push({ x: startX, y: startY, vx: 0, vy: 0 });
            }
            this.c = PALETTE[Math.floor(Math.random() * PALETTE.length)];
            this.alpha = Math.random() * 0.15 + 0.05;
        }
        update() {
            const head = this.points[0];
            const angle = noise(head.x * 0.004, head.y * 0.004, time * 0.0005) * Math.PI * 3;
            head.vx += Math.cos(angle) * 0.15;
            head.vy += Math.sin(angle) * 0.15;
            head.vx *= 0.92;
            head.vy *= 0.92;
            head.x += head.vx;
            head.y += head.vy;
            if (head.x < -100) head.x = W + 100;
            if (head.x > W + 100) head.x = -100;
            if (head.y < -100) head.y = H + 100;
            if (head.y > H + 100) head.y = -100;
            for (let i = 1; i < this.points.length; i++) {
                const p = this.points[i];
                const prev = this.points[i - 1];
                p.vx += (prev.x - p.x) * 0.08;
                p.vy += (prev.y - p.y) * 0.08;
                p.vx *= 0.85;
                p.vy *= 0.85;
                p.x += p.vx;
                p.y += p.vy;
            }
        }
        draw() {
            ctx.beginPath();
            ctx.moveTo(this.points[0].x, this.points[0].y);
            for (let i = 1; i < this.points.length; i++) {
                const p = this.points[i];
                const prev = this.points[i - 1];
                const cpx = (prev.x + p.x) / 2;
                const cpy = (prev.y + p.y) / 2;
                ctx.quadraticCurveTo(prev.x, prev.y, cpx, cpy);
            }
            ctx.strokeStyle = `rgba(${this.c[0]},${this.c[1]},${this.c[2]},${this.alpha})`;
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }
    }

    // ── Floating Crystalline Shapes ──
    class Crystal {
        constructor() { this.reset(); }
        reset() {
            this.x = Math.random() * W;
            this.y = Math.random() * H;
            this.rotation = Math.random() * Math.PI * 2;
            this.rotSpeed = (Math.random() - 0.5) * 0.005;
            this.size = Math.random() * 60 + 30;
            this.sides = Math.floor(Math.random() * 3) + 3;
            this.c = PALETTE[Math.floor(Math.random() * PALETTE.length)];
            this.alpha = Math.random() * 0.08 + 0.03;
            this.dx = (Math.random() - 0.5) * 0.15;
            this.dy = (Math.random() - 0.5) * 0.15;
        }
        update() {
            this.x += this.dx; this.y += this.dy;
            this.rotation += this.rotSpeed;
            if (this.x < -200) this.x = W + 200;
            if (this.x > W + 200) this.x = -200;
            if (this.y < -200) this.y = H + 200;
            if (this.y > H + 200) this.y = -200;
        }
        draw() {
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(this.rotation);
            ctx.globalAlpha = this.alpha;
            ctx.beginPath();
            for (let i = 0; i < this.sides; i++) {
                const a = (i / this.sides) * Math.PI * 2 - Math.PI / 2;
                const r = this.size * (0.8 + Math.sin(time * 0.01 + i) * 0.2);
                const x = Math.cos(a) * r;
                const y = Math.sin(a) * r;
                if (i === 0) ctx.moveTo(x, y);
                else {
                    const prevA = ((i - 1) / this.sides) * Math.PI * 2 - Math.PI / 2;
                    const prevR = this.size * (0.8 + Math.sin(time * 0.01 + i - 1) * 0.2);
                    const cpx = Math.cos(prevA + a / 2) * r * 1.2;
                    const cpy = Math.sin(prevA + a / 2) * r * 1.2;
                    ctx.quadraticCurveTo(cpx, cpy, x, y);
                }
            }
            ctx.closePath();
            ctx.strokeStyle = `rgba(${this.c[0]},${this.c[1]},${this.c[2]},0.6)`;
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.fillStyle = `rgba(${this.c[0]},${this.c[1]},${this.c[2]},0.15)`;
            ctx.fill();
            ctx.restore();
        }
    }

    // ── Perlin Noise (for organic movement) ──
    function createNoise() {
        const perm = [];
        for (let i = 0; i < 512; i++) perm.push(Math.floor(Math.random() * 256));
        return function(x, y, z) {
            const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
            const xf = x - Math.floor(x), yf = y - Math.floor(y), zf = z - Math.floor(z);
            const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
            const A = perm[X] + Y, AA = perm[A] + Z, AB = perm[A + 1] + Z;
            const B = perm[X + 1] + Y, BA = perm[B] + Z, BB = perm[B + 1] + Z;
            const grad = (h, x, y, z) => { const hh = h & 3; return (hh & 1 ? x : -x) + (hh & 2 ? y : -y) + (hh & 8 ? z : -z); };
            return (
                (1 - w) * ((1 - v) * ((1 - u) * grad(perm[AA], xf, yf, zf) + u * grad(perm[BA], xf - 1, yf, zf)) + v * ((1 - u) * grad(perm[AB], xf, yf - 1, zf) + u * grad(perm[BB], xf - 1, yf - 1, zf))) +
                w * ((1 - v) * ((1 - u) * grad(perm[AA + 1], xf, yf, zf - 1) + u * grad(perm[BA + 1], xf - 1, yf, zf - 1)) + v * ((1 - u) * grad(perm[AB + 1], xf, yf - 1, zf - 1) + u * grad(perm[BB + 1], xf - 1, yf - 1, zf - 1)))
            );
        };
    }
    const noise = createNoise();

    // ── Deep-style organic wash layer ──
    function drawOrganicWash() {
        const grad = ctx.createRadialGradient(W * 0.3, H * 0.4, 0, W * 0.5, H * 0.5, Math.max(W, H) * 0.7);
        grad.addColorStop(0, `rgba(10,5,30,0.5)`);
        const t = time * 0.0001;
        grad.addColorStop(0.3, `rgba(${20 + Math.sin(t) * 10},${5 + Math.cos(t * 0.7) * 5},${40 + Math.sin(t * 1.3) * 15},0.4)`);
        grad.addColorStop(0.6, `rgba(${5 + Math.cos(t * 1.1) * 5},${10 + Math.sin(t * 0.9) * 8},${30 + Math.cos(t * 0.8) * 10},0.3)`);
        grad.addColorStop(1, 'rgba(5,5,16,0.8)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);

        // Subtle grid overlay (like AI latent space)
        ctx.strokeStyle = 'rgba(255,255,255,0.015)';
        ctx.lineWidth = 0.5;
        const gridSize = 60 + Math.sin(time * 0.002) * 5;
        for (let x = 0; x < W; x += gridSize) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
        }
        for (let y = 0; y < H; y += gridSize) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
        }
    }

    function anim() {
        // Skip drawing when app is hidden (auth page visible)
        if (document.getElementById('auth-page').classList.contains('visible')) {
            requestAnimationFrame(anim);
            return;
        }
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = '#050510';
        ctx.fillRect(0, 0, W, H);

        drawOrganicWash();
        filaments.forEach(f => { f.update(); f.draw(); });
        crystals.forEach(c => c.draw());
        nodes.forEach(n => { n.update(); n.draw(); });

        // Draw neural connections between nearby nodes
        ctx.lineWidth = 0.5;
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const dx = nodes[i].x - nodes[j].x;
                const dy = nodes[i].y - nodes[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 250) {
                    const alpha = (1 - dist / 250) * 0.2;
                    const c = nodes[i].c;
                    ctx.beginPath();
                    ctx.moveTo(nodes[i].x, nodes[i].y);
                    const cpx = (nodes[i].x + nodes[j].x) / 2 + Math.sin(time * 0.005 + i + j) * 20;
                    const cpy = (nodes[i].y + nodes[j].y) / 2 + Math.cos(time * 0.005 + i + j) * 20;
                    ctx.quadraticCurveTo(cpx, cpy, nodes[j].x, nodes[j].y);
                    ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
                    ctx.stroke();
                }
            }
        }

        time++;
        requestAnimationFrame(anim);
    }

    resize();
    window.addEventListener('resize', resize);
    for (let i = 0; i < NODE_COUNT; i++) nodes.push(new Node());
    for (let i = 0; i < FILAMENT_COUNT; i++) filaments.push(new Filament());
    for (let i = 0; i < CRYSTAL_COUNT; i++) crystals.push(new Crystal());
    anim();
})();

// ---- Micro-interactions (GSAP) ----
function initMicroInteractions() {
    if (typeof gsap === 'undefined') return;
    document.addEventListener('mouseover', (e) => {
        const btn = e.target.closest('.btn:not(.btn-ghost)');
        if (btn) {
            gsap.to(btn, { scale: 1.04, borderColor: '#00d4aa', boxShadow: '0 0 20px rgba(0,212,170,0.25)', duration: 0.25, ease: 'power2.out' });
        }
        const card = e.target.closest('.card, .project-card, .metric-card');
        if (card) {
            gsap.to(card, { y: -4, borderColor: 'rgba(124,77,255,0.4)', boxShadow: '0 12px 40px rgba(124,77,255,0.15)', duration: 0.3, ease: 'power2.out' });
        }
    });
    document.addEventListener('mouseout', (e) => {
        const btn = e.target.closest('.btn:not(.btn-ghost)');
        if (btn) {
            gsap.to(btn, { scale: 1, borderColor: 'rgba(255,255,255,0.1)', boxShadow: 'none', duration: 0.3, ease: 'power2.out' });
        }
        const card = e.target.closest('.card, .project-card, .metric-card');
        if (card) {
            gsap.to(card, { y: 0, borderColor: 'rgba(255,255,255,0.08)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)', duration: 0.35, ease: 'power2.out' });
        }
    });
    // Form fields focus glow
    document.addEventListener('focusin', (e) => {
        const input = e.target.closest('.form-control');
        if (input) {
            gsap.to(input, { borderColor: '#00d4aa', boxShadow: '0 0 12px rgba(0,212,170,0.2)', duration: 0.2, ease: 'power2.out' });
        }
    });
    document.addEventListener('focusout', (e) => {
        const input = e.target.closest('.form-control');
        if (input) {
            gsap.to(input, { borderColor: 'rgba(255,255,255,0.1)', boxShadow: 'none', duration: 0.25, ease: 'power2.out' });
        }
    });
}

// ---- Password Strength Meter ----
function checkPasswordStrength(password) {
    const container = document.getElementById('password-strength');
    const bars = [1,2,3,4].map(i => document.getElementById(`pstr-${i}`));
    const label = document.getElementById('pstr-label');

    if (!password) {
        container.style.display = 'none';
        return;
    }
    container.style.display = 'block';

    let score = 0;
    if (password.length >= 4) score++;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
    if (/\d/.test(password) && /[^a-zA-Z0-9]/.test(password)) score++;

    const levels = ['', 'Weak', 'Medium', 'Strong', 'Very Strong'];
    const classes = ['', 'weak', 'medium', 'strong', 'very-strong'];
    const colors = ['', '#f3616f', '#ffb347', '#00d4aa', '#00F2FE'];

    bars.forEach((bar, i) => {
        bar.className = 'pstr-bar';
        if (i < score) bar.classList.add(classes[score] || 'weak');
    });
    label.textContent = levels[score] || '';
    label.style.color = colors[score] || 'var(--text-muted)';
}

// ---- AI Typing Animation for Auth Page ----
const AI_WELCOMES = [
    { title: "Hey there! 👋", sub: "Your projects are waiting for you." },
    { title: "Ready to build? 🚀", sub: "Track your progress with AI-powered insights." },
    { title: "Welcome back! ⚡", sub: "Your neural dashboard is synced and ready." },
    { title: "Let's create something amazing ✨", sub: "AI is ready to help you track smarter." },
    { title: "Good to see you! 🌟", sub: "Your productivity hub is always on." },
];

function initAuthTyping() {
    const titleEl = document.getElementById('ai-welcome-text');
    const subEl = document.getElementById('ai-welcome-subtext');
    if (!titleEl) return;

    const pick = AI_WELCOMES[Math.floor(Math.random() * AI_WELCOMES.length)];

    if (typeof gsap !== 'undefined') {
        // Type out the title
        let i = 0;
        titleEl.textContent = '';
        const typeInterval = setInterval(() => {
            titleEl.textContent += pick.title[i];
            i++;
            if (i >= pick.title.length) {
                clearInterval(typeInterval);
                // Then type out the subtitle
                let j = 0;
                const subInterval = setInterval(() => {
                    subEl.textContent += pick.sub[j];
                    j++;
                    if (j >= pick.sub.length) clearInterval(subInterval);
                }, 25);
            }
        }, 50);
    } else {
        titleEl.textContent = pick.title;
        subEl.textContent = pick.sub;
    }
}

// ---- Auth Neural Background ----
let authParticles = [];
let authAnimId = null;
function initAuthNeuralBg() {
    const canvas = document.getElementById('auth-neural-bg');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let W, H;

    function resize() {
        W = canvas.width = window.innerWidth;
        H = canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    class Particle {
        constructor() { this.reset(); }
        reset() {
            this.x = Math.random() * W;
            this.y = Math.random() * H;
            this.vx = (Math.random() - 0.5) * 0.3;
            this.vy = (Math.random() - 0.5) * 0.3;
            this.r = Math.random() * 2 + 1;
            this.alpha = Math.random() * 0.3 + 0.1;
            this.pulse = Math.random() * Math.PI * 2;
        }
        update() {
            this.x += this.vx; this.y += this.vy;
            this.pulse += 0.02;
            if (this.x < -20) this.x = W + 20;
            if (this.x > W + 20) this.x = -20;
            if (this.y < -20) this.y = H + 20;
            if (this.y > H + 20) this.y = -20;
        }
        draw() {
            const a = this.alpha * (0.5 + Math.sin(this.pulse) * 0.5);
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(0, 242, 254, ${a})`;
            ctx.fill();
        }
    }

    const count = Math.min(80, Math.floor((W * H) / 15000));
    for (let i = 0; i < count; i++) authParticles.push(new Particle());

    function anim() {
        if (!document.getElementById('auth-page').classList.contains('visible')) {
            authAnimId = requestAnimationFrame(anim);
            return;
        }
        ctx.clearRect(0, 0, W, H);
        authParticles.forEach(p => { p.update(); p.draw(); });

        // Draw connections
        for (let i = 0; i < authParticles.length; i++) {
            for (let j = i + 1; j < authParticles.length; j++) {
                const dx = authParticles[i].x - authParticles[j].x;
                const dy = authParticles[i].y - authParticles[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 150) {
                    const alpha = (1 - dist / 150) * 0.1;
                    ctx.beginPath();
                    ctx.moveTo(authParticles[i].x, authParticles[i].y);
                    ctx.lineTo(authParticles[j].x, authParticles[j].y);
                    ctx.strokeStyle = `rgba(0, 242, 254, ${alpha})`;
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                }
            }
        }
        authAnimId = requestAnimationFrame(anim);
    }
    anim();
}

// ---- Auth Functions ----
function showAuthPage() {
    document.getElementById('auth-page').classList.add('visible');
    document.getElementById('app').style.display = 'none';
    initAuthTyping();
    if (typeof gsap !== 'undefined') {
        gsap.fromTo('.auth-container', { opacity: 0, y: 20, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: 'power3.out' });
    }
}
function hideAuthPage() {
    if (typeof gsap !== 'undefined') {
        gsap.to('.auth-container', { opacity: 0, y: -10, scale: 0.97, duration: 0.25, ease: 'power2.in', onComplete: () => {
            document.getElementById('auth-page').classList.remove('visible');
            document.getElementById('app').style.display = 'flex';
            gsap.set('.auth-container', { opacity: 1, y: 0, scale: 1 });
        }});
    } else {
        document.getElementById('auth-page').classList.remove('visible');
        document.getElementById('app').style.display = 'flex';
    }
}
function showLogin() {
    document.getElementById('register-form').classList.remove('visible');
    document.getElementById('login-form').classList.add('visible');
    // Reset password strength
    const pstr = document.getElementById('password-strength');
    if (pstr) pstr.style.display = 'none';
    if (typeof gsap !== 'undefined') {
        gsap.fromTo('#login-form .input-field', { opacity: 0, x: -15 }, { opacity: 1, x: 0, duration: 0.4, stagger: 0.1, ease: 'power2.out' });
    }
}
function showRegister() {
    document.getElementById('login-form').classList.remove('visible');
    document.getElementById('register-form').classList.add('visible');
    // Reset password strength
    const pstr = document.getElementById('password-strength');
    if (pstr) pstr.style.display = 'none';
    if (typeof gsap !== 'undefined') {
        gsap.fromTo('#register-form .input-field', { opacity: 0, x: -15 }, { opacity: 1, x: 0, duration: 0.4, stagger: 0.1, ease: 'power2.out' });
    }
}
async function handleLogin(e) {
    e.preventDefault();
    const btn = document.getElementById('login-btn');
    const txt = btn.querySelector('.btn-text');
    const spn = btn.querySelector('.btn-spinner');
    btn.disabled = true; txt.textContent = 'Signing in...'; spn.style.display = 'inline';
    try {
        const data = await loginUser(document.getElementById('login-username').value, document.getElementById('login-password').value);
        hideAuthPage();
        document.getElementById('sidebar-user').textContent = `👤 ${data.username}`;
        navigate('dashboard');
    } catch (err) {
        toast(err.message, 'error');
    }
    btn.disabled = false; txt.textContent = 'Sign In'; spn.style.display = 'none';
}
async function handleRegister(e) {
    e.preventDefault();
    const btn = document.getElementById('register-btn');
    const txt = btn.querySelector('.btn-text');
    const spn = btn.querySelector('.btn-spinner');
    const errorEl = document.getElementById('reg-error');
    errorEl.style.display = 'none';
    const username = document.getElementById('reg-username').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const mobile = document.getElementById('reg-mobile').value.trim();
    const password = document.getElementById('reg-password').value;
    const confirm_password = document.getElementById('reg-confirm-password').value;
    if (password !== confirm_password) {
        errorEl.textContent = 'Passwords do not match';
        errorEl.style.display = 'block';
        return;
    }
    btn.disabled = true; txt.textContent = 'Creating...'; spn.style.display = 'inline';
    try {
        await registerUser(username, email, mobile, password, confirm_password);
        toast('Registration successful! Please sign in.', 'success');
        showLogin();
        document.getElementById('login-username').value = username;
    } catch (err) {
        errorEl.textContent = err.message;
        errorEl.style.display = 'block';
    }
    btn.disabled = false; txt.textContent = 'Create Account'; spn.style.display = 'none';
}

// ---- Init ----
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initAuthNeuralBg();
    const token = getToken();
    if (token) {
        hideAuthPage();
        const user = localStorage.getItem(USER_KEY);
        if (user) document.getElementById('sidebar-user').textContent = `👤 ${user}`;
        initMicroInteractions();
        navigate('dashboard');
    } else {
        showAuthPage();
    }
});
