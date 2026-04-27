import re

with open('/Users/javi/RODEO/frontend/src/app/dashboard/grazing/page.tsx', 'r', encoding='utf-8') as f:
    page = f.read()

# 1. Herds indicators (remove pastillas) in page.tsx
# Example: <div className="w-8 h-2 rounded-full" style={{ backgroundColor: isSelected ? 'rgba(255,255,255,0.4)' : hColor }} />
page = re.sub(r'<div className="w-8 h-2 rounded-full"[^>]*/>\s*', '', page)
page = re.sub(r'<div className="w-7 h-1\.5 rounded-full mb-1\.5"[^>]*/>\s*', '', page)

# 2. Herd selection button colors (green/white vs white/black)
# For manual form:
#    isSuggestedEdit
#      ? isSelected
#        ? 'border-green-500 bg-green-50 text-green-900'
#        : 'border-gray-100 bg-white text-gray-400 opacity-50 cursor-default'
#      : isSelected
#        ? 'border-green-500 bg-green-50 text-green-900'
#        : 'border-gray-100 bg-white hover:border-gray-300 hover:bg-gray-50 text-gray-700'
page = page.replace(
    "'border-green-500 bg-green-50 text-green-900'",
    "'border-green-600 bg-green-600 text-white shadow-md'"
)
page = page.replace("'border-gray-100 bg-white text-gray-400 opacity-50 cursor-default'", "'border-gray-200 bg-white text-gray-400 opacity-50 cursor-default'")
page = page.replace("'border-gray-100 bg-white hover:border-gray-300 hover:bg-gray-50 text-gray-700'", "'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 text-gray-900'")

# In suggested plan specific (2nd modal):
# isSel ? 'border-green-600 bg-green-50 text-green-900 shadow-sm' : 'border-gray-100 bg-white hover:border-gray-200'
page = page.replace(
    "'border-green-600 bg-green-50 text-green-900 shadow-sm'",
    "'border-green-600 bg-green-600 text-white shadow-md'"
)

# Text colors inside herd button for grey/white font:
# <p className={`text-xs font-bold ${isSelected ? 'text-gray-300' : 'text-gray-400'}`}>
page = page.replace(
    "`text-xs font-bold ${isSelected ? 'text-gray-300' : 'text-gray-400'}`",
    "`text-[10px] font-bold ${isSelected ? 'text-green-100' : 'text-gray-500'}`"
)
page = page.replace(
    "`text-[10px] font-bold ${isSel ? 'text-gray-300' : 'text-gray-400'}`",
    "`text-[10px] font-bold ${isSel ? 'text-green-100' : 'text-gray-500'}`"
)

# Check icon circles:
# isSel && <div className="absolute top-2 right-2 w-4 h-4 bg-green-600 rounded-full flex items-center justify-center"><Check className="w-2.5 h-2.5 text-white" /></div>
page = page.replace(
    '<div className="absolute top-2 right-2 w-4 h-4 bg-green-600 rounded-full flex items-center justify-center"><Check className="w-2.5 h-2.5 text-white" /></div>',
    '<div className="absolute top-2 right-2 w-4 h-4 bg-white/20 rounded-full flex items-center justify-center"><Check className="w-2.5 h-2.5 text-white" /></div>'
)
page = page.replace(
    '<div className={`absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center ${isSuggestedEdit ? \'bg-green-600\' : \'bg-green-600\'}`}>',
    '<div className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center bg-white/20">'
)

# 3. Potrero selection colors (suggested plan)
# className={`flex items-center justify-between px-4 py-2.5 rounded-xl border-2 text-left transition-all ${isSel ? 'border-green-600 bg-green-50' : 'border-gray-100 bg-white hover:border-gray-200'}`}
page = page.replace(
    "isSel ? 'border-green-600 bg-green-50' : 'border-gray-100 bg-white hover:border-gray-200'",
    "isSel ? 'border-green-600 bg-green-600 text-white shadow-md' : 'border-gray-200 bg-white hover:border-gray-300 text-gray-900'"
)
page = page.replace(
    "`text-sm font-bold ${isSel ? 'text-green-900' : 'text-gray-800'}`",
    "`text-sm font-bold ${isSel ? 'text-white' : 'text-gray-900'}`"
)
page = page.replace(
    "`text-[10px] text-gray-400`", # applies to paddock area ha
    "`text-[10px] ${isSel ? 'text-green-100' : 'text-gray-500'}`"
)
page = page.replace(
    "<p className={`text-sm font-black ${msColor}`}>{p.dry_matter_kg_ha || 0}</p>",
    "<p className={`text-sm font-black ${isSel ? 'text-white' : 'text-green-700'}`}>{p.dry_matter_kg_ha || 0}</p>"
)
page = page.replace(
    '<p className="text-[9px] text-gray-400">kg MS/ha</p>',
    '<p className={`text-[9px] ${isSel ? \'text-green-200\' : \'text-gray-400\'}`}>kg MS/ha</p>'
)

# Potrero selection in manual mode
page = page.replace(
    "isSelected ? 'border-green-600 bg-green-50' : 'border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50'",
    "isSelected ? 'border-green-600 bg-green-600 text-white shadow-md' : 'border-gray-200 bg-white hover:border-gray-300 text-gray-900'"
)
page = page.replace(
    "`text-sm font-bold ${isSelected ? 'text-green-900' : 'text-gray-900'}`",
    "`text-sm font-bold ${isSelected ? 'text-white' : 'text-gray-900'}`"
)
page = page.replace(
    '<p className="text-[10px] text-gray-400">{Number(p.area_ha).toFixed(1)} ha</p>',
    '<p className={`text-[10px] ${isSelected ? \'text-green-100\' : \'text-gray-500\'}`}>{Number(p.area_ha).toFixed(1)} ha</p>'
)
page = page.replace(
    '<p className={`text-sm font-black ${dmColor}`}>{p.dry_matter_kg_ha || 0}</p>',
    '<p className={`text-sm font-black ${isSelected ? \'text-white\' : \'text-green-700\'}`}>{p.dry_matter_kg_ha || 0}</p>'
)
page = page.replace(
    '<p className="text-[9px] text-gray-400 font-bold">kg MS/ha</p>',
    '<p className={`text-[9px] font-bold ${isSelected ? \'text-green-200\' : \'text-gray-400\'}`}>kg MS/ha</p>'
)

# Checkmark in Potrero manual selection
page = page.replace(
    '<div className="w-5 h-5 bg-green-600 rounded-full flex items-center justify-center shrink-0"><Check className="w-3 h-3 text-white" /></div>',
    '<div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center shrink-0"><Check className="w-3 h-3 text-white" /></div>'
)

# Add outline circle to unselected cards if not present
# Actually, unselected Potreros already have: <div className="w-4 h-4 rounded-full border-2 border-gray-200 shrink-0" />
# Unselected Herds didn't have a circle, let's just make the whole card clickable, no circle needed, checkmark appears when selected. User said: "pone verde el check de selección o el circulo de deseleccionado", meaning just style it. The circle in Potrero is enough. For Herds, I'll add an empty circle if unselected manually if I want, but let's see.
page = re.sub(
    r'(\{\s*isSelected\s*\n\s*\?\s*<div.*?Check.*?div>\s*\n\s*):',
    r'\1: <div className="absolute top-2 right-2 w-5 h-5 rounded-full border-2 border-gray-200 flex items-center justify-center" />',
    page
)


# 4. Remove stars in relative quality
# <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800" title="Calidad Relativa del potrero">★{p.technical_data.relative_quality}</span>
# Make it neutral (gray or green)
page = re.sub(
    r'<span className="text-\[8px\] font-black px-1\.5 py-0\.5 rounded-full bg-amber-100 text-amber-800"\s*title="Calidad Relativa del potrero">\s*★\{p\.technical_data\.relative_quality\}\s*</span>',
    r'<span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-green-900/20 text-current" title="Calidad Relativa del potrero">{p.technical_data.relative_quality}/10</span>',
    page
)
page = re.sub(
    r'<span className=\{`text-\[8px\] font-black \$\{p\.id === formData\.paddock_id \? \'text-amber-300\' : \'text-amber-600\'\}`\}>\s*★\{p\.technical_data\.relative_quality\}\s*</span>',
    r'<span className={`text-[8px] font-black ${p.id === formData.paddock_id ? \'text-green-200\' : \'text-green-600\'}`}>{p.technical_data.relative_quality}/10</span>',
    page
)


# 5. Non-red/orange alerts
# Change red limit alert
# className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2" -> bg-gray-50 border-gray-200
page = page.replace('bg-red-50 border border-red-200 rounded-xl', 'bg-gray-50 border-gray-200 rounded-xl')
page = page.replace('text-red-500 shrink-0', 'text-gray-500 shrink-0')
page = page.replace('text-[11px] text-red-600', 'text-[11px] text-gray-600')
page = page.replace('bg-red-100 text-red-600', 'bg-gray-100 text-gray-600')
page = page.replace('border-red-300 focus:ring-red-400', 'border-gray-300 focus:ring-gray-400')

# Change inline edit alert (amber)
page = page.replace('bg-amber-50 border border-amber-200 rounded-xl p-3', 'bg-gray-50 border border-gray-200 rounded-xl p-3')
page = page.replace('text-amber-800 flex items-center', 'text-gray-800 flex items-center')
page = page.replace('bg-amber-500 text-white rounded-xl text-xs font-black hover:bg-amber-600', 'bg-gray-800 text-white rounded-xl text-xs font-black hover:bg-gray-900')

# Change red/orange delta feedback in suggestion preview
page = page.replace('bg-orange-50 border-orange-200', 'bg-gray-50 border-gray-200')
page = page.replace('text-orange-500', 'text-gray-500')
page = page.replace('text-orange-800', 'text-gray-800')
page = page.replace('text-orange-600', 'text-gray-600')

# Remanente feedback
page = page.replace('bg-amber-50 border-2 border-amber-100', 'bg-gray-50 border-2 border-gray-100')
page = page.replace('text-amber-600', 'text-green-700')
page = page.replace('text-amber-700', 'text-gray-700')
page = page.replace('text-amber-500', 'text-gray-500')
page = page.replace('focus:ring-amber-400', 'focus:ring-green-500')
page = page.replace('border-amber-200', 'border-gray-200')

# Change warning real dates
page = page.replace('bg-orange-100 text-orange-600', 'bg-gray-200 text-gray-700')

# Write back
with open('/Users/javi/RODEO/frontend/src/app/dashboard/grazing/page.tsx', 'w', encoding='utf-8') as f:
    f.write(page)

# HerdModal Activity tab fixes
with open('/Users/javi/RODEO/frontend/src/components/HerdModal.tsx', 'r', encoding='utf-8') as f:
    herd_modal = f.read()

# Change Baby icon and ShoppingCart icon out of the Activities array
herd_modal = herd_modal.replace("{ id: 'paricion',  label: 'Parición',  color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200',   dot: 'bg-blue-500',   icon: Baby }", "{ id: 'paricion',  label: 'Parición',  color: 'text-gray-700',   bg: 'bg-gray-50',   border: 'border-gray-200',   dot: 'bg-gray-400',   icon: Plus }")
herd_modal = herd_modal.replace("{ id: 'compra',    label: 'Compra',    color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200',  dot: 'bg-green-500',  icon: ShoppingCart }", "{ id: 'compra',    label: 'Compra',    color: 'text-gray-700',  bg: 'bg-gray-50',  border: 'border-gray-200',  dot: 'bg-gray-400',  icon: Plus }")
herd_modal = herd_modal.replace("{ id: 'destete',   label: 'Destete',   color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200', dot: 'bg-violet-500', icon: Baby }", "{ id: 'destete',   label: 'Destete',   color: 'text-gray-700', bg: 'bg-gray-50', border: 'border-gray-200', dot: 'bg-gray-400', icon: Minus }")
herd_modal = herd_modal.replace("{ id: 'mortandad', label: 'Mortandad', color: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200',    dot: 'bg-red-500',    icon: TrendingDown }", "{ id: 'mortandad', label: 'Mortandad', color: 'text-gray-700',    bg: 'bg-gray-50',    border: 'border-gray-200',    dot: 'bg-gray-400',    icon: Minus }")
herd_modal = herd_modal.replace("{ id: 'venta',     label: 'Venta',     color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200',  dot: 'bg-amber-500',  icon: TrendingUp }", "{ id: 'venta',     label: 'Venta',     color: 'text-gray-700',  bg: 'bg-gray-50',  border: 'border-gray-200',  dot: 'bg-gray-400',  icon: Minus }")

# Re-add selected state styles logically
herd_modal = herd_modal.replace("sel ? `${a.bg} ${a.color} ${a.border}` : 'border-gray-200 text-gray-600 hover:border-gray-300 bg-white'", "sel ? `bg-gray-900 border-gray-900 text-white shadow-md` : 'border-gray-200 text-gray-600 hover:border-gray-300 bg-white'")
herd_modal = herd_modal.replace("sel ? a.dot : 'bg-gray-300'", "sel ? 'bg-white' : 'bg-gray-300'")

# Remove Baby completely from empty states
herd_modal = herd_modal.replace('<Baby className="w-10 h-10 text-gray-200 mx-auto mb-3" />', '<ClipboardList className="w-10 h-10 text-gray-200 mx-auto mb-3" />')
herd_modal = herd_modal.replace('<Baby className="w-4 h-4 text-green-600 shrink-0" />', '<Check className="w-4 h-4 text-green-600 shrink-0" />')

with open('/Users/javi/RODEO/frontend/src/components/HerdModal.tsx', 'w', encoding='utf-8') as f:
    f.write(herd_modal)

print("Done Refactoring script 3")

