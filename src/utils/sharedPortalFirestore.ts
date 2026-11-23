import {
  collection,
  doc,
  DocumentData,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  QueryDocumentSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
  Unsubscribe,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  handleFirestoreError,
  OperationType,
  sharedDb,
} from '../firebase';
import { JobApplication, JobListing } from '../types/portal';
import { CONFIDENTIAL_COMPANY_LABEL } from './jobHelpers';

export const MAX_SHARED_RESUME_BASE64_CHARS = 800000;

function generateSharedId(prefix: 'app' | 'cand' | 'req' | 'qry'): string {
  const rand =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '')
      : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
  return `${prefix}_${rand}`.slice(0, 120);
}

function trimToMax(raw: unknown, max: number, fallback = ''): string {
  const clean = String(raw ?? '').trim() || fallback;
  return clean.slice(0, max);
}

function formatFirestoreDate(val: unknown): string {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (
    val &&
    typeof val === 'object' &&
    'toDate' in val &&
    typeof (val as { toDate: () => Date }).toDate === 'function'
  ) {
    return (val as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof val === 'string' && val.trim()) {
    return val;
  }
  return new Date().toISOString();
}

function parseTimestampMs(val: unknown): number {
  if (val instanceof Timestamp) {
    return val.toMillis();
  }
  if (
    val &&
    typeof val === 'object' &&
    'toMillis' in val &&
    typeof (val as { toMillis: () => number }).toMillis === 'function'
  ) {
    return (val as { toMillis: () => number }).toMillis();
  }
  if (
    val &&
    typeof val === 'object' &&
    'toDate' in val &&
    typeof (val as { toDate: () => Date }).toDate === 'function'
  ) {
    return (val as { toDate: () => Date }).toDate().getTime();
  }
  if (typeof val === 'string' && val.trim()) {
    const parsed = Date.parse(val);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

function normalizeSkillsArray(raw: unknown): string[] {
  const arr = Array.isArray(raw)
    ? raw.map((item) => trimToMax(item, 80)).filter(Boolean)
    : String(raw ?? '')
        .split(',')
        .map((item) => trimToMax(item, 80))
        .filter(Boolean);
  const bounded = arr.slice(0, 30);
  return bounded.length > 0 ? bounded : ['Relevant Experience'];
}

function logSharedFirestoreFailure(
  error: unknown,
  operationType: OperationType,
  path: string
): void {
  try {
    handleFirestoreError(error, operationType, path);
  } catch {
    // Error details already logged via handleFirestoreError
  }
}

function mapSharedJobData(id: string, d: DocumentData): JobListing {
  const jobTitle = String(
    d.jobTitle || d.title || d.designation || d.role || 'Job Opening'
  ).trim();
  const clientName = String(
    d.clientName || d.company || d.companyName || ''
  ).trim();
  const location = String(d.location || d.city || 'Pan India').trim();
  const experience = String(d.experience || d.exp || 'As per JD').trim();
  const salary = String(d.salary || d.ctc || d.package || 'Negotiable').trim();
  const skills = normalizeSkillsArray(d.skills);
  const jobDescription = String(
    d.jobDescription || d.description || d.jd || ''
  ).trim();
  const openingsCount = Math.max(
    1,
    Number(d.openingsCount ?? d.openings ?? 1) || 1
  );
  const lastDate = String(
    d.lastDate || d.lastDateToApply || 'Open Until Filled'
  ).trim();
  const createdAtIso = formatFirestoreDate(d.createdAt);
  const postedAt = String(d.postedAt || createdAtIso.slice(0, 10));

  return {
    id: String(d.id || id),
    title: jobTitle,
    jobTitle,
    designation: String(d.designation || jobTitle),
    company: clientName || CONFIDENTIAL_COMPANY_LABEL,
    clientName,
    companyMasked: String(d.companyMasked || CONFIDENTIAL_COMPANY_LABEL),
    location,
    experience,
    salary,
    jobType: String(d.jobType || 'Full-Time'),
    skills,
    description: jobDescription,
    jobDescription,
    qualification: String(d.qualification || d.education || ''),
    openings: openingsCount,
    openingsCount,
    lastDateToApply: lastDate,
    lastDate,
    postedAt,
    createdAt: createdAtIso,
    employerId: typeof d.employerUid === 'string' ? d.employerUid : undefined,
    status: 'Approved',
  };
}

function sortSharedJobsNewestFirst(
  docs: QueryDocumentSnapshot<DocumentData>[]
): JobListing[] {
  return [...docs]
    .sort((a, b) => {
      const aMs =
        parseTimestampMs(a.data().createdAt) ||
        parseTimestampMs(a.data().updatedAt);
      const bMs =
        parseTimestampMs(b.data().createdAt) ||
        parseTimestampMs(b.data().updatedAt);
      return bMs - aMs;
    })
    .map((snap) => mapSharedJobData(snap.id, snap.data()));
}

export function subscribeSharedActiveJobs(
  onUpdate: (jobs: JobListing[]) => void,
  onError?: (friendlyMessage: string) => void
): Unsubscribe {
  const path = 'jobs';
  const q = query(
    collection(sharedDb, path),
    where('status', 'in', ['active', 'Active'])
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const jobs = sortSharedJobsNewestFirst(snapshot.docs);
      onUpdate(jobs);
    },
    (error) => {
      logSharedFirestoreFailure(error, OperationType.LIST, path);
      onError?.('Something went wrong, please try again.');
    }
  );
}

export async function fetchSharedActiveJobs(): Promise<JobListing[]> {
  const path = 'jobs';
  try {
    const q = query(
      collection(sharedDb, path),
      where('status', 'in', ['active', 'Active'])
    );
    const snapshot = await getDocs(q);
    return sortSharedJobsNewestFirst(snapshot.docs);
  } catch (error) {
    logSharedFirestoreFailure(error, OperationType.LIST, path);
    throw new Error('Something went wrong, please try again.');
  }
}

export async function fetchSharedJobById(
  jobId: string
): Promise<JobListing | null> {
  const cleanId = String(jobId || '').trim();
  if (!cleanId) return null;
  const path = `jobs/${cleanId}`;
  try {
    const snap = await getDoc(doc(sharedDb, 'jobs', cleanId));
    if (!snap.exists()) return null;
    const data = snap.data();
    const status = String(data.status || '').trim().toLowerCase();
    if (status !== 'active' && status !== 'approved') {
      return null;
    }
    return mapSharedJobData(snap.id, data);
  } catch (error) {
    logSharedFirestoreFailure(error, OperationType.GET, path);
    return null;
  }
}

export interface SharedCandidateSubmissionInput {
  name: string;
  email: string;
  phone: string;
  city: string;
  postApplied: string;
  qualificationExperience?: string;
  termsAccepted?: boolean;
  jobId: string;
  resumeFileName: string;
  resumeBase64: string;
  resumeSummary?: string;
  resumeFullText?: string;
}

export interface SharedResumeProfileInput {
  name: string;
  email: string;
  phone: string;
  city: string;
  state?: string | null;
  postApplied?: string | null;
  experience?: string | null;
  qualification?: string | null;
  currentCompany?: string | null;
  designation?: string | null;
  currentCtc?: string | null;
  expectedSalary?: string | null;
  noticePeriod?: string | null;
  skills?: string | string[] | null;
  resumeHeadline?: string | null;
  resumeSummary?: string | null;
  resumeFullText?: string | null;
  workHistory?: string[] | null;
  resumeFileName?: string | null;
  resumeBase64?: string | null;
}

export interface SharedCompanyRequirementInput {
  companyName: string;
  contactPerson: string;
  phone: string;
  city: string;
  postRequired: string;
  salary: string;
  vacancyCount: number;
  jobDescription: string;
}

export interface SharedClientQueryInput {
  name: string;
  phone: string;
  message: string;
}

type OutboxEntry =
  | {
      id: string;
      kind: 'application';
      appId: string;
      candId: string;
      applicationPayload: Record<string, unknown>;
      candidatePayload: Record<string, unknown>;
      createdAtMs: number;
    }
  | {
      id: string;
      kind: 'candidate';
      candId: string;
      candidatePayload: Record<string, unknown>;
      createdAtMs: number;
    }
  | {
      id: string;
      kind: 'requirement';
      reqId: string;
      requirementPayload: Record<string, unknown>;
      createdAtMs: number;
    }
  | {
      id: string;
      kind: 'query';
      qryId: string;
      queryPayload: Record<string, unknown>;
      createdAtMs: number;
    };

const SHARED_SYNC_OUTBOX_KEY = 'vcs_shared_sync_outbox_v1';
const MAX_OUTBOX_ITEMS = 40;
let flushInFlight: Promise<void> | null = null;
let daemonStarted = false;

function readOutbox(): OutboxEntry[] {
  try {
    const raw = window.localStorage.getItem(SHARED_SYNC_OUTBOX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as OutboxEntry[]) : [];
  } catch {
    return [];
  }
}

function writeOutbox(entries: OutboxEntry[]): void {
  try {
    if (entries.length === 0) {
      window.localStorage.removeItem(SHARED_SYNC_OUTBOX_KEY);
      window.dispatchEvent(new Event('vcs-offline-change'));
      return;
    }
    window.localStorage.setItem(
      SHARED_SYNC_OUTBOX_KEY,
      JSON.stringify(entries.slice(-MAX_OUTBOX_ITEMS))
    );
    window.dispatchEvent(new Event('vcs-offline-change'));
  } catch {
    // Fallback if base64 payload exceeds localStorage quota: strip binary field while keeping metadata
    try {
      const compact = entries.slice(-MAX_OUTBOX_ITEMS).map((entry) => {
        if (entry.kind === 'application') {
          return {
            ...entry,
            applicationPayload: { ...entry.applicationPayload, resumeBase64: '' },
            candidatePayload: { ...entry.candidatePayload, uploadedFileBase64: '' },
          };
        }
        if (entry.kind === 'candidate') {
          return {
            ...entry,
            candidatePayload: { ...entry.candidatePayload, uploadedFileBase64: '' },
          };
        }
        return entry;
      });
      window.localStorage.setItem(SHARED_SYNC_OUTBOX_KEY, JSON.stringify(compact));
      window.dispatchEvent(new Event('vcs-offline-change'));
    } catch {
      // Ignore unrecoverable storage errors
    }
  }
}

function enqueueOutboxEntry(entry: OutboxEntry): void {
  const existing = readOutbox().filter((item) => item.id !== entry.id);
  existing.push(entry);
  writeOutbox(existing);
}

function removeOutboxEntry(entryId: string): void {
  const existing = readOutbox();
  if (existing.length === 0) return;
  writeOutbox(existing.filter((item) => item.id !== entryId));
}

function isRetryableSyncError(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return true;
  }
  const raw =
    error instanceof Error
      ? `${(error as { code?: string }).code || ''} ${error.message}`.toLowerCase()
      : String(error || '').toLowerCase();
  return (
    raw.includes('unavailable') ||
    raw.includes('deadline-exceeded') ||
    raw.includes('network') ||
    raw.includes('offline') ||
    raw.includes('timeout') ||
    raw.includes('aborted') ||
    raw.includes('resource-exhausted') ||
    raw.includes('internal') ||
    raw.includes('failed to fetch')
  );
}

async function executeOutboxEntry(entry: OutboxEntry): Promise<void> {
  if (entry.kind === 'application') {
    const batch = writeBatch(sharedDb);
    batch.set(doc(sharedDb, 'applications', entry.appId), {
      ...entry.applicationPayload,
      createdAt: serverTimestamp(),
    });
    batch.set(doc(sharedDb, 'candidates', entry.candId), {
      ...entry.candidatePayload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
    return;
  }
  if (entry.kind === 'candidate') {
    await setDoc(doc(sharedDb, 'candidates', entry.candId), {
      ...entry.candidatePayload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return;
  }
  if (entry.kind === 'requirement') {
    await setDoc(doc(sharedDb, 'company_requirements', entry.reqId), {
      ...entry.requirementPayload,
      createdAt: serverTimestamp(),
    });
    return;
  }
  if (entry.kind === 'query') {
    await setDoc(doc(sharedDb, 'client_queries', entry.qryId), {
      ...entry.queryPayload,
      createdAt: serverTimestamp(),
    });
  }
}

export async function flushSharedSyncOutbox(): Promise<void> {
  if (flushInFlight) return flushInFlight;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

  const queue = readOutbox();
  if (queue.length === 0) return;

  flushInFlight = (async () => {
    const remaining: OutboxEntry[] = [];
    for (const item of queue) {
      try {
        await executeOutboxEntry(item);
      } catch (err) {
        if (isRetryableSyncError(err)) {
          remaining.push(item);
        }
      }
    }
    writeOutbox(remaining);
  })();

  try {
    await flushInFlight;
  } finally {
    flushInFlight = null;
  }
}

export function startSharedAutoSyncDaemon(): () => void {
  if (typeof window === 'undefined' || daemonStarted) {
    return () => {};
  }
  daemonStarted = true;

  const triggerFlush = () => {
    void flushSharedSyncOutbox().catch(() => null);
  };

  triggerFlush();
  window.addEventListener('online', triggerFlush);
  window.addEventListener('focus', triggerFlush);
  const handleVisibility = () => {
    if (document.visibilityState === 'visible') {
      triggerFlush();
    }
  };
  document.addEventListener('visibilitychange', handleVisibility);
  const timerId = window.setInterval(triggerFlush, 15000);

  return () => {
    daemonStarted = false;
    window.removeEventListener('online', triggerFlush);
    window.removeEventListener('focus', triggerFlush);
    document.removeEventListener('visibilitychange', handleVisibility);
    window.clearInterval(timerId);
  };
}

function parseExperienceYearsNumber(raw: string | null | undefined): number {
  const s = String(raw || '').trim().toLowerCase();
  if (!s || s === 'fresher') return 0;
  const match = s.match(/\d+(\.\d+)?/);
  if (!match) return 1;
  const num = Number(match[0]);
  return Number.isFinite(num) ? Math.max(0, Math.min(60, Math.round(num * 10) / 10)) : 1;
}

function parseLpaNumber(raw: string | null | undefined): number {
  const s = String(raw || '').trim();
  if (!s) return 0;
  const match = s.match(/\d+(\.\d+)?/);
  if (!match) return 0;
  const num = Number(match[0]);
  return Number.isFinite(num) ? Math.max(0, Math.min(500, Math.round(num * 10) / 10)) : 0;
}

export async function submitCandidateApplicationToSharedPortal(
  input: SharedCandidateSubmissionInput
): Promise<{ applicationId: string; candidateId: string }> {
  const appId = generateSharedId('app');
  const candId = generateSharedId('cand');

  const name = trimToMax(input.name, 140);
  const email = trimToMax(input.email.toLowerCase(), 160);
  const phone = trimToMax(input.phone, 30);
  const city = trimToMax(input.city, 140, 'India');
  const postApplied = trimToMax(input.postApplied, 180, 'Candidate Application');
  const qualificationExperience = trimToMax(
    input.qualificationExperience,
    240,
    'Resume Uploaded via External Portal'
  );
  const jobId = trimToMax(input.jobId, 140, 'general_resume');
  const resumeFileName = trimToMax(input.resumeFileName, 240, 'resume.pdf');
  const rawBase64 = String(input.resumeBase64 ?? '');
  const resumeBase64 =
    rawBase64.length <= MAX_SHARED_RESUME_BASE64_CHARS ? rawBase64 : '';

  const resumeSummary = trimToMax(
    input.resumeSummary ||
      `${name} applied for ${postApplied} from ${city}. Qualification/Exp: ${qualificationExperience}. Contact: ${phone}${email ? ` (${email})` : ''}.`,
    2000
  );
  const resumeFullText = trimToMax(
    input.resumeFullText ||
      `Candidate: ${name}\nEmail: ${email}\nPhone: ${phone}\nCity: ${city}\nPost Applied: ${postApplied}\nQualification / Experience: ${qualificationExperience}\nTerms Accepted: ${input.termsAccepted ? 'Yes (Terms & Conditions & Candidate Declaration Accepted)' : 'No'}\nResume File: ${resumeFileName}`,
    8000
  );

  const applicationPayload = {
    id: appId,
    candidateId: candId,
    name,
    phone,
    city,
    postApplied,
    jobId,
    resumeFileName,
    resumeFileType: 'pdf',
    resumeBase64,
    status: 'new',
  };

  const candidatePayload = {
    id: candId,
    ownerUid: 'public_job_portal',
    fullName: name,
    email,
    phone,
    headline: postApplied,
    clientTag: 'External Job Portal',
    experienceYears: parseExperienceYearsNumber(qualificationExperience),
    currentCompany: 'External Portal Applicant',
    currentRole: postApplied,
    currentSalaryLpa: 0,
    expectedSalaryLpa: 0,
    noticePeriod: 'Immediate',
    country: 'India',
    region: 'All India',
    state: city,
    cityDistrict: city,
    skills: [postApplied],
    education: qualificationExperience,
    resumeSummary,
    resumeFullText,
    workHistory: ['Applied via External Job Portal'],
    uploadedFileName: resumeFileName,
    uploadedFileType: 'pdf',
    uploadedFileBase64: resumeBase64,
    activeDaysAgo: 0,
    sourcePortal: 'job_portal',
  };

  const outboxItem: OutboxEntry = {
    id: appId,
    kind: 'application',
    appId,
    candId,
    applicationPayload,
    candidatePayload,
    createdAtMs: Date.now(),
  };

  enqueueOutboxEntry(outboxItem);
  try {
    await executeOutboxEntry(outboxItem);
    removeOutboxEntry(appId);
    return { applicationId: appId, candidateId: candId };
  } catch (error) {
    logSharedFirestoreFailure(
      error,
      OperationType.WRITE,
      `applications/${appId}`
    );
    if (isRetryableSyncError(error)) {
      return { applicationId: appId, candidateId: candId };
    }
    removeOutboxEntry(appId);
    throw new Error('Something went wrong, please try again.');
  }
}

export async function syncResumeProfileToSharedCandidates(
  input: SharedResumeProfileInput
): Promise<string> {
  const candId = generateSharedId('cand');
  const name = trimToMax(input.name, 140, 'Candidate');
  const email = trimToMax(input.email.toLowerCase(), 160);
  const phone = trimToMax(input.phone, 30);
  const city = trimToMax(input.city, 140, 'India');
  const state = trimToMax(input.state, 140, city);
  const postApplied = trimToMax(
    input.designation || input.postApplied,
    180,
    'Job Seeker'
  );
  const resumeHeadline = trimToMax(input.resumeHeadline || postApplied, 180, postApplied);
  const qualification = trimToMax(
    input.qualification,
    240,
    'Resume Uploaded via External Portal'
  );
  const currentCompany = trimToMax(
    input.currentCompany,
    160,
    'External Portal Applicant'
  );
  const noticePeriod = trimToMax(input.noticePeriod, 60, 'Immediate');
  const resumeFileName = trimToMax(input.resumeFileName, 240, 'resume.pdf');
  const rawBase64 = String(input.resumeBase64 ?? '');
  const resumeBase64 =
    rawBase64.length <= MAX_SHARED_RESUME_BASE64_CHARS ? rawBase64 : '';

  const skillsList = input.skills
    ? normalizeSkillsArray(input.skills)
    : [postApplied];

  const workHistoryList =
    Array.isArray(input.workHistory) && input.workHistory.length > 0
      ? input.workHistory.map((w) => trimToMax(w, 240)).filter(Boolean).slice(0, 20)
      : currentCompany && currentCompany !== 'External Portal Applicant'
        ? [`${postApplied} at ${currentCompany}`]
        : ['Applied via External Job Portal'];

  const resumeSummary = trimToMax(
    input.resumeSummary ||
      `${name} (${resumeHeadline}) from ${city}${state && state !== city ? `, ${state}` : ''}. Experience: ${input.experience || 'As per profile'}. Qualification: ${qualification}. Skills: ${skillsList.join(', ')}.`,
    2000
  );

  const resumeFullText = trimToMax(
    input.resumeFullText ||
      [
        `Candidate: ${name}`,
        email ? `Email: ${email}` : '',
        phone ? `Phone: ${phone}` : '',
        `City: ${city}`,
        state ? `State: ${state}` : '',
        `Role / Headline: ${resumeHeadline}`,
        `Experience: ${input.experience || 'As per profile'}`,
        `Qualification: ${qualification}`,
        `Skills: ${skillsList.join(', ')}`,
        `Work History: ${workHistoryList.join(' | ')}`,
        `Resume File: ${resumeFileName}`,
      ]
        .filter(Boolean)
        .join('\n'),
    8000
  );

  const candidatePayload = {
    id: candId,
    ownerUid: 'public_job_portal',
    fullName: name,
    email,
    phone,
    headline: resumeHeadline,
    clientTag: 'External Job Portal',
    experienceYears: parseExperienceYearsNumber(input.experience),
    currentCompany,
    currentRole: postApplied,
    currentSalaryLpa: parseLpaNumber(input.currentCtc),
    expectedSalaryLpa: parseLpaNumber(input.expectedSalary),
    noticePeriod,
    country: 'India',
    region: 'All India',
    state,
    cityDistrict: city,
    skills: skillsList,
    education: qualification,
    resumeSummary,
    resumeFullText,
    workHistory: workHistoryList,
    uploadedFileName: resumeFileName,
    uploadedFileType: 'pdf',
    uploadedFileBase64: resumeBase64,
    activeDaysAgo: 0,
    sourcePortal: 'job_portal',
  };

  const outboxItem: OutboxEntry = {
    id: candId,
    kind: 'candidate',
    candId,
    candidatePayload,
    createdAtMs: Date.now(),
  };

  enqueueOutboxEntry(outboxItem);
  try {
    await executeOutboxEntry(outboxItem);
    removeOutboxEntry(candId);
    return candId;
  } catch (error) {
    logSharedFirestoreFailure(
      error,
      OperationType.CREATE,
      `candidates/${candId}`
    );
    if (isRetryableSyncError(error)) {
      return candId;
    }
    removeOutboxEntry(candId);
    throw new Error('Something went wrong, please try again.');
  }
}

export async function submitCompanyRequirementToSharedPortal(
  input: SharedCompanyRequirementInput
): Promise<string> {
  const reqId = generateSharedId('req');
  const vacancyCount = Math.max(1, Math.floor(Number(input.vacancyCount) || 1));

  const requirementPayload = {
    id: reqId,
    companyName: trimToMax(input.companyName, 180),
    contactPerson: trimToMax(input.contactPerson, 140),
    phone: trimToMax(input.phone, 30, 'Not provided'),
    city: trimToMax(input.city, 140, 'Pan India'),
    postRequired: trimToMax(input.postRequired, 180),
    salary: trimToMax(input.salary, 80, 'Negotiable'),
    vacancyCount,
    jobDescription: trimToMax(input.jobDescription, 10000),
    status: 'new',
  };

  const outboxItem: OutboxEntry = {
    id: reqId,
    kind: 'requirement',
    reqId,
    requirementPayload,
    createdAtMs: Date.now(),
  };

  enqueueOutboxEntry(outboxItem);
  try {
    await executeOutboxEntry(outboxItem);
    removeOutboxEntry(reqId);
    return reqId;
  } catch (error) {
    logSharedFirestoreFailure(
      error,
      OperationType.CREATE,
      `company_requirements/${reqId}`
    );
    if (isRetryableSyncError(error)) {
      return reqId;
    }
    removeOutboxEntry(reqId);
    throw new Error('Something went wrong, please try again.');
  }
}

export async function submitClientQueryToSharedPortal(
  input: SharedClientQueryInput
): Promise<string> {
  const qryId = generateSharedId('qry');

  const queryPayload = {
    id: qryId,
    name: trimToMax(input.name, 140),
    phone: trimToMax(input.phone, 30, 'Not provided'),
    message: trimToMax(input.message, 5000),
    status: 'new',
  };

  const outboxItem: OutboxEntry = {
    id: qryId,
    kind: 'query',
    qryId,
    queryPayload,
    createdAtMs: Date.now(),
  };

  enqueueOutboxEntry(outboxItem);
  try {
    await executeOutboxEntry(outboxItem);
    removeOutboxEntry(qryId);
    return qryId;
  } catch (error) {
    logSharedFirestoreFailure(
      error,
      OperationType.CREATE,
      `client_queries/${qryId}`
    );
    if (isRetryableSyncError(error)) {
      return qryId;
    }
    removeOutboxEntry(qryId);
    throw new Error('Something went wrong, please try again.');
  }
}

function mapSharedApplicationDocs(
  appDocs: QueryDocumentSnapshot<DocumentData>[],
  candById: Map<string, DocumentData>
): JobApplication[] {
  const mapped: JobApplication[] = appDocs.map((snap) => {
    const d = snap.data();
    const candId = String(d.candidateId || '');
    const cand = candById.get(candId);
    const qualificationExperience = cand?.education
      ? String(cand.education)
      : '';
    return {
      id: String(d.id || snap.id),
      candidateId: candId,
      jobId: String(d.jobId || 'general_resume'),
      jobTitle: String(d.postApplied || 'Candidate Application'),
      companyMasked: CONFIDENTIAL_COMPANY_LABEL,
      location: String(d.city || ''),
      city: String(d.city || ''),
      salary: 'As per Industry Standards',
      experience: qualificationExperience,
      qualificationExperience,
      resumeSummary: cand?.resumeSummary ? String(cand.resumeSummary) : undefined,
      applicantName: String(d.name || cand?.fullName || ''),
      applicantEmail: String(cand?.email || ''),
      applicantPhone: String(d.phone || cand?.phone || ''),
      resumeId: String(d.id || snap.id),
      resumeFileName: String(d.resumeFileName || cand?.uploadedFileName || 'resume.pdf'),
      resumeBase64:
        typeof d.resumeBase64 === 'string' && d.resumeBase64
          ? d.resumeBase64
          : typeof cand?.uploadedFileBase64 === 'string'
            ? cand.uploadedFileBase64
            : undefined,
      termsAccepted: true,
      appliedAt: formatFirestoreDate(d.createdAt),
      status: 'Submitted',
      source: 'shared-portal',
    };
  });

  return mapped.sort(
    (a, b) => Date.parse(b.appliedAt || '') - Date.parse(a.appliedAt || '')
  );
}

export async function fetchSharedResumeGodamEntries(): Promise<JobApplication[]> {
  try {
    const [appsSnap, candsSnap] = await Promise.all([
      getDocs(collection(sharedDb, 'applications')),
      getDocs(collection(sharedDb, 'candidates')).catch(() => null),
    ]);

    const candById = new Map<string, DocumentData>();
    if (candsSnap) {
      for (const snap of candsSnap.docs) {
        const d = snap.data();
        candById.set(String(d.id || snap.id), d);
      }
    }

    return mapSharedApplicationDocs(appsSnap.docs, candById);
  } catch {
    return [];
  }
}

export function subscribeSharedResumeGodamEntries(
  onUpdate: (entries: JobApplication[]) => void
): Unsubscribe {
  const candById = new Map<string, DocumentData>();
  let latestAppDocs: QueryDocumentSnapshot<DocumentData>[] = [];

  const emit = () => {
    if (latestAppDocs.length === 0) return;
    onUpdate(mapSharedApplicationDocs(latestAppDocs, candById));
  };

  const unsubCands = onSnapshot(
    collection(sharedDb, 'candidates'),
    (snapshot) => {
      for (const snap of snapshot.docs) {
        const d = snap.data();
        candById.set(String(d.id || snap.id), d);
      }
      emit();
    },
    () => {
      // Non-fatal if candidate collection listener is temporarily throttled
    }
  );

  const unsubApps = onSnapshot(
    collection(sharedDb, 'applications'),
    (snapshot) => {
      latestAppDocs = snapshot.docs;
      onUpdate(mapSharedApplicationDocs(latestAppDocs, candById));
    },
    () => {
      // Retain existing application state on transient listener errors
    }
  );

  return () => {
    unsubCands();
    unsubApps();
  };
}

export interface SharedCompanyRequirementRecord {
  id: string;
  companyName: string;
  contactPerson: string;
  phone: string;
  city: string;
  postRequired: string;
  salary: string;
  vacancyCount: number;
  jobDescription: string;
  status: string;
  createdAt: string;
}

function mapCompanyRequirementDocs(
  docs: QueryDocumentSnapshot<DocumentData>[]
): SharedCompanyRequirementRecord[] {
  return docs
    .map((snap) => {
      const d = snap.data();
      return {
        id: String(d.id || snap.id),
        companyName: String(d.companyName || ''),
        contactPerson: String(d.contactPerson || ''),
        phone: String(d.phone || ''),
        city: String(d.city || ''),
        postRequired: String(d.postRequired || ''),
        salary: String(d.salary || 'Negotiable'),
        vacancyCount: Math.max(1, Number(d.vacancyCount || 1) || 1),
        jobDescription: String(d.jobDescription || ''),
        status: String(d.status || 'new'),
        createdAt: formatFirestoreDate(d.createdAt),
      };
    })
    .sort((a, b) => Date.parse(b.createdAt || '') - Date.parse(a.createdAt || ''));
}

export async function fetchSharedCompanyRequirements(): Promise<
  SharedCompanyRequirementRecord[]
> {
  try {
    const snap = await getDocs(collection(sharedDb, 'company_requirements'));
    return mapCompanyRequirementDocs(snap.docs);
  } catch {
    return [];
  }
}

export function subscribeSharedCompanyRequirements(
  onUpdate: (entries: SharedCompanyRequirementRecord[]) => void
): Unsubscribe {
  return onSnapshot(
    collection(sharedDb, 'company_requirements'),
    (snapshot) => {
      onUpdate(mapCompanyRequirementDocs(snapshot.docs));
    },
    () => {
      // Non-fatal if collection listener is unavailable offline
    }
  );
}
