'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Language, Story, StoryChatMessage } from '@/lib/types';
import { recordUserSignal } from '@/lib/telemetry';
import { MessageSquare, X, Send, Sparkles, Loader2, Bot } from 'lucide-react';

interface FloatingAiBotProps {
  lang: Language;
  apiBaseUrl: string;
  story?: Story | null;
  initialMessages?: StoryChatMessage[];
}

export function FloatingAiBot({
  lang,
  apiBaseUrl,
  story = null,
  initialMessages = [],
}: FloatingAiBotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<StoryChatMessage[]>(initialMessages);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMessages(initialMessages);
  }, [story?.id]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSend = async (customQuestion?: string) => {
    const qText = (customQuestion ?? question).trim();
    if (!qText || loading) return;

    setQuestion('');
    setLoading(true);

    const userMsg: StoryChatMessage = {
      id: 'user-' + Date.now(),
      storyId: story?.id || '',
      role: 'user',
      content: qText,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);

    if (story) {
      const activeToken =
        typeof window !== 'undefined' ? localStorage.getItem('reach_news_token') : null;
      recordUserSignal({
        apiBaseUrl,
        token: activeToken,
        storyId: story.id,
        category: story.category,
        topicTag: story.topicTagPt,
        eventType: 'chat',
      });
    }

    try {
      const endpoint = story?.id
        ? `${apiBaseUrl}/api/stories/${story.id}/chat`
        : `${apiBaseUrl}/api/chat`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: qText,
          storyId: story?.id,
          lang,
        }),
      });

      const data = await res.json();
      if (data?.message) {
        setMessages((prev) => [...prev, data.message]);
      } else if (data?.answer) {
        setMessages((prev) => [
          ...prev,
          {
            id: 'ai-' + Date.now(),
            storyId: story?.id || '',
            role: 'assistant',
            content: data.answer,
            createdAt: new Date().toISOString(),
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: 'err-' + Date.now(),
          storyId: story?.id || '',
          role: 'assistant',
          content:
            lang === 'pt'
              ? 'Não foi possível conectar ao assistente de IA no momento.'
              : 'Could not connect to the AI assistant right now.',
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Formats inline Markdown (**bold**, *italic*, `code`) into React elements
   */
  const renderInlineMarkdown = (text: string): React.ReactNode => {
    const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
        return (
          <strong key={idx} className="font-semibold text-white">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
        return (
          <code
            key={idx}
            className="px-1.5 py-0.5 rounded bg-white/10 text-[#53b8bb] font-mono text-[12px]"
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      return part.replace(/\*(.*?)\*/g, '$1');
    });
  };

  /**
   * Formats block-level Markdown (headings, bullet lists, numbered lists, blockquotes, paragraphs) for chat bubbles
   */
  const renderChatMarkdown = (content: string) => {
    const blocks = content.replace(/\r\n/g, '\n').split(/\n\n+/);

    return blocks.map((block, bIdx) => {
      const trimmed = block.trim();
      if (!trimmed) return null;

      // Headings (#, ##, ###)
      if (/^#{1,4}\s+/.test(trimmed)) {
        const headingText = trimmed.replace(/^#{1,4}\s+/, '');
        return (
          <h4
            key={bIdx}
            className="font-semibold text-[#53b8bb] text-[13.5px] mt-2.5 mb-1 leading-snug"
          >
            {renderInlineMarkdown(headingText)}
          </h4>
        );
      }

      // Blockquote (>)
      if (trimmed.startsWith('> ')) {
        return (
          <blockquote
            key={bIdx}
            className="pl-3 border-l-2 border-[#53b8bb] italic text-[#b4b8b9] my-2 text-[12.5px]"
          >
            {renderInlineMarkdown(trimmed.replace(/^>\s+/gm, ''))}
          </blockquote>
        );
      }

      // Multi-line or single-line bullet / numbered lists
      const lines = trimmed.split('\n');
      const isList = lines.every(
        (l) => /^(\s*[-*•]\s+|\s*\d+\.\s+)/.test(l.trim()) || !l.trim()
      );

      if (isList) {
        return (
          <ul key={bIdx} className="space-y-1.5 my-2 pl-1">
            {lines
              .filter((l) => l.trim().length > 0)
              .map((line, lIdx) => {
                const cleanLine = line
                  .trim()
                  .replace(/^([-*•]|\d+\.)\s+/, '');
                return (
                  <li key={lIdx} className="flex items-start gap-2 text-[13px] leading-relaxed">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#53b8bb] shrink-0 mt-2" />
                    <span className="flex-1">{renderInlineMarkdown(cleanLine)}</span>
                  </li>
                );
              })}
          </ul>
        );
      }

      // Mixed paragraph with inline line breaks or embedded bullets
      return (
        <div key={bIdx} className="space-y-1.5 mb-2.5 last:mb-0">
          {lines.map((line, lIdx) => {
            const tLine = line.trim();
            if (!tLine) return null;
            if (/^#{1,4}\s+/.test(tLine)) {
              return (
                <h4 key={lIdx} className="font-semibold text-[#53b8bb] text-[13.5px] mt-2">
                  {renderInlineMarkdown(tLine.replace(/^#{1,4}\s+/, ''))}
                </h4>
              );
            }
            if (/^([-*•]|\d+\.)\s+/.test(tLine)) {
              const cleanItem = tLine.replace(/^([-*•]|\d+\.)\s+/, '');
              return (
                <div key={lIdx} className="flex items-start gap-2 pl-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#53b8bb] shrink-0 mt-2" />
                  <span className="flex-1">{renderInlineMarkdown(cleanItem)}</span>
                </div>
              );
            }
            return (
              <p key={lIdx} className="leading-relaxed">
                {renderInlineMarkdown(tLine)}
              </p>
            );
          })}
        </div>
      );
    });
  };

  const quickSuggestions = story
    ? lang === 'pt'
      ? [
          'Quais os principais impactos dessa notícia?',
          'Resuma os pontos-chave em 3 tópicos',
          'Qual é o contexto histórico desse caso?',
        ]
      : [
          'What are the main impacts of this story?',
          'Summarize the key points in 3 bullets',
          'What is the background context here?',
        ]
    : lang === 'pt'
    ? [
        'O que aconteceu de mais importante nas últimas 24 horas?',
        'Quais são os assuntos mais comentados hoje?',
        'Me explique os últimos avanços em IA',
      ]
    : [
        'What were the most critical events in the last 24 hours?',
        'What are the top trending topics today?',
        'Explain the latest breakthroughs in AI',
      ];

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 flex flex-col items-end">
      {/* Chat Window */}
      {isOpen && (
        <div className="mb-3 w-[calc(100vw-2rem)] sm:w-[400px] h-[68vh] sm:h-[510px] max-h-[78vh] rounded-2xl bg-[#202222] border border-white/[0.12] shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
          {/* Header */}
          <div className="px-4 py-3.5 bg-[#191a1a] border-b border-white/[0.08] flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-[#53b8bb]/15 border border-[#53b8bb]/40 flex items-center justify-center text-[#53b8bb] shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-xs font-semibold text-[#ececec] truncate">
                    reach.news AI
                  </h3>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                </div>
                <p className="text-[11px] text-[#8e9293] truncate">
                  {story
                    ? lang === 'pt'
                      ? 'Tire dúvidas sobre esta matéria ou qualquer assunto'
                      : 'Ask about this story or any other topic'
                    : lang === 'pt'
                    ? 'Pergunte sobre qualquer notícia ou assunto'
                    : 'Ask about any news or topic'}
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-full text-[#8e9293] hover:text-white hover:bg-white/[0.06] transition"
              aria-label="Fechar chat"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Story Context Pill (if reading an article) */}
          {story && (
            <div className="px-4 py-2 bg-[#1c1e1e] border-b border-white/[0.05] flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-[#53b8bb] shrink-0" />
              <span className="text-[11px] text-[#9ba0a1] truncate">
                {lang === 'pt' ? 'Lendo:' : 'Reading:'}{' '}
                <strong className="text-[#dcdede] font-medium">
                  {lang === 'pt' ? story.titlePt : story.titleEn}
                </strong>
              </span>
            </div>
          )}

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col justify-between py-2">
                <div className="p-3.5 rounded-xl bg-[#191a1a] border border-white/[0.06] text-xs text-[#b4b8b9] leading-relaxed">
                  {story
                    ? lang === 'pt'
                      ? 'Olá! Estou com o contexto completo desta reportagem aberto. Você pode me fazer perguntas específicas sobre ela ou perguntar sobre qualquer outro assunto.'
                      : 'Hi! I have the full context of this article loaded. Ask me anything about this story or any other topic.'
                    : lang === 'pt'
                    ? 'Olá! Sou o assistente inteligente do reach.news. Pergunte sobre qualquer notícia, tendência ou assunto.'
                    : 'Hi! I am the reach.news AI assistant. Ask me about any news story, trend, or topic.'}
                </div>

                <div className="space-y-2 mt-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8e9293] px-1">
                    {lang === 'pt' ? 'Sugestões rápidas' : 'Quick suggestions'}
                  </p>
                  {quickSuggestions.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSend(item)}
                      className="w-full text-left px-3 py-2 rounded-xl bg-[#191a1a] hover:bg-[#262929] border border-white/[0.06] hover:border-[#53b8bb]/40 text-xs text-[#dcdede] transition flex items-center justify-between gap-2"
                    >
                      <span className="truncate">{item}</span>
                      <Send className="w-3 h-3 text-[#53b8bb] shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex flex-col ${
                    m.role === 'user' ? 'items-end' : 'items-start'
                  }`}
                >
                  <div
                    className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                      m.role === 'user'
                        ? 'bg-[#53b8bb] text-[#111313] font-medium rounded-br-sm'
                        : 'bg-[#191a1a] border border-white/[0.07] text-[#e2e4e4] rounded-bl-sm'
                    }`}
                  >
                    {m.role === 'user' ? m.content : renderChatMarkdown(m.content)}
                  </div>
                </div>
              ))
            )}

            {loading && (
              <div className="flex items-start">
                <div className="bg-[#191a1a] border border-white/[0.07] rounded-2xl rounded-bl-sm px-3.5 py-2.5 flex items-center gap-2 text-xs text-[#8e9293]">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#53b8bb]" />
                  <span>{lang === 'pt' ? 'Analisando...' : 'Thinking...'}</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="p-3 bg-[#191a1a] border-t border-white/[0.08] flex items-center gap-2"
          >
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={
                lang === 'pt'
                  ? 'Pergunte sobre a notícia ou outro tema...'
                  : 'Ask about this story or any topic...'
              }
              className="flex-1 bg-[#202222] border border-white/[0.1] rounded-full px-4 py-2 text-xs text-[#ececec] placeholder-[#8e9293] focus:outline-none focus:border-[#53b8bb]"
            />
            <button
              type="submit"
              disabled={loading || !question.trim()}
              className="w-8 h-8 rounded-full bg-[#53b8bb] hover:bg-[#66c7ca] text-[#111313] flex items-center justify-center transition disabled:opacity-40 shrink-0"
              aria-label="Enviar pergunta"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}

      {/* Floating Launcher Button (Bottom-Right) */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="group flex items-center gap-2.5 h-13 px-4 py-3.5 rounded-full bg-[#53b8bb] hover:bg-[#65c8cb] text-[#111313] font-semibold text-xs shadow-xl shadow-black/50 border border-white/15 transition-all duration-200 hover:scale-[1.03]"
      >
        {isOpen ? (
          <>
            <X className="w-4 h-4 stroke-[2.5]" />
            <span>{lang === 'pt' ? 'Fechar Chat' : 'Close Chat'}</span>
          </>
        ) : (
          <>
            <MessageSquare className="w-4 h-4 stroke-[2.2]" />
            <span>{lang === 'pt' ? 'Perguntar à IA' : 'Ask AI'}</span>
          </>
        )}
      </button>
    </div>
  );
}
