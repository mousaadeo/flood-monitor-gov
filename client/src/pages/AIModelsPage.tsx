// AIModelsPage — FloodSat AI Abu Dhabi
// AI model performance metrics, accuracy indicators, and comparison

import { aiModels, rainfallData } from '@/data/mockData';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from 'recharts';
import { Brain, Target, Zap, Database, TrendingUp, FileDown } from 'lucide-react';
import InfoTooltip, { TOOLTIPS } from '@/components/InfoTooltip';

const modelColors = ['var(--cyan)', '#10B981', '#F59E0B', '#A855F7'];

function MetricBadge({ label, value, color, tooltip }: { label: string; value: number; color: string; tooltip?: any }) {
  const r = 22;
  const circ = 2 * Math.PI * r;
  const dash = (value / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="56" height="56" viewBox="0 0 56 56">
        <circle cx="28" cy="28" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
        <circle cx="28" cy="28" r={r} fill="none" stroke={color} strokeWidth="4"
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeLinecap="round"
          transform="rotate(-90 28 28)"
          style={{ filter: `drop-shadow(0 0 4px ${color})` }}
        />
        <text x="28" y="32" textAnchor="middle" fill={color}
          style={{ fontFamily: 'JetBrains Mono', fontSize: '10px', fontWeight: 'bold' }}>
          {value}%
        </text>
      </svg>
      <div className="flex items-center gap-0.5 justify-center">
        {tooltip && <InfoTooltip content={{ ...tooltip, value: `${value}%`, color }} size="sm" />}
        <span className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>{label}</span>
      </div>
    </div>
  );
}

export default function AIModelsPage() {
  const radarData = aiModels.map(m => ({
    model: m.model.split(' ')[0],
    Accuracy: m.accuracy,
    'Accuracy Forecast': m.Precision,
    'Recall': m.Recall,
    'F1': m.f1Score,
  }));

  const barData = aiModels.map((m, i) => ({
    name: m.model.split(' ')[0],
    Accuracy: m.accuracy,
    'Accuracy Forecast': m.Precision,
    'Recall': m.Recall,
    color: modelColors[i],
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>Models Artificial Intelligence</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Performance and Accuracy of AI Models in Flood Monitoring and Satellite Data Analysis
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-3 py-2 rounded text-xs font-semibold flex-shrink-0"
          style={{ background: 'rgba(139,92,246,0.10)', color: '#A78BFA', border: '1px solid rgba(139,92,246,0.30)' }}
        >
          <FileDown size={12} />
          Export PDF
        </button>
      </div>

      {/* Hero */}
      <div className="relative rounded overflow-hidden" style={{ height: '160px' }}>
        <img
          src="https://d2xsxph8kpxj0f.cloudfront.net/310519663384867006/UpUV4ACjBMFtNVM49QL7JW/ai-analysis-panel-Nc2jB9FwfGMwB3JcvtDLFX.webp"
          alt="AI Analysis"
          className="w-full h-full object-cover opacity-60"
        />
        <div className="absolute inset-0 flex items-center px-8"
          style={{ background: 'linear-gradient(90deg, rgba(6,13,26,0.92) 50%, transparent)' }}>
          <div>
            <h2 className="text-base font-bold glow-text-cyan" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
              AI System for Satellite Monitoring
            </h2>
            <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
              4 integrated models • Accuracy up to 94.1% • Response time under 10 minutes
            </p>
          </div>
        </div>
      </div>

      {/* Model cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {aiModels.map((model, i) => {
          const color = modelColors[i];
          return (
            <div key={model.model} className="card-dark p-5">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded flex items-center justify-center flex-shrink-0"
                  style={{ background: `${color}22`, border: `1px solid ${color}44` }}>
                  <Brain size={18} style={{ color }} />
                </div>
                <div>
                  <h3 className="font-bold text-sm" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>{model.model}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Database size={11} style={{ color: 'var(--text-muted)' }} />
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{model.dataSource}</span>
                  </div>
                </div>
                <div className="mr-auto text-left">
                  <div className="font-data text-2xl font-bold" style={{ color }}>{model.accuracy}%</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Total Accuracy</div>
                </div>
              </div>

              {/* Metrics row */}
              <div className="flex justify-around mb-4">
                <MetricBadge label="Accuracy" value={model.Precision} color={color}
                  tooltip={{ title: 'Accuracy Forecast (Precision)', description: 'Of all flood zones predicted by the model, how many were actual floods. 90% means 9 out of 10 predictions were correct.', normalRange: '80% — 95%', source: 'Assessment model' }} />
                <MetricBadge label="recall" value={model.Recall} color={color}
                  tooltip={{ title: 'Flood Recall', description: 'Of all actual flood zones, how many were detected by the model. 90% means the model missed only 10% of flood zones.', normalRange: '80% — 95%', source: 'Assessment model' }} />
                <MetricBadge label="F1 Score" value={model.f1Score} color={color} tooltip={TOOLTIPS.f1Score} />
              </div>

              {/* Accuracy bar */}
              <div className="mb-3">
                <div className="flex justify-between text-xs mb-1">
                  <span className="flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                    <InfoTooltip content={TOOLTIPS.aiAccuracy} />
                    Total Accuracy
                  </span>
                  <span className="font-data font-bold" style={{ color }}>{model.accuracy}%</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${model.accuracy}%`, background: `linear-gradient(90deg, ${color}, ${color}99)` }} />
                </div>
              </div>

              {/* Latency */}
              <div className="flex items-center gap-2 pt-3 border-t" style={{ borderColor: 'var(--border-color)' }}>
                <Zap size={12} style={{ color: 'var(--amber)' }} />
                <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                  <InfoTooltip content={TOOLTIPS.responseTime} />
                  Processing Time:
                </span>
                <span className="font-data text-xs font-bold" style={{ color: 'var(--amber)' }}>{model.latency}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Bar chart comparison */}
        <div className="card-dark p-4">
          <h2 className="text-sm font-bold mb-4">Comparison Performance Models</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={barData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
              <YAxis domain={[75, 100]} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
              <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-active)', borderRadius: '6px', fontSize: '11px' }} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Bar dataKey="Accuracy" fill="var(--cyan)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Accuracy Forecast" fill="#10B981" radius={[3, 3, 0, 0]} />
              <Bar dataKey="recall" fill="#F59E0B" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Radar chart */}
        <div className="card-dark p-4">
          <h2 className="text-sm font-bold mb-4">Radar Chart — Multi-dimensional Performance</h2>
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={[
              { metric: 'Accuracy', 'GeoAI': 92.4, 'LSTM': 87.6, 'RF': 89.3, 'ViT': 94.1 },
              { metric: 'recall', 'GeoAI': 93.1, 'LSTM': 89.8, 'RF': 90.4, 'ViT': 94.5 },
              { metric: 'F1', 'GeoAI': 92.4, 'LSTM': 87.4, 'RF': 89.2, 'ViT': 94.1 },
              { metric: 'Speed', 'GeoAI': 95, 'LSTM': 90, 'RF': 85, 'ViT': 88 },
              { metric: 'Coverage', 'GeoAI': 94, 'LSTM': 100, 'RF': 87, 'ViT': 96 },
            ]}>
              <PolarGrid stroke="rgba(27,79,138,0.1)" />
              <PolarAngleAxis dataKey="metric" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
              <PolarRadiusAxis domain={[80, 100]} tick={{ fill: 'var(--text-muted)', fontSize: 8 }} />
              {['GeoAI', 'LSTM', 'RF', 'ViT'].map((key, i) => (
                <Radar key={key} name={key} dataKey={key} stroke={modelColors[i]} fill={modelColors[i]} fillOpacity={0.1} />
              ))}
              <Legend wrapperStyle={{ fontSize: '11px' }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Technical specs table */}
      <div className="card-dark p-4">
        <h2 className="text-sm font-bold mb-4">Technical Specifications of Models</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                {['Model', 'Data Source', 'Accuracy', 'Recall', 'F1 Score', 'Processing Time', 'Assessment'].map(h => (
                  <th key={h} className="py-2 px-3 text-right font-medium" style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {aiModels.map((model, i) => {
                const color = modelColors[i];
                const rating = model.accuracy >= 93 ? 'Excellent' : model.accuracy >= 90 ? 'Excellent' : 'Good';
                const ratingColor = model.accuracy >= 93 ? '#10B981' : model.accuracy >= 90 ? 'var(--cyan)' : 'var(--amber)';
                return (
                  <tr key={model.model} className="border-b transition-colors hover:bg-white/5"
                    style={{ borderColor: 'var(--border-color)' }}>
                    <td className="py-2.5 px-3 font-medium" style={{ color, fontFamily: 'Playfair Display, Georgia, serif' }}>{model.model}</td>
                    <td className="py-2.5 px-3" style={{ color: 'var(--text-secondary)' }}>{model.dataSource}</td>
                    <td className="py-2.5 px-3 font-data font-bold" style={{ color }}>{model.Precision}%</td>
                    <td className="py-2.5 px-3 font-data font-bold" style={{ color }}>{model.Recall}%</td>
                    <td className="py-2.5 px-3 font-data font-bold" style={{ color }}>{model.f1Score}%</td>
                    <td className="py-2.5 px-3 font-data" style={{ color: 'var(--amber)' }}>{model.latency}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded font-bold" style={{ background: `${ratingColor}22`, color: ratingColor, border: `1px solid ${ratingColor}44` }}>
                        {rating}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
