'use client';

import React from 'react';
import useSWR, { mutate } from 'swr';
import { Bell, CheckCheck, Trash2, Building2, Zap, Clock, AlertTriangle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { formatRelativeTime } from '@/lib/format';

interface Notification {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

const KEY = '/api/notifications';

const TYPE_ICON: Record<string, React.ReactNode> = {
  job_match: <Zap className="h-4 w-4 text-primary" />,
  peer_auto_added: <Building2 className="h-4 w-4 text-success" />,
  autofill_expired: <Clock className="h-4 w-4 text-warning" />,
  application_sent: <CheckCheck className="h-4 w-4 text-primary" />,
  quick_apply_error: <AlertTriangle className="h-4 w-4 text-destructive" />,
};

export default function NotificationsPage() {
  const { data, isLoading } = useSWR<Notification[]>(KEY, (url: string) =>
    api.get<Notification[]>(url),
  );

  async function markAllRead() {
    try {
      await api.post('/api/notifications/read-all');
      await mutate(KEY);
    } catch {
      toast({ title: 'Failed to mark all as read', variant: 'destructive' });
    }
  }

  async function markRead(id: string) {
    try {
      await api.post(`/api/notifications/${id}/read`);
      await mutate(KEY);
    } catch {
      toast({ title: 'Failed to mark as read', variant: 'destructive' });
    }
  }

  const unreadCount = data?.filter((n) => !n.readAt).length ?? 0;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Notifications
            {unreadCount > 0 && (
              <span className="ml-1 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground font-medium">
                {unreadCount}
              </span>
            )}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Matches, peer additions, and application updates</p>
        </div>
        {unreadCount > 0 && (
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={markAllRead}>
            <CheckCheck className="h-4 w-4" />
            Mark all read
          </Button>
        )}
      </div>

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      )}

      {data && data.length === 0 && (
        <div className="text-center py-16 text-muted-foreground text-sm">
          <Bell className="h-8 w-8 mx-auto mb-3 opacity-30" />
          <p>No notifications yet.</p>
        </div>
      )}

      {data && data.length > 0 && (
        <div className="space-y-1">
          {data.map((n) => {
            const unread = !n.readAt;
            const message = (n.payload['message'] as string | undefined) ?? n.type;
            const icon = TYPE_ICON[n.type] ?? <Bell className="h-4 w-4 text-muted-foreground" />;

            return (
              <div
                key={n.id}
                className={`group flex items-start gap-3 rounded-lg px-4 py-3 transition-colors cursor-pointer hover:bg-accent/50 ${
                  unread ? 'bg-primary/5' : ''
                }`}
                onClick={() => { if (unread) markRead(n.id); }}
              >
                <div className="mt-0.5 shrink-0">{icon}</div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${unread ? 'font-medium' : 'text-muted-foreground'}`}>
                    {message}
                  </p>
                  {n.type === 'quick_apply_error' && (
                    <div className="mt-1.5 space-y-1">
                      {n.payload['errorDetail'] != null && (
                        <p className="text-xs text-destructive/80 font-mono bg-destructive/5 rounded px-2 py-1 truncate">
                          {`${n.payload['errorDetail']}`}
                        </p>
                      )}
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                        {n.payload['atsType'] != null && (
                          <span className="font-medium">{`${n.payload['atsType']}`.toUpperCase()}</span>
                        )}
                        <a
                          href="/queue"
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-0.5 text-primary hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Fix in Autofill Profiles
                        </a>
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatRelativeTime(n.createdAt)}
                  </p>
                </div>
                {unread && (
                  <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
