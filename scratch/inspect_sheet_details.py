import openpyxl

file_path = r"C:\Users\dairi\Downloads\Reporte_Consolidado_Sistema_UFCA_2026-06-14.xlsx"
wb = openpyxl.load_workbook(file_path)

print("Workbook sheets and their visibility:")
for name in wb.sheetnames:
    ws = wb[name]
    print(f"- Name: {name}, State: {ws.sheet_state}, Views: {ws.views}")
