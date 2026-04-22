"""
RAHAT-ONE Fraud Detection Modal Service

Full 5-layer fraud detection pipeline:
- Layer 1: MD5 Hash (0.35) â€” exact duplicate detection
- Layer 2: pHash (0.20) â€” perceptual similarity via DCT
- Layer 3: CLIP ViT-B-32 (0.25) â€” visual embedding similarity
- Layer 4: Florence-2-large (0.10) â€” VLM forgery keyword scan
- Layer 5: Anomaly Detection (0.10) â€” Z-score vs employee history

CLIP and Florence-2 run on GPU containers (T4).
MD5, pHash, anomaly, and aggregation run in the web endpoint container (CPU).

Author: RAHAT-ONE Team
"""

import base64
import hashlib
import io
import math
import re
from typing import Dict, List, Optional, cast

import modal

# ===== MODAL APP CONFIGURATION =====
app = modal.App("rahat-fraud-detection")

# ===== CONTAINER IMAGES =====

# CLIP Image: Lightweight dependencies for embedding generation
clip_image = modal.Image.debian_slim(python_version="3.11").pip_install(
    "torch",
    "torchvision",
    "open-clip-torch",
    "Pillow",
)

# Font consistency image: OCR + typographic analysis for tamper detection.
semantic_image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "torch",
        "torchvision",
        "pytesseract",
        "opencv-python-headless",
        "numpy",
        "Pillow",
    )
    .apt_install("tesseract-ocr")
)


# ===== CLIP EMBEDDING FUNCTION =====


@app.function(
    gpu="T4",
    image=clip_image,
    timeout=300,
    secrets=[],  # Add secrets here if needed
)
def generate_clip_embedding(image_bytes: bytes) -> List[float]:
    """
    Generate CLIP visual embedding for invoice image.

    Args:
        image_bytes: Raw image bytes (JPEG, PNG, etc.)

    Returns:
        List of 512 floats representing the image embedding

    Processing time: ~2-3 seconds on T4 GPU
    Use case: Compare with past embeddings to detect duplicate/rescanned receipts
    """
    import open_clip
    import torch
    from PIL import Image

    print(f"[CLIP] Loading model...")

    # Load CLIP model (cached after first run)
    model, _, preprocess = open_clip.create_model_and_transforms(
        "ViT-B-32", pretrained="openai"
    )
    model.eval()

    # Move to GPU if available
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model = model.to(device)

    print(f"[CLIP] Processing image on {device}...")

    # Load and preprocess image
    image = Image.open(io.BytesIO(image_bytes))

    # Convert to RGB if needed (handles PNG transparency, etc.)
    if image.mode != "RGB":
        image = image.convert("RGB")

    # Preprocess and move to device
    image_tensor = preprocess(image).unsqueeze(0).to(device)

    # Generate embedding
    with torch.no_grad():
        embedding = model.encode_image(image_tensor)

    # Convert to list and normalize
    embedding_list = embedding.squeeze().cpu().tolist()

    print(f"[CLIP] Generated embedding: {len(embedding_list)} dimensions")

    return cast(List[float], embedding_list)


# ===== LAYER 4: FONT CONSISTENCY VERIFIER =====


@app.function(
    gpu="T4",
    image=semantic_image,
    timeout=600,
    secrets=[],
)
def detect_forgery_florence(
    image_bytes: bytes, claimed_amount: Optional[float] = None
) -> Dict:
    """
    Analyze invoice tampering with typographic consistency checks.

    Args:
        image_bytes: Raw image bytes
        claimed_amount: Expense amount claimed by employee (for OCR cross-check)

    Returns:
        Dict containing:
            - font_consistency_score (float): 0.0-1.0 based on font consistency
            - flagged_regions (list): Regions with typographic anomalies
            - is_suspicious (bool): Whether typographic anomalies were detected

    Processing time: ~3-6 seconds on T4 GPU
    Use case: Detect inconsistent font rendering, pasted totals, edited numeric fields
    """
    import numpy as np
    import pytesseract
    import torch
    from PIL import Image

    print("[L4-FONT] Loading font consistency verifier...")

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"[L4-FONT] Analyzing document on {device}...")

    # Load image
    image = Image.open(io.BytesIO(image_bytes))
    if image.mode != "RGB":
        image = image.convert("RGB")

    def _to_builtin(value):
        """Convert numpy scalars/arrays and nested containers to JSON-safe Python types."""
        if isinstance(value, np.generic):
            return value.item()
        if isinstance(value, np.ndarray):
            return [_to_builtin(v) for v in value.tolist()]
        if isinstance(value, dict):
            return {k: _to_builtin(v) for k, v in value.items()}
        if isinstance(value, (list, tuple)):
            return [_to_builtin(v) for v in value]
        return value

    def _build_box_from_tesseract_item(item):
        x, y, w, h = int(item[6]), int(item[7]), int(item[8]), int(item[9])
        return {
            "left": x,
            "top": y,
            "width": max(w, 0),
            "height": max(h, 0),
            "right": x + max(w, 0),
            "bottom": y + max(h, 0),
            "cx": x + max(w, 0) / 2.0,
            "cy": y + max(h, 0) / 2.0,
        }

    def _stroke_width_features(binary_region):
        if binary_region.size == 0:
            return None
        foreground = binary_region == 0
        if not foreground.any():
            return None
        try:
            import cv2

            dist = cv2.distanceTransform(foreground.astype(np.uint8), cv2.DIST_L2, 5)
        except Exception:
            return None
        stroke_values = dist[foreground]
        if stroke_values.size == 0:
            return None
        return {
            "stroke_width": float(np.mean(stroke_values) * 2.0),
            "stroke_std": float(np.std(stroke_values) * 2.0),
            "pixel_density": float(np.mean(foreground)),
        }

    def _extract_numeric_region_features(image_array, ocr_data):
        numeric_rows = []
        for item in ocr_data:
            text = str(item[11] or "").strip()
            confidence = float(item[10]) if len(item) > 10 else 0.0
            if not text:
                continue
            normalized = text.replace(" ", "")
            if not re.fullmatch(r"[0-9,./:-]+", normalized):
                continue
            if confidence < 30:
                continue

            box = _build_box_from_tesseract_item(item)
            padding = 2
            left = max(box["left"] - padding, 0)
            top = max(box["top"] - padding, 0)
            right = min(box["right"] + padding, image_array.shape[1])
            bottom = min(box["bottom"] + padding, image_array.shape[0])
            if right <= left or bottom <= top:
                continue

            crop = image_array[top:bottom, left:right]
            if crop.size == 0:
                continue

            gray = crop if len(crop.shape) == 2 else np.mean(crop, axis=2)
            gray = gray.astype(np.uint8)
            try:
                import cv2

                _, binary = cv2.threshold(
                    gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU
                )
            except Exception:
                binary = np.where(gray < 180, 0, 255).astype(np.uint8)

            font_metrics = _stroke_width_features(binary)
            if font_metrics is None:
                continue

            numeric_rows.append(
                {
                    "text": text,
                    "confidence": confidence,
                    "box": box,
                    "stroke_width": font_metrics["stroke_width"],
                    "stroke_std": font_metrics["stroke_std"],
                    "pixel_density": font_metrics["pixel_density"],
                }
            )
        return numeric_rows

    def _parse_amount(text):
        normalized = re.sub(r"[^0-9.,]", "", str(text or ""))
        if not normalized or not re.search(r"\d", normalized):
            return None
        normalized = normalized.replace(",", "")
        try:
            value = float(normalized)
            return value if value > 0 else None
        except Exception:
            return None

    image_array = np.array(image)
    tesseract_data = pytesseract.image_to_data(
        image_array, output_type=pytesseract.Output.DICT, config="--psm 6"
    )
    row_count = len(tesseract_data.get("text", []))
    ocr_rows = []
    for index in range(row_count):
        text = str(tesseract_data["text"][index] or "").strip()
        if not text:
            continue
        ocr_rows.append(
            [
                tesseract_data["level"][index],
                tesseract_data["page_num"][index],
                tesseract_data["block_num"][index],
                tesseract_data["par_num"][index],
                tesseract_data["line_num"][index],
                tesseract_data["word_num"][index],
                tesseract_data["left"][index],
                tesseract_data["top"][index],
                tesseract_data["width"][index],
                tesseract_data["height"][index],
                tesseract_data["conf"][index],
                text,
            ]
        )

    numeric_regions = _extract_numeric_region_features(image_array, ocr_rows)
    stroke_widths = [region["stroke_width"] for region in numeric_regions]
    mean_stroke_width = float(np.mean(stroke_widths)) if stroke_widths else 0.0
    std_stroke_width = float(np.std(stroke_widths)) if stroke_widths else 0.0
    mean_confidence = (
        float(np.mean([region["confidence"] for region in numeric_regions]))
        if numeric_regions
        else 0.0
    )

    flagged_regions = []
    is_suspicious = False
    total_keywords = ("total", "grand total", "amount due", "balance due", "net total")
    total_candidates = []
    for region in numeric_regions:
        label = "numeric"
        nearby_text = " ".join(
            row[11].lower()
            for row in ocr_rows
            if abs((row[6] + row[8] / 2.0) - region["box"]["cx"]) < 90
            and abs((row[7] + row[9] / 2.0) - region["box"]["cy"]) < 40
        )
        if any(keyword in nearby_text for keyword in total_keywords):
            label = "total"

        amount_value = _parse_amount(region["text"])
        if amount_value is not None:
            total_candidates.append(
                {
                    "value": amount_value,
                    "label": label,
                    "confidence": region["confidence"],
                    "text": region["text"],
                }
            )

        deviation = 0.0
        if std_stroke_width > 0:
            deviation = (
                abs(region["stroke_width"] - mean_stroke_width) / std_stroke_width
            )
        if deviation > 2.0 or (label == "total" and deviation > 1.5):
            flagged_regions.append(
                {
                    "text": region["text"],
                    "region": label,
                    "stroke_width": round(region["stroke_width"], 3),
                    "mean_stroke_width": round(mean_stroke_width, 3),
                    "deviation": round(deviation, 2),
                    "confidence": round(region["confidence"], 1),
                }
            )

    if flagged_regions:
        is_suspicious = True

    total_candidates.sort(
        key=lambda item: (
            1 if item["label"] == "total" else 0,
            item["confidence"],
            item["value"],
        ),
        reverse=True,
    )
    detected_total_amount = total_candidates[0]["value"] if total_candidates else None
    amount_delta_ratio = None
    amount_mismatch = False
    if (
        detected_total_amount is not None
        and claimed_amount is not None
        and claimed_amount > 0
    ):
        amount_delta_ratio = abs(detected_total_amount - claimed_amount) / max(
            detected_total_amount, claimed_amount
        )
        if amount_delta_ratio >= 0.18:
            amount_mismatch = True
            flagged_regions.append(
                {
                    "text": f"claimed={claimed_amount:.2f}, detected={detected_total_amount:.2f}",
                    "region": "amount_consistency",
                    "deviation": round(amount_delta_ratio * 10.0, 2),
                    "confidence": round(mean_confidence, 1),
                }
            )
            is_suspicious = True

    font_consistency_score = 1.0
    if numeric_regions:
        outlier_ratio = len(flagged_regions) / len(numeric_regions)
        confidence_penalty = max(0.0, 1.0 - (mean_confidence / 100.0))
        font_consistency_score = max(
            0.0, min(1.0, 1.0 - (outlier_ratio * 0.7) - (confidence_penalty * 0.3))
        )
    if amount_mismatch:
        font_consistency_score = max(0.0, font_consistency_score - 0.25)

    analysis = [
        f"Numeric regions analyzed: {len(numeric_regions)}",
        f"Flagged regions: {len(flagged_regions)}",
        f"Font consistency score: {font_consistency_score:.3f}",
    ]
    if detected_total_amount is not None:
        analysis.append(f"Detected total candidate: {detected_total_amount:.2f}")
    if claimed_amount is not None and claimed_amount > 0:
        analysis.append(f"Claimed amount: {claimed_amount:.2f}")
    if amount_delta_ratio is not None:
        analysis.append(f"Amount delta ratio: {amount_delta_ratio:.2%}")

    print(
        f"[L4-FONT] Numeric regions={len(numeric_regions)} | Flagged={len(flagged_regions)} | Score={font_consistency_score:.3f}"
    )

    return {
        "font_consistency_score": round(font_consistency_score, 4),
        "flagged_regions": _to_builtin(flagged_regions),
        "is_suspicious": is_suspicious,
        "mean_stroke_width": round(mean_stroke_width, 4),
        "std_stroke_width": round(std_stroke_width, 4),
        "mean_ocr_confidence": round(mean_confidence, 2),
        "numeric_region_count": len(numeric_regions),
        "claimed_amount": claimed_amount,
        "detected_total_amount": round(detected_total_amount, 2)
        if detected_total_amount is not None
        else None,
        "amount_delta_ratio": round(amount_delta_ratio, 4)
        if amount_delta_ratio is not None
        else None,
        "amount_mismatch": amount_mismatch,
        "analysis": "\n".join(analysis),
        "model": "tesseract-font-consistency",
    }


# ===== COMBINED WEB ENDPOINT =====

# Web endpoint image with FastAPI + Pillow + numpy (for pHash image processing)
web_image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("libjpeg-dev", "libpng-dev")  # JPEG/PNG codec support for Pillow
    .pip_install("fastapi", "pydantic", "Pillow", "numpy", "pymupdf")
)


@app.function(timeout=900, image=web_image)
@modal.asgi_app()
def fastapi_app():
    """
    FastAPI web endpoint for full 5-layer fraud detection pipeline.

    Endpoint: POST /analyze
    """
    import time

    from fastapi import FastAPI, HTTPException
    from fastapi.responses import JSONResponse
    from PIL import Image
    from pydantic import BaseModel

    web_app = FastAPI()

    def to_json_safe(value):
        """Recursively convert numpy values (e.g., int32) to JSON-native Python types."""
        try:
            import numpy as np
        except Exception:
            np = None

        if np is not None and isinstance(value, np.generic):
            return value.item()
        if np is not None and isinstance(value, np.ndarray):
            return [to_json_safe(v) for v in value.tolist()]
        if isinstance(value, dict):
            return {k: to_json_safe(v) for k, v in value.items()}
        if isinstance(value, (list, tuple)):
            return [to_json_safe(v) for v in value]
        return value

    # ===== THRESHOLDS & WEIGHTS (ported from fraudDetectionService.js) =====

    WEIGHTS = {
        "md5": 0.45,
        "receiptMath": 0.20,
        "anomaly": 0.35,
        # Backward-compatible placeholders for existing consumers.
        "pHash": 0.0,
        "clip": 0.0,
        "florence": 0.0,
    }

    THRESHOLDS = {
        "anomaly": {"extreme": 3.0, "high": 2.5, "moderate": 2.0},
        "receiptMath": {"suspicious": 0.40},
        "overall": {"fraudulent": 0.70, "suspicious": 0.40},
    }

    # ===== LOCAL HELPER FUNCTIONS =====

    def compute_md5(image_bytes: bytes) -> str:
        return hashlib.md5(image_bytes).hexdigest()

    def compute_phash(image_bytes: bytes) -> str:
        """DCT-based perceptual hash â€” same algorithm as backend imageHashing.js"""
        img = Image.open(io.BytesIO(image_bytes)).resize((32, 32)).convert("L")
        pixels = list(img.getdata())
        matrix = [pixels[i * 32 : (i + 1) * 32] for i in range(32)]

        # DCT
        N = 32
        dct = [[0.0] * N for _ in range(N)]
        for u in range(N):
            for v in range(N):
                s = 0.0
                for i in range(N):
                    for j in range(N):
                        s += (
                            matrix[i][j]
                            * math.cos((2 * i + 1) * u * math.pi / (2 * N))
                            * math.cos((2 * j + 1) * v * math.pi / (2 * N))
                        )
                cu = 1.0 / math.sqrt(2) if u == 0 else 1.0
                cv = 1.0 / math.sqrt(2) if v == 0 else 1.0
                dct[u][v] = 0.25 * cu * cv * s

        # Extract 8x8 low frequencies
        low_freq = [dct[i][j] for i in range(8) for j in range(8)]
        sorted_freq = sorted(low_freq)
        median = sorted_freq[len(sorted_freq) // 2]

        # 64-bit hash as hex
        bits = "".join("1" if v > median else "0" for v in low_freq)
        return hex(int(bits, 2))[2:].zfill(16)

    def phash_similarity(hash1: str, hash2: str) -> float:
        """Hamming distance â†’ similarity (0.0-1.0)"""
        if not hash1 or not hash2 or len(hash1) != len(hash2):
            return 0.0
        bin1 = bin(int(hash1, 16))[2:].zfill(64)
        bin2 = bin(int(hash2, 16))[2:].zfill(64)
        distance = sum(a != b for a, b in zip(bin1, bin2))
        return 1.0 - (distance / 64.0)

    def cosine_similarity(emb1: List[float], emb2: List[float]) -> float:
        dot = sum(a * b for a, b in zip(emb1, emb2))
        mag1 = math.sqrt(sum(a * a for a in emb1))
        mag2 = math.sqrt(sum(b * b for b in emb2))
        if mag1 == 0 or mag2 == 0:
            return 0.0
        return max(0.0, min(1.0, dot / (mag1 * mag2)))

    # ===== LAYER RUNNERS =====

    def run_md5_layer(md5_hash: str, past_hashes: list) -> dict:
        for past in past_hashes:
            if past.get("md5") == md5_hash:
                return {
                    "score": 1.0,
                    "matched": True,
                    "matchedExpenseId": past["id"],
                    "details": f"Exact duplicate of expense #{past['id']}",
                    "hash": md5_hash,
                }
        return {
            "score": 0.0,
            "matched": False,
            "details": "No exact duplicate found",
            "hash": md5_hash,
        }

    def amount_delta_ratio(
        current_amount: float, past_amount: Optional[float]
    ) -> Optional[float]:
        if past_amount is None or current_amount <= 0 or past_amount <= 0:
            return None
        denom = max(current_amount, past_amount)
        return abs(current_amount - past_amount) / denom

    def run_phash_layer(p_hash: str, past_hashes: list, current_amount: float) -> dict:
        candidates = []
        for past in past_hashes:
            if not past.get("perceptual_hash"):
                continue
            sim = phash_similarity(p_hash, past["perceptual_hash"])
            delta = amount_delta_ratio(current_amount, past.get("amount"))
            candidates.append(
                {"id": past["id"], "similarity": sim, "amountDelta": delta}
            )

        if not candidates:
            return {
                "score": 0.0,
                "matched": False,
                "matchedExpenseId": None,
                "amountDeltaRatio": None,
                "likelyTemplateOnly": False,
                "templatePattern": False,
                "similarity": 0.0,
                "details": "No perceptual duplicates to compare",
                "hash": p_hash,
                "topMatches": [],
                "highSimilarityCount": 0,
                "veryHighSimilarityCount": 0,
            }

        candidates.sort(key=lambda item: item["similarity"], reverse=True)
        top = candidates[0]
        max_sim = top["similarity"]
        matched_id = top["id"]
        matched_amount_delta = top["amountDelta"]

        high_count = sum(
            1
            for item in candidates
            if item["similarity"] >= THRESHOLDS["pHash"]["high"]
        )
        very_high_count = sum(
            1
            for item in candidates
            if item["similarity"] >= THRESHOLDS["pHash"]["veryHigh"]
        )
        likely_template_only = (
            matched_amount_delta is not None and matched_amount_delta > 0.25
        )
        template_pattern = high_count >= 3 and very_high_count == 0

        if max_sim >= THRESHOLDS["pHash"]["veryHigh"]:
            if matched_amount_delta is not None and matched_amount_delta <= 0.10:
                score, detail = (
                    0.72,
                    f"Near-identical pHash ({max_sim*100:.1f}%) to expense #{matched_id} with close amount",
                )
            elif likely_template_only:
                score, detail = (
                    0.42,
                    f"Very high pHash ({max_sim*100:.1f}%) to expense #{matched_id} but amount differs significantly",
                )
            else:
                score, detail = (
                    0.56,
                    f"Very high pHash similarity ({max_sim*100:.1f}%) to expense #{matched_id}",
                )
        elif max_sim >= THRESHOLDS["pHash"]["high"]:
            if template_pattern:
                score, detail = (
                    0.30,
                    f"High pHash similarity pattern across {high_count} past expenses suggests repeated template reuse",
                )
            elif likely_template_only:
                score, detail = (
                    0.24,
                    f"High pHash similarity ({max_sim*100:.1f}%) but amount delta indicates template-only overlap",
                )
            else:
                score, detail = (
                    0.38,
                    f"High pHash similarity ({max_sim*100:.1f}%) to expense #{matched_id}",
                )
        elif max_sim >= THRESHOLDS["pHash"]["suspicious"]:
            score = 0.20 if template_pattern else 0.14
            detail = f"Moderate pHash similarity ({max_sim*100:.1f}%) to expense #{matched_id}"
        else:
            score, detail = (
                0.0,
                f"No meaningful pHash overlap (max similarity: {max_sim*100:.1f}%)",
            )

        top_matches = [
            {
                "id": item["id"],
                "similarity": round(item["similarity"], 4),
                "amountDeltaRatio": round(item["amountDelta"], 4)
                if item["amountDelta"] is not None
                else None,
            }
            for item in candidates[:3]
        ]

        return {
            "score": score,
            "matched": max_sim >= THRESHOLDS["pHash"]["suspicious"] or template_pattern,
            "matchedExpenseId": matched_id,
            "amountDeltaRatio": round(matched_amount_delta, 4)
            if matched_amount_delta is not None
            else None,
            "likelyTemplateOnly": likely_template_only,
            "templatePattern": template_pattern,
            "similarity": round(max_sim, 4),
            "details": detail,
            "hash": p_hash,
            "topMatches": top_matches,
            "highSimilarityCount": high_count,
            "veryHighSimilarityCount": very_high_count,
        }

    def run_clip_layer(
        clip_embedding: list, past_embeddings: list, current_amount: float
    ) -> dict:
        if not past_embeddings:
            return {
                "score": 0.0,
                "matched": False,
                "details": "No past CLIP embeddings to compare",
                "embedding": clip_embedding,
                "similarity": 0.0,
            }
        candidates = []
        for past in past_embeddings:
            sim = cosine_similarity(clip_embedding, past["embedding"])
            delta = amount_delta_ratio(current_amount, past.get("amount"))
            candidates.append(
                {"id": past["id"], "similarity": sim, "amountDelta": delta}
            )

        candidates.sort(key=lambda item: item["similarity"], reverse=True)
        top = candidates[0]
        max_sim = top["similarity"]
        matched_id = top["id"]
        matched_amount_delta = top["amountDelta"]

        very_high_count = sum(
            1
            for item in candidates
            if item["similarity"] >= THRESHOLDS["clip"]["veryHigh"]
        )
        extreme_count = sum(
            1
            for item in candidates
            if item["similarity"] >= THRESHOLDS["clip"]["extreme"]
        )
        likely_template_only = (
            matched_amount_delta is not None and matched_amount_delta > 0.25
        )
        template_pattern = very_high_count >= 3 and extreme_count == 0

        if max_sim >= THRESHOLDS["clip"]["extreme"]:
            if matched_amount_delta is not None and matched_amount_delta <= 0.10:
                score, detail = (
                    0.76,
                    f"Extremely high CLIP similarity ({max_sim*100:.1f}%) to expense #{matched_id} with close amount",
                )
            elif likely_template_only:
                score, detail = (
                    0.44,
                    f"Extreme visual similarity ({max_sim*100:.1f}%) to expense #{matched_id} with a large amount delta",
                )
            else:
                score, detail = (
                    0.58,
                    f"Extremely high CLIP similarity ({max_sim*100:.1f}%) to expense #{matched_id}",
                )
        elif max_sim >= THRESHOLDS["clip"]["veryHigh"]:
            if template_pattern:
                score, detail = (
                    0.30,
                    f"High CLIP similarity pattern across {very_high_count} expenses indicates repeated visual template",
                )
            elif likely_template_only:
                score, detail = (
                    0.24,
                    f"Very high visual similarity ({max_sim*100:.1f}%) but amount delta suggests layout reuse",
                )
            else:
                score, detail = (
                    0.40,
                    f"Very high CLIP similarity ({max_sim*100:.1f}%) to expense #{matched_id}",
                )
        elif max_sim >= THRESHOLDS["clip"]["moderate"]:
            score = 0.18 if template_pattern else 0.12
            detail = f"Moderate visual similarity ({max_sim*100:.1f}%) to expense #{matched_id}"
        else:
            score, detail = (
                0.0,
                f"No meaningful CLIP overlap (max similarity: {max_sim*100:.1f}%)",
            )

        top_matches = [
            {
                "id": item["id"],
                "similarity": round(item["similarity"], 4),
                "amountDeltaRatio": round(item["amountDelta"], 4)
                if item["amountDelta"] is not None
                else None,
            }
            for item in candidates[:3]
        ]

        return {
            "score": score,
            "matched": max_sim >= THRESHOLDS["clip"]["moderate"] or template_pattern,
            "matchedExpenseId": matched_id,
            "amountDeltaRatio": round(matched_amount_delta, 4)
            if matched_amount_delta is not None
            else None,
            "likelyTemplateOnly": likely_template_only,
            "templatePattern": template_pattern,
            "similarity": round(max_sim, 4),
            "details": detail,
            "embedding": clip_embedding,
            "topMatches": top_matches,
            "veryHighSimilarityCount": very_high_count,
            "extremeSimilarityCount": extreme_count,
        }

    def run_receipt_math_layer(chandra_result: dict) -> dict:
        """
        Layer 2: Chandra OCR + Pydantic-style deterministic validation.
        Current implementation uses the OCR extraction output and enforces deterministic
        amount consistency rules with explicit validation errors.
        """
        flags = chandra_result.get("flagged_regions", [])
        claimed_amount = chandra_result.get("claimed_amount")
        detected_total = chandra_result.get("detected_total_amount")
        amount_delta_ratio = chandra_result.get("amount_delta_ratio")
        amount_mismatch = bool(chandra_result.get("amount_mismatch", False))
        font_score = float(chandra_result.get("font_consistency_score", 0.0))

        validation_errors = []
        if detected_total is None:
            validation_errors.append(
                {
                    "field": "detected_total_amount",
                    "code": "missing_total",
                    "message": "Could not reliably extract total amount from receipt",
                }
            )
        if amount_mismatch:
            validation_errors.append(
                {
                    "field": "total_amount",
                    "code": "amount_mismatch",
                    "message": f"Claimed amount {claimed_amount} does not match extracted total {detected_total}",
                    "delta_ratio": str(amount_delta_ratio),
                }
            )

        # Layer 2 is intentionally capped to suspicious-only influence.
        base_score = 1.0 - font_score
        if amount_mismatch:
            base_score = max(base_score, 0.55)
        score = round(min(max(base_score, 0.0), 0.65), 4)

        details = "Receipt OCR + deterministic math validation complete"
        if validation_errors:
            details += f" | Validation issues: {len(validation_errors)}"

        structured_receipt = {
            "claimed_amount": claimed_amount,
            "detected_total_amount": detected_total,
            "amount_delta_ratio": amount_delta_ratio,
            "numeric_region_count": chandra_result.get("numeric_region_count", 0),
        }

        return {
            "score": score,
            "matched": bool(validation_errors),
            "details": details,
            "analysis": chandra_result.get("analysis", ""),
            "validation_passed": len(validation_errors) == 0,
            "validation_errors": validation_errors,
            "structured_receipt": structured_receipt,
            "amount_mismatch": amount_mismatch,
            "claimed_amount": claimed_amount,
            "detected_total_amount": detected_total,
            "amount_delta_ratio": amount_delta_ratio,
            "font_consistency_score": chandra_result.get("font_consistency_score", 0.0),
            "flagged_regions": flags,
            "model": "chandra-ocr2+pydantic-validation",
        }

    def run_anomaly_layer(amount: float, stats: Optional[dict]) -> dict:
        if not stats or stats.get("count", 0) < 3:
            return {
                "score": 0.0,
                "details": "Insufficient historical data for anomaly detection",
                "zScore": None,
            }
        z = (
            abs((amount - stats["mean"]) / stats["stdDev"])
            if stats["stdDev"] > 0
            else 0.0
        )
        if z > THRESHOLDS["anomaly"]["extreme"]:
            score, detail = (
                0.95,
                f"Extreme outlier (Z={z:.2f}) - {amount} vs avg {stats['mean']:.0f}",
            )
        elif z > THRESHOLDS["anomaly"]["high"]:
            score, detail = (
                0.80,
                f"High outlier (Z={z:.2f}) - {amount} vs avg {stats['mean']:.0f}",
            )
        elif z > THRESHOLDS["anomaly"]["moderate"]:
            score, detail = (
                0.60,
                f"Moderate outlier (Z={z:.2f}) - {amount} vs avg {stats['mean']:.0f}",
            )
        else:
            score, detail = 0.0, f"Normal amount (Z={z:.2f})"
        return {"score": score, "zScore": round(z, 2), "details": detail}

    # ===== AGGREGATION =====

    def aggregate(layers: dict) -> tuple:
        """Returns (overallScore, status, confidence, recommendation)"""
        overall = (
            (layers["md5"].get("score", 0) * WEIGHTS["md5"])
            + (layers["receiptMath"].get("score", 0) * WEIGHTS["receiptMath"])
            + (layers["anomaly"].get("score", 0) * WEIGHTS["anomaly"])
        )

        anomaly_score = layers["anomaly"].get("score", 0)
        receipt_math_score = layers["receiptMath"].get("score", 0)
        receipt_math_triggered = layers["receiptMath"].get("matched") is True

        # Status
        if layers["md5"]["matched"]:
            status = "fraudulent"
        elif anomaly_score >= 0.80:
            status = "fraudulent"
        elif anomaly_score >= 0.60:
            status = "suspicious"
        elif (
            receipt_math_triggered
            or receipt_math_score >= THRESHOLDS["receiptMath"]["suspicious"]
        ):
            status = "suspicious"
        elif overall >= THRESHOLDS["overall"]["fraudulent"]:
            status = "fraudulent"
        elif overall >= THRESHOLDS["overall"]["suspicious"]:
            status = "suspicious"
        else:
            status = "clean"

        # Confidence (layer agreement)
        confidence = 0.34
        if layers["md5"].get("matched"):
            confidence = 1.0
        elif anomaly_score >= 0.80:
            confidence = 0.92
        elif anomaly_score >= 0.60:
            confidence = 0.82
        elif receipt_math_triggered:
            confidence = 0.74

        # Recommendation
        if status == "fraudulent":
            if layers["md5"]["matched"]:
                rec = "REJECT - Exact duplicate file detected"
            elif anomaly_score >= 0.80:
                rec = "REJECT - Strong statistical anomaly detected"
            else:
                rec = "REJECT - Fraud indicators exceeded the hard threshold"
        elif status == "suspicious":
            if anomaly_score >= 0.60:
                rec = "ESCALATE TO HR - Strong anomaly signal requires direct HR review"
            elif receipt_math_triggered:
                rec = "ESCALATE TO HR - Receipt validation failed deterministic consistency checks"
            else:
                rec = "ESCALATE TO HR - Receipt consistency looks suspicious"
        else:
            rec = "APPROVE - No fraud indicators detected"

        return round(overall, 4), status, round(confidence, 4), rec

    def with_legacy_layer_aliases(base_layers: dict, p_hash_value: str = "") -> dict:
        """
        Keep old keys (`pHash`, `clip`, `florence`) so existing n8n/Odoo mappings keep
        working while the active architecture uses 3 layers.
        """
        receipt_math = base_layers.get("receiptMath", {})
        return {
            **base_layers,
            "pHash": {
                "score": 0.0,
                "matched": False,
                "details": "Deprecated layer - replaced by receipt OCR + deterministic validation",
                "hash": p_hash_value or "",
                "deprecated": True,
            },
            "clip": {
                "score": 0.0,
                "matched": False,
                "details": "Deprecated layer - replaced by receipt OCR + deterministic validation",
                "embedding": None,
                "similarity": 0.0,
                "deprecated": True,
            },
            "florence": {
                "score": receipt_math.get("score", 0.0),
                "matched": receipt_math.get("matched", False),
                "details": "Compatibility alias for Layer 2 receipt validation",
                "analysis": receipt_math.get("analysis", ""),
                "flags": receipt_math.get("flagged_regions", []),
                "deprecated": True,
            },
        }

    # ===== REQUEST / RESPONSE MODELS =====

    class EmployeeStats(BaseModel):
        mean: float = 0.0
        stdDev: float = 0.0
        count: int = 0

    class PastHash(BaseModel):
        id: int
        md5: Optional[str] = None
        perceptual_hash: Optional[str] = None
        amount: Optional[float] = None

    class PastEmbedding(BaseModel):
        id: int
        embedding: List[float]
        amount: Optional[float] = None

    class FullAnalysisRequest(BaseModel):
        image: str  # base64 encoded image or PDF
        mimetype: Optional[str] = None  # e.g. "image/jpeg", "application/pdf"
        employee_id: int = 0
        expense_id: int = 0
        amount: float = 0.0
        employee_stats: Optional[EmployeeStats] = None
        past_hashes: Optional[List[PastHash]] = []
        past_embeddings: Optional[List[PastEmbedding]] = []

    def is_pdf_bytes(data: bytes, mimetype: Optional[str]) -> bool:
        if mimetype and "pdf" in mimetype.lower():
            return True
        return len(data) >= 4 and data[:4] == b"%PDF"

    def pdf_to_image_bytes(pdf_bytes: bytes) -> bytes:
        """Render page 1 of a PDF to PNG bytes via PyMuPDF."""
        import fitz  # PyMuPDF

        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        if doc.page_count == 0:
            doc.close()
            raise ValueError("PDF has no pages")
        page = doc.load_page(0)
        # 200 DPI gives a clean render for OCR/VLM without being huge
        pix = page.get_pixmap(dpi=200, alpha=False)
        png_bytes = pix.tobytes("png")
        doc.close()
        return cast(bytes, png_bytes)

    # ===== ENDPOINTS =====

    @web_app.post("/analyze")
    async def analyze_full_pipeline(request: FullAnalysisRequest):
        """
        Full 5-layer fraud detection pipeline.

        n8n sends image + employee context, Modal returns complete verdict.
        CLIP and Florence-2 run on GPU in parallel.
        MD5, pHash, anomaly, and aggregation run here on CPU.

        Request body:
            {
                "image": "<base64>",
                "employee_id": 123,
                "expense_id": 456,
                "amount": 8500.0,
                "employee_stats": { "mean": 5200, "stdDev": 1800, "count": 12 },
                "past_hashes": [ { "id": 10, "md5": "abc...", "perceptual_hash": "def..." } ],
                "past_embeddings": [ { "id": 10, "embedding": [0.1, 0.2, ...] } ]
            }

        Response:
            {
                "success": true,
                "status": "clean|suspicious|fraudulent",
                "overallScore": 0.23,
                "confidence": 0.91,
                "recommendation": "APPROVE - No fraud indicators detected",
                "layers": { md5: {...}, pHash: {...}, clip: {...}, florence: {...}, anomaly: {...} },
                "processing_time_seconds": 5.8
            }
        """
        start_time = time.time()

        try:
            print(
                f"[PIPELINE] Fraud detection for expense #{request.expense_id}, employee #{request.employee_id}, amount={request.amount}"
            )

            # Decode payload (image OR pdf)
            try:
                raw_bytes = base64.b64decode(request.image)
                print(
                    f"[PIPELINE] Decoded payload: {len(raw_bytes)} bytes, mimetype={request.mimetype}"
                )
            except Exception as e:
                raise HTTPException(
                    status_code=400, detail=f"Invalid base64 payload: {str(e)}"
                )

            # If PDF, render page 1 to a PNG â€” downstream layers need an image
            if is_pdf_bytes(raw_bytes, request.mimetype):
                print("[PIPELINE] PDF detected â€” rendering page 1 to PNG")
                try:
                    image_bytes = pdf_to_image_bytes(raw_bytes)
                    print(f"[PIPELINE] Rendered PDF page: {len(image_bytes)} bytes")
                except Exception as e:
                    raise HTTPException(
                        status_code=400, detail=f"Failed to render PDF: {str(e)}"
                    )
            else:
                image_bytes = raw_bytes

            # ===== PHASE 1: LOCAL LAYERS (CPU, instant) =====
            print(
                "[PIPELINE] Phase 1: Running local layers (MD5, metadata pHash, Anomaly)..."
            )
            past_hashes = [h.model_dump() for h in (request.past_hashes or [])]
            stats = (
                request.employee_stats.model_dump() if request.employee_stats else None
            )

            # MD5 on original bytes â€” byte-identical re-uploads (PDF or image) must collide
            md5_hash = compute_md5(raw_bytes)
            md5_result = run_md5_layer(md5_hash, past_hashes)

            # pHash is kept as metadata only for backward-compatible storage fields.
            p_hash = compute_phash(image_bytes)

            anomaly_result = run_anomaly_layer(request.amount, stats)

            print(f"[PIPELINE] Phase 1 done. MD5 matched={md5_result['matched']}")

            # Early exit on exact MD5 match
            if md5_result["matched"]:
                print("[PIPELINE] EXACT DUPLICATE â€” early exit")
                base_layers = {
                    "md5": md5_result,
                    "receiptMath": {
                        "score": 0.0,
                        "matched": False,
                        "details": "Skipped - MD5 matched (hard duplicate)",
                        "analysis": "",
                        "validation_passed": True,
                        "validation_errors": [],
                        "structured_receipt": {},
                    },
                    "anomaly": anomaly_result,
                }
                layers = with_legacy_layer_aliases(base_layers, p_hash)
                overall, status, confidence, rec = aggregate(layers)
                return JSONResponse(
                    content=to_json_safe(
                        {
                            "success": True,
                            "status": status,
                            "overallScore": overall,
                            "confidence": confidence,
                            "recommendation": rec,
                            "layers": layers,
                            "weights": WEIGHTS,
                            "clip_embedding": [],
                            "florence_analysis": {
                                "analysis": "Skipped - MD5 hard duplicate",
                                "flags": [],
                                "amount_mismatch": False,
                            },
                            "processing_time_seconds": round(
                                time.time() - start_time, 2
                            ),
                            "earlyExit": True,
                        }
                    )
                )

            # ===== PHASE 2: RECEIPT OCR + DETERMINISTIC VALIDATION =====
            print(
                "[PIPELINE] Phase 2: Running receipt OCR + deterministic math validation..."
            )
            chandra_raw = detect_forgery_florence.remote(image_bytes, request.amount)
            print("[PIPELINE] Phase 2 done.")

            # ===== PHASE 3: SCORE ALL LAYERS =====
            receipt_math_result = run_receipt_math_layer(chandra_raw)

            base_layers = {
                "md5": md5_result,
                "receiptMath": receipt_math_result,
                "anomaly": anomaly_result,
            }
            layers = with_legacy_layer_aliases(base_layers, p_hash)

            overall, status, confidence, rec = aggregate(layers)

            processing_time = round(time.time() - start_time, 2)
            print(
                f"[PIPELINE] Complete in {processing_time}s | Status: {status} | Score: {overall}"
            )

            return JSONResponse(
                content=to_json_safe(
                    {
                        "success": True,
                        "status": status,
                        "overallScore": overall,
                        "confidence": confidence,
                        "recommendation": rec,
                        "layers": layers,
                        "weights": WEIGHTS,
                        "clip_embedding": [],
                        "florence_analysis": chandra_raw,
                        "processing_time_seconds": processing_time,
                    }
                )
            )

        except HTTPException:
            raise
        except Exception as e:
            processing_time = round(time.time() - start_time, 2)
            print(f"[PIPELINE] Error after {processing_time}s: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))

    # Legacy endpoint â€” kept for backwards compatibility if anything still calls the old contract
    class LegacyRequest(BaseModel):
        image: str

    @web_app.post("/analyze-legacy")
    async def analyze_legacy(request: LegacyRequest):
        """Original endpoint that only returns CLIP + Florence (no pipeline)."""
        start_time = time.time()
        try:
            image_bytes = base64.b64decode(request.image)
            clip_task = generate_clip_embedding.spawn(image_bytes)
            florence_task = detect_forgery_florence.spawn(image_bytes)
            clip_embedding = clip_task.get()
            florence_result = florence_task.get()
            return JSONResponse(
                content=to_json_safe(
                    {
                        "success": True,
                        "clip_embedding": clip_embedding,
                        "florence_analysis": florence_result,
                        "processing_time_seconds": round(time.time() - start_time, 2),
                    }
                )
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    return web_app


# ===== LOCAL TESTING FUNCTIONS =====


@app.local_entrypoint()
def test_local():
    """
    Test the fraud detection functions locally.

    Usage:
        modal run modal/fraud_detection.py
    """
    import os

    # Try to load a test image
    test_image_path = "modal/test_images/sample_invoice.jpg"

    if not os.path.exists(test_image_path):
        print(f"âš ï¸  No test image found at {test_image_path}")
        print(
            "Please add a sample invoice image to modal/test_images/sample_invoice.jpg"
        )
        return

    print(f"ðŸ“„ Testing with image: {test_image_path}")

    with open(test_image_path, "rb") as f:
        image_bytes = f.read()

    print("\n=== Testing CLIP Embedding ===")
    embedding = generate_clip_embedding.remote(image_bytes)
    print(f"âœ… CLIP embedding: {len(embedding)} dimensions")
    print(f"   First 5 values: {embedding[:5]}")

    print("\n=== Testing Florence-2 Analysis ===")
    florence_result = detect_forgery_florence.remote(image_bytes)
    print(f"âœ… Florence analysis:")
    print(f"   Description: {florence_result['analysis'][:200]}...")
    print(f"   Fraud score: {florence_result['fraud_score']}")
    print(f"   Flags: {florence_result['flags']}")

    print("\nâœ… Both functions tested successfully!")
    print("\nTo test the web endpoint, deploy first:")
    print("  modal deploy modal/fraud_detection.py")
    print("\nThen use curl or Postman to POST to the /analyze endpoint")
