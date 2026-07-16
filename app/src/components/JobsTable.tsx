import { Fragment, useState } from 'react';
import { ExternalLink, MapPin, DollarSign, Calendar, Cpu, CheckCircle, Sparkles } from 'lucide-react';
import type { JobResult } from '@/services/api';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';

interface JobsTableProps {
  jobs: JobResult[];
  onApply: (jobId: string) => Promise<any>;
  onSelect?: (job: JobResult | null) => void;
  loading: boolean;
}

export function JobsTable({ jobs, onApply, onSelect: _onSelect, loading }: JobsTableProps) {
  void _onSelect;
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'score' | 'date'>('score');

  const sortedJobs = [...jobs].sort((a, b) => {
    if (sortBy === 'score') return b.match_score - a.match_score;
    return 0;
  });

  const handleApply = async (jobId: string) => {
    setApplyingId(jobId);
    await onApply(jobId);
    setApplyingId(null);
  };

  const toggleExpand = (jobId: string) => {
    setExpandedJob(expandedJob === jobId ? null : jobId);
  };

  if (loading && jobs.length === 0) {
    return (
      <Card className="card-gradient p-12">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">Scanning job boards...</p>
        </div>
      </Card>
    );
  }

  if (jobs.length === 0) {
    return (
      <Card className="card-gradient p-12">
        <div className="flex flex-col items-center gap-4">
          <Sparkles className="w-12 h-12 text-border" />
          <p className="text-muted-foreground text-sm">Configure your search and click "Search" to find matching jobs</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="card-gradient overflow-hidden py-0">
      <div className="p-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-muted-foreground">
            Matched Jobs <span className="text-primary font-mono-data">({jobs.length})</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Sort:</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSortBy('score')}
            className={
              sortBy === 'score'
                ? 'bg-primary/20 text-primary hover:bg-primary/20 hover:text-primary'
                : 'text-muted-foreground'
            }
          >
            Match Score
          </Button>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow className="text-xs text-muted-foreground uppercase tracking-wider hover:bg-transparent">
            <TableHead className="px-4 py-3">Role</TableHead>
            <TableHead className="px-4 py-3">Company</TableHead>
            <TableHead className="px-4 py-3">Match</TableHead>
            <TableHead className="px-4 py-3 hidden md:table-cell">Location</TableHead>
            <TableHead className="px-4 py-3 hidden lg:table-cell">Salary</TableHead>
            <TableHead className="px-4 py-3">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedJobs.map((job, index) => {
            const isExpanded = expandedJob === job.id;
            const isApplying = applyingId === job.id;
            const scoreClass =
              job.match_score >= 80 ? 'text-primary' : job.match_score >= 60 ? 'text-accent' : 'text-muted-foreground';

            return (
              <Fragment key={job.id}>
                <TableRow
                  className="group cursor-pointer animate-fade-in-up"
                  style={{ animationDelay: `${index * 50}ms` }}
                  onClick={() => toggleExpand(job.id)}
                >
                  <TableCell className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-xs font-bold text-primary">
                        {job.company.charAt(0)}
                      </div>
                      <div>
                        <div className="text-sm font-medium group-hover:text-primary transition-colors">
                          {job.title}
                        </div>
                        <div className="text-xs text-muted-foreground">{job.source}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <span className="text-sm text-muted-foreground">{job.company}</span>
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-12 h-2 bg-background rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${scoreClass.replace('text-', 'bg-')}`}
                          style={{ width: `${job.match_score}%` }}
                        />
                      </div>
                      <span className={`text-xs font-mono-data font-semibold ${scoreClass}`}>
                        {Math.round(job.match_score)}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3 hidden md:table-cell">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="w-3 h-3" />
                      {job.location}
                      {job.remote && (
                        <Badge variant="outline" className="ml-1 border-primary/30 bg-primary/10 text-primary text-[10px]">
                          Remote
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3 hidden lg:table-cell">
                    {job.salary ? (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <DollarSign className="w-3 h-3" />
                        {job.salary}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground/50">Not disclosed</span>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleApply(job.id);
                      }}
                      disabled={isApplying}
                      className="border-primary/30 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground"
                    >
                      {isApplying ? (
                        <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <CheckCircle className="w-3 h-3" />
                      )}
                      Apply
                    </Button>
                  </TableCell>
                </TableRow>
                {isExpanded && (
                  <TableRow>
                    <TableCell colSpan={6} className="px-4 py-4 bg-background/50 animate-fade-in-up">
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground leading-relaxed whitespace-normal">
                          {job.description}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {job.matched_skills.map((skill: string) => (
                            <Badge key={skill} variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                              {skill}
                            </Badge>
                          ))}
                          {job.missing_skills.map((skill: string) => (
                            <Badge key={skill} variant="outline" className="border-accent/30 bg-accent/10 text-accent">
                              {skill} (missing)
                            </Badge>
                          ))}
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {job.posted_date}
                          </span>
                          <a
                            href={job.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary/80 hover:text-primary transition-colors flex items-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="w-3 h-3" />
                            View Job Posting
                          </a>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}
