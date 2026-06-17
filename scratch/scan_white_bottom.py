from PIL import Image

image_path = r"C:\Users\maria\.gemini\antigravity\brain\941fb00a-6c8e-4bcf-b3f9-dc4b3a22e174\media__1781655266799.png"
img = Image.open(image_path)

# Scan y from 110 to 140 for white pixels in the left box region (x: 26 to 151)
for y in range(110, 140):
    whites_in_row = []
    for x in range(26, 151):
        r, g, b, a = img.getpixel((x, y))
        if r > 200 and g > 200 and b > 200:
            whites_in_row.append(x)
    if whites_in_row:
        print(f"y={y}: has {len(whites_in_row)} white pixels (x from {min(whites_in_row)} to {max(whites_in_row)})")
