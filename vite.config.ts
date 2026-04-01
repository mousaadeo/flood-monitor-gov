import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { defineConfig, type Plugin, type ViteDevServer } from "vite";
import { vitePluginManusRuntime } from "vite-plugin-manus-runtime";

// =============================================================================
// Manus Debug Collector - Vite Plugin
// Writes browser logs directly to files, trimmed when exceeding size limit
// =============================================================================

const PROJECT_ROOT = import.meta.dirname;
const LOG_DIR = path.join(PROJECT_ROOT, ".manus-logs");
const MAX_LOG_SIZE_BYTES = 1 * 1024 * 1024; // 1MB per log file
const TRIM_TARGET_BYTES = Math.floor(MAX_LOG_SIZE_BYTES * 0.6); // Trim to 60% to avoid constant re-trimming

type LogSource = "browserConsole" | "networkRequests" | "sessionReplay";

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function trimLogFile(logPath: string, maxSize: number) {
  try {
    if (!fs.existsSync(logPath) || fs.statSync(logPath).size <= maxSize) {
      return;
    }

    const lines = fs.readFileSync(logPath, "utf-8").split("\n");
    const keptLines: string[] = [];
    let keptBytes = 0;

    // Keep newest lines (from end) that fit within 60% of maxSize
    const targetSize = TRIM_TARGET_BYTES;
    for (let i = lines.length - 1; i >= 0; i--) {
      const lineBytes = Buffer.byteLength(`${lines[i]}\n`, "utf-8");
      if (keptBytes + lineBytes > targetSize) break;
      keptLines.unshift(lines[i]);
      keptBytes += lineBytes;
    }

    fs.writeFileSync(logPath, keptLines.join("\n"), "utf-8");
  } catch {
    /* ignore trim errors */
  }
}

function writeToLogFile(source: LogSource, entries: unknown[]) {
  if (entries.length === 0) return;

  ensureLogDir();
  const logPath = path.join(LOG_DIR, `${source}.log`);

  // Format entries with timestamps
  const lines = entries.map((entry) => {
    const ts = new Date().toISOString();
    return `[${ts}] ${JSON.stringify(entry)}`;
  });

  // Append to log file
  fs.appendFileSync(logPath, `${lines.join("\n")}\n`, "utf-8");

  // Trim if exceeds max size
  trimLogFile(logPath, MAX_LOG_SIZE_BYTES);
}

/**
 * Vite plugin to collect browser debug logs
 * - POST /__manus__/logs: Browser sends logs, written directly to files
 * - Files: browserConsole.log, networkRequests.log, sessionReplay.log
 * - Auto-trimmed when exceeding 1MB (keeps newest entries)
 */
function vitePluginManusDebugCollector(): Plugin {
  return {
    name: "manus-debug-collector",

    transformIndexHtml(html) {
      if (process.env.NODE_ENV === "production") {
        return html;
      }
      return {
        html,
        tags: [
          {
            tag: "script",
            attrs: {
              src: "/__manus__/debug-collector.js",
              defer: true,
            },
            injectTo: "head",
          },
        ],
      };
    },

    configureServer(server: ViteDevServer) {
      // POST /__manus__/logs: Browser sends logs (written directly to files)
      server.middlewares.use("/__manus__/logs", (req, res, next) => {
        if (req.method !== "POST") {
          return next();
        }

        const handlePayload = (payload: any) => {
          // Write logs directly to files
          if (payload.consoleLogs?.length > 0) {
            writeToLogFile("browserConsole", payload.consoleLogs);
          }
          if (payload.networkRequests?.length > 0) {
            writeToLogFile("networkRequests", payload.networkRequests);
          }
          if (payload.sessionEvents?.length > 0) {
            writeToLogFile("sessionReplay", payload.sessionEvents);
          }

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true }));
        };

        const reqBody = (req as { body?: unknown }).body;
        if (reqBody && typeof reqBody === "object") {
          try {
            handlePayload(reqBody);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
          return;
        }

        let body = "";
        req.on("data", (chunk) => {
          body += chunk.toString();
        });

        req.on("end", () => {
          try {
            const payload = JSON.parse(body);
            handlePayload(payload);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
        });
      });
    },
  };
}

// Plugin to fix __vite__mapDeps TDZ bug on iOS Safari < 15
// Vite generates: const __vite__mapDeps=(i,m=__vite__mapDeps,...)
// The self-reference in default parameter causes TDZ ReferenceError on iOS Safari < 15
// because 'const' variables are in TDZ until fully initialized.
// Fix: replace 'const __vite__mapDeps=' with 'var __vite__mapDeps='
// 'var' is hoisted and has no TDZ, so self-reference in default param works fine.
function vitePluginFixMapDepsTDZ(): Plugin {
  return {
    name: 'vite-plugin-fix-mapdeps-tdz',
    enforce: 'post',
    // renderChunk is called for each chunk BEFORE writing to disk
    // This is the correct hook to transform chunk code in Rollup/Vite
    renderChunk(code, chunk) {
      if (code.includes('const __vite__mapDeps=')) {
        console.log('[fix-mapdeps-tdz] Fixing TDZ in chunk:', chunk.fileName);
        return {
          code: code.replace(/const __vite__mapDeps=/g, 'var __vite__mapDeps='),
          map: null,
        };
      }
      return null;
    },
  };
}

// Plugin to remove crossorigin attribute and modulepreload from production HTML
// iOS Safari has known issues with <script type="module" crossorigin> and
// <link rel="modulepreload" crossorigin> causing silent script execution failures
function vitePluginSafariCompat(): Plugin {
  return {
    name: 'vite-plugin-safari-compat',
    enforce: 'post',
    transformIndexHtml(html) {
      return html
        // Remove crossorigin from script tags
        .replace(/<script type="module" crossorigin/g, '<script type="module"')
        // Remove modulepreload links entirely (not needed, causes issues on iOS Safari)
        .replace(/<link rel="modulepreload" crossorigin[^>]+>/g, '')
        // Remove modulepreload without crossorigin too
        .replace(/<link rel="modulepreload"[^>]+>/g, '')
        // Remove crossorigin from CSS stylesheet links
        .replace(/<link rel="stylesheet" crossorigin/g, '<link rel="stylesheet"');
    },
  };
}

// vitePluginManusRuntime is excluded from production builds:
// It bundles a full copy of React + renders its own root, causing a React conflict
// on iOS Safari (two React instances fighting over #root = silent crash)
export default defineConfig(({ mode }) => {
  const isDev = mode !== 'production';
  const plugins = [
    react(),
    tailwindcss(),
    jsxLocPlugin(),
    ...(isDev ? [vitePluginManusRuntime({ injectTo: 'body-prepend' })] : []),
    vitePluginManusDebugCollector(),
    // Remove crossorigin and modulepreload from production HTML for iOS Safari compat
    ...(!isDev ? [vitePluginSafariCompat()] : []),
    // Fix __vite__mapDeps TDZ bug on iOS Safari < 15
    ...(!isDev ? [vitePluginFixMapDepsTDZ()] : []),
  ];
  return {
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    // Target iOS Safari 13+ (covers iOS 13-18)
    // es2019 ensures compatibility with older Safari versions
    target: ['es2019', 'safari13', 'chrome87', 'firefox78'],
    // Ensure CSS is compatible with iOS Safari
    cssTarget: ['safari13', 'chrome87'],
    // Disable modulePreload polyfill — __vite__mapDeps uses const self-reference
    // in default parameter which causes TDZ error on iOS Safari < 15
    modulePreload: { polyfill: false },
    rollupOptions: {
      output: {
        // NO manualChunks — all vendor libs bundled into main bundle
        // iOS Safari fails silently when static ES module imports fail to load
        // (CORS, network timeout, or parse error in any chunk = entire app fails)
        // By keeping everything in one bundle, we eliminate all dependency chain failures
      },
    },
  },
  server: {
    host: true,
    allowedHosts: [
      ".manuspre.computer",
      ".manus.computer",
      ".manus-asia.computer",
      ".manuscomputer.ai",
      ".manusvm.computer",
      "localhost",
      "127.0.0.1",
    ],
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
  };
});
