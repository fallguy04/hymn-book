"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

interface HymnPreview {
  number: number;
  title: string;
}

export default function GlassTicket({ hymn, onClick }: { hymn: HymnPreview; onClick: () => void }) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.95 }}
      onClick={onClick}
      // CHANGED: From 'fixed' to 'absolute' and 'bottom-full' to float it above the parent
      className="absolute bottom-full mb-6 left-4 right-4 mx-auto max-w-sm glass-panel p-4 rounded-2xl flex items-center justify-between group active:scale-95 transition-transform z-[70] pointer-events-auto"
    >
      <div className="text-left">
        <span className="text-label block mb-1">Go to Hymn</span>
        <div className="flex items-baseline gap-3">
          <span className="font-serif text-3xl font-bold text-paper-ink">{hymn.number}</span>
          <span className="font-serif text-lg text-paper-ink/80 italic truncate max-w-[140px]">
            {hymn.title}
          </span>
        </div>
      </div>
      
      <div className="w-10 h-10 rounded-full bg-paper-ink/5 flex items-center justify-center group-hover:bg-paper-ink/10 transition-colors">
        <ArrowRight className="w-5 h-5 text-paper-ink/60" />
      </div>
    </motion.button>
  );
}