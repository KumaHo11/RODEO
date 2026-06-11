import openpyxl

wb = openpyxl.load_workbook('/Users/javi/RODEO/sheet.xlsx', data_only=False)
sheet = wb.active

def print_cell_info(cell_ref):
    cell = sheet[cell_ref]
    print(f"{cell_ref}: val={cell.value}")

print("--- Cells for RAC/POT ---")
print_cell_info('AD70')
print_cell_info('BI70')
print_cell_info('CN70')
print_cell_info('DS70')
print_cell_info('EX70')
print_cell_info('GC70')
print_cell_info('HH70')
print_cell_info('IA5')
print_cell_info('HW59')

print("--- Getting row labels for row 70 ---")
print_cell_info('B70')
print_cell_info('C70')
print_cell_info('D70')

