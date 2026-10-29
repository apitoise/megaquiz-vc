"""Anonymise les jaquettes de jeux : repère le texte (EasyOCR), le masque, reconstitue le décor (LaMa).

Usage (depuis la racine du projet, après `npm run covers:setup`) :
    npm run covers:anonymize                 # toutes les jaquettes (reprend où il en était)
    npm run covers:anonymize -- --limit 20   # essai sur 20 jaquettes
    npm run covers:anonymize -- --force      # tout refaire

Entrée : data/games.json. Sorties (hors git) : public/covers/<image_id>.jpg et public/covers/manifest.json.
Tout tourne en local (GPU si disponible) ; seules les jaquettes originales sont téléchargées depuis IGDB.

Chaque jaquette est classée « sure » (le nom du jeu a été lu puis effacé) ou « a-verifier » (nom non
repéré, encore lisible, ou grande zone effacée) : ces dernières ne sont posées en partie qu'une fois
validées dans l'écran « Relire les jaquettes ».
"""

from __future__ import annotations

import argparse
import difflib
import json
import re
import time
import unicodedata
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
GAMES = ROOT / "data" / "games.json"
CACHE = ROOT / ".cache" / "covers"
OUT = ROOT / "public" / "covers"
MANIFEST = OUT / "manifest.json"
COVER_URL = "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/{}.jpg"

# Une zone de texte est élargie de cette fraction de sa hauteur (+ quelques pixels) avant d'être effacée.
DILATE_RATIO = 0.3
DILATE_MIN_PX = 6
# Au-delà de cette part de l'image effacée, le résultat risque d'être flou : à vérifier à l'œil.
LARGE_MASK_RATIO = 0.35
# Confiance minimale d'une zone de texte (EasyOCR) pour être effacée.
MIN_CONFIDENCE = 0.05
# Passages maximum. Le premier efface tout le texte lu ; les suivants seulement les mots du titre
# encore lisibles (effacer davantage fait déborder le masque sur le dessin — essayé).
MAX_PASSES = 3
# Ressemblance minimale d'un mot lu avec un mot du titre (l'OCR lit approximativement les logos) ;
# plus tolérante pour la vérification finale (« RFD DFAN » laissé à la place de « RED DEAD »).
TITLE_MATCH = 0.7
RESIDUAL_MATCH = 0.6
STOPWORDS = {"the", "of", "and", "a", "an", "le", "la", "les", "de", "des", "du", "edition"}


def normalize(text: str) -> str:
    text = unicodedata.normalize("NFD", text)
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def title_tokens(name: str) -> list[str]:
    """Mots distinctifs du nom du jeu (« The Witcher 3: Wild Hunt » → witcher, wild, hunt)."""
    return [w for w in normalize(name).split() if len(w) >= 3 and w not in STOPWORDS]


def title_hits(name: str, texts: list[str], threshold: float = TITLE_MATCH) -> list[str]:
    """Mots du nom du jeu retrouvés (même approximativement) dans le texte lu sur l'image."""
    words = [w for t in texts for w in normalize(t).split()]
    joined = " ".join(normalize(t) for t in texts)
    return [
        token
        for token in title_tokens(name)
        if token in joined or any(difflib.SequenceMatcher(None, token, w).ratio() >= threshold for w in words)
    ]


def box_center(box) -> tuple[int, int]:
    xs = [float(x) for x, _y in box]
    ys = [float(y) for _x, y in box]
    return int(sum(xs) / len(xs)), int(sum(ys) / len(ys))


def inside(mask: np.ndarray, point: tuple[int, int]) -> bool:
    x, y = point
    return 0 <= y < mask.shape[0] and 0 <= x < mask.shape[1] and bool(mask[y, x])


def download(image_id: str) -> Path:
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / f"{image_id}.jpg"
    if not path.exists():
        time.sleep(0.1)  # rester discret avec le CDN d'IGDB
        with urllib.request.urlopen(COVER_URL.format(image_id), timeout=20) as r:
            path.write_bytes(r.read())
    return path


def text_mask(size: tuple[int, int], detections) -> Image.Image:
    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)
    for box, _text, _confidence in detections:
        xs = [float(x) for x, _y in box]
        ys = [float(y) for _x, y in box]
        pad = max(DILATE_MIN_PX, (max(ys) - min(ys)) * DILATE_RATIO)
        draw.rectangle([min(xs) - pad, min(ys) - pad, max(xs) + pad, max(ys) + pad], fill=255)
    return mask.filter(ImageFilter.MaxFilter(5))


def read_text(reader, image: Image.Image):
    return [d for d in reader.readtext(np.array(image), detail=1, paragraph=False) if d[2] >= MIN_CONFIDENCE]


def process(game: dict, reader, lama) -> dict:
    name, image_id = game["name"], game["cover"]
    image = Image.open(download(image_id)).convert("RGB")
    total_mask = np.zeros((image.height, image.width), dtype=bool)

    detections = read_text(reader, image)
    found = [t for _b, t, _c in detections]
    first_hits = title_hits(name, found)
    for _ in range(MAX_PASSES):
        if not detections:
            break
        mask = text_mask(image.size, detections)
        total_mask |= np.array(mask) > 0
        image = lama(image, mask)
        detections = [d for d in read_text(reader, image) if title_hits(name, [d[1]])]

    # Vérification finale : un mot du titre encore reconnaissable, ou du texte lisible là où on a effacé.
    leftovers = read_text(reader, image)
    residual = title_hits(name, [t for _b, t, _c in leftovers], RESIDUAL_MATCH)
    residual += [t for b, t, _c in leftovers if len(normalize(t)) >= 3 and inside(total_mask, box_center(b))]

    ratio = float(total_mask.mean())
    flags = []
    if not first_hits:
        flags.append("titre-non-detecte")
    if residual:
        flags.append("titre-residuel")
    if ratio > LARGE_MASK_RATIO:
        flags.append("masque-large")

    anonymized = bool(total_mask.any())
    if anonymized:
        OUT.mkdir(parents=True, exist_ok=True)
        image.save(OUT / f"{image_id}.jpg", quality=88)
    return {
        "game": name,
        "gameId": game["id"],
        "status": "a-verifier" if flags else "sure",
        "flags": flags,
        "anonymized": anonymized,
        "maskRatio": round(ratio, 3),
        "titleHits": first_hits,
        "text": found[:12],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--limit", type=int, help="ne traiter que les N premières jaquettes")
    parser.add_argument("--force", action="store_true", help="retraiter les jaquettes déjà faites")
    args = parser.parse_args()

    import easyocr  # imports lourds : seulement une fois les arguments validés
    import torch
    from lama import Lama

    gpu = torch.cuda.is_available()
    print(f"GPU : {torch.cuda.get_device_name(0) if gpu else 'non (CPU, plus lent)'}")
    reader = easyocr.Reader(["en", "fr"], gpu=gpu, verbose=False)
    lama = Lama()

    games = [g for g in json.loads(GAMES.read_text()) if g.get("cover")]
    if args.limit:
        games = games[: args.limit]
    manifest = json.loads(MANIFEST.read_text()) if MANIFEST.exists() and not args.force else {}

    start = time.time()
    for i, game in enumerate(games, 1):
        if game["cover"] in manifest:
            continue
        try:
            manifest[game["cover"]] = process(game, reader, lama)
        except Exception as err:  # une jaquette en échec ne doit pas arrêter le lot
            print(f"  échec {game['name']} : {err}")
            continue
        entry = manifest[game["cover"]]
        print(f"[{i}/{len(games)}] {entry['status']:<10} {game['name']} {' '.join(entry['flags'])}")
        if i % 20 == 0:
            MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=1))
    OUT.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=1))

    entries = list(manifest.values())
    sure = sum(e["status"] == "sure" for e in entries)
    print(f"\n{len(entries)} jaquettes en {time.time() - start:.0f} s : {sure} sûres, {len(entries) - sure} à vérifier")
    for flag in ("titre-non-detecte", "titre-residuel", "masque-large"):
        print(f"  {flag} : {sum(flag in e['flags'] for e in entries)}")


if __name__ == "__main__":
    main()
