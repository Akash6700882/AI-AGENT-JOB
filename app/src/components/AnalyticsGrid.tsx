import { Target, TrendingUp, BarChart3 } from 'lucide-react';

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
      <div className="rounded-xl border bg-[#0A1128]">
        <div className="p-4 border-b flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-green-400" />
          <span className="text-sm text-gray-400">Pipeline Funnel</span>
        </div>
        <div className="p-6">
          <SuccessFunnel agent={safeAgent} />
        </div>
      </div>

      {/* Daily Target */}
      <div className="rounded-xl border bg-[#0A1128]">
        <div className="p-4 border-b flex items-center gap-2">
          <Target className="w-4 h-4 text-green-400" />
          <span className="text-sm text-gray-400">Daily Target</span>
        </div>
        <div className="p-6 flex justify-center">
          <DailyTarget agent={safeAgent} />
        </div>
      </div>

      {/* Weekly */}
      <div className="rounded-xl border bg-[#0A1128]">
        <div className="p-4 border-b flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-green-400" />
          <span className="text-sm text-gray-400">Weekly Activity</span>
        </div>
        <div className="p-6">
          <WeeklyChart agent={safeAgent} />
        </div>
      </div>

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
            <div className="w-16 text-xs text-gray-400 text-right">
              {stage.label}
            </div>

            <div className="flex-1 h-8 bg-black rounded">
              <div
                className="h-full bg-green-500 flex items-center justify-end pr-2"
                style={{
                  width: `${widthPercent}%`,
                  transitionDelay: `${i * 100}ms`,
                }}
              >
                <span className="text-xs text-white">{stage.value}</span>
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
        <circle cx="60" cy="60" r="50" fill="none" stroke="#1E3A8A" strokeWidth="8" />
        <circle
          cx="60"
          cy="60"
          r="50"
          fill="none"
          stroke="green"
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-white text-xl">
          {applied}/{dailyGoal}
        </div>
        <div className="text-xs text-gray-400">Applied Today</div>
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
              className="flex-1 bg-green-500"
              style={{ height: `${(week.applied / maxVal) * 80}px` }}
            />

            <div
              className="flex-1 bg-yellow-500"
              style={{ height: `${((week.responses || 0) / maxVal) * 80}px` }}
            />

          </div>

          <span className="text-xs text-gray-400">
            {week.week || `W${i + 1}`}
          </span>

        </div>
      ))}
    </div>
  );
}