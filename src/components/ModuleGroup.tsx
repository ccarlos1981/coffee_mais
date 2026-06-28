"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Lock } from "lucide-react";
import { ReactNode } from "react";

interface ModuleItem {
  title: string;
  href: string;
  description: string;
  color: string;
  ready: boolean;
  iconNode: ReactNode;
  highlight?: boolean;
}

interface ModuleGroupProps {
  category: string;
  items: ModuleItem[];
}

export function ModuleGroup({ group }: { group: ModuleGroupProps }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <section className="animate-fade-in">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="group relative w-full flex items-center justify-between mb-3 md:mb-4 px-5 py-3 md:p-0 glass-card md:!bg-transparent md:!border-transparent md:!backdrop-blur-none !rounded-full md:!rounded-none md:pointer-events-none focus:outline-none transition-all duration-300 active:scale-[0.98] hover:border-gold/30 overflow-hidden"
      >
        <div className="flex items-center gap-3 relative z-10 w-full">
          <div className="w-1.5 h-1.5 rounded-full bg-gold shadow-[0_0_8px_rgba(212,175,55,0.6)] flex-shrink-0"></div>
          <h3 className="text-[0.7rem] md:text-[0.65rem] font-bold uppercase tracking-[0.2em] text-foreground md:text-gold flex-shrink-0">
            {group.category}
          </h3>
          <div className="hidden md:block h-[1px] flex-grow bg-gradient-to-r from-gold/20 via-gold/5 to-transparent ml-3" />
        </div>
        
        <div className="flex items-center gap-3 md:hidden relative z-10">
          <span className={`text-[0.65rem] font-medium transition-colors duration-300 ${isOpen ? 'text-gold' : 'text-muted'}`}>
            {group.items.length} {group.items.length === 1 ? 'módulo' : 'módulos'}
          </span>
          <div className={`flex items-center justify-center w-7 h-7 rounded-full transition-colors duration-300 ${isOpen ? 'bg-gold/20' : 'bg-white/5 group-hover:bg-white/10'}`}>
            <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${isOpen ? 'rotate-180 text-gold' : 'text-muted group-hover:text-foreground'}`} />
          </div>
        </div>
        
        {/* Subtle background glow effect for mobile */}
        <div className="absolute inset-0 bg-gradient-to-r from-gold/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 md:hidden pointer-events-none !rounded-full" />
      </button>

      <div className={`grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3 ${isOpen ? 'grid' : 'hidden md:grid'}`}>
        {group.items.map((mod: ModuleItem) => {
          return (
            <Link
              key={mod.title}
              href={mod.href}
              className={`group relative overflow-hidden p-3.5 transition-all duration-300 hover:scale-[1.03] hover:-translate-y-0.5 !rounded-xl border ${
                mod.highlight 
                  ? "bg-gradient-to-br from-red-600 to-red-850 dark:from-red-750 dark:to-red-900 border-red-500/50 hover:border-red-400 shadow-md shadow-red-500/10 hover:shadow-lg hover:shadow-red-500/20 text-white" 
                  : "glass-card border-border dark:border-white/20 hover:border-gold/40 dark:hover:border-gold/55 hover:shadow-lg hover:shadow-gold/3"
              } ${
                !mod.ready ? "opacity-45 pointer-events-none" : ""
              }`}
            >
              {/* Gradient orb background */}
              <div
                className={`absolute -top-5 -right-5 w-12 h-12 rounded-full bg-gradient-to-br ${mod.highlight ? 'from-white to-red-300' : mod.color} ${mod.highlight ? 'opacity-20 group-hover:opacity-35' : 'opacity-10 group-hover:opacity-20'} transition-opacity blur-xl`}
              />

              <div className="relative z-10 flex flex-col justify-between h-full">
                <div>
                  <div className="relative mb-3.5 flex items-center justify-between">
                    {/* Squircle Icon Container */}
                    <div className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border transition-all duration-300 group-hover:scale-105 ${mod.highlight ? 'bg-red-950/80 border-red-500/30 text-white group-hover:border-red-400' : 'bg-neutral-900 border-border dark:border-white/20 group-hover:border-gold/30 dark:group-hover:border-gold/40'}`}>
                      {mod.iconNode}
                    </div>
                    {/* Glowing category dot */}
                    <span className={`w-2 h-2 rounded-full ${mod.highlight ? 'bg-white shadow-[0_0_8px_rgba(255,255,255,0.7)] animate-pulse' : `bg-gradient-to-br ${mod.color} shadow-[0_0_6px_rgba(255,255,255,0.1)]`}`} />
                  </div>

                  <h4 className={`text-[12px] font-bold leading-tight transition-colors duration-200 ${mod.highlight ? 'text-white group-hover:text-red-100' : 'text-foreground group-hover:text-gold'}`}>
                    {mod.title}
                  </h4>
                  <p className={`text-[10px] leading-relaxed mt-1 transition-colors duration-200 ${mod.highlight ? 'text-red-200 group-hover:text-white' : 'text-muted group-hover:text-foreground-secondary'}`}>
                    {mod.description}
                  </p>
                </div>

                {!mod.ready && (
                  <span className="mt-2.5 inline-flex items-center gap-1 text-[8px] font-bold uppercase tracking-wider bg-neutral-900 text-neutral-500 border border-neutral-800 px-2 py-0.5 rounded-full w-fit">
                    <Lock className="w-2.5 h-2.5" /> Em breve
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
