import './polyfills'; // iOS Safari compatibility — MUST be first
import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { getLoginUrl } from "./const";
import "./index.css";

// ── Visible error helper (shows error on screen for iOS Safari debugging) ──
function showFatalError(stage: string, err: unknown) {
  const msg = err instanceof Error
    ? err.message + '\n\nStack:\n' + (err.stack || '').substring(0, 500)
    : String(err);
  if (typeof (window as any).__showError === 'function') {
    (window as any).__showError('Fatal Error [' + stage + ']: ' + msg, '', '');
  } else {
    // Fallback: create error overlay directly
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:#0d1b2a;display:flex;align-items:center;justify-content:center;z-index:99999;font-family:system-ui,-apple-system,sans-serif;padding:24px;';
    overlay.innerHTML =
      '<div style="max-width:90vw;">' +
      '<div style="color:#ff6b35;font-size:18px;font-weight:bold;margin-bottom:12px;">⚠️ ' + stage + '</div>' +
      '<div style="color:#e8f4f8;font-size:12px;word-break:break-all;white-space:pre-wrap;background:#0a1520;padding:12px;border-radius:8px;margin-bottom:12px;">' + msg + '</div>' +
      '<button onclick="location.reload()" style="padding:10px 20px;background:#42a5f5;color:#0a1520;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;width:100%;">🔄 إعادة التحميل</button>' +
      '</div>';
    document.body.appendChild(overlay);
  }
}

let queryClient: QueryClient;
let trpcClient: ReturnType<typeof trpc.createClient>;

try {
  queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        retryDelay: 1000,
      },
    },
  });

  const redirectToLoginIfUnauthorized = (error: unknown) => {
    if (!(error instanceof TRPCClientError)) return;
    if (typeof window === "undefined") return;
    const isUnauthorized = error.message === UNAUTHED_ERR_MSG;
    if (!isUnauthorized) return;
    window.location.href = getLoginUrl();
  };

  queryClient.getQueryCache().subscribe(event => {
    if (event.type === "updated" && event.action.type === "error") {
      const error = event.query.state.error;
      redirectToLoginIfUnauthorized(error);
      console.error("[API Query Error]", error);
    }
  });

  queryClient.getMutationCache().subscribe(event => {
    if (event.type === "updated" && event.action.type === "error") {
      const error = event.mutation.state.error;
      redirectToLoginIfUnauthorized(error);
      console.error("[API Mutation Error]", error);
    }
  });

  trpcClient = trpc.createClient({
    links: [
      httpBatchLink({
        url: "/api/trpc",
        transformer: superjson,
        fetch(input, init) {
          return globalThis.fetch(input, {
            ...(init ?? {}),
            credentials: "include",
          });
        },
      }),
    ],
  });
} catch (e) {
  showFatalError('إعداد QueryClient/tRPC', e);
  throw e;
}

try {
  if (typeof (window as any).__debugStep === 'function') (window as any).__debugStep('JS bundle loaded');

  const rootEl = document.getElementById("root");
  if (!rootEl) throw new Error('لم يتم العثور على عنصر #root في الصفحة');

  if (typeof (window as any).__debugStep === 'function') (window as any).__debugStep('createRoot...');
  const root = createRoot(rootEl);

  if (typeof (window as any).__debugStep === 'function') (window as any).__debugStep('root.render()...');
  root.render(
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </trpc.Provider>
  );
  if (typeof (window as any).__debugStep === 'function') (window as any).__debugStep('render() called ✔');

  // NOTE: __hideLoader is now called from App.tsx useEffect
  // to ensure it only hides AFTER React has fully rendered
} catch (e) {
  showFatalError('تحميل React', e);
}
