import os

with open('frontend/src/app/dashboard/grazing/page.tsx', 'r') as f:
    lines = f.readlines()

# indices:
# line 1 is index 0
# line 244 is index 243
# line 245 is index 244
# line 2409 is index 2408

part1 = lines[0:244] # Lines 1 to 244
part2 = lines[244:2409] # Lines 245 to 2409
part3 = lines[2409:] # Line 2410 to end

# InteractiveGantt.tsx gets part1 + part2 + export default
with open('frontend/src/app/dashboard/grazing/InteractiveGantt.tsx', 'w') as f:
    f.writelines(part1)
    f.writelines(part2)
    f.write("\nexport default InteractiveGantt;\n")

# page.tsx gets part1 (with the new import) + part3
with open('frontend/src/app/dashboard/grazing/page.tsx', 'w') as f:
    # insert import after line 36 (imports end around there)
    for i in range(37):
        f.write(part1[i])
    f.write("import InteractiveGantt from './InteractiveGantt';\n")
    for i in range(37, len(part1)):
        f.write(part1[i])
    f.writelines(part3)

