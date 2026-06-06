import re
import sys

def process(filename):
    with open(filename, 'r') as f:
        content = f.read()
    
    # find all numbers
    matches = re.findall(r'(-?\d+(?:\.\d+)?)', content[content.find('<g'):])
    numbers = [float(m) for m in matches if abs(float(m)) > 0]
    
    # naive approach won't work well due to path commands, 
    # but let's try finding the x and y coordinates from d="..."
    path_ds = re.findall(r'd="([^"]+)"', content)
    xs, ys = [], []
    for d in path_ds:
        tokens = re.findall(r'(-?\d+(?:\.\d+)?)', d)
        if not tokens: continue
        # pair them up roughly (this is very naive but might give an idea)
        for i in range(0, len(tokens)-1, 2):
            xs.append(float(tokens[i]))
            ys.append(float(tokens[i+1]))
    
    if xs and ys:
        print(f"{filename}: bbox ≈ {min(xs)} {min(ys)} {max(xs)-min(xs)} {max(ys)-min(ys)}")

process('/Users/javi/RODEO/frontend/public/LogoHeader.svg')
process('/Users/javi/RODEO/frontend/public/LogoRodeohorizontal.svg')
process('/Users/javi/RODEO/frontend/public/LogoRodeo.svg')
