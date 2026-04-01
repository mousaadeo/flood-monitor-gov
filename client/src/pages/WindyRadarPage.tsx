// WindyRadarPage.tsx — FloodSat AI
// Windy.com interactive weather radar centered on UAE
// Layers: Rain, Wind, Radar, Clouds, Pressure, Humidity, Temperature
import { useState, useRef, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useIsMobile } from '@/hooks/useMobile';
import {
  CloudRain, Wind, Radar, Cloud, Gauge, Droplets,
  Thermometer, ExternalLink, RefreshCw, Info, Layers
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Layer definitions — each maps to a Windy overlay parameter
// ─────────────────────────────────────────────────────────────────────────────
interface WindyLayer {
  id: string;
  labelAr: string;
  labelEn: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  windyOverlay: string;
  description: { ar: string; en: string };
}

const LAYERS: WindyLayer[] = [
  {
    id: 'rain',
    labelAr: 'الأمطار',
    labelEn: 'Rain',
    icon: CloudRain,
    color: '#42A5F5',
    windyOverlay: 'rain',
    description: {
      ar: 'هطول الأمطار المتوقع (mm/h) — نموذج GFS/ECMWF',
      en: 'Precipitation forecast (mm/h) — GFS/ECMWF model',
    },
  },
  {
    id: 'wind',
    labelAr: 'الرياح',
    labelEn: 'Wind',
    icon: Wind,
    color: '#69F0AE',
    windyOverlay: 'wind',
    description: {
      ar: 'سرعة واتجاه الرياح (km/h) مع جسيمات متحركة',
      en: 'Wind speed and direction (km/h) with animated particles',
    },
  },
  {
    id: 'radar',
    labelAr: 'الرادار',
    labelEn: 'Radar',
    icon: Radar,
    color: '#FF7043',
    windyOverlay: 'radar',
    description: {
      ar: 'رادار الأمطار الحي — انعكاسية الأمطار الفعلية',
      en: 'Live rain radar — actual precipitation reflectivity',
    },
  },
  {
    id: 'clouds',
    labelAr: 'الغيوم',
    labelEn: 'Clouds',
    icon: Cloud,
    color: '#B0BEC5',
    windyOverlay: 'clouds',
    description: {
      ar: 'تغطية السحاب الكلية (%)',
      en: 'Total cloud cover (%)',
    },
  },
  {
    id: 'pressure',
    labelAr: 'الضغط',
    labelEn: 'Pressure',
    icon: Gauge,
    color: '#CE93D8',
    windyOverlay: 'pressure',
    description: {
      ar: 'الضغط الجوي (hPa) مع خطوط التساوي',
      en: 'Atmospheric pressure (hPa) with isobars',
    },
  },
  {
    id: 'humidity',
    labelAr: 'الرطوبة',
    labelEn: 'Humidity',
    icon: Droplets,
    color: '#4DD0E1',
    windyOverlay: 'rh',
    description: {
      ar: 'الرطوبة النسبية (%) على مستوى السطح',
      en: 'Relative humidity (%) at surface level',
    },
  },
  {
    id: 'temp',
    labelAr: 'الحرارة',
    labelEn: 'Temp',
    icon: Thermometer,
    color: '#FFB74D',
    windyOverlay: 'temp',
    description: {
      ar: 'درجة الحرارة (°C) على ارتفاع 2 متر',
      en: 'Temperature (°C) at 2m height',
    },
  },
];

// UAE center coordinates
const UAE_LAT = 24.0;
const UAE_LON = 54.5;
const UAE_ZOOM = 7;

// Build Windy embed URL
function buildWindyUrl(overlay: string): string {
  return (
    `https://embed.windy.com/embed2.html` +
    `?lat=${UAE_LAT}` +
    `&lon=${UAE_LON}` +
    `&detailLat=${UAE_LAT}` +
    `&detailLon=${UAE_LON}` +
    `&width=100%` +
    `&height=100%` +
    `&zoom=${UAE_ZOOM}` +
    `&level=surface` +
    `&overlay=${overlay}` +
    `&product=ecmwf` +
    `&menu=` +
    `&message=true` +
    `&marker=true` +
    `&calendar=now` +
    `&pressure=true` +
    `&type=map` +
    `&location=coordinates` +
    `&detail=` +
    `&metricWind=km%2Fh` +
    `&metricTemp=%C2%B0C` +
    `&radarRange=-1`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
export default function WindyRadarPage() {
  const { lang } = useLanguage();
  const isMobile = useIsMobile();
  const isAr = lang === 'ar';

  const [activeLayer, setActiveLayer] = useState<WindyLayer>(LAYERS[0]);
  const [iframeKey, setIframeKey] = useState(0);
  const [showInfo, setShowInfo] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleLayerChange = useCallback((layer: WindyLayer) => {
    setActiveLayer(layer);
    // Force iframe reload with new overlay
    setIframeKey(k => k + 1);
  }, []);

  const handleRefresh = useCallback(() => {
    setIframeKey(k => k + 1);
  }, []);

  const windyUrl = buildWindyUrl(activeLayer.windyOverlay);

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-primary)',
        overflow: 'hidden',
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div
        style={{
          flexShrink: 0,
          padding: isMobile ? '10px 12px' : '12px 20px',
          borderBottom: '1px solid rgba(66,165,245,0.15)',
          background: 'rgba(10,20,40,0.95)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexWrap: isMobile ? 'wrap' : 'nowrap',
        }}
      >
        {/* Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #1565C0, #0288D1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Layers size={16} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#E3F2FD', fontFamily: 'Space Mono, monospace' }}>
              {isAr ? 'رادار Windy التفاعلي' : 'Windy Interactive Radar'}
            </div>
            <div style={{ fontSize: 10, color: '#42A5F5', opacity: 0.8 }}>
              {isAr ? 'الإمارات العربية المتحدة — بيانات ECMWF حية' : 'UAE — Live ECMWF Data'}
            </div>
          </div>
        </div>

        {/* Layer selector */}
        <div
          style={{
            display: 'flex',
            gap: '6px',
            flexWrap: 'wrap',
            flex: 1,
            justifyContent: isMobile ? 'flex-start' : 'center',
          }}
        >
          {LAYERS.map((layer) => {
            const Icon = layer.icon;
            const isActive = activeLayer.id === layer.id;
            return (
              <button
                key={layer.id}
                onClick={() => handleLayerChange(layer)}
                title={isAr ? layer.description.ar : layer.description.en}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: isMobile ? '5px 8px' : '6px 12px',
                  borderRadius: '20px',
                  border: `1px solid ${isActive ? layer.color : 'rgba(255,255,255,0.1)'}`,
                  background: isActive
                    ? `${layer.color}22`
                    : 'rgba(255,255,255,0.04)',
                  color: isActive ? layer.color : '#90A4AE',
                  fontSize: isMobile ? 11 : 12,
                  fontWeight: isActive ? 700 : 400,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap',
                }}
              >
                <Icon size={13} />
                {isAr ? layer.labelAr : layer.labelEn}
              </button>
            );
          })}
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
          <button
            onClick={() => setShowInfo(s => !s)}
            title={isAr ? 'معلومات المصدر' : 'Source info'}
            style={{
              width: 32,
              height: 32,
              borderRadius: '8px',
              border: `1px solid ${showInfo ? '#42A5F5' : 'rgba(255,255,255,0.1)'}`,
              background: showInfo ? 'rgba(66,165,245,0.15)' : 'rgba(255,255,255,0.04)',
              color: showInfo ? '#42A5F5' : '#90A4AE',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Info size={14} />
          </button>
          <button
            onClick={handleRefresh}
            title={isAr ? 'تحديث' : 'Refresh'}
            style={{
              width: 32,
              height: 32,
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.04)',
              color: '#90A4AE',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <RefreshCw size={14} />
          </button>
          <a
            href="https://www.windy.com/?rain,24.0,54.5,7"
            target="_blank"
            rel="noopener noreferrer"
            title={isAr ? 'فتح في Windy.com' : 'Open in Windy.com'}
            style={{
              width: 32,
              height: 32,
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.04)',
              color: '#90A4AE',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textDecoration: 'none',
            }}
          >
            <ExternalLink size={14} />
          </a>
        </div>
      </div>

      {/* ── Info Banner ─────────────────────────────────────────────────────── */}
      {showInfo && (
        <div
          style={{
            flexShrink: 0,
            padding: '10px 20px',
            background: 'rgba(21,101,192,0.12)',
            borderBottom: '1px solid rgba(66,165,245,0.2)',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '20px',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#69F0AE' }} />
            <span style={{ fontSize: 11, color: '#B0BEC5' }}>
              {isAr ? 'المصدر: Windy.com — نموذج ECMWF' : 'Source: Windy.com — ECMWF model'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#42A5F5' }} />
            <span style={{ fontSize: 11, color: '#B0BEC5' }}>
              {isAr ? 'دقة التوقع: 9 كم — تحديث كل 6 ساعات' : 'Forecast resolution: 9 km — updated every 6h'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#FFB74D' }} />
            <span style={{ fontSize: 11, color: '#B0BEC5' }}>
              {isAr
                ? 'الطبقة النشطة: ' + activeLayer.description.ar
                : 'Active layer: ' + activeLayer.description.en}
            </span>
          </div>
        </div>
      )}

      {/* ── Active layer indicator ──────────────────────────────────────────── */}
      <div
        style={{
          flexShrink: 0,
          padding: '6px 16px',
          background: `${activeLayer.color}11`,
          borderBottom: `1px solid ${activeLayer.color}33`,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
          {(() => {
            const Icon = activeLayer.icon;
            return <span style={{ color: activeLayer.color, display: 'flex' }}><Icon size={13} /></span>;
          })()}
        <span style={{ fontSize: 11, color: activeLayer.color, fontWeight: 600 }}>
          {isAr ? activeLayer.labelAr : activeLayer.labelEn}
        </span>
        <span style={{ fontSize: 11, color: '#78909C' }}>—</span>
        <span style={{ fontSize: 11, color: '#78909C' }}>
          {isAr ? activeLayer.description.ar : activeLayer.description.en}
        </span>
      </div>

      {/* ── Windy iframe ────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <iframe
          key={iframeKey}
          ref={iframeRef}
          src={windyUrl}
          title={isAr ? 'رادار Windy التفاعلي' : 'Windy Interactive Radar'}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            display: 'block',
          }}
          allowFullScreen
          loading="lazy"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        />

        {/* Loading overlay — shown briefly on layer change */}
        <div
          style={{
            position: 'absolute',
            bottom: 12,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(10,20,40,0.85)',
            border: `1px solid ${activeLayer.color}44`,
            borderRadius: '20px',
            padding: '5px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
          {(() => {
            const Icon = activeLayer.icon;
            return <span style={{ color: activeLayer.color, display: 'flex' }}><Icon size={12} /></span>;
          })()}
          <span style={{ fontSize: 11, color: activeLayer.color, fontFamily: 'Space Mono, monospace' }}>
            {isAr
              ? `طبقة ${activeLayer.labelAr} نشطة — Windy ECMWF`
              : `${activeLayer.labelEn} layer active — Windy ECMWF`}
          </span>
        </div>
      </div>
    </div>
  );
}
