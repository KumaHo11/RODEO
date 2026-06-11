import openpyxl

wb = openpyxl.load_workbook('/Users/javi/RODEO/sheet.xlsx', data_only=False)
sheet = wb.active

print(f"HW59 value: {wb.active['HW59'].value}")
print(f"HW59 formula: {wb.active['HW59'].value if isinstance(wb.active['HW59'].value, str) else ''}")

