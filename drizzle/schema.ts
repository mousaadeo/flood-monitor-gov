import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between keys.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Flood alert notifications log
export const floodAlerts = mysqlTable("floodAlerts", {
  id: int("id").autoincrement().primaryKey(),
  regionId: varchar("regionId", { length: 64 }).notNull(),
  regionNameEn: varchar("regionNameEn", { length: 128 }).notNull(),
  regionNameAr: varchar("regionNameAr", { length: 128 }).notNull(),
  alertLevel: mysqlEnum("alertLevel", ["watch", "warning", "critical"]).notNull(),
  floodRisk: int("floodRisk").notNull(),
  precipitation: varchar("precipitation", { length: 32 }).notNull().default("0"),
  notified: int("notified").default(0).notNull(), // 1 if push notification was sent
  acknowledged: int("acknowledged").default(0).notNull(), // 1 if operator acknowledged
  acknowledgedAt: timestamp("acknowledgedAt"),
  lat: varchar("lat", { length: 32 }).notNull().default("0"),
  lon: varchar("lon", { length: 32 }).notNull().default("0"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type FloodAlert = typeof floodAlerts.$inferSelect;
export type InsertFloodAlert = typeof floodAlerts.$inferInsert;

// Alert engine settings
export const alertSettings = mysqlTable("alertSettings", {
  id: int("id").autoincrement().primaryKey(),
  riskThreshold: int("riskThreshold").default(70).notNull(), // % flood risk to trigger alert
  cooldownMinutes: int("cooldownMinutes").default(30).notNull(), // minutes between alerts for same region
  notificationsEnabled: int("notificationsEnabled").default(1).notNull(), // 1=enabled
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AlertSettings = typeof alertSettings.$inferSelect;
