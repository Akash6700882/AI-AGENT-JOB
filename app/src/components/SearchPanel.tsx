import { useState } from 'react';
import { Search, MapPin, Briefcase, Globe, Filter } from 'lucide-react';

import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface SearchPanelProps {
  agent: any;
  onSearch: (config: {
    keywords: string;
    location?: string;
    job_type?: string;
    remote_only?: boolean;
  }) => Promise<any[]>;
}

export function SearchPanel({ agent, onSearch }: SearchPanelProps) {
  const [keywords, setKeywords] = useState(agent.resume?.skills?.slice(0, 3).join(' ') || 'Software Engineer');
  const [location, setLocation] = useState('');
  const [jobType, setJobType] = useState('all');
  const [remoteOnly, setRemoteOnly] = useState(true);

  const handleSearch = async () => {
    if (!keywords.trim()) return;
    await onSearch({
      keywords,
      location,
      job_type: jobType === 'all' ? '' : jobType,
      remote_only: remoteOnly,
    });
  };

  return (
    <Card className="card-gradient overflow-hidden py-0">
      <div className="p-4 border-b flex items-center gap-2">
        <Filter className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium text-muted-foreground">Search Parameters</span>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Keywords */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
            <Input
              type="text"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="Job title, keywords..."
              className="pl-10"
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>

          {/* Location */}
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
            <Input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Location"
              className="pl-10"
            />
          </div>

          {/* Job Type */}
          <div className="relative">
            <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10 pointer-events-none" />
            <Select value={jobType} onValueChange={setJobType}>
              <SelectTrigger className="pl-10 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="full-time">Full-time</SelectItem>
                <SelectItem value="contract">Contract</SelectItem>
                <SelectItem value="part-time">Part-time</SelectItem>
                <SelectItem value="internship">Internship</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Search Button */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
              <Switch checked={remoteOnly} onCheckedChange={setRemoteOnly} />
              <Globe className="w-3.5 h-3.5" />
              Remote
            </label>

            <Button
              onClick={handleSearch}
              disabled={agent.searching}
              className="flex-1 glow-green"
            >
              {agent.searching ? (
                <>
                  <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  Scanning...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  Search
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

