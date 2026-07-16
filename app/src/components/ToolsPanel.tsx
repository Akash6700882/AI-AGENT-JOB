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
} from 'lucide-react';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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
      <Tabs value={activeTool} onValueChange={(v) => setActiveTool(v as Tool)}>
        <TabsList className="h-auto flex-wrap justify-start gap-2 bg-transparent p-0">
          {tools.map((t) => {
            const Icon = t.icon;
            return (
              <TabsTrigger
                key={t.id}
                value={t.id}
                className="gap-2 rounded-lg border border-transparent px-4 py-2 text-sm font-medium data-[state=active]:border-primary/30 data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:shadow-none"
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {/* Shared job context */}
      <Card className="card-gradient overflow-hidden py-0">
        <CardHeader className="flex-row items-center justify-between gap-3 space-y-0 border-b px-4 py-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-muted-foreground">Target Job</span>
          </div>
          {agent.jobs?.length > 0 && (
            <Select onValueChange={(v) => v && loadFromJob(v)}>
              <SelectTrigger size="sm" className="text-xs">
                <SelectValue placeholder="Load from matched jobs..." />
              </SelectTrigger>
              <SelectContent>
                {agent.jobs.map((j: any) => (
                  <SelectItem key={j.id} value={j.id}>
                    {j.title} — {j.company}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
          <Input
            type="text"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            placeholder="Job title"
          />
          <Input
            type="text"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Company"
          />
          <Textarea
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder="Paste the job description here (or load one from your matched jobs above)..."
            rows={4}
            className="md:col-span-2 resize-none"
          />
        </CardContent>
      </Card>

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
    <Card className="card-gradient overflow-hidden py-0 animate-fade-in-up">
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0 border-b px-4 py-4">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-muted-foreground">{title}</span>
        </div>
        <div className="flex items-center gap-3">
          {extraControls}
          <Button onClick={onGenerate} disabled={disabled || generating} size="sm" className="font-semibold">
            {generating ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                {actionLabel}
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        {!hasResume && (
          <p className="mb-3 text-xs text-amber-500">
            Upload a resume first — every tool here is grounded in your real resume data.
          </p>
        )}
        {error && (
          <Alert variant="destructive" className="mb-3 py-2">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {result ? (
          <div className="relative">
            <Button
              onClick={handleCopy}
              variant="outline"
              size="sm"
              className="absolute top-3 right-3 h-auto gap-1.5 px-2.5 py-1 text-[10px]"
            >
              {copied ? <Check className="w-3 h-3 text-primary" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
            <pre className="whitespace-pre-wrap rounded-lg bg-background p-4 pr-20 font-sans text-sm leading-relaxed text-foreground">
              {result}
            </pre>
          </div>
        ) : (
          !error && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Fill in the target job above and click "{actionLabel}" to generate.
            </p>
          )
        )}
      </CardContent>
    </Card>
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
        <Tabs value={mode} onValueChange={(v) => setMode(v as 'resume' | 'cover-letter')}>
          <TabsList className="h-8">
            <TabsTrigger value="cover-letter" className="text-xs">Cover Letter</TabsTrigger>
            <TabsTrigger value="resume" className="text-xs">Tailored Resume</TabsTrigger>
          </TabsList>
        </Tabs>
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
    <Card className="card-gradient overflow-hidden py-0 animate-fade-in-up">
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0 border-b px-4 py-4">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-muted-foreground">Job Scorer</span>
        </div>
        <Button onClick={handleGenerate} disabled={!jobDescription.trim() || !agent.resume || busy} size="sm" className="font-semibold">
          {busy ? (
            <>
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              Scoring...
            </>
          ) : (
            <>
              <Target className="w-3.5 h-3.5" />
              Score My Match
            </>
          )}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4 p-4">
        {!agent.resume && (
          <p className="text-xs text-amber-500">Upload a resume first to score a job against it.</p>
        )}
        {error && (
          <Alert variant="destructive" className="py-2">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {!score && !error && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Paste a job description above (a pasted-in one from any company's careers page works too) and click
            "Score My Match".
          </p>
        )}
        {score && (
          <>
            <div className="flex items-center gap-4">
              <div className="relative h-20 w-20 flex-shrink-0">
                <svg className="h-full w-full -rotate-90" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="34" fill="none" stroke="hsl(var(--border))" strokeWidth="6" />
                  <circle
                    cx="40"
                    cy="40"
                    r="34"
                    fill="none"
                    stroke="hsl(var(--primary))"
                    strokeWidth="6"
                    strokeDasharray={2 * Math.PI * 34}
                    strokeDashoffset={2 * Math.PI * 34 * (1 - score.overall_score / 100)}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center font-mono-data text-lg font-bold text-foreground">
                  {Math.round(score.overall_score)}
                </div>
              </div>
              <div className="grid flex-1 grid-cols-2 gap-2 text-xs">
                {[
                  { label: 'Skills', value: score.skill_match_score },
                  { label: 'Title Fit', value: score.title_match_score },
                  { label: 'Experience', value: score.experience_match_score },
                  { label: 'Location', value: score.location_match_score },
                ].map((s) => (
                  <div key={s.label} className="flex items-center justify-between rounded-lg bg-background px-3 py-1.5">
                    <span className="text-muted-foreground">{s.label}</span>
                    <span className="font-mono-data text-primary">{Math.round(s.value)}%</span>
                  </div>
                ))}
              </div>
            </div>

            {score.matched_skills?.length > 0 && (
              <div>
                <div className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">Matched Skills</div>
                <div className="flex flex-wrap gap-1.5">
                  {score.matched_skills.map((s: string) => (
                    <Badge key={s} variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                      {s}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {score.missing_skills?.length > 0 && (
              <div>
                <div className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">Missing Skills</div>
                <div className="flex flex-wrap gap-1.5">
                  {score.missing_skills.map((s: string) => (
                    <Badge key={s} variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-500">
                      {s}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
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
        <Select value={platform} onValueChange={setPlatform}>
          <SelectTrigger size="sm" className="text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="linkedin">LinkedIn</SelectItem>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="twitter">X / Twitter</SelectItem>
          </SelectContent>
        </Select>
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
        <Select value={stage} onValueChange={setStage}>
          <SelectTrigger size="sm" className="text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="post_application">After Applying</SelectItem>
            <SelectItem value="post_interview">After Interview</SelectItem>
          </SelectContent>
        </Select>
      }
    />
  );
}
