import React from 'react';
import { Download, ArrowLeft } from 'lucide-react';

const Results = ({ matches, onBack }) => {
  return (
    <div className="w-full max-w-6xl animate-in fade-in slide-in-from-bottom-4">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold text-slate-800">
          We found <span className="text-indigo-600">{matches.length} photos</span> of you
        </h2>
        <button onClick={onBack} className="text-slate-500 hover:text-slate-800 flex items-center gap-2 font-medium">
          <ArrowLeft size={20} /> Back
        </button>
      </div>

      {matches.length === 0 ? (
        <div className="text-center py-24 bg-white rounded-3xl border border-dashed border-slate-300">
          <p className="text-slate-500 text-lg">No matches found. Try a different angle or lighting.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {matches.map((m, i) => (
            <div key={i} className="group relative rounded-2xl overflow-hidden shadow-sm bg-slate-100 hover:shadow-xl transition-all duration-300">
              <img src={m.url} className="w-full h-64 object-cover" alt="Match" loading="lazy" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
              <a 
                href={m.url} 
                download 
                className="absolute bottom-4 right-4 p-3 bg-white text-slate-900 rounded-full shadow-lg opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all"
              >
                <Download size={20} />
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
export default Results;