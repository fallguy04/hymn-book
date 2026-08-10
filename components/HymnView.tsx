"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Star } from "lucide-react";

interface Hymn {
  number: number;
  title: string;
  meter: string;
  verses: string[];
}

interface HymnViewProps {
  hymn: Hymn;
  isFavorite: boolean;
  direction: number; // New prop to tell us which way to slide
  onToggleFavorite: (num: number) => void;
  onMeterClick: () => void;
  onNext: () => void; // New callback for swipe
  onPrev: () => void; // New callback for swipe
}

// Animation settings
const variants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0,
  }),
  center: {
    zIndex: 1,
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    zIndex: 0,
    x: direction < 0 ? 300 : -300,
    opacity: 0,
  }),
};

const swipeConfidenceThreshold = 10000;
const swipePower = (offset: number, velocity: number) => {
  return Math.abs(offset) * velocity;
};

export default function HymnView({ 
  hymn, 
  isFavorite, 
  direction,
  onToggleFavorite, 
  onMeterClick,
  onNext,
  onPrev
}: HymnViewProps) {
  return (
    // We add overflow-x-hidden to prevent scrollbars during animation
    <div className="w-full min-h-screen bg-paper flex justify-center overflow-y-auto overflow-x-hidden">
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={hymn.number}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{
            x: { type: "spring", stiffness: 300, damping: 30 },
            opacity: { duration: 0.2 }
          }}
          // Swipe Handlers
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={1}
          onDragEnd={(e, { offset, velocity }) => {
            const swipe = swipePower(offset.x, velocity.x);

            if (swipe < -swipeConfidenceThreshold) {
              onNext();
            } else if (swipe > swipeConfidenceThreshold) {
              onPrev();
            }
          }}
          className="w-full max-w-md px-6 pt-12 pb-40 text-center cursor-grab active:cursor-grabbing"
        >
          {/* Hymn Number & Favorite Star */}
          <div className="flex items-center justify-center gap-4 mb-2">
            <div className="font-serif text-paper-ink/60 text-lg tracking-widest uppercase">
              Hymn {hymn.number}
            </div>
            <button 
              onClick={(e) => {
                e.stopPropagation(); // Prevent drag when clicking star
                onToggleFavorite(hymn.number);
              }}
              className="p-2 transition-transform active:scale-75"
              aria-label="Toggle Favorite"
            >
              <Star 
                className={`w-6 h-6 transition-colors ${isFavorite ? 'fill-yellow-500 text-yellow-500' : 'text-paper-ink/20'}`} 
              />
            </button>
          </div>

          {/* Title */}
          <h1 className="font-serif text-3xl text-paper-ink mb-6 leading-tight select-none">
            {hymn.title}
          </h1>

          {/* Meter Badge */}
          <div className="mb-12 flex justify-center">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMeterClick();
              }}
              className="px-4 py-1.5 rounded-full border border-paper-ink/20 font-sans text-xs text-paper-ink/60 uppercase tracking-widest font-bold hover:bg-paper-ink hover:text-paper transition-all active:scale-95"
            >
              {hymn.meter}
            </button>
          </div>

          {/* Verses */}
          <div className="space-y-10 text-left select-none">
            {hymn.verses.map((verse, index) => (
              <div key={index} className="relative pl-4 group">
                <span className="absolute left-0 top-1 text-xs font-bold text-paper-ink/30 font-sans select-none">
                  {index + 1}
                </span>
                <p className="font-serif text-lg leading-relaxed text-paper-ink whitespace-pre-line">
                  {verse}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-16 mb-8 flex justify-center opacity-30">
            <div className="w-2 h-2 rounded-full bg-paper-ink mx-1" />
            <div className="w-2 h-2 rounded-full bg-paper-ink mx-1" />
            <div className="w-2 h-2 rounded-full bg-paper-ink mx-1" />
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}