'use client';

import React, { useState } from 'react';
import { Story, StoryChatMessage, UI_TEXT } from '@/lib/types';
import {
  X,
  Sparkles,
  FileText,
  Layers,
  ExternalLink,
  MessageSquare,
  Send,
  Bookmark,
  BookmarkCheck,
  Globe,
  Scale,
  CheckCircle2,
  Loader2,
} from 'lucide-react';

interface StoryDetailModalProps {
  story: Story;
  lang: 'pt' | 'en';
  isSaved: boolean;
  onClose: () => void;
  onToggleSave: (storyId: string) => void;
  apiBaseUrl: string;
}

export function StoryDetailModal({
  story,
  lang,
  isSaved,
  onClose,
  onToggleSave,
  apiBaseUrl,
}: StoryDetailModalProps) {
  const [viewMode, setViewMode] = useState<'particle' | 'article'>('particle');
  const [question, setQuestion] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [messages, setMessages] = useState<StoryChatMessage[]>(story.chatMessages || []);

  const t = UI_TEXT[lang];
  const title = lang === 'pt' ? story.titlePt : story.titleEn;
  const summary = lang === 'pt' ? story.summaryPt : story.summaryEn;
  const topicTag = lang === 'pt' ? story.topicTagPt : story.topicTagEn;
  const bullets = lang === 'pt' ? story.bulletPointsPt : story.bulletPointsEn;
  const perspectives = lang === 'pt' ? story.perspectivesPt : story.perspectivesEn;
  const fullArticle = lang === 'pt' ? story.fullArticlePt : story.fullArticleEn;

  const handleAskAi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || chatLoading) return;

    const userQ = question.trim();
    setQuestion('');
    setChatLoading(true);

    const tempUserMsg: StoryChatMessage = {
      id: 'temp-' + Date.now(),
      storyId: story.id,
      role: 'user',
      content: userQ,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const res = await fetch(`${apiBaseUrl}/api/stories/${story.id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: userQ, lang }),
      });
      const data = await res.json();
      if (data.message) {
        setMessages((prev) => [...prev, data.message]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: 'err-' + Date.now(),
          storyId: story.id,
          role: 'assistant',
          content:
            lang === 'pt'
              ? 'Erro ao contatar o servidor de IA.'
              : 'Failed to contact the AI server.',
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  // Render simple Markdown paragraphs & headings cleanly for Full Article Mode
  const renderMarkdownArticle = (md: string) => {
    return md.split('\n\n').map((block, idx) => {
      const trimmed = block.trim();
      if (!trimmed) return null;
      if (trimmed.startsWith('## ')) {
        return (
          <h3
            key={idx}
            className="text-xl font-bold text-white mt-7 mb-3 tracking-tight border-l-4 pl-3"
            style={{ borderColor: story.dominantColor }}
          >
            {trimmed.replace('## ', '')}
          </h3>
        );
      }
      if (trimmed.startsWith('> ')) {
        return (
          <blockquote
            key={idx}
            className="my-5 p-4 rounded-xl bg-white/5 border-l-4 text-white/90 italic text-base"
            style={{ borderColor: '#f3795b' }}
          >
            {trimmed.replace('> ', '')}
          </blockquote>
        );
      }
      if (trimmed.startsWith('- ')) {
        const items = trimmed.split('\n').map((line) => line.replace(/^- /, ''));
        return (
          <ul key={idx} className="my-4 space-y-2 list-disc list-inside text-white/85">
            {items.map((li, i) => (
              <li key={i} className="leading-relaxed">
                {li.replace(/\*\*(.*?)\*\*/g, '$1')}
              </li>
            ))}
          </ul>
        );
      }
      return (
        <p key={idx} className="text-white/85 leading-[1.75] text-[16px] mb-4">
          {trimmed.replace(/\*\*(.*?)\*\*/g, '$1')}
        </p>
      );
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-6 overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-[#1a0d09] border border-white/15 rounded-3xl overflow-hidden shadow-2xl my-auto max-h-[92vh] flex flex-col">
        {/* Hero Header with Dominant Color Gradient */}
        <div
          className="relative p-6 sm:p-8 flex flex-col justify-end min-h-[240px]"
          style={{
            background: `linear-gradient(135deg, ${story.dominantColor} 0%, #1a0d09 95%)`,
          }}
        >
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-black/40 text-[#f3795b] border border-[#f3795b]/30">
                {topicTag}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-white/15 text-white">
                {story.articleCount} {t.articlesCount}
              </span>
              {story.isRadarGenerated && (
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" /> OmniRoute Radar
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => onToggleSave(story.id)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-black/40 hover:bg-black/60 text-white text-xs font-semibold border border-white/15 transition"
              >
                {isSaved ? (
                  <>
                    <BookmarkCheck className="w-4 h-4 text-[#f3795b]" />
                    <span>{t.bookmarkSaved}</span>
                  </>
                ) : (
                  <>
                    <Bookmark className="w-4 h-4" />
                    <span>{t.bookmarkSave}</span>
                  </>
                )}
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-full bg-black/40 hover:bg-black/70 text-white/80 hover:text-white border border-white/15 transition"
                aria-label={t.closeModal}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight mb-3">
            {title}
          </h2>
          <p className="text-white/90 text-sm sm:text-base max-w-3xl leading-relaxed">
            {summary}
          </p>

          {/* Mode Switcher Bar: Particle Mode (Option 1) vs Full Journalistic Article (Option 2) */}
          <div className="mt-6 flex flex-wrap items-center gap-2 pt-4 border-t border-white/15">
            <button
              onClick={() => setViewMode('particle')}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs sm:text-sm font-bold transition ${
                viewMode === 'particle'
                  ? 'bg-[#f3795b] text-black shadow-lg'
                  : 'bg-black/35 text-white/75 hover:text-white border border-white/10'
              }`}
            >
              <Layers className="w-4 h-4" />
              {t.particleMode}
            </button>
            <button
              onClick={() => setViewMode('article')}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs sm:text-sm font-bold transition ${
                viewMode === 'article'
                  ? 'bg-[#f3795b] text-black shadow-lg'
                  : 'bg-black/35 text-white/75 hover:text-white border border-white/10'
              }`}
            >
              <FileText className="w-4 h-4" />
              {t.fullArticleMode}
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column (8 cols): Either Particle 360° Mode OR Full Journalistic Article */}
          <div className="lg:col-span-8 space-y-8">
            {viewMode === 'particle' ? (
              <>
                {/* 5W1H / Bullet Points */}
                <section className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
                  <div className="flex items-center gap-2 text-[#f3795b] font-bold text-sm uppercase tracking-wider mb-4">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{t.keyTakeaways}</span>
                  </div>
                  <ul className="space-y-3.5">
                    {(Array.isArray(bullets) ? bullets : []).map((point, i) => (
                      <li key={i} className="flex items-start gap-3 text-white/90 text-[15px] leading-relaxed">
                        <span
                          className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 text-white"
                          style={{ backgroundColor: story.dominantColor }}
                        >
                          {i + 1}
                        </span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </section>

                {/* Perspectives Comparison */}
                <section className="space-y-4">
                  <div className="flex items-center gap-2 text-[#f3795b] font-bold text-sm uppercase tracking-wider">
                    <Scale className="w-4 h-4" />
                    <span>{t.perspectivesTitle}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {(Array.isArray(perspectives) ? perspectives : []).map((p, idx) => (
                      <div
                        key={idx}
                        className="bg-white/[0.04] border border-white/10 rounded-2xl p-4 flex flex-col justify-between"
                      >
                        <div>
                          <span className="inline-block text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-white/10 text-[#f3795b] mb-2">
                            {p.stance}
                          </span>
                          <h4 className="font-bold text-white text-sm mb-2">{p.label}</h4>
                          <p className="text-white/75 text-xs leading-relaxed">{p.summary}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </>
            ) : (
              /* Option 2: Detailed Journalistic Article Mode */
              <section className="bg-white/[0.02] border border-white/10 rounded-2xl p-6 sm:p-8">
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
                  <div className="flex items-center gap-2 text-xs text-white/60">
                    <Sparkles className="w-4 h-4 text-[#f3795b]" />
                    <span>
                      {lang === 'pt'
                        ? 'Reportagem sintetizada por IA via OmniRoute a partir de múltiplas fontes'
                        : 'AI-synthesized journalistic report via OmniRoute across multiple outlets'}
                    </span>
                  </div>
                </div>
                <div className="prose prose-invert max-w-none">
                  {renderMarkdownArticle(fullArticle)}
                </div>
              </section>
            )}

            {/* Interactive OmniRoute AI Q&A Box */}
            <section className="bg-gradient-to-br from-[#281510] to-[#160b08] border border-[#f3795b]/30 rounded-2xl p-5 sm:p-6">
              <div className="flex items-center gap-2 text-white font-bold text-sm mb-3">
                <MessageSquare className="w-4 h-4 text-[#f3795b]" />
                <span>{t.askAiTitle}</span>
              </div>

              {messages.length > 0 && (
                <div className="space-y-3 mb-4 max-h-60 overflow-y-auto pr-2">
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={`p-3.5 rounded-xl text-sm leading-relaxed ${
                        m.role === 'user'
                          ? 'bg-white/10 text-white ml-8'
                          : 'bg-black/40 border border-white/10 text-white/90 mr-4'
                      }`}
                    >
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-[#f3795b] mb-1">
                        {m.role === 'user' ? (lang === 'pt' ? 'Você' : 'You') : 'OmniRoute AI'}
                      </span>
                      {m.content}
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={handleAskAi} className="flex gap-2">
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder={t.askAiPlaceholder}
                  className="flex-1 bg-black/50 border border-white/15 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/40 focus:outline-none focus:border-[#f3795b]"
                />
                <button
                  type="submit"
                  disabled={chatLoading}
                  className="px-4 py-2.5 rounded-xl bg-[#f3795b] hover:bg-[#f5896e] text-black font-bold text-sm flex items-center gap-1.5 transition disabled:opacity-50"
                >
                  {chatLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  <span>{t.askAiSend}</span>
                </button>
              </form>
            </section>
          </div>

          {/* Right Column (4 cols): Verified Original Sources List */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 sticky top-0">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-white font-bold text-sm">
                  <Globe className="w-4 h-4 text-[#f3795b]" />
                  <span>{t.sourcesTitle}</span>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/80">
                  {story.sources?.length || 0}
                </span>
              </div>

              <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                {(story.sources || []).map((src) => (
                  <a
                    key={src.id}
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-3.5 rounded-xl bg-black/35 hover:bg-white/[0.07] border border-white/10 transition group"
                  >
                    <div className="flex items-center justify-between text-xs text-[#f3795b] font-bold mb-1">
                      <span>{src.name}</span>
                      <ExternalLink className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
                    </div>
                    <h5 className="text-white text-xs font-semibold leading-snug mb-1 group-hover:underline">
                      {src.title}
                    </h5>
                    {src.snippet && (
                      <p className="text-white/55 text-[11px] line-clamp-2">{src.snippet}</p>
                    )}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
