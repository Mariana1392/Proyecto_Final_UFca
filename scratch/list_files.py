import os

def list_interesting_files(directory):
    interesting_exts = ('.png', '.jpg', '.jpeg', '.svg', '.html', '.docx', '.doc', '.vsd', '.vsdx', '.fig', '.drawio')
    for root, dirs, files in os.walk(directory):
        if any(ex in root for ex in ["node_modules", ".git"]):
            continue
        for file in files:
            if file.lower().endswith(interesting_exts) or 'alcance' in file.lower() or 'objetivo' in file.lower():
                filepath = os.path.join(root, file)
                print(f"File: {filepath} (Size: {os.path.getsize(filepath)} bytes)")

list_interesting_files(".")
