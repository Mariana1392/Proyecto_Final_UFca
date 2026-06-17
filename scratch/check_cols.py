from PIL import Image

image_path = r"C:\Users\maria\.gemini\antigravity\brain\941fb00a-6c8e-4bcf-b3f9-dc4b3a22e174\media__1781655266799.png"
img = Image.open(image_path)

# Let's count white pixels for each column in y: 20 to 58, x: 320 to 700
col_counts = {}
for x in range(320, 700):
    count = 0
    for y in range(28, 44):
        r, g, b, a = img.getpixel((x, y))
        if r > 200 and g > 200 and b > 200:
            count += 1
    if count > 0:
        col_counts[x] = count

columns_with_white = sorted(col_counts.keys())
if columns_with_white:
    print(f"White columns range: {columns_with_white[0]} to {columns_with_white[-1]}")
    # Let's print some samples to see where the continuous blocks of text are
    # We can group columns that are close to each other
    gaps = []
    for i in range(len(columns_with_white) - 1):
        if columns_with_white[i+1] - columns_with_white[i] > 5:
            gaps.append((columns_with_white[i], columns_with_white[i+1]))
    print(f"Gaps in white columns: {gaps}")
else:
    print("No white columns found")
