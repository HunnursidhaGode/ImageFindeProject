import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Bell } from 'lucide-react';

// Layout
import Header from './components/common/Header';
import Footer from './components/common/Footer';
import QRCodeModal from './components/features/QRCodeModal';

// Features
import AdminPanel from './components/features/AdminPanel';
import GuestSearch from './components/features/GuestSearch';
import Results from './components/features/Results';

const App = () => {
  const [view, setView] = useState("home"); 
  const [showQR, setShowQR] = useState(false);
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState([]);
  const [isMobileGuest, setIsMobileGuest] = useState(false);
  
  // --- STATE: Gallery Lock ---
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);

  // --- NEW STATE: Live Notifications ---
  const [wsStatus, setWsStatus] = useState("disconnected");
  const wsRef = useRef(null);
  const [newPhotoNotification, setNewPhotoNotification] = useState(false);

  const API_URL = `http://${window.location.hostname}:8000`;
  const WS_URL = `ws://${window.location.hostname}:8000/ws`;

  // Check if we are on mobile/guest mode AND Start Polling Status
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("mode") === "guest") {
      setIsMobileGuest(true);
    }

    // 1. Check Gallery Status
    checkGalleryStatus();
    const interval = setInterval(checkGalleryStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const checkGalleryStatus = async () => {
    try {
        const res = await axios.get(`${API_URL}/status`);
        setIsGalleryOpen(res.data.gallery_open);
    } catch(e) { 
        // Silent fail
    }
  };

  // --- WEBSOCKET LOGIC (THE LIVE TUNNEL) ---
  const startLiveConnection = (file) => {
    // Close old connection if exists
    if (wsRef.current) wsRef.current.close();

    const socket = new WebSocket(WS_URL);
    wsRef.current = socket;

    socket.onopen = () => {
        setWsStatus("connected");
        console.log("🟢 Connected to Live Updates");
        // Send the raw image file to register for updates
        socket.send(file); 
    };

    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === "NEW_MATCH") {
            console.log("🔔 NEW PHOTO RECEIVED:", data.url);
            
            // 1. Show notification bubble
            setNewPhotoNotification(true);
            setTimeout(() => setNewPhotoNotification(false), 5000);

            // 2. Add new photo to the TOP of the list
            setMatches(prev => [{ url: data.url, isNew: true }, ...prev]);
        }
    };

    socket.onclose = () => setWsStatus("disconnected");
  };

  // 1. Search by Face
  const handleSearch = async (file) => {
    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      // Step A: Standard HTTP Search (Get Past Photos)
      const res = await axios.post(`${API_URL}/search`, formData);
      setMatches(res.data.matches || []);
      
      // Step B: Start WebSocket (Listen for Future Photos)
      startLiveConnection(file);

      setView("results");
    } catch (err) {
      console.error(err);
      alert("Connection Failed. Ensure you are on the same WiFi.");
    }
    setLoading(false);
  };

  // 2. View All Photos (No Face Search)
  const handleViewAll = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/all-photos`);
      setMatches(res.data.matches || []);
      setView("results");
    } catch (err) {
      console.error(err);
      alert("Could not load full gallery. Check server.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans text-slate-900 w-full overflow-x-hidden relative">
      
      {/* --- LIVE NOTIFICATION POPUP --- */}
      {newPhotoNotification && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-sm animate-in slide-in-from-top-4 fade-in duration-300">
            <div className="bg-indigo-600 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 border border-indigo-400/30 backdrop-blur-md">
                <div className="bg-white/20 p-2 rounded-full animate-bounce">
                    <Bell size={24} className="text-white" />
                </div>
                <div>
                    <h4 className="font-bold text-sm">New Photo Found!</h4>
                    <p className="text-indigo-100 text-xs">A new photo of you was just added.</p>
                </div>
            </div>
        </div>
      )}

      {/* Header spanning full width */}
      <Header 
        onReset={() => setView("home")} 
        onShowQR={!isMobileGuest ? () => setShowQR(true) : null} 
      />
      
      {/* Main Container */}
      <main className="flex-grow w-full max-w-none px-4 md:px-8 py-6 flex flex-col justify-center">
        
        {view === "home" && (
          <div className={`${isMobileGuest ? 'flex justify-center' : 'grid lg:grid-cols-2'} gap-8 items-stretch h-full w-full`}>
             
            {/* Left Side: Admin Panel (Hidden on Guest Mobile) */}
            {!isMobileGuest && (
              <div className="w-full h-full">
                <AdminPanel loading={loading} setLoading={setLoading} />
              </div>
            )}
            
            {/* Right Side: Guest Search Zone */}
            <div className={`w-full h-full flex justify-center ${isMobileGuest ? "max-w-lg mx-auto" : ""}`}>
               <div className="w-full h-full">
                 <GuestSearch 
                    onSearch={handleSearch} 
                    onViewAll={handleViewAll} 
                    loading={loading}
                    isGalleryOpen={isGalleryOpen} 
                 />
               </div>
            </div>

          </div>
        )}

        {/* Results Page */}
        {view === "results" && (
          <Results matches={matches} onBack={() => setView("home")} />
        )}

      </main>

      <Footer />
      {showQR && <QRCodeModal onClose={() => setShowQR(false)} />}
    </div>
  );
};

export default App;