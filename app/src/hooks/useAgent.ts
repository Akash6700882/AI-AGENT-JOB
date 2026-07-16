import { useState, useEffect, useCallback } from "react";

const API = "http://127.0.0.1:8001/api";
const TOKEN_STORAGE_KEY = "careerpilot_token";
const USER_STORAGE_KEY = "careerpilot_user";

export function useAgent() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [resume, setResume] = useState<any>(null);
  const [statistics, setStatistics] = useState<any>({});
  const [weeklyActivity, setWeeklyActivity] = useState<any[]>([]);

  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  // ===============================
  // 🔐 AUTH (Phase 0C)
  // ===============================
  // Token lives in localStorage so a page refresh doesn't log you out —
  // this is a real browser app (not a Claude artifact), so localStorage
  // is the normal, correct place for this, unlike in-chat generated
  // widgets where it's unavailable.
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_STORAGE_KEY));
  const [currentUser, setCurrentUser] = useState<any>(() => {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    try { return raw ? JSON.parse(raw) : null; } catch { return null; }
  });
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const isAuthenticated = !!token;

  // Every existing fetch call below needs this now — Phase 0C protects
  // every data endpoint with JWT auth, so a request without this header
  // gets a 401 instead of the data it used to return unconditionally.
  const authHeaders = useCallback((): Record<string, string> => {
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [token]);

  // Shared POST helper for every auth endpoint below — they all follow the
  // same shape (JSON body, JSON {success/access_token/...} or {detail}
  // error response), so this is the one place that owns auth loading/error
  // state and FastAPI's array-shaped 422 validation errors.
  const authRequest = async (path: string, body: Record<string, any>) => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const res = await fetch(`${API}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        const detail = Array.isArray(data.detail)
          ? data.detail.map((d: any) => d.msg).join(", ")
          : data.detail;
        setAuthError(detail || "Something went wrong.");
        return null;
      }
      return data;
    } catch (err) {
      console.error(`Auth request (${path}) failed:`, err);
      setAuthError("Could not reach the server. Is the backend running?");
      return null;
    } finally {
      setAuthLoading(false);
    }
  };

  const _persistSession = (data: any) => {
    setToken(data.access_token);
    setCurrentUser(data.user);
    localStorage.setItem(TOKEN_STORAGE_KEY, data.access_token);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user));
  };

  const login = async (identifier: string, password: string) => {
    const data = await authRequest("/auth/login", { identifier, password });
    if (!data?.access_token) return false;
    _persistSession(data);
    return true;
  };

  // No-signup entry: mints an anonymous account server-side so the app is
  // usable with zero clicks. Registering/logging in later just swaps this
  // token out for a real one via the same _persistSession path.
  const guestLogin = async () => {
    const data = await authRequest("/auth/guest", {});
    if (!data?.access_token) return false;
    _persistSession(data);
    return true;
  };

  const isGuest = !!currentUser?.username?.startsWith("guest_");

  // ===============================
  // ✉️ REGISTRATION (email OTP-gated, 3 steps)
  // ===============================
  const sendRegisterOtp = async (email: string) => {
    const data = await authRequest("/auth/register/send-otp", { email });
    return !!data?.success;
  };

  const verifyRegisterOtp = async (email: string, otp: string): Promise<string | null> => {
    const data = await authRequest("/auth/register/verify-otp", { email, otp });
    return data?.verification_token || null;
  };

  const completeRegister = async (verificationToken: string, username: string, password: string) => {
    const data = await authRequest("/auth/register", {
      verification_token: verificationToken, username, password,
    });
    if (!data?.access_token) return false;
    _persistSession(data);
    return true;
  };

  // ===============================
  // 🔑 FORGOT PASSWORD (email OTP-gated, 3 steps)
  // ===============================
  const sendResetOtp = async (email: string) => {
    const data = await authRequest("/auth/forgot-password/send-otp", { email });
    return !!data?.success;
  };

  const verifyResetOtp = async (email: string, otp: string): Promise<string | null> => {
    const data = await authRequest("/auth/forgot-password/verify-otp", { email, otp });
    return data?.reset_token || null;
  };

  const resetPassword = async (resetToken: string, newPassword: string, confirmPassword: string) => {
    const data = await authRequest("/auth/reset-password", {
      reset_token: resetToken, new_password: newPassword, confirm_password: confirmPassword,
    });
    return !!data?.success;
  };

  const logout = () => {
    // Stateless JWT (see backend/auth.py) — logout is purely client-side,
    // there's no server-side session to invalidate. Also reset all
    // in-memory state so the next login doesn't briefly flash the
    // previous user's data before the fetch-on-mount effect refetches.
    setToken(null);
    setCurrentUser(null);
    setResume(null);
    setApplications([]);
    setJobs([]);
    setStatistics({});
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
  };

  const clearAuthError = () => setAuthError(null);

  // ===============================
  // 📄 UPLOAD RESUME
  // ===============================
  const uploadResume = async (file: File) => {
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${API}/resume/upload`, {
        method: "POST",
        headers: authHeaders(),
        body: formData,
      });

      const data = await res.json();

      console.log("UPLOAD RESPONSE:", data);

      if (data.success) {
        // FIX: the backend returns resume fields flat on the response
        // object itself (data.name, data.skills, ...) — there is no
        // nested data.data. Passing data.data here was always undefined,
        // which is why the UI showed "0 skills extracted" / "No skills
        // detected" regardless of what the parser actually extracted.
        setResume(data);
      }
    } catch (err) {
      console.error("Resume upload failed:", err);
    }

    setLoading(false);
  };

  // ===============================
  // 📄 LOAD RESUME (for refresh)
  // ===============================
  const loadResume = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/resume`, { headers: authHeaders() });
      const data = await res.json();

      // FIX: same contract mismatch as uploadResume above — the backend
      // returns { success: bool, ... } for this endpoint, never { loaded, data }.
      if (data.success) {
        setResume(data);
      }
    } catch (err) {
      console.error("Load resume error:", err);
    }
  };

  // ===============================
  // 🔍 SEARCH JOBS
  // ===============================
  const searchJobs = async (params: any) => {
    setSearching(true);

    try {
      const res = await fetch(`${API}/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify(params),
      });

      const data = await res.json();

      console.log("SEARCH RESPONSE:", data);

      setJobs(data.jobs || []);
    } catch (err) {
      console.error("Search failed:", err);
    }

    setSearching(false);
  };

  // ===============================
  // 📄 LOAD APPLICATIONS
  // ===============================
  const loadApplications = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/applications`, { headers: authHeaders() });
      const data = await res.json();

      setApplications(data.applications || []);
      // FIX: the backend has always included a `stats` object in this
      // response, but it was fetched and immediately discarded — nothing
      // ever captured it into state. AnalyticsGrid's funnel chart reads
      // agent.statistics.applications, which was always {} as a result,
      // so Scanned/Applied/Interview counts stayed at 0 regardless of
      // real application data.
      setStatistics({ applications: data.stats || {} });
    } catch (err) {
      console.error("Applications error:", err);
    }
  };

  // ===============================
  // 📌 APPLY TO JOB
  // ===============================
  const applyToJob = async (jobId: string, notes: string = "") => {
    try {
      // FIX: this previously POSTed to /api/apply (doesn't exist — always
      // 404'd) with a JSON body {job_id, custom_message}. The real endpoint
      // is POST /api/applications (plural), and it takes job_id/notes as
      // query params, not a JSON body — there was no working "Apply" button
      // in this app until this fix.
      const url = `${API}/applications?job_id=${encodeURIComponent(jobId)}&notes=${encodeURIComponent(notes)}`;
      const res = await fetch(url, { method: "POST", headers: authHeaders() });

      const data = await res.json();

      console.log("APPLY RESPONSE:", data);

      // refresh applications after applying
      loadApplications();
      return data;
    } catch (err) {
      console.error("Apply failed:", err);
    }
  };

  // ===============================
  // 🗑️ DELETE APPLICATION
  // ===============================
  const deleteApplication = async (appId: string) => {
    try {
      const res = await fetch(`${API}/applications/${encodeURIComponent(appId)}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await res.json();
      // refresh applications after deleting
      loadApplications();
      return data;
    } catch (err) {
      console.error("Delete application failed:", err);
    }
  };

  // ===============================
  // 📈 WEEKLY ACTIVITY
  // ===============================
  const loadWeeklyActivity = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/weekly-activity`, { headers: authHeaders() });
      const data = await res.json();
      setWeeklyActivity(data.weekly_activity || []);
    } catch (err) {
      console.error("Weekly activity error:", err);
    }
  };

  // ===============================
  // ✨ CONTENT GENERATION (Phase 0E)
  // Cover letter / tailored resume / cold DM / interview prep / follow-up.
  // Shared POST helper — all five endpoints take the same job_title/company/
  // job_description shape and return {success, content, generated_by}.
  // ===============================
  const generateContent = async (endpoint: string, params: Record<string, any>) => {
    setGenerating(true);
    try {
      const res = await fetch(`${API}/generate/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.detail || "Generation failed." };
      }
      return data;
    } catch (err) {
      console.error(`Generate (${endpoint}) failed:`, err);
      return { success: false, error: "Could not reach the server." };
    } finally {
      setGenerating(false);
    }
  };

  const generateTailoredResume = (params: { job_title: string; company?: string; job_description?: string }) =>
    generateContent("resume", params);

  const generateCoverLetter = (params: { job_title: string; company?: string; job_description?: string; tone?: string }) =>
    generateContent("cover-letter", params);

  const generateColdDM = (params: { job_title: string; company?: string; job_description?: string; platform?: string }) =>
    generateContent("cold-dm", params);

  const generateInterviewPrep = (params: { job_title: string; company?: string; job_description?: string }) =>
    generateContent("interview-prep", params);

  const generateFollowUp = (params: { job_title: string; company?: string; job_description?: string; stage?: string }) =>
    generateContent("follow-up", params);

  // ===============================
  // 🎯 STANDALONE JOB SCORER
  // ===============================
  const scoreJob = async (params: { job_title: string; company?: string; job_description: string; location?: string; remote?: boolean }) => {
    setGenerating(true);
    try {
      const res = await fetch(`${API}/score-job`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.detail || "Scoring failed." };
      }
      return data;
    } catch (err) {
      console.error("Score job failed:", err);
      return { success: false, error: "Could not reach the server." };
    } finally {
      setGenerating(false);
    }
  };

  // ===============================
  // 👤 AUTO GUEST LOGIN
  // Runs once on mount: if there's no saved session at all (first visit,
  // or after logout), silently create a guest account so the app opens
  // straight into the dashboard instead of a login wall. A real login/
  // register later just overwrites this token via _persistSession.
  // ===============================
  useEffect(() => {
    if (!token) {
      guestLogin();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===============================
  // 🔄 AUTO LOAD ON START / ON LOGIN
  // ===============================
  useEffect(() => {
    // Phase 0C: only fetch user data once we actually have a token —
    // these calls would just 401 otherwise. Re-runs automatically after
    // login/register/logout since `token` is a dependency.
    if (token) {
      loadResume();
      loadApplications();
      loadWeeklyActivity();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // ===============================
  // 🚀 RETURN EVERYTHING
  // ===============================
  return {
    jobs: jobs || [],
    applications: applications || [],
    resume: resume || null,
    statistics: statistics || {},
    weeklyActivity: weeklyActivity || [],

    searching,
    loading,
    generating,

    // Auth (Phase 0C)
    isAuthenticated,
    isGuest,
    currentUser,
    authError,
    authLoading,
    login,
    guestLogin,
    logout,
    clearAuthError,
    sendRegisterOtp,
    verifyRegisterOtp,
    completeRegister,
    sendResetOtp,
    verifyResetOtp,
    resetPassword,

    uploadResume,
    loadResume,
    searchJobs,
    loadApplications,
    applyToJob,
    deleteApplication,
    loadWeeklyActivity,

    // Content generation (Phase 0E)
    generateTailoredResume,
    generateCoverLetter,
    generateColdDM,
    generateInterviewPrep,
    generateFollowUp,
    scoreJob,
  };
}