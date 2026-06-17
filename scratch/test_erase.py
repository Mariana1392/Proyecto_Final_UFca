from PIL import Image

image_path = r"C:\Users\maria\.gemini\antigravity\brain\941fb00a-6c8e-4bcf-b3f9-dc4b3a22e174\media__1781655266799.png"
img = Image.open(image_path)

# Let's erase the text "OBJETIVO GENERAL" by horizontal interpolation.
# The text is roughly in x = 32 to 145, y = 94 to 134.
for y in range(94, 135):
    c_left = img.getpixel((31, y))
    c_right = img.getpixel((146, y))
    for x in range(32, 146):
        t = (x - 31) / (146 - 31)
        r = int(c_left[0] * (1 - t) + c_right[0] * t)
        g = int(c_left[1] * (1 - t) + c_right[1] * t)
        b = int(c_left[2] * (1 - t) + c_right[2] * t)
        a = int(c_left[3] * (1 - t) + c_right[3] * t) if len(c_left) > 3 else 255
        img.putpixel((x, y), (r, g, b, a))

# Save the cropped region to check
crop_left_erased = img.crop((20, 45, 160, 145))
crop_left_erased.save("scratch/crop_left_erased.png")
print("Saved crop_left_erased.png")
