import sqlite3, hashlib

conn = sqlite3.connect(r'C:\Users\MayurShrirao\projects_dashboard\tracker.db')
users = conn.execute('SELECT id, username, password_hash FROM users').fetchall()

salt = 'project_hub_salt_2024'

for u in users:
    print(f'User: {u[1]}')
    print(f'  DB hash: {u[2]}')

# Try common passwords
for pw in ['test123', 'password123', 'admin123', 'Test@123', 'Test1234', 'Welcome@1', 'Password@123']:
    h = hashlib.sha256((pw + salt).encode()).hexdigest()
    for u in users:
        if h == u[2]:
            print(f'  *** PASSWORD FOUND: {pw} for user {u[1]} ***')

# If not found, reset it
h = hashlib.sha256(('test123' + salt).encode()).hexdigest()
print(f'\nHash for "test123": {h}')

# Check if user 1 hash matches test123
if h != users[0][2]:
    print('Hash mismatch! Resetting password to test123...')
    conn.execute('UPDATE users SET password_hash=? WHERE id=?', (h, users[0][0]))
    conn.commit()
    print('Reset complete')

conn.close()
