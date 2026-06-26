"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { ReactNode } from "react";

interface ModuleItem {
  title: string;
  href: string;
  description: string;
  color: string;
  ready: boolean;
  iconNode: ReactNode;
}

interface ModuleGroupProps {
  category: string;
  items: ModuleItem[];
}

export function ModuleGroup({ group }: { group: ModuleGroupProps }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <section>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="group relative w-full flex items-center justify-between mb-3 md:mb-4 px-5 py-3 md:p-0 glass-card md:!bg-transparent md:!border-transparent md:!backdrop-blur-none !rounded-full md:!rounded-none md:pointer-events-none focus:outline-none transition-all duration-300 active:scale-[0.98] hover:border-gold/30 overflow-hidden"
      >
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-1.5 h-1.5 rounded-full bg-gold shadow-[0_0_8px_rgba(212,175,55,0.6)]"></div>
          <h3 className="text-[0.7rem] md:text-[0.65rem] font-bold uppercase tracking-[0.2em] text-foreground md:text-gold">
            {group.category}
          </h3>
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
      <div className={`grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2 ${isOpen ? 'grid' : 'hidden md:grid'}`}>
        {group.items.map((mod: ModuleItem) => {
          return (
            <Link
              key={mod.title}
              href={mod.href}
              className={`glass-card group relative overflow-hidden p-2.5 transition-all duration-200 hover:scale-[1.02] hover:border-gold/40 ${
                !mod.ready ? "opacity-50 pointer-events-none" : ""
              }`}
            >
              {/* Gradient orb background */}
              <div
                className={`absolute -top-5 -right-5 w-12 h-12 rounded-full bg-gradient-to-br ${mod.color} opacity-15 group-hover:opacity-25 transition-opacity blur-xl`}
              />

              <div className="relative z-10">
                <div
                  className={`inline-flex items-center justify-center w-6 h-6 rounded-md bg-gradient-to-br ${mod.color} mb-1.5`}
                >
                  {mod.iconNode}
                </div>
                <h4 className="text-xs font-semibold text-foreground leading-tight">
                  {mod.title}
                </h4>
                <p className="text-[0.6rem] text-muted leading-snug mt-0.5">
                  {mod.description}
                </p>
                {!mod.ready && (
                  <span className="mt-1.5 inline-block text-[0.55rem] bg-border/50 text-dim px-1.5 py-0.5 rounded">
                    Em breve
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
