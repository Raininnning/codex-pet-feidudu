import unittest
from pathlib import Path
from PIL import Image


def metrics(image):
    alpha = image.getchannel('A')
    bounds = alpha.point(lambda a: 255 if a > 128 else 0).getbbox()
    pixels = list(alpha.get_flattened_data())
    mass = sum(pixels)
    return bounds[3] - bounds[1], (
        sum((i % image.width) * a for i, a in enumerate(pixels)) / mass,
        sum((i // image.width) * a for i, a in enumerate(pixels)) / mass)


class HoverAlignmentTest(unittest.TestCase):
    def test_all_six_source_frames_have_same_size_and_visual_center(self):
        root = Path(__file__).resolve().parents[1] / 'assets/pets'
        for i in range(1, 7):
            with self.subTest(frame=i), Image.open(root / f'kangaroo-hover-{i}.png') as image:
                self.assertEqual(image.size, (1263, 1246))
                height, center = metrics(image)
                self.assertLessEqual(abs(height - 1100), 2)
                self.assertLessEqual(abs(center[0] - 631.5), 1)
                self.assertLessEqual(abs(center[1] - 670), 1)

    def test_native_interaction_centers_match_idle_center(self):
        root = Path(__file__).resolve().parents[1] / 'native-pets'
        for pose in ['feidudu']:
            with Image.open(root / f'{pose}' / 'spritesheet.png') as sheet:
                _, anchor = metrics(sheet.crop((0, 0, 192, 208)))
                for row, count in [(3, 4), (4, 5)]:
                    for col in range(count):
                        with self.subTest(pose=pose, row=row, col=col):
                            height, center = metrics(sheet.crop((col * 192, row * 208, (col + 1) * 192, (row + 1) * 208)))
                            self.assertLessEqual(abs(height - 164), 2)
                            self.assertLessEqual(abs(center[0] - anchor[0]), 0.75)
                            self.assertLessEqual(abs(center[1] - anchor[1]), 0.75)


if __name__ == '__main__':
    unittest.main()
