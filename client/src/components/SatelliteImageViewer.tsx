/**
 * SatelliteImageViewer — FloodSat AI
 *
 * Fetches and displays satellite imagery (SAR or Optical) for a given region.
 * Shows subscription prompt if credentials are not configured.
 */

import { useState } from 'react';
import {
  Satellite, Settings, Download, RefreshCw, AlertCircle,
  CheckCircle, Loader2, ExternalLink, Calendar, MapPin, Info
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { loadProviderCredentials } from './SatelliteSettingsModal';

interface Props {
  regionName: string;
  regionNameAr?: string;
  bbox: [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]
  onOpenSettings: () => void;
  lang?: 'ar' | 'en';
}

export default function SatelliteImageViewer({ regionName, regionNameAr, bbox, onOpenSettings, lang = 'en' }: Props) {
  const isAr = lang === 'ar';
  const displayName = isAr && regionNameAr ? regionNameAr : regionName;

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const weekAgoStr = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [imageType, setImageType] = useState<'SAR' | 'OPTICAL'>('SAR');
  const [dateFrom, setDateFrom] = useState(weekAgoStr);
  const [dateTo, setDateTo] = useState(todayStr);
  const [fetchEnabled, setFetchEnabled] = useState(false);

  // Load credentials from localStorage
  const sentinelCreds = loadProviderCredentials('sentinel-hub');
  const hasCredentials = !!(sentinelCreds.clientId && sentinelCreds.clientSecret);

  // Search for available scenes (free, no auth)
  const { data: scenesData, isLoading: scenesLoading } = trpc.satellite.searchScenes.useQuery(
    { bbox, dateFrom, dateTo },
    { staleTime: 5 * 60 * 1000 }
  );

  // Fetch actual image (requires credentials)
  const { data: imageData, isLoading: imageLoading, refetch: refetchImage } = trpc.satellite.fetchImage.useQuery(
    {
      bbox,
      dateFrom,
      dateTo,
      imageType,
      credentials: hasCredentials ? {
        clientId: sentinelCreds.clientId,
        clientSecret: sentinelCreds.clientSecret,
      } : undefined,
    },
    {
      enabled: fetchEnabled,
      staleTime: 10 * 60 * 1000,
    }
  );

  // CEMS activations
  const { data: cemsData } = trpc.satellite.getCEMSActivations.useQuery(undefined, {
    staleTime: 30 * 60 * 1000,
  });

  const scenes = scenesData?.scenes ?? [];
  const activations = cemsData?.activations ?? [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Satellite size={16} style={{ color: 'var(--cyan)' }} />
          <span className="font-semibold text-sm">
            {isAr ? 'صور الأقمار الصناعية' : 'Satellite Imagery'}
          </span>
          <span className="text-xs px-2 py-0.5 rounded"
            style={{ background: 'rgba(0,212,255,0.1)', color: 'var(--cyan)', border: '1px solid rgba(0,212,255,0.2)' }}>
            {displayName}
          </span>
        </div>
        <button
          onClick={onOpenSettings}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs transition-colors hover:bg-white/10"
          style={{ color: 'var(--text-muted)', border: '1px solid var(--border-color)' }}
        >
          <Settings size={11} />
          {isAr ? 'إعدادات الاشتراك' : 'Subscription Settings'}
        </button>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Image Type */}
        <div className="flex rounded overflow-hidden" style={{ border: '1px solid var(--border-color)' }}>
          {(['SAR', 'OPTICAL'] as const).map(type => (
            <button
              key={type}
              onClick={() => setImageType(type)}
              className="px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                background: imageType === type ? 'rgba(0,212,255,0.15)' : 'transparent',
                color: imageType === type ? 'var(--cyan)' : 'var(--text-muted)',
                borderRight: type === 'SAR' ? '1px solid var(--border-color)' : 'none',
              }}
            >
              {type === 'SAR'
                ? (isAr ? 'رادار SAR' : 'SAR Radar')
                : (isAr ? 'بصري' : 'Optical')}
            </button>
          ))}
        </div>

        {/* Date Range */}
        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
          <Calendar size={11} />
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="px-2 py-1 rounded text-xs"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
          />
          <span>—</span>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="px-2 py-1 rounded text-xs"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
          />
        </div>
      </div>

      {/* Available Scenes (Free Info) */}
      {scenes.length > 0 && (
        <div className="p-3 rounded text-xs"
          style={{ background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.15)' }}>
          <div className="flex items-center gap-2 mb-2" style={{ color: 'var(--cyan)' }}>
            <Info size={11} />
            <span className="font-semibold">
              {isAr
                ? `${scenes.length} مشهد SAR متاح في الفترة المحددة`
                : `${scenes.length} SAR scene(s) available in selected period`}
            </span>
          </div>
          <div className="space-y-1">
            {scenes.slice(0, 3).map((scene, i) => (
              <div key={i} className="flex items-center justify-between" style={{ color: 'var(--text-secondary)' }}>
                <span className="font-mono">{scene.sceneId?.substring(0, 30)}...</span>
                <span>{scene.acquisitionDate?.substring(0, 10)}</span>
                <span style={{ color: scene.orbitDirection === 'ASCENDING' ? '#10B981' : 'var(--amber)' }}>
                  {scene.orbitDirection}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Image Area */}
      <div className="relative rounded overflow-hidden"
        style={{ minHeight: '280px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)' }}>

        {/* Loading State */}
        {imageLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <Loader2 size={24} className="animate-spin" style={{ color: 'var(--cyan)' }} />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {isAr ? 'جارٍ جلب الصورة من Sentinel Hub...' : 'Fetching image from Sentinel Hub...'}
            </span>
          </div>
        )}

        {/* Image Display */}
        {imageData?.success && imageData.imageBase64 && (
          <div className="relative">
            <img
              src={imageData.imageBase64}
              alt={`${imageType} satellite image of ${regionName}`}
              className="w-full"
              style={{ imageRendering: 'pixelated' }}
            />
            {/* Image Info Overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-3"
              style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.8))' }}>
              <div className="flex items-center justify-between text-xs">
                <span style={{ color: 'var(--text-secondary)' }}>{imageData.source}</span>
                <div className="flex items-center gap-2">
                  {imageData.resolution && (
                    <span style={{ color: 'var(--cyan)' }}>{imageData.resolution}</span>
                  )}
                  {imageData.acquisitionDate && (
                    <span style={{ color: 'var(--text-muted)' }}>{imageData.acquisitionDate}</span>
                  )}
                </div>
              </div>
            </div>
            {/* Download Button */}
            <button
              onClick={() => {
                const a = document.createElement('a');
                a.href = imageData.imageBase64!;
                a.download = `${regionName}_${imageType}_${dateTo}.png`;
                a.click();
              }}
              className="absolute top-2 right-2 p-2 rounded transition-colors hover:bg-black/50"
              style={{ background: 'rgba(0,0,0,0.5)', color: 'var(--text-secondary)' }}
              title={isAr ? 'تحميل الصورة' : 'Download image'}
            >
              <Download size={12} />
            </button>
          </div>
        )}

        {/* Subscription Required */}
        {!imageLoading && (!fetchEnabled || (imageData && !imageData.success)) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
            {/* SAR placeholder visualization */}
            <div className="relative w-full max-w-xs h-40 rounded overflow-hidden"
              style={{ background: 'rgba(0,0,0,0.5)' }}>
              {/* Simulated SAR-like pattern */}
              <div className="absolute inset-0 opacity-20"
                style={{
                  backgroundImage: `repeating-linear-gradient(
                    0deg, transparent, transparent 2px,
                    rgba(0,212,255,0.3) 2px, rgba(0,212,255,0.3) 3px
                  ), repeating-linear-gradient(
                    90deg, transparent, transparent 4px,
                    rgba(0,212,255,0.1) 4px, rgba(0,212,255,0.1) 5px
                  )`
                }} />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <Satellite size={32} style={{ color: 'rgba(0,212,255,0.4)', margin: '0 auto 8px' }} />
                  <div className="text-xs font-mono" style={{ color: 'rgba(0,212,255,0.5)' }}>
                    SAR · {imageType} · {dateFrom} → {dateTo}
                  </div>
                </div>
              </div>
            </div>

            {/* Subscription info */}
            {imageData?.requiresSubscription ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--amber)' }}>
                  <AlertCircle size={16} />
                  {isAr ? 'يتطلب اشتراكاً' : 'Subscription Required'}
                </div>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {imageData.error}
                </p>
                {imageData.subscriptionInfo && (
                  <div className="p-3 rounded text-xs"
                    style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)' }}>
                    <div className="font-semibold mb-1" style={{ color: 'var(--amber)' }}>
                      {imageData.subscriptionInfo.provider}
                    </div>
                    <p style={{ color: 'var(--text-secondary)' }}>{imageData.subscriptionInfo.description}</p>
                    <a
                      href={imageData.subscriptionInfo.signupUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-2 hover:underline"
                      style={{ color: 'var(--cyan)' }}
                    >
                      <ExternalLink size={10} />
                      {isAr ? 'ابدأ التجربة المجانية' : 'Start Free Trial'}
                    </a>
                  </div>
                )}
                <button
                  onClick={onOpenSettings}
                  className="px-4 py-2 rounded text-xs font-semibold transition-colors"
                  style={{ background: 'rgba(0,212,255,0.15)', color: 'var(--cyan)', border: '1px solid rgba(0,212,255,0.3)' }}
                >
                  {isAr ? 'ربط الاشتراك' : 'Connect Subscription'}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {isAr
                    ? hasCredentials
                      ? 'اضغط لجلب الصورة من Sentinel Hub'
                      : 'أضف مفاتيح Sentinel Hub لعرض صور SAR الحقيقية، أو اضغط لمعاينة التوفر'
                    : hasCredentials
                      ? 'Click to fetch image from Sentinel Hub'
                      : 'Add Sentinel Hub keys to view real SAR images, or click to preview availability'}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setFetchEnabled(true); refetchImage(); }}
                    className="px-4 py-2 rounded text-xs font-semibold transition-colors"
                    style={{
                      background: hasCredentials ? 'rgba(0,212,255,0.15)' : 'rgba(255,255,255,0.05)',
                      color: hasCredentials ? 'var(--cyan)' : 'var(--text-muted)',
                      border: `1px solid ${hasCredentials ? 'rgba(0,212,255,0.3)' : 'var(--border-color)'}`,
                    }}
                  >
                    {hasCredentials
                      ? (isAr ? 'جلب الصورة' : 'Fetch Image')
                      : (isAr ? 'معاينة التوفر' : 'Preview Availability')}
                  </button>
                  {!hasCredentials && (
                    <button
                      onClick={onOpenSettings}
                      className="px-4 py-2 rounded text-xs font-semibold transition-colors"
                      style={{ background: 'rgba(0,212,255,0.15)', color: 'var(--cyan)', border: '1px solid rgba(0,212,255,0.3)' }}
                    >
                      {isAr ? 'ربط الاشتراك' : 'Connect Subscription'}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* CEMS Emergency Activations */}
      {activations.length > 0 && (
        <div className="p-3 rounded" style={{ border: '1px solid var(--border-color)' }}>
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle size={12} style={{ color: 'var(--red)' }} />
            <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
              {isAr ? 'تفعيلات Copernicus CEMS للطوارئ — الإمارات' : 'Copernicus CEMS Emergency Activations — UAE'}
            </span>
            <span className="text-xs px-1.5 py-0.5 rounded"
              style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981', border: '1px solid rgba(16,185,129,0.3)' }}>
              {isAr ? 'مجاني' : 'FREE'}
            </span>
          </div>
          <div className="space-y-2">
            {activations.map(act => (
              <div key={act.activationId} className="flex items-center justify-between p-2 rounded text-xs"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)' }}>
                <div>
                  <span className="font-semibold font-mono" style={{ color: 'var(--red)' }}>{act.activationId}</span>
                  <span className="ml-2" style={{ color: 'var(--text-secondary)' }}>{act.title}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span style={{ color: 'var(--text-muted)' }}>{act.activationDate?.substring(0, 10)}</span>
                  <a
                    href={`https://emergency.copernicus.eu/mapping/list-of-components/${act.activationId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline flex items-center gap-0.5"
                    style={{ color: 'var(--cyan)' }}
                  >
                    <ExternalLink size={9} />
                    {isAr ? 'عرض' : 'View'}
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
