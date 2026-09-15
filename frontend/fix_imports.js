const fs = require('fs');
const path = require('path');

const files = [
  'src/components/HerdModal.tsx',
  'src/app/dashboard/mi-campo/components/PaddockModal.tsx',
  'src/app/dashboard/bitacora/components/BitacoraModal.tsx',
  'src/lib/offline/outbox.ts',
  'src/app/dashboard/bitacora/page.tsx',
  'src/app/dashboard/tareas/page.tsx',
  'src/app/dashboard/agenda/page.tsx',
  'src/app/dashboard/equipo/page.tsx',
  'src/app/dashboard/herds/page.tsx',
  'src/app/dashboard/grazing/page.tsx',
  'src/app/dashboard/mi-campo/page.tsx'
];

for (const file of files) {
  const filePath = path.join(__dirname, file);
  if (!fs.existsSync(filePath)) {
    console.log(`Skipping ${file} - not found`);
    continue;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Replace dynamic imports
  content = content.replace(/const\s+\{\s*enqueue\s*\}\s*=\s*await\s+import\(['"]@\/lib\/offline\/outbox['"]\);?/g, '');
  content = content.replace(/const\s+\{\s*outboxGetAll\s*\}\s*=\s*await\s+import\(['"]@\/lib\/offline\/db['"]\);?/g, '');
  content = content.replace(/const\s+\{\s*(?:get|save|delete)Pending(?:Photo|Audio)(?:\s*,\s*(?:get|save|delete)Pending(?:Photo|Audio))*\s*\}\s*=\s*await\s+import\(['"]@\/lib\/audioOfflineStore['"]\);?/g, '');
  content = content.replace(/const\s+\{\s*compressImage\s*\}\s*=\s*await\s+import\(['"]@\/components\/shared\/RecordEditor['"]\);?/g, '');
  // General db imports
  content = content.replace(/const\s+\{\s*dbGetAll(?:,\s*metaGet)?(?:,\s*dbGetOrg)?\s*\}\s*=\s*await\s+import\(['"]@\/lib\/offline\/db['"]\);?/g, '');
  content = content.replace(/const\s+\{\s*dbUpsertMany(?:,\s*metaSet)?(?:,\s*dbUpsertOrg)?\s*\}\s*=\s*await\s+import\(['"]@\/lib\/offline\/db['"]\);?/g, '');
  
  // Add static imports at the top
  const importsToAdd = [];
  if (file.includes('Modal.tsx') || file.includes('page.tsx')) {
    if (!content.includes(`from '@/lib/offline/outbox'`)) importsToAdd.push(`import { enqueue } from '@/lib/offline/outbox'`);
    if (!content.includes(`from '@/lib/audioOfflineStore'`)) importsToAdd.push(`import { savePendingPhoto, savePendingAudio, getPendingPhoto, getPendingAudio, deletePendingPhoto, deletePendingAudio } from '@/lib/audioOfflineStore'`);
  }
  
  if (file.includes('Modal.tsx') && !content.includes('compressImage')) {
    if (content.includes(`import RecordEditor`)) {
      content = content.replace(/import RecordEditor(.*?) from ['"]@\/components\/shared\/RecordEditor['"]/, `import RecordEditor$1, { compressImage } from '@/components/shared/RecordEditor'`);
    } else {
      importsToAdd.push(`import { compressImage } from '@/components/shared/RecordEditor'`);
    }
  }

  if (file.includes('outbox.ts')) {
     if (!content.includes(`from '@/lib/audioOfflineStore'`)) importsToAdd.push(`import { savePendingPhoto, savePendingAudio, getPendingPhoto, getPendingAudio, deletePendingPhoto, deletePendingAudio } from '@/lib/audioOfflineStore'`);
  }
  
  if (file.includes('page.tsx')) {
    if (!content.includes(`from '@/lib/offline/db'`)) importsToAdd.push(`import { dbGetAll, dbUpsertMany, outboxGetAll, metaGet, metaSet, dbGetOrg, dbUpsertOrg } from '@/lib/offline/db'`);
  }

  if (importsToAdd.length > 0) {
    // Insert after the first import or 'use client'
    const useClientMatch = content.match(/['"]use client['"];?\n/);
    if (useClientMatch) {
      content = content.substring(0, useClientMatch.index + useClientMatch[0].length) + importsToAdd.join('\n') + '\n' + content.substring(useClientMatch.index + useClientMatch[0].length);
    } else {
      content = importsToAdd.join('\n') + '\n' + content;
    }
  }
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Processed ${file}`);
}
