import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Route, Router as WouterRouter, Switch, useLocation } from "wouter";
import { ArrowRight, Eye, EyeOff, KeyRound, LockKeyhole } from "lucide-react";
import { ErrorBoundary } from "@/components/error-boundary";
import { Button } from "@/components/workspace";
import { WorkspaceRouter } from "@/pages/workspace-pages";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } });

const SESSION_KEY = "waffar-workspace-session";

function Router({ authenticated, onLogin, onLogout }: { authenticated: boolean; onLogin: () => void; onLogout: () => void }) {
  const [location, setLocation] = useLocation();
  useEffect(() => {
    if (!authenticated && location !== "/login") setLocation("/login");
    if (authenticated && location === "/login") setLocation("/");
  }, [authenticated, location, setLocation]);
  if ((!authenticated && location !== "/login") || (authenticated && location === "/login")) return null;
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/login">{() => <LoginPage onLogin={onLogin} />}</Route>
        <Route path="/">{() => <WorkspaceRouter onLogout={onLogout} />}</Route>
        <Route path="/my-tasks">{() => <WorkspaceRouter onLogout={onLogout} />}</Route>
        <Route path="/tasks">{() => <WorkspaceRouter onLogout={onLogout} />}</Route>
        <Route path="/tasks/:id">{() => <WorkspaceRouter onLogout={onLogout} />}</Route>
        <Route path="/team">{() => <WorkspaceRouter onLogout={onLogout} />}</Route>
        <Route path="/time">{() => <WorkspaceRouter onLogout={onLogout} />}</Route>
        <Route path="/activity">{() => <WorkspaceRouter onLogout={onLogout} />}</Route>
        <Route path="/settings">{() => <WorkspaceRouter onLogout={onLogout} />}</Route>
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  useEffect(() => {
    setAuthenticated(window.localStorage.getItem(SESSION_KEY) === "active");
  }, []);
  const login = () => {
    window.localStorage.setItem(SESSION_KEY, "active");
    setAuthenticated(true);
  };
  const logout = () => {
    window.localStorage.removeItem(SESSION_KEY);
    setAuthenticated(false);
  };
  if (authenticated === null) return <div className="min-h-[100dvh] bg-[#faf7f2]" />;
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router authenticated={authenticated} onLogin={login} onLogout={logout} /></WouterRouter>
    </QueryClientProvider>
  );
}

function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [, setLocation] = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    window.setTimeout(() => { onLogin(); setPending(false); setLocation("/"); }, 450);
  };
  return <main className="grain flex min-h-[100dvh] bg-[#faf7f2] text-[#0f1410]"><section className="hidden w-[44%] flex-col justify-between bg-[#1b4d2e] p-10 text-[#f8f5ea] lg:flex"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#e8a020] font-display text-xl font-bold text-[#173d24]">W</span><span><span className="block font-display text-xl font-semibold">WAFFAR</span><span className="block text-[9px] font-bold uppercase tracking-[0.18em] text-[#b7d7bf]">team workspace</span></span></div><div className="max-w-md"><p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#e8a020]">A shared workroom</p><h1 className="mt-5 font-display text-5xl font-semibold leading-[1.04] tracking-[-0.05em]">The shape of the work, together.</h1><p className="mt-6 max-w-sm text-sm leading-6 text-[#bfdac4]">Open the room, see what matters, and leave the work clearer than you found it.</p><div className="mt-10 flex items-center gap-3 text-xs text-[#a8cdb1]"><span className="h-2 w-2 rounded-full bg-[#e8a020]" /> WAFFAR workspace is ready</div></div><p className="text-[11px] text-[#8eb69a]">Private workspace · Built for the WAFFAR team</p></section><section className="flex flex-1 items-center justify-center px-5 py-10 sm:px-10"><div className="w-full max-w-[390px] animate-rise-in"><div className="mb-10 lg:hidden"><span className="inline-grid h-10 w-10 place-items-center rounded-xl bg-[#1b4d2e] font-display text-xl font-bold text-[#e8a020]">W</span><p className="mt-3 font-display text-xl font-semibold text-[#1b4d2e]">WAFFAR</p></div><div><p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#b27912]">Welcome back</p><h2 className="mt-2 font-display text-4xl font-semibold tracking-[-0.05em] text-[#1e3323]">Take your seat.</h2><p className="mt-3 text-sm leading-6 text-[#78857b]">Your team is already in the room.</p></div><form onSubmit={submit} className="mt-8 space-y-4"><label className="block"><span className="mb-1.5 block text-xs font-bold text-[#526254]">Work email</span><input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@waffar.co" className="h-12 w-full rounded-xl border border-[#d9d1c3] bg-[#fffdf9] px-3.5 text-sm outline-none transition focus:border-[#4f8b5c] focus:ring-3 focus:ring-[#d8eddf]" data-testid="input-login-email" /></label><label className="block"><div className="mb-1.5 flex items-center justify-between"><span className="text-xs font-bold text-[#526254]">Password</span><button type="button" onClick={() => setForgotSent(true)} className="text-[11px] font-bold text-[#2d7040] hover:underline" data-testid="button-forgot-password">Forgot password?</button></div><div className="relative"><LockKeyhole size={16} className="pointer-events-none absolute left-3 top-3.5 text-[#9aa59c]" /><input required minLength={4} autoComplete="current-password" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" className="h-12 w-full rounded-xl border border-[#d9d1c3] bg-[#fffdf9] pl-10 pr-11 text-sm outline-none transition focus:border-[#4f8b5c] focus:ring-3 focus:ring-[#d8eddf]" data-testid="input-login-password" /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-2 rounded-lg p-2 text-[#8a958c] hover:bg-[#eef3ec]" data-testid="button-toggle-password">{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label>{forgotSent && <p className="rounded-lg bg-[#e8f2e9] px-3 py-2 text-xs font-semibold text-[#2d7040]" data-testid="status-forgot-password">If that email is in WAFFAR, a reset link is on its way.</p>}<Button type="submit" className="h-12 w-full" disabled={pending} testId="button-login-submit">{pending ? "Opening workspace..." : "Open workspace"}{!pending && <ArrowRight size={16} />}</Button></form><div className="mt-8 flex items-center gap-3 text-[11px] text-[#98a198]"><span className="h-px flex-1 bg-[#e4ddd1]" /><span className="inline-flex items-center gap-1.5"><KeyRound size={12} /> Private to WAFFAR</span><span className="h-px flex-1 bg-[#e4ddd1]" /></div></div></section></main>;
}

export default App;
