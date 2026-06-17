from PIL import Image
import os

image_path = r"C:\Users\maria\.gemini\antigravity\brain\941fb00a-6c8e-4bcf-b3f9-dc4b3a22e174\media__1781655266799.png"
img = Image.open(image_path)

os.makedirs("scratch", exist_ok=True)

# Crop 1: Top green banner
crop_top = img.crop((320, 5, 700, 75))
crop_top.save("scratch/crop_top.png")

# Crop 2: Left green box
crop_left = img.crop((20, 45, 160, 145))
crop_left.save("scratch/crop_left.png")

# Crop 3: Blue banner
crop_blue = img.crop((340, 140, 690, 175))
crop_blue.save("scratch/crop_blue.png")

print("Cropped images saved in scratch/")
