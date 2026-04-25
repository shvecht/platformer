from pathlib import Path

import cv2
import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "daniel-idle-sheet.png"

POSES = {
    "daniel-idle-cutout.png": {
        "crop": (292, 48, 674, 850),
        "rect_inset": (25, 8, 55, 28),
        "iterations": 10,
    },
    "daniel-pose-look.png": {
        "crop": (54, 902, 209, 1265),
        "rect_inset": (18, 16, 16, 16),
        "iterations": 8,
    },
    "daniel-pose-front.png": {
        "crop": (247, 908, 399, 1262),
        "rect_inset": (18, 14, 18, 16),
        "iterations": 8,
    },
    "daniel-pose-three-quarter.png": {
        "crop": (470, 905, 625, 1263),
        "rect_inset": (18, 16, 14, 16),
        "iterations": 8,
    },
    "daniel-pose-side.png": {
        "crop": (622, 905, 764, 1262),
        "rect_inset": (15, 16, 13, 16),
        "iterations": 8,
    },
    "daniel-pose-back.png": {
        "crop": (787, 904, 931, 1264),
        "rect_inset": (16, 16, 15, 16),
        "iterations": 8,
    },
    "daniel-pose-back-three-quarter.png": {
        "crop": (983, 902, 1120, 1264),
        "rect_inset": (15, 16, 14, 16),
        "iterations": 8,
    },
}


def feather_alpha(mask: np.ndarray) -> np.ndarray:
    mask = (mask * 255).astype(np.uint8)
    kernel = np.ones((5, 5), np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=2)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel, iterations=1)

    components, labels, stats, _ = cv2.connectedComponentsWithStats(mask, 8)
    if components > 1:
        largest = 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])
        mask = np.where(labels == largest, 255, 0).astype(np.uint8)

    soft = cv2.GaussianBlur(mask, (0, 0), 1.25)
    return soft


def extract_pose(source: Image.Image, filename: str, crop_box: tuple[int, int, int, int], rect_inset: tuple[int, int, int, int], iterations: int) -> None:
    crop = source.crop(crop_box)
    rgb = np.array(crop.convert("RGB"))
    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    h, w = rgb.shape[:2]

    mask = np.zeros((h, w), np.uint8)
    left, top, right, bottom = rect_inset
    rect = (left, top, w - left - right, h - top - bottom)
    bg_model = np.zeros((1, 65), np.float64)
    fg_model = np.zeros((1, 65), np.float64)
    cv2.grabCut(bgr, mask, rect, bg_model, fg_model, iterations, cv2.GC_INIT_WITH_RECT)

    matte = np.where(
        (mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD),
        1,
        0,
    ).astype(np.uint8)

    alpha = feather_alpha(matte)

    rgba = np.dstack([rgb, alpha])
    ys, xs = np.where(alpha > 10)
    x0, x1 = xs.min(), xs.max()
    y0, y1 = ys.min(), ys.max()
    trimmed = rgba[max(y0 - 10, 0) : min(y1 + 11, h), max(x0 - 10, 0) : min(x1 + 11, w)]

    out = ROOT / "assets" / filename
    Image.fromarray(trimmed).save(out)
    print(f"Wrote {out} ({trimmed.shape[1]}x{trimmed.shape[0]})")


def main() -> None:
    source = Image.open(SOURCE).convert("RGBA")
    for filename, config in POSES.items():
        extract_pose(
            source,
            filename,
            config["crop"],
            config["rect_inset"],
            config["iterations"],
        )


if __name__ == "__main__":
    main()
