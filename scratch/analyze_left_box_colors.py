from PIL import Image

image_path = r"C:\Users\maria\.gemini\antigravity\brain\941fb00a-6c8e-4bcf-b3f9-dc4b3a22e174\media__1781655266799.png"
img = Image.open(image_path)

# Bounding box of the left green box: x = 26 to 151, y = 48 to 139.
# Let's inspect colors along x = 32 (near the left edge of the box) for y in [48, 139]
print("Left edge colors:")
for y in range(48, 140, 10):
    r, g, b, a = img.getpixel((32, y))
    print(f"y={y}: RGB=({r},{g},{b})")

print("\nRight edge colors:")
# Let's inspect colors along x = 145 (near the right edge of the box) for y in [48, 139]
for y in range(48, 140, 10):
    r, g, b, a = img.getpixel((145, y))
    print(f"y={y}: RGB=({r},{g},{b})")

print("\nMiddle column colors (near bottom edge, below text):")
# Let's inspect colors along y = 136 (near the bottom edge of the box) for x in [26, 151]
for x in range(30, 150, 15):
    r, g, b, a = img.getpixel((x, 136))
    print(f"x={x}: RGB=({r},{g},{b})")
