// NotificationsPage.tsx — FloodSat AI
// Alert notification history, settings, and management
// Design: "Geological Strata" — Dark field operations interface

import { useState, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { trpc } from '@/lib/trpc';
import {
  Bell, BellOff, CheckCheck, Trash2, RefreshCw, Settings,
  AlertTriangle, Eye, Shield, Clock, MapPin, Droplets,
  ChevronDown, ChevronUp, Filter, Play, CheckCircle2,
  X, Save, ToggleLeft, ToggleRight, Info,
} from 'lucide-react';
import { toast } from 'sonner';

const GEO = {
  bgCard:    'rgba(21,34,51,0.88)',
  bgDeep:    'rgba(13,27,42,0.97)',
  bgPanel:   'rgba(16,30,46,0.95)',
  border:    'rgba(66,165,245,0.12)',
  borderHi:  'rgba(66,165,245,0.25)',
  blue:      '#42A5F5',
  teal:      '#4DD0E1',
  green:     '#43A047',
  orange:    '#FF8F00',
  red:       '#FF6B35',
  yellow:    '#FDD835',
  text:      '#E8F4F8',
  textSub:   '#90CAF9',
  textMuted: '#546E7A',
  fontHead:  'Playfair Display, Georgia, serif',
  fontMono:  'Space Mono, Courier New, monospace',
  fontAr:    'Noto Naskh Arabic, serif',
};

const LEVEL_CONFIG = {
  critical: { color: GEO.red,    bg: 'rgba(255,107,53,0.15)', icon: <AlertTriangle size={14} />, labelEn: 'Critical', labelAr: 'حرج' },
  warning:  { color: GEO.orange, bg: 'rgba(255,143,0,0.15)',  icon: <Eye size={14} />,           labelEn: 'Warning',  labelAr: 'تحذير' },
  watch:    { color: GEO.yellow, bg: 'rgba(253,216,53,0.12)', icon: <Shield size={14} />,        labelEn: 'Watch',    labelAr: 'مراقبة' },
};

type AlertLevel = 'critical' | 'warning' | 'watch';

interface AlertItem {
  id: number;
  regionId: string;
  regionNameEn: string;
  regionNameAr: string;
  alertLevel: AlertLevel;
  floodRisk: number;
  precipitation: string;
  notified: number;
  acknowledged: number;
  acknowledgedAt: Date | null;
  lat: string;
  lon: string;
  createdAt: Date;
}

function formatTime(date: Date, isAr: boolean): string {
  const d = new Date(date);
  return d.toLocaleString(isAr ? 'ar-AE' : 'en-AE', {
    timeZone: 'Asia/Dubai',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function AlertRow({ alert, isAr, onAck }: { alert: AlertItem; isAr: boolean; onAck: (id: number) => void }) {
  const [expanded, setExpanded] = useState(false);
  const lvl = LEVEL_CONFIG[alert.alertLevel];
  const isAcked = alert.acknowledged === 1;

  return (
    <div style={{
      background: isAcked ? 'rgba(13,27,42,0.6)' : GEO.bgCard,
      border: `1px solid ${isAcked ? GEO.border : lvl.color + '33'}`,
      borderRadius: 10,
      marginBottom: 8,
      overflow: 'hidden',
      opacity: isAcked ? 0.7 : 1,
      transition: 'all 0.2s',
    }}>
      {/* Main row */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer' }}
        onClick={() => setExpanded(!expanded)}
      >
        {/* Level badge */}
        <div style={{
          background: lvl.bg,
          border: `1px solid ${lvl.color}44`,
          borderRadius: 6,
          padding: '3px 8px',
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          minWidth: 90,
          justifyContent: 'center',
        }}>
          <span style={{ color: lvl.color }}>{lvl.icon}</span>
          <span style={{ color: lvl.color, fontSize: 11, fontWeight: 700, fontFamily: GEO.fontMono }}>
            {isAr ? lvl.labelAr : lvl.labelEn}
          </span>
        </div>

        {/* Region name */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            color: GEO.text,
            fontSize: 13,
            fontWeight: 600,
            fontFamily: isAr ? GEO.fontAr : 'inherit',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {isAr ? alert.regionNameAr : alert.regionNameEn}
          </div>
          <div style={{ color: GEO.textMuted, fontSize: 11, fontFamily: GEO.fontMono, marginTop: 2 }}>
            {formatTime(alert.createdAt, isAr)}
          </div>
        </div>

        {/* Risk score */}
        <div style={{ textAlign: 'center', minWidth: 50 }}>
          <div style={{ color: lvl.color, fontSize: 18, fontWeight: 700, fontFamily: GEO.fontMono, lineHeight: 1 }}>
            {alert.floodRisk}%
          </div>
          <div style={{ color: GEO.textMuted, fontSize: 10 }}>{isAr ? 'خطر' : 'risk'}</div>
        </div>

        {/* Notified badge */}
        <div style={{
          background: alert.notified ? 'rgba(67,160,71,0.15)' : 'rgba(84,110,122,0.15)',
          border: `1px solid ${alert.notified ? GEO.green + '44' : GEO.textMuted + '44'}`,
          borderRadius: 4,
          padding: '2px 6px',
          fontSize: 10,
          color: alert.notified ? GEO.green : GEO.textMuted,
          fontFamily: GEO.fontMono,
          minWidth: 60,
          textAlign: 'center',
        }}>
          {alert.notified ? (isAr ? 'أُرسل' : 'Sent') : (isAr ? 'محلي' : 'Local')}
        </div>

        {/* Ack button */}
        {!isAcked && (
          <button
            onClick={(e) => { e.stopPropagation(); onAck(alert.id); }}
            style={{
              background: 'rgba(66,165,245,0.1)',
              border: `1px solid ${GEO.blue}44`,
              borderRadius: 6,
              padding: '4px 10px',
              color: GEO.blue,
              fontSize: 11,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontFamily: GEO.fontMono,
            }}
          >
            <CheckCircle2 size={12} />
            {isAr ? 'تأكيد' : 'Ack'}
          </button>
        )}
        {isAcked && (
          <div style={{ color: GEO.green, display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
            <CheckCircle2 size={12} />
            <span style={{ fontFamily: GEO.fontMono }}>{isAr ? 'مؤكد' : 'Acked'}</span>
          </div>
        )}

        {/* Expand chevron */}
        <span style={{ color: GEO.textMuted }}>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div style={{
          borderTop: `1px solid ${GEO.border}`,
          padding: '12px 16px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: 12,
          background: 'rgba(13,27,42,0.5)',
        }}>
          <div>
            <div style={{ color: GEO.textMuted, fontSize: 10, fontFamily: GEO.fontMono, marginBottom: 3 }}>
              {isAr ? 'هطول الأمطار' : 'Precipitation'}
            </div>
            <div style={{ color: GEO.blue, fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
              <Droplets size={13} />
              {parseFloat(alert.precipitation).toFixed(1)} mm/hr
            </div>
          </div>
          <div>
            <div style={{ color: GEO.textMuted, fontSize: 10, fontFamily: GEO.fontMono, marginBottom: 3 }}>
              {isAr ? 'الإحداثيات' : 'Coordinates'}
            </div>
            <div style={{ color: GEO.textSub, fontSize: 12, fontFamily: GEO.fontMono, display: 'flex', alignItems: 'center', gap: 5 }}>
              <MapPin size={12} />
              {parseFloat(alert.lat).toFixed(4)}, {parseFloat(alert.lon).toFixed(4)}
            </div>
          </div>
          <div>
            <div style={{ color: GEO.textMuted, fontSize: 10, fontFamily: GEO.fontMono, marginBottom: 3 }}>
              {isAr ? 'وقت التنبيه' : 'Alert Time'}
            </div>
            <div style={{ color: GEO.textSub, fontSize: 12, fontFamily: GEO.fontMono, display: 'flex', alignItems: 'center', gap: 5 }}>
              <Clock size={12} />
              {formatTime(alert.createdAt, isAr)}
            </div>
          </div>
          {alert.acknowledgedAt && (
            <div>
              <div style={{ color: GEO.textMuted, fontSize: 10, fontFamily: GEO.fontMono, marginBottom: 3 }}>
                {isAr ? 'وقت التأكيد' : 'Acknowledged At'}
              </div>
              <div style={{ color: GEO.green, fontSize: 12, fontFamily: GEO.fontMono, display: 'flex', alignItems: 'center', gap: 5 }}>
                <CheckCircle2 size={12} />
                {formatTime(alert.acknowledgedAt, isAr)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SettingsPanel({ isAr, onClose }: { isAr: boolean; onClose: () => void }) {
  const { data: settingsData } = trpc.notifications.getSettings.useQuery();
  const updateMutation = trpc.notifications.updateSettings.useMutation({
    onSuccess: () => {
      toast.success(isAr ? 'تم حفظ الإعدادات' : 'Settings saved');
    },
  });

  const [threshold, setThreshold] = useState(() => settingsData?.riskThreshold ?? 70);
  const [cooldown, setCooldown] = useState(() => settingsData?.cooldownMinutes ?? 30);
  const [enabled, setEnabled] = useState(() => settingsData?.notificationsEnabled ?? true);

  // Note: useState lazy initializer runs once; settings are pre-populated when available

  function handleSave() {
    updateMutation.mutate({ riskThreshold: threshold, cooldownMinutes: cooldown, notificationsEnabled: enabled });
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.7)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }} onClick={onClose}>
      <div
        style={{
          background: GEO.bgDeep,
          border: `1px solid ${GEO.borderHi}`,
          borderRadius: 14,
          padding: 28,
          width: 420,
          maxWidth: '90vw',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Settings size={18} color={GEO.blue} />
            <span style={{ color: GEO.text, fontSize: 16, fontWeight: 700, fontFamily: GEO.fontHead }}>
              {isAr ? 'إعدادات التنبيهات' : 'Alert Settings'}
            </span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: GEO.textMuted, cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        {/* Enable/Disable toggle */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          background: 'rgba(66,165,245,0.06)',
          border: `1px solid ${GEO.border}`,
          borderRadius: 8,
          marginBottom: 16,
        }}>
          <div>
            <div style={{ color: GEO.text, fontSize: 13, fontWeight: 600 }}>
              {isAr ? 'إشعارات Push' : 'Push Notifications'}
            </div>
            <div style={{ color: GEO.textMuted, fontSize: 11, marginTop: 2 }}>
              {isAr ? 'إرسال إشعار للمسؤول عند تجاوز العتبة' : 'Send notification to owner when threshold exceeded'}
            </div>
          </div>
          <button
            onClick={() => setEnabled(!enabled)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: enabled ? GEO.green : GEO.textMuted }}
          >
            {enabled ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
          </button>
        </div>

        {/* Risk threshold */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <label style={{ color: GEO.textSub, fontSize: 12, fontFamily: GEO.fontMono }}>
              {isAr ? 'عتبة خطر الفيضان' : 'Flood Risk Threshold'}
            </label>
            <span style={{ color: GEO.orange, fontSize: 14, fontWeight: 700, fontFamily: GEO.fontMono }}>
              {threshold}%
            </span>
          </div>
          <input
            type="range"
            min={10}
            max={100}
            step={5}
            value={threshold}
            onChange={e => setThreshold(Number(e.target.value))}
            style={{ width: '100%', accentColor: GEO.orange }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', color: GEO.textMuted, fontSize: 10, fontFamily: GEO.fontMono }}>
            <span>10%</span>
            <span style={{ color: GEO.yellow }}>50% ({isAr ? 'موصى به' : 'recommended'})</span>
            <span>100%</span>
          </div>
        </div>

        {/* Cooldown */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <label style={{ color: GEO.textSub, fontSize: 12, fontFamily: GEO.fontMono }}>
              {isAr ? 'فترة التهدئة (دقيقة)' : 'Cooldown Period (minutes)'}
            </label>
            <span style={{ color: GEO.blue, fontSize: 14, fontWeight: 700, fontFamily: GEO.fontMono }}>
              {cooldown} {isAr ? 'دقيقة' : 'min'}
            </span>
          </div>
          <input
            type="range"
            min={5}
            max={120}
            step={5}
            value={cooldown}
            onChange={e => setCooldown(Number(e.target.value))}
            style={{ width: '100%', accentColor: GEO.blue }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', color: GEO.textMuted, fontSize: 10, fontFamily: GEO.fontMono }}>
            <span>5 {isAr ? 'دقائق' : 'min'}</span>
            <span style={{ color: GEO.blue }}>30 {isAr ? 'دقيقة' : 'min'} ({isAr ? 'افتراضي' : 'default'})</span>
            <span>120 {isAr ? 'دقيقة' : 'min'}</span>
          </div>
        </div>

        {/* Info note */}
        <div style={{
          display: 'flex',
          gap: 8,
          padding: '10px 14px',
          background: 'rgba(77,208,225,0.06)',
          border: `1px solid ${GEO.teal}22`,
          borderRadius: 8,
          marginBottom: 20,
        }}>
          <Info size={14} color={GEO.teal} style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ color: GEO.textMuted, fontSize: 11, margin: 0, lineHeight: 1.5 }}>
            {isAr
              ? 'يفحص المحرك بيانات الطقس كل 5 دقائق. عند تجاوز عتبة الخطر، يُرسل إشعاراً واحداً للمنطقة ثم ينتظر فترة التهدئة قبل الإشعار التالي.'
              : 'The engine checks weather data every 5 minutes. When risk threshold is exceeded, it sends one notification per region then waits the cooldown period before the next alert.'}
          </p>
        </div>

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={updateMutation.isPending}
          style={{
            width: '100%',
            padding: '10px 0',
            background: 'rgba(66,165,245,0.15)',
            border: `1px solid ${GEO.blue}44`,
            borderRadius: 8,
            color: GEO.blue,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            fontFamily: GEO.fontMono,
          }}
        >
          <Save size={14} />
          {updateMutation.isPending ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ الإعدادات' : 'Save Settings')}
        </button>
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  const { lang, dir } = useLanguage();
  const isAr = lang === 'ar';
  const isRtl = dir === 'rtl';

  const [levelFilter, setLevelFilter] = useState<'all' | 'watch' | 'warning' | 'critical'>('all');
  const [ackFilter, setAckFilter] = useState<'all' | 'yes' | 'no'>('no');
  const [showSettings, setShowSettings] = useState(false);

  const { data, isLoading, refetch } = trpc.notifications.getAlerts.useQuery({
    limit: 100,
    offset: 0,
    level: levelFilter,
    acknowledged: ackFilter,
  }, { refetchInterval: 30_000 });

  const { data: unreadData } = trpc.notifications.getUnreadCount.useQuery(
    undefined,
    { refetchInterval: 30_000 }
  );

  const ackMutation = trpc.notifications.acknowledge.useMutation({
    onSuccess: () => { refetch(); toast.success(isAr ? 'تم تأكيد التنبيه' : 'Alert acknowledged'); },
  });

  const ackAllMutation = trpc.notifications.acknowledgeAll.useMutation({
    onSuccess: () => { refetch(); toast.success(isAr ? 'تم تأكيد جميع التنبيهات' : 'All alerts acknowledged'); },
  });

  const clearMutation = trpc.notifications.clearAll.useMutation({
    onSuccess: () => { refetch(); toast.success(isAr ? 'تم مسح جميع التنبيهات' : 'All alerts cleared'); },
  });

  const triggerMutation = trpc.notifications.triggerCheck.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success(isAr ? 'تم تشغيل الفحص الفوري' : 'Manual check triggered');
        setTimeout(() => refetch(), 2000);
      }
    },
  });

  const alerts = (data?.alerts ?? []) as AlertItem[];

  // Stats
  const criticalCount = alerts.filter(a => a.alertLevel === 'critical').length;
  const warningCount  = alerts.filter(a => a.alertLevel === 'warning').length;
  const watchCount    = alerts.filter(a => a.alertLevel === 'watch').length;

  return (
    <div style={{
      minHeight: '100vh',
      background: GEO.bgDeep,
      color: GEO.text,
      direction: isRtl ? 'rtl' : 'ltr',
      fontFamily: isAr ? GEO.fontAr : 'Inter, sans-serif',
      padding: '24px 20px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <div style={{
              background: 'rgba(255,107,53,0.15)',
              border: '1px solid rgba(255,107,53,0.3)',
              borderRadius: 10,
              padding: '8px 10px',
            }}>
              <Bell size={20} color={GEO.red} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, fontFamily: GEO.fontHead, color: GEO.text }}>
                {isAr ? 'مركز الإشعارات' : 'Notifications Center'}
              </h1>
              <p style={{ margin: 0, fontSize: 12, color: GEO.textMuted, marginTop: 2 }}>
                {isAr ? 'سجل تنبيهات الفيضانات الحية — محرك التنبيه يعمل كل 5 دقائق' : 'Live flood alert log — engine runs every 5 minutes'}
              </p>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={() => triggerMutation.mutate()}
            disabled={triggerMutation.isPending}
            style={{
              background: 'rgba(77,208,225,0.1)',
              border: `1px solid ${GEO.teal}44`,
              borderRadius: 7,
              padding: '7px 12px',
              color: GEO.teal,
              fontSize: 12,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontFamily: GEO.fontMono,
            }}
          >
            <Play size={13} />
            {isAr ? 'فحص فوري' : 'Manual Check'}
          </button>
          <button
            onClick={() => ackAllMutation.mutate()}
            disabled={ackAllMutation.isPending || (unreadData?.count ?? 0) === 0}
            style={{
              background: 'rgba(67,160,71,0.1)',
              border: `1px solid ${GEO.green}44`,
              borderRadius: 7,
              padding: '7px 12px',
              color: GEO.green,
              fontSize: 12,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontFamily: GEO.fontMono,
              opacity: (unreadData?.count ?? 0) === 0 ? 0.4 : 1,
            }}
          >
            <CheckCheck size={13} />
            {isAr ? 'تأكيد الكل' : 'Ack All'}
            {(unreadData?.count ?? 0) > 0 && (
              <span style={{
                background: GEO.green,
                color: '#000',
                borderRadius: 10,
                padding: '0 6px',
                fontSize: 10,
                fontWeight: 700,
              }}>{unreadData?.count}</span>
            )}
          </button>
          <button
            onClick={() => refetch()}
            style={{
              background: 'rgba(66,165,245,0.1)',
              border: `1px solid ${GEO.blue}44`,
              borderRadius: 7,
              padding: '7px 12px',
              color: GEO.blue,
              fontSize: 12,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontFamily: GEO.fontMono,
            }}
          >
            <RefreshCw size={13} />
            {isAr ? 'تحديث' : 'Refresh'}
          </button>
          <button
            onClick={() => clearMutation.mutate()}
            disabled={clearMutation.isPending || alerts.length === 0}
            style={{
              background: 'rgba(255,107,53,0.1)',
              border: `1px solid ${GEO.red}44`,
              borderRadius: 7,
              padding: '7px 12px',
              color: GEO.red,
              fontSize: 12,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontFamily: GEO.fontMono,
              opacity: alerts.length === 0 ? 0.4 : 1,
            }}
          >
            <Trash2 size={13} />
            {isAr ? 'مسح الكل' : 'Clear All'}
          </button>
          <button
            onClick={() => setShowSettings(true)}
            style={{
              background: 'rgba(144,202,249,0.1)',
              border: `1px solid ${GEO.textSub}44`,
              borderRadius: 7,
              padding: '7px 12px',
              color: GEO.textSub,
              fontSize: 12,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontFamily: GEO.fontMono,
            }}
          >
            <Settings size={13} />
            {isAr ? 'الإعدادات' : 'Settings'}
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: isAr ? 'حرجة' : 'Critical', value: criticalCount, color: GEO.red, icon: <AlertTriangle size={16} /> },
          { label: isAr ? 'تحذير' : 'Warning', value: warningCount, color: GEO.orange, icon: <Eye size={16} /> },
          { label: isAr ? 'مراقبة' : 'Watch', value: watchCount, color: GEO.yellow, icon: <Shield size={16} /> },
          { label: isAr ? 'غير مؤكدة' : 'Unread', value: unreadData?.count ?? 0, color: GEO.blue, icon: <Bell size={16} /> },
        ].map((stat, i) => (
          <div key={i} style={{
            background: GEO.bgCard,
            border: `1px solid ${stat.color}22`,
            borderRadius: 10,
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}>
            <span style={{ color: stat.color }}>{stat.icon}</span>
            <div>
              <div style={{ color: stat.color, fontSize: 22, fontWeight: 700, fontFamily: GEO.fontMono, lineHeight: 1 }}>
                {stat.value}
              </div>
              <div style={{ color: GEO.textMuted, fontSize: 11, marginTop: 2 }}>{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{
        display: 'flex',
        gap: 8,
        marginBottom: 16,
        flexWrap: 'wrap',
        alignItems: 'center',
      }}>
        <Filter size={14} color={GEO.textMuted} />
        <span style={{ color: GEO.textMuted, fontSize: 12, fontFamily: GEO.fontMono }}>
          {isAr ? 'المستوى:' : 'Level:'}
        </span>
        {(['all', 'critical', 'warning', 'watch'] as const).map(lvl => (
          <button
            key={lvl}
            onClick={() => setLevelFilter(lvl)}
            style={{
              background: levelFilter === lvl ? 'rgba(66,165,245,0.2)' : 'rgba(66,165,245,0.05)',
              border: `1px solid ${levelFilter === lvl ? GEO.blue : GEO.border}`,
              borderRadius: 6,
              padding: '4px 12px',
              color: levelFilter === lvl ? GEO.blue : GEO.textMuted,
              fontSize: 11,
              cursor: 'pointer',
              fontFamily: GEO.fontMono,
              fontWeight: levelFilter === lvl ? 700 : 400,
            }}
          >
            {lvl === 'all' ? (isAr ? 'الكل' : 'All') :
             lvl === 'critical' ? (isAr ? 'حرج' : 'Critical') :
             lvl === 'warning' ? (isAr ? 'تحذير' : 'Warning') :
             (isAr ? 'مراقبة' : 'Watch')}
          </button>
        ))}

        <span style={{ color: GEO.textMuted, fontSize: 12, fontFamily: GEO.fontMono, marginLeft: 8 }}>
          {isAr ? 'الحالة:' : 'Status:'}
        </span>
        {(['all', 'no', 'yes'] as const).map(ack => (
          <button
            key={ack}
            onClick={() => setAckFilter(ack)}
            style={{
              background: ackFilter === ack ? 'rgba(66,165,245,0.2)' : 'rgba(66,165,245,0.05)',
              border: `1px solid ${ackFilter === ack ? GEO.blue : GEO.border}`,
              borderRadius: 6,
              padding: '4px 12px',
              color: ackFilter === ack ? GEO.blue : GEO.textMuted,
              fontSize: 11,
              cursor: 'pointer',
              fontFamily: GEO.fontMono,
              fontWeight: ackFilter === ack ? 700 : 400,
            }}
          >
            {ack === 'all' ? (isAr ? 'الكل' : 'All') :
             ack === 'no' ? (isAr ? 'غير مؤكدة' : 'Unread') :
             (isAr ? 'مؤكدة' : 'Acknowledged')}
          </button>
        ))}
      </div>

      {/* Alert list */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: GEO.textMuted }}>
          <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: 12 }} />
          <p>{isAr ? 'جاري التحميل...' : 'Loading...'}</p>
        </div>
      ) : alerts.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '60px 0',
          color: GEO.textMuted,
          background: GEO.bgCard,
          border: `1px solid ${GEO.border}`,
          borderRadius: 12,
        }}>
          <BellOff size={40} style={{ marginBottom: 16, opacity: 0.4 }} />
          <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: GEO.textSub }}>
            {isAr ? 'لا توجد تنبيهات' : 'No Alerts Found'}
          </p>
          <p style={{ fontSize: 13, color: GEO.textMuted, maxWidth: 360, margin: '0 auto' }}>
            {isAr
              ? 'سيظهر هنا سجل التنبيهات عندما يتجاوز خطر الفيضان العتبة المحددة. يمكنك تشغيل فحص فوري لاختبار النظام.'
              : 'Alert history will appear here when flood risk exceeds the configured threshold. You can trigger a manual check to test the system.'}
          </p>
          <button
            onClick={() => triggerMutation.mutate()}
            style={{
              marginTop: 20,
              background: 'rgba(77,208,225,0.1)',
              border: `1px solid ${GEO.teal}44`,
              borderRadius: 8,
              padding: '8px 20px',
              color: GEO.teal,
              fontSize: 13,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Play size={14} />
            {isAr ? 'تشغيل فحص فوري' : 'Run Manual Check'}
          </button>
        </div>
      ) : (
        <div>
          <div style={{ color: GEO.textMuted, fontSize: 12, fontFamily: GEO.fontMono, marginBottom: 10 }}>
            {isAr ? `عرض ${alerts.length} تنبيه` : `Showing ${alerts.length} alert${alerts.length !== 1 ? 's' : ''}`}
          </div>
          {alerts.map(alert => (
            <AlertRow
              key={alert.id}
              alert={alert}
              isAr={isAr}
              onAck={(id) => ackMutation.mutate({ id })}
            />
          ))}
        </div>
      )}

      {/* Settings modal */}
      {showSettings && <SettingsPanel isAr={isAr} onClose={() => setShowSettings(false)} />}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
