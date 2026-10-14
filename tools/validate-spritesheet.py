"""验证发布精灵图的结构和透明格；不宣称视觉语义质量门通过。"""
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
COUNTS = [6, 8, 8, 4, 5, 8, 6, 6, 6, 8, 8]


def main():
    file = ROOT / 'native-pets/feidudu/spritesheet.png'
    encoded = file.read_bytes()
    errors = []
    if not 0 < len(encoded) <= 20 * 1024 * 1024:
        errors.append('编码大小必须为 1 字节至 20 MiB')
    with Image.open(file) as original:
        if original.format != 'PNG' or original.mode != 'RGBA':
            errors.append('需要透明 RGBA PNG')
        image = original.convert('RGBA')
        if image.size != (1536, 2288):
            errors.append('v2 图像必须为 1536 × 2288')
        else:
            for row, count in enumerate(COUNTS):
                for col in range(8):
                    cell = image.crop((col * 192, row * 208, (col + 1) * 192, (row + 1) * 208))
                    alpha = cell.getchannel('A')
                    if col >= count:
                        if alpha.getextrema() != (0, 0):
                            errors.append(f'row={row}, frame={col}: 空白格包含像素')
                    else:
                        if not alpha.point(lambda a: 255 if a > 128 else 0).getbbox():
                            errors.append(f'row={row}, frame={col}: 必需帧没有角色')
                        if any(alpha.getpixel(p) != 0 for p in [(0, 0), (191, 0), (0, 207), (191, 207)]):
                            errors.append(f'row={row}, frame={col}: 角落不透明')
        residue = sum(1 for r, g, b, a in image.get_flattened_data() if a == 0 and (r or g or b))
        if residue:
            errors.append(f'全透明像素有隐藏 RGB 残留: {residue}')
        report = {
            'ok': not errors, 'file': 'spritesheet.png', 'encoded_bytes': len(encoded),
            'sha256': hashlib.sha256(encoded).hexdigest(), 'format': 'PNG', 'mode': 'RGBA',
            'width': image.width, 'height': image.height, 'sprite_version_number': 2,
            'frames_per_row': COUNTS, 'required_frames': sum(COUNTS),
            'transparent_rgb_residue_pixels': residue, 'errors': errors, 'warnings': [],
            'scope': '结构验证；视觉重心与尺寸另由 test_hover_alignment.py 检查；不覆盖方向及动作语义'
        }
    (file.parent / 'validation.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'ok': report['ok'], 'sha256': report['sha256'], 'errors': errors}, ensure_ascii=False))
    if errors:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
