import { useState, useEffect, useCallback } from "react";

const API = "http://127.0.0.1:8001/api";
const TOKEN_STORAGE_KEY = "careerpilot_token";
const USER_STORAGE_KEY = "careerpilot_user";

export function useAgent() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [resume, setResume] = useState<any>(null);
  const [statistics, setStatistics] = useState<any>({});

  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(false);

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

  const login = async (username: string, password: string) => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.access_token) {
        setAuthError(data.detail || "Login failed.");
        return false;
      }
      setToken(data.access_token);
      setCurrentUser(data.user);
      localStorage.setItem(TOKEN_STORAGE_KEY, data.access_token);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user));
      return true;
    } catch (err) {
      console.error("Login error:", err);
      setAuthError("Could not reach the server. Is the backend running?");
      return false;
    } finally {
      setAuthLoading(false);
    }
  };

  const register = async (username: string, email: string, password: string) => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const res = await fetch(`${API}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.access_token) {
        // FastAPI validation errors (422) come back as data.detail = [...]
        // rather than a plain string — flatten that into something readable.
        const detail = Array.isArray(data.detail)
          ? data.detail.map((d: any) => d.msg).join(", ")
          : data.detail;
        setAuthError(detail || "Registration failed.");
        return false;
      }
      setToken(data.access_token);
      setCurrentUser(data.user);
      localStorage.setItem(TOKEN_STORAGE_KEY, data.access_token);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user));
      return true;
    } catch (err) {
      console.error("Register error:", err);
      setAuthError("Could not reach the server. Is the backend running?");
      return false;
    } finally {
      setAuthLoading(false);
    }
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
  // 🔄 AUTO LOAD ON START / ON LOGIN
  // ===============================
  useEffect(() => {
    // Phase 0C: only fetch user data once we actually have a token —
    // these calls would just 401 otherwise. Re-runs automatically after
    // login/register/logout since `token` is a dependency.
    if (token) {
      loadResume();
      loadApplications();
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

    searching,
    loading,

    // Auth (Phase 0C)
    isAuthenticated,
    currentUser,
    authError,
    authLoading,
    login,
    register,
    logout,

    uploadResume,
    loadResume,
    searchJobs,
    loadApplications,
    applyToJob,
  };
}