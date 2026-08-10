"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { X, Search as SearchIcon } from "lucide-react";
import hymns from "@/data/hymns.json";

interface TextSearchProps {
  onSelect: (number: number) => void;
  onClose: () => void;
}

export default function TextSearch({ onSelect, onClose }: TextSearchProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Function to wrap matching text in bold tags
const HighlightText = ({ text, term }: { text: string; term: string }) => {
  if (!term.trim()) return <>{text}</>;
  const parts = text.split(new RegExp(`(${term})`, "gi"));
  return (
    <>
      {parts.map((part, i) => 
        part.toLowerCase() === term.toLowerCase() ? (
          <mark key={i} className="bg-yellow-200/50 text-paper-ink rounded-sm px-0.5 font-bold">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
};

  const getSnippet = (verses: string[], term: string) => {
    const matchingVerse = verses.find(v => v.toLowerCase().includes(term.toLowerCase()));
    if (!matchingVerse) return null;

    const index = matchingVerse.toLowerCase().indexOf(term.toLowerCase());
    const start = Math.max(0, index - 30);
    const end = Math.min(matchingVerse.length, index + 50);
    
    let snippet = matchingVerse.substring(start, end).replace(/\n/g, " ");
    if (start > 0) snippet = "..." + snippet;
    if (end < matchingVerse.length) snippet = snippet + "...";
    
    return snippet;
  };

  const results = useMemo(() => {
    if (!searchTerm) return [];
    const term = searchTerm.toLowerCase();
    
    return hymns
      .filter(h => 
        h.title.toLowerCase().includes(term) || 
        h.number.toString().includes(term) ||
        h.verses.some(v => v.toLowerCase().includes(term))
      )
      .slice(0, 40)
      .map(h => ({
        ...h,
        snippet: getSnippet(h.verses, term)
      }));
  }, [searchTerm]);

  return (
    <div className="w-full h-full max-w-lg mx-auto bg-paper rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-paper-ink/10">
      <div className="flex items-center p-4 border-b border-paper-ink/10 gap-3 bg-paper sticky top-0 z-10">
        <SearchIcon className="w-5 h-5 text-paper-ink/40" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search titles or lyrics..."
          className="flex-1 bg-transparent text-lg font-serif outline-none text-paper-ink placeholder:text-paper-ink/30"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <button 
          onClick={onClose}
          className="p-2 rounded-full hover:bg-paper-ink/5 active:scale-95"
        >
          <X className="w-6 h-6 text-paper-ink/60" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 bg-paper space-y-1">
        {results.length === 0 && searchTerm && (
          <div className="text-center mt-10 text-paper-ink/40 font-serif italic">
            No matches found.
          </div>
        )}

        {results.map((hymn) => (
          <button
            key={hymn.number}
            onClick={() => onSelect(hymn.number)}
            className="w-full text-left p-4 rounded-2xl hover:bg-paper-dark/5 active:bg-paper-dark/10 transition-colors border-b border-paper-ink/5 last:border-0 group"
          >
            <div className="flex justify-between items-baseline mb-1">
              <span className="font-bold text-paper-ink/40 text-[10px] tracking-widest uppercase">
                Hymn {hymn.number}
              </span>
              <span className="text-[10px] text-paper-ink/40 font-bold px-2 py-0.5 rounded-full bg-paper-ink/5 group-hover:bg-paper-ink/10 transition-colors">
                {hymn.meter}
              </span>
            </div>
            
            <h3 className="text-lg font-serif text-paper-ink leading-tight mb-1">
                <HighlightText text={hymn.title} term={searchTerm} />
            </h3>

            {hymn.snippet && (
                <p className="text-sm font-serif text-paper-ink/50 italic leading-snug line-clamp-2">
                    <HighlightText text={hymn.snippet} term={searchTerm} />
                </p>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}