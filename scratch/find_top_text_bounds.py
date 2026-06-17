from PIL import Image

image_path = r"C:\Users\maria\.gemini\antigravity\brain\941fb00a-6c8e-4bcf-b3f9-dc4b3a22e174\media__1781655266799.png"
img = Image.open(image_path)

# Scan for white pixels in the top banner region: x in [350, 680], y in [10, 65]
whites_x = []
whites_y = []
for y in range(10, 65):
    for x in range(350, 680):
        r, g, b, a = img.getpixel((x, y))
        # White text has a slight shadow but is mostly bright white
        if r > 220 and g > 220 and b > 220:
            whites_x.append(x)
            whites_y.append(y)

if whites_x and whites_y:
    print(f"Top banner text 'OBJETIVOS' bounds:")
    print(f"x = {min(whites_x)} to {max(whites_x)}")
    print(f"y = {min(whites_y)} to {max(whites_y)}")
else:
    print("No white pixels found in the top banner area")
