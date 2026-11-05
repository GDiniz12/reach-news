'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Language, Story, StoryChatMessage, UI_TEXT, UserProfile } from '@/lib/types';
import { SourceIconsCluster } from '@/components/StoryCard';
import { AuthModal } from '@/components/Modals';
import { FloatingAiBot } from '@/components/FloatingAiBot';
import { BrandLogo } from '@/components/BrandLogo';
import { recordUserSignal } from '@/lib/telemetry';
import {
  ArrowLeft,
  FileText,
  Layers,
  ExternalLink,
  Heart,
  Globe,
  Scale,
  CheckCircle2,
  Loader2,
  Clock,
  Share2,
  Compass,
} from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001';

export default function StoryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const slug = String(params?.slug || '');

  const initialLang = (searchParams?.get('lang') === 'en' ? 'en' : 'pt') as Language;
  const [lang, setLang] = useState<Language>(initialLang);

  const [story, setStory] = useState<Story | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  // Default to full journalistic article ('article') so the user immediately sees the Perplexity Discover editorial body
  const [viewMode, setViewMode] = useState<'article' | 'particle'>('article');
  const [messages, setMessages] = useState<StoryChatMessage[]>([]);

  // Auth & Bookmark state
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [authModalMode, setAuthModalMode] = useState<'signin' | 'signup' | null>(null);
  const [copied, setCopied] = useState(false);

  const t = UI_TEXT[lang];

  useEffect(() => {
    const urlLang = searchParams?.get('lang');
    if (urlLang === 'pt' || urlLang === 'en') {
      setLang(urlLang);
      localStorage.setItem('reach_news_lang', urlLang);
      return;
    }
    const savedLang = localStorage.getItem('reach_news_lang') as Language | null;
    if (savedLang === 'pt' || savedLang === 'en') {
      setLang(savedLang);
    }
  }, [searchParams]);

  const handleSetLang = (newLang: Language) => {
    setLang(newLang);
    localStorage.setItem('reach_news_lang', newLang);
  };

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    fetch(`${API_BASE_URL}/api/stories/${encodeURIComponent(slug)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.story) {
          setStory(data.story);
          setMessages(data.story.chatMessages || []);
        }
      })
      .catch((err) => console.error('Error loading story:', err))
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    const savedToken = localStorage.getItem('reach_news_token');
    if (savedToken) {
      setToken(savedToken);
      fetch(`${API_BASE_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${savedToken}` },
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.user) {
            setUser(data.user);
            if (story && Array.isArray(data.user.savedStories)) {
              setIsSaved(data.user.savedStories.some((s: Story) => s.id === story.id));
            }
          }
        })
        .catch(() => {});
    }
  }, [story?.id]);

  // Behavioral Telemetry: Record "view" (+2 pts) immediately & "dwell" (+4 pts) after 20s of active reading
  useEffect(() => {
    if (!story) return;
    const activeToken = localStorage.getItem('reach_news_token');

    recordUserSignal({
      apiBaseUrl: API_BASE_URL,
      token: activeToken,
      storyId: story.id,
      category: story.category,
      topicTag: story.topicTagPt,
      eventType: 'view',
    });

    const dwellTimer = setTimeout(() => {
      recordUserSignal({
        apiBaseUrl: API_BASE_URL,
        token: activeToken,
        storyId: story.id,
        category: story.category,
        topicTag: story.topicTagPt,
        eventType: 'dwell',
      });
    }, 20000);

    return () => clearTimeout(dwellTimer);
  }, [story?.id]);

  const handleToggleSave = async () => {
    if (!story) return;
    if (!token || !user) {
      router.push(`/auth?mode=signin&redirect=${encodeURIComponent(`/story/${slug}`)}`);
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/stories/${story.id}/bookmark`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setIsSaved(Boolean(data.saved));
      if (data.saved) {
        recordUserSignal({
          apiBaseUrl: API_BASE_URL,
          token,
          storyId: story.id,
          category: story.category,
          topicTag: story.topicTagPt,
          eventType: 'bookmark',
        });
      }
    } catch {
      // ignore
    }
  };

  const handleShare = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  /**
   * Formats inline Markdown (**bold**, *italic*) inside article paragraphs
   */
  const renderInlineArticleText = (text: string): React.ReactNode => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
        return (
          <strong key={idx} className="font-semibold text-[#f3f4f4]">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part.replace(/\*(.*?)\*/g, '$1');
    });
  };

  /**
   * Renders the journalistic article body using the exact Perplexity Discover serif typography
   * shown in screenshot #2 (Source Serif 4 / Georgia, warm off-white #e4e5e5, generous line-height).
   */
  const renderMarkdownArticle = (md: string) => {
    return md.replace(/\r\n/g, '\n').split(/\n\n+/).map((block, idx) => {
      const trimmed = block.trim();
      if (!trimmed) return null;

      if (trimmed.startsWith('### ')) {
        return (
          <h3
            key={idx}
            className="font-editorial text-[22px] font-medium text-[#53b8bb] mt-8 mb-3"
          >
            {renderInlineArticleText(trimmed.replace(/^###\s+/, ''))}
          </h3>
        );
      }

      if (/^#{1,2}\s+/.test(trimmed)) {
        return (
          <h2
            key={idx}
            className="font-editorial text-[27px] sm:text-[31px] font-normal text-[#ececec] mt-11 mb-5 leading-[1.22] tracking-[-0.01em]"
          >
            {renderInlineArticleText(trimmed.replace(/^#{1,2}\s+/, ''))}
          </h2>
        );
      }

      if (trimmed.startsWith('> ')) {
        return (
          <blockquote
            key={idx}
            className="font-editorial my-8 pl-6 border-l-2 border-[#53b8bb] text-[#dcdede] italic text-[20px] sm:text-[21px] leading-[1.6]"
          >
            {renderInlineArticleText(trimmed.replace(/^>\s+/gm, ''))}
          </blockquote>
        );
      }

      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const items = trimmed.split('\n').map((line) => line.replace(/^[-*]\s+/, ''));
        return (
          <ul
            key={idx}
            className="font-editorial my-6 space-y-3 list-disc list-inside text-[#dcdede] text-[19px] sm:text-[20px]"
          >
            {items.map((li, i) => (
              <li key={i} className="leading-[1.68]">
                {renderInlineArticleText(li)}
              </li>
            ))}
          </ul>
        );
      }

      return (
        <p
          key={idx}
          className="font-editorial text-[#dcdede] leading-[1.68] text-[19.5px] sm:text-[21px] mb-7 font-normal tracking-[-0.005em]"
        >
          {renderInlineArticleText(trimmed)}
        </p>
      );
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#191a1a] flex flex-col items-center justify-center gap-4 text-[#8e9293]">
        <Loader2 className="w-7 h-7 animate-spin text-[#53b8bb]" />
        <p className="text-sm font-medium">
          {lang === 'pt' ? 'Carregando reportagem...' : 'Loading story...'}
        </p>
      </div>
    );
  }

  if (!story) {
    return (
      <div className="min-h-screen bg-[#191a1a] flex flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="font-editorial text-3xl text-[#ececec]">
          {lang === 'pt' ? 'Notícia não encontrada' : 'Story not found'}
        </h1>
        <Link
          href="/"
          className="px-5 py-2.5 rounded-full bg-[#53b8bb] text-[#111313] font-semibold text-sm inline-flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{lang === 'pt' ? 'Voltar ao Discover' : 'Back to Discover'}</span>
        </Link>
      </div>
    );
  }

  const title = lang === 'pt' ? story.titlePt : story.titleEn;
  const summary = lang === 'pt' ? story.summaryPt : story.summaryEn;
  const topicTag = lang === 'pt' ? story.topicTagPt : story.topicTagEn;
  const bullets = lang === 'pt' ? story.bulletPointsPt : story.bulletPointsEn;
  const perspectives = lang === 'pt' ? story.perspectivesPt : story.perspectivesEn;
  const fullArticle = lang === 'pt' ? story.fullArticlePt : story.fullArticleEn;

  const hoursDiff = Math.max(
    1,
    Math.round((Date.now() - new Date(story.publishedAt).getTime()) / (1000 * 60 * 60))
  );

  return (
    <div className="min-h-screen bg-[#191a1a] text-[#ececec] flex flex-col justify-between">
      <div>
        {/* ================= TOP NAVIGATION HEADER ================= */}
        <header className="sticky top-0 z-30 bg-[#191a1a]/90 backdrop-blur-md border-b border-white/[0.06]">
          <div className="max-w-[1040px] mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/')}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#202222] hover:bg-[#282b2b] border border-white/[0.08] text-xs font-medium text-[#ececec] transition"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-[#53b8bb]" />
                <span>{lang === 'pt' ? 'Discover' : 'Discover'}</span>
              </button>

              <Link href="/" className="hidden sm:flex items-center gap-2 select-none group">
                <BrandLogo size="sm" />
              </Link>
            </div>

            <div className="flex items-center gap-2.5">
              {/* Bilingual Switcher */}
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

              <button
                onClick={handleShare}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#202222] hover:bg-[#282b2b] text-[#ececec] text-xs font-medium border border-white/[0.07] transition"
              >
                <Share2 className="w-3.5 h-3.5 text-[#53b8bb]" />
                <span className="hidden sm:inline">
                  {copied
                    ? lang === 'pt'
                      ? 'Copiado!'
                      : 'Copied!'
                    : lang === 'pt'
                    ? 'Compartilhar'
                    : 'Share'}
                </span>
              </button>

              <button
                onClick={handleToggleSave}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium border transition ${
                  isSaved
                    ? 'bg-[#53b8bb]/15 text-[#53b8bb] border-[#53b8bb]/40'
                    : 'bg-[#202222] hover:bg-[#282b2b] text-[#ececec] border-white/[0.07]'
                }`}
              >
                <Heart className={`w-3.5 h-3.5 ${isSaved ? 'fill-[#53b8bb] text-[#53b8bb]' : ''}`} />
                <span>{isSaved ? t.bookmarkSaved : t.bookmarkSave}</span>
              </button>
            </div>
          </div>
        </header>

        {/* ================= MAIN ARTICLE CONTAINER (PERPLEXITY DISCOVER BODY STYLE) ================= */}
        <main className="max-w-[820px] mx-auto px-5 sm:px-8 pt-10 sm:pt-14 pb-20">
          {/* Category & Meta Row */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
            <div className="flex items-center gap-3 text-xs text-[#8e9293] font-sans">
              <span className="px-2.5 py-1 rounded-md bg-[#202222] text-[#53b8bb] font-semibold border border-white/[0.06]">
                {topicTag}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                {lang === 'pt'
                  ? `Publicado há ${hoursDiff} ${hoursDiff === 1 ? 'hora' : 'horas'}`
                  : `Published ${hoursDiff} ${hoursDiff === 1 ? 'hour' : 'hours'} ago`}
              </span>
            </div>

            <SourceIconsCluster
              sources={story.sources}
              count={story.articleCount || story.sources?.length || 12}
              lang={lang}
            />
          </div>

          {/* Large Editorial Serif Headline (Exactly matching Screenshot #2) */}
          <h1 className="font-editorial text-[29px] sm:text-[44px] lg:text-[50px] text-[#ececec] leading-[1.15] tracking-[-0.015em] font-normal mb-6">
            {title}
          </h1>

          {/* Reading Mode Toggle Bar + Featured Photo */}
          <div className="my-6 py-2.5 px-4 rounded-2xl bg-[#202222] border border-white/[0.06] flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-medium text-[#8e9293]">
              {lang === 'pt' ? 'Modo de leitura:' : 'Reading mode:'}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode('article')}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition ${
                  viewMode === 'article'
                    ? 'bg-[#53b8bb] text-[#111313]'
                    : 'text-[#9ba0a1] hover:text-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>{t.fullArticleMode}</span>
              </button>
              <button
                onClick={() => setViewMode('particle')}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition ${
                  viewMode === 'particle'
                    ? 'bg-[#53b8bb] text-[#111313]'
                    : 'text-[#9ba0a1] hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{t.particleMode}</span>
              </button>
            </div>
          </div>

          <figure className="my-7">
            <div className="relative rounded-[18px] overflow-hidden bg-[#202222] border border-white/[0.07] aspect-[16/9]">
              <img
                src={story.imageUrl}
                alt={title}
                className="w-full h-full object-cover"
              />
            </div>
          </figure>

          {/* BODY CONTENT */}
          {viewMode === 'article' ? (
            /* Editorial Serif Body matching Screenshot #2 */
            <article className="mt-6">
              {renderMarkdownArticle(fullArticle)}
            </article>
          ) : (
            /* 360° Synthesis Mode (Takeaways + Perspectives) */
            <div className="space-y-10 mt-6">
              <section className="bg-[#202222] border border-white/[0.06] rounded-2xl p-6 sm:p-8">
                <div className="flex items-center gap-2 text-[#53b8bb] font-semibold text-xs uppercase tracking-wider mb-5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{t.keyTakeaways}</span>
                </div>
                <ul className="space-y-4">
                  {(Array.isArray(bullets) ? bullets : []).map((point, i) => (
                    <li
                      key={i}
                      className="font-editorial flex items-start gap-3.5 text-[#dcdede] text-[19px] leading-[1.6]"
                    >
                      <span className="w-6 h-6 rounded-full bg-[#2c3030] text-[#53b8bb] font-sans text-xs font-bold flex items-center justify-center shrink-0 mt-1">
                        {i + 1}
                      </span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="space-y-4">
                <div className="flex items-center gap-2 text-[#53b8bb] font-semibold text-xs uppercase tracking-wider">
                  <Scale className="w-4 h-4" />
                  <span>{t.perspectivesTitle}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {(Array.isArray(perspectives) ? perspectives : []).map((p, idx) => (
                    <div
                      key={idx}
                      className="bg-[#202222] border border-white/[0.06] rounded-2xl p-5 flex flex-col justify-between"
                    >
                      <div>
                        <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded bg-[#53b8bb]/15 text-[#53b8bb] mb-2.5">
                          {p.stance}
                        </span>
                        <h3 className="font-editorial text-[#ececec] text-lg font-medium mb-2">
                          {p.label}
                        </h3>
                        <p className="text-[#9ba0a1] text-sm leading-relaxed">{p.summary}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {/* ================= SOURCES AT THE VERY BOTTOM OF THE ARTICLE ================= */}
          <section className="mt-12 pt-8 border-t border-white/[0.08]">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2 text-[#ececec] font-semibold text-sm">
                <Globe className="w-4 h-4 text-[#53b8bb]" />
                <span>{t.sourcesTitle}</span>
              </div>
              <SourceIconsCluster
                sources={story.sources}
                count={story.sources?.length || story.articleCount || 12}
                lang={lang}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
              {(story.sources || []).map((src, idx) => (
                <a
                  key={src.id || idx}
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col justify-between p-4 rounded-xl bg-[#202222] hover:bg-[#262828] border border-white/[0.06] transition group"
                >
                  <div>
                    <div className="flex items-center justify-between text-xs text-[#53b8bb] font-semibold mb-1.5">
                      <span className="truncate">{src.name}</span>
                      <ExternalLink className="w-3 h-3 opacity-50 group-hover:opacity-100 shrink-0" />
                    </div>
                    <h4 className="font-sans text-[#ececec] text-xs font-medium leading-snug line-clamp-2 group-hover:underline">
                      {src.title}
                    </h4>
                  </div>
                </a>
              ))}
            </div>
          </section>
        </main>
      </div>

      {/* Floating Bottom-Right AI Bot */}
      <FloatingAiBot
        lang={lang}
        apiBaseUrl={API_BASE_URL}
        story={story}
        initialMessages={messages}
      />

      {/* Auth Modal */}
      {authModalMode && (
        <AuthModal
          mode={authModalMode}
          lang={lang}
          apiBaseUrl={API_BASE_URL}
          onClose={() => setAuthModalMode(null)}
          onSwitchMode={(m) => setAuthModalMode(m)}
          onSuccess={(newToken, newUser) => {
            localStorage.setItem('reach_news_token', newToken);
            setToken(newToken);
            setUser(newUser);
          }}
        />
      )}
    </div>
  );
}
