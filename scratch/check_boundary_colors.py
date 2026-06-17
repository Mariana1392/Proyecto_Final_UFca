from PIL import Image

image_path = r"C:\Users\maria\.gemini\antigravity\brain\941fb00a-6c8e-4bcf-b3f9-dc4b3a22e174\media__1781655266799.png"
img = Image.open(image_path)

print("Colors at x=410:")
for y in range(18, 38):
    print(f"y={y}: {img.getpixel((410, y))}")

print("\nColors at x=655:")
for y in range(18, 38):
    print(f"y={y}: {img.getpixel((655, y))}")
