// Sidebar.tsx — FloodSat AI
// Design: "Geological Strata" — Dark glass floating panel
// Deep ocean navy + water blues + Playfair Display + Space Mono
// Supports: Arabic (RTL) + English (LTR) + ADEO Light theme + Mobile Drawer
// v5 — Mobile-first with Sheet drawer on small screens

import { useState } from 'react';
import { useLocation } from 'wouter';
import {
  LayoutDashboard, Map, Satellite, BarChart3, Bell,
  ChevronLeft, ChevronRight, Activity, Layers,
  Mountain, FlaskConical, Network, Droplets, Archive, Brain,
  Eye, Route, ScanLine, BookOpen, X, Radio
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useRealWeather, computeAlertSummary } from '@/hooks/useRealWeather';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAppTheme } from '@/contexts/ThemeContext';
import NavTooltip from '@/components/NavTooltip';
import { useIsMobile } from '@/hooks/useMobile';
import { Sheet, SheetContent } from '@/components/ui/sheet';

// ─────────────────────────────────────────────────────────────────────────────
// Navigation structure — 5 clear sections without duplication
// ─────────────────────────────────────────────────────────────────────────────
const PATH_TO_KEY: Record<string, string> = {
  '/':                'dashboard',
  '/alerts':          'alerts',
  '/map':             'map',
  '/dem':             'dem',
  '/road-network':    'road-network',
  '/drainage':        'drainage',
  '/uncertainty':     'uncertainty-map',
  '/regions':         'regions',
  '/simulation':      'scenarios',
  '/archive':         'archive',
  '/reports':         'reports',
  '/decision-support':'decision-support',
  '/smart-lens':      'field-validation',
  '/accuracy':        'accuracy',
  '/notifications':    'notifications',
};

// Access levels: E=Executive | M=Managerial | O=Operational
const LEVEL_BADGE: Record<string, { ar: string; en: string; color: string }> = {
  E: { ar: 'E', en: 'E', color: '#C8A84B' },
  M: { ar: 'M', en: 'M', color: '#42A5F5' },
  O: { ar: 'O', en: 'O', color: '#69F0AE' },
};

const NAV_GROUPS = [
  {
    groupAr: 'المراقبة الحية',
    groupEn: 'Live Monitoring',
    items: [
      { path: '/',        icon: LayoutDashboard, labelAr: 'لوحة القيادة', labelEn: 'Command Dashboard', level: 'E' },
      { path: '/alerts',  icon: Bell,            labelAr: 'التنبيهات',  labelEn: 'Alerts', level: 'E' },
      { path: '/notifications', icon: Bell, labelAr: 'مركز الإشعارات', labelEn: 'Notifications', level: 'E' },
    ],
  },
  {
    groupAr: 'الخرائط والرصد',
    groupEn: 'Maps & Monitoring',
    items: [
      { path: '/map',          icon: Map,      labelAr: 'مركز الخريطة الموحدة',   labelEn: 'Unified Map Center', level: 'O' },
      { path: '/dem',          icon: Mountain, labelAr: 'ارتفاع التضاريس',    labelEn: 'DEM Elevation', level: 'O' },
      { path: '/road-network', icon: Route,    labelAr: 'شبكة الطرق',    labelEn: 'Road Network', level: 'O' },
      { path: '/drainage',     icon: Droplets, labelAr: 'الصرف والتربة',    labelEn: 'Drainage & Soil', level: 'O' },
      { path: '/uncertainty',  icon: Eye,      labelAr: 'خريطة عدم اليقين',      labelEn: 'Uncertainty Map', level: 'O' },
      { path: '/windy',          icon: Radio,    labelAr: 'رادار Windy',            labelEn: 'Windy Radar', level: 'O' },
    ],
  },
  {
    groupAr: 'التحليل والتنبؤ',
    groupEn: 'Analysis & Forecast',
    items: [
      { path: '/regions',    icon: Layers,       labelAr: 'مستكشف المناطق',         labelEn: 'Regions Explorer', level: 'M' },
      { path: '/simulation', icon: FlaskConical, labelAr: 'محاكاة السيناريو',   labelEn: 'Scenario Simulation', level: 'M' },
      { path: '/archive',    icon: Archive,      labelAr: 'الأرشيف التاريخي',      labelEn: 'Historical Archive', level: 'M' },
      { path: '/reports',    icon: BarChart3,    labelAr: 'التقارير',              labelEn: 'Reports', level: 'E' },
    ],
  },
  {
    groupAr: 'دعم القرار',
    groupEn: 'Decision Support',
    items: [
      { path: '/decision-support', icon: Brain,     labelAr: 'مركز دعم القرار',      labelEn: 'Decision Center', level: 'E' },
      { path: '/smart-lens',       icon: ScanLine,  labelAr: 'العدسة الذكية الميدانية', labelEn: 'Smart Field Lens', level: 'O' },
      { path: '/accuracy',         icon: Network,   labelAr: 'دقة النموذج',           labelEn: 'Model Accuracy', level: 'M' },
      { path: '/glossary',         icon: BookOpen,  labelAr: 'الفهرس التعريفي',         labelEn: 'Indicator Glossary', level: 'E' },
    ],
  },
  {
    groupAr: 'التقنية والبنية',
    groupEn: 'Technology',
    items: [
      { path: '/satellites', icon: Satellite,  labelAr: 'الأقمار الصناعية',       labelEn: 'Satellites', level: 'O' },
      { path: '/ai-models',  icon: Activity,   labelAr: 'نماذج الذكاء الاصطناعي', labelEn: 'AI Models', level: 'O' },
    ],
  },
];

// Shared state for mobile drawer — lifted via a simple module-level store
let _mobileOpen = false;
const _listeners: Set<(v: boolean) => void> = new Set();
export function openMobileSidebar() {
  _mobileOpen = true;
  _listeners.forEach(fn => fn(true));
}
function useMobileSidebarState() {
  const [open, setOpen] = useState(_mobileOpen);
  useState(() => {
    _listeners.add(setOpen);
    return () => { _listeners.delete(setOpen); };
  });
  const close = () => {
    _mobileOpen = false;
    setOpen(false);
    _listeners.forEach(fn => fn(false));
  };
  return { open, close };
}

// ─────────────────────────────────────────────────────────────────────────────
// Nav content (shared between desktop sidebar and mobile drawer)
// ─────────────────────────────────────────────────────────────────────────────
function NavContent({
  collapsed,
  onNavigate,
  isAdeo,
  isRtl,
  lang,
  totalAlerts,
  sidebarBg,
  borderColor,
  brandBg,
  accentColor,
  textPrimary,
  textMuted,
  activeBg,
  hoverBg,
  location,
}: {
  collapsed: boolean;
  onNavigate: (path: string) => void;
  isAdeo: boolean;
  isRtl: boolean;
  lang: string;
  totalAlerts: number;
  sidebarBg: string;
  borderColor: string;
  brandBg: string;
  accentColor: string;
  textPrimary: string;
  textMuted: string;
  activeBg: string;
  hoverBg: string;
  location: string;
}) {
  return (
    <>
      {/* ── Brand header ── */}
      <div style={{
        minHeight: '56px',
        padding: collapsed ? '0' : '14px 16px',
        display: 'flex', alignItems: 'center', gap: '10px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        borderBottom: `1px solid ${borderColor}`,
        background: brandBg,
        flexShrink: 0,
      }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div style={{
            width: '32px', height: '32px',
            background: isAdeo
              ? 'linear-gradient(135deg, #C8A84B, #E8C96A)'
              : 'linear-gradient(135deg, #1565C0, #42A5F5)',
            clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Droplets size={15} color={isAdeo ? '#003366' : '#E8F4F8'} />
          </div>
          <div style={{
            position: 'absolute', inset: '-4px', borderRadius: '50%',
            border: `1.5px solid ${accentColor}`, opacity: 0.4,
            animation: 'pulse-ring 3s ease-out infinite',
          }} />
        </div>
        {!collapsed && (
          <div>
            <div style={{
              fontFamily: 'Playfair Display, serif', fontWeight: 700, fontSize: '15px',
              color: '#E8F4F8', letterSpacing: '-0.02em', lineHeight: 1.2,
            }}>FloodSat AI</div>
            <div style={{
              fontFamily: 'Space Mono, monospace', fontSize: '8px',
              color: accentColor, letterSpacing: '0.08em',
            }}>
              {lang === 'ar' ? 'أبوظبي · مباشر' : 'Abu Dhabi · LIVE'}
            </div>
          </div>
        )}
      </div>

      {/* ── Nav groups ── */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 0', scrollbarWidth: 'none' }}>
        {NAV_GROUPS.map((group) => (
          <div key={group.groupAr} style={{ marginBottom: '4px' }}>
            {!collapsed && (
              <div style={{
                padding: '8px 16px 4px', fontSize: '9px', fontWeight: 700,
                color: textMuted, letterSpacing: '0.10em', textTransform: 'uppercase',
                fontFamily: 'Space Mono, monospace',
              }}>
                {lang === 'ar' ? group.groupAr : group.groupEn}
              </div>
            )}
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.path ||
                (item.path === '/road-network' && location === '/traffic');
              const label = lang === 'ar' ? item.labelAr : item.labelEn;
              const showBadge = item.path === '/alerts' && totalAlerts > 0;

              return (
                <button
                  key={item.labelAr}
                  onClick={() => onNavigate(item.path)}
                  title={collapsed ? label : undefined}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                    padding: collapsed ? '10px 0' : '8px 16px',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    background: isActive ? activeBg : 'transparent',
                    borderRight: isActive && isRtl  ? `2px solid ${accentColor}` : '2px solid transparent',
                    borderLeft:  isActive && !isRtl ? `2px solid ${accentColor}` : '2px solid transparent',
                    color: isActive ? accentColor : textPrimary,
                    cursor: 'pointer', transition: 'all 0.15s ease',
                    position: 'relative', fontSize: '13px',
                    fontFamily: lang === 'ar' ? 'Noto Naskh Arabic, serif' : 'Inter, sans-serif',
                    fontWeight: isActive ? 600 : 400,
                    border: 'none', outline: 'none',
                  }}
                  onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = hoverBg; }}
                  onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <Icon size={16} style={{ flexShrink: 0, opacity: isActive ? 1 : 0.65 }} />
                  {!collapsed && (
                    <span style={{ flex: 1, textAlign: isRtl ? 'right' : 'left' }}>{label}</span>
                  )}
                  {showBadge && !collapsed && (
                    <span style={{
                      background: '#E53935', color: '#fff', borderRadius: '10px',
                      fontSize: '9px', fontWeight: 700, padding: '1px 6px',
                      fontFamily: 'Space Mono, monospace',
                    }}>{totalAlerts}</span>
                  )}
                  {/* Level badge */}
                  {item.level && !collapsed && (() => {
                    const badge = LEVEL_BADGE[item.level];
                    return badge ? (
                      <span
                        title={item.level === 'E' ? 'Executive Level' : item.level === 'M' ? 'Managerial Level' : 'Operational Level'}
                        style={{
                          fontSize: '8px', fontWeight: 700, padding: '1px 4px',
                          borderRadius: '3px', fontFamily: 'Space Mono, monospace',
                          color: badge.color, border: `1px solid ${badge.color}44`,
                          background: `${badge.color}11`, lineHeight: 1.4,
                        }}
                      >
                        {lang === 'ar' ? badge.ar : badge.en}
                      </span>
                    ) : null;
                  })()}
                  {!collapsed && PATH_TO_KEY[item.path] && (
                    <NavTooltip
                      pageKey={PATH_TO_KEY[item.path]}
                      size={11}
                      position={isRtl ? 'left' : 'right'}
                    />
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* ── Level Legend ── */}
      {!collapsed && (
        <div style={{
          padding: '6px 12px',
          borderTop: `1px solid ${borderColor}`,
          display: 'flex', gap: '6px', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          {Object.entries(LEVEL_BADGE).map(([key, badge]) => (
            <span
              key={key}
              title={key === 'E' ? 'Executive' : key === 'M' ? 'Managerial' : 'Operational'}
              style={{
                fontSize: '8px', fontWeight: 700, padding: '2px 5px',
                borderRadius: '3px', fontFamily: 'Space Mono, monospace',
                color: badge.color, border: `1px solid ${badge.color}44`,
                background: `${badge.color}11`, cursor: 'default',
              }}
            >
              {badge.en} {key === 'E' ? 'Exec' : key === 'M' ? 'Mgr' : 'Ops'}
            </span>
          ))}
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Sidebar component
// ─────────────────────────────────────────────────────────────────────────────
export default function Sidebar() {
  const { data: weatherData } = useRealWeather();
  const { activeAlerts: totalAlerts } = computeAlertSummary(weatherData);

  const [location, navigate] = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const { lang } = useLanguage();
  const { theme } = useAppTheme();
  const isMobile = useIsMobile();
  const { open: mobileOpen, close: closeMobile } = useMobileSidebarState();

  const isAdeo = theme === 'adeo-light';
  const isRtl = lang === 'ar';

  const sidebarBg    = isAdeo ? 'rgba(255,255,255,0.97)' : 'rgba(13, 27, 42, 0.97)';
  const borderColor  = isAdeo ? 'rgba(0,51,102,0.15)'    : 'rgba(66,165,245,0.12)';
  const brandBg      = isAdeo ? 'rgba(0,51,102,0.97)'    : 'rgba(10,22,36,0.95)';
  const accentColor  = isAdeo ? '#C8A84B'                : '#42A5F5';
  const textPrimary  = isAdeo ? '#0D1B2A'                : '#E8F4F8';
  const textMuted    = isAdeo ? '#6B7C93'                : '#546E7A';
  const activeBg     = isAdeo ? 'rgba(0,51,102,0.08)'    : 'rgba(66,165,245,0.10)';
  const hoverBg      = isAdeo ? 'rgba(0,51,102,0.05)'    : 'rgba(66,165,245,0.06)';

  const navProps = {
    collapsed: isMobile ? false : collapsed,
    onNavigate: (path: string) => { navigate(path); if (isMobile) closeMobile(); },
    isAdeo, isRtl, lang, totalAlerts,
    sidebarBg, borderColor, brandBg, accentColor,
    textPrimary, textMuted, activeBg, hoverBg, location,
  };

  // ── Mobile: Sheet drawer ──
  if (isMobile) {
    return (
      <Sheet open={mobileOpen} onOpenChange={(v) => { if (!v) closeMobile(); }}>
        <SheetContent
          side={isRtl ? 'right' : 'left'}
          className="p-0 border-0"
          style={{
            width: '260px',
            background: sidebarBg,
            borderLeft:  isRtl ? `1px solid ${borderColor}` : 'none',
            borderRight: isRtl ? 'none' : `1px solid ${borderColor}`,
          }}
        >
          {/* Close button */}
          <button
            onClick={closeMobile}
            style={{
              position: 'absolute',
              top: '14px',
              right: isRtl ? 'auto' : '12px',
              left: isRtl ? '12px' : 'auto',
              zIndex: 10,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: textMuted,
              padding: '4px',
            }}
          >
            <X size={16} />
          </button>
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: sidebarBg }}>
            <NavContent {...navProps} />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // ── Desktop: Fixed sidebar ──
  return (
    <aside
      className="sidebar fixed h-full z-40 flex flex-col transition-all duration-300"
      style={{
        width: collapsed ? '56px' : '210px',
        right: isRtl ? 0 : 'auto',
        left: isRtl ? 'auto' : 0,
        background: sidebarBg,
        borderLeft:  isRtl ? `1px solid ${borderColor}` : 'none',
        borderRight: isRtl ? 'none' : `1px solid ${borderColor}`,
        boxShadow: isRtl ? '-4px 0 32px rgba(0,0,0,0.3)' : '4px 0 32px rgba(0,0,0,0.3)',
        top: 0,
      }}
    >
      <NavContent {...navProps} />

      {/* ── Collapse toggle ── */}
      <div style={{ padding: '8px', borderTop: `1px solid ${borderColor}`, flexShrink: 0 }}>
        <button
          onClick={() => setCollapsed(!collapsed)}
          style={{
            width: '100%', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: textMuted, borderRadius: '4px', transition: 'all 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = hoverBg}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
        >
          {isRtl
            ? (collapsed ? <ChevronLeft size={16} /> : <ChevronRight size={16} />)
            : (collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />)
          }
        </button>
      </div>
    </aside>
  );
}
