from PIL import Image

image_path = r"C:\Users\maria\.gemini\antigravity\brain\941fb00a-6c8e-4bcf-b3f9-dc4b3a22e174\media__1781655266799.png"
img = Image.open(image_path)

# Let's print a grid of the white pixels in x: 400 to 620, y: 15 to 55 (sampled every 2 pixels)
for y in range(15, 56, 2):
    row_chars = []
    for x in range(400, 621, 3):
        r, g, b, a = img.getpixel((x, y))
        # Use # for white/near-white, . for background
        if r > 200 and g > 200 and b > 200:
            row_chars.append("#")
        else:
            row_chars.append(".")
    print(f"y={y:02d}: " + "".join(row_chars))
