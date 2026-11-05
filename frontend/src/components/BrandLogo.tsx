'use client';

import React from 'react';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showDiscoverBadge?: boolean;
  className?: string;
}

export function BrandLogo({
  size = 'md',
  showDiscoverBadge = false,
  className = '',
}: BrandLogoProps) {
  const heightClass =
    size === 'sm'
      ? 'h-6 sm:h-7'
      : size === 'lg'
      ? 'h-9 sm:h-11'
      : 'h-7 sm:h-8';

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      <img
        src="/logo-dark.png"
        alt="[Reach] NEWS"
        className={`${heightClass} w-auto object-contain transition-opacity group-hover:opacity-90`}
      />
      {showDiscoverBadge && (
        <span className="hidden sm:inline-block text-[10px] uppercase tracking-[0.2em] text-[#8e9293] font-sans font-semibold border-l border-white/10 pl-2.5 py-0.5">
          Discover
        </span>
      )}
    </div>
  );
}
