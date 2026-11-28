import { JobListing, SearchPageFilters } from '../types/portal';

export const CONFIDENTIAL_COMPANY_LABEL = 'Confidential - Apply via VCS';
export const OFFICIAL_EMAIL = 'info@vardhmanconsultancy.com';

export const FOOTER_SOCIAL_LINKS = {
  linkedin: 'https://www.linkedin.com/in/vikas-jain-0aa49093',
} as const;

export const SAVED_JOBS_STORAGE_KEY = 'vcs_saved_job_ids_v1';

/**
 * Hides raw employer legal names across public job listings while honoring
 * curated masked labels (defaulting to "Confidential - Apply via VCS").
 */
export function maskCompanyName(_company: string, maskedOverride?: string): string {
  const clean = (maskedOverride || '').trim();
  return clean || CONFIDENTIAL_COMPANY_LABEL;
}

export function filterJobsList(
  jobs: JobListing[],
  filters: SearchPageFilters
): JobListing[] {
  const kw = filters.keyword.trim().toLowerCase();
  const loc = filters.location.trim().toLowerCase();
  const exp = filters.experience.trim();
  const sal = filters.salary.trim();
  const desig = filters.designation.trim().toLowerCase();

  return jobs.filter((job) => {
    const matchesKeyword =
      !kw ||
      job.title.toLowerCase().includes(kw) ||
      (job.jobTitle || '').toLowerCase().includes(kw) ||
      job.designation.toLowerCase().includes(kw) ||
      job.description.toLowerCase().includes(kw) ||
      (job.jobDescription || '').toLowerCase().includes(kw) ||
      job.location.toLowerCase().includes(kw) ||
      job.qualification.toLowerCase().includes(kw) ||
      job.skills.some((skill) => skill.toLowerCase().includes(kw));

    const matchesLocation = !loc || job.location.toLowerCase().includes(loc);
    const matchesExperience =
      !exp ||
      job.experience === exp ||
      (exp.toLowerCase().includes('fresher') &&
        (job.experience.toLowerCase().includes('fresher') ||
          job.location.toLowerCase().includes('fresher')));
    const matchesSalary = !sal || job.salary === sal;
    const matchesDesignation =
      !desig ||
      job.designation.toLowerCase().includes(desig) ||
      job.title.toLowerCase().includes(desig);

    return (
      matchesKeyword &&
      matchesLocation &&
      matchesExperience &&
      matchesSalary &&
      matchesDesignation
    );
  });
}

export function loadSavedJobIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(SAVED_JOBS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function persistSavedJobIds(ids: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SAVED_JOBS_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Ignore storage quota errors gracefully
  }
}

export function base64ToPdfBlobUrl(base64Input: string): string | null {
  const trimmed = String(base64Input || '').trim();
  if (!trimmed) return null;
  try {
    const cleanBase64 = trimmed.includes(',') ? trimmed.split(',')[1] || '' : trimmed;
    const binary = window.atob(cleanBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'application/pdf' });
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

export function buildJobShareUrl(jobId: string): string {
  if (typeof window === 'undefined') {
    return `/#job/${encodeURIComponent(jobId)}`;
  }
  return `${window.location.origin}${window.location.pathname}#job/${encodeURIComponent(jobId)}`;
}

export async function shareJobListing(
  job: Pick<JobListing, 'id' | 'title' | 'location' | 'salary'>
): Promise<'shared' | 'copied' | 'failed'> {
  if (typeof window === 'undefined') return 'failed';
  const shareUrl = `${window.location.origin}/#job/${encodeURIComponent(job.id)}`;
  const shareText = `${job.title} (${job.location}) — ${job.salary} | Apply via Vardhman Consultancy Services`;

  try {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      await navigator.share({
        title: `${job.title} - Vardhman Consultancy Services`,
        text: shareText,
        url: shareUrl,
      });
      return 'shared';
    }
  } catch {
    // Fall back to clipboard copy when native share cancels or isn't permitted
  }

  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
      return 'copied';
    }
  } catch {
    // Ignore clipboard rejection
  }

  return 'failed';
}

export function toFriendlyPortalError(
  error: unknown,
  fallback = 'Something went wrong, please try again.'
): string {
  const errCode =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code || '')
      : '';
  const raw = error instanceof Error ? error.message : String(error ?? '');
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase();

  if (
    errCode === 'BACKEND_UNAVAILABLE' ||
    lower.includes('server api is unavailable')
  ) {
    return 'Please use Continue with Google or try again in a moment.';
  }
  if (!trimmed || trimmed.startsWith('{')) {
    return fallback;
  }
  if (lower.includes('auth/unauthorized-domain')) {
    return 'This domain is not authorized for Google Sign-In yet. Add both jobsnia.com and www.jobsnia.com in Firebase Console → Authentication → Settings → Authorized domains.';
  }
  if (lower.includes('auth/popup-blocked')) {
    return 'Google Sign-In popup was blocked by your browser. Please allow popups for this site and try again.';
  }
  if (
    lower.includes('firebase') ||
    lower.includes('firestore') ||
    lower.includes('google') ||
    lower.includes('permission') ||
    lower.includes('quota') ||
    lower.includes('auth/') ||
    lower.includes('client is offline') ||
    lower.includes('network-request-failed')
  ) {
    return fallback;
  }
  return trimmed;
}

