// FieldValidationPage.tsx — FloodSat AI
// Design: Dual-theme (Dark Tech + ADEO Light) · Bilingual (AR/EN)
// Purpose: Field validation reports comparing model predictions vs ground truth

import { useState, useMemo, useRef, useCallback } from 'react';
import InfoTooltip from '@/components/InfoTooltip';

const FV_TOOLTIPS = {
  currentAccuracy: {
    title: 'Current Model Accuracy',
    unit: '%',
    description: 'Percentage match of model predictions with documented field reality. Calculated by comparing model classificationel (Dry/Wet/Flooded) with actual field-monitored status from verification team.',
    source: 'Reports Documented field verification',
    normalRange: '75% — 95%',
    updateFreq: 'With each field round',
    color: '#EF4444',
  },
  improvedAccuracy: {
    title: 'Post-Improvement Accuracy',
    unit: '%',
    description: 'Projected accuracy after applying all improvement recommendations: Update DEM + Add field data + adjust drainage coefficients + model temporal delay.',
    source: 'Gradual improvement model estimate',
    normalRange: '85% — 98%',
    updateFreq: 'After each improvement cycle',
    color: '#10B981',
  },
  modelAccuracy: {
    title: 'Model accuracy for this report',
    unit: '%',
    description: 'Model match percentage for this region specifically. Includes Classification Accuracy (50%) + Depth Accuracypth (Error < 5cm = 100%) + Timing Accuracy (Error < 2hr = 100%). Weighted average of the three.',
    source: 'Comparison of model data with field reports',
    normalRange: '> 80%',
    updateFreq: 'With each field report',
    color: '#F59E0B',
  },
  depthGap: {
    title: 'Depth Difference',
    unit: 'cm',
    description: 'Difference between actual field-measured water depth and model-forecasted depth. Positive gap = model underestimates. Negative gap = model overestimates.',
    source: 'Live field measurement with depth sensor',
    normalRange: '< 5 cm',
    updateFreq: 'With each field round',
    color: '#EF4444',
  },
};
import {
  CheckCircle, AlertTriangle, XCircle, MapPin, Clock,
  Camera, TrendingUp, Layers, FileText, Target, BarChart2,
  Plus, ExternalLink, Activity, Zap, ChevronRight, FileDown,
  Upload, X, RefreshCw, Scan, CheckCircle2, AlertCircle, ImageIcon
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAppTheme } from '@/contexts/ThemeContext';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────
type FloodStatus = 'flooded' | 'wet' | 'dry';
type GapType = 'time_lag' | 'intensity_error' | 'location_error';

interface FieldReport {
  id: string;
  titleAr: string;
  titleEn: string;
  locationAr: string;
  locationEn: string;
  coords: { lat: number; lng: number };
  timestamp: string;
  reporterAr: string;
  reporterEn: string;
  fieldStatus: FloodStatus;
  modelStatus: FloodStatus;
  waterDepth_cm: number;
  modelDepth_cm: number;
  accuracy: number;
  correctedAccuracy: number;
  gap: GapType;
  gapNoteAr: string;
  gapNoteEn: string;
  trafficImpactAr: string;
  trafficImpactEn: string;
  dimensions: {
    topographyAr: string; topographyEn: string;
    drainageAr: string;   drainageEn: string;
    precipAr: string;     precipEn: string;
    soilAr: string;       soilEn: string;
  };
  recommendationsAr: string[];
  recommendationsEn: string[];
}

// ─── Data ─────────────────────────────────────────────────────────────────────
const REPORTS: FieldReport[] = [
  {
    id: 'FR-001',
    titleAr: 'South Al Shamkha — Road E11',
    titleEn: 'South Al Shamkha — E11 Road',
    locationAr: 'South Al Shamkha, Abu Dhabi',
    locationEn: 'South Al Shamkha, Abu Dhabi',
    coords: { lat: 24.5235, lng: 54.3891 },
    timestamp: '2026-03-23T07:30:00',
    reporterAr: 'Team Field Monitoring A',
    reporterEn: 'Field Monitoring Team A',
    fieldStatus: 'wet',
    modelStatus: 'dry',
    waterDepth_cm: 8,
    modelDepth_cm: 0,
    accuracy: 42,
    correctedAccuracy: 78,
    gap: 'time_lag',
    gapNoteAr: 'Rain fell 12 hours ago and road is still wet — model did not account for drainage lag',
    gapNoteEn: 'Rain fell 12 hours ago, road still wet — model did not account for drainage lag',
    trafficImpactAr: 'Notable slowdown',
    trafficImpactEn: 'Noticeable slowdown',
    dimensions: {
      topographyAr: 'Relatively low region (height 8m) — normal water accumulation',
      topographyEn: 'Relatively low area (8m elevation) — natural water accumulation',
      drainageAr: 'Old drainage network at 40% of required capacity',
      drainageEn: 'Old drainage network at 40% required capacity',
      precipAr: '4.3 mm Last 6 hours — 15.2 mm Last 12 hour',
      precipEn: '4.3mm last 6h — 15.2mm last 12h',
      soilAr: 'SFull saturation — no additional absorption',
      soilEn: 'Fully saturated — no additional absorption',
    },
    recommendationsAr: [
      'Add drainage lag coefficient (6-18 hours) to model',
      'Connect actual drainage network data from Abu Dhabi Municipality',
      'Update topographic depression map with 5m accuracy',
    ],
    recommendationsEn: [
      'Add drainage lag factor (6-18 hours) to the model',
      'Integrate actual drainage network data from Abu Dhabi Municipality',
      'Update topographic depression map at 5m resolution',
    ],
  },
  {
    id: 'FR-002',
    titleAr: 'Al Shamkha Area — Parking Lot',
    titleEn: 'Al Shamkha Mall — Parking Lot',
    locationAr: 'Al Shamkha Area, Abu Dhabi',
    locationEn: 'Al Shamkha Mall, Abu Dhabi',
    coords: { lat: 24.387203, lng: 54.723679 },
    timestamp: '2026-03-23T09:20:00',
    reporterAr: 'Team Field Monitoring B',
    reporterEn: 'Field Monitoring Team B',
    fieldStatus: 'flooded',
    modelStatus: 'wet',
    waterDepth_cm: 15,
    modelDepth_cm: 5,
    accuracy: 35,
    correctedAccuracy: 82,
    gap: 'intensity_error',
    gapNoteAr: 'Model underestimated depth by 10 cm — parking area accumulated water',
    gapNoteEn: 'Model underestimated depth by 10cm — parking lot area amplifies accumulation',
    trafficImpactAr: 'Partial stoppage',
    trafficImpactEn: 'Partial stoppage',
    dimensions: {
      topographyAr: 'Flat parking lot surrounded by barriers — acts as collection basin',
      topographyEn: 'Flat parking lot surrounded by barriers — acts as collection basin',
      drainageAr: 'Insufficient drains for parking area (12,000 m²)',
      drainageEn: 'Insufficient drains for parking area (12,000 m²)',
      precipAr: '0 mm currently — 22 mm during the past 24 hours',
      precipEn: '0mm now — 22mm in last 24 hours',
      soilAr: 'Asphalt surface — zero absorption',
      soilEn: 'Asphalt surface — zero absorption',
    },
    recommendationsAr: [
      'Add modeling of closed asphalt surfaces as accumulation zones',
      'Upload high-accuracy DEM for parking and commercial areas',
      'Add parking drain data to drainage model',
    ],
    recommendationsEn: [
      'Add closed asphalt surface modeling as accumulation zones',
      'Increase DEM resolution in parking and commercial complex areas',
      'Add parking drain data to the drainage model',
    ],
  },
];

// ─── Config ───────────────────────────────────────────────────────────────────
const STATUS_CFG: Record<FloodStatus, { labelAr: string; labelEn: string; color: string; darkBg: string; lightBg: string; Icon: typeof CheckCircle }> = {
  flooded: { labelAr: 'Flooded',              labelEn: 'Flooded',   color: '#EF4444', darkBg: 'rgba(239,68,68,0.12)',   lightBg: '#FEF2F2', Icon: XCircle },
  wet:     { labelAr: 'Wet / Water Accumulating', labelEn: 'Wet/Pooled', color: '#F59E0B', darkBg: 'rgba(245,158,11,0.12)', lightBg: '#FFFBEB', Icon: AlertTriangle },
  dry:     { labelAr: 'Dry',               labelEn: 'Dry',        color: '#10B981', darkBg: 'rgba(16,185,129,0.12)',  lightBg: '#F0FDF4', Icon: CheckCircle },
};

const GAP_CFG: Record<GapType, { labelAr: string; labelEn: string; color: string }> = {
  time_lag:        { labelAr: 'Temporal Gap',  labelEn: 'Time Lag',        color: '#3B82F6' },
  intensity_error: { labelAr: 'Intensity Error', labelEn: 'Intensity Error', color: '#F59E0B' },
  location_error:  { labelAr: 'Location Error',   labelEn: 'Location Error',  color: '#8B5CF6' },
};

// ─── Accuracy Arc SVG ─────────────────────────────────────────────────────────
function AccuracyArc({ value, color, size = 80 }: { value: number; color: string; size?: number }) {
  const r = size * 0.38;
  const cx = size / 2, cy = size / 2;
  const circ = 2 * Math.PI * r;
  const dash = (value / 100) * circ * 0.75;
  const offset = circ * 0.125;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(148,163,184,0.15)" strokeWidth={size * 0.075}
        strokeDasharray={`${circ * 0.75} ${circ * 0.25}`}
        strokeDashoffset={-offset}
        strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={size * 0.075}
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeDashoffset={-offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.8s ease' }} />
      <text x={cx} y={cy + 4} textAnchor="middle" fontSize={size * 0.2} fontWeight="800" fill={color} fontFamily="Space Mono">
        {value}%
      </text>
    </svg>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function FieldValidationPage() {
  const { lang } = useLanguage();
  const { theme } = useAppTheme();
  const isDark = theme !== 'adeo-light';
  const isRtl = lang === 'ar';

  const [selectedId, setSelectedId] = useState('FR-001');
  const [tab, setTab] = useState<'overview' | 'dimensions' | 'recommendations' | 'camera'>('overview');

  const report = REPORTS.find(r => r.id === selectedId)!;
  const fieldCfg = STATUS_CFG[report.fieldStatus];
  const modelCfg = STATUS_CFG[report.modelStatus];
  const gapCfg   = GAP_CFG[report.gap];

  const avgAccuracy = Math.round(REPORTS.reduce((s, r) => s + r.accuracy, 0) / REPORTS.length);
  const avgCorrected = Math.round(REPORTS.reduce((s, r) => s + r.correctedAccuracy, 0) / REPORTS.length);

  // ─── Camera State ──────────────────────────────────────────────────────────
  const [cameraMode, setCameraMode] = useState<'idle' | 'live' | 'captured' | 'uploaded' | 'analyzing' | 'done'>('idle');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<{
    status: 'flooded' | 'wet' | 'dry';
    confidence: number;
    waterDepth: number;
    notes: string[];
  } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraMode('idle');
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraMode('live');
    } catch {
      alert(isRtl ? 'Cannot access camera. Please allow camera permission.' : 'Camera access denied. Please allow camera permission.');
    }
  }, [isRtl]);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const v = videoRef.current;
    const c = canvasRef.current;
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext('2d')?.drawImage(v, 0, 0);
    const dataUrl = c.toDataURL('image/jpeg', 0.85);
    setCapturedImage(dataUrl);
    stopCamera();
    setCameraMode('captured');
  }, [stopCamera]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      setCapturedImage(ev.target?.result as string);
      setCameraMode('uploaded');
    };
    reader.readAsDataURL(file);
  }, []);

  const analyzeImage = useCallback(async () => {
    setCameraMode('analyzing');
    // Simulate AI analysis (2 seconds)
    await new Promise(r => setTimeout(r, 2200));
    // Generate realistic analysis based on selected report
    const statusMap: Record<FloodStatus, { status: FloodStatus; confidence: number; waterDepth: number; notes: string[] }> = {
      flooded: { status: 'flooded', confidence: 91, waterDepth: report.waterDepth_cm, notes: [
        isRtl ? 'Standing water detected covering the entire road' : 'Standing water detected covering the entire road',
        isRtl ? 'Estimated water depth: ' + report.waterDepth_cm + ' cm' : 'Estimated water depth: ' + report.waterDepth_cm + ' cm',
        isRtl ? 'Road closure recommended immediately' : 'Road closure recommended immediately',
      ]},
      wet: { status: 'wet', confidence: 87, waterDepth: report.waterDepth_cm, notes: [
        isRtl ? 'Wet road surface with minor water pooling' : 'Wet road surface with minor water pooling',
        isRtl ? 'Estimated water depth: ' + report.waterDepth_cm + ' cm' : 'Estimated water depth: ' + report.waterDepth_cm + ' cm',
        isRtl ? 'Reduce speed and proceed with caution' : 'Reduce speed and proceed with caution',
      ]},
      dry: { status: 'dry', confidence: 94, waterDepth: 0, notes: [
        isRtl ? 'Dry road surface — no visible water' : 'Dry road surface — no visible water',
        isRtl ? 'No current flood risk detected' : 'No current flood risk detected',
        isRtl ? 'Status Normal — No Procedure required' : 'Normal conditions — no action required',
      ]},
    };
    setAnalysisResult(statusMap[report.fieldStatus]);
    setCameraMode('done');
  }, [report, isRtl]);

  const resetCamera = useCallback(() => {
    setCapturedImage(null);
    setAnalysisResult(null);
    setCameraMode('idle');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  // Theme colors
  const bg = isDark ? '#0D1B2A' : '#F8FAFC';
  const bgCard = isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF';
  const bgCardBorder = isDark ? 'rgba(255,255,255,0.08)' : '#E5E7EB';
  const textPrimary = isDark ? '#E8F4F8' : '#111827';
  const textSecondary = isDark ? '#94A3B8' : '#6B7280';
  const textMuted = isDark ? '#546E7A' : '#9CA3AF';
  const accentBlue = isDark ? '#60A5FA' : '#1B4F8A';
  const sidebarBg = isDark ? 'rgba(255,255,255,0.03)' : '#FFFFFF';
  const headerBg = isDark ? 'rgba(13,27,42,0.95)' : '#FFFFFF';
  const activeCardBg = isDark ? 'rgba(96,165,250,0.08)' : '#EFF6FF';
  const activeCardBorder = isDark ? '#60A5FA' : '#1B4F8A';

  // Radar data for selected report
  const radarData = [
    { dim: isRtl ? 'Topography' : 'Topography', model: 30, reality: 80 },
    { dim: isRtl ? 'drainage' : 'Drainage', model: 40, reality: 75 },
    { dim: isRtl ? 'Precipitation' : 'Precipitation', model: 70, reality: 85 },
    { dim: isRtl ? 'Soil' : 'Soil', model: 20, reality: 90 },
    { dim: isRtl ? 'accuracy' : 'Accuracy', model: report.accuracy, reality: report.correctedAccuracy },
  ];

  // Comparison bar data
  const barData = REPORTS.map(r => ({
    name: r.id,
    [isRtl ? 'Current' : 'Current']: r.accuracy,
    [isRtl ? 'Improved' : 'Improved']: r.correctedAccuracy,
  }));

  const t = (ar: string, en: string) => isRtl ? ar : en;

  return (
    <div style={{ background: bg, color: textPrimary, minHeight: '100vh', direction: isRtl ? 'rtl' : 'ltr', fontFamily: isRtl ? "'Noto Naskh Arabic', serif" : "'Inter', sans-serif" }}>

      {/* ── Sticky Header ─────────────────────────────────────────────────────── */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: headerBg, borderBottom: `1px solid ${bgCardBorder}`, padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backdropFilter: 'blur(12px)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: isDark ? 'linear-gradient(135deg, #1565C0, #42A5F5)' : 'linear-gradient(135deg, #003366, #1B4F8A)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Target size={16} color="white" />
            </div>
            <h1 style={{ fontSize: '18px', fontWeight: 800, color: textPrimary, margin: 0 }}>
              {t('Verification Field', 'Field Validation')}
            </h1>
          </div>
          <p style={{ fontSize: '12px', color: textMuted, margin: 0 }}>
            {t('Comparison of model readings vs field reality', 'Model predictions vs ground truth comparison')}
          </p>
        </div>
        <button
          onClick={() => window.print()}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '7px 14px',
            background: 'rgba(139,92,246,0.10)',
            border: '1px solid rgba(139,92,246,0.30)',
            borderRadius: '8px',
            cursor: 'pointer',
            color: '#A78BFA',
            fontSize: '11px',
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          <FileDown size={12} />
          {t('Export PDF', 'Export PDF')}
        </button>

        {/* Accuracy Summary */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#EF4444', fontFamily: 'Space Mono', lineHeight: 1 }}>{avgAccuracy}%</div>
            <div style={{ fontSize: '10px', color: textMuted, marginTop: '2px' }}>{t('Current Accuracy', 'Current Accuracy')}</div>
          </div>
          <div style={{ color: textMuted, fontSize: '20px' }}>→</div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#10B981', fontFamily: 'Space Mono', lineHeight: 1 }}>{avgCorrected}%</div>
            <div style={{ fontSize: '10px', color: textMuted, marginTop: '2px' }}>{t('After Improvement', 'After Improvement')}</div>
          </div>
          <div style={{ width: '1px', height: '40px', background: bgCardBorder }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 800, color: accentBlue, fontFamily: 'Space Mono', lineHeight: 1 }}>{REPORTS.length}</div>
            <div style={{ fontSize: '10px', color: textMuted, marginTop: '2px' }}>{t('Reports', 'Reports')}</div>
          </div>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────────── */}
      <div style={{ padding: '20px 24px', display: 'grid', gridTemplateColumns: '300px 1fr', gap: '20px' }}>

        {/* ── Left: Report List ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* Summary Card */}
          <div style={{ borderRadius: '12px', padding: '18px', background: isDark ? 'linear-gradient(135deg, rgba(21,101,192,0.3), rgba(66,165,245,0.15))' : 'linear-gradient(135deg, #003366, #1B4F8A)', border: `1px solid ${isDark ? 'rgba(66,165,245,0.3)' : 'transparent'}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <Activity size={15} color={isDark ? '#60A5FA' : '#93C5FD'} />
              <span style={{ fontSize: '13px', fontWeight: 700, color: isDark ? '#E8F4F8' : '#FFFFFF' }}>
                {t('Summary accuracy', 'Accuracy Summary')}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', textAlign: 'center' }}>
              {[
                { val: `${avgAccuracy}%`, labelAr: 'Current', labelEn: 'Current', color: '#FCA5A5', tip: FV_TOOLTIPS.currentAccuracy },
                { val: `${avgCorrected}%`, labelAr: 'Improved', labelEn: 'Improved', color: '#86EFAC', tip: FV_TOOLTIPS.improvedAccuracy },
                { val: `${REPORTS.length}`, labelAr: 'Reports', labelEn: 'Reports', color: '#FDE68A', tip: null },
              ].map(item => (
                <div key={item.labelAr} style={{ position: 'relative' }}>
                  {item.tip && (
                    <div style={{ position: 'absolute', top: 0, right: 0 }}>
                      <InfoTooltip content={{ ...item.tip, value: item.val }} size="sm" />
                    </div>
                  )}
                  <div style={{ fontSize: '22px', fontWeight: 800, color: item.color, fontFamily: 'Space Mono', lineHeight: 1 }}>{item.val}</div>
                  <div style={{ fontSize: '10px', marginTop: '3px', color: isDark ? '#93C5FD' : '#BFDBFE' }}>{isRtl ? item.labelAr : item.labelEn}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Comparison Mini Chart */}
          <div style={{ background: bgCard, border: `1px solid ${bgCardBorder}`, borderRadius: '12px', padding: '14px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: textSecondary, marginBottom: '10px' }}>
              {t('Comparison accuracy', 'Accuracy Comparison')}
            </div>
            <ResponsiveContainer width="100%" height={80}>
              <BarChart data={barData} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: textMuted }} />
                <YAxis tick={{ fontSize: 9, fill: textMuted }} domain={[0, 100]} />
                <Tooltip contentStyle={{ background: isDark ? '#0D1B2A' : '#fff', border: `1px solid ${bgCardBorder}`, borderRadius: '6px', fontSize: '11px' }} />
                <Bar dataKey={isRtl ? 'Current' : 'Current'} fill="#EF4444" radius={[3, 3, 0, 0]} />
                <Bar dataKey={isRtl ? 'Improved' : 'Improved'} fill="#10B981" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Report Cards */}
          {REPORTS.map(r => {
            const fc = STATUS_CFG[r.fieldStatus];
            const gc = GAP_CFG[r.gap];
            const isActive = r.id === selectedId;
            return (
              <button
                key={r.id}
                onClick={() => { setSelectedId(r.id); setTab('overview'); }}
                style={{
                  width: '100%', textAlign: isRtl ? 'right' : 'left',
                  background: isActive ? activeCardBg : bgCard,
                  border: `1.5px solid ${isActive ? activeCardBorder : bgCardBorder}`,
                  borderRadius: '12px', padding: '14px',
                  cursor: 'pointer', transition: 'all 0.2s',
                  position: 'relative', overflow: 'hidden',
                }}
              >
                {/* Active indicator */}
                {isActive && (
                  <div style={{ position: 'absolute', top: 0, right: isRtl ? 0 : 'auto', left: isRtl ? 'auto' : 0, width: '3px', height: '100%', background: accentBlue, borderRadius: '12px 0 0 12px' }} />
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', background: isDark ? 'rgba(96,165,250,0.15)' : '#1B4F8A', color: isDark ? '#60A5FA' : '#fff' }}>
                    {r.id}
                  </span>
                  <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '6px', background: `${gc.color}18`, color: gc.color, fontWeight: 500 }}>
                    {isRtl ? gc.labelAr : gc.labelEn}
                  </span>
                </div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: textPrimary, marginBottom: '6px' }}>
                  {isRtl ? r.titleAr : r.titleEn}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: textMuted, marginBottom: '10px' }}>
                  <MapPin size={10} />
                  <span>{isRtl ? r.locationAr : r.locationEn}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '10px' }}>
                  <div style={{ borderRadius: '8px', padding: '8px', background: isDark ? fc.darkBg : fc.lightBg, border: `1px solid ${fc.color}30` }}>
                    <div style={{ fontSize: '9px', color: textMuted, marginBottom: '2px' }}>{t('Reality', 'Reality')}</div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: fc.color }}>{isRtl ? fc.labelAr : fc.labelEn}</div>
                  </div>
                  <div style={{ borderRadius: '8px', padding: '8px', background: isDark ? modelCfg.darkBg : modelCfg.lightBg, border: `1px solid ${STATUS_CFG[r.modelStatus].color}30` }}>
                    <div style={{ fontSize: '9px', color: textMuted, marginBottom: '2px' }}>{t('the model', 'Model')}</div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: STATUS_CFG[r.modelStatus].color }}>{isRtl ? STATUS_CFG[r.modelStatus].labelAr : STATUS_CFG[r.modelStatus].labelEn}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '11px', color: textMuted }}>{t('Model Accuracy', 'Model Accuracy')}</span>
                  <span style={{ fontSize: '14px', fontWeight: 800, color: r.accuracy < 50 ? '#EF4444' : '#F59E0B', fontFamily: 'Space Mono' }}>
                    {r.accuracy}%
                  </span>
                </div>
              </button>
            );
          })}

          {/* Add Report Button */}
          <button style={{ width: '100%', padding: '12px', borderRadius: '12px', border: `2px dashed ${bgCardBorder}`, color: textMuted, background: 'transparent', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: 'all 0.2s' }}>
            <Plus size={14} />
            {t('Add Report Field', 'Add Field Report')}
          </button>
        </div>

        {/* ── Right: Detail Panel ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>

          {/* Report Header */}
          <div style={{ background: bgCard, border: `1px solid ${bgCardBorder}`, borderRadius: '14px', padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, padding: '3px 10px', borderRadius: '6px', background: isDark ? 'rgba(96,165,250,0.15)' : '#1B4F8A', color: isDark ? '#60A5FA' : '#fff' }}>
                    {report.id}
                  </span>
                  <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '6px', background: `${gapCfg.color}15`, color: gapCfg.color, fontWeight: 600 }}>
                    {isRtl ? gapCfg.labelAr : gapCfg.labelEn}
                  </span>
                </div>
                <h2 style={{ fontSize: '17px', fontWeight: 800, color: textPrimary, margin: '0 0 8px 0' }}>
                  {isRtl ? report.titleAr : report.titleEn}
                </h2>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: textMuted }}>
                    <MapPin size={12} color={accentBlue} />
                    <span>{isRtl ? report.locationAr : report.locationEn}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: textMuted }}>
                    <Clock size={12} color={accentBlue} />
                    <span>{new Date(report.timestamp).toLocaleString(isRtl ? 'ar-AE' : 'en-AE')}</span>
                  </div>
                </div>
              </div>
              {/* Accuracy Arc */}
              <div style={{ textAlign: 'center', flexShrink: 0, position: 'relative' }}>
                <AccuracyArc value={report.accuracy} color={report.accuracy < 50 ? '#EF4444' : '#F59E0B'} size={90} />
                <div style={{ fontSize: '10px', color: textMuted, marginTop: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                  {t('Model Accuracy', 'Model Accuracy')}
                  <InfoTooltip content={{ ...FV_TOOLTIPS.modelAccuracy, value: `${report.accuracy}%` }} size="sm" />
                </div>
              </div>
            </div>

            {/* Field vs Model Comparison */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <div style={{ borderRadius: '10px', padding: '14px', background: isDark ? fieldCfg.darkBg : fieldCfg.lightBg, border: `1px solid ${fieldCfg.color}30` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                  <Camera size={13} color={fieldCfg.color} />
                  <span style={{ fontSize: '11px', fontWeight: 600, color: textSecondary }}>{t('Actual Reality', 'Actual Reality')}</span>
                </div>
                <div style={{ fontSize: '16px', fontWeight: 800, color: fieldCfg.color, marginBottom: '4px' }}>{isRtl ? fieldCfg.labelAr : fieldCfg.labelEn}</div>
                <div style={{ fontSize: '11px', color: textSecondary }}>{t('Depth:', 'Depth:')} <strong style={{ color: fieldCfg.color }}>{report.waterDepth_cm} {t('cm', 'cm')}</strong></div>
                <div style={{ fontSize: '11px', color: textSecondary, marginTop: '2px' }}>{t('Traffic:', 'Traffic:')} <strong style={{ color: fieldCfg.color }}>{isRtl ? report.trafficImpactAr : report.trafficImpactEn}</strong></div>
              </div>
              <div style={{ borderRadius: '10px', padding: '14px', background: isDark ? modelCfg.darkBg : modelCfg.lightBg, border: `1px solid ${modelCfg.color}30` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                  <BarChart2 size={13} color={modelCfg.color} />
                  <span style={{ fontSize: '11px', fontWeight: 600, color: textSecondary }}>{t('Model Output', 'Model Output')}</span>
                </div>
                <div style={{ fontSize: '16px', fontWeight: 800, color: modelCfg.color, marginBottom: '4px' }}>{isRtl ? modelCfg.labelAr : modelCfg.labelEn}</div>
                <div style={{ fontSize: '11px', color: textSecondary }}>{t('Expected Depth:', 'Expected Depth:')} <strong style={{ color: modelCfg.color }}>{report.modelDepth_cm} {t('cm', 'cm')}</strong></div>
                <div style={{ fontSize: '11px', color: '#EF4444', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {t('Gap:', 'Gap:')} <strong>+{report.waterDepth_cm - report.modelDepth_cm} {t('cm', 'cm')}</strong>
                  <InfoTooltip content={{ ...FV_TOOLTIPS.depthGap, value: `+${report.waterDepth_cm - report.modelDepth_cm} cm` }} size="sm" />
                </div>
              </div>
            </div>

            {/* Gap Note */}
            <div style={{ borderRadius: '8px', padding: '12px 14px', background: `${gapCfg.color}0D`, borderRight: isRtl ? `3px solid ${gapCfg.color}` : 'none', borderLeft: isRtl ? 'none' : `3px solid ${gapCfg.color}` }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: gapCfg.color }}>{t('Gap Reason: ', 'Gap Reason: ')}</span>
              <span style={{ fontSize: '12px', color: textSecondary }}>{isRtl ? report.gapNoteAr : report.gapNoteEn}</span>
            </div>
          </div>

          {/* Two-column: Tabs + Radar */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '16px' }}>

            {/* Tabs */}
            <div style={{ background: bgCard, border: `1px solid ${bgCardBorder}`, borderRadius: '14px', overflow: 'hidden' }}>
              <div style={{ display: 'flex', borderBottom: `1px solid ${bgCardBorder}` }}>
                {([
                  { key: 'overview' as const,        labelAr: 'Overview',      labelEn: 'Overview',        Icon: FileText },
                  { key: 'dimensions' as const,      labelAr: 'Dimensions Analysis',  labelEn: 'Dimensions',      Icon: Layers },
                  { key: 'recommendations' as const, labelAr: 'Improvement Recommendations', labelEn: 'Recommendations', Icon: TrendingUp },
                  { key: 'camera' as const,          labelAr: 'Smart Camera', labelEn: 'Smart Camera',    Icon: Camera },
                ]).map(({ key, labelAr, labelEn, Icon }) => (
                  <button
                    key={key}
                    onClick={() => setTab(key)}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                      padding: '12px 8px', fontSize: '11px', fontWeight: tab === key ? 700 : 400,
                      color: tab === key ? accentBlue : textMuted,
                      borderBottom: `2px solid ${tab === key ? accentBlue : 'transparent'}`,
                      borderTop: 'none', borderLeft: 'none', borderRight: 'none',
                      background: 'transparent', cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >
                    <Icon size={12} />
                    {isRtl ? labelAr : labelEn}
                  </button>
                ))}
              </div>

              <div style={{ padding: '18px' }}>
                {/* Overview */}
                {tab === 'overview' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {/* Accuracy Progress */}
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: textSecondary, marginBottom: '12px' }}>
                        {t('Route Improvement accuracy', 'Accuracy Improvement Path')}
                      </div>
                      {[
                        { label: t('Current Accuracy', 'Current Accuracy'), value: report.accuracy, color: '#EF4444' },
                        { label: t('Expected After Improvement', 'Expected After Improvement'), value: report.correctedAccuracy, color: '#10B981' },
                      ].map((item, i) => (
                        <div key={i} style={{ marginBottom: '10px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '5px' }}>
                            <span style={{ color: textMuted }}>{item.label}</span>
                            <span style={{ fontWeight: 700, color: item.color, fontFamily: 'Space Mono' }}>{item.value}%</span>
                          </div>
                          <div style={{ height: '6px', borderRadius: '3px', background: isDark ? 'rgba(255,255,255,0.08)' : '#E5E7EB', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${item.value}%`, background: item.color, borderRadius: '3px', transition: 'width 0.8s ease' }} />
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Coordinates */}
                    <div style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC', borderRadius: '8px', padding: '12px', border: `1px solid ${bgCardBorder}` }}>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: textSecondary, marginBottom: '6px' }}>{t('Coordinates geographic', 'Geographic Coordinates')}</div>
                      <div style={{ fontFamily: 'Space Mono', fontSize: '12px', color: accentBlue, marginBottom: '8px' }}>
                        {report.coords.lat.toFixed(6)}°N, {report.coords.lng.toFixed(6)}°E
                      </div>
                      <a
                        href={`https://maps.google.com/?q=${report.coords.lat},${report.coords.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600, color: accentBlue, textDecoration: 'none' }}
                      >
                        <ExternalLink size={11} />
                        {t('Open in Google Maps', 'Open in Google Maps')}
                      </a>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: textMuted }}>
                      <span>{t('Reporter:', 'Reporter:')} <strong style={{ color: textSecondary }}>{isRtl ? report.reporterAr : report.reporterEn}</strong></span>
                      <span>{new Date(report.timestamp).toLocaleString(isRtl ? 'ar-AE' : 'en-AE')}</span>
                    </div>
                  </div>
                )}

                {/* Dimensions */}
                {tab === 'dimensions' && (
                  <div>
                    {[
                      { icon: '⛰️', labelAr: 'Local Topography', labelEn: 'Local Topography', valueAr: report.dimensions.topographyAr, valueEn: report.dimensions.topographyEn },
                      { icon: '🌊', labelAr: 'Drainage Network',           labelEn: 'Drainage Network',  valueAr: report.dimensions.drainageAr,   valueEn: report.dimensions.drainageEn },
                      { icon: '🌧️', labelAr: 'Rainfall',        labelEn: 'Precipitation',      valueAr: report.dimensions.precipAr,     valueEn: report.dimensions.precipEn },
                      { icon: '🌱', labelAr: 'Soil Saturation',          labelEn: 'Soil Saturation',    valueAr: report.dimensions.soilAr,       valueEn: report.dimensions.soilEn },
                    ].map((dim, i) => (
                      <div key={i} style={{ display: 'flex', gap: '10px', padding: '12px 0', borderBottom: i < 3 ? `1px solid ${bgCardBorder}` : 'none' }}>
                        <span style={{ fontSize: '18px', flexShrink: 0 }}>{dim.icon}</span>
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: 600, color: textSecondary, marginBottom: '3px' }}>{isRtl ? dim.labelAr : dim.labelEn}</div>
                          <div style={{ fontSize: '11px', color: textMuted, lineHeight: 1.5 }}>{isRtl ? dim.valueAr : dim.valueEn}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Smart Camera */}
                {tab === 'camera' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {/* Hidden inputs */}
                    <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileUpload} />
                    <canvas ref={canvasRef} style={{ display: 'none' }} />

                    {/* IDLE state */}
                    {cameraMode === 'idle' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ textAlign: 'center', padding: '20px 0 10px' }}>
                          <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: isDark ? 'rgba(96,165,250,0.12)' : '#EFF6FF', border: `1px solid ${isDark ? 'rgba(96,165,250,0.3)' : '#BFDBFE'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
                            <Camera size={24} color={accentBlue} />
                          </div>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: textPrimary, marginBottom: '4px' }}>{t('Smart Camera for Field Inspector', 'Smart Camera for Field Inspector')}</div>
                          <div style={{ fontSize: '11px', color: textMuted }}>{t('Capture or upload a photo for AI analysis', 'Capture or upload a photo for AI analysis')}</div>
                        </div>
                        <button
                          onClick={startCamera}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', borderRadius: '10px', background: isDark ? 'rgba(96,165,250,0.12)' : '#1B4F8A', border: `1px solid ${isDark ? 'rgba(96,165,250,0.3)' : 'transparent'}`, color: isDark ? '#60A5FA' : '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}
                        >
                          <Camera size={15} />
                          {t('Operation camera', 'Open Camera')}
                        </button>
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', borderRadius: '10px', background: 'transparent', border: `1px dashed ${isDark ? 'rgba(255,255,255,0.2)' : '#D1D5DB'}`, color: textSecondary, fontSize: '12px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
                        >
                          <Upload size={15} />
                          {t('Upload from Device', 'Upload from Device')}
                        </button>
                      </div>
                    )}

                    {/* LIVE camera */}
                    {cameraMode === 'live' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ position: 'relative', borderRadius: '10px', overflow: 'hidden', background: '#000', aspectRatio: '4/3' }}>
                          <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                          {/* Scan overlay */}
                          <div style={{ position: 'absolute', inset: 0, border: '2px solid rgba(96,165,250,0.5)', borderRadius: '10px', pointerEvents: 'none' }}>
                            <div style={{ position: 'absolute', top: '10px', left: '10px', width: '20px', height: '20px', borderTop: '2px solid #60A5FA', borderLeft: '2px solid #60A5FA' }} />
                            <div style={{ position: 'absolute', top: '10px', right: '10px', width: '20px', height: '20px', borderTop: '2px solid #60A5FA', borderRight: '2px solid #60A5FA' }} />
                            <div style={{ position: 'absolute', bottom: '10px', left: '10px', width: '20px', height: '20px', borderBottom: '2px solid #60A5FA', borderLeft: '2px solid #60A5FA' }} />
                            <div style={{ position: 'absolute', bottom: '10px', right: '10px', width: '20px', height: '20px', borderBottom: '2px solid #60A5FA', borderRight: '2px solid #60A5FA' }} />
                          </div>
                          <div style={{ position: 'absolute', top: '8px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(239,68,68,0.9)', borderRadius: '20px', padding: '3px 10px', fontSize: '10px', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#fff', animation: 'pulse 1s infinite' }} />
                            LIVE
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={capturePhoto}
                            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '11px', borderRadius: '10px', background: accentBlue, border: 'none', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                          >
                            <Camera size={14} />
                            {t('Capture Photo', 'Capture Photo')}
                          </button>
                          <button
                            onClick={stopCamera}
                            style={{ padding: '11px 14px', borderRadius: '10px', background: 'transparent', border: `1px solid ${isDark ? 'rgba(255,255,255,0.15)' : '#E5E7EB'}`, color: textMuted, cursor: 'pointer' }}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Captured / Uploaded */}
                    {(cameraMode === 'captured' || cameraMode === 'uploaded') && capturedImage && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ position: 'relative', borderRadius: '10px', overflow: 'hidden', aspectRatio: '4/3' }}>
                          <img src={capturedImage} alt="captured" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                          <div style={{ position: 'absolute', top: '8px', left: '8px', background: 'rgba(0,0,0,0.6)', borderRadius: '6px', padding: '3px 8px', fontSize: '10px', color: '#fff', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <ImageIcon size={10} />
                            {cameraMode === 'uploaded' ? (isRtl ? 'Uploaded' : 'Uploaded') : (isRtl ? 'Captured' : 'Captured')}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={analyzeImage}
                            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '11px', borderRadius: '10px', background: isDark ? 'linear-gradient(135deg, #1565C0, #42A5F5)' : '#1B4F8A', border: 'none', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                          >
                            <Scan size={14} />
                            {t('Analyze with AI', 'Analyze with AI')}
                          </button>
                          <button
                            onClick={resetCamera}
                            style={{ padding: '11px 14px', borderRadius: '10px', background: 'transparent', border: `1px solid ${isDark ? 'rgba(255,255,255,0.15)' : '#E5E7EB'}`, color: textMuted, cursor: 'pointer' }}
                          >
                            <RefreshCw size={14} />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Analyzing */}
                    {cameraMode === 'analyzing' && capturedImage && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ position: 'relative', borderRadius: '10px', overflow: 'hidden', aspectRatio: '4/3' }}>
                          <img src={capturedImage} alt="analyzing" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', filter: 'brightness(0.6)' }} />
                          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: `3px solid ${accentBlue}`, borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                            <div style={{ fontSize: '12px', fontWeight: 700, color: '#fff' }}>{t('Analyzing...', 'Analyzing...')}</div>
                            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.7)' }}>{t('Model FloodSat Vision AI', 'FloodSat Vision AI Model')}</div>
                          </div>
                          {/* Scan line animation */}
                          <div style={{ position: 'absolute', left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, transparent, #60A5FA, transparent)', animation: 'scanLine 1.5s ease-in-out infinite' }} />
                        </div>
                      </div>
                    )}

                    {/* Done — Analysis Result */}
                    {cameraMode === 'done' && capturedImage && analysisResult && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {/* Image with overlay */}
                        <div style={{ position: 'relative', borderRadius: '10px', overflow: 'hidden', aspectRatio: '4/3' }}>
                          <img src={capturedImage} alt="analyzed" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(0,0,0,0.8))', padding: '20px 12px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {analysisResult.status === 'dry'
                                ? <CheckCircle2 size={16} color="#10B981" />
                                : <AlertCircle size={16} color={analysisResult.status === 'flooded' ? '#EF4444' : '#F59E0B'} />}
                              <span style={{ fontSize: '13px', fontWeight: 800, color: '#fff' }}>
                                {analysisResult.status === 'flooded' ? (isRtl ? 'Flood' : 'Flooded')
                                  : analysisResult.status === 'wet' ? (isRtl ? 'Wet' : 'Wet')
                                  : (isRtl ? 'Dry' : 'Dry')}
                              </span>
                            </div>
                            <span style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.8)', background: 'rgba(0,0,0,0.4)', padding: '2px 8px', borderRadius: '20px' }}>
                              {t('Confidence:', 'Confidence:')} {analysisResult.confidence}%
                            </span>
                          </div>
                        </div>

                        {/* Analysis details */}
                        <div style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC', borderRadius: '10px', padding: '14px', border: `1px solid ${bgCardBorder}` }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                            <Scan size={13} color={accentBlue} />
                            <span style={{ fontSize: '12px', fontWeight: 700, color: textSecondary }}>{t('Results Analysis FloodSat Vision AI', 'FloodSat Vision AI Results')}</span>
                          </div>
                          {/* Confidence bar */}
                          <div style={{ marginBottom: '10px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: textMuted, marginBottom: '4px' }}>
                              <span>{t('Confidence Level', 'Confidence Level')}</span>
                              <span style={{ fontFamily: 'Space Mono', fontWeight: 700, color: accentBlue }}>{analysisResult.confidence}%</span>
                            </div>
                            <div style={{ height: '5px', borderRadius: '3px', background: isDark ? 'rgba(255,255,255,0.08)' : '#E5E7EB' }}>
                              <div style={{ height: '100%', width: `${analysisResult.confidence}%`, background: `linear-gradient(90deg, ${accentBlue}, #60A5FA)`, borderRadius: '3px', transition: 'width 0.8s ease' }} />
                            </div>
                          </div>
                          {/* Depth */}
                          {analysisResult.waterDepth > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '10px', padding: '8px', borderRadius: '6px', background: isDark ? 'rgba(239,68,68,0.08)' : '#FEF2F2', border: `1px solid rgba(239,68,68,0.2)` }}>
                              <span style={{ color: textMuted }}>{t('Water Depth estimated', 'Estimated Water Depth')}</span>
                              <span style={{ fontFamily: 'Space Mono', fontWeight: 700, color: '#EF4444' }}>{analysisResult.waterDepth} {t('cm', 'cm')}</span>
                            </div>
                          )}
                          {/* Notes */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {analysisResult.notes.map((note, i) => (
                              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', fontSize: '11px', color: textSecondary }}>
                                <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: accentBlue, flexShrink: 0, marginTop: '4px' }} />
                                {note}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={resetCamera}
                            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px', borderRadius: '10px', background: isDark ? 'rgba(96,165,250,0.1)' : '#EFF6FF', border: `1px solid ${isDark ? 'rgba(96,165,250,0.25)' : '#BFDBFE'}`, color: accentBlue, fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                          >
                            <RefreshCw size={13} />
                            {t('Analyze New Photo', 'Analyze New Photo')}
                          </button>
                          <button
                            onClick={() => { const a = document.createElement('a'); a.href = capturedImage!; a.download = `FloodSat_${report.id}_${Date.now()}.jpg`; a.click(); }}
                            style={{ padding: '10px 14px', borderRadius: '10px', background: 'transparent', border: `1px solid ${isDark ? 'rgba(255,255,255,0.15)' : '#E5E7EB'}`, color: textMuted, cursor: 'pointer', fontSize: '11px' }}
                          >
                            {t('Save', 'Save')}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Recommendations */}
                {tab === 'recommendations' && (
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: textSecondary, marginBottom: '12px' }}>
                      {t(`Recommendations to raise accuracy from ${report.accuracy}% to ${report.correctedAccuracy}%`, `Recommendations to raise accuracy from ${report.accuracy}% to ${report.correctedAccuracy}%`)}
                    </div>
                    {(isRtl ? report.recommendationsAr : report.recommendationsEn).map((rec, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', borderRadius: '8px', padding: '12px', marginBottom: '8px', background: isDark ? 'rgba(96,165,250,0.06)' : '#EFF6FF', border: `1px solid ${isDark ? 'rgba(96,165,250,0.15)' : '#BFDBFE'}` }}>
                        <div style={{ flexShrink: 0, width: '22px', height: '22px', borderRadius: '50%', background: isDark ? 'rgba(96,165,250,0.2)' : '#1B4F8A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800, color: isDark ? '#60A5FA' : '#fff' }}>
                          {i + 1}
                        </div>
                        <p style={{ fontSize: '12px', color: isDark ? '#93C5FD' : '#1E40AF', lineHeight: 1.6, margin: 0 }}>{rec}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Radar Chart */}
            <div style={{ background: bgCard, border: `1px solid ${bgCardBorder}`, borderRadius: '14px', padding: '16px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: textSecondary, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Zap size={13} color={accentBlue} />
                {t('Multi-Dimensional Analysis', 'Multi-Dimensional Analysis')}
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke={isDark ? 'rgba(255,255,255,0.08)' : '#E5E7EB'} />
                  <PolarAngleAxis dataKey="dim" tick={{ fontSize: 9, fill: textMuted }} />
                  <Radar name={t('the model', 'Model')} dataKey="model" stroke="#EF4444" fill="#EF4444" fillOpacity={0.15} />
                  <Radar name={t('Reality', 'Reality')} dataKey="reality" stroke="#10B981" fill="#10B981" fillOpacity={0.15} />
                  <Tooltip contentStyle={{ background: isDark ? '#0D1B2A' : '#fff', border: `1px solid ${bgCardBorder}`, borderRadius: '6px', fontSize: '11px' }} />
                </RadarChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '8px' }}>
                {[{ color: '#EF4444', labelAr: 'the model', labelEn: 'Model' }, { color: '#10B981', labelAr: 'Reality', labelEn: 'Reality' }].map(l => (
                  <div key={l.labelAr} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: textMuted }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: l.color }} />
                    {isRtl ? l.labelAr : l.labelEn}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
