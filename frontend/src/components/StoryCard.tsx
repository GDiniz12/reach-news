'use client';

import React from 'react';
import Link from 'next/link';
import { Story } from '@/lib/types';
import { Clock, Heart, MoreHorizontal, Sparkles } from 'lucide-react';

const BADGE_COLORS = [
  'bg-[#1e6091] text-white',
  'bg-[#168aad] text-white',
  'bg-[#386641] text-white',
  'bg-[#9b2226] text-white',
  'bg-[#5a189a] text-white',
  'bg-[#b56576] text-white',
];

export function SourceIconsCluster({
  sources,
  count,
  lang,
}: {
  sources: Story['sources'];
  count: number;
  lang: 'pt' | 'en';
}) {
  const topSources = (sources && sources.length > 0
    ? sources.slice(0, 3)
    : [{ name: 'R' }, { name: 'V' }, { name: 'G' }]
  ).map((s) => s.name?.trim().charAt(0).toUpperCase() || 'N');

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center -space-x-1.5">
        {topSources.map((letter, idx) => (
          <span
            key={idx}
            className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-sans font-bold ring-2 ring-[#191a1a] ${
              BADGE_COLORS[idx % BADGE_COLORS.length]
            }`}
          >
            {letter}
          </span>
        ))}
      </div>
      <span className="text-[13px] font-sans font-medium text-[#8e9293]">
        {count} {lang === 'pt' ? 'fontes' : 'sources'}
      </span>
    </div>
  );
}

function getRelativeTime(publishedAt: string, lang: 'pt' | 'en') {
  const hours = Math.max(
    1,
    Math.round((Date.now() - new Date(publishedAt).getTime()) / (1000 * 60 * 60))
  );
  if (lang === 'pt') {
    return `Publicado há ${hours} ${hours === 1 ? 'hora' : 'horas'}`;
  }
  return `Published ${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
}

interface HeroStoryProps {
  story: Story;
  lang: 'pt' | 'en';
  isSaved?: boolean;
  onToggleSave?: (id: string, e: React.MouseEvent) => void;
}

/**
 * Top Featured Hero Story exactly matching Perplexity Discover screenshot #1:
 * Left side: Large muted-teal serif headline (#53b8bb), clock icon + "Published 23 hours ago",
 * editorial serif summary paragraph, and bottom row with stacked source icons + heart + ellipsis.
 * Right side: Large rounded-2xl image.
 */
export function DiscoverHeroStory({
  story,
  lang,
  isSaved,
  onToggleSave,
}: HeroStoryProps) {
  const title = lang === 'pt' ? story.titlePt : story.titleEn;
  const summary = lang === 'pt' ? story.summaryPt : story.summaryEn;
  const href = `/story/${encodeURIComponent(story.slug || story.id)}?lang=${lang}`;

  return (
    <div className="group py-4 sm:py-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 lg:gap-10 items-center">
        {/* Left 6 cols: Editorial Typography */}
        <div className="lg:col-span-6 flex flex-col justify-between space-y-4">
          <Link href={href} className="block space-y-3.5">
            <h1 className="font-editorial text-[28px] sm:text-[40px] lg:text-[44px] leading-[1.15] tracking-[-0.015em] font-normal text-[#53b8bb] group-hover:text-[#68cdd0] transition-colors">
              {title}
            </h1>

            <div className="flex flex-wrap items-center gap-2 text-[#8e9293] text-[13.5px] font-sans">
              <Clock className="w-3.5 h-3.5 stroke-[2]" />
              <span>{getRelativeTime(story.publishedAt, lang)}</span>
              {story.isJustGenerated && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#53b8bb]/20 border border-[#53b8bb]/50 text-[#53b8bb] text-[11px] font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#53b8bb] animate-pulse" />
                  <span>{lang === 'pt' ? 'Gerada agora' : 'Generated now'}</span>
                </span>
              )}
              {(story.matchReasonPt || story.matchReasonEn) && !story.isJustGenerated && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#53b8bb]/15 border border-[#53b8bb]/30 text-[#53b8bb] text-[11px] font-semibold">
                  <Sparkles className="w-3 h-3" />
                  <span>{lang === 'pt' ? story.matchReasonPt : story.matchReasonEn}</span>
                </span>
              )}
              {story.isRadarGenerated && (
                <span className="px-2 py-0.5 rounded bg-[#53b8bb]/15 text-[#53b8bb] text-[11px] font-semibold">
                  Radar AI
                </span>
              )}
            </div>

            <p className="font-editorial text-[#e4e5e5] text-[18px] sm:text-[19.5px] leading-[1.52] font-normal pt-1">
              {summary}
            </p>
          </Link>

          {/* Bottom Meta Bar: Stacked Source Icons + Heart + Dots */}
          <div className="pt-3 flex items-center justify-between max-w-md">
            <SourceIconsCluster
              sources={story.sources}
              count={story.articleCount || story.sources?.length || 12}
              lang={lang}
            />

            <div className="flex items-center gap-3 text-[#8e9293]">
              <button
                type="button"
                onClick={(e) => onToggleSave && onToggleSave(story.id, e)}
                className={`p-1.5 rounded-full hover:bg-white/5 transition ${
                  isSaved ? 'text-[#53b8bb]' : 'hover:text-white'
                }`}
                aria-label="Save story"
              >
                <Heart className={`w-4 h-4 ${isSaved ? 'fill-[#53b8bb]' : ''}`} />
              </button>
              <Link
                href={href}
                className="p-1.5 rounded-full hover:bg-white/5 hover:text-white transition"
                aria-label="More details"
              >
                <MoreHorizontal className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* Right 6 cols: Large Rounded Featured Photo */}
        <div className="lg:col-span-6">
          <Link
            href={href}
            className="block relative overflow-hidden rounded-[18px] bg-[#202222] aspect-[16/10] border border-white/[0.06] shadow-lg"
          >
            <img
              src={story.imageUrl}
              alt={title}
              className="w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-[1.02]"
            />
          </Link>
        </div>
      </div>
    </div>
  );
}

interface StoryCardProps {
  story: Story;
  lang: 'pt' | 'en';
  isSaved?: boolean;
  onToggleSave?: (id: string, e: React.MouseEvent) => void;
}

/**
 * Secondary 3-Column Card matching Perplexity Discover screenshot #1 bottom row:
 * Dark charcoal card (#202222), rounded-2xl, top image (aspect 16/10),
 * bottom padding with off-white editorial serif title, summary/sources footer.
 */
export function StoryCard({ story, lang, isSaved, onToggleSave }: StoryCardProps) {
  const title = lang === 'pt' ? story.titlePt : story.titleEn;
  const summary = lang === 'pt' ? story.summaryPt : story.summaryEn;
  const href = `/story/${encodeURIComponent(story.slug || story.id)}?lang=${lang}`;

  return (
    <div
      className={`group flex flex-col rounded-[16px] bg-[#202222] hover:bg-[#252727] border overflow-hidden transition-colors duration-200 ${
        story.isJustGenerated
          ? 'border-[#53b8bb]/45 shadow-lg shadow-[#53b8bb]/5'
          : 'border-white/[0.05]'
      }`}
    >
      <Link href={href} className="block relative aspect-[16/10] w-full overflow-hidden bg-[#161717]">
        <img
          src={story.imageUrl}
          alt={title}
          className="w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-[1.03]"
        />
        {story.isJustGenerated && (
          <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#111313]/90 backdrop-blur-md border border-[#53b8bb]/60 text-[#53b8bb] text-[11px] font-semibold shadow-md">
            <span className="w-1.5 h-1.5 rounded-full bg-[#53b8bb] animate-pulse" />
            <span>{lang === 'pt' ? 'Gerada agora' : 'Generated now'}</span>
          </div>
        )}
      </Link>

      <div className="flex-1 flex flex-col justify-between p-5">
        <Link href={href} className="block space-y-2.5">
          {story.isJustGenerated ? (
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#53b8bb]/15 text-[#53b8bb] text-[10.5px] font-semibold">
              <Sparkles className="w-2.5 h-2.5" />
              <span>{lang === 'pt' ? 'Gerada agora' : 'Generated now'}</span>
            </div>
          ) : (
            (story.matchReasonPt || story.matchReasonEn) && (
              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#53b8bb]/15 text-[#53b8bb] text-[10.5px] font-semibold">
                <Sparkles className="w-2.5 h-2.5" />
                <span>{lang === 'pt' ? story.matchReasonPt : story.matchReasonEn}</span>
              </div>
            )
          )}
          <h3 className="font-editorial text-[#ececec] group-hover:text-[#53b8bb] transition-colors text-[21px] leading-[1.28] font-normal line-clamp-3">
            {title}
          </h3>
          <p className="font-sans text-[#9ba0a1] text-[13.5px] leading-[1.48] line-clamp-2">
            {summary}
          </p>
        </Link>

        <div className="pt-4 mt-2 flex items-center justify-between">
          <SourceIconsCluster
            sources={story.sources}
            count={story.articleCount || story.sources?.length || 12}
            lang={lang}
          />

          <div className="flex items-center gap-1.5 text-[#8e9293]">
            {onToggleSave && (
              <button
                type="button"
                onClick={(e) => onToggleSave(story.id, e)}
                className={`p-1.5 rounded-full hover:bg-white/5 transition ${
                  isSaved ? 'text-[#53b8bb]' : 'hover:text-white'
                }`}
                aria-label="Save"
              >
                <Heart className={`w-3.5 h-3.5 ${isSaved ? 'fill-[#53b8bb]' : ''}`} />
              </button>
            )}
            <Link
              href={href}
              className="p-1.5 rounded-full hover:bg-white/5 hover:text-white transition"
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
