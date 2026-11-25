import {
  collection,
  doc,
  DocumentData,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  QueryDocumentSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  startAfter,
  Timestamp,
  Unsubscribe,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import {
  CandidateProfile,
  JobApplication,
  JobApprovalStatus,
  JobListing,
} from '../types/portal';
import { CONFIDENTIAL_COMPANY_LABEL } from './jobHelpers';

export const JOBS_PER_PAGE = 20;

function trimToMax(raw: unknown, max: number, fallback = ''): string {
  const s = String(raw ?? '').trim();
  const clean = s || fallback;
  return clean.slice(0, max);
}

function sanitizeId(raw: string): string {
  const cleaned = String(raw ?? '').replace(/[^a-zA-Z0-9_-]/g, '_');
  return cleaned.slice(0, 128) || `id_${Date.now().toString(36)}`;
}

export function generatePortalRecordId(prefix: 'job' | 'app' | 'res'): string {
  const rand =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '')
      : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
  return `${prefix}_${rand}`.slice(0, 120);
}

function formatFirestoreDate(val: unknown): string {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (val && typeof val === 'object' && 'toDate' in val && typeof (val as { toDate: () => Date }).toDate === 'function') {
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

function normalizeJobStatus(raw: unknown): JobApprovalStatus {
  const val = String(raw || 'Pending').trim().toLowerCase();
  if (val === 'approved' || val === 'active' || val === 'published' || val === 'live') {
    return 'Approved';
  }
  if (val === 'rejected' || val === 'declined' || val === 'closed') {
    return 'Rejected';
  }
  return 'Pending';
}

function mapPublicJobData(id: string, d: DocumentData): JobListing {
  const title = String(d.title || d.jobTitle || d.role || 'Job Opening');
  return {
    id: String(d.id || id),
    title,
    designation: String(d.designation || title),
    company: CONFIDENTIAL_COMPANY_LABEL,
    companyMasked: String(d.companyMasked || CONFIDENTIAL_COMPANY_LABEL),
    location: String(d.location || d.city || 'Pan India'),
    experience: String(d.experience || d.exp || 'As per JD'),
    salary: String(d.salary || d.ctc || d.package || 'Negotiable'),
    jobType: String(d.jobType || 'Full-Time'),
    skills: normalizeSkillsArray(d.skills),
    description: String(d.description || d.jd || d.jobDescription || ''),
    qualification: String(d.qualification || d.education || ''),
    openings: typeof d.openings === 'number' ? d.openings : 1,
    lastDateToApply: String(d.lastDateToApply || 'Open Until Filled'),
    postedAt: String(d.postedAt || formatFirestoreDate(d.createdAt).slice(0, 10)),
    employerId: typeof d.employerUid === 'string' ? d.employerUid : undefined,
    status: 'Approved',
  };
}

function mapPublicJobDoc(snap: QueryDocumentSnapshot<DocumentData>): JobListing {
  return mapPublicJobData(snap.id, snap.data());
}

function mapEmployerJobDoc(snap: QueryDocumentSnapshot<DocumentData>): JobListing {
  const d = snap.data();
  const status = normalizeJobStatus(d.status);
  const title = String(d.title || d.jobTitle || d.role || 'Job Opening');
  return {
    id: String(d.id || snap.id),
    title,
    designation: String(d.designation || title),
    company: String(d.company || d.companyName || 'Confidential Organization'),
    companyMasked: String(d.companyMasked || CONFIDENTIAL_COMPANY_LABEL),
    recruiterName: String(d.recruiterName || d.contactPerson || ''),
    recruiterEmail: String(d.recruiterEmail || d.email || ''),
    recruiterPhone: String(d.recruiterPhone || d.phone || ''),
    location: String(d.location || d.city || 'Pan India'),
    experience: String(d.experience || d.exp || 'As per JD'),
    salary: String(d.salary || d.ctc || d.package || 'Negotiable'),
    jobType: String(d.jobType || 'Full-Time'),
    skills: normalizeSkillsArray(d.skills),
    description: String(d.description || d.jd || d.jobDescription || ''),
    qualification: String(d.qualification || d.education || ''),
    openings: typeof d.openings === 'number' ? d.openings : 1,
    lastDateToApply: String(d.lastDateToApply || 'Open Until Filled'),
    postedAt: String(d.postedAt || formatFirestoreDate(d.createdAt).slice(0, 10)),
    employerId: typeof d.employerUid === 'string' ? d.employerUid : undefined,
    status,
  };
}

function mapApplicationDoc(snap: QueryDocumentSnapshot<DocumentData>): JobApplication {
  const d = snap.data();
  return {
    id: String(d.id || snap.id),
    candidateId: String(d.candidateUid || ''),
    jobId: String(d.jobId || ''),
    jobTitle: String(d.jobTitle || ''),
    companyMasked: String(d.companyMasked || CONFIDENTIAL_COMPANY_LABEL),
    location: String(d.location || ''),
    salary: String(d.salary || ''),
    experience: String(d.experience || ''),
    applicantName: String(d.applicantName || ''),
    applicantEmail: String(d.applicantEmail || ''),
    applicantPhone: String(d.applicantPhone || ''),
    resumeId: String(d.resumeId || ''),
    resumeFileName: String(d.resumeFileName || ''),
    appliedAt: formatFirestoreDate(d.appliedAt),
    status: 'Submitted',
  };
}

function sortJobDocsNewestFirst(docs: QueryDocumentSnapshot<DocumentData>[]): JobListing[] {
  return [...docs]
    .sort((a, b) => {
      const aMs = parseTimestampMs(a.data().createdAt) || parseTimestampMs(a.data().updatedAt);
      const bMs = parseTimestampMs(b.data().createdAt) || parseTimestampMs(b.data().updatedAt);
      return bMs - aMs;
    })
    .map(mapPublicJobDoc);
}

/**
 * Real-time public jobs subscription (Approved jobs from Cloud Firestore).
 * Queries without orderBy so documents without composite indexes or missing createdAt never get dropped.
 */
export function subscribeApprovedPublicJobs(
  onUpdate: (jobs: JobListing[], lastCursor: QueryDocumentSnapshot<DocumentData> | null, hasMore: boolean) => void,
  batchSize = 200
): Unsubscribe {
  const path = 'public_jobs';
  const q = query(
    collection(db, path),
    where('status', '==', 'Approved'),
    limit(batchSize)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const jobs = sortJobDocsNewestFirst(snapshot.docs);
      const lastCursor = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;
      const hasMore = snapshot.docs.length === batchSize;
      onUpdate(jobs, lastCursor, hasMore);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function fetchMoreApprovedPublicJobs(
  afterCursor: QueryDocumentSnapshot<DocumentData>,
  batchSize = 200
): Promise<{
  jobs: JobListing[];
  lastCursor: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
}> {
  const path = 'public_jobs';
  try {
    const q = query(
      collection(db, path),
      where('status', '==', 'Approved'),
      startAfter(afterCursor),
      limit(batchSize)
    );
    const snapshot = await getDocs(q);
    return {
      jobs: sortJobDocsNewestFirst(snapshot.docs),
      lastCursor: snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null,
      hasMore: snapshot.docs.length === batchSize,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function fetchTotalApprovedJobsCount(): Promise<number> {
  const path = 'public_jobs';
  try {
    const q = query(collection(db, path), where('status', '==', 'Approved'));
    const countSnap = await getCountFromServer(q);
    return countSnap.data().count;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function fetchGlobalAutoApproveSetting(): Promise<boolean> {
  if (!auth.currentUser || !auth.currentUser.emailVerified) return false;
  const path = 'portal_settings/jobs';
  try {
    const snap = await getDoc(doc(db, 'portal_settings', 'jobs'));
    if (!snap.exists()) return false;
    return Boolean(snap.data().autoApprove);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function setGlobalAutoApproveSetting(enabled: boolean): Promise<boolean> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Authentication required to update job workflow settings.');
  }
  const path = 'portal_settings/jobs';
  try {
    await setDoc(doc(db, 'portal_settings', 'jobs'), {
      autoApprove: Boolean(enabled),
      updatedByUid: sanitizeId(currentUser.uid),
      updatedAt: serverTimestamp(),
    });
    return Boolean(enabled);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export interface CreateFirestoreJobInput {
  jobId: string;
  company: string;
  recruiterName: string;
  recruiterEmail: string;
  recruiterPhone?: string;
  title: string;
  designation: string;
  location: string;
  experience: string;
  salary: string;
  jobType: string;
  skills: string | string[];
  description: string;
  qualification?: string;
  openings?: number;
  lastDateToApply: string;
  autoApprove?: boolean;
}

export async function createJobInFirestore(
  input: CreateFirestoreJobInput
): Promise<JobListing> {
  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.emailVerified) {
    throw new Error('Please sign in to save and submit your job post.');
  }

  const jobId = sanitizeId(input.jobId);
  const employerUid = sanitizeId(currentUser.uid);
  const isAdminUser = currentUser.email?.toLowerCase() === 'cvforvcs@gmail.com';
  let globalAutoApprove = false;
  try {
    globalAutoApprove = await fetchGlobalAutoApproveSetting();
  } catch {
    globalAutoApprove = false;
  }

  const shouldPublishImmediately = Boolean(
    globalAutoApprove || (isAdminUser && input.autoApprove)
  );
  const status: JobApprovalStatus = shouldPublishImmediately ? 'Approved' : 'Pending';
  const postedAt = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const normalizedSkills = normalizeSkillsArray(input.skills);
  const openingsCount = Math.max(1, Math.min(1000, Math.floor(Number(input.openings) || 1)));
  const cleanQualification = trimToMax(input.qualification, 200);
  const cleanRecruiterPhone = trimToMax(input.recruiterPhone, 30);

  const jobDocData: Record<string, unknown> = {
    id: jobId,
    employerUid,
    company: trimToMax(input.company, 160, 'Confidential Organization'),
    companyMasked: CONFIDENTIAL_COMPANY_LABEL,
    recruiterName: trimToMax(input.recruiterName, 120, 'Hiring Manager'),
    recruiterEmail: trimToMax(input.recruiterEmail.toLowerCase(), 160),
    title: trimToMax(input.title, 180),
    designation: trimToMax(input.designation, 140),
    location: trimToMax(input.location, 140),
    experience: trimToMax(input.experience, 80),
    salary: trimToMax(input.salary, 80),
    jobType: trimToMax(input.jobType, 60, 'Full-Time'),
    skills: normalizedSkills,
    description: trimToMax(input.description, 10000),
    openings: openingsCount,
    lastDateToApply: trimToMax(input.lastDateToApply, 40),
    postedAt: trimToMax(postedAt, 40),
    status,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (cleanQualification) {
    jobDocData.qualification = cleanQualification;
  }
  if (cleanRecruiterPhone) {
    jobDocData.recruiterPhone = cleanRecruiterPhone;
  }

  try {
    if (shouldPublishImmediately) {
      const batch = writeBatch(db);
      const publicDocData: Record<string, unknown> = {
        id: jobId,
        employerUid,
        companyMasked: CONFIDENTIAL_COMPANY_LABEL,
        title: jobDocData.title,
        designation: jobDocData.designation,
        location: jobDocData.location,
        experience: jobDocData.experience,
        salary: jobDocData.salary,
        jobType: jobDocData.jobType,
        skills: normalizedSkills,
        description: jobDocData.description,
        openings: openingsCount,
        lastDateToApply: jobDocData.lastDateToApply,
        postedAt: jobDocData.postedAt,
        status: 'Approved',
        createdAt: serverTimestamp(),
      };
      if (cleanQualification) {
        publicDocData.qualification = cleanQualification;
      }

      batch.set(doc(db, 'jobs', jobId), jobDocData);
      batch.set(doc(db, 'public_jobs', jobId), publicDocData);
      await batch.commit();
    } else {
      await setDoc(doc(db, 'jobs', jobId), jobDocData);
    }

    return {
      id: jobId,
      title: String(jobDocData.title),
      designation: String(jobDocData.designation),
      company: String(jobDocData.company),
      companyMasked: CONFIDENTIAL_COMPANY_LABEL,
      recruiterName: String(jobDocData.recruiterName),
      recruiterEmail: String(jobDocData.recruiterEmail),
      recruiterPhone: cleanRecruiterPhone || undefined,
      location: String(jobDocData.location),
      experience: String(jobDocData.experience),
      salary: String(jobDocData.salary),
      jobType: String(jobDocData.jobType),
      skills: normalizedSkills,
      description: String(jobDocData.description),
      qualification: cleanQualification,
      openings: openingsCount,
      lastDateToApply: String(jobDocData.lastDateToApply),
      postedAt,
      employerId: employerUid,
      status,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `jobs/${jobId}`);
  }
}

export async function updateJobApprovalInFirestore(
  job: JobListing,
  nextStatus: 'Approved' | 'Rejected'
): Promise<JobListing> {
  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.emailVerified) {
    throw new Error('Admin verification required to approve or reject jobs.');
  }

  const jobId = sanitizeId(job.id);
  try {
    const batch = writeBatch(db);
    const jobRef = doc(db, 'jobs', jobId);
    const publicRef = doc(db, 'public_jobs', jobId);

    batch.update(jobRef, {
      status: nextStatus,
      updatedAt: serverTimestamp(),
    });

    if (nextStatus === 'Approved') {
      const publicSnap = await getDoc(publicRef);
      if (!publicSnap.exists()) {
        const jobSnap = await getDoc(jobRef);
        const rawJob = jobSnap.exists() ? jobSnap.data() : null;
        const employerUid = sanitizeId(String(rawJob?.employerUid || job.employerId || currentUser.uid));
        const skillsArr = normalizeSkillsArray(rawJob?.skills || job.skills || []);
        const qualificationStr = trimToMax(rawJob?.qualification ?? job.qualification, 200);
        const publicDocData: Record<string, unknown> = {
          id: jobId,
          employerUid,
          companyMasked: CONFIDENTIAL_COMPANY_LABEL,
          title: trimToMax(rawJob?.title ?? job.title, 180),
          designation: trimToMax(rawJob?.designation ?? job.designation, 140),
          location: trimToMax(rawJob?.location ?? job.location, 140),
          experience: trimToMax(rawJob?.experience ?? job.experience, 80),
          salary: trimToMax(rawJob?.salary ?? job.salary, 80),
          jobType: trimToMax(rawJob?.jobType ?? job.jobType, 60, 'Full-Time'),
          skills: skillsArr,
          description: trimToMax(rawJob?.description ?? job.description, 10000),
          openings: Math.max(1, Math.min(1000, Math.floor(Number(rawJob?.openings ?? job.openings) || 1))),
          lastDateToApply: trimToMax(rawJob?.lastDateToApply ?? job.lastDateToApply, 40, '2026-12-31'),
          postedAt: trimToMax(rawJob?.postedAt ?? job.postedAt, 40),
          status: 'Approved',
          createdAt: serverTimestamp(),
        };
        if (qualificationStr) {
          publicDocData.qualification = qualificationStr;
        }
        batch.set(publicRef, publicDocData);
      }
    } else {
      batch.delete(publicRef);
    }

    await batch.commit();
    return {
      ...job,
      status: nextStatus,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `jobs/${jobId}`);
  }
}

export async function syncApprovedJobsToPublicInFirestore(
  adminJobs: JobListing[]
): Promise<number> {
  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.emailVerified) {
    throw new Error('Admin verification required to publish jobs.');
  }

  const approvedList = adminJobs.filter((j) => j.status === 'Approved');
  if (approvedList.length === 0) return 0;

  let synced = 0;
  for (const job of approvedList) {
    const jobId = sanitizeId(job.id);
    const publicRef = doc(db, 'public_jobs', jobId);
    const publicSnap = await getDoc(publicRef);
    if (!publicSnap.exists()) {
      const employerUid = sanitizeId(job.employerId || currentUser.uid);
      const skillsArr = normalizeSkillsArray(job.skills || []);
      const qualificationStr = trimToMax(job.qualification, 200);
      const publicDocData: Record<string, unknown> = {
        id: jobId,
        employerUid,
        companyMasked: trimToMax(job.companyMasked, 100, CONFIDENTIAL_COMPANY_LABEL),
        title: trimToMax(job.title, 180, 'Job Opening'),
        designation: trimToMax(job.designation || job.title, 140, 'Role'),
        location: trimToMax(job.location, 140, 'Pan India'),
        experience: trimToMax(job.experience, 80, 'As per JD'),
        salary: trimToMax(job.salary, 80, 'Negotiable'),
        jobType: trimToMax(job.jobType, 60, 'Full-Time'),
        skills: skillsArr,
        description: trimToMax(job.description, 10000, 'Details available on request.'),
        openings: Math.max(1, Math.min(1000, Math.floor(Number(job.openings) || 1))),
        lastDateToApply: trimToMax(job.lastDateToApply, 40, 'Open Until Filled'),
        postedAt: trimToMax(job.postedAt, 40, new Date().toISOString().slice(0, 10)),
        status: 'Approved',
        createdAt: serverTimestamp(),
      };
      if (qualificationStr) {
        publicDocData.qualification = qualificationStr;
      }
      await setDoc(publicRef, publicDocData);
      synced += 1;
    }
  }
  return synced;
}

export function subscribeEmployerJobsFromFirestore(
  employerUid: string,
  onUpdate: (jobs: JobListing[]) => void
): Unsubscribe {
  const path = 'jobs';
  const q = query(
    collection(db, path),
    where('employerUid', '==', employerUid)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const sorted = [...snapshot.docs]
        .sort((a, b) => parseTimestampMs(b.data().createdAt) - parseTimestampMs(a.data().createdAt))
        .map(mapEmployerJobDoc);
      onUpdate(sorted);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeAdminJobsFromFirestore(
  onUpdate: (jobs: JobListing[]) => void
): Unsubscribe {
  const path = 'jobs';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const sorted = [...snapshot.docs]
        .sort((a, b) => parseTimestampMs(b.data().createdAt) - parseTimestampMs(a.data().createdAt))
        .map(mapEmployerJobDoc);
      onUpdate(sorted);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function publicJobExistsInFirestore(jobId: string): Promise<boolean> {
  const cleanId = sanitizeId(jobId);
  try {
    const snap = await getDoc(doc(db, 'public_jobs', cleanId));
    return snap.exists() && snap.data()?.status === 'Approved';
  } catch {
    return false;
  }
}

export async function fetchPublicJobById(jobId: string): Promise<JobListing | null> {
  const cleanId = sanitizeId(jobId);
  if (!cleanId) return null;
  try {
    const snap = await getDoc(doc(db, 'public_jobs', cleanId));
    if (!snap.exists() || snap.data()?.status !== 'Approved') {
      return null;
    }
    return mapPublicJobData(snap.id, snap.data());
  } catch {
    return null;
  }
}

export interface CreateFirestoreApplicationInput {
  applicationId: string;
  job: JobListing;
  applicantName: string;
  applicantEmail: string;
  applicantPhone: string;
  resumeId: string;
  resumeFileName: string;
}

export async function createApplicationInFirestore(
  input: CreateFirestoreApplicationInput
): Promise<JobApplication> {
  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.emailVerified) {
    throw new Error('Please sign in to submit your application.');
  }

  const applicationId = sanitizeId(input.applicationId);
  const candidateUid = sanitizeId(currentUser.uid);
  const jobId = sanitizeId(input.job.id);
  const cleanPhoneDigits = input.applicantPhone.replace(/\D/g, '');
  const phoneFormatted =
    cleanPhoneDigits.length >= 10
      ? cleanPhoneDigits.slice(-10)
      : trimToMax(input.applicantPhone, 20);

  const appDocData: Record<string, unknown> = {
    id: applicationId,
    candidateUid,
    jobId,
    jobTitle: trimToMax(input.job.title, 180),
    companyMasked: trimToMax(input.job.companyMasked || CONFIDENTIAL_COMPANY_LABEL, 100),
    location: trimToMax(input.job.location, 140),
    salary: trimToMax(input.job.salary, 80),
    experience: trimToMax(input.job.experience, 80),
    applicantName: trimToMax(input.applicantName, 120),
    applicantEmail: trimToMax(input.applicantEmail.toLowerCase(), 160),
    applicantPhone: phoneFormatted.padEnd(10, '0').slice(0, 20),
    resumeId: sanitizeId(input.resumeId),
    resumeFileName: trimToMax(input.resumeFileName, 240, 'resume.pdf'),
    status: 'Submitted',
    appliedAt: serverTimestamp(),
  };

  if (input.job.employerId && /^[a-zA-Z0-9_-]{1,128}$/.test(input.job.employerId)) {
    appDocData.employerUid = input.job.employerId;
  }

  try {
    await setDoc(doc(db, 'applications', applicationId), appDocData);
    return {
      id: applicationId,
      candidateId: candidateUid,
      jobId,
      jobTitle: String(appDocData.jobTitle),
      companyMasked: String(appDocData.companyMasked),
      location: String(appDocData.location),
      salary: String(appDocData.salary),
      experience: String(appDocData.experience),
      applicantName: String(appDocData.applicantName),
      applicantEmail: String(appDocData.applicantEmail),
      applicantPhone: String(appDocData.applicantPhone),
      resumeId: String(appDocData.resumeId),
      resumeFileName: String(appDocData.resumeFileName),
      appliedAt: new Date().toISOString(),
      status: 'Submitted',
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `applications/${applicationId}`);
  }
}

export function subscribeCandidateApplicationsFromFirestore(
  candidateUid: string,
  onUpdate: (applications: JobApplication[]) => void
): Unsubscribe {
  const path = 'applications';
  const q = query(
    collection(db, path),
    where('candidateUid', '==', candidateUid)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const sorted = [...snapshot.docs]
        .sort((a, b) => parseTimestampMs(b.data().appliedAt) - parseTimestampMs(a.data().appliedAt))
        .map(mapApplicationDoc);
      onUpdate(sorted);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeEmployerApplicationsFromFirestore(
  employerUid: string,
  onUpdate: (applications: JobApplication[]) => void
): Unsubscribe {
  const path = 'applications';
  const q = query(
    collection(db, path),
    where('employerUid', '==', employerUid)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const sorted = [...snapshot.docs]
        .sort((a, b) => parseTimestampMs(b.data().appliedAt) - parseTimestampMs(a.data().appliedAt))
        .map(mapApplicationDoc);
      onUpdate(sorted);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeAdminApplicationsFromFirestore(
  onUpdate: (applications: JobApplication[]) => void
): Unsubscribe {
  const path = 'applications';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const sorted = [...snapshot.docs]
        .sort((a, b) => parseTimestampMs(b.data().appliedAt) - parseTimestampMs(a.data().appliedAt))
        .map(mapApplicationDoc);
      onUpdate(sorted);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function syncUserProfileToFirestore(profile: CandidateProfile): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.emailVerified) return;

  const uid = sanitizeId(currentUser.uid);
  const path = `users/${uid}`;
  try {
    const ref = doc(db, 'users', uid);
    const snap = await getDoc(ref);
    const baseData: Record<string, unknown> = {
      uid,
      role: profile.role,
      name: trimToMax(profile.name, 120, 'User'),
      email: trimToMax(profile.email.toLowerCase(), 160),
      updatedAt: serverTimestamp(),
    };
    if (profile.phone) baseData.phone = trimToMax(profile.phone, 20);
    if (profile.city) baseData.city = trimToMax(profile.city, 120);
    if (profile.experience) baseData.experience = trimToMax(profile.experience, 80);
    if (profile.companyName) baseData.companyName = trimToMax(profile.companyName, 160);
    if (profile.resumeFileName) baseData.resumeFileName = trimToMax(profile.resumeFileName, 240);

    if (!snap.exists()) {
      await setDoc(ref, {
        ...baseData,
        createdAt: serverTimestamp(),
      });
    } else {
      await setDoc(
        ref,
        {
          ...baseData,
          role: snap.data().role || profile.role,
          createdAt: snap.data().createdAt,
        },
        { merge: false }
      );
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

function mapResumeGodamDoc(snap: QueryDocumentSnapshot<DocumentData>): JobApplication {
  const d = snap.data();
  const resumeId = sanitizeId(String(d.id || snap.id));
  return {
    id: String(d.id || snap.id),
    candidateId: String(d.candidateUid || ''),
    jobId: String(d.jobId || 'general_resume'),
    jobTitle: String(d.jobTitle || 'Candidate Application'),
    companyMasked: String(d.companyMasked || CONFIDENTIAL_COMPANY_LABEL),
    location: String(d.city || ''),
    city: String(d.city || ''),
    salary: 'As per Industry Standards',
    experience: String(d.qualificationExperience || ''),
    qualificationExperience: String(d.qualificationExperience || ''),
    resumeSummary: d.resumeSummary ? String(d.resumeSummary) : undefined,
    applicantName: String(d.applicantName || ''),
    applicantEmail: String(d.applicantEmail || ''),
    applicantPhone: String(d.applicantPhone || ''),
    resumeId,
    resumeFileName: String(d.resumeFileName || 'resume.pdf'),
    resumeBase64: typeof d.resumeBase64 === 'string' ? d.resumeBase64 : undefined,
    termsAccepted: Boolean(d.termsAccepted),
    appliedAt: formatFirestoreDate(d.createdAt),
    status: 'Submitted',
    source: 'resume-godam',
  };
}

export interface CreateResumeGodamInput {
  entryId?: string;
  jobId: string;
  jobTitle: string;
  companyMasked?: string;
  applicantName: string;
  applicantEmail: string;
  applicantPhone: string;
  city: string;
  qualificationExperience: string;
  resumeSummary?: string;
  resumeFileName: string;
  resumeBase64: string;
  termsAccepted: boolean;
}

export async function createResumeGodamEntryInFirestore(
  input: CreateResumeGodamInput
): Promise<JobApplication> {
  const entryId = sanitizeId(input.entryId || generatePortalRecordId('app'));
  const cleanJobId = sanitizeId(input.jobId || 'general_resume');
  const cleanPhoneDigits = String(input.applicantPhone || '').replace(/\D/g, '');
  const phoneFormatted =
    cleanPhoneDigits.length >= 10
      ? cleanPhoneDigits.slice(-10)
      : trimToMax(input.applicantPhone, 20).padEnd(10, '0');
  const resumeBase64 = String(input.resumeBase64 ?? '').slice(0, 800000);
  const companyMasked = trimToMax(
    input.companyMasked,
    100,
    CONFIDENTIAL_COMPANY_LABEL
  );
  const city = trimToMax(input.city, 140, 'India');
  const qualificationExperience = trimToMax(
    input.qualificationExperience,
    240,
    'Qualified Candidate'
  );
  const cleanSummary = trimToMax(input.resumeSummary, 2000);
  const currentUser = auth.currentUser;
  const verifiedUid =
    currentUser && currentUser.emailVerified ? sanitizeId(currentUser.uid) : '';

  const godamDoc: Record<string, unknown> = {
    id: entryId,
    jobId: cleanJobId,
    jobTitle: trimToMax(input.jobTitle, 180, 'Candidate Application'),
    companyMasked,
    applicantName: trimToMax(input.applicantName, 120),
    applicantEmail: trimToMax(input.applicantEmail.toLowerCase(), 160),
    applicantPhone: phoneFormatted.slice(0, 20),
    city,
    qualificationExperience,
    resumeFileName: trimToMax(input.resumeFileName, 240, 'resume.pdf'),
    resumeFileType: 'pdf',
    resumeBase64,
    termsAccepted: Boolean(input.termsAccepted),
    status: 'Submitted',
    createdAt: serverTimestamp(),
  };

  if (verifiedUid) {
    godamDoc.candidateUid = verifiedUid;
  }
  if (cleanSummary) {
    godamDoc.resumeSummary = cleanSummary;
  }

  try {
    await setDoc(doc(db, 'resume_godam', entryId), godamDoc);
    return {
      id: entryId,
      candidateId: verifiedUid,
      jobId: cleanJobId,
      jobTitle: String(godamDoc.jobTitle),
      companyMasked,
      location: city,
      city,
      salary: 'As per Industry Standards',
      experience: qualificationExperience,
      qualificationExperience,
      resumeSummary: cleanSummary || undefined,
      applicantName: String(godamDoc.applicantName),
      applicantEmail: String(godamDoc.applicantEmail),
      applicantPhone: String(godamDoc.applicantPhone),
      resumeId: entryId,
      resumeFileName: String(godamDoc.resumeFileName),
      resumeBase64,
      termsAccepted: true,
      appliedAt: new Date().toISOString(),
      status: 'Submitted',
      source: 'resume-godam',
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `resume_godam/${entryId}`);
  }
}

export function subscribeAdminResumeGodamFromFirestore(
  onUpdate: (entries: JobApplication[]) => void
): Unsubscribe {
  const path = 'resume_godam';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const sorted = [...snapshot.docs]
        .sort(
          (a, b) =>
            parseTimestampMs(b.data().createdAt) - parseTimestampMs(a.data().createdAt)
        )
        .map(mapResumeGodamDoc);
      onUpdate(sorted);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeCandidateResumeGodamFromFirestore(
  candidateUid: string,
  onUpdate: (entries: JobApplication[]) => void
): Unsubscribe {
  const path = 'resume_godam';
  const q = query(
    collection(db, path),
    where('candidateUid', '==', candidateUid)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const sorted = [...snapshot.docs]
        .sort(
          (a, b) =>
            parseTimestampMs(b.data().createdAt) - parseTimestampMs(a.data().createdAt)
        )
        .map(mapResumeGodamDoc);
      onUpdate(sorted);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function getIstDateKey(now: Date = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function logNonFatalFirestoreFailure(
  error: unknown,
  operationType: OperationType,
  path: string
): void {
  try {
    handleFirestoreError(error, operationType, path);
  } catch {
    // Logged cleanly via handleFirestoreError without crashing the page
  }
}

export function subscribeDailyVisitorsFromFirestore(
  dateKey: string,
  onUpdate: (count: number) => void,
  onError?: (error: unknown) => void
): Unsubscribe {
  const cleanDateKey = /^\d{4}-\d{2}-\d{2}$/.test(dateKey)
    ? dateKey
    : getIstDateKey();
  const path = `daily_visitors/${cleanDateKey}`;

  return onSnapshot(
    doc(db, 'daily_visitors', cleanDateKey),
    (snapshot) => {
      if (!snapshot.exists()) {
        onUpdate(0);
        return;
      }
      const rawCount = snapshot.data()?.count;
      const count = typeof rawCount === 'number' && Number.isFinite(rawCount)
        ? Math.max(0, Math.floor(rawCount))
        : 0;
      onUpdate(count);
    },
    (error) => {
      logNonFatalFirestoreFailure(error, OperationType.GET, path);
      onError?.(error);
    }
  );
}

export async function recordDailyVisitorHitInFirestore(
  rawVisitorId: string,
  dateKey: string = getIstDateKey()
): Promise<number | null> {
  const cleanDateKey = /^\d{4}-\d{2}-\d{2}$/.test(dateKey)
    ? dateKey
    : getIstDateKey();
  const cleanVisitorId = sanitizeId(rawVisitorId);
  const boundedVisitorId =
    cleanVisitorId.length >= 8
      ? cleanVisitorId.slice(0, 64)
      : `${cleanVisitorId}_visitor`.slice(0, 64);
  const hitId = `${cleanDateKey}_${boundedVisitorId}`.slice(0, 128);
  const summaryRef = doc(db, 'daily_visitors', cleanDateKey);
  const hitRef = doc(db, 'daily_visitor_hits', hitId);

  try {
    const nextCount = await runTransaction(db, async (transaction) => {
      const hitSnap = await transaction.get(hitRef);
      const summarySnap = await transaction.get(summaryRef);
      const existingCount =
        summarySnap.exists() && typeof summarySnap.data()?.count === 'number'
          ? Math.max(0, Math.floor(summarySnap.data().count))
          : 0;

      if (hitSnap.exists()) {
        return existingCount;
      }

      const updatedCount = summarySnap.exists() ? existingCount + 1 : 1;

      transaction.set(hitRef, {
        id: hitId,
        date: cleanDateKey,
        visitorId: boundedVisitorId,
        createdAt: serverTimestamp(),
      });

      if (!summarySnap.exists()) {
        transaction.set(summaryRef, {
          date: cleanDateKey,
          count: 1,
          lastHitId: hitId,
          updatedAt: serverTimestamp(),
        });
      } else {
        transaction.update(summaryRef, {
          count: updatedCount,
          lastHitId: hitId,
          updatedAt: serverTimestamp(),
        });
      }

      return updatedCount;
    });

    return nextCount;
  } catch (error) {
    logNonFatalFirestoreFailure(
      error,
      OperationType.WRITE,
      `daily_visitors/${cleanDateKey}`
    );
    return null;
  }
}
