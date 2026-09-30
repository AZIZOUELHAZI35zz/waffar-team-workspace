import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useParams } from "wouter";
import {
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Coffee,
  Flag,
  Hash,
  LayoutList,
  ListFilter,
  Mic,
  MicOff,
  MessageCircle,
  MoreHorizontal,
  Pause,
  PhoneOff,
  Play,
  Plus,
  Send,
  Settings2,
  Target,
  UserRound,
  Users,
  UsersRound,
  Video,
  VideoOff,
  X,
} from "lucide-react";
import {
  WORKSPACE_KEY,
  TASKS_KEY,
  ACTIVITY_KEY,
  CHANNELS_KEY,
  ROOMS_KEY,
  taskCommentsKey,
  channelMessagesKey,
  useWorkspaceData,
  useTasksData,
  useActivityData,
  useCreateTaskMutation,
  useUpdateTaskMutation,
  useDeleteTaskMutation,
  useTaskCommentsData,
  useCreateCommentMutation,
  useStartTimerMutation,
  useStopTimerMutation,
  useSupabaseRealtime,
  useChannelsData,
  useMessagesData,
  useSendMessageMutation,
  useCreateChannelMutation,
  useRoomsData,
  useCreateRoomMutation,
  useJoinRoomMutation,
  useLeaveRoomMutation,
  useToggleRoomMediaMutation,
  useJoinWorkspaceMutation,
  useCreateWorkspaceMutation,
  type ChatChannel,
  type ChatMessage,
  type MeetingRoom,
  type WorkspaceInfo,
} from "@/hooks/use-supabase";
import type { Activity, Profile, Task, TaskStatus, Workspace } from "@workspace/api-client-react";
import {
  ActivityList,
  AppShell,
  Avatar,
  Button,
  EmptyState,
  FilterBar,
  formatDate,
  formatDuration,
  PageHeader,
  PriorityPill,
  relativeTime,
  SectionHeading,
  SkeletonBlock,
  StatTile,
  StatusPill,
  TaskDialog,
  TaskRow,
  TeamStrip,
  Toggle,
  formatLongDate,
} from "@/components/workspace";

// Alias helpers so the rest of the file (which uses the old names) still compiles
const getGetWorkspaceQueryKey = () => WORKSPACE_KEY;
const getListTasksQueryKey = () => TASKS_KEY;
const getListActivityQueryKey = () => ACTIVITY_KEY;
const getListTaskCommentsQueryKey = (id: string) => taskCommentsKey(id);
const useGetWorkspace = (options?: any) => useWorkspaceData(options?.query);
const useListTasks = (_p: any, options?: any) => useTasksData(options?.query);
const useListActivity = (options?: any) => useActivityData();
const useListTaskComments = (taskId: string, options?: any) => useTaskCommentsData(taskId);
const useCreateTask = () => useCreateTaskMutation();
const useUpdateTask = () => useUpdateTaskMutation();
const useDeleteTask = () => useDeleteTaskMutation();
const useCreateTaskComment = () => useCreateCommentMutation();
const useStartTaskTimer = () => useStartTimerMutation();
const useStopTaskTimer = () => useStopTimerMutation();

// ─────────────────────────────────────────────
// WorkspaceRouter
// ─────────────────────────────────────────────

export function WorkspaceRouter({ onLogout }: { onLogout: () => void }) {
  useSupabaseRealtime();
  const workspaceQuery = useGetWorkspace({ query: { queryKey: getGetWorkspaceQueryKey(), staleTime: 5000, refetchInterval: 15000, refetchOnMount: "always" } });
  const workspace = workspaceQuery.data;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [location] = useLocation();
  const team = workspace?.team ?? [];
  const currentUser = workspace?.currentUser;

  // Show join/create workspace dialog if user has no workspace
  const [wsDialogOpen, setWsDialogOpen] = useState(false);
  useEffect(() => {
    if (workspace && (workspace as any).workspaceInfo?.code === "WAFFAR-MAIN" && !workspaceQuery.isLoading) {
      // Only show if the workspace is the default placeholder
    }
  }, [workspace, workspaceQuery.isLoading]);

  return (
    <AppShell currentUser={currentUser} myTaskCount={workspace?.stats.myTasks ?? 0} onCreateTask={() => setDialogOpen(true)} onLogout={onLogout}>
      <div className="relative">
        {workspaceQuery.isLoading && !workspace ? <LoadingWorkspace /> : workspaceQuery.isError && !workspace ? <ErrorState onRetry={() => workspaceQuery.refetch()} /> : (
          <WorkspaceRouteContent location={location} workspace={workspace} currentUser={currentUser} />
        )}
      </div>
      <GlobalTaskDialog open={dialogOpen} onClose={() => setDialogOpen(false)} team={team} />
    </AppShell>
  );
}

function GlobalTaskDialog({ open, onClose, team }: { open: boolean; onClose: () => void; team: Profile[] }) {
  const queryClient = useQueryClient();
  const createTask = useCreateTask();
  return <TaskDialog open={open} onClose={onClose} team={team} pending={createTask.isPending} onSubmit={(form) => createTask.mutate({ title: form.title, description: form.description, assigneeId: form.assigneeId, department: form.department, priority: form.priority, dueDate: form.dueDate || null }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetWorkspaceQueryKey() }); queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() }); onClose(); } })} />;
}

function WorkspaceRouteContent({ location, workspace, currentUser }: { location: string; workspace?: WorkspaceLike; currentUser?: Profile }) {
  if (location === "/") return <DashboardPage workspace={workspace} />;
  if (location === "/my-tasks") return <MyTasksPage workspace={workspace} />;
  if (location.startsWith("/tasks")) return <TasksPage workspace={workspace} />;
  if (location === "/team") return <TeamPage workspace={workspace} />;
  if (location === "/time") return <TimePage workspace={workspace} />;
  if (location === "/activity") return <ActivityPage workspace={workspace} />;
  if (location === "/chat") return <ChatPage currentUser={currentUser} />;
  if (location === "/meetings") return <MeetingRoomsPage currentUser={currentUser} />;
  if (location === "/workspace") return <WorkspacePage workspace={workspace} currentUser={currentUser} />;
  if (location === "/settings") return <SettingsPage workspace={workspace} />;
  return <DashboardPage workspace={workspace} />;
}

type WorkspaceLike = Workspace & { workspaceInfo?: WorkspaceInfo };
function LoadingWorkspace() {
  return <div className="space-y-6"><SkeletonBlock className="h-8 w-56" /><SkeletonBlock className="h-5 w-80" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[1, 2, 3, 4].map((item) => <SkeletonBlock key={item} className="h-36" />)}</div><SkeletonBlock className="h-80" /></div>;
}
function ErrorState({ onRetry }: { onRetry: () => void }) {
  return <div className="flex min-h-[420px] items-center justify-center"><div className="max-w-sm text-center"><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#fae6df] text-[#9a513e]"><Target size={24} /></div><h2 className="mt-4 font-display text-xl font-semibold text-[#263a2a]">The workroom door is stuck</h2><p className="mt-2 text-sm leading-6 text-[#7d897f]">We couldn't load the workspace right now. Give it another try.</p><Button onClick={onRetry} variant="outline" className="mt-5" testId="button-retry-workspace">Try again</Button></div></div>;
}

// ─────────────────────────────────────────────
// Dashboard Page
// ─────────────────────────────────────────────

function DashboardPage({ workspace }: { workspace?: WorkspaceLike }) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const startTimer = useStartTaskTimer();
  const stopTimer = useStopTaskTimer();
  const current = workspace?.currentUser;
  const tasks = workspace?.tasks ?? [];
  const active = tasks.filter((task) => task.status === "in_progress");
  const myTasks = tasks.filter((task) => task.assignee.id === current?.id && task.status !== "done");
  const today = new Date();
  const weekEnd = new Date(today);
  weekEnd.setDate(today.getDate() + (7 - ((today.getDay() + 6) % 7)));
  const dueThisWeek = tasks.filter((task) => {
    if (!task.dueDate || task.status === "done") return false;
    const due = new Date(`${task.dueDate}T00:00:00`);
    return due >= new Date(today.getFullYear(), today.getMonth(), today.getDate()) && due <= weekEnd;
  }).length;
  const urgent = tasks.filter((task) => task.priority === "urgent" && task.status !== "done").length;
  return <div>
    <PageHeader eyebrow={formatLongDate()} title={`Good morning, ${current?.fullName?.split(" ")[0] ?? "team"}.`} description="Here's the shape of the workroom today. Keep the important things moving." action={<Button onClick={() => document.querySelector<HTMLButtonElement>('[data-testid="button-sidebar-create-task"]')?.click()} testId="button-dashboard-new-task"><Plus size={16} /> New task</Button>} />
    <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
      <StatTile label="My tasks" value={workspace?.stats.myTasks ?? myTasks.length} detail={`${dueThisWeek} due this week`} icon={ListFilter} accent="green" />
      <StatTile label="In progress" value={workspace?.stats.inProgress ?? active.length} detail={`${urgent} urgent ${urgent === 1 ? "task" : "tasks"}`} icon={Target} accent="gold" />
      <StatTile label="Completed" value={workspace?.stats.completed ?? tasks.filter((task) => task.status === "done").length} detail="All assigned tasks" icon={CheckCircle2} accent="ink" />
      <StatTile label="Time today" value={formatDuration(workspace?.stats.timeTodaySeconds ?? current?.timeTodaySeconds)} detail={`${formatDuration(workspace?.stats.timeWeekSeconds ?? current?.timeWeekSeconds)} this week`} icon={Clock3} accent="coral" />
    </div>
    <div className="mt-7 grid gap-6 xl:grid-cols-[1.45fr_.8fr]">
      <section className="rounded-2xl border border-[#e5ded2] bg-[#fffdf9] shadow-[0_1px_2px_rgba(41,50,39,.03)] animate-rise-in delay-1">
        <div className="flex items-center justify-between border-b border-[#eee8dd] px-5 py-4"><div><SectionHeading title="On the workbench" detail="Your open tasks, in order of attention." /></div><Link href="/my-tasks" className="inline-flex items-center gap-1 text-xs font-bold text-[#2d7040] hover:text-[#1b4d2e]" data-testid="link-view-my-tasks">View all <ArrowUpRight size={14} /></Link></div>
        {myTasks.length ? <div>{myTasks.slice(0, 5).map((task) => <TaskRow key={task.id} task={task} onOpen={(item) => setLocation(`/tasks/${item.id}`)} onTimer={(item) => { const mutation = item.activeSession ? stopTimer : startTimer; mutation.mutate({ taskId: item.id }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetWorkspaceQueryKey() }); queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() }); } }); }} />)}</div> : <div className="p-4"><EmptyState icon={CheckCircle2} title="Nothing waiting on you" description="A clear bench is a good bench. Pick up a task when you're ready." action={<Link href="/tasks" className="text-xs font-bold text-[#2d7040]" data-testid="link-browse-tasks">Browse tasks <ArrowUpRight size={13} className="inline" /></Link>} /></div>}
      </section>
      <section className="rounded-2xl border border-[#e5ded2] bg-[#fffdf9] px-5 py-4 shadow-[0_1px_2px_rgba(41,50,39,.03)] animate-rise-in delay-2">
        <SectionHeading title="Team pulse" detail="Who's in the room right now." action={<Link href="/team" className="text-[#2d7040]" data-testid="link-team-pulse"><ArrowUpRight size={16} /></Link>} />
        <TeamStrip team={workspace?.team ?? []} />
        <div className="mt-5 space-y-3.5">{(workspace?.team ?? []).slice(0, 5).map((person) => <div key={person.id} className="flex items-center gap-3" data-testid={`team-pulse-${person.id}`}><Avatar profile={person} /><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><p className="truncate text-sm font-semibold text-[#334736]">{person.fullName}</p><span className={`text-[10px] font-semibold ${person.status === "working" ? "text-[#2d7040]" : person.status === "online" ? "text-[#a2731b]" : "text-[#9ba49d]"}`}>{person.status === "working" ? "Working" : person.status === "online" ? "Available" : "Offline"}</span></div><p className="truncate text-xs text-[#89958b]">{person.department}</p></div></div>)}</div>
        <Link href="/team" className="mt-5 flex items-center justify-center gap-2 rounded-lg bg-[#f2f6ef] py-2.5 text-xs font-bold text-[#2d7040] hover:bg-[#e8f2e9]" data-testid="link-open-team">Open team directory <ChevronRight size={14} /></Link>
      </section>
    </div>
    <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_.9fr]">
      <section className="rounded-2xl border border-[#e5ded2] bg-[#fffdf9] px-5 py-4 shadow-[0_1px_2px_rgba(41,50,39,.03)]"><SectionHeading title="Latest movement" detail="The last few things that changed." action={<Link href="/activity" className="text-xs font-bold text-[#2d7040]" data-testid="link-view-activity">See all</Link>} /><ActivityList items={workspace?.activity ?? []} limit={5} /></section>
      <WorkloadCard tasks={tasks} team={workspace?.team ?? []} />
    </div>
    {/* Quick-access cards */}
    <div className="mt-6 grid gap-4 sm:grid-cols-2">
      <Link href="/chat" className="group flex items-center gap-4 rounded-2xl border border-[#e5ded2] bg-[#fffdf9] p-5 shadow-[0_1px_2px_rgba(41,50,39,.03)] transition-all hover:-translate-y-0.5 hover:border-[#bcd3bf] hover:shadow-md" data-testid="link-go-chat">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-[#e8f2e9] text-[#1b4d2e]"><MessageCircle size={22} /></div>
        <div className="min-w-0 flex-1"><p className="font-display text-base font-semibold text-[#263a2a]">Team chat</p><p className="mt-0.5 text-xs text-[#829087]">Channels, messages, and real-time conversation</p></div>
        <ArrowUpRight size={18} className="text-[#c2cec4] transition group-hover:text-[#2d7040]" />
      </Link>
      <Link href="/meetings" className="group flex items-center gap-4 rounded-2xl border border-[#e5ded2] bg-[#fffdf9] p-5 shadow-[0_1px_2px_rgba(41,50,39,.03)] transition-all hover:-translate-y-0.5 hover:border-[#bcd3bf] hover:shadow-md" data-testid="link-go-meetings">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-[#fff5e0] text-[#9b6810]"><Video size={22} /></div>
        <div className="min-w-0 flex-1"><p className="font-display text-base font-semibold text-[#263a2a]">Meeting rooms</p><p className="mt-0.5 text-xs text-[#829087]">Live rooms, presence, and audio/video state</p></div>
        <ArrowUpRight size={18} className="text-[#c2cec4] transition group-hover:text-[#9b6810]" />
      </Link>
    </div>
  </div>;
}

function WorkloadCard({ tasks, team }: { tasks: Task[]; team: Profile[] }) {
  return <section className="rounded-2xl border border-[#e5ded2] bg-[#fffdf9] px-5 py-4 shadow-[0_1px_2px_rgba(41,50,39,.03)]"><SectionHeading title="Workload at a glance" detail="Open work by owner." /><div className="space-y-4">{team.slice(0, 5).map((person) => { const count = tasks.filter((task) => task.assignee.id === person.id && task.status !== "done").length; const width = Math.min(100, count * 19 + 8); return <div key={person.id} className="flex items-center gap-3" data-testid={`workload-${person.id}`}><Avatar profile={person} size="sm" /><span className="w-20 truncate text-xs font-semibold text-[#536256]">{person.fullName.split(" ")[0]}</span><div className="h-2 flex-1 rounded-full bg-[#eef0e9]"><div className="h-2 rounded-full bg-[#7dad80] transition-all duration-500" style={{ width: `${width}%` }} /></div><span className="w-5 text-right font-mono text-[10px] text-[#7c897f]">{count}</span></div>; })}{!team.length && <EmptyState icon={UsersRound} title="No team data yet" description="People will show up here once the workspace is connected." />}</div></section>;
}

// ─────────────────────────────────────────────
// Tasks Pages
// ─────────────────────────────────────────────

function MyTasksPage({ workspace }: { workspace?: WorkspaceLike }) {
  const current = workspace?.currentUser;
  const tasks = workspace?.tasks ?? [];
  return <TasksCollectionPage title="My tasks" eyebrow="Your workbench" description="The work that has your name on it, with enough context to make the next move." tasks={tasks.filter((task) => task.assignee.id === current?.id)} team={workspace?.team ?? []} />;
}

function TasksPage({ workspace }: { workspace?: WorkspaceLike }) {
  const params = useParams<{ id?: string }>();
  const [, setLocation] = useLocation();
  const tasksQuery = useListTasks(undefined, { query: { queryKey: getListTasksQueryKey(), staleTime: 5000, refetchInterval: 15000, refetchOnMount: "always" } });
  const tasks = tasksQuery.data ?? workspace?.tasks ?? [];
  const selected = params.id ? tasks.find((task) => task.id === params.id) : null;
  return <div className={selected ? "relative" : ""}><TasksCollectionPage title="All tasks" eyebrow="The full workroom" description="Everything currently in motion across WAFFAR, visible and easy to move." tasks={tasks} team={workspace?.team ?? []} loading={tasksQuery.isLoading && !tasks.length} onOpen={(task) => setLocation(`/tasks/${task.id}`)} onRefresh={() => tasksQuery.refetch()} />{selected && <TaskDetailDrawer task={selected} team={workspace?.team ?? []} onClose={() => setLocation("/tasks")} />}</div>;
}

function TasksCollectionPage({ title, eyebrow, description, tasks, team, loading = false, onOpen, onRefresh }: { title: string; eyebrow: string; description: string; tasks: Task[]; team: Profile[]; loading?: boolean; onOpen?: (task: Task) => void; onRefresh?: () => void }) {
  const [dialog, setDialog] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("priority");
  const queryClient = useQueryClient();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const visible = useMemo(() => tasks.filter((task) => `${task.title} ${task.department} ${task.assignee.fullName}`.toLowerCase().includes(query.toLowerCase())).filter((task) => status === "all" || task.status === status).sort((a, b) => sort === "date" ? new Date(a.dueDate ?? "2999").getTime() - new Date(b.dueDate ?? "2999").getTime() : sort === "status" ? a.status.localeCompare(b.status) : ({ urgent: 0, high: 1, medium: 2, low: 3 }[a.priority] - { urgent: 0, high: 1, medium: 2, low: 3 }[b.priority])), [tasks, query, status, sort]);
  const saveTask = (form: { title: string; description: string; assigneeId: string; department: string; priority: Task["priority"]; dueDate: string }) => createTask.mutate({ ...form, dueDate: form.dueDate || null }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetWorkspaceQueryKey() }); queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() }); setDialog(false); onRefresh?.(); } });
  return <div>
    <PageHeader eyebrow={eyebrow} title={title} description={description} action={<Button onClick={() => setDialog(true)} testId="button-create-task"><Plus size={16} /> New task</Button>} />
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-2 text-xs text-[#839087]"><span className="font-mono text-[#3d5b44]">{visible.length}</span> tasks showing <span className="h-1 w-1 rounded-full bg-[#b8c4b8]" /><span>{tasks.filter((task) => task.status === "in_progress").length} in motion</span></div><div className="flex items-center gap-2"><span className="text-[11px] font-bold uppercase tracking-wide text-[#89958b]">Sort by</span><select value={sort} onChange={(event) => setSort(event.target.value)} className="rounded-lg border border-[#e3dbcf] bg-[#fffdf9] px-2.5 py-2 text-xs font-semibold text-[#506054] outline-none" data-testid="select-sort-tasks"><option value="priority">Priority</option><option value="date">Due date</option><option value="status">Status</option></select></div></div>
    <FilterBar query={query} onQuery={setQuery} status={status} onStatus={setStatus} />
    <section className="mt-4 overflow-hidden rounded-2xl border border-[#e5ded2] bg-[#fffdf9] shadow-[0_1px_2px_rgba(41,50,39,.03)]">{loading ? <div className="space-y-2 p-4">{[1, 2, 3, 4, 5].map((item) => <SkeletonBlock key={item} className="h-16" />)}</div> : visible.length ? <div>{visible.map((task) => <TaskRow key={task.id} task={task} onOpen={onOpen} onTimer={(item) => updateTask.mutate({ taskId: item.id, data: { status: item.status === "in_progress" ? "todo" : "in_progress" } }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetWorkspaceQueryKey() }); queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() }); } })} />)}</div> : <div className="p-4"><EmptyState icon={LayoutList} title={query || status !== "all" ? "No tasks match" : "The task bench is clear"} description={query || status !== "all" ? "Try a different filter or search term." : "Create the first task and give the room something to move."} action={!query && status === "all" ? <Button onClick={() => setDialog(true)} variant="quiet" testId="button-empty-create-task"><Plus size={15} /> Create task</Button> : undefined} /></div>}</section>
    <TaskDialog open={dialog} onClose={() => setDialog(false)} team={team} pending={createTask.isPending} onSubmit={saveTask} />
  </div>;
}

function TaskDetailDrawer({ task, team, onClose }: { task: Task; team: Profile[]; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [comment, setComment] = useState("");
  const [editing, setEditing] = useState(false);
  const commentsQuery = useListTaskComments(task.id, { query: { enabled: Boolean(task.id), queryKey: getListTaskCommentsQueryKey(task.id), refetchInterval: 15000 } });
  const commentMutation = useCreateTaskComment();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const startTimer = useStartTaskTimer();
  const stopTimer = useStopTaskTimer();
  const running = Boolean(task.activeSession);
  const submitComment = () => { if (!comment.trim()) return; commentMutation.mutate({ taskId: task.id, data: { content: comment.trim() } }, { onSuccess: () => { setComment(""); queryClient.invalidateQueries({ queryKey: getListTaskCommentsQueryKey(task.id) }); queryClient.invalidateQueries({ queryKey: getListActivityQueryKey() }); } }); };
  const changeStatus = (status: TaskStatus) => updateTask.mutate({ taskId: task.id, data: { status } }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetWorkspaceQueryKey() }); queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() }); } });
  return <div className="fixed inset-0 z-40 flex justify-end bg-[#0f1410]/20 backdrop-blur-[1px]" onClick={onClose}><aside className="h-full w-full max-w-xl overflow-y-auto border-l border-[#e1d8ca] bg-[#fffdf9] px-5 py-6 shadow-2xl sm:px-7" onClick={(event) => event.stopPropagation()} data-testid="drawer-task-detail">
    <div className="flex items-center justify-between"><button type="button" onClick={onClose} className="inline-flex items-center gap-2 text-xs font-bold text-[#738176] hover:text-[#1b4d2e]" data-testid="button-close-task-detail"><X size={16} /> Back to tasks</button><button type="button" className="rounded-lg p-2 text-[#859087] hover:bg-[#eef3ec]" data-testid="button-task-more"><MoreHorizontal size={18} /></button></div>
    <div className="mt-8"><div className="flex items-center gap-2"><StatusPill status={task.status} /><PriorityPill priority={task.priority} /></div><h2 className="mt-3 font-display text-3xl font-semibold leading-tight tracking-[-0.035em] text-[#203624]" data-testid="text-task-detail-title">{task.title}</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#68776b]" data-testid="text-task-detail-description">{task.description || "No description added yet."}</p></div>
    <div className="mt-7 grid grid-cols-2 gap-3"><div className="rounded-xl bg-[#f5f6ef] p-3.5"><p className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#8d998f]">Owner</p><div className="mt-2 flex items-center gap-2"><Avatar profile={task.assignee} size="sm" /><span className="text-xs font-semibold text-[#3c513f]">{task.assignee.fullName}</span></div></div><div className="rounded-xl bg-[#f5f6ef] p-3.5"><p className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#8d998f]">Due</p><p className="mt-2 text-sm font-semibold text-[#3c513f]">{formatDate(task.dueDate)}</p></div></div>
    <div className="mt-4 flex flex-wrap gap-2"><Button variant={running ? "outline" : "quiet"} onClick={() => running ? stopTimer.mutate({ taskId: task.id }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetWorkspaceQueryKey() }); queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() }); } }) : startTimer.mutate({ taskId: task.id }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetWorkspaceQueryKey() }); queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() }); } })} disabled={startTimer.isPending || stopTimer.isPending} testId="button-detail-timer">{running ? <Pause size={15} /> : <Play size={15} fill="currentColor" />}{running ? "Stop timer" : "Start timer"} <span className="font-mono text-[10px]">{formatDuration(task.timeSpentSeconds)}</span></Button><select value={task.status} onChange={(event) => changeStatus(event.target.value as TaskStatus)} className="h-10 rounded-[9px] border border-[#d9d1c3] bg-[#fffdf9] px-3 text-xs font-bold text-[#405449] outline-none" data-testid="select-detail-status"><option value="todo">To do</option><option value="in_progress">In progress</option><option value="blocked">Blocked</option><option value="done">Done</option></select><Button variant="outline" onClick={() => setEditing(true)} testId="button-edit-task-detail"><Settings2 size={14} /> Edit</Button><Button variant="danger" onClick={() => { if (window.confirm("Delete this task?")) deleteTask.mutate({ taskId: task.id }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetWorkspaceQueryKey() }); queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() }); onClose(); } }); }} testId="button-delete-task-detail">Delete</Button></div>
    <div className="mt-9 border-t border-[#eee8dd] pt-6"><SectionHeading title="Conversation" detail={`${commentsQuery.data?.length ?? 0} notes on this task`} /><div className="space-y-4">{commentsQuery.isLoading ? <><SkeletonBlock className="h-14" /><SkeletonBlock className="h-14" /></> : (commentsQuery.data ?? []).length ? commentsQuery.data?.map((item) => <div key={item.id} className="flex gap-2.5" data-testid={`comment-${item.id}`}><Avatar profile={item.author} size="sm" /><div><div className="rounded-2xl rounded-tl-sm bg-[#f2f5ef] px-3.5 py-2.5"><p className="text-sm leading-5 text-[#4c5e50]">{item.content}</p></div><p className="mt-1 text-[10px] text-[#a0aaa1]">{item.author.fullName} · {relativeTime(item.createdAt)}</p></div></div>) : <p className="rounded-xl bg-[#faf8f2] p-4 text-center text-xs text-[#89958b]">No notes yet. Add the first bit of context.</p>}</div><div className="mt-5 flex gap-2"><input value={comment} onChange={(event) => setComment(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); submitComment(); } }} placeholder="Add a note..." className="h-10 min-w-0 flex-1 rounded-xl border border-[#dcd4c7] bg-[#fbfaf5] px-3 text-sm outline-none focus:border-[#4f8b5c]" data-testid="input-task-comment" /><Button onClick={submitComment} disabled={commentMutation.isPending || !comment.trim()} testId="button-submit-comment"><MessageCircle size={14} /> Post</Button></div></div>
    {editing && <TaskDialog open={editing} onClose={() => setEditing(false)} team={team} initialTask={task} pending={updateTask.isPending} onSubmit={(form) => updateTask.mutate({ taskId: task.id, data: { ...form, dueDate: form.dueDate || null } }, { onSuccess: () => { setEditing(false); queryClient.invalidateQueries({ queryKey: getGetWorkspaceQueryKey() }); queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() }); } })} />}
  </aside></div>;
}

// ─────────────────────────────────────────────
// Team Page
// ─────────────────────────────────────────────

function TeamPage({ workspace }: { workspace?: WorkspaceLike }) {
  const [selected, setSelected] = useState<Profile | null>(null);
  const team = workspace?.team ?? [];
  const tasks = workspace?.tasks ?? [];
  return <div><PageHeader eyebrow="The people behind the work" title="Team room" description="A small team, with enough visibility to help each other without adding ceremony." action={<TeamStrip team={team} />} /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{team.map((person, index) => { const open = tasks.filter((task) => task.assignee.id === person.id && task.status !== "done"); const completed = tasks.filter((task) => task.assignee.id === person.id && task.status === "done").length; return <button type="button" onClick={() => setSelected(person)} key={person.id} className="group rounded-2xl border border-[#e5ded2] bg-[#fffdf9] p-5 text-left shadow-[0_1px_2px_rgba(41,50,39,.03)] transition-all hover:-translate-y-0.5 hover:border-[#bcd3bf] hover:shadow-[0_8px_22px_rgba(41,50,39,.07)] animate-rise-in" style={{ animationDelay: `${index * 45}ms` }} data-testid={`card-team-member-${person.id}`}><div className="flex items-start justify-between"><Avatar profile={person} size="lg" /><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${person.status === "working" ? "bg-[#e4f0e6] text-[#287043]" : person.status === "online" ? "bg-[#fff0cf] text-[#9b6810]" : "bg-[#f0eee8] text-[#8c948e]"}`}>{person.status}</span></div><h2 className="mt-4 font-display text-xl font-semibold tracking-[-0.025em] text-[#263a2a]">{person.fullName}</h2><p className="mt-0.5 text-xs text-[#89958b]">{person.role} · {person.department}</p><div className="mt-5 grid grid-cols-2 gap-2 border-t border-[#eee8dd] pt-4"><div><p className="font-mono text-lg font-bold text-[#35523a]">{open.length}</p><p className="text-[10px] uppercase tracking-wide text-[#939e94]">Open tasks</p></div><div><p className="font-mono text-lg font-bold text-[#35523a]">{completed}</p><p className="text-[10px] uppercase tracking-wide text-[#939e94]">Completed</p></div></div><div className="mt-4 flex items-center gap-1 text-xs font-bold text-[#2d7040] opacity-0 transition-opacity group-hover:opacity-100">View activity <ArrowUpRight size={13} /></div></button>; })}</div>{!team.length && <EmptyState icon={UsersRound} title="No teammates yet" description="Once people join the workspace, you'll see their work here." />}{selected && <MemberDrawer person={selected} tasks={tasks} activity={workspace?.activity ?? []} onClose={() => setSelected(null)} />}</div>;
}

function MemberDrawer({ person, tasks, activity, onClose }: { person: Profile; tasks: Task[]; activity: Activity[]; onClose: () => void }) {
  const owned = tasks.filter((task) => task.assignee.id === person.id);
  return <div className="fixed inset-0 z-40 flex justify-end bg-[#0f1410]/20" onClick={onClose}><aside className="h-full w-full max-w-md overflow-y-auto border-l border-[#e1d8ca] bg-[#fffdf9] p-6 shadow-2xl" onClick={(event) => event.stopPropagation()} data-testid="drawer-member-detail"><div className="flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#b27912]">Team member</span><button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-[#eef3ec]" data-testid="button-close-member-drawer"><X size={18} /></button></div><div className="mt-8 flex items-center gap-4"><Avatar profile={person} size="lg" /><div><h2 className="font-display text-2xl font-semibold text-[#263a2a]">{person.fullName}</h2><p className="text-sm text-[#829087]">{person.role} · {person.department}</p></div></div><div className="mt-7 grid grid-cols-2 gap-3"><StatTile label="Completed" value={person.tasksCompleted ?? owned.filter((task) => task.status === "done").length} detail="All time" icon={CheckCircle2} accent="green" /><StatTile label="This week" value={formatDuration(person.timeWeekSeconds)} detail="Tracked time" icon={Clock3} accent="gold" /></div><div className="mt-8"><SectionHeading title="Current tasks" detail={`${owned.filter((task) => task.status !== "done").length} open`} />{owned.filter((task) => task.status !== "done").slice(0, 5).map((task) => <TaskRow key={task.id} task={task} compact />)}{!owned.length && <p className="rounded-xl bg-[#faf8f2] p-4 text-sm text-[#89958b]">No assigned tasks at the moment.</p>}</div><div className="mt-8"><SectionHeading title="Recent activity" /> <ActivityList items={activity.filter((item) => item.actor.id === person.id)} limit={4} /></div></aside></div>;
}

// ─────────────────────────────────────────────
// Time Page
// ─────────────────────────────────────────────

function TimePage({ workspace }: { workspace?: WorkspaceLike }) {
  const tasks = workspace?.tasks ?? [];
  const active = tasks.filter((task) => task.activeSession);
  const totalToday = workspace?.stats.timeTodaySeconds ?? workspace?.currentUser.timeTodaySeconds ?? 0;
  return <div><PageHeader eyebrow="A clear record of the day" title="Time room" description="Keep the clock honest. See where attention is going, then make room for the work that matters." action={<Button variant="quiet" testId="button-time-export"><ArrowUpRight size={15} /> Export week</Button>} /><div className="grid gap-3.5 sm:grid-cols-3"><StatTile label="Today" value={formatDuration(totalToday)} detail="Across the team" icon={Clock3} accent="green" /><StatTile label="This week" value={formatDuration(workspace?.stats.timeWeekSeconds)} detail="Monday to now" icon={CalendarDays} accent="gold" /><StatTile label="Live now" value={active.length} detail="Active sessions" icon={Play} accent="coral" /></div><div className="mt-7 grid gap-6 xl:grid-cols-[1.15fr_.85fr]"><section className="rounded-2xl border border-[#e5ded2] bg-[#fffdf9] p-5"><SectionHeading title="Live sessions" detail="Work happening right now." />{active.length ? <div className="space-y-2">{active.map((task) => <div key={task.id} className="flex items-center gap-3 rounded-xl bg-[#f3f7f1] px-3.5 py-3" data-testid={`live-session-${task.id}`}><span className="h-2 w-2 animate-soft-pulse rounded-full bg-[#e8a020]" /><Avatar profile={task.assignee} size="sm" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-[#334736]">{task.assignee.fullName} <span className="font-normal text-[#849087]">is working on</span> {task.title}</p><p className="mt-0.5 text-xs text-[#89958b]">{formatDuration(task.timeSpentSeconds)} logged · {task.department}</p></div><Button variant="outline" className="!px-2.5 !py-2" testId={`button-view-live-${task.id}`}><ArrowUpRight size={14} /></Button></div>)}</div> : <EmptyState icon={Coffee} title="The clock is quiet" description="Start a timer from any task to make the next block of work visible." />}</section><section className="rounded-2xl border border-[#e5ded2] bg-[#fffdf9] p-5"><SectionHeading title="Where time goes" detail="By department this week." /><TimeBars tasks={tasks} /></section></div></div>;
}
function TimeBars({ tasks }: { tasks: Task[] }) {
  const groups = Array.from(new Set(tasks.map((task) => task.department))).slice(0, 6);
  const max = Math.max(...groups.map((group) => tasks.filter((task) => task.department === group).reduce((sum, task) => sum + task.timeSpentSeconds, 0)), 1);
  return <div className="space-y-5">{groups.map((group, index) => { const seconds = tasks.filter((task) => task.department === group).reduce((sum, task) => sum + task.timeSpentSeconds, 0); return <div key={group} data-testid={`time-bar-${group}`}><div className="mb-2 flex justify-between text-xs"><span className="font-semibold text-[#536256]">{group}</span><span className="font-mono text-[#8a968d]">{formatDuration(seconds)}</span></div><div className="h-2.5 rounded-full bg-[#edf0e9]"><div className={`h-2.5 rounded-full ${["bg-[#1b4d2e]", "bg-[#d59a2d]", "bg-[#7da786]", "bg-[#bd8060]"][index % 4]}`} style={{ width: `${Math.max(6, seconds / max * 100)}%` }} /></div></div>; })}{!groups.length && <EmptyState icon={Clock3} title="No time logged yet" description="Tracked sessions will become a picture here." />}</div>;
}

// ─────────────────────────────────────────────
// Activity Page
// ─────────────────────────────────────────────

function ActivityPage({ workspace }: { workspace?: WorkspaceLike }) {
  const activityQuery = useListActivity({ query: { queryKey: getListActivityQueryKey(), staleTime: 5000, refetchInterval: 15000, refetchOnMount: "always" } });
  const items = activityQuery.data ?? workspace?.activity ?? [];
  const [filter, setFilter] = useState("all");
  const actors = Array.from(new Set(items.map((item) => item.actor.fullName)));
  const shown = filter === "all" ? items : items.filter((item) => item.actor.fullName === filter);
  return <div><PageHeader eyebrow="The room remembers" title="Activity" description="A shared, lightweight record of what changed and who moved it forward." action={<div className="flex items-center gap-2 rounded-xl bg-[#e8f2e9] px-3 py-2 text-xs font-bold text-[#2d7040]"><span className="h-1.5 w-1.5 animate-soft-pulse rounded-full bg-[#4d995f]" />Live feed</div>} /><div className="mb-5 flex flex-wrap gap-2">{["all", ...actors].map((item) => <button key={item} type="button" onClick={() => setFilter(item)} className={`rounded-full px-3 py-2 text-xs font-bold transition ${filter === item ? "bg-[#1b4d2e] text-white" : "border border-[#e0d8cb] bg-[#fffdf9] text-[#6f7d72] hover:border-[#a4bea7]"}`} data-testid={`button-activity-filter-${item.toLowerCase().replaceAll(" ", "-")}`}>{item === "all" ? "Everyone" : item}</button>)}</div><section className="max-w-3xl rounded-2xl border border-[#e5ded2] bg-[#fffdf9] p-5 shadow-[0_1px_2px_rgba(41,50,39,.03)]"><div className="mb-2 flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-[0.15em] text-[#8c978e]">{shown.length} updates</span><button type="button" className="text-xs font-bold text-[#2d7040]" onClick={() => activityQuery.refetch()} data-testid="button-refresh-activity">Refresh</button></div>{activityQuery.isLoading ? <div className="space-y-3">{[1, 2, 3, 4].map((item) => <SkeletonBlock key={item} className="h-14" />)}</div> : <ActivityList items={shown} />}</section></div>;
}

// ─────────────────────────────────────────────
// Chat Page
// ─────────────────────────────────────────────

function ChatPage({ currentUser }: { currentUser?: Profile }) {
  const channelsQuery = useChannelsData();
  const channels = channelsQuery.data ?? [];
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [newChannelName, setNewChannelName] = useState("");
  const [showNewChannel, setShowNewChannel] = useState(false);
  const createChannel = useCreateChannelMutation();

  // Auto-select first channel
  useEffect(() => {
    if (channels.length && !activeChannelId) {
      setActiveChannelId(channels[0].id);
    }
  }, [channels, activeChannelId]);

  const activeChannel = channels.find((ch) => ch.id === activeChannelId) ?? null;

  const handleCreateChannel = () => {
    if (!newChannelName.trim()) return;
    createChannel.mutate(
      { name: newChannelName, description: "" },
      {
        onSuccess: (data) => {
          setNewChannelName("");
          setShowNewChannel(false);
          setActiveChannelId((data as any).id);
        },
      }
    );
  };

  return (
    <div>
      <PageHeader
        eyebrow="Real-time messaging"
        title="Team chat"
        description="Channels for every topic. Messages delivered instantly."
        action={
          <div className="flex items-center gap-2 rounded-xl bg-[#e8f2e9] px-3 py-2 text-xs font-bold text-[#2d7040]">
            <span className="h-1.5 w-1.5 animate-soft-pulse rounded-full bg-[#4d995f]" />
            Live
          </div>
        }
      />

      <div className="mt-4 flex h-[calc(100vh-240px)] min-h-[500px] overflow-hidden rounded-2xl border border-[#e5ded2] shadow-[0_1px_2px_rgba(41,50,39,.03)]">
        {/* Sidebar */}
        <aside className="flex w-60 flex-shrink-0 flex-col border-r border-[#eee8dd] bg-[#f7f4ee]">
          <div className="flex items-center justify-between border-b border-[#eee8dd] px-4 py-3">
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#8c978e]">Channels</span>
            <button
              type="button"
              onClick={() => setShowNewChannel(true)}
              className="rounded-md p-1 text-[#5a7d63] hover:bg-[#e8f2e9]"
              data-testid="button-new-channel"
              title="Add channel"
            >
              <Plus size={15} />
            </button>
          </div>

          {showNewChannel && (
            <div className="border-b border-[#eee8dd] p-3">
              <input
                autoFocus
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleCreateChannel(); if (e.key === "Escape") setShowNewChannel(false); }}
                placeholder="channel-name"
                className="w-full rounded-lg border border-[#dcd4c7] bg-white px-2.5 py-1.5 text-xs outline-none focus:border-[#4f8b5c]"
                data-testid="input-new-channel-name"
              />
              <div className="mt-2 flex gap-1.5">
                <button
                  type="button"
                  onClick={handleCreateChannel}
                  disabled={createChannel.isPending}
                  className="flex-1 rounded-lg bg-[#1b4d2e] py-1.5 text-xs font-bold text-white hover:bg-[#163d25]"
                  data-testid="button-create-channel-submit"
                >
                  {createChannel.isPending ? "Creating…" : "Create"}
                </button>
                <button type="button" onClick={() => setShowNewChannel(false)} className="rounded-lg px-2 text-[#8c978e] hover:bg-[#e5ded2]">
                  <X size={13} />
                </button>
              </div>
            </div>
          )}

          <nav className="flex-1 overflow-y-auto py-2">
            {channelsQuery.isLoading ? (
              <div className="space-y-1 px-2">{[1, 2, 3].map((i) => <SkeletonBlock key={i} className="h-8" />)}</div>
            ) : channels.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-[#9aa59c]">No channels yet.<br />Create your first one.</p>
            ) : (
              channels.map((ch) => (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => setActiveChannelId(ch.id)}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${activeChannelId === ch.id ? "bg-[#1b4d2e] text-white" : "text-[#4c5e50] hover:bg-[#ece8e0]"}`}
                  data-testid={`button-channel-${ch.name}`}
                >
                  <Hash size={13} className="flex-shrink-0 opacity-60" />
                  <span className="truncate font-semibold">{ch.name}</span>
                </button>
              ))
            )}
          </nav>
        </aside>

        {/* Message area */}
        {activeChannel ? (
          <MessageFeed channel={activeChannel} currentUser={currentUser} />
        ) : (
          <div className="flex flex-1 items-center justify-center bg-[#fffdf9]">
            <div className="text-center">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#e8f2e9] text-[#2d7040]">
                <MessageCircle size={24} />
              </div>
              <p className="mt-4 font-display text-lg font-semibold text-[#263a2a]">Select a channel</p>
              <p className="mt-1.5 text-sm text-[#89958b]">Choose a channel from the left to start chatting.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MessageFeed({ channel, currentUser }: { channel: ChatChannel; currentUser?: Profile }) {
  const messagesQuery = useMessagesData(channel.id);
  const messages = messagesQuery.data ?? [];
  const sendMessage = useSendMessageMutation();
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const submit = () => {
    if (!text.trim() || sendMessage.isPending) return;
    sendMessage.mutate({ channelId: channel.id, content: text.trim() }, { onSuccess: () => setText("") });
  };

  return (
    <div className="flex flex-1 flex-col bg-[#fffdf9]">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-[#eee8dd] px-5 py-3">
        <Hash size={15} className="text-[#6d8072]" />
        <span className="font-display text-base font-semibold text-[#263a2a]">{channel.name}</span>
        {channel.description && <span className="ml-2 hidden text-xs text-[#9aa59c] sm:block">— {channel.description}</span>}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4" data-testid="message-feed">
        {messagesQuery.isLoading ? (
          <div className="space-y-4">{[1, 2, 3].map((i) => <div key={i} className="flex gap-3"><SkeletonBlock className="h-8 w-8 rounded-full" /><div className="flex-1 space-y-1.5"><SkeletonBlock className="h-3 w-32" /><SkeletonBlock className="h-10" /></div></div>)}</div>
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[#f2f5ef] text-[#5a7d63]"><Hash size={20} /></div>
              <p className="mt-3 font-semibold text-[#3d5140]">Start the conversation</p>
              <p className="mt-1 text-xs text-[#89958b]">Be the first to say something in #{channel.name}</p>
            </div>
          </div>
        ) : (
          messages.map((msg, i) => {
            const isMe = msg.author.id === currentUser?.id;
            const prevMsg = messages[i - 1];
            const sameAuthor = prevMsg?.author.id === msg.author.id;
            return (
              <div key={msg.id} className={`flex gap-3 ${isMe ? "flex-row-reverse" : ""}`} data-testid={`message-${msg.id}`}>
                {!sameAuthor && <Avatar profile={msg.author} size="sm" />}
                {sameAuthor && <div className="w-8 flex-shrink-0" />}
                <div className={`max-w-[70%] ${isMe ? "items-end" : "items-start"} flex flex-col`}>
                  {!sameAuthor && (
                    <div className={`mb-1 flex items-baseline gap-2 ${isMe ? "flex-row-reverse" : ""}`}>
                      <span className="text-xs font-bold text-[#405449]">{isMe ? "You" : msg.author.fullName}</span>
                      <span className="text-[10px] text-[#a0aaa1]">{relativeTime(msg.createdAt)}</span>
                    </div>
                  )}
                  <div className={`rounded-2xl px-3.5 py-2.5 text-sm leading-5 ${isMe ? "rounded-tr-sm bg-[#1b4d2e] text-[#e8f5eb]" : "rounded-tl-sm bg-[#f2f5ef] text-[#3d5140]"}`}>
                    {msg.content}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-[#eee8dd] px-4 py-3">
        <div className="flex items-center gap-2 rounded-xl border border-[#dcd4c7] bg-[#fbfaf5] px-3 focus-within:border-[#4f8b5c] focus-within:ring-2 focus-within:ring-[#d8eddf]">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
            placeholder={`Message #${channel.name}…`}
            className="h-10 flex-1 bg-transparent text-sm outline-none placeholder:text-[#9aa59c]"
            data-testid="input-chat-message"
          />
          <button
            type="button"
            onClick={submit}
            disabled={!text.trim() || sendMessage.isPending}
            className="rounded-lg p-1.5 text-[#2d7040] transition hover:bg-[#e8f2e9] disabled:opacity-40"
            data-testid="button-send-message"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Meeting Rooms Page
// ─────────────────────────────────────────────

function MeetingRoomsPage({ currentUser }: { currentUser?: Profile }) {
  const roomsQuery = useRoomsData();
  const rooms = roomsQuery.data ?? [];
  const joinRoom = useJoinRoomMutation();
  const leaveRoom = useLeaveRoomMutation();
  const toggleMedia = useToggleRoomMediaMutation();
  const createRoom = useCreateRoomMutation();
  const [newRoomTitle, setNewRoomTitle] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);

  const myParticipation = useMemo(() => {
    for (const room of rooms) {
      const part = room.participants.find((p) => p.user.id === currentUser?.id);
      if (part) return { room, participant: part };
    }
    return null;
  }, [rooms, currentUser?.id]);

  const handleJoin = (roomId: string) => {
    joinRoom.mutate({ roomId, isMuted: false, isVideoOn: true }, {
      onSuccess: () => setActiveRoomId(roomId),
    });
  };

  const handleLeave = (roomId: string) => {
    leaveRoom.mutate({ roomId }, {
      onSuccess: () => { if (activeRoomId === roomId) setActiveRoomId(null); },
    });
  };

  const handleCreate = () => {
    if (!newRoomTitle.trim()) return;
    createRoom.mutate({ title: newRoomTitle.trim(), description: "" }, {
      onSuccess: () => { setNewRoomTitle(""); setShowNew(false); },
    });
  };

  return (
    <div>
      <PageHeader
        eyebrow="Voice & video"
        title="Meeting rooms"
        description="Drop in, say hi, and work together — no scheduling needed."
        action={
          <Button onClick={() => setShowNew(true)} testId="button-new-room">
            <Plus size={16} /> New room
          </Button>
        }
      />

      {/* Currently in a room banner */}
      {myParticipation && (
        <div className="mb-5 flex items-center gap-4 rounded-2xl bg-[#1b4d2e] px-5 py-4 text-[#e8f5eb] shadow-lg animate-rise-in">
          <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl bg-[#e8a020]/20">
            <Video size={20} className="text-[#e8a020]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-display text-sm font-semibold">You're live in <span className="text-[#e8a020]">{myParticipation.room.title}</span></p>
            <p className="text-xs text-[#9abfa3]">{myParticipation.room.participantCount} participant{myParticipation.room.participantCount !== 1 ? "s" : ""} in the room</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => toggleMedia.mutate({ roomId: myParticipation.room.id, isMuted: !myParticipation.participant.isMuted })}
              className={`grid h-9 w-9 place-items-center rounded-xl transition ${myParticipation.participant.isMuted ? "bg-red-500/20 text-red-300" : "bg-[#ffffff15] text-[#e8f5eb] hover:bg-[#ffffff25]"}`}
              data-testid="button-toggle-mute"
            >
              {myParticipation.participant.isMuted ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
            <button
              type="button"
              onClick={() => toggleMedia.mutate({ roomId: myParticipation.room.id, isVideoOn: !myParticipation.participant.isVideoOn })}
              className={`grid h-9 w-9 place-items-center rounded-xl transition ${!myParticipation.participant.isVideoOn ? "bg-red-500/20 text-red-300" : "bg-[#ffffff15] text-[#e8f5eb] hover:bg-[#ffffff25]"}`}
              data-testid="button-toggle-video"
            >
              {myParticipation.participant.isVideoOn ? <Video size={16} /> : <VideoOff size={16} />}
            </button>
            <button
              type="button"
              onClick={() => handleLeave(myParticipation.room.id)}
              className="grid h-9 w-9 place-items-center rounded-xl bg-red-500/20 text-red-300 transition hover:bg-red-500/30"
              data-testid="button-leave-room"
            >
              <PhoneOff size={16} />
            </button>
          </div>
        </div>
      )}

      {/* New room form */}
      {showNew && (
        <div className="mb-5 rounded-2xl border border-[#e5ded2] bg-[#fffdf9] p-5">
          <p className="mb-3 text-sm font-bold text-[#3d5140]">Create a new room</p>
          <div className="flex gap-3">
            <input
              autoFocus
              value={newRoomTitle}
              onChange={(e) => setNewRoomTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setShowNew(false); }}
              placeholder="e.g. Design review, Quick sync…"
              className="h-10 flex-1 rounded-xl border border-[#dcd4c7] bg-[#fbfaf5] px-3 text-sm outline-none focus:border-[#4f8b5c]"
              data-testid="input-new-room-title"
            />
            <Button onClick={handleCreate} disabled={createRoom.isPending || !newRoomTitle.trim()} testId="button-create-room-submit">
              {createRoom.isPending ? "Creating…" : "Create room"}
            </Button>
            <Button variant="outline" onClick={() => setShowNew(false)} testId="button-cancel-new-room">Cancel</Button>
          </div>
        </div>
      )}

      {/* Room grid */}
      {roomsQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">{[1, 2, 3, 4].map((i) => <SkeletonBlock key={i} className="h-44" />)}</div>
      ) : rooms.length === 0 ? (
        <EmptyState icon={Video} title="No rooms yet" description="Create your first meeting room and invite your team to join." action={<Button onClick={() => setShowNew(true)} testId="button-empty-new-room"><Plus size={15} /> Create room</Button>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {rooms.map((room) => {
            const isInRoom = room.participants.some((p) => p.user.id === currentUser?.id);
            const myPart = room.participants.find((p) => p.user.id === currentUser?.id);
            return (
              <div
                key={room.id}
                className={`rounded-2xl border p-5 transition-all ${isInRoom ? "border-[#2d7040] bg-[#f2f9f4] shadow-[0_0_0_2px_#2d704020]" : "border-[#e5ded2] bg-[#fffdf9] hover:border-[#bcd3bf] hover:shadow-md"}`}
                data-testid={`room-card-${room.id}`}
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className={`h-2.5 w-2.5 rounded-full ${room.participantCount > 0 ? "bg-[#4d995f] shadow-[0_0_0_3px_#4d995f30]" : "bg-[#c4cfc6]"}`} />
                      <h3 className="font-display text-lg font-semibold text-[#263a2a] truncate">{room.title}</h3>
                    </div>
                    {room.description && <p className="mt-1 text-xs text-[#89958b] truncate">{room.description}</p>}
                  </div>
                  <span className="ml-3 flex-shrink-0 rounded-full bg-[#f2f5ef] px-2.5 py-1 text-[10px] font-bold text-[#5a7d63]">
                    {room.participantCount} in room
                  </span>
                </div>

                {/* Participants */}
                {room.participants.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {room.participants.map((p) => (
                      <div key={p.id} className="flex items-center gap-1.5 rounded-full bg-white border border-[#e5ded2] pl-1 pr-2.5 py-1 text-xs" data-testid={`room-participant-${p.user.id}`}>
                        <Avatar profile={p.user} size="sm" />
                        <span className="font-semibold text-[#405449] truncate max-w-[80px]">{p.user.fullName.split(" ")[0]}</span>
                        <span className="flex items-center gap-0.5 text-[#9ba49d]">
                          {p.isMuted && <MicOff size={10} />}
                          {!p.isVideoOn && <VideoOff size={10} />}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Action buttons */}
                <div className="mt-5 flex gap-2">
                  {isInRoom ? (
                    <>
                      <button
                        type="button"
                        onClick={() => toggleMedia.mutate({ roomId: room.id, isMuted: !myPart?.isMuted })}
                        className={`flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-bold transition ${myPart?.isMuted ? "bg-red-100 text-red-600 hover:bg-red-200" : "bg-[#e8f2e9] text-[#2d7040] hover:bg-[#d5ebd8]"}`}
                        data-testid={`button-room-mute-${room.id}`}
                      >
                        {myPart?.isMuted ? <><MicOff size={13} /> Unmute</> : <><Mic size={13} /> Mute</>}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleLeave(room.id)}
                        className="flex h-9 items-center gap-1.5 rounded-xl bg-red-100 px-3 text-xs font-bold text-red-600 transition hover:bg-red-200"
                        data-testid={`button-room-leave-${room.id}`}
                      >
                        <PhoneOff size={13} /> Leave
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleJoin(room.id)}
                      disabled={joinRoom.isPending}
                      className="flex h-9 items-center gap-1.5 rounded-xl bg-[#1b4d2e] px-4 text-xs font-bold text-white transition hover:bg-[#163d25] disabled:opacity-50"
                      data-testid={`button-room-join-${room.id}`}
                    >
                      <Video size={13} /> Join room
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Workspace Page (Join / Create)
// ─────────────────────────────────────────────

function WorkspacePage({ workspace, currentUser }: { workspace?: WorkspaceLike; currentUser?: Profile }) {
  const [mode, setMode] = useState<"view" | "join" | "create">("view");
  const [joinCode, setJoinCode] = useState("");
  const [wsName, setWsName] = useState("");
  const joinWs = useJoinWorkspaceMutation();
  const createWs = useCreateWorkspaceMutation();
  const workspaceInfo = (workspace as any)?.workspaceInfo;

  return (
    <div>
      <PageHeader
        eyebrow="Your shared space"
        title="Workspace"
        description="One workspace unites all tasks, chat, and meetings for your team."
      />

      <div className="grid max-w-4xl gap-5 lg:grid-cols-2">
        {/* Current workspace info */}
        <section className="rounded-2xl border border-[#e5ded2] bg-[#fffdf9] p-6">
          <SectionHeading title="Current workspace" detail="Your active shared space." />
          <div className="mt-5 space-y-3">
            <div className="rounded-xl bg-[#f3f6ef] p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#8b978d]">Name</p>
              <p className="mt-1 font-display text-xl font-semibold text-[#263a2a]">{workspaceInfo?.name ?? "WAFFAR Main Workspace"}</p>
            </div>
            <div className="rounded-xl bg-[#f3f6ef] p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#8b978d]">Invite code</p>
              <div className="mt-1 flex items-center gap-3">
                <p className="font-mono text-xl font-bold tracking-widest text-[#1b4d2e]">{workspaceInfo?.code ?? "—"}</p>
                {workspaceInfo?.code && (
                  <button
                    type="button"
                    onClick={() => { navigator.clipboard.writeText(workspaceInfo.code); }}
                    className="rounded-lg bg-[#1b4d2e] px-2.5 py-1 text-[10px] font-bold text-white hover:bg-[#163d25]"
                    data-testid="button-copy-code"
                  >
                    Copy
                  </button>
                )}
              </div>
              <p className="mt-1.5 text-xs text-[#89958b]">Share this code with teammates so they can join</p>
            </div>
            <div className="rounded-xl bg-[#f3f6ef] p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#8b978d]">Members</p>
              <p className="mt-1 font-display text-xl font-semibold text-[#263a2a]">{workspace?.team.length ?? 0}</p>
            </div>
          </div>
        </section>

        {/* Join / Create */}
        <section className="rounded-2xl border border-[#e5ded2] bg-[#fffdf9] p-6">
          <SectionHeading title="Switch workspace" detail="Join an existing space or create a new one." />

          {/* Mode tabs */}
          <div className="mt-4 flex rounded-xl bg-[#f3f6ef] p-1">
            <button
              type="button"
              onClick={() => setMode("join")}
              className={`flex-1 rounded-lg py-2 text-xs font-bold transition ${mode === "join" ? "bg-white text-[#1b4d2e] shadow-sm" : "text-[#6b7d6e] hover:text-[#3d5140]"}`}
              data-testid="button-tab-join"
            >
              Join with code
            </button>
            <button
              type="button"
              onClick={() => setMode("create")}
              className={`flex-1 rounded-lg py-2 text-xs font-bold transition ${mode === "create" ? "bg-white text-[#1b4d2e] shadow-sm" : "text-[#6b7d6e] hover:text-[#3d5140]"}`}
              data-testid="button-tab-create"
            >
              Create new
            </button>
          </div>

          {mode === "join" && (
            <div className="mt-5 space-y-3">
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-[#526254]">Workspace code</span>
                <input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="e.g. WAFFAR-MAIN or WAF-AB12"
                  className="h-11 w-full rounded-xl border border-[#dcd4c7] bg-[#fbfaf5] px-3.5 font-mono text-sm tracking-widest outline-none focus:border-[#4f8b5c] focus:ring-2 focus:ring-[#d8eddf]"
                  data-testid="input-join-code"
                />
              </label>
              {joinWs.isError && (
                <p className="rounded-lg bg-[#fae6df] px-3 py-2 text-xs font-semibold text-[#9a513e]">
                  {(joinWs.error as Error)?.message ?? "Workspace not found. Check the code and try again."}
                </p>
              )}
              {joinWs.isSuccess && (
                <p className="rounded-lg bg-[#e8f2e9] px-3 py-2 text-xs font-semibold text-[#2d7040]">
                  Joined! The page will refresh with your new workspace.
                </p>
              )}
              <Button
                onClick={() => joinWs.mutate(joinCode)}
                disabled={joinWs.isPending || !joinCode.trim()}
                className="w-full"
                testId="button-join-workspace"
              >
                {joinWs.isPending ? "Joining…" : "Join workspace"}
              </Button>
            </div>
          )}

          {mode === "create" && (
            <div className="mt-5 space-y-3">
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-[#526254]">Workspace name</span>
                <input
                  value={wsName}
                  onChange={(e) => setWsName(e.target.value)}
                  placeholder="e.g. Acme Engineering"
                  className="h-11 w-full rounded-xl border border-[#dcd4c7] bg-[#fbfaf5] px-3.5 text-sm outline-none focus:border-[#4f8b5c] focus:ring-2 focus:ring-[#d8eddf]"
                  data-testid="input-create-workspace-name"
                />
              </label>
              <p className="text-[11px] text-[#89958b]">A unique invite code will be generated automatically. You can share it with your teammates.</p>
              {createWs.isError && (
                <p className="rounded-lg bg-[#fae6df] px-3 py-2 text-xs font-semibold text-[#9a513e]">
                  {(createWs.error as Error)?.message ?? "Failed to create workspace. Try again."}
                </p>
              )}
              {createWs.isSuccess && (
                <p className="rounded-lg bg-[#e8f2e9] px-3 py-2 text-xs font-semibold text-[#2d7040]">
                  Workspace created! Share your invite code with teammates.
                </p>
              )}
              <Button
                onClick={() => createWs.mutate({ name: wsName })}
                disabled={createWs.isPending || !wsName.trim()}
                className="w-full"
                testId="button-create-workspace"
              >
                {createWs.isPending ? "Creating…" : "Create workspace"}
              </Button>
            </div>
          )}

          {mode === "view" && (
            <div className="mt-8 flex flex-col gap-3">
              <button
                type="button"
                onClick={() => setMode("join")}
                className="flex items-center gap-3 rounded-xl border border-[#e5ded2] bg-[#f8f5ef] p-4 text-left transition hover:border-[#bcd3bf] hover:bg-[#f0f7f1]"
                data-testid="button-go-join"
              >
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#e8f2e9] text-[#2d7040]"><Users size={18} /></div>
                <div><p className="text-sm font-bold text-[#263a2a]">Join with a code</p><p className="text-xs text-[#89958b]">Your teammate shared a code with you</p></div>
                <ChevronRight size={16} className="ml-auto text-[#c2cec4]" />
              </button>
              <button
                type="button"
                onClick={() => setMode("create")}
                className="flex items-center gap-3 rounded-xl border border-[#e5ded2] bg-[#f8f5ef] p-4 text-left transition hover:border-[#bcd3bf] hover:bg-[#f0f7f1]"
                data-testid="button-go-create"
              >
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#fff5e0] text-[#9b6810]"><Plus size={18} /></div>
                <div><p className="text-sm font-bold text-[#263a2a]">Create a workspace</p><p className="text-xs text-[#89958b]">Start fresh and invite your team</p></div>
                <ChevronRight size={16} className="ml-auto text-[#c2cec4]" />
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Settings Page
// ─────────────────────────────────────────────

function SettingsPage({ workspace }: { workspace?: WorkspaceLike }) {
  const user = workspace?.currentUser;
  const [notifications, setNotifications] = useState(true);
  const [digest, setDigest] = useState(false);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return <div><PageHeader eyebrow="Make the room yours" title="Settings" description="Small controls for how WAFFAR shows up in your day." /><div className="grid max-w-4xl gap-6 lg:grid-cols-[1.1fr_.9fr]"><section className="rounded-2xl border border-[#e5ded2] bg-[#fffdf9] p-5 sm:p-6"><SectionHeading title="Your profile" detail="Visible to everyone in the workspace." /><div className="mt-5 flex items-center gap-4"><Avatar profile={user} size="lg" /><div><p className="font-display text-xl font-semibold text-[#263a2a]">{user?.fullName ?? "Your profile"}</p><p className="text-sm text-[#87938a]">{user?.email}</p></div><Button variant="outline" onClick={() => window.alert("Profile editing requires a connected workspace account.")} className="ml-auto" testId="button-edit-profile">Edit profile</Button></div><div className="mt-7 grid gap-4 sm:grid-cols-2"><label className="block"><span className="mb-1.5 block text-xs font-bold text-[#526254]">Full name</span><input readOnly value={user?.fullName ?? ""} className="h-11 w-full rounded-xl border border-[#dcd4c7] bg-[#fbfaf5] px-3.5 text-sm outline-none focus:border-[#4f8b5c]" data-testid="input-settings-name" /></label><label className="block"><span className="mb-1.5 block text-xs font-bold text-[#526254]">Email</span><input readOnly value={user?.email ?? ""} className="h-11 w-full rounded-xl border border-[#dcd4c7] bg-[#fbfaf5] px-3.5 text-sm outline-none focus:border-[#4f8b5c]" data-testid="input-settings-email" /></label></div></section><section className="rounded-2xl border border-[#e5ded2] bg-[#fffdf9] p-5 sm:p-6"><SectionHeading title="Notifications" detail="Choose what earns your attention." /><div className="mt-5 space-y-5"><div className="flex items-center justify-between gap-4"><div><p className="text-sm font-semibold text-[#3d5140]">Task movement</p><p className="mt-1 text-xs leading-5 text-[#89958b]">When a task is assigned or moved.</p></div><Toggle value={notifications} onChange={setNotifications} label="" id="task-movement" /></div><div className="flex items-center justify-between gap-4"><div><p className="text-sm font-semibold text-[#3d5140]">Weekly digest</p><p className="mt-1 text-xs leading-5 text-[#89958b]">A Friday note on the shape of the week.</p></div><Toggle value={digest} onChange={setDigest} label="" id="weekly-digest" /></div></div></section><section className="rounded-2xl border border-[#e5ded2] bg-[#fffdf9] p-5 sm:p-6 lg:col-span-2"><SectionHeading title="Workspace" detail="The shared defaults for WAFFAR." /><div className="mt-5 grid gap-4 sm:grid-cols-3"><div className="rounded-xl bg-[#f3f6ef] p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-[#8b978d]">Workspace</p><p className="mt-1 font-display text-lg font-semibold text-[#263a2a]">WAFFAR Team</p></div><div className="rounded-xl bg-[#f3f6ef] p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-[#8b978d]">People</p><p className="mt-1 font-display text-lg font-semibold text-[#263a2a]">{workspace?.team.length ?? 0} members</p></div><div className="rounded-xl bg-[#f3f6ef] p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-[#8b978d]">Timezone</p><p className="mt-1 font-display text-lg font-semibold text-[#263a2a]">{timezone}</p></div></div></section></div></div>;
}
