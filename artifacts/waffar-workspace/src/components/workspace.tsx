import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Activity as ActivityIcon,
  ArrowRight,
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  CircleDot,
  Clock3,
  Command,
  Filter,
  LayoutDashboard,
  ListTodo,
  Menu,
  MessageCircle,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Search,
  Settings,
  Sparkles,
  Timer,
  Users,
  Video,
  X,
} from "lucide-react";
import type { Activity, Profile, Task } from "@workspace/api-client-react";

export function initials(name: string) {
  return name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

export function formatDuration(seconds = 0) {
  const safe = Math.max(0, seconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  return hours ? `${hours}h ${String(minutes).padStart(2, "0")}m` : `${minutes}m`;
}

export function relativeTime(dateValue?: string | null) {
  if (!dateValue) return "recently";
  const diff = Math.max(0, Date.now() - new Date(dateValue).getTime());
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function formatDate(dateValue?: string | null) {
  if (!dateValue) return "No date";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(dateValue));
}

export function formatLongDate(dateValue = new Date()) {
  return new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric" }).format(dateValue);
}

export function Avatar({ profile, size = "md", className = "" }: { profile?: Partial<Profile> | null; size?: "sm" | "md" | "lg"; className?: string }) {
  const sizeClass = size === "lg" ? "h-11 w-11 text-sm" : size === "sm" ? "h-7 w-7 text-[10px]" : "h-8 w-8 text-[11px]";
  const name = profile?.fullName ?? "Team member";
  return profile?.avatarUrl ? (
    <img data-testid={`img-avatar-${profile.id ?? "member"}`} src={profile.avatarUrl} alt={name} className={`${sizeClass} rounded-full object-cover ring-2 ring-background ${className}`} />
  ) : (
    <span data-testid={`avatar-${profile?.id ?? "member"}`} title={name} className={`${sizeClass} inline-flex shrink-0 items-center justify-center rounded-full bg-[#d8eddf] font-semibold text-[#1b4d2e] ring-2 ring-background ${className}`}>
      {profile?.avatarInitials || initials(name)}
    </span>
  );
}

export function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <header className="mb-7 flex flex-col gap-4 md:flex-row md:items-end md:justify-between animate-rise-in">
      <div>
        {eyebrow && <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#b27912]" data-testid="text-page-eyebrow">{eyebrow}</p>}
        <h1 className="font-display text-3xl font-semibold tracking-[-0.03em] text-[#0f1410] sm:text-[38px]" data-testid="text-page-title">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm leading-6 text-[#68736a]" data-testid="text-page-description">{description}</p>}
      </div>
      {action}
    </header>
  );
}

const nav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/my-tasks", label: "My tasks", icon: ListTodo },
  { href: "/tasks", label: "All tasks", icon: CircleDot },
  { href: "/team", label: "Team", icon: Users },
  { href: "/time", label: "Time", icon: Timer },
  { href: "/activity", label: "Activity", icon: ActivityIcon },
];

const navCollaborate = [
  { href: "/chat", label: "Chat", icon: MessageCircle },
  { href: "/meetings", label: "Meetings", icon: Video },
  { href: "/workspace", label: "Workspace", icon: Settings },
];

export function AppShell({ children, currentUser, myTaskCount = 0, onCreateTask, onLogout }: { children: React.ReactNode; currentUser?: Profile | null; myTaskCount?: number; onCreateTask?: () => void; onLogout?: () => void }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const user = currentUser ?? { fullName: "Loading workspace", avatarInitials: "W", role: "Team member" };

  return (
    <div className="grain min-h-[100dvh] bg-[#faf7f2] text-[#0f1410]">
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[258px] flex-col bg-[#1b4d2e] px-4 py-5 text-[#f7f4ea] transition-transform duration-300 lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between px-3">
          <Link href="/" className="flex items-center gap-3" data-testid="link-brand">
            <span className="grid h-9 w-9 place-items-center rounded-[11px] bg-[#e8a020] font-display text-lg font-bold text-[#173d24]">W</span>
            <span>
              <span className="block font-display text-lg font-semibold tracking-[-0.04em]">WAFFAR</span>
              <span className="block text-[9px] font-bold uppercase tracking-[0.18em] text-[#b7d7bf]">team workspace</span>
            </span>
          </Link>
          <button type="button" onClick={() => setMobileOpen(false)} className="rounded-lg p-2 text-[#b7d7bf] hover:bg-[#2e6040] lg:hidden" data-testid="button-close-menu"><X size={17} /></button>
        </div>

        <div className="mt-10 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[#91ba9c]">Workroom</div>
        <nav className="mt-3 space-y-1" aria-label="Primary navigation">
          {nav.map((item) => {
            const active = item.href === "/" ? location === "/" : location.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} className={`group flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium transition-colors ${active ? "bg-[#2d6540] text-[#fff8e8] shadow-[inset_3px_0_0_#e8a020]" : "text-[#c2ddc8] hover:bg-[#285a39] hover:text-white"}`} data-testid={`link-nav-${item.label.toLowerCase().replaceAll(" ", "-")}`}>
                <Icon size={17} strokeWidth={active ? 2.2 : 1.8} />
                <span>{item.label}</span>
                {item.label === "My tasks" && myTaskCount > 0 && <span className="ml-auto rounded-full bg-[#e8a020] px-1.5 py-0.5 text-[10px] font-bold text-[#173d24]">{myTaskCount}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="mt-6 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[#91ba9c]">Collaborate</div>
        <nav className="mt-3 space-y-1" aria-label="Collaborate navigation">
          {navCollaborate.map((item) => {
            const active = location.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} className={`group flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium transition-colors ${active ? "bg-[#2d6540] text-[#fff8e8] shadow-[inset_3px_0_0_#e8a020]" : "text-[#c2ddc8] hover:bg-[#285a39] hover:text-white"}`} data-testid={`link-nav-${item.label.toLowerCase()}`}>
                <Icon size={17} strokeWidth={active ? 2.2 : 1.8} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-9 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[#91ba9c]">Shortcuts</div>
        <div className="mt-3 space-y-1">
          <button type="button" onClick={onCreateTask} className="flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left text-sm font-medium text-[#c2ddc8] transition-colors hover:bg-[#285a39] hover:text-white" data-testid="button-sidebar-create-task"><Plus size={17} /><span>New task</span><span className="ml-auto text-[10px] text-[#91ba9c]">N</span></button>
          <button type="button" onClick={() => setCommandOpen(true)} className="flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left text-sm font-medium text-[#c2ddc8] transition-colors hover:bg-[#285a39] hover:text-white" data-testid="button-sidebar-search"><Search size={17} /><span>Search</span><span className="ml-auto text-[10px] text-[#91ba9c]">⌘ K</span></button>
        </div>

        <div className="mt-auto rounded-2xl border border-[#397049] bg-[#164326] p-3">
          <div className="flex items-center gap-3">
            <Avatar profile={user} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold" data-testid="text-sidebar-user">{user.fullName}</p>
              <p className="truncate text-[11px] text-[#a8cdb1]">{user.role}</p>
            </div>
            <span className="ml-auto h-2 w-2 rounded-full bg-[#e8a020]" title="Available" />
          </div>
           <Link href="/settings" className="mt-3 flex items-center gap-2 border-t border-[#2e6040] pt-3 text-xs text-[#b7d7bf] hover:text-white" data-testid="link-sidebar-settings"><Settings size={14} /> Workspace settings</Link>
           <button type="button" onClick={onLogout} className="mt-2 flex w-full items-center gap-2 text-left text-xs text-[#b7d7bf] hover:text-white" data-testid="button-sidebar-logout"><ArrowRight size={14} className="rotate-180" /> Log out</button>
        </div>
      </aside>

      {mobileOpen && <button type="button" className="fixed inset-0 z-30 bg-[#0f1410]/30 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close navigation" data-testid="button-overlay-close" />}

      <main className="min-h-[100dvh] lg:pl-[258px]">
        <div className="sticky top-0 z-20 flex h-[68px] items-center justify-between border-b border-[#e8e1d5] bg-[#faf7f2]/90 px-5 backdrop-blur-md sm:px-8 lg:px-10">
          <button type="button" onClick={() => setMobileOpen(true)} className="rounded-lg p-2 text-[#1b4d2e] hover:bg-[#e9f2e8] lg:hidden" data-testid="button-open-menu"><Menu size={21} /></button>
          <div className="hidden items-center gap-2 text-xs text-[#829087] lg:flex"><span className="h-1.5 w-1.5 rounded-full bg-[#4d995f]" /> {formatLongDate()} <span className="text-[#c6bfae]">/</span> <span className="font-semibold text-[#49614f]">Good morning, {user.fullName?.split(" ")[0] || "team"}</span></div>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <button type="button" onClick={() => setCommandOpen(true)} className="hidden h-9 items-center gap-2 rounded-lg border border-[#ded7ca] bg-[#fffdf9] px-3 text-xs text-[#8b968d] shadow-sm transition hover:border-[#b7cdb9] sm:flex" data-testid="button-header-search"><Search size={14} /><span>Search anything</span><kbd className="ml-3 rounded border border-[#e2dbcf] px-1.5 py-0.5 font-mono text-[9px]">⌘K</kbd></button>
            <button type="button" className="relative rounded-lg p-2 text-[#627167] hover:bg-[#e9f2e8]" data-testid="button-notifications"><Bell size={18} /><span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#e8a020]" /></button>
            <Link href="/settings" className="lg:hidden" data-testid="link-mobile-settings"><Avatar profile={user} size="sm" /></Link>
          </div>
        </div>
        <div className="workspace-grid min-h-[calc(100dvh-68px)] px-5 py-7 sm:px-8 lg:px-10 lg:py-9">
          <div className="mx-auto max-w-[1440px]">{children}</div>
        </div>
      </main>

      {commandOpen && <CommandPalette onClose={() => setCommandOpen(false)} />}
    </div>
  );
}

function CommandPalette({ onClose }: { onClose: () => void }) {
  const [, setLocation] = useLocation();
  const [query, setQuery] = useState("");
  const commands = [
    { label: "Go to workspace", href: "/", icon: LayoutDashboard },
    { label: "Open my tasks", href: "/my-tasks", icon: ListTodo },
    { label: "Browse all tasks", href: "/tasks", icon: CircleDot },
    { label: "View team", href: "/team", icon: Users },
    { label: "Open time tracking", href: "/time", icon: Timer },
  ];
  const filtered = commands.filter((item) => item.label.toLowerCase().includes(query.toLowerCase()));
  return (
    <div className="fixed inset-0 z-50 grid place-items-start bg-[#0f1410]/30 px-4 pt-[13vh] backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-[#ddd4c5] bg-[#fffdf9] shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-[#ece5d9] px-4">
          <Command size={18} className="text-[#8c978e]" />
          <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Jump to a page..." className="h-14 flex-1 bg-transparent text-sm outline-none placeholder:text-[#a2aba3]" data-testid="input-command-search" />
          <button type="button" onClick={onClose} className="rounded-md border border-[#e2dbcf] px-1.5 py-0.5 text-[10px] text-[#89948b]" data-testid="button-close-command">esc</button>
        </div>
        <div className="p-2">
          {filtered.map((item) => {
            const Icon = item.icon;
            return <button type="button" key={item.href} onClick={() => { setLocation(item.href); onClose(); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-[#34473a] hover:bg-[#edf4eb]" data-testid={`button-command-${item.href.replace("/", "") || "workspace"}`}><Icon size={16} className="text-[#1b4d2e]" /><span>{item.label}</span><ArrowRight size={14} className="ml-auto text-[#adb7ae]" /></button>;
          })}
          {!filtered.length && <p className="px-3 py-6 text-center text-sm text-[#87938a]">No pages match that search.</p>}
        </div>
      </div>
    </div>
  );
}

export function Button({ children, variant = "primary", onClick, type = "button", className = "", disabled = false, testId }: { children: React.ReactNode; variant?: "primary" | "quiet" | "outline" | "danger"; onClick?: () => void; type?: "button" | "submit"; className?: string; disabled?: boolean; testId?: string }) {
  const variants = {
    primary: "bg-[#1b4d2e] text-white shadow-[0_4px_10px_rgba(27,77,46,.14)] hover:bg-[#28633c]",
    quiet: "bg-[#e8f2e9] text-[#1b4d2e] hover:bg-[#d8eddf]",
    outline: "border border-[#d9d1c3] bg-[#fffdf9] text-[#405449] hover:border-[#9eb8a3] hover:bg-[#f4f8f2]",
    danger: "bg-[#fff0ee] text-[#a23931] hover:bg-[#ffe4e0]",
  };
  return <button type={type} onClick={onClick} disabled={disabled} className={`inline-flex items-center justify-center gap-2 rounded-[9px] px-3.5 py-2.5 text-xs font-bold transition-all duration-200 hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 ${variants[variant]} ${className}`} data-testid={testId}>{children}</button>;
}

export function StatTile({ label, value, detail, icon: Icon, accent = "green" }: { label: string; value: string | number; detail: string; icon: typeof Clock3; accent?: "green" | "gold" | "ink" | "coral" }) {
  const colors = { green: "bg-[#e5f1e7] text-[#1b4d2e]", gold: "bg-[#fff0cf] text-[#9b6810]", ink: "bg-[#e8e7df] text-[#4d5147]", coral: "bg-[#fae6df] text-[#984e3d]" };
  return <div className="group rounded-2xl border border-[#e6dfd2] bg-[#fffdf9] p-4 shadow-[0_1px_2px_rgba(41,50,39,.03)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[#c4d7c6] hover:shadow-[0_8px_22px_rgba(41,50,39,.07)]" data-testid={`stat-${label.toLowerCase().replaceAll(" ", "-")}`}>
    <div className="flex items-start justify-between"><span className={`grid h-9 w-9 place-items-center rounded-xl ${colors[accent]}`}><Icon size={17} /></span><MoreHorizontal size={16} className="text-[#b6beb5]" /></div>
    <div className="mt-4"><p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#89958b]">{label}</p><p className="mt-1 font-display text-3xl font-semibold tracking-[-0.04em] text-[#1a2c1d]" data-testid={`value-${label.toLowerCase().replaceAll(" ", "-")}`}>{value}</p><p className="mt-1 text-xs text-[#7c897f]">{detail}</p></div>
  </div>;
}

export function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-soft-pulse rounded-xl bg-[#e9e5db] ${className}`} aria-label="Loading" data-testid="loading-skeleton" />;
}

export function EmptyState({ icon: Icon = Sparkles, title, description, action }: { icon?: typeof Sparkles; title: string; description: string; action?: React.ReactNode }) {
  return <div className="flex min-h-[230px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#d8d0c2] bg-[#fffdf9]/70 p-8 text-center" data-testid="empty-state"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#e8f2e9] text-[#1b4d2e]"><Icon size={21} /></span><h3 className="mt-4 font-display text-lg font-semibold text-[#253929]">{title}</h3><p className="mt-1 max-w-xs text-sm leading-5 text-[#7c897f]">{description}</p>{action && <div className="mt-5">{action}</div>}</div>;
}

export function StatusPill({ status }: { status: Task["status"] }) {
  const map = {
    todo: { label: "To do", cls: "bg-[#eef0eb] text-[#607064]" },
    in_progress: { label: "In progress", cls: "bg-[#e4f0e6] text-[#287043]" },
    blocked: { label: "Blocked", cls: "bg-[#fae7df] text-[#9a513e]" },
    done: { label: "Done", cls: "bg-[#e8e5f3] text-[#65588b]" },
  };
  const item = map[status];
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-bold ${item.cls}`} data-testid={`status-${status}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{item.label}</span>;
}

export function PriorityPill({ priority }: { priority: Task["priority"] }) {
  const map = { low: "text-[#7a887d]", medium: "text-[#9b6810]", high: "text-[#bb6b2b]", urgent: "text-[#a23931]" };
  return <span className={`text-[10px] font-bold uppercase tracking-[0.1em] ${map[priority]}`} data-testid={`priority-${priority}`}>{priority}</span>;
}

export function TaskRow({ task, onOpen, onTimer, compact = false }: { task: Task; onOpen?: (task: Task) => void; onTimer?: (task: Task) => void; compact?: boolean }) {
  const running = Boolean(task.activeSession);
  return <div className={`group flex items-center gap-3 border-b border-[#eee8dd] px-4 py-3.5 last:border-b-0 hover:bg-[#fbfaf5] ${compact ? "sm:px-3" : ""}`} data-testid={`row-task-${task.id}`}>
    <button type="button" onClick={() => onOpen?.(task)} className="min-w-0 flex-1 text-left" data-testid={`button-open-task-${task.id}`}>
      <div className="flex min-w-0 items-center gap-2.5"><span className={`h-2 w-2 shrink-0 rounded-full ${task.priority === "urgent" ? "bg-[#c85043]" : task.priority === "high" ? "bg-[#dc892c]" : task.priority === "medium" ? "bg-[#e8a020]" : "bg-[#9fb1a2]"}`} /><p className="truncate text-sm font-semibold text-[#263a2a] group-hover:text-[#1b4d2e]">{task.title}</p></div>
      <div className="mt-1.5 flex items-center gap-3 pl-[18px] text-[11px] text-[#87938a]"><StatusPill status={task.status} /><span className="hidden sm:inline">{task.department}</span>{task.dueDate && <span className="inline-flex items-center gap-1"><CalendarDays size={11} />{formatDate(task.dueDate)}</span>}</div>
    </button>
    <div className="hidden items-center gap-2 sm:flex"><Avatar profile={task.assignee} size="sm" /><PriorityPill priority={task.priority} /></div>
    {onTimer && <button type="button" onClick={() => onTimer(task)} className={`grid h-8 w-8 place-items-center rounded-lg transition ${running ? "bg-[#fff0cf] text-[#9b6810]" : "text-[#97a198] hover:bg-[#e8f2e9] hover:text-[#1b4d2e]"}`} title={running ? "Stop timer" : "Start timer"} data-testid={`button-timer-task-${task.id}`}>{running ? <Pause size={14} /> : <Play size={14} fill="currentColor" />}</button>}
  </div>;
}

export function ActivityList({ items, limit }: { items: Activity[]; limit?: number }) {
  const shown = limit ? items.slice(0, limit) : items;
  if (!shown.length) return <EmptyState icon={ActivityIcon} title="A quiet workroom" description="New team movement will appear here as work gets picked up." />;
  return <div className="divide-y divide-[#eee8dd]" data-testid="activity-list">{shown.map((item) => <div key={item.id} className="flex gap-3 px-1 py-3.5" data-testid={`activity-item-${item.id}`}><Avatar profile={item.actor} size="sm" /><div className="min-w-0 flex-1"><p className="text-sm leading-5 text-[#4f5e51]"><span className="font-semibold text-[#243b29]">{item.actor.fullName}</span>{" "}{item.message}</p><p className="mt-1 text-[11px] text-[#9aa39b]">{relativeTime(item.createdAt)}{item.action && <span className="ml-2 rounded-full bg-[#f0ece4] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-[#8b948c]">{item.action}</span>}</p></div></div>)}</div>;
}

type TaskForm = { title: string; description: string; assigneeId: string; department: string; priority: Task["priority"]; dueDate: string };
export function TaskDialog({ open, onClose, onSubmit, team, initialTask, pending = false }: { open: boolean; onClose: () => void; onSubmit: (form: TaskForm) => void; team: Profile[]; initialTask?: Task | null; pending?: boolean }) {
  const [form, setForm] = useState<TaskForm>(() => ({ title: initialTask?.title ?? "", description: initialTask?.description ?? "", assigneeId: initialTask?.assignee.id ?? team[0]?.id ?? "", department: initialTask?.department ?? team[0]?.department ?? "Product", priority: initialTask?.priority ?? "medium", dueDate: initialTask?.dueDate?.slice(0, 10) ?? "" }));
  useEffect(() => {
    if (open) setForm({ title: initialTask?.title ?? "", description: initialTask?.description ?? "", assigneeId: initialTask?.assignee.id ?? team[0]?.id ?? "", department: initialTask?.department ?? team[0]?.department ?? "Product", priority: initialTask?.priority ?? "medium", dueDate: initialTask?.dueDate?.slice(0, 10) ?? "" });
  }, [open, initialTask, team]);
  if (!open) return null;
  const update = (key: keyof TaskForm, value: string) => setForm((prev) => ({ ...prev, [key]: value }));
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#0f1410]/35 backdrop-blur-sm sm:items-center sm:p-5" onClick={onClose}>
    <div className="max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-3xl border border-[#dfd7c8] bg-[#fffdf9] p-5 shadow-2xl sm:rounded-3xl sm:p-7" onClick={(event) => event.stopPropagation()} data-testid="dialog-task">
      <div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#b27912]">{initialTask ? "Edit task" : "New task"}</p><h2 className="mt-1 font-display text-2xl font-semibold text-[#213725]">{initialTask ? "Shape the next move" : "Add something worth moving"}</h2></div><button type="button" onClick={onClose} className="rounded-lg p-2 text-[#869287] hover:bg-[#eef3ec]" data-testid="button-close-task-dialog"><X size={18} /></button></div>
      <form className="mt-6 space-y-4" onSubmit={(event) => { event.preventDefault(); if (form.title.trim()) onSubmit(form); }}>
        <label className="block"><span className="mb-1.5 block text-xs font-bold text-[#526254]">Task title</span><input autoFocus required value={form.title} onChange={(event) => update("title", event.target.value)} placeholder="e.g. Review launch checklist" className="h-11 w-full rounded-xl border border-[#dcd4c7] bg-[#fbfaf5] px-3.5 text-sm outline-none transition focus:border-[#4f8b5c] focus:ring-3 focus:ring-[#d8eddf]" data-testid="input-task-title" /></label>
        <label className="block"><span className="mb-1.5 block text-xs font-bold text-[#526254]">A little context</span><textarea value={form.description} onChange={(event) => update("description", event.target.value)} placeholder="What does done look like?" rows={3} className="w-full resize-none rounded-xl border border-[#dcd4c7] bg-[#fbfaf5] px-3.5 py-3 text-sm outline-none transition focus:border-[#4f8b5c] focus:ring-3 focus:ring-[#d8eddf]" data-testid="input-task-description" /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block"><span className="mb-1.5 block text-xs font-bold text-[#526254]">Owner</span><select value={form.assigneeId} onChange={(event) => update("assigneeId", event.target.value)} className="h-11 w-full rounded-xl border border-[#dcd4c7] bg-[#fbfaf5] px-3 text-sm outline-none focus:border-[#4f8b5c]" data-testid="select-task-assignee">{team.map((person) => <option key={person.id} value={person.id}>{person.fullName}</option>)}</select></label>
          <label className="block"><span className="mb-1.5 block text-xs font-bold text-[#526254]">Department</span><select value={form.department} onChange={(event) => update("department", event.target.value)} className="h-11 w-full rounded-xl border border-[#dcd4c7] bg-[#fbfaf5] px-3 text-sm outline-none focus:border-[#4f8b5c]" data-testid="select-task-department">{["Product", "Design", "Engineering", "Operations", "Growth"].map((department) => <option key={department} value={department}>{department}</option>)}</select></label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block"><span className="mb-1.5 block text-xs font-bold text-[#526254]">Priority</span><select value={form.priority} onChange={(event) => update("priority", event.target.value)} className="h-11 w-full rounded-xl border border-[#dcd4c7] bg-[#fbfaf5] px-3 text-sm outline-none focus:border-[#4f8b5c]" data-testid="select-task-priority">{["low", "medium", "high", "urgent"].map((priority) => <option key={priority} value={priority}>{priority[0].toUpperCase() + priority.slice(1)}</option>)}</select></label>
          <label className="block"><span className="mb-1.5 block text-xs font-bold text-[#526254]">Due date <span className="font-normal text-[#9ca69c]">(optional)</span></span><input type="date" value={form.dueDate} onChange={(event) => update("dueDate", event.target.value)} className="h-11 w-full rounded-xl border border-[#dcd4c7] bg-[#fbfaf5] px-3 text-sm outline-none focus:border-[#4f8b5c]" data-testid="input-task-due-date" /></label>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-[#eee8dd] pt-5"><Button variant="outline" onClick={onClose} testId="button-cancel-task">Cancel</Button><Button type="submit" disabled={pending} testId="button-submit-task">{pending ? "Saving..." : initialTask ? "Save changes" : "Create task"}</Button></div>
      </form>
    </div>
  </div>;
}

export function SectionHeading({ title, detail, action }: { title: string; detail?: string; action?: React.ReactNode }) {
  return <div className="mb-3 flex items-center justify-between"><div><h2 className="font-display text-lg font-semibold tracking-[-0.02em] text-[#263a2a]" data-testid={`heading-${title.toLowerCase().replaceAll(" ", "-")}`}>{title}</h2>{detail && <p className="mt-0.5 text-xs text-[#8b978d]">{detail}</p>}</div>{action}</div>;
}

export function FilterBar({ query, onQuery, status, onStatus, placeholder = "Filter tasks..." }: { query: string; onQuery: (value: string) => void; status: string; onStatus: (value: string) => void; placeholder?: string }) {
  return <div className="flex flex-col gap-2.5 rounded-2xl border border-[#e5ded2] bg-[#fffdf9] p-2.5 sm:flex-row"><div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl bg-[#f7f5ef] px-3 text-[#8f9b91]"><Search size={15} /><input value={query} onChange={(event) => onQuery(event.target.value)} placeholder={placeholder} className="min-w-0 flex-1 bg-transparent text-sm text-[#34473a] outline-none placeholder:text-[#9ba49d]" data-testid="input-filter-tasks" /></div><div className="flex gap-2"><div className="relative flex-1 sm:flex-none"><Filter size={14} className="pointer-events-none absolute left-3 top-3 text-[#829087]" /><select value={status} onChange={(event) => onStatus(event.target.value)} className="h-10 w-full appearance-none rounded-xl border border-[#e5ded2] bg-[#fffdf9] pl-9 pr-8 text-xs font-semibold text-[#506054] outline-none sm:w-36" data-testid="select-filter-status"><option value="all">All statuses</option><option value="todo">To do</option><option value="in_progress">In progress</option><option value="blocked">Blocked</option><option value="done">Done</option></select><ChevronDown size={13} className="pointer-events-none absolute right-3 top-3.5 text-[#829087]" /></div></div></div>;
}

export function TeamStrip({ team }: { team: Profile[] }) {
  const working = useMemo(() => team.filter((person) => person.status === "working"), [team]);
  return <div className="flex items-center"><div className="flex -space-x-2">{team.slice(0, 6).map((person) => <Avatar key={person.id} profile={person} size="sm" className="transition-transform hover:z-10 hover:-translate-y-1" />)}</div><span className="ml-3 text-xs text-[#7d8a80]"><span className="font-semibold text-[#395540]">{working.length} working now</span> · {team.length} {team.length === 1 ? "person" : "people"}</span></div>;
}

export function Toggle({ value, onChange, label, id }: { value: boolean; onChange: (value: boolean) => void; label: string; id?: string }) {
  return <button type="button" onClick={() => onChange(!value)} className="flex items-center gap-3 text-sm text-[#4c5e50]" data-testid={`toggle-${(id || label || "preference").toLowerCase().replaceAll(" ", "-")}`}><span className={`relative h-6 w-10 rounded-full p-1 transition-colors ${value ? "bg-[#1b4d2e]" : "bg-[#d9ded8]"}`}><span className={`block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${value ? "translate-x-4" : "translate-x-0"}`} /></span>{label}</button>;
}