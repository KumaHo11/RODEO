import openpyxl

wb = openpyxl.load_workbook('/Users/javi/RODEO/sheet.xlsx', data_only=False)
sheet = wb.active

print(f"HW8 (header): {sheet['HW8'].value}")
print(f"HW10 (value/formula): {sheet['HW10'].value}")

print(f"IA8 (header): {sheet['IA8'].value}")
print(f"IB8 (header): {sheet['IB8'].value}")
print(f"IA5 (value): {sheet['IA5'].value}, IA4: {sheet['IA4'].value}, HZ5: {sheet['HZ5'].value}, HZ4: {sheet['HZ4'].value}")
