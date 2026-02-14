#!/usr/bin/env python3
"""
生成简单的 PNG 图标用于插件测试
需要安装 Pillow: pip install Pillow
"""
from PIL import Image, ImageDraw, ImageFont
def create_icon(size, output_path):
    # 创建白色背景
    img = Image.new('RGBA', (size, size), (255, 255, 255, 0))
    draw = ImageDraw.Draw(img)
    
    # 绘制渐变背景（蓝色）
    for i in range(size):
        ratio = i / size
        r = int(0 + (0 - 0) * ratio)
        g = int(120 + (190 - 120) * ratio)
        b = int(212 + (203 - 212) * ratio)
        draw.rectangle([(0, i), (size, i+1)], fill=(r, g, b, 255))
    
    # 绘制 PDF 文字
    try:
        # 尝试使用系统字体
        font_size = max(size // 4, 12)
        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", font_size)
    except:
        font = ImageFont.load_default()
    
    text = "PDF"
    # 获取文字尺寸
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    
    x = (size - text_width) // 2
    y = (size - text_height) // 2 - bbox[1]
    
    # 绘制白色文字
    draw.text((x, y), text, font=font, fill=(255, 255, 255, 255))
    
    # 保存
    img.save(output_path, 'PNG')
    print(f"Created: {output_path}")

if __name__ == '__main__':
    import os
    
    # 获取当前目录
    current_dir = os.path.dirname(os.path.abspath(__file__))
    
    # 生成不同尺寸的图标
    sizes = [16, 32, 48, 128]
    for size in sizes:
        output_path = os.path.join(current_dir, f"icon{size}.png")
        create_icon(size, output_path)
    
    print("All icons generated successfully!")
