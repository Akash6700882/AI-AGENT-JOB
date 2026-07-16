import { useCallback, useState, useEffect } from 'react';
import { Upload, FileText, CheckCircle, Sparkles, Mail, Phone, MapPin, Code } from 'lucide-react';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface ResumeUploadProps {
  agent: any;
}

export function ResumeUpload({ agent }: ResumeUploadProps) {
  const [dragOver, setDragOver] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  // Local state to force React to re-render when the agent's data changes
  const [resumeData, setResumeData] = useState(agent.resume);

  // Sync local state if agent.resume changes from outside (e.g., on initial load)
  useEffect(() => {
    setResumeData(agent.resume);
  }, [agent.resume]);

  const processUpload = async (file: File) => {
    try {
      setIsUploading(true);
      setUploadedFile(file);
      
      // Call the agent's upload method and wait for the backend response
      await agent.uploadResume(file);
      
      // Update local state with a new object reference to trigger UI refresh
      setResumeData({ ...agent.resume });
    } catch (error) {
      console.error("Resume upload failed:", error);
      alert("Failed to upload resume. Please check the backend connection.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file && (file.name.endsWith('.pdf') || file.name.endsWith('.docx') || file.name.endsWith('.txt'))) {
        processUpload(file);
      }
    },
    [agent]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        processUpload(file);
      }
    },
    [agent]
  );

  const resume = resumeData;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Upload Area */}
      <Card className="card-gradient overflow-hidden py-0">
        <div className="p-4 border-b flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-muted-foreground">Resume Upload</span>
        </div>
        <div className="p-6">
          {isUploading ? (
            <div className="p-12 text-center animate-pulse">
              <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-primary animate-spin" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Analyzing Resume...</h3>
              <p className="text-sm text-muted-foreground">Extracting skills and experience with AI</p>
            </div>
          ) : !resume ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-12 text-center transition-all duration-300 cursor-pointer ${
                dragOver
                  ? 'border-primary bg-primary/5'
                  : 'border-border/50 hover:border-border bg-background/30'
              }`}
              onClick={() => document.getElementById('resume-input')?.click()}
            >
              <input
                id="resume-input"
                type="file"
                accept=".pdf,.docx,.doc,.txt"
                onChange={handleFileSelect}
                className="hidden"
              />
              <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto mb-4">
                <Upload className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Drop your resume here</h3>
              <p className="text-sm text-muted-foreground mb-4">or click to browse. Supports PDF, DOCX, and TXT files.</p>
              <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                <Badge variant="outline" className="bg-background">PDF</Badge>
                <Badge variant="outline" className="bg-background">DOCX</Badge>
                <Badge variant="outline" className="bg-background">TXT</Badge>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4 p-4 bg-background rounded-xl border border-primary/30">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium">
                  {uploadedFile?.name || 'Resume loaded'}
                </div>
                <div className="text-xs text-muted-foreground">
                  {resume.skills?.length || 0} skills extracted
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setResumeData(null);
                  setUploadedFile(null);
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                Replace
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Resume Details Grid */}
      {resume && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in-up">
          {/* Profile Overview */}
          <Card className="card-gradient overflow-hidden py-0">
            <div className="p-4 border-b flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-muted-foreground">Profile Overview</span>
            </div>
            <div className="p-4 space-y-3">
              {resume.name && <div className="text-lg font-semibold">{resume.name}</div>}
              <div className="space-y-2">
                {resume.email && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="w-4 h-4 text-primary" />
                    {resume.email}
                  </div>
                )}
                {resume.phone && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="w-4 h-4 text-primary" />
                    {resume.phone}
                  </div>
                )}
                {resume.location && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="w-4 h-4 text-primary" />
                    {resume.location}
                  </div>
                )}
              </div>
              {resume.summary && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground leading-relaxed line-clamp-4">{resume.summary}</p>
                </div>
              )}
            </div>
          </Card>

          {/* Skills Section */}
          <Card className="card-gradient overflow-hidden py-0">
            <div className="p-4 border-b flex items-center gap-2">
              <Code className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-muted-foreground">
                Skills ({resume.skills?.length || 0})
              </span>
            </div>
            <div className="p-4">
              <div className="flex flex-wrap gap-2">
                {resume.skills?.map((skill: string, idx: number) => (
                  <Badge
                    key={`${skill}-${idx}`}
                    variant="outline"
                    className="border-primary/30 bg-primary/10 text-primary text-sm px-3 py-1.5"
                  >
                    {skill}
                  </Badge>
                )) || <p className="text-sm text-muted-foreground">No skills detected</p>}
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}