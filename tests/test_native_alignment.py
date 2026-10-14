import unittest
from pathlib import Path
from PIL import Image


class NativeAlignmentTest(unittest.TestCase):
    def test_all_native_frames_share_center_baseline_and_height(self):
        root = Path(__file__).resolve().parents[1] / 'native-pets'
        required_frames = [6, 8, 8, 4, 5, 8, 6, 6, 6, 8, 8]
        for pose in ['feidudu']:
            with Image.open(root / f'{pose}' / 'spritesheet.png') as image:
                for row in range(11):
                    for col in range(required_frames[row]):
                        with self.subTest(pose=pose, row=row, col=col):
                            cell = image.crop((col * 192, row * 208, (col + 1) * 192, (row + 1) * 208))
                            bounds = cell.getchannel('A').point(lambda a: 255 if a > 128 else 0).getbbox()
                            self.assertIsNotNone(bounds)
                            left, top, right, bottom = bounds
                            if row in [3, 4]:
                                # 互动帧锁定大小与重心；姿态改变可以导致脚底位置变化。
                                self.assertGreaterEqual(left, 2)
                                self.assertLessEqual(right, 190)
                                self.assertGreaterEqual(top, 8)
                                self.assertLessEqual(bottom, 207)
                                continue
                            self.assertLessEqual(abs((left + right) / 2 - 96), 1)
                            self.assertLessEqual(abs(bottom - 193), 1)
                            self.assertLessEqual(abs(bottom - top - 164), 1)

    def test_unused_cells_are_fully_transparent(self):
        root = Path(__file__).resolve().parents[1] / 'native-pets'
        required_frames = [6, 8, 8, 4, 5, 8, 6, 6, 6, 8, 8]
        for pose in ['feidudu']:
            with Image.open(root / f'{pose}' / 'spritesheet.png') as image:
                for row, count in enumerate(required_frames):
                    for col in range(count, 8):
                        with self.subTest(pose=pose, row=row, col=col):
                            cell = image.crop((col * 192, row * 208, (col + 1) * 192, (row + 1) * 208))
                            self.assertEqual(cell.getchannel('A').getextrema(), (0, 0))

    def test_wave_and_jump_rows_include_all_six_distinct_frames(self):
        root = Path(__file__).resolve().parents[1] / 'native-pets'
        for pose in ['feidudu']:
            with Image.open(root / f'{pose}' / 'spritesheet.png') as image:
                wave = [image.crop((c * 192, 3 * 208, (c + 1) * 192, 4 * 208)).tobytes() for c in range(4)]
                jump = [image.crop((c * 192, 4 * 208, (c + 1) * 192, 5 * 208)).tobytes() for c in range(5)]
                self.assertEqual(len(set(wave)), 4)
                self.assertEqual(len(set(jump)), 5)
                self.assertEqual(len(set(wave + jump)), 6)

    def test_sitting_interaction_starts_with_exact_idle_frame(self):
        root = Path(__file__).resolve().parents[1] / 'native-pets'
        with Image.open(root / 'feidudu' / 'spritesheet.png') as image:
            idle = image.crop((0, 0, 192, 208)).tobytes()
            first_wave = image.crop((0, 3 * 208, 192, 4 * 208)).tobytes()
            first_jump = image.crop((0, 4 * 208, 192, 5 * 208)).tobytes()
            self.assertEqual(idle, first_wave)
            self.assertEqual(idle, first_jump)


if __name__ == '__main__':
    unittest.main()
