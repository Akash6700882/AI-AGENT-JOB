import { useState } from 'react';
import {
  FileText,
  Target,
  Send,
  MessagesSquare,
  Mail,
  Copy,
  Check,
  Sparkles,
  ChevronDown,
} from 'lucide-react';

interface ToolsPanelProps {
  agent: any;
}

type Tool = 'resume' | 'scorer' | 'cold-dm' | 'interview' | 'follow-up';

const tools: { id: Tool; label: string; icon: any }[] = [
  { id: 'resume', label: 'Resume & Cover Letter', icon: FileText },
  { id: 'scorer', label: 'Job Scorer', icon: Target },
  { id: 'cold-dm', label: 'Cold DM Writer', icon: Send },
  { id: 'interview', label: 'Interview Prep', icon: MessagesSquare },
  { id: 'follow-up', label: 'Follow Up Email', icon: Mail },
];

export function ToolsPanel({ agent }: ToolsPanelProps) {
  const [activeTool, setActiveTool] = useState<Tool>('resume');

  // Shared job context, editable by hand or loaded from a previous search.
  const [jobTitle, setJobTitle] = useState('');
  const [company, setCompany] = useState('');
  const [jobDescription, setJobDescription] = useState('');

  const loadFromJob = (jobId: string) => {
    const job = (agent.jobs || []).find((j: any) => j.id === jobId);
    if (!job) return;
    setJobTitle(job.title || '');
    setCompany(job.company || '');
    setJobDescription(job.description || '');
  };

  return (
    <div className="space-y-6">
      {/* Sub-nav */}
      <div className="flex flex-wrap gap-2">
        {tools.map((t) => {
          const Icon = t.icon;
          const isActive = activeTool === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTool(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30'
                  : 'text-[#94A3B8] hover:text-[#F8FAFC] border border-transparent hover:border-[#1E3A8A]/50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Shared job context */}
      <div className="rounded-xl border border-[#1E3A8A]/50 bg-[#0A1128] card-gradient overflow-hidden">
        <div className="p-4 border-b border-[#1E3A8A]/30 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#10B981]" />
            <span className="text-sm font-medium text-[#94A3B8]">Target Job</span>
          </div>
          {agent.jobs?.length > 0 && (
            <div className="relative">
              <select
                onChange={(e) => e.target.value && loadFromJob(e.target.value)}
                defaultValue=""
                className="pl-3 pr-8 py-1.5 bg-[#030712] border border-[#1E3A8A]/50 rounded-lg text-xs text-[#94A3B8] focus:outline-none focus:border-[#10B981]/50 appearance-none cursor-pointer"
              >
                <option value="" disabled>
                  Load from matched jobs...
                </option>
                {agent.jobs.map((j: any) => (
                  <option key={j.id} value={j.id}>
                    {j.title} — {j.company}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94A3B8] pointer-events-none" />
            </div>
          )}
        </div>
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            type="text"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            placeholder="Job title"
            className="w-full px-4 py-2.5 bg-[#030712] border border-[#1E3A8A]/50 rounded-lg text-sm text-[#F8FAFC] placeholder-[#94A3B8]/50 focus:outline-none focus:border-[#10B981]/50 focus:ring-1 focus:ring-[#10B981]/20 transition-all"
          />
          <input
            type="text"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Company"
            className="w-full px-4 py-2.5 bg-[#030712] border border-[#1E3A8A]/50 rounded-lg text-sm text-[#F8FAFC] placeholder-[#94A3B8]/50 focus:outline-none focus:border-[#10B981]/50 focus:ring-1 focus:ring-[#10B981]/20 transition-all"
          />
          <textarea
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder="Paste the job description here (or load one from your matched jobs above)..."
            rows={4}
            className="md:col-span-2 w-full px-4 py-2.5 bg-[#030712] border border-[#1E3A8A]/50 rounded-lg text-sm text-[#F8FAFC] placeholder-[#94A3B8]/50 focus:outline-none focus:border-[#10B981]/50 focus:ring-1 focus:ring-[#10B981]/20 transition-all resize-none"
          />
        </div>
      </div>

      {/* Active tool */}
      {activeTool === 'resume' && (
        <ResumeCoverLetterTool agent={agent} jobTitle={jobTitle} company={company} jobDescription={jobDescription} />
      )}
      {activeTool === 'scorer' && (
        <JobScorerTool agent={agent} jobTitle={jobTitle} company={company} jobDescription={jobDescription} />
      )}
      {activeTool === 'cold-dm' && (
        <ColdDMTool agent={agent} jobTitle={jobTitle} company={company} jobDescription={jobDescription} />
      )}
      {activeTool === 'interview' && (
        <InterviewPrepTool agent={agent} jobTitle={jobTitle} company={company} jobDescription={jobDescription} />
      )}
      {activeTool === 'follow-up' && (
        <FollowUpTool agent={agent} jobTitle={jobTitle} company={company} jobDescription={jobDescription} />
      )}
    </div>
  );
}

// =============================================================================
// Shared bits
// =============================================================================

interface ToolProps {
  agent: any;
  jobTitle: string;
  company: string;
  jobDescription: string;
}

function ToolShell({
  title,
  icon: Icon,
  disabled,
  onGenerate,
  generating,
  actionLabel,
  extraControls,
  result,
  error,
  hasResume,
}: {
  title: string;
  icon: any;
  disabled: boolean;
  onGenerate: () => void;
  generating: boolean;
  actionLabel: string;
  extraControls?: React.ReactNode;
  result: string | null;
  error: string | null;
  hasResume: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="rounded-xl border border-[#1E3A8A]/50 bg-[#0A1128] card-gradient overflow-hidden animate-fade-in-up">
      <div className="p-4 border-b border-[#1E3A8A]/30 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-[#10B981]" />
          <span className="text-sm font-medium text-[#94A3B8]">{title}</span>
        </div>
        <div className="flex items-center gap-3">
          {extraControls}
          <button
            onClick={onGenerate}
            disabled={disabled || generating}
            className="flex items-center gap-2 px-4 py-2 bg-[#10B981] text-[#030712] rounded-lg font-semibold text-xs hover:bg-[#34D399] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-[#030712] border-t-transparent rounded-full animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                {actionLabel}
              </>
            )}
          </button>
        </div>
      </div>
      <div className="p-4">
        {!hasResume && (
          <p className="text-xs text-[#F59E0B] mb-3">
            Upload a resume first — every tool here is grounded in your real resume data.
          </p>
        )}
        {error && <p className="text-xs text-[#EF4444] mb-3">{error}</p>}
        {result ? (
          <div className="relative">
            <button
              onClick={handleCopy}
              className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 bg-[#1E3A8A]/30 border border-[#1E3A8A]/50 text-[#94A3B8] rounded-md text-[10px] hover:text-[#F8FAFC] hover:bg-[#1E3A8A]/50 transition-all"
            >
              {copied ? <Check className="w-3 h-3 text-[#10B981]" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <pre className="whitespace-pre-wrap font-sans text-sm text-[#F8FAFC] bg-[#030712] rounded-lg p-4 pr-20 leading-relaxed">
              {result}
            </pre>
          </div>
        ) : (
          !error && (
            <p className="text-sm text-[#94A3B8] text-center py-8">
              Fill in the target job above and click "{actionLabel}" to generate.
            </p>
          )
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Resume & Cover Letter
// =============================================================================

function ResumeCoverLetterTool({ agent, jobTitle, company, jobDescription }: ToolProps) {
  const [mode, setMode] = useState<'resume' | 'cover-letter'>('cover-letter');
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleGenerate = async () => {
    setError(null);
    setResult(null);
    setBusy(true);
    const params = { job_title: jobTitle, company, job_description: jobDescription };
    const data =
      mode === 'cover-letter' ? await agent.generateCoverLetter(params) : await agent.generateTailoredResume(params);
    setBusy(false);
    if (data?.success) setResult(data.content);
    else setError(data?.error || 'Generation failed.');
  };

  return (
    <ToolShell
      title="Resume & Cover Letter"
      icon={FileText}
      disabled={!jobTitle.trim() || !agent.resume}
      hasResume={!!agent.resume}
      onGenerate={handleGenerate}
      generating={busy}
      actionLabel={mode === 'cover-letter' ? 'Write Cover Letter' : 'Build Tailored Resume'}
      result={result}
      error={error}
      extraControls={
        <div className="flex items-center rounded-lg border border-[#1E3A8A]/50 overflow-hidden text-xs">
          <button
            onClick={() => setMode('cover-letter')}
            className={`px-3 py-1.5 transition-all ${mode === 'cover-letter' ? 'bg-[#10B981]/15 text-[#10B981]' : 'text-[#94A3B8]'}`}
          >
            Cover Letter
          </button>
          <button
            onClick={() => setMode('resume')}
            className={`px-3 py-1.5 transition-all ${mode === 'resume' ? 'bg-[#10B981]/15 text-[#10B981]' : 'text-[#94A3B8]'}`}
          >
            Tailored Resume
          </button>
        </div>
      }
    />
  );
}

// =============================================================================
// Job Scorer
// =============================================================================

function JobScorerTool({ agent, jobTitle, company, jobDescription }: ToolProps) {
  const [score, setScore] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleGenerate = async () => {
    setError(null);
    setScore(null);
    setBusy(true);
    const data = await agent.scoreJob({ job_title: jobTitle, company, job_description: jobDescription });
    setBusy(false);
    if (data?.success) setScore(data);
    else setError(data?.error || 'Scoring failed.');
  };

  return (
    <div className="rounded-xl border border-[#1E3A8A]/50 bg-[#0A1128] card-gradient overflow-hidden animate-fade-in-up">
      <div className="p-4 border-b border-[#1E3A8A]/30 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-[#10B981]" />
          <span className="text-sm font-medium text-[#94A3B8]">Job Scorer</span>
        </div>
        <button
          onClick={handleGenerate}
          disabled={!jobDescription.trim() || !agent.resume || busy}
          className="flex items-center gap-2 px-4 py-2 bg-[#10B981] text-[#030712] rounded-lg font-semibold text-xs hover:bg-[#34D399] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-[#030712] border-t-transparent rounded-full animate-spin" />
              Scoring...
            </>
          ) : (
            <>
              <Target className="w-3.5 h-3.5" />
              Score My Match
            </>
          )}
        </button>
      </div>
      <div className="p-4 space-y-4">
        {!agent.resume && (
          <p className="text-xs text-[#F59E0B]">Upload a resume first to score a job against it.</p>
        )}
        {error && <p className="text-xs text-[#EF4444]">{error}</p>}
        {!score && !error && (
          <p className="text-sm text-[#94A3B8] text-center py-8">
            Paste a job description above (a pasted-in one from any company's careers page works too) and click
            "Score My Match".
          </p>
        )}
        {score && (
          <>
            <div className="flex items-center gap-4">
              <div className="relative w-20 h-20 flex-shrink-0">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="34" fill="none" stroke="#1E3A8A" strokeWidth="6" />
                  <circle
                    cx="40"
                    cy="40"
                    r="34"
                    fill="none"
                    stroke="#10B981"
                    strokeWidth="6"
                    strokeDasharray={2 * Math.PI * 34}
                    strokeDashoffset={2 * Math.PI * 34 * (1 - score.overall_score / 100)}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-lg font-mono-data font-bold text-[#F8FAFC]">
                  {Math.round(score.overall_score)}
                </div>
              </div>
              <div className="flex-1 grid grid-cols-2 gap-2 text-xs">
                {[
                  { label: 'Skills', value: score.skill_match_score },
                  { label: 'Title Fit', value: score.title_match_score },
                  { label: 'Experience', value: score.experience_match_score },
                  { label: 'Location', value: score.location_match_score },
                ].map((s) => (
                  <div key={s.label} className="flex items-center justify-between bg-[#030712] rounded-lg px-3 py-1.5">
                    <span className="text-[#94A3B8]">{s.label}</span>
                    <span className="font-mono-data text-[#10B981]">{Math.round(s.value)}%</span>
                  </div>
                ))}
              </div>
            </div>

            {score.matched_skills?.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[#94A3B8] mb-2">Matched Skills</div>
                <div className="flex flex-wrap gap-1.5">
                  {score.matched_skills.map((s: string) => (
                    <span key={s} className="px-2 py-0.5 rounded-full text-[11px] bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/30">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {score.missing_skills?.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[#94A3B8] mb-2">Missing Skills</div>
                <div className="flex flex-wrap gap-1.5">
                  {score.missing_skills.map((s: string) => (
                    <span key={s} className="px-2 py-0.5 rounded-full text-[11px] bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/30">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Cold DM Writer
// =============================================================================

function ColdDMTool({ agent, jobTitle, company, jobDescription }: ToolProps) {
  const [platform, setPlatform] = useState('linkedin');
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleGenerate = async () => {
    setError(null);
    setResult(null);
    setBusy(true);
    const data = await agent.generateColdDM({ job_title: jobTitle, company, job_description: jobDescription, platform });
    setBusy(false);
    if (data?.success) setResult(data.content);
    else setError(data?.error || 'Generation failed.');
  };

  return (
    <ToolShell
      title="Cold DM Writer"
      icon={Send}
      disabled={!jobTitle.trim() || !agent.resume}
      hasResume={!!agent.resume}
      onGenerate={handleGenerate}
      generating={busy}
      actionLabel="Write My DM"
      result={result}
      error={error}
      extraControls={
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          className="px-3 py-1.5 bg-[#030712] border border-[#1E3A8A]/50 rounded-lg text-xs text-[#94A3B8] focus:outline-none focus:border-[#10B981]/50 cursor-pointer"
        >
          <option value="linkedin">LinkedIn</option>
          <option value="email">Email</option>
          <option value="twitter">X / Twitter</option>
        </select>
      }
    />
  );
}

// =============================================================================
// Interview Prep
// =============================================================================

function InterviewPrepTool({ agent, jobTitle, company, jobDescription }: ToolProps) {
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleGenerate = async () => {
    setError(null);
    setResult(null);
    setBusy(true);
    const data = await agent.generateInterviewPrep({ job_title: jobTitle, company, job_description: jobDescription });
    setBusy(false);
    if (data?.success) setResult(data.content);
    else setError(data?.error || 'Generation failed.');
  };

  return (
    <ToolShell
      title="Interview Prep"
      icon={MessagesSquare}
      disabled={!jobTitle.trim() || !agent.resume}
      hasResume={!!agent.resume}
      onGenerate={handleGenerate}
      generating={busy}
      actionLabel="Prep Me For This Interview"
      result={result}
      error={error}
    />
  );
}

// =============================================================================
// Follow Up Email
// =============================================================================

function FollowUpTool({ agent, jobTitle, company, jobDescription }: ToolProps) {
  const [stage, setStage] = useState('post_application');
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleGenerate = async () => {
    setError(null);
    setResult(null);
    setBusy(true);
    const data = await agent.generateFollowUp({ job_title: jobTitle, company, job_description: jobDescription, stage });
    setBusy(false);
    if (data?.success) setResult(data.content);
    else setError(data?.error || 'Generation failed.');
  };

  return (
    <ToolShell
      title="Follow Up Email"
      icon={Mail}
      disabled={!jobTitle.trim() || !agent.resume}
      hasResume={!!agent.resume}
      onGenerate={handleGenerate}
      generating={busy}
      actionLabel="Write Follow Up"
      result={result}
      error={error}
      extraControls={
        <select
          value={stage}
          onChange={(e) => setStage(e.target.value)}
          className="px-3 py-1.5 bg-[#030712] border border-[#1E3A8A]/50 rounded-lg text-xs text-[#94A3B8] focus:outline-none focus:border-[#10B981]/50 cursor-pointer"
        >
          <option value="post_application">After Applying</option>
          <option value="post_interview">After Interview</option>
        </select>
      }
    />
  );
}
