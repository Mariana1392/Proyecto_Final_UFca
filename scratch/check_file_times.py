import os
import glob
import datetime

files = glob.glob(r"C:\Users\dairi\Downloads\Reporte_Consolidado_Sistema_UFCA_2026-06-14*")
for f in files:
    mtime = os.path.getmtime(f)
    mtime_dt = datetime.datetime.fromtimestamp(mtime)
    size = os.path.getsize(f)
    print(f"{os.path.basename(f)}: size={size} bytes, modified={mtime_dt}")
