import sqlite3, os, shutil, uuid

DB = r'C:\Users\MayurShrirao\projects_dashboard\tracker.db'
UPLOADS = r'C:\Users\MayurShrirao\projects_dashboard\uploads'
WORKSPACE = r'C:\Users\MayurShrirao\OneDrive - Datafortune Software Solutions Pvt. Ltd\Documents\Workspace\Notesight'

conn = sqlite3.connect(DB)

# Check tables
tables = conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
print("Tables:", [t[0] for t in tables])

# Check projects table schema
print("\nProjects table:")
print(conn.execute("SELECT sql FROM sqlite_master WHERE name='projects'").fetchone()[0])

# Get the Notesight project IDs
projects = conn.execute("SELECT id, user_id, name FROM projects WHERE name='Notesight'").fetchall()
print(f"\nNotesight projects: {projects}")

conn.close()
