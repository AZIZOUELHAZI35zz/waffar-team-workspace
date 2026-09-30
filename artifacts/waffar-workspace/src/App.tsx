import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Route, Router as WouterRouter, Switch, useLocation } from "wouter";
import { ArrowRight, Eye, EyeOff, KeyRound, LockKeyhole } from "lucide-react";
import { ErrorBoundary } from "@/components/error-boundary";
import { Button } from "@/components/workspace";
import { WorkspaceRouter } from "@/pages/workspace-pages";
import NotFound from "@/pages/not-found";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

function Router({
  session,
  onLogout,
}: {
  session: Session | null;
  onLogout: () => void;
}) {
  const [location, setLocation] = useLocation();
  const authenticated = Boolean(session);

  useEffect(() => {
    if (!authenticated && location !== "/login") setLocation("/login");
    if (authenticated && location === "/login") setLocation("/");
  }, [authenticated, location, setLocation]);

  if ((!authenticated && location !== "/login") || (authenticated && location === "/login")) return null;

  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/login">{() => <LoginPage />}</Route>
        <Route path="/">{() => <WorkspaceRouter onLogout={onLogout} />}</Route>
        <Route path="/my-tasks">{() => <WorkspaceRouter onLogout={onLogout} />}</Route>
        <Route path="/tasks">{() => <WorkspaceRouter onLogout={onLogout} />}</Route>
        <Route path="/tasks/:id">{() => <WorkspaceRouter onLogout={onLogout} />}</Route>
        <Route path="/team">{() => <WorkspaceRouter onLogout={onLogout} />}</Route>
        <Route path="/time">{() => <WorkspaceRouter onLogout={onLogout} />}</Route>
        <Route path="/activity">{() => <WorkspaceRouter onLogout={onLogout} />}</Route>
        <Route path="/chat">{() => <WorkspaceRouter onLogout={onLogout} />}</Route>
        <Route path="/meetings">{() => <WorkspaceRouter onLogout={onLogout} />}</Route>
        <Route path="/workspace">{() => <WorkspaceRouter onLogout={onLogout} />}</Route>
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
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    // Listen for auth state changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) {
        // Clear all cached queries on logout
        queryClient.clear();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    queryClient.clear();
  };

  // Still loading initial session
  if (session === undefined) return <div className="min-h-[100dvh] bg-[#faf7f2]" />;

  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <Router session={session} onLogout={logout} />
      </WouterRouter>
    </QueryClientProvider>
  );
}

function LoginPage() {
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("Member");
  const [department, setDepartment] = useState("Other");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [forgotSent, setForgotSent] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSuccessMsg(null);

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
        setPending(false);
      } else {
        setLocation("/");
      }
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role,
            department,
          },
        },
      });
      if (error) {
        setError(error.message);
        setPending(false);
      } else if (data.session) {
        // Ensure profile is created if trigger wasn't executed
        try {
          await supabase.from("profiles").upsert({
            id: data.user!.id,
            full_name: fullName || email.split("@")[0],
            email,
            avatar_initials: (fullName || email).slice(0, 2).toUpperCase(),
            role,
            department,
            status: "online",
          });
        } catch {
          // Trigger might have handled it
        }
        setLocation("/");
      } else {
        setSuccessMsg("Account created! Check your email to confirm if verification is enabled.");
        setPending(false);
      }
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError("Enter your email address first, then click Forgot password.");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/`,
    });
    if (error) {
      setError(error.message);
    } else {
      setForgotSent(true);
    }
  };

  return (
    <main className="grain flex min-h-[100dvh] bg-[#faf7f2] text-[#0f1410]">
      <section className="hidden w-[44%] flex-col justify-between bg-[#1b4d2e] p-10 text-[#f8f5ea] lg:flex">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#e8a020] font-display text-xl font-bold text-[#173d24]">W</span>
          <span>
            <span className="block font-display text-xl font-semibold">WAFFAR</span>
            <span className="block text-[9px] font-bold uppercase tracking-[0.18em] text-[#b7d7bf]">team workspace</span>
          </span>
        </div>
        <div className="max-w-md">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#e8a020]">A shared workroom</p>
          <h1 className="mt-5 font-display text-5xl font-semibold leading-[1.04] tracking-[-0.05em]">
            The shape of the work, together.
          </h1>
          <p className="mt-6 max-w-sm text-sm leading-6 text-[#bfdac4]">
            Open the room, see what matters, and leave the work clearer than you found it.
          </p>
          <div className="mt-10 flex items-center gap-3 text-xs text-[#a8cdb1]">
            <span className="h-2 w-2 rounded-full bg-[#e8a020]" /> WAFFAR workspace is ready
          </div>
        </div>
        <p className="text-[11px] text-[#8eb69a]">Private workspace · Built for the WAFFAR team</p>
      </section>

      <section className="flex flex-1 items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-[390px] animate-rise-in">
          <div className="mb-10 lg:hidden">
            <span className="inline-grid h-10 w-10 place-items-center rounded-xl bg-[#1b4d2e] font-display text-xl font-bold text-[#e8a020]">W</span>
            <p className="mt-3 font-display text-xl font-semibold text-[#1b4d2e]">WAFFAR</p>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#b27912]">
              {mode === "signin" ? "Welcome back" : "Join the team"}
            </p>
            <h2 className="mt-2 font-display text-4xl font-semibold tracking-[-0.05em] text-[#1e3323]">
              {mode === "signin" ? "Take your seat." : "Create your account."}
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#78857b]">
              {mode === "signin" ? "Your team is already in the room." : "Set up your workspace profile."}
            </p>
          </div>

          <form onSubmit={submit} className="mt-8 space-y-4">
            {mode === "signup" && (
              <>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold text-[#526254]">Full name</span>
                  <input
                    required
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Aziz El Hazri"
                    className="h-12 w-full rounded-xl border border-[#d9d1c3] bg-[#fffdf9] px-3.5 text-sm outline-none transition focus:border-[#4f8b5c] focus:ring-3 focus:ring-[#d8eddf]"
                    data-testid="input-signup-name"
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-bold text-[#526254]">Role</span>
                    <input
                      type="text"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      placeholder="e.g. CEO, Engineer"
                      className="h-12 w-full rounded-xl border border-[#d9d1c3] bg-[#fffdf9] px-3 text-sm outline-none transition focus:border-[#4f8b5c] focus:ring-3 focus:ring-[#d8eddf]"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-bold text-[#526254]">Department</span>
                    <select
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className="h-12 w-full rounded-xl border border-[#d9d1c3] bg-[#fffdf9] px-2.5 text-xs outline-none transition focus:border-[#4f8b5c] focus:ring-3 focus:ring-[#d8eddf]"
                    >
                      <option value="CEO">CEO</option>
                      <option value="CTO">CTO</option>
                      <option value="CMO">CMO</option>
                      <option value="CFO">CFO</option>
                      <option value="Operations">Operations</option>
                      <option value="Product">Product</option>
                      <option value="Marketing">Marketing</option>
                      <option value="Sales">Sales</option>
                      <option value="Other">Other</option>
                    </select>
                  </label>
                </div>
              </>
            )}

            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-[#526254]">Work email</span>
              <input
                required
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@waffar.co"
                className="h-12 w-full rounded-xl border border-[#d9d1c3] bg-[#fffdf9] px-3.5 text-sm outline-none transition focus:border-[#4f8b5c] focus:ring-3 focus:ring-[#d8eddf]"
                data-testid="input-login-email"
              />
            </label>
            <label className="block">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-xs font-bold text-[#526254]">Password</span>
                {mode === "signin" && (
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-[11px] font-bold text-[#2d7040] hover:underline"
                    data-testid="button-forgot-password"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <LockKeyhole size={16} className="pointer-events-none absolute left-3 top-3.5 text-[#9aa59c]" />
                <input
                  required
                  minLength={6}
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === "signin" ? "Enter your password" : "At least 6 characters"}
                  className="h-12 w-full rounded-xl border border-[#d9d1c3] bg-[#fffdf9] pl-10 pr-11 text-sm outline-none transition focus:border-[#4f8b5c] focus:ring-3 focus:ring-[#d8eddf]"
                  data-testid="input-login-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-2 rounded-lg p-2 text-[#8a958c] hover:bg-[#eef3ec]"
                  data-testid="button-toggle-password"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>

            {error && (
              <p className="rounded-lg bg-[#fae6df] px-3 py-2 text-xs font-semibold text-[#9a513e]" data-testid="status-login-error">
                {error}
              </p>
            )}
            {successMsg && (
              <p className="rounded-lg bg-[#e8f2e9] px-3 py-2 text-xs font-semibold text-[#2d7040]">
                {successMsg}
              </p>
            )}
            {forgotSent && (
              <p className="rounded-lg bg-[#e8f2e9] px-3 py-2 text-xs font-semibold text-[#2d7040]" data-testid="status-forgot-password">
                If that email is in WAFFAR, a reset link is on its way.
              </p>
            )}

            <Button type="submit" className="h-12 w-full" disabled={pending} testId="button-login-submit">
              {pending
                ? mode === "signin"
                  ? "Opening workspace..."
                  : "Creating account..."
                : mode === "signin"
                ? "Open workspace"
                : "Create account"}
              {!pending && <ArrowRight size={16} />}
            </Button>
          </form>

          <p className="mt-4 text-center text-xs text-[#78857b]">
            {mode === "signin" ? (
              <>
                Need an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("signup");
                    setError(null);
                    setSuccessMsg(null);
                  }}
                  className="font-bold text-[#2d7040] hover:underline"
                >
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("signin");
                    setError(null);
                    setSuccessMsg(null);
                  }}
                  className="font-bold text-[#2d7040] hover:underline"
                >
                  Sign in
                </button>
              </>
            )}
          </p>

          <div className="mt-8 flex items-center gap-3 text-[11px] text-[#98a198]">
            <span className="h-px flex-1 bg-[#e4ddd1]" />
            <span className="inline-flex items-center gap-1.5">
              <KeyRound size={12} /> Private to WAFFAR
            </span>
            <span className="h-px flex-1 bg-[#e4ddd1]" />
          </div>
        </div>
      </section>
    </main>
  );
}

export default App;
