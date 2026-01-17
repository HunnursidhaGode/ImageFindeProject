import React from 'react';
import { QRCodeCanvas } from 'qrcode.react'; 
import { X } from 'lucide-react';

const QRCodeModal = ({ onClose }) => {
  // 1. DYNAMICALLY GET THE IP ADDRESS
  // This grabs whatever is in your browser address bar (e.g., 192.168.1.5)
  const currentHost = window.location.hostname; 
  const currentPort = window.location.port;
  
  // 2. CONSTRUCT THE MOBILE URL
  // We force the protocol to http:// and append ?mode=guest
  const guestUrl = `http://${currentHost}:${currentPort}/?mode=guest`;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white p-8 rounded-3xl shadow-2xl relative max-w-sm w-full text-center border-4 border-white/20">
        
        <button onClick={onClose} className="absolute top-4 right-4 bg-slate-100 p-2 rounded-full hover:bg-slate-200 hover:text-red-500 transition-all">
          <X size={24} />
        </button>
        
        <h3 className="text-2xl font-bold text-slate-800 mb-2">Scan to Join</h3>
        <p className="text-slate-500 text-sm mb-6">Make sure phone is on same WiFi!</p>
        
        <div className="bg-white p-4 rounded-xl border-2 border-slate-100 inline-block shadow-inner mb-4">
          <QRCodeCanvas value={guestUrl} size={220} />
        </div>
        
        {/* VISUAL CHECK: Ensure this prints the IP, NOT localhost */}
        <div className="text-xs text-indigo-600 font-mono bg-indigo-50 py-3 px-4 rounded-xl break-all border border-indigo-100">
          {guestUrl}
        </div>

      </div>
    </div>
  );
};

export default QRCodeModal;