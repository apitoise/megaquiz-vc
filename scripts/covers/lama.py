"""Reconstitution d'image (inpainting) avec LaMa, modèle TorchScript « big-lama ».

Repris de simple-lama-inpainting (Apache-2.0, d'après advimman/lama), sans ses dépendances figées
(Pillow < 10, numpy < 2) incompatibles avec Python 3.12.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import torch
from PIL import Image

MODEL_URL = "https://github.com/enesmsahin/simple-lama-inpainting/releases/download/v0.1.0/big-lama.pt"
MODEL_PATH = Path(__file__).resolve().parents[2] / ".cache" / "models" / "big-lama.pt"


def _to_chw(array: np.ndarray) -> np.ndarray:
    array = array[np.newaxis, ...] if array.ndim == 2 else np.transpose(array, (2, 0, 1))
    return array.astype(np.float32) / 255


def _pad(array: np.ndarray, mod: int = 8) -> np.ndarray:
    _, h, w = array.shape
    return np.pad(array, ((0, 0), (0, -h % mod), (0, -w % mod)), mode="symmetric")


class Lama:
    def __init__(self, device: torch.device | None = None) -> None:
        self.device = device or torch.device("cuda" if torch.cuda.is_available() else "cpu")
        if not MODEL_PATH.exists():
            MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
            torch.hub.download_url_to_file(MODEL_URL, str(MODEL_PATH), progress=True)
        self.model = torch.jit.load(str(MODEL_PATH), map_location=self.device).eval()

    def __call__(self, image: Image.Image, mask: Image.Image) -> Image.Image:
        """Remplit les zones blanches du masque ; renvoie une image de même taille."""
        width, height = image.size
        img = torch.from_numpy(_pad(_to_chw(np.array(image.convert("RGB"))))).unsqueeze(0).to(self.device)
        msk = torch.from_numpy(_pad(_to_chw(np.array(mask.convert("L"))))).unsqueeze(0).to(self.device)
        with torch.inference_mode():
            out = self.model(img, (msk > 0).float())[0].permute(1, 2, 0).cpu().numpy()
        return Image.fromarray(np.clip(out * 255, 0, 255).astype(np.uint8)).crop((0, 0, width, height))
