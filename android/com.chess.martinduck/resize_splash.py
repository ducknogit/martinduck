from PIL import Image
import os

# Source icon
icon_path = r'c:\Users\Admin\Desktop\chess\android\com.chess.martinduck\www\icon.jpg'
img = Image.open(icon_path).convert('RGBA')

# Target sizes for different screen densities
sizes = {
    'drawable-mdpi': 48,
    'drawable-hdpi': 72,
    'drawable-xhdpi': 96,
    'drawable-xxhdpi': 144,
}

base = r'c:\Users\Admin\Desktop\chess\android\com.chess.martinduck\platforms\android\app\src\main\res'

for folder, size in sizes.items():
    target_dir = os.path.join(base, folder)
    if not os.path.exists(target_dir):
        os.makedirs(target_dir)
    
    resized = img.resize((size, size), Image.Resampling.LANCZOS)
    output_path = os.path.join(target_dir, 'ic_cdv_splashscreen.png')
    resized.save(output_path, 'PNG')
    print(f'Saved: {output_path}')

print('Done!')
