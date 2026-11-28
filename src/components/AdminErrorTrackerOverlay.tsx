import { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Database,
  RefreshCw,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react';
import { AdminErrorNotification } from '../types/portal';
import { ADMIN_MONITORED_FEEDS } from '../utils/adminErrorTracker';
import { formatIstDateTime } from '../utils/adminRecordTools';

interface AdminErrorTrackerOverlayProps {
  isOpen: boolean;
  errors: AdminErrorNotification[];
  isRetrying: boolean;
  onClose: () => void;
  onRetrySubscriptions: () => Promise<void>;
  onDismissError: (errorId: string) => void;
  onClearAll: () => void;
}

type OverlayFilter = 'active' | 'resolved' | 'all';

export function AdminErrorTrackerOverlay({
  isOpen,
  errors,
  isRetrying,
  onClose,
  onRetrySubscriptions,
  onDismissError,
  onClearAll,
}: AdminErrorTrackerOverlayProps) {
  const [filter, setFilter] = useState<OverlayFilter>('active');
  const [copiedReport, setCopiedReport] = useState(false);

  const visibleErrors = errors.filter((item) => !item.dismissed);
  const activeErrors = visibleErrors.filter((item) => !item.resolved);
  const resolvedErrors = visibleErrors.filter((item) => item.resolved);

  useEffect(() => {
    if (!isOpen) return;
    if (activeErrors.length > 0) {
      setFilter('active');
    } else if (visibleErrors.length > 0) {
      setFilter('all');
    }
  }, [isOpen, activeErrors.length, visibleErrors.length]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const displayedErrors =
    filter === 'active'
      ? activeErrors
      : filter === 'resolved'
        ? resolvedErrors
        : visibleErrors;

  const activeFeedKeys = new Set(activeErrors.map((e) => e.feedKey));

  const handleCopyDiagnostics = async () => {
    const payload = {
      generatedAtIst: formatIstDateTime(new Date().toISOString()),
      activeCount: activeErrors.length,
      resolvedCount: resolvedErrors.length,
      errors: visibleErrors.map((err) => ({
        feedKey: err.feedKey,
        sourceLabel: err.sourceLabel,
        database: err.database,
        operationType: err.operationType,
        path: err.path,
        code: err.code,
        severity: err.severity,
        resolved: err.resolved,
        occurrences: err.occurrences,
        friendlyMessage: err.friendlyMessage,
        rawMessage: err.rawMessage,
        lastOccurredAt: err.lastOccurredAt,
      })),
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setCopiedReport(true);
      window.setTimeout(() => setCopiedReport(false), 2000);
    } catch {
      // Ignore clipboard failures in restricted contexts
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-900/60 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-error-tracker-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white h-full shadow-2xl border-l border-slate-200 flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Overlay Header */}
        <div className="bg-gradient-to-r from-[#041C3F] via-[#062856] to-[#083B7E] text-white px-5 py-4 border-b border-white/15 shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <ShieldAlert
                  className={`w-5 h-5 shrink-0 ${
                    activeErrors.length > 0 ? 'text-red-300' : 'text-[#F6D574]'
                  }`}
                  aria-hidden="true"
                />
                <h2
                  id="admin-error-tracker-title"
                  className="font-display text-lg font-bold text-white truncate"
                >
                  Admin Error Tracker &amp; Firestore Diagnostics
                </h2>
              </div>
              <p className="mt-1 text-xs text-slate-200">
                {activeErrors.length > 0
                  ? `${activeErrors.length} active error notification${activeErrors.length === 1 ? '' : 's'} across Primary & Shared Firestore feeds.`
                  : `All ${ADMIN_MONITORED_FEEDS.length} monitored Firestore feeds are healthy.`}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close error tracker"
              className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white flex items-center justify-center shrink-0 cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Action Bar */}
          <div className="mt-3.5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={isRetrying}
              onClick={() => void onRetrySubscriptions()}
              className="min-h-[36px] px-3.5 py-1.5 rounded-lg bg-[#D4AF37] hover:bg-[#C39E27] disabled:opacity-60 text-[#041C3F] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>{isRetrying ? 'Reconnecting...' : 'Retry All Feeds'}</span>
            </button>

            <button
              type="button"
              disabled={visibleErrors.length === 0}
              onClick={() => void handleCopyDiagnostics()}
              className="min-h-[36px] px-3 py-1.5 rounded-lg bg-white/12 hover:bg-white/20 disabled:opacity-45 border border-white/20 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              {copiedReport ? (
                <Check className="w-3.5 h-3.5 text-emerald-300" aria-hidden="true" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-[#F6D574]" aria-hidden="true" />
              )}
              <span>{copiedReport ? 'Diagnostics Copied' : 'Copy Diagnostics'}</span>
            </button>

            <button
              type="button"
              disabled={visibleErrors.length === 0}
              onClick={onClearAll}
              className="min-h-[36px] px-3 py-1.5 rounded-lg bg-white/10 hover:bg-red-600/80 disabled:opacity-45 border border-white/20 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Clear All</span>
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-slate-50">
          {/* Live Feed Health Matrix */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#063B7A] inline-flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-[#0A8E43]" aria-hidden="true" />
                <span>Monitored Firestore Feeds</span>
              </h3>
              <span className="text-[11px] font-medium text-slate-500 tabular-nums">
                {ADMIN_MONITORED_FEEDS.length - activeFeedKeys.size}/{ADMIN_MONITORED_FEEDS.length} Healthy
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ADMIN_MONITORED_FEEDS.map((feed) => {
                const hasError = activeFeedKeys.has(feed.feedKey);
                return (
                  <div
                    key={feed.feedKey}
                    className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-xs ${
                      hasError
                        ? 'bg-red-50/80 border-red-200 text-red-900'
                        : 'bg-slate-50 border-slate-200/80 text-slate-700'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{feed.label}</p>
                      <p className="text-[10px] text-slate-500 truncate">
                        {feed.database === 'shared' ? 'Shared DB' : 'Primary DB'} · {feed.path}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        hasError
                          ? 'bg-red-600 text-white'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {hasError ? 'Error' : 'OK'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-200/70 rounded-xl w-fit">
            {(
              [
                { id: 'active', label: `Active (${activeErrors.length})` },
                { id: 'resolved', label: `Resolved (${resolvedErrors.length})` },
                { id: 'all', label: `All (${visibleErrors.length})` },
              ] as Array<{ id: OverlayFilter; label: string }>
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer tabular-nums ${
                  filter === tab.id
                    ? 'bg-white text-[#063B7A] shadow-xs'
                    : 'text-slate-600 hover:text-[#063B7A]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Error Notification List */}
          {displayedErrors.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-50 text-[#0A8E43] flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" aria-hidden="true" />
              </div>
              <h3 className="mt-3 font-display text-base font-bold text-[#063B7A]">
                {filter === 'active'
                  ? 'No Active "Something Went Wrong" Errors'
                  : 'No Tracked Errors in This View'}
              </h3>
              <p className="mt-1 text-xs text-slate-600 max-w-sm mx-auto">
                Any Firestore permission, quota, index, offline, or admin action error will appear here automatically with specific collection and operation context.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {displayedErrors.map((err) => {
                const isResolved = err.resolved;
                const isCritical = !isResolved && err.severity === 'critical';
                return (
                  <article
                    key={err.id}
                    className={`bg-white rounded-xl border p-4 shadow-xs space-y-2.5 ${
                      isResolved
                        ? 'border-emerald-200'
                        : isCritical
                          ? 'border-red-300'
                          : 'border-amber-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {isResolved ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                            <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                            <span>RESOLVED</span>
                          </span>
                        ) : isCritical ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-600 text-white text-[11px] font-bold">
                            <AlertTriangle className="w-3 h-3" aria-hidden="true" />
                            <span>CRITICAL</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500 text-white text-[11px] font-bold">
                            <AlertTriangle className="w-3 h-3" aria-hidden="true" />
                            <span>WARNING</span>
                          </span>
                        )}

                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[#063B7A] text-[11px] font-semibold">
                          <Database className="w-3 h-3" aria-hidden="true" />
                          <span>
                            {err.database === 'shared'
                              ? 'Shared DB'
                              : err.database === 'primary'
                                ? 'Primary DB'
                                : 'Portal API'}
                          </span>
                        </span>

                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono text-[11px]">
                          {err.code}
                        </span>

                        {err.occurrences > 1 && (
                          <span className="px-2 py-0.5 rounded-md bg-red-50 border border-red-200 text-red-700 text-[11px] font-bold tabular-nums">
                            ×{err.occurrences}
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => onDismissError(err.id)}
                        aria-label="Dismiss error notification"
                        className="text-slate-400 hover:text-slate-700 p-1 rounded-md cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="text-xs text-slate-500 font-medium">
                      <span className="font-bold text-[#063B7A]">{err.sourceLabel}</span>
                      {' · '}
                      <span className="font-mono uppercase">{err.operationType}</span>
                      {' · '}
                      <span className="font-mono">{err.path}</span>
                    </div>

                    <p
                      className={`text-sm font-semibold leading-snug ${
                        isResolved
                          ? 'text-slate-700'
                          : isCritical
                            ? 'text-red-700'
                            : 'text-amber-900'
                      }`}
                    >
                      {err.friendlyMessage}
                    </p>

                    {err.rawMessage && err.rawMessage !== err.friendlyMessage && (
                      <div className="bg-slate-900 text-slate-100 rounded-lg px-3 py-2 text-[11px] font-mono break-words">
                        {err.rawMessage}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-slate-500 tabular-nums">
                      <span>Last seen: {formatIstDateTime(err.lastOccurredAt)}</span>
                      {err.resolvedAt && (
                        <span className="text-emerald-700 font-semibold">
                          Recovered: {formatIstDateTime(err.resolvedAt)}
                        </span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
