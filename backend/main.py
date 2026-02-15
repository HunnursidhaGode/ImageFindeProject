import os
import glob
import uuid
import multiprocessing
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

# --- IMPROVED CORS FOR LOCAL NETWORK TESTING ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows your phone and laptop to communicate
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

EVENT_DB = load_db()
WATCH_FOLDER = None
GALLERY_OPEN = False
MAIN_LOOP = None

# ---------------- STATUS ----------------

@app.get("/status")
def get_status():
    return {"gallery_open": GALLERY_OPEN}

# ---------------- WEBSOCKET MANAGER ----------------

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[dict] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()

    def disconnect(self, websocket: WebSocket):
        self.active_connections = [c for c in self.active_connections if c["ws"] != websocket]

    async def register_user_face(self, websocket: WebSocket, image_bytes: bytes):
        temp_filename = f"temp_{uuid.uuid4()}.jpg"
        try:
            with open(temp_filename, "wb") as f:
                f.write(image_bytes)

            img = face_recognition.load_image_file(temp_filename)
            encs = face_recognition.face_encodings(img, num_jitters=1) # Reduced jitters for speed in live tracking

            if encs:
                # Disconnect previous registration for this specific socket if it exists
                self.disconnect(websocket)
                self.active_connections.append({
                    "ws": websocket,
                    "vector": encs[0]
                })
                await websocket.send_json({"type": "STATUS", "message": "Live Tracking Active"})
            else:
                await websocket.send_json({"type": "ERROR", "message": "No face found"})
        finally:
            if os.path.exists(temp_filename):
                os.remove(temp_filename)

    async def check_and_notify(self, new_photo_path, vector, base_url):
        for client in self.active_connections:
            score = face_recognition.face_distance([client["vector"]], vector)[0]
            if score <= 0.50:
                # Ensure the URL sent to the user uses the current base_url (Ngrok/Local IP)
                url = f"{base_url}get-image?path={new_photo_path}"
                try:
                    await client["ws"].send_json({
                        "type": "NEW_MATCH",
                        "url": url,
                        "score": float(score)
                    })
                except Exception:
                    self.disconnect(client["ws"])

manager = ConnectionManager()

# ---------------- CORE IMAGE PROCESS ----------------

def process_single_image(img_path):
    try:
        img = Image.open(img_path).convert("RGB")
        img.thumbnail((800, 800))
        arr = np.array(img)

        locs = face_recognition.face_locations(arr)
        encs = face_recognition.face_encodings(arr, locs)

        if encs:
            # Convert numpy arrays to lists for JSON storage if needed
            return {"status": "found", "path": img_path, "vectors": [v.tolist() for v in encs]}
    except Exception as e:
        print(f"Error processing {img_path}: {e}")
    return {"status": "empty"}

# ---------------- WATCHDOG ----------------

class NewImageHandler(FileSystemEventHandler):
    def __init__(self, loop, request_origin):
        self.loop = loop
        self.request_origin = request_origin

    def on_created(self, event):
        if event.is_directory or not event.src_path.lower().endswith((".jpg", ".jpeg", ".png")):
            return

        res = process_single_image(event.src_path)
        if res["status"] == "found":
            entry = {
                "id": str(uuid.uuid4()),
                "path": res["path"],
                "vectors": res["vectors"]
            }
            EVENT_DB.append(entry)
            save_db(EVENT_DB)

            if self.loop:
                for v in res["vectors"]:
                    # Ensure v is a numpy array for comparison
                    asyncio.run_coroutine_threadsafe(
                        manager.check_and_notify(res["path"], np.array(v), self.request_origin),
                        self.loop
                    )

def start_watching(path, loop, origin):
    observer = Observer()
    observer.schedule(NewImageHandler(loop, origin), path, recursive=True)
    observer.start()

# ---------------- BULK SCAN ----------------

def run_scan(folder_path, loop, origin):
    image_files = []
    for ext in ["**/*.jpg", "**/*.jpeg", "**/*.png"]:
        image_files.extend(glob.glob(os.path.join(folder_path, ext), recursive=True))

    with ProcessPoolExecutor() as exe:
        results = list(exe.map(process_single_image, image_files))
        for r in results:
            if r["status"] == "found":
                EVENT_DB.append({
                    "id": str(uuid.uuid4()),
                    "path": r["path"],
                    "vectors": r["vectors"]
                })

    save_db(EVENT_DB)
    Thread(target=start_watching, args=(folder_path, loop, origin), daemon=True).start()

# ---------------- API ROUTES ----------------

class FolderRequest(BaseModel):
    path: str

@app.post("/scan-folder")
async def scan_folder(req: FolderRequest, request: Request, bg: BackgroundTasks):
    origin = str(request.base_url)
    bg.add_task(run_scan, req.path, MAIN_LOOP, origin)
    return {"message": "Scanning started"}

@app.get("/all-photos")
async def all_photos(request: Request):
    base = str(request.base_url)
    return {"matches": [{"url": f"{base}get-image?path={e['path']}"} for e in EVENT_DB[::-1]]}

@app.post("/search")
async def search(request: Request, file: UploadFile = File(...)):
    img = face_recognition.load_image_file(file.file)
    enc = face_recognition.face_encodings(img, num_jitters=1) # Reduced for performance

    if not enc:
        return {"matches": []}

    user = enc[0]
    base = str(request.base_url)
    matches = []

    for e in EVENT_DB:
        # Convert stored list vectors back to numpy for distance calculation
        db_vectors = [np.array(v) for v in e["vectors"]]
        distances = face_recognition.face_distance(db_vectors, user)
        if any(d <= 0.50 for d in distances):
            matches.append({"url": f"{base}get-image?path={e['path']}"})

    return {"matches": matches}

@app.get("/get-image")
async def get_image(path: str):
    if os.path.exists(path):
        return FileResponse(path)
    raise HTTPException(status_code=404, detail="Image not found")

@app.delete("/reset-db")
def reset_db():
    global EVENT_DB
    EVENT_DB = []
    save_db(EVENT_DB)
    return {"message": "reset complete"}

@app.post("/toggle-gallery")
def toggle_gallery():
    global GALLERY_OPEN
    GALLERY_OPEN = not GALLERY_OPEN
    return {"gallery_open": GALLERY_OPEN}

# ---------------- WEBSOCKET ----------------

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await manager.connect(ws)
    try:
        while True:
            data = await ws.receive_bytes()
            await manager.register_user_face(ws, data)
    except WebSocketDisconnect:
        manager.disconnect(ws)

@app.on_event("startup")
async def startup():
    global MAIN_LOOP
    MAIN_LOOP = asyncio.get_running_loop()

if __name__ == "__main__":
    multiprocessing.freeze_support()
    import uvicorn
    # 0.0.0.0 is necessary to allow external devices (phones) to connect
    uvicorn.run(app, host="0.0.0.0", port=8000)