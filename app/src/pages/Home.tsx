import { useState } from 'react';
import { useAgentContext } from '@/components/AgentContext';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
import { AgentStatusHUD } from '@/components/AgentStatusHUD';
import { AnalyticsGrid } from '@/components/AnalyticsGrid';
import { JobsTable } from '@/components/JobsTable';
import { ApplicationsPanel } from '@/components/ApplicationsPanel';
import { ResumeUpload } from '@/components/ResumeUpload';
import { SearchPanel } from '@/components/SearchPanel';
import { Toast } from '@/components/Toast';
import type { JobResult } from '@/services/api';

type View = 'dashboard' | 'jobs' | 'applications' | 'resume';

export default function Home() {
  const agent = useAgentContext();
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [, setSelectedJob] = useState<JobResult | null>(null);

  return (
    <div className="flex h-screen w-full bg-[#030712] overflow-hidden">
      {/* Sidebar */}
      <Sidebar currentView={currentView} onViewChange={setCurrentView} agent={agent} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <TopBar agent={agent} currentView={currentView} onViewChange={setCurrentView} />

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-8 py-6 scanline">
          {currentView === 'dashboard' && (
            <div className="space-y-6 animate-fade-in-up">
              <AgentStatusHUD agent={agent} />
              <AnalyticsGrid agent={agent} />
            </div>
          )}

          {currentView === 'jobs' && (
            <div className="space-y-6 animate-fade-in-up">
              <SearchPanel agent={agent} onSearch={agent.searchJobs} />
              <JobsTable
                jobs={agent.jobs}
                onApply={agent.applyToJob}
                onSelect={setSelectedJob}
                loading={agent.searching}
              />
            </div>
          )}

          {currentView === 'applications' && (
            <div className="animate-fade-in-up">
              <ApplicationsPanel agent={agent} />
            </div>
          )}

          {currentView === 'resume' && (
            <div className="animate-fade-in-up">
              <ResumeUpload agent={agent} />
            </div>
          )}
        </div>
      </div>

      {/* Toast Notification */}
      {agent.toast && (
        <Toast
          message={agent.toast.message}
          type={agent.toast.type}
          onClose={() => {}}
        />
      )}
    </div>
  );
}
