/**
 * alertEngine.ts — Flood Alert Engine
 *
 * Monitors live weather data every 5 minutes.
 * When a region's flood risk exceeds the configured threshold (default 70%),
 * it logs the alert to the database and sends a push notification to the owner.
 * A 30-minute cooldown per region prevents duplicate alerts.
 */

import { getDb } from "./db";
import { floodAlerts, alertSettings } from "../drizzle/schema";
import { notifyOwner } from "./_core/notification";
import { getCachedWeatherData } from "./weatherService";

// In-memory cooldown tracker: regionId → last alert timestamp (ms)
const cooldownMap = new Map<string, number>();

let engineRunning = false;
let engineInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Get current alert settings from DB (or defaults if none exist)
 */
async function getSettings(): Promise<{ riskThreshold: number; cooldownMinutes: number; notificationsEnabled: boolean }> {
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
    // Insert default settings
    await db.insert(alertSettings).values({
      riskThreshold: 70,
      cooldownMinutes: 30,
      notificationsEnabled: 1,
    });
    return { riskThreshold: 70, cooldownMinutes: 30, notificationsEnabled: true };
  } catch (err) {
    console.error("[AlertEngine] Failed to get settings:", err);
    return { riskThreshold: 70, cooldownMinutes: 30, notificationsEnabled: true };
  }
}

/**
 * Main check function — runs every 5 minutes
 */
async function runAlertCheck() {
  try {
    const weatherData = getCachedWeatherData();
    if (!weatherData) {
      console.log("[AlertEngine] No cached weather data yet, skipping check");
      return;
    }

    const settings = await getSettings();
    const { riskThreshold, cooldownMinutes, notificationsEnabled } = settings;
    const now = Date.now();
    const cooldownMs = cooldownMinutes * 60 * 1000;

    const triggeredRegions: Array<{
      regionId: string;
      regionNameEn: string;
      regionNameAr: string;
      alertLevel: "watch" | "warning" | "critical";
      floodRisk: number;
      precipitation: number;
      lat: number;
      lon: number;
    }> = [];

    for (const region of weatherData.regions) {
      if (region.floodRisk < riskThreshold) continue;
      if (region.alertLevel === "safe") continue;

      // Check cooldown
      const lastAlert = cooldownMap.get(region.id);
      if (lastAlert && now - lastAlert < cooldownMs) continue;

      triggeredRegions.push({
        regionId: region.id,
        regionNameEn: region.nameEn,
        regionNameAr: region.nameAr,
        alertLevel: region.alertLevel as "watch" | "warning" | "critical",
        floodRisk: region.floodRisk,
        precipitation: region.currentPrecipitation,
        lat: region.lat,
        lon: region.lon,
      });

      // Update cooldown
      cooldownMap.set(region.id, now);
    }

    if (triggeredRegions.length === 0) return;

    console.log(`[AlertEngine] ${triggeredRegions.length} new alerts triggered`);

    // Insert all triggered alerts into DB
    const db = await getDb();
    if (db) {
      for (const r of triggeredRegions) {
        await db.insert(floodAlerts).values({
          regionId: r.regionId,
          regionNameEn: r.regionNameEn,
          regionNameAr: r.regionNameAr,
          alertLevel: r.alertLevel,
          floodRisk: r.floodRisk,
          precipitation: String(r.precipitation),
          lat: String(r.lat),
          lon: String(r.lon),
          notified: notificationsEnabled ? 1 : 0,
          acknowledged: 0,
        });
      }
    }

    // Send push notification if enabled
    if (notificationsEnabled && triggeredRegions.length > 0) {
      const criticalList = triggeredRegions.filter(r => r.alertLevel === "critical");
      const warningList = triggeredRegions.filter(r => r.alertLevel === "warning");
      const watchList = triggeredRegions.filter(r => r.alertLevel === "watch");

      const levelSummary = [
        criticalList.length > 0 ? `🔴 Critical: ${criticalList.length}` : "",
        warningList.length > 0 ? `🟠 Warning: ${warningList.length}` : "",
        watchList.length > 0 ? `🟡 Watch: ${watchList.length}` : "",
      ].filter(Boolean).join(" | ");

      const topRegions = triggeredRegions
        .sort((a, b) => b.floodRisk - a.floodRisk)
        .slice(0, 5)
        .map(r => `• ${r.regionNameEn}: ${r.floodRisk}% risk (${r.precipitation}mm/hr)`)
        .join("\n");

      const title = `⚠️ FloodSat AI — ${triggeredRegions.length} Flood Alert${triggeredRegions.length > 1 ? "s" : ""} Triggered`;
      const content = `${levelSummary}\n\nTop Affected Regions:\n${topRegions}\n\nTime: ${new Date().toLocaleString("en-AE", { timeZone: "Asia/Dubai" })}\nThreshold: ≥${riskThreshold}% flood risk`;

      try {
        await notifyOwner({ title, content });
        console.log(`[AlertEngine] Push notification sent for ${triggeredRegions.length} alerts`);
      } catch (err) {
        console.error("[AlertEngine] Failed to send push notification:", err);
      }
    }
  } catch (err) {
    console.error("[AlertEngine] Check failed:", err);
  }
}

/**
 * Start the alert engine background loop
 */
export function startAlertEngine() {
  if (engineRunning) return;
  engineRunning = true;

  // Run first check after 30 seconds (allow weather data to load)
  setTimeout(() => {
    runAlertCheck();
  }, 30_000);

  // Then run every 5 minutes
  engineInterval = setInterval(() => {
    runAlertCheck();
  }, 5 * 60 * 1000);

  console.log("[AlertEngine] Started — checking every 5 minutes");
}

/**
 * Stop the alert engine
 */
export function stopAlertEngine() {
  if (engineInterval) {
    clearInterval(engineInterval);
    engineInterval = null;
  }
  engineRunning = false;
  console.log("[AlertEngine] Stopped");
}

/**
 * Manually trigger an immediate check (for testing)
 */
export async function triggerManualCheck() {
  await runAlertCheck();
}
