"""从最终精灵图导出预览；只裁切、编码现有像素，不重新绘制角色。"""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/previews'
STATES = ['idle', 'running-right', 'running-left', 'waving', 'jumping', 'failed', 'waiting', 'running', 'review', 'look-first', 'look-second']
COUNTS = [6, 8, 8, 4, 5, 8, 6, 6, 6, 8, 8]


def gif(frames, output, durations):
    # 白色底仅用于演示；安装用的精灵图仍保留原始 alpha。
    preview = []
    for frame in frames:
        matte = Image.new('RGB', frame.size, 'white')
        matte.paste(frame, mask=frame.getchannel('A'))
        preview.append(matte)
    preview[0].save(output, save_all=True, append_images=preview[1:], duration=durations, loop=0, disposal=2)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    with Image.open(ROOT / 'native-pets/feidudu/spritesheet.png') as atlas:
        atlas = atlas.convert('RGBA')
        all_frames = []
        contact = Image.new('RGB', (1536, 11 * 230), '#fafafa')
        draw = ImageDraw.Draw(contact)
        rows = []
        for row, (state, count) in enumerate(zip(STATES, COUNTS)):
            frames = [atlas.crop((col * 192, row * 208, (col + 1) * 192, (row + 1) * 208)) for col in range(count)]
            rows.append(frames)
            gif(frames, OUT / f'native-{state}.gif', [180] * count)
            all_frames.extend(frames)
            draw.text((8, row * 230 + 4), state, fill='#333333')
            for col, frame in enumerate(frames):
                contact.paste(frame, (col * 192, row * 230 + 22), frame)
        contact.save(OUT / 'native-contact-sheet.png')
        gif(all_frames, OUT / 'native-all-states.gif', [180] * len(all_frames))
        gif(rows[0] + rows[4] + rows[0], OUT / 'native-idle-jump-idle.gif', [180] * (6 + 5 + 6))
    source_frames = [Image.open(ROOT / f'assets/pets/kangaroo-hover-{i}.png').convert('RGBA') for i in range(1, 7)]
    # 演示缩放使用同一画布比例，不按每帧重新裁切，保留已验证的视觉重心。
    source_frames = [frame.resize((316, 312), Image.Resampling.LANCZOS) for frame in source_frames]
    gif(source_frames, OUT / 'hover-six-frames.gif', [180, 180, 180, 240, 300, 320])
    for i in [1, 3, 5, 6]:
        source_frames[i - 1].save(OUT / f'hover-still-{i}.png')
    print('已从最终精灵图导出演示与六帧源动画')


if __name__ == '__main__':
    main()
