import { createInsertSchema } from "drizzle-zod";
import {
  date,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const profilesTable = pgTable("profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull().unique(),
  avatarUrl: text("avatar_url"),
  avatarInitials: text("avatar_initials").notNull(),
  role: text("role").notNull(),
  department: text("department").notNull(),
  status: text("status").notNull().default("offline"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tasksTable = pgTable("tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  status: text("status").notNull().default("todo"),
  priority: text("priority").notNull().default("medium"),
  assigneeId: uuid("assignee_id").notNull().references(() => profilesTable.id),
  creatorId: uuid("creator_id").notNull().references(() => profilesTable.id),
  department: text("department").notNull(),
  dueDate: date("due_date", { mode: "string" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const timeSessionsTable = pgTable("time_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  taskId: uuid("task_id").notNull().references(() => tasksTable.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => profilesTable.id),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  durationSeconds: integer("duration_seconds").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const taskCommentsTable = pgTable("task_comments", {
  id: uuid("id").defaultRandom().primaryKey(),
  taskId: uuid("task_id").notNull().references(() => tasksTable.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => profilesTable.id),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const activityLogsTable = pgTable("activity_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => profilesTable.id),
  taskId: uuid("task_id").references(() => tasksTable.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  metadata: jsonb("metadata").$type<Record<string, string | number | null>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertProfileSchema = createInsertSchema(profilesTable).omit({ id: true, createdAt: true });
export const insertTaskSchema = createInsertSchema(tasksTable).omit({ id: true, createdAt: true });
export const insertTimeSessionSchema = createInsertSchema(timeSessionsTable).omit({ id: true, createdAt: true });
export const insertTaskCommentSchema = createInsertSchema(taskCommentsTable).omit({ id: true, createdAt: true });
export const insertActivityLogSchema = createInsertSchema(activityLogsTable).omit({ id: true, createdAt: true });

export type Profile = z.infer<typeof insertProfileSchema>;
export type Task = typeof tasksTable.$inferSelect;
export type TimeSession = typeof timeSessionsTable.$inferSelect;
export type TaskComment = typeof taskCommentsTable.$inferSelect;
export type ActivityLog = typeof activityLogsTable.$inferSelect;