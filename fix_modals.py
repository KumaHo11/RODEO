import re

with open('/Users/javi/RODEO/frontend/src/app/dashboard/grazing/page.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Fix suggested plan submit buttons
code = code.replace("bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-black text-sm shadow-lg shadow-indigo-200", "bg-green-600 text-white rounded-xl hover:bg-green-700 font-black text-sm shadow-lg shadow-green-200")
code = code.replace("shadow-indigo-200", "shadow-green-200")
code = code.replace("border-indigo-100", "border-gray-100")
code = code.replace("bg-indigo-100", "bg-gray-100")
code = code.replace("text-indigo-600", "text-gray-600")

# Ensure text-[10px] for inputs
code = code.replace('text-xs font-black text-gray-700 tracking-wide', 'text-[10px] font-black text-gray-700 tracking-widest uppercase')

# Drop any unneeded empty state text lines (in case the regex missed it)
code = re.sub(r'<p className="text-\[10px\] text-amber-600 font-bold text-center py-1">👆.*?</p>', '', code)
code = re.sub(r'\{.*\.length === 0 && \(\s*\)\}', '', code)

# Planificacion Fechas input section background fix (it was blue-50)
code = code.replace("border-blue-100 bg-blue-50/40", "border-gray-200 bg-gray-50/50")
code = code.replace("bg-blue-100/60 border-b border-blue-100", "bg-gray-100/60 border-b border-gray-200")
code = code.replace("text-blue-700 uppercase tracking-widest", "text-gray-700 uppercase tracking-widest")
code = code.replace("text-[9px] font-black text-blue-600 tracking-widest uppercase", "text-[10px] font-black text-gray-700 tracking-widest uppercase")

with open('/Users/javi/RODEO/frontend/src/app/dashboard/grazing/page.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

print("Done Refactoring Modal 2")
