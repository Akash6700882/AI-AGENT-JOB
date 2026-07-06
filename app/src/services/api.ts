import {
  mockJobs,
  mockApplications,
  mockResume,
  mockStatistics,
  mockRecommendations,
  mockWeeklyActivity,
} from './mockData';

const API_BASE = 'http://localhost:8000';
const USE_MOCK = true; // Set to false when backend is running

class ApiService {
  private async fetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
    if (USE_MOCK) {
      return this.mockResponse<T>(endpoint, options);
    }

    try {
      const url = `${API_BASE}${endpoint}`;
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(error.detail || `HTTP ${response.status}`);
      }

      return response.json();
    } catch (err) {
      console.warn(`API call failed for ${endpoint}, using mock data`);
      return this.mockResponse<T>(endpoint, options);
    }
  }

  private mockResponse<T>(endpoint: string, _options?: RequestInit): Promise<T> {
    return new Promise((resolve) => {
      setTimeout(() => {
        if (endpoint === '/') {
          resolve({ message: 'CareerPilot API', version: '1.0.0', status: 'online' } as T);
        } else if (endpoint === '/api/status') {
          resolve({
            state: 'idle',
            message: 'Agent Online',
            jobs_found: 10,
            jobs_matched: 10,
            jobs_applied: 5,
            current_action: '',
            progress_percent: 100,
            last_search_time: new Date().toISOString(),
            errors: [],
          } as T);
        } else if (endpoint === '/api/resume') {
          resolve({ loaded: true, data: mockResume } as T);
        } else if (endpoint === '/api/applications') {
          resolve({ applications: mockApplications } as T);
        } else if (endpoint === '/api/statistics') {
          resolve(mockStatistics as T);
        } else if (endpoint === '/api/recommendations') {
          resolve({ recommendations: mockRecommendations } as T);
        } else if (endpoint === '/api/weekly-activity') {
          resolve({ activity: mockWeeklyActivity } as T);
        } else if (endpoint === '/api/search') {
          resolve({ success: true, jobs_found: mockJobs.length, jobs: mockJobs } as T);
        } else if (endpoint === '/api/apply') {
          resolve({
            success: true,
            message: 'Application submitted successfully',
            application_id: `app_${Date.now()}`,
            cover_letter: 'Generated cover letter...',
          } as T);
        } else {
          resolve({} as T);
        }
      }, 800);
    });
  }

  async uploadResume(file: File) {
    if (USE_MOCK) {
      await new Promise((r) => setTimeout(r, 1500));
      return {
        success: true,
        message: 'Resume uploaded successfully',
        data: mockResume,
      };
    }

    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${API_BASE}/api/resume/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Upload failed' }));
      throw new Error(error.detail);
    }
    return response.json();
  }

  async getResume() {
    return this.fetch<{ loaded: boolean; data: any }>('/api/resume');
  }

  async searchJobs(config: {
    keywords: string;
    location?: string;
    job_type?: string;
    remote_only?: boolean;
    min_match_score?: number;
    max_results?: number;
  }) {
    if (USE_MOCK) {
      // Filter mock jobs based on search config
      let filtered = [...mockJobs];
      if (config.keywords) {
        const kw = config.keywords.toLowerCase();
        filtered = filtered.filter(
          (j) =>
            j.title.toLowerCase().includes(kw) ||
            j.company.toLowerCase().includes(kw) ||
            j.matched_skills.some((s) => s.toLowerCase().includes(kw))
        );
      }
      if (config.remote_only) {
        filtered = filtered.filter((j) => j.remote);
      }
      await new Promise((r) => setTimeout(r, 1200));
      return {
        success: true,
        jobs_found: filtered.length,
        jobs: filtered,
      };
    }

    return this.fetch<{
      success: boolean;
      jobs_found: number;
      jobs: JobResult[];
    }>('/api/search', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }

  async applyToJob(jobId: string, _customMessage?: string) {
    if (USE_MOCK) {
      await new Promise((r) => setTimeout(r, 800));
      const job = mockJobs.find((j) => j.id === jobId);
      return {
        success: true,
        message: `Applied to ${job?.title || 'job'} successfully`,
        application_id: `app_${Date.now()}`,
        cover_letter: `Dear Hiring Manager,\n\nI am writing to express my strong interest in the ${job?.title} position at ${job?.company}.\n\nSincerely,\nAlex Developer`,
      };
    }

    return this.fetch<{
      success: boolean;
      message: string;
      application_id: string;
      cover_letter: string;
    }>('/api/apply', {
      method: 'POST',
      body: JSON.stringify({ job_id: jobId, custom_message: _customMessage || '' }),
    });
  }

  async getApplications(status?: string) {
    if (USE_MOCK) {
      let apps = [...mockApplications];
      if (status) {
        apps = apps.filter((a) => a.status === status);
      }
      return { applications: apps };
    }

    const url = status ? `/api/applications?status=${status}` : '/api/applications';
    return this.fetch<{ applications: Application[] }>(url);
  }

  async updateApplication(appId: string, status: string, notes?: string) {
    return this.fetch<{ success: boolean; message: string }>(
      `/api/applications/${appId}`,
      {
        method: 'PUT',
        body: JSON.stringify({ status, notes: notes || '' }),
      }
    );
  }

  async getStatistics() {
    return this.fetch<any>('/api/statistics');
  }

  async getRecommendations() {
    return this.fetch<{ recommendations: Recommendation[] }>('/api/recommendations');
  }

  async getWeeklyActivity() {
    return this.fetch<{ activity: WeeklyActivity[] }>('/api/weekly-activity');
  }

  async getStatus() {
    return this.fetch<any>('/api/status');
  }
}

// Types
export interface JobResult {
  id: string;
  title: string;
  company: string;
  location: string;
  salary: string;
  description: string;
  url: string;
  source: string;
  remote: boolean;
  posted_date: string;
  match_score: number;
  skill_match: number;
  matched_skills: string[];
  missing_skills: string[];
}

export interface Application {
  id: string;
  job_title: string;
  company: string;
  location: string;
  salary: string;
  match_score: number;
  status: string;
  applied_date: string;
  notes: string;
  job_url: string;
  source: string;
}

export interface Recommendation {
  type: string;
  message: string;
  priority: string;
}

export interface WeeklyActivity {
  week: string;
  applied: number;
  responses: number;
}

export const api = new ApiService();
