// SmartLensPage.tsx — FloodSat AI
// Design: Dark Tech · Mobile-first · Bilingual (AR/EN)
// Purpose: Smart Lens system for field inspector — Radar UI + Smart Lens + Active Learning Loop
// Based on: "Technical Specifications for Smart Lens System and Field Inspector App"

import { useState, useRef, useCallback, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import L from 'leaflet';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, LineChart, Line, ReferenceLine, Cell } from 'recharts';
import InfoTooltip from '@/components/InfoTooltip';

const SL_TOOLTIPS = {
  totalSamples: {
    title: 'Total Samples',
    unit: 'Sample',
    description: 'Count of Ground Truth samples collected in the field. Each sample contains: Classification Status + Water Depth + Pool Area + Inspector Confidence. Feeds the self-learning Model.',
    source: 'Field Inspectors via App',
    normalRange: '> 10 Samples',
    updateFreq: 'With each field round',
    color: '#60A5FA',
  },
  statusMatch: {
    title: 'Classification Match',
    unit: '%',
    description: 'Percentage of samples where Model classification (Dry/Wet/Flooded) matches Field classification. Calculated as: (Matching Samples / Total Samples) × 100.',
    source: 'Comparison of Ground Truth samples with Model data',
    normalRange: '> 75%',
    updateFreq: 'With each new sample',
    color: '#34D399',
  },
  avgDepthError: {
    title: 'Average Depth Error',
    unit: 'cm',
    description: 'Average absolute difference between field-measured Water Depth and Model Depth. Calculated as: Average |(Actual Depth - Model Depth)| for all samples.',
    source: 'Samples Ground Truth',
    normalRange: '< 5 cm',
    updateFreq: 'With each new sample',
    color: '#F59E0B',
  },
  modelAccuracy: {
    title: 'Current Model Accuracy',
    unit: '%',
    description: 'Total Model Accuracy after integrating all field samples. Starts at 68% and increases +0.8% with each new sample. Target: exceed 80% (reference line).',
    source: 'Active Learning Algorithm + Ground Truth Samples',
    normalRange: '> 80%',
    updateFreq: 'With each new sample',
    color: '#60A5FA',
  },
};
import {
  Camera, Navigation, Wifi, WifiOff, MapPin, Zap, Activity,
  Eye, Send, AlertTriangle, CheckCircle, Clock, Target,
  Compass, Radio, Upload, RefreshCw, ChevronLeft, ChevronRight,
  Layers, BarChart2, TrendingUp, Shield, Scan, X, Plus, FileDown,
  FlaskConical, GitCompare, Ruler, Droplets, ArrowUpDown, Award, Info,
  Play, Square, Car, Maximize2, Minimize2, Download
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAppTheme } from '@/contexts/ThemeContext';
import { useIsMobile } from '@/hooks/useMobile';

// ─── Types ────────────────────────────────────────────────────────────────────
type AnalysisStatus = 'dry' | 'wet' | 'flooded';
type AppMode = 'radar' | 'lens' | 'learning' | 'sampling' | 'vehicle';
type CameraState = 'idle' | 'live' | 'analyzing' | 'result';

interface TargetPoint {
  id: string;
  nameAr: string;
  nameEn: string;
  lat: number;
  lng: number;
  uncertaintyScore: number;
  priority: 'critical' | 'high' | 'medium';
}

interface AnalysisFrame {
  id: string;
  timestamp: string;
  status: AnalysisStatus;
  confidence: number;
  waterDepth_cm: number;
  area_m2: number;
  lat: number;
  lng: number;
  synced: boolean;
  imageDataUrl?: string; // The actual captured image
}

// Ground Truth Sample — what the field inspector actually measured
interface GroundTruthSample {
  id: string;
  targetId: string;
  targetNameAr: string;
  targetNameEn: string;
  timestamp: string;
  lat: number;
  lng: number;
  // Inspector's actual measurement
  actualStatus: AnalysisStatus;
  actualDepth_cm: number;
  actualArea_m2: number;
  actualConfidence: number; // inspector's certainty 0-100
  // Platform's prediction at same point
  platformStatus: AnalysisStatus;
  platformDepth_cm: number;
  platformArea_m2: number;
  platformConfidence: number;
  // Derived
  depthError_cm: number;   // actualDepth - platformDepth
  areaError_pct: number;   // (actual - platform) / actual * 100
  statusMatch: boolean;
  inspectorNote: string;
  synced: boolean;
  usedForTraining: boolean;
}

interface FreeObservation {
  id: string;
  timestamp: string;
  lat: number;
  lng: number;
  noteAr: string;
  noteEn: string;
  synced: boolean;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────
const TARGET_POINTS: TargetPoint[] = [
  { id: 'TP-001', nameAr: 'South Al Shamkha — E11', nameEn: 'South Al Shamkha — E11', lat: 24.5235, lng: 54.3891, uncertaintyScore: 87, priority: 'critical' },
  { id: 'TP-002', nameAr: 'South Mussafah Junction', nameEn: 'South Mussafah Junction', lat: 24.3512, lng: 54.5023, uncertaintyScore: 74, priority: 'high' },
  { id: 'TP-003', nameAr: 'Al Karama — Street 21', nameEn: 'Al Karama — Street 21', lat: 24.4789, lng: 54.3456, uncertaintyScore: 61, priority: 'high' },
  { id: 'TP-004', nameAr: 'Al Wathba Industrial Area', nameEn: 'Al Wathba Industrial', lat: 24.6123, lng: 54.6789, uncertaintyScore: 52, priority: 'medium' },
];

const INITIAL_FRAMES: AnalysisFrame[] = [
  { id: 'AF-001', timestamp: '2026-03-24T06:12:00', status: 'wet', confidence: 87, waterDepth_cm: 8, area_m2: 24, lat: 24.5235, lng: 54.3891, synced: true },
  { id: 'AF-002', timestamp: '2026-03-24T06:08:00', status: 'flooded', confidence: 91, waterDepth_cm: 22, area_m2: 180, lat: 24.3512, lng: 54.5023, synced: true },
  { id: 'AF-003', timestamp: '2026-03-24T05:55:00', status: 'dry', confidence: 94, waterDepth_cm: 0, area_m2: 0, lat: 24.4789, lng: 54.3456, synced: false },
];

// Initial ground truth samples (demo data)
const INITIAL_SAMPLES: GroundTruthSample[] = [
  {
    id: 'GTS-001', targetId: 'TP-001',
    targetNameAr: 'South Al Shamkha — E11', targetNameEn: 'South Al Shamkha — E11',
    timestamp: '2026-03-24T06:15:00', lat: 24.5235, lng: 54.3891,
    actualStatus: 'flooded', actualDepth_cm: 31, actualArea_m2: 210, actualConfidence: 95,
    platformStatus: 'wet',   platformDepth_cm: 8,  platformArea_m2: 24,  platformConfidence: 87,
    depthError_cm: 23, areaError_pct: 88.6, statusMatch: false,
    inspectorNote: 'Platform estimated water at 8 cm only, actual is 31 cm — large pool under Bridge',
    synced: true, usedForTraining: true,
  },
  {
    id: 'GTS-002', targetId: 'TP-002',
    targetNameAr: 'South Mussafah Junction', targetNameEn: 'South Mussafah Junction',
    timestamp: '2026-03-24T05:50:00', lat: 24.3512, lng: 54.5023,
    actualStatus: 'flooded', actualDepth_cm: 19, actualArea_m2: 165, actualConfidence: 90,
    platformStatus: 'flooded', platformDepth_cm: 22, platformArea_m2: 180, platformConfidence: 91,
    depthError_cm: -3, areaError_pct: -9.1, statusMatch: true,
    inspectorNote: 'Good match — Platform is accurate at this point',
    synced: true, usedForTraining: true,
  },
  {
    id: 'GTS-003', targetId: 'TP-003',
    targetNameAr: 'Al Karama — Street 21', targetNameEn: 'Al Karama — Street 21',
    timestamp: '2026-03-24T05:30:00', lat: 24.4789, lng: 54.3456,
    actualStatus: 'wet', actualDepth_cm: 5, actualArea_m2: 18, actualConfidence: 88,
    platformStatus: 'dry',  platformDepth_cm: 0,  platformArea_m2: 0,  platformConfidence: 94,
    depthError_cm: 5, areaError_pct: 100, statusMatch: false,
    inspectorNote: 'Platform classified area as Dry but there is a small pool at the curb edge',
    synced: false, usedForTraining: false,
  },
];

// ─── Helper Components ────────────────────────────────────────────────────────

function RadarDisplay({ target, distance, bearing, isRtl, isDark }: {
  target: TargetPoint;
  distance: number;
  bearing: number;
  isRtl: boolean;
  isDark: boolean;
}) {
  const accentColor = target.priority === 'critical' ? '#EF4444' : target.priority === 'high' ? '#F59E0B' : '#10B981';
  const isNear = distance <= 15;

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      aspectRatio: '1',
      maxWidth: '280px',
      margin: '0 auto',
    }}>
      {/* Radar rings */}
      {[1, 2, 3].map(ring => (
        <div key={ring} style={{
          position: 'absolute',
          inset: `${(ring - 1) * 16.5}%`,
          borderRadius: '50%',
          border: `1px solid ${isDark ? `rgba(96,165,250,${0.15 - ring * 0.03})` : `rgba(27,79,138,${0.1 + ring * 0.02})`}`,
        }} />
      ))}

      {/* Radar sweep */}
      <div style={{
        position: 'absolute',
        inset: 0,
        borderRadius: '50%',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: '50%',
          height: '2px',
          transformOrigin: '0 50%',
          background: `linear-gradient(90deg, ${isDark ? 'rgba(96,165,250,0.8)' : 'rgba(27,79,138,0.8)'}, transparent)`,
          animation: 'radarSweep 3s linear infinite',
          transform: 'rotate(0deg)',
        }} />
      </div>

      {/* Center dot */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '12px',
        height: '12px',
        borderRadius: '50%',
        background: isDark ? '#60A5FA' : '#1B4F8A',
        boxShadow: `0 0 10px ${isDark ? '#60A5FA' : '#1B4F8A'}`,
      }} />

      {/* Target point — positioned based on bearing */}
      {(() => {
        const rad = (bearing - 90) * Math.PI / 180;
        const maxDist = 500; // meters
        const ratio = Math.min(distance / maxDist, 0.9);
        const x = 50 + Math.cos(rad) * ratio * 45;
        const y = 50 + Math.sin(rad) * ratio * 45;
        return (
          <div style={{
            position: 'absolute',
            left: `${x}%`,
            top: `${y}%`,
            transform: 'translate(-50%, -50%)',
          }}>
            <div style={{
              width: isNear ? '14px' : '10px',
              height: isNear ? '14px' : '10px',
              borderRadius: '50%',
              background: accentColor,
              boxShadow: `0 0 ${isNear ? 16 : 8}px ${accentColor}`,
              animation: isNear ? 'geofencePulse 1.5s ease-out infinite' : undefined,
            }} />
          </div>
        );
      })()}

      {/* Distance label */}
      <div style={{
        position: 'absolute',
        bottom: '8px',
        left: '50%',
        transform: 'translateX(-50%)',
        fontSize: '11px',
        fontWeight: 700,
        color: isDark ? '#60A5FA' : '#1B4F8A',
        fontFamily: 'Space Mono',
        background: isDark ? 'rgba(13,27,42,0.8)' : 'rgba(255,255,255,0.9)',
        padding: '2px 8px',
        borderRadius: '10px',
        whiteSpace: 'nowrap',
      }}>
        {distance < 1000 ? `${Math.round(distance)}m` : `${(distance / 1000).toFixed(1)}km`}
      </div>

      {/* Geofence alert */}
      {isNear && (
        <div style={{
          position: 'absolute',
          top: '8px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(239,68,68,0.9)',
          borderRadius: '20px',
          padding: '3px 10px',
          fontSize: '10px',
          fontWeight: 700,
          color: '#fff',
          whiteSpace: 'nowrap',
          animation: 'liveRecord 0.8s ease-in-out infinite',
        }}>
          📍 {isRtl ? 'Target Reached!' : 'Target Reached!'}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status, isRtl }: { status: AnalysisStatus; isRtl: boolean }) {
  const cfg = {
    flooded: { color: '#EF4444', bg: 'rgba(239,68,68,0.12)', ar: 'Flood', en: 'Flooded' },
    wet:     { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', ar: 'Wet', en: 'Wet' },
    dry:     { color: '#10B981', bg: 'rgba(16,185,129,0.12)', ar: 'Dry', en: 'Dry' },
  }[status];
  return (
    <span style={{ padding: '2px 8px', borderRadius: '6px', background: cfg.bg, color: cfg.color, fontSize: '11px', fontWeight: 700 }}>
      {isRtl ? cfg.ar : cfg.en}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SmartLensPage() {
  const { lang } = useLanguage();
  const { theme } = useAppTheme();
  const isDark = theme !== 'adeo-light';
  const isRtl = lang === 'ar';
  const isMobile = useIsMobile();
  const t = (ar: string, en: string) => isRtl ? ar : en;

  // ── App State ──────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<AppMode>('radar');
  const [isOnline, setIsOnline] = useState(true);
  const [selectedTarget, setSelectedTarget] = useState<TargetPoint>(TARGET_POINTS[0]);
  const [simulatedDistance, setSimulatedDistance] = useState(247);
  const [simulatedBearing, setSimulatedBearing] = useState(42);

  // ── Camera / Lens State ───────────────────────────────────────────────────
  const [cameraState, setCameraState] = useState<CameraState>('idle');
  const [analysisFrames, setAnalysisFrames] = useState<AnalysisFrame[]>(INITIAL_FRAMES);
  const [currentResult, setCurrentResult] = useState<AnalysisFrame | null>(null);
  const [autoAnalyzeEnabled, setAutoAnalyzeEnabled] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const autoAnalyzeRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Separate ref for video in fullscreen mode (uses same stream)
  const videoFsRef = useRef<HTMLVideoElement>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [lensSubTab, setLensSubTab] = useState<'camera' | 'history'>('camera');
  const [captureFlash, setCaptureFlash] = useState(false); // Flash effect on capture
  const [autoCountdown, setAutoCountdown] = useState(0); // Countdown timer (0 = inactive)
  const autoCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Learning State ────────────────────────────────────────────────────────
  const [freeObservations, setFreeObservations] = useState<FreeObservation[]>([]);
  const [pendingSync, setPendingSync] = useState(2);
  const [modelAccuracy, setModelAccuracy] = useState(74);
  const [newObsNote, setNewObsNote] = useState('');

  // ── Sampling State ────────────────────────────────────────────────────────
  const [groundTruthSamples, setGroundTruthSamples] = useState<GroundTruthSample[]>(INITIAL_SAMPLES);
  const [showSampleForm, setShowSampleForm] = useState(false);
  const [sampleForm, setSampleForm] = useState({
    actualStatus: 'wet' as AnalysisStatus,
    actualDepth_cm: '',
    actualArea_m2: '',
    actualConfidence: '90',
    inspectorNote: '',
  });
  const [activeGapTab, setActiveGapTab] = useState<'depth' | 'area' | 'radar'>('depth');
  // ── Free Sample Form State ────────────────────────────────────────────────
  const [showFreeSampleForm, setShowFreeSampleForm] = useState(false);
  const [freeSampleForm, setFreeSampleForm] = useState({
    locationDesc: '',
    actualStatus: 'wet' as AnalysisStatus,
    actualDepth_cm: '',
    actualArea_m2: '',
    actualConfidence: '85',
    inspectorNote: '',
  });
  // ── Accuracy history (simulated) ─────────────────────────────────────────
  const [accuracyHistory] = useState([
    { session: 'S1', accuracy: 68, samples: 1 },
    { session: 'S2', accuracy: 71, samples: 3 },
    { session: 'S3', accuracy: 74, samples: 6 },
    { session: 'S4', accuracy: 74, samples: 9 },
  ]);

  // ── Vehicle Survey State ────────────────────────────────────────────────
  // Vehicle survey point type
  interface VehicleScanPoint {
    id: string;
    lat: number;
    lng: number;
    timestamp: number;
    imageDataUrl?: string;
    floodStatus: 'dry' | 'wet' | 'flooded';
    floodDepthCm: number;
    floodLengthM: number;
    side: 'left' | 'right' | 'both' | 'none';
    confidence: number;
    modelPrediction: 'dry' | 'wet' | 'flooded';
    modelDepthCm: number;
    matchesModel: boolean;
    // Location data
    district: string;   // District / Area
    city: string;       // City
    region: string;     // Emirate / Major Region
  }
  const [vehicleGpsPos, setVehicleGpsPos] = useState<[number, number]>([24.4539, 54.3773]);
  const [vehicleGpsAccuracy, setVehicleGpsAccuracy] = useState(0);
  const [vehicleGpsActive, setVehicleGpsActive] = useState(false);
  const [vehicleGpsError, setVehicleGpsError] = useState('');
  const [vehicleTrackPath, setVehicleTrackPath] = useState<[number, number][]>([]);
  const [vehicleCameraActive, setVehicleCameraActive] = useState(false);
  const [vehicleAutoCapture, setVehicleAutoCapture] = useState(false);
  const [vehicleCaptureInterval, setVehicleCaptureInterval] = useState(5);
  const [vehicleScanPoints, setVehicleScanPoints] = useState<VehicleScanPoint[]>([]);
  const [vehicleSessionActive, setVehicleSessionActive] = useState(false);
  const [vehicleSessionStart, setVehicleSessionStart] = useState<number | null>(null);
  const [vehicleScanning, setVehicleScanning] = useState(false);
  const [vehicleMonitorActive, setVehicleMonitorActive] = useState(false);
  const [vehicleLastCapturePos, setVehicleLastCapturePos] = useState<[number, number] | null>(null);
  const [vehicleAiStatus, setVehicleAiStatus] = useState<'idle' | 'scanning' | 'water_found' | 'no_water'>('idle');
  const [vehicleAiNotes, setVehicleAiNotes] = useState('');
  const vehicleMonitorRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [vehicleActiveTab, setVehicleActiveTab] = useState<'map' | 'camera' | 'stats' | 'gallery'>('map');
  const [vehicleGalleryFilter, setVehicleGalleryFilter] = useState<'all' | 'flooded' | 'wet'>('all');
  const [vehicleGalleryGroup, setVehicleGalleryGroup] = useState<'region' | 'city' | 'district'>('city');
  const [vehicleSelectedPhoto, setVehicleSelectedPhoto] = useState<VehicleScanPoint | null>(null);
  const [cameraFullscreen, setCameraFullscreen] = useState(false);
  const [vehicleCameraFullscreen, setVehicleCameraFullscreen] = useState(false);
  const vehicleVideoRef = useRef<HTMLVideoElement>(null);
  const vehicleVideoFsRef = useRef<HTMLVideoElement>(null); // Separate video for fullscreen
  const vehicleCanvasRef = useRef<HTMLCanvasElement>(null);
  const vehicleStreamRef = useRef<MediaStream | null>(null);
  const vehicleGpsWatchRef = useRef<number | null>(null);
  const vehicleSimIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const vehicleAutoCaptureRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const vehicleMapRef = useRef<L.Map | null>(null);
  const vehicleMapDivRef = useRef<HTMLDivElement>(null);
  const vehicleCarMarkerRef = useRef<L.Marker | null>(null);
  const vehiclePathRef = useRef<L.Polyline | null>(null);
  const vehicleMarkersRef = useRef<L.Marker[]>([]);

  // ── Theme colors ──────────────────────────────────────────────────────────
  const bg = isDark ? '#0A1628' : '#F0F4F8';
  const bgCard = isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF';
  const bgCardBorder = isDark ? 'rgba(255,255,255,0.09)' : '#E2E8F0';
  const textPrimary = isDark ? '#E8F4F8' : '#0F172A';
  const textSecondary = isDark ? '#94A3B8' : '#475569';
  const textMuted = isDark ? '#4A6580' : '#94A3B8';
  const accentBlue = isDark ? '#60A5FA' : '#1B4F8A';
  const headerBg = isDark ? 'rgba(10,22,40,0.96)' : 'rgba(255,255,255,0.96)';

  // ── Simulate GPS movement ─────────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      setSimulatedDistance(d => Math.max(5, d - Math.random() * 3));
      setSimulatedBearing(b => (b + (Math.random() - 0.5) * 2 + 360) % 360);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // ── Bind stream to fullscreen video (lens) ───────────────────────────
  useEffect(() => {
    if (cameraFullscreen && videoFsRef.current && streamRef.current) {
      videoFsRef.current.srcObject = streamRef.current;
      videoFsRef.current.muted = true;
      videoFsRef.current.play().catch(() => {});
    }
  }, [cameraFullscreen]);

  // ── Bind stream to fullscreen video (vehicle) ───────────────────────
  useEffect(() => {
    if (vehicleCameraFullscreen && vehicleVideoFsRef.current && vehicleStreamRef.current) {
      vehicleVideoFsRef.current.srcObject = vehicleStreamRef.current;
      vehicleVideoFsRef.current.muted = true;
      vehicleVideoFsRef.current.play().catch(() => {});
    }
  }, [vehicleCameraFullscreen]);

  // ── Camera functions ──────────────────────────────────────────────────────
  const startLens = useCallback(async () => {
    try {
      // Stop any previous stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }

      // Request Camera — try without constraints first
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
      } catch {
        // If failed, try any available Camera
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }
      streamRef.current = stream;

      // Set live stream on video before changing status
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        try { await videoRef.current.play(); } catch { /* will play via onCanPlay */ }
      }
      setCameraState('live');
    } catch (err) {
      console.error('Camera failed:', err);
      alert(t('Camera access denied. Please allow camera permission.', 'Camera access denied. Please allow camera permission.'));
    }
  }, [t]);

  const stopLens = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(tr => tr.stop());
      streamRef.current = null;
    }
    if (autoAnalyzeRef.current) clearInterval(autoAnalyzeRef.current);
    if (autoCountdownRef.current) clearInterval(autoCountdownRef.current);
    setCameraState('idle');
    setAutoAnalyzeEnabled(false);
    setAutoCountdown(0);
  }, []);

  const runAnalysis = useCallback(async () => {
    // Flash effect on capture
    setCaptureFlash(true);
    setTimeout(() => setCaptureFlash(false), 400);

    setCameraState('analyzing');

    // Capture real image from Camera if active
    let capturedDataUrl: string | undefined;
    if (videoRef.current && canvasRef.current && streamRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        capturedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setCapturedImage(capturedDataUrl);
      }
    }

    // Analysis time (0.8 seconds only)
    await new Promise(r => setTimeout(r, 800));

    const statuses: AnalysisStatus[] = ['wet', 'flooded', 'dry', 'wet'];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const frame: AnalysisFrame = {
      id: `AF-${Date.now()}`,
      timestamp: new Date().toISOString(),
      status,
      confidence: 82 + Math.floor(Math.random() * 14),
      waterDepth_cm: status === 'dry' ? 0 : status === 'wet' ? 4 + Math.floor(Math.random() * 12) : 15 + Math.floor(Math.random() * 30),
      area_m2: status === 'dry' ? 0 : 10 + Math.floor(Math.random() * 200),
      lat: selectedTarget.lat + (Math.random() - 0.5) * 0.001,
      lng: selectedTarget.lng + (Math.random() - 0.5) * 0.001,
      synced: isOnline,
      imageDataUrl: capturedDataUrl, // Save image in log
    };
    setCurrentResult(frame);
    setAnalysisFrames(prev => [frame, ...prev.slice(0, 19)]); // Keep up to 20 frames
    if (!isOnline) setPendingSync(p => p + 1);
    setCameraState('result');
    // Return to live stream after 2 seconds only
    if (streamRef.current) {
      setTimeout(() => {
        setCameraState(prev => prev === 'result' ? 'live' : prev);
      }, 2000);
    }
  }, [selectedTarget, isOnline]);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setCapturedImage(dataUrl);
    runAnalysis();
  }, [runAnalysis]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setCapturedImage(dataUrl);
      setCameraState('analyzing');
      setTimeout(() => {
        const statuses: AnalysisStatus[] = ['wet', 'flooded', 'dry', 'wet'];
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        const frame: AnalysisFrame = {
          id: `AF-${Date.now()}`,
          timestamp: new Date().toISOString(),
          status,
          confidence: 85 + Math.floor(Math.random() * 12),
          waterDepth_cm: status === 'dry' ? 0 : status === 'wet' ? 4 + Math.floor(Math.random() * 12) : 15 + Math.floor(Math.random() * 30),
          area_m2: status === 'dry' ? 0 : 10 + Math.floor(Math.random() * 200),
          lat: selectedTarget.lat + (Math.random() - 0.5) * 0.001,
          lng: selectedTarget.lng + (Math.random() - 0.5) * 0.001,
          synced: isOnline,
        };
        setCurrentResult(frame);
        setAnalysisFrames(prev => [frame, ...prev.slice(0, 9)]);
        if (!isOnline) setPendingSync(p => p + 1);
        setCameraState('result');
      }, 2000);
    };
    reader.readAsDataURL(file);
    if (e.target) e.target.value = '';
  }, [selectedTarget, isOnline]);

  const AUTO_INTERVAL = 5; // seconds

  const startCountdown = useCallback(() => {
    if (autoCountdownRef.current) clearInterval(autoCountdownRef.current);
    setAutoCountdown(AUTO_INTERVAL);
    autoCountdownRef.current = setInterval(() => {
      setAutoCountdown(prev => {
        if (prev <= 1) {
          return AUTO_INTERVAL; // Reset counter after each capture
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const stopCountdown = useCallback(() => {
    if (autoCountdownRef.current) clearInterval(autoCountdownRef.current);
    autoCountdownRef.current = null;
    setAutoCountdown(0);
  }, []);

  const toggleAutoAnalyze = useCallback(() => {
    if (autoAnalyzeEnabled) {
      if (autoAnalyzeRef.current) clearInterval(autoAnalyzeRef.current);
      setAutoAnalyzeEnabled(false);
      stopCountdown();
    } else {
      setAutoAnalyzeEnabled(true);
      startCountdown();
      autoAnalyzeRef.current = setInterval(() => {
        runAnalysis();
        setAutoCountdown(AUTO_INTERVAL); // Reset counter after each capture
      }, 5000); // Every 5 seconds for quick monitoring
    }
  }, [autoAnalyzeEnabled, runAnalysis, startCountdown, stopCountdown]);

  // ── Free observation ──────────────────────────────────────────────────────
  const addObservation = useCallback(() => {
    if (!newObsNote.trim()) return;
    const obs: FreeObservation = {
      id: `OBS-${Date.now()}`,
      timestamp: new Date().toISOString(),
      lat: selectedTarget.lat + (Math.random() - 0.5) * 0.002,
      lng: selectedTarget.lng + (Math.random() - 0.5) * 0.002,
      noteAr: newObsNote,
      noteEn: newObsNote,
      synced: isOnline,
    };
    setFreeObservations(prev => [obs, ...prev]);
    setNewObsNote('');
    if (!isOnline) setPendingSync(p => p + 1);
    // Simulate model improvement
    setModelAccuracy(a => Math.min(99, a + 0.3));
  }, [newObsNote, selectedTarget, isOnline]);

  // ── Add Ground Truth Sample ────────────────────────────────────────────────────────
  const submitSample = useCallback(() => {
    const depth = parseFloat(sampleForm.actualDepth_cm) || 0;
    const area = parseFloat(sampleForm.actualArea_m2) || 0;
    // Get latest platform prediction for this target
    const latestFrame = analysisFrames.find(f => Math.abs(f.lat - selectedTarget.lat) < 0.01);
    const platDepth = latestFrame?.waterDepth_cm ?? 0;
    const platArea = latestFrame?.area_m2 ?? 0;
    const platStatus = latestFrame?.status ?? 'dry';
    const platConf = latestFrame?.confidence ?? 0;
    const sample: GroundTruthSample = {
      id: `GTS-${Date.now()}`,
      targetId: selectedTarget.id,
      targetNameAr: selectedTarget.nameAr,
      targetNameEn: selectedTarget.nameEn,
      timestamp: new Date().toISOString(),
      lat: selectedTarget.lat + (Math.random() - 0.5) * 0.0005,
      lng: selectedTarget.lng + (Math.random() - 0.5) * 0.0005,
      actualStatus: sampleForm.actualStatus,
      actualDepth_cm: depth,
      actualArea_m2: area,
      actualConfidence: parseFloat(sampleForm.actualConfidence) || 90,
      platformStatus: platStatus,
      platformDepth_cm: platDepth,
      platformArea_m2: platArea,
      platformConfidence: platConf,
      depthError_cm: depth - platDepth,
      areaError_pct: area > 0 ? ((area - platArea) / area) * 100 : 0,
      statusMatch: sampleForm.actualStatus === platStatus,
      inspectorNote: sampleForm.inspectorNote,
      synced: isOnline,
      usedForTraining: false,
    };
    setGroundTruthSamples(prev => [sample, ...prev]);
    setShowSampleForm(false);
    setSampleForm({ actualStatus: 'wet', actualDepth_cm: '', actualArea_m2: '', actualConfidence: '90', inspectorNote: '' });
    if (!isOnline) setPendingSync(p => p + 1);
    // Simulate model improvement from new ground truth
    setModelAccuracy(a => Math.min(99, a + 0.8));
  }, [sampleForm, selectedTarget, analysisFrames, isOnline]);

  const markForTraining = useCallback((id: string) => {
    setGroundTruthSamples(prev => prev.map(s => s.id === id ? { ...s, usedForTraining: true, synced: true } : s));
    setModelAccuracy(a => Math.min(99, a + 1.2));
  }, []);

  // ── Sync simulation ────────────────────────────────────────────────────────
  const syncData = useCallback(() => {
    setIsOnline(true);
    setPendingSync(0);
    setAnalysisFrames(prev => prev.map(f => ({ ...f, synced: true })));
    setFreeObservations(prev => prev.map(o => ({ ...o, synced: true })));
    setGroundTruthSamples(prev => prev.map(s => ({ ...s, synced: true })));
  }, []);
  // ── Mode tabs ─────────────────────────────────────────────────────────────
  const MODES = [
    { key: 'radar' as AppMode,    icon: Navigation,    labelAr: 'Radar',  labelEn: 'Radar' },
    { key: 'lens' as AppMode,     icon: Camera,        labelAr: 'Lens',   labelEn: 'Lens' },
    { key: 'sampling' as AppMode, icon: FlaskConical,  labelAr: 'Samples',  labelEn: 'Samples' },
    { key: 'learning' as AppMode, icon: TrendingUp,    labelAr: 'Learning',  labelEn: 'Learning' },
    { key: 'vehicle' as AppMode,  icon: Car,           labelAr: '🚗 Vehicle', labelEn: '🚗 Vehicle' },
  ];

  // ── Abu Dhabi regions map ────────────────────────────────────────────────
  const ABU_DHABI_DISTRICTS = [
    // Abu Dhabi City
    { lat: 24.4539, lng: 54.3773, r: 0.08, district: 'Abu Dhabi Island', city: 'Abu Dhabi', region: 'Abu Dhabi Emirate' },
    { lat: 24.4200, lng: 54.4700, r: 0.05, district: 'Mussafah', city: 'Abu Dhabi', region: 'Abu Dhabi Emirate' },
    { lat: 24.3900, lng: 54.5200, r: 0.04, district: 'Al Shahama', city: 'Abu Dhabi', region: 'Abu Dhabi Emirate' },
    { lat: 24.4700, lng: 54.3500, r: 0.04, district: 'Al Karama', city: 'Abu Dhabi', region: 'Abu Dhabi Emirate' },
    { lat: 24.4300, lng: 54.4100, r: 0.04, district: 'Al Muroor', city: 'Abu Dhabi', region: 'Abu Dhabi Emirate' },
    { lat: 24.4600, lng: 54.3200, r: 0.03, district: 'Al Zaab', city: 'Abu Dhabi', region: 'Abu Dhabi Emirate' },
    { lat: 24.4800, lng: 54.3600, r: 0.03, district: 'Old Airport', city: 'Abu Dhabi', region: 'Abu Dhabi Emirate' },
    { lat: 24.4100, lng: 54.4400, r: 0.04, district: 'Al Rashidiya', city: 'Abu Dhabi', region: 'Abu Dhabi Emirate' },
    { lat: 24.4400, lng: 54.3800, r: 0.03, district: 'Tourist Club', city: 'Abu Dhabi', region: 'Abu Dhabi Emirate' },
    { lat: 24.5000, lng: 54.3700, r: 0.04, district: 'Al Bahia', city: 'Abu Dhabi', region: 'Abu Dhabi Emirate' },
    // Al Ain City
    { lat: 24.2075, lng: 55.7447, r: 0.08, district: 'Al Ain Center', city: 'Al Ain', region: 'Al Ain Region' },
    { lat: 24.2300, lng: 55.7200, r: 0.04, district: 'Al Maamoura', city: 'Al Ain', region: 'Al Ain Region' },
    { lat: 24.1900, lng: 55.7600, r: 0.04, district: 'New Al Ain', city: 'Al Ain', region: 'Al Ain Region' },
    { lat: 24.2200, lng: 55.7700, r: 0.04, district: 'Al Shawamekh', city: 'Al Ain', region: 'Al Ain Region' },
    // Al Dhafra Region
    { lat: 23.5000, lng: 53.9000, r: 0.30, district: 'Liwa', city: 'Liwa', region: 'Al Dhafra Region' },
    { lat: 23.2000, lng: 53.7000, r: 0.25, district: 'Ghayathi', city: 'Ghayathi', region: 'Al Dhafra Region' },
    { lat: 23.7000, lng: 54.1000, r: 0.20, district: 'Zayed City', city: 'Zayed City', region: 'Al Dhafra Region' },
  ];

  const vehicleGetLocation = useCallback((lat: number, lng: number): { district: string; city: string; region: string } => {
    // Search for nearest area
    let best = { district: 'Undetermined', city: 'Abu Dhabi', region: 'Abu Dhabi Emirate' };
    let minDist = Infinity;
    for (const d of ABU_DHABI_DISTRICTS) {
      const dist = Math.sqrt(Math.pow(lat - d.lat, 2) + Math.pow(lng - d.lng, 2));
      if (dist < minDist) { minDist = dist; best = { district: d.district, city: d.city, region: d.region }; }
    }
    return best;
  }, []);

  // ── Vehicle Survey Functions ────────────────────────────────────────────────
  const vehicleAnalyzePoint = useCallback((lat: number, lng: number, imageDataUrl: string | undefined, aiResult?: { floodStatus: 'dry'|'wet'|'flooded'; floodDepthCm: number; floodLengthM: number; side: 'left'|'right'|'both'|'none'; confidence: number; notes: string }) => {
    // Use AI result if available, otherwise random fallback
    const status = aiResult?.floodStatus ?? (Math.random() < 0.3 ? 'dry' as const : Math.random() < 0.6 ? 'wet' as const : 'flooded' as const);
    const modelRand = Math.random();
    const modelStatus = modelRand < 0.35 ? 'dry' as const : modelRand < 0.65 ? 'wet' as const : 'flooded' as const;
    const modelDepthMap = { dry: 0, wet: Math.round(Math.random() * 5 + 1), flooded: Math.round(Math.random() * 80 + 10) };
    const floodLengthM = aiResult?.floodLengthM ?? (status === 'flooded' ? Math.round(Math.random() * 450 + 50) : status === 'wet' ? Math.round(Math.random() * 100 + 10) : 0);
    const side = aiResult?.side ?? (status === 'dry' ? 'none' as const : (['left','right','both'] as const)[Math.floor(Math.random() * 3)]);
    const depthCm = aiResult?.floodDepthCm ?? (status === 'dry' ? 0 : status === 'wet' ? Math.round(Math.random() * 5 + 1) : Math.round(Math.random() * 80 + 10));
    const confidence = aiResult?.confidence ?? Math.round(Math.random() * 25 + 70);
    const pointLat = lat;
    const pointLng = lng;
    const loc = vehicleGetLocation(pointLat, pointLng);
    const point: VehicleScanPoint = {
      id: `VSP-${Date.now()}`,
      lat: pointLat,
      lng: pointLng,
      timestamp: Date.now(),
      imageDataUrl,
      floodStatus: status,
      floodDepthCm: depthCm,
      floodLengthM,
      side,
      confidence,
      modelPrediction: modelStatus,
      modelDepthCm: modelDepthMap[modelStatus],
      matchesModel: status === modelStatus,
      district: loc.district,
      city: loc.city,
      region: loc.region,
    };
    setVehicleScanPoints(prev => [...prev, point]);
    // Update Map with rich marker containing image
    if (vehicleMapRef.current) {
      const color = status === 'flooded' ? '#EF4444' : status === 'wet' ? '#F59E0B' : '#10B981';
      const hasImg = !!imageDataUrl;
      // Larger marker if flooded
      const size = status === 'flooded' ? 18 : status === 'wet' ? 14 : 10;
      const icon = L.divIcon({
        html: `<div style="width:${size}px;height:${size}px;background:${color};border-radius:50%;border:2px solid rgba(255,255,255,0.8);box-shadow:0 0 8px ${color}99;cursor:pointer;${hasImg ? 'outline:2px solid #fff;outline-offset:2px;' : ''}"></div>`,
        className: '', iconSize: [size, size], iconAnchor: [size/2, size/2],
      });
      // Build popup content
      const sideLabel = side === 'left' ? 'Left side' : side === 'right' ? 'Right side' : side === 'both' ? 'Both sides' : 'None';
      const statusLabel = status === 'flooded' ? '🔴 Flood' : status === 'wet' ? '🟡 Wet' : '🟢 Dry';
      const matchColor = status === modelStatus ? '#10B981' : '#EF4444';
      const matchLabel = status === modelStatus ? '✓ Matches Model' : '✗ Differs from Model';
      // Visual bar for pool size (percentage of 500m)
      const barPct = Math.min(100, Math.round((floodLengthM / 500) * 100));
      const barColor = status === 'flooded' ? '#EF4444' : '#F59E0B';
      const popupHtml = `
        <div dir="${isRtl ? 'rtl' : 'ltr'}" style="font-family:Tajawal,sans-serif;font-size:12px;min-width:200px;max-width:240px;">
          ${hasImg ? `<img src="${imageDataUrl}" style="width:100%;height:110px;object-fit:cover;border-radius:6px;margin-bottom:8px;display:block;"/>` : ''}
          <div style="font-weight:700;font-size:13px;color:${color};margin-bottom:4px;">${statusLabel}</div>
          <div style="color:#94A3B8;font-size:10px;margin-bottom:6px;">📍 ${loc.district} • ${loc.city} • ${loc.region}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:6px;">
            <div style="background:rgba(255,255,255,0.05);border-radius:4px;padding:4px 6px;">
              <div style="font-size:9px;color:#64748B;">Water Depth</div>
              <div style="font-weight:700;color:${color};">${depthCm}cm</div>
            </div>
            <div style="background:rgba(255,255,255,0.05);border-radius:4px;padding:4px 6px;">
              <div style="font-size:9px;color:#64748B;">Side</div>
              <div style="font-weight:700;color:#E2E8F0;font-size:11px;">${sideLabel}</div>
            </div>
          </div>
          ${floodLengthM > 0 ? `
          <div style="margin-bottom:6px;">
            <div style="display:flex;justify-content:space-between;font-size:10px;color:#94A3B8;margin-bottom:3px;">
              <span>Pool Length</span><span style="color:${barColor};font-weight:700;">${floodLengthM}m</span>
            </div>
            <div style="height:6px;background:rgba(255,255,255,0.08);border-radius:3px;overflow:hidden;">
              <div style="height:100%;width:${barPct}%;background:${barColor};border-radius:3px;"></div>
            </div>
            <div style="font-size:9px;color:#64748B;text-align:left;margin-top:2px;">of 500m as max threshold</div>
          </div>` : ''}
          <div style="font-size:10px;color:${matchColor};font-weight:600;border-top:1px solid rgba(255,255,255,0.08);padding-top:5px;">${matchLabel}</div>
          <div style="font-size:9px;color:#64748B;margin-top:2px;">${new Date(Date.now()).toLocaleTimeString('ar-AE')}</div>
        </div>`;
      const marker = L.marker([point.lat, point.lng], { icon })
        .addTo(vehicleMapRef.current)
        .bindPopup(popupHtml, { maxWidth: 260, className: 'vehicle-scan-popup' });
      vehicleMarkersRef.current.push(marker);
    }
    return point;
  }, [vehicleGetLocation]);

  const vehicleStartGPS = useCallback(() => {
    setVehicleGpsError('');
    setVehicleGpsActive(true);
    if (navigator.geolocation) {
      vehicleGpsWatchRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const newPos: [number, number] = [pos.coords.latitude, pos.coords.longitude];
          setVehicleGpsPos(newPos);
          setVehicleGpsAccuracy(Math.round(pos.coords.accuracy));
          setVehicleTrackPath(prev => {
            const last = prev[prev.length - 1];
            if (!last || Math.abs(last[0] - newPos[0]) > 0.00001 || Math.abs(last[1] - newPos[1]) > 0.00001) {
              return [...prev, newPos];
            }
            return prev;
          });
          // Update vehicle marker
          if (vehicleMapRef.current) {
            if (vehicleCarMarkerRef.current) {
              vehicleCarMarkerRef.current.setLatLng(newPos);
            }
            vehicleMapRef.current.setView(newPos, vehicleMapRef.current.getZoom(), { animate: true, duration: 0.5 });
          }
        },
        (err) => {
          setVehicleGpsError(`Error GPS: ${err.message}`);
          // Simulate movement in Abu Dhabi
          let step = 0;
          const baseLat = 24.4539, baseLng = 54.3773;
          vehicleSimIntervalRef.current = setInterval(() => {
            step++;
            const newPos: [number, number] = [
              baseLat + step * 0.00015 + (Math.random() - 0.5) * 0.00005,
              baseLng + step * 0.00010 + (Math.random() - 0.5) * 0.00005,
            ];
            setVehicleGpsPos(newPos);
            setVehicleGpsAccuracy(Math.round(Math.random() * 3 + 2));
            setVehicleTrackPath(prev => [...prev, newPos]);
            if (vehicleMapRef.current) {
              if (vehicleCarMarkerRef.current) vehicleCarMarkerRef.current.setLatLng(newPos);
              if (vehiclePathRef.current) vehiclePathRef.current.setLatLngs(vehicleTrackPath.concat([newPos]));
              vehicleMapRef.current.setView(newPos, vehicleMapRef.current.getZoom(), { animate: true, duration: 0.5 });
            }
          }, 2000);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 1000 }
      );
    } else {
      // Live simulation
      let step = 0;
      const baseLat = 24.4539, baseLng = 54.3773;
      vehicleSimIntervalRef.current = setInterval(() => {
        step++;
        const newPos: [number, number] = [
          baseLat + step * 0.00015 + (Math.random() - 0.5) * 0.00005,
          baseLng + step * 0.00010 + (Math.random() - 0.5) * 0.00005,
        ];
        setVehicleGpsPos(newPos);
        setVehicleGpsAccuracy(Math.round(Math.random() * 3 + 2));
        setVehicleTrackPath(prev => [...prev, newPos]);
        if (vehicleMapRef.current) {
          if (vehicleCarMarkerRef.current) vehicleCarMarkerRef.current.setLatLng(newPos);
          vehicleMapRef.current.setView(newPos, vehicleMapRef.current.getZoom(), { animate: true, duration: 0.5 });
        }
      }, 2000);
    }
  }, [vehicleTrackPath]);

  const vehicleStopGPS = useCallback(() => {
    if (vehicleGpsWatchRef.current !== null) {
      navigator.geolocation.clearWatch(vehicleGpsWatchRef.current);
      vehicleGpsWatchRef.current = null;
    }
    if (vehicleSimIntervalRef.current) {
      clearInterval(vehicleSimIntervalRef.current);
      vehicleSimIntervalRef.current = null;
    }
    setVehicleGpsActive(false);
  }, []);

  const vehicleStartCamera = useCallback(async () => {
    try {
      // Stop any previous stream
      if (vehicleStreamRef.current) {
        vehicleStreamRef.current.getTracks().forEach(t => t.stop());
        vehicleStreamRef.current = null;
      }
      // Request rear Camera first, if failed try front
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { exact: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch {
        // Some devices do not support exact — try ideal
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
      }
      vehicleStreamRef.current = stream;
      // Set status first to make element visible
      setVehicleCameraActive(true);
      // Wait for DOM render then set stream
      setTimeout(() => {
        if (vehicleVideoRef.current) {
          vehicleVideoRef.current.srcObject = stream;
          vehicleVideoRef.current.setAttribute('playsinline', 'true');
          vehicleVideoRef.current.setAttribute('webkit-playsinline', 'true');
          vehicleVideoRef.current.muted = true;
          const playPromise = vehicleVideoRef.current.play();
          if (playPromise !== undefined) {
            playPromise.catch(() => {
              // Second attempt after 300ms
              setTimeout(() => {
                if (vehicleVideoRef.current) vehicleVideoRef.current.play().catch(() => {});
              }, 300);
            });
          }
        }
      }, 100);
    } catch (err) {
      console.error('Camera operation failed:', err);
      setVehicleCameraActive(false);
    }
  }, []);

  const vehicleStopCamera = useCallback(() => {
    if (vehicleStreamRef.current) {
      vehicleStreamRef.current.getTracks().forEach(t => t.stop());
      vehicleStreamRef.current = null;
    }
    setVehicleCameraActive(false);
    setVehicleAutoCapture(false);
  }, []);

  // Function to capture image from Camera and convert to base64 JPEG
  const vehicleCaptureFrame = useCallback((): { imageDataUrl: string; base64: string } | null => {
    const canvas = vehicleCanvasRef.current;
    const video = vehicleVideoRef.current;
    if (!canvas || !video || !vehicleCameraActive || video.videoWidth === 0) return null;
    canvas.width = Math.min(video.videoWidth, 640);
    canvas.height = Math.min(video.videoHeight, 480);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.6);
    const base64 = imageDataUrl.replace(/^data:image\/jpeg;base64,/, '');
    return { imageDataUrl, base64 };
  }, [vehicleCameraActive]);

  // Distance in meters between two GPS points
  const vehicleDistanceM = useCallback((a: [number, number], b: [number, number]): number => {
    const R = 6371000;
    const dLat = (b[0] - a[0]) * Math.PI / 180;
    const dLng = (b[1] - a[1]) * Math.PI / 180;
    const aa = Math.sin(dLat/2)**2 + Math.cos(a[0]*Math.PI/180) * Math.cos(b[0]*Math.PI/180) * Math.sin(dLng/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1-aa));
  }, []);

  // Manual capture and analysis when capture button pressed
  const vehicleCaptureAndAnalyze = useCallback(() => {
    setVehicleScanning(true);
    const frame = vehicleCaptureFrame();
    if (!frame) { setVehicleScanning(false); return; }
    vehicleAnalyzePoint(vehicleGpsPos[0], vehicleGpsPos[1], frame.imageDataUrl);
    setVehicleScanning(false);
  }, [vehicleGpsPos, vehicleCaptureFrame, vehicleAnalyzePoint]);

  const vehicleStartSession = useCallback(() => {
    setVehicleScanPoints([]);
    setVehicleTrackPath([]);
    setVehicleSessionActive(true);
    setVehicleSessionStart(Date.now());
    vehicleStartGPS();
    vehicleStartCamera();
    // Initialize Map
    setTimeout(() => {
      if (vehicleMapDivRef.current && !vehicleMapRef.current) {
        const map = L.map(vehicleMapDivRef.current, { zoomControl: true, attributionControl: false });
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          attribution: '&copy; OpenStreetMap &copy; CARTO',
        }).addTo(map);
        map.setView([24.4539, 54.3773], 16);
        // Vehicle marker
        const carIcon = L.divIcon({
          html: `<div style="width:32px;height:32px;background:#00D4FF;border-radius:50%;border:3px solid #fff;display:flex;align-items:center;justify-content:center;box-shadow:0 0 12px #00D4FF88;font-size:16px;">🚗</div>`,
          className: '', iconSize: [32, 32], iconAnchor: [16, 16],
        });
        vehicleCarMarkerRef.current = L.marker([24.4539, 54.3773], { icon: carIcon }).addTo(map);
        // Tracking route
        vehiclePathRef.current = L.polyline([], { color: '#00D4FF', weight: 3, opacity: 0.7, dashArray: '6,4' }).addTo(map);
        vehicleMapRef.current = map;
      }
    }, 100);
  }, [vehicleStartGPS, vehicleStartCamera]);

  const vehicleStopSession = useCallback(() => {
    vehicleStopGPS();
    vehicleStopCamera();
    if (vehicleAutoCaptureRef.current) { clearInterval(vehicleAutoCaptureRef.current); vehicleAutoCaptureRef.current = null; }
    setVehicleAutoCapture(false);
    setVehicleSessionActive(false);
  }, [vehicleStopGPS, vehicleStopCamera]);

  // Update tracking route on Map
  useEffect(() => {
    if (vehiclePathRef.current && vehicleTrackPath.length > 1) {
      vehiclePathRef.current.setLatLngs(vehicleTrackPath);
    }
  }, [vehicleTrackPath]);

  // Smart monitoring: check every 3 seconds and capture only when water detected
  const vehicleGpsPosRef = useRef(vehicleGpsPos);
  useEffect(() => { vehicleGpsPosRef.current = vehicleGpsPos; }, [vehicleGpsPos]);

  const vehicleSmartMonitor = useCallback(async () => {
    if (!vehicleCameraActive) return;
    const frame = vehicleCaptureFrame();
    if (!frame) return;
    const currentPos = vehicleGpsPosRef.current;
    // Avoid duplication: do not capture if in same area (less than 50m)
    if (vehicleLastCapturePos) {
      const dist = vehicleDistanceM(vehicleLastCapturePos, currentPos);
      if (dist < 30) return; // Did not move much, skip
    }
    setVehicleAiStatus('scanning');
    try {
      // Send image to Forge Vision API for quick check
      const res = await fetch('/api/trpc/flood.analyzeImage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          json: {
            imageBase64: frame.base64,
            lat: currentPos[0],
            lng: currentPos[1],
            timestamp: Date.now(),
          }
        }),
      });
      const json = await res.json();
      const aiData = json?.result?.data?.data;
      if (aiData && aiData.hasWater && aiData.floodStatus !== 'dry') {
        // Water detected → capture and archive
        setVehicleAiStatus('water_found');
        setVehicleAiNotes(aiData.notes || '');
        setVehicleLastCapturePos(currentPos);
        vehicleAnalyzePoint(currentPos[0], currentPos[1], frame.imageDataUrl, {
          floodStatus: aiData.floodStatus,
          floodDepthCm: aiData.floodDepthCm,
          floodLengthM: aiData.floodLengthM,
          side: aiData.side,
          confidence: aiData.confidence,
          notes: aiData.notes,
        });
        setTimeout(() => setVehicleAiStatus('idle'), 3000);
      } else {
        setVehicleAiStatus('no_water');
        setTimeout(() => setVehicleAiStatus('idle'), 1500);
      }
    } catch {
      setVehicleAiStatus('idle');
    }
  }, [vehicleCameraActive, vehicleCaptureFrame, vehicleLastCapturePos, vehicleDistanceM, vehicleAnalyzePoint]);

  // Start/stop smart monitoring
  useEffect(() => {
    if (vehicleMonitorActive && vehicleSessionActive) {
      vehicleMonitorRef.current = setInterval(() => {
        vehicleSmartMonitor();
      }, 3000); // Check every 3 seconds
    } else {
      if (vehicleMonitorRef.current) { clearInterval(vehicleMonitorRef.current); vehicleMonitorRef.current = null; }
      setVehicleAiStatus('idle');
    }
    return () => { if (vehicleMonitorRef.current) clearInterval(vehicleMonitorRef.current); };
  }, [vehicleMonitorActive, vehicleSessionActive, vehicleSmartMonitor]);

  // Cleanup on page leave
  useEffect(() => {
    return () => {
      vehicleStopGPS();
      vehicleStopCamera();
      if (vehicleMapRef.current) { vehicleMapRef.current.remove(); vehicleMapRef.current = null; }
    };
  }, [vehicleStopGPS, vehicleStopCamera]);

  // Initialize Map when switching to vehicle mode
  useEffect(() => {
    if (mode === 'vehicle' && vehicleSessionActive && vehicleMapDivRef.current && !vehicleMapRef.current) {
      const map = L.map(vehicleMapDivRef.current, { zoomControl: true, attributionControl: false });
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
      }).addTo(map);
      map.setView([24.4539, 54.3773], 16);
      const carIcon = L.divIcon({
        html: `<div style="width:32px;height:32px;background:#00D4FF;border-radius:50%;border:3px solid #fff;display:flex;align-items:center;justify-content:center;box-shadow:0 0 12px #00D4FF88;font-size:16px;">🚗</div>`,
        className: '', iconSize: [32, 32], iconAnchor: [16, 16],
      });
      vehicleCarMarkerRef.current = L.marker([24.4539, 54.3773], { icon: carIcon }).addTo(map);
      vehiclePathRef.current = L.polyline([], { color: '#00D4FF', weight: 3, opacity: 0.7, dashArray: '6,4' }).addTo(map);
      vehicleMapRef.current = map;
    }
    if (mode !== 'vehicle' && vehicleMapRef.current) {
      vehicleMapRef.current.remove();
      vehicleMapRef.current = null;
      vehicleCarMarkerRef.current = null;
      vehiclePathRef.current = null;
      vehicleMarkersRef.current = [];
    }
  }, [mode, vehicleSessionActive]);

  // Calculate session statistics
  const vehicleStats = {
    total: vehicleScanPoints.length,
    flooded: vehicleScanPoints.filter(p => p.floodStatus === 'flooded').length,
    wet: vehicleScanPoints.filter(p => p.floodStatus === 'wet').length,
    dry: vehicleScanPoints.filter(p => p.floodStatus === 'dry').length,
    matchRate: vehicleScanPoints.length > 0
      ? Math.round((vehicleScanPoints.filter(p => p.matchesModel).length / vehicleScanPoints.length) * 100)
      : 0,
    totalFloodLength: vehicleScanPoints.reduce((s, p) => s + p.floodLengthM, 0),
    avgDepthError: vehicleScanPoints.length > 0
      ? Math.round(vehicleScanPoints.reduce((s, p) => s + Math.abs(p.floodDepthCm - p.modelDepthCm), 0) / vehicleScanPoints.length)
      : 0,
    sessionDurationMin: vehicleSessionStart ? Math.round((Date.now() - vehicleSessionStart) / 60000) : 0,
  };

  // Submit free sample
  const submitFreeSample = useCallback(() => {
    const depth = parseFloat(freeSampleForm.actualDepth_cm) || 0;
    const area = parseFloat(freeSampleForm.actualArea_m2) || 0;
    const sample: GroundTruthSample = {
      id: `GTS-FREE-${Date.now()}`,
      targetId: 'FREE',
      targetNameAr: freeSampleForm.locationDesc || 'Free Point',
      targetNameEn: freeSampleForm.locationDesc || 'Free Point',
      timestamp: new Date().toISOString(),
      lat: 24.4 + Math.random() * 0.3,
      lng: 54.3 + Math.random() * 0.5,
      actualStatus: freeSampleForm.actualStatus,
      actualDepth_cm: depth,
      actualArea_m2: area,
      actualConfidence: parseFloat(freeSampleForm.actualConfidence) || 85,
      platformStatus: 'dry',
      platformDepth_cm: 0,
      platformArea_m2: 0,
      platformConfidence: 0,
      depthError_cm: depth,
      areaError_pct: 100,
      statusMatch: freeSampleForm.actualStatus === 'dry',
      inspectorNote: freeSampleForm.inspectorNote,
      synced: isOnline,
      usedForTraining: false,
    };
    setGroundTruthSamples(prev => [sample, ...prev]);
    setShowFreeSampleForm(false);
    setFreeSampleForm({ locationDesc: '', actualStatus: 'wet', actualDepth_cm: '', actualArea_m2: '', actualConfidence: '85', inspectorNote: '' });
    if (!isOnline) setPendingSync(p => p + 1);
    setModelAccuracy(a => Math.min(99, a + 0.5));
  }, [freeSampleForm, isOnline]);

  // Computed gap analysis data
  const gapChartData = groundTruthSamples.map(s => ({
    name: isRtl ? s.targetNameAr.split(' —')[0] : s.targetNameEn.split(' —')[0],
    actual: s.actualDepth_cm,
    platform: s.platformDepth_cm,
    error: Math.abs(s.depthError_cm),
    actualArea: s.actualArea_m2,
    platformArea: s.platformArea_m2,
  }));
  const statusMatchRate = groundTruthSamples.length > 0
    ? (groundTruthSamples.filter(s => s.statusMatch).length / groundTruthSamples.length) * 100
    : 0;
  const avgDepthError = groundTruthSamples.length > 0
    ? groundTruthSamples.reduce((sum, s) => sum + Math.abs(s.depthError_cm), 0) / groundTruthSamples.length
    : 0;
   const avgAreaError = groundTruthSamples.length > 0
    ? groundTruthSamples.reduce((sum, s) => sum + Math.abs(s.areaError_pct), 0) / groundTruthSamples.length
    : 0;
  // Radar chart data for multi-dimensional comparison
  const radarCompareData = [
    {
      metric: isRtl ? 'Accuracy Depth' : 'Depth Acc.',
      actual: groundTruthSamples.length > 0 ? Math.max(0, 100 - avgDepthError * 2) : 0,
      platform: groundTruthSamples.length > 0 ? Math.min(100, statusMatchRate + 10) : 0,
    },
    {
      metric: isRtl ? 'Accuracy Area' : 'Area Acc.',
      actual: groundTruthSamples.length > 0 ? Math.max(0, 100 - Math.abs(avgAreaError) * 0.5) : 0,
      platform: groundTruthSamples.length > 0 ? Math.max(0, 100 - Math.abs(avgAreaError)) : 0,
    },
    {
      metric: isRtl ? 'Classification Status' : 'Status Class.',
      actual: 100,
      platform: statusMatchRate,
    },
    {
      metric: isRtl ? 'Model Confidence' : 'Confidence',
      actual: groundTruthSamples.length > 0 ? groundTruthSamples.reduce((sum, x) => sum + x.actualConfidence, 0) / groundTruthSamples.length : 0,
      platform: groundTruthSamples.length > 0 ? groundTruthSamples.reduce((sum, x) => sum + x.platformConfidence, 0) / groundTruthSamples.length : 0,
    },
    {
      metric: isRtl ? 'Points Coverage' : 'Coverage',
      actual: Math.min(100, groundTruthSamples.length * 25),
      platform: Math.min(100, groundTruthSamples.length * 20),
    },
  ];
  // Accuracy history with current session appended
  const liveAccuracyHistory = [
    ...accuracyHistory,
    { session: isRtl ? 'Current' : 'Now', accuracy: parseFloat(modelAccuracy.toFixed(1)), samples: groundTruthSamples.length },
  ];
  return (
    <div style={{ background: bg, color: textPrimary, minHeight: '100vh', direction: isRtl ? 'rtl' : 'ltr', fontFamily: isRtl ? "'Noto Naskh Arabic', serif" : "'Inter', sans-serif" }}>

      {/* ── Sticky Header ─────────────────────────────────────────────────── */}
      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: headerBg, borderBottom: `1px solid ${bgCardBorder}`, backdropFilter: 'blur(12px)' }}>
        <div style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: isDark ? 'linear-gradient(135deg, #1565C0, #42A5F5)' : 'linear-gradient(135deg, #003366, #1B4F8A)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Eye size={16} color="white" />
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 800, color: textPrimary, lineHeight: 1.2 }}>
                {t('Smart Lens', 'Smart Lens')}
              </div>
              <div style={{ fontSize: '10px', color: textMuted }}>
                {t('Inspector Field — FloodSat AI', 'Field Inspector — FloodSat AI')}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Online/Offline toggle */}
            <button
              onClick={() => setIsOnline(o => !o)}
              style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '20px', border: `1px solid ${isOnline ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)'}`, background: isOnline ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: isOnline ? '#10B981' : '#EF4444', fontSize: '10px', fontWeight: 700, cursor: 'pointer' }}
            >
              {isOnline ? <Wifi size={11} /> : <WifiOff size={11} />}
              {isOnline ? t('Online', 'Online') : t('Offline', 'Offline')}
            </button>
            {pendingSync > 0 && (
              <button
                onClick={syncData}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 10px', borderRadius: '20px', border: '1px solid rgba(245,158,11,0.4)', background: 'rgba(245,158,11,0.1)', color: '#F59E0B', fontSize: '10px', fontWeight: 700, cursor: 'pointer' }}
              >
                <Send size={10} />
                {t(`Sync (${pendingSync})`, `Sync (${pendingSync})`)}
              </button>
            )}
            <button onClick={() => window.print()} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 10px', borderRadius: '8px', border: `1px solid ${isDark ? 'rgba(139,92,246,0.3)' : '#DDD6FE'}`, background: isDark ? 'rgba(139,92,246,0.08)' : '#F5F3FF', color: '#A78BFA', fontSize: '10px', fontWeight: 600, cursor: 'pointer' }}>
              <FileDown size={11} />
              PDF
            </button>
          </div>
        </div>

        {/* Mode tabs */}
        <div style={{ display: 'flex', borderTop: `1px solid ${bgCardBorder}` }}>
          {MODES.map(({ key, icon: Icon, labelAr, labelEn }) => (
            <button
              key={key}
              onClick={() => setMode(key)}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                padding: '10px', fontSize: '12px', fontWeight: mode === key ? 700 : 400,
                color: mode === key ? accentBlue : textMuted,
                borderBottom: `2px solid ${mode === key ? accentBlue : 'transparent'}`,
                borderTop: 'none', borderLeft: 'none', borderRight: 'none',
                background: mode === key ? (isDark ? 'rgba(96,165,250,0.06)' : 'rgba(27,79,138,0.04)') : 'transparent',
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              <Icon size={13} />
              {isRtl ? labelAr : labelEn}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <div style={{ padding: '16px 20px', maxWidth: '900px', margin: '0 auto' }}>

        {/* ═══════════════════════════════════════════════════════════════════
            MODE 1: RADAR UI & NAVIGATION
        ═══════════════════════════════════════════════════════════════════ */}
        {mode === 'radar' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Target selector */}
            <div style={{ background: bgCard, border: `1px solid ${bgCardBorder}`, borderRadius: '14px', padding: '16px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: textSecondary, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Target size={12} color={accentBlue} />
                {t('Select Target Point', 'Select Target Point')}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {TARGET_POINTS.map(tp => {
                  const priorityColor = tp.priority === 'critical' ? '#EF4444' : tp.priority === 'high' ? '#F59E0B' : '#10B981';
                  return (
                    <button
                      key={tp.id}
                      onClick={() => { setSelectedTarget(tp); setSimulatedDistance(50 + Math.random() * 400); }}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 12px', borderRadius: '10px', cursor: 'pointer', textAlign: isRtl ? 'right' : 'left',
                        background: selectedTarget.id === tp.id ? (isDark ? 'rgba(96,165,250,0.1)' : '#EFF6FF') : 'transparent',
                        border: `1px solid ${selectedTarget.id === tp.id ? (isDark ? 'rgba(96,165,250,0.3)' : '#BFDBFE') : bgCardBorder}`,
                        transition: 'all 0.15s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: priorityColor, flexShrink: 0 }} />
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: 600, color: textPrimary }}>{isRtl ? tp.nameAr : tp.nameEn}</div>
                          <div style={{ fontSize: '10px', color: textMuted, fontFamily: 'Space Mono' }}>{tp.lat.toFixed(4)}°N, {tp.lng.toFixed(4)}°E</div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '13px', fontWeight: 800, color: priorityColor, fontFamily: 'Space Mono' }}>{tp.uncertaintyScore}</div>
                        <div style={{ fontSize: '9px', color: textMuted }}>{t('Uncertainty', 'Uncertainty')}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Radar display */}
            <div style={{ background: bgCard, border: `1px solid ${bgCardBorder}`, borderRadius: '14px', padding: '20px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: textSecondary, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Radio size={12} color={accentBlue} />
                {t('Radar & Navigation UI', 'Radar & Navigation UI')}
                <span style={{ marginRight: 'auto', marginLeft: 'auto' }} />
                <span style={{ fontFamily: 'Space Mono', fontSize: '10px', color: accentBlue }}>
                  {t('Direction:', 'Bearing:')} {Math.round(simulatedBearing)}°
                </span>
              </div>

              <RadarDisplay
                target={selectedTarget}
                distance={simulatedDistance}
                bearing={simulatedBearing}
                isRtl={isRtl}
                isDark={isDark}
              />

              {/* Info row */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: '10px', marginTop: '16px' }}>
                {[
                  { icon: MapPin, labelAr: 'Distance', labelEn: 'Distance', value: simulatedDistance < 1000 ? `${Math.round(simulatedDistance)}m` : `${(simulatedDistance / 1000).toFixed(1)}km` },
                  { icon: Compass, labelAr: 'Direction', labelEn: 'Bearing', value: `${Math.round(simulatedBearing)}°` },
                  { icon: Zap, labelAr: 'Uncertainty', labelEn: 'Uncertainty', value: `${selectedTarget.uncertaintyScore}%` },
                ].map((item, i) => (
                  <div key={i} style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC', borderRadius: '10px', padding: '10px', textAlign: 'center', border: `1px solid ${bgCardBorder}` }}>
                    <item.icon size={14} color={accentBlue} style={{ marginBottom: '4px' }} />
                    <div style={{ fontSize: '14px', fontWeight: 800, color: textPrimary, fontFamily: 'Space Mono' }}>{item.value}</div>
                    <div style={{ fontSize: '9px', color: textMuted }}>{isRtl ? item.labelAr : item.labelEn}</div>
                  </div>
                ))}
              </div>

              {/* Geofence alert */}
              {simulatedDistance <= 15 && (
                <div style={{ marginTop: '14px', padding: '12px 14px', borderRadius: '10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertTriangle size={16} color="#EF4444" />
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#EF4444' }}>{t('Alert: Within 15m Geofence!', 'Alert: Within 15m Geofence!')}</div>
                    <div style={{ fontSize: '10px', color: textSecondary }}>{t('Start documentation — Smart Lens activates automatically', 'Start documentation — Smart Lens activating automatically')}</div>
                  </div>
                </div>
              )}

              {/* Navigate to lens button */}
              <button
                onClick={() => setMode('lens')}
                style={{ width: '100%', marginTop: '14px', padding: '12px', borderRadius: '10px', background: isDark ? 'linear-gradient(135deg, #1565C0, #42A5F5)' : '#1B4F8A', border: 'none', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <Camera size={15} />
                {t('Open Smart Lens', 'Open Smart Lens')}
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            MODE 2: SMART LENS — NO SHUTTER BUTTON
        ═══════════════════════════════════════════════════════════════════ */}
        {mode === 'lens' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* hidden file input */}
            <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileUpload} style={{ display: 'none' }} />
            {/* Sub-tabs: Camera / History */}
            <div style={{ display: 'flex', background: isDark ? 'rgba(255,255,255,0.04)' : '#F1F5F9', borderRadius: '12px', padding: '3px', gap: '3px' }}>
              {([['camera', 'Camera', 'Camera'], ['history', 'History', 'History']] as [typeof lensSubTab, string, string][]).map(([key, ar, en]) => (
                <button key={key} onClick={() => setLensSubTab(key)}
                  style={{ flex: 1, padding: '8px', borderRadius: '9px', border: 'none', background: lensSubTab === key ? (isDark ? '#1E3A5F' : '#fff') : 'transparent', color: lensSubTab === key ? accentBlue : textMuted, fontSize: '12px', fontWeight: lensSubTab === key ? 700 : 400, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', boxShadow: lensSubTab === key ? '0 1px 4px rgba(0,0,0,0.15)' : 'none', transition: 'all 0.15s' }}
                >
                  {key === 'camera' ? <Camera size={13} /> : <Layers size={13} />}
                  {isRtl ? ar : en}
                </button>
              ))}
            </div>
            {lensSubTab === 'camera' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* ── CAMERA VIEWFINDER ── */}
            {/* Fullscreen overlay */}
            {cameraFullscreen && (
              <div style={{
                position: 'fixed', inset: 0, zIndex: 9998,
                background: '#000',
                display: 'flex', flexDirection: 'column',
              }}>
                {/* Separate video for fullscreen - gets stream from useEffect */}
                <video
                  ref={videoFsRef}
                  autoPlay playsInline muted
                  onCanPlay={() => { if (videoFsRef.current) videoFsRef.current.play().catch(() => {}); }}
                  onLoadedMetadata={() => { if (videoFsRef.current) videoFsRef.current.play().catch(() => {}); }}
                  style={{ flex: 1, width: '100%', objectFit: 'cover' }}
                />
                {/* Fullscreen toolbar */}
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  padding: '16px 20px',
                  background: 'linear-gradient(transparent, rgba(0,0,0,0.85))',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
                }}>
                  {/* Capture - uses videoFsRef for capture and returns to normal size */}
                  <button
                    onClick={() => {
                      const vid = videoFsRef.current || videoRef.current;
                      if (canvasRef.current && vid) {
                        const ctx = canvasRef.current.getContext('2d');
                        canvasRef.current.width = vid.videoWidth || 640;
                        canvasRef.current.height = vid.videoHeight || 480;
                        ctx?.drawImage(vid, 0, 0);
                        const img = canvasRef.current.toDataURL('image/jpeg', 0.9);
                        setCapturedImage(img);
                        setCameraState('analyzing');
                        setCameraFullscreen(false);
                      }
                    }}
                    style={{ flex: 1, height: '56px', borderRadius: '16px', border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)', color: '#fff', fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  >
                    <Camera size={20} /> {t('Capture', 'Capture')}
                  </button>
                  {/* Close */}
                  <button
                    onClick={() => setCameraFullscreen(false)}
                    style={{ width: '56px', height: '56px', borderRadius: '16px', border: 'none', cursor: 'pointer', background: 'rgba(239,68,68,0.3)', backdropFilter: 'blur(10px)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <X size={22} />
                  </button>
                </div>
                {/* LIVE badge */}
                <div style={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', background: 'rgba(239,68,68,0.85)', borderRadius: '20px', padding: '4px 14px', fontSize: '11px', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#fff', animation: 'liveRecord 1s ease-in-out infinite' }} /> LIVE
                </div>
              </div>
            )}
            <div style={{ background: '#000', borderRadius: '16px', overflow: 'hidden', position: 'relative', aspectRatio: '4/3' }}>
              {cameraState === 'idle' && (
                <div style={{ position: 'absolute', inset: 0, background: '#0A1628', display: 'flex', flexDirection: 'column' }}>
                  {/* ── Viewfinder frame with grid ── */}
                  <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {/* Grid overlay */}
                    <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(96,165,250,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(96,165,250,0.08) 1px, transparent 1px)', backgroundSize: '33.33% 33.33%' }} />
                    {/* Center crosshair */}
                    <div style={{ position: 'absolute', width: '2px', height: '24px', background: 'rgba(96,165,250,0.5)', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
                    <div style={{ position: 'absolute', width: '24px', height: '2px', background: 'rgba(96,165,250,0.5)', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
                    {/* Corner brackets — larger */}
                    {[['top', 'left'], ['top', 'right'], ['bottom', 'left'], ['bottom', 'right']].map(([v, h]) => (
                      <div key={`${v}-${h}`} style={{
                        position: 'absolute',
                        [v]: '18%', [h]: '10%',
                        width: '28px', height: '28px',
                        borderTop: v === 'top' ? '2.5px solid #60A5FA' : 'none',
                        borderBottom: v === 'bottom' ? '2.5px solid #60A5FA' : 'none',
                        borderLeft: h === 'left' ? '2.5px solid #60A5FA' : 'none',
                        borderRight: h === 'right' ? '2.5px solid #60A5FA' : 'none',
                      }} />
                    ))}
                    {/* Target zone indicator */}
                    <div style={{ position: 'absolute', top: '18%', left: '10%', right: '10%', bottom: '18%', border: '1px dashed rgba(96,165,250,0.2)', borderRadius: '4px' }} />
                    {/* Center icon */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', zIndex: 1 }}>
                      <div style={{ width: '56px', height: '56px', borderRadius: '50%', border: '2px solid rgba(96,165,250,0.4)', background: 'rgba(96,165,250,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Camera size={24} color="#60A5FA" />
                      </div>
                      <span style={{ fontSize: '11px', color: 'rgba(96,165,250,0.7)', fontFamily: 'Space Mono', letterSpacing: '0.1em' }}>{t('Press to capture', 'TAP TO CAPTURE')}</span>
                    </div>
                    {/* Top bar */}
                    <div style={{ position: 'absolute', top: '10px', left: '12px', right: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ background: 'rgba(0,0,0,0.5)', borderRadius: '8px', padding: '4px 8px', fontSize: '10px', color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <MapPin size={9} color="#60A5FA" />
                        <span style={{ fontFamily: 'Space Mono' }}>{selectedTarget.lat.toFixed(4)}°N</span>
                      </div>
                      <div style={{ background: 'rgba(0,0,0,0.5)', borderRadius: '8px', padding: '4px 8px', fontSize: '10px', color: 'rgba(255,255,255,0.7)', fontFamily: 'Space Mono' }}>
                        {isRtl ? selectedTarget.nameAr : selectedTarget.nameEn}
                      </div>
                    </div>
                  </div>
                  {/* ── Bottom action bar ── */}
                  <div style={{ padding: '14px 16px', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                    {/* Upload from gallery */}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      style={{ width: '48px', height: '48px', borderRadius: '12px', border: '1.5px solid rgba(96,165,250,0.4)', background: 'rgba(96,165,250,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
                    >
                      <Upload size={18} color="#60A5FA" />
                    </button>
                    {/* Main capture / activate button */}
                    <button
                      onClick={startLens}
                      style={{ flex: 1, height: '52px', borderRadius: '14px', background: 'linear-gradient(135deg, #1565C0, #42A5F5)', border: 'none', color: '#fff', fontSize: '14px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', letterSpacing: '0.02em' }}
                    >
                      <Eye size={18} />
                      {t('Activate Camera', 'Activate Camera')}
                    </button>
                    {/* Settings placeholder */}
                    <button
                      onClick={() => {}}
                      style={{ width: '48px', height: '48px', borderRadius: '12px', border: '1.5px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
                    >
                      <Zap size={18} color="rgba(255,255,255,0.4)" />
                    </button>
                  </div>
                </div>
              )}

              {/* Video permanently in DOM — required to avoid black screen on iOS/Android */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                onCanPlay={() => { if (videoRef.current) videoRef.current.play().catch(() => {}); }}
                onLoadedMetadata={() => { if (videoRef.current) videoRef.current.play().catch(() => {}); }}
                style={{
                  position: 'absolute', inset: 0,
                  width: '100%', height: '100%',
                  objectFit: 'cover',
                  display: (cameraState === 'live' || cameraState === 'analyzing' || cameraState === 'result') ? 'block' : 'none',
                  filter: cameraState === 'analyzing' ? 'brightness(0.7)' : 'none',
                  zIndex: 1,
                }}
              />
              {(cameraState === 'live' || cameraState === 'analyzing' || cameraState === 'result') && (
                <>
                  <canvas ref={canvasRef} style={{ display: 'none' }} />
                  {/* Flash effect on capture */}
                  {captureFlash && (
                    <div style={{
                      position: 'absolute', inset: 0, zIndex: 20, pointerEvents: 'none',
                      background: 'rgba(255,255,255,0.35)',
                      animation: 'captureFlashAnim 0.4s ease-out forwards',
                    }} />
                  )}
                  {/* Transparent layer over video */}
                  <div style={{ position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none' }} />

                  {/* Corner brackets */}
                  {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map(corner => (
                    <div key={corner} style={{
                      position: 'absolute',
                      [corner.includes('top') ? 'top' : 'bottom']: '12px',
                      [corner.includes('left') ? 'left' : 'right']: '12px',
                      width: '20px', height: '20px',
                      borderTop: corner.includes('top') ? '2px solid rgba(96,165,250,0.8)' : 'none',
                      borderBottom: corner.includes('bottom') ? '2px solid rgba(96,165,250,0.8)' : 'none',
                      borderLeft: corner.includes('left') ? '2px solid rgba(96,165,250,0.8)' : 'none',
                      borderRight: corner.includes('right') ? '2px solid rgba(96,165,250,0.8)' : 'none',
                    }} />
                  ))}

                  {/* LIVE badge + fullscreen button */}
                  {cameraState === 'live' && (
                    <>
                      <div style={{ position: 'absolute', top: '10px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(239,68,68,0.9)', borderRadius: '20px', padding: '3px 10px', fontSize: '10px', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '4px', zIndex: 10 }}>
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#fff', animation: 'liveRecord 1s ease-in-out infinite' }} />
                        LIVE
                      </div>

                      {/* Visible countdown when AUTO is active */}
                      {autoAnalyzeEnabled && autoCountdown > 0 && (
                        <div style={{
                          position: 'absolute', bottom: '12px', left: '50%', transform: 'translateX(-50%)',
                          zIndex: 15, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                          pointerEvents: 'none',
                        }}>
                          {/* Progress bar */}
                          <div style={{
                            width: '120px', height: '3px', borderRadius: '2px',
                            background: 'rgba(255,255,255,0.2)',
                            overflow: 'hidden',
                          }}>
                            <div style={{
                              height: '100%',
                              width: `${(autoCountdown / 5) * 100}%`,
                              background: autoCountdown <= 1 ? '#EF4444' : autoCountdown <= 2 ? '#F59E0B' : '#34D399',
                              borderRadius: '2px',
                              transition: 'width 0.9s linear, background 0.3s',
                            }} />
                          </div>
                          {/* Number */}
                          <div style={{
                            background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
                            borderRadius: '20px', padding: '2px 10px',
                            fontSize: '11px', fontWeight: 700, color: autoCountdown <= 1 ? '#EF4444' : autoCountdown <= 2 ? '#F59E0B' : '#34D399',
                            fontFamily: 'Space Mono', display: 'flex', alignItems: 'center', gap: '5px',
                            border: `1px solid ${autoCountdown <= 1 ? 'rgba(239,68,68,0.5)' : 'rgba(52,211,153,0.3)'}`,
                          }}>
                            <Activity size={9} />
                            AUTO · {autoCountdown}s
                          </div>
                        </div>
                      )}
                      {/* Fullscreen button */}
                      <button
                        onClick={() => setCameraFullscreen(true)}
                        style={{ position: 'absolute', top: '8px', right: '8px', zIndex: 10, width: '32px', height: '32px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        title={t('Fullscreen', 'Fullscreen')}
                      >
                        <Maximize2 size={15} />
                      </button>
                    </>
                  )}

                  {/* Grid overlay (rule of thirds) */}
                  {cameraState === 'live' && (
                    <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(96,165,250,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(96,165,250,0.12) 1px, transparent 1px)', backgroundSize: '33.33% 33.33%', pointerEvents: 'none' }} />
                  )}
                  {/* Center crosshair */}
                  {cameraState === 'live' && (
                    <>
                      <div style={{ position: 'absolute', width: '1.5px', height: '20px', background: 'rgba(96,165,250,0.6)', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none' }} />
                      <div style={{ position: 'absolute', width: '20px', height: '1.5px', background: 'rgba(96,165,250,0.6)', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none' }} />
                    </>
                  )}
                  {/* Auto-analyze indicator */}
                  {autoAnalyzeEnabled && cameraState === 'live' && (
                    <div style={{ position: 'absolute', top: '46px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(52,211,153,0.85)', borderRadius: '20px', padding: '3px 12px', fontSize: '10px', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                      <Activity size={10} />
                      {t('Auto every 8s', 'Auto every 8s')}
                    </div>
                  )}

                  {/* Analyzing overlay */}
                  {cameraState === 'analyzing' && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                      <div style={{ width: '44px', height: '44px', borderRadius: '50%', border: '3px solid #60A5FA', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>{t('Analyzing...', 'Analyzing...')}</div>
                      <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.7)' }}>FloodSat Vision AI</div>
                      {/* Scan line */}
                      <div style={{ position: 'absolute', left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, transparent, #60A5FA, transparent)', animation: 'scanLine 1.5s ease-in-out infinite' }} />
                    </div>
                  )}

                  {/* Result overlay — full bottom panel */}
                  {cameraState === 'result' && currentResult && (
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(0,0,0,0.92))', padding: '40px 14px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <StatusBadge status={currentResult.status} isRtl={isRtl} />
                          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.8)' }}>{currentResult.confidence}% {t('Confidence', 'confidence')}</span>
                        </div>
                        {currentResult.waterDepth_cm > 0 && (
                          <span style={{ fontSize: '12px', fontWeight: 700, color: '#FCA5A5', fontFamily: 'Space Mono' }}>
                            {currentResult.waterDepth_cm}cm · {currentResult.area_m2}m²
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={runAnalysis} style={{ flex: 1, padding: '8px', borderRadius: '8px', background: 'rgba(96,165,250,0.2)', border: '1px solid rgba(96,165,250,0.4)', color: '#60A5FA', fontSize: '11px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                          <RefreshCw size={12} />{t('Analysis New', 'Re-analyze')}
                        </button>
                        <button onClick={capturePhoto} style={{ flex: 1, padding: '8px', borderRadius: '8px', background: 'rgba(52,211,153,0.2)', border: '1px solid rgba(52,211,153,0.4)', color: '#34D399', fontSize: '11px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                          <Camera size={12} />{t('New Photo', 'New Photo')}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Camera controls — shutter bar (live/result state) */}
            {(cameraState === 'live' || cameraState === 'result') && (
              <div style={{ background: isDark ? 'rgba(10,22,40,0.95)' : '#0A1628', borderRadius: '16px', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                {/* Upload from gallery */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  style={{ width: '50px', height: '50px', borderRadius: '12px', border: '1.5px solid rgba(96,165,250,0.35)', background: 'rgba(96,165,250,0.1)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '3px', cursor: 'pointer', flexShrink: 0 }}
                >
                  <Upload size={16} color="#60A5FA" />
                  <span style={{ fontSize: '8px', color: 'rgba(96,165,250,0.7)', fontWeight: 700 }}>{t('UPLOAD', 'UPLOAD')}</span>
                </button>
                {/* Main shutter button */}
                <button
                  onClick={capturePhoto}
                  disabled={cameraState !== 'live'}
                  style={{ width: '68px', height: '68px', borderRadius: '50%', border: '3px solid rgba(255,255,255,0.9)', background: cameraState === 'live' ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: cameraState === 'live' ? 'pointer' : 'default', flexShrink: 0, boxShadow: cameraState === 'live' ? '0 0 0 3px rgba(96,165,250,0.4), 0 4px 16px rgba(0,0,0,0.4)' : 'none', transition: 'all 0.15s' }}
                  onMouseDown={e => cameraState === 'live' && (e.currentTarget.style.transform = 'scale(0.92)')}
                  onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
                >
                  <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: cameraState === 'live' ? '#fff' : 'rgba(255,255,255,0.3)' }} />
                </button>
                {/* Auto toggle + Stop */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
                  <button
                    onClick={toggleAutoAnalyze}
                    style={{ width: '50px', height: '22px', borderRadius: '6px', border: `1px solid ${autoAnalyzeEnabled ? 'rgba(52,211,153,0.5)' : 'rgba(255,255,255,0.15)'}`, background: autoAnalyzeEnabled ? 'rgba(52,211,153,0.2)' : 'rgba(255,255,255,0.05)', color: autoAnalyzeEnabled ? '#34D399' : 'rgba(255,255,255,0.4)', fontSize: '8px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}
                  >
                    <Activity size={9} />{t('Automatic', 'AUTO')}
                  </button>
                  <button
                    onClick={stopLens}
                    style={{ width: '50px', height: '22px', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.1)', color: '#EF4444', fontSize: '8px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}
                  >
                    <X size={9} />{t('STOP', 'STOP')}
                  </button>
                </div>
              </div>
            )}

            {/* GPS stamp info */}
            <div style={{ background: bgCard, border: `1px solid ${bgCardBorder}`, borderRadius: '12px', padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: textSecondary }}>
                <MapPin size={12} color={accentBlue} />
                <span style={{ fontFamily: 'Space Mono' }}>{selectedTarget.lat.toFixed(5)}°N, {selectedTarget.lng.toFixed(5)}°E</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: textMuted }}>
                <Clock size={10} />
                {new Date().toLocaleTimeString(isRtl ? 'ar-AE' : 'en-AE')}
              </div>
            </div>

            {/* Recent analysis frames */}
            <div style={{ background: bgCard, border: `1px solid ${bgCardBorder}`, borderRadius: '14px', padding: '14px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: textSecondary, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Layers size={12} color={accentBlue} />
                {t('Recent Analysis Frames', 'Recent Analysis Frames')}
                <span style={{ marginRight: 'auto', marginLeft: 'auto' }} />
                <span style={{ fontFamily: 'Space Mono', fontSize: '10px', color: textMuted }}>{analysisFrames.length} {t('frames', 'frames')}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {analysisFrames.slice(0, 5).map(frame => (
                  <div key={frame.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: '8px', background: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC', border: `1px solid ${bgCardBorder}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <StatusBadge status={frame.status} isRtl={isRtl} />
                      <div>
                        <div style={{ fontSize: '10px', fontFamily: 'Space Mono', color: textMuted }}>{new Date(frame.timestamp).toLocaleTimeString(isRtl ? 'ar-AE' : 'en-AE')}</div>
                        {frame.waterDepth_cm > 0 && (
                          <div style={{ fontSize: '10px', color: textSecondary }}>{frame.waterDepth_cm}cm · {frame.area_m2}m²</div>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '10px', fontFamily: 'Space Mono', color: accentBlue }}>{frame.confidence}%</span>
                      {frame.synced
                        ? <CheckCircle size={12} color="#10B981" />
                        : <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#F59E0B', animation: 'liveRecord 1.5s ease-in-out infinite' }} />
                      }
                    </div>
                  </div>
                ))}
              </div>
            </div>
            </div>
            )}
            {/* ── HISTORY sub-tab ── */}
            {lensSubTab === 'history' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: textSecondary, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Layers size={12} color={accentBlue} />
                  {t('Analysis History', 'Analysis History')}
                  <span style={{ marginRight: 'auto', marginLeft: 'auto' }} />
                  <span style={{ fontFamily: 'Space Mono', fontSize: '10px', color: textMuted }}>{analysisFrames.length} {t('frames', 'frames')}</span>
                </div>
                {analysisFrames.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: textMuted, fontSize: '12px' }}>
                    <Camera size={32} color={textMuted} style={{ marginBottom: '10px', opacity: 0.4 }} />
                    <div>{t('No analyses yet', 'No analyses yet')}</div>
                  </div>
                )}
                {analysisFrames.map((frame, idx) => (
                  <div key={frame.id} style={{ background: bgCard, border: `1px solid ${bgCardBorder}`, borderRadius: '12px', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', gap: '0' }}>
                      {/* Thumbnail - real image or placeholder */}
                      <div style={{ width: '80px', flexShrink: 0, position: 'relative', overflow: 'hidden', background: frame.status === 'flooded' ? 'rgba(239,68,68,0.15)' : frame.status === 'wet' ? 'rgba(59,130,246,0.15)' : 'rgba(107,114,128,0.1)' }}>
                        {frame.imageDataUrl ? (
                          <img src={frame.imageDataUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '4px', padding: '10px 0' }}>
                            <Camera size={20} color={frame.status === 'flooded' ? '#EF4444' : frame.status === 'wet' ? '#60A5FA' : '#9CA3AF'} />
                          </div>
                        )}
                        <span style={{ position: 'absolute', bottom: '3px', left: '50%', transform: 'translateX(-50%)', fontSize: '8px', fontFamily: 'Space Mono', color: '#fff', background: 'rgba(0,0,0,0.6)', borderRadius: '3px', padding: '1px 4px' }}>#{String(analysisFrames.length - idx).padStart(3, '0')}</span>
                      </div>
                      {/* Info */}
                      <div style={{ flex: 1, padding: '10px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <StatusBadge status={frame.status} isRtl={isRtl} />
                          <span style={{ fontSize: '10px', fontFamily: 'Space Mono', color: accentBlue, fontWeight: 700 }}>{frame.confidence}%</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                          <div style={{ fontSize: '10px', color: textMuted }}>
                            <span style={{ color: textSecondary, fontWeight: 600 }}>{t('Depth', 'Depth')}: </span>
                            <span style={{ fontFamily: 'Space Mono' }}>{frame.waterDepth_cm}cm</span>
                          </div>
                          <div style={{ fontSize: '10px', color: textMuted }}>
                            <span style={{ color: textSecondary, fontWeight: 600 }}>{t('Area', 'Area')}: </span>
                            <span style={{ fontFamily: 'Space Mono' }}>{frame.area_m2}m²</span>
                          </div>
                        </div>
                        <div style={{ fontSize: '9px', color: textMuted, marginTop: '5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={9} />
                          {new Date(frame.timestamp).toLocaleString(isRtl ? 'ar-AE' : 'en-AE')}
                          {frame.synced
                            ? <CheckCircle size={9} color="#10B981" style={{ marginRight: 'auto', marginLeft: 'auto' }} />
                            : <span style={{ color: '#F59E0B', marginRight: 'auto', marginLeft: 'auto' }}>{t('Pending', 'Pending')}</span>
                          }
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {/* ════════════════════════════════════════════════════════════════════════════
            MODE 3: GROUND TRUTH SAMPLING
        ════════════════════════════════════════════════════════════════════════════ */}
        {mode === 'sampling' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* ── Summary KPIs ── */}
            {/* Progress bar for inspection points */}
            <div style={{ background: bgCard, border: `1px solid ${bgCardBorder}`, borderRadius: '12px', padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: textSecondary, display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Target size={12} color={accentBlue} />
                  {t('Scheduled Inspection Points Coverage', 'Scheduled Inspection Points Coverage')}
                </div>
                <span style={{ fontSize: '12px', fontWeight: 800, color: accentBlue, fontFamily: 'Space Mono' }}>
                  {Math.min(TARGET_POINTS.length, groundTruthSamples.filter(s => s.targetId !== 'FREE').length)}/{TARGET_POINTS.length}
                </span>
              </div>
              <div style={{ height: '6px', borderRadius: '3px', background: isDark ? 'rgba(255,255,255,0.08)' : '#E5E7EB', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(100, (groundTruthSamples.filter(s => s.targetId !== 'FREE').length / TARGET_POINTS.length) * 100)}%`, background: `linear-gradient(90deg, ${accentBlue}, #34D399)`, borderRadius: '3px', transition: 'width 0.8s ease' }} />
              </div>
              <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
                {TARGET_POINTS.map(tp => {
                  const visited = groundTruthSamples.some(s => s.targetId === tp.id);
                  return (
                    <div key={tp.id} style={{ flex: 1, height: '4px', borderRadius: '2px', background: visited ? '#34D399' : (tp.priority === 'critical' ? 'rgba(239,68,68,0.4)' : tp.priority === 'high' ? 'rgba(245,158,11,0.4)' : 'rgba(107,114,128,0.3)') }} />
                  );
                })}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              {[
                { labelAr: 'Total Samples', labelEn: 'Total Samples', value: groundTruthSamples.length, icon: FlaskConical, color: accentBlue, tip: SL_TOOLTIPS.totalSamples },
                { labelAr: 'Classification Match', labelEn: 'Status Match', value: `${statusMatchRate.toFixed(0)}%`, icon: CheckCircle, color: '#34D399', tip: SL_TOOLTIPS.statusMatch },
                { labelAr: 'Avg Depth Error', labelEn: 'Avg Depth Error', value: `${avgDepthError.toFixed(1)} cm`, icon: ArrowUpDown, color: '#F59E0B', tip: SL_TOOLTIPS.avgDepthError },
              ].map((kpi, i) => (
                <div key={i} style={{ background: bgCard, border: `1px solid ${bgCardBorder}`, borderRadius: '12px', padding: '12px 10px', textAlign: 'center' }}>
                  <kpi.icon size={16} color={kpi.color} style={{ marginBottom: '6px' }} />
                  <div style={{ fontSize: '16px', fontWeight: 800, color: kpi.color }}>{kpi.value}</div>
                  <div style={{ fontSize: '10px', color: textMuted, marginTop: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
                    {t(kpi.labelAr, kpi.labelEn)}
                    <InfoTooltip content={{ ...kpi.tip, value: `${kpi.value}` }} size="sm" />
                  </div>
                </div>
              ))}
            </div>

            {/* ── New Sample Button ── */}
            {!showSampleForm && (
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => setShowSampleForm(true)}
                  style={{ flex: 1, padding: '13px', borderRadius: '12px', background: 'linear-gradient(135deg, #1565C0, #42A5F5)', border: 'none', color: 'white', fontWeight: 700, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  <Plus size={16} />
                  {t('New Guided Sample', 'New Guided Sample')}
                </button>
              </div>
            )}

            {/* ── Sample Form ── */}
            {showSampleForm && (
              <div style={{ background: bgCard, border: `2px solid ${accentBlue}`, borderRadius: '14px', padding: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FlaskConical size={16} color={accentBlue} />
                    <span style={{ fontSize: '13px', fontWeight: 700, color: textPrimary }}>
                      {t('Guided Sample', 'Guided Sample')}
                    </span>
                  </div>
                  <button onClick={() => setShowSampleForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: textMuted }}><X size={16} /></button>
                </div>
                {/* Target point selector */}
                <div style={{ marginBottom: '14px' }}>
                  <div style={{ fontSize: '11px', color: textMuted, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Target size={11} color={accentBlue} />
                    {t('Select Inspection Point', 'Select Inspection Point')}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {TARGET_POINTS.map(tp => (
                      <button
                        key={tp.id}
                        onClick={() => setSelectedTarget(tp)}
                        style={{
                          padding: '8px 12px', borderRadius: '8px', border: `1px solid ${selectedTarget.id === tp.id ? accentBlue : bgCardBorder}`,
                          background: selectedTarget.id === tp.id ? (isDark ? 'rgba(96,165,250,0.12)' : '#EFF6FF') : 'transparent',
                          color: selectedTarget.id === tp.id ? accentBlue : textSecondary,
                          fontSize: '11px', fontWeight: selectedTarget.id === tp.id ? 700 : 400,
                          cursor: 'pointer', textAlign: isRtl ? 'right' : 'left',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        }}
                      >
                        <span>{isRtl ? tp.nameAr : tp.nameEn}</span>
                        <span style={{ fontSize: '10px', color: tp.priority === 'critical' ? '#EF4444' : tp.priority === 'high' ? '#F59E0B' : '#34D399', background: tp.priority === 'critical' ? 'rgba(239,68,68,0.1)' : tp.priority === 'high' ? 'rgba(245,158,11,0.1)' : 'rgba(52,211,153,0.1)', padding: '2px 6px', borderRadius: '10px', fontWeight: 700 }}>
                          {tp.uncertaintyScore}%
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Platform prediction banner */}
                <div style={{ background: isDark ? 'rgba(96,165,250,0.08)' : '#EFF6FF', border: `1px solid ${isDark ? 'rgba(96,165,250,0.2)' : '#BFDBFE'}`, borderRadius: '10px', padding: '10px 12px', marginBottom: '14px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: accentBlue, marginBottom: '6px' }}>{t('Platform Prediction (Reference)', 'Platform Prediction (Reference)')}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                    {[{
                      labelAr: 'Classification', labelEn: 'Status',
                      value: t(
                        analysisFrames[0]?.status === 'flooded' ? 'Flood' : analysisFrames[0]?.status === 'wet' ? 'Wet' : 'Dry',
                        analysisFrames[0]?.status ?? 'N/A'
                      )
                    }, {
                      labelAr: 'Depth', labelEn: 'Depth',
                      value: `${analysisFrames[0]?.waterDepth_cm ?? '?'} cm`
                    }, {
                      labelAr: 'Area', labelEn: 'Area',
                      value: `${analysisFrames[0]?.area_m2 ?? '?'} m²`
                    }].map((item, i) => (
                      <div key={i} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: textPrimary }}>{item.value}</div>
                        <div style={{ fontSize: '10px', color: textMuted }}>{t(item.labelAr, item.labelEn)}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Inspector actual measurement */}
                <div style={{ fontSize: '11px', fontWeight: 700, color: textSecondary, marginBottom: '10px' }}>
                  {t('Inspector Actual Measurement — Field Reality', 'Inspector Actual Measurement — Field Reality')}
                </div>

                {/* Status selector */}
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ fontSize: '11px', color: textMuted, marginBottom: '6px' }}>{t('Actual Water Status', 'Actual Water Status')}</div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {(['dry', 'wet', 'flooded'] as AnalysisStatus[]).map(s => (
                      <button
                        key={s}
                        onClick={() => setSampleForm(f => ({ ...f, actualStatus: s }))}
                        style={{
                          flex: 1, padding: '8px 4px', borderRadius: '8px', border: `2px solid ${sampleForm.actualStatus === s ? (s === 'dry' ? '#6B7280' : s === 'wet' ? '#3B82F6' : '#EF4444') : bgCardBorder}`,
                          background: sampleForm.actualStatus === s ? (s === 'dry' ? 'rgba(107,114,128,0.15)' : s === 'wet' ? 'rgba(59,130,246,0.15)' : 'rgba(239,68,68,0.15)') : 'transparent',
                          color: sampleForm.actualStatus === s ? (s === 'dry' ? '#9CA3AF' : s === 'wet' ? '#60A5FA' : '#F87171') : textMuted,
                          fontSize: '11px', fontWeight: 700, cursor: 'pointer'
                        }}
                      >
                        {t(s === 'dry' ? 'Dry' : s === 'wet' ? 'Wet' : 'Flooded', s === 'dry' ? 'Dry' : s === 'wet' ? 'Wet' : 'Flooded')}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Depth & Area inputs */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: textMuted, marginBottom: '5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Ruler size={11} color={textMuted} />
                      {t('Water Depth (cm)', 'Water Depth (cm)')}
                    </div>
                    <input
                      type="number" min="0" max="500" placeholder="0"
                      value={sampleForm.actualDepth_cm}
                      onChange={e => setSampleForm(f => ({ ...f, actualDepth_cm: e.target.value }))}
                      style={{ width: '100%', padding: '9px 10px', borderRadius: '8px', border: `1px solid ${bgCardBorder}`, background: isDark ? 'rgba(255,255,255,0.06)' : '#F8FAFC', color: textPrimary, fontSize: '14px', fontWeight: 700, boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: textMuted, marginBottom: '5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Droplets size={11} color={textMuted} />
                      {t('Pool Area (m²)', 'Pool Area (m²)')}
                    </div>
                    <input
                      type="number" min="0" placeholder="0"
                      value={sampleForm.actualArea_m2}
                      onChange={e => setSampleForm(f => ({ ...f, actualArea_m2: e.target.value }))}
                      style={{ width: '100%', padding: '9px 10px', borderRadius: '8px', border: `1px solid ${bgCardBorder}`, background: isDark ? 'rgba(255,255,255,0.06)' : '#F8FAFC', color: textPrimary, fontSize: '14px', fontWeight: 700, boxSizing: 'border-box' }}
                    />
                  </div>
                </div>

                {/* Inspector confidence */}
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ fontSize: '11px', color: textMuted, marginBottom: '5px' }}>
                    {t(`Inspector Confidence: ${sampleForm.actualConfidence}%`, `Inspector Confidence: ${sampleForm.actualConfidence}%`)}
                  </div>
                  <input
                    type="range" min="50" max="100"
                    value={sampleForm.actualConfidence}
                    onChange={e => setSampleForm(f => ({ ...f, actualConfidence: e.target.value }))}
                    style={{ width: '100%', accentColor: accentBlue }}
                  />
                </div>

                {/* Inspector note */}
                <div style={{ marginBottom: '14px' }}>
                  <div style={{ fontSize: '11px', color: textMuted, marginBottom: '5px' }}>{t('Inspector Note (optional)', 'Inspector Note (optional)')}</div>
                  <textarea
                    rows={2}
                    placeholder={t('Describe what you observe in the field...', 'Describe what you observe in the field...')}
                    value={sampleForm.inspectorNote}
                    onChange={e => setSampleForm(f => ({ ...f, inspectorNote: e.target.value }))}
                    style={{ width: '100%', padding: '9px 10px', borderRadius: '8px', border: `1px solid ${bgCardBorder}`, background: isDark ? 'rgba(255,255,255,0.06)' : '#F8FAFC', color: textPrimary, fontSize: '12px', resize: 'vertical', boxSizing: 'border-box' }}
                  />
                </div>

                {/* Submit */}
                <button
                  onClick={submitSample}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'linear-gradient(135deg, #059669, #34D399)', border: 'none', color: 'white', fontWeight: 700, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  <CheckCircle size={15} />
                  {t('Confirm Sample & Send to Platform', 'Confirm Sample & Send to Platform')}
                </button>
              </div>
            )}

            {/* ── Gap Analysis Charts ── */}
            {groundTruthSamples.length > 0 && (
              <div style={{ background: bgCard, border: `1px solid ${bgCardBorder}`, borderRadius: '14px', padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <GitCompare size={14} color={accentBlue} />
                    <span style={{ fontSize: '12px', fontWeight: 700, color: textPrimary }}>{t('Gap Analysis — Reality vs Platform', 'Gap Analysis — Reality vs Platform')}</span>
                  </div>
                  {/* Tab switcher */}
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {([['depth', 'Depth', 'Depth'], ['area', 'Area', 'Area'], ['radar', 'Radar', 'Radar']] as [typeof activeGapTab, string, string][]).map(([key, ar, en]) => (
                      <button key={key} onClick={() => setActiveGapTab(key)}
                        style={{ padding: '4px 8px', borderRadius: '6px', border: 'none', fontSize: '10px', fontWeight: 700, cursor: 'pointer',
                          background: activeGapTab === key ? accentBlue : 'transparent',
                          color: activeGapTab === key ? 'white' : textMuted }}
                      >{t(ar, en)}</button>
                    ))}
                  </div>
                </div>
                {activeGapTab !== 'radar' ? (
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={gapChartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.06)' : '#E2E8F0'} />
                      <XAxis dataKey="name" tick={{ fontSize: 9, fill: textMuted }} />
                      <YAxis tick={{ fontSize: 9, fill: textMuted }} />
                      <Tooltip
                        contentStyle={{ background: isDark ? '#0F1E35' : '#fff', border: `1px solid ${bgCardBorder}`, borderRadius: '8px', fontSize: '11px' }}
                        labelStyle={{ color: textPrimary }}
                      />
                      <Legend wrapperStyle={{ fontSize: '10px' }} />
                      {activeGapTab === 'depth' ? (
                        <>
                          <Bar dataKey="actual" name={t('Actual (cm)', 'Actual (cm)')} fill="#34D399" radius={[4,4,0,0]} />
                          <Bar dataKey="platform" name={t('Platform (cm)', 'Platform (cm)')} fill={accentBlue} radius={[4,4,0,0]} />
                          <Bar dataKey="error" name={t('Gap (cm)', 'Gap (cm)')} fill="rgba(239,68,68,0.7)" radius={[4,4,0,0]} />
                        </>
                      ) : (
                        <>
                          <Bar dataKey="actualArea" name={t('Actual (m²)', 'Actual (m²)')} fill="#34D399" radius={[4,4,0,0]} />
                          <Bar dataKey="platformArea" name={t('Platform (m²)', 'Platform (m²)')} fill={accentBlue} radius={[4,4,0,0]} />
                        </>
                      )}
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div>
                    <div style={{ fontSize: '10px', color: textMuted, textAlign: 'center', marginBottom: '4px' }}>
                      {t('Multi-dimensional: Reality vs Platform', 'Multi-dimensional: Reality vs Platform')}
                    </div>
                    <ResponsiveContainer width="100%" height={200}>
                      <RadarChart data={radarCompareData} margin={{ top: 10, right: 20, left: 20, bottom: 10 }}>
                        <PolarGrid stroke={isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0'} />
                        <PolarAngleAxis dataKey="metric" tick={{ fontSize: 9, fill: textMuted }} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 8, fill: textMuted }} />
                        <Radar name={t('Field Reality', 'Field Reality')} dataKey="actual" stroke="#34D399" fill="#34D399" fillOpacity={0.25} />
                        <Radar name={t('Platform Prediction', 'Platform Prediction')} dataKey="platform" stroke={accentBlue} fill={accentBlue} fillOpacity={0.2} />
                        <Legend wrapperStyle={{ fontSize: '10px' }} />
                        <Tooltip contentStyle={{ background: isDark ? '#0F1E35' : '#fff', border: `1px solid ${bgCardBorder}`, borderRadius: '8px', fontSize: '11px' }} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                )}
                <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                  <div style={{ flex: 1, background: isDark ? 'rgba(52,211,153,0.08)' : '#F0FDF4', border: `1px solid ${isDark ? 'rgba(52,211,153,0.2)' : '#BBF7D0'}`, borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#34D399' }}>{statusMatchRate.toFixed(0)}%</div>
                    <div style={{ fontSize: '10px', color: textMuted }}>{t('Accuracy Classification', 'Classification Accuracy')}</div>
                  </div>
                  <div style={{ flex: 1, background: isDark ? 'rgba(245,158,11,0.08)' : '#FFFBEB', border: `1px solid ${isDark ? 'rgba(245,158,11,0.2)' : '#FDE68A'}`, borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#F59E0B' }}>{avgDepthError.toFixed(1)} cm</div>
                    <div style={{ fontSize: '10px', color: textMuted }}>{t('Average Depth Error', 'Avg Depth Error')}</div>
                  </div>
                  <div style={{ flex: 1, background: isDark ? 'rgba(239,68,68,0.08)' : '#FEF2F2', border: `1px solid ${isDark ? 'rgba(239,68,68,0.2)' : '#FECACA'}`, borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#EF4444' }}>{avgAreaError.toFixed(0)}%</div>
                    <div style={{ fontSize: '10px', color: textMuted }}>{t('Error Area', 'Area Error')}</div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Samples List ── */}
            <div style={{ background: bgCard, border: `1px solid ${bgCardBorder}`, borderRadius: '14px', padding: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: textPrimary, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FlaskConical size={13} color={accentBlue} />
                {t('Ground Truth Sample Log', 'Ground Truth Sample Log')}
              </div>
              {groundTruthSamples.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 0', color: textMuted, fontSize: '12px' }}>
                  {t('No samples yet. Press New Sample to start.', 'No samples yet. Press New Sample to start.')}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {groundTruthSamples.map(sample => {
                    const matchColor = sample.statusMatch ? '#34D399' : '#EF4444';
                    const depthErrAbs = Math.abs(sample.depthError_cm);
                    return (
                      <div key={sample.id} style={{ background: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC', border: `1px solid ${sample.statusMatch ? 'rgba(52,211,153,0.25)' : 'rgba(239,68,68,0.25)'}`, borderRadius: '10px', padding: '12px' }}>
                        {/* Header row */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <MapPin size={12} color={accentBlue} />
                            <span style={{ fontSize: '11px', fontWeight: 700, color: textPrimary }}>
                              {t(sample.targetNameAr, sample.targetNameEn)}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '10px', fontWeight: 700, color: matchColor, background: `${matchColor}18`, padding: '2px 7px', borderRadius: '20px' }}>
                              {sample.statusMatch ? t('Match', 'Match') : t('Gap', 'Gap')}
                            </span>
                            {!sample.synced && <span style={{ fontSize: '9px', color: '#F59E0B', background: 'rgba(245,158,11,0.12)', padding: '2px 6px', borderRadius: '10px' }}>{t('Unsynced', 'Unsynced')}</span>}
                          </div>
                        </div>
                        {/* Comparison grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '8px' }}>
                          {[{
                            labelAr: 'Actual Depth', labelEn: 'Actual Depth',
                            actual: `${sample.actualDepth_cm} cm`,
                            platform: `${sample.platformDepth_cm} cm`,
                            errorLabel: depthErrAbs > 0 ? `Gap ${depthErrAbs} cm` : 'Match',
                            errorColor: depthErrAbs > 10 ? '#EF4444' : depthErrAbs > 3 ? '#F59E0B' : '#34D399',
                          }, {
                            labelAr: 'Actual Area', labelEn: 'Actual Area',
                            actual: `${sample.actualArea_m2} m²`,
                            platform: `${sample.platformArea_m2} m²`,
                            errorLabel: `${Math.abs(sample.areaError_pct).toFixed(0)}% Error`,
                            errorColor: Math.abs(sample.areaError_pct) > 50 ? '#EF4444' : Math.abs(sample.areaError_pct) > 20 ? '#F59E0B' : '#34D399',
                          }, {
                            labelAr: 'Classification', labelEn: 'Classification',
                            actual: t(sample.actualStatus === 'flooded' ? 'Flood' : sample.actualStatus === 'wet' ? 'Wet' : 'Dry', sample.actualStatus),
                            platform: t(sample.platformStatus === 'flooded' ? 'Flood' : sample.platformStatus === 'wet' ? 'Wet' : 'Dry', sample.platformStatus),
                            errorLabel: sample.statusMatch ? t('Exact Match', 'Exact Match') : t('Wrong Class', 'Wrong Class'),
                            errorColor: sample.statusMatch ? '#34D399' : '#EF4444',
                          }].map((col, i) => (
                            <div key={i} style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#F1F5F9', borderRadius: '7px', padding: '7px 8px' }}>
                              <div style={{ fontSize: '9px', color: textMuted, marginBottom: '4px' }}>{t(col.labelAr, col.labelEn)}</div>
                              <div style={{ fontSize: '12px', fontWeight: 800, color: '#34D399' }}>{col.actual}</div>
                              <div style={{ fontSize: '10px', color: textSecondary }}>{t('Platform:', 'Platform:')} {col.platform}</div>
                              <div style={{ fontSize: '9px', fontWeight: 700, color: col.errorColor, marginTop: '3px' }}>{col.errorLabel}</div>
                            </div>
                          ))}
                        </div>
                        {/* Note */}
                        {sample.inspectorNote && (
                          <div style={{ fontSize: '10px', color: textSecondary, background: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC', borderRadius: '6px', padding: '6px 8px', marginBottom: '8px' }}>
                            “{sample.inspectorNote}”
                          </div>
                        )}
                        {/* Actions */}
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {!sample.usedForTraining && (
                            <button
                              onClick={() => markForTraining(sample.id)}
                              style={{ flex: 1, padding: '6px', borderRadius: '7px', border: `1px solid ${accentBlue}`, background: 'transparent', color: accentBlue, fontSize: '10px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                            >
                              <Award size={11} />
                              {t('Send to Training', 'Send to Training')}
                            </button>
                          )}
                          {sample.usedForTraining && (
                            <div style={{ flex: 1, padding: '6px', borderRadius: '7px', background: 'rgba(52,211,153,0.1)', color: '#34D399', fontSize: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                              <CheckCircle size={11} />
                              {t('Used for Training', 'Used for Training')}
                            </div>
                          )}
                          <div style={{ fontSize: '9px', color: textMuted, display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <Clock size={9} />
                            {new Date(sample.timestamp).toLocaleTimeString('ar-AE', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Free Sample (Inspector-initiated) ── */}
            <div style={{ background: bgCard, border: `1px solid ${isDark ? 'rgba(245,158,11,0.3)' : '#FDE68A'}`, borderRadius: '14px', padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Radio size={14} color="#F59E0B" />
                  <span style={{ fontSize: '12px', fontWeight: 700, color: textPrimary }}>{t('Free Sample — Unscheduled Point', 'Free Sample — Unscheduled Point')}</span>
                </div>
                <button
                  onClick={() => setShowFreeSampleForm(f => !f)}
                  style={{ padding: '5px 10px', borderRadius: '8px', border: `1px solid rgba(245,158,11,0.4)`, background: showFreeSampleForm ? 'rgba(245,158,11,0.15)' : 'transparent', color: '#F59E0B', fontSize: '10px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  {showFreeSampleForm ? <X size={11} /> : <Plus size={11} />}
                  {showFreeSampleForm ? t('Close', 'Close') : t('New Sample', 'New Sample')}
                </button>
              </div>
              <div style={{ fontSize: '11px', color: textSecondary, marginBottom: showFreeSampleForm ? '14px' : '0', lineHeight: 1.5 }}>
                {t(
                  'For any water pool not in the Monitoring Plan — record actual measurements to feed the Model with new data.',
                  'For any water pool not in the monitoring plan — record actual measurements to feed the model with new data.'
                )}
              </div>
              {showFreeSampleForm && (
                <div>
                  {/* Location description */}
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '11px', color: textMuted, marginBottom: '5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <MapPin size={11} color="#F59E0B" />
                      {t('Description Location', 'Location Description')}
                    </div>
                    <input
                      type="text"
                      placeholder={t('e.g.: Al Wahda St intersection with St 21...', 'e.g.: Al Wahda St intersection with St 21...')}
                      value={freeSampleForm.locationDesc}
                      onChange={e => setFreeSampleForm(f => ({ ...f, locationDesc: e.target.value }))}
                      style={{ width: '100%', padding: '9px 10px', borderRadius: '8px', border: `1px solid ${bgCardBorder}`, background: isDark ? 'rgba(255,255,255,0.06)' : '#F8FAFC', color: textPrimary, fontSize: '12px', boxSizing: 'border-box' }}
                    />
                  </div>
                  {/* Status selector */}
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '11px', color: textMuted, marginBottom: '6px' }}>{t('Actual Water Status', 'Actual Water Status')}</div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {(['dry', 'wet', 'flooded'] as AnalysisStatus[]).map(s => (
                        <button key={s} onClick={() => setFreeSampleForm(f => ({ ...f, actualStatus: s }))}
                          style={{ flex: 1, padding: '8px 4px', borderRadius: '8px', border: `1px solid ${freeSampleForm.actualStatus === s ? (s === 'dry' ? '#6B7280' : s === 'wet' ? '#3B82F6' : '#EF4444') : bgCardBorder}`, background: freeSampleForm.actualStatus === s ? (s === 'dry' ? 'rgba(107,114,128,0.15)' : s === 'wet' ? 'rgba(59,130,246,0.15)' : 'rgba(239,68,68,0.15)') : 'transparent', color: freeSampleForm.actualStatus === s ? (s === 'dry' ? '#9CA3AF' : s === 'wet' ? '#60A5FA' : '#F87171') : textMuted, fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                        >
                          {t(s === 'dry' ? 'Dry' : s === 'wet' ? 'Wet' : 'Flooded', s === 'dry' ? 'Dry' : s === 'wet' ? 'Wet' : 'Flooded')}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Depth & Area inputs */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                    <div>
                      <div style={{ fontSize: '11px', color: textMuted, marginBottom: '5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Ruler size={11} color={textMuted} />
                        {t('Water Depth (cm)', 'Water Depth (cm)')}
                      </div>
                      <input
                        type="number" min="0" max="500" placeholder="0"
                        value={freeSampleForm.actualDepth_cm}
                        onChange={e => setFreeSampleForm(f => ({ ...f, actualDepth_cm: e.target.value }))}
                        style={{ width: '100%', padding: '9px 10px', borderRadius: '8px', border: `1px solid ${bgCardBorder}`, background: isDark ? 'rgba(255,255,255,0.06)' : '#F8FAFC', color: textPrimary, fontSize: '14px', fontWeight: 700, boxSizing: 'border-box' }}
                      />
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: textMuted, marginBottom: '5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Droplets size={11} color={textMuted} />
                        {t('Pool Area (m²)', 'Pool Area (m²)')}
                      </div>
                      <input
                        type="number" min="0" placeholder="0"
                        value={freeSampleForm.actualArea_m2}
                        onChange={e => setFreeSampleForm(f => ({ ...f, actualArea_m2: e.target.value }))}
                        style={{ width: '100%', padding: '9px 10px', borderRadius: '8px', border: `1px solid ${bgCardBorder}`, background: isDark ? 'rgba(255,255,255,0.06)' : '#F8FAFC', color: textPrimary, fontSize: '14px', fontWeight: 700, boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>
                  {/* Inspector confidence */}
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '11px', color: textMuted, marginBottom: '5px' }}>
                      {t(`Confidence Inspector: ${freeSampleForm.actualConfidence}%`, `Inspector Confidence: ${freeSampleForm.actualConfidence}%`)}
                    </div>
                    <input
                      type="range" min="50" max="100"
                      value={freeSampleForm.actualConfidence}
                      onChange={e => setFreeSampleForm(f => ({ ...f, actualConfidence: e.target.value }))}
                      style={{ width: '100%', accentColor: '#F59E0B' }}
                    />
                  </div>
                  {/* Inspector note */}
                  <div style={{ marginBottom: '14px' }}>
                    <div style={{ fontSize: '11px', color: textMuted, marginBottom: '5px' }}>{t('Additional Note (optional)', 'Additional Note (optional)')}</div>
                    <textarea
                      rows={2}
                      placeholder={t('Describe what you observe in the field...', 'Describe what you observe in the field...')}
                      value={freeSampleForm.inspectorNote}
                      onChange={e => setFreeSampleForm(f => ({ ...f, inspectorNote: e.target.value }))}
                      style={{ width: '100%', padding: '9px 10px', borderRadius: '8px', border: `1px solid ${bgCardBorder}`, background: isDark ? 'rgba(255,255,255,0.06)' : '#F8FAFC', color: textPrimary, fontSize: '12px', resize: 'vertical', boxSizing: 'border-box' }}
                    />
                  </div>
                  {/* Submit */}
                  <button
                    onClick={submitFreeSample}
                    disabled={!freeSampleForm.locationDesc.trim()}
                    style={{ width: '100%', padding: '12px', borderRadius: '10px', background: freeSampleForm.locationDesc.trim() ? 'linear-gradient(135deg, #D97706, #F59E0B)' : bgCardBorder, border: 'none', color: freeSampleForm.locationDesc.trim() ? 'white' : textMuted, fontWeight: 700, fontSize: '13px', cursor: freeSampleForm.locationDesc.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  >
                    <Radio size={15} />
                    {t('Record Free Sample & Send to Training', 'Record Free Sample & Send to Training')}
                  </button>
                 </div>
              )}
            </div>
            {/* ── Feed to Learning Loop CTA ── */}
            {groundTruthSamples.length > 0 && (
              <div style={{ background: isDark ? 'rgba(52,211,153,0.06)' : '#F0FDF4', border: `1px solid ${isDark ? 'rgba(52,211,153,0.2)' : '#BBF7D0'}`, borderRadius: '14px', padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <TrendingUp size={14} color="#34D399" />
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#34D399' }}>
                    {t('Your data is ready to feed the learning loop', 'Your data is ready to feed the learning loop')}
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: textSecondary, marginBottom: '12px', lineHeight: 1.5 }}>
                  {t(
                    `You have ${groundTruthSamples.length} real samples — ${groundTruthSamples.filter(s => s.usedForTraining).length} sent for training. Go to the Learning mode to track Model Accuracy evolution.`,
                    `You have ${groundTruthSamples.length} ground truth samples — ${groundTruthSamples.filter(s => s.usedForTraining).length} sent to training. Switch to Learning mode to track model accuracy evolution.`
                  )}
                </div>
                <button
                  onClick={() => setMode('learning')}
                  style={{ width: '100%', padding: '11px', borderRadius: '10px', background: 'linear-gradient(135deg, #059669, #34D399)', border: 'none', color: 'white', fontWeight: 700, fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  <TrendingUp size={14} />
                  {t('View Model Accuracy Evolution →', 'View Model Accuracy Evolution →')}
                </button>
              </div>
            )}
          </div>
        )}
        {/* ════════════════════════════════════════════════════════════════════════════
            MODE 4: ACTIVE LEARNING LOOP
        ════════════════════════════════════════════════════════════════════════════ */}
        {mode === 'learning' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Model accuracy card */}
            <div style={{ background: bgCard, border: `1px solid ${bgCardBorder}`, borderRadius: '14px', padding: '20px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: textSecondary, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <TrendingUp size={12} color={accentBlue} />
                {t('Active Learning Loop', 'Active Learning Loop')}
              </div>

              {/* Accuracy meter */}
              <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                <div style={{ fontSize: '42px', fontWeight: 900, fontFamily: 'Space Mono', color: accentBlue, lineHeight: 1 }}>
                  {modelAccuracy.toFixed(1)}%
                </div>
                <div style={{ fontSize: '11px', color: textMuted, marginTop: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                  {t('Current Model Accuracy', 'Current Model Accuracy')}
                  <InfoTooltip content={{ ...SL_TOOLTIPS.modelAccuracy, value: `${modelAccuracy.toFixed(1)}%` }} size="sm" />
                </div>
                <div style={{ marginTop: '10px', height: '8px', borderRadius: '4px', background: isDark ? 'rgba(255,255,255,0.08)' : '#E5E7EB', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${modelAccuracy}%`, background: `linear-gradient(90deg, ${accentBlue}, #34D399)`, borderRadius: '4px', transition: 'width 0.8s ease' }} />
                </div>
              </div>

              {/* Stats grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                {[
                  { labelAr: 'Frames Analyzed', labelEn: 'Frames Analyzed', value: analysisFrames.length, icon: Camera },
                  { labelAr: 'Ground Truth Samples', labelEn: 'Ground Truth', value: groundTruthSamples.length, icon: FlaskConical },
                  { labelAr: 'Pending Sync', labelEn: 'Pending Sync', value: pendingSync, icon: Send },
                ].map((stat, i) => (
                  <div key={i} style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC', borderRadius: '10px', padding: '12px', textAlign: 'center', border: `1px solid ${bgCardBorder}` }}>
                    <stat.icon size={14} color={accentBlue} />
                    <div style={{ fontSize: '18px', fontWeight: 800, color: textPrimary, fontFamily: 'Space Mono', marginTop: '4px' }}>{stat.value}</div>
                    <div style={{ fontSize: '9px', color: textMuted, marginTop: '2px' }}>{isRtl ? stat.labelAr : stat.labelEn}</div>
                  </div>
                ))}
              </div>
              {/* Accuracy trend chart */}
              <div style={{ borderTop: `1px solid ${bgCardBorder}`, paddingTop: '14px' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: textSecondary, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <TrendingUp size={11} color="#34D399" />
                  {t('Model Accuracy Evolution Across Field Sessions', 'Model Accuracy Evolution Across Field Sessions')}
                </div>
                <ResponsiveContainer width="100%" height={130}>
                  <LineChart data={liveAccuracyHistory} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.06)' : '#E2E8F0'} />
                    <XAxis dataKey="session" tick={{ fontSize: 9, fill: textMuted }} />
                    <YAxis domain={[60, 100]} tick={{ fontSize: 9, fill: textMuted }} />
                    <Tooltip
                      contentStyle={{ background: isDark ? '#0F1E35' : '#fff', border: `1px solid ${bgCardBorder}`, borderRadius: '8px', fontSize: '11px' }}
                      labelStyle={{ color: textPrimary }}
                      formatter={(val: number) => [`${val}%`, t('Model Accuracy', 'Model Accuracy')]}
                    />
                    <ReferenceLine y={80} stroke="rgba(52,211,153,0.4)" strokeDasharray="4 4" label={{ value: '80%', position: 'right', fontSize: 8, fill: '#34D399' }} />
                    <Line
                      type="monotone" dataKey="accuracy"
                      stroke="#34D399" strokeWidth={2}
                      dot={{ fill: '#34D399', r: 4, strokeWidth: 0 }}
                      activeDot={{ r: 6, fill: '#34D399' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
                <div style={{ fontSize: '9px', color: textMuted, textAlign: 'center', marginTop: '4px' }}>
                  {t('Each new ground truth sample improves accuracy +0.8%', 'Each new ground truth sample improves accuracy +0.8%')}
                </div>
              </div>
            </div>

            {/* Free observation button */}
            <div style={{ background: bgCard, border: `1px solid ${bgCardBorder}`, borderRadius: '14px', padding: '16px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: textSecondary, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Radio size={12} color={accentBlue} />
                {t('Free Observation — Report Random Pooling', 'Free Observation — Report Random Pooling')}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={newObsNote}
                  onChange={e => setNewObsNote(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addObservation()}
                  placeholder={t('Describe the water pooling...', 'Describe the water pooling...')}
                  style={{
                    flex: 1, padding: '10px 12px', borderRadius: '10px',
                    background: isDark ? 'rgba(255,255,255,0.06)' : '#F8FAFC',
                    border: `1px solid ${bgCardBorder}`,
                    color: textPrimary, fontSize: '12px',
                    outline: 'none', direction: isRtl ? 'rtl' : 'ltr',
                  }}
                />
                <button
                  onClick={addObservation}
                  style={{ padding: '10px 16px', borderRadius: '10px', background: accentBlue, border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 700 }}
                >
                  <Plus size={14} />
                  {t('Report', 'Report')}
                </button>
              </div>
              <div style={{ fontSize: '10px', color: textMuted, marginTop: '6px' }}>
                {t('Data classified as "random discovery data" to enrich the Model database', 'Data classified as "random discovery data" to enrich model training')}
              </div>
            </div>

            {/* Offline mode indicator */}
            <div style={{ background: isOnline ? (isDark ? 'rgba(16,185,129,0.08)' : '#F0FDF4') : (isDark ? 'rgba(245,158,11,0.08)' : '#FFFBEB'), border: `1px solid ${isOnline ? 'rgba(16,185,129,0.25)' : 'rgba(245,158,11,0.25)'}`, borderRadius: '12px', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              {isOnline ? <Wifi size={16} color="#10B981" /> : <WifiOff size={16} color="#F59E0B" />}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: isOnline ? '#10B981' : '#F59E0B' }}>
                  {isOnline ? t('Online — Data uploading in real-time', 'Online — Data uploading in real-time') : t('Offline — Data saved locally', 'Offline Mode — Data saved locally')}
                </div>
                <div style={{ fontSize: '10px', color: textMuted, marginTop: '2px' }}>
                  {isOnline
                    ? t('Auto-sync system active', 'Auto-sync system active')
                    : t(`${pendingSync} records queued for sync when connection restored`, `${pendingSync} records queued for sync when connection restored`)}
                </div>
              </div>
              {!isOnline && pendingSync > 0 && (
                <button
                  onClick={syncData}
                  style={{ padding: '6px 12px', borderRadius: '8px', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', color: '#F59E0B', fontSize: '11px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <RefreshCw size={11} />
                  {t('Sync', 'Sync')}
                </button>
              )}
            </div>

            {/* Observations list */}
            {freeObservations.length > 0 && (
              <div style={{ background: bgCard, border: `1px solid ${bgCardBorder}`, borderRadius: '14px', padding: '14px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: textSecondary, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Eye size={12} color={accentBlue} />
                  {t('Recorded Free Observations', 'Recorded Free Observations')}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {freeObservations.map(obs => (
                    <div key={obs.id} style={{ padding: '10px 12px', borderRadius: '8px', background: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC', border: `1px solid ${bgCardBorder}`, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '12px', color: textPrimary, marginBottom: '3px' }}>{isRtl ? obs.noteAr : obs.noteEn}</div>
                        <div style={{ fontSize: '10px', color: textMuted, fontFamily: 'Space Mono' }}>
                          {obs.lat.toFixed(5)}°N · {new Date(obs.timestamp).toLocaleTimeString(isRtl ? 'ar-AE' : 'en-AE')}
                        </div>
                      </div>
                      {obs.synced
                        ? <CheckCircle size={13} color="#10B981" style={{ flexShrink: 0 }} />
                        : <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#F59E0B', flexShrink: 0, marginTop: '3px', animation: 'liveRecord 1.5s ease-in-out infinite' }} />
                      }
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Learning loop explanation */}
            <div style={{ background: isDark ? 'rgba(96,165,250,0.06)' : '#EFF6FF', border: `1px solid ${isDark ? 'rgba(96,165,250,0.15)' : '#BFDBFE'}`, borderRadius: '12px', padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <Shield size={13} color={accentBlue} />
                <span style={{ fontSize: '11px', fontWeight: 700, color: accentBlue }}>{t('How does Active Learning work?', 'How does Active Learning work?')}</span>
              </div>
              <div style={{ fontSize: '11px', color: textSecondary, lineHeight: 1.6 }}>
                {t(
                  'The data you collect is not just documentation — it is "Ground Truth" that feeds the Model to correct itself. The points you visit are the areas where the Model records the highest "Uncertainty" score, ensuring every field trip achieves maximum impact on improving platform accuracy.',
                  'The data you collect is not just documentation — it is "ground truth" that feeds the model to self-correct. The points you visit are areas where the model records the highest "uncertainty score", ensuring every field trip maximizes impact on platform accuracy improvement.'
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            MODE 5: Vehicle Survey Mode
            Target: Monitor water pools on road edge + reality matching + Model correction
        ═══════════════════════════════════════════════════════════════════ */}
        {mode === 'vehicle' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

            {/* Mode description */}
            <div style={{ background: isDark ? 'rgba(0,212,255,0.06)' : '#EFF6FF', border: `1px solid ${isDark ? 'rgba(0,212,255,0.2)' : '#BAE6FD'}`, borderRadius: '12px', padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <Car size={14} color='#00D4FF' />
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#00D4FF' }}>Vehicle Survey Mode</span>
              </div>
              <div style={{ fontSize: '11px', color: textSecondary, lineHeight: 1.7 }}>
                Monitor water pools on road edges while driving — captures images automatically every {vehicleCaptureInterval} seconds with threshold. Coordinates and analyzes floods immediately.
                Results are compared with platform predictions to self-correct the Model.
              </div>
            </div>

            {/* Mode tabs */}
            <div style={{ display: 'flex', borderRadius: '10px', overflow: 'hidden', border: `1px solid ${bgCardBorder}` }}>
              {(['map', 'camera', 'gallery', 'stats'] as const).map((tab) => {
                const labels: Record<string, string> = { map: '🗺️ Map', camera: '📷 Camera', gallery: '🖼️ Gallery', stats: '📊 Analysis' };
                const isActive = vehicleActiveTab === tab;
                const hasPhotos = tab === 'gallery' && vehicleScanPoints.filter(p => p.imageDataUrl).length > 0;
                return (
                  <button key={tab} onClick={() => setVehicleActiveTab(tab as 'map' | 'camera' | 'gallery' | 'stats')} style={{
                    flex: 1, padding: '9px', fontSize: '11px', fontWeight: isActive ? 700 : 400,
                    color: isActive ? '#00D4FF' : textMuted,
                    background: isActive ? (isDark ? 'rgba(0,212,255,0.08)' : 'rgba(0,150,200,0.06)') : 'transparent',
                    border: 'none', borderBottom: `2px solid ${isActive ? '#00D4FF' : 'transparent'}`,
                    cursor: 'pointer', transition: 'all 0.15s', position: 'relative',
                  }}>
                    {labels[tab]}
                    {hasPhotos && <span style={{ position: 'absolute', top: 4, right: 4, width: 6, height: 6, borderRadius: '50%', background: '#10B981' }} />}
                  </button>
                );
              })}
            </div>

            {/* Tab: Map */}
            {vehicleActiveTab === 'map' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {/* Quick stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '8px' }}>
                  {[
                    { label: 'Survey Points', value: vehicleStats.total, color: '#00D4FF' },
                    { label: '🔴 Flood', value: vehicleStats.flooded, color: '#EF4444' },
                    { label: '🟡 Wet', value: vehicleStats.wet, color: '#F59E0B' },
                    { label: 'Match %', value: vehicleStats.matchRate, color: vehicleStats.matchRate > 75 ? '#10B981' : '#F59E0B' },
                  ].map(k => (
                    <div key={k.label} style={{ background: bgCard, border: `1px solid ${k.color}22`, borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: k.color }}>{k.value}{k.label === 'Match %' ? '%' : ''}</div>
                      <div style={{ fontSize: '9px', color: textMuted, marginTop: '2px' }}>{k.label}</div>
                    </div>
                  ))}
                </div>

                {/* Map GPS */}
                <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', border: `1px solid ${bgCardBorder}` }}>
                  {!vehicleSessionActive ? (
                    <div style={{ height: '300px', background: isDark ? '#0D1117' : '#F0F4F8', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
                      <Car size={40} color={isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'} />
                      <div style={{ fontSize: '13px', color: textMuted }}>Start survey session to activate Map</div>
                      <button onClick={vehicleStartSession} style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '10px 24px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                        background: 'linear-gradient(135deg,#10B981,#059669)',
                        color: '#fff', fontSize: '14px', fontWeight: 700,
                        boxShadow: '0 2px 12px rgba(16,185,129,0.3)',
                      }}>
                        <Play size={16} /> Start Survey Session
                      </button>
                    </div>
                  ) : (
                    <div>
                      {/* Active session badge */}
                      <div style={{ padding: '8px 12px', background: isDark ? 'rgba(239,68,68,0.1)' : '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#EF4444', animation: 'liveRecord 1s ease-in-out infinite' }} />
                          <span style={{ fontSize: '11px', color: '#EF4444', fontWeight: 700 }}>Active Survey — {vehicleStats.sessionDurationMin} min</span>
                          <span style={{ fontSize: '10px', color: textMuted }}>GPS: {vehicleGpsActive ? `±${vehicleGpsAccuracy}m` : 'Inactive'}</span>
                        </div>
                        <button onClick={vehicleStopSession} style={{
                          display: 'flex', alignItems: 'center', gap: '5px',
                          padding: '5px 12px', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.4)',
                          background: 'rgba(239,68,68,0.1)', color: '#EF4444',
                          fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                        }}>
                          <Square size={11} /> Stop
                        </button>
                      </div>
                      {/* Map Leaflet */}
                      <div ref={vehicleMapDivRef} style={{ height: '320px', width: '100%' }} />
                      {/* GPS statistics */}
                      <div style={{ padding: '6px 12px', background: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.05)', fontSize: '10px', color: textMuted, fontFamily: 'Space Mono', display: 'flex', gap: '12px' }}>
                        <span>📍 {vehicleGpsPos[0].toFixed(5)}°N {vehicleGpsPos[1].toFixed(5)}°E</span>
                        {vehicleGpsError && <span style={{ color: '#F59E0B' }}>⚠ GPS Simulation</span>}
                      </div>
                    </div>
                  )}
                </div>

                {/* Latest observed water pools */}
                {vehicleScanPoints.filter(p => p.floodStatus === 'flooded').length > 0 && (
                  <div style={{ background: bgCard, border: `1px solid rgba(239,68,68,0.2)`, borderRadius: '12px', padding: '12px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#EF4444', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Droplets size={12} />
                      Water pools observed on road edge
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflow: 'auto' }}>
                      {vehicleScanPoints.filter(p => p.floodStatus === 'flooded').slice(-5).reverse().map((pt, i) => (
                        <div key={pt.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', background: isDark ? 'rgba(239,68,68,0.06)' : '#FEF2F2', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.15)' }}>
                          <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: '#EF4444', flexShrink: 0 }}>{i+1}</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '11px', fontWeight: 600, color: '#EF4444' }}>
                              Length {pt.floodLengthM}m • Depth {pt.floodDepthCm}cm • {pt.side === 'left' ? 'Left side' : pt.side === 'right' ? 'Right side' : pt.side === 'both' ? 'Both sides' : ''}
                            </div>
                            <div style={{ fontSize: '9px', color: textMuted }}>{pt.lat.toFixed(5)}°N • {new Date(pt.timestamp).toLocaleTimeString('ar-AE')}</div>
                          </div>
                          <div style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: pt.matchesModel ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)', color: pt.matchesModel ? '#10B981' : '#EF4444', fontWeight: 600 }}>
                            {pt.matchesModel ? '✓' : '✗'}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: '8px', fontSize: '11px', color: textMuted, textAlign: 'center' }}>
                      Total Pool Length: <strong style={{ color: '#A78BFA' }}>{vehicleStats.totalFloodLength} m</strong>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab: Camera */}
            {vehicleActiveTab === 'camera' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {/* Fullscreen overlay for vehicle camera mode */}
                {vehicleCameraFullscreen && (
                  <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#000', display: 'flex', flexDirection: 'column' }}>
                    {/* Separate video for fullscreen - gets stream from useEffect */}
                    <video
                      ref={vehicleVideoFsRef}
                      autoPlay playsInline muted
                      onCanPlay={() => { if (vehicleVideoFsRef.current) vehicleVideoFsRef.current.play().catch(() => {}); }}
                      onLoadedMetadata={() => { if (vehicleVideoFsRef.current) vehicleVideoFsRef.current.play().catch(() => {}); }}
                      style={{ flex: 1, width: '100%', objectFit: 'cover' }}
                    />
                    <canvas ref={vehicleCanvasRef} style={{ display: 'none' }} />
                    {/* Fullscreen toolbar */}
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '16px 20px', background: 'linear-gradient(transparent, rgba(0,0,0,0.9))', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                      {/* Manual Capture */}
                      <button
                        onClick={() => { vehicleCaptureAndAnalyze(); setVehicleCameraFullscreen(false); }}
                        style={{ flex: 1, height: '56px', borderRadius: '16px', border: '1px solid rgba(0,212,255,0.4)', cursor: 'pointer', background: 'rgba(0,212,255,0.2)', backdropFilter: 'blur(10px)', color: '#00D4FF', fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                      >
                        <Camera size={20} /> Capture & Analyze
                      </button>
                      {/* Close */}
                      <button
                        onClick={() => setVehicleCameraFullscreen(false)}
                        style={{ width: '56px', height: '56px', borderRadius: '16px', border: 'none', cursor: 'pointer', background: 'rgba(239,68,68,0.3)', backdropFilter: 'blur(10px)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Minimize2 size={22} />
                      </button>
                    </div>
                    {/* LIVE badge + statistics */}
                    <div style={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', background: 'rgba(239,68,68,0.85)', borderRadius: '20px', padding: '4px 14px', fontSize: '11px', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#fff', animation: 'liveRecord 1s ease-in-out infinite' }} /> LIVE
                    </div>
                    <div style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(13,17,23,0.75)', borderRadius: '8px', padding: '4px 10px', fontSize: '10px', color: '#00D4FF', fontFamily: 'Space Mono' }}>
                      {vehicleGpsPos[0].toFixed(5)}°N
                    </div>
                  </div>
                )}
                {/* Camera screen */}
                <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', background: '#000', border: `1px solid ${bgCardBorder}` }}>
                  {/* Video permanently in DOM to avoid black screen issue on mobile */}
                  <video
                    ref={vehicleVideoRef}
                    autoPlay
                    playsInline
                    muted
                    onLoadedMetadata={() => { if (vehicleVideoRef.current) vehicleVideoRef.current.play().catch(() => {}); }}
                    style={{
                      width: '100%',
                      height: '240px',
                      objectFit: 'cover',
                      display: 'block',
                      visibility: vehicleCameraActive ? 'visible' : 'hidden',
                      position: vehicleCameraActive ? 'relative' : 'absolute',
                      top: 0, left: 0,
                    }}
                  />
                  <canvas ref={vehicleCanvasRef} style={{ display: 'none' }} />
                  {!vehicleCameraActive && (
                    <div style={{ height: '240px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', background: isDark ? '#0D1117' : '#F0F4F8' }}>
                      <Camera size={36} color={isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'} />
                      <div style={{ fontSize: '12px', color: textMuted }}>Camera not active</div>
                      <button onClick={vehicleStartCamera} style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#00D4FF,#0066FF)', color: '#fff', fontSize: '13px', fontWeight: 700 }}>
                        Start Camera
                      </button>
                    </div>
                  )}
                  {vehicleScanning && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,212,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid rgba(0,212,255,0.4)' }}>
                      <div style={{ background: isDark ? 'rgba(13,17,23,0.9)' : 'rgba(255,255,255,0.9)', borderRadius: '10px', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid rgba(0,212,255,0.3)' }}>
                        <RefreshCw size={14} color='#00D4FF' style={{ animation: 'spin 1s linear infinite' }} />
                        <span style={{ color: '#00D4FF', fontWeight: 700, fontSize: '13px' }}>Analyzing...</span>
                      </div>
                    </div>
                  )}
                  {/* Viewfinder corners + fullscreen button */}
                  {vehicleCameraActive && !vehicleScanning && (
                    <>
                      {[{top:10,left:10,borderTop:'2px solid #00D4FF',borderLeft:'2px solid #00D4FF'},{top:10,right:10,borderTop:'2px solid #00D4FF',borderRight:'2px solid #00D4FF'},{bottom:10,left:10,borderBottom:'2px solid #00D4FF',borderLeft:'2px solid #00D4FF'},{bottom:10,right:10,borderBottom:'2px solid #00D4FF',borderRight:'2px solid #00D4FF'}].map((s,i) => (
                        <div key={i} style={{ position:'absolute', width:20, height:20, ...s }} />
                      ))}
                      <div style={{ position:'absolute', top:8, left:'50%', transform:'translateX(-50%)', background:'rgba(13,17,23,0.8)', borderRadius:6, padding:'3px 10px', border:'1px solid rgba(0,212,255,0.3)', fontSize:10, color:'#00D4FF', fontFamily:'Space Mono', whiteSpace:'nowrap' }}>
                        {vehicleGpsPos[0].toFixed(5)}°N · {vehicleGpsPos[1].toFixed(5)}°E
                      </div>
                      {/* Fullscreen button */}
                      <button
                        onClick={() => setVehicleCameraFullscreen(true)}
                        style={{ position: 'absolute', bottom: 8, right: 8, width: '34px', height: '34px', borderRadius: '8px', border: '1px solid rgba(0,212,255,0.4)', cursor: 'pointer', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', color: '#00D4FF', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}
                        title='Fullscreen'
                      >
                        <Maximize2 size={16} />
                      </button>
                    </>
                  )}
                </div>

                {/* Capture settings */}
                <div style={{ background: bgCard, border: `1px solid ${bgCardBorder}`, borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>

                  {/* Smart monitoring button */}
                  <button
                    onClick={() => {
                      // Start GPS automatically if not active
                      if (!vehicleGpsActive) vehicleStartGPS();
                      setVehicleMonitorActive(p => !p);
                    }}
                    disabled={!vehicleCameraActive}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '11px 14px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '13px', color: '#fff', opacity: !vehicleCameraActive ? 0.4 : 1, background: vehicleMonitorActive ? 'linear-gradient(135deg,#EF4444,#DC2626)' : 'linear-gradient(135deg,#8B5CF6,#7C3AED)', transition: 'all 0.2s' }}>
                    {vehicleMonitorActive ? <><Square size={13} /> Stop Smart Monitoring</> : <><Zap size={13} /> Start Smart Monitoring ✨</>}
                  </button>

                  {/* Index Status AI */}
                  {vehicleMonitorActive && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '8px', background: vehicleAiStatus === 'water_found' ? 'rgba(239,68,68,0.12)' : vehicleAiStatus === 'scanning' ? 'rgba(139,92,246,0.12)' : vehicleAiStatus === 'no_water' ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.04)', border: `1px solid ${vehicleAiStatus === 'water_found' ? '#EF444433' : vehicleAiStatus === 'scanning' ? '#8B5CF633' : '#10B98133'}` }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: vehicleAiStatus === 'water_found' ? '#EF4444' : vehicleAiStatus === 'scanning' ? '#8B5CF6' : vehicleAiStatus === 'no_water' ? '#10B981' : '#64748B', animation: vehicleAiStatus === 'scanning' ? 'pulse 1s infinite' : 'none' }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: vehicleAiStatus === 'water_found' ? '#EF4444' : vehicleAiStatus === 'scanning' ? '#A78BFA' : vehicleAiStatus === 'no_water' ? '#10B981' : textMuted }}>
                          {vehicleAiStatus === 'scanning' ? '⚡ Checking image...' : vehicleAiStatus === 'water_found' ? '🚨 Water pool detected! Archived' : vehicleAiStatus === 'no_water' ? '✔ No water — continuing monitoring' : '👁 Continuous monitoring — checking every 3s'}
                        </div>
                        {vehicleAiStatus === 'water_found' && vehicleAiNotes && (
                          <div style={{ fontSize: '10px', color: textMuted, marginTop: 2 }}>{vehicleAiNotes}</div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Manual Capture */}
                  <button onClick={vehicleCaptureAndAnalyze} disabled={!vehicleCameraActive || vehicleScanning}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px', borderRadius: '10px', border: `2px solid rgba(0,212,255,0.4)`, background: 'rgba(0,212,255,0.08)', color: '#00D4FF', fontSize: '13px', fontWeight: 700, cursor: 'pointer', opacity: (!vehicleCameraActive || vehicleScanning) ? 0.4 : 1 }}>
                    <Camera size={15} /> Manual Capture & Analyze
                  </button>

                  {/* Last result */}
                  {vehicleScanPoints.length > 0 && (() => {
                    const last = vehicleScanPoints[vehicleScanPoints.length - 1];
                    const statusColor = last.floodStatus === 'flooded' ? '#EF4444' : last.floodStatus === 'wet' ? '#F59E0B' : '#10B981';
                    return (
                      <div style={{ background: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC', borderRadius: '8px', padding: '8px 10px', display: 'flex', alignItems: 'center', gap: '8px', border: `1px solid ${statusColor}33` }}>
                        {last.imageDataUrl && <img src={last.imageDataUrl} alt="" style={{ width: 44, height: 32, objectFit: 'cover', borderRadius: 4 }} />}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '11px', fontWeight: 700, color: statusColor }}>
                            {last.floodStatus === 'flooded' ? '🔴 Flood' : last.floodStatus === 'wet' ? '🟡 Wet' : '🟢 Dry'}
                            {last.floodLengthM > 0 && ` • ${last.floodLengthM}m`}
                            {last.floodDepthCm > 0 && ` • ${last.floodDepthCm}cm`}
                            {last.side !== 'none' && ` • ${last.side === 'left' ? 'Left' : last.side === 'right' ? 'Right' : 'Both sides'}`}
                          </div>
                          <div style={{ fontSize: '9px', color: textMuted }}>{new Date(last.timestamp).toLocaleTimeString('ar-AE')}</div>
                        </div>
                        <div style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: last.matchesModel ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)', color: last.matchesModel ? '#10B981' : '#EF4444', fontWeight: 600 }}>
                          {last.matchesModel ? '✓ Match' : '✗ Mismatch'}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Tab: Analysis & Matching */}
            {vehicleActiveTab === 'stats' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* KPIs */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '8px' }}>
                  {[
                    { label: 'Survey Points', value: `${vehicleStats.total}`, color: '#00D4FF', desc: 'Total analyzed points' },
                    { label: 'Model Match', value: `${vehicleStats.matchRate}%`, color: vehicleStats.matchRate > 75 ? '#10B981' : '#F59E0B', desc: 'Model match with reality' },
                    { label: 'Depth Error', value: `${vehicleStats.avgDepthError}cm`, color: '#A78BFA', desc: 'Average depth difference' },
                    { label: 'Pool Length', value: `${vehicleStats.totalFloodLength}m`, color: '#EF4444', desc: 'Total pool lengths' },
                  ].map(k => (
                    <div key={k.label} style={{ background: bgCard, border: `1px solid ${k.color}22`, borderRadius: '10px', padding: '12px' }}>
                      <div style={{ fontSize: '22px', fontWeight: 800, color: k.color }}>{k.value}</div>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: textPrimary, marginTop: '2px' }}>{k.label}</div>
                      <div style={{ fontSize: '10px', color: textMuted }}>{k.desc}</div>
                    </div>
                  ))}
                </div>

                {/* Match bar */}
                {vehicleStats.total > 0 && (
                  <div style={{ background: bgCard, border: `1px solid ${bgCardBorder}`, borderRadius: '12px', padding: '12px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: textPrimary, marginBottom: '8px' }}>Reality vs Model Match</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                      <span style={{ color: textSecondary }}>Match Percentage</span>
                      <span style={{ color: vehicleStats.matchRate > 75 ? '#10B981' : '#F59E0B', fontWeight: 700 }}>{vehicleStats.matchRate}%</span>
                    </div>
                    <div style={{ height: '8px', background: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${vehicleStats.matchRate}%`, background: vehicleStats.matchRate > 75 ? 'linear-gradient(90deg,#10B981,#059669)' : 'linear-gradient(90deg,#F59E0B,#D97706)', borderRadius: '4px', transition: 'width 0.5s' }} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '6px', marginTop: '10px' }}>
                      {[{label:'Dry',count:vehicleStats.dry,color:'#10B981'},{label:'Wet',count:vehicleStats.wet,color:'#F59E0B'},{label:'Flood',count:vehicleStats.flooded,color:'#EF4444'}].map(s => (
                        <div key={s.label} style={{ background: `${s.color}11`, border: `1px solid ${s.color}33`, borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
                          <div style={{ fontSize: '18px', fontWeight: 800, color: s.color }}>{s.count}</div>
                          <div style={{ fontSize: '10px', color: textMuted }}>{s.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Model correction alert */}
                {vehicleStats.total >= 5 && vehicleStats.matchRate < 70 && (
                  <div style={{ background: isDark ? 'rgba(245,158,11,0.08)' : '#FFFBEB', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '12px', padding: '12px', display: 'flex', gap: '10px' }}>
                    <AlertTriangle size={16} color='#F59E0B' style={{ flexShrink: 0, marginTop: 1 }} />
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#F59E0B', marginBottom: '3px' }}>Model Correction Required</div>
                      <div style={{ fontSize: '11px', color: textSecondary, lineHeight: 1.6 }}>
                        Match percentage {vehicleStats.matchRate}% is below 70%. This session data will feed the Model to automatically improve its accuracy.
                      </div>
                    </div>
                  </div>
                )}
                {vehicleStats.total >= 5 && vehicleStats.matchRate >= 70 && (
                  <div style={{ background: isDark ? 'rgba(16,185,129,0.08)' : '#F0FDF4', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '12px', padding: '12px', display: 'flex', gap: '10px' }}>
                    <CheckCircle size={16} color='#10B981' style={{ flexShrink: 0, marginTop: 1 }} />
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#10B981', marginBottom: '3px' }}>Model is performing well</div>
                      <div style={{ fontSize: '11px', color: textSecondary, lineHeight: 1.6 }}>
                        Match {vehicleStats.matchRate}% with field reality. Session data will reinforce the Model and improve its accuracy.
                      </div>
                    </div>
                  </div>
                )}

                {/* Detailed self-correction panel */}
                {vehicleStats.total > 0 && (() => {
                  const mismatches = vehicleScanPoints.filter(p => !p.matchesModel);
                  const dryWrong = mismatches.filter(p => p.floodStatus !== 'dry' && p.modelPrediction === 'dry').length;
                  const floodMissed = mismatches.filter(p => p.floodStatus === 'flooded' && p.modelPrediction !== 'flooded').length;
                  const overPredict = mismatches.filter(p => p.floodStatus === 'dry' && p.modelPrediction !== 'dry').length;
                  const corrections = [
                    dryWrong > 0 && { label: 'Flood not detected by Model', count: dryWrong, color: '#EF4444', icon: '🚨' },
                    floodMissed > 0 && { label: 'Flood missed by Model', count: floodMissed, color: '#F59E0B', icon: '⚠️' },
                    overPredict > 0 && { label: 'Predicted Flood that did not occur', count: overPredict, color: '#8B5CF6', icon: '📊' },
                  ].filter(Boolean) as { label: string; count: number; color: string; icon: string }[];
                  return (
                    <div style={{ background: bgCard, border: `1px solid ${bgCardBorder}`, borderRadius: '12px', padding: '12px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: textPrimary, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '14px' }}>🧠</span> Self-Correction Panel
                      </div>
                      {corrections.length === 0 ? (
                        <div style={{ fontSize: '11px', color: '#10B981', textAlign: 'center', padding: '8px' }}>✔ Model performing with high accuracy — no corrections needed</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {corrections.map(c => (
                            <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', borderRadius: '8px', background: `${c.color}11`, border: `1px solid ${c.color}33` }}>
                              <span style={{ fontSize: '14px' }}>{c.icon}</span>
                              <div style={{ flex: 1, fontSize: '11px', color: textSecondary }}>{c.label}</div>
                              <div style={{ fontSize: '14px', fontWeight: 800, color: c.color }}>{c.count}</div>
                            </div>
                          ))}
                          <div style={{ fontSize: '10px', color: textMuted, marginTop: '4px', lineHeight: 1.6 }}>
                            This data will be sent to the platform Model to improve its accuracy by region and time.
                          </div>
                        </div>
                      )}

                      {/* Export session data */}
                      {vehicleStats.total > 0 && (
                        <button
                          onClick={() => {
                            const data = vehicleScanPoints.map(p => ({
                              id: p.id, lat: p.lat, lng: p.lng,
                              time: new Date(p.timestamp).toISOString(),
                              status: p.floodStatus, depth: p.floodDepthCm,
                              length: p.floodLengthM, side: p.side,
                              confidence: p.confidence,
                              model: p.modelPrediction, match: p.matchesModel,
                              district: p.district, city: p.city, region: p.region,
                            }));
                            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url; a.download = `flood-scan-${Date.now()}.json`; a.click();
                            URL.revokeObjectURL(url);
                          }}
                          style={{ marginTop: '10px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '9px', borderRadius: '8px', border: `1px solid rgba(0,212,255,0.3)`, background: 'rgba(0,212,255,0.06)', color: '#00D4FF', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                          <Download size={13} /> Export Session Data JSON
                        </button>
                      )}
                    </div>
                  );
                })()}

                {/* Start session button if not started */}
                {!vehicleSessionActive && (
                  <button onClick={() => { setVehicleActiveTab('map'); vehicleStartSession(); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', borderRadius: '10px', border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#10B981,#059669)', color: '#fff', fontSize: '13px', fontWeight: 700 }}>
                    <Play size={15} /> Start New Survey Session
                  </button>
                )}
              </div>
            )}

            {/* Tab: Location View ──────────────────────────────────────────────── */}
            {vehicleActiveTab === 'gallery' && (() => {
              const allPhotos = vehicleScanPoints.filter(p => p.imageDataUrl);
              const filtered = vehicleGalleryFilter === 'all' ? allPhotos
                : allPhotos.filter(p => p.floodStatus === vehicleGalleryFilter);

              // Group by selected group
              const grouped: Record<string, VehicleScanPoint[]> = {};
              for (const p of filtered) {
                const key = vehicleGalleryGroup === 'region' ? p.region
                  : vehicleGalleryGroup === 'city' ? p.city
                  : p.district;
                if (!grouped[key]) grouped[key] = [];
                grouped[key].push(p);
              }

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

                  {/* Control bar */}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    {/* Filter Status */}
                    <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', border: `1px solid ${bgCardBorder}`, flex: 1, minWidth: 180 }}>
                      {(['all', 'flooded', 'wet'] as const).map(f => {
                        const fLabels = { all: 'All', flooded: '🔴 Flood', wet: '🟡 Wet' };
                        return (
                          <button key={f} onClick={() => setVehicleGalleryFilter(f)} style={{
                            flex: 1, padding: '6px 4px', fontSize: '10px', fontWeight: vehicleGalleryFilter === f ? 700 : 400,
                            color: vehicleGalleryFilter === f ? '#00D4FF' : textMuted,
                            background: vehicleGalleryFilter === f ? (isDark ? 'rgba(0,212,255,0.1)' : 'rgba(0,150,200,0.06)') : 'transparent',
                            border: 'none', cursor: 'pointer',
                          }}>{fLabels[f]}</button>
                        );
                      })}
                    </div>
                    {/* Group by */}
                    <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', border: `1px solid ${bgCardBorder}`, flex: 1, minWidth: 180 }}>
                      {(['region', 'city', 'district'] as const).map(g => {
                        const gLabels = { region: 'Emirate', city: 'City', district: 'District' };
                        return (
                          <button key={g} onClick={() => setVehicleGalleryGroup(g)} style={{
                            flex: 1, padding: '6px 4px', fontSize: '10px', fontWeight: vehicleGalleryGroup === g ? 700 : 400,
                            color: vehicleGalleryGroup === g ? '#00D4FF' : textMuted,
                            background: vehicleGalleryGroup === g ? (isDark ? 'rgba(0,212,255,0.1)' : 'rgba(0,150,200,0.06)') : 'transparent',
                            border: 'none', cursor: 'pointer',
                          }}>{gLabels[g]}</button>
                        );
                      })}
                    </div>
                  </div>

                  {/* No photos */}
                  {allPhotos.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '40px 20px', color: textMuted }}>
                      <div style={{ fontSize: '32px', marginBottom: '10px' }}>📷</div>
                      <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>No photos yet</div>
                      <div style={{ fontSize: '11px', opacity: 0.7 }}>Start a survey session and activate the Camera to capture location photos</div>
                    </div>
                  )}

                  {/* Area groups */}
                  {Object.entries(grouped).map(([groupName, points]) => {
                    // Calculate group totals
                    const grpFlooded = points.filter(p => p.floodStatus === 'flooded').length;
                    const grpWet = points.filter(p => p.floodStatus === 'wet').length;
                    const grpMaxLen = Math.max(...points.map(p => p.floodLengthM), 0);
                    const grpMaxDepth = Math.max(...points.map(p => p.floodDepthCm), 0);
                    return (
                      <div key={groupName} style={{ background: bgCard, border: `1px solid ${bgCardBorder}`, borderRadius: '12px', overflow: 'hidden' }}>
                        {/* Group header */}
                        <div style={{ padding: '10px 14px', background: isDark ? 'rgba(0,212,255,0.06)' : 'rgba(0,150,200,0.04)', borderBottom: `1px solid ${bgCardBorder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: textPrimary }}>📍 {groupName}</div>
                            <div style={{ fontSize: '10px', color: textMuted, marginTop: '2px' }}>
                              {points.length} photos • {grpFlooded > 0 ? `🔴 ${grpFlooded} Flood` : ''} {grpWet > 0 ? `🟡 ${grpWet} Wet` : ''}
                            </div>
                          </div>
                          <div style={{ textAlign: 'left', fontSize: '10px', color: textMuted }}>
                            {grpMaxLen > 0 && <div>Max pool length: <span style={{ color: '#F59E0B', fontWeight: 700 }}>{grpMaxLen}m</span></div>}
                            {grpMaxDepth > 0 && <div>Max pool depth: <span style={{ color: '#EF4444', fontWeight: 700 }}>{grpMaxDepth}cm</span></div>}
                          </div>
                        </div>

                        {/* Photo grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '1px', background: bgCardBorder }}>
                          {points.map(p => {
                            const pColor = p.floodStatus === 'flooded' ? '#EF4444' : p.floodStatus === 'wet' ? '#F59E0B' : '#10B981';
                            const barW = Math.min(100, Math.round((p.floodLengthM / 500) * 100));
                            return (
                              <div key={p.id}
                                onClick={() => setVehicleSelectedPhoto(p)}
                                style={{ position: 'relative', cursor: 'pointer', background: isDark ? '#0D1117' : '#F8FAFC', overflow: 'hidden' }}
                              >
                                {/* Image */}
                                <img src={p.imageDataUrl} alt="Field photo"
                                  style={{ width: '100%', height: '100px', objectFit: 'cover', display: 'block' }}
                                />
                                {/* Bottom bar */}
                                <div style={{ padding: '6px 8px', background: isDark ? 'rgba(13,17,23,0.95)' : 'rgba(255,255,255,0.97)' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                    <span style={{ fontSize: '10px', fontWeight: 700, color: pColor }}>
                                      {p.floodStatus === 'flooded' ? '🔴 Flood' : p.floodStatus === 'wet' ? '🟡 Wet' : '🟢 Dry'}
                                    </span>
                                    <span style={{ fontSize: '9px', color: textMuted }}>{p.floodDepthCm}cm</span>
                                  </div>
                                  {/* Pool size bar */}
                                  {p.floodLengthM > 0 && (
                                    <div>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', color: textMuted, marginBottom: '2px' }}>
                                        <span>Length</span><span style={{ color: pColor }}>{p.floodLengthM}m</span>
                                      </div>
                                      <div style={{ height: '3px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                                        <div style={{ height: '100%', width: `${barW}%`, background: pColor, borderRadius: '2px' }} />
                                      </div>
                                    </div>
                                  )}
                                  <div style={{ fontSize: '8px', color: textMuted, marginTop: '3px' }}>
                                    {p.district} • {new Date(p.timestamp).toLocaleTimeString('ar-AE', { hour: '2-digit', minute: '2-digit' })}
                                  </div>
                                </div>
                                {/* Mismatch badge */}
                                {!p.matchesModel && (
                                  <div style={{ position: 'absolute', top: 4, left: 4, background: '#EF4444', borderRadius: '4px', padding: '1px 5px', fontSize: '8px', color: '#fff', fontWeight: 700 }}>✗ Error</div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}

                  {/* Full photo view modal */}
                  {vehicleSelectedPhoto && (
                    <div
                      onClick={() => setVehicleSelectedPhoto(null)}
                      style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
                    >
                      <div onClick={e => e.stopPropagation()} style={{ background: isDark ? '#0D1117' : '#fff', borderRadius: '16px', overflow: 'hidden', maxWidth: '360px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}>
                        <img src={vehicleSelectedPhoto.imageDataUrl} alt="Field photo"
                          style={{ width: '100%', maxHeight: '240px', objectFit: 'cover', display: 'block' }}
                        />
                        <div style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                            <div>
                              <div style={{ fontSize: '14px', fontWeight: 700, color: vehicleSelectedPhoto.floodStatus === 'flooded' ? '#EF4444' : vehicleSelectedPhoto.floodStatus === 'wet' ? '#F59E0B' : '#10B981' }}>
                                {vehicleSelectedPhoto.floodStatus === 'flooded' ? '🔴 Flood' : vehicleSelectedPhoto.floodStatus === 'wet' ? '🟡 Wet' : '🟢 Dry'}
                              </div>
                              <div style={{ fontSize: '11px', color: textMuted, marginTop: '2px' }}>
                                📍 {vehicleSelectedPhoto.district} • {vehicleSelectedPhoto.city} • {vehicleSelectedPhoto.region}
                              </div>
                            </div>
                            <button onClick={() => setVehicleSelectedPhoto(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: textMuted, fontSize: '18px' }}>×</button>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px', marginBottom: '10px' }}>
                            {[
                              { label: 'Depth', value: `${vehicleSelectedPhoto.floodDepthCm}cm`, color: vehicleSelectedPhoto.floodStatus === 'flooded' ? '#EF4444' : '#F59E0B' },
                              { label: 'Pool Length', value: `${vehicleSelectedPhoto.floodLengthM}m`, color: '#F59E0B' },
                              { label: 'Side', value: vehicleSelectedPhoto.side === 'left' ? 'Left' : vehicleSelectedPhoto.side === 'right' ? 'Right' : vehicleSelectedPhoto.side === 'both' ? 'Both' : 'None', color: '#00D4FF' },
                            ].map(k => (
                              <div key={k.label} style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC', borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
                                <div style={{ fontSize: '14px', fontWeight: 800, color: k.color }}>{k.value}</div>
                                <div style={{ fontSize: '9px', color: textMuted, marginTop: '2px' }}>{k.label}</div>
                              </div>
                            ))}
                          </div>
                          {/* Large pool size bar */}
                          {vehicleSelectedPhoto.floodLengthM > 0 && (
                            <div style={{ marginBottom: '10px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: textMuted, marginBottom: '4px' }}>
                                <span>Pool size compared to Maximum (500m)</span>
                                <span style={{ color: '#F59E0B', fontWeight: 700 }}>{vehicleSelectedPhoto.floodLengthM}m</span>
                              </div>
                              <div style={{ height: '8px', background: isDark ? 'rgba(255,255,255,0.06)' : '#E2E8F0', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                                <div style={{ height: '100%', width: `${Math.min(100, (vehicleSelectedPhoto.floodLengthM / 500) * 100)}%`, background: 'linear-gradient(90deg,#F59E0B,#EF4444)', borderRadius: '4px', transition: 'width 0.5s ease' }} />
                                {/* Reference marks */}
                                {[100, 200, 300, 400].map(m => (
                                  <div key={m} style={{ position: 'absolute', top: 0, bottom: 0, left: `${(m/500)*100}%`, width: '1px', background: 'rgba(255,255,255,0.15)' }} />
                                ))}
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', color: textMuted, marginTop: '2px' }}>
                                <span>0m</span><span>100m</span><span>200m</span><span>300m</span><span>400m</span><span>500m</span>
                              </div>
                            </div>
                          )}
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: textMuted, borderTop: `1px solid ${bgCardBorder}`, paddingTop: '8px' }}>
                            <span style={{ color: vehicleSelectedPhoto.matchesModel ? '#10B981' : '#EF4444', fontWeight: 600 }}>
                              {vehicleSelectedPhoto.matchesModel ? '✓ Matches Model' : '✗ Differs from Model'}
                            </span>
                            <span>{new Date(vehicleSelectedPhoto.timestamp).toLocaleString('ar-AE')}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              );
            })()}

          </div>
        )}

      </div>
    </div>
  );
}
