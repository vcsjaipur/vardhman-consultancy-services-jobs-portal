import {
  AdminErrorNotification,
  FirestoreErrorDatabase,
  FirestoreSubscriptionError,
} from '../types/portal';

export interface MonitoredAdminFeed {
  feedKey: string;
  label: string;
  path: string;
  database: FirestoreErrorDatabase;
}

export const ADMIN_MONITORED_FEEDS: MonitoredAdminFeed[] = [
  {
    feedKey: 'admin-jobs',
    label: 'Primary Job Mandates',
    path: 'jobs',
    database: 'primary',
  },
  {
    feedKey: 'admin-applications',
    label: 'Primary Applications',
    path: 'applications',
    database: 'primary',
  },
  {
    feedKey: 'admin-resume-godam',
    label: 'Primary Resume Repository',
    path: 'resume_godam',
    database: 'primary',
  },
  {
    feedKey: 'admin-users',
    label: 'Registered Users Directory',
    path: 'users',
    database: 'primary',
  },
  {
    feedKey: 'shared-resume-applications',
    label: 'Shared Portal Applications',
    path: 'applications',
    database: 'shared',
  },
  {
    feedKey: 'shared-resume-candidates',
    label: 'Shared Resume Candidates',
    path: 'candidates',
    database: 'shared',
  },
  {
    feedKey: 'shared-candidates-feed',
    label: 'Shared Candidate Registrations',
    path: 'candidates',
    database: 'shared',
  },
  {
    feedKey: 'shared-company-requirements',
    label: 'Shared Company Requirements',
    path: 'company_requirements',
    database: 'shared',
  },
  {
    feedKey: 'shared-client-queries',
    label: 'Shared Client Inquiries',
    path: 'client_queries',
    database: 'shared',
  },
  {
    feedKey: 'visitor-stats',
    label: 'Cumulative Visitor Stats',
    path: 'site_stats/visitors',
    database: 'primary',
  },
];

interface ParsedRawError {
  code: string;
  message: string;
  parsedPath?: string;
  parsedOperation?: string;
  email?: string;
}

const KNOWN_FIRESTORE_CODES = [
  'permission-denied',
  'unauthenticated',
  'resource-exhausted',
  'unavailable',
  'failed-precondition',
  'deadline-exceeded',
  'not-found',
  'already-exists',
  'invalid-argument',
  'aborted',
  'cancelled',
  'internal',
  'data-loss',
];

function extractRawErrorDetails(error: unknown): ParsedRawError {
  const directCode =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code || '').trim()
      : '';
  const initialMsg =
    error instanceof Error ? error.message : String(error ?? 'Unknown error');
  const trimmed = initialMsg.trim();

  let innerMessage = trimmed;
  let parsedPath: string | undefined;
  let parsedOperation: string | undefined;
  let email: string | undefined;

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed) as {
        error?: unknown;
        path?: unknown;
        operationType?: unknown;
        authInfo?: { email?: unknown };
      };
      if (typeof parsed.error === 'string' && parsed.error.trim()) {
        innerMessage = parsed.error.trim();
      }
      if (typeof parsed.path === 'string' && parsed.path.trim()) {
        parsedPath = parsed.path.trim();
      }
      if (typeof parsed.operationType === 'string' && parsed.operationType.trim()) {
        parsedOperation = parsed.operationType.trim();
      }
      if (typeof parsed.authInfo?.email === 'string' && parsed.authInfo.email.trim()) {
        email = parsed.authInfo.email.trim();
      }
    } catch {
      // Keep original string if not valid JSON
    }
  }

  const lower = `${directCode} ${innerMessage}`.toLowerCase();
  let code = directCode.replace(/^firestore\//, '').replace(/^auth\//, '');
  if (!code) {
    const matched = KNOWN_FIRESTORE_CODES.find((c) => lower.includes(c));
    if (matched) {
      code = matched;
    } else if (lower.includes('missing or insufficient permissions')) {
      code = 'permission-denied';
    } else if (lower.includes('quota exceeded')) {
      code = 'resource-exhausted';
    } else if (lower.includes('client is offline') || lower.includes('network')) {
      code = 'unavailable';
    } else if (lower.includes('requires an index')) {
      code = 'failed-precondition';
    } else if (lower.includes('auth/')) {
      code = 'unauthenticated';
    } else {
      code = 'unknown';
    }
  }

  return {
    code,
    message: innerMessage || 'Unknown Firestore error',
    parsedPath,
    parsedOperation,
    email,
  };
}

export function buildFirestoreSubscriptionError(params: {
  feedKey: string;
  sourceLabel: string;
  database: FirestoreErrorDatabase;
  operationType: string;
  path: string;
  error: unknown;
}): FirestoreSubscriptionError {
  const details = extractRawErrorDetails(params.error);
  const effectivePath = details.parsedPath || params.path;
  const effectiveOp = details.parsedOperation || params.operationType;
  const dbTag =
    params.database === 'shared'
      ? 'Shared Portal DB'
      : params.database === 'primary'
        ? 'Primary DB'
        : 'Portal API';
  const lowerMsg = details.message.toLowerCase();
  const lowerCode = details.code.toLowerCase();

  let friendlyMessage: string;
  let severity: 'critical' | 'warning' = 'critical';

  if (
    lowerCode.includes('permission-denied') ||
    lowerMsg.includes('missing or insufficient permissions')
  ) {
    const accountHint = details.email
      ? ` (signed in as ${details.email})`
      : '';
    friendlyMessage = `Something went wrong while accessing ${params.sourceLabel} (${effectivePath} on ${dbTag}): Permission denied${accountHint}. Check Firestore security rules for "${effectiveOp}" on "${effectivePath}" or re-verify the admin Google session.`;
  } else if (
    lowerCode.includes('resource-exhausted') ||
    lowerMsg.includes('quota exceeded')
  ) {
    friendlyMessage = `Something went wrong while syncing ${params.sourceLabel} (${effectivePath} on ${dbTag}): Firestore usage quota exceeded. Daily read/write limits were reached; quota resets tomorrow or upgrade the Firebase plan.`;
  } else if (
    lowerCode.includes('unauthenticated') ||
    lowerMsg.includes('auth/') ||
    lowerMsg.includes('authentication required') ||
    lowerMsg.includes('admin verification required')
  ) {
    friendlyMessage = `Something went wrong while authenticating ${params.sourceLabel} (${effectivePath} on ${dbTag}): Admin authentication expired or email is unverified. Please sign out and sign back in with cvforvcs@gmail.com.`;
  } else if (
    lowerCode.includes('failed-precondition') ||
    lowerMsg.includes('requires an index')
  ) {
    friendlyMessage = `Something went wrong while querying ${params.sourceLabel} (${effectivePath} on ${dbTag}): Firestore precondition or composite index error — ${details.message}`;
  } else if (
    lowerCode.includes('unavailable') ||
    lowerCode.includes('deadline-exceeded') ||
    lowerMsg.includes('client is offline') ||
    lowerMsg.includes('offline') ||
    lowerMsg.includes('failed to fetch') ||
    lowerMsg.includes('network')
  ) {
    severity = 'warning';
    friendlyMessage = `Something went wrong while connecting to ${params.sourceLabel} (${effectivePath} on ${dbTag}): Database is temporarily unreachable or the browser is offline. Cached records remain visible until reconnection.`;
  } else if (lowerMsg === 'something went wrong, please try again.') {
    friendlyMessage = `Something went wrong while syncing ${params.sourceLabel} (${effectivePath} on ${dbTag}): The feed returned a generic error (${details.code}). Use "Retry Feeds" or inspect browser console for details.`;
  } else {
    friendlyMessage = `Something went wrong while syncing ${params.sourceLabel} (${effectivePath} on ${dbTag}): ${details.message}`;
  }

  return {
    feedKey: params.feedKey,
    sourceLabel: params.sourceLabel,
    database: params.database,
    operationType: effectiveOp,
    path: effectivePath,
    code: details.code,
    friendlyMessage,
    rawMessage: details.message,
    severity,
    timestamp: new Date().toISOString(),
  };
}

export function upsertAdminError(
  list: AdminErrorNotification[],
  incoming: FirestoreSubscriptionError
): AdminErrorNotification[] {
  const existingIdx = list.findIndex(
    (item) =>
      !item.dismissed &&
      !item.resolved &&
      item.feedKey === incoming.feedKey &&
      item.code === incoming.code &&
      item.rawMessage === incoming.rawMessage
  );

  if (existingIdx !== -1) {
    const existing = list[existingIdx];
    const updated: AdminErrorNotification = {
      ...existing,
      ...incoming,
      occurrences: existing.occurrences + 1,
      lastOccurredAt: incoming.timestamp,
    };
    const next = list.filter((_, idx) => idx !== existingIdx);
    return [updated, ...next];
  }

  const id = `err_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const created: AdminErrorNotification = {
    ...incoming,
    id,
    occurrences: 1,
    firstOccurredAt: incoming.timestamp,
    lastOccurredAt: incoming.timestamp,
    resolved: false,
    dismissed: false,
  };

  return [created, ...list].slice(0, 50);
}

export function markAdminFeedResolved(
  list: AdminErrorNotification[],
  feedKey: string
): AdminErrorNotification[] {
  let changed = false;
  const now = new Date().toISOString();
  const next = list.map((item) => {
    if (item.feedKey === feedKey && !item.resolved) {
      changed = true;
      return {
        ...item,
        resolved: true,
        resolvedAt: now,
      };
    }
    return item;
  });
  return changed ? next : list;
}
