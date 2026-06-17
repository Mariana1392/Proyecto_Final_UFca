import os
import glob
from datetime import datetime

print("Searching in brain directory...")
brain_dir = r"C:\Users\maria\.gemini\antigravity\brain\941fb00a-6c8e-4bcf-b3f9-dc4b3a22e174"
if os.path.exists(brain_dir):
    for root, dirs, files in os.walk(brain_dir):
        for file in files:
            if file.lower().endswith(('.png', '.jpg', '.jpeg', '.svg')):
                filepath = os.path.join(root, file)
                mtime = os.path.getmtime(filepath)
                dt = datetime.fromtimestamp(mtime)
                print(f"Brain image: {filepath} (modified: {dt}, size: {os.path.getsize(filepath)} bytes)")
else:
    print("Brain directory does not exist")

print("Searching in workspace...")
for root, dirs, files in os.walk("."):
    if any(ex in root for ex in ["node_modules", ".git"]):
        continue
    for file in files:
        if file.lower().endswith(('.png', '.jpg', '.jpeg', '.svg')):
            filepath = os.path.join(root, file)
            mtime = os.path.getmtime(filepath)
            dt = datetime.fromtimestamp(mtime)
            print(f"Workspace image: {filepath} (modified: {dt}, size: {os.path.getsize(filepath)} bytes)")
