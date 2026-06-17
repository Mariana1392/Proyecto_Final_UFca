import os

search_terms = ["objetivo", "especifico", "gestionar roles"]
exclude_dirs = ["node_modules", ".git", ".vercel", ".claude", "dist", "build"]

def search_files(directory):
    for root, dirs, files in os.walk(directory):
        # Exclude directories
        dirs[:] = [d for d in dirs if d not in exclude_dirs]
        for file in files:
            filepath = os.path.join(root, file)
            # Skip large binary files unless they are word documents/excel (we handle encoding errors)
            if file.endswith(('.png', '.jpg', '.jpeg', '.apk', '.xlsx')):
                continue
            try:
                with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                    for term in search_terms:
                        if term in content.lower():
                            print(f"Match found for '{term}' in file: {filepath}")
            except Exception as e:
                pass

search_files(".")
