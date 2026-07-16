import { useState } from 'react';
import { ClipboardList, CheckCircle, Clock, XCircle, Star, ChevronDown, ExternalLink, Trash2 } from 'lucide-react';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface ApplicationsPanelProps {
  agent: any;
}

// No design token exists for the "applied" (cyan) status this app previously
// hardcoded, so it's a dimmer shade of primary instead — distinguishable from
// interview/offer/accepted (full primary) without inventing an off-palette color.
const statusConfig: Record<string, { text: string; bg: string; icon: any; label: string }> = {
  pending: { text: 'text-accent', bg: 'bg-accent/15', icon: Clock, label: 'Pending' },
  applied: { text: 'text-primary/70', bg: 'bg-primary/10', icon: CheckCircle, label: 'Applied' },
  rejected: { text: 'text-destructive', bg: 'bg-destructive/15', icon: XCircle, label: 'Rejected' },
  interview: { text: 'text-primary', bg: 'bg-primary/15', icon: Star, label: 'Interview' },
  offer: { text: 'text-primary', bg: 'bg-primary/15', icon: Star, label: 'Offer' },
  accepted: { text: 'text-primary', bg: 'bg-primary/15', icon: CheckCircle, label: 'Accepted' },
  declined: { text: 'text-muted-foreground', bg: 'bg-muted', icon: XCircle, label: 'Declined' },
};

export function ApplicationsPanel({ agent }: ApplicationsPanelProps) {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expandedApp, setExpandedApp] = useState<string | null>(null);

  const filteredApps = statusFilter === 'all'
    ? agent.applications
    : agent.applications.filter((a: any) => a.status === statusFilter);

  const stats = agent.statistics?.applications || {};

  const statusCounts = [
    { key: 'all', label: 'All', count: stats.total || 0 },
    { key: 'pending', label: 'Pending', count: stats.pending || 0 },
    { key: 'applied', label: 'Applied', count: stats.applied || 0 },
    { key: 'interview', label: 'Interview', count: stats.interview || 0 },
    { key: 'rejected', label: 'Rejected', count: stats.rejected || 0 },
    { key: 'offer', label: 'Offer', count: stats.offer || 0 },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: stats.total || 0, className: '' },
          { label: 'Applied', value: stats.applied || 0, className: 'text-primary/70' },
          { label: 'Interview Rate', value: `${stats.interview_rate || 0}%`, className: 'text-primary' },
          { label: 'Response Rate', value: `${stats.response_rate || 0}%`, className: 'text-accent' },
        ].map((stat) => (
          <Card key={stat.label} className="card-gradient p-4 text-center">
            <div className={`text-2xl font-mono-data font-bold ${stat.className}`}>
              {stat.value}
            </div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">
              {stat.label}
            </div>
          </Card>
        ))}
      </div>

      {/* Applications List */}
      <Card className="card-gradient overflow-hidden py-0">
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-muted-foreground">
              Applications <span className="text-primary font-mono-data">({filteredApps.length})</span>
            </span>
          </div>
        </div>

        {/* Status Filters */}
        <div className="px-4 py-3 border-b flex flex-wrap gap-2">
          {statusCounts.map((s) => (
            <Button
              key={s.key}
              variant="outline"
              size="sm"
              onClick={() => setStatusFilter(s.key)}
              className={
                statusFilter === s.key
                  ? 'border-primary/30 bg-primary/20 text-primary hover:bg-primary/20 hover:text-primary'
                  : 'border-transparent text-muted-foreground'
              }
            >
              {s.label} ({s.count})
            </Button>
          ))}
        </div>

        {/* Applications */}
        {filteredApps.length === 0 ? (
          <div className="p-12 text-center">
            <ClipboardList className="w-12 h-12 text-border mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {statusFilter === 'all'
                ? 'No applications yet. Search for jobs and start applying!'
                : `No applications with status "${statusFilter}"`}
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {filteredApps.map((app: any) => {
              const config = statusConfig[app.status] || statusConfig.pending;
              const StatusIcon = config.icon;
              const isExpanded = expandedApp === app.id;

              return (
                <div
                  key={app.id}
                  className="group hover:bg-secondary/20 transition-all duration-200"
                >
                  <div
                    className="p-4 flex items-center justify-between cursor-pointer"
                    onClick={() => setExpandedApp(isExpanded ? null : app.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${config.bg}`}>
                        <StatusIcon className={`w-5 h-5 ${config.text}`} />
                      </div>
                      <div>
                        <div className="text-sm font-medium">
                          {app.job_title}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {app.company} • {app.location}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <Badge variant="outline" className={`border-transparent ${config.text} ${config.bg}`}>
                          {config.label}
                        </Badge>
                        <div className="text-[10px] text-muted-foreground mt-1">
                          {app.applied_date ? new Date(app.applied_date).toLocaleDateString() : 'N/A'}
                        </div>
                      </div>
                      <ChevronDown
                        className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      />
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-4 animate-fade-in-up">
                      <div className="bg-background rounded-lg p-4 space-y-3">
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>Match Score: <span className="text-primary font-mono-data font-semibold">{Math.round(app.match_score)}%</span></span>
                          {app.salary && <span>Salary: {app.salary}</span>}
                          <span>Source: {app.source}</span>
                        </div>

                        {app.notes && (
                          <div className="text-xs text-muted-foreground">
                            <span className="text-accent">Notes:</span> {app.notes}
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" asChild>
                            <a
                              href={app.job_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink className="w-3 h-3" />
                              View Job
                            </a>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              agent.deleteApplication(app.id);
                            }}
                            className="border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive"
                          >
                            <Trash2 className="w-3 h-3" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
