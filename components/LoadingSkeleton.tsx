import React from 'react';

export const CardSkeleton = () => (
  <div className="flex-shrink-0 w-36 md:w-44 rounded-xl overflow-hidden bg-[#1a1a1a] animate-pulse">
    <div className="aspect-[2/3] bg-[#252525]" />
    <div className="p-2 space-y-2">
      <div className="h-3 bg-[#252525] rounded w-4/5" />
      <div className="h-3 bg-[#252525] rounded w-2/5" />
    </div>
  </div>
);

export const HeroSkeleton = () => (
  <div className="relative w-full h-[70vh] bg-[#141414] animate-pulse">
    <div className="absolute bottom-0 left-0 p-8 space-y-4 w-full max-w-xl">
      <div className="h-10 bg-[#252525] rounded w-3/5" />
      <div className="h-4 bg-[#252525] rounded w-full" />
      <div className="h-4 bg-[#252525] rounded w-4/5" />
      <div className="flex gap-3 mt-4">
        <div className="h-12 w-32 bg-[#252525] rounded-full" />
        <div className="h-12 w-32 bg-[#252525] rounded-full" />
      </div>
    </div>
  </div>
);

export const DetailSkeleton = () => (
  <div className="animate-pulse">
    <div className="h-[55vh] bg-[#141414]" />
    <div className="max-w-6xl mx-auto px-6 -mt-24 relative z-10">
      <div className="flex gap-6">
        <div className="w-44 h-64 bg-[#252525] rounded-xl flex-shrink-0" />
        <div className="flex-1 space-y-3 pt-4">
          <div className="h-8 bg-[#252525] rounded w-2/3" />
          <div className="h-4 bg-[#252525] rounded w-1/3" />
          <div className="h-4 bg-[#252525] rounded w-full" />
          <div className="h-4 bg-[#252525] rounded w-5/6" />
        </div>
      </div>
    </div>
  </div>
);

export const EpisodeSkeleton = () => (
  <div className="space-y-2 animate-pulse">
    {Array.from({ length: 6 }).map((_, i) => (
      <div key={i} className="flex gap-3 p-3 rounded-xl bg-[#1a1a1a]">
        <div className="w-28 h-16 bg-[#252525] rounded-lg flex-shrink-0" />
        <div className="flex-1 space-y-2 py-1">
          <div className="h-4 bg-[#252525] rounded w-3/5" />
          <div className="h-3 bg-[#252525] rounded w-4/5" />
        </div>
      </div>
    ))}
  </div>
);

export const GridSkeleton = ({ count = 12 }: { count?: number }) => (
  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="rounded-xl overflow-hidden bg-[#1a1a1a] animate-pulse">
        <div className="aspect-[2/3] bg-[#252525]" />
        <div className="p-2 space-y-2">
          <div className="h-3 bg-[#252525] rounded w-4/5" />
          <div className="h-3 bg-[#252525] rounded w-2/5" />
        </div>
      </div>
    ))}
  </div>
);
