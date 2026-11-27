export type OfflineApiMethod = 'POST';

export interface OfflineApiQueueItem {
  id: string;
  url: string;
  method: OfflineApiMethod;
  body: string;
  includeAuth: boolean;
  label: string;
  createdAt: string;
}

export const OFFLINE_CACHE_KEYS = {
  approvedJobs: 'vcs_cache_approved_jobs_v1',
  insightsPosts: 'vcs_cache_insights_posts_v1',
  adminApplications: 'vcs_cache_admin_apps_v1',
  companyRequirements: 'vcs_cache_company_reqs_v1',
  candidateApplications: 'vcs_cache_candidate_apps_v1',
} as const;

const API_OUTBOX_KEY = 'vcs_api_offline_outbox_v1';
const SHARED_OUTBOX_KEY = 'vcs_shared_sync_outbox_v1';
const MAX_API_OUTBOX = 60;

type OfflineStateListener = () => void;

const listeners = new Set<OfflineStateListener>();
let authTokenProvider: (() => string | null) | null = null;
let visitorIdProvider: (() => string) | null = null;
let apiFlushPromise: Promise<void> | null = null;
let apiDaemonStarted = false;

export function registerOfflineAuthProviders(
  getAuthToken: () => string | null,
  getVisitorId: () => string
): void {
  authTokenProvider = getAuthToken;
  visitorIdProvider = getVisitorId;
}

function notifyOfflineListeners(): void {
  listeners.forEach((cb) => {
    try {
      cb();
    } catch {
      // Ignore subscriber errors
    }
  });
}

export function subscribeOfflineState(listener: OfflineStateListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function readApiOutbox(): OfflineApiQueueItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(API_OUTBOX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as OfflineApiQueueItem[]) : [];
  } catch {
    return [];
  }
}

function writeApiOutbox(items: OfflineApiQueueItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    if (items.length === 0) {
      window.localStorage.removeItem(API_OUTBOX_KEY);
    } else {
      window.localStorage.setItem(
        API_OUTBOX_KEY,
        JSON.stringify(items.slice(-MAX_API_OUTBOX))
      );
    }
  } catch {
    // Fallback: strip base64 PDF blobs from oldest items if localStorage quota is tight
    try {
      const compact = items.slice(-MAX_API_OUTBOX).map((item) => {
        try {
          const parsed = JSON.parse(item.body) as Record<string, unknown>;
          if (typeof parsed.resumeBase64 === 'string' && parsed.resumeBase64.length > 0) {
            parsed.resumeBase64 = '';
            return { ...item, body: JSON.stringify(parsed) };
          }
        } catch {
          // Keep original
        }
        return item;
      });
      window.localStorage.setItem(API_OUTBOX_KEY, JSON.stringify(compact));
    } catch {
      // Ignore quota errors
    }
  }
  notifyOfflineListeners();
}

export function enqueueOfflineApiRequest(input: {
  id?: string;
  url: string;
  body: unknown;
  includeAuth: boolean;
  label: string;
}): OfflineApiQueueItem {
  const item: OfflineApiQueueItem = {
    id:
      input.id ||
      `api_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    url: input.url,
    method: 'POST',
    body: typeof input.body === 'string' ? input.body : JSON.stringify(input.body),
    includeAuth: input.includeAuth,
    label: input.label,
    createdAt: new Date().toISOString(),
  };
  const existing = readApiOutbox().filter((entry) => entry.id !== item.id);
  existing.push(item);
  writeApiOutbox(existing);
  return item;
}

export function readSharedOutboxRaw(): Array<Record<string, unknown>> {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(SHARED_OUTBOX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as Array<Record<string, unknown>>) : [];
  } catch {
    return [];
  }
}

export function getOfflinePendingCount(): number {
  const apiItems = readApiOutbox();
  const sharedItems = readSharedOutboxRaw();
  // Deduplicate logical pending entries across both queues where possible
  const uniqueIds = new Set<string>();
  for (const item of apiItems) {
    uniqueIds.add(item.id);
  }
  for (const item of sharedItems) {
    const id = typeof item.id === 'string' ? item.id : `shared_${uniqueIds.size}`;
    uniqueIds.add(id);
  }
  return Math.max(apiItems.length, sharedItems.length, uniqueIds.size === 0 ? 0 : Math.min(uniqueIds.size, apiItems.length + sharedItems.length));
}

export function isOfflineOrNetworkError(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return true;
  }
  if (error instanceof TypeError) {
    return true;
  }
  if (error && typeof error === 'object' && 'status' in error) {
    const status = Number((error as { status?: number }).status || 0);
    if (status === 0 || status >= 500 || status === 408 || status === 429) {
      return true;
    }
    return false;
  }
  const msg = error instanceof Error ? error.message.toLowerCase() : String(error || '').toLowerCase();
  return (
    msg.includes('failed to fetch') ||
    msg.includes('network') ||
    msg.includes('offline') ||
    msg.includes('load failed') ||
    msg.includes('timeout')
  );
}

export async function flushOfflineApiOutbox(): Promise<void> {
  if (apiFlushPromise) return apiFlushPromise;
  if (typeof window === 'undefined') return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

  const queue = readApiOutbox();
  if (queue.length === 0) return;

  const apiBaseUrl = String(import.meta.env.VITE_API_BASE_URL || '')
    .trim()
    .replace(/\/+$/, '');

  apiFlushPromise = (async () => {
    const remaining: OfflineApiQueueItem[] = [];
    for (const item of queue) {
      try {
        const headers = new Headers();
        headers.set('Content-Type', 'application/json');
        if (visitorIdProvider) {
          headers.set('X-Visitor-Id', visitorIdProvider());
        }
        if (item.includeAuth && authTokenProvider) {
          const token = authTokenProvider();
          if (token) {
            headers.set('Authorization', `Bearer ${token}`);
          }
        }
        const targetUrl =
          item.url.startsWith('/api') && apiBaseUrl ? `${apiBaseUrl}${item.url}` : item.url;
        const res = await fetch(targetUrl, {
          method: item.method,
          headers,
          body: item.body,
        });
        const contentType = (res.headers.get('content-type') || '').toLowerCase();
        if (
          (item.url.startsWith('/api') && !contentType.includes('application/json')) ||
          (!res.ok && res.status >= 500)
        ) {
          remaining.push(item);
        }
      } catch {
        remaining.push(item);
      }
    }
    writeApiOutbox(remaining);
  })();

  try {
    await apiFlushPromise;
  } finally {
    apiFlushPromise = null;
  }
}

export function startOfflineApiDaemon(): () => void {
  if (typeof window === 'undefined' || apiDaemonStarted) {
    return () => {};
  }
  apiDaemonStarted = true;

  const triggerFlush = () => {
    notifyOfflineListeners();
    void flushOfflineApiOutbox().catch(() => null);
  };

  triggerFlush();
  window.addEventListener('online', triggerFlush);
  window.addEventListener('offline', triggerFlush);
  window.addEventListener('focus', triggerFlush);
  const handleVisibility = () => {
    if (document.visibilityState === 'visible') {
      triggerFlush();
    }
  };
  document.addEventListener('visibilitychange', handleVisibility);
  const timerId = window.setInterval(triggerFlush, 15000);

  return () => {
    apiDaemonStarted = false;
    window.removeEventListener('online', triggerFlush);
    window.removeEventListener('offline', triggerFlush);
    window.removeEventListener('focus', triggerFlush);
    document.removeEventListener('visibilitychange', handleVisibility);
    window.clearInterval(timerId);
  };
}

export function saveOfflineCache<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadOfflineCache<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function collectSavedDrafts(): Record<string, unknown> {
  if (typeof window === 'undefined') return {};
  const drafts: Record<string, unknown> = {};
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith('vcs_draft_')) {
        const val = window.localStorage.getItem(k);
        if (val) {
          try {
            drafts[k] = JSON.parse(val);
          } catch {
            drafts[k] = val;
          }
        }
      }
    }
  } catch {
    // Ignore storage access errors
  }
  return drafts;
}

export interface OfflineExportSnapshot {
  exportedAt: string;
  portal: string;
  onlineStatus: string;
  pendingSubmissionsCount: number;
  pendingSharedQueue: Array<Record<string, unknown>>;
  pendingBackendQueue: OfflineApiQueueItem[];
  savedFormDrafts: Record<string, unknown>;
  cachedApprovedJobs: unknown[];
  cachedCandidateApplications: unknown[];
  cachedCompanyRequirements: unknown[];
}

export function buildOfflineExportSnapshot(): OfflineExportSnapshot {
  const pendingSharedQueue = readSharedOutboxRaw();
  const pendingBackendQueue = readApiOutbox();
  return {
    exportedAt: new Date().toISOString(),
    portal: 'JobsNia.com — A Venture of Vardhman Consultancy Services',
    onlineStatus:
      typeof navigator !== 'undefined' && !navigator.onLine ? 'Offline' : 'Online',
    pendingSubmissionsCount: getOfflinePendingCount(),
    pendingSharedQueue,
    pendingBackendQueue: pendingBackendQueue.map((item) => {
      let parsedBody: unknown = item.body;
      try {
        parsedBody = JSON.parse(item.body);
      } catch {
        // Keep string
      }
      return { ...item, body: JSON.stringify(parsedBody) };
    }),
    savedFormDrafts: collectSavedDrafts(),
    cachedApprovedJobs: loadOfflineCache<unknown[]>(OFFLINE_CACHE_KEYS.approvedJobs, []),
    cachedCandidateApplications: loadOfflineCache<unknown[]>(
      OFFLINE_CACHE_KEYS.adminApplications,
      loadOfflineCache<unknown[]>(OFFLINE_CACHE_KEYS.candidateApplications, [])
    ),
    cachedCompanyRequirements: loadOfflineCache<unknown[]>(
      OFFLINE_CACHE_KEYS.companyRequirements,
      []
    ),
  };
}

function triggerFileDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function downloadOfflineDataJson(): void {
  const snapshot = buildOfflineExportSnapshot();
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  triggerFileDownload(blob, `jobsnia-offline-data-${stamp}.json`);
}

function csvEscape(val: unknown): string {
  const str = String(val ?? '').replace(/\r?\n/g, ' ').trim();
  return `"${str.replace(/"/g, '""')}"`;
}

export function downloadOfflineDataCsv(): void {
  const snapshot = buildOfflineExportSnapshot();
  const rows: string[][] = [
    ['Record Type', 'ID', 'Name / Title', 'Contact / Mobile', 'Email', 'Location / City', 'Details / Qualification / Salary', 'Status / Queue State', 'Timestamp'],
  ];

  for (const item of snapshot.pendingSharedQueue) {
    const kind = String(item.kind || 'queued');
    const appPayload = (item.applicationPayload || {}) as Record<string, unknown>;
    const candPayload = (item.candidatePayload || {}) as Record<string, unknown>;
    const reqPayload = (item.requirementPayload || {}) as Record<string, unknown>;
    const qryPayload = (item.queryPayload || {}) as Record<string, unknown>;

    if (kind === 'application' || kind === 'candidate') {
      rows.push([
        'Pending Candidate Application',
        String(item.id || ''),
        `${String(appPayload.name || candPayload.fullName || '')} — ${String(appPayload.postApplied || candPayload.currentRole || '')}`,
        String(appPayload.phone || candPayload.phone || ''),
        String(candPayload.email || ''),
        String(appPayload.city || candPayload.cityDistrict || ''),
        String(candPayload.education || appPayload.resumeFileName || ''),
        'Pending Auto-Submit',
        item.createdAtMs ? new Date(Number(item.createdAtMs)).toISOString() : snapshot.exportedAt,
      ]);
    } else if (kind === 'requirement') {
      rows.push([
        'Pending Company Requirement',
        String(item.id || ''),
        `${String(reqPayload.companyName || '')} — ${String(reqPayload.postRequired || '')}`,
        String(reqPayload.phone || ''),
        String(reqPayload.contactPerson || ''),
        String(reqPayload.city || ''),
        `${String(reqPayload.salary || '')} | Vacancies: ${String(reqPayload.vacancyCount || 1)}`,
        'Pending Auto-Submit',
        item.createdAtMs ? new Date(Number(item.createdAtMs)).toISOString() : snapshot.exportedAt,
      ]);
    } else if (kind === 'query') {
      rows.push([
        'Pending Client Inquiry',
        String(item.id || ''),
        String(qryPayload.name || ''),
        String(qryPayload.phone || ''),
        '',
        '',
        String(qryPayload.message || ''),
        'Pending Auto-Submit',
        item.createdAtMs ? new Date(Number(item.createdAtMs)).toISOString() : snapshot.exportedAt,
      ]);
    }
  }

  for (const rawApp of snapshot.cachedCandidateApplications) {
    const app = rawApp as Record<string, unknown>;
    rows.push([
      'Saved Candidate Application',
      String(app.id || ''),
      `${String(app.applicantName || '')} — ${String(app.jobTitle || '')}`,
      String(app.applicantPhone || ''),
      String(app.applicantEmail || ''),
      String(app.city || app.location || ''),
      String(app.qualificationExperience || app.experience || app.resumeFileName || ''),
      String(app.status || 'Submitted'),
      String(app.appliedAt || ''),
    ]);
  }

  for (const rawReq of snapshot.cachedCompanyRequirements) {
    const req = rawReq as Record<string, unknown>;
    rows.push([
      'Saved Company Requirement',
      String(req.id || ''),
      `${String(req.companyName || '')} — ${String(req.postRequired || '')}`,
      String(req.phone || ''),
      String(req.contactPerson || ''),
      String(req.city || ''),
      `${String(req.salary || '')} | Vacancies: ${String(req.vacancyCount || 1)} | ${String(req.jobDescription || '')}`,
      String(req.status || 'Submitted'),
      String(req.createdAt || ''),
    ]);
  }

  for (const rawJob of snapshot.cachedApprovedJobs) {
    const job = rawJob as Record<string, unknown>;
    rows.push([
      'Cached Live Job',
      String(job.id || ''),
      String(job.title || job.jobTitle || ''),
      '',
      '',
      String(job.location || ''),
      `${String(job.experience || '')} | ${String(job.salary || '')}`,
      String(job.status || 'Approved'),
      String(job.postedAt || job.createdAt || ''),
    ]);
  }

  const csvBody = rows.map((line) => line.map(csvEscape).join(',')).join('\r\n');
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const blob = new Blob([csvBody], { type: 'text/csv;charset=utf-8;' });
  triggerFileDownload(blob, `jobsnia-offline-data-${stamp}.csv`);
}
