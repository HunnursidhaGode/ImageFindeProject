import os
import glob
import uuid
import multiprocessing
import time
import asyncio
from typing import List
from concurrent.futures import ProcessPoolExecutor
from threading import Thread
from fastapi import FastAPI, File, UploadFile, HTTPException, BackgroundTasks, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image
import numpy as np
import face_recognition
from database import load_db, save_db
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

app = FastAPI(title="Viniti Real-Time API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- GLOBAL STATE ---
EVENT_DB = load_db()
WATCH_FOLDER = None 
GALLERY_OPEN = False
MAIN_LOOP = None # Bridge for Thread -> Async communication

# --- WEBSOCKET MANAGER (THE TRAFFIC CONTROLLER) ---
class ConnectionManager:
    def __init__(self):
        # Stores active connections: [{"ws": websocket, "vector": numpy_array}]
        self.active_connections: List[dict] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        print("🔌 New Client Connected via WebSocket")

    def disconnect(self, websocket: WebSocket):
        self.active_connections = [c for c in self.active_connections if c["ws"] != websocket]
        print("🔌 Client Disconnected")

    async def register_user_face(self, websocket: WebSocket, image_bytes: bytes):
        """ Calculate vector for the connected user and store it in RAM """
        try:
            # Save temp file to read
            temp_filename = f"temp_{uuid.uuid4()}.jpg"
            with open(temp_filename, "wb") as f:
                f.write(image_bytes)
            
            img = face_recognition.load_image_file(temp_filename)
            # Use Jittering for the reference face too (Higher accuracy)
            encs = face_recognition.face_encodings(img, num_jitters=10)
            
            if os.path.exists(temp_filename):
                os.remove(temp_filename)

            if encs:
                # Store the WebSocket AND their Face Vector
                self.active_connections.append({
                    "ws": websocket, 
                    "vector": encs[0]
                })
                await websocket.send_json({"type": "STATUS", "message": "✅ Live Tracking Active"})
                print(f"👤 User registered for Live Updates. Total users: {len(self.active_connections)}")
            else:
                await websocket.send_json({"type": "ERROR", "message": "No face found in selfie"})
        except Exception as e:
            print(f"WS Error: {e}")

    async def check_and_notify(self, new_photo_path, new_photo_vector):
        """ Checks a new photo against ALL connected users """
        if not self.active_connections:
            return

        print(f"📡 Checking new photo against {len(self.active_connections)} live users...")
        
        STRICT_TOLERANCE = 0.50
        host = "localhost" # In production, this would be your dynamic IP
        port = "8000"

        for client in self.active_connections:
            # Compare New Photo vs Connected User
            dist = face_recognition.face_distance([client['vector']], new_photo_vector)
            score = dist[0]

            if score <= STRICT_TOLERANCE:
                # IT'S A MATCH! PUSH TO PHONE!
                # We construct the URL dynamically
                # NOTE: In a real deploy, 'host' needs to be the actual server IP, not localhost
                url = f"http://{host}:{port}/get-image?path={new_photo_path}"
                
                try:
                    await client['ws'].send_json({
                        "type": "NEW_MATCH",
                        "url": url,
                        "score": float(score)
                    })
                    print(f"   🔔 Pushed notification to user (Score: {score:.3f})")
                except:
                    print("   ⚠️ Failed to push (User might have disconnected)")

manager = ConnectionManager()

# --- CORE AI FUNCTION ---
def process_single_image(img_path):
    try:
        time.sleep(0.5) 
        img = Image.open(img_path).convert('RGB')
        img.thumbnail((800, 800)) 
        img_arr = np.array(img)
        
        locs = face_recognition.face_locations(img_arr, number_of_times_to_upsample=1)
        encodings = face_recognition.face_encodings(img_arr, known_face_locations=locs)

        if len(encodings) > 0:
            return {"status": "found", "path": img_path, "vectors": encodings}
    except Exception as e:
        print(f"⚠️ Error reading {img_path}: {e}")
    return {"status": "empty"}

# --- WATCHDOG HANDLER ---
class NewImageHandler(FileSystemEventHandler):
    def on_created(self, event):
        if event.is_directory: return
        filename = event.src_path
        if filename.lower().endswith(('.jpg', '.jpeg', '.png')):
            
            if any(entry['path'] == filename for entry in EVENT_DB): return

            print(f"\n⚡ NEW PHOTO DETECTED: {filename}")
            res = process_single_image(filename)
            
            if res["status"] == "found":
                if not any(entry['path'] == res['path'] for entry in EVENT_DB):
                    entry = {
                        "id": str(uuid.uuid4()),
                        "path": res["path"],
                        "vectors": res["vectors"]
                    }
                    EVENT_DB.append(entry)
                    save_db(EVENT_DB)
                    print(f"   🚀 LIVE ADDED: {os.path.basename(filename)}")

                    # --- TRIGGER WEBSOCKET BROADCAST ---
                    # We need to bridge the Sync Thread (Watchdog) to Async Loop (FastAPI)
                    if MAIN_LOOP:
                        # We use the first face found in the photo for notification comparison
                        # (Ideally, we loop through all faces in the photo, but this works for single-subject photos)
                        for vector in res["vectors"]:
                            asyncio.run_coroutine_threadsafe(
                                manager.check_and_notify(res["path"], vector), 
                                MAIN_LOOP
                            )
                else:
                    print(f"   🚫 Already indexed.")

# --- BACKGROUND THREAD FOR WATCHING ---
def start_watching(path):
    event_handler = NewImageHandler()
    observer = Observer()
    observer.schedule(event_handler, path, recursive=True)
    observer.start()
    print(f"👀 WATCH MODE ACTIVE: Monitoring {path} for new photos...")
    try:
        while True: time.sleep(1)
    except:
        observer.stop()
    observer.join()

# --- EXISTING BULK SCAN ---
def run_scan(folder_path):
    print(f"\n📂 STARTING BULK SCAN: {folder_path}")
    global WATCH_FOLDER
    WATCH_FOLDER = folder_path 

    image_files = []
    for ext in ['**/*.jpg', '**/*.jpeg', '**/*.png', '**/*.JPG']:
        image_files.extend(glob.glob(os.path.join(folder_path, ext), recursive=True))
    
    print(f"🔎 Found {len(image_files)} images. Indexing...")
    new_entries = []
    cpu_cores = max(1, multiprocessing.cpu_count() - 1)
    
    with ProcessPoolExecutor(max_workers=cpu_cores) as executor:
        results = executor.map(process_single_image, image_files)
        for res in results:
            if res["status"] == "found":
                if not any(e['path'] == res['path'] for e in EVENT_DB):
                    entry = {
                        "id": str(uuid.uuid4()),
                        "path": res["path"],
                        "vectors": res["vectors"]
                    }
                    EVENT_DB.append(entry)
                    new_entries.append(entry)

    if new_entries:
        save_db(EVENT_DB)
        print(f"🎉 Bulk Scan Done! Added {len(new_entries)} new photos.")
    
    watch_thread = Thread(target=start_watching, args=(folder_path,), daemon=True)
    watch_thread.start()

# --- API ENDPOINTS ---
class FolderRequest(BaseModel):
    path: str

@app.post("/scan-folder")
async def scan_folder(req: FolderRequest, bg_tasks: BackgroundTasks):
    path = req.path.strip('"')
    if not os.path.exists(path): raise HTTPException(400, "Folder does not exist")
    bg_tasks.add_task(run_scan, path)
    return {"message": "Scanning started!"}

@app.get("/all-photos")
async def get_all_photos(request: Request):
    if not GALLERY_OPEN: return {"matches": []}
    host = request.base_url.hostname 
    port = request.base_url.port
    matches = [{"url": f"http://{host}:{port}/get-image?path={entry['path']}"} for entry in reversed(EVENT_DB)]
    return {"matches": matches} 

@app.post("/search")
async def search_face(request: Request, file: UploadFile = File(...)):
    try:
        img = face_recognition.load_image_file(file.file)
        user_encs = face_recognition.face_encodings(img, num_jitters=10)
        if not user_encs: return {"matches": []}

        user_vec = user_encs[0]
        potential_matches = []
        host = request.base_url.hostname 
        port = request.base_url.port
        STRICT_TOLERANCE = 0.50

        for entry in EVENT_DB:
            face_dist = face_recognition.face_distance(entry["vectors"], user_vec)
            score = np.min(face_dist)
            if score <= STRICT_TOLERANCE:
                potential_matches.append({
                    "score": score,
                    "path": entry['path'],
                    "filename": os.path.basename(entry['path'])
                })
        
        potential_matches.sort(key=lambda x: x["score"])
        final_matches = [{"url": f"http://{host}:{port}/get-image?path={match['path']}"} for match in potential_matches]
        return {"matches": final_matches}
    except Exception as e: return {"error": str(e)}

@app.get("/get-image")
async def get_image(path: str):
    if os.path.exists(path): return FileResponse(path)
    return HTTPException(404)

@app.delete("/reset-db")
def reset_database():
    global EVENT_DB
    EVENT_DB = []
    save_db(EVENT_DB)
    return {"message": "Reset complete"}

# --- SECURITY ENDPOINTS ---
@app.get("/status")
def get_status(): return {"gallery_open": GALLERY_OPEN}

@app.post("/toggle-gallery")
def toggle_gallery():
    global GALLERY_OPEN
    GALLERY_OPEN = not GALLERY_OPEN
    return {"gallery_open": GALLERY_OPEN}

# --- NEW: WEBSOCKET ENDPOINT ---
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # 1. Wait for client to send selfie image bytes
            data = await websocket.receive_bytes()
            # 2. Register them for live updates
            await manager.register_user_face(websocket, data)
            # 3. Keep connection alive
            while True:
                await websocket.receive_text() # Just listen for pings
    except WebSocketDisconnect:
        manager.disconnect(websocket)

# --- STARTUP HOOK TO GET ASYNC LOOP ---
@app.on_event("startup")
async def startup_event():
    global MAIN_LOOP
    MAIN_LOOP = asyncio.get_running_loop()

if __name__ == "__main__":
    multiprocessing.freeze_support()
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)