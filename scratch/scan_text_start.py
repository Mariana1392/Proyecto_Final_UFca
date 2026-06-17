from PIL import Image

image_path = r"C:\Users\maria\.gemini\antigravity\brain\941fb00a-6c8e-4bcf-b3f9-dc4b3a22e174\media__1781655266799.png"
img = Image.open(image_path)

# Scan column x = 80 for y from 85 to 110.
# White pixels (the text) will have high RGB values.
for y in range(85, 110):
    r, g, b, a = img.getpixel((80, y))
    print(f"y={y}: RGB=({r},{g},{b})")
