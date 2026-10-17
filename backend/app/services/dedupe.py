import math
from typing import Dict, Any, List, Optional, Tuple
from rapidfuzz import fuzz
from app.core.logging import logger

_model = None

def get_sentence_transformer_model():
    """
    Lazy loads sentence-transformers model. If unavailable or fails, returns None
    so rapidfuzz fallback is used cleanly.
    """
    global _model
    if _model is not None:
        return _model
    try:
        from sentence_transformers import SentenceTransformer
        _model = SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2")
        logger.info("Loaded multilingual MiniLM sentence transformer model successfully")
    except Exception as e:
        logger.warn("sentence-transformers model could not be loaded; using rapidfuzz fallback", error=str(e))
        _model = False
    return _model if _model is not False else None


def haversine_distance_meters(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    """
    Computes great-circle distance between two points in meters.
    """
    R = 6371000.0  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c


def calculate_semantic_similarity(text1: str, text2: str) -> float:
    """
    Calculates semantic similarity between two report texts [0.0 to 1.0].
    Supports English, Urdu, and Roman Urdu. Uses multilingual embeddings if available,
    falling back seamlessly to rapidfuzz token-set similarity.
    """
    if not text1 or not text2:
        return 0.0

    model = get_sentence_transformer_model()
    if model is not None:
        try:
            embeddings = model.encode([text1, text2], convert_to_tensor=True)
            from sentence_transformers import util
            sim = util.cos_sim(embeddings[0], embeddings[1]).item()
            return max(0.0, min(1.0, float(sim)))
        except Exception as e:
            logger.warn("Embedding similarity failed; falling back to rapidfuzz", error=str(e))

    # RapidFuzz fallback (token set ratio handles reordered words across Roman Urdu / English)
    ratio = fuzz.token_set_ratio(text1, text2) / 100.0
    return float(ratio)


def find_matching_cluster(
    new_text: str,
    new_lon: float,
    new_lat: float,
    existing_reports: List[Dict[str, Any]],
    radius_meters: float = 150.0,
    similarity_threshold: float = 0.65,
) -> Optional[Tuple[str, float]]:
    """
    Checks if a new incoming report matches any recent reports within spatial radius (150m)
    AND text/semantic similarity (>0.65).
    Returns (cluster_id, similarity) or None if unique.
    """
    for rep in existing_reports:
        rep_lon = rep.get("lon")
        rep_lat = rep.get("lat")
        rep_text = rep.get("raw_text", "")
        cluster_id = rep.get("cluster_id") or rep.get("id")

        if rep_lon is not None and rep_lat is not None:
            dist = haversine_distance_meters(new_lon, new_lat, rep_lon, rep_lat)
            if dist <= radius_meters:
                sim = calculate_semantic_similarity(new_text, rep_text)
                if sim >= similarity_threshold:
                    logger.info("Found duplicate/clustered report", cluster_id=cluster_id, distance_m=round(dist, 1), similarity=round(sim, 2))
                    return cluster_id, sim

    return None
