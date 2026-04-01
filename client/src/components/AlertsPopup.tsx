/**
 * AlertsPopup.tsx — FloodSat AI
 * Full-screen alert notification popup window.
 * Shows when bell icon is clicked — displays live alert list with full details per alert.
 * Muting/unmuting audio is done ONLY from this window.
 */
import { useEffect, useRef } from 'react';
import {
  X, Bell, AlertTriangle, Droplets, MapPin,
  Clock, Volume2, VolumeX, RefreshCw, Shield,
  Waves, Thermometer, Wind, Activity,
  AlertCircle, CheckCircle, Info, Navigation,
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAppTheme } from '@/contexts/ThemeContext';
import { useRealWeather, computeAlertSummary } from '@/hooks/useRealWeather';
import { setMuted, playBellClick } from '@/services/audioAlertService';

interface AlertsPopupProps {
  onClose: () => void;
  mutedState: boolean;
  onMuteChange: (muted: boolean) => void;
}

const LEVEL_CONFIG = {
  critical: {
    color: '#EF4444',
    bg: 'rgba(239,68,68,0.12)',
    border: 'rgba(239,68,68,0.35)',
    labelAr: 'حرج',
    labelEn: 'Critical',
    icon: '🔴',
  },
  warning: {
    color: '#F59E0B',
    bg: 'rgba(245,158,11,0.12)',
    border: 'rgba(245,158,11,0.30)',
    labelAr: 'تحذير',
    labelEn: 'Warning',
    icon: '🟡',
  },
  watch: {
    color: '#0EA5E9',
    bg: 'rgba(14,165,233,0.10)',
    border: 'rgba(14,165,233,0.25)',
    labelAr: 'مراقبة',
    labelEn: 'Watch',
    icon: '🔵',
  },
  safe: {
    color: '#10B981',
    bg: 'rgba(16,185,129,0.10)',
    border: 'rgba(16,185,129,0.20)',
    labelAr: 'آمن',
    labelEn: 'Safe',
    icon: '🟢',
  },
};

function getHazardType(region: any, lang: string): string {
  const wadiActive = (region.waterAccumulation?.wadiDischarge ?? 0) > 0.5;
  const deepWater = (region.waterAccumulation?.estimatedDepthCm ?? 0) >= 50;
  const highRain = region.currentPrecipitation >= 2;
  const highRisk = region.floodRisk >= 40;
  if (lang === 'ar') {
    if (wadiActive && deepWater) return 'فيضان وادي + تجمع مياه';
    if (wadiActive) return 'فيضان وادي نشط';
    if (deepWater) return 'تجمع مياه عميق';
    if (highRain && highRisk) return 'هطول غزير + خطر فيضان';
    if (highRain) return 'هطول مطري نشط';
    if (highRisk) return 'خطر فيضان مرتفع';
    return 'مراقبة احترازية';
  } else {
    if (wadiActive && deepWater) return 'Wadi Flood + Water Accumulation';
    if (wadiActive) return 'Active Wadi Flood';
    if (deepWater) return 'Deep Water Accumulation';
    if (highRain && highRisk) return 'Heavy Rain + Flood Risk';
    if (highRain) return 'Active Rainfall';
    if (highRisk) return 'High Flood Risk';
    return 'Precautionary Watch';
  }
}

function getRecommendation(region: any, lang: string): string {
  const level = region.alertLevel;
  const wadiActive = (region.waterAccumulation?.wadiDischarge ?? 0) > 0.5;
  if (lang === 'ar') {
    if (level === 'critical') return wadiActive
      ? 'إخلاء فوري — تجنب الأودية والمناطق المنخفضة بالكامل'
      : 'تجنب التنقل — ابق في مكان مرتفع وآمن حتى انتهاء الخطر';
    if (level === 'warning') return 'توخ الحذر الشديد عند القيادة — تجنب الطرق المنخفضة والأنفاق';
    if (level === 'watch') return 'تابع التحديثات بانتظام — كن مستعداً للتصرف الفوري';
    return 'الوضع تحت المراقبة المستمرة';
  } else {
    if (level === 'critical') return wadiActive
      ? 'Immediate evacuation — avoid all wadis and low-lying areas'
      : 'Avoid travel — stay in elevated safe location until hazard clears';
    if (level === 'warning') return 'Drive with extreme caution — avoid low-lying roads and underpasses';
    if (level === 'watch') return 'Monitor updates regularly — be ready to act immediately';
    return 'Situation under continuous monitoring';
  }
}

function getAccumLabel(level: string, lang: string): string {
  const map: Record<string, [string, string]> = {
    none: ['لا يوجد', 'None'],
    minor: ['طفيف', 'Minor'],
    moderate: ['متوسط', 'Moderate'],
    severe: ['شديد', 'Severe'],
    extreme: ['بالغ الشدة', 'Extreme'],
  };
  const pair = map[level] ?? map['none'];
  return lang === 'ar' ? pair[0] : pair[1];
}

export default function AlertsPopup({ onClose, mutedState, onMuteChange }: AlertsPopupProps) {
  const { lang, dir } = useLanguage();
  const { theme } = useAppTheme();
  const { data, isLive, lastUpdated, refresh } = useRealWeather();
  const isRtl = dir === 'rtl';
  const isAdeo = theme === 'adeo-light';
  const panelRef = useRef<HTMLDivElement>(null);
  const t = (ar: string, en: string) => lang === 'ar' ? ar : en;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    };
    const timer = setTimeout(() => document.addEventListener('mousedown', handler), 100);
    return () => { clearTimeout(timer); document.removeEventListener('mousedown', handler); };
  }, [onClose]);

  function handleMuteToggle() {
    const next = !mutedState;
    setMuted(next);
    onMuteChange(next);
    if (!next) playBellClick();
  }

  const {
    activeRegions: alerts,
    criticalCount,
    warningCount,
    watchCount,
    activeAlerts: totalCount,
    highestSeverity,
  } = computeAlertSummary(data);

  const headerColor = highestSeverity === 'critical'
    ? '#EF4444'
    : highestSeverity === 'warning'
    ? '#F59E0B'
    : '#0EA5E9';
  const headerBg = isAdeo
    ? 'rgba(255,255,255,0.98)'
    : highestSeverity === 'critical'
    ? 'linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(10,14,20,0.98) 60%)'
    : highestSeverity === 'warning'
    ? 'linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(10,14,20,0.98) 60%)'
    : 'linear-gradient(135deg, rgba(14,165,233,0.10) 0%, rgba(10,14,20,0.98) 60%)';

  const lastUpdateStr = lastUpdated
    ? lastUpdated.toLocaleTimeString(lang === 'ar' ? 'ar-AE' : 'en-AE', {
        hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Dubai',
      })
    : t('جاري التحميل...', 'Loading...');

  const textPrimary = isAdeo ? '#111827' : '#e2e8f0';
  const textSecondary = isAdeo ? '#6B7280' : '#64748b';
  const textMuted = isAdeo ? '#9CA3AF' : '#475569';
  const dividerColor = isAdeo ? '#E5E7EB' : 'rgba(255,255,255,0.06)';
  const cardBg = isAdeo ? 'rgba(255,255,255,0.98)' : 'rgba(10,14,20,0.98)';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9998,
      background: 'rgba(0,0,0,0.60)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'flex-start', justifyContent: isRtl ? 'flex-end' : 'flex-start',
      padding: '60px 12px 12px',
      direction: dir,
    }}>
      <div ref={panelRef} style={{
        width: '100%', maxWidth: '520px',
        background: cardBg,
        border: `1px solid ${headerColor}44`,
        borderTop: `3px solid ${headerColor}`,
        borderRadius: '14px',
        boxShadow: `0 24px 64px rgba(0,0,0,0.6), 0 0 40px ${headerColor}18`,
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        maxHeight: 'calc(100vh - 80px)',
        fontFamily: 'Tajawal, sans-serif',
      }}>

        {/* ── Header ── */}
        <div style={{
          padding: '14px 16px',
          background: headerBg,
          borderBottom: `1px solid ${headerColor}25`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
            <div style={{
              width: '38px', height: '38px', borderRadius: '10px', flexShrink: 0,
              background: `${headerColor}20`, border: `1px solid ${headerColor}44`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Bell size={17} style={{ color: headerColor }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '15px', fontWeight: 700, color: textPrimary, lineHeight: 1.2 }}>
                {t('مركز التنبيهات', 'Alert Center')}
              </div>
              <div style={{ fontSize: '10px', color: textSecondary, marginTop: '2px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <div style={{
                  width: '6px', height: '6px', borderRadius: '50%',
                  background: isLive ? '#10B981' : '#EF4444',
                  boxShadow: isLive ? '0 0 5px #10B981' : 'none',
                }} />
                {isLive ? t('مباشر', 'Live') : t('غير متصل', 'Offline')}
                <span style={{ color: textMuted }}>—</span>
                <Clock size={9} style={{ color: textMuted }} />
                <span style={{ color: textMuted }}>{lastUpdateStr}</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            <button onClick={refresh} title={t('تحديث', 'Refresh')} style={{
              width: '30px', height: '30px', borderRadius: '7px', cursor: 'pointer',
              background: isAdeo ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)',
              border: `1px solid ${dividerColor}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: textSecondary,
            }}>
              <RefreshCw size={12} />
            </button>
            {/* Mute / Unmute — ONLY place to control audio */}
            <button onClick={handleMuteToggle}
              title={mutedState ? t('تفعيل الصوت', 'Unmute alerts') : t('كتم الصوت', 'Mute alerts')}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '5px 10px', borderRadius: '7px', cursor: 'pointer',
                background: mutedState ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)',
                border: mutedState ? '1px solid rgba(239,68,68,0.35)' : '1px solid rgba(16,185,129,0.35)',
                color: mutedState ? '#EF4444' : '#10B981',
                fontSize: '11px', fontWeight: 600,
                fontFamily: 'Space Mono, monospace',
              }}>
              {mutedState ? <VolumeX size={12} /> : <Volume2 size={12} />}
              {mutedState ? t('كتم', 'Muted') : t('صوت', 'Sound')}
            </button>
            <button onClick={onClose} style={{
              width: '30px', height: '30px', borderRadius: '7px', cursor: 'pointer',
              background: isAdeo ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)',
              border: `1px solid ${dividerColor}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: textSecondary,
            }}>
              <X size={14} />
            </button>
          </div>
        </div>

        {/* ── Summary Pills ── */}
        <div style={{
          display: 'flex', gap: '6px', padding: '10px 16px',
          borderBottom: `1px solid ${dividerColor}`,
          flexShrink: 0, flexWrap: 'wrap', alignItems: 'center',
        }}>
          {[
            { count: criticalCount, ...LEVEL_CONFIG.critical },
            { count: warningCount, ...LEVEL_CONFIG.warning },
            { count: watchCount, ...LEVEL_CONFIG.watch },
          ].filter(item => item.count > 0).map(item => (
            <div key={item.labelEn} style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              padding: '4px 10px', borderRadius: '20px',
              background: item.bg, border: `1px solid ${item.border}`,
              fontSize: '11px', fontWeight: 700, color: item.color,
              fontFamily: 'Space Mono, monospace',
            }}>
              <span>{item.icon}</span>
              <span>{item.count}</span>
              <span style={{ fontSize: '10px', opacity: 0.85 }}>
                {lang === 'ar' ? item.labelAr : item.labelEn}
              </span>
            </div>
          ))}
          {totalCount === 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              padding: '4px 10px', borderRadius: '20px',
              background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.25)',
              fontSize: '11px', fontWeight: 700, color: '#10B981',
            }}>
              <Shield size={11} />
              {t('جميع المناطق آمنة', 'All regions safe')}
            </div>
          )}
          <div style={{ marginInlineStart: 'auto', fontSize: '10px', color: textMuted, fontFamily: 'Space Mono, monospace' }}>
            {totalCount} {t('تنبيه', 'alert')}
          </div>
        </div>

        {/* ── Alert List ── */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {totalCount === 0 ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: '40px 16px', gap: '12px',
            }}>
              <CheckCircle size={40} style={{ color: '#10B981', opacity: 0.8 }} />
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#10B981' }}>
                {t('لا توجد تنبيهات نشطة', 'No active alerts')}
              </div>
              <div style={{ fontSize: '12px', color: textMuted, textAlign: 'center', lineHeight: 1.6 }}>
                {t('جميع مناطق إمارة أبوظبي في وضع آمن', 'All Abu Dhabi Emirate regions are in safe status')}
              </div>
            </div>
          ) : (
            alerts.map(region => {
              const cfg = LEVEL_CONFIG[region.alertLevel as keyof typeof LEVEL_CONFIG] ?? LEVEL_CONFIG.safe;
              const ts = new Date(region.lastUpdated);
              const timeStr = ts.toLocaleTimeString(lang === 'ar' ? 'ar-AE' : 'en-AE', {
                hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dubai',
              });
              const acc = (region as any).waterAccumulation;
              const depthCm = acc?.estimatedDepthCm ?? 0;
              const areaKm2 = acc?.estimatedAreaKm2 ?? 0;
              const wadiDischarge = acc?.wadiDischarge ?? 0;
              const accLevel = acc?.level ?? 'none';
              const hazardType = getHazardType(region, lang);
              const recommendation = getRecommendation(region, lang);

              return (
                <div key={region.id} style={{
                  borderRadius: '12px',
                  background: cfg.bg,
                  border: `1px solid ${cfg.border}`,
                  overflow: 'hidden',
                }}>
                  {/* Card Header */}
                  <div style={{
                    padding: '10px 12px 8px',
                    borderBottom: `1px solid ${cfg.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
                      <MapPin size={13} style={{ color: cfg.color, flexShrink: 0 }} />
                      <span style={{ fontSize: '14px', fontWeight: 700, color: textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {lang === 'ar' ? region.nameAr : region.nameEn}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      <span style={{
                        padding: '3px 9px', borderRadius: '5px',
                        background: `${cfg.color}22`, border: `1px solid ${cfg.color}55`,
                        fontSize: '10px', fontWeight: 700, color: cfg.color,
                        fontFamily: 'Space Mono, monospace',
                      }}>
                        {cfg.icon} {lang === 'ar' ? cfg.labelAr : cfg.labelEn}
                      </span>
                      <span style={{ fontSize: '9px', color: textMuted, fontFamily: 'Space Mono, monospace' }}>
                        {timeStr}
                      </span>
                    </div>
                  </div>

                  {/* Hazard Type Banner */}
                  <div style={{
                    padding: '5px 12px',
                    background: `${cfg.color}10`,
                    borderBottom: `1px solid ${cfg.border}`,
                    display: 'flex', alignItems: 'center', gap: '6px',
                  }}>
                    <AlertCircle size={11} style={{ color: cfg.color, flexShrink: 0 }} />
                    <span style={{ fontSize: '11px', fontWeight: 600, color: cfg.color }}>
                      {hazardType}
                    </span>
                  </div>

                  {/* Main Data Grid */}
                  <div style={{
                    padding: '8px 12px',
                    display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
                    gap: '6px',
                  }}>
                    {/* Rainfall */}
                    <div style={{
                      padding: '7px 8px', borderRadius: '8px',
                      background: isAdeo ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.12)',
                      border: '1px solid rgba(59,130,246,0.20)',
                      display: 'flex', flexDirection: 'column', gap: '2px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Droplets size={10} style={{ color: '#3B82F6' }} />
                        <span style={{ fontSize: '9px', color: textMuted }}>{t('هطول', 'Rainfall')}</span>
                      </div>
                      <span style={{ fontSize: '15px', fontWeight: 700, color: '#3B82F6', fontFamily: 'Space Mono, monospace', lineHeight: 1 }}>
                        {region.currentPrecipitation.toFixed(1)}
                      </span>
                      <span style={{ fontSize: '8px', color: textMuted }}>mm/h</span>
                    </div>

                    {/* Flood Risk */}
                    <div style={{
                      padding: '7px 8px', borderRadius: '8px',
                      background: `${cfg.color}10`,
                      border: `1px solid ${cfg.color}25`,
                      display: 'flex', flexDirection: 'column', gap: '2px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Activity size={10} style={{ color: cfg.color }} />
                        <span style={{ fontSize: '9px', color: textMuted }}>{t('مؤشر الخطر', 'Risk Index')}</span>
                      </div>
                      <span style={{ fontSize: '15px', fontWeight: 700, color: cfg.color, fontFamily: 'Space Mono, monospace', lineHeight: 1 }}>
                        {region.floodRisk}%
                      </span>
                      <span style={{ fontSize: '8px', color: textMuted }}>{t('فيضان', 'flood')}</span>
                    </div>

                    {/* Water Depth */}
                    <div style={{
                      padding: '7px 8px', borderRadius: '8px',
                      background: isAdeo ? 'rgba(14,165,233,0.08)' : 'rgba(14,165,233,0.12)',
                      border: '1px solid rgba(14,165,233,0.20)',
                      display: 'flex', flexDirection: 'column', gap: '2px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Waves size={10} style={{ color: '#0EA5E9' }} />
                        <span style={{ fontSize: '9px', color: textMuted }}>{t('عمق المياه', 'Water Depth')}</span>
                      </div>
                      <span style={{ fontSize: '15px', fontWeight: 700, color: '#0EA5E9', fontFamily: 'Space Mono, monospace', lineHeight: 1 }}>
                        {depthCm}
                      </span>
                      <span style={{ fontSize: '8px', color: textMuted }}>cm</span>
                    </div>
                  </div>

                  {/* Secondary Data Row */}
                  <div style={{
                    padding: '0 12px 8px',
                    display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px' }}>
                      <Clock size={9} style={{ color: textMuted }} />
                      <span style={{ color: textMuted }}>{t('24س:', '24h:')}</span>
                      <span style={{ fontFamily: 'Space Mono, monospace', fontWeight: 600, color: '#60A5FA' }}>
                        {region.totalLast24h.toFixed(1)} mm
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px' }}>
                      <Thermometer size={9} style={{ color: '#F97316' }} />
                      <span style={{ fontFamily: 'Space Mono, monospace', fontWeight: 600, color: '#F97316' }}>
                        {region.currentTemperature}°C
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px' }}>
                      <Wind size={9} style={{ color: '#94A3B8' }} />
                      <span style={{ fontFamily: 'Space Mono, monospace', fontWeight: 600, color: '#94A3B8' }}>
                        {region.currentWindSpeed} km/h
                      </span>
                    </div>
                    {areaKm2 > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px' }}>
                        <Navigation size={9} style={{ color: '#A78BFA' }} />
                        <span style={{ color: textMuted }}>{t('مساحة:', 'Area:')}</span>
                        <span style={{ fontFamily: 'Space Mono, monospace', fontWeight: 600, color: '#A78BFA' }}>
                          {areaKm2} km²
                        </span>
                      </div>
                    )}
                    {wadiDischarge > 0.5 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px' }}>
                        <Waves size={9} style={{ color: '#F59E0B' }} />
                        <span style={{ color: textMuted }}>{t('وادي:', 'Wadi:')}</span>
                        <span style={{ fontFamily: 'Space Mono, monospace', fontWeight: 600, color: '#F59E0B' }}>
                          {wadiDischarge.toFixed(1)} m³/s
                        </span>
                      </div>
                    )}
                    {accLevel !== 'none' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px' }}>
                        <AlertTriangle size={9} style={{ color: cfg.color }} />
                        <span style={{ color: textMuted }}>{t('تراكم:', 'Accum:')}</span>
                        <span style={{ fontFamily: 'Space Mono, monospace', fontWeight: 600, color: cfg.color }}>
                          {getAccumLabel(accLevel, lang)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Recommendation Footer */}
                  <div style={{
                    padding: '7px 12px',
                    borderTop: `1px solid ${cfg.border}`,
                    background: `${cfg.color}08`,
                    display: 'flex', alignItems: 'flex-start', gap: '6px',
                  }}>
                    <Info size={11} style={{ color: cfg.color, flexShrink: 0, marginTop: '1px' }} />
                    <span style={{ fontSize: '11px', color: textSecondary, lineHeight: 1.5, fontWeight: 500 }}>
                      {recommendation}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{
          padding: '8px 16px',
          borderTop: `1px solid ${dividerColor}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: '9px', color: textMuted, fontFamily: 'Space Mono, monospace' }}>
            {t('المصدر: Open-Meteo + GloFAS + DEM', 'Source: Open-Meteo + GloFAS + DEM')}
          </span>
          <span style={{ fontSize: '9px', color: textMuted, fontFamily: 'Space Mono, monospace' }}>
            {t('تحديث كل 5 دقائق', 'Updates every 5 min')}
          </span>
        </div>
      </div>
    </div>
  );
}
