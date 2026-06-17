from PIL import Image

image_path = r"C:\Users\maria\.gemini\antigravity\brain\941fb00a-6c8e-4bcf-b3f9-dc4b3a22e174\media__1781655266799.png"
img = Image.open(image_path)

# Let's find all pixels in the left box region (x: 26 to 151, y: 48 to 110) that are white/near white (R > 200, G > 200, B > 200).
# We want to identify the bottom-most pixel of the target symbol.
# Since the target symbol is at the top and the text is at the bottom, there will be a clear gap.
for y in range(48, 110):
    whites_in_row = []
    for x in range(26, 151):
        r, g, b, a = img.getpixel((x, y))
        if r > 200 and g > 200 and b > 200:
            whites_in_row.append(x)
    if whites_in_row:
        print(f"y={y}: has {len(whites_in_row)} white pixels (x from {min(whites_in_row)} to {max(whites_in_row)})")
