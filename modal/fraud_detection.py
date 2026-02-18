"""
RAHAT-ONE Fraud Detection Modal Service

This Modal app provides GPU-accelerated fraud detection using:
- CLIP: Visual similarity embeddings for duplicate detection
- Florence-2: Document analysis for forgery detection

Author: RAHAT-ONE Team
"""

import base64
import io
from typing import Dict, List

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

    return embedding_list


# ===== FLORENCE-2 FORGERY DETECTION FUNCTION =====


@app.function(
    gpu="T4",
    image=florence_image,
    timeout=600,
    secrets=[],
)
def detect_forgery_florence(image_bytes: bytes) -> Dict:
    """
    Analyze invoice for visual inconsistencies using Florence-2 VLM.

    Args:
        image_bytes: Raw image bytes

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

    # Use detailed caption task to get comprehensive analysis
    task_prompt = "<DETAILED_CAPTION>"

    inputs = processor(text=task_prompt, images=image, return_tensors="pt")

    # Move inputs to device and match model dtype (float16)
    inputs = {
        k: v.to(device, dtype=torch.float16)
        if v.dtype == torch.float32
        else v.to(device)
        for k, v in inputs.items()
    }

    # Generate analysis
    with torch.no_grad():
        generated_ids = model.generate(
            **inputs, max_new_tokens=256, num_beams=3, do_sample=False
        )

    # Decode the output
    generated_text = processor.batch_decode(generated_ids, skip_special_tokens=True)[0]

    # Extract the actual description (Florence-2 returns format: "task_prompt description")
    analysis = generated_text.replace(task_prompt, "").strip()

    print(f"[FLORENCE] Analysis: {analysis[:100]}...")

    # Simple heuristic-based fraud scoring
    # Look for keywords that might indicate manipulation
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
    ]

    detected_flags = []
    analysis_lower = analysis.lower()

    for keyword in suspicious_keywords:
        if keyword in analysis_lower:
            detected_flags.append(keyword)

    # Calculate fraud score (0.0 to 1.0)
    # More flags = higher score, but cap at 1.0
    fraud_score = min(len(detected_flags) / 5.0, 1.0)

    print(f"[FLORENCE] Detected flags: {detected_flags}, Score: {fraud_score}")

    return {
        "analysis": analysis,
        "fraud_score": fraud_score,
        "flags": detected_flags,
        "model": model_name,
    }


# ===== COMBINED WEB ENDPOINT =====

# Web endpoint image with FastAPI
web_image = modal.Image.debian_slim(python_version="3.11").pip_install(
    "fastapi", "pydantic"
)


@app.function(timeout=900, image=web_image)
@modal.asgi_app()
def fastapi_app():
    """
    FastAPI web endpoint for fraud detection.

    Endpoint: POST /analyze
    """
    import time

    from fastapi import FastAPI, HTTPException
    from fastapi.responses import JSONResponse
    from pydantic import BaseModel

    web_app = FastAPI()

    class InvoiceRequest(BaseModel):
        image: str  # base64 encoded image

    @web_app.post("/analyze")
    async def analyze_invoice_endpoint(request: InvoiceRequest):
        """
        Combined endpoint that runs CLIP and Florence-2 in parallel.

        Request body:
            {
                "image": "base64_encoded_image_string"
            }

        Response:
            {
                "success": true,
                "clip_embedding": [512 floats],
                "florence_analysis": {
                    "analysis": "...",
                    "fraud_score": 0.0-1.0,
                    "flags": [...]
                },
                "processing_time_seconds": 5.2
            }
        """
        start_time = time.time()

        try:
            print("[ENDPOINT] Received fraud detection request")

            # Decode base64 image
            try:
                image_bytes = base64.b64decode(request.image)
                print(f"[ENDPOINT] Decoded image: {len(image_bytes)} bytes")
            except Exception as e:
                raise HTTPException(
                    status_code=400, detail=f"Invalid base64 image: {str(e)}"
                )

            # Spawn both functions in parallel for faster processing
            print("[ENDPOINT] Spawning CLIP and Florence tasks in parallel...")

            clip_task = generate_clip_embedding.spawn(image_bytes)
            florence_task = detect_forgery_florence.spawn(image_bytes)

            # Wait for both to complete
            print("[ENDPOINT] Waiting for results...")
            clip_embedding = clip_task.get()
            florence_result = florence_task.get()

            processing_time = time.time() - start_time

            print(f"[ENDPOINT] Complete! Processing time: {processing_time:.2f}s")

            return JSONResponse(
                content={
                    "success": True,
                    "clip_embedding": clip_embedding,
                    "florence_analysis": florence_result,
                    "processing_time_seconds": round(processing_time, 2),
                }
            )

        except HTTPException:
            raise
        except Exception as e:
            processing_time = time.time() - start_time
            print(f"[ENDPOINT] Error after {processing_time:.2f}s: {str(e)}")
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
        print(f"⚠️  No test image found at {test_image_path}")
        print(
            "Please add a sample invoice image to modal/test_images/sample_invoice.jpg"
        )
        return

    print(f"📄 Testing with image: {test_image_path}")

    with open(test_image_path, "rb") as f:
        image_bytes = f.read()

    print("\n=== Testing CLIP Embedding ===")
    embedding = generate_clip_embedding.remote(image_bytes)
    print(f"✅ CLIP embedding: {len(embedding)} dimensions")
    print(f"   First 5 values: {embedding[:5]}")

    print("\n=== Testing Florence-2 Analysis ===")
    florence_result = detect_forgery_florence.remote(image_bytes)
    print(f"✅ Florence analysis:")
    print(f"   Description: {florence_result['analysis'][:200]}...")
    print(f"   Fraud score: {florence_result['fraud_score']}")
    print(f"   Flags: {florence_result['flags']}")

    print("\n✅ Both functions tested successfully!")
    print("\nTo test the web endpoint, deploy first:")
    print("  modal deploy modal/fraud_detection.py")
    print("\nThen use curl or Postman to POST to the /analyze endpoint")


# ===== UTILITY: COMPARE EMBEDDINGS =====


@app.function()
def compare_embeddings(embedding1: List[float], embedding2: List[float]) -> float:
    """
    Calculate cosine similarity between two CLIP embeddings.

    Args:
        embedding1: First 512-dim embedding
        embedding2: Second 512-dim embedding

    Returns:
        Similarity score 0.0-1.0 (1.0 = identical)

    Usage: similarity = compare_embeddings.remote(emb1, emb2)
    """
    import math

    # Cosine similarity: dot(A, B) / (||A|| * ||B||)
    dot_product = sum(a * b for a, b in zip(embedding1, embedding2))

    magnitude_a = math.sqrt(sum(a * a for a in embedding1))
    magnitude_b = math.sqrt(sum(b * b for b in embedding2))

    similarity = dot_product / (magnitude_a * magnitude_b)

    # Normalize to 0-1 range (cosine similarity is -1 to 1)
    normalized_similarity = (similarity + 1) / 2

    return normalized_similarity
