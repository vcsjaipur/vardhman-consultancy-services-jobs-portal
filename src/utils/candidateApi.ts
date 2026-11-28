import {
  AcademicEntry,
  AdminEmailStatusResponse,
  AdminJobAlertsOverview,
  AiCareerCopilotResponse,
  AiCoverLetterResponse,
  AiInterviewCoachResponse,
  AiJobAnalysis,
  AiResumeAssistResponse,
  AutoApplyConfig,
  CandidateProfile,
  EmailDispatchSummary,
  InsightCategory,
  InsightPost,
  InterviewReminder,
  JobAlertPreviewJob,
  JobApplication,
  JobListing,
  SearchHistoryItem,
  SkillTestQuestion,
  SkillTestResult,
  UserRole,
  WorkExperienceEntry,
} from '../types/portal';
import {
  enqueueOfflineApiRequest,
  isOfflineOrNetworkError,
  registerOfflineAuthProviders,
} from './offlineSyncManager';

const TOKEN_STORAGE_KEY = 'vcs_candidate_session_token';
const PROFILE_CACHE_KEY = 'vcs_cached_candidate_profile_v1';
const VISITOR_ID_STORAGE_KEY = 'vcs_visitor_client_id';
export const MAX_RESUME_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

export function normalizeEmailInput(raw: string): string {
  return String(raw ?? '').trim().toLowerCase();
}

export function normalizeMobileInput(raw: string): string {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length > 10) {
    return digits.slice(-10);
  }
  return digits;
}

export function normalizeLoginIdentifier(raw: string): string {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return '';
  if (trimmed.includes('@')) {
    return normalizeEmailInput(trimmed);
  }
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length >= 10 && /^[\d\s+\-()]+$/.test(trimmed)) {
    return normalizeMobileInput(trimmed);
  }
  return trimmed;
}

export class ApiRequestError extends Error {
  status: number;
  code?: string;
  field?: string;

  constructor(message: string, status: number, code?: string, field?: string) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
    this.field = field;
  }
}

let inMemoryFallbackVisitorId: string | null = null;

export function getOrCreateVisitorId(): string {
  const createFreshId = () => {
    const rand =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
        : Math.random().toString(36).slice(2, 12);
    return `v_${Date.now().toString(36)}_${rand}`.slice(0, 64);
  };

  try {
    const existing = window.localStorage.getItem(VISITOR_ID_STORAGE_KEY);
    if (existing && /^[a-zA-Z0-9_-]{8,64}$/.test(existing)) {
      return existing;
    }
    const generated = createFreshId();
    window.localStorage.setItem(VISITOR_ID_STORAGE_KEY, generated);
    return generated;
  } catch {
    try {
      const sessionExisting = window.sessionStorage.getItem(VISITOR_ID_STORAGE_KEY);
      if (sessionExisting && /^[a-zA-Z0-9_-]{8,64}$/.test(sessionExisting)) {
        return sessionExisting;
      }
      const generated = createFreshId();
      window.sessionStorage.setItem(VISITOR_ID_STORAGE_KEY, generated);
      return generated;
    } catch {
      if (!inMemoryFallbackVisitorId) {
        inMemoryFallbackVisitorId = createFreshId();
      }
      return inMemoryFallbackVisitorId;
    }
  }
}

export function getStoredToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function getCachedCandidateProfile(): CandidateProfile | null {
  try {
    const token = getStoredToken();
    if (!token) return null;
    const raw = window.localStorage.getItem(PROFILE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CandidateProfile | null;
    return parsed && typeof parsed.id === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

export function setCachedCandidateProfile(profile: CandidateProfile | null): void {
  try {
    if (profile) {
      window.localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile));
    } else {
      window.localStorage.removeItem(PROFILE_CACHE_KEY);
    }
  } catch {
    // Ignore storage quota errors
  }
}

export function setStoredToken(token: string | null): void {
  try {
    if (token) {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
      window.localStorage.removeItem(PROFILE_CACHE_KEY);
    }
  } catch {
    // Ignore storage quota errors
  }
}

registerOfflineAuthProviders(getStoredToken, getOrCreateVisitorId);

export async function readResumeFileAsBase64(
  file: File
): Promise<{ fileName: string; base64: string; sizeBytes: number }> {
  const lower = file.name.toLowerCase();
  const allowedMimes = new Set([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ]);
  const hasAllowedExt =
    lower.endsWith('.pdf') || lower.endsWith('.doc') || lower.endsWith('.docx');

  if (!allowedMimes.has(file.type) && !hasAllowedExt) {
    throw new Error('Only PDF, DOC, and DOCX files are allowed (max 10 MB).');
  }
  if (file.size === 0) {
    throw new Error('The selected resume file is empty.');
  }
  if (file.size > MAX_RESUME_BYTES) {
    throw new Error('Resume file must be 10 MB or smaller.');
  }

  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Could not read the selected resume file.'));
      }
    };
    reader.onerror = () => reject(new Error('Could not read the selected resume file.'));
    reader.readAsDataURL(file);
  });

  return {
    fileName: file.name,
    base64,
    sizeBytes: file.size,
  };
}

export async function readPdfFileAsBase64(
  file: File
): Promise<{ fileName: string; base64: string; sizeBytes: number }> {
  const isPdfMime = file.type === 'application/pdf';
  const isPdfExt = file.name.toLowerCase().endsWith('.pdf');
  if (!isPdfMime && !isPdfExt) {
    throw new Error('Only PDF files (.pdf) are allowed for resume upload.');
  }
  return readResumeFileAsBase64(file);
}

const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL || '')
  .trim()
  .replace(/\/+$/, '');

export function resolveApiUrl(url: string): string {
  if (url.startsWith('/api') && API_BASE_URL) {
    return `${API_BASE_URL}${url}`;
  }
  return url;
}

async function apiRequest<T>(
  url: string,
  options: RequestInit = {},
  includeAuth = true
): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  headers.set('X-Visitor-Id', getOrCreateVisitorId());
  if (includeAuth) {
    const token = getStoredToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  const response = await fetch(resolveApiUrl(url), { ...options, headers });
  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  if (url.startsWith('/api') && !contentType.includes('application/json')) {
    throw new ApiRequestError(
      'Server API is unavailable on this static host. Please use Continue with Google or configure VITE_API_BASE_URL.',
      503,
      'BACKEND_UNAVAILABLE'
    );
  }
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const message =
      typeof data.error === 'string' && data.error
        ? data.error
        : 'Request failed. Please try again.';
    const code = typeof data.code === 'string' ? data.code : undefined;
    const field = typeof data.field === 'string' ? data.field : undefined;
    throw new ApiRequestError(message, response.status, code, field);
  }
  return data as T;
}

export interface RegisterPayload {
  role?: UserRole;
  name: string;
  email: string;
  phone?: string;
  password: string;
  pin?: string;
  city?: string;
  experience?: string;
  companyName?: string;
  fullAddress?: string;
  currentRequirements?: string;
  jdFileName?: string;
  jdBase64?: string;
  resumeFileName?: string;
  resumeBase64?: string;
  fatherName?: string;
  motherName?: string;
  dob?: string;
  state?: string;
  districtCity?: string;
  pinCode?: string;
  qualification?: string;
  designation?: string;
  currentCompany?: string;
  currentCtc?: string;
  expectedSalary?: string;
  noticePeriod?: string;
  keySkills?: string[];
  preferredLocation?: string;
  preferredRole?: string;
  jobType?: string;
  resumeHeadline?: string;
  profileSummary?: string;
  careerSummary?: string;
  resumeSummary?: string;
  maritalStatus?: string;
  spouseName?: string;
  emergencyContact?: string;
  academicDetails?: AcademicEntry[];
  workExperience?: WorkExperienceEntry[];
  termsAccepted?: boolean;
}

export interface AccountStatusResponse {
  exists: boolean;
  matchedBy?: 'email' | 'phone';
  normalizedEmail?: string;
  normalizedPhone?: string;
  role?: UserRole;
}

export async function checkAccountStatus(payload: {
  identifier?: string;
  email?: string;
  phone?: string;
}): Promise<AccountStatusResponse> {
  return apiRequest<AccountStatusResponse>(
    '/api/auth/account-status',
    {
      method: 'POST',
      body: JSON.stringify({
        identifier: payload.identifier ? normalizeLoginIdentifier(payload.identifier) : undefined,
        email: payload.email ? normalizeEmailInput(payload.email) : undefined,
        phone: payload.phone ? normalizeMobileInput(payload.phone) : undefined,
      }),
    },
    false
  );
}

export async function registerCandidate(
  payload: RegisterPayload
): Promise<{ token: string; candidate: CandidateProfile; initialJob?: JobListing | null }> {
  const cleanPhone = payload.phone ? normalizeMobileInput(payload.phone) : '';
  const normalizedPayload: RegisterPayload = {
    ...payload,
    email: normalizeEmailInput(payload.email),
    phone: cleanPhone || undefined,
  };
  const result = await apiRequest<{
    token: string;
    candidate: CandidateProfile;
    initialJob?: JobListing | null;
  }>(
    '/api/auth/register',
    {
      method: 'POST',
      body: JSON.stringify(normalizedPayload),
    },
    false
  );
  setStoredToken(result.token);
  setCachedCandidateProfile(result.candidate);
  return result;
}

export async function loginCandidate(
  identifier: string,
  password: string
): Promise<{ token: string; candidate: CandidateProfile }> {
  const normalizedId = normalizeLoginIdentifier(identifier);
  const result = await apiRequest<{ token: string; candidate: CandidateProfile }>(
    '/api/auth/login',
    {
      method: 'POST',
      body: JSON.stringify({ identifier: normalizedId, email: normalizedId, password }),
    },
    false
  );
  setStoredToken(result.token);
  setCachedCandidateProfile(result.candidate);
  return result;
}

export async function loginCandidateWithPin(
  identifier: string,
  pin: string
): Promise<{ token: string; candidate: CandidateProfile }> {
  const normalizedId = normalizeLoginIdentifier(identifier);
  const result = await apiRequest<{ token: string; candidate: CandidateProfile }>(
    '/api/auth/pin-login',
    {
      method: 'POST',
      body: JSON.stringify({ identifier: normalizedId, pin }),
    },
    false
  );
  setStoredToken(result.token);
  setCachedCandidateProfile(result.candidate);
  return result;
}

export async function sendAuthOtp(
  target: string,
  purpose: 'register' | 'login' | 'reset'
): Promise<{
  sent: boolean;
  targetDisplay: string;
  deliveredVia?: 'smtp' | 'queued';
  verificationCode?: string;
  expiresInSeconds?: number;
  message: string;
}> {
  return apiRequest<{
    sent: boolean;
    targetDisplay: string;
    deliveredVia?: 'smtp' | 'queued';
    verificationCode?: string;
    expiresInSeconds?: number;
    message: string;
  }>(
    '/api/auth/otp/send',
    {
      method: 'POST',
      body: JSON.stringify({ target: normalizeLoginIdentifier(target), purpose }),
    },
    false
  );
}

export async function verifyAuthOtp(
  target: string,
  otp: string,
  purpose: 'register' | 'login' | 'reset'
): Promise<{ verified: boolean; message: string }> {
  return apiRequest<{ verified: boolean; message: string }>(
    '/api/auth/otp/verify',
    {
      method: 'POST',
      body: JSON.stringify({ target: normalizeLoginIdentifier(target), otp, purpose }),
    },
    false
  );
}

export async function loginCandidateWithOtp(
  target: string,
  otp: string
): Promise<{ token: string; candidate: CandidateProfile }> {
  const result = await apiRequest<{ token: string; candidate: CandidateProfile }>(
    '/api/auth/otp/login',
    {
      method: 'POST',
      body: JSON.stringify({ target: normalizeLoginIdentifier(target), otp }),
    },
    false
  );
  setStoredToken(result.token);
  setCachedCandidateProfile(result.candidate);
  return result;
}

export async function resetCandidateCredentials(payload: {
  target: string;
  otp: string;
  newPassword: string;
  newPin?: string;
}): Promise<{ reset: boolean; message: string }> {
  return apiRequest<{ reset: boolean; message: string }>(
    '/api/auth/reset-credentials',
    {
      method: 'POST',
      body: JSON.stringify({
        ...payload,
        target: normalizeLoginIdentifier(payload.target),
      }),
    },
    false
  );
}

export async function loginWithGoogleToken(
  idToken: string,
  preferredRole: UserRole = 'candidate'
): Promise<{ token: string; candidate: CandidateProfile }> {
  const result = await apiRequest<{ token: string; candidate: CandidateProfile }>(
    '/api/auth/google',
    {
      method: 'POST',
      body: JSON.stringify({ idToken, preferredRole }),
    },
    false
  );
  setStoredToken(result.token);
  setCachedCandidateProfile(result.candidate);
  return result;
}

export async function fetchCurrentCandidate(): Promise<CandidateProfile | null> {
  const token = getStoredToken();
  if (!token) return null;
  if (token.startsWith('static_')) {
    return getCachedCandidateProfile();
  }
  try {
    const result = await apiRequest<{ candidate: CandidateProfile }>('/api/auth/me');
    setCachedCandidateProfile(result.candidate);
    return result.candidate;
  } catch (err) {
    if (err instanceof ApiRequestError && err.status === 401) {
      setStoredToken(null);
      return null;
    }
    return getCachedCandidateProfile();
  }
}

export async function uploadCandidateResume(
  resumeFileName: string,
  resumeBase64: string
): Promise<CandidateProfile> {
  const result = await apiRequest<{ candidate: CandidateProfile }>(
    '/api/candidate/resume',
    {
      method: 'POST',
      body: JSON.stringify({ resumeFileName, resumeBase64 }),
    }
  );
  setCachedCandidateProfile(result.candidate);
  return result.candidate;
}

export interface UpdateCandidateProfilePayload {
  name: string;
  email: string;
  phone: string;
  city: string;
  districtCity?: string;
  state?: string;
  pinCode?: string;
  dob?: string;
  fatherName?: string;
  motherName?: string;
  maritalStatus?: string;
  spouseName?: string;
  emergencyContact?: string;
  experience: string;
  qualification?: string;
  currentCompany?: string;
  designation?: string;
  currentCtc?: string;
  expectedSalary?: string;
  noticePeriod?: string;
  jobType?: string;
  preferredLocation?: string;
  preferredRole?: string;
  resumeHeadline?: string;
  profileSummary?: string;
  careerSummary?: string;
  resumeSummary?: string;
  keySkills?: string[];
  academicDetails?: AcademicEntry[];
  workExperience?: WorkExperienceEntry[];
}

export async function updateCandidateProfile(
  payload: UpdateCandidateProfilePayload
): Promise<CandidateProfile> {
  const result = await apiRequest<{ candidate: CandidateProfile }>(
    '/api/candidate/profile',
    {
      method: 'PATCH',
      body: JSON.stringify({
        ...payload,
        email: normalizeEmailInput(payload.email),
        phone: normalizeMobileInput(payload.phone),
      }),
    }
  );
  setCachedCandidateProfile(result.candidate);
  return result.candidate;
}

export async function uploadCandidatePhoto(payload: {
  photoBase64?: string;
  removePhoto?: boolean;
}): Promise<CandidateProfile> {
  const result = await apiRequest<{ candidate: CandidateProfile }>(
    '/api/candidate/photo',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
  setCachedCandidateProfile(result.candidate);
  return result.candidate;
}

export async function fetchMyApplications(): Promise<JobApplication[]> {
  const result = await apiRequest<{ applications: JobApplication[] }>('/api/applications');
  return result.applications;
}

export interface SubmitApplicationPayload {
  id?: string;
  jobId: string;
  jobTitle: string;
  companyMasked: string;
  location: string;
  salary: string;
  experience: string;
  city?: string;
  qualificationExperience?: string;
  resumeSummary?: string;
  applicantName: string;
  applicantEmail: string;
  applicantPhone: string;
  useProfileResume?: boolean;
  resumeFileName?: string;
  resumeBase64?: string;
  termsAccepted?: boolean;
}

export async function submitJobApplication(
  payload: SubmitApplicationPayload
): Promise<JobApplication> {
  try {
    const result = await apiRequest<{
      application: JobApplication;
      emailDispatch?: EmailDispatchSummary;
    }>('/api/applications', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return result.application;
  } catch (err) {
    if (isOfflineOrNetworkError(err)) {
      enqueueOfflineApiRequest({
        id: payload.id,
        url: '/api/applications',
        body: payload,
        includeAuth: true,
        label: `Candidate Application: ${payload.applicantName}`,
      });
      return {
        id: payload.id || `offline_app_${Date.now()}`,
        candidateId: 'offline_queued',
        jobId: payload.jobId,
        jobTitle: payload.jobTitle,
        companyMasked: payload.companyMasked,
        location: payload.location,
        salary: payload.salary,
        experience: payload.experience,
        city: payload.city || payload.location,
        qualificationExperience: payload.qualificationExperience,
        resumeSummary: payload.resumeSummary,
        applicantName: payload.applicantName,
        applicantEmail: payload.applicantEmail,
        applicantPhone: payload.applicantPhone,
        resumeId: payload.id || 'offline_resume',
        resumeFileName: payload.resumeFileName || 'resume.pdf',
        resumeBase64: payload.resumeBase64,
        termsAccepted: payload.termsAccepted ?? true,
        appliedAt: new Date().toISOString(),
        status: 'Submitted',
        source: 'applications',
      };
    }
    throw err;
  }
}

export interface PublicApplicationPayload {
  id?: string;
  jobId: string;
  jobTitle: string;
  companyMasked?: string;
  location?: string;
  salary?: string;
  experience?: string;
  city: string;
  qualificationExperience: string;
  resumeSummary?: string;
  applicantName: string;
  applicantEmail: string;
  applicantPhone: string;
  resumeFileName: string;
  resumeBase64: string;
  termsAccepted: boolean;
}

export async function submitPublicApplication(
  payload: PublicApplicationPayload
): Promise<JobApplication> {
  try {
    const result = await apiRequest<{
      application: JobApplication;
      emailDispatch?: EmailDispatchSummary;
    }>(
      '/api/public/applications',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      false
    );
    return result.application;
  } catch (err) {
    if (isOfflineOrNetworkError(err)) {
      enqueueOfflineApiRequest({
        id: payload.id,
        url: '/api/public/applications',
        body: payload,
        includeAuth: false,
        label: `Candidate Application: ${payload.applicantName}`,
      });
      return {
        id: payload.id || `offline_pub_${Date.now()}`,
        candidateId: 'public_job_portal',
        jobId: payload.jobId,
        jobTitle: payload.jobTitle,
        companyMasked: payload.companyMasked || 'Confidential - Apply via VCS',
        location: payload.location || payload.city,
        city: payload.city,
        salary: payload.salary || 'As per Industry Standards',
        experience: payload.experience || payload.qualificationExperience,
        qualificationExperience: payload.qualificationExperience,
        resumeSummary: payload.resumeSummary,
        applicantName: payload.applicantName,
        applicantEmail: payload.applicantEmail,
        applicantPhone: payload.applicantPhone,
        resumeId: payload.id || 'offline_resume',
        resumeFileName: payload.resumeFileName,
        resumeBase64: payload.resumeBase64,
        termsAccepted: payload.termsAccepted,
        appliedAt: new Date().toISOString(),
        status: 'Submitted',
        source: 'resume-godam',
      };
    }
    throw err;
  }
}

export async function fetchAdminApplications(): Promise<JobApplication[]> {
  const result = await apiRequest<{ applications: JobApplication[] }>(
    '/api/admin/applications'
  );
  return result.applications.map((app) => ({
    ...app,
    source: app.source || 'server',
  }));
}

export async function fetchResumeBlobUrl(resumeId: string): Promise<string> {
  const token = getStoredToken();
  if (!token) {
    throw new Error('Please log in as Admin to view this resume.');
  }
  const response = await fetch(resolveApiUrl(`/api/resumes/${encodeURIComponent(resumeId)}`), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    throw new Error('Unable to load resume PDF.');
  }
  const blob = await response.blob();
  const pdfBlob =
    blob.type === 'application/pdf'
      ? blob
      : new Blob([blob], { type: 'application/pdf' });
  return URL.createObjectURL(pdfBlob);
}

export async function downloadResumePdf(
  resumeId: string,
  fileName: string
): Promise<void> {
  const token = getStoredToken();
  if (!token) {
    throw new Error('Please log in to download your resume.');
  }
  const response = await fetch(resolveApiUrl(`/api/resumes/${encodeURIComponent(resumeId)}`), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    throw new Error('Unable to download resume PDF.');
  }
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName || 'resume.pdf';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
}

export async function fetchApprovedJobs(): Promise<JobListing[]> {
  const result = await apiRequest<{ jobs: JobListing[] }>('/api/jobs/approved', {}, false);
  return result.jobs;
}

export interface PostJobPayload {
  id?: string;
  company: string;
  recruiterName: string;
  recruiterEmail: string;
  recruiterPhone: string;
  title: string;
  designation: string;
  location: string;
  experience: string;
  salary: string;
  jobType: string;
  skills: string;
  description: string;
  lastDateToApply: string;
  qualification?: string;
  openings?: number;
  autoApprove?: boolean;
}

export async function postEmployerJob(
  payload: PostJobPayload
): Promise<{ job: JobListing; message: string; emailDispatches?: EmailDispatchSummary[] }> {
  try {
    return await apiRequest<{
      job: JobListing;
      message: string;
      emailDispatches?: EmailDispatchSummary[];
    }>('/api/jobs', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  } catch (err) {
    if (isOfflineOrNetworkError(err)) {
      enqueueOfflineApiRequest({
        id: payload.id,
        url: '/api/jobs',
        body: payload,
        includeAuth: true,
        label: `Company Requirement: ${payload.company} — ${payload.title}`,
      });
      return {
        job: {
          id: payload.id || `offline_job_${Date.now()}`,
          title: payload.title,
          jobTitle: payload.title,
          designation: payload.designation,
          company: payload.company,
          clientName: payload.company,
          location: payload.location,
          experience: payload.experience,
          salary: payload.salary,
          jobType: payload.jobType,
          skills: payload.skills.split(',').map((s) => s.trim()).filter(Boolean),
          description: payload.description,
          jobDescription: payload.description,
          qualification: payload.qualification || '',
          openings: payload.openings || 1,
          openingsCount: payload.openings || 1,
          lastDateToApply: payload.lastDateToApply,
          postedAt: new Date().toISOString().slice(0, 10),
          status: 'Pending',
        },
        message: 'Saved offline. Requirement will submit automatically once online.',
        emailDispatches: [],
      };
    }
    throw err;
  }
}

export interface PublicCompanyRequirementPayload {
  id?: string;
  companyName: string;
  contactPerson: string;
  phone: string;
  email?: string;
  city: string;
  postRequired: string;
  salary: string;
  vacancyCount: number;
  jobDescription: string;
}

export async function submitPublicCompanyRequirement(
  payload: PublicCompanyRequirementPayload
): Promise<{ job: JobListing; message: string; emailDispatches?: EmailDispatchSummary[] }> {
  try {
    return await apiRequest<{
      job: JobListing;
      message: string;
      emailDispatches?: EmailDispatchSummary[];
    }>(
      '/api/public/company-requirement',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      false
    );
  } catch (err) {
    if (isOfflineOrNetworkError(err)) {
      enqueueOfflineApiRequest({
        id: payload.id,
        url: '/api/public/company-requirement',
        body: payload,
        includeAuth: false,
        label: `Company Requirement: ${payload.companyName} — ${payload.postRequired}`,
      });
      return {
        job: {
          id: payload.id || `offline_req_${Date.now()}`,
          title: payload.postRequired,
          jobTitle: payload.postRequired,
          designation: payload.postRequired,
          company: payload.companyName,
          clientName: payload.companyName,
          location: payload.city,
          experience: 'As per JD',
          salary: payload.salary,
          skills: [payload.postRequired],
          description: payload.jobDescription,
          jobDescription: payload.jobDescription,
          qualification: '',
          openings: payload.vacancyCount,
          openingsCount: payload.vacancyCount,
          postedAt: new Date().toISOString().slice(0, 10),
          status: 'Pending',
        },
        message: 'Saved offline. Requirement will submit automatically once connected.',
        emailDispatches: [],
      };
    }
    throw err;
  }
}

export async function fetchEmployerJobs(): Promise<JobListing[]> {
  const result = await apiRequest<{ jobs: JobListing[] }>('/api/employer/jobs');
  return result.jobs;
}

export async function fetchAdminJobs(): Promise<JobListing[]> {
  const result = await apiRequest<{ jobs: JobListing[] }>('/api/admin/jobs');
  return result.jobs;
}

export async function updateAdminJobStatus(
  jobId: string,
  status: 'Approved' | 'Rejected'
): Promise<JobListing> {
  const result = await apiRequest<{ job: JobListing }>(
    `/api/admin/jobs/${encodeURIComponent(jobId)}/status`,
    {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }
  );
  return result.job;
}

export interface JobAlertPayload {
  name: string;
  email: string;
  channels?: Array<'email'>;
  city: string;
  category: string;
  jobs?: JobListing[];
}

export async function submitJobAlert(
  payload: JobAlertPayload
): Promise<{
  message: string;
  emailDispatch?: EmailDispatchSummary | null;
  matchedJobsCount?: number;
  matchedJobsPreview?: JobAlertPreviewJob[];
}> {
  const wirePayload = {
    name: payload.name,
    email: payload.email,
    channels: payload.channels || ['email'],
    city: payload.city,
    category: payload.category,
    jobs: Array.isArray(payload.jobs)
      ? payload.jobs.slice(0, 60).map((j) => ({
          id: j.id,
          title: j.title,
          designation: j.designation,
          location: j.location,
          experience: j.experience,
          salary: j.salary,
          skills: j.skills,
          qualification: j.qualification,
          description: (j.description || '').slice(0, 350),
        }))
      : undefined,
  };
  try {
    return await apiRequest<{
      message: string;
      emailDispatch?: EmailDispatchSummary | null;
      matchedJobsCount?: number;
      matchedJobsPreview?: JobAlertPreviewJob[];
    }>(
      '/api/job-alerts',
      {
        method: 'POST',
        body: JSON.stringify(wirePayload),
      },
      true
    );
  } catch (err) {
    if (isOfflineOrNetworkError(err)) {
      enqueueOfflineApiRequest({
        url: '/api/job-alerts',
        body: wirePayload,
        includeAuth: true,
        label: `Job Alert Subscription: ${payload.name}`,
      });
      return {
        message: 'Job alert preference saved on this device.',
        emailDispatch: null,
        matchedJobsCount: 0,
        matchedJobsPreview: [],
      };
    }
    throw err;
  }
}

export async function sendCandidateJobAlertDigest(payload: {
  city?: string;
  category?: string;
  jobs?: JobListing[];
}): Promise<{
  emailDispatch: EmailDispatchSummary;
  matchedJobsCount: number;
  message: string;
}> {
  return apiRequest<{
    emailDispatch: EmailDispatchSummary;
    matchedJobsCount: number;
    message: string;
  }>('/api/candidate/job-alerts/send-digest', {
    method: 'POST',
    body: JSON.stringify({
      city: payload.city,
      category: payload.category,
      jobs: (payload.jobs || []).slice(0, 60).map((j) => ({
        id: j.id,
        title: j.title,
        designation: j.designation,
        location: j.location,
        experience: j.experience,
        salary: j.salary,
        skills: j.skills,
        qualification: j.qualification,
        description: (j.description || '').slice(0, 350),
      })),
    }),
  });
}

export async function fetchAdminJobAlertsOverview(): Promise<AdminJobAlertsOverview> {
  return apiRequest<AdminJobAlertsOverview>('/api/admin/job-alerts');
}

export async function dispatchAdminJobAlertForJob(
  job: JobListing
): Promise<{ dispatchedCount: number; message: string }> {
  return apiRequest<{ dispatchedCount: number; message: string }>(
    '/api/admin/job-alerts/dispatch',
    {
      method: 'POST',
      body: JSON.stringify({
        job: {
          id: job.id,
          title: job.title,
          designation: job.designation,
          location: job.location,
          experience: job.experience,
          salary: job.salary,
          skills: job.skills,
          qualification: job.qualification,
          description: (job.description || '').slice(0, 400),
        },
      }),
    }
  );
}

export interface ContactInquiryPayload {
  name: string;
  email?: string;
  phone: string;
  companyName?: string;
  message: string;
}

export async function submitContactInquiry(
  payload: ContactInquiryPayload
): Promise<{ message: string; emailDispatch?: EmailDispatchSummary }> {
  try {
    return await apiRequest<{ message: string; emailDispatch?: EmailDispatchSummary }>(
      '/api/contact',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      false
    );
  } catch (err) {
    if (isOfflineOrNetworkError(err)) {
      enqueueOfflineApiRequest({
        url: '/api/contact',
        body: payload,
        includeAuth: false,
        label: `Contact Inquiry: ${payload.name}`,
      });
      return {
        message: 'Inquiry saved on this device and will send automatically when online.',
      };
    }
    throw err;
  }
}

export async function readImageFileAsBase64(
  file: File
): Promise<{ fileName: string; base64: string; sizeBytes: number }> {
  const allowedMimes = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']);
  const lower = file.name.toLowerCase();
  const hasAllowedExt =
    lower.endsWith('.png') ||
    lower.endsWith('.jpg') ||
    lower.endsWith('.jpeg') ||
    lower.endsWith('.webp') ||
    lower.endsWith('.gif');

  if (!allowedMimes.has(file.type) && !hasAllowedExt) {
    throw new Error('Please upload a PNG, JPG, WebP, or GIF image.');
  }
  if (file.size === 0) {
    throw new Error('The selected image file is empty.');
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error('Post image must be 5 MB or smaller.');
  }

  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Could not read the selected image file.'));
      }
    };
    reader.onerror = () => reject(new Error('Could not read the selected image file.'));
    reader.readAsDataURL(file);
  });

  return {
    fileName: file.name,
    base64,
    sizeBytes: file.size,
  };
}

export async function fetchInsightPosts(): Promise<InsightPost[]> {
  const result = await apiRequest<{ posts: InsightPost[] }>('/api/insights', {}, true);
  return result.posts;
}

export interface SaveInsightPostPayload {
  title: string;
  description: string;
  category: InsightCategory;
  hashtags?: string[];
  ctaLabel?: string | null;
  imageBase64?: string;
  removeImage?: boolean;
}

export async function createInsightPost(payload: SaveInsightPostPayload): Promise<InsightPost> {
  const result = await apiRequest<{ post: InsightPost }>('/api/insights', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return result.post;
}

export async function updateInsightPost(
  postId: string,
  payload: SaveInsightPostPayload
): Promise<InsightPost> {
  const result = await apiRequest<{ post: InsightPost }>(
    `/api/insights/${encodeURIComponent(postId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }
  );
  return result.post;
}

export async function deleteInsightPost(postId: string): Promise<string> {
  const result = await apiRequest<{ deletedId: string }>(
    `/api/insights/${encodeURIComponent(postId)}`,
    {
      method: 'DELETE',
    }
  );
  return result.deletedId;
}

export async function toggleInsightLike(postId: string): Promise<InsightPost> {
  const result = await apiRequest<{ post: InsightPost }>(
    `/api/insights/${encodeURIComponent(postId)}/like`,
    {
      method: 'POST',
    },
    true
  );
  return result.post;
}

export async function addInsightComment(postId: string, content: string): Promise<InsightPost> {
  const result = await apiRequest<{ post: InsightPost }>(
    `/api/insights/${encodeURIComponent(postId)}/comments`,
    {
      method: 'POST',
      body: JSON.stringify({ content }),
    }
  );
  return result.post;
}

export async function deleteInsightComment(
  postId: string,
  commentId: string
): Promise<InsightPost> {
  const result = await apiRequest<{ post: InsightPost }>(
    `/api/insights/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}`,
    {
      method: 'DELETE',
    }
  );
  return result.post;
}

// ============================================================================
// AI Features API Wrappers (Server-side Gemini API)
// ============================================================================

export async function generateAiResumeAssist(payload: {
  name?: string;
  role?: string;
  experience?: string;
  education?: string;
  skills?: string;
  city?: string;
}): Promise<AiResumeAssistResponse> {
  return apiRequest<AiResumeAssistResponse>(
    '/api/ai/resume-assist',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    false
  );
}

export async function analyzeAiSmartMatch(
  job: JobListing,
  candidate?: CandidateProfile | null
): Promise<AiJobAnalysis> {
  return apiRequest<AiJobAnalysis>(
    '/api/ai/smart-match',
    {
      method: 'POST',
      body: JSON.stringify({
        job: {
          title: job.title,
          designation: job.designation,
          location: job.location,
          experience: job.experience,
          qualification: job.qualification,
          skills: job.skills,
          description: job.description,
        },
        candidate: candidate
          ? {
              name: candidate.name,
              designation: candidate.designation,
              preferredRole: candidate.preferredRole,
              experience: candidate.experience,
              qualification: candidate.qualification,
              city: candidate.city,
              keySkills: candidate.keySkills,
            }
          : {},
      }),
    },
    false
  );
}

export async function generateAiSkillTest(payload: {
  topic: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
}): Promise<{
  topic: string;
  difficulty: string;
  questions: SkillTestQuestion[];
}> {
  return apiRequest<{
    topic: string;
    difficulty: string;
    questions: SkillTestQuestion[];
  }>(
    '/api/ai/skill-test/generate',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    false
  );
}

export async function generateAiInterviewCoach(payload: {
  roleTitle: string;
  skills?: string;
  experience?: string;
}): Promise<AiInterviewCoachResponse> {
  return apiRequest<AiInterviewCoachResponse>(
    '/api/ai/interview-coach',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    false
  );
}

export async function draftAiJobDescription(payload: {
  jobTitle: string;
  city?: string;
  salary?: string;
}): Promise<{ description: string }> {
  return apiRequest<{ description: string }>(
    '/api/ai/job-description',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    false
  );
}

export async function queryAiCareerCopilot(payload: {
  query: string;
  jobs: JobListing[];
  candidate?: CandidateProfile | null;
}): Promise<AiCareerCopilotResponse> {
  return apiRequest<AiCareerCopilotResponse>(
    '/api/ai/career-copilot',
    {
      method: 'POST',
      body: JSON.stringify({
        query: payload.query,
        jobs: payload.jobs.slice(0, 60).map((j) => ({
          id: j.id,
          title: j.title,
          designation: j.designation,
          location: j.location,
          experience: j.experience,
          salary: j.salary,
          qualification: j.qualification,
          skills: j.skills,
        })),
        candidate: payload.candidate
          ? {
              name: payload.candidate.name,
              preferredRole: payload.candidate.preferredRole,
              designation: payload.candidate.designation,
              experience: payload.candidate.experience,
              city: payload.candidate.city,
              keySkills: payload.candidate.keySkills,
            }
          : {},
      }),
    },
    false
  );
}

export async function generateAiCoverLetter(payload: {
  job: JobListing;
  candidate?: {
    name?: string;
    qualificationExperience?: string;
    experience?: string;
    city?: string;
    keySkills?: string[];
  } | null;
  tone?: 'Professional' | 'Executive' | 'Concise';
}): Promise<AiCoverLetterResponse> {
  return apiRequest<AiCoverLetterResponse>(
    '/api/ai/cover-letter',
    {
      method: 'POST',
      body: JSON.stringify({
        job: {
          title: payload.job.title,
          jobTitle: payload.job.jobTitle,
          location: payload.job.location,
          experience: payload.job.experience,
          qualification: payload.job.qualification,
          skills: payload.job.skills,
        },
        candidate: payload.candidate || {},
        tone: payload.tone || 'Professional',
      }),
    },
    false
  );
}

export async function fetchAiSearchSuggestions(
  query: string,
  field: 'keyword' | 'location'
): Promise<string[]> {
  const result = await apiRequest<{ suggestions: string[] }>(
    '/api/ai/search-suggestions',
    {
      method: 'POST',
      body: JSON.stringify({ query, field }),
    },
    false
  );
  return Array.isArray(result.suggestions) ? result.suggestions : [];
}

// ============================================================================
// Preferences, Search History, Skill Tests, Auto-Apply, Interview Reminders
// ============================================================================

export async function updateCandidatePreferences(payload: {
  emailNotificationsEnabled?: boolean;
  alertCity?: string;
  alertCategory?: string;
  autoApplyConfig?: Partial<AutoApplyConfig>;
  sendConfirmationEmail?: boolean;
}): Promise<{ candidate: CandidateProfile; emailDispatch?: EmailDispatchSummary | null }> {
  return apiRequest<{ candidate: CandidateProfile; emailDispatch?: EmailDispatchSummary | null }>(
    '/api/candidate/preferences',
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    }
  );
}

export async function saveCandidateSearchHistory(payload: {
  keyword: string;
  location: string;
  experience?: string;
  salary?: string;
  designation?: string;
}): Promise<{ history: SearchHistoryItem[]; candidate?: CandidateProfile }> {
  return apiRequest<{ history: SearchHistoryItem[]; candidate?: CandidateProfile }>(
    '/api/candidate/search-history',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
}

export async function deleteCandidateSearchHistory(
  id?: string
): Promise<{ history: SearchHistoryItem[]; candidate?: CandidateProfile }> {
  const url = id
    ? `/api/candidate/search-history?id=${encodeURIComponent(id)}`
    : '/api/candidate/search-history';
  return apiRequest<{ history: SearchHistoryItem[]; candidate?: CandidateProfile }>(url, {
    method: 'DELETE',
  });
}

export async function saveSkillTestResult(payload: {
  topic: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  totalQuestions: number;
  correctAnswers: number;
  sendEmailReport?: boolean;
}): Promise<{
  result: SkillTestResult;
  candidate: CandidateProfile;
  emailDispatch?: EmailDispatchSummary | null;
}> {
  return apiRequest<{
    result: SkillTestResult;
    candidate: CandidateProfile;
    emailDispatch?: EmailDispatchSummary | null;
  }>('/api/candidate/skill-tests', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function createInterviewReminder(payload: {
  jobId?: string | null;
  jobTitle: string;
  companyName?: string;
  interviewDate: string;
  interviewTime: string;
  mode: 'Video Call' | 'In-Person' | 'Phone Screen';
  locationOrLink: string;
  notes?: string;
  sendEmailReminder?: boolean;
}): Promise<{ reminder: InterviewReminder; candidate: CandidateProfile }> {
  return apiRequest<{ reminder: InterviewReminder; candidate: CandidateProfile }>(
    '/api/candidate/interview-reminders',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
}

export async function updateInterviewReminderStatus(
  id: string,
  status: 'Scheduled' | 'Completed' | 'Cancelled'
): Promise<{ candidate: CandidateProfile }> {
  return apiRequest<{ candidate: CandidateProfile }>(
    `/api/candidate/interview-reminders/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }
  );
}

export async function deleteInterviewReminder(
  id: string
): Promise<{ candidate: CandidateProfile }> {
  return apiRequest<{ candidate: CandidateProfile }>(
    `/api/candidate/interview-reminders/${encodeURIComponent(id)}`,
    {
      method: 'DELETE',
    }
  );
}

export async function sendInterviewReminderEmail(
  id: string
): Promise<{ emailDispatch: EmailDispatchSummary; candidate: CandidateProfile }> {
  return apiRequest<{ emailDispatch: EmailDispatchSummary; candidate: CandidateProfile }>(
    `/api/candidate/interview-reminders/${encodeURIComponent(id)}/notify`,
    {
      method: 'POST',
    }
  );
}

export async function runAutoApplyMode(
  jobs: JobListing[]
): Promise<{
  applications: JobApplication[];
  appliedCount: number;
  candidate: CandidateProfile;
  emailDispatch?: EmailDispatchSummary | null;
  message: string;
}> {
  return apiRequest<{
    applications: JobApplication[];
    appliedCount: number;
    candidate: CandidateProfile;
    emailDispatch?: EmailDispatchSummary | null;
    message: string;
  }>('/api/candidate/auto-apply/run', {
    method: 'POST',
    body: JSON.stringify({
      jobs: jobs.map((j) => ({
        id: j.id,
        title: j.title,
        location: j.location,
        salary: j.salary,
        experience: j.experience,
      })),
    }),
  });
}

export async function fetchAdminEmailStatus(): Promise<AdminEmailStatusResponse> {
  return apiRequest<AdminEmailStatusResponse>('/api/admin/email-status');
}

export async function sendAdminTestEmail(): Promise<{
  ok: boolean;
  deliveredVia: 'smtp' | 'queued';
  smtpHostUsed?: string | null;
  error?: string | null;
  dispatch: EmailDispatchSummary;
}> {
  return apiRequest('/api/admin/email-test', { method: 'POST' });
}

export async function retryQueuedAdminEmails(): Promise<{
  attempted: number;
  retriedSent: number;
  stillFailed: number;
}> {
  return apiRequest('/api/admin/email-retry-queued', { method: 'POST' });
}
