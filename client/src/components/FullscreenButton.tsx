/**
 * FullscreenButton — expand/collapse screen button
 * Supports:
 * - Browser Fullscreen API
 * - Expand specific element (element fullscreen)
 * - Keyboard shortcut F (when focused) or F11 globally
 * - "expand panel" mode to expand side panel
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';

// ─── Hook: useFullscreen ──────────────────────────────────────────────────────
export function useFullscreen(targetRef?: React.RefObject<HTMLElement>) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const enter = useCallback(() => {
    const el = targetRef?.current ?? document.documentElement;
    if (el.requestFullscreen) {
      el.requestFullscreen().catch(() => {});
    } else if ((el as any).webkitRequestFullscreen) {
      (el as any).webkitRequestFullscreen();
    } else if ((el as any).mozRequestFullScreen) {
      (el as any).mozRequestFullScreen();
    }
  }, [targetRef]);

  const exit = useCallback(() => {
    if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    } else if ((document as any).webkitExitFullscreen) {
      (document as any).webkitExitFullscreen();
    } else if ((document as any).mozCancelFullScreen) {
      (document as any).mozCancelFullScreen();
    }
  }, []);

  const toggle = useCallback(() => {
    if (isFullscreen) exit();
    else enter();
  }, [isFullscreen, enter, exit]);

  useEffect(() => {
    const handler = () => {
      setIsFullscreen(
        !!(document.fullscreenElement ||
          (document as any).webkitFullscreenElement ||
          (document as any).mozFullScreenElement)
      );
    };
    document.addEventListener('fullscreenchange', handler);
    document.addEventListener('webkitfullscreenchange', handler);
    document.addEventListener('mozfullscreenchange', handler);
    return () => {
      document.removeEventListener('fullscreenchange', handler);
      document.removeEventListener('webkitfullscreenchange', handler);
      document.removeEventListener('mozfullscreenchange', handler);
    };
  }, []);

  return { isFullscreen, toggle, enter, exit };
}

// ─── Component: FullscreenButton ─────────────────────────────────────────────
interface FullscreenButtonProps {
  /** ref for element to expand (optional — if not specified, expands full page) */
  targetRef?: React.RefObject<HTMLElement>;
  /** Icon size */
  size?: number;
  /** Tooltip text */
  label?: string;
  /** Additional className */
  className?: string;
  /** Display mode: icon only or icon + text */
  variant?: 'icon' | 'icon-text';
  /** Button color */
  color?: string;
}

export default function FullscreenButton({
  targetRef,
  size = 14,
  label,
  className = '',
  variant = 'icon',
  color = 'rgba(255,255,255,0.55)',
}: FullscreenButtonProps) {
  const { isFullscreen, toggle } = useFullscreen(targetRef);
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={toggle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={isFullscreen ? 'Exit Fullscreen (Esc)' : (label ?? 'Fullscreen (F11)')}
      aria-label={isFullscreen ? 'Collapse' : 'Expand'}
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: variant === 'icon-text' ? '4px 10px' : '4px',
        background: hovered ? 'rgba(255,255,255,0.08)' : 'transparent',
        border: '1px solid',
        borderColor: hovered ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)',
        borderRadius: '4px',
        cursor: 'pointer',
        color,
        transition: 'all 0.15s ease',
        flexShrink: 0,
      }}
    >
      {isFullscreen
        ? <Minimize2 size={size} />
        : <Maximize2 size={size} />
      }
      {variant === 'icon-text' && (
        <span style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>
          {isFullscreen ? 'Collapse' : 'Expand'}
        </span>
      )}
    </button>
  );
}

// ─── Component: ExpandableCard ────────────────────────────────────────────────
/**
 * Expandable card — wraps any content and adds expand button showing it in enlarged modal
 */
interface ExpandableCardProps {
  title: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
  headerExtra?: React.ReactNode;
}

export function ExpandableCard({ title, children, style, className = '', headerExtra }: ExpandableCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [hovered, setHovered] = useState(false);

  // ESC to close
  useEffect(() => {
    if (!expanded) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpanded(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [expanded]);

  return (
    <>
      <div className={className} style={style}>
        {/* Header with expand button */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.75)', fontFamily: 'Tajawal, sans-serif' }}>
            {title}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {headerExtra}
            <button
              onClick={() => setExpanded(true)}
              onMouseEnter={() => setHovered(true)}
              onMouseLeave={() => setHovered(false)}
              title="Expand (F)"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '3px',
                padding: '3px 6px',
                background: hovered ? 'rgba(255,255,255,0.08)' : 'transparent',
                border: '1px solid',
                borderColor: hovered ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.07)',
                borderRadius: '3px',
                cursor: 'pointer',
                color: 'rgba(255,255,255,0.4)',
                transition: 'all 0.15s',
                fontSize: '9px',
                fontFamily: 'JetBrains Mono',
              }}
            >
              <Maximize2 size={10} />
              <span>Expand</span>
            </button>
          </div>
        </div>
        {children}
      </div>

      {/* Modal overlay */}
      {expanded && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setExpanded(false); }}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '24px',
            backdropFilter: 'blur(4px)',
          }}
        >
          <div style={{
            background: '#0D1220',
            border: '1px solid rgba(27,79,138,0.4)',
            borderRadius: '8px',
            width: '100%',
            maxWidth: '1100px',
            maxHeight: '90vh',
            overflow: 'auto',
            padding: '20px',
            position: 'relative',
          }}>
            {/* Modal header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <span style={{ fontSize: '15px', fontWeight: 700, color: 'rgba(255,255,255,0.9)', fontFamily: 'Tajawal, sans-serif' }}>
                {title}
              </span>
              <button
                onClick={() => setExpanded(false)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  padding: '5px 12px',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  color: 'rgba(255,255,255,0.6)',
                  fontSize: '11px',
                  fontFamily: 'JetBrains Mono',
                }}
              >
                <Minimize2 size={12} />
                <span>Close (Esc)</span>
              </button>
            </div>
            {/* Scaled content */}
            <div style={{ minHeight: '400px' }}>
              {children}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
