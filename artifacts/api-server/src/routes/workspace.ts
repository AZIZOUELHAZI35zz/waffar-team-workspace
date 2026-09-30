import { Router, type IRouter } from "express";
import { and, desc, eq, gte, isNull, lt, or } from "drizzle-orm";
import { db, activityLogsTable, profilesTable, taskCommentsTable, tasksTable, timeSessionsTable } from "@workspace/db";
import {
  CreateTaskBody,
  CreateTaskCommentBody,
  CreateTaskCommentParams,
  CreateTaskResponse,
  DeleteTaskParams,
  GetWorkspaceResponse,
  ListActivityResponse,
  ListTaskCommentsParams,
  ListTaskCommentsResponse,
  ListTasksQueryParams,
  ListTasksResponse,
  StartTaskTimerParams,
  StartTaskTimerResponse,
  StopTaskTimerParams,
  StopTaskTimerResponse,
  UpdateTaskBody,
  UpdateTaskParams,
  UpdateTaskResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();
let seedPromise: Promise<void> | undefined;

const seed = async (): Promise<void> => {
  const existing = await db.select({ id: profilesTable.id }).from(profilesTable).limit(1);
  if (existing.length) return;

  const [aziz, cto, cmo] = await db
    .insert(profilesTable)
    .values([
      { fullName: "Aziz El Hazri", email: "aziz@waffar.co", avatarInitials: "AE", role: "CEO", department: "CEO", status: "working" },
      { fullName: "CTO", email: "cto@waffar.co", avatarInitials: "CT", role: "CTO", department: "CTO", status: "working" },
      { fullName: "CMO", email: "cmo@waffar.co", avatarInitials: "CM", role: "CMO", department: "CMO", status: "online" },
    ])
    .returning();

  const seededTasks = await db
    .insert(tasksTable)
    .values([
      { title: "Build WAFFAR Landing Page", description: "Turn the first product story into a clear, conversion-focused landing page.", status: "in_progress", priority: "high", assigneeId: aziz.id, creatorId: aziz.id, department: "CEO", dueDate: "2026-10-02" },
      { title: "Implement Supabase Authentication", description: "Set up the secure email login flow and session persistence for the workspace.", status: "in_progress", priority: "urgent", assigneeId: cto.id, creatorId: aziz.id, department: "CTO", dueDate: "2026-10-01" },
      { title: "Create Marketing Strategy", description: "Outline the first three channels and a simple weekly experiment cadence.", status: "todo", priority: "medium", assigneeId: cmo.id, creatorId: aziz.id, department: "CMO", dueDate: "2026-10-06" },
      { title: "Contact First 10 Merchants", description: "Talk to ten early merchants and capture the strongest objections.", status: "blocked", priority: "high", assigneeId: aziz.id, creatorId: cmo.id, department: "Sales", dueDate: "2026-10-08" },
      { title: "Prepare Investor Presentation", description: "Refine the narrative, traction slide, and next milestone.", status: "done", priority: "medium", assigneeId: aziz.id, creatorId: aziz.id, department: "CEO", dueDate: "2026-09-24" },
    ])
    .returning();

  await db.insert(timeSessionsTable).values([
    { taskId: seededTasks[0].id, userId: aziz.id, startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), endedAt: new Date(Date.now() - 30 * 60 * 1000), durationSeconds: 5400 },
    { taskId: seededTasks[1].id, userId: cto.id, startedAt: new Date(Date.now() - 3 * 60 * 60 * 1000), endedAt: new Date(Date.now() - 45 * 60 * 1000), durationSeconds: 8100 },
    { taskId: seededTasks[2].id, userId: cmo.id, startedAt: new Date(Date.now() - 90 * 60 * 1000), endedAt: new Date(Date.now() - 20 * 60 * 1000), durationSeconds: 4200 },
  ]);

  await db.insert(activityLogsTable).values([
    { userId: aziz.id, taskId: seededTasks[4].id, action: "task_completed", metadata: { title: seededTasks[4].title } },
    { userId: cto.id, taskId: seededTasks[1].id, action: "timer_started", metadata: { title: seededTasks[1].title } },
    { userId: aziz.id, taskId: seededTasks[0].id, action: "task_created", metadata: { title: seededTasks[0].title, assignee: "Aziz El Hazri" } },
  ]);
};

const ensureSeed = (): Promise<void> => {
  seedPromise ??= seed();
  return seedPromise;
};

const currentUser = async () => {
  const [profile] = await db.select().from(profilesTable).orderBy(profilesTable.createdAt).limit(1);
  return profile;
};

const profileView = (profile: typeof profilesTable.$inferSelect, stats?: { completed: number; inProgress: number; today: number; week: number; currentTaskId: string | null }) => ({
  id: profile.id,
  fullName: profile.fullName,
  email: profile.email,
  avatarUrl: profile.avatarUrl,
  avatarInitials: profile.avatarInitials,
  role: profile.role,
  department: profile.department,
  status: profile.status,
  currentTaskId: stats?.currentTaskId ?? null,
  tasksCompleted: stats?.completed ?? 0,
  tasksInProgress: stats?.inProgress ?? 0,
  timeTodaySeconds: stats?.today ?? 0,
  timeWeekSeconds: stats?.week ?? 0,
});

const sessionSeconds = (session: typeof timeSessionsTable.$inferSelect): number =>
  session.endedAt ? session.durationSeconds : session.durationSeconds + Math.max(0, Math.floor((Date.now() - session.startedAt.getTime()) / 1000));

const buildWorkspace = async () => {
  const [profiles, tasks, sessions, activity] = await Promise.all([
    db.select().from(profilesTable).orderBy(profilesTable.createdAt),
    db.select().from(tasksTable).orderBy(desc(tasksTable.createdAt)),
    db.select().from(timeSessionsTable).orderBy(desc(timeSessionsTable.startedAt)),
    db.select().from(activityLogsTable).orderBy(desc(activityLogsTable.createdAt)).limit(12),
  ]);
  const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(dayStart);
  weekStart.setDate(dayStart.getDate() - ((dayStart.getDay() + 6) % 7));
  const team = profiles.map((profile) => {
    const memberTasks = tasks.filter((task) => task.assigneeId === profile.id);
    const memberSessions = sessions.filter((session) => session.userId === profile.id);
    return profileView(profile, {
      completed: memberTasks.filter((task) => task.status === "done").length,
      inProgress: memberTasks.filter((task) => task.status === "in_progress").length,
      currentTaskId: memberTasks.find((task) => task.status === "in_progress")?.id ?? null,
      today: memberSessions.filter((session) => session.startedAt >= dayStart).reduce((sum, session) => sum + sessionSeconds(session), 0),
      week: memberSessions.filter((session) => session.startedAt >= weekStart).reduce((sum, session) => sum + sessionSeconds(session), 0),
    });
  });
  const taskView = tasks.map((task) => ({
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    assignee: profileView(profileMap.get(task.assigneeId)!),
    creator: profileView(profileMap.get(task.creatorId)!),
    department: task.department,
    dueDate: task.dueDate,
    timeSpentSeconds: sessions.filter((session) => session.taskId === task.id).reduce((sum, session) => sum + sessionSeconds(session), 0),
    activeSession: (() => {
      const active = sessions.find((session) => session.taskId === task.id && !session.endedAt);
      return active ? { startedAt: active.startedAt.toISOString(), userId: active.userId } : null;
    })(),
    createdAt: task.createdAt.toISOString(),
  }));
  const activityView = activity.map((entry) => {
    const actor = profileMap.get(entry.userId)!;
    const metadata = entry.metadata ?? {};
    const title = typeof metadata.title === "string" ? metadata.title : "a task";
    const messageByAction: Record<string, string> = {
      task_completed: `completed ${title}`,
      timer_started: `started working on ${title}`,
      timer_stopped: `stopped working on ${title}`,
      task_created: `created ${title}`,
      comment_added: `commented on ${title}`,
      task_updated: `updated ${title}`,
    };
    return { id: entry.id, action: entry.action, actor: profileView(actor), taskId: entry.taskId, message: messageByAction[entry.action] ?? `updated ${title}`, createdAt: entry.createdAt.toISOString() };
  });
  const user = team[0];
  return {
    currentUser: user,
    team,
    tasks: taskView,
    activity: activityView,
    stats: {
      myTasks: tasks.filter((task) => task.assigneeId === user.id && task.status !== "done").length,
      inProgress: tasks.filter((task) => task.status === "in_progress").length,
      completed: tasks.filter((task) => task.assigneeId === user.id && task.status === "done").length,
      timeTodaySeconds: user.timeTodaySeconds,
      timeWeekSeconds: user.timeWeekSeconds,
    },
  };
};

const taskById = async (id: string) => {
  const workspace = await buildWorkspace();
  return workspace.tasks.find((task) => task.id === id);
};

router.get("/workspace", async (_req, res): Promise<void> => {
  await ensureSeed();
  res.json(GetWorkspaceResponse.parse(await buildWorkspace()));
});

router.get("/tasks", async (req, res): Promise<void> => {
  await ensureSeed();
  const parsed = ListTasksQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const workspace = await buildWorkspace();
  const filtered = workspace.tasks.filter((task) => (!parsed.data.assigneeId || task.assignee.id === parsed.data.assigneeId) && (!parsed.data.status || task.status === parsed.data.status));
  res.json(ListTasksResponse.parse(filtered));
});

router.post("/tasks", async (req, res): Promise<void> => {
  await ensureSeed();
  const parsed = CreateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const user = await currentUser();
  const [created] = await db.insert(tasksTable).values({ ...parsed.data, creatorId: user.id }).returning();
  await db.insert(activityLogsTable).values({ userId: user.id, taskId: created.id, action: "task_created", metadata: { title: created.title } });
  res.status(201).json(CreateTaskResponse.parse(await taskById(created.id)));
});

router.patch("/tasks/:taskId", async (req, res): Promise<void> => {
  await ensureSeed();
  const params = UpdateTaskParams.safeParse(req.params);
  const body = UpdateTaskBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid task update" });
    return;
  }
  const user = await currentUser();
  const [updated] = await db.update(tasksTable).set(body.data).where(eq(tasksTable.id, params.data.taskId)).returning();
  if (!updated) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  const action = body.data.status === "done" ? "task_completed" : "task_updated";
  await db.insert(activityLogsTable).values({ userId: user.id, taskId: updated.id, action, metadata: { title: updated.title } });
  res.json(UpdateTaskResponse.parse(await taskById(updated.id)));
});

router.delete("/tasks/:taskId", async (req, res): Promise<void> => {
  await ensureSeed();
  const params = DeleteTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [deleted] = await db.delete(tasksTable).where(eq(tasksTable.id, params.data.taskId)).returning();
  if (!deleted) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  res.sendStatus(204);
});

router.get("/tasks/:taskId/comments", async (req, res): Promise<void> => {
  await ensureSeed();
  const params = ListTaskCommentsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [comments, profiles] = await Promise.all([
    db.select().from(taskCommentsTable).where(eq(taskCommentsTable.taskId, params.data.taskId)).orderBy(desc(taskCommentsTable.createdAt)),
    db.select().from(profilesTable),
  ]);
  const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
  res.json(ListTaskCommentsResponse.parse(comments.map((comment) => ({ id: comment.id, taskId: comment.taskId, author: profileView(profileMap.get(comment.userId)!), content: comment.content, createdAt: comment.createdAt.toISOString() }))));
});

router.post("/tasks/:taskId/comments", async (req, res): Promise<void> => {
  await ensureSeed();
  const params = CreateTaskCommentParams.safeParse(req.params);
  const body = CreateTaskCommentBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid comment" });
    return;
  }
  const user = await currentUser();
  const [comment] = await db.insert(taskCommentsTable).values({ taskId: params.data.taskId, userId: user.id, content: body.data.content }).returning();
  const task = await taskById(params.data.taskId);
  await db.insert(activityLogsTable).values({ userId: user.id, taskId: params.data.taskId, action: "comment_added", metadata: { title: task?.title ?? "a task" } });
  res.status(201).json({ id: comment.id, taskId: comment.taskId, author: profileView(user), content: comment.content, createdAt: comment.createdAt.toISOString() });
});

router.post("/tasks/:taskId/timer", async (req, res): Promise<void> => {
  await ensureSeed();
  const params = StartTaskTimerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const user = await currentUser();
  const [active] = await db.select().from(timeSessionsTable).where(and(eq(timeSessionsTable.userId, user.id), isNull(timeSessionsTable.endedAt))).limit(1);
  if (active) {
    res.status(409).json({ error: "Stop the current timer before starting another." });
    return;
  }
  const [session] = await db.insert(timeSessionsTable).values({ taskId: params.data.taskId, userId: user.id, startedAt: new Date() }).returning();
  await db.update(tasksTable).set({ status: "in_progress" }).where(eq(tasksTable.id, params.data.taskId));
  await db.insert(activityLogsTable).values({ userId: user.id, taskId: params.data.taskId, action: "timer_started", metadata: { title: (await taskById(params.data.taskId))?.title ?? "a task" } });
  res.status(201).json(StartTaskTimerResponse.parse({ id: session.id, taskId: session.taskId, userId: session.userId, startedAt: session.startedAt.toISOString(), endedAt: null, durationSeconds: 0 }));
});

router.post("/tasks/:taskId/timer/stop", async (req, res): Promise<void> => {
  await ensureSeed();
  const params = StopTaskTimerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const user = await currentUser();
  const [active] = await db.select().from(timeSessionsTable).where(and(eq(timeSessionsTable.taskId, params.data.taskId), eq(timeSessionsTable.userId, user.id), isNull(timeSessionsTable.endedAt))).limit(1);
  if (!active) {
    res.status(404).json({ error: "No active timer found." });
    return;
  }
  const endedAt = new Date();
  const durationSeconds = Math.max(1, Math.floor((endedAt.getTime() - active.startedAt.getTime()) / 1000));
  const [session] = await db.update(timeSessionsTable).set({ endedAt, durationSeconds }).where(eq(timeSessionsTable.id, active.id)).returning();
  await db.insert(activityLogsTable).values({ userId: user.id, taskId: active.taskId, action: "timer_stopped", metadata: { title: (await taskById(active.taskId))?.title ?? "a task", durationSeconds } });
  res.json(StopTaskTimerResponse.parse({ id: session.id, taskId: session.taskId, userId: session.userId, startedAt: session.startedAt.toISOString(), endedAt: session.endedAt?.toISOString() ?? null, durationSeconds: session.durationSeconds }));
});

router.get("/activity", async (_req, res): Promise<void> => {
  await ensureSeed();
  const workspace = await buildWorkspace();
  res.json(ListActivityResponse.parse(workspace.activity));
});

export default router;