/**
 * alertEngine.test.ts
 * Tests for the flood alert engine and notifications tRPC procedures
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock weatherService ──────────────────────────────────────────────────────
vi.mock('./weatherService', () => ({
  getCachedWeatherData: vi.fn(),
}));

// ── Mock notification ────────────────────────────────────────────────────────
vi.mock('./_core/notification', () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

// ── Mock DB — use inline factories to avoid hoisting issues ──────────────────
vi.mock('./db', () => ({
  getDb: vi.fn().mockResolvedValue({
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([]),
        where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    }),
    delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
  }),
}));

import { getCachedWeatherData } from './weatherService';
import { notifyOwner } from './_core/notification';
import { startAlertEngine, stopAlertEngine, triggerManualCheck } from './alertEngine';

// ── Helpers ──────────────────────────────────────────────────────────────────
function makeWeatherData(regions: any[]) {
  return {
    regions,
    fetchedAt: new Date().toISOString(),
    source: 'test',
    nowStr: '2026-01-01T12:00',
    accumulationSummary: {
      totalRegionsWithWater: 0, extremeCount: 0, severeCount: 0,
      moderateCount: 0, minorCount: 0, maxScore: 0, maxScoreRegionId: '',
      totalEstimatedAreaKm2: 0, activeWadis: 0,
    },
  };
}

function makeRegion(overrides: Partial<{
  id: string;
  nameEn: string;
  nameAr: string;
  floodRisk: number;
  alertLevel: string;
  currentPrecipitation: number;
  lat: number;
  lon: number;
}> = {}) {
  return {
    id: 'region-1',
    nameEn: 'Test Region',
    nameAr: 'منطقة تجريبية',
    floodRisk: 75,
    alertLevel: 'critical',
    currentPrecipitation: 2.5,
    lat: 24.4539,
    lon: 54.3773,
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Alert Engine — triggerManualCheck', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('skips check when no cached weather data', async () => {
    vi.mocked(getCachedWeatherData).mockReturnValue(null);
    await triggerManualCheck();
    expect(notifyOwner).not.toHaveBeenCalled();
  });

  it('skips regions below risk threshold (default 70)', async () => {
    vi.mocked(getCachedWeatherData).mockReturnValue(
      makeWeatherData([makeRegion({ floodRisk: 50, alertLevel: 'watch' })]) as any
    );
    await triggerManualCheck();
    expect(notifyOwner).not.toHaveBeenCalled();
  });

  it('triggers alert and sends notification for high-risk region', async () => {
    vi.mocked(getCachedWeatherData).mockReturnValue(
      makeWeatherData([makeRegion({ floodRisk: 80, alertLevel: 'critical' })]) as any
    );
    await triggerManualCheck();
    expect(notifyOwner).toHaveBeenCalledOnce();
    const callArgs = vi.mocked(notifyOwner).mock.calls[0][0];
    expect(callArgs.title).toContain('FloodSat AI');
    expect(callArgs.content).toContain('Test Region');
  });

  it('skips safe regions even if risk is high', async () => {
    vi.mocked(getCachedWeatherData).mockReturnValue(
      makeWeatherData([makeRegion({ floodRisk: 90, alertLevel: 'safe' })]) as any
    );
    await triggerManualCheck();
    expect(notifyOwner).not.toHaveBeenCalled();
  });

  it('handles multiple regions and sends combined notification', async () => {
    vi.mocked(getCachedWeatherData).mockReturnValue(
      makeWeatherData([
        makeRegion({ id: 'r1', nameEn: 'Region A', floodRisk: 85, alertLevel: 'critical' }),
        makeRegion({ id: 'r2', nameEn: 'Region B', floodRisk: 72, alertLevel: 'warning' }),
        makeRegion({ id: 'r3', nameEn: 'Region C', floodRisk: 45, alertLevel: 'watch' }), // below threshold
      ]) as any
    );
    await triggerManualCheck();
    expect(notifyOwner).toHaveBeenCalledOnce();
    const callArgs = vi.mocked(notifyOwner).mock.calls[0][0];
    expect(callArgs.title).toContain('2 Flood Alerts');
    expect(callArgs.content).toContain('Region A');
    expect(callArgs.content).toContain('Region B');
  });

  it('sends notification with correct level summary', async () => {
    // Use unique region IDs to avoid cooldown from previous tests
    vi.mocked(getCachedWeatherData).mockReturnValue(
      makeWeatherData([
        makeRegion({ id: 'crit-zone-unique', nameEn: 'Critical Zone', floodRisk: 90, alertLevel: 'critical' }),
        makeRegion({ id: 'warn-zone-unique', nameEn: 'Warning Zone', floodRisk: 75, alertLevel: 'warning' }),
      ]) as any
    );
    await triggerManualCheck();
    expect(notifyOwner).toHaveBeenCalledOnce();
    const callArgs = vi.mocked(notifyOwner).mock.calls[0][0];
    expect(callArgs.content).toContain('Critical: 1');
    expect(callArgs.content).toContain('Warning: 1');
  });
});

describe('Alert Engine — lifecycle', () => {
  it('startAlertEngine and stopAlertEngine do not throw', () => {
    expect(() => startAlertEngine()).not.toThrow();
    expect(() => stopAlertEngine()).not.toThrow();
  });
});
