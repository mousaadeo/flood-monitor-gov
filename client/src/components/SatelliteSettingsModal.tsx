/**
 * SatelliteSettingsModal — FloodSat AI
 *
 * Modal for connecting satellite data subscriptions.
 * Supports: Sentinel Hub, Planet Labs, Copernicus CEMS, ASF
 *
 * Credentials are stored in localStorage (client-side only, never sent to server
 * except when making an actual image request).
 */

import { useState, useEffect } from 'react';
import {
  X, Satellite, Key, ExternalLink, CheckCircle, AlertCircle,
  Eye, EyeOff, ChevronDown, ChevronUp, Loader2, Globe, Lock, Unlock
} from 'lucide-react';
import { trpc } from '@/lib/trpc';

interface ProviderCredentials {
  [key: string]: string;
}

interface StoredCredentials {
  [providerId: string]: ProviderCredentials;
}

const STORAGE_KEY = 'floodsat_satellite_credentials';

function loadCredentials(): StoredCredentials {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveCredentials(creds: StoredCredentials) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(creds));
  } catch { /* ignore */ }
}

export function loadProviderCredentials(providerId: string): ProviderCredentials {
  const all = loadCredentials();
  return all[providerId] ?? {};
}

interface Props {
  open: boolean;
  onClose: () => void;
  lang?: 'ar' | 'en';
}

export default function SatelliteSettingsModal({ open, onClose, lang = 'en' }: Props) {
  const isAr = lang === 'ar';

  const { data: providersData } = trpc.satellite.getProviders.useQuery(undefined, {
    enabled: open,
    staleTime: Infinity,
  });

  const providers = providersData?.providers ?? [];

  const [credentials, setCredentials] = useState<StoredCredentials>(loadCredentials());
  const [expandedProvider, setExpandedProvider] = useState<string | null>('sentinel-hub');
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, 'success' | 'error' | null>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (open) {
      setCredentials(loadCredentials());
      setSaved(false);
    }
  }, [open]);

  const handleCredentialChange = (providerId: string, field: string, value: string) => {
    setCredentials(prev => ({
      ...prev,
      [providerId]: { ...(prev[providerId] ?? {}), [field]: value }
    }));
    setSaved(false);
    setTestResults(prev => ({ ...prev, [providerId]: null }));
  };

  const handleSave = () => {
    saveCredentials(credentials);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleClear = (providerId: string) => {
    setCredentials(prev => {
      const next = { ...prev };
      delete next[providerId];
      return next;
    });
    setTestResults(prev => ({ ...prev, [providerId]: null }));
    setSaved(false);
  };

  const togglePassword = (key: string) => {
    setShowPasswords(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const hasCredentials = (providerId: string) => {
    const creds = credentials[providerId] ?? {};
    return Object.values(creds).some(v => v && v.trim().length > 0);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-5 border-b"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded" style={{ background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.2)' }}>
              <Satellite size={18} style={{ color: 'var(--cyan)' }} />
            </div>
            <div>
              <h2 className="font-bold text-base" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
                {isAr ? 'إعدادات الأقمار الصناعية' : 'Satellite Data Settings'}
              </h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {isAr
                  ? 'ربط اشتراكات مزودي بيانات الأقمار الصناعية'
                  : 'Connect your satellite data provider subscriptions'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-white/10 transition-colors">
            <X size={16} style={{ color: 'var(--text-muted)' }} />
          </button>
        </div>

        {/* Info Banner */}
        <div className="mx-5 mt-5 p-3 rounded text-xs leading-relaxed"
          style={{ background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.15)', color: 'var(--text-secondary)' }}>
          <div className="flex items-start gap-2">
            <Lock size={12} style={{ color: 'var(--cyan)', marginTop: '2px', flexShrink: 0 }} />
            <span>
              {isAr
                ? 'مفاتيح API تُحفظ محلياً في متصفحك فقط ولا تُرسل إلى خوادمنا إلا عند طلب صورة فعلية. بيانات Copernicus CEMS مجانية ولا تتطلب مفتاحاً.'
                : 'API keys are stored locally in your browser only and sent to our servers only when requesting an actual image. Copernicus CEMS data is free and requires no key.'}
            </span>
          </div>
        </div>

        {/* Providers List */}
        <div className="p-5 space-y-3">
          {providers.length === 0 ? (
            // Fallback static providers if API not loaded yet
            <StaticProvidersList
              credentials={credentials}
              expandedProvider={expandedProvider}
              setExpandedProvider={setExpandedProvider}
              showPasswords={showPasswords}
              togglePassword={togglePassword}
              handleCredentialChange={handleCredentialChange}
              handleClear={handleClear}
              hasCredentials={hasCredentials}
              testResults={testResults}
              isAr={isAr}
            />
          ) : (
            providers.map(provider => (
              <ProviderCard
                key={provider.id}
                provider={provider}
                credentials={credentials[provider.id] ?? {}}
                expanded={expandedProvider === provider.id}
                onToggle={() => setExpandedProvider(expandedProvider === provider.id ? null : provider.id)}
                showPasswords={showPasswords}
                togglePassword={togglePassword}
                onCredentialChange={(field, value) => handleCredentialChange(provider.id, field, value)}
                onClear={() => handleClear(provider.id)}
                hasCredentials={hasCredentials(provider.id)}
                testResult={testResults[provider.id] ?? null}
                isAr={isAr}
              />
            ))
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-between p-5 border-t"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {isAr ? 'التغييرات تُطبَّق فوراً على طلبات الصور القادمة' : 'Changes apply immediately to future image requests'}
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded text-xs font-medium transition-colors hover:bg-white/10"
              style={{ color: 'var(--text-muted)', border: '1px solid var(--border-color)' }}
            >
              {isAr ? 'إغلاق' : 'Close'}
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 rounded text-xs font-semibold transition-all"
              style={{
                background: saved ? 'rgba(16,185,129,0.15)' : 'rgba(0,212,255,0.15)',
                color: saved ? '#10B981' : 'var(--cyan)',
                border: `1px solid ${saved ? 'rgba(16,185,129,0.3)' : 'rgba(0,212,255,0.3)'}`,
              }}
            >
              {saved
                ? (isAr ? '✓ تم الحفظ' : '✓ Saved')
                : (isAr ? 'حفظ الإعدادات' : 'Save Settings')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Provider Card Component ───────────────────────────────────────────────────

interface ProviderCardProps {
  provider: {
    id: string;
    name: string;
    nameAr: string;
    type: string;
    resolution: string;
    revisitTime: string;
    freeAccess: boolean;
    trialAvailable: boolean;
    signupUrl: string;
    apiDocsUrl: string;
    description: string;
    descriptionAr: string;
    requiredFields: { key: string; label: string; labelAr: string; type: string }[];
  };
  credentials: ProviderCredentials;
  expanded: boolean;
  onToggle: () => void;
  showPasswords: Record<string, boolean>;
  togglePassword: (key: string) => void;
  onCredentialChange: (field: string, value: string) => void;
  onClear: () => void;
  hasCredentials: boolean;
  testResult: 'success' | 'error' | null;
  isAr: boolean;
}

function ProviderCard({
  provider, credentials, expanded, onToggle, showPasswords, togglePassword,
  onCredentialChange, onClear, hasCredentials, testResult, isAr
}: ProviderCardProps) {
  const typeColor = provider.type === 'SAR' ? 'var(--cyan)' : provider.type === 'OPTICAL' ? '#10B981' : '#A855F7';
  const isFree = provider.freeAccess;

  return (
    <div className="rounded overflow-hidden transition-all"
      style={{ border: `1px solid ${hasCredentials ? 'rgba(0,212,255,0.3)' : 'var(--border-color)'}` }}>

      {/* Provider Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-white/5 transition-colors"
      >
        {/* Status indicator */}
        <div className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ background: hasCredentials || isFree ? '#10B981' : 'rgba(255,255,255,0.2)' }} />

        {/* Provider info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{isAr ? provider.nameAr : provider.name}</span>
            <span className="text-xs px-1.5 py-0.5 rounded"
              style={{ background: `${typeColor}22`, color: typeColor, border: `1px solid ${typeColor}44` }}>
              {provider.type}
            </span>
            {isFree && (
              <span className="text-xs px-1.5 py-0.5 rounded"
                style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981', border: '1px solid rgba(16,185,129,0.3)' }}>
                {isAr ? 'مجاني' : 'FREE'}
              </span>
            )}
            {provider.trialAvailable && !isFree && (
              <span className="text-xs px-1.5 py-0.5 rounded"
                style={{ background: 'rgba(245,158,11,0.1)', color: 'var(--amber)', border: '1px solid rgba(245,158,11,0.3)' }}>
                {isAr ? 'تجربة مجانية' : 'Free Trial'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{provider.resolution}</span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>•</span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{provider.revisitTime}</span>
          </div>
        </div>

        {/* Status & expand */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {hasCredentials && (
            <div className="flex items-center gap-1 text-xs" style={{ color: '#10B981' }}>
              <Unlock size={11} />
              <span>{isAr ? 'مربوط' : 'Connected'}</span>
            </div>
          )}
          {isFree && !hasCredentials && (
            <div className="flex items-center gap-1 text-xs" style={{ color: '#10B981' }}>
              <Globe size={11} />
              <span>{isAr ? 'متاح' : 'Available'}</span>
            </div>
          )}
          {expanded ? <ChevronUp size={14} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />}
        </div>
      </button>

      {/* Expanded Content */}
      {expanded && (
        <div className="px-4 pb-4 border-t" style={{ borderColor: 'var(--border-color)' }}>
          {/* Description */}
          <p className="text-xs mt-3 mb-4 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {isAr ? provider.descriptionAr : provider.description}
          </p>

          {/* Credential Fields */}
          {provider.requiredFields.length > 0 ? (
            <div className="space-y-3">
              <div className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>
                <Key size={11} className="inline mr-1" />
                {isAr ? 'مفاتيح الاشتراك' : 'Subscription Keys'}
              </div>
              {provider.requiredFields.map(field => {
                const pwKey = `${provider.id}_${field.key}`;
                const isPassword = field.type === 'password';
                const showPw = showPasswords[pwKey];
                return (
                  <div key={field.key}>
                    <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>
                      {isAr ? field.labelAr : field.label}
                    </label>
                    <div className="relative">
                      <input
                        type={isPassword && !showPw ? 'password' : 'text'}
                        value={credentials[field.key] ?? ''}
                        onChange={e => onCredentialChange(field.key, e.target.value)}
                        placeholder={isPassword ? '••••••••••••••••' : `Enter ${field.label}`}
                        className="w-full px-3 py-2 rounded text-xs font-mono pr-8"
                        style={{
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid var(--border-color)',
                          color: 'var(--text-primary)',
                          outline: 'none',
                        }}
                      />
                      {isPassword && (
                        <button
                          type="button"
                          onClick={() => togglePassword(pwKey)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          {showPw ? <EyeOff size={12} /> : <Eye size={12} />}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Actions */}
              <div className="flex items-center gap-2 mt-3">
                {hasCredentials && (
                  <button
                    onClick={onClear}
                    className="text-xs px-3 py-1.5 rounded transition-colors hover:bg-white/10"
                    style={{ color: 'var(--text-muted)', border: '1px solid var(--border-color)' }}
                  >
                    {isAr ? 'مسح المفاتيح' : 'Clear Keys'}
                  </button>
                )}
                {testResult === 'success' && (
                  <span className="text-xs flex items-center gap-1" style={{ color: '#10B981' }}>
                    <CheckCircle size={11} /> {isAr ? 'الاتصال ناجح' : 'Connection successful'}
                  </span>
                )}
                {testResult === 'error' && (
                  <span className="text-xs flex items-center gap-1" style={{ color: 'var(--red)' }}>
                    <AlertCircle size={11} /> {isAr ? 'فشل الاتصال — تحقق من المفاتيح' : 'Connection failed — check your keys'}
                  </span>
                )}
              </div>
            </div>
          ) : (
            // Free provider — no credentials needed
            <div className="p-3 rounded text-xs"
              style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)', color: '#10B981' }}>
              <CheckCircle size={12} className="inline mr-1" />
              {isAr
                ? 'هذا المزود مجاني ومتاح تلقائياً — لا يتطلب مفتاح API'
                : 'This provider is free and automatically available — no API key required'}
            </div>
          )}

          {/* Links */}
          <div className="flex items-center gap-3 mt-4 pt-3 border-t" style={{ borderColor: 'var(--border-color)' }}>
            <a
              href={provider.signupUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs flex items-center gap-1 hover:underline"
              style={{ color: 'var(--cyan)' }}
            >
              <ExternalLink size={10} />
              {isAr ? (provider.trialAvailable ? 'تجربة مجانية' : 'الموقع الرسمي') : (provider.trialAvailable ? 'Free Trial' : 'Official Site')}
            </a>
            <a
              href={provider.apiDocsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs flex items-center gap-1 hover:underline"
              style={{ color: 'var(--text-muted)' }}
            >
              <ExternalLink size={10} />
              {isAr ? 'توثيق API' : 'API Docs'}
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Static Fallback (when API not loaded) ─────────────────────────────────────

function StaticProvidersList(props: any) {
  const staticProviders = [
    {
      id: 'sentinel-hub',
      name: 'Sentinel Hub',
      nameAr: 'سنتينل هاب',
      type: 'BOTH',
      resolution: '5–20 م (SAR) / 10 م (بصري)',
      revisitTime: 'كل 6 أيام',
      freeAccess: false,
      trialAvailable: true,
      signupUrl: 'https://www.sentinel-hub.com/trial/',
      apiDocsUrl: 'https://docs.sentinel-hub.com/api/latest/',
      description: 'Access Sentinel-1 SAR and Sentinel-2 optical imagery. 30-day free trial available.',
      descriptionAr: 'وصول لصور Sentinel-1 الرادارية (SAR) وSentinel-2 البصرية. تجربة مجانية 30 يوم.',
      requiredFields: [
        { key: 'clientId', label: 'Client ID', labelAr: 'معرف العميل', type: 'text' },
        { key: 'clientSecret', label: 'Client Secret', labelAr: 'مفتاح السر', type: 'password' },
      ]
    },
    {
      id: 'planet',
      name: 'Planet Labs',
      nameAr: 'بلانيت لابس',
      type: 'OPTICAL',
      resolution: '3–5 م',
      revisitTime: 'يومياً',
      freeAccess: false,
      trialAvailable: true,
      signupUrl: 'https://www.planet.com/explorer/',
      apiDocsUrl: 'https://developers.planet.com/docs/apis/',
      description: 'Daily high-resolution optical imagery. Education & research access available.',
      descriptionAr: 'صور بصرية عالية الدقة يومياً. وصول للبحث والتعليم متاح.',
      requiredFields: [
        { key: 'apiKey', label: 'API Key', labelAr: 'مفتاح API', type: 'password' },
      ]
    },
    {
      id: 'copernicus-cems',
      name: 'Copernicus CEMS',
      nameAr: 'كوبرنيكوس CEMS',
      type: 'BOTH',
      resolution: '10–30 م',
      revisitTime: 'عند الكوارث فقط',
      freeAccess: true,
      trialAvailable: false,
      signupUrl: 'https://emergency.copernicus.eu/',
      apiDocsUrl: 'https://emergency.copernicus.eu/mapping/ems-api',
      description: 'Free flood maps during declared emergencies. No API key required.',
      descriptionAr: 'خرائط فيضانات مجانية خلال الكوارث المُعلنة. لا يتطلب مفتاح API.',
      requiredFields: []
    },
    {
      id: 'asf',
      name: 'ASF (Alaska Satellite Facility)',
      nameAr: 'مرفق ألاسكا للأقمار الصناعية',
      type: 'SAR',
      resolution: '10–40 م',
      revisitTime: 'كل 6–12 يوم',
      freeAccess: false,
      trialAvailable: false,
      signupUrl: 'https://search.asf.alaska.edu/',
      apiDocsUrl: 'https://docs.asf.alaska.edu/',
      description: 'Free Sentinel-1 SAR scene search and download. NASA Earthdata account required.',
      descriptionAr: 'بحث وتحميل مجاني لمشاهد Sentinel-1 SAR. يتطلب حساب NASA Earthdata.',
      requiredFields: [
        { key: 'username', label: 'NASA Earthdata Username', labelAr: 'اسم المستخدم (NASA Earthdata)', type: 'text' },
        { key: 'password', label: 'Password', labelAr: 'كلمة المرور', type: 'password' },
      ]
    }
  ];

  return (
    <>
      {staticProviders.map(provider => (
        <ProviderCard
          key={provider.id}
          provider={provider}
          credentials={props.credentials[provider.id] ?? {}}
          expanded={props.expandedProvider === provider.id}
          onToggle={() => props.setExpandedProvider(props.expandedProvider === provider.id ? null : provider.id)}
          showPasswords={props.showPasswords}
          togglePassword={props.togglePassword}
          onCredentialChange={(field: string, value: string) => props.handleCredentialChange(provider.id, field, value)}
          onClear={() => props.handleClear(provider.id)}
          hasCredentials={props.hasCredentials(provider.id)}
          testResult={props.testResults[provider.id] ?? null}
          isAr={props.isAr}
        />
      ))}
    </>
  );
}
