'use client';

import React from 'react';
import { Upload, FileText, CheckCircle2, AlertCircle, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface ParsedResume {
  displayName?: string;
  roles?: string[];
  keywords?: string[];
  locations?: string[];
  summary?: string;
}

interface ResumeUploadProps {
  onParsed: (data: ParsedResume) => void;
  className?: string;
}

type UploadState = 'idle' | 'dragging' | 'uploading' | 'success' | 'error';

export function ResumeUpload({ onParsed, className }: ResumeUploadProps) {
  const [state, setState] = React.useState<UploadState>('idle');
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function processFile(file: File) {
    if (!file) return;
    const allowed = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowed.includes(file.type)) {
      setState('error');
      setErrorMsg('Only PDF or Word documents are supported.');
      return;
    }

    setFileName(file.name);
    setState('uploading');
    setErrorMsg(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:8787'}/api/resumes`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!res.ok) throw new Error('Upload failed');

      const json = (await res.json()) as {
        parsed?: ParsedResume;
        displayName?: string;
        roles?: string[];
        keywords?: string[];
        locations?: string[];
      };

      const parsed: ParsedResume = json.parsed ?? Object.fromEntries(
        Object.entries({
          displayName: json.displayName,
          roles: json.roles,
          keywords: json.keywords,
          locations: json.locations,
        }).filter(([, v]) => v !== undefined),
      ) as ParsedResume;

      setState('success');
      onParsed(parsed);
    } catch (err) {
      setState('error');
      setErrorMsg(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setState('idle');
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  }

  function reset() {
    setState('idle');
    setFileName(null);
    setErrorMsg(null);
  }

  return (
    <div className={cn('w-full', className)}>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.doc,.docx"
        className="sr-only"
        onChange={handleFileChange}
      />

      {state === 'success' ? (
        <div className="flex items-center gap-3 rounded-xl border border-success/30 bg-success/8 px-4 py-3.5">
          <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">Resume parsed successfully</p>
            <p className="text-xs text-muted-foreground truncate mt-0.5">{fileName}</p>
          </div>
          <button
            type="button"
            onClick={reset}
            className="rounded-md p-1 hover:bg-accent transition-colors flex-shrink-0"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setState('dragging'); }}
          onDragLeave={() => setState((s) => s === 'dragging' ? 'idle' : s)}
          onDrop={handleDrop}
          onClick={() => state !== 'uploading' && inputRef.current?.click()}
          className={cn(
            'relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-all cursor-pointer select-none',
            state === 'dragging'
              ? 'border-primary bg-primary/8 scale-[1.01]'
              : state === 'error'
              ? 'border-destructive/50 bg-destructive/5'
              : state === 'uploading'
              ? 'border-border bg-muted/30 cursor-default pointer-events-none'
              : 'border-border bg-card hover:border-primary/60 hover:bg-primary/5',
          )}
        >
          {state === 'uploading' ? (
            <>
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
              <div>
                <p className="text-sm font-medium text-foreground">Parsing resume…</p>
                <p className="text-xs text-muted-foreground mt-1">Extracting your skills, roles, and info</p>
              </div>
            </>
          ) : state === 'error' ? (
            <>
              <div className="rounded-full bg-destructive/10 p-3">
                <AlertCircle className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{errorMsg ?? 'Upload failed'}</p>
                <p className="text-xs text-primary mt-1 font-medium">Click to try again</p>
              </div>
            </>
          ) : (
            <>
              <div className={cn(
                'rounded-full p-3 transition-colors',
                state === 'dragging' ? 'bg-primary/15' : 'bg-muted',
              )}>
                {state === 'dragging' ? (
                  <Upload className="h-6 w-6 text-primary" />
                ) : (
                  <FileText className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {state === 'dragging' ? 'Drop to upload' : 'Upload your resume'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Drag & drop or <span className="text-primary font-medium">click to browse</span>
                </p>
                <p className="text-[11px] text-muted-foreground mt-2">PDF, DOC, DOCX · Max 5 MB</p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
