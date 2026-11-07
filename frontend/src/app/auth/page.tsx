'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { INTEREST_CATEGORIES, Language, UI_TEXT } from '@/lib/types';
import { seedLocalInterests, saveAuthSession } from '@/lib/telemetry';
import { BrandLogo } from '@/components/BrandLogo';
import {
  Compass,
  ArrowLeft,
  Mail,
  Lock,
  User,
  Sparkles,
  Loader2,
  CheckCircle2,
  Globe,
  Layers,
  ShieldCheck,
  Eye,
  EyeOff,
  Check,
  Plus,
  ArrowRight,
} from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001';

function AuthPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialMode = searchParams?.get('mode') === 'signup' ? 'signup' : 'signin';
  const redirectUrl = searchParams?.get('redirect') || '/';

  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  const [step, setStep] = useState<'credentials' | 'interests'>('credentials');
  const [lang, setLang] = useState<Language>('pt');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Step 2: Onboarding Interest Picker state
  const [selectedInterests, setSelectedInterests] = useState<string[]>([
    'artificial_intelligence',
    'technology',
    'economics',
  ]);
  const [customTagInput, setCustomTagInput] = useState('');
  const [customTags, setCustomTags] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const t = UI_TEXT[lang];

  useEffect(() => {
    const modeParam = searchParams?.get('mode');
    if (modeParam === 'signup' || modeParam === 'signin') {
      setMode(modeParam);
      setStep('credentials');
      setError('');
    }
  }, [searchParams]);

  useEffect(() => {
    const savedLang = localStorage.getItem('reach_news_lang') as Language | null;
    if (savedLang === 'pt' || savedLang === 'en') {
      setLang(savedLang);
    }
  }, []);

  const handleSetLang = (newLang: Language) => {
    setLang(newLang);
    localStorage.setItem('reach_news_lang', newLang);
  };

  const switchMode = (newMode: 'signin' | 'signup') => {
    setMode(newMode);
    setStep('credentials');
    setError('');
  };

  const toggleInterest = (id: string) => {
    setSelectedInterests((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleAddCustomTag = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = customTagInput.trim();
    if (!cleaned || cleaned.length < 2) return;
    if (!customTags.includes(cleaned)) {
      setCustomTags((prev) => [...prev, cleaned]);
    }
    setCustomTagInput('');
  };

  const removeCustomTag = (tag: string) => {
    setCustomTags((prev) => prev.filter((tItem) => tItem !== tag));
  };

  // Step 1 handler: for Sign In submits immediately; for Sign Up validates & advances to Step 2 (Interests)
  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (mode === 'signup') {
      if (password.length < 6) {
        setError(
          lang === 'pt'
            ? 'A senha deve ter pelo menos 6 caracteres.'
            : 'Password must be at least 6 characters.'
        );
        return;
      }

      if (confirmPassword && password !== confirmPassword) {
        setError(
          lang === 'pt'
            ? 'As senhas informadas não coincidem.'
            : 'Passwords do not match.'
        );
        return;
      }

      // Advance to Step 2: Personalize "For You" Algorithm
      setStep('interests');
      return;
    }

    // Sign In flow
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/signin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.error ||
            (lang === 'pt' ? 'Falha na autenticação.' : 'Authentication failed.')
        );
      }

      if (data.token) {
        saveAuthSession(data.token, data.user);
      }
      if (Array.isArray(data.user?.interests)) {
        seedLocalInterests(data.user.interests);
      }
      router.push(redirectUrl);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Step 2 handler: Finalize Sign Up with selected interests
  const handleCompleteSignup = async () => {
    if (selectedInterests.length + customTags.length < 1) {
      setError(
        lang === 'pt'
          ? 'Selecione pelo menos 1 área de interesse para calibrar seu feed.'
          : 'Select at least 1 interest area to calibrate your feed.'
      );
      return;
    }

    setError('');
    setLoading(true);
    const allChosenInterests = [...selectedInterests, ...customTags];

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          password,
          interests: allChosenInterests,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          setStep('credentials');
        }
        throw new Error(
          data.error ||
            (lang === 'pt' ? 'Falha ao criar conta.' : 'Failed to create account.')
        );
      }

      if (data.token) {
        saveAuthSession(data.token, data.user);
      }
      seedLocalInterests(allChosenInterests);
      router.push(redirectUrl);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Group the 25 categories by their thematic group
  const groupedCategories = INTEREST_CATEGORIES.reduce<
    Record<string, typeof INTEREST_CATEGORIES>
  >((acc, cat) => {
    const groupName = lang === 'pt' ? cat.groupPt : cat.groupEn;
    if (!acc[groupName]) acc[groupName] = [];
    acc[groupName].push(cat);
    return acc;
  }, {});

  const editorialHighlights =
    lang === 'pt'
      ? [
          {
            icon: Sparkles,
            title: 'Algoritmo Adaptativo "Para Você"',
            desc: 'Seu feed evolui a cada leitura, tempo de permanência, pesquisa no Radar e matéria salva.',
          },
          {
            icon: Layers,
            title: 'Síntese 360° e Grande Reportagem',
            desc: 'Alterne entre resumos executivos multi-perspectiva e reportagens densas escritas com rigor jornalístico.',
          },
          {
            icon: Globe,
            title: '25+ Editorias & Fontes Verificadas',
            desc: 'De Inteligência Artificial e Mercado Financeiro a Geopolítica, Espaço, Futebol e Fórmula 1.',
          },
        ]
      : [
          {
            icon: Sparkles,
            title: 'Adaptive "For You" Algorithm',
            desc: 'Your feed evolves with every article read, dwell time, Radar search, and bookmark.',
          },
          {
            icon: Layers,
            title: '360° Synthesis & Long-Form Journalism',
            desc: 'Switch seamlessly between multi-angle executive takeaways and deeply reported features.',
          },
          {
            icon: Globe,
            title: '25+ Topics & Verified Sources',
            desc: 'From Artificial Intelligence and Financial Markets to Geopolitics, Space, Football, and F1.',
          },
        ];

  return (
    <div className="min-h-screen bg-[#191a1a] text-[#ececec] flex flex-col justify-between">
      {/* Top Bar */}
      <header className="border-b border-white/[0.06] bg-[#191a1a]/90 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-[1160px] mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href={redirectUrl}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#202222] hover:bg-[#282b2b] border border-white/[0.08] text-xs font-medium text-[#ececec] transition"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-[#53b8bb]" />
              <span>{lang === 'pt' ? 'Voltar ao Discover' : 'Back to Discover'}</span>
            </Link>

            <Link href="/" className="flex items-center gap-2.5 select-none group">
              <BrandLogo size="sm" />
            </Link>
          </div>

          {/* Language Switcher */}
          <div className="flex items-center rounded-full bg-[#202222] border border-white/[0.07] p-0.5 text-[11px] font-semibold">
            <button
              type="button"
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
              type="button"
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
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-5 sm:px-8 py-10 sm:py-14">
        {mode === 'signup' && step === 'interests' ? (
          /* ================= STEP 2: FULL-WIDTH ONBOARDING INTERESTS WIZARD ================= */
          <div className="w-full max-w-[960px] bg-[#202222] border border-white/[0.09] rounded-[26px] p-6 sm:p-10 shadow-2xl">
            {/* Step Progress Header */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-6 mb-7 border-b border-white/[0.07]">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#53b8bb]/15 border border-[#53b8bb]/30 text-[#53b8bb] text-[11px] font-semibold mb-3">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>
                    {lang === 'pt'
                      ? 'PASSO 2 DE 2 • CALIBRAÇÃO DO ALGORITMO'
                      : 'STEP 2 OF 2 • ALGORITHM CALIBRATION'}
                  </span>
                </div>
                <h1 className="font-editorial text-[30px] sm:text-[38px] text-[#ececec] leading-tight">
                  {lang === 'pt'
                    ? `O que mais interessa a você, ${name.split(' ')[0] || 'leitor'}?`
                    : `What interests you most, ${name.split(' ')[0] || 'reader'}?`}
                </h1>
                <p className="text-xs sm:text-sm text-[#9ba0a1] mt-1">
                  {lang === 'pt'
                    ? 'Escolha seus temas favoritos abaixo. A aba "Para Você" usará essa base inicial e aprenderá continuamente com as notícias que você ler, salvar ou pesquisar.'
                    : 'Choose your favorite topics below. Your "For You" tab will use this baseline and continuously learn from the stories you read, bookmark, or research.'}
                </p>
              </div>

              <div className="flex items-center gap-2 bg-[#191a1a] px-4 py-2.5 rounded-2xl border border-white/[0.07]">
                <span className="text-xs text-[#8e9293]">
                  {lang === 'pt' ? 'Selecionados:' : 'Selected:'}
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-[#53b8bb] text-[#111313] font-bold text-xs">
                  {selectedInterests.length + customTags.length}
                </span>
              </div>
            </div>

            {error && (
              <div className="mb-6 p-3.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs">
                {error}
              </div>
            )}

            {/* Grouped Categories Grid (25 categories across 6 groups) */}
            <div className="space-y-7 max-h-[52vh] overflow-y-auto pr-2">
              {Object.entries(groupedCategories).map(([groupTitle, items]) => (
                <div key={groupTitle}>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[#53b8bb] mb-3">
                    {groupTitle}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {items.map((cat) => {
                      const isSelected = selectedInterests.includes(cat.id);
                      const label = lang === 'pt' ? cat.labelPt : cat.labelEn;
                      const desc = lang === 'pt' ? cat.descPt : cat.descEn;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => toggleInterest(cat.id)}
                          className={`text-left p-3.5 rounded-2xl border transition flex items-start justify-between gap-3 ${
                            isSelected
                              ? 'bg-[#53b8bb]/15 border-[#53b8bb] text-[#ececec]'
                              : 'bg-[#191a1a] hover:bg-[#252828] border-white/[0.07] text-[#b4b8b9]'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="font-semibold text-xs sm:text-[13px] text-[#ececec] mb-0.5">
                              {label}
                            </div>
                            <p className="text-[11px] text-[#8e9293] line-clamp-2 leading-snug">
                              {desc}
                            </p>
                          </div>
                          <div
                            className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 border ${
                              isSelected
                                ? 'bg-[#53b8bb] border-[#53b8bb] text-[#111313]'
                                : 'border-white/20 text-transparent'
                            }`}
                          >
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Custom Specific Topic Input (e.g. "Nvidia", "Flamengo", "Bitcoin", "SpaceX") */}
              <div className="pt-2 border-t border-white/[0.06]">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#53b8bb] mb-2">
                  {lang === 'pt'
                    ? 'Tópicos Específicos Personalizados (Opcional)'
                    : 'Custom Specific Topics (Optional)'}
                </h3>
                <div className="flex gap-2 max-w-md mb-3">
                  <input
                    type="text"
                    value={customTagInput}
                    onChange={(e) => setCustomTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomTag(e);
                      }
                    }}
                    placeholder={
                      lang === 'pt'
                        ? 'Ex: Nvidia, Flamengo, SpaceX, STF, Bitcoin...'
                        : 'E.g. Nvidia, Arsenal, SpaceX, Bitcoin...'
                    }
                    className="flex-1 bg-[#191a1a] border border-white/[0.1] rounded-full px-4 py-2 text-xs text-[#ececec] placeholder-[#6e7273] focus:outline-none focus:border-[#53b8bb]"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomTag}
                    className="px-4 py-2 rounded-full bg-[#2c3030] hover:bg-[#373c3c] text-[#53b8bb] text-xs font-semibold flex items-center gap-1 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{lang === 'pt' ? 'Adicionar' : 'Add'}</span>
                  </button>
                </div>

                {customTags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {customTags.map((tag) => (
                      <span
                        key={tag}
                        onClick={() => removeCustomTag(tag)}
                        className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#53b8bb]/20 border border-[#53b8bb]/50 text-xs text-[#53b8bb] font-medium"
                      >
                        <span>#{tag}</span>
                        <span className="text-[10px] opacity-75">✕</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Wizard Footer Actions */}
            <div className="mt-8 pt-6 border-t border-white/[0.08] flex flex-col sm:flex-row items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => setStep('credentials')}
                className="px-5 py-2.5 rounded-full bg-[#191a1a] hover:bg-[#262929] border border-white/[0.08] text-xs font-medium text-[#b4b8b9] transition flex items-center gap-2"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{lang === 'pt' ? 'Voltar aos dados' : 'Back to details'}</span>
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={handleCompleteSignup}
                className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-[#53b8bb] hover:bg-[#65c8cb] text-[#111313] font-semibold text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-black/40 disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                <span>
                  {lang === 'pt'
                    ? 'Criar Conta e Gerar Meu Feed "Para Você"'
                    : 'Create Account & Build My "For You" Feed'}
                </span>
              </button>
            </div>
          </div>
        ) : (
          /* ================= STEP 1: SPLIT CREDENTIALS PAGE ================= */
          <div className="w-full max-w-[1040px] grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            {/* Left Column: Editorial Brand Showcase */}
            <div className="lg:col-span-6 space-y-8">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#202222] border border-white/[0.08] text-[#53b8bb] text-xs font-medium">
                <Sparkles className="w-3.5 h-3.5" />
                <span>
                  {lang === 'pt'
                    ? 'Jornalismo Inteligente & Personalizado'
                    : 'Personalized Multi-Source AI Journalism'}
                </span>
              </div>

              <div className="space-y-4">
                <h1 className="font-editorial text-[36px] sm:text-[44px] leading-[1.12] tracking-[-0.015em] text-[#ececec] font-normal">
                  {lang === 'pt'
                    ? 'Um feed de notícias que aprende e evolui com você.'
                    : 'A newsroom feed that learns and evolves with you.'}
                </h1>
                <p className="text-[#9ba0a1] text-[15px] leading-relaxed max-w-lg">
                  {lang === 'pt'
                    ? 'Escolha suas editorias favoritas ao criar sua conta e deixe o algoritmo do reach.news adaptar a aba "Para Você" conforme os assuntos que você mais lê, pesquisa e salva.'
                    : 'Choose your favorite topics when signing up and let the reach.news algorithm adapt your "For You" tab based on what you read, search, and bookmark.'}
                </p>
              </div>

              {/* Feature Cards */}
              <div className="space-y-3.5 pt-2">
                {editorialHighlights.map((item, idx) => {
                  const IconComponent = item.icon;
                  return (
                    <div
                      key={idx}
                      className="p-4 rounded-2xl bg-[#202222]/80 border border-white/[0.06] flex items-start gap-3.5"
                    >
                      <div className="w-9 h-9 rounded-xl bg-[#191a1a] border border-white/[0.08] flex items-center justify-center text-[#53b8bb] shrink-0 mt-0.5">
                        <IconComponent className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-editorial text-[17px] text-[#ececec] font-normal mb-0.5">
                          {item.title}
                        </h3>
                        <p className="text-xs text-[#8e9293] leading-relaxed">
                          {item.desc}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Login / Sign Up Card */}
            <div className="lg:col-span-6">
              <div className="bg-[#202222] border border-white/[0.09] rounded-[24px] p-6 sm:p-9 shadow-2xl">
                {/* Mode Switcher Tabs */}
                <div className="grid grid-cols-2 p-1 rounded-full bg-[#191a1a] border border-white/[0.07] mb-7">
                  <button
                    type="button"
                    onClick={() => switchMode('signin')}
                    className={`py-2.5 rounded-full text-xs font-semibold transition ${
                      mode === 'signin'
                        ? 'bg-[#53b8bb] text-[#111313] shadow-sm'
                        : 'text-[#8e9293] hover:text-[#ececec]'
                    }`}
                  >
                    {lang === 'pt' ? 'Entrar na Conta' : 'Sign In'}
                  </button>
                  <button
                    type="button"
                    onClick={() => switchMode('signup')}
                    className={`py-2.5 rounded-full text-xs font-semibold transition ${
                      mode === 'signup'
                        ? 'bg-[#53b8bb] text-[#111313] shadow-sm'
                        : 'text-[#8e9293] hover:text-[#ececec]'
                    }`}
                  >
                    {lang === 'pt' ? 'Criar Conta' : 'Create Account'}
                  </button>
                </div>

                {/* Card Heading */}
                <div className="mb-6">
                  {mode === 'signup' && (
                    <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-[#53b8bb] mb-1">
                      {lang === 'pt' ? 'PASSO 1 DE 2 • SEUS DADOS' : 'STEP 1 OF 2 • YOUR DETAILS'}
                    </span>
                  )}
                  <h2 className="font-editorial text-[28px] sm:text-[32px] text-[#ececec] leading-tight mb-1.5">
                    {mode === 'signin'
                      ? lang === 'pt'
                        ? 'Bem-vindo de volta'
                        : 'Welcome back'
                      : lang === 'pt'
                      ? 'Crie sua conta no reach.news'
                      : 'Create your reach.news account'}
                  </h2>
                  <p className="text-xs text-[#8e9293]">
                    {mode === 'signin'
                      ? lang === 'pt'
                        ? 'Insira suas credenciais para acessar sua aba "Para Você" e matérias salvas.'
                        : 'Enter your credentials to access your "For You" tab and saved stories.'
                      : lang === 'pt'
                      ? 'Preencha seus dados para avançar à escolha das suas áreas de interesse.'
                      : 'Fill in your details to proceed to selecting your areas of interest.'}
                  </p>
                </div>

                {error && (
                  <div className="mb-5 p-3.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs flex items-center gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <form onSubmit={handleCredentialsSubmit} className="space-y-4">
                  {mode === 'signup' && (
                    <div>
                      <label className="block text-xs font-medium text-[#b4b8b9] mb-1.5">
                        {t.nameLabel}
                      </label>
                      <div className="relative">
                        <User className="w-4 h-4 text-[#8e9293] absolute left-4 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          required
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder={lang === 'pt' ? 'Seu nome completo' : 'Your full name'}
                          className="w-full bg-[#191a1a] border border-white/[0.1] focus:border-[#53b8bb] rounded-xl pl-11 pr-4 py-3 text-sm text-[#ececec] placeholder-[#6e7273] focus:outline-none transition"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-[#b4b8b9] mb-1.5">
                      {t.emailLabel}
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-[#8e9293] absolute left-4 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="voce@exemplo.com"
                        className="w-full bg-[#191a1a] border border-white/[0.1] focus:border-[#53b8bb] rounded-xl pl-11 pr-4 py-3 text-sm text-[#ececec] placeholder-[#6e7273] focus:outline-none transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#b4b8b9] mb-1.5">
                      {t.passwordLabel}
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-[#8e9293] absolute left-4 top-1/2 -translate-y-1/2" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-[#191a1a] border border-white/[0.1] focus:border-[#53b8bb] rounded-xl pl-11 pr-11 py-3 text-sm text-[#ececec] placeholder-[#6e7273] focus:outline-none transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8e9293] hover:text-[#ececec] transition"
                        tabIndex={-1}
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {mode === 'signup' && (
                    <div>
                      <label className="block text-xs font-medium text-[#b4b8b9] mb-1.5">
                        {lang === 'pt' ? 'Confirmar Senha' : 'Confirm Password'}
                      </label>
                      <div className="relative">
                        <CheckCircle2 className="w-4 h-4 text-[#8e9293] absolute left-4 top-1/2 -translate-y-1/2" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full bg-[#191a1a] border border-white/[0.1] focus:border-[#53b8bb] rounded-xl pl-11 pr-4 py-3 text-sm text-[#ececec] placeholder-[#6e7273] focus:outline-none transition"
                        />
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full mt-2 py-3.5 rounded-full bg-[#53b8bb] hover:bg-[#65c8cb] text-[#111313] font-semibold text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-black/30 disabled:opacity-50"
                  >
                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>
                      {mode === 'signin'
                        ? lang === 'pt'
                          ? 'Entrar no reach.news'
                          : 'Sign In to reach.news'
                        : lang === 'pt'
                        ? 'Continuar para Meus Interesses'
                        : 'Continue to My Interests'}
                    </span>
                    {mode === 'signup' && <ArrowRight className="w-4 h-4" />}
                  </button>
                </form>

                {/* Footer switch link */}
                <div className="mt-6 pt-5 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#8e9293]">
                  <button
                    type="button"
                    onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}
                    className="hover:text-[#53b8bb] transition font-medium"
                  >
                    {mode === 'signin' ? t.noAccountYet : t.alreadyHaveAccount}
                  </button>

                  <span className="inline-flex items-center gap-1.5 text-[11px] text-[#6e7273]">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#53b8bb]" />
                    {lang === 'pt' ? 'Autenticação JWT Segura' : 'Secure JWT Auth'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Simple Footer */}
      <footer className="border-t border-white/[0.06] py-5 px-5 sm:px-8 text-center text-xs text-[#8e9293]">
        <div className="max-w-[1160px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <BrandLogo size="sm" />
          <span>
            {lang === 'pt'
              ? 'Jornalismo em tempo real com algoritmo adaptativo multi-fonte.'
              : 'Real-time journalism with adaptive multi-source synthesis.'}
          </span>
        </div>
      </footer>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#191a1a] flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-[#53b8bb]" />
        </div>
      }
    >
      <AuthPageContent />
    </Suspense>
  );
}
