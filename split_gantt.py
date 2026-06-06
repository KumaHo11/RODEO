import os

with open('frontend/src/app/dashboard/grazing/page.tsx', 'r') as f:
    lines = f.readlines()

# Lines are 0-indexed in python list.
imports = lines[0:37]
helpers = lines[37:244]
components = lines[244:2410]
rest = lines[2410:]

# 1. Create InteractiveGantt.tsx
with open('frontend/src/app/dashboard/grazing/InteractiveGantt.tsx', 'w') as f:
    f.writelines(imports)
    f.write("\n")
    f.writelines(helpers)
    f.write("\n")
    f.writelines(components)
    f.write("\nexport default InteractiveGantt;\n")

# 2. Modify page.tsx
with open('frontend/src/app/dashboard/grazing/page.tsx', 'w') as f:
    f.writelines(imports)
    f.write("import InteractiveGantt from './InteractiveGantt';\n")
    f.writelines(helpers)
    f.write("\n")
    f.writelines(rest)

