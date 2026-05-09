#!/usr/bin/env python3
"""Apply 5 targeted fixes to grazing/page.tsx and herds/page.tsx"""

import re

# ══════════════════════════════════════════════════════════════════════════════
# FIX 1 + 2: grazing/page.tsx
# ══════════════════════════════════════════════════════════════════════════════
FILE = '/Users/javi/RODEO/frontend/src/app/dashboard/grazing/page.tsx'
with open(FILE, 'r') as f:
    content = f.read()

# ── 1a. Solid bg on animal rows (bg-inherit → explicit color per parity) ──
# The herd rows use bg-inherit which is transparent. Change sticky label to explicit.
content = content.replace(
    'sticky left-0 z-10 bg-inherit shadow-[1px_0_0_0_#e5e7eb]',
    'sticky left-0 z-10 shadow-[2px_0_0_0_#e5e7eb]',
    1
)
# Make the rows themselves carry explicit bg (not inherit):
# Even rows: bg-white, odd: bg-gray-50/60 → bg-gray-50
content = content.replace(
    "hi % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'",
    "hi % 2 === 0 ? 'bg-white' : 'bg-gray-50'",
    1
)

# ── 1b. Solid bg on the sticky label inside each herd row ──────────────────
# The label div needs to mirror the row bg. We use a before-pseudo trick by
# wrapping the condition. Replace flex div to carry explicit bg classes:
content = content.replace(
    '''                        <div style={{ width: LABEL_W, minWidth: LABEL_W }} className="pl-4 pr-2.5 flex items-center border-r border-gray-200 shrink-0 gap-1 justify-start sticky left-0 z-10 shadow-[1px_0_0_0_#e5e7eb]">''',
    '''                        <div style={{ width: LABEL_W, minWidth: LABEL_W }} className={`pl-4 pr-2.5 flex items-center border-r border-gray-200 shrink-0 gap-1 justify-start sticky left-0 z-10 shadow-[2px_0_0_0_#e5e7eb] ${hi % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>''',
    1
)

# ── 1c. Solid bg on split button sticky label ──────────────────────────────
content = content.replace(
    'sticky left-0 z-10 bg-green-50/20',
    'sticky left-0 z-10 bg-white',
    1
)
content = content.replace(
    '"flex border-t border-dashed border-green-200 bg-green-50/20"',
    '"flex border-t border-dashed border-green-200 bg-white"',
    1
)

# ── 2. Sticky paddock label column ─────────────────────────────────────────
# Paddock row label: add sticky left-0 with solid bg matching the row.
# The row bg is: !isEnabled ? 'bg-gray-100/60' : rowIdx%2==0 ? 'bg-white' : 'bg-[#fafafa]'
# The label div (line 705) currently has no sticky
content = content.replace(
    '              <div style={{ width: LABEL_W, minWidth: LABEL_W }} className="px-3 py-2 flex items-center gap-2 border-r border-gray-100 shrink-0 overflow-hidden">',
    '              <div style={{ width: LABEL_W, minWidth: LABEL_W }} className={`px-3 py-2 flex items-center gap-2 border-r border-gray-100 shrink-0 overflow-hidden sticky left-0 z-20 shadow-[2px_0_0_0_#f3f4f6] ${!isEnabled ? \'bg-gray-100\' : rowIdx % 2 === 0 ? \'bg-white\' : \'bg-[#fafafa]\'}`}>',
    1
)

# ── 3. Unify EV formula → use metabolic body weight: (weight/400)^0.75 * factor * count ──
# Replace all occurrences of the wrong formula in grazing/page.tsx
OLD_EV_FORMULA_1 = '(peso / 450) * factor'
NEW_EV_FORMULA_1 = 'Math.pow((peso || 400) / 400, 0.75) * factor'
content = content.replace(OLD_EV_FORMULA_1, NEW_EV_FORMULA_1)

OLD_EV_FORMULA_2 = '(peso / 450) * fac'
NEW_EV_FORMULA_2 = 'Math.pow((peso || 400) / 400, 0.75) * fac'
content = content.replace(OLD_EV_FORMULA_2, NEW_EV_FORMULA_2)

OLD_EV_FORMULA_3 = '(p / 450) * factor'
NEW_EV_FORMULA_3 = 'Math.pow((p || 400) / 400, 0.75) * factor'
content = content.replace(OLD_EV_FORMULA_3, NEW_EV_FORMULA_3)

OLD_EV_FORMULA_4 = '(p / 450) * fac'
NEW_EV_FORMULA_4 = 'Math.pow((p || 400) / 400, 0.75) * fac'
content = content.replace(OLD_EV_FORMULA_4, NEW_EV_FORMULA_4)

# Also fix the addHerdForm EV display and save (already uses heads * (peso/450) * factor)
content = content.replace(
    '(heads * (peso / 450) * factor).toFixed(1)',
    '(Math.pow((peso || 400) / 400, 0.75) * factor * heads).toFixed(1)'
)
content = content.replace(
    'parseFloat((heads * (peso / 450) * factor).toFixed(2))',
    'parseFloat((Math.pow((peso || 400) / 400, 0.75) * factor * heads).toFixed(2))'
)

# Also fix the old formula in the Ampliar modal and anywhere else in file
content = content.replace(
    '(Number(h.total_ev) || 0) / Math.max(Number(h.head_count) || 1, 1)',
    '(Number(h.total_ev) || (Math.pow((Number(h.avg_weight_kg) || 400) / 400, 0.75) * (CATEGORIA_DEMAND_FACTOR[h.categoria as keyof typeof CATEGORIA_DEMAND_FACTOR] ?? 1.0) * (Number(h.head_count) || 1))) / Math.max(Number(h.head_count) || 1, 1)'
)
content = content.replace(
    '(Number(herd.total_ev) || 0) / Math.max(currentHeadCount, 1)',
    '(Number(herd.total_ev) || (Math.pow((Number(herd.avg_weight_kg) || 400) / 400, 0.75) * (CATEGORIA_DEMAND_FACTOR[herd.categoria as keyof typeof CATEGORIA_DEMAND_FACTOR] ?? 1.0) * currentHeadCount)) / Math.max(currentHeadCount, 1)'
)

with open(FILE, 'w') as f:
    f.write(content)
print('✅ grazing/page.tsx done')

# ══════════════════════════════════════════════════════════════════════════════
# FIX 4: herds/page.tsx — bottom padding on cards grid
# ══════════════════════════════════════════════════════════════════════════════
HERDS_FILE = '/Users/javi/RODEO/frontend/src/app/dashboard/herds/page.tsx'
with open(HERDS_FILE, 'r') as f:
    hc = f.read()

# Add pb-20 sm:pb-8 to the two card grid divs
hc = hc.replace(
    '<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">',
    '<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-24 sm:pb-10">',
    2  # replace both loading skeleton and actual grid
)

with open(HERDS_FILE, 'w') as f:
    f.write(hc)
print('✅ herds/page.tsx padding done')

# ══════════════════════════════════════════════════════════════════════════════
# FIX 5: herds/page.tsx — unify EV formula
# ══════════════════════════════════════════════════════════════════════════════
with open(HERDS_FILE, 'r') as f:
    hc = f.read()

# The herds page has: Math.pow((weight || 400) / 400, 0.75) * f * count — this is CORRECT
# Just verify it's there
if 'Math.pow((weight || 400) / 400, 0.75)' in hc:
    print('✅ herds/page.tsx EV formula already correct')
else:
    print('⚠️  herds/page.tsx EV formula check needed')

print('All done.')
