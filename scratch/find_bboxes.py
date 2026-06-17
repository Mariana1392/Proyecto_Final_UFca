from PIL import Image

image_path = r"C:\Users\maria\.gemini\antigravity\brain\941fb00a-6c8e-4bcf-b3f9-dc4b3a22e174\media__1781655266799.png"
img = Image.open(image_path)
width, height = img.size

# Helper to check if a pixel is green (top banner and left box)
def is_green(r, g, b):
    # Green in this image is typically: G is highest, G > R + 30, G > B + 30
    return g > r + 30 and g > b + 30 and g > 60

# Helper to check if a pixel is dark blue (specific objectives banner)
def is_dark_blue(r, g, b):
    # Dark blue: B is highest, B > 50, R < 40, G < 45
    return b > g + 30 and b > r + 30 and b > 40 and r < 40 and g < 45

# 1. Bounding box of the top green banner
# We know it contains (512, 25). Let's scan outward.
top_banner_pixels = []
for y in range(0, 70):
    for x in range(250, 780):
        r, g, b, a = img.getpixel((x, y))
        if is_green(r, g, b):
            top_banner_pixels.append((x, y))

if top_banner_pixels:
    x_min = min(p[0] for p in top_banner_pixels)
    x_max = max(p[0] for p in top_banner_pixels)
    y_min = min(p[1] for p in top_banner_pixels)
    y_max = max(p[1] for p in top_banner_pixels)
    print(f"Top Green Banner bounding box: x={x_min} to {x_max}, y={y_min} to {y_max}")

# 2. Bounding box of the left green box
# It contains (80, 100). Let's scan in x in [10, 180], y in [45, 145]
left_box_pixels = []
for y in range(45, 145):
    for x in range(10, 180):
        r, g, b, a = img.getpixel((x, y))
        if is_green(r, g, b):
            left_box_pixels.append((x, y))

if left_box_pixels:
    x_min = min(p[0] for p in left_box_pixels)
    x_max = max(p[0] for p in left_box_pixels)
    y_min = min(p[1] for p in left_box_pixels)
    y_max = max(p[1] for p in left_box_pixels)
    print(f"Left Green Box bounding box: x={x_min} to {x_max}, y={y_min} to {y_max}")

# 3. Bounding box of the blue banner
# It contains (512, 155). Let's scan in x in [300, 700], y in [130, 180]
blue_banner_pixels = []
for y in range(130, 180):
    for x in range(300, 700):
        r, g, b, a = img.getpixel((x, y))
        if is_dark_blue(r, g, b):
            blue_banner_pixels.append((x, y))

if blue_banner_pixels:
    x_min = min(p[0] for p in blue_banner_pixels)
    x_max = max(p[0] for p in blue_banner_pixels)
    y_min = min(p[1] for p in blue_banner_pixels)
    y_max = max(p[1] for p in blue_banner_pixels)
    print(f"Blue Banner bounding box: x={x_min} to {x_max}, y={y_min} to {y_max}")
