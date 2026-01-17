import json
import os
import numpy as np

DB_FILE = "viniti_db.json"

def load_db():
    """Loads the face index from disk."""
    if not os.path.exists(DB_FILE):
        return []
    print("📂 Loading Viniti Database...")
    try:
        with open(DB_FILE, "r") as f:
            data = json.load(f)
            # Convert lists back to numpy arrays for AI
            for entry in data:
                entry["vectors"] = [np.array(v) for v in entry["vectors"]]
            return data
    except Exception as e:
        print(f"❌ DB Error: {e}")
        return []

def save_db(db):
    """Saves the face index to disk."""
    print("💾 Saving Viniti Database...")
    serialized_db = []
    for entry in db:
        serialized_db.append({
            "id": entry["id"],
            "path": entry["path"],
            "vectors": [v.tolist() for v in entry["vectors"]]
        })
    with open(DB_FILE, "w") as f:
        json.dump(serialized_db, f)