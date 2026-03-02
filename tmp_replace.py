import os

directory = 'src'
for root, _, files in os.walk(directory):
    for file in files:
        if file.endswith(('.css', '.tsx', '.ts')):
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
            if 'Playfair' in content:
                content = content.replace("'Playfair Display', serif", "'Outfit', sans-serif")
                content = content.replace("\"Playfair Display\", serif", "\"Outfit\", sans-serif")
                content = content.replace("'Playfair Display'", "'Outfit'")
                content = content.replace("Playfair+Display", "Outfit")
                with open(path, 'w', encoding='utf-8', newline='') as f:
                    f.write(content)
                print("Updated " + path)
