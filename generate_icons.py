import os
import cairosvg

# Original SVG
svg_path = '/Users/javi/RODEO/frontend/public/LogoInstallapp.svg'
with open(svg_path, 'r') as f:
    svg_content = f.read()

# Replace the styles and add a green background
# The original SVG has:
#    <![CDATA[
#     .fil0 {fill:#E8EBE9}
#     .fil1 {fill:white}
#    ]]>
# We want both fil0 and fil1 to be white (#ffffff), and we want a green background.
# We can inject a <rect> after <g id="Capa_x0020_1"> or just wrap it.

new_style = """
    .fil0 {fill:#ffffff}
    .fil1 {fill:#ffffff}
"""
svg_content = svg_content.replace(".fil0 {fill:#E8EBE9}", ".fil0 {fill:#ffffff}")
svg_content = svg_content.replace(".fil1 {fill:white}", ".fil1 {fill:#ffffff}")

# Add background rect
# The viewBox is 0 0 1693.32 1693.32
# Insert <rect> right after <g id="_2550369256">
bg_rect = '<rect width="1693.32" height="1693.32" rx="338" fill="#16a34a"/>'
svg_content = svg_content.replace('<g id="_2550369256">', f'<g id="_2550369256">{bg_rect}')

# Generate the base modified SVG
modified_svg_path = '/Users/javi/RODEO/frontend/public/icons/icon-base.svg'
with open(modified_svg_path, 'w') as f:
    f.write(svg_content)

sizes = [72, 96, 128, 180, 192, 512, 1024]
for size in sizes:
    png_path = f'/Users/javi/RODEO/frontend/public/icons/icon-{size}.png'
    cairosvg.svg2png(bytestring=svg_content.encode('utf-8'), write_to=png_path, output_width=size, output_height=size)

