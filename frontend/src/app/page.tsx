'use client';

import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  CATEGORIES,
  CATEGORY_SUBTHEMES,
  SubTheme,
  Language,
  Story,
  UI_TEXT,
  UserProfile,
} from '@/lib/types';
import { DiscoverHeroStory, StoryCard } from '@/components/StoryCard';
import SportsHub from '@/components/SportsHub';
import FinanceHub from '@/components/FinanceHub';
import { AuthModal, InterestsModal } from '@/components/Modals';
import { FloatingAiBot } from '@/components/FloatingAiBot';
import { BrandLogo } from '@/components/BrandLogo';
import {
  getLocalAffinityMap,
  recordUserSignal,
  getCachedAuthSession,
  saveAuthSession,
  clearAuthSession,
  syncSessionWithBackend,
  touchAuthSession,
} from '@/lib/telemetry';
import {
  Compass,
  Sparkles,
  RefreshCw,
  LogOut,
  Heart,
  Search,
  Loader2,
  ArrowRight,
  SlidersHorizontal,
  Clock,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001';

export default function ReachNewsHomePage() {
  const router = useRouter();
  const [lang, setLang] = useState<Language>('pt');
  const [selectedCategory, setSelectedCategory] = useState<string>('popular');
  const [selectedSubtheme, setSelectedSubtheme] = useState<string | null>(null);
  const [stories, setStories] = useState<Story[]>([]);
  const [loadingStories, setLoadingStories] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<boolean>(false);
  const activeCategoryRef = useRef<string>('popular');
  const [showInterestsModal, setShowInterestsModal] = useState<boolean>(false);

  // Radar Search state
  const [radarQuery, setRadarQuery] = useState<string>('');
  const [radarLoading, setRadarLoading] = useState<boolean>(false);
  const [activeSearchTerm, setActiveSearchTerm] = useState<string | null>(null);
  const [radarGeneratedInfo, setRadarGeneratedInfo] = useState<{
    scope: 'broad' | 'specific';
    count: number;
  } | null>(null);

  // Auth & Profile state
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [authModalMode, setAuthModalMode] = useState<'signin' | 'signup' | null>(null);
  const [savedStoryIds, setSavedStoryIds] = useState<Set<string>>(new Set());
  const [viewingSavedOnly, setViewingSavedOnly] = useState<boolean>(false);

  const t = UI_TEXT[lang];

  const handleSetLang = (newLang: Language) => {
    setLang(newLang);
    localStorage.setItem('reach_news_lang', newLang);
  };

  const fetchWithRetry = async (
    url: string,
    options?: RequestInit,
    maxRetries = 2,
    baseDelayMs = 1200
  ): Promise<any> => {
    let lastError: any = null;
    let delay = baseDelayMs;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const res = await fetch(url, options);
        if (res.ok) {
          return await res.json();
        }
        // If server returns 500, 502, 503, 504 (typical in production cold start), retry after pause
        if (res.status >= 500 && attempt < maxRetries) {
          console.warn(
            `[ReachNews] Server HTTP ${res.status} on attempt ${attempt + 1}. Retrying in ${delay}ms...`
          );
          await new Promise((r) => setTimeout(r, delay));
          delay *= 1.5;
          continue;
        }
        return await res.json().catch(() => ({}));
      } catch (err) {
        lastError = err;
        if (attempt < maxRetries) {
          console.warn(
            `[ReachNews] Network error on attempt ${attempt + 1}. Retrying in ${delay}ms...`,
            err
          );
          await new Promise((r) => setTimeout(r, delay));
          delay *= 1.5;
          continue;
        }
      }
    }
    throw lastError || new Error('Falha na comunicação com o servidor');
  };

  const fetchStories = async (category: string) => {
    activeCategoryRef.current = category;
    setLoadingStories(true);
    setLoadError(false);
    try {
      if (category === 'for_you') {
        const activeToken =
          typeof window !== 'undefined' ? localStorage.getItem('reach_news_token') : null;
        const localAff = JSON.stringify(getLocalAffinityMap());
        const url = `${API_BASE_URL}/api/stories/for-you?lang=${lang}&limit=30&localAffinity=${encodeURIComponent(
          localAff
        )}`;
        const data = await fetchWithRetry(url, {
          headers: activeToken ? { Authorization: `Bearer ${activeToken}` } : {},
        });
        if (activeCategoryRef.current === category && Array.isArray(data?.stories)) {
          setStories(data.stories);
        }
        return;
      }

      if (category === 'last_24h') {
        const url = `${API_BASE_URL}/api/stories?category=last_24h&timeframe=24h&lang=${lang}&limit=30`;
        const data = await fetchWithRetry(url);
        if (activeCategoryRef.current === category && Array.isArray(data?.stories)) {
          // Extra safeguard: guarantee client-side that every story was published within the last 24h
          const cutoff = Date.now() - 24 * 60 * 60 * 1000;
          const filtered = data.stories.filter(
            (s: Story) => new Date(s.publishedAt).getTime() >= cutoff
          );
          setStories(filtered.length > 0 ? filtered : data.stories);
        }
        return;
      }

      const url = `${API_BASE_URL}/api/stories?category=${encodeURIComponent(category)}&limit=30`;
      const data = await fetchWithRetry(url);
      if (activeCategoryRef.current === category && Array.isArray(data?.stories)) {
        setStories(data.stories);
      }
    } catch (err) {
      console.error('Error loading stories:', err);
      if (activeCategoryRef.current === category) {
        setLoadError(true);
      }
    } finally {
      if (activeCategoryRef.current === category) {
        setLoadingStories(false);
      }
    }
  };

  useEffect(() => {
    fetchStories(selectedCategory);
  }, [selectedCategory]);

  useEffect(() => {
    const savedLang = localStorage.getItem('reach_news_lang') as Language | null;
    if (savedLang === 'pt' || savedLang === 'en') {
      setLang(savedLang);
    }

    // 1. Instantly hydrate cached session (<1ms) so the user appears logged in immediately upon entering the platform
    const cached = getCachedAuthSession();
    if (cached.token) {
      setToken(cached.token);
      if (cached.user) {
        setUser(cached.user);
        setSelectedCategory((prev) => (prev === 'popular' ? 'for_you' : prev));
        if (Array.isArray(cached.user.savedStories)) {
          setSavedStoryIds(new Set(cached.user.savedStories.map((s: Story) => s.id)));
        }
      }

      // 2. Verify and renew the rolling session with backend (with automatic cold-start retry)
      syncSessionWithBackend(API_BASE_URL).then((res) => {
        if (res.unauthorized) {
          setToken(null);
          setUser(null);
          setSavedStoryIds(new Set());
          setSelectedCategory('popular');
          return;
        }
        if (res.token) {
          setToken(res.token);
        }
        if (res.user) {
          setUser(res.user);
          setSelectedCategory((prev) => (prev === 'popular' ? 'for_you' : prev));
          if (Array.isArray(res.user.savedStories)) {
            setSavedStoryIds(new Set(res.user.savedStories.map((s: Story) => s.id)));
          }
        }
      });
    }
  }, []);

  const handleRadarInvestigate = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = radarQuery.trim();
    if (!q || radarLoading) return;

    setViewingSavedOnly(false);
    setActiveSearchTerm(q);
    setRadarGeneratedInfo(null);
    setRadarLoading(true);

    // 1. Immediately display existing related stories from PostgreSQL while AI synthesizes new ones
    try {
      const existingRes = await fetch(
        `${API_BASE_URL}/api/stories?q=${encodeURIComponent(q)}&limit=15`
      );
      const existingData = await existingRes.json();
      if (Array.isArray(existingData.stories)) {
        setStories(existingData.stories);
      }
    } catch {
      // ignore
    } finally {
      setLoadingStories(false);
    }

    // 2. Simultaneously, AI interprets the query breadth & generates 3+ stories (for broad topics) or 1 (for specific events)
    try {
      const res = await fetch(`${API_BASE_URL}/api/radar/research`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: q,
          category: selectedCategory,
          lang,
        }),
      });
      const data = await res.json();
      const rawNewStories: Story[] = Array.isArray(data.stories)
        ? data.stories
        : data.story
        ? [data.story]
        : [];

      const newStories: Story[] = rawNewStories.map((s) => ({
        ...s,
        isJustGenerated: true,
      }));

      if (newStories.length > 0) {
        recordUserSignal({
          apiBaseUrl: API_BASE_URL,
          token,
          storyId: newStories[0].id,
          category: newStories[0].category || 'technology',
          topicTag: q,
          eventType: 'radar',
        });

        setRadarGeneratedInfo({
          scope: data.scope === 'specific' ? 'specific' : 'broad',
          count: newStories.length,
        });

        setStories((prev) => {
          const newIds = new Set(newStories.map((s) => s.id));
          return [...newStories, ...prev.filter((p) => !newIds.has(p.id))];
        });
      }
    } catch (err) {
      console.error('Radar error:', err);
    } finally {
      setRadarLoading(false);
    }
  };

  const handleClearSearch = () => {
    setActiveSearchTerm(null);
    setRadarGeneratedInfo(null);
    setRadarQuery('');
    fetchStories(selectedCategory);
  };



  const handleToggleSave = async (storyId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!token || !user) {
      router.push('/auth?mode=signin');
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/stories/${storyId}/bookmark`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setSavedStoryIds((prev) => {
        const next = new Set(prev);
        if (data.saved) next.add(storyId);
        else next.delete(storyId);
        return next;
      });
      if (data.saved) {
        const targetStory = stories.find((s) => s.id === storyId);
        if (targetStory) {
          recordUserSignal({
            apiBaseUrl: API_BASE_URL,
            token,
            storyId: targetStory.id,
            category: targetStory.category,
            topicTag: targetStory.topicTagPt,
            eventType: 'bookmark',
          });
        }
      }
    } catch {
      // ignore
    }
  };

  const handleLogout = () => {
    clearAuthSession();
    setToken(null);
    setUser(null);
    setSavedStoryIds(new Set());
    setViewingSavedOnly(false);
    setSelectedCategory('popular');
  };

  // Available subthemes for the selected parent theme (predefined + dynamic unique tags from loaded stories)
  const availableSubthemes = useMemo(() => {
    const predefined = CATEGORY_SUBTHEMES[selectedCategory] || [];

    // Dynamically surface real tags present in the loaded stories of this category
    const dynamicTags: SubTheme[] = [];
    const seen = new Set<string>();
    predefined.forEach((p) => {
      seen.add(p.labelPt.toLowerCase());
      seen.add(p.labelEn.toLowerCase());
      p.keywords.forEach((k) => seen.add(k.toLowerCase()));
    });

    for (const s of stories) {
      const tagPt = (s.topicTagPt || '').trim();
      const tagEn = (s.topicTagEn || s.topicTagPt || '').trim();
      if (!tagPt || tagPt.length < 3 || tagPt.length > 35) continue;
      const lower = tagPt.toLowerCase();

      if (!seen.has(lower) && !lower.startsWith('radar:')) {
        seen.add(lower);
        dynamicTags.push({
          id: `dyn_${lower.replace(/[^a-z0-9]/g, '_')}`,
          labelPt: tagPt,
          labelEn: tagEn,
          keywords: [tagPt, tagEn],
        });
      }
      if (dynamicTags.length >= 6) break;
    }

    return [...predefined, ...dynamicTags];
  }, [selectedCategory, stories]);

  // Apply viewingSavedOnly AND selectedSubtheme filter
  const displayedStories = useMemo(() => {
    let list = viewingSavedOnly
      ? stories.filter((s) => savedStoryIds.has(s.id))
      : stories;

    if (!selectedSubtheme) return list;

    const matchedSub = availableSubthemes.find((s) => s.id === selectedSubtheme);
    const keywords = matchedSub?.keywords && matchedSub.keywords.length > 0
      ? matchedSub.keywords
      : [selectedSubtheme];
    const targetLabel = (matchedSub ? (lang === 'pt' ? matchedSub.labelPt : matchedSub.labelEn) : selectedSubtheme).toLowerCase();

    return list.filter((story) => {
      const tagPt = (story.topicTagPt || '').toLowerCase();
      const tagEn = (story.topicTagEn || '').toLowerCase();
      if (tagPt.includes(targetLabel) || targetLabel.includes(tagPt)) return true;
      if (tagEn.includes(targetLabel) || targetLabel.includes(tagEn)) return true;

      const fullText = `${story.titlePt} ${story.titleEn} ${story.summaryPt} ${story.summaryEn} ${story.topicTagPt} ${story.topicTagEn}`.toLowerCase();
      return keywords.some((kw) => kw && fullText.includes(kw.toLowerCase()));
    });
  }, [stories, viewingSavedOnly, savedStoryIds, selectedSubtheme, availableSubthemes, lang]);

  const isBoxOnlyMode = Boolean(activeSearchTerm) || viewingSavedOnly;
  const heroStory = isBoxOnlyMode ? null : displayedStories[0] || null;
  const gridStories = isBoxOnlyMode ? displayedStories : displayedStories.slice(1);

  return (
    <div className="min-h-screen flex flex-col justify-between bg-[#191a1a] text-[#ececec]">
      <div>
        {/* ================= TOP HEADER (PERPLEXITY DISCOVER STYLE) ================= */}
        <header className="sticky top-0 z-30 bg-[#191a1a]/90 backdrop-blur-md border-b border-white/[0.06]">
          <div className="max-w-[1160px] mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-2 sm:gap-4">
            {/* Brand + Discover Title */}
            <div
              onClick={() => {
                setViewingSavedOnly(false);
                setSelectedCategory(user ? 'for_you' : 'popular');
              }}
              className="flex items-center gap-3 cursor-pointer select-none group"
            >
              <BrandLogo size="md" showDiscoverBadge />
            </div>

            {/* Center: Perplexity-style Radar AI Research Input */}
            <form
              onSubmit={handleRadarInvestigate}
              className="hidden md:flex items-center flex-1 max-w-md mx-4"
            >
              <div className="relative w-full">
                <Search className="w-4 h-4 text-[#8e9293] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={radarQuery}
                  onChange={(e) => setRadarQuery(e.target.value)}
                  placeholder={
                    lang === 'pt'
                      ? 'Pesquisar tópicos, pessoas ou empresas no Radar AI...'
                      : 'Research topics, figures or companies with Radar AI...'
                  }
                  className="w-full bg-[#202222] hover:bg-[#252727] focus:bg-[#202222] border border-white/[0.08] focus:border-[#53b8bb]/60 rounded-full pl-10 pr-24 py-1.5 text-[13px] text-[#ececec] placeholder-[#8e9293] focus:outline-none transition"
                />
                <button
                  type="submit"
                  disabled={radarLoading}
                  className="absolute right-1 top-1/2 -translate-y-1/2 px-3 py-1 rounded-full bg-[#53b8bb]/15 hover:bg-[#53b8bb]/25 text-[#53b8bb] text-[11px] font-semibold flex items-center gap-1 transition disabled:opacity-50"
                >
                  {radarLoading ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <>
                      <span>Radar</span>
                      <ArrowRight className="w-3 h-3" />
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Right Controls */}
            <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
              {/* Algorithm Interests Button ("Meus Interesses" - ONLY FOR LOGGED-IN USERS) */}
              {user && (
                <button
                  onClick={() => setShowInterestsModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#202222] hover:bg-[#262828] border border-[#53b8bb]/30 text-xs font-medium text-[#53b8bb] transition"
                  title={
                    lang === 'pt'
                      ? 'Personalizar Interesses e Algoritmo'
                      : 'Customize Interests & Algorithm'
                  }
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">
                    {lang === 'pt' ? 'Meus Interesses' : 'My Interests'}
                  </span>
                </button>
              )}

              {/* Bilingual Selector (PT-BR / EN-US) */}
              <div className="flex items-center rounded-full bg-[#202222] border border-white/[0.07] p-0.5 text-[11px] font-semibold">
                <button
                  onClick={() => handleSetLang('pt')}
                  className={`px-2.5 py-1 rounded-full transition ${
                    lang === 'pt'
                      ? 'bg-[#2c3030] text-[#53b8bb]'
                      : 'text-[#8e9293] hover:text-white'
                  }`}
                >
                  PT
                </button>
                <button
                  onClick={() => handleSetLang('en')}
                  className={`px-2.5 py-1 rounded-full transition ${
                    lang === 'en'
                      ? 'bg-[#2c3030] text-[#53b8bb]'
                      : 'text-[#8e9293] hover:text-white'
                  }`}
                >
                  EN
                </button>
              </div>

              {/* Auth State */}
              {!user ? (
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <button
                    onClick={() => router.push('/auth?mode=signin')}
                    className="px-2.5 sm:px-3.5 py-1.5 rounded-full bg-transparent hover:bg-white/[0.05] text-xs font-medium text-[#ececec] transition whitespace-nowrap"
                  >
                    {t.signIn}
                  </button>
                  <button
                    onClick={() => router.push('/auth?mode=signup')}
                    className="px-3 sm:px-4 py-1.5 rounded-full bg-[#53b8bb] hover:bg-[#66c7ca] text-[#111313] text-xs font-semibold transition whitespace-nowrap"
                  >
                    {t.signUp}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setViewingSavedOnly(!viewingSavedOnly)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                      viewingSavedOnly
                        ? 'bg-[#53b8bb]/20 text-[#53b8bb] border-[#53b8bb]/40'
                        : 'bg-[#202222] text-[#b4b8b9] border-white/[0.07] hover:text-white'
                    }`}
                  >
                    <Heart className={`w-3.5 h-3.5 ${viewingSavedOnly ? 'fill-[#53b8bb]' : ''}`} />
                    <span className="hidden sm:inline">{t.savedStories}</span>
                    <span className="text-[11px] opacity-75">({savedStoryIds.size})</span>
                  </button>

                  <div className="flex items-center gap-2 pl-2 pr-2.5 py-1 rounded-full bg-[#202222] border border-white/[0.08]">
                    <div className="w-6 h-6 rounded-full bg-[#53b8bb] text-[#111313] font-bold text-[11px] flex items-center justify-center uppercase">
                      {user.name.slice(0, 2)}
                    </div>
                    <span className="hidden sm:inline text-xs font-medium text-[#ececec]">
                      {user.name.split(' ')[0]}
                    </span>
                    <button
                      onClick={handleLogout}
                      title={t.signOut}
                      className="p-1 rounded-full hover:bg-white/10 text-[#8e9293] hover:text-white transition"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Mobile Radar Search Bar */}
          <div className="md:hidden px-5 pb-3">
            <form onSubmit={handleRadarInvestigate} className="relative w-full">
              <Search className="w-4 h-4 text-[#8e9293] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={radarQuery}
                onChange={(e) => setRadarQuery(e.target.value)}
                placeholder={t.radarInputPlaceholder}
                className="w-full bg-[#202222] border border-white/[0.08] rounded-full pl-10 pr-24 py-2 text-xs text-[#ececec] placeholder-[#8e9293] focus:outline-none focus:border-[#53b8bb]"
              />
              <button
                type="submit"
                disabled={radarLoading}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1 rounded-full bg-[#53b8bb] text-[#111313] text-xs font-semibold"
              >
                {radarLoading ? '...' : 'Radar'}
              </button>
            </form>
          </div>

          {/* Category Navigation Tabs (Perplexity Discover clean horizontal bar) */}
          <div className="max-w-[1160px] mx-auto px-5 sm:px-8 flex items-center justify-between gap-4 py-2.5 border-t border-white/[0.04]">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pr-2">
              {/* "Para Você" Tab ONLY exists for logged-in users */}
              {user && (
                <button
                  onClick={() => {
                    setViewingSavedOnly(false);
                    setActiveSearchTerm(null);
                    setRadarGeneratedInfo(null);
                    setSelectedSubtheme(null);
                    setSelectedCategory('for_you');
                  }}
                  className={`px-3.5 py-1.5 rounded-full text-[13px] font-medium transition shrink-0 flex items-center gap-1.5 ${
                    selectedCategory === 'for_you' && !viewingSavedOnly && !activeSearchTerm
                      ? 'bg-[#282b2b] text-[#53b8bb] border border-[#53b8bb]/30'
                      : 'text-[#8e9293] hover:text-[#ececec] hover:bg-white/[0.03]'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#53b8bb]" />
                  <span>{lang === 'pt' ? 'Para Você' : 'For You'}</span>
                </button>
              )}

              {/* The original 9 platform categories + dedicated 24h breaking session */}
              {CATEGORIES.map((cat) => {
                const isSelected =
                  selectedCategory === cat.id && !viewingSavedOnly && !activeSearchTerm;
                const label = lang === 'pt' ? cat.labelPt : cat.labelEn;
                const is24h = cat.id === 'last_24h';
                return (
                  <button
                    key={cat.id}
                    onClick={() => {
                      setViewingSavedOnly(false);
                      setActiveSearchTerm(null);
                      setRadarGeneratedInfo(null);
                      setSelectedSubtheme(null);
                      setSelectedCategory(cat.id);
                    }}
                    className={`px-3.5 py-1.5 rounded-full text-[13px] font-medium transition shrink-0 flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-[#282b2b] text-[#53b8bb] border border-[#53b8bb]/30'
                        : is24h
                        ? 'text-[#dcdede] hover:text-[#53b8bb] hover:bg-white/[0.04]'
                        : 'text-[#8e9293] hover:text-[#ececec] hover:bg-white/[0.03]'
                    }`}
                  >
                    {is24h && <Clock className="w-3.5 h-3.5 text-[#53b8bb]" />}
                    <span>{label}</span>
                    {is24h && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Subthemes row for the selected parent theme */}
          {!viewingSavedOnly && !activeSearchTerm && availableSubthemes.length > 0 && (
            <div className="border-t border-white/[0.04] bg-[#141515]/90 backdrop-blur-md">
              <div className="max-w-[1160px] mx-auto px-4 sm:px-8 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                <span className="text-[11px] font-semibold text-[#6d7172] uppercase tracking-wider mr-1 hidden sm:inline-block shrink-0 select-none">
                  {lang === 'pt' ? 'Subtemas:' : 'Subtopics:'}
                </span>

                {/* 'Todos' / 'All' pill */}
                <button
                  onClick={() => setSelectedSubtheme(null)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition shrink-0 flex items-center gap-1.5 ${
                    selectedSubtheme === null
                      ? 'bg-[#53b8bb]/20 text-[#53b8bb] border border-[#53b8bb]/50 shadow-sm font-semibold'
                      : 'text-[#8e9293] hover:text-[#ececec] hover:bg-white/[0.03] border border-white/[0.04]'
                  }`}
                >
                  <span>{lang === 'pt' ? 'Todos' : 'All'}</span>
                  <span className="text-[10px] opacity-60">({stories.length})</span>
                </button>

                {availableSubthemes.map((sub) => {
                  const isSubActive = selectedSubtheme === sub.id;
                  const label = lang === 'pt' ? sub.labelPt : sub.labelEn;
                  return (
                    <button
                      key={sub.id}
                      onClick={() => setSelectedSubtheme(isSubActive ? null : sub.id)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition shrink-0 flex items-center gap-1.5 ${
                        isSubActive
                          ? 'bg-[#53b8bb]/20 text-[#53b8bb] border border-[#53b8bb]/50 shadow-sm font-semibold'
                          : 'text-[#8e9293] hover:text-[#ececec] hover:bg-white/[0.03] border border-white/[0.04]'
                      }`}
                    >
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </header>

        {/* ================= MAIN DISCOVER EDITORIAL FEED ================= */}
        <main className="max-w-[1160px] mx-auto px-5 sm:px-8 pt-6 pb-20">
          {user && selectedCategory === 'for_you' && !viewingSavedOnly && (
            <div className="mb-5 px-4 py-3 rounded-2xl bg-[#202222]/90 border border-white/[0.06] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-xs text-[#b4b8b9]">
                <span className="w-7 h-7 rounded-full bg-[#53b8bb]/15 border border-[#53b8bb]/30 flex items-center justify-center text-[#53b8bb] shrink-0">
                  <Sparkles className="w-3.5 h-3.5" />
                </span>
                <span>
                  {lang === 'pt'
                    ? `Feed "Para Você" calibrado para ${user.name.split(' ')[0]} com base nos seus interesses e comportamento de leitura.`
                    : `"For You" feed calibrated for ${user.name.split(' ')[0]} based on your interests and reading activity.`}
                </span>
              </div>
              <button
                onClick={() => setShowInterestsModal(true)}
                className="px-3.5 py-1.5 rounded-full bg-[#191a1a] hover:bg-[#282b2b] border border-[#53b8bb]/30 text-[#53b8bb] text-xs font-semibold transition flex items-center gap-1.5"
              >
                <SlidersHorizontal className="w-3 h-3" />
                <span>
                  {lang === 'pt' ? 'Ajustar Algoritmo' : 'Tune Algorithm'}
                </span>
              </button>
            </div>
          )}

          {/* DEDICATED BANNER FOR 24-HOUR BREAKING SESSION */}
          {selectedCategory === 'last_24h' && !viewingSavedOnly && !activeSearchTerm && (
            <div className="mb-6 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-[#202222] via-[#242828] to-[#202222] border border-[#53b8bb]/35 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg shadow-black/20">
              <div className="flex items-start sm:items-center gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-[#53b8bb]/15 border border-[#53b8bb]/35 flex items-center justify-center text-[#53b8bb] shrink-0">
                  <Clock className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base sm:text-lg font-semibold text-white tracking-tight">
                      {t.last24hTitle}
                    </h2>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[11px] font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span>{lang === 'pt' ? 'Plantão Ao Vivo' : 'Live Desk'}</span>
                    </span>
                  </div>
                  <p className="text-xs sm:text-[13px] text-[#a4a9aa] mt-1 max-w-2xl leading-relaxed">
                    {t.last24hDesc}
                  </p>
                </div>
              </div>
            </div>
          )}
          {activeSearchTerm && (
            <div className="mb-6 p-4 sm:p-5 rounded-2xl bg-[#202222] border border-[#53b8bb]/35 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#53b8bb]">
                  <Search className="w-3.5 h-3.5" />
                  <span>
                    {lang === 'pt'
                      ? `Pesquisa no Radar: "${activeSearchTerm}"`
                      : `Radar Search: "${activeSearchTerm}"`}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-[#dcdede]">
                  {radarLoading ? (
                    <span className="inline-flex items-center gap-2 text-[#b4b8b9]">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[#53b8bb]" />
                      {lang === 'pt'
                        ? 'Exibindo matérias relacionadas abaixo enquanto a IA interpreta o tema e redige novas reportagens (mínimo de 3 para temas amplos)...'
                        : 'Showing related stories below while AI interprets the topic and writes fresh reports (at least 3 for broad topics)...'}
                    </span>
                  ) : radarGeneratedInfo ? (
                    lang === 'pt' ? (
                      radarGeneratedInfo.scope === 'broad' ? (
                        `A IA interpretou "${activeSearchTerm}" como um tema amplo e gerou ${radarGeneratedInfo.count} novas reportagens sob diferentes ângulos, além das matérias relacionadas!`
                      ) : (
                        `A IA interpretou "${activeSearchTerm}" como um fato específico e gerou uma reportagem dedicada!`
                      )
                    ) : radarGeneratedInfo.scope === 'broad' ? (
                      `AI interpreted "${activeSearchTerm}" as a broad topic and synthesized ${radarGeneratedInfo.count} new stories across distinct angles!`
                    ) : (
                      `AI interpreted "${activeSearchTerm}" as a specific event and synthesized a dedicated report!`
                    )
                  ) : lang === 'pt' ? (
                    'Resultados relacionados encontrados na plataforma.'
                  ) : (
                    'Related stories found on the platform.'
                  )}
                </p>
              </div>

              <button
                onClick={handleClearSearch}
                className="self-start sm:self-center px-3.5 py-1.5 rounded-full bg-[#191a1a] hover:bg-[#2a2d2d] border border-white/10 text-xs font-medium text-[#ececec] shrink-0 transition"
              >
                {lang === 'pt' ? 'Limpar Pesquisa' : 'Clear Search'}
              </button>
            </div>
          )}

          {selectedCategory === 'sports' && !viewingSavedOnly && !activeSearchTerm && (
            <SportsHub subtheme={selectedSubtheme} />
          )}

          {selectedCategory === 'economics' && !viewingSavedOnly && !activeSearchTerm && (
            <FinanceHub subtheme={selectedSubtheme} />
          )}

          {loadingStories ? (
            <div className="space-y-10">
              <div className="h-[340px] rounded-2xl bg-[#202222] animate-pulse border border-white/[0.05]" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[1, 2, 3].map((n) => (
                  <div
                    key={n}
                    className="h-[340px] rounded-2xl bg-[#202222] animate-pulse border border-white/[0.05]"
                  />
                ))}
              </div>
            </div>
          ) : loadError ? (
            <div className="rounded-2xl bg-[#202222] border border-white/[0.06] p-12 text-center my-8">
              <p className="font-editorial text-[#b4b8b9] text-xl mb-3">
                {lang === 'pt'
                  ? 'Não foi possível carregar as notícias no momento.'
                  : 'Unable to load stories at this moment.'}
              </p>
              <p className="text-xs text-[#8e9293] mb-6 max-w-md mx-auto leading-relaxed">
                {lang === 'pt'
                  ? 'O servidor pode estar inicializando (cold start) ou houve uma oscilação temporária de rede.'
                  : 'The backend server may be waking up (cold start) or there was a temporary network fluctuation.'}
              </p>
              <button
                onClick={() => fetchStories(selectedCategory)}
                className="px-5 py-2.5 rounded-full bg-[#53b8bb] text-[#111313] font-semibold text-xs inline-flex items-center gap-2 transition hover:bg-[#66c7ca]"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{lang === 'pt' ? 'Tentar Novamente' : 'Try Again'}</span>
              </button>
            </div>
          ) : displayedStories.length === 0 ? (
            <div className="rounded-2xl bg-[#202222] border border-white/[0.06] p-12 text-center my-8">
              <p className="font-editorial text-[#b4b8b9] text-xl mb-3">
                {viewingSavedOnly
                  ? lang === 'pt'
                    ? 'Você ainda não salvou nenhuma notícia.'
                    : 'You have not saved any stories yet.'
                  : selectedSubtheme
                  ? lang === 'pt'
                    ? 'Nenhuma matéria encontrada para este subtema específico.'
                    : 'No stories found for this specific subtopic.'
                  : selectedCategory === 'last_24h'
                  ? t.no24hStoriesTitle
                  : lang === 'pt'
                  ? 'Nenhuma notícia encontrada nesta categoria ainda.'
                  : 'No stories found in this category yet.'}
              </p>
              {selectedSubtheme && (
                <div className="mt-4">
                  <button
                    onClick={() => setSelectedSubtheme(null)}
                    className="px-5 py-2.5 rounded-full bg-[#53b8bb] text-[#111313] font-semibold text-xs inline-flex items-center gap-2 transition hover:bg-[#66c7ca]"
                  >
                    <span>{lang === 'pt' ? 'Ver todas as matérias' : 'View all stories'}</span>
                  </button>
                </div>
              )}
              {selectedCategory === 'last_24h' && !viewingSavedOnly && !selectedSubtheme && (
                <p className="text-xs text-[#8e9293] mb-5 max-w-md mx-auto leading-relaxed">
                  {t.no24hStoriesDesc}
                </p>
              )}
              {!viewingSavedOnly && !selectedSubtheme && (
                <button
                  onClick={() => fetchStories(selectedCategory)}
                  disabled={loadingStories}
                  className="px-5 py-2.5 rounded-full bg-[#202222] hover:bg-[#282b2b] border border-white/[0.08] text-[#ececec] font-semibold text-xs inline-flex items-center gap-2 transition"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 text-[#53b8bb] ${
                      loadingStories ? 'animate-spin' : ''
                    }`}
                  />
                  <span>{lang === 'pt' ? 'Atualizar Notícias' : 'Refresh News'}</span>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-10">
              {/* 1. TOP FEATURED HERO STORY (Exactly like Perplexity Discover Image #1) */}
              {heroStory && (
                <DiscoverHeroStory
                  story={heroStory}
                  lang={lang}
                  isSaved={savedStoryIds.has(heroStory.id)}
                  onToggleSave={handleToggleSave}
                />
              )}

              {/* 2. THREE-COLUMN EDITORIAL GRID BELOW */}
              {gridStories.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
                  {gridStories.map((story) => (
                    <StoryCard
                      key={story.id}
                      story={story}
                      lang={lang}
                      isSaved={savedStoryIds.has(story.id)}
                      onToggleSave={handleToggleSave}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* ================= MINIMALIST FOOTER ================= */}
      <footer className="w-full py-8 border-t border-white/[0.06] text-center text-[#8e9293] bg-[#161717]">
        <div className="max-w-[1160px] mx-auto px-5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2.5">
            <BrandLogo size="sm" />
            <span>— reach.news</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-5">
            <span className="hover:text-[#ececec] cursor-pointer transition">{t.footerTerms}</span>
            <span className="hover:text-[#ececec] cursor-pointer transition">{t.footerPrivacy}</span>
          </div>
        </div>
      </footer>

      {/* ================= MODALS ================= */}
      {authModalMode && (
        <AuthModal
          mode={authModalMode}
          lang={lang}
          apiBaseUrl={API_BASE_URL}
          onClose={() => setAuthModalMode(null)}
          onSwitchMode={(m) => setAuthModalMode(m)}
          onSuccess={(newToken, newUser) => {
            saveAuthSession(newToken, newUser);
            setToken(newToken);
            setUser(newUser);
            setSelectedCategory('for_you');
          }}
        />
      )}

      {showInterestsModal && (
        <InterestsModal
          lang={lang}
          apiBaseUrl={API_BASE_URL}
          token={token}
          user={user}
          onClose={() => setShowInterestsModal(false)}
          onSaved={(newInterests, newAffinity) => {
            if (user) {
              const updatedUser = { ...user, interests: newInterests, affinityMap: newAffinity };
              setUser(updatedUser);
              touchAuthSession(token || undefined, updatedUser);
            }
            if (selectedCategory === 'for_you') {
              fetchStories('for_you');
            }
          }}
        />
      )}

      {/* Floating Bottom-Right AI Bot */}
      <FloatingAiBot lang={lang} apiBaseUrl={API_BASE_URL} />
    </div>
  );
}
