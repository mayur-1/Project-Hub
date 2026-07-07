import sqlite3

DB = r'C:\Users\MayurShrirao\projects_dashboard\tracker.db'
conn = sqlite3.connect(DB)

columns = [r[1] for r in conn.execute('PRAGMA table_info(projects)').fetchall()]
print('Current columns:', columns)

if 'workspace_path' not in columns:
    conn.execute("ALTER TABLE projects ADD COLUMN workspace_path TEXT DEFAULT ''")
    conn.commit()
    print('Added workspace_path column')
else:
    print('workspace_path already exists')

columns = [r[1] for r in conn.execute('PRAGMA table_info(projects)').fetchall()]
print('Updated columns:', columns)

# Set workspace_path for Notesight projects
wp = r'C:\Users\MayurShrirao\OneDrive - Datafortune Software Solutions Pvt. Ltd\Documents\Workspace\Notesight'
users = conn.execute('SELECT id FROM users').fetchall()
for (uid,) in users:
    p = conn.execute('SELECT id FROM projects WHERE user_id=? AND name=?', (uid, 'Notesight')).fetchone()
    if p:
        conn.execute('UPDATE projects SET workspace_path=? WHERE id=?', (wp, p[0]))
        print(f'Set workspace_path for user {uid} project {p[0]}')

conn.commit()
conn.close()
print('Done!')
