import re

path = '/Users/javi/RODEO/frontend/src/app/dashboard/mi-campo/components/PaddockModal.tsx'
with open(path, 'r') as f:
    content = f.read()

content = content.replace('setNoteImage(null)', 'setNoteImages([])')
content = content.replace('setNoteImagePreview(null)', 'setNoteImagePreviews([])')

content = re.sub(r'\} else if \(noteImage\) \{', '} else if (noteImages.length > 0) {', content)
content = re.sub(r'blob: noteImage,', 'blob: noteImages[0],', content)
content = re.sub(r'title: noteTitle.trim\(\) \|\| noteImage.name,', 'title: noteTitle.trim() || noteImages[0]?.name,', content)

content = re.sub(r'if \(noteImage\) \{', 'if (noteImages.length > 0) {', content)
content = re.sub(r'const compressedImage = await compressImage\(noteImage\)', 'const compressedImage = await compressImage(noteImages[0])', content)

content = content.replace('if (!noteImage) return', 'if (noteImages.length === 0) return')
content = content.replace('[noteImage, areaHa]', '[noteImages, areaHa]')

with open(path, 'w') as f:
    f.write(content)
print("Fixes applied.")
