from PIL import Image

image_path = r"C:\Users\maria\.gemini\antigravity\brain\941fb00a-6c8e-4bcf-b3f9-dc4b3a22e174\media__1781655266799.png"
img = Image.open(image_path)
width, height = img.size

# Let's inspect colors along some lines to locate elements.
# The top green banner is in the top-middle. Let's sample colors vertically in the middle (x = 512).
# Let's find green pixels. Green color is roughly: R < 50, G > 100, B < 50 or similar.
# Let's look at the exact RGB values.

for y in range(0, height, 5):
    r, g, b, a = img.getpixel((512, y))
    if g > 100 and r < 80 and b < 80:
        print(f"Green at y={y}: RGB=({r},{g},{b})")

print("---")
# Let's sample horizontally at y = 40 (inside the top green banner).
for x in range(0, width, 10):
    r, g, b, a = img.getpixel((x, 40))
    if g > 100 and r < 80 and b < 80:
        print(f"Green at x={x}: RGB=({r},{g},{b})")

print("---")
# Let's find the blue banner (y is probably around 150-180, in the middle). Let's sample at x = 512 vertically around there.
for y in range(120, 200, 2):
    r, g, b, a = img.getpixel((512, y))
    if b > 80 and r < 50 and g < 50:
        print(f"Blue at y={y}: RGB=({r},{g},{b})")

print("---")
# Let's sample the left green box (x around 80, y around 130).
for y in range(80, 200, 5):
    r, g, b, a = img.getpixel((80, y))
    if g > 100 and r < 80 and b < 80:
         print(f"Left green box at y={y}: RGB=({r},{g},{b})")
