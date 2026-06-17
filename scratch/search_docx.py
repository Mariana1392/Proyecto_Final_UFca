import os
import zipfile
import re

docx_files = []
for root, dirs, files in os.walk("."):
    if any(ex in root for ex in ["node_modules", ".git", ".vercel", ".claude"]):
        continue
    for file in files:
        if file.lower().endswith('.docx'):
            docx_files.append(os.path.join(root, file))

print(f"Searching in docx files: {docx_files}")

for docx in docx_files:
    try:
        with zipfile.ZipFile(docx, 'r') as z:
            # Word documents store text in word/document.xml
            if 'word/document.xml' in z.namelist():
                content = z.read('word/document.xml').decode('utf-8', errors='ignore')
                if 'coogranada' in content.lower():
                    print(f"Found 'Coogranada' in docx file: {docx}")
                if 'antecedentes' in content.lower():
                    print(f"Found 'Antecedentes' in docx file: {docx}")
    except Exception as e:
        print(f"Error reading {docx}: {e}")
