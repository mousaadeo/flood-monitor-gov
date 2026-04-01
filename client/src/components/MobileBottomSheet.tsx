/**
 * MobileBottomSheet — FloodSat AI
 *
 * A swipeable bottom sheet for mobile devices.
 * Supports three snap points: collapsed (peek), half, and full.
 * The map remains fully visible and interactive underneath.
 */

import { useRef, useState, useEffect, useCallback } from 'react';
import { ChevronUp, ChevronDown, GripHorizontal } from 'lucide-react';

export type SnapPoint = 'peek' | 'half' | 'full';

interface MobileBottomSheetProps {
  children: React.ReactNode;
  defaultSnap?: SnapPoint;
  peekHeight?: number;   // px visible when collapsed (default 72)
  halfHeight?: number;   // px for half state (default 50% of viewport)
}

const SNAP_HEIGHTS: Record<SnapPoint, (vh: number, peek: number, half: number) => number> = {
  peek: (_vh, peek, _half) => peek,
  half: (_vh, _peek, half) => half,
  full: (vh, _peek, _half) => vh - 56, // leave 56px for top bar
};

export default function MobileBottomSheet({
  children,
  defaultSnap = 'half',
  peekHeight = 80,
  halfHeight,
}: MobileBottomSheetProps) {
  const [snap, setSnap] = useState<SnapPoint>(defaultSnap);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const sheetRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const half = halfHeight ?? Math.round(vh * 0.52);

  const getSnapHeight = useCallback((s: SnapPoint) =>
    SNAP_HEIGHTS[s](vh, peekHeight, half), [vh, peekHeight, half]);

  const currentHeight = getSnapHeight(snap) + (isDragging ? -dragOffset : 0);
  const clampedHeight = Math.max(peekHeight, Math.min(vh - 56, currentHeight));

  // Snap to nearest point after drag
  const snapToNearest = useCallback((finalHeight: number) => {
    const points: SnapPoint[] = ['peek', 'half', 'full'];
    let closest: SnapPoint = 'half';
    let minDist = Infinity;
    for (const p of points) {
      const dist = Math.abs(getSnapHeight(p) - finalHeight);
      if (dist < minDist) { minDist = dist; closest = p; }
    }
    setSnap(closest);
    setDragOffset(0);
    setIsDragging(false);
  }, [getSnapHeight]);

  // Touch handlers
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    startYRef.current = e.touches[0].clientY;
    startHeightRef.current = getSnapHeight(snap);
    setIsDragging(true);
  }, [snap, getSnapHeight]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;
    const dy = e.touches[0].clientY - startYRef.current;
    setDragOffset(dy);
  }, [isDragging]);

  const onTouchEnd = useCallback(() => {
    const finalHeight = startHeightRef.current - dragOffset;
    snapToNearest(finalHeight);
  }, [dragOffset, snapToNearest]);

  // Mouse handlers for desktop testing
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    startYRef.current = e.clientY;
    startHeightRef.current = getSnapHeight(snap);
    setIsDragging(true);
    const onMove = (ev: MouseEvent) => {
      setDragOffset(ev.clientY - startYRef.current);
    };
    const onUp = (ev: MouseEvent) => {
      const finalHeight = startHeightRef.current - (ev.clientY - startYRef.current);
      snapToNearest(finalHeight);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [snap, getSnapHeight, snapToNearest]);

  const cycleSnap = () => {
    const order: SnapPoint[] = ['peek', 'half', 'full'];
    const idx = order.indexOf(snap);
    setSnap(order[(idx + 1) % order.length]);
  };

  return (
    <div
      ref={sheetRef}
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: `${clampedHeight}px`,
        zIndex: 400,
        background: 'rgba(8,12,20,0.97)',
        borderTop: '1px solid rgba(0,212,255,0.2)',
        borderRadius: '16px 16px 0 0',
        display: 'flex',
        flexDirection: 'column',
        transition: isDragging ? 'none' : 'height 0.32s cubic-bezier(0.4,0,0.2,1)',
        boxShadow: '0 -8px 32px rgba(0,0,0,0.6)',
        willChange: 'height',
        touchAction: 'none',
      }}
    >
      {/* Drag Handle */}
      <div
        style={{
          flexShrink: 0,
          padding: '8px 0 4px',
          cursor: 'grab',
          userSelect: 'none',
          touchAction: 'none',
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        onClick={snap === 'peek' ? cycleSnap : undefined}
      >
        {/* Grip bar */}
        <div style={{
          width: '40px',
          height: '4px',
          borderRadius: '2px',
          background: 'rgba(255,255,255,0.2)',
          margin: '0 auto 6px',
        }} />

        {/* Snap indicator dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '5px', marginBottom: '4px' }}>
          {(['peek', 'half', 'full'] as SnapPoint[]).map(s => (
            <button
              key={s}
              onClick={(e) => { e.stopPropagation(); setSnap(s); }}
              style={{
                width: snap === s ? '16px' : '6px',
                height: '6px',
                borderRadius: '3px',
                background: snap === s ? 'var(--cyan, #00d4ff)' : 'rgba(255,255,255,0.2)',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                transition: 'all 0.2s',
              }}
            />
          ))}
        </div>
      </div>

      {/* Content — scrollable */}
      <div style={{
        flex: 1,
        overflowY: snap === 'peek' ? 'hidden' : 'auto',
        overflowX: 'hidden',
        WebkitOverflowScrolling: 'touch',
        padding: snap === 'peek' ? '0' : '0 0 env(safe-area-inset-bottom, 16px)',
      }}>
        {children}
      </div>
    </div>
  );
}
