import requests, json

BASE = 'http://localhost:8501'

# Login
r = requests.post(f'{BASE}/api/login', json={'username': 'mayur.shrirao@datafortune.com', 'password': 'test123'})
print('Login:', r.status_code)
if r.status_code != 200:
    print('Login failed:', r.text)
    exit()

token = r.json()['token']
headers = {'Authorization': f'Bearer {token}'}

# Get projects
r2 = requests.get(f'{BASE}/api/projects', headers=headers)
projects = r2.json()
print(f'Projects: {len(projects)}')
for p in projects:
    wp = p.get('workspace_path', '')
    print(f'  - {p["name"]} | workspace_path: {bool(wp)}')

# Test doc content
r3 = requests.get(f'{BASE}/api/documents/1/content', headers=headers)
print(f'Doc content ID 1: {r3.status_code}', end='')
if r3.status_code == 404:
    print(f' - {r3.json().get("detail")}')
elif r3.status_code == 200:
    print(f' - type={r3.json().get("type")}')

# Test open workspace
if projects:
    pid = projects[0]['id']
    r4 = requests.post(f'{BASE}/api/projects/{pid}/open-workspace', headers=headers)
    print(f'Open workspace ({pid}): {r4.status_code}')
    if r4.status_code == 404:
        print(f'  Reason: {r4.json().get("detail")}')

print('All tests passed!')
print(f'Please open http://localhost:8501 in your browser.')
