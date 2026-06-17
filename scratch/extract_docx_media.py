import os
import zipfile
import shutil

docx_files = []
for root, dirs, files in os.walk("."):
    if any(ex in root for ex in ["node_modules", ".git", ".vercel", ".claude"]):
        continue
    for file in files:
        if file.lower().endswith('.docx'):
            docx_files.append(os.path.join(root, file))

print(f"Found docx files: {docx_files}")

os.makedirs("scratch/extracted_media", exist_ok=True)

for docx in docx_files:
    try:
        with zipfile.ZipFile(docx, 'r') as z:
            media_files = [f for f in z.namelist() if f.startswith('word/media/')]
            if media_files:
                print(f"Document {docx} contains {len(media_files)} media files.")
                doc_name = os.path.splitext(os.path.basename(docx))[0]
                doc_media_dir = os.path.join("scratch/extracted_media", doc_name)
                os.makedirs(doc_media_dir, exist_ok=True)
                for media_file in media_files:
                    target_name = os.path.basename(media_file)
                    target_path = os.path.join(doc_media_dir, target_name)
                    with z.open(media_file) as source, open(target_path, 'wb') as target:
                        shutil.copyfileobj(source, target)
                    print(f"  Extracted: {target_name} to {target_path} (Size: {os.path.getsize(target_path)} bytes)")
    except Exception as e:
        print(f"Error processing {docx}: {e}")
