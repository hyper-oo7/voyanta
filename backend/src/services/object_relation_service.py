import logging
import math
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0 # Earth's radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def get_lat_lng(obj: dict) -> Optional[tuple]:
    attrs = obj.get("attributes") or {}
    lat = attrs.get("latitude") or attrs.get("lat")
    lng = attrs.get("longitude") or attrs.get("lng")
    try:
        if lat is not None and lng is not None:
            return float(lat), float(lng)
    except (ValueError, TypeError):
        pass
    return None

def get_area(obj: dict) -> Optional[str]:
    area = obj.get("area")
    if not area:
        attrs = obj.get("attributes") or {}
        area = attrs.get("area")
    if isinstance(area, str) and area.strip():
        return area.strip().lower()
    return None

def compute_and_save_nearby_relations(inserted_objects: List[dict], db_client):
    """
    Computes nearby relations for newly inserted knowledge objects by comparing
    them against all other active knowledge objects in the same destination.
    Inserts/upserts relations in both directions.
    """
    if not inserted_objects:
        return
        
    try:
        # Fetch all active knowledge objects in the same destinations as the new objects
        destinations = list({obj["destination"] for obj in inserted_objects if obj.get("destination")})
        if not destinations:
            return
            
        # Get all active objects in these destinations
        existing_res = db_client.table("knowledge_objects")\
            .select("id, name, destination, area, attributes")\
            .eq("is_active", True)\
            .in_("destination", destinations)\
            .execute()
            
        all_objects = existing_res.data or []
        if not all_objects:
            return

        relation_records = []
        
        # Build a list of candidate pairs to compare
        for new_obj in inserted_objects:
            new_id = new_obj["id"]
            new_dest = new_obj.get("destination")
            new_lat_lng = get_lat_lng(new_obj)
            new_area = get_area(new_obj)
            
            for other_obj in all_objects:
                other_id = other_obj["id"]
                if new_id == other_id:
                    continue
                if other_obj.get("destination") != new_dest:
                    continue
                    
                other_lat_lng = get_lat_lng(other_obj)
                other_area = get_area(other_obj)
                
                distance_minutes = None
                
                # Check lat/lng first
                if new_lat_lng and other_lat_lng:
                    dist_km = haversine_distance(new_lat_lng[0], new_lat_lng[1], other_lat_lng[0], other_lat_lng[1])
                    if dist_km <= 10.0: # within 10 km
                        distance_minutes = max(1, int(dist_km * 2.0))
                
                # Check area match if no lat/lng match
                elif new_area and other_area and new_area == other_area:
                    distance_minutes = 10
                    
                if distance_minutes is not None:
                    # Add bidirectional records
                    relation_records.append({
                        "object_a_id": new_id,
                        "object_b_id": other_id,
                        "relation_type": "nearby",
                        "distance_minutes": distance_minutes,
                        "confidence_level": "high"
                    })
                    relation_records.append({
                        "object_a_id": other_id,
                        "object_b_id": new_id,
                        "relation_type": "nearby",
                        "distance_minutes": distance_minutes,
                        "confidence_level": "high"
                    })
                    
        if relation_records:
            db_client.table("object_relations").upsert(relation_records).execute()
            logger.info(f"[ObjectRelations] Inserted {len(relation_records)} nearby relations.")
    except Exception as e:
        logger.error(f"[ObjectRelations] Failed to compute and save nearby relations: {e}")

def process_and_save_extracted_relations(extracted_objects: List[dict], inserted_map: dict, db_client):
    """
    Resolves LLM-proposed relations (pairs_well_with, alternative_to)
    and saves them in the database.
    
    extracted_objects: list of dicts directly from the LLM extraction payload.
    inserted_map: dict mapping (name, object_type) -> database UUID.
    """
    relation_records = []
    
    try:
        for obj in extracted_objects:
            if not isinstance(obj, dict):
                continue
                
            name = obj.get("name")
            obj_type = obj.get("object_type")
            if not name or not obj_type:
                continue
                
            # Find the database ID of Object A
            obj_a_id = inserted_map.get((name, obj_type))
            if not obj_a_id:
                continue
                
            relations = obj.get("relations") or []
            if not isinstance(relations, list):
                continue
                
            for rel in relations:
                if not isinstance(rel, dict):
                    continue
                    
                rel_type = rel.get("relation_type")
                target_name = rel.get("target_object_name")
                confidence = rel.get("confidence_level") or "medium"
                
                if rel_type not in ("pairs_well_with", "alternative_to", "nearby") or not target_name:
                    continue
                    
                # Resolve Object B
                obj_b_id = None
                
                # Check if Object B is in the currently extracted batch
                for (n, t), uuid_val in inserted_map.items():
                    if n.lower() == target_name.lower():
                        obj_b_id = uuid_val
                        break
                        
                # If not found in current batch, query database by name (case-insensitive)
                if not obj_b_id:
                    db_res = db_client.table("knowledge_objects")\
                        .select("id")\
                        .ilike("name", target_name)\
                        .eq("is_active", True)\
                        .limit(1)\
                        .execute()
                    if db_res.data:
                        obj_b_id = db_res.data[0]["id"]
                        
                if obj_a_id and obj_b_id and obj_a_id != obj_b_id:
                    # Insert in both directions
                    relation_records.append({
                        "object_a_id": obj_a_id,
                        "object_b_id": obj_b_id,
                        "relation_type": rel_type,
                        "confidence_level": confidence,
                        "is_dismissed": False
                    })
                    relation_records.append({
                        "object_a_id": obj_b_id,
                        "object_b_id": obj_a_id,
                        "relation_type": rel_type,
                        "confidence_level": confidence,
                        "is_dismissed": False
                    })
                    
        if relation_records:
            db_client.table("object_relations").upsert(relation_records).execute()
            logger.info(f"[ObjectRelations] Inserted {len(relation_records)} extracted relations.")
    except Exception as e:
        logger.error(f"[ObjectRelations] Failed to process and save extracted relations: {e}")
