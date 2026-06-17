from PIL import Image

image_path = r"C:\Users\maria\.gemini\antigravity\brain\941fb00a-6c8e-4bcf-b3f9-dc4b3a22e174\media__1781655266799.png"
img = Image.open(image_path)

# Erase the word "OBJETIVOS" inside the green banner
# Range: x = 375 to 655, y = 18 to 38.
# We will interpolate horizontally from x = 370 to x = 660
for y in range(18, 39):
    c_left = img.getpixel((370, y))
    c_right = img.getpixel((660, y))
    for x in range(371, 660):
        t = (x - 370) / (660 - 370)
        r = int(c_left[0] * (1 - t) + c_right[0] * t)
        g = int(c_left[1] * (1 - t) + c_right[1] * t)
        b = int(c_left[2] * (1 - t) + c_right[2] * t)
        a = int(c_left[3] * (1 - t) + c_right[3] * t) if len(c_left) > 3 else 255
        img.putpixel((x, y), (r, g, b, a))

# Save the cropped region to check
crop_top_erased = img.crop((320, 5, 700, 75))
crop_top_erased.save("scratch/crop_top_erased.png")
print("Saved crop_top_erased.png")
