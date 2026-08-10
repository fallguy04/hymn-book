"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search } from "lucide-react";
import HymnView from "@/components/HymnView";
import SmartNumpad from "@/components/SmartNumpad";
import GlassTicket from "@/components/GlassTicket";
import SparkDrawer from "@/components/SparkDrawer"; 
import TextSearch from "@/components/TextSearch";
import hymns from "@/data/hymns.json";

export default function Home() {
  // 1. CHANGE THIS LINE: Use a tuple to track [page, direction]
  const [[page, direction], setPage] = useState([1, 0]);
  
  // 2. Helper to get the number cleanly
  const currentHymnNumber = page;

  const [isSearchOpen, setIsSearchOpen] = useState(true);
  const [searchMode, setSearchMode] = useState<'NUM' | 'TEXT'>('NUM');
  const [inputBuffer, setInputBuffer] = useState("");
  const [isTunesOpen, setIsTunesOpen] = useState(false);
  const [favorites, setFavorites] = useState<number[]>([]);

  // ... (Load favorites useEffect stays the same) ...
  useEffect(() => {
    const saved = localStorage.getItem("hymn_favorites");
    if (saved) setFavorites(JSON.parse(saved));
  }, []);

  const toggleFavorite = (num: number) => {
    const newFavs = favorites.includes(num) 
      ? favorites.filter(f => f !== num) 
      : [...favorites, num];
    setFavorites(newFavs);
    localStorage.setItem("hymn_favorites", JSON.stringify(newFavs));
  };

  const currentHymn = useMemo(() => 
    hymns.find(h => h.number === currentHymnNumber) || hymns[0], 
  [currentHymnNumber]);

  const targetHymn = useMemo(() => {
    if (!inputBuffer) return null;
    const num = parseInt(inputBuffer);
    return hymns.find(h => h.number === num) || null;
  }, [inputBuffer]);

  // ... (handleKeyPress and handleDelete stay the same) ...
  const handleKeyPress = (key: string) => {
    if (inputBuffer.length < 3) setInputBuffer(prev => prev + key);
  };

  const handleDelete = () => {
    setInputBuffer(prev => prev.slice(0, -1));
  };

  // 3. UPDATE handleGo to use the new setPage logic
  const handleGo = (number?: number) => {
    let nextNumber = currentHymnNumber;

    if (number) {
      nextNumber = number;
    } else if (targetHymn) {
      nextNumber = targetHymn.number;
    } else {
      return; // Do nothing if no valid target
    }

    // Calculate direction: 1 for forward, -1 for backward
    const newDirection = nextNumber > currentHymnNumber ? 1 : -1;
    setPage([nextNumber, newDirection]);
    
    setInputBuffer("");
    setIsSearchOpen(false);
    setSearchMode('NUM');
  };

  // 4. NEW Helpers for Swiping
  const paginate = (newDirection: number) => {
    const nextNumber = currentHymnNumber + newDirection;
    // Simple bounds check (assuming hymns 1-500, adjust as needed)
    if (hymns.find(h => h.number === nextNumber)) {
      setPage([nextNumber, newDirection]);
    }
  };

  return (
    <main className="min-h-screen relative">
      <HymnView 
        hymn={currentHymn} 
        isFavorite={favorites.includes(currentHymn.number)}
        direction={direction} // Pass direction
        onToggleFavorite={toggleFavorite}
        onMeterClick={() => setIsTunesOpen(true)}
        onNext={() => paginate(1)}  // Handle Next
        onPrev={() => paginate(-1)} // Handle Prev
      />

      {/* ... (Rest of the JSX below stays exactly the same) ... */}
      <SparkDrawer 
        isOpen={isTunesOpen} 
        onClose={() => setIsTunesOpen(false)} 
        meter={currentHymn.meter}
        onSelectHymn={(num) => handleGo(num)} 
      />

      <div className="fixed inset-0 pointer-events-none z-50">
         {/* ... (Search UI code stays same) ... */}
         <AnimatePresence>
          {isSearchOpen && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSearchOpen(false)}
              className="absolute inset-0 bg-paper-ink/10 pointer-events-auto backdrop-blur-sm"
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {!isSearchOpen && (
            <motion.button
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              onClick={() => { setIsSearchOpen(true); setSearchMode('NUM'); }}
              className="pointer-events-auto absolute bottom-8 left-1/2 -translate-x-1/2 w-14 h-14 rounded-full bg-paper text-paper-ink shadow-lg border border-paper-dark/50 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
            >
              <Search className="w-6 h-6 opacity-60" />
            </motion.button>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {isSearchOpen && searchMode === 'NUM' && (
            <div className="absolute inset-0 flex flex-col justify-end pointer-events-none">
              <div key="numpad" className="pointer-events-auto relative w-full">
                {targetHymn && (
                  <GlassTicket hymn={targetHymn} onClick={() => handleGo()} />
                )}
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute bottom-full mb-32 w-full text-center font-serif text-5xl text-paper-ink/20 pointer-events-none"
                >
                  {inputBuffer || ""}
                </motion.div>
                <SmartNumpad 
                  onKeyPress={handleKeyPress}
                  onDelete={handleDelete}
                  onClose={() => setIsSearchOpen(false)}
                  onToggleMode={() => setSearchMode('TEXT')}
                />
              </div>
            </div>
          )}

          {isSearchOpen && searchMode === 'TEXT' && (
            <motion.div 
              key="textsearch"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 pointer-events-auto p-4 flex flex-col"
            >
               <TextSearch 
                 onSelect={(num) => handleGo(num)}
                 onClose={() => setIsSearchOpen(false)}
               />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}