import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Profile, Task, Activity, Workspace } from "@workspace/api-client-react";

// ---------------------------------------------------------------------------
// Helpers: map Supabase rows → API-compatible shapes
// ---------------------------------------------------------------------------

function mapProfile(row: any): Profile {
  if (!row) {
    return {
      id: "unassigned",
      fullName: "Unassigned",
      email: "",
      avatarUrl: null,
      avatarInitials: "--",
      role: "Member",
      department: "Other",
      status: "offline",
      currentTaskId: null,
      tasksCompleted: 0,
      tasksInProgress: 0,
      timeTodaySeconds: 0,
      timeWeekSeconds: 0,
    };
  }
  return {
    id: row.id,
    fullName: row.full_name || "Team Member",
    email: row.email || "",
    avatarUrl: row.avatar_url ?? null,
    avatarInitials: row.avatar_initials || (row.full_name ? row.full_name.slice(0, 2).toUpperCase() : "W"),
    role: row.role || "Member",
    department: row.department || "Other",
    status: row.status ?? "offline",
    currentTaskId: null,
    tasksCompleted: row.tasks_completed ?? 0,
    tasksInProgress: row.tasks_in_progress ?? 0,
    timeTodaySeconds: row.time_today_seconds ?? 0,
    timeWeekSeconds: row.time_week_seconds ?? 0,
  };
}

function mapTask(row: any, sessions: any[]): Task {
  const taskSessions = sessions.filter((s) => s.task_id === row.id);
  const totalSeconds = taskSessions.reduce((sum: number, s: any) => sum + (s.duration_seconds ?? 0), 0);
  const activeSession = taskSessions.find((s: any) => s.ended_at === null) ?? null;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    assignee: mapProfile(row.assignee),
    creator: mapProfile(row.creator),
    department: row.department,
    dueDate: row.due_date ?? null,
    timeSpentSeconds: totalSeconds,
    activeSession: activeSession
      ? { startedAt: activeSession.started_at, userId: activeSession.user_id }
      : null,
    createdAt: row.created_at,
  };
}

function mapActivity(row: any): Activity {
  const meta = row.metadata ?? {};
  const action = row.action as string;
  let message = action;
  if (action === "task_created") message = `Created task "${meta.title ?? ""}"`;
  else if (action === "task_updated") message = `Updated "${meta.field ?? "task"}" on "${meta.title ?? ""}"`;
  else if (action === "task_deleted") message = `Deleted task "${meta.title ?? ""}"`;
  else if (action === "task_completed") message = `Completed task "${meta.title ?? ""}"`;
  else if (action === "comment_added") message = `Commented on "${meta.title ?? ""}"`;
  else if (action === "timer_started") message = `Started timer on "${meta.title ?? ""}"`;
  else if (action === "timer_stopped") message = `Stopped timer on "${meta.title ?? ""}"`;
  return {
    id: row.id,
    action,
    actor: mapProfile(row.actor),
    taskId: row.task_id ?? null,
    message,
    createdAt: row.created_at,
  };
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const WORKSPACE_KEY = ["workspace"] as const;
export const TASKS_KEY = ["tasks"] as const;
export const taskCommentsKey = (taskId: string) => ["task-comments", taskId] as const;
export const ACTIVITY_KEY = ["activity"] as const;

// ---------------------------------------------------------------------------
// useWorkspace — main workspace snapshot
// ---------------------------------------------------------------------------

export type WorkspaceInfo = {
  id: string;
  name: string;
  code: string;
  createdBy: string | null;
  createdAt: string;
};

export type WorkspaceWithMeta = Workspace & {
  workspaceInfo: WorkspaceInfo;
};

async function fetchWorkspace(): Promise<WorkspaceWithMeta> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Ensure current user exists in public.profiles to satisfy Foreign Key constraints
  const creatorName = (user.user_metadata?.full_name as string) || user.email?.split("@")[0] || "Team Member";
  try {
    await supabase.from("profiles").upsert(
      {
        id: user.id,
        full_name: creatorName,
        email: user.email || "",
        avatar_initials: (creatorName.slice(0, 2) || "W").toUpperCase(),
        role: (user.user_metadata?.role as string) || "CEO",
        department: "CEO",
        status: "online",
      },
      { onConflict: "id" }
    );
  } catch {
    // Non-blocking if offline or RLS
  }

  // Find user's workspace_id
  const { data: prof } = await supabase
    .from("profiles")
    .select("workspace_id")
    .eq("id", user.id)
    .maybeSingle();

  let wsId = prof?.workspace_id;
  if (!wsId) {
    wsId = "00000000-0000-0000-0000-000000000001";
    // Auto-link to default workspace
    await supabase.from("profiles").update({ workspace_id: wsId }).eq("id", user.id);
  }

  // Get workspace info
  let workspaceInfo: WorkspaceInfo = {
    id: wsId,
    name: "WAFFAR Main Workspace",
    code: "WAFFAR-MAIN",
    createdBy: null,
    createdAt: new Date().toISOString(),
  };

  const { data: wsRow } = await supabase
    .from("workspaces")
    .select("*")
    .eq("id", wsId)
    .maybeSingle();

  if (wsRow) {
    workspaceInfo = {
      id: wsRow.id,
      name: wsRow.name,
      code: wsRow.code,
      createdBy: wsRow.created_by,
      createdAt: wsRow.created_at,
    };
  } else {
    // Create the default workspace in the database
    const { data: newWs, error: wsError } = await supabase
      .from("workspaces")
      .insert({
        id: wsId,
        name: "WAFFAR Main Workspace",
        code: "WAFFAR-MAIN",
        created_by: user.id,
      })
      .select()
      .single();

    if (!wsError && newWs) {
      workspaceInfo = {
        id: newWs.id,
        name: newWs.name,
        code: newWs.code,
        createdBy: newWs.created_by,
        createdAt: newWs.created_at,
      };

      // Create default channels & rooms for the new workspace
      await supabase.from("chat_channels").insert([
        { workspace_id: wsId, name: "general", description: "Company-wide updates & workroom chatter" },
        { workspace_id: wsId, name: "engineering", description: "Technical discussion & architecture" },
      ]);

      await supabase.from("meeting_rooms").insert([
        { workspace_id: wsId, title: "Daily Standup & Sync", description: "15-min sync room" },
        { workspace_id: wsId, title: "Open Coworking Lounge", description: "Drop in with mic or camera" },
      ]);
    }
  }

  const [profilesRes, tasksRes, sessionsRes, activityRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .eq("workspace_id", wsId)
      .order("full_name"),
    supabase
      .from("tasks")
      .select("*, assignee:profiles!tasks_assignee_id_fkey(*), creator:profiles!tasks_creator_id_fkey(*)")
      .eq("workspace_id", wsId)
      .order("created_at", { ascending: false }),
    supabase
      .from("time_sessions")
      .select("*"),
    supabase
      .from("activity_logs")
      .select("*, actor:profiles!activity_logs_user_id_fkey(*)")
      .eq("workspace_id", wsId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  if (profilesRes.error) throw profilesRes.error;
  if (tasksRes.error) throw tasksRes.error;
  if (sessionsRes.error) throw sessionsRes.error;
  if (activityRes.error) throw activityRes.error;

  const sessions = sessionsRes.data ?? [];
  const tasks: Task[] = (tasksRes.data ?? []).map((t: any) => mapTask(t, sessions));
  const team: Profile[] = (profilesRes.data ?? []).map(mapProfile);
  const activity: Activity[] = (activityRes.data ?? []).map(mapActivity);

  let currentUser = team.find((p) => p.email === user.email || p.id === user.id);
  if (!currentUser) {
    currentUser = {
      id: user.id,
      fullName: (user.user_metadata?.full_name as string) || user.email?.split("@")[0] || "Team Member",
      email: user.email || "",
      avatarUrl: (user.user_metadata?.avatar_url as string) ?? null,
      avatarInitials: ((user.user_metadata?.full_name as string)?.slice(0, 2) || user.email?.slice(0, 2) || "W").toUpperCase(),
      role: (user.user_metadata?.role as string) || "Member",
      department: (user.user_metadata?.department as string) || "Other",
      status: "online",
      currentTaskId: null,
      tasksCompleted: 0,
      tasksInProgress: 0,
      timeTodaySeconds: 0,
      timeWeekSeconds: 0,
    };
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).toISOString();

  const timeTodaySeconds = sessions
    .filter((s: any) => s.started_at >= todayStart)
    .reduce((sum: number, s: any) => sum + (s.duration_seconds ?? 0), 0);
  const timeWeekSeconds = sessions
    .filter((s: any) => s.started_at >= weekStart)
    .reduce((sum: number, s: any) => sum + (s.duration_seconds ?? 0), 0);

  const myTasks = tasks.filter((t) => t.assignee.id === currentUser?.id && t.status !== "done").length;
  const inProgress = tasks.filter((t) => t.status === "in_progress").length;
  const completed = tasks.filter((t) => t.status === "done").length;

  return {
    currentUser,
    team: team.length > 0 ? team : [currentUser],
    tasks,
    activity,
    workspaceInfo,
    stats: { myTasks, inProgress, completed, timeTodaySeconds, timeWeekSeconds },
  };
}

export function useWorkspaceData(options?: { staleTime?: number; refetchInterval?: number }) {
  return useQuery({
    queryKey: WORKSPACE_KEY,
    queryFn: fetchWorkspace,
    staleTime: options?.staleTime ?? 5000,
    refetchInterval: options?.refetchInterval ?? 15000,
    refetchOnMount: "always",
  });
}

// ---------------------------------------------------------------------------
// useTasks
// ---------------------------------------------------------------------------

async function fetchTasks(): Promise<Task[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data: prof } = await supabase.from("profiles").select("workspace_id").eq("id", user.id).maybeSingle();
  let wsId = prof?.workspace_id || "00000000-0000-0000-0000-000000000001";

  // Ensure workspace exists
  const { data: wsRow } = await supabase.from("workspaces").select("id").eq("id", wsId).maybeSingle();
  if (!wsRow) {
    await supabase.from("workspaces").insert({
      id: wsId,
      name: "WAFFAR Main Workspace",
      code: "WAFFAR-MAIN",
      created_by: user.id,
    });
  }

  const sessionsRes = await supabase.from("time_sessions").select("*");
  const sessions = sessionsRes.data ?? [];

  const { data, error } = await supabase
    .from("tasks")
    .select("*, assignee:profiles!tasks_assignee_id_fkey(*), creator:profiles!tasks_creator_id_fkey(*)")
    .eq("workspace_id", wsId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map((t: any) => mapTask(t, sessions));
}

export function useTasksData(options?: { staleTime?: number; refetchInterval?: number }) {
  return useQuery({
    queryKey: TASKS_KEY,
    queryFn: fetchTasks,
    staleTime: options?.staleTime ?? 5000,
    refetchInterval: options?.refetchInterval ?? 15000,
    refetchOnMount: "always",
  });
}

// ---------------------------------------------------------------------------
// useCreateTask
// ---------------------------------------------------------------------------

export function useCreateTaskMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      title: string;
      description: string;
      assigneeId: string;
      department: string;
      priority: "low" | "medium" | "high" | "urgent";
      dueDate: string | null;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // 1. Ensure creator exists in public.profiles to satisfy Foreign Key
      const creatorName = (user.user_metadata?.full_name as string) || user.email?.split("@")[0] || "Team Member";
      await supabase.from("profiles").upsert(
        {
          id: user.id,
          full_name: creatorName,
          email: user.email || "",
          avatar_initials: (creatorName.slice(0, 2) || "W").toUpperCase(),
          role: (user.user_metadata?.role as string) || "CEO",
          department: "CEO",
          status: "online",
        },
        { onConflict: "id" }
      );

      // 2. Validate and resolve assignee_id
      let finalAssigneeId = input.assigneeId;
      if (!finalAssigneeId || finalAssigneeId === "unassigned" || finalAssigneeId.trim() === "") {
        finalAssigneeId = user.id;
      } else {
        const { data: assigneeExists } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", finalAssigneeId)
          .maybeSingle();

        if (!assigneeExists) {
          finalAssigneeId = user.id;
        }
      }

      // 3. Insert task safely
      const { data, error } = await supabase
        .from("tasks")
        .insert({
          title: input.title,
          description: input.description || "",
          assignee_id: finalAssigneeId,
          creator_id: user.id,
          department: input.department || "Other",
          priority: input.priority || "medium",
          due_date: input.dueDate || null,
          status: "todo",
        })
        .select()
        .single();
      if (error) throw error;

      // 4. Log activity
      try {
        await supabase.from("activity_logs").insert({
          user_id: user.id,
          task_id: data.id,
          action: "task_created",
          metadata: { title: input.title },
        });
      } catch {
        // Non-blocking
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WORKSPACE_KEY });
      queryClient.invalidateQueries({ queryKey: TASKS_KEY });
      queryClient.invalidateQueries({ queryKey: ACTIVITY_KEY });
    },
  });
}

// ---------------------------------------------------------------------------
// useUpdateTask
// ---------------------------------------------------------------------------

export function useUpdateTaskMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, data: input }: {
      taskId: string;
      data: Partial<{
        title: string;
        description: string;
        assigneeId: string;
        department: string;
        priority: "low" | "medium" | "high" | "urgent";
        dueDate: string | null;
        status: "todo" | "in_progress" | "blocked" | "done";
      }>;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const patch: Record<string, unknown> = {};
      if (input.title !== undefined) patch.title = input.title;
      if (input.description !== undefined) patch.description = input.description;
      if (input.assigneeId !== undefined) patch.assignee_id = input.assigneeId;
      if (input.department !== undefined) patch.department = input.department;
      if (input.priority !== undefined) patch.priority = input.priority;
      if (input.dueDate !== undefined) patch.due_date = input.dueDate;
      if (input.status !== undefined) patch.status = input.status;

      const { data, error } = await supabase
        .from("tasks")
        .update(patch)
        .eq("id", taskId)
        .select()
        .single();
      if (error) throw error;

      // Get the updated task title for activity
      const taskTitle = data?.title ?? taskId;
      const changedField = Object.keys(input)[0] ?? "task";
      await supabase.from("activity_logs").insert({
        user_id: user.id,
        task_id: taskId,
        action: "task_updated",
        metadata: { title: taskTitle, field: changedField, value: String(input[changedField as keyof typeof input] ?? "") },
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WORKSPACE_KEY });
      queryClient.invalidateQueries({ queryKey: TASKS_KEY });
      queryClient.invalidateQueries({ queryKey: ACTIVITY_KEY });
    },
  });
}

// ---------------------------------------------------------------------------
// useDeleteTask
// ---------------------------------------------------------------------------

export function useDeleteTaskMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId }: { taskId: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Fetch title before deletion for activity log
      const { data: task } = await supabase.from("tasks").select("title").eq("id", taskId).single();

      const { error } = await supabase.from("tasks").delete().eq("id", taskId);
      if (error) throw error;

      await supabase.from("activity_logs").insert({
        user_id: user.id,
        task_id: null,
        action: "task_deleted",
        metadata: { title: task?.title ?? taskId },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WORKSPACE_KEY });
      queryClient.invalidateQueries({ queryKey: TASKS_KEY });
      queryClient.invalidateQueries({ queryKey: ACTIVITY_KEY });
    },
  });
}

// ---------------------------------------------------------------------------
// useTaskComments
// ---------------------------------------------------------------------------

export function useTaskCommentsData(taskId: string) {
  return useQuery({
    queryKey: taskCommentsKey(taskId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_comments")
        .select("*, author:profiles!task_comments_user_id_fkey(*)")
        .eq("task_id", taskId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row: any) => ({
        id: row.id,
        taskId: row.task_id,
        author: mapProfile(row.author),
        content: row.content,
        createdAt: row.created_at,
      }));
    },
    enabled: Boolean(taskId),
    refetchInterval: 15000,
  });
}

export function useCreateCommentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, data }: { taskId: string; data: { content: string } }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: inserted, error } = await supabase
        .from("task_comments")
        .insert({ task_id: taskId, user_id: user.id, content: data.content })
        .select()
        .single();
      if (error) throw error;

      // Fetch task title for activity
      const { data: task } = await supabase.from("tasks").select("title").eq("id", taskId).single();
      await supabase.from("activity_logs").insert({
        user_id: user.id,
        task_id: taskId,
        action: "comment_added",
        metadata: { title: task?.title ?? taskId },
      });

      return inserted;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: taskCommentsKey(variables.taskId) });
      queryClient.invalidateQueries({ queryKey: ACTIVITY_KEY });
    },
  });
}

// ---------------------------------------------------------------------------
// useStartTimer / useStopTimer
// ---------------------------------------------------------------------------

export function useStartTimerMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId }: { taskId: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Stop any other running session for this user first
      await supabase
        .from("time_sessions")
        .update({ ended_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .is("ended_at", null);

      const { data, error } = await supabase
        .from("time_sessions")
        .insert({ task_id: taskId, user_id: user.id, started_at: new Date().toISOString() })
        .select()
        .single();
      if (error) throw error;

      const { data: task } = await supabase.from("tasks").select("title").eq("id", taskId).single();
      await supabase.from("activity_logs").insert({
        user_id: user.id,
        task_id: taskId,
        action: "timer_started",
        metadata: { title: task?.title ?? taskId },
      });

      // Update profile status to 'working'
      await supabase.from("profiles").update({ status: "working" }).eq("id", user.id);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WORKSPACE_KEY });
      queryClient.invalidateQueries({ queryKey: TASKS_KEY });
    },
  });
}

export function useStopTimerMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId }: { taskId: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Find the running session
      const { data: session } = await supabase
        .from("time_sessions")
        .select("*")
        .eq("task_id", taskId)
        .eq("user_id", user.id)
        .is("ended_at", null)
        .single();

      if (!session) throw new Error("No active session found");

      const endedAt = new Date();
      const startedAt = new Date(session.started_at);
      const durationSeconds = Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000);

      const { data, error } = await supabase
        .from("time_sessions")
        .update({ ended_at: endedAt.toISOString(), duration_seconds: durationSeconds })
        .eq("id", session.id)
        .select()
        .single();
      if (error) throw error;

      const { data: task } = await supabase.from("tasks").select("title").eq("id", taskId).single();
      await supabase.from("activity_logs").insert({
        user_id: user.id,
        task_id: taskId,
        action: "timer_stopped",
        metadata: { title: task?.title ?? taskId, duration_seconds: durationSeconds },
      });

      // Set profile status back to 'online'
      await supabase.from("profiles").update({ status: "online" }).eq("id", user.id);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WORKSPACE_KEY });
      queryClient.invalidateQueries({ queryKey: TASKS_KEY });
    },
  });
}

// ---------------------------------------------------------------------------
// useActivity
// ---------------------------------------------------------------------------

export function useActivityData() {
  return useQuery({
    queryKey: ACTIVITY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_logs")
        .select("*, actor:profiles!activity_logs_user_id_fkey(*)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []).map(mapActivity);
    },
    staleTime: 5000,
    refetchInterval: 15000,
    refetchOnMount: "always",
  });
}

// ---------------------------------------------------------------------------
// Query keys for Chat, Meeting, and Workspace
// ---------------------------------------------------------------------------

export const CHANNELS_KEY = ["chat-channels"] as const;
export const channelMessagesKey = (channelId: string) => ["chat-messages", channelId] as const;
export const ROOMS_KEY = ["meeting-rooms"] as const;

export type ChatChannel = {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  createdAt: string;
};

export type ChatMessage = {
  id: string;
  channelId: string;
  author: Profile;
  content: string;
  createdAt: string;
};

export type MeetingParticipant = {
  id: string;
  roomId: string;
  user: Profile;
  isMuted: boolean;
  isVideoOn: boolean;
  isScreenSharing: boolean;
  joinedAt: string;
};

export type MeetingRoom = {
  id: string;
  workspaceId: string;
  title: string;
  description: string;
  isActive: boolean;
  participantCount: number;
  participants: MeetingParticipant[];
  createdAt: string;
};

// ---------------------------------------------------------------------------
// Workspace Join / Create Mutations
// ---------------------------------------------------------------------------

export function useJoinWorkspaceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (code: string) => {
      const cleanCode = code.trim().toUpperCase();
      const { data: ws, error } = await supabase
        .from("workspaces")
        .select("*")
        .ilike("code", cleanCode)
        .maybeSingle();

      if (error || !ws) {
        throw new Error(`Workspace with code "${cleanCode}" not found. Please verify the code.`);
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Update user's workspace_id
      const { error: updateErr } = await supabase
        .from("profiles")
        .update({ workspace_id: ws.id })
        .eq("id", user.id);

      if (updateErr) throw updateErr;
      return ws;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WORKSPACE_KEY });
      queryClient.invalidateQueries({ queryKey: TASKS_KEY });
      queryClient.invalidateQueries({ queryKey: CHANNELS_KEY });
      queryClient.invalidateQueries({ queryKey: ROOMS_KEY });
    },
  });
}

export function useCreateWorkspaceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ name }: { name: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const randomCode = `WAF-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      const { data: ws, error } = await supabase
        .from("workspaces")
        .insert({
          name: name.trim() || "My Workspace",
          code: randomCode,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      await supabase
        .from("profiles")
        .update({ workspace_id: ws.id })
        .eq("id", user.id);

      // Create default channels & rooms
      await supabase.from("chat_channels").insert([
        { workspace_id: ws.id, name: "general", description: "Company-wide updates & workroom chatter" },
        { workspace_id: ws.id, name: "engineering", description: "Technical discussion & architecture" },
      ]);

      await supabase.from("meeting_rooms").insert([
        { workspace_id: ws.id, title: "Daily Standup & Sync", description: "15-min sync room" },
        { workspace_id: ws.id, title: "Open Coworking Lounge", description: "Drop in with mic or camera" },
      ]);

      return ws;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WORKSPACE_KEY });
      queryClient.invalidateQueries({ queryKey: TASKS_KEY });
      queryClient.invalidateQueries({ queryKey: CHANNELS_KEY });
      queryClient.invalidateQueries({ queryKey: ROOMS_KEY });
    },
  });
}

// ---------------------------------------------------------------------------
// Chat Hooks
// ---------------------------------------------------------------------------

export function useChannelsData() {
  return useQuery({
    queryKey: CHANNELS_KEY,
    queryFn: async (): Promise<ChatChannel[]> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data: prof } = await supabase.from("profiles").select("workspace_id").eq("id", user.id).maybeSingle();
      const wsId = prof?.workspace_id || "00000000-0000-0000-0000-000000000001";

      const { data, error } = await supabase
        .from("chat_channels")
        .select("*")
        .eq("workspace_id", wsId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data ?? []).map((ch: any) => ({
        id: ch.id,
        workspaceId: ch.workspace_id,
        name: ch.name,
        description: ch.description || "",
        createdAt: ch.created_at,
      }));
    },
  });
}

export function useCreateChannelMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, description }: { name: string; description?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data: prof } = await supabase.from("profiles").select("workspace_id").eq("id", user.id).maybeSingle();
      const wsId = prof?.workspace_id || "00000000-0000-0000-0000-000000000001";

      const cleanName = name.trim().toLowerCase().replace(/\s+/g, "-");
      const { data, error } = await supabase
        .from("chat_channels")
        .insert({ workspace_id: wsId, name: cleanName, description: description || "" })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHANNELS_KEY });
    },
  });
}

export function useMessagesData(channelId: string | null) {
  return useQuery({
    queryKey: channelId ? channelMessagesKey(channelId) : ["chat-messages", "none"],
    queryFn: async (): Promise<ChatMessage[]> => {
      if (!channelId) return [];
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*, author:profiles!chat_messages_user_id_fkey(*)")
        .eq("channel_id", channelId)
        .order("created_at", { ascending: true })
        .limit(100);

      if (error) throw error;
      return (data ?? []).map((m: any) => ({
        id: m.id,
        channelId: m.channel_id,
        author: mapProfile(m.author),
        content: m.content,
        createdAt: m.created_at,
      }));
    },
    enabled: Boolean(channelId),
    refetchInterval: 4000,
  });
}

export function useSendMessageMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ channelId, content }: { channelId: string; content: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("chat_messages")
        .insert({ channel_id: channelId, user_id: user.id, content: content.trim() })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: channelMessagesKey(variables.channelId) });
    },
  });
}

// ---------------------------------------------------------------------------
// Meeting Rooms Hooks
// ---------------------------------------------------------------------------

export function useRoomsData() {
  return useQuery({
    queryKey: ROOMS_KEY,
    queryFn: async (): Promise<MeetingRoom[]> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data: prof } = await supabase.from("profiles").select("workspace_id").eq("id", user.id).maybeSingle();
      const wsId = prof?.workspace_id || "00000000-0000-0000-0000-000000000001";

      const [roomsRes, partsRes] = await Promise.all([
        supabase
          .from("meeting_rooms")
          .select("*")
          .eq("workspace_id", wsId)
          .order("created_at", { ascending: true }),
        supabase
          .from("meeting_participants")
          .select("*, user:profiles!meeting_participants_user_id_fkey(*)"),
      ]);

      if (roomsRes.error) throw roomsRes.error;
      const participants = partsRes.data ?? [];

      return (roomsRes.data ?? []).map((r: any) => {
        const roomParts: MeetingParticipant[] = participants
          .filter((p: any) => p.room_id === r.id)
          .map((p: any) => ({
            id: p.id,
            roomId: p.room_id,
            user: mapProfile(p.user),
            isMuted: p.is_muted ?? false,
            isVideoOn: p.is_video_on ?? false,
            isScreenSharing: p.is_screen_sharing ?? false,
            joinedAt: p.joined_at,
          }));

        return {
          id: r.id,
          workspaceId: r.workspace_id,
          title: r.title,
          description: r.description || "",
          isActive: r.is_active ?? true,
          participantCount: roomParts.length,
          participants: roomParts,
          createdAt: r.created_at,
        };
      });
    },
    refetchInterval: 4000,
  });
}

export function useCreateRoomMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ title, description }: { title: string; description?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data: prof } = await supabase.from("profiles").select("workspace_id").eq("id", user.id).maybeSingle();
      const wsId = prof?.workspace_id || "00000000-0000-0000-0000-000000000001";

      const { data, error } = await supabase
        .from("meeting_rooms")
        .insert({ workspace_id: wsId, title: title.trim(), description: description || "" })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ROOMS_KEY });
    },
  });
}

export function useJoinRoomMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ roomId, isMuted = false, isVideoOn = true }: { roomId: string; isMuted?: boolean; isVideoOn?: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Leave any other room first
      await supabase.from("meeting_participants").delete().eq("user_id", user.id);

      const { data, error } = await supabase
        .from("meeting_participants")
        .upsert(
          {
            room_id: roomId,
            user_id: user.id,
            is_muted: isMuted,
            is_video_on: isVideoOn,
            is_screen_sharing: false,
          },
          { onConflict: "room_id,user_id" }
        )
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ROOMS_KEY });
    },
  });
}

export function useLeaveRoomMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ roomId }: { roomId: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("meeting_participants")
        .delete()
        .eq("room_id", roomId)
        .eq("user_id", user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ROOMS_KEY });
    },
  });
}

export function useToggleRoomMediaMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      roomId,
      isMuted,
      isVideoOn,
      isScreenSharing,
    }: {
      roomId: string;
      isMuted?: boolean;
      isVideoOn?: boolean;
      isScreenSharing?: boolean;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const patch: Record<string, boolean> = {};
      if (isMuted !== undefined) patch.is_muted = isMuted;
      if (isVideoOn !== undefined) patch.is_video_on = isVideoOn;
      if (isScreenSharing !== undefined) patch.is_screen_sharing = isScreenSharing;

      const { data, error } = await supabase
        .from("meeting_participants")
        .update(patch)
        .eq("room_id", roomId)
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ROOMS_KEY });
    },
  });
}

// ---------------------------------------------------------------------------
// Realtime updates
// ---------------------------------------------------------------------------

export function useSupabaseRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("workspace_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => {
        queryClient.invalidateQueries({ queryKey: WORKSPACE_KEY });
        queryClient.invalidateQueries({ queryKey: TASKS_KEY });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => {
        queryClient.invalidateQueries({ queryKey: WORKSPACE_KEY });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "time_sessions" }, () => {
        queryClient.invalidateQueries({ queryKey: WORKSPACE_KEY });
        queryClient.invalidateQueries({ queryKey: TASKS_KEY });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "activity_logs" }, () => {
        queryClient.invalidateQueries({ queryKey: WORKSPACE_KEY });
        queryClient.invalidateQueries({ queryKey: ACTIVITY_KEY });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "task_comments" }, (payload) => {
        const taskId = (payload.new as any)?.task_id || (payload.old as any)?.task_id;
        if (taskId) {
          queryClient.invalidateQueries({ queryKey: taskCommentsKey(taskId) });
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_channels" }, () => {
        queryClient.invalidateQueries({ queryKey: CHANNELS_KEY });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages" }, (payload) => {
        const chId = (payload.new as any)?.channel_id || (payload.old as any)?.channel_id;
        if (chId) {
          queryClient.invalidateQueries({ queryKey: channelMessagesKey(chId) });
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "meeting_rooms" }, () => {
        queryClient.invalidateQueries({ queryKey: ROOMS_KEY });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "meeting_participants" }, () => {
        queryClient.invalidateQueries({ queryKey: ROOMS_KEY });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "workspaces" }, () => {
        queryClient.invalidateQueries({ queryKey: WORKSPACE_KEY });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}


