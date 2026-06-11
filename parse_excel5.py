import openpyxl

wb = openpyxl.load_workbook('/Users/javi/RODEO/sheet.xlsx', data_only=False)
sheet = wb.active

print("G cells:")
for r in [58, 59, 60, 61, 62]:
    print(f"G{r}: {sheet[f'G{r}'].value}")

print("H10:HN10 count explanation:")
# What is in H10 to HN10?
# They are probably cells for the calendar.
print(f"H9: {sheet['H9'].value}, H10: {sheet['H10'].value}, HN9: {sheet['HN9'].value}")

# Let's also check HW10
print(f"HW10: {sheet['HW10'].value}")

