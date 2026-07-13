import { useState } from 'react';
import { Lock, Mail, User, Loader2, X, Eye, EyeOff, Bot, ArrowLeft, ShieldCheck } from 'lucide-react';

interface LoginFormProps {
  agent: any;
  onClose?: () => void;
}

type Mode = 'login' | 'register' | 'forgot';
type RegisterStep = 'email' | 'otp' | 'details';
type ForgotStep = 'email' | 'otp' | 'reset';

const OTP_LENGTH = 6;

export function LoginForm({ agent, onClose }: LoginFormProps) {
  const [mode, setMode] = useState<Mode>('login');
  const [showPassword, setShowPassword] = useState(false);

  // Login fields
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  // Register fields/steps
  const [regStep, setRegStep] = useState<RegisterStep>('email');
  const [regEmail, setRegEmail] = useState('');
  const [regOtp, setRegOtp] = useState('');
  const [regVerificationToken, setRegVerificationToken] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regPasswordMismatch, setRegPasswordMismatch] = useState(false);

  // Forgot-password fields/steps
  const [forgotStep, setForgotStep] = useState<ForgotStep>('email');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotResetToken, setForgotResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetPasswordMismatch, setResetPasswordMismatch] = useState(false);

  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const switchMode = (next: Mode) => {
    setMode(next);
    setInfoMessage(null);
    agent.clearAuthError?.();
  };

  // -- Login ----------------------------------------------------------------

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await agent.login(identifier.trim(), password);
    if (ok) onClose?.();
  };

  // -- Register: step 1, email -> send OTP -----------------------------------

  const handleSendRegisterOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setInfoMessage(null);
    const ok = await agent.sendRegisterOtp(regEmail.trim().toLowerCase());
    if (ok) {
      setRegOtp('');
      setRegStep('otp');
      setInfoMessage('Verification code sent — check your email.');
    }
  };

  const handleResendRegisterOtp = async () => {
    setInfoMessage(null);
    const ok = await agent.sendRegisterOtp(regEmail.trim().toLowerCase());
    if (ok) {
      setRegOtp('');
      setInfoMessage('New code sent — check your email.');
    }
  };

  // -- Register: step 2, OTP -> verify ---------------------------------------

  const handleVerifyRegisterOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setInfoMessage(null);
    const token = await agent.verifyRegisterOtp(regEmail.trim().toLowerCase(), regOtp);
    if (token) {
      setRegVerificationToken(token);
      setRegStep('details');
      setInfoMessage('Email verified.');
    }
  };

  // -- Register: step 3, username/password -> complete ------------------------

  const handleCompleteRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setInfoMessage(null);
    if (regPassword !== regConfirmPassword) {
      agent.clearAuthError?.();
      setInfoMessage(null);
      setRegPasswordMismatch(true);
      return;
    }
    setRegPasswordMismatch(false);
    const ok = await agent.completeRegister(regVerificationToken, regUsername.trim(), regPassword);
    if (ok) onClose?.();
  };

  // -- Forgot password: step 1, email -> send OTP -----------------------------

  const handleSendResetOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setInfoMessage(null);
    const ok = await agent.sendResetOtp(forgotEmail.trim().toLowerCase());
    if (ok) {
      setForgotOtp('');
      setForgotStep('otp');
      setInfoMessage('If that email is registered, a verification code has been sent.');
    }
  };

  const handleResendResetOtp = async () => {
    setInfoMessage(null);
    const ok = await agent.sendResetOtp(forgotEmail.trim().toLowerCase());
    if (ok) {
      setForgotOtp('');
      setInfoMessage('New code sent — check your email.');
    }
  };

  // -- Forgot password: step 2, OTP -> verify ----------------------------------

  const handleVerifyResetOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setInfoMessage(null);
    const token = await agent.verifyResetOtp(forgotEmail.trim().toLowerCase(), forgotOtp);
    if (token) {
      setForgotResetToken(token);
      setForgotStep('reset');
      setInfoMessage('Email verified. Choose a new password.');
    }
  };

  // -- Forgot password: step 3, new password + confirm -------------------------

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setInfoMessage(null);
    if (newPassword !== confirmPassword) {
      setResetPasswordMismatch(true);
      return;
    }
    setResetPasswordMismatch(false);
    const ok = await agent.resetPassword(forgotResetToken, newPassword, confirmPassword);
    if (ok) {
      switchMode('login');
      setInfoMessage('Password updated — sign in with your new password.');
    }
  };

  const title =
    mode === 'login' ? 'Sign in to your account'
    : mode === 'register' ? 'Create an account to get started'
    : 'Reset your password';

  return (
    <div className="w-full max-w-sm animate-fade-in-up">
      <div className="relative overflow-hidden rounded-2xl border border-[#1E3A8A]/40 bg-[#0A1128]/90 shadow-2xl shadow-black/40 backdrop-blur-xl">
        <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-[#10B981]/20 blur-3xl" />

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-4 top-4 z-10 rounded-lg p-1 text-[#94A3B8] transition-colors hover:bg-white/5 hover:text-[#F8FAFC]"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        <div className="relative p-7">
          <div className="mb-6 text-center">
            <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#10B981] to-[#059669] glow-green">
              <Bot className="h-7 w-7 text-[#030712]" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-[#F8FAFC]">
              Career<span className="text-gradient-green">Pilot</span>
            </h1>
            <p className="mt-1 text-sm text-[#94A3B8]">{title}</p>
          </div>

          {mode !== 'forgot' && (
            <div className="mb-6 grid grid-cols-2 rounded-xl border border-[#1E3A8A]/40 bg-[#030712] p-1 text-sm font-medium">
              <button
                type="button"
                onClick={() => switchMode('login')}
                className={`rounded-lg py-2 transition-all ${
                  mode === 'login' ? 'bg-[#10B981]/15 text-[#10B981] shadow-sm' : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => switchMode('register')}
                className={`rounded-lg py-2 transition-all ${
                  mode === 'register' ? 'bg-[#10B981]/15 text-[#10B981] shadow-sm' : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                }`}
              >
                Create Account
              </button>
            </div>
          )}

          {/* ── LOGIN ─────────────────────────────────────────────── */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <Field icon={<User className="h-4 w-4" />} label="Username or Email">
                <input
                  type="text" value={identifier} onChange={(e) => setIdentifier(e.target.value)}
                  required autoComplete="username" autoFocus
                  className={inputClass} placeholder="yourname or you@example.com"
                />
              </Field>
              <Field
                icon={<Lock className="h-4 w-4" />}
                label="Password"
                trailing={<PasswordToggle shown={showPassword} onToggle={() => setShowPassword((s) => !s)} />}
              >
                <input
                  type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
                  required minLength={8} autoComplete="current-password"
                  className={`${inputClass} pr-9`} placeholder="••••••••"
                />
              </Field>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => switchMode('forgot')}
                  className="text-xs text-[#10B981] hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <InfoBanner message={infoMessage} />
              <ErrorBanner message={agent.authError} />
              <SubmitButton loading={agent.authLoading} label="Sign In" />
            </form>
          )}

          {/* ── REGISTER: step 1 — email ─────────────────────────────── */}
          {mode === 'register' && regStep === 'email' && (
            <form onSubmit={handleSendRegisterOtp} className="space-y-4">
              <Field icon={<Mail className="h-4 w-4" />} label="Email">
                <input
                  type="email" value={regEmail} onChange={(e) => setRegEmail(e.target.value)}
                  required autoComplete="email" autoFocus
                  className={inputClass} placeholder="you@example.com"
                />
              </Field>
              <p className="text-xs text-[#94A3B8]">
                We'll email you a 6-digit code to verify this address before creating your account.
              </p>
              <ErrorBanner message={agent.authError} />
              <SubmitButton loading={agent.authLoading} label="Send Verification Code" />
            </form>
          )}

          {/* ── REGISTER: step 2 — OTP ───────────────────────────────── */}
          {mode === 'register' && regStep === 'otp' && (
            <form onSubmit={handleVerifyRegisterOtp} className="space-y-4">
              <BackLink onClick={() => { setRegStep('email'); agent.clearAuthError?.(); setInfoMessage(null); }} />
              <OtpField value={regOtp} onChange={setRegOtp} email={regEmail} />
              <InfoBanner message={infoMessage} />
              <ErrorBanner message={agent.authError} />
              <SubmitButton loading={agent.authLoading} label="Verify Code" disabled={regOtp.length !== OTP_LENGTH} />
              <ResendLink onClick={handleResendRegisterOtp} />
            </form>
          )}

          {/* ── REGISTER: step 3 — username/password ─────────────────── */}
          {mode === 'register' && regStep === 'details' && (
            <form onSubmit={handleCompleteRegister} className="space-y-4">
              <div className="flex items-center gap-2 rounded-lg border border-[#10B981]/30 bg-[#10B981]/10 px-3 py-2 text-xs text-[#10B981]">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                {regEmail} verified
              </div>
              <Field icon={<User className="h-4 w-4" />} label="Username">
                <input
                  type="text" value={regUsername} onChange={(e) => setRegUsername(e.target.value)}
                  required minLength={3} maxLength={32} pattern="[a-zA-Z0-9_.\-]+" autoComplete="username" autoFocus
                  className={inputClass} placeholder="yourname"
                />
              </Field>
              <Field
                icon={<Lock className="h-4 w-4" />}
                label="Password"
                trailing={<PasswordToggle shown={showPassword} onToggle={() => setShowPassword((s) => !s)} />}
              >
                <input
                  type={showPassword ? 'text' : 'password'} value={regPassword} onChange={(e) => setRegPassword(e.target.value)}
                  required minLength={8} autoComplete="new-password"
                  className={`${inputClass} pr-9`} placeholder="At least 8 characters"
                />
              </Field>
              <Field icon={<Lock className="h-4 w-4" />} label="Confirm Password">
                <input
                  type={showPassword ? 'text' : 'password'} value={regConfirmPassword}
                  onChange={(e) => setRegConfirmPassword(e.target.value)}
                  required minLength={8} autoComplete="new-password"
                  className={inputClass} placeholder="Re-enter your password"
                />
              </Field>
              {regPasswordMismatch && <ErrorBanner message="Passwords do not match." />}
              <ErrorBanner message={agent.authError} />
              <SubmitButton loading={agent.authLoading} label="Create Account" />
            </form>
          )}

          {/* ── FORGOT PASSWORD: step 1 — email ──────────────────────── */}
          {mode === 'forgot' && forgotStep === 'email' && (
            <form onSubmit={handleSendResetOtp} className="space-y-4">
              <BackLink onClick={() => switchMode('login')} label="Back to sign in" />
              <Field icon={<Mail className="h-4 w-4" />} label="Email">
                <input
                  type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)}
                  required autoComplete="email" autoFocus
                  className={inputClass} placeholder="you@example.com"
                />
              </Field>
              <p className="text-xs text-[#94A3B8]">
                We'll email a 6-digit code to reset your password if this address has an account.
              </p>
              <ErrorBanner message={agent.authError} />
              <SubmitButton loading={agent.authLoading} label="Send Reset Code" />
            </form>
          )}

          {/* ── FORGOT PASSWORD: step 2 — OTP ────────────────────────── */}
          {mode === 'forgot' && forgotStep === 'otp' && (
            <form onSubmit={handleVerifyResetOtp} className="space-y-4">
              <BackLink onClick={() => { setForgotStep('email'); agent.clearAuthError?.(); setInfoMessage(null); }} />
              <OtpField value={forgotOtp} onChange={setForgotOtp} email={forgotEmail} />
              <InfoBanner message={infoMessage} />
              <ErrorBanner message={agent.authError} />
              <SubmitButton loading={agent.authLoading} label="Verify Code" disabled={forgotOtp.length !== OTP_LENGTH} />
              <ResendLink onClick={handleResendResetOtp} />
            </form>
          )}

          {/* ── FORGOT PASSWORD: step 3 — new password ───────────────── */}
          {mode === 'forgot' && forgotStep === 'reset' && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <Field
                icon={<Lock className="h-4 w-4" />}
                label="New Password"
                trailing={<PasswordToggle shown={showPassword} onToggle={() => setShowPassword((s) => !s)} />}
              >
                <input
                  type={showPassword ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                  required minLength={8} autoComplete="new-password" autoFocus
                  className={`${inputClass} pr-9`} placeholder="At least 8 characters"
                />
              </Field>
              <Field icon={<Lock className="h-4 w-4" />} label="Confirm New Password">
                <input
                  type={showPassword ? 'text' : 'password'} value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required minLength={8} autoComplete="new-password"
                  className={inputClass} placeholder="Re-enter your new password"
                />
              </Field>
              {resetPasswordMismatch && <ErrorBanner message="Passwords do not match." />}
              <ErrorBanner message={agent.authError} />
              <SubmitButton loading={agent.authLoading} label="Reset Password" />
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// -- small shared pieces, kept local to this file since nothing else uses them --

const inputClass =
  "w-full rounded-lg border border-[#1E3A8A]/40 bg-[#030712] py-2.5 pl-9 pr-3 text-sm text-[#F8FAFC] placeholder-[#94A3B8]/50 outline-none transition-colors focus:border-[#10B981]/60 focus:ring-2 focus:ring-[#10B981]/15";

function Field({
  icon,
  label,
  trailing,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-[#94A3B8]">{label}</label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]">{icon}</span>
        {children}
        {trailing && <span className="absolute right-1 top-1/2 -translate-y-1/2">{trailing}</span>}
      </div>
    </div>
  );
}

function OtpField({ value, onChange, email }: { value: string; onChange: (v: string) => void; email: string }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-[#94A3B8]">
        6-digit code sent to <span className="text-[#F8FAFC]">{email}</span>
      </label>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, OTP_LENGTH))}
        autoFocus
        maxLength={OTP_LENGTH}
        className="w-full rounded-lg border border-[#1E3A8A]/40 bg-[#030712] py-3 text-center text-lg tracking-[0.5em] text-[#F8FAFC] outline-none transition-colors focus:border-[#10B981]/60 focus:ring-2 focus:ring-[#10B981]/15"
        placeholder="------"
      />
    </div>
  );
}

function BackLink({ onClick, label = 'Back' }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 text-xs text-[#94A3B8] transition-colors hover:text-[#F8FAFC]"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function ResendLink({ onClick }: { onClick: () => void }) {
  return (
    <p className="text-center text-xs text-[#94A3B8]">
      Didn't get a code?{' '}
      <button type="button" onClick={onClick} className="text-[#10B981] hover:underline">
        Resend
      </button>
    </p>
  );
}

function PasswordToggle({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      tabIndex={-1}
      aria-label={shown ? 'Hide password' : 'Show password'}
      className="rounded-md p-1.5 text-[#94A3B8] transition-colors hover:text-[#F8FAFC]"
    >
      {shown ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
    </button>
  );
}

function InfoBanner({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div className="animate-fade-in-up rounded-lg border border-[#10B981]/30 bg-[#10B981]/10 px-3 py-2 text-xs text-[#10B981]">
      {message}
    </div>
  );
}

function ErrorBanner({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div className="animate-fade-in-up rounded-lg border border-[#EF4444]/30 bg-[#EF4444]/10 px-3 py-2 text-xs text-[#EF4444]">
      {message}
    </div>
  );
}

function SubmitButton({ loading, label, disabled }: { loading: boolean; label: string; disabled?: boolean }) {
  return (
    <button
      type="submit"
      disabled={loading || disabled}
      className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#10B981] to-[#059669] py-2.5 text-sm font-semibold text-[#030712] transition-all hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {label}
    </button>
  );
}
