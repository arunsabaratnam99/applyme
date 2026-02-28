'use client';

import React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  className?: string;
  fromResume?: string[];
}

export function TagInput({ tags, onChange, placeholder = 'Type and press Enter…', className, fromResume = [] }: TagInputProps) {
  const [input, setInput] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);

  function addTag(raw: string) {
    const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
    const next = [...tags];
    for (const p of parts) {
      if (p && !next.includes(p)) next.push(p);
    }
    onChange(next);
    setInput('');
  }

  function removeTag(tag: string) {
    onChange(tags.filter((t) => t !== tag));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (input.trim()) addTag(input);
    } else if (e.key === 'Backspace' && !input && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  }

  return (
    <div
      className={cn(
        'flex flex-wrap gap-1.5 min-h-[44px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm cursor-text transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background',
        className,
      )}
      onClick={() => inputRef.current?.focus()}
    >
      {tags.map((tag) => (
        <span
          key={tag}
          className={cn(
            'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium transition-colors',
            fromResume.includes(tag)
              ? 'bg-primary/20 text-primary border border-primary/30'
              : 'bg-muted text-foreground border border-border',
          )}
        >
          {fromResume.includes(tag) && (
            <span className="text-[9px] font-semibold uppercase tracking-wide opacity-60 mr-0.5">AI</span>
          )}
          {tag}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); removeTag(tag); }}
            className="ml-0.5 rounded-sm opacity-60 hover:opacity-100 transition-opacity"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => { if (input.trim()) addTag(input); }}
        placeholder={tags.length === 0 ? placeholder : ''}
        className="flex-1 min-w-[120px] bg-transparent outline-none placeholder:text-muted-foreground text-sm"
      />
    </div>
  );
}
