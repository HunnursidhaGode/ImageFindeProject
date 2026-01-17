import React from 'react';
import { Camera, QrCode, RefreshCcw } from 'lucide-react';

const Header = ({ onReset, onShowQR }) => {
  return (
    // 1. MAIN BACKGROUND: Changed to Indigo-600
    <header className="bg-indigo-600 text-white shadow-lg sticky top-0 z-50 border-b border-indigo-700">
      
      {/* 2. WIDTH: Changed max-w-6xl to w-full/max-w-[96%] to match your new layout */}
      <div className="w-full max-w-[96%] mx-auto px-4 h-20 flex justify-between items-center">
        
        {/* Branding */}
        <div onClick={onReset} className="flex items-center gap-3 cursor-pointer group">
          {/* Logo Box: White background with Indigo Icon */}
          <div className="bg-white p-2.5 rounded-xl text-indigo-600 shadow-lg group-hover:rotate-3 transition-transform">
            <Camera size={24} />
          </div>
          
          {/* Title: Pure White Text */}
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Viniti Image Finder
          </h1>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-3">
          
          {/* Mobile Code Button: Transparent White */}
          {onShowQR && (
            <button 
              onClick={onShowQR} 
              className="flex items-center gap-2 px-4 py-2 text-indigo-100 hover:text-white hover:bg-white/10 rounded-full transition-all font-medium border border-transparent hover:border-white/20"
            >
              <QrCode size={20} /> 
              <span className="hidden md:inline">Mobile Code</span>
            </button>
          )}

          {/* Reset Button: White Background (High Contrast) */}
          <button 
            onClick={onReset} 
            className="flex items-center gap-2 text-sm font-bold text-indigo-700 bg-white px-5 py-2.5 rounded-full hover:bg-indigo-50 transition-colors shadow-md active:scale-95"
          >
            <RefreshCcw size={16} />
            <span className="hidden sm:inline">Reset App</span>
          </button>
          
        </div>
      </div>
    </header>
  );
};

export default Header;