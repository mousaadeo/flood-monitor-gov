import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { invokeLLM } from "./_core/llm";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { fetchAllRegionsWeatherServer, invalidateServerWeatherCache } from "./weatherService";
import { fetchSatelliteImage, fetchCopernicusCEMSActivations, searchSentinel1Scenes, SATELLITE_PROVIDERS } from "./satelliteService";
import { fetchDrainageSystems, invalidateDrainageCache } from "./drainageService";
import { getDb } from "./db";
import { floodAlerts, alertSettings } from "../drizzle/schema";
import { desc, eq } from "drizzle-orm";
import { triggerManualCheck } from "./alertEngine";
import { fetchHistoricalData, invalidateHistoricalCache } from "./historicalDataService";

// ── Flood Image Analysis ──────────────────────────────────────────────────────

const FLOOD_ANALYSIS_SYSTEM_PROMPT = `You are an AI system specialized in monitoring floods and water pools on roads and streets.
Your task: Analyze field images captured from a moving vehicle in the United Arab Emirates.

Analysis rules:
1. Look for any water surfaces on the road or its edge (right/left/both)
2. Estimate water depth in centimeters based on water height on tires/curbs/signs
3. Estimate pool length in meters (from 0 to 500 meters)
4. Determine pool side: left, right, both, none
5. Assess risk level: dry, wet (damp/moist), flooded
6. Estimate your confidence percentage from 0 to 100
7. Note any additional indicators: traffic density, rain intensity, presence of people in water

Return the result in strict JSON format only.`;

const FLOOD_ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    hasWater: { type: "boolean", description: "Is there water in the image?" },
    floodStatus: { type: "string", enum: ["dry", "wet", "flooded"], description: "Road condition" },
    floodDepthCm: { type: "number", description: "Water depth in centimeters (0 if dry)" },
    floodLengthM: { type: "number", description: "Water pool length in meters (0 if dry)" },
    side: { type: "string", enum: ["left", "right", "both", "none"], description: "Pool side" },
    confidence: { type: "number", description: "Confidence percentage from 0 to 100" },
    trafficDensity: { type: "string", enum: ["clear", "light", "moderate", "heavy"], description: "Traffic density" },
    rainIntensity: { type: "string", enum: ["none", "light", "moderate", "heavy"], description: "Visible rain intensity" },
    hazardLevel: { type: "string", enum: ["safe", "caution", "danger", "critical"], description: "Hazard level" },
    notes: { type: "string", description: "Brief additional notes" },
  },
  required: ["hasWater", "floodStatus", "floodDepthCm", "floodLengthM", "side", "confidence", "trafficDensity", "rainIntensity", "hazardLevel", "notes"],
  additionalProperties: false,
} as const;

// ── Executive Summary Prompt ─────────────────────────────────────────────────
const buildExecutiveSummaryPrompt = (lang: 'ar' | 'en') => lang === 'ar'
  ? `أنت محلل استراتيجي متخصص في إدارة مخاطر الفيضانات في إمارة أبوظبي.
مهمتك: توليد ملخص تنفيذي احترافي ومركّز بناءً على البيانات الحية المقدمة.

قواعد الكتابة:
1. الأسلوب: تنفيذي مباشر — لا تكرار، لا حشو، كل جملة تضيف قيمة
2. الهيكل: ثلاثة أقسام فقط: (أ) الوضع الراهن، (ب) الرؤى والمخاطر، (ج) التوصيات الفورية
3. اللغة: عربية فصحى احترافية مناسبة لصانعي القرار
4. الطول: 250–350 كلمة بالضبط — موجز لكن شامل
5. التنسيق: استخدم ## للعناوين و**نص** للتأكيد، تجنب القوائم الطويلة
6. البيانات: استشهد بالأرقام الفعلية المقدمة، لا تخترع أرقاماً
7. التوصيات: 3 توصيات محددة وقابلة للتنفيذ الفوري

أعد النتيجة بتنسيق JSON صارم فقط.`
  : `You are a strategic analyst specializing in flood risk management in the Emirate of Abu Dhabi.
Your task: Generate a professional, focused executive summary based on the live data provided.

Writing rules:
1. Style: Direct executive — no repetition, no padding, every sentence adds value
2. Structure: Three sections only: (a) Current Situation, (b) Insights & Risks, (c) Immediate Recommendations
3. Language: Clear professional English suitable for decision-makers
4. Length: 250–350 words exactly — concise but comprehensive
5. Format: Use ## for headings and **text** for emphasis, avoid lengthy bullet lists
6. Data: Reference the actual numbers provided, do not invent figures
7. Recommendations: 3 specific, immediately actionable recommendations

Return the result in strict JSON format only.`;

const EXECUTIVE_SUMMARY_SCHEMA = {
  type: "object",
  properties: {
        title: { type: "string", description: "Executive summary title" },
        riskLevel: { type: "string", enum: ["low", "medium", "high", "critical"], description: "Overall risk level" },
        riskScore: { type: "number", description: "Risk score from 0 to 100" },
        currentStatus: { type: "string", description: "Current situation section — 80-100 words" },
        insights: { type: "string", description: "Insights & risks section — 80-100 words" },
        recommendations: { type: "string", description: "Immediate recommendations section — 3 specific recommendations" },
        topRegion: { type: "string", description: "Highest-risk region" },
        keyMetric: { type: "string", description: "Key metric highlighted in this report" },
        generatedAt: { type: "string", description: "Report generation time" },
  },
  required: ["title", "riskLevel", "riskScore", "currentStatus", "insights", "recommendations", "topRegion", "keyMetric", "generatedAt"],
  additionalProperties: false,
} as const;

export const appRouter = router({
  system: systemRouter,

  // ── Live Weather Data (server-side) ─────────────────────────────────────
  weather: router({
    getLiveData: publicProcedure
      .query(async () => {
        try {
          const data = await fetchAllRegionsWeatherServer();
          return { success: true, data };
        } catch (err) {
          console.error('[weather.getLiveData] Error:', err);
          return { success: false, data: null, error: String(err) };
        }
      }),
    invalidateCache: publicProcedure
      .mutation(async () => {
        invalidateServerWeatherCache();
        return { success: true };
      }),

    // Extended precipitation data: historical (up to 90 days) + forecast (up to 16 days)
    getPrecipHistory: publicProcedure
      .input(z.object({
        lat: z.number(),
        lon: z.number(),
        mode: z.enum(['24h', '7d', '30d', '90d', '16d_forecast']),
      }))
      .query(async ({ input }) => {
        try {
          const { lat, lon, mode } = input;
          const now = new Date();
          // Dubai = UTC+4
          const dubaiNow = new Date(now.getTime() + 4 * 60 * 60 * 1000);
          const todayStr = dubaiNow.toISOString().split('T')[0];

          let points: { time: string; precipitation: number; probability: number; isHistory: boolean }[] = [];

          if (mode === '24h') {
            // 24h: past 12h + next 12h from forecast endpoint
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=precipitation,precipitation_probability&past_days=1&forecast_days=2&timezone=Asia%2FDubai`;
            const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
            const data = await res.json() as { hourly: { time: string[]; precipitation: number[]; precipitation_probability: number[] } };
            const nowHour = dubaiNow.toISOString().slice(0, 13).replace('T', 'T');
            const nowIdx = data.hourly.time.findIndex(t => t >= nowHour.slice(0, 13));
            const ci = nowIdx >= 0 ? nowIdx : 24;
            const start = Math.max(0, ci - 12);
            const end = Math.min(data.hourly.time.length, ci + 13);
            for (let i = start; i < end; i++) {
              points.push({
                time: data.hourly.time[i],
                precipitation: data.hourly.precipitation[i] ?? 0,
                probability: data.hourly.precipitation_probability[i] ?? 0,
                isHistory: i < ci,
              });
            }
          } else if (mode === '7d') {
            // 7d: past 3 days + next 4 days
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=precipitation,precipitation_probability&past_days=3&forecast_days=4&timezone=Asia%2FDubai`;
            const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
            const data = await res.json() as { hourly: { time: string[]; precipitation: number[]; precipitation_probability: number[] } };
            const nowHour = dubaiNow.toISOString().slice(0, 13);
            for (let i = 0; i < data.hourly.time.length; i++) {
              points.push({
                time: data.hourly.time[i],
                precipitation: data.hourly.precipitation[i] ?? 0,
                probability: data.hourly.precipitation_probability[i] ?? 0,
                isHistory: data.hourly.time[i] < nowHour,
              });
            }
          } else if (mode === '16d_forecast') {
            // 16-day forecast
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=precipitation,precipitation_probability&past_days=1&forecast_days=16&timezone=Asia%2FDubai`;
            const res = await fetch(url, { signal: AbortSignal.timeout(25000) });
            const data = await res.json() as { hourly: { time: string[]; precipitation: number[]; precipitation_probability: number[] } };
            const nowHour = dubaiNow.toISOString().slice(0, 13);
            for (let i = 0; i < data.hourly.time.length; i++) {
              points.push({
                time: data.hourly.time[i],
                precipitation: data.hourly.precipitation[i] ?? 0,
                probability: data.hourly.precipitation_probability[i] ?? 0,
                isHistory: data.hourly.time[i] < nowHour,
              });
            }
          } else {
            // 30d or 90d: use ERA5 archive API
            const days = mode === '30d' ? 30 : 90;
            const startDate = new Date(dubaiNow.getTime() - days * 24 * 60 * 60 * 1000);
            const startStr = startDate.toISOString().split('T')[0];
            // Archive API (historical only)
            const archiveUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${startStr}&end_date=${todayStr}&hourly=precipitation&timezone=Asia%2FDubai`;
            const archiveRes = await fetch(archiveUrl, { signal: AbortSignal.timeout(30000) });
            const archiveData = await archiveRes.json() as { hourly: { time: string[]; precipitation: number[] } };
            // Forecast for next 3 days
            const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=precipitation,precipitation_probability&forecast_days=3&timezone=Asia%2FDubai`;
            const forecastRes = await fetch(forecastUrl, { signal: AbortSignal.timeout(20000) });
            const forecastData = await forecastRes.json() as { hourly: { time: string[]; precipitation: number[]; precipitation_probability: number[] } };
            const nowHour = dubaiNow.toISOString().slice(0, 13);
            for (let i = 0; i < archiveData.hourly.time.length; i++) {
              points.push({
                time: archiveData.hourly.time[i],
                precipitation: archiveData.hourly.precipitation[i] ?? 0,
                probability: 0,
                isHistory: true,
              });
            }
            for (let i = 0; i < forecastData.hourly.time.length; i++) {
              if (forecastData.hourly.time[i] > nowHour) {
                points.push({
                  time: forecastData.hourly.time[i],
                  precipitation: forecastData.hourly.precipitation[i] ?? 0,
                  probability: forecastData.hourly.precipitation_probability[i] ?? 0,
                  isHistory: false,
                });
              }
            }
          }

          // Aggregate to daily for long periods
          const aggregate = mode === '30d' || mode === '90d';
          if (aggregate) {
            const dailyMap = new Map<string, { precip: number; maxProb: number; isHistory: boolean }>();
            for (const p of points) {
              const day = p.time.split('T')[0];
              const existing = dailyMap.get(day);
              if (existing) {
                existing.precip += p.precipitation;
                existing.maxProb = Math.max(existing.maxProb, p.probability);
                if (!p.isHistory) existing.isHistory = false;
              } else {
                dailyMap.set(day, { precip: p.precipitation, maxProb: p.probability, isHistory: p.isHistory });
              }
            }
            points = Array.from(dailyMap.entries()).map(([day, v]) => ({
              time: day,
              precipitation: Math.round(v.precip * 10) / 10,
              probability: v.maxProb,
              isHistory: v.isHistory,
            }));
          }

          return { success: true, points, mode };
        } catch (err) {
          console.error('[weather.getPrecipHistory] Error:', err);
          return { success: false, points: [], mode: input.mode, error: String(err) };
        }
      }),
  }),

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ── Executive Summary Generator ─────────────────────────────────────────
  reports: router({
    generateExecutiveSummary: publicProcedure
      .input(z.object({
        lang: z.enum(['ar', 'en']).optional().default('en'),
        regions: z.array(z.object({
          nameAr: z.string(),
          nameEn: z.string().optional(),
          rainfall: z.number(),
          floodRisk: z.number(),
          waterAccumulation: z.number(),
          drainageLag: z.number().optional(),
        })),
        systemStats: z.object({
          totalMonitoredArea: z.number(),
          alertsLast24h: z.number(),
          avgResponseTime: z.string(),
          dataProcessed: z.string(),
          overallRisk: z.number().optional(),
        }),
        weatherSummary: z.object({
          rainfall: z.number(),
          temperature: z.number(),
          humidity: z.number(),
          windSpeed: z.number(),
        }).optional(),
        eventContext: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          const topRegion = [...input.regions].sort((a, b) => b.floodRisk - a.floodRisk)[0];
          const avgRisk = Math.round(input.regions.reduce((s, r) => s + r.floodRisk, 0) / input.regions.length);
          const criticalCount = input.regions.filter(r => r.floodRisk >= 70).length;
          const now = new Date().toLocaleString('en-AE', { timeZone: 'Asia/Dubai', dateStyle: 'full', timeStyle: 'short' });

          const dataContext = `
Current situation data — ${now}

System statistics:
- Monitored area: ${input.systemStats.totalMonitoredArea.toLocaleString()} km2
- Alerts last 24h: ${input.systemStats.alertsLast24h} alerts
- Average response time: ${input.systemStats.avgResponseTime}
- Data processed: ${input.systemStats.dataProcessed}
- Average overall risk index: ${avgRisk}%
- Critical zones (risk >=70%): ${criticalCount} zones

Zone data:
${input.regions.map(r => `- ${r.nameEn ?? r.nameAr}: rainfall ${r.rainfall} mm/h | risk ${r.floodRisk}% | accumulation water ${r.waterAccumulation.toLocaleString()} m2 ${r.drainageLag ? `| drainage lag ${r.drainageLag}h` : ''}`).join('\n')}

Highest-risk zone: ${topRegion?.nameEn ?? topRegion?.nameAr} (${topRegion?.floodRisk}%)

${input.weatherSummary ? `Current weather conditions:
- Rainfall: ${input.weatherSummary.rainfall} mm/h
- Temperature: ${input.weatherSummary.temperature} C
- Humidity: ${input.weatherSummary.humidity}%
- Wind: ${input.weatherSummary.windSpeed} km/h` : ''}

${input.eventContext ? `Event context: ${input.eventContext}` : ''}
`;

          const execLang = input.lang ?? 'en';
          const response = await invokeLLM({
            messages: [
              { role: "system", content: buildExecutiveSummaryPrompt(execLang) },
              { role: "user", content: dataContext },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "executive_summary",
                strict: true,
                schema: EXECUTIVE_SUMMARY_SCHEMA,
              },
            },
          });

          const content = response.choices?.[0]?.message?.content;
          if (!content) throw new Error("No LLM response");
          const result = typeof content === "string" ? JSON.parse(content) : content;
          return { success: true, data: result };
        } catch (err) {
          console.error("[ExecutiveSummary] Error:", err);
          return { success: false, data: null, error: String(err) };
        }
      }),
  }),

  // ── AI Chat with Platform Context ───────────────────────────────────
  chat: router({
    sendMessage: publicProcedure
      .input(z.object({
        message: z.string().min(1).max(2000),
        lang: z.enum(['ar', 'en']).optional().default('en'),
        history: z.array(z.object({
          role: z.enum(["user", "assistant"]),
          content: z.string(),
        })).max(20),
        platformContext: z.object({
          regions: z.array(z.object({
            nameAr: z.string(),
            nameEn: z.string().optional(),
            rainfall: z.number(),
            floodRisk: z.number(),
            waterAccumulation: z.number(),
            drainageLag: z.number().optional(),
          })),
          systemStats: z.object({
            totalMonitoredArea: z.number(),
            alertsLast24h: z.number(),
            avgResponseTime: z.string(),
            dataProcessed: z.string(),
          }),
          weatherSummary: z.object({
            rainfall: z.number(),
            temperature: z.number(),
            humidity: z.number(),
            windSpeed: z.number(),
          }).optional(),
          executiveSummary: z.string().optional(),
        }),
      }))
      .mutation(async ({ input }) => {
        try {
          const topRegion = [...input.platformContext.regions].sort((a, b) => b.floodRisk - a.floodRisk)[0];
          const avgRisk = Math.round(input.platformContext.regions.reduce((s, r) => s + r.floodRisk, 0) / input.platformContext.regions.length);
          const criticalRegions = input.platformContext.regions.filter(r => r.floodRisk >= 70);
          const now = new Date().toLocaleString('en-AE', { timeZone: 'Asia/Dubai', dateStyle: 'full', timeStyle: 'short' });

          const systemPrompt = `You are an AI advisor specialized in the FloodSat AI platform for flood monitoring in the Emirate of Abu Dhabi.
You have full authority to answer any question related to floods, climate, disaster management, and geophysical data.

== Live Platform Data ==
Time: ${now}

System statistics:
- Monitored area: ${input.platformContext.systemStats.totalMonitoredArea.toLocaleString()} km2
- Alerts last 24h: ${input.platformContext.systemStats.alertsLast24h}
- Response time: ${input.platformContext.systemStats.avgResponseTime}
- Data processed: ${input.platformContext.systemStats.dataProcessed}
- Average risk index: ${avgRisk}%
- Critical zones (>= 70%): ${criticalRegions.length} zones

Current zone data:
${input.platformContext.regions.map(r => `• ${r.nameEn ?? r.nameAr}: rainfall ${r.rainfall} mm/h | risk ${r.floodRisk}% | accumulation ${r.waterAccumulation.toLocaleString()} m2 ${r.drainageLag ? `| drainage lag ${r.drainageLag}h` : ''}`).join('\n')}

Highest-risk zone: ${topRegion?.nameEn ?? topRegion?.nameAr} (${topRegion?.floodRisk}%)

${input.platformContext.weatherSummary ? `Weather: ${input.platformContext.weatherSummary.rainfall}mm/h rain | ${input.platformContext.weatherSummary.temperature}°C | ${input.platformContext.weatherSummary.humidity}% humidity | ${input.platformContext.weatherSummary.windSpeed}km/h wind` : ''}
${input.platformContext.executiveSummary ? `Previously generated executive summary:\n${input.platformContext.executiveSummary}` : ''}

== Response style ==
- IMPORTANT: Respond in ${input.lang === 'ar' ? 'clear professional Arabic (Modern Standard Arabic / فصحى)' : 'clear professional English'} — match the user's language exactly
- Always reference the live data above, do not invent figures
- Be specific and practical — avoid unnecessary verbosity
- If asked about something outside platform data scope, answer with your general scientific knowledge
- Use Markdown for formatting (**emphasis**, headings, tables) when needed`;

          const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
            { role: "system", content: systemPrompt },
            ...input.history.map(h => ({ role: h.role as "user" | "assistant", content: h.content })),
            { role: "user", content: input.message },
          ];

          const response = await invokeLLM({ messages });
          const reply = response.choices?.[0]?.message?.content;
          if (!reply || typeof reply !== "string") throw new Error("No reply");
          return { success: true, reply };
        } catch (err) {
          console.error("[FloodChat] Error:", err);
        return { success: false, reply: "Sorry, a connection error occurred. Please try again." };
        }
      }),
  }),

  // ── Drainage Network (OSM + Open-Meteo soil moisture) ─────────────────────
  drainage: router({
    getSystems: publicProcedure
      .query(async () => {
        try {
          const systems = await fetchDrainageSystems();
          return { success: true, data: systems };
        } catch (err) {
          console.error('[drainage.getSystems] Error:', err);
          return { success: false, data: [], error: String(err) };
        }
      }),
    invalidateCache: publicProcedure
      .mutation(async () => {
        invalidateDrainageCache();
        return { success: true };
      }),
  }),

  // ── Flood Vision Analysis ─────────────────────────────────────────────────
  flood: router({
    analyzeImage: publicProcedure
      .input(z.object({
        imageBase64: z.string(), // base64 JPEG image (without data URL prefix)
        lat: z.number(),
        lng: z.number(),
        timestamp: z.number(),
      }))
      .mutation(async ({ input }) => {
        try {
          const response = await invokeLLM({
            messages: [
              { role: "system", content: FLOOD_ANALYSIS_SYSTEM_PROMPT },
              {
                role: "user",
                content: [
                  {
                    type: "image_url",
                    image_url: {
                      url: `data:image/jpeg;base64,${input.imageBase64}`,
        detail: "low", // fast and sufficient for field monitoring
                    },
                  },
                  {
                    type: "text",
        text: `Analyze this field image captured from a vehicle in the UAE.
        Coordinates: ${input.lat.toFixed(5)}, ${input.lng.toFixed(5)}
        Time: ${new Date(input.timestamp).toLocaleString('en-AE')}
        Is there a water pool? Return result in JSON format only.`,
                  },
                ],
              },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "flood_analysis",
                strict: true,
                schema: FLOOD_ANALYSIS_SCHEMA,
              },
            },
          });

          const content = response.choices?.[0]?.message?.content;
          if (!content) throw new Error("No response from LLM");

          const result = typeof content === "string" ? JSON.parse(content) : content;
          return { success: true, data: result };
        } catch (err) {
          console.error("[FloodVision] Analysis error:", err);
        // fallback: if LLM fails, return random analysis for continuity
          return {
            success: false,
            data: {
              hasWater: false,
              floodStatus: "dry",
              floodDepthCm: 0,
              floodLengthM: 0,
              side: "none",
              confidence: 0,
              trafficDensity: "clear",
              rainIntensity: "none",
              hazardLevel: "safe",
          notes: "Analysis failed — check connection",
            },
          };
        }
      }),
   }),

  // ── Notifications Router ─────────────────────────────────────────────────────
  notifications: router({
    // Get all alerts with pagination
    getAlerts: publicProcedure
      .input(z.object({
        limit: z.number().default(50),
        offset: z.number().default(0),
        level: z.enum(['all', 'watch', 'warning', 'critical']).default('all'),
        acknowledged: z.enum(['all', 'yes', 'no']).default('all'),
      }))
      .query(async ({ input }) => {
        try {
          const db = await getDb();
          if (!db) return { success: false, alerts: [], total: 0 };

          const results = await db.select().from(floodAlerts)
            .orderBy(desc(floodAlerts.createdAt))
            .limit(input.limit)
            .offset(input.offset);

          // Filter in JS for simplicity
          let filtered = results;
          if (input.level !== 'all') {
            filtered = filtered.filter(a => a.alertLevel === input.level);
          }
          if (input.acknowledged === 'yes') {
            filtered = filtered.filter(a => a.acknowledged === 1);
          } else if (input.acknowledged === 'no') {
            filtered = filtered.filter(a => a.acknowledged === 0);
          }

          return { success: true, alerts: filtered, total: filtered.length };
        } catch (err) {
          console.error('[notifications.getAlerts]', err);
          return { success: false, alerts: [], total: 0 };
        }
      }),

    // Get unread (unacknowledged) count
    getUnreadCount: publicProcedure
      .query(async () => {
        try {
          const db = await getDb();
          if (!db) return { count: 0 };
          const rows = await db.select().from(floodAlerts)
            .where(eq(floodAlerts.acknowledged, 0));
          return { count: rows.length };
        } catch (err) {
          return { count: 0 };
        }
      }),

    // Acknowledge a single alert
    acknowledge: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        try {
          const db = await getDb();
          if (!db) return { success: false };
          await db.update(floodAlerts)
            .set({ acknowledged: 1, acknowledgedAt: new Date() })
            .where(eq(floodAlerts.id, input.id));
          return { success: true };
        } catch (err) {
          console.error('[notifications.acknowledge]', err);
          return { success: false };
        }
      }),

    // Acknowledge all alerts
    acknowledgeAll: publicProcedure
      .mutation(async () => {
        try {
          const db = await getDb();
          if (!db) return { success: false };
          await db.update(floodAlerts)
            .set({ acknowledged: 1, acknowledgedAt: new Date() })
            .where(eq(floodAlerts.acknowledged, 0));
          return { success: true };
        } catch (err) {
          console.error('[notifications.acknowledgeAll]', err);
          return { success: false };
        }
      }),

    // Clear all alerts
    clearAll: publicProcedure
      .mutation(async () => {
        try {
          const db = await getDb();
          if (!db) return { success: false };
          await db.delete(floodAlerts);
          return { success: true };
        } catch (err) {
          console.error('[notifications.clearAll]', err);
          return { success: false };
        }
      }),

    // Get alert settings
    getSettings: publicProcedure
      .query(async () => {
        try {
          const db = await getDb();
          if (!db) return { riskThreshold: 70, cooldownMinutes: 30, notificationsEnabled: true };
          const rows = await db.select().from(alertSettings).limit(1);
          if (rows.length > 0) {
            return {
              riskThreshold: rows[0].riskThreshold,
              cooldownMinutes: rows[0].cooldownMinutes,
              notificationsEnabled: rows[0].notificationsEnabled === 1,
            };
          }
          return { riskThreshold: 70, cooldownMinutes: 30, notificationsEnabled: true };
        } catch (err) {
          return { riskThreshold: 70, cooldownMinutes: 30, notificationsEnabled: true };
        }
      }),

    // Update alert settings
    updateSettings: publicProcedure
      .input(z.object({
        riskThreshold: z.number().min(10).max(100),
        cooldownMinutes: z.number().min(5).max(120),
        notificationsEnabled: z.boolean(),
      }))
      .mutation(async ({ input }) => {
        try {
          const db = await getDb();
          if (!db) return { success: false };
          const existing = await db.select().from(alertSettings).limit(1);
          if (existing.length > 0) {
            await db.update(alertSettings)
              .set({
                riskThreshold: input.riskThreshold,
                cooldownMinutes: input.cooldownMinutes,
                notificationsEnabled: input.notificationsEnabled ? 1 : 0,
              })
              .where(eq(alertSettings.id, existing[0].id));
          } else {
            await db.insert(alertSettings).values({
              riskThreshold: input.riskThreshold,
              cooldownMinutes: input.cooldownMinutes,
              notificationsEnabled: input.notificationsEnabled ? 1 : 0,
            });
          }
          return { success: true };
        } catch (err) {
          console.error('[notifications.updateSettings]', err);
          return { success: false };
        }
      }),

    // Manually trigger alert check (for testing)
    triggerCheck: publicProcedure
      .mutation(async () => {
        try {
          await triggerManualCheck();
          return { success: true };
        } catch (err) {
          return { success: false, error: String(err) };
        }
      }),
  }),

  // ── Historical Data (ERA5 Archive) ──────────────────────────────────────
  historical: router({
    getData: publicProcedure
      .query(async () => {
        try {
          const data = await fetchHistoricalData();
          return { success: true, data };
        } catch (err) {
          console.error('[historical.getData] Error:', err);
          return { success: false, data: null, error: String(err) };
        }
      }),
    invalidateCache: publicProcedure
      .mutation(() => {
        invalidateHistoricalCache();
        return { success: true };
      }),
  }),

  // ── Satellite Imagery ────────────────────────────────────────────────────
  satellite: router({
    // Get list of available providers and their subscription requirements
    getProviders: publicProcedure
      .query(() => {
        return { success: true, providers: SATELLITE_PROVIDERS };
      }),

    // Fetch satellite image (SAR or Optical) — requires credentials for Sentinel Hub
    fetchImage: publicProcedure
      .input(z.object({
        bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
        dateFrom: z.string(),
        dateTo: z.string(),
        imageType: z.enum(['SAR', 'OPTICAL', 'FLOOD_MAP']),
        credentials: z.object({
          clientId: z.string(),
          clientSecret: z.string(),
        }).optional(),
      }))
      .query(async ({ input }) => {
        try {
          const result = await fetchSatelliteImage(input);
          return result;
        } catch (err) {
          console.error('[satellite.fetchImage] Error:', err);
          return { success: false, source: 'Unknown', error: String(err) };
        }
      }),

    // Search for available Sentinel-1 scenes (free, no auth required)
    searchScenes: publicProcedure
      .input(z.object({
        bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
        dateFrom: z.string(),
        dateTo: z.string(),
      }))
      .query(async ({ input }) => {
        try {
          const scenes = await searchSentinel1Scenes(input.bbox, input.dateFrom, input.dateTo);
          return { success: true, scenes };
        } catch (err) {
          return { success: false, scenes: [], error: String(err) };
        }
      }),

    // Get Copernicus CEMS emergency activations (free)
    getCEMSActivations: publicProcedure
      .query(async () => {
        try {
          const activations = await fetchCopernicusCEMSActivations('UAE');
          return { success: true, activations };
        } catch (err) {
          return { success: false, activations: [], error: String(err) };
        }
      }),
  }),
});
export type AppRouter = typeof appRouter;
