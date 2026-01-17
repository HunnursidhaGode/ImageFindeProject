import React, { useState, useEffect } from 'react';
import { FolderSearch, Play, Trash2, Database, Lock, Unlock, RefreshCw, ShieldAlert, X } from 'lucide-react';
import axios from 'axios';

const AdminPanel = ({ loading, setLoading }) => {
  const [path, setPath] = useState("");
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  
  // --- AUTH STATE ---
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(null); // 'RESET' or 'TOGGLE_LOCK'
  const [passwordInput, setPasswordInput] = useState("");

  // 🔒 THE ADMIN PASSWORD (Fixed!)
  const ADMIN_PASSWORD = "admin123"; 

  const API_URL = `http://${window.location.hostname}:8000`;

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      const res = await axios.get(`${API_URL}/status`);
      setIsGalleryOpen(res.data.gallery_open);
    } catch (err) {
      console.error("Backend offline");
    }
  };

  const handleScan = async () => {
    if (!path) return;
    setLoading(true);
    try {
      const cleanPath = path.replace(/"/g, ''); 
      const res = await axios.post(`${API_URL}/scan-folder`, { path: cleanPath });
      alert(res.data.message);
      setPath("");
    } catch (err) {
      alert("Error: Could not access folder.");
    }
    setLoading(false);
  };

  // --- STEP 1: TRIGGER AUTH ---
  const initiateAction = (actionType) => {
    setPendingAction(actionType);
    setPasswordInput(""); // Clear old password
    setShowAuthModal(true);
  };

  // --- STEP 2: VERIFY PASSWORD & EXECUTE ---
  const confirmAction = async () => {
    if (passwordInput !== ADMIN_PASSWORD) {
        alert("❌ WRONG PASSWORD! Access Denied.");
        return;
    }

    setShowAuthModal(false); // Close modal

    // Execute the pending action
    if (pendingAction === 'RESET') {
        try {
            await axios.delete(`${API_URL}/reset-db`);
            alert("✅ Database cleared successfully.");
        } catch (err) { alert("Error resetting DB."); }
    } 
    
    else if (pendingAction === 'TOGGLE_LOCK') {
        try {
            const res = await axios.post(`${API_URL}/toggle-gallery`);
            setIsGalleryOpen(res.data.gallery_open);
        } catch (err) { alert("Connection failed."); }
    }
  };

  return (
    <div className="bg-slate-900 text-white p-10 rounded-[2rem] shadow-2xl flex flex-col items-center text-center relative overflow-hidden h-full border border-slate-800">
      
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -translate-y-10 translate-x-10"></div>

      <div className="w-20 h-20 bg-slate-800 rounded-2xl flex items-center justify-center text-indigo-400 mb-6 border border-slate-700 relative z-10">
        <FolderSearch size={36} />
      </div>
      
      <h2 className="text-3xl font-bold mb-2">Photographer Zone</h2>
      <p className="text-slate-400 mb-8 max-w-sm text-sm">
        Enter the folder path to index photos.
      </p>
      
      <div className="w-full space-y-4 relative z-10">
        <input 
          type="text" 
          placeholder="e.g. D:\Events\Wedding_2026" 
          value={path}
          onChange={(e) => setPath(e.target.value)}
          className="w-full p-4 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors text-center font-mono text-sm"
        />
        
        <button 
          onClick={handleScan}
          disabled={loading || !path}
          className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 rounded-xl font-bold flex justify-center items-center gap-2 transition-all active:scale-95"
        >
          {loading ? <RefreshCw className="animate-spin" /> : <><Play size={20} /> Start Indexing</>}
        </button>

        {/* --- PROTECTED BUTTON 1: RESET --- */}
        <button 
          onClick={() => initiateAction('RESET')}
          className="w-full py-3 bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 rounded-xl font-medium flex justify-center items-center gap-2 transition-all text-sm"
        >
          <Trash2 size={16} /> Reset Database
        </button>

        {/* --- PROTECTED BUTTON 2: LOCK TOGGLE --- */}
        <div className="pt-4 border-t border-slate-800 mt-4">
            <h3 className="text-xs font-semibold text-slate-500 mb-3 uppercase tracking-wider">Guest Access Control</h3>
            <button 
                onClick={() => initiateAction('TOGGLE_LOCK')}
                className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all border
                ${isGalleryOpen 
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20" 
                    : "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700"
                }`}
            >
                {isGalleryOpen ? <Unlock size={18} /> : <Lock size={18} />}
                {isGalleryOpen ? "Gallery is UNLOCKED" : "Gallery is LOCKED"}
            </button>
            <p className="text-[10px] text-slate-500 mt-2">
                {isGalleryOpen 
                    ? "Guests can skip face search." 
                    : "Guests MUST use face search."}
            </p>
        </div>
      </div>

      <div className="mt-auto pt-6 flex items-center gap-2 text-xs text-slate-500">
        <Database size={12} />
        <span>Local Storage • Secure</span>
      </div>

      {/* --- 🔐 SECURITY POPUP MODAL --- */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white text-slate-900 p-8 rounded-3xl shadow-2xl max-w-sm w-full relative">
                
                <button 
                    onClick={() => setShowAuthModal(false)}
                    className="absolute top-4 right-4 p-2 bg-slate-100 rounded-full hover:bg-slate-200 text-slate-500"
                >
                    <X size={20} />
                </button>

                <div className="flex justify-center mb-4 text-amber-500">
                    <ShieldAlert size={48} />
                </div>
                
                <h3 className="text-xl font-bold text-center mb-2">Admin Access Required</h3>
                <p className="text-slate-500 text-center text-sm mb-6">
                    {pendingAction === 'RESET' 
                        ? "Deleting the database requires authorization." 
                        : "Changing gallery access requires authorization."}
                </p>

                <input 
                    type="password" 
                    autoFocus
                    placeholder="Enter Admin Password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && confirmAction()}
                    className="w-full p-3 bg-slate-100 rounded-xl border border-slate-200 mb-4 focus:outline-none focus:border-indigo-500 text-center font-bold tracking-widest"
                />

                <button 
                    onClick={confirmAction}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all active:scale-95"
                >
                    Confirm Access
                </button>
            </div>
        </div>
      )}

    </div>
  );
};

export default AdminPanel;