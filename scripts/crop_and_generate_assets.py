import os
from PIL import Image

image_path = '/Users/abdulbashir/.gemini/antigravity-ide/brain/69f75ffd-c4c9-408c-b459-d7bc0d2f2c6e/media__1786346984385.jpg'
src_assets_dir = '/Users/abdulbashir/Documents/AdMedika/NahSehat-AdBrief-Dash/src/assets'
public_dir = '/Users/abdulbashir/Documents/AdMedika/NahSehat-AdBrief-Dash/public'

os.makedirs(src_assets_dir, exist_ok=True)
os.makedirs(public_dir, exist_ok=True)

img = Image.open(image_path)
width, height = img.size

# Dictionary of assets to crop: name -> (left, top, right, bottom)
crops = {
    # Logo Variations
    'logo-mark-large.png': (10, 5, 205, 125),
    'logo-horizontal-dark-header.png': (215, 15, 520, 115),
    'banner-top-dark.png': (545, 5, 995, 130),

    # Favicons & Icons
    'favicon-light-512.png': (24, 168, 106, 248),
    'favicon-dark-192.png': (125, 168, 207, 248),
    'favicon-dark-32.png': (228, 194, 271, 237),
    'favicon-dark-16.png': (286, 206, 320, 238),

    # Logo Variations Card Crops
    'logo-horizontal-light.png': (350, 165, 510, 245),
    'logo-vertical-light.png': (520, 160, 615, 255),
    'logo-symbol-only.png': (630, 165, 690, 240),
    'brand-colors.png': (708, 142, 988, 270),

    # UI Previews
    'sidebar-header-expanded.png': (10, 280, 192, 580),
    'sidebar-header-collapsed.png': (198, 280, 282, 580),
    'page-login-full.png': (290, 280, 988, 580),
    'page-login-hero-card.png': (292, 290, 715, 580),
    'page-login-form-card.png': (715, 290, 985, 580),

    # Backgrounds
    'bg-login.png': (10, 588, 493, 740),
    'bg-dashboard-light.png': (507, 588, 988, 740),

    # Bottom Row Cards
    'adbrief-ai-logo.png': (10, 745, 150, 890),
    'loading-frame-1.png': (160, 765, 238, 865),
    'loading-frame-2.png': (250, 765, 328, 865),
    'loading-frame-3.png': (340, 765, 418, 865),
    'insight-recommendation-card.png': (435, 745, 626, 890),
    'empty-state-card.png': (635, 745, 798, 890),
    'mobile-app-icon-light.png': (810, 770, 890, 850),
    'mobile-app-icon-dark.png': (900, 770, 980, 850),

    # Footer Banner
    'banner-footer-hero.png': (10, 898, 988, 998),
}

for name, box in crops.items():
    cropped = img.crop(box)
    target_path = os.path.join(src_assets_dir, name)
    cropped.save(target_path)
    print(f"Saved: {name} -> {box}")

    # Also copy main logos/backgrounds to public directory for easy static imports
    if name in ['logo-mark-large.png', 'logo-horizontal-light.png', 'bg-login.png', 'bg-dashboard-light.png', 'favicon-dark-192.png']:
        pub_target = os.path.join(public_dir, name)
        cropped.save(pub_target)
        print(f"Copied to public: {name}")

print("Cropping complete!")
