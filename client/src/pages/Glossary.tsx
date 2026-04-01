/**
 * Glossary.tsx — الفهرس التعريفي الشامل
 * يشرح كل مؤشر وطريقة احتسابه والعتبات المستخدمة
 */

import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { EXPLAINERS, type ExplainerKey } from '@/components/ExplainerTooltip';
import {
  BookOpen, Calculator, AlertTriangle, Database,
  Search, ChevronDown, ChevronUp, Activity, Droplets,
  Thermometer, Bell, Mountain, Layers, TrendingUp,
  Satellite, Clock, BarChart3
} from 'lucide-react';

// ── تصنيفات المؤشرات ──────────────────────────────────────────────────────────
const CATEGORIES = [
  {
    id: 'risk',
    titleAr: 'مؤشرات الخطر والتنبيه',
    titleEn: 'Risk & Alert Indicators',
    icon: AlertTriangle,
    color: '#FF6B35',
    items: ['floodRiskIndex', 'activeAlerts', 'alertLevel', 'floodRisk37'] as ExplainerKey[],
  },
  {
    id: 'weather',
    titleAr: 'مؤشرات الطقس والهطول',
    titleEn: 'Weather & Precipitation',
    icon: Droplets,
    color: '#42A5F5',
    items: ['currentPrecip', 'maxRainfall24h', 'totalLast24h', 'precipitation48h', 'avgTemperature', 'forecastProbability'] as ExplainerKey[],
  },
  {
    id: 'terrain',
    titleAr: 'مؤشرات التضاريس والتربة',
    titleEn: 'Terrain & Soil Indicators',
    icon: Mountain,
    color: '#4DD0E1',
    items: ['demElevation', 'slopeAngle', 'drainageCapacity', 'soilSaturation'] as ExplainerKey[],
  },
  {
    id: 'system',
    titleAr: 'مؤشرات النظام والتغطية',
    titleEn: 'System & Coverage',
    icon: Satellite,
    color: '#43A047',
    items: ['coverageArea', 'satCoverage', 'modelAccuracy', 'updateInterval'] as ExplainerKey[],
  },
];

const GEO = {
  bg:        '#0D1B2A',
  bgCard:    'rgba(21,34,51,0.88)',
  bgCardHov: 'rgba(28,44,64,0.95)',
  border:    'rgba(66,165,245,0.12)',
  blue:      '#42A5F5',
  teal:      '#4DD0E1',
  green:     '#43A047',
  amber:     '#FFB300',
  red:       '#FF6B35',
  text:      '#E8F4F8',
  textSub:   '#90CAF9',
  textMuted: '#546E7A',
  fontHead:  'Playfair Display, Georgia, serif',
  fontMono:  'Space Mono, Courier New, monospace',
  fontAr:    'Noto Naskh Arabic, serif',
};

function MetricCard({ id, isExpanded, onToggle }: { id: ExplainerKey; isExpanded: boolean; onToggle: () => void }) {
  const { lang } = useLanguage();
  const isRtl = lang === 'ar';
  const data = EXPLAINERS[id];
  if (!data) return null;

  const title = isRtl ? data.titleAr : data.titleEn;
  const definition = isRtl ? data.definitionAr : data.definitionEn;
  const formula = isRtl ? data.formulaAr : data.formulaEn;
  const source = isRtl ? data.sourceAr : data.sourceEn;
  const unit = isRtl ? data.unitAr : data.unitEn;

  return (
    <div style={{
      background: GEO.bgCard,
      border: `1px solid ${isExpanded ? 'rgba(66,165,245,0.30)' : GEO.border}`,
      borderRadius: '6px',
      overflow: 'hidden',
      transition: 'all 0.2s',
    }}>
      {/* Card Header — clickable */}
      <button
        onClick={onToggle}
        style={{
          width: '100%', padding: '14px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'none', border: 'none', cursor: 'pointer',
          textAlign: isRtl ? 'right' : 'left',
          direction: isRtl ? 'rtl' : 'ltr',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '4px',
            background: 'rgba(66,165,245,0.10)', border: '1px solid rgba(66,165,245,0.20)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <BookOpen size={14} color={GEO.blue} />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '14px', color: GEO.text, fontFamily: isRtl ? GEO.fontAr : GEO.fontHead }}>
              {title}
            </div>
            {unit && (
              <span style={{
                fontSize: '9px', padding: '1px 6px', borderRadius: '3px', marginTop: '3px', display: 'inline-block',
                background: 'rgba(66,165,245,0.12)', color: GEO.blue,
                fontFamily: GEO.fontMono,
              }}>{unit}</span>
            )}
          </div>
        </div>
        <div style={{ color: GEO.textMuted, flexShrink: 0 }}>
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {/* Short definition always visible */}
      <div style={{ padding: '0 16px 12px', direction: isRtl ? 'rtl' : 'ltr' }}>
        <p style={{ fontSize: '12px', color: GEO.textSub, lineHeight: 1.6, margin: 0, fontFamily: isRtl ? GEO.fontAr : 'Inter, sans-serif' }}>
          {definition}
        </p>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div style={{
          borderTop: `1px solid ${GEO.border}`,
          padding: '14px 16px',
          display: 'flex', flexDirection: 'column', gap: '14px',
          direction: isRtl ? 'rtl' : 'ltr',
        }}>
          {/* Formula */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
              <Calculator size={12} color={GEO.teal} />
              <span style={{ fontSize: '11px', color: GEO.teal, fontFamily: GEO.fontMono, letterSpacing: '0.06em', fontWeight: 700 }}>
                {isRtl ? 'طريقة الاحتساب' : 'HOW IT\'S CALCULATED'}
              </span>
            </div>
            <pre style={{
              fontSize: isRtl ? '12px' : '11px',
              color: '#90CAF9',
              lineHeight: 1.8,
              margin: 0,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              background: 'rgba(66,165,245,0.05)',
              borderRadius: '4px',
              padding: '10px 12px',
              border: '1px solid rgba(66,165,245,0.10)',
              fontFamily: isRtl ? GEO.fontAr : GEO.fontMono,
            }}>{formula}</pre>
          </div>

          {/* Thresholds */}
          {data.thresholds && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <AlertTriangle size={12} color={GEO.amber} />
                <span style={{ fontSize: '11px', color: GEO.amber, fontFamily: GEO.fontMono, letterSpacing: '0.06em', fontWeight: 700 }}>
                  {isRtl ? 'مستويات التصنيف والعتبات' : 'CLASSIFICATION LEVELS & THRESHOLDS'}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '8px' }}>
                {data.thresholds.map((t, i) => (
                  <div key={i} style={{
                    padding: '10px 12px',
                    borderRadius: '4px',
                    background: `${t.color}0D`,
                    border: `1px solid ${t.color}30`,
                    display: 'flex', flexDirection: 'column', gap: '4px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 700, fontSize: '13px', color: t.color, fontFamily: isRtl ? GEO.fontAr : GEO.fontHead }}>
                        {isRtl ? t.label : t.labelEn}
                      </span>
                      <span style={{
                        fontSize: '10px', color: t.color, fontFamily: GEO.fontMono,
                        background: `${t.color}20`, padding: '1px 6px', borderRadius: '3px',
                      }}>{t.value}</span>
                    </div>
                    <p style={{ fontSize: '11px', color: GEO.textSub, lineHeight: 1.5, margin: 0, fontFamily: isRtl ? GEO.fontAr : 'Inter, sans-serif' }}>
                      {isRtl ? t.descAr : t.descEn}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Source */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            paddingTop: '8px', borderTop: `1px solid ${GEO.border}`,
          }}>
            <Database size={11} color={GEO.textMuted} />
            <span style={{ fontSize: '11px', color: GEO.textMuted, fontFamily: GEO.fontMono }}>
              {isRtl ? 'المصدر: ' : 'Source: '}{source}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Glossary() {
  const { lang } = useLanguage();
  const isRtl = lang === 'ar';
  const [search, setSearch] = useState('');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const toggleItem = (id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    const allIds = CATEGORIES.flatMap(c => c.items);
    setExpandedItems(new Set(allIds));
  };

  const collapseAll = () => setExpandedItems(new Set());

  // Filter by search
  const filteredCategories = CATEGORIES.map(cat => ({
    ...cat,
    items: cat.items.filter(id => {
      if (!search) return true;
      const data = EXPLAINERS[id];
      if (!data) return false;
      const q = search.toLowerCase();
      return (
        data.titleAr.includes(q) ||
        data.titleEn.toLowerCase().includes(q) ||
        data.definitionAr.includes(q) ||
        data.definitionEn.toLowerCase().includes(q)
      );
    }),
  })).filter(cat => (activeCategory ? cat.id === activeCategory : true) && cat.items.length > 0);

  const totalItems = CATEGORIES.reduce((sum, c) => sum + c.items.length, 0);

  return (
    <div style={{
      minHeight: '100vh',
      background: GEO.bg,
      color: GEO.text,
      direction: isRtl ? 'rtl' : 'ltr',
      fontFamily: isRtl ? GEO.fontAr : 'Inter, sans-serif',
      padding: '24px',
    }}>
      {/* Header */}
      <div style={{
        marginBottom: '28px',
        borderBottom: `1px solid ${GEO.border}`,
        paddingBottom: '20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '6px',
            background: 'linear-gradient(135deg, #1565C0, #42A5F5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <BookOpen size={20} color="#fff" />
          </div>
          <div>
            <h1 style={{
              fontFamily: isRtl ? GEO.fontAr : GEO.fontHead,
              fontSize: '24px', fontWeight: 700, color: GEO.text, margin: 0,
            }}>
              {isRtl ? 'الفهرس التعريفي' : 'Indicator Glossary'}
            </h1>
            <p style={{ fontSize: '13px', color: GEO.textMuted, margin: '2px 0 0', fontFamily: GEO.fontMono }}>
              {isRtl
                ? `${totalItems} مؤشر · طريقة الاحتساب · العتبات · المصادر`
                : `${totalItems} indicators · Calculation methods · Thresholds · Sources`}
            </p>
          </div>
        </div>

        {/* Description */}
        <div style={{
          background: 'rgba(66,165,245,0.06)',
          border: '1px solid rgba(66,165,245,0.15)',
          borderRadius: '6px',
          padding: '12px 16px',
          marginTop: '16px',
        }}>
          <p style={{ fontSize: '13px', color: GEO.textSub, lineHeight: 1.7, margin: 0 }}>
            {isRtl
              ? 'هذا الفهرس يشرح جميع المؤشرات والأرقام المستخدمة في منصة FloodSat AI. لكل مؤشر: تعريف واضح، طريقة الاحتساب بالتفصيل، مستويات التصنيف والعتبات، ومصدر البيانات. يمكنك أيضاً الاطلاع على هذه المعلومات مباشرةً بوضع مؤشر الفأرة على أي رقم في لوحة التحكم.'
              : 'This glossary explains all indicators and numbers used in the FloodSat AI platform. Each indicator includes: a clear definition, detailed calculation method, classification levels and thresholds, and data source. You can also access this information directly by hovering over any number in the dashboard.'}
          </p>
        </div>
      </div>

      {/* Controls */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: '12px',
        marginBottom: '20px', alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1', minWidth: '200px', maxWidth: '360px' }}>
          <Search size={14} color={GEO.textMuted} style={{
            position: 'absolute',
            [isRtl ? 'right' : 'left']: '12px',
            top: '50%', transform: 'translateY(-50%)',
          }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={isRtl ? 'ابحث عن مؤشر...' : 'Search indicators...'}
            style={{
              width: '100%', padding: isRtl ? '8px 36px 8px 12px' : '8px 12px 8px 36px',
              background: 'rgba(21,34,51,0.88)',
              border: `1px solid ${GEO.border}`,
              borderRadius: '4px',
              color: GEO.text,
              fontSize: '13px',
              fontFamily: isRtl ? GEO.fontAr : 'Inter, sans-serif',
              outline: 'none',
              direction: isRtl ? 'rtl' : 'ltr',
            }}
          />
        </div>

        {/* Category filters */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setActiveCategory(null)}
            style={{
              padding: '5px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px',
              fontFamily: GEO.fontMono, fontWeight: 600, letterSpacing: '0.04em',
              background: !activeCategory ? 'rgba(66,165,245,0.20)' : 'rgba(21,34,51,0.88)',
              border: `1px solid ${!activeCategory ? 'rgba(66,165,245,0.40)' : GEO.border}`,
              color: !activeCategory ? GEO.blue : GEO.textMuted,
            }}
          >
            {isRtl ? 'الكل' : 'ALL'}
          </button>
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)}
              style={{
                padding: '5px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px',
                fontFamily: GEO.fontMono, fontWeight: 600, letterSpacing: '0.04em',
                background: activeCategory === cat.id ? `${cat.color}20` : 'rgba(21,34,51,0.88)',
                border: `1px solid ${activeCategory === cat.id ? `${cat.color}50` : GEO.border}`,
                color: activeCategory === cat.id ? cat.color : GEO.textMuted,
                display: 'flex', alignItems: 'center', gap: '5px',
              }}
            >
              <cat.icon size={11} />
              {isRtl ? cat.titleAr.split(' ')[0] : cat.titleEn.split(' ')[0]}
            </button>
          ))}
        </div>

        {/* Expand/Collapse all */}
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={expandAll}
            style={{
              padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px',
              fontFamily: GEO.fontMono, background: 'rgba(21,34,51,0.88)',
              border: `1px solid ${GEO.border}`, color: GEO.textMuted,
            }}
          >
            {isRtl ? 'توسيع الكل' : 'Expand All'}
          </button>
          <button
            onClick={collapseAll}
            style={{
              padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px',
              fontFamily: GEO.fontMono, background: 'rgba(21,34,51,0.88)',
              border: `1px solid ${GEO.border}`, color: GEO.textMuted,
            }}
          >
            {isRtl ? 'طي الكل' : 'Collapse All'}
          </button>
        </div>
      </div>

      {/* Categories */}
      {filteredCategories.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: GEO.textMuted }}>
          <Search size={32} style={{ marginBottom: '12px', opacity: 0.4 }} />
          <p style={{ fontFamily: GEO.fontMono, fontSize: '13px' }}>
            {isRtl ? 'لا توجد نتائج للبحث' : 'No results found'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          {filteredCategories.map(cat => (
            <div key={cat.id}>
              {/* Category Header */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                marginBottom: '14px',
                paddingBottom: '10px',
                borderBottom: `2px solid ${cat.color}30`,
              }}>
                <div style={{
                  width: '28px', height: '28px', borderRadius: '4px',
                  background: `${cat.color}15`, border: `1px solid ${cat.color}30`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <cat.icon size={14} color={cat.color} />
                </div>
                <h2 style={{
                  fontFamily: isRtl ? GEO.fontAr : GEO.fontHead,
                  fontSize: '16px', fontWeight: 700, color: cat.color, margin: 0,
                }}>
                  {isRtl ? cat.titleAr : cat.titleEn}
                </h2>
                <span style={{
                  fontSize: '10px', padding: '1px 8px', borderRadius: '10px',
                  background: `${cat.color}15`, color: cat.color,
                  fontFamily: GEO.fontMono,
                }}>
                  {cat.items.length} {isRtl ? 'مؤشر' : 'indicators'}
                </span>
              </div>

              {/* Items Grid */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {cat.items.map(id => (
                  <MetricCard
                    key={id}
                    id={id}
                    isExpanded={expandedItems.has(id)}
                    onToggle={() => toggleItem(id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div style={{
        marginTop: '40px', paddingTop: '20px',
        borderTop: `1px solid ${GEO.border}`,
        display: 'flex', alignItems: 'center', gap: '8px',
        color: GEO.textMuted,
      }}>
        <Database size={12} />
        <span style={{ fontSize: '11px', fontFamily: GEO.fontMono }}>
          {isRtl
            ? 'المصادر الرئيسية: Open-Meteo ERA5 · NASA SRTM · ESA Copernicus · OpenStreetMap · بيانات ميدانية 2011–2024'
            : 'Primary sources: Open-Meteo ERA5 · NASA SRTM · ESA Copernicus · OpenStreetMap · Field data 2011–2024'}
        </span>
      </div>
    </div>
  );
}
