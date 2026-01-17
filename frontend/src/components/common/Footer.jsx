import React from 'react';

const Footer = () => {
  return (
    // 🎨 THEME UPDATE: Dark Background with Light Text
    <footer className="mt-auto py-8 bg-slate-900 border-t border-slate-800 text-center">
      <p className="text-slate-400 text-sm font-medium">
        © {new Date().getFullYear()} Viniti Image Finder. 
        <span className="mx-2 text-slate-600">•</span> 
        <span className="text-slate-500">Designed for Professional Events</span>
      </p>
    </footer>
  );
};

export default Footer;