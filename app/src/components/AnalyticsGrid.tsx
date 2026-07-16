import { Target, TrendingUp, BarChart3 } from 'lucide-react';

import { Card, CardHeader, CardContent } from '@/components/ui/card';

interface AnalyticsGridProps {
  agent: any;
}

export function AnalyticsGrid({ agent }: AnalyticsGridProps) {

  // ✅ GLOBAL SAFE AGENT
  const safeAgent = {
    jobs: [],
    applications: [],
    weeklyActivity: [],
    statistics: {},
    ...agent,
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

      {/* Funnel */}
      <Card className="py-0 overflow-hidden">
        <CardHeader className="p-4 border-b flex-row items-center gap-2 space-y-0">
          <BarChart3 className="w-4 h-4 text-primary" />
          <span className="text-sm text-muted-foreground">Pipeline Funnel</span>
        </CardHeader>
        <CardContent className="p-6">
          <SuccessFunnel agent={safeAgent} />
        </CardContent>
      </Card>

      {/* Daily Target */}
      <Card className="py-0 overflow-hidden">
        <CardHeader className="p-4 border-b flex-row items-center gap-2 space-y-0">
          <Target className="w-4 h-4 text-primary" />
          <span className="text-sm text-muted-foreground">Daily Target</span>
        </CardHeader>
        <CardContent className="p-6 flex justify-center">
          <DailyTarget agent={safeAgent} />
        </CardContent>
      </Card>

      {/* Weekly */}
      <Card className="py-0 overflow-hidden">
        <CardHeader className="p-4 border-b flex-row items-center gap-2 space-y-0">
          <TrendingUp className="w-4 h-4 text-primary" />
          <span className="text-sm text-muted-foreground">Weekly Activity</span>
        </CardHeader>
        <CardContent className="p-6">
          <WeeklyChart agent={safeAgent} />
        </CardContent>
      </Card>

    </div>
  );
}

function SuccessFunnel({ agent }: { agent: any }) {
  const stats = agent?.statistics?.applications || {};

  const jobs = agent?.jobs || [];

  const stages = [
    { label: 'Scanned', value: stats.total || 0 },
    { label: 'Matched', value: jobs.length },
    { label: 'Applied', value: stats.applied || 0 },
    { label: 'Interview', value: stats.interview || 0 },
  ];

  const maxVal = Math.max(...stages.map((s) => s.value), 1);

  return (
    <div className="space-y-3">
      {stages.map((stage, i) => {
        const widthPercent = 30 + (stage.value / maxVal) * 70;

        return (
          <div key={stage.label} className="flex items-center gap-3">
            <div className="w-16 text-xs text-muted-foreground text-right">
              {stage.label}
            </div>

            <div className="flex-1 h-8 bg-background rounded">
              <div
                className="h-full bg-primary flex items-center justify-end pr-2"
                style={{
                  width: `${widthPercent}%`,
                  transitionDelay: `${i * 100}ms`,
                }}
              >
                <span className="text-xs text-primary-foreground">{stage.value}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DailyTarget({ agent }: { agent: any }) {

  const applications = agent?.applications || [];

  const dailyGoal = 10;

  const applied = applications.filter((a: any) => a.status === 'applied').length;

  const percentage = Math.min((applied / dailyGoal) * 100, 100);

  const circumference = 2 * Math.PI * 50;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative w-40 h-40">

      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="50" fill="none" stroke="currentColor" strokeWidth="8" className="text-border" />
        <circle
          cx="60"
          cy="60"
          r="50"
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="text-primary"
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-xl">
          {applied}/{dailyGoal}
        </div>
        <div className="text-xs text-muted-foreground">Applied Today</div>
      </div>
    </div>
  );
}

function WeeklyChart({ agent }: { agent: any }) {

  const activity = agent?.weeklyActivity || [];

  const data =
    activity.length > 0
      ? activity
      : [
          { week: 'W1', applied: 3, responses: 1 },
          { week: 'W2', applied: 5, responses: 2 },
          { week: 'W3', applied: 2, responses: 0 },
          { week: 'W4', applied: 7, responses: 3 },
        ];

  const maxVal = Math.max(
    ...data.flatMap((d: any) => [d.applied, d.responses || 0]),
    1
  );

  return (
    <div className="flex items-end gap-3 h-32">

      {data.map((week: any, i: number) => (
        <div key={i} className="flex-1 flex flex-col items-center">

          <div className="w-full flex items-end gap-1">

            <div
              className="flex-1 bg-primary"
              style={{ height: `${(week.applied / maxVal) * 80}px` }}
            />

            <div
              className="flex-1 bg-accent"
              style={{ height: `${((week.responses || 0) / maxVal) * 80}px` }}
            />

          </div>

          <span className="text-xs text-muted-foreground">
            {week.week || `W${i + 1}`}
          </span>

        </div>
      ))}
    </div>
  );
}