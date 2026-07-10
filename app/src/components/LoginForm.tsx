import { useState, useEffect, useRef } from 'react';
import { Lock, Mail, User, Loader2, ShieldCheck, ArrowLeft } from 'lucide-react';

interface LoginFormProps {
  agent: any;
}

type Mode = 'login' | 'register';
type RegisterStep = 'email' | 'otp' | 'details';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60; // client-side cooldown before "Resend" becomes clickable
// (independent of the backend's 15-min/3-resend limit — this is just to
// stop someone mashing the button; the backend enforces the real limit
// and surfaces its own error message if that's hit)

export function LoginForm({ agent }: LoginFormProps) {
  const [mode, setMode] = useState<Mode>('login');
  const [step, setStep] = useState<RegisterStep>('email');

  // Login fields
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Register fields
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Countdown timer for resend
  const [cooldown, setCooldown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (cooldown <= 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      setCooldown((c) => (c <= 1 ? 0 : c - 1));
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [cooldown]);

  const switchMode = (next: Mode) => {
    setMode(next);
    setStep('email');
    setOtp('');
    setVerificationToken('');
    setSuccessMessage(null);
    setCooldown(0);
  };

  // -- Step 1: email -> send OTP -------------------------------------------

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage(null);
    const result = await agent.sendOtp(email);
    if (result) {
      setSuccessMessage('Verification code sent — check your email.');
      setStep('otp');
      setCooldown(RESEND_COOLDOWN_SECONDS);
    }
  };

  const handleResendOtp = async () => {
    if (cooldown > 0) return;
    setSuccessMessage(null);
    const result = await agent.sendOtp(email);
    if (result) {
      setSuccessMessage('New code sent — check your email.');
      setOtp('');
      setCooldown(RESEND_COOLDOWN_SECONDS);
    }
  };

  // -- Step 2: OTP -> verify -------------------------------------------------

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage(null);
    const token = await agent.verifyOtp(email, otp);
    if (token) {
      setVerificationToken(token);
      setSuccessMessage('Email verified.');
      setStep('details');
    }
  };

  // -- Step 3: username/password -> complete registration ---------------------

  const handleCompleteRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    await agent.register(verificationToken, regUsername, regPassword);
    // On success, agent.isAuthenticated flips true and Home.tsx swaps
    // this form out automatically — nothing else to do here.
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    await agent.login(username, password);
  };

  return (
    <div className="flex h-screen w-full items-center justify-center bg-[#030712] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#10B981]/10 border border-[#10B981]/30">
            <Lock className="h-6 w-6 text-[#10B981]" />
          </div>
          <h1 className="text-xl font-semibold text-[#F8FAFC]">CareerPilot Agent</h1>
          <p className="mt-1 text-sm text-[#94A3B8]">
            {mode === 'login' && 'Sign in to your account'}
            {mode === 'register' && step === 'email' && 'Create an account to get started'}
            {mode === 'register' && step === 'otp' && 'Verify your email'}
            {mode === 'register' && step === 'details' && 'Choose your username and password'}
          </p>
        </div>

        <div className="space-y-4 rounded-xl border border-[#1E3A8A]/30 bg-[#0B1120] p-6">
          {/* ── LOGIN ─────────────────────────────────────────────── */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <Field icon={<User className="h-4 w-4" />} label="Username">
                <input
                  type="text" value={username} onChange={(e) => setUsername(e.target.value)}
                  required minLength={3} maxLength={32} autoComplete="username"
                  className={inputClass} placeholder="yourname"
                />
              </Field>
              <Field icon={<Lock className="h-4 w-4" />} label="Password">
                <input
                  type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  required minLength={8} autoComplete="current-password"
                  className={inputClass} placeholder="••••••••"
                />
              </Field>
              <ErrorBanner message={agent.authError} />
              <SubmitButton loading={agent.authLoading} label="Sign In" />
              <SwitchLink text="Don't have an account?" cta="Create one" onClick={() => switchMode('register')} />
            </form>
          )}

          {/* ── REGISTER: STEP 1 — EMAIL ─────────────────────────────── */}
          {mode === 'register' && step === 'email' && (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <Field icon={<Mail className="h-4 w-4" />} label="Email">
                <input
                  type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  required autoComplete="email"
                  className={inputClass} placeholder="you@example.com"
                />
              </Field>
              <ErrorBanner message={agent.authError} />
              <SubmitButton loading={agent.authLoading} label="Send Verification Code" />
              <SwitchLink text="Already have an account?" cta="Sign in" onClick={() => switchMode('login')} />
            </form>
          )}

          {/* ── REGISTER: STEP 2 — OTP ───────────────────────────────── */}
          {mode === 'register' && step === 'otp' && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <button
                type="button"
                onClick={() => setStep('email')}
                className="flex items-center gap-1 text-xs text-[#94A3B8] hover:text-[#F8FAFC]"
              >
                <ArrowLeft className="h-3 w-3" /> Change email
              </button>

              <p className="text-xs text-[#94A3B8]">
                We sent a {OTP_LENGTH}-digit code to <span className="text-[#F8FAFC]">{email}</span>
              </p>

              <Field icon={<ShieldCheck className="h-4 w-4" />} label="Verification code">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="\d{6}"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, OTP_LENGTH))}
                  required
                  autoComplete="one-time-code"
                  className={`${inputClass} text-center tracking-[0.5em] font-mono`}
                  placeholder="000000"
                />
              </Field>

              <SuccessBanner message={successMessage} />
              <ErrorBanner message={agent.authError} />

              <SubmitButton loading={agent.authLoading} label="Verify Code" disabled={otp.length !== OTP_LENGTH} />

              <div className="text-center text-xs text-[#94A3B8]">
                {cooldown > 0 ? (
                  <span>Resend code in {cooldown}s</span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={agent.authLoading}
                    className="text-[#10B981] hover:underline disabled:opacity-50"
                  >
                    Resend code
                  </button>
                )}
              </div>
            </form>
          )}

          {/* ── REGISTER: STEP 3 — USERNAME + PASSWORD ───────────────── */}
          {mode === 'register' && step === 'details' && (
            <form onSubmit={handleCompleteRegistration} className="space-y-4">
              <SuccessBanner message="Email verified" />

              <Field icon={<User className="h-4 w-4" />} label="Username">
                <input
                  type="text" value={regUsername} onChange={(e) => setRegUsername(e.target.value)}
                  required minLength={3} maxLength={32} autoComplete="username"
                  className={inputClass} placeholder="yourname"
                />
              </Field>
              <Field icon={<Lock className="h-4 w-4" />} label="Password">
                <input
                  type="password" value={regPassword} onChange={(e) => setRegPassword(e.target.value)}
                  required minLength={8} autoComplete="new-password"
                  className={inputClass} placeholder="At least 8 characters"
                />
              </Field>

              <ErrorBanner message={agent.authError} />
              <SubmitButton loading={agent.authLoading} label="Create Account" />
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// -- small shared pieces, kept local to this file since nothing else uses them --

const inputClass =
  "w-full rounded-lg border border-[#1E3A8A]/40 bg-[#030712] py-2 pl-9 pr-3 text-sm text-[#F8FAFC] placeholder-[#94A3B8]/50 outline-none focus:border-[#10B981]/50";

function Field({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-[#94A3B8]">{label}</label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]">{icon}</span>
        {children}
      </div>
    </div>
  );
}

function ErrorBanner({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div className="rounded-lg border border-[#EF4444]/30 bg-[#EF4444]/10 px-3 py-2 text-xs text-[#EF4444]">
      {message}
    </div>
  );
}

function SuccessBanner({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div className="rounded-lg border border-[#10B981]/30 bg-[#10B981]/10 px-3 py-2 text-xs text-[#10B981]">
      {message}
    </div>
  );
}

function SubmitButton({ loading, label, disabled }: { loading: boolean; label: string; disabled?: boolean }) {
  return (
    <button
      type="submit"
      disabled={loading || disabled}
      className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#10B981] py-2.5 text-sm font-medium text-[#030712] transition-all hover:bg-[#10B981]/90 active:scale-[0.98] disabled:opacity-50"
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {label}
    </button>
  );
}

function SwitchLink({ text, cta, onClick }: { text: string; cta: string; onClick: () => void }) {
  return (
    <p className="text-center text-xs text-[#94A3B8]">
      {text}{' '}
      <button type="button" onClick={onClick} className="text-[#10B981] hover:underline">
        {cta}
      </button>
    </p>
  );
}