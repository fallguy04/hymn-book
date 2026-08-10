"use client";

import { motion } from "framer-motion";
import { Delete, Type } from "lucide-react";

interface SmartNumpadProps {
  onKeyPress: (key: string) => void;
  onDelete: () => void;
  onClose: () => void;
  onToggleMode: () => void; // Must allow switching!
}

export default function SmartNumpad({ onKeyPress, onDelete, onClose, onToggleMode }: SmartNumpadProps) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

  return (
    <div className="bg-paper shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.1)] rounded-t-3xl p-6 pb-12">
      <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto">
        {keys.map((key) => (
          <button
            key={key}
            onClick={() => onKeyPress(key)}
            className="h-16 rounded-2xl bg-paper-ink/5 text-2xl font-serif text-paper-ink hover:bg-paper-ink/10 active:scale-95 transition-all shadow-sm"
          >
            {key}
          </button>
        ))}

        {/* Bottom Row */}
        <button
          onClick={onToggleMode}
          className="h-16 rounded-2xl bg-paper-ink/5 text-paper-ink flex items-center justify-center hover:bg-paper-ink/10 active:scale-95 transition-all shadow-sm group"
        >
          <span className="font-bold text-xs tracking-widest opacity-60 group-hover:opacity-100 transition-opacity">
            ABC
          </span>
        </button>

        <button
          onClick={() => onKeyPress("0")}
          className="h-16 rounded-2xl bg-paper-ink/5 text-2xl font-serif text-paper-ink hover:bg-paper-ink/10 active:scale-95 transition-all shadow-sm"
        >
          0
        </button>

        <button
          onClick={onDelete}
          className="h-16 rounded-2xl bg-paper-ink/5 text-paper-ink flex items-center justify-center hover:bg-paper-ink/10 active:scale-95 transition-all shadow-sm"
        >
          <Delete className="w-6 h-6 opacity-60" />
        </button>
      </div>
      
      <div className="mt-6 flex justify-center">
        <button 
          onClick={onClose}
          className="px-8 py-3 rounded-full bg-paper-ink/5 text-xs font-bold tracking-widest opacity-40 hover:opacity-100 transition-opacity"
        >
          CLOSE
        </button>
      </div>
    </div>
  );
}