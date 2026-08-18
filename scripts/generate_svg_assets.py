import os

src_assets_dir = '/Users/abdulbashir/Documents/AdMedika/NahSehat-AdBrief-Dash/src/assets'
public_dir = '/Users/abdulbashir/Documents/AdMedika/NahSehat-AdBrief-Dash/public'

os.makedirs(src_assets_dir, exist_ok=True)
os.makedirs(public_dir, exist_ok=True)

# 1. logo-mark.svg
logo_mark_svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="100%" height="100%">
  <defs>
    <!-- Linear Gradient for A leg -->
    <linearGradient id="blueGrad" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#0052CC"/>
      <stop offset="50%" stop-color="#0066FF"/>
      <stop offset="100%" stop-color="#00C8FF"/>
    </linearGradient>
    
    <!-- Linear Gradient for B loops -->
    <linearGradient id="cyanGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#00D2FF"/>
      <stop offset="60%" stop-color="#00E5D9"/>
      <stop offset="100%" stop-color="#00F0B5"/>
    </linearGradient>

    <!-- Linear Gradient for Bar Chart inside B -->
    <linearGradient id="barGrad" x1="0%" y1="100%" x2="0%" y2="0%">
      <stop offset="0%" stop-color="#0088FF"/>
      <stop offset="100%" stop-color="#00F0B5"/>
    </linearGradient>
  </defs>

  <!-- Main AB Symbol Group -->
  <g transform="translate(10, 10)">
    <!-- A Left Stem & Top Arch -->
    <path d="M 70 420 
             L 160 420 
             L 240 160 
             C 255 110, 275 90, 310 85 
             L 245 85 
             C 210 85, 185 110, 165 160 
             Z" 
          fill="url(#blueGrad)"/>

    <!-- Dynamic A-to-B Outer Loop -->
    <path d="M 175 420 
             L 245 420 
             C 320 420, 370 380, 370 310 
             C 370 260, 340 230, 290 220 
             C 340 210, 360 180, 360 140 
             C 360 80, 310 40, 230 40 
             L 140 210 
             L 195 210 
             C 240 120, 275 90, 305 90 
             C 330 90, 345 105, 345 130 
             C 345 160, 320 185, 260 190 
             L 220 190 
             L 200 240 
             L 270 240 
             C 335 240, 360 270, 360 320 
             C 360 375, 315 405, 230 405 
             L 180 405 Z" 
          fill="url(#cyanGrad)"/>

    <!-- Bar Chart Lines Inside Lower Loop of B -->
    <rect x="250" y="320" width="14" height="60" rx="7" fill="url(#barGrad)"/>
    <rect x="274" y="295" width="14" height="85" rx="7" fill="url(#barGrad)"/>
    <rect x="298" y="270" width="14" height="110" rx="7" fill="url(#barGrad)"/>
    <rect x="322" y="305" width="14" height="75" rx="7" fill="url(#barGrad)"/>
  </g>
</svg>
'''

# 2. logo-horizontal.svg (Dark Navy text for light background)
logo_horizontal_svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 250" width="100%" height="100%">
  <defs>
    <linearGradient id="blueGrad" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#0052CC"/>
      <stop offset="50%" stop-color="#0066FF"/>
      <stop offset="100%" stop-color="#00C8FF"/>
    </linearGradient>
    <linearGradient id="cyanGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#00D2FF"/>
      <stop offset="60%" stop-color="#00E5D9"/>
      <stop offset="100%" stop-color="#00F0B5"/>
    </linearGradient>
    <linearGradient id="barGrad" x1="0%" y1="100%" x2="0%" y2="0%">
      <stop offset="0%" stop-color="#0088FF"/>
      <stop offset="100%" stop-color="#00F0B5"/>
    </linearGradient>
  </defs>

  <!-- AB Symbol -->
  <g transform="translate(20, 20) scale(0.42)">
    <path d="M 70 420 L 160 420 L 240 160 C 255 110, 275 90, 310 85 L 245 85 C 210 85, 185 110, 165 160 Z" fill="url(#blueGrad)"/>
    <path d="M 175 420 L 245 420 C 320 420, 370 380, 370 310 C 370 260, 340 230, 290 220 C 340 210, 360 180, 360 140 C 360 80, 310 40, 230 40 L 140 210 L 195 210 C 240 120, 275 90, 305 90 C 330 90, 345 105, 345 130 C 345 160, 320 185, 260 190 L 220 190 L 200 240 L 270 240 C 335 240, 360 270, 360 320 C 360 375, 315 405, 230 405 L 180 405 Z" fill="url(#cyanGrad)"/>
    <rect x="250" y="320" width="14" height="60" rx="7" fill="url(#barGrad)"/>
    <rect x="274" y="295" width="14" height="85" rx="7" fill="url(#barGrad)"/>
    <rect x="298" y="270" width="14" height="110" rx="7" fill="url(#barGrad)"/>
    <rect x="322" y="305" width="14" height="75" rx="7" fill="url(#barGrad)"/>
  </g>

  <!-- Typography -->
  <text x="240" y="130" font-family="Inter, system-ui, -apple-system, sans-serif" font-weight="800" font-size="95" fill="#0B1F44" letter-spacing="-1">AdBrief</text>
  <text x="245" y="182" font-family="Inter, system-ui, -apple-system, sans-serif" font-weight="500" font-size="34" fill="#64748B" letter-spacing="1">by <tspan font-weight="700" fill="#0B1F44">NahSehat</tspan></text>
</svg>
'''

# 3. logo-horizontal-dark.svg (White text for dark background)
logo_horizontal_dark_svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 250" width="100%" height="100%">
  <defs>
    <linearGradient id="blueGrad" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#0052CC"/>
      <stop offset="50%" stop-color="#0066FF"/>
      <stop offset="100%" stop-color="#00C8FF"/>
    </linearGradient>
    <linearGradient id="cyanGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#00D2FF"/>
      <stop offset="60%" stop-color="#00E5D9"/>
      <stop offset="100%" stop-color="#00F0B5"/>
    </linearGradient>
    <linearGradient id="barGrad" x1="0%" y1="100%" x2="0%" y2="0%">
      <stop offset="0%" stop-color="#0088FF"/>
      <stop offset="100%" stop-color="#00F0B5"/>
    </linearGradient>
  </defs>

  <!-- AB Symbol -->
  <g transform="translate(20, 20) scale(0.42)">
    <path d="M 70 420 L 160 420 L 240 160 C 255 110, 275 90, 310 85 L 245 85 C 210 85, 185 110, 165 160 Z" fill="url(#blueGrad)"/>
    <path d="M 175 420 L 245 420 C 320 420, 370 380, 370 310 C 370 260, 340 230, 290 220 C 340 210, 360 180, 360 140 C 360 80, 310 40, 230 40 L 140 210 L 195 210 C 240 120, 275 90, 305 90 C 330 90, 345 105, 345 130 C 345 160, 320 185, 260 190 L 220 190 L 200 240 L 270 240 C 335 240, 360 270, 360 320 C 360 375, 315 405, 230 405 L 180 405 Z" fill="url(#cyanGrad)"/>
    <rect x="250" y="320" width="14" height="60" rx="7" fill="url(#barGrad)"/>
    <rect x="274" y="295" width="14" height="85" rx="7" fill="url(#barGrad)"/>
    <rect x="298" y="270" width="14" height="110" rx="7" fill="url(#barGrad)"/>
    <rect x="322" y="305" width="14" height="75" rx="7" fill="url(#barGrad)"/>
  </g>

  <!-- Typography -->
  <text x="240" y="130" font-family="Inter, system-ui, -apple-system, sans-serif" font-weight="800" font-size="95" fill="#FFFFFF" letter-spacing="-1">AdBrief</text>
  <text x="245" y="182" font-family="Inter, system-ui, -apple-system, sans-serif" font-weight="500" font-size="34" fill="#94A3B8" letter-spacing="1">by <tspan font-weight="700" fill="#FFFFFF">NahSehat</tspan></text>
</svg>
'''

# 4. adbrief-ai-logo.svg
adbrief_ai_logo_svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 500" width="100%" height="100%">
  <defs>
    <linearGradient id="blueGrad" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#0052CC"/>
      <stop offset="50%" stop-color="#0066FF"/>
      <stop offset="100%" stop-color="#00C8FF"/>
    </linearGradient>
    <linearGradient id="cyanGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#00D2FF"/>
      <stop offset="60%" stop-color="#00E5D9"/>
      <stop offset="100%" stop-color="#00F0B5"/>
    </linearGradient>
    <linearGradient id="barGrad" x1="0%" y1="100%" x2="0%" y2="0%">
      <stop offset="0%" stop-color="#0088FF"/>
      <stop offset="100%" stop-color="#00F0B5"/>
    </linearGradient>
  </defs>

  <g transform="translate(70, 20) scale(0.6)">
    <path d="M 70 420 L 160 420 L 240 160 C 255 110, 275 90, 310 85 L 245 85 C 210 85, 185 110, 165 160 Z" fill="url(#blueGrad)"/>
    <path d="M 175 420 L 245 420 C 320 420, 370 380, 370 310 C 370 260, 340 230, 290 220 C 340 210, 360 180, 360 140 C 360 80, 310 40, 230 40 L 140 210 L 195 210 C 240 120, 275 90, 305 90 C 330 90, 345 105, 345 130 C 345 160, 320 185, 260 190 L 220 190 L 200 240 L 270 240 C 335 240, 360 270, 360 320 C 360 375, 315 405, 230 405 L 180 405 Z" fill="url(#cyanGrad)"/>
    <rect x="250" y="320" width="14" height="60" rx="7" fill="url(#barGrad)"/>
    <rect x="274" y="295" width="14" height="85" rx="7" fill="url(#barGrad)"/>
    <rect x="298" y="270" width="14" height="110" rx="7" fill="url(#barGrad)"/>
    <rect x="322" y="305" width="14" height="75" rx="7" fill="url(#barGrad)"/>
    
    <!-- AI Sparkle Icon Top Right -->
    <path d="M 380 90 Q 410 90 410 60 Q 410 90 440 90 Q 410 90 410 120 Q 410 90 380 90 Z" fill="#00E5D9"/>
  </g>

  <!-- Text -->
  <text x="300" y="360" font-family="Inter, system-ui, -apple-system, sans-serif" font-weight="800" font-size="70" fill="#0B1F44" text-anchor="middle">AdBrief AI</text>
  <text x="300" y="415" font-family="Inter, system-ui, -apple-system, sans-serif" font-weight="500" font-size="28" fill="#64748B" text-anchor="middle">by <tspan font-weight="700" fill="#0B1F44">NahSehat</tspan></text>
</svg>
'''

# Write SVGs to src/assets and public
svg_files = {
    'logo-mark.svg': logo_mark_svg,
    'logo-horizontal.svg': logo_horizontal_svg,
    'logo-horizontal-dark.svg': logo_horizontal_dark_svg,
    'adbrief-ai-logo.svg': adbrief_ai_logo_svg,
}

for name, content in svg_files.items():
    with open(os.path.join(src_assets_dir, name), 'w') as f:
        f.write(content.strip())
    with open(os.path.join(public_dir, name), 'w') as f:
        f.write(content.strip())
    print(f"Generated SVG: {name}")

print("SVG Generation complete!")
