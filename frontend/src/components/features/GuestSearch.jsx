import React, { useRef, useState, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import { Camera, Search, Video, VideoOff, RefreshCw, Image as ImageIcon, Power, Grid } from 'lucide-react';

// 1. Added 'isGalleryOpen' to props
const GuestSearch = ({ onSearch, onViewAll, loading, isGalleryOpen }) => {
  const webcamRef = useRef(null);
  const fileInputRef = useRef(null);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [error, setError] = useState(null);

  // Auto-start camera on mount
  useEffect(() => {
    setIsCameraOn(true);
  }, []);

  const videoConstraints = {
    width: 720,
    height: 720,
    facingMode: "user"
  };

  const capture = useCallback(async () => {
    if (!isCameraOn) return alert("Please turn on the camera first.");
    
    const src = webcamRef.current?.getScreenshot();
    
    if (src) {
      const blob = await (await fetch(src)).blob();
      const file = new File([blob], "selfie.jpg", { type: "image/jpeg" });
      onSearch(file);
    } else {
      alert("Camera is loading... please wait.");
    }
  }, [webcamRef, onSearch, isCameraOn]);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) onSearch(file);
  };

  const toggleCamera = () => {
    setIsCameraOn(!isCameraOn);
    setError(null);
  };

  return (
    <div className="bg-white p-6 md:p-8 rounded-[2rem] shadow-xl border border-slate-100 flex flex-col items-center text-center h-full relative w-full">
      
      <input 
        type="file" 
        accept="image/*" 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
        className="hidden" 
      />

      <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-4">
        <Camera size={32} />
      </div>
      
      <h2 className="text-2xl font-bold text-slate-800 mb-1">Guest Zone</h2>
      <p className="text-slate-500 mb-6 text-sm">
        Scan your face or upload a photo.
      </p>

      {/* --- CAMERA WINDOW --- */}
      <div className="relative rounded-2xl overflow-hidden shadow-lg border-4 border-slate-900 bg-black aspect-square w-full max-w-xs mb-6 group">
        
        {/* The Toggle Button */}
        <button 
          onClick={toggleCamera}
          className={`absolute top-3 right-3 z-20 p-2 rounded-full backdrop-blur-md transition-all shadow-md flex items-center gap-2 text-xs font-bold
            ${isCameraOn 
              ? "bg-red-500/20 text-red-200 hover:bg-red-500/40 border border-red-500/30" 
              : "bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/40 border border-emerald-500/30"
            }`}
        >
          {isCameraOn ? <Power size={14} /> : <Video size={14} />}
          {isCameraOn ? "Stop" : "Start"}
        </button>

        {isCameraOn ? (
          <Webcam 
            ref={webcamRef} 
            screenshotFormat="image/jpeg" 
            className="w-full h-full object-cover" 
            videoConstraints={videoConstraints}
            mirrored={true}
            onUserMediaError={() => setError("Camera blocked.")}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 bg-slate-900">
            <VideoOff size={48} className="mb-2 opacity-50" />
            <p className="text-sm">Camera is Off</p>
            <button 
                onClick={toggleCamera}
                className="mt-4 text-indigo-400 text-xs hover:underline"
            >
                Tap to turn on
            </button>
          </div>
        )}

        {error && isCameraOn && (
          <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center text-white p-4 z-10">
            <p className="text-xs mb-2 text-red-300">Camera Access Denied</p>
            <button onClick={toggleCamera} className="px-3 py-1 bg-white/10 rounded text-[10px]">Retry</button>
          </div>
        )}
      </div>

      {/* --- ACTION BUTTONS --- */}
      <div className="w-full max-w-xs space-y-3">
        
        {/* 1. Scan Face */}
        <button 
          onClick={capture} 
          disabled={loading || !isCameraOn || !!error}
          className={`w-full py-3.5 rounded-xl font-bold flex justify-center items-center gap-2 shadow-lg transition-all active:scale-95 
            ${!isCameraOn 
                ? "bg-slate-200 text-slate-400 cursor-not-allowed" 
                : "bg-indigo-600 text-white hover:bg-indigo-700"
            }`}
        >
          {loading ? (
            <><RefreshCw className="animate-spin" size={20} /> Scanning...</>
          ) : (
            <><Search size={20} /> {isCameraOn ? "Scan Face" : "Turn Camera On"}</>
          )}
        </button>

        <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="flex-shrink mx-4 text-slate-400 text-xs font-medium uppercase">OR</span>
            <div className="flex-grow border-t border-slate-200"></div>
        </div>

        {/* 2. Upload from Gallery */}
        <button 
          onClick={() => fileInputRef.current.click()}
          disabled={loading}
          className="w-full py-3.5 bg-white border-2 border-indigo-100 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-200 rounded-xl font-bold flex justify-center items-center gap-2 transition-all active:scale-95"
        >
          <ImageIcon size={20} /> Upload from Gallery
        </button>

        {/* 3. NEW: CONDITIONAL VIEW FULL GALLERY BUTTON */}
        {/* Only visible if Photographer unlocks it */}
        {isGalleryOpen && (
            <div className="pt-2 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <button 
                    onClick={onViewAll}
                    className="w-full py-3 text-slate-500 hover:text-indigo-600 hover:bg-slate-50 rounded-xl font-medium text-sm flex justify-center items-center gap-2 transition-colors"
                >
                    <Grid size={16} /> Skip & View Full Gallery
                </button>
            </div>
        )}

      </div>
    </div>
  );
};

export default GuestSearch;