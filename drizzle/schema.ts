import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const loanApplications = mysqlTable("loan_applications", {
  id: int("id").autoincrement().primaryKey(),
  applicationId: varchar("applicationId", { length: 64 }).notNull().unique(),
  borrowerOpenId: varchar("borrowerOpenId", { length: 64 }),
  walletAddress: varchar("walletAddress", { length: 128 }).notNull(),
  sourceChain: varchar("sourceChain", { length: 48 }).notNull(),
  state: varchar("state", { length: 32 }).notNull(),
  requestedAmount: decimal("requestedAmount", { precision: 18, scale: 2 }).notNull(),
  evidenceRoot: varchar("evidenceRoot", { length: 128 }),
  policyHash: varchar("policyHash", { length: 128 }),
  modelVersion: varchar("modelVersion", { length: 128 }),
  decisionHash: varchar("decisionHash", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const verifiedFacts = mysqlTable("verified_facts", {
  id: int("id").autoincrement().primaryKey(),
  factId: varchar("factId", { length: 64 }).notNull().unique(),
  applicationId: varchar("applicationId", { length: 64 }).notNull(),
  chain: varchar("chain", { length: 48 }).notNull(),
  sourceBlock: int("sourceBlock").notNull(),
  txHash: varchar("txHash", { length: 128 }).notNull(),
  eventType: varchar("eventType", { length: 48 }).notNull(),
  amount: varchar("amount", { length: 64 }).notNull(),
  verificationBlock: int("verificationBlock").notNull(),
  freshness: varchar("freshness", { length: 16 }).notNull(),
  proofRoot: varchar("proofRoot", { length: 128 }).notNull(),
  verifiedAt: timestamp("verifiedAt").defaultNow().notNull(),
});

export const decisions = mysqlTable("decisions", {
  id: int("id").autoincrement().primaryKey(),
  applicationId: varchar("applicationId", { length: 64 }).notNull(),
  pd30: decimal("pd30", { precision: 8, scale: 5 }).notNull(),
  pd90: decimal("pd90", { precision: 8, scale: 5 }).notNull(),
  confidence: decimal("confidence", { precision: 8, scale: 5 }).notNull(),
  riskTier: varchar("riskTier", { length: 8 }).notNull(),
  reasonCodes: text("reasonCodes").notNull(),
  featureVersion: varchar("featureVersion", { length: 128 }).notNull(),
  modelVersion: varchar("modelVersion", { length: 128 }).notNull(),
  policyHash: varchar("policyHash", { length: 128 }).notNull(),
  evidenceRoot: varchar("evidenceRoot", { length: 128 }).notNull(),
  decisionHash: varchar("decisionHash", { length: 128 }).notNull(),
  featureFingerprint: varchar("featureFingerprint", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const offers = mysqlTable("offers", {
  id: int("id").autoincrement().primaryKey(),
  applicationId: varchar("applicationId", { length: 64 }).notNull(),
  amount: decimal("amount", { precision: 18, scale: 2 }).notNull(),
  apr: decimal("apr", { precision: 8, scale: 3 }).notNull(),
  ltv: decimal("ltv", { precision: 8, scale: 5 }).notNull(),
  termDays: int("termDays").notNull(),
  status: varchar("status", { length: 16 }).notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;


export const acceptanceIdempotency = mysqlTable("acceptance_idempotency", {
  id: int("id").autoincrement().primaryKey(),
  applicationId: varchar("applicationId", { length: 64 }).notNull().unique(),
  requestKey: varchar("requestKey", { length: 128 }).notNull(),
  status: varchar("status", { length: 16 }).notNull(),
  resultJson: text("resultJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const proofRequestIdempotency = mysqlTable("proof_request_idempotency", {
  id: int("id").autoincrement().primaryKey(),
  requestKey: varchar("requestKey", { length: 128 }).notNull().unique(),
  walletAddress: varchar("walletAddress", { length: 128 }).notNull(),
  sourceChain: varchar("sourceChain", { length: 48 }).notNull(),
  applicationId: varchar("applicationId", { length: 64 }),
  status: varchar("status", { length: 16 }).notNull(),
  resultJson: text("resultJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const auditEvents = mysqlTable("audit_events", {
  id: int("id").autoincrement().primaryKey(),
  applicationId: varchar("applicationId", { length: 64 }).notNull(),
  state: varchar("state", { length: 32 }).notNull(),
  label: varchar("label", { length: 64 }).notNull(),
  detail: text("detail").notNull(),
  eventHash: varchar("eventHash", { length: 128 }).notNull().unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
