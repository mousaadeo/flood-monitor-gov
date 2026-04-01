// Design: Techno-Geospatial Command Center (Dark Navy + Cyan/Amber/Red)
// Theme 2: ADEO Light — Abu Dhabi Executive Office brand identity

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { LanguageProvider, useLanguage } from "./contexts/LanguageContext";
import { DataModeProvider } from "./contexts/DataModeContext";
import Sidebar from "./components/Sidebar";
import TopBar from "./components/TopBar";
import { useIsMobile } from "./hooks/useMobile";
import { lazy, Suspense, useEffect, Component, ReactNode } from "react";

// ── Dashboard is eager-loaded (not lazy) to avoid dynamic import issues on iOS Safari ──
// Dynamic imports can silently fail on iOS Safari, causing infinite Suspense wait
import Dashboard from "./pages/Dashboard";

// ── Other pages are lazy-loaded — only loaded when navigated to ──
const SatellitesPage    = lazy(() => import("./pages/SatellitesPage"));
const AIModelsPage      = lazy(() => import("./pages/AIModelsPage"));
const ReportsPage       = lazy(() => import("./pages/ReportsPage"));
const AlertsPage        = lazy(() => import("./pages/AlertsPage"));
const DEMPage           = lazy(() => import("./pages/DEMPage"));
const SimulationPage    = lazy(() => import("./pages/SimulationPage"));
const RoadNetworkPage   = lazy(() => import("./pages/RoadNetworkPage"));
const AccuracyDashboard = lazy(() => import("./pages/AccuracyDashboard"));
const UnifiedMapPage    = lazy(() => import("./pages/UnifiedMapPage"));
const RegionsExplorerPage   = lazy(() => import("./pages/RegionsExplorerPage"));
const HistoricalArchivePage = lazy(() => import("./pages/HistoricalArchivePage"));
const DecisionSupportPage   = lazy(() => import("./pages/DecisionSupportPage"));
const UncertaintyMapPage    = lazy(() => import("./pages/UncertaintyMapPage"));
const ReleaseNotesPage  = lazy(() => import("./pages/ReleaseNotesPage"));
const DrainageDataPage  = lazy(() => import("./pages/DrainageDataPage"));
const SmartLensPage     = lazy(() => import("./pages/SmartLensPage"));
const WindyRadarPage    = lazy(() => import("./pages/WindyRadarPage"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const Glossary          = lazy(() => import("./pages/Glossary"));

// ── PageLoader: shown while lazy pages load ──
// Also hides the HTML loader overlay — fires when React has committed to DOM
function PageLoader() {
  useEffect(() => {
    // Hide the HTML loader overlay once React has mounted PageLoader
    // This fires even while Suspense is waiting for lazy imports
    if (typeof (window as any).__hideLoader === 'function') {
      (window as any).__hideLoader();
    }
  }, []);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '60vh', color: '#42a5f5', fontSize: '14px', gap: '10px',
      backgroundColor: '#0d1b2a',
    }}>
      <div className="loader-spinner" style={{
        width: '24px', height: '24px',
        border: '2px solid rgba(66,165,245,0.2)',
        borderTopColor: '#42a5f5', borderRadius: '50%',
      }} />
      <span>جارٍ التحميل...</span>
    </div>
  );
}

// ── SuspenseErrorBoundary: catches errors from lazy imports ──
interface SuspenseEBState { hasError: boolean; error: Error | null }
class SuspenseErrorBoundary extends Component<{ children: ReactNode }, SuspenseEBState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error) {
    console.error('[SuspenseErrorBoundary]', error);
    if (typeof (window as any).__showError === 'function') {
      (window as any).__showError('Page Load Error: ' + error.message, '', '');
    }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          minHeight: '60vh', padding: '24px', backgroundColor: '#0d1b2a',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}>
          <div style={{ textAlign: 'center', color: '#e8f4f8', maxWidth: '400px' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>⚠️</div>
            <div style={{ color: '#ff6b35', fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>
              فشل تحميل الصفحة
            </div>
            <div style={{ color: '#90caf9', fontSize: '12px', marginBottom: '16px' }}>
              {this.state.error?.message || 'خطأ غير معروف'}
            </div>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '10px 20px', backgroundColor: '#42a5f5', color: '#0a1520',
                border: 'none', borderRadius: '8px', fontSize: '14px',
                fontWeight: '600', cursor: 'pointer',
              }}
            >
              🔄 إعادة التحميل
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Sidebar width constants
const SIDEBAR_EXPANDED = 210;

function Layout({ children }: { children: React.ReactNode }) {
  const { dir } = useLanguage();
  const isRtl = dir === 'rtl';
  const isMobile = useIsMobile();
  return (
    <div className="min-h-screen grid-bg" style={{ background: 'var(--bg-primary)' }}>
      <TopBar />
      <Sidebar />
      <main
        className="transition-all duration-300"
        style={{
          marginTop: '56px',
          marginRight: isMobile ? '0' : (isRtl ? `${SIDEBAR_EXPANDED}px` : '0'),
          marginLeft: isMobile ? '0' : (isRtl ? '0' : `${SIDEBAR_EXPANDED}px`),
          padding: isMobile ? '12px' : '24px',
          minHeight: 'calc(100vh - 56px)',
        }}
        id="main-content"
      >
        {children}
      </main>
    </div>
  );
}

function MapLayout({ children }: { children: React.ReactNode }) {
  const { dir } = useLanguage();
  const isRtl = dir === 'rtl';
  const isMobile = useIsMobile();
  return (
    <div style={{ background: 'var(--bg-primary)' }}>
      <TopBar />
      <Sidebar />
      <div
        style={{
          marginTop: '56px',
          marginRight: isMobile ? '0' : (isRtl ? `${SIDEBAR_EXPANDED}px` : '0'),
          marginLeft: isMobile ? '0' : (isRtl ? '0' : `${SIDEBAR_EXPANDED}px`),
          height: 'calc(100vh - 56px)',
          overflow: 'hidden',
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Router() {
  return (
    <SuspenseErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <Switch>
          {/* Dashboard is eager-loaded — no dynamic import needed */}
          <Route path="/" component={() => <Layout><Dashboard /></Layout>} />
          <Route path="/map" component={() => <MapLayout><UnifiedMapPage /></MapLayout>} />
          <Route path="/satellites" component={() => <Layout><SatellitesPage /></Layout>} />
          <Route path="/ai-models" component={() => <Layout><AIModelsPage /></Layout>} />
          <Route path="/regions" component={() => <Layout><RegionsExplorerPage /></Layout>} />
          <Route path="/reports" component={() => <Layout><ReportsPage /></Layout>} />
          <Route path="/alerts" component={() => <Layout><AlertsPage /></Layout>} />
          {/* Redirects for removed/merged pages */}
          <Route path="/heatmap" component={() => { window.location.replace('/map'); return null; }} />
          <Route path="/map-legacy" component={() => { window.location.replace('/map'); return null; }} />
          <Route path="/traffic" component={() => { window.location.replace('/road-network'); return null; }} />
          <Route path="/field-validation" component={() => { window.location.replace('/smart-lens'); return null; }} />
          <Route path="/field-match" component={() => { window.location.replace('/smart-lens'); return null; }} />
          <Route path="/dem" component={() => <MapLayout><DEMPage /></MapLayout>} />
          <Route path="/simulation" component={() => <MapLayout><SimulationPage /></MapLayout>} />
          <Route path="/road-network" component={() => <MapLayout><RoadNetworkPage /></MapLayout>} />
          <Route path="/accuracy" component={() => <Layout><AccuracyDashboard /></Layout>} />
          <Route path="/archive" component={() => <Layout><HistoricalArchivePage /></Layout>} />
          <Route path="/decision-support" component={() => <Layout><DecisionSupportPage /></Layout>} />
          <Route path="/uncertainty" component={() => <MapLayout><UncertaintyMapPage /></MapLayout>} />
          <Route path="/release-notes" component={() => <Layout><ReleaseNotesPage /></Layout>} />
          <Route path="/drainage" component={() => <MapLayout><DrainageDataPage /></MapLayout>} />
          <Route path="/smart-lens" component={() => <Layout><SmartLensPage /></Layout>} />
          <Route path="/glossary" component={() => <Layout><Glossary /></Layout>} />
          <Route path="/windy" component={() => <MapLayout><WindyRadarPage /></MapLayout>} />
          <Route path="/notifications" component={() => <Layout><NotificationsPage /></Layout>} />
          <Route path="/404" component={NotFound} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </SuspenseErrorBoundary>
  );
}

// ── Debug step helper ──
const dbg = (step: string) => {
  if (typeof (window as any).__debugStep === 'function') (window as any).__debugStep(step);
};

export default function App() {
  // Hide the loading screen once React has fully mounted
  useEffect(() => {
    dbg('App mounted ✔');
    if (typeof (window as any).__hideLoader === 'function') {
      (window as any).__hideLoader();
    }
  }, []);

  dbg('App() render start');

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <LanguageProvider>
          <DataModeProvider>
            <TooltipProvider>
              <Toaster position="top-left" />
              <Router />
            </TooltipProvider>
          </DataModeProvider>
        </LanguageProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
