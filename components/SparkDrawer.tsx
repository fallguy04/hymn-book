"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Music, Plus, Trash2, Star, ChevronRight } from "lucide-react";
import hymns from "@/data/hymns.json";

interface SparkDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectHymn: (num: number) => void; 
  meter?: string;
}

interface SavedTune {
  name: string;
  meter: string;
}

export default function SparkDrawer({ isOpen, onClose, onSelectHymn, meter }: SparkDrawerProps) {
  const [activeTab, setActiveTab] = useState<'TUNES' | 'FAVORITES'>('TUNES');
  const [tunes, setTunes] = useState<SavedTune[]>([]);
  const [favorites, setFavorites] = useState<number[]>([]);
  const [newTune, setNewTune] = useState("");

  useEffect(() => {
    if (isOpen) {
      const savedTunes = localStorage.getItem("spark_tunes");
      const savedFavs = localStorage.getItem("hymn_favorites");
      if (savedTunes) setTunes(JSON.parse(savedTunes));
      if (savedFavs) setFavorites(JSON.parse(savedFavs));
    }
  }, [isOpen]);

  const saveTune = () => {
    if (!newTune.trim() || !meter) return;
    const updated = [...tunes, { name: newTune.trim(), meter: meter }];
    setTunes(updated);
    localStorage.setItem("spark_tunes", JSON.stringify(updated));
    setNewTune("");
  };

  // ✅ Keep your meter-specific filtering
  const filteredTunes = tunes.filter(t => t.meter === meter);

  const deleteTune = (tuneName: string) => {
    // Better to delete by name/meter to avoid index mismatches in filtered lists
    const updated = tunes.filter((t) => t.name !== tuneName);
    setTunes(updated);
    localStorage.setItem("spark_tunes", JSON.stringify(updated));
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-paper-ink/20 z-[60] backdrop-blur-sm"
          />

          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed bottom-0 left-0 right-0 bg-paper border-t border-paper-ink/10 rounded-t-3xl z-[70] h-[80vh] flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="p-6 border-b border-paper-ink/10">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="font-serif text-2xl text-paper-ink tracking-tight">Deacon's Drawer</h2>
                  <p className="text-[10px] font-sans font-bold text-paper-ink/40 tracking-[0.2em] uppercase mt-1">
                    {activeTab === 'TUNES' ? `TUNE REPERTOIRE • ${meter}` : 'STARRED SELECTIONS'}
                  </p>
                </div>
                <button onClick={onClose} className="p-2 bg-paper-ink/5 rounded-full">
                  <X className="w-5 h-5 text-paper-ink/60" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex bg-paper-ink/5 p-1 rounded-xl">
                <button
                  onClick={() => setActiveTab('TUNES')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'TUNES' ? 'bg-paper text-paper-ink shadow-sm' : 'text-paper-ink/40'}`}
                >
                  <Music className="w-3.5 h-3.5" /> TUNES
                </button>
                <button
                  onClick={() => setActiveTab('FAVORITES')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'FAVORITES' ? 'bg-paper text-paper-ink shadow-sm' : 'text-paper-ink/40'}`}
                >
                  <Star className="w-3.5 h-3.5" /> FAVORITES
                </button>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === 'TUNES' ? (
                <div className="space-y-3">
                  {/* Tab 1: Now shows the tunes matching the current meter */}
                  {filteredTunes.map((tune, i) => (
                    <div key={i} className="flex justify-between items-center p-4 bg-paper-ink/[0.03] border border-paper-ink/5 rounded-2xl">
                      <span className="font-serif text-lg text-paper-ink">{tune.name}</span>
                      <button onClick={() => deleteTune(tune.name)} className="p-2 text-paper-ink/20 hover:text-red-400 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {filteredTunes.length === 0 && (
                    <p className="text-center py-10 font-serif italic opacity-30">No {meter} tunes cataloged.</p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Tab 2: Show Actual Starred Hymns from JSON */}
                  {favorites.map((num) => {
                    const hymn = hymns.find(h => h.number === num);
                    return (
                      <button 
                        key={num}
                        onClick={() => { onSelectHymn(num); onClose(); }}
                        className="w-full flex justify-between items-center p-4 bg-paper-ink/[0.03] border border-paper-ink/5 rounded-2xl text-left active:bg-paper-ink/5 transition-colors"
                      >
                        <div>
                          <span className="block text-[10px] font-bold opacity-40 mb-1">#{num}</span>
                          <span className="font-serif text-lg text-paper-ink">{hymn?.title || "Unknown Hymn"}</span>
                        </div>
                        <ChevronRight className="w-5 h-5 text-paper-ink/20" />
                      </button>
                    );
                  })}
                  {favorites.length === 0 && (
                    <p className="text-center py-10 font-serif italic opacity-30">No starred selections yet.</p>
                  )}
                </div>
              )}
            </div>

            {/* Input Area */}
            {activeTab === 'TUNES' && (
              <div className="p-6 bg-paper-dark/5 border-t border-paper-ink/5 pb-10">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder={`Add ${meter} tune...`}
                    className="flex-1 px-4 py-3 rounded-xl bg-paper border border-paper-ink/10 outline-none font-serif text-paper-ink"
                    value={newTune}
                    onChange={(e) => setNewTune(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && saveTune()}
                  />
                  <button onClick={saveTune} className="bg-paper-ink text-paper px-4 rounded-xl active:scale-95 transition-transform">
                    <Plus className="w-6 h-6" />
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}