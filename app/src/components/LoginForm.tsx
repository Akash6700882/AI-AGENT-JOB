import { useState } from 'react';
import { REGEXP_ONLY_DIGITS } from 'input-otp';
import { Lock, Mail, User, Loader2, Eye, EyeOff, Bot, ArrowLeft, ShieldCheck } from 'lucide-react';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';

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
    <Card className="w-full max-w-sm border-primary/20 bg-card/90 shadow-2xl shadow-black/40 backdrop-blur-xl">
      <CardHeader className="text-center">
        <div className="mx-auto mb-1 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/70 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
          <Bot className="h-7 w-7 text-primary-foreground" />
        </div>
        <h1 className="text-xl font-semibold tracking-tight">
          Career<span className="text-primary">Pilot</span>
        </h1>
        <p className="text-sm text-muted-foreground">{title}</p>
      </CardHeader>

      <CardContent className="space-y-5">
        {mode !== 'forgot' && (
          <Tabs value={mode} onValueChange={(v) => switchMode(v as Mode)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Sign In</TabsTrigger>
              <TabsTrigger value="register">Create Account</TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        {/* ── LOGIN ─────────────────────────────────────────────── */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <Field icon={<User className="h-4 w-4" />} label="Username or Email">
              <Input
                type="text" value={identifier} onChange={(e) => setIdentifier(e.target.value)}
                required autoComplete="username" autoFocus
                className="pl-9" placeholder="yourname or you@example.com"
              />
            </Field>
            <Field
              icon={<Lock className="h-4 w-4" />}
              label="Password"
              trailing={<PasswordToggle shown={showPassword} onToggle={() => setShowPassword((s) => !s)} />}
            >
              <Input
                type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
                required minLength={8} autoComplete="current-password"
                className="pl-9 pr-9" placeholder="••••••••"
              />
            </Field>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => switchMode('forgot')}
                className="text-xs text-primary hover:underline"
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
              <Input
                type="email" value={regEmail} onChange={(e) => setRegEmail(e.target.value)}
                required autoComplete="email" autoFocus
                className="pl-9" placeholder="you@example.com"
              />
            </Field>
            <p className="text-xs text-muted-foreground">
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
            <Alert className="border-primary/30 bg-primary/10 py-2">
              <AlertDescription className="flex items-center gap-2 text-primary">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                {regEmail} verified
              </AlertDescription>
            </Alert>
            <Field icon={<User className="h-4 w-4" />} label="Username">
              <Input
                type="text" value={regUsername} onChange={(e) => setRegUsername(e.target.value)}
                required minLength={3} maxLength={32} pattern="[a-zA-Z0-9_.\-]+" autoComplete="username" autoFocus
                className="pl-9" placeholder="yourname"
              />
            </Field>
            <Field
              icon={<Lock className="h-4 w-4" />}
              label="Password"
              trailing={<PasswordToggle shown={showPassword} onToggle={() => setShowPassword((s) => !s)} />}
            >
              <Input
                type={showPassword ? 'text' : 'password'} value={regPassword} onChange={(e) => setRegPassword(e.target.value)}
                required minLength={8} autoComplete="new-password"
                className="pl-9 pr-9" placeholder="At least 8 characters"
              />
            </Field>
            <Field icon={<Lock className="h-4 w-4" />} label="Confirm Password">
              <Input
                type={showPassword ? 'text' : 'password'} value={regConfirmPassword}
                onChange={(e) => setRegConfirmPassword(e.target.value)}
                required minLength={8} autoComplete="new-password"
                className="pl-9" placeholder="Re-enter your password"
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
              <Input
                type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)}
                required autoComplete="email" autoFocus
                className="pl-9" placeholder="you@example.com"
              />
            </Field>
            <p className="text-xs text-muted-foreground">
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
              <Input
                type={showPassword ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                required minLength={8} autoComplete="new-password" autoFocus
                className="pl-9 pr-9" placeholder="At least 8 characters"
              />
            </Field>
            <Field icon={<Lock className="h-4 w-4" />} label="Confirm New Password">
              <Input
                type={showPassword ? 'text' : 'password'} value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required minLength={8} autoComplete="new-password"
                className="pl-9" placeholder="Re-enter your new password"
              />
            </Field>
            {resetPasswordMismatch && <ErrorBanner message="Passwords do not match." />}
            <ErrorBanner message={agent.authError} />
            <SubmitButton loading={agent.authLoading} label="Reset Password" />
          </form>
        )}
      </CardContent>
    </Card>
  );
}

// -- small shared pieces, kept local to this file since nothing else uses them --

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
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{icon}</span>
        {children}
        {trailing && <span className="absolute right-1 top-1/2 -translate-y-1/2">{trailing}</span>}
      </div>
    </div>
  );
}

function OtpField({ value, onChange, email }: { value: string; onChange: (v: string) => void; email: string }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium text-muted-foreground">
        6-digit code sent to <span className="text-foreground">{email}</span>
      </Label>
      <InputOTP maxLength={OTP_LENGTH} pattern={REGEXP_ONLY_DIGITS} value={value} onChange={onChange} autoFocus>
        <InputOTPGroup className="w-full justify-between">
          {Array.from({ length: OTP_LENGTH }).map((_, i) => (
            <InputOTPSlot key={i} index={i} className="h-12 w-12 rounded-lg border text-lg" />
          ))}
        </InputOTPGroup>
      </InputOTP>
    </div>
  );
}

function BackLink({ onClick, label = 'Back' }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function ResendLink({ onClick }: { onClick: () => void }) {
  return (
    <p className="text-center text-xs text-muted-foreground">
      Didn't get a code?{' '}
      <button type="button" onClick={onClick} className="text-primary hover:underline">
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
      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground"
    >
      {shown ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
    </button>
  );
}

function InfoBanner({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <Alert className="animate-fade-in-up border-primary/30 bg-primary/10 py-2 text-primary">
      <AlertDescription className="text-primary">{message}</AlertDescription>
    </Alert>
  );
}

function ErrorBanner({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <Alert variant="destructive" className="animate-fade-in-up py-2">
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

function SubmitButton({ loading, label, disabled }: { loading: boolean; label: string; disabled?: boolean }) {
  return (
    <Button
      type="submit"
      disabled={loading || disabled}
      size="lg"
      className="w-full bg-gradient-to-r from-primary to-primary/80 font-semibold hover:brightness-110 active:scale-[0.98]"
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {label}
    </Button>
  );
}
