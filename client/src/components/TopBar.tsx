// TopBar.tsx — FloodSat AI
// Design: "Geological Strata" — Dark glass topbar with contour accent
// Deep ocean navy + water blues + Space Mono data + Playfair brand
import { useState, useEffect, useRef, useMemo } from 'react';
import { Bell, BellOff, Wifi, WifiOff, Satellite, AlertTriangle, Droplets, Sun, Moon, Globe, Menu } from 'lucide-react';
import FullscreenButton from '@/components/FullscreenButton';
import { useRealWeather, computeAlertSummary } from '@/hooks/useRealWeather';
import { useAppTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import DataModeSwitcher from '@/components/DataModeSwitcher';
import ExplainerTooltip from '@/components/ExplainerTooltip';
import { useIsMobile } from '@/hooks/useMobile';
import { openMobileSidebar } from '@/components/Sidebar';
import {
  playAlertSound,
  isMuted,
  setMuted,
  unlockAudio,
} from '@/services/audioAlertService';
import AlertsPopup from '@/components/AlertsPopup';
import { trpc } from '@/lib/trpc';

export default function TopBar() {
  const [time, setTime] = useState(new Date());
  const [tickerIndex, setTickerIndex] = useState(0);
  const [muted, setMutedState] = useState(isMuted);
  const [bellAnimating, setBellAnimating] = useState(false);
  const [alertsPopupOpen, setAlertsPopupOpen] = useState(false);
  const { data, isLive } = useRealWeather();
  const { theme, setTheme } = useAppTheme();
  const { lang, setLang, dir } = useLanguage();
  trpc.notifications.getUnreadCount.useQuery(
    undefined,
    { refetchInterval: 30_000 }
  );
  const isRtl = dir === 'rtl';

  // Track previous alert counts to detect new alerts
  const prevCriticalRef = useRef<number>(0);
  const prevWarningRef  = useRef<number>(0);
  const prevWatchRef    = useRef<number>(0);
  const audioUnlockedRef = useRef(false);

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Unlock audio on first user interaction anywhere
  useEffect(() => {
    const unlock = () => {
      if (!audioUnlockedRef.current) {
        unlockAudio();
        audioUnlockedRef.current = true;
      }
    };
    window.addEventListener('click', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('click', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  // Detect new alerts and play sound
  useEffect(() => {
    if (!data) return;

    const {
      criticalCount: critical,
      warningCount: warning,
      watchCount: watch,
    } = computeAlertSummary(data);

    const prevCritical = prevCriticalRef.current;
    const prevWarning  = prevWarningRef.current;
    const prevWatch    = prevWatchRef.current;

    // Only play if count increased (new alert arrived)
    if (critical > prevCritical) {
      playAlertSound('critical');
      triggerBellAnimation();
    } else if (warning > prevWarning) {
      playAlertSound('warning');
      triggerBellAnimation();
    } else if (watch > prevWatch) {
      playAlertSound('watch');
      triggerBellAnimation();
    }

    prevCriticalRef.current = critical;
    prevWarningRef.current  = warning;
    prevWatchRef.current    = watch;
  }, [data]);

  function triggerBellAnimation() {
    setBellAnimating(true);
    setTimeout(() => setBellAnimating(false), 800);
  }

  function handleBellClick() {
    // Bell click opens/closes the alerts popup
    setAlertsPopupOpen(prev => !prev);
  }

  function handleMuteChange(newMuted: boolean) {
    setMuted(newMuted);
    setMutedState(newMuted);
  }

  const alertSummary = useMemo(() => computeAlertSummary(data), [data]);
  const { activeRegions, criticalCount, warningCount, watchCount, activeAlerts, highestSeverity } = alertSummary;

  const tickerItems = useMemo(() => {
    if (!data) return [
      {
        regionAr: lang === 'ar' ? 'نظام المراقبة' : 'Monitoring System',
        level: 'safe' as const,
        message: lang === 'ar'
          ? 'الأقمار الصناعية نشطة — تغطية 98.7% من إمارة أبوظبي'
          : 'Satellites active — 98.7% coverage of Abu Dhabi Emirate',
      },
    ];

    const alerts = activeRegions.map(r => ({
      regionAr: lang === 'ar' ? r.nameAr : r.nameEn,
      level: r.alertLevel,
      message: lang === 'ar'
        ? `هطول: ${r.currentPrecipitation} ملم/ساعة — مؤشر الخطر: ${r.floodRisk}%`
        : `Precip: ${r.currentPrecipitation} mm/h — Risk: ${r.floodRisk}%`,
    }));

    return alerts.length > 0 ? alerts : [
      {
        regionAr: lang === 'ar' ? 'إمارة أبوظبي' : 'Abu Dhabi Emirate',
        level: 'safe' as const,
        message: lang === 'ar'
          ? 'جميع المناطق آمنة — لا تجمعات مائية مرصودة'
          : 'All zones safe — No water accumulations detected',
      },
    ];
  }, [activeRegions, data, lang]);

  const tickerLen = tickerItems.length;
  useEffect(() => {
    if (tickerLen <= 1) return;
    const t = setInterval(() => setTickerIndex(i => (i + 1) % tickerLen), 5000);
    return () => clearInterval(t);
  }, [tickerLen]);

  const currentTicker = tickerItems[tickerIndex % tickerLen];

  const alertColor =
    currentTicker?.level === 'critical' ? '#FF6B35'
    : currentTicker?.level === 'warning'  ? '#FFB300'
    : currentTicker?.level === 'watch'    ? '#4DD0E1'
    : '#43A047';

  const alertBg =
    currentTicker?.level === 'critical' ? 'rgba(255,107,53,0.10)'
    : currentTicker?.level === 'warning'  ? 'rgba(255,179,0,0.10)'
    : currentTicker?.level === 'watch'    ? 'rgba(77,208,225,0.08)'
    : 'rgba(67,160,71,0.08)';

  const formatTime = (d: Date) =>
    d.toLocaleTimeString(lang === 'ar' ? 'ar-AE' : 'en-AE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const formatDate = (d: Date) =>
    d.toLocaleDateString(lang === 'ar' ? 'ar-AE' : 'en-AE', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

  const isAdeo = theme === 'adeo-light';
  const isMobile = useIsMobile();

  // Bell color: red if critical alerts, yellow if warnings, blue/gold otherwise
  const bellColor = highestSeverity === 'critical'
    ? '#FF6B35'
    : highestSeverity === 'warning'
    ? '#FFB300'
    : highestSeverity === 'watch'
    ? '#4DD0E1'
    : isAdeo ? '#003366' : '#42A5F5';

  const bellBg = highestSeverity === 'critical'
    ? 'rgba(255,107,53,0.15)'
    : highestSeverity === 'warning'
    ? 'rgba(255,179,0,0.12)'
    : highestSeverity === 'watch'
    ? 'rgba(77,208,225,0.10)'
    : isAdeo ? 'rgba(0,51,102,0.08)' : 'rgba(66,165,245,0.08)';

  const bellBorder = highestSeverity === 'critical'
    ? 'rgba(255,107,53,0.35)'
    : highestSeverity === 'warning'
    ? 'rgba(255,179,0,0.30)'
    : highestSeverity === 'watch'
    ? 'rgba(77,208,225,0.28)'
    : isAdeo ? 'rgba(0,51,102,0.2)' : 'rgba(66,165,245,0.2)';

  // Brand block position: right side for LTR, left side for RTL
  const brandWidth = isMobile ? '0px' : '210px';
  const brandBlockStyle: React.CSSProperties = isMobile ? { display: 'none' } : {
    width: '210px',
    height: '100%',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '0 16px',
    background: isAdeo ? 'rgba(0,51,102,0.97)' : 'rgba(10,22,36,0.95)',
    borderLeft: isRtl ? `1px solid ${isAdeo ? 'rgba(200,168,75,0.3)' : 'rgba(66,165,245,0.12)'}` : 'none',
    borderRight: !isRtl ? `1px solid ${isAdeo ? 'rgba(200,168,75,0.3)' : 'rgba(66,165,245,0.12)'}` : 'none',
    position: 'absolute' as const,
    right: isRtl ? 0 : 'auto',
    left: isRtl ? 'auto' : 0,
    top: 0,
  };

  // Content area: offset from the brand block side
  const contentAreaStyle: React.CSSProperties = {
    marginRight: isMobile ? '0' : (isRtl ? '210px' : '0'),
    marginLeft: isMobile ? '0' : (isRtl ? '0' : '210px'),
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: isMobile ? '6px' : '10px',
    padding: isMobile ? '0 8px' : '0 16px',
    minWidth: 0,
    overflow: 'hidden',
    direction: dir,
  };

  return (
    <>
      {/* Bell shake animation keyframes */}
      <style>{`
        @keyframes bellShake {
          0%   { transform: rotate(0deg); }
          15%  { transform: rotate(-18deg); }
          30%  { transform: rotate(16deg); }
          45%  { transform: rotate(-12deg); }
          60%  { transform: rotate(10deg); }
          75%  { transform: rotate(-6deg); }
          90%  { transform: rotate(4deg); }
          100% { transform: rotate(0deg); }
        }
        .bell-shake { animation: bellShake 0.8s ease-in-out; }
        @keyframes bellPulse {
          0%   { box-shadow: 0 0 0 0 rgba(255,107,53,0.5); }
          70%  { box-shadow: 0 0 0 8px rgba(255,107,53,0); }
          100% { box-shadow: 0 0 0 0 rgba(255,107,53,0); }
        }
        .bell-pulse { animation: bellPulse 0.8s ease-out; }
      `}</style>

      <header
        className="topnav fixed top-0 left-0 right-0 z-50 flex items-center overflow-hidden"
        style={{
          height: '52px',
          background: isAdeo ? 'rgba(255,255,255,0.97)' : undefined,
          borderBottom: isAdeo ? '2px solid #003366' : undefined,
        }}
      >
        {/* Topographic contour accent line */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
          background: isAdeo
            ? 'linear-gradient(90deg, transparent, #003366 20%, #C8A84B 50%, #003366 80%, transparent)'
            : 'linear-gradient(90deg, transparent, #1565C0 20%, #42A5F5 50%, #1565C0 80%, transparent)',
          opacity: 0.7,
        }} />

        {/* Brand block */}
        <div style={brandBlockStyle}>
          <div style={{
            width: '28px', height: '28px',
            background: isAdeo ? 'linear-gradient(135deg, #C8A84B, #E8C96A)' : 'linear-gradient(135deg, #1565C0, #42A5F5)',
            clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Droplets size={13} color={isAdeo ? '#003366' : '#E8F4F8'} />
          </div>
          <div>
            <div style={{ fontFamily: 'Playfair Display, serif', fontWeight: 700, fontSize: '14px', color: '#E8F4F8', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              FloodSat AI
            </div>
            <div style={{ fontFamily: 'Space Mono, monospace', fontSize: '8px', color: isAdeo ? '#C8A84B' : '#42A5F5', letterSpacing: '0.08em' }}>
              {lang === 'ar' ? 'أبوظبي · مباشر' : 'Abu Dhabi · LIVE'}
            </div>
          </div>
        </div>

        {/* Content area */}
        <div style={contentAreaStyle}>
          {/* Hamburger menu button — mobile only */}
          {isMobile && (
            <button
              onClick={openMobileSidebar}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '34px', height: '34px', borderRadius: '6px', cursor: 'pointer',
                background: isAdeo ? 'rgba(0,51,102,0.08)' : 'rgba(66,165,245,0.08)',
                border: `1px solid ${isAdeo ? 'rgba(0,51,102,0.2)' : 'rgba(66,165,245,0.2)'}`,
                color: isAdeo ? '#003366' : '#42A5F5',
                flexShrink: 0,
              }}
            >
              <Menu size={16} />
            </button>
          )}

          {/* Brand name — mobile only (inline instead of sidebar block) */}
          {isMobile && (
            <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{
                width: '22px', height: '22px',
                background: isAdeo ? 'linear-gradient(135deg, #C8A84B, #E8C96A)' : 'linear-gradient(135deg, #1565C0, #42A5F5)',
                clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Droplets size={10} color={isAdeo ? '#003366' : '#E8F4F8'} />
              </div>
              <span style={{ fontFamily: 'Playfair Display, serif', fontWeight: 700, fontSize: '13px', color: isAdeo ? '#003366' : '#E8F4F8', letterSpacing: '-0.02em' }}>FloodSat AI</span>
            </div>
          )}

          {/* Clock + divider + data mode + satellites — hidden on mobile */}
          {!isMobile && (
            <>
              <div style={{ flexShrink: 0, textAlign: isRtl ? 'right' : 'left' }}>
                <div style={{ fontFamily: 'Space Mono, monospace', fontWeight: 700, fontSize: '13px', color: isAdeo ? '#003366' : '#E8F4F8', letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>
                  {formatTime(time)}
                </div>
                <div style={{ fontFamily: 'Space Mono, monospace', fontSize: '9px', color: '#546E7A', lineHeight: 1.2 }}>
                  {formatDate(time)}
                </div>
              </div>
              <div style={{ width: '1px', height: '24px', background: isAdeo ? 'rgba(0,51,102,0.2)' : 'rgba(66,165,245,0.15)', flexShrink: 0 }} />
              {/* Data Mode Switcher (LIVE / ARCHIVE) */}
              <DataModeSwitcher />
              {/* Satellites */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                <Satellite size={11} style={{ color: isAdeo ? '#003366' : '#42A5F5' }} />
                <span style={{ fontFamily: 'Space Mono, monospace', fontWeight: 700, fontSize: '11px', color: isAdeo ? '#003366' : '#42A5F5' }}>
                  {lang === 'ar' ? '6 أقمار' : '6 Sats'}
                </span>
              </div>
              <div style={{ width: '1px', height: '24px', background: isAdeo ? 'rgba(0,51,102,0.2)' : 'rgba(66,165,245,0.15)', flexShrink: 0 }} />
            </>
          )}

          {/* Alert ticker */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 10px', borderRadius: '3px', background: alertBg, border: `1px solid ${alertColor}22`, minWidth: 0, overflow: 'hidden' }}>
            <AlertTriangle size={11} style={{ color: alertColor, flexShrink: 0 }} />
            <span style={{ color: alertColor, fontSize: '12px', fontFamily: lang === 'ar' ? 'Noto Naskh Arabic, serif' : 'Inter, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
              <strong>{currentTicker.regionAr}:</strong>{' '}{currentTicker.message}
            </span>
            <ExplainerTooltip id="floodRiskIndex" position="bottom" iconSize={11} />
          </div>

          {/* Alert badges */}
          {(criticalCount > 0 || warningCount > 0) && (
            <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
              {criticalCount > 0 && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '2px', background: 'rgba(255,107,53,0.12)', color: '#FF6B35', border: '1px solid rgba(255,107,53,0.25)', fontSize: '10px', fontWeight: 700, fontFamily: 'Space Mono, monospace' }}>
                  <Bell size={8} />{criticalCount} {lang === 'ar' ? 'حرج' : 'Critical'}
                </span>
              )}
              {warningCount > 0 && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '2px', background: 'rgba(255,179,0,0.10)', color: '#FFB300', border: '1px solid rgba(255,179,0,0.22)', fontSize: '10px', fontWeight: 700, fontFamily: 'Space Mono, monospace' }}>
                  {warningCount} {lang === 'ar' ? 'تحذير' : 'Warning'}
                </span>
              )}
            </div>
          )}

          <div style={{ width: '1px', height: '24px', background: isAdeo ? 'rgba(0,51,102,0.2)' : 'rgba(66,165,245,0.15)', flexShrink: 0 }} />

          {/* ─── BELL / MUTE BUTTON ─── */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <button
              onClick={handleBellClick}
              title={lang === 'ar' ? 'فتح مركز التنبيهات' : 'Open Alert Center'}
              className={bellAnimating ? 'bell-pulse' : ''}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '30px', height: '30px', borderRadius: '6px', cursor: 'pointer',
                background: muted ? (isAdeo ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)') : bellBg,
                border: `1px solid ${muted ? 'rgba(128,128,128,0.2)' : bellBorder}`,
                color: muted ? '#546E7A' : bellColor,
                transition: 'all 0.2s',
                position: 'relative',
              }}
            >
              <span className={bellAnimating ? 'bell-shake' : ''} style={{ display: 'flex' }}>
                {muted ? <BellOff size={13} /> : <Bell size={13} />}
              </span>
            </button>

            {/* Alert count badge — unified with active alert summary */}
            {!muted && activeAlerts > 0 && (
              <span style={{
                position: 'absolute',
                top: '-4px',
                right: isRtl ? 'auto' : '-4px',
                left: isRtl ? '-4px' : 'auto',
                minWidth: '16px', height: '16px',
                background: highestSeverity === 'critical' ? '#FF6B35' : highestSeverity === 'warning' ? '#FFB300' : '#4DD0E1',
                color: '#fff',
                borderRadius: '8px',
                fontSize: '9px', fontWeight: 700,
                fontFamily: 'Space Mono, monospace',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '0 3px',
                border: '1.5px solid rgba(10,22,36,0.8)',
                pointerEvents: 'none',
              }}>
                {activeAlerts}
              </span>
            )}
          </div>

          {/* Language Toggle */}
          <button
            onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
            title={lang === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
            style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              padding: '4px 10px', borderRadius: '4px', cursor: 'pointer',
              background: isAdeo ? 'rgba(0,51,102,0.08)' : 'rgba(66,165,245,0.08)',
              border: `1px solid ${isAdeo ? 'rgba(0,51,102,0.2)' : 'rgba(66,165,245,0.2)'}`,
              color: isAdeo ? '#003366' : '#42A5F5',
              fontSize: '11px', fontWeight: 700, fontFamily: 'Space Mono, monospace',
              flexShrink: 0, transition: 'all 0.2s',
            }}
          >
            <Globe size={11} />
            {lang === 'ar' ? 'EN' : 'AR'}
          </button>

          {/* Fullscreen Toggle */}
          <FullscreenButton
            size={11}
            color={isAdeo ? '#003366' : '#42A5F5'}
            className=""
          />

          {/* Theme Toggle */}
          <button
            onClick={() => setTheme(isAdeo ? 'dark-tech' : 'adeo-light')}
            title={isAdeo ? 'Dark Tech Theme' : 'ADEO Light Theme'}
            style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              padding: '4px 10px', borderRadius: '4px', cursor: 'pointer',
              background: isAdeo ? 'rgba(0,51,102,0.08)' : 'rgba(200,168,75,0.08)',
              border: `1px solid ${isAdeo ? 'rgba(0,51,102,0.2)' : 'rgba(200,168,75,0.25)'}`,
              color: isAdeo ? '#003366' : '#C8A84B',
              fontSize: '10px', fontWeight: 700,
              flexShrink: 0, transition: 'all 0.2s',
            }}
          >
            {isAdeo ? <Moon size={11} /> : <Sun size={11} />}
            {isAdeo ? 'Dark' : 'ADEO'}
          </button>
        </div>
      </header>

      {/* Alerts Popup — opens when bell is clicked */}
      {alertsPopupOpen && (
        <AlertsPopup
          onClose={() => setAlertsPopupOpen(false)}
          mutedState={muted}
          onMuteChange={handleMuteChange}
        />
      )}
    </>
  );
}
