import { useMemo, useState } from "react";
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
  LayoutList,
  ListFilter,
  MessageCircle,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Settings2,
  Target,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import {
  getGetWorkspaceQueryKey,
  getListActivityQueryKey,
  getListTasksQueryKey,
  getListTaskCommentsQueryKey,
  useCreateTask,
  useCreateTaskComment,
  useDeleteTask,
  useGetWorkspace,
  useListActivity,
  useListTaskComments,
  useListTasks,
  useStartTaskTimer,
  useStopTaskTimer,
  useUpdateTask,
} from "@workspace/api-client-react";
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
} from "@/components/workspace";

export function WorkspaceRouter({ onLogout }: { onLogout: () => void }) {
  const workspaceQuery = useGetWorkspace({ query: { queryKey: getGetWorkspaceQueryKey(), staleTime: 30000 } });
  const workspace = workspaceQuery.data;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [location] = useLocation();
  const team = workspace?.team ?? [];
  const currentUser = workspace?.currentUser;
  return (
    <AppShell currentUser={currentUser} onCreateTask={() => setDialogOpen(true)} onLogout={onLogout}>
      <div className="relative">
        {workspaceQuery.isLoading && !workspace ? <LoadingWorkspace /> : workspaceQuery.isError && !workspace ? <ErrorState onRetry={() => workspaceQuery.refetch()} /> : (
          <WorkspaceRouteContent location={location} workspace={workspace} />
        )}
      </div>
      <GlobalTaskDialog open={dialogOpen} onClose={() => setDialogOpen(false)} team={team} />
    </AppShell>
  );
}

function GlobalTaskDialog({ open, onClose, team }: { open: boolean; onClose: () => void; team: Profile[] }) {
  const queryClient = useQueryClient();
  const createTask = useCreateTask();
  return <TaskDialog open={open} onClose={onClose} team={team} pending={createTask.isPending} onSubmit={(form) => createTask.mutate({ data: { title: form.title, description: form.description, assigneeId: form.assigneeId, department: form.department, priority: form.priority, dueDate: form.dueDate || null } }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetWorkspaceQueryKey() }); queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() }); onClose(); } })} />;
}

function WorkspaceRouteContent({ location, workspace }: { location: string; workspace?: WorkspaceLike }) {
  if (location === "/") return <DashboardPage workspace={workspace} />;
  if (location === "/my-tasks") return <MyTasksPage workspace={workspace} />;
  if (location.startsWith("/tasks")) return <TasksPage workspace={workspace} />;
  if (location === "/team") return <TeamPage workspace={workspace} />;
  if (location === "/time") return <TimePage workspace={workspace} />;
  if (location === "/activity") return <ActivityPage workspace={workspace} />;
  if (location === "/settings") return <SettingsPage workspace={workspace} />;
  return <DashboardPage workspace={workspace} />;
}

type WorkspaceLike = Workspace;
function LoadingWorkspace() {
  return <div className="space-y-6"><SkeletonBlock className="h-8 w-56" /><SkeletonBlock className="h-5 w-80" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[1, 2, 3, 4].map((item) => <SkeletonBlock key={item} className="h-36" />)}</div><SkeletonBlock className="h-80" /></div>;
}
function ErrorState({ onRetry }: { onRetry: () => void }) {
  return <div className="flex min-h-[420px] items-center justify-center"><div className="max-w-sm text-center"><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#fae6df] text-[#9a513e]"><Target size={24} /></div><h2 className="mt-4 font-display text-xl font-semibold text-[#263a2a]">The workroom door is stuck</h2><p className="mt-2 text-sm leading-6 text-[#7d897f]">We couldn't load the workspace right now. Give it another try.</p><Button onClick={onRetry} variant="outline" className="mt-5" testId="button-retry-workspace">Try again</Button></div></div>;
}

function DashboardPage({ workspace }: { workspace?: WorkspaceLike }) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const startTimer = useStartTaskTimer();
  const stopTimer = useStopTaskTimer();
  const current = workspace?.currentUser;
  const tasks = workspace?.tasks ?? [];
  const active = tasks.filter((task) => task.status === "in_progress");
  const myTasks = tasks.filter((task) => task.assignee.id === current?.id && task.status !== "done");
  return <div>
    <PageHeader eyebrow="Thursday, 24 October" title={`Good morning, ${current?.fullName?.split(" ")[0] ?? "team"}.`} description="Here's the shape of the workroom today. Keep the important things moving." action={<Button onClick={() => document.querySelector<HTMLButtonElement>('[data-testid="button-sidebar-create-task"]')?.click()} testId="button-dashboard-new-task"><Plus size={16} /> New task</Button>} />
    <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
      <StatTile label="My tasks" value={workspace?.stats.myTasks ?? myTasks.length} detail="2 due this week" icon={ListFilter} accent="green" />
      <StatTile label="In progress" value={workspace?.stats.inProgress ?? active.length} detail={`${active.filter((task) => task.priority === "urgent").length || 1} needs a close eye`} icon={Target} accent="gold" />
      <StatTile label="Completed" value={workspace?.stats.completed ?? tasks.filter((task) => task.status === "done").length} detail="This week" icon={CheckCircle2} accent="ink" />
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
  </div>;
}

function WorkloadCard({ tasks, team }: { tasks: Task[]; team: Profile[] }) {
  return <section className="rounded-2xl border border-[#e5ded2] bg-[#fffdf9] px-5 py-4 shadow-[0_1px_2px_rgba(41,50,39,.03)]"><SectionHeading title="Workload at a glance" detail="Open work by owner." /><div className="space-y-4">{team.slice(0, 5).map((person) => { const count = tasks.filter((task) => task.assignee.id === person.id && task.status !== "done").length; const width = Math.min(100, count * 19 + 8); return <div key={person.id} className="flex items-center gap-3" data-testid={`workload-${person.id}`}><Avatar profile={person} size="sm" /><span className="w-20 truncate text-xs font-semibold text-[#536256]">{person.fullName.split(" ")[0]}</span><div className="h-2 flex-1 rounded-full bg-[#eef0e9]"><div className="h-2 rounded-full bg-[#7dad80] transition-all duration-500" style={{ width: `${width}%` }} /></div><span className="w-5 text-right font-mono text-[10px] text-[#7c897f]">{count}</span></div>; })}{!team.length && <EmptyState icon={UsersRound} title="No team data yet" description="People will show up here once the workspace is connected." />}</div></section>;
}

function MyTasksPage({ workspace }: { workspace?: WorkspaceLike }) {
  const current = workspace?.currentUser;
  const tasks = workspace?.tasks ?? [];
  return <TasksCollectionPage title="My tasks" eyebrow="Your workbench" description="The work that has your name on it, with enough context to make the next move." tasks={tasks.filter((task) => task.assignee.id === current?.id)} team={workspace?.team ?? []} />;
}

function TasksPage({ workspace }: { workspace?: WorkspaceLike }) {
  const params = useParams<{ id?: string }>();
  const [, setLocation] = useLocation();
  const tasksQuery = useListTasks(undefined, { query: { queryKey: getListTasksQueryKey(), staleTime: 30000 } });
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
  const saveTask = (form: { title: string; description: string; assigneeId: string; department: string; priority: Task["priority"]; dueDate: string }) => createTask.mutate({ data: { ...form, dueDate: form.dueDate || null } }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetWorkspaceQueryKey() }); queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() }); setDialog(false); onRefresh?.(); } });
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
  const commentsQuery = useListTaskComments(task.id, { query: { enabled: Boolean(task.id), queryKey: getListTaskCommentsQueryKey(task.id) } });
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

function ActivityPage({ workspace }: { workspace?: WorkspaceLike }) {
  const activityQuery = useListActivity({ query: { queryKey: getListActivityQueryKey(), staleTime: 30000 } });
  const items = activityQuery.data ?? workspace?.activity ?? [];
  const [filter, setFilter] = useState("all");
  const actors = Array.from(new Set(items.map((item) => item.actor.fullName)));
  const shown = filter === "all" ? items : items.filter((item) => item.actor.fullName === filter);
  return <div><PageHeader eyebrow="The room remembers" title="Activity" description="A shared, lightweight record of what changed and who moved it forward." action={<div className="flex items-center gap-2 rounded-xl bg-[#e8f2e9] px-3 py-2 text-xs font-bold text-[#2d7040]"><span className="h-1.5 w-1.5 animate-soft-pulse rounded-full bg-[#4d995f]" />Live feed</div>} /><div className="mb-5 flex flex-wrap gap-2">{["all", ...actors].map((item) => <button key={item} type="button" onClick={() => setFilter(item)} className={`rounded-full px-3 py-2 text-xs font-bold transition ${filter === item ? "bg-[#1b4d2e] text-white" : "border border-[#e0d8cb] bg-[#fffdf9] text-[#6f7d72] hover:border-[#a4bea7]"}`} data-testid={`button-activity-filter-${item.toLowerCase().replaceAll(" ", "-")}`}>{item === "all" ? "Everyone" : item}</button>)}</div><section className="max-w-3xl rounded-2xl border border-[#e5ded2] bg-[#fffdf9] p-5 shadow-[0_1px_2px_rgba(41,50,39,.03)]"><div className="mb-2 flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-[0.15em] text-[#8c978e]">{shown.length} updates</span><button type="button" className="text-xs font-bold text-[#2d7040]" onClick={() => activityQuery.refetch()} data-testid="button-refresh-activity">Refresh</button></div>{activityQuery.isLoading ? <div className="space-y-3">{[1, 2, 3, 4].map((item) => <SkeletonBlock key={item} className="h-14" />)}</div> : <ActivityList items={shown} />}</section></div>;
}

function SettingsPage({ workspace }: { workspace?: WorkspaceLike }) {
  const user = workspace?.currentUser;
  const [notifications, setNotifications] = useState(true);
  const [digest, setDigest] = useState(false);
  return <div><PageHeader eyebrow="Make the room yours" title="Settings" description="Small controls for how WAFFAR shows up in your day." /><div className="grid max-w-4xl gap-6 lg:grid-cols-[1.1fr_.9fr]"><section className="rounded-2xl border border-[#e5ded2] bg-[#fffdf9] p-5 sm:p-6"><SectionHeading title="Your profile" detail="Visible to everyone in the workspace." /><div className="mt-5 flex items-center gap-4"><Avatar profile={user} size="lg" /><div><p className="font-display text-xl font-semibold text-[#263a2a]">{user?.fullName ?? "Your profile"}</p><p className="text-sm text-[#87938a]">{user?.email}</p></div><Button variant="outline" onClick={() => window.alert("Profile editing will be available soon.")} className="ml-auto" testId="button-edit-profile">Edit profile</Button></div><div className="mt-7 grid gap-4 sm:grid-cols-2"><label className="block"><span className="mb-1.5 block text-xs font-bold text-[#526254]">Full name</span><input defaultValue={user?.fullName} className="h-11 w-full rounded-xl border border-[#dcd4c7] bg-[#fbfaf5] px-3.5 text-sm outline-none focus:border-[#4f8b5c]" data-testid="input-settings-name" /></label><label className="block"><span className="mb-1.5 block text-xs font-bold text-[#526254]">Email</span><input defaultValue={user?.email} className="h-11 w-full rounded-xl border border-[#dcd4c7] bg-[#fbfaf5] px-3.5 text-sm outline-none focus:border-[#4f8b5c]" data-testid="input-settings-email" /></label></div></section><section className="rounded-2xl border border-[#e5ded2] bg-[#fffdf9] p-5 sm:p-6"><SectionHeading title="Notifications" detail="Choose what earns your attention." /><div className="mt-5 space-y-5"><div className="flex items-center justify-between gap-4"><div><p className="text-sm font-semibold text-[#3d5140]">Task movement</p><p className="mt-1 text-xs leading-5 text-[#89958b]">When a task is assigned or moved.</p></div><Toggle value={notifications} onChange={setNotifications} label="" id="task-movement" /></div><div className="flex items-center justify-between gap-4"><div><p className="text-sm font-semibold text-[#3d5140]">Weekly digest</p><p className="mt-1 text-xs leading-5 text-[#89958b]">A Friday note on the shape of the week.</p></div><Toggle value={digest} onChange={setDigest} label="" id="weekly-digest" /></div></div></section><section className="rounded-2xl border border-[#e5ded2] bg-[#fffdf9] p-5 sm:p-6 lg:col-span-2"><SectionHeading title="Workspace" detail="The shared defaults for WAFFAR." /><div className="mt-5 grid gap-4 sm:grid-cols-3"><div className="rounded-xl bg-[#f3f6ef] p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-[#8b978d]">Workspace</p><p className="mt-1 font-display text-lg font-semibold text-[#263a2a]">WAFFAR Team</p></div><div className="rounded-xl bg-[#f3f6ef] p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-[#8b978d]">People</p><p className="mt-1 font-display text-lg font-semibold text-[#263a2a]">{workspace?.team.length ?? 0} members</p></div><div className="rounded-xl bg-[#f3f6ef] p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-[#8b978d]">Timezone</p><p className="mt-1 font-display text-lg font-semibold text-[#263a2a]">Local time</p></div></div></section></div></div>;
}
