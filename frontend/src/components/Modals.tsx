'use client';

import React, { useEffect, useState } from 'react';
import { INTEREST_CATEGORIES, OmniRouteStatus, UI_TEXT, UserProfile } from '@/lib/types';
import { seedLocalInterests, getLocalAffinityMap } from '@/lib/telemetry';
import {
  X,
  Server,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Shield,
  User,
  Sparkles,
  Check,
  TrendingUp,
} from 'lucide-react';

interface AuthModalProps {
  mode: 'signin' | 'signup';
  lang: 'pt' | 'en';
  apiBaseUrl: string;
  onClose: () => void;
  onSuccess: (token: string, user: UserProfile) => void;
  onSwitchMode: (mode: 'signin' | 'signup') => void;
}

export function AuthModal({
  mode,
  lang,
  apiBaseUrl,
  onClose,
  onSuccess,
  onSwitchMode,
}: AuthModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const t = UI_TEXT[lang];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = mode === 'signup' ? '/api/auth/signup' : '/api/auth/signin';
      const res = await fetch(`${apiBaseUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      onSuccess(data.token, data.user);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md bg-[#202222] border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full bg-white/5 hover:bg-white/10 text-[#8e9293] hover:text-white transition cursor-pointer z-20"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-xl bg-[#53b8bb]/15 border border-[#53b8bb]/30 flex items-center justify-center text-[#53b8bb]">
            <User className="w-5 h-5" />
          </div>
          <h3 className="font-editorial text-2xl text-[#ececec]">
            {mode === 'signin' ? t.authSignInTitle : t.authSignUpTitle}
          </h3>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-medium text-[#9ba0a1] mb-1.5">
                {t.nameLabel}
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-[#191a1a] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-[#ececec] focus:outline-none focus:border-[#53b8bb]"
                placeholder="Gabriel Diniz"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-[#9ba0a1] mb-1.5">
              {t.emailLabel}
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#191a1a] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-[#ececec] focus:outline-none focus:border-[#53b8bb]"
              placeholder="voce@reach.news"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#9ba0a1] mb-1.5">
              {t.passwordLabel}
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#191a1a] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-[#ececec] focus:outline-none focus:border-[#53b8bb]"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-full bg-[#53b8bb] hover:bg-[#66c7ca] text-[#111313] font-semibold text-sm transition flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{mode === 'signin' ? t.signIn : t.signUp}</span>
          </button>
        </form>

        <div className="mt-5 text-center">
          <button
            type="button"
            onClick={() => onSwitchMode(mode === 'signin' ? 'signup' : 'signin')}
            className="text-xs text-[#8e9293] hover:text-[#53b8bb] transition"
          >
            {mode === 'signin' ? t.noAccountYet : t.alreadyHaveAccount}
          </button>
        </div>
      </div>
    </div>
  );
}

interface OmniRouteModalProps {
  status: OmniRouteStatus | null;
  lang: 'pt' | 'en';
  apiBaseUrl: string;
  onClose: () => void;
  onUpdated: (newStatus: OmniRouteStatus) => void;
}

export function OmniRouteModal({
  status,
  lang,
  apiBaseUrl,
  onClose,
  onUpdated,
}: OmniRouteModalProps) {
  const [baseUrl, setBaseUrl] = useState(
    status?.config?.omnirouteBaseUrl || status?.baseUrl || 'http://localhost:20128/v1'
  );
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState(
    status?.config?.omnirouteModel || status?.model || 'auto/best-chat'
  );
  const [cronEnabled, setCronEnabled] = useState(status?.config?.cronEnabled ?? true);
  const [saving, setSaving] = useState(false);

  const t = UI_TEXT[lang];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/omniroute/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          omnirouteBaseUrl: baseUrl,
          omnirouteApiKey: apiKey || undefined,
          omnirouteModel: model,
          cronEnabled,
        }),
      });
      const data = await res.json();
      if (data.status) {
        onUpdated({ ...data.status, config: data.config });
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg bg-[#202222] border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full bg-white/5 hover:bg-white/10 text-[#8e9293] hover:text-white transition cursor-pointer z-20"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-[#53b8bb]/15 border border-[#53b8bb]/30 flex items-center justify-center text-[#53b8bb]">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-editorial text-2xl text-[#ececec]">{t.omnirouteModalTitle}</h3>
            <div className="flex items-center gap-2 text-xs">
              {status?.online ? (
                <span className="text-emerald-400 flex items-center gap-1 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Online ({status.latencyMs}ms)
                </span>
              ) : (
                <span className="text-amber-400 flex items-center gap-1 font-medium">
                  <AlertCircle className="w-3.5 h-3.5" />{' '}
                  {lang === 'pt'
                    ? 'Modo Híbrido (Aguardando OmniRoute na porta 20128)'
                    : 'Hybrid Mode (Waiting for OmniRoute on port 20128)'}
                </span>
              )}
            </div>
          </div>
        </div>

        <p className="text-xs text-[#9ba0a1] leading-relaxed mb-5">{t.omnirouteModalDesc}</p>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#9ba0a1] mb-1">
              OmniRoute Base URL
            </label>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              className="w-full bg-[#191a1a] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-[#ececec] font-mono focus:outline-none focus:border-[#53b8bb]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#9ba0a1] mb-1">
              OmniRoute API Key{' '}
              {lang === 'pt'
                ? '(deixe em branco para manter a atual)'
                : '(leave blank to keep current)'}
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-••••••••••••••••••••"
              className="w-full bg-[#191a1a] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-[#ececec] font-mono focus:outline-none focus:border-[#53b8bb]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#9ba0a1] mb-1">
              {lang === 'pt'
                ? 'Modelo de Roteamento (ex: auto/best-chat, auto/pro-chat)'
                : 'Routing Model (e.g. auto/best-chat, auto/pro-chat)'}
            </label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full bg-[#191a1a] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-[#ececec] font-mono focus:outline-none focus:border-[#53b8bb]"
            />
          </div>

          <label className="flex items-center gap-2.5 text-xs text-[#b4b8b9] cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={cronEnabled}
              onChange={(e) => setCronEnabled(e.target.checked)}
              className="rounded accent-[#53b8bb]"
            />
            <span>
              {lang === 'pt'
                ? 'Atualização periódica automática das categorias via Agente OmniRoute'
                : 'Enable periodic background category synthesis via OmniRoute Agent'}
            </span>
          </label>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 rounded-full bg-[#53b8bb] hover:bg-[#66c7ca] text-[#111313] font-semibold text-sm transition flex items-center justify-center gap-2 mt-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
            <span>{t.saveSettings}</span>
          </button>
        </form>
      </div>
    </div>
  );
}

interface InterestsModalProps {
  lang: 'pt' | 'en';
  apiBaseUrl: string;
  token: string | null;
  user: UserProfile | null;
  onClose: () => void;
  onSaved: (updatedInterests: string[], updatedAffinity: Record<string, number>) => void;
}

export function InterestsModal({
  lang,
  apiBaseUrl,
  token,
  user,
  onClose,
  onSaved,
}: InterestsModalProps) {
  const [selected, setSelected] = useState<string[]>(
    user?.interests && user.interests.length > 0
      ? user.interests
      : ['artificial_intelligence', 'technology', 'economics']
  );
  const [saving, setSaving] = useState(false);

  const affinityMap: Record<string, number> = {
    ...getLocalAffinityMap(),
    ...(user?.affinityMap || {}),
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const toggleCategory = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSaveInterests = async () => {
    setSaving(true);
    try {
      seedLocalInterests(selected);
      if (token) {
        const res = await fetch(`${apiBaseUrl}/api/auth/interests`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ interests: selected }),
        });
        const data = await res.json();
        if (res.ok) {
          onSaved(data.interests || selected, data.affinityMap || affinityMap);
          onClose();
          return;
        }
      }
      onSaved(selected, getLocalAffinityMap());
      onClose();
    } finally {
      setSaving(false);
    }
  };

  // Top learned affinities from user behavior
  const topLearned = Object.entries(affinityMap)
    .filter(([, pts]) => pts > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const groupedCategories = INTEREST_CATEGORIES.reduce<
    Record<string, typeof INTEREST_CATEGORIES>
  >((acc, cat) => {
    const groupName = lang === 'pt' ? cat.groupPt : cat.groupEn;
    if (!acc[groupName]) acc[groupName] = [];
    acc[groupName].push(cat);
    return acc;
  }, {});

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-4xl bg-[#202222] border border-white/10 rounded-[24px] p-6 sm:p-8 shadow-2xl max-h-[88vh] flex flex-col"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full bg-white/5 hover:bg-white/10 text-[#8e9293] hover:text-white transition cursor-pointer z-20"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="pb-5 border-b border-white/[0.08] pr-10">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#53b8bb]/15 text-[#53b8bb] text-[11px] font-semibold mb-2">
            <Sparkles className="w-3 h-3" />
            <span>
              {lang === 'pt' ? 'DNA DO SEU ALGORITMO' : 'YOUR ALGORITHM DNA'}
            </span>
          </div>
          <h3 className="font-editorial text-2xl sm:text-3xl text-[#ececec]">
            {lang === 'pt'
              ? 'Personalizar Feed "Para Você"'
              : 'Customize Your "For You" Feed'}
          </h3>
          <p className="text-xs text-[#9ba0a1] mt-1">
            {lang === 'pt'
              ? 'Gerencie suas áreas de interesse e veja os assuntos que o algoritmo identificou a partir das suas leituras.'
              : 'Manage your interest areas and inspect the topics our algorithm learned from your reading activity.'}
          </p>
        </div>

        {/* Learned Affinity Telemetry Bar */}
        {topLearned.length > 0 && (
          <div className="my-4 p-3.5 rounded-2xl bg-[#191a1a] border border-white/[0.06]">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#53b8bb] mb-2">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>
                {lang === 'pt'
                  ? 'Pontuação de afinidade aprendida pelo algoritmo (Tempo Real):'
                  : 'Real-time affinity scores learned by the algorithm:'}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {topLearned.map(([key, pts]) => {
                const foundCat = INTEREST_CATEGORIES.find((c) => c.id === key);
                const label = foundCat
                  ? lang === 'pt'
                    ? foundCat.labelPt
                    : foundCat.labelEn
                  : key.replace(/^tag:/, '#');
                return (
                  <span
                    key={key}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#202222] border border-[#53b8bb]/30 text-xs text-[#ececec]"
                  >
                    <span>{label}</span>
                    <strong className="text-[#53b8bb] font-mono text-[11px]">
                      +{Math.round(pts)} pts
                    </strong>
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Scrollable Category Grid */}
        <div className="flex-1 overflow-y-auto space-y-6 pr-2 py-2">
          {Object.entries(groupedCategories).map(([groupTitle, items]) => (
            <div key={groupTitle}>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[#53b8bb] mb-2.5">
                {groupTitle}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {items.map((cat) => {
                  const isSelected = selected.includes(cat.id);
                  const label = lang === 'pt' ? cat.labelPt : cat.labelEn;
                  const desc = lang === 'pt' ? cat.descPt : cat.descEn;
                  const catScore = affinityMap[cat.id] || 0;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => toggleCategory(cat.id)}
                      className={`text-left p-3 rounded-xl border transition flex items-start justify-between gap-2.5 ${
                        isSelected
                          ? 'bg-[#53b8bb]/15 border-[#53b8bb] text-[#ececec]'
                          : 'bg-[#191a1a] hover:bg-[#252828] border-white/[0.07] text-[#b4b8b9]'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-xs text-[#ececec] truncate">
                            {label}
                          </span>
                          {catScore > 0 && (
                            <span className="text-[10px] font-mono text-[#53b8bb]">
                              +{Math.round(catScore)}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#8e9293] line-clamp-1 mt-0.5">
                          {desc}
                        </p>
                      </div>
                      <div
                        className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5 border ${
                          isSelected
                            ? 'bg-[#53b8bb] border-[#53b8bb] text-[#111313]'
                            : 'border-white/20 text-transparent'
                        }`}
                      >
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="pt-4 mt-4 border-t border-white/[0.08] flex items-center justify-between gap-4">
          <span className="text-xs text-[#8e9293]">
            {selected.length}{' '}
            {lang === 'pt' ? 'editorias selecionadas' : 'topics selected'}
          </span>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full bg-[#191a1a] hover:bg-[#262929] text-xs font-medium text-[#b4b8b9] transition"
            >
              {lang === 'pt' ? 'Cancelar' : 'Cancel'}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleSaveInterests}
              className="px-6 py-2.5 rounded-full bg-[#53b8bb] hover:bg-[#66c7ca] text-[#111313] font-semibold text-xs transition flex items-center gap-2"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>
                {lang === 'pt' ? 'Salvar e Atualizar Feed' : 'Save & Refresh Feed'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
