import { useState, useEffect } from "react";

const API = "http://127.0.0.1:8001/api";

export function useAgent() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [resume, setResume] = useState<any>(null);

  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(false);

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
        body: formData,
      });

      const data = await res.json();

      console.log("UPLOAD RESPONSE:", data);

      if (data.success) {
        setResume(data.data);   // 🔥 update UI instantly
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
    try {
      const res = await fetch(`${API}/resume`);
      const data = await res.json();

      if (data.loaded) {
        setResume(data.data);
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
    try {
      const res = await fetch(`${API}/applications`);
      const data = await res.json();

      setApplications(data.applications || []);
    } catch (err) {
      console.error("Applications error:", err);
    }
  };

  // ===============================
  // 📌 APPLY TO JOB
  // ===============================
  const applyToJob = async (jobId: string) => {
    try {
      const res = await fetch(`${API}/apply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          job_id: jobId,
          custom_message: "",
        }),
      });

      const data = await res.json();

      console.log("APPLY RESPONSE:", data);

      // refresh applications after applying
      loadApplications();
    } catch (err) {
      console.error("Apply failed:", err);
    }
  };

  // ===============================
  // 🔄 AUTO LOAD ON START
  // ===============================
  useEffect(() => {
    loadResume();
    loadApplications();
  }, []);

  // ===============================
  // 🚀 RETURN EVERYTHING
  // ===============================
  return {
    jobs: jobs || [],
    applications: applications || [],
    resume: resume || null,

    searching,
    loading,

    uploadResume,
    loadResume,
    searchJobs,
    loadApplications,
    applyToJob,
  };
}
