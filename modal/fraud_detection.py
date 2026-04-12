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

# Florence-2 Image: Vision-language model for document analysis
# Note: Uses CUDA development base image for flash-attention compilation
florence_image = (
    modal.Image.from_registry("nvidia/cuda:12.1.0-devel-ubuntu22.04", add_python="3.11")
    .apt_install("git", "clang")  # Added clang for flash_attn compilation
    .pip_install(
        "torch",
        "numpy",  # Required by flash_attn setup
        "ninja",
        "packaging",
        "wheel",
    )
    .run_commands(
        # Try pre-built wheels first, compile only if necessary with reduced parallelism
        "pip install flash-attn || MAX_JOBS=1 pip install flash-attn --no-build-isolation"
    )
    .pip_install(
        "transformers==4.38.2",  # Pin to compatible version
        "Pillow",
        "accelerate",
        "einops",  # Required by Florence-2
        "timm",  # Required by Florence-2
    )
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


# ===== FLORENCE-2 FORGERY DETECTION FUNCTION =====


@app.function(
    gpu="T4",
    image=florence_image,
    timeout=600,
    secrets=[],
)
def detect_forgery_florence(
    image_bytes: bytes, claimed_amount: Optional[float] = None
) -> Dict:
    """
    Analyze invoice for visual inconsistencies using Florence-2 VLM.

    Args:
        image_bytes: Raw image bytes
        claimed_amount: Expense amount claimed by employee (for OCR cross-check)

    Returns:
        Dict containing:
            - analysis (str): Detailed description of the document
            - fraud_score (float): 0.0-1.0 based on suspicious patterns
            - flags (list): Specific issues detected

    Processing time: ~4-6 seconds on T4 GPU
    Use case: Detect Photoshopped amounts, font inconsistencies, copy-paste artifacts
    """
    import torch
    from PIL import Image
    from transformers import AutoModelForCausalLM, AutoProcessor

    print("[FLORENCE] Loading model...")

    # Load Florence-2 model
    model_name = "microsoft/Florence-2-large"
    model = AutoModelForCausalLM.from_pretrained(
        model_name,
        trust_remote_code=True,
        torch_dtype=torch.float16,
        attn_implementation="sdpa",  # Use PyTorch's attention instead of flash_attn
    )
    processor = AutoProcessor.from_pretrained(model_name, trust_remote_code=True)

    # Move to GPU
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model = model.to(device)
    model.eval()

    print(f"[FLORENCE] Analyzing document on {device}...")

    # Load image
    image = Image.open(io.BytesIO(image_bytes))
    if image.mode != "RGB":
        image = image.convert("RGB")

    def run_task(task_prompt: str, question: Optional[str] = None) -> str:
        prompt = task_prompt if question is None else f"{task_prompt}{question}"
        inputs = processor(text=prompt, images=image, return_tensors="pt")
        inputs = {
            k: v.to(device, dtype=torch.float16)
            if v.dtype == torch.float32
            else v.to(device)
            for k, v in inputs.items()
        }

        with torch.no_grad():
            generated_ids = model.generate(
                **inputs, max_new_tokens=512, num_beams=3, do_sample=False
            )

        generated_text = processor.batch_decode(
            generated_ids, skip_special_tokens=True
        )[0]
        return cast(str, generated_text.replace(prompt, "").strip())

    analysis = run_task("<MORE_DETAILED_CAPTION>")
    ocr_text = run_task("<OCR>")
    ocr_with_region = run_task("<OCR_WITH_REGION>")
    forensic_q1 = run_task(
        "<VQA>",
        "Does the total amount text look visually different in font, weight, or alignment from nearby numbers? Answer yes or no with one short reason.",
    )
    forensic_q2 = run_task(
        "<VQA>",
        "Do you see signs of edited, overwritten, pasted, or tampered digits in the total/grand total area? Answer yes or no with one short reason.",
    )
    forensic_q3 = run_task(
        "<VQA>",
        "Is the grand total internally inconsistent with other fare amounts on this document? Answer yes or no with one short reason.",
    )
    forensic_q4 = run_task(
        "<VQA>",
        "Read the grand total amount only as digits (no words). If unreadable, answer unreadable.",
    )

    print(f"[FLORENCE] Caption: {analysis[:120]}...")

    suspicious_keywords = [
        "inconsistent",
        "edited",
        "altered",
        "mismatch",
        "artifact",
        "blur",
        "different font",
        "overlay",
        "pasted",
        "modified",
        "compression",
        "quality difference",
        "irregular",
        "misaligned",
        "tampered",
        "manipulated",
        "font change",
        "text replacement",
        "pixelated",
        "cloned",
        "copy paste",
        "inpainted",
    ]

    detected_flags = []
    analysis_lower = analysis.lower()
    ocr_lower = ocr_text.lower()

    for keyword in suspicious_keywords:
        if keyword in analysis_lower:
            detected_flags.append(f"caption:{keyword}")

    amount_mismatch = False
    amount_delta_pct = None
    ocr_amount = None
    amount_matches = re.findall(r"\d{1,3}(?:[,\s]\d{3})*(?:\.\d+)?|\d+\.\d+", ocr_lower)
    numeric_amounts = []
    for raw in amount_matches:
        compact = raw.replace(",", "").replace(" ", "")
        try:
            value = float(compact)
            if value > 0:
                numeric_amounts.append(value)
        except ValueError:
            continue

    if numeric_amounts and claimed_amount is not None and claimed_amount > 0:
        ocr_amount = max(numeric_amounts)
        amount_delta_pct = abs(ocr_amount - claimed_amount) / claimed_amount
        if amount_delta_pct > 0.15:
            amount_mismatch = True
            detected_flags.append("ocr_amount_mismatch")

    q1_lower = forensic_q1.lower()
    q2_lower = forensic_q2.lower()
    q3_lower = forensic_q3.lower()
    q4_lower = forensic_q4.lower()

    if "yes" in q1_lower:
        detected_flags.append("vqa_font_style_mismatch")
    if "yes" in q2_lower:
        detected_flags.append("vqa_tamper_detected")
    if "yes" in q3_lower:
        detected_flags.append("vqa_total_inconsistent")
    if "unreadable" in q4_lower:
        detected_flags.append("vqa_total_unreadable")

    # Florence sometimes hallucinates giant repeated flight lists; treat this as a reliability red flag.
    if analysis_lower.count("flight ") >= 40:
        detected_flags.append("caption_repetitive_hallucination")

    if len(ocr_lower.strip()) < 20:
        detected_flags.append("ocr_text_too_short")

    if len(analysis_lower.strip()) < 50:
        detected_flags.append("caption_too_vague")

    unique_flags = list(dict.fromkeys(detected_flags))

    # Multi-signal scoring with high emphasis on explicit forensic VQA signals.
    score = 0.0
    keyword_hits = len([f for f in unique_flags if f.startswith("caption:")])
    score += min(keyword_hits * 0.04, 0.20)
    if amount_mismatch:
        score += 0.30
    if "vqa_font_style_mismatch" in unique_flags:
        score += 0.35
    if "vqa_tamper_detected" in unique_flags:
        score += 0.45
    if "vqa_total_inconsistent" in unique_flags:
        score += 0.25
    if "vqa_total_unreadable" in unique_flags:
        score += 0.10
    if "caption_repetitive_hallucination" in unique_flags:
        score += 0.12
    if "ocr_text_too_short" in unique_flags:
        score += 0.10
    if "caption_too_vague" in unique_flags:
        score += 0.05
    fraud_score = min(score, 1.0)

    print(f"[FLORENCE] Detected flags: {unique_flags}, Score: {fraud_score}")

    return {
        "analysis": analysis,
        "ocr_text": ocr_text,
        "ocr_with_region": ocr_with_region,
        "forensic_vqa": {
            "font_style_check": forensic_q1,
            "tamper_check": forensic_q2,
            "total_consistency_check": forensic_q3,
            "grand_total_read": forensic_q4,
        },
        "fraud_score": fraud_score,
        "flags": unique_flags,
        "amount_mismatch": amount_mismatch,
        "ocr_amount": ocr_amount,
        "claimed_amount": claimed_amount,
        "amount_delta_pct": amount_delta_pct,
        "model": model_name,
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

    # ===== THRESHOLDS & WEIGHTS (ported from fraudDetectionService.js) =====

    WEIGHTS = {
        "md5": 0.30,
        "pHash": 0.15,
        "clip": 0.20,
        "florence": 0.15,
        "anomaly": 0.20,
    }

    THRESHOLDS = {
        "pHash": {"veryHigh": 0.95, "high": 0.88, "suspicious": 0.80},
        "clip": {"extreme": 0.98, "veryHigh": 0.93, "moderate": 0.85},
        "anomaly": {"extreme": 3.0, "high": 2.5, "moderate": 2.0},
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
        max_sim = 0.0
        matched_id = None
        matched_amount_delta = None
        for past in past_hashes:
            if past.get("perceptual_hash"):
                sim = phash_similarity(p_hash, past["perceptual_hash"])
                if sim > max_sim:
                    max_sim = sim
                    matched_id = past["id"]
                    matched_amount_delta = amount_delta_ratio(
                        current_amount, past.get("amount")
                    )

        likely_template_only = (
            matched_amount_delta is not None and matched_amount_delta > 0.20
        )

        if max_sim >= THRESHOLDS["pHash"]["veryHigh"]:
            if likely_template_only:
                score, detail = (
                    0.20,
                    f"Very high template similarity ({max_sim*100:.1f}%) to expense #{matched_id}, but amount differs significantly",
                )
            else:
                score, detail = (
                    0.65,
                    f"Very high similarity ({max_sim*100:.1f}%) to expense #{matched_id}",
                )
        elif max_sim >= THRESHOLDS["pHash"]["high"]:
            if likely_template_only:
                score, detail = (
                    0.12,
                    f"High template similarity ({max_sim*100:.1f}%) to expense #{matched_id}, likely same receipt format",
                )
            else:
                score, detail = (
                    0.35,
                    f"High similarity ({max_sim*100:.1f}%) to expense #{matched_id}",
                )
        elif max_sim >= THRESHOLDS["pHash"]["suspicious"]:
            score, detail = (
                0.15,
                f"Moderate similarity ({max_sim*100:.1f}%) to expense #{matched_id}",
            )
        else:
            score, detail = (
                0.0,
                f"No perceptual duplicates (max similarity: {max_sim*100:.1f}%)",
            )

        return {
            "score": score,
            "matched": max_sim >= THRESHOLDS["pHash"]["suspicious"],
            "matchedExpenseId": matched_id,
            "amountDeltaRatio": round(matched_amount_delta, 4)
            if matched_amount_delta is not None
            else None,
            "likelyTemplateOnly": likely_template_only,
            "similarity": round(max_sim, 4),
            "details": detail,
            "hash": p_hash,
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
        max_sim = 0.0
        matched_id = None
        matched_amount_delta = None
        for past in past_embeddings:
            sim = cosine_similarity(clip_embedding, past["embedding"])
            if sim > max_sim:
                max_sim = sim
                matched_id = past["id"]
                matched_amount_delta = amount_delta_ratio(
                    current_amount, past.get("amount")
                )

        likely_template_only = (
            matched_amount_delta is not None and matched_amount_delta > 0.20
        )

        if max_sim >= THRESHOLDS["clip"]["extreme"]:
            if likely_template_only:
                score, detail = (
                    0.25,
                    f"Extremely high visual template similarity ({max_sim*100:.1f}%) to expense #{matched_id}, but amount differs significantly",
                )
            else:
                score, detail = (
                    0.75,
                    f"Extremely similar ({max_sim*100:.1f}%) to expense #{matched_id} - likely same receipt",
                )
        elif max_sim >= THRESHOLDS["clip"]["veryHigh"]:
            if likely_template_only:
                score, detail = (
                    0.15,
                    f"Very high visual template similarity ({max_sim*100:.1f}%) to expense #{matched_id}, likely same layout",
                )
            else:
                score, detail = (
                    0.45,
                    f"Very similar ({max_sim*100:.1f}%) to expense #{matched_id} - possibly rescanned",
                )
        elif max_sim >= THRESHOLDS["clip"]["moderate"]:
            score, detail = (
                0.20,
                f"Somewhat similar ({max_sim*100:.1f}%) to expense #{matched_id}",
            )
        else:
            score, detail = (
                0.0,
                f"No visual duplicates (max similarity: {max_sim*100:.1f}%)",
            )

        return {
            "score": score,
            "matched": max_sim >= THRESHOLDS["clip"]["moderate"],
            "matchedExpenseId": matched_id,
            "amountDeltaRatio": round(matched_amount_delta, 4)
            if matched_amount_delta is not None
            else None,
            "likelyTemplateOnly": likely_template_only,
            "similarity": round(max_sim, 4),
            "details": detail,
            "embedding": clip_embedding,
        }

    def run_florence_layer(florence_result: dict) -> dict:
        flags = florence_result.get("flags", [])
        detail = (
            f"Detected {len(flags)} suspicious patterns: {', '.join(flags)}"
            if flags
            else "No forgery indicators detected"
        )
        return {
            "score": florence_result.get("fraud_score", 0.0),
            "flags": flags,
            "details": detail,
            "analysis": florence_result.get("analysis", ""),
            "ocr_text": florence_result.get("ocr_text", ""),
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
        # Weighted score
        overall = sum(layers[k]["score"] * WEIGHTS[k] for k in WEIGHTS)

        p_hash_similarity = layers["pHash"].get("similarity", 0.0) or 0.0
        clip_similarity = layers["clip"].get("similarity", 0.0) or 0.0
        florence_flags = set(layers["florence"].get("flags", []))

        template_plus_anomaly = layers["anomaly"].get("score", 0) >= 0.80 and (
            layers["pHash"].get("likelyTemplateOnly") is True
            or layers["clip"].get("likelyTemplateOnly") is True
        )
        likely_tampered_duplicate = (
            p_hash_similarity >= 0.995
            and clip_similarity >= 0.995
            and layers["anomaly"].get("score", 0) < 0.20
            and (
                "vqa_total_unreadable" in florence_flags
                or "caption_repetitive_hallucination" in florence_flags
            )
        )
        florence_strong = layers["florence"].get("score", 0) >= 0.70

        # Status
        if layers["md5"]["matched"]:
            status = "fraudulent"
        elif likely_tampered_duplicate:
            status = "fraudulent"
        elif florence_strong:
            status = "fraudulent"
        elif template_plus_anomaly:
            status = "suspicious"
        elif overall >= THRESHOLDS["overall"]["fraudulent"]:
            status = "fraudulent"
        elif overall >= THRESHOLDS["overall"]["suspicious"]:
            status = "suspicious"
        else:
            status = "clean"

        # Confidence (layer agreement)
        high_layers = sum(1 for layer in layers.values() if layer["score"] > 0.5)
        confidence = high_layers / 5.0
        critical = sum(1 for k in ["md5", "pHash", "clip"] if layers[k]["score"] > 0.5)
        if critical >= 2:
            confidence = min(confidence + 0.2, 1.0)

        # Recommendation
        if status == "fraudulent":
            if layers["md5"]["matched"]:
                rec = "REJECT - Exact duplicate file detected"
            elif likely_tampered_duplicate:
                rec = "REJECT - Likely tampered duplicate template with unreadable/edited total area"
            elif layers["pHash"]["matched"] and layers["clip"]["matched"]:
                rec = "REJECT - Multiple duplicate detection methods confirm fraud"
            else:
                rec = "ESCALATE TO HR - High fraud probability detected"
        elif status == "suspicious":
            flagged = [k for k in layers if layers[k]["score"] > 0.4]
            rec = (
                f"MANUAL REVIEW REQUIRED - Suspicious patterns in: {', '.join(flagged)}"
            )
        else:
            rec = "APPROVE - No fraud indicators detected"

        return round(overall, 4), status, round(confidence, 4), rec

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
            print("[PIPELINE] Phase 1: Running local layers (MD5, pHash, Anomaly)...")
            past_hashes = [h.model_dump() for h in (request.past_hashes or [])]
            stats = (
                request.employee_stats.model_dump() if request.employee_stats else None
            )

            # MD5 on original bytes â€” byte-identical re-uploads (PDF or image) must collide
            md5_hash = compute_md5(raw_bytes)
            md5_result = run_md5_layer(md5_hash, past_hashes)

            p_hash = compute_phash(image_bytes)
            phash_result = run_phash_layer(p_hash, past_hashes, request.amount)

            anomaly_result = run_anomaly_layer(request.amount, stats)

            print(f"[PIPELINE] Phase 1 done. MD5 matched={md5_result['matched']}")

            # Early exit on exact MD5 match
            if md5_result["matched"]:
                print("[PIPELINE] EXACT DUPLICATE â€” early exit")
                layers = {
                    "md5": md5_result,
                    "pHash": phash_result,
                    "clip": {
                        "score": 0,
                        "matched": False,
                        "details": "Skipped - MD5 match",
                        "embedding": None,
                        "similarity": 0,
                    },
                    "florence": {
                        "score": 0,
                        "flags": [],
                        "details": "Skipped - MD5 match",
                        "analysis": "",
                    },
                    "anomaly": anomaly_result,
                }
                overall, status, confidence, rec = aggregate(layers)
                return JSONResponse(
                    content={
                        "success": True,
                        "status": status,
                        "overallScore": overall,
                        "confidence": confidence,
                        "recommendation": rec,
                        "layers": layers,
                        "processing_time_seconds": round(time.time() - start_time, 2),
                        "earlyExit": True,
                    }
                )

            # ===== PHASE 2: GPU LAYERS (CLIP + Florence in parallel) =====
            print("[PIPELINE] Phase 2: Spawning CLIP + Florence on GPU...")
            clip_task = generate_clip_embedding.spawn(image_bytes)
            florence_task = detect_forgery_florence.spawn(image_bytes, request.amount)

            clip_embedding = clip_task.get()
            florence_raw = florence_task.get()
            print("[PIPELINE] Phase 2 done.")

            # ===== PHASE 3: SCORE ALL LAYERS =====
            past_embs = [
                {"id": e.id, "embedding": e.embedding, "amount": e.amount}
                for e in (request.past_embeddings or [])
            ]
            clip_result = run_clip_layer(clip_embedding, past_embs, request.amount)
            florence_result = run_florence_layer(florence_raw)

            layers = {
                "md5": md5_result,
                "pHash": phash_result,
                "clip": clip_result,
                "florence": florence_result,
                "anomaly": anomaly_result,
            }

            overall, status, confidence, rec = aggregate(layers)

            processing_time = round(time.time() - start_time, 2)
            print(
                f"[PIPELINE] Complete in {processing_time}s | Status: {status} | Score: {overall}"
            )

            return JSONResponse(
                content={
                    "success": True,
                    "status": status,
                    "overallScore": overall,
                    "confidence": confidence,
                    "recommendation": rec,
                    "layers": layers,
                    "processing_time_seconds": processing_time,
                }
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
                content={
                    "success": True,
                    "clip_embedding": clip_embedding,
                    "florence_analysis": florence_result,
                    "processing_time_seconds": round(time.time() - start_time, 2),
                }
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
