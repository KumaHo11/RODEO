const fs = require('fs');

let content = fs.readFileSync('/Users/javi/RODEO/frontend/src/app/landing/page.tsx', 'utf8');

content = content.replace(/emoji:\s*'🛰️'/g, "Icon: Antenna");
content = content.replace(/emoji:\s*'📋'/g, "Icon: ClipboardCheck");
content = content.replace(/emoji:\s*'💰'/g, "Icon: Leaf");

content = content.replace(
  /<div className="text-3xl mb-4">\{item\.emoji\}<\/div>/g,
  '<div className="w-10 h-10 bg-green-600/20 rounded-xl flex items-center justify-center mb-4">\n                  <item.Icon className="w-6 h-6 text-green-400" />\n                </div>'
);

const lucideMatch = content.match(/import\s+\{([^}]+)\}\s+from\s+'lucide-react'/);
if (lucideMatch) {
  let imports = lucideMatch[1];
  const toAdd = ['Antenna', 'ClipboardCheck', 'Leaf', 'ClipboardCheck'];
  for (const icon of toAdd) {
    if (!imports.includes(icon)) {
      imports += `, ${icon}`;
    }
  }
  content = content.replace(lucideMatch[0], `import {${imports}} from 'lucide-react'`);
}

fs.writeFileSync('/Users/javi/RODEO/frontend/src/app/landing/page.tsx', content);
