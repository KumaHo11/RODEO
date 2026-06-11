import openpyxl

wb = openpyxl.load_workbook('/Users/javi/RODEO/sheet.xlsx', data_only=False)
sheet = wb.active

for i in range(55, 60):
    val = sheet[f'HW{i}'].value
    print(f"HW{i}: {val}")

# And let's see HN55 to HN59 labels
for i in range(55, 60):
    print(f"HN{i}: {sheet[f'HN{i}'].value}")

