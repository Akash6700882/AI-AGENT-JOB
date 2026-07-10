import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type { JobResult, Application, Recommendation, WeeklyActivity } from '@/services/api';

export interface AgentStatus {
  state: string;
  message: string;
  jobs_found: number;
  jobs_matched: number;
  jobs_applied: number;
  current_action: string;
  progress_percent: number;
  last_search_time: string;
  errors: string[];
}

export function useAgent() {
  const [status] = useState<AgentStatus>({
    state: 'idle',
    message: 'Ready to start',
    jobs_found: 0,
    jobs_matched: 0,
    jobs_applied: 0,
    current_action: '',
    progress_percent: 0,
    last_search_time: '',
    errors: [],
  });
  const [resume, setResume] = useState<any>(null);
  const [jobs, setJobs] = useState<JobResult[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [statistics, setStatistics] = useState<any>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [weeklyActivity, setWeeklyActivity] = useState<WeeklyActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const loadResume = useCallback(async () => {
    try {
      const data = await api.getResume();
      if (data.loaded && data.data) {
        setResume(data.data);
        return data.data;
      }
      return null;
    } catch (err) {
      console.log('No resume loaded');
      return null;
    }
  }, []);

  const uploadResume = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.uploadResume(file);
      if (result.success) {
        setResume(result.data);
        showToast('Resume uploaded successfully', 'success');
        await loadResume();
        return result.data;
      }
    } catch (err: any) {
      setError(err.message);
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [loadResume, showToast]);

  const searchJobs = useCallback(async (config: {
    keywords: string;
    location?: string;
    job_type?: string;
    remote_only?: boolean;
  }) => {
    setSearching(true);
    setError(null);
    try {
      const result = await api.searchJobs({
        ...config,
        max_results: 50,
        min_match_score: 20,
      });
      setJobs(result.jobs);
      showToast(`Found ${result.jobs_found} matching jobs`, 'success');
      return result.jobs;
    } catch (err: any) {
      setError(err.message);
      showToast(err.message, 'error');
      return [];
    } finally {
      setSearching(false);
    }
  }, [showToast]);

  const applyToJob = useCallback(async (jobId: string) => {
    setLoading(true);
    try {
      const result = await api.applyToJob(jobId);
      showToast(result.message, 'success');
      await loadApplications();
      return result;
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const loadApplications = useCallback(async () => {
    try {
      const result = await api.getApplications();
      setApplications(result.applications);
    } catch (err) {
      console.error('Failed to load applications');
    }
  }, []);

  const loadStatistics = useCallback(async () => {
    try {
      const stats = await api.getStatistics();
      setStatistics(stats);
    } catch (err) {
      console.error('Failed to load statistics');
    }
  }, []);

  const loadRecommendations = useCallback(async () => {
    try {
      const result = await api.getRecommendations();
      setRecommendations(result.recommendations);
    } catch (err) {
      console.error('Failed to load recommendations');
    }
  }, []);

  const loadWeeklyActivity = useCallback(async () => {
    try {
      const result = await api.getWeeklyActivity();
      setWeeklyActivity(result.activity);
    } catch (err) {
      console.error('Failed to load weekly activity');
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadResume();
    loadApplications();
    loadStatistics();
    loadRecommendations();
    loadWeeklyActivity();
  }, [loadResume, loadApplications, loadStatistics, loadRecommendations, loadWeeklyActivity]);

  return {
    status,
    resume,
    jobs,
    applications,
    statistics,
    recommendations,
    weeklyActivity,
    loading,
    error,
    searching,
    toast,
    uploadResume,
    searchJobs,
    applyToJob,
    loadApplications,
    loadStatistics,
    showToast,
  };
}