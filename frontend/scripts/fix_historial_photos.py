import re

path = '/Users/javi/RODEO/frontend/src/app/dashboard/mi-campo/components/PaddockModal.tsx'
with open(path, 'r') as f:
    content = f.read()

# Fix hasPhoto checks
content = content.replace('const hasPhoto = !!note.photo_url', 'const hasPhoto = !!note.photo_url || (note.photo_urls && note.photo_urls.length > 0)')

# Fix aspect ratio for single image
old_button = 'className="relative w-full aspect-square overflow-hidden rounded-lg group"'
new_button = 'className={`relative w-full overflow-hidden rounded-lg group ${urls.length === 1 ? "aspect-video" : "aspect-square"}`}'
content = content.replace(old_button, new_button)

with open(path, 'w') as f:
    f.write(content)
print("Updated history photos.")
