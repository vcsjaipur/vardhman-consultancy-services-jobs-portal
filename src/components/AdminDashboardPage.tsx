import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Briefcase,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Eye,
  FileCheck2,
  FileText,
  Filter,
  GraduationCap,
  IndianRupee,
  Loader2,
  LogOut,
  Mail,
  MapPin,
  MessageSquare,
  Newspaper,
  Phone,
  Search,
  ShieldAlert,
  ShieldCheck,
  User,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { VCS_TERMS_DOCUMENT } from '../constants/jobSeekerTerms';
import {
  AdminEmailStatusResponse,
  CandidateProfile,
  JobApplication,
  JobApprovalStatus,
  JobListing,
} from '../types/portal';
import {
  auditCompanyRequirementCompleteness,
  auditEmployerProfileCompleteness,
  auditJobMandateCompleteness,
  auditJobseekerCompleteness,
  CompletenessAuditResult,
  downloadCompleteCompanyFormPdf,
  downloadCompleteJobseekerApplicationPdf,
  downloadOwnerActivityCsv,
  formatIstDateTime,
  isTodayIst,
} from '../utils/adminRecordTools';
import {
  fetchAdminEmailStatus,
  fetchResumeBlobUrl,
  getStoredToken,
  retryQueuedAdminEmails,
  sendAdminTestEmail,
} from '../utils/candidateApi';
import { JOBS_PER_PAGE, SiteVisitorStats } from '../utils/firestorePortal';
import {
  base64ToPdfBlobUrl,
  CONFIDENTIAL_COMPANY_LABEL,
  toFriendlyPortalError,
} from '../utils/jobHelpers';
import { downloadOfflineDataJson } from '../utils/offlineSyncManager';
import {
  SharedClientQueryRecord,
  SharedCompanyRequirementRecord,
} from '../utils/sharedPortalFirestore';
import { PORTAL_BRAND_LOGO_SRC } from './Header';
import { DashboardCardSkeleton } from './SkeletonLoaders';

interface AdminDashboardPageProps {
  candidate: CandidateProfile | null;
  jobs: JobListing[];
  applications?: JobApplication[];
  registeredUsers?: CandidateProfile[];
  companyRequirements?: SharedCompanyRequirementRecord[];
  clientQueries?: SharedClientQueryRecord[];
  visitorStats?: SiteVisitorStats | null;
  isLoading: boolean;
  isLoadingApplications?: boolean;
  autoApproveEnabled?: boolean;
  onToggleAutoApprove?: (enabled: boolean) => Promise<void>;
  onSyncApprovedJobs?: () => Promise<number>;
  onPostNewJob?: () => void;
  onUpdateStatus: (jobId: string, status: 'Approved' | 'Rejected') => Promise<void>;
  onManageVcsInsights: () => void;
  onOwnerGoogleSignIn?: () => Promise<void>;
  onLogout: () => void;
  onGoToLogin: () => void;
  onGoToRegister: () => void;
  onBackHome: () => void;
}

type AdminFilterTab =
  | 'AllActivity'
  | 'Jobseekers'
  | 'Companies'
  | 'Pending'
  | 'Approved'
  | 'Rejected'
  | 'All'
  | 'Inquiries';

type OwnerActivityEntry =
  | {
      kind: 'jobseeker';
      key: string;
      sortMs: number;
      isToday: boolean;
      audit: CompletenessAuditResult;
      app: JobApplication;
      linkedUser?: CandidateProfile | null;
    }
  | {
      kind: 'company-requirement';
      key: string;
      sortMs: number;
      isToday: boolean;
      audit: CompletenessAuditResult;
      req: SharedCompanyRequirementRecord;
    }
  | {
      kind: 'employer-account';
      key: string;
      sortMs: number;
      isToday: boolean;
      audit: CompletenessAuditResult;
      emp: CandidateProfile;
    }
  | {
      kind: 'job-mandate';
      key: string;
      sortMs: number;
      isToday: boolean;
      audit: CompletenessAuditResult;
      job: JobListing;
    };

export function AdminDashboardPage({
  candidate,
  jobs,
  applications = [],
  registeredUsers = [],
  companyRequirements = [],
  clientQueries = [],
  visitorStats = null,
  isLoading,
  isLoadingApplications = false,
  autoApproveEnabled = false,
  onToggleAutoApprove,
  onSyncApprovedJobs,
  onPostNewJob,
  onUpdateStatus,
  onManageVcsInsights,
  onOwnerGoogleSignIn,
  onLogout,
  onGoToLogin,
  onGoToRegister,
  onBackHome,
}: AdminDashboardPageProps) {
  const [activeTab, setActiveTab] = useState<AdminFilterTab>('AllActivity');
  const [todayOnly, setTodayOnly] = useState(false);
  const [incompleteOnly, setIncompleteOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [busyJobId, setBusyJobId] = useState<string | null>(null);
  const [busyCvAppId, setBusyCvAppId] = useState<string | null>(null);
  const [isOwnerSigningIn, setIsOwnerSigningIn] = useState(false);
  const [ownerAuthError, setOwnerAuthError] = useState('');
  const [isTogglingAutoApprove, setIsTogglingAutoApprove] = useState(false);
  const [isSyncingApproved, setIsSyncingApproved] = useState(false);
  const [syncNotice, setSyncNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const [cvPreview, setCvPreview] = useState<{
    applicantName: string;
    fileName: string;
    blobUrl: string;
  } | null>(null);
  const [inspectedJobseeker, setInspectedJobseeker] = useState<{
    app: JobApplication;
    linkedUser?: CandidateProfile | null;
    audit: CompletenessAuditResult;
  } | null>(null);
  const [emailStatus, setEmailStatus] = useState<AdminEmailStatusResponse | null>(null);
  const [emailStatusUnavailable, setEmailStatusUnavailable] = useState(false);
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [isRetryingEmails, setIsRetryingEmails] = useState(false);
  const [emailActionFeedback, setEmailActionFeedback] = useState('');

  const loadEmailForwardStatus = async () => {
    if (!getStoredToken()) {
      setEmailStatusUnavailable(true);
      return;
    }
    try {
      const status = await fetchAdminEmailStatus();
      setEmailStatus(status);
      setEmailStatusUnavailable(false);
    } catch {
      setEmailStatusUnavailable(true);
    }
  };

  useEffect(() => {
    if (candidate?.role === 'admin') {
      void loadEmailForwardStatus();
    }
  }, [candidate?.id, candidate?.role]);

  const handleSendTestForwardEmail = async () => {
    setEmailActionFeedback('');
    setIsTestingEmail(true);
    try {
      const res = await sendAdminTestEmail();
      if (res.ok) {
        setEmailActionFeedback(
          `Test email delivered via ${res.smtpHostUsed || 'SMTP'} to info@vardhmanconsultancy.com & the authorized admin inbox.`
        );
      } else {
        setEmailActionFeedback(
          res.error || 'Email was queued because SMTP credentials are not configured on the server.'
        );
      }
      await loadEmailForwardStatus();
    } catch (err) {
      setEmailActionFeedback(
        err instanceof Error ? err.message : 'Unable to send test email right now.'
      );
    } finally {
      setIsTestingEmail(false);
    }
  };

  const handleRetryQueuedForwardEmails = async () => {
    setEmailActionFeedback('');
    setIsRetryingEmails(true);
    try {
      const res = await retryQueuedAdminEmails();
      setEmailActionFeedback(
        `Retried ${res.attempted} queued email(s): ${res.retriedSent} delivered, ${res.stillFailed} failed.`
      );
      await loadEmailForwardStatus();
    } catch (err) {
      setEmailActionFeedback(
        err instanceof Error ? err.message : 'Unable to retry queued emails right now.'
      );
    } finally {
      setIsRetryingEmails(false);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchQuery, todayOnly, incompleteOnly]);

  useEffect(() => {
    return () => {
      if (cvPreview?.blobUrl) {
        URL.revokeObjectURL(cvPreview.blobUrl);
      }
    };
  }, [cvPreview]);

  const userById = useMemo(() => {
    const map = new Map<string, CandidateProfile>();
    for (const u of registeredUsers) {
      map.set(u.id, u);
    }
    return map;
  }, [registeredUsers]);

  const userByEmail = useMemo(() => {
    const map = new Map<string, CandidateProfile>();
    for (const u of registeredUsers) {
      if (u.email) map.set(u.email.toLowerCase(), u);
    }
    return map;
  }, [registeredUsers]);

  // Combine all jobseeker applications AND registered candidate profiles not yet in applications
  const combinedJobseekers = useMemo(() => {
    const dedupedApps: JobApplication[] = [];
    const seenAppCandIds = new Set<string>();
    const seenEmails = new Set<string>();
    const seenPhones = new Set<string>();

    // First pass: real applications (not profile_registration)
    for (const app of applications) {
      if (app.jobId !== 'profile_registration') {
        dedupedApps.push(app);
        if (app.candidateId) seenAppCandIds.add(app.candidateId);
        if (app.applicantEmail) seenEmails.add(app.applicantEmail.toLowerCase());
        const digits = (app.applicantPhone || '').replace(/\D/g, '').slice(-10);
        if (digits.length === 10 && !/^0+$/.test(digits)) seenPhones.add(digits);
      }
    }

    // Second pass: profile_registration entries from sharedDb/candidates if not already in an app
    for (const app of applications) {
      if (app.jobId === 'profile_registration') {
        const emailLower = (app.applicantEmail || '').toLowerCase();
        const digits = (app.applicantPhone || '').replace(/\D/g, '').slice(-10);
        const alreadyCovered =
          (app.candidateId && seenAppCandIds.has(app.candidateId)) ||
          (emailLower && seenEmails.has(emailLower)) ||
          (digits.length === 10 && seenPhones.has(digits));
        if (!alreadyCovered) {
          dedupedApps.push(app);
          if (app.candidateId) seenAppCandIds.add(app.candidateId);
          if (emailLower) seenEmails.add(emailLower);
          if (digits.length === 10 && !/^0+$/.test(digits)) seenPhones.add(digits);
        }
      }
    }

    // Third pass: registered candidate accounts in /users who haven't submitted a form yet
    for (const u of registeredUsers) {
      if (u.role !== 'candidate') continue;
      const emailLower = (u.email || '').toLowerCase();
      const digits = (u.phone || '').replace(/\D/g, '').slice(-10);
      const alreadyCovered =
        seenAppCandIds.has(u.id) ||
        (emailLower && seenEmails.has(emailLower)) ||
        (digits.length === 10 && seenPhones.has(digits));
      if (alreadyCovered) continue;

      dedupedApps.push({
        id: `reg_${u.id}`,
        candidateId: u.id,
        jobId: 'profile_registration',
        jobTitle: u.preferredRole || u.designation || 'Registered Candidate Account',
        companyMasked: CONFIDENTIAL_COMPANY_LABEL,
        location: u.city || '',
        city: u.city || '',
        salary: u.expectedSalary || 'As per Industry Standards',
        experience: u.experience || u.qualification || '',
        qualificationExperience: [u.qualification, u.experience]
          .filter(Boolean)
          .join(' · '),
        resumeSummary: u.resumeSummary || u.profileSummary || undefined,
        applicantName: u.name || u.email || 'Registered Candidate',
        applicantEmail: u.email || '',
        applicantPhone: u.phone || '',
        resumeId: u.resumeId || '',
        resumeFileName: u.resumeFileName || '',
        termsAccepted: u.termsAccepted === true,
        appliedAt: u.createdAt || new Date().toISOString(),
        status: 'Submitted',
        source: 'applications',
      });
    }

    return dedupedApps.map((app) => {
      const linkedUser =
        userById.get(app.candidateId) ||
        (app.applicantEmail ? userByEmail.get(app.applicantEmail.toLowerCase()) : undefined) ||
        null;
      const audit = auditJobseekerCompleteness(app, linkedUser);
      return {
        kind: 'jobseeker' as const,
        key: `js_${app.id}`,
        sortMs: Date.parse(app.appliedAt || '') || 0,
        isToday: isTodayIst(app.appliedAt),
        audit,
        app,
        linkedUser,
      };
    });
  }, [applications, registeredUsers, userById, userByEmail]);

  const combinedCompanies = useMemo(() => {
    const list: OwnerActivityEntry[] = [];

    for (const req of companyRequirements) {
      list.push({
        kind: 'company-requirement',
        key: `req_${req.id}`,
        sortMs: Date.parse(req.createdAt || '') || 0,
        isToday: isTodayIst(req.createdAt),
        audit: auditCompanyRequirementCompleteness(req),
        req,
      });
    }

    for (const emp of registeredUsers.filter((u) => u.role === 'employer')) {
      list.push({
        kind: 'employer-account',
        key: `emp_${emp.id}`,
        sortMs: Date.parse(emp.createdAt || '') || 0,
        isToday: isTodayIst(emp.createdAt),
        audit: auditEmployerProfileCompleteness(emp),
        emp,
      });
    }

    for (const job of jobs) {
      list.push({
        kind: 'job-mandate',
        key: `job_${job.id}`,
        sortMs: Date.parse(job.createdAt || job.postedAt || '') || 0,
        isToday: isTodayIst(job.createdAt || job.postedAt),
        audit: auditJobMandateCompleteness(job),
        job,
      });
    }

    return list.sort((a, b) => b.sortMs - a.sortMs);
  }, [companyRequirements, registeredUsers, jobs]);

  const todayJobseekersCount = useMemo(
    () => combinedJobseekers.filter((item) => item.isToday).length,
    [combinedJobseekers]
  );
  const todayCompaniesCount = useMemo(
    () => combinedCompanies.filter((item) => item.isToday).length,
    [combinedCompanies]
  );
  const incompleteTotalCount = useMemo(() => {
    const jsInc = combinedJobseekers.filter((item) => !item.audit.isComplete).length;
    const compInc = combinedCompanies.filter((item) => !item.audit.isComplete).length;
    return jsInc + compInc;
  }, [combinedJobseekers, combinedCompanies]);

  const filteredActivityEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let pool: OwnerActivityEntry[] = [];
    if (activeTab === 'AllActivity') {
      pool = [...combinedJobseekers, ...combinedCompanies];
    } else if (activeTab === 'Jobseekers') {
      pool = combinedJobseekers;
    } else if (activeTab === 'Companies') {
      pool = combinedCompanies;
    }

    return pool
      .filter((entry) => {
        if (todayOnly && !entry.isToday) return false;
        if (incompleteOnly && entry.audit.isComplete) return false;
        if (!q) return true;

        if (entry.kind === 'jobseeker') {
          const { app, audit } = entry;
          return [
            app.applicantName,
            app.applicantPhone,
            app.applicantEmail,
            app.qualificationExperience,
            app.experience,
            app.city,
            app.location,
            app.jobTitle,
            app.resumeFileName,
            app.resumeSummary,
            audit.missingFields.join(' '),
          ]
            .filter(Boolean)
            .some((val) => String(val).toLowerCase().includes(q));
        }

        if (entry.kind === 'company-requirement') {
          const { req, audit } = entry;
          return [
            req.companyName,
            req.contactPerson,
            req.phone,
            req.city,
            req.postRequired,
            req.salary,
            req.jobDescription,
            audit.missingFields.join(' '),
          ]
            .filter(Boolean)
            .some((val) => String(val).toLowerCase().includes(q));
        }

        if (entry.kind === 'employer-account') {
          const { emp, audit } = entry;
          return [
            emp.companyName,
            emp.name,
            emp.email,
            emp.phone,
            emp.city,
            emp.gstNumber,
            audit.missingFields.join(' '),
          ]
            .filter(Boolean)
            .some((val) => String(val).toLowerCase().includes(q));
        }

        const { job, audit } = entry;
        return [
          job.company,
          job.clientName,
          job.title,
          job.designation,
          job.location,
          job.recruiterName,
          job.recruiterEmail,
          job.recruiterPhone,
          audit.missingFields.join(' '),
        ]
          .filter(Boolean)
          .some((val) => String(val).toLowerCase().includes(q));
      })
      .sort((a, b) => b.sortMs - a.sortMs);
  }, [
    activeTab,
    combinedJobseekers,
    combinedCompanies,
    todayOnly,
    incompleteOnly,
    searchQuery,
  ]);

  const filteredQueries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return clientQueries.filter((qry) => {
      if (todayOnly && !isTodayIst(qry.createdAt)) return false;
      if (!q) return true;
      return [qry.name, qry.phone, qry.message, qry.status]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [clientQueries, todayOnly, searchQuery]);

  const handleQuickOwnerGoogleSignIn = async () => {
    if (!onOwnerGoogleSignIn) {
      onGoToLogin();
      return;
    }
    setOwnerAuthError('');
    setIsOwnerSigningIn(true);
    try {
      await onOwnerGoogleSignIn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.toLowerCase().includes('popup-closed-by-user')) {
        setOwnerAuthError('Google sign-in popup was closed. Please try again.');
      } else {
        setOwnerAuthError(
          toFriendlyPortalError(err, 'Unable to verify owner Google account.')
        );
      }
    } finally {
      setIsOwnerSigningIn(false);
    }
  };

  if (!candidate) {
    return (
      <div className="bg-slate-50 min-h-[calc(100vh-5rem)] flex items-center justify-center px-4 py-14 border-b border-slate-200">
        <div className="w-full max-w-sm bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-lg text-center">
          {ownerAuthError && (
            <p
              className="mb-4 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-left"
              role="alert"
            >
              {ownerAuthError}
            </p>
          )}

          <button
            type="button"
            disabled={isOwnerSigningIn}
            onClick={() => {
              if (onOwnerGoogleSignIn) {
                void handleQuickOwnerGoogleSignIn();
              } else {
                onGoToLogin();
              }
            }}
            className="w-full min-h-[48px] px-6 py-3 rounded-xl bg-[#062856] hover:bg-[#041C3F] disabled:opacity-60 text-white text-sm font-semibold shadow-sm inline-flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            {isOwnerSigningIn && (
              <Loader2 className="w-4 h-4 animate-spin text-[#F6D574]" aria-hidden="true" />
            )}
            <span>{isOwnerSigningIn ? 'Opening...' : 'Jobsnia'}</span>
          </button>
        </div>
      </div>
    );
  }

  if (candidate.role !== 'admin') {
    return (
      <div className="bg-gradient-to-br from-slate-100 via-[#F4F7FB] to-[#E6EEF8] min-h-[calc(100vh-5rem)] border-b border-slate-200">
        <div className="grid grid-cols-3 h-1 w-full" aria-hidden="true">
          <div className="bg-[#063B7A]" />
          <div className="bg-[#F58220]" />
          <div className="bg-[#0A8E43]" />
        </div>

        <div className="max-w-xl mx-auto px-4 sm:px-6 py-14 sm:py-20 text-center">
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-10 shadow-xl">
            <img
              src={PORTAL_BRAND_LOGO_SRC}
              alt="JobsNia.com — Jobs With Purpose"
              decoding="sync"
              className="h-16 sm:h-20 w-auto mx-auto object-contain mb-4 select-none"
            />
            <div className="w-14 h-14 mx-auto rounded-2xl bg-red-50 text-red-600 flex items-center justify-center shadow-xs">
              <ShieldCheck className="w-7 h-7" aria-hidden="true" />
            </div>

            <h1 className="mt-5 font-display text-2xl font-extrabold text-[#063B7A]">
              Authorized Access Only
            </h1>
            <p className="mt-2.5 text-sm sm:text-base text-slate-600 leading-relaxed">
              You are currently signed in as <span className="font-semibold">{candidate.email}</span> ({candidate.role}). Please sign in with the authorized Google account to continue.
            </p>

            <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={onBackHome}
                className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl border border-slate-300 text-[#063B7A] text-sm font-semibold transition-colors cursor-pointer"
              >
                Back to Home
              </button>
              <button
                type="button"
                onClick={onLogout}
                className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#063B7A] to-[#042A58] text-white text-sm font-semibold shadow-sm transition-all cursor-pointer"
              >
                Logout &amp; Switch Account
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const pendingCount = jobs.filter((j) => (j.status || 'Pending') === 'Pending').length;
  const approvedCount = jobs.filter((j) => j.status === 'Approved').length;
  const rejectedCount = jobs.filter((j) => j.status === 'Rejected').length;

  const isJobApprovalTab =
    activeTab === 'Pending' ||
    activeTab === 'Approved' ||
    activeTab === 'Rejected' ||
    activeTab === 'All';

  const isActivityTab =
    activeTab === 'AllActivity' ||
    activeTab === 'Jobseekers' ||
    activeTab === 'Companies';

  const filteredJobs = jobs.filter((job) => {
    if (!isJobApprovalTab) return false;
    const status: JobApprovalStatus = job.status || 'Pending';
    if (todayOnly && !isTodayIst(job.createdAt || job.postedAt)) return false;
    const audit = auditJobMandateCompleteness(job);
    if (incompleteOnly && audit.isComplete) return false;
    const q = searchQuery.trim().toLowerCase();
    if (
      q &&
      ![
        job.title,
        job.company,
        job.location,
        job.recruiterName,
        job.recruiterEmail,
        job.recruiterPhone,
      ]
        .filter(Boolean)
        .some((val) => String(val).toLowerCase().includes(q))
    ) {
      return false;
    }
    if (activeTab === 'All') return true;
    return status === activeTab;
  });

  const activeItemsCount = isActivityTab
    ? filteredActivityEntries.length
    : activeTab === 'Inquiries'
      ? filteredQueries.length
      : filteredJobs.length;

  const totalPages = Math.max(1, Math.ceil(activeItemsCount / JOBS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedJobs = filteredJobs.slice(
    (safePage - 1) * JOBS_PER_PAGE,
    safePage * JOBS_PER_PAGE
  );
  const paginatedActivity = filteredActivityEntries.slice(
    (safePage - 1) * JOBS_PER_PAGE,
    safePage * JOBS_PER_PAGE
  );
  const paginatedQueries = filteredQueries.slice(
    (safePage - 1) * JOBS_PER_PAGE,
    safePage * JOBS_PER_PAGE
  );

  const resolveApplicationPdfBlobUrl = async (app: JobApplication): Promise<string> => {
    if (app.resumeBase64) {
      const fromBase64 = base64ToPdfBlobUrl(app.resumeBase64);
      if (fromBase64) return fromBase64;
    }
    if (app.resumeId && !app.id.startsWith('reg_')) {
      return fetchResumeBlobUrl(app.resumeId);
    }
    throw new Error('PDF CV is not uploaded on this candidate record yet.');
  };

  const handleViewCv = async (app: JobApplication) => {
    setActionError('');
    setBusyCvAppId(app.id);
    try {
      const blobUrl = await resolveApplicationPdfBlobUrl(app);
      setCvPreview((prev) => {
        if (prev?.blobUrl) URL.revokeObjectURL(prev.blobUrl);
        return {
          applicantName: app.applicantName || 'Candidate',
          fileName: app.resumeFileName || 'resume.pdf',
          blobUrl,
        };
      });
    } catch (err) {
      setActionError(
        toFriendlyPortalError(err, 'Unable to open CV preview right now.')
      );
    } finally {
      setBusyCvAppId(null);
    }
  };

  const handleDownloadCv = async (app: JobApplication) => {
    setActionError('');
    setBusyCvAppId(app.id);
    try {
      const blobUrl = await resolveApplicationPdfBlobUrl(app);
      const anchor = document.createElement('a');
      anchor.href = blobUrl;
      anchor.download =
        app.resumeFileName || `${app.applicantName || 'candidate'}_resume.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1500);
    } catch (err) {
      setActionError(
        toFriendlyPortalError(err, 'Unable to download CV PDF right now.')
      );
    } finally {
      setBusyCvAppId(null);
    }
  };

  const closeCvPreview = () => {
    setCvPreview((prev) => {
      if (prev?.blobUrl) URL.revokeObjectURL(prev.blobUrl);
      return null;
    });
  };

  const handleDecision = async (jobId: string, decision: 'Approved' | 'Rejected') => {
    setActionError('');
    setBusyJobId(jobId);
    try {
      await onUpdateStatus(jobId, decision);
    } catch (err) {
      setActionError(
        toFriendlyPortalError(err, 'Unable to update job status right now.')
      );
    } finally {
      setBusyJobId(null);
    }
  };

  const handleAutoApproveToggle = async () => {
    if (!onToggleAutoApprove) return;
    setActionError('');
    setIsTogglingAutoApprove(true);
    try {
      await onToggleAutoApprove(!autoApproveEnabled);
    } catch (err) {
      setActionError(
        toFriendlyPortalError(err, 'Unable to update job workflow setting.')
      );
    } finally {
      setIsTogglingAutoApprove(false);
    }
  };

  const handleSyncApprovedClick = async () => {
    if (!onSyncApprovedJobs) return;
    setActionError('');
    setSyncNotice('');
    setIsSyncingApproved(true);
    try {
      const count = await onSyncApprovedJobs();
      setSyncNotice(
        count > 0
          ? `Published ${count} approved job(s) to the live portal.`
          : 'All approved jobs are already published on the live portal.'
      );
    } catch (err) {
      setActionError(
        toFriendlyPortalError(err, 'Unable to publish approved jobs right now.')
      );
    } finally {
      setIsSyncingApproved(false);
    }
  };

  const handleExportOwnerCsv = () => {
    downloadOwnerActivityCsv({
      applications: combinedJobseekers.map((j) => j.app),
      registeredUsers,
      companyRequirements,
      jobs,
      clientQueries,
    });
  };

  const renderAuditBadge = (audit: CompletenessAuditResult) => {
    if (audit.isComplete) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold tabular-nums">
          <CheckCircle2 className="w-3.5 h-3.5 text-[#0A8E43]" aria-hidden="true" />
          <span>
            Complete ({audit.completedCount}/{audit.totalChecks})
          </span>
        </span>
      );
    }
    return (
      <span
        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-red-50 border border-red-200 text-red-700 text-xs font-semibold"
        title={`Missing: ${audit.missingFields.join(', ')}`}
      >
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>
          Incomplete ({audit.completedCount}/{audit.totalChecks}) · Missing:{' '}
          {audit.missingFields.join(', ')}
        </span>
      </span>
    );
  };

  return (
    <div className="bg-slate-100/70 min-h-[calc(100vh-5rem)] border-b border-slate-200">
      <div
        className="h-[3px] w-full bg-gradient-to-r from-[#062856] via-[#D4AF37] to-[#062856]"
        aria-hidden="true"
      />

      {/* Gradient Owner Desk Header */}
      <section className="bg-gradient-to-br from-[#041C3F] via-[#062856] to-[#083B7E] text-white py-8 sm:py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div>
              <div className="bg-white rounded-xl px-3.5 py-2 inline-flex items-center mb-3 shadow-sm">
                <img
                  src={PORTAL_BRAND_LOGO_SRC}
                  alt="JobsNia.com — Jobs With Purpose"
                  decoding="sync"
                  className="h-16 sm:h-20 w-auto object-contain select-none"
                />
              </div>
              <p className="text-xs sm:text-sm font-semibold text-[#F6D574]">
                JobsNia.com · Vardhman Consultancy Services · Owner Full Control Desk ({candidate.email})
              </p>
              <h1 className="mt-1 font-display text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Owner Activity, Completeness Audit &amp; Downloads
              </h1>
              <p className="mt-1.5 text-sm text-slate-200">
                Inspect every Jobseeker application, registration, Terms &amp; Conditions status, and Company requirement in one place—with instant PDF downloads.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              {onPostNewJob && (
                <button
                  type="button"
                  onClick={onPostNewJob}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#D4AF37] hover:bg-[#C39E27] text-[#041C3F] text-sm font-bold inline-flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Briefcase className="w-4 h-4" aria-hidden="true" />
                  <span>Post New Job</span>
                </button>
              )}

              <button
                type="button"
                onClick={onManageVcsInsights}
                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 border border-white/25 text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
              >
                <Newspaper className="w-4 h-4 text-[#F6D574]" aria-hidden="true" />
                <span>Manage VCS Insights</span>
              </button>

              <button
                type="button"
                onClick={onLogout}
                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/25 text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
              >
                <LogOut className="w-4 h-4" aria-hidden="true" />
                <span>Logout</span>
              </button>
            </div>
          </div>

          {/* Owner Overview Strip (5 Interactive KPI Cards) */}
          <div className="mt-7 grid grid-cols-2 lg:grid-cols-5 gap-4">
            <button
              type="button"
              onClick={() => {
                setActiveTab('Jobseekers');
                setTodayOnly(true);
                setIncompleteOnly(false);
              }}
              className="text-left bg-white hover:bg-slate-50 border border-white/20 rounded-2xl shadow-lg p-4 transition-colors cursor-pointer"
            >
              <p className="text-xs font-semibold text-slate-500">Today&apos;s Jobseekers (IST)</p>
              <p className="mt-1 font-display text-2xl font-bold text-[#0A8E43] tabular-nums">
                {todayJobseekersCount}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500 tabular-nums">
                Total: {combinedJobseekers.length} records
              </p>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('Companies');
                setTodayOnly(true);
                setIncompleteOnly(false);
              }}
              className="text-left bg-white hover:bg-slate-50 border border-white/20 rounded-2xl shadow-lg p-4 transition-colors cursor-pointer"
            >
              <p className="text-xs font-semibold text-slate-500">Today&apos;s Companies (IST)</p>
              <p className="mt-1 font-display text-2xl font-bold text-[#063B7A] tabular-nums">
                {todayCompaniesCount}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500 tabular-nums">
                Total: {combinedCompanies.length} records
              </p>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('AllActivity');
                setTodayOnly(false);
                setIncompleteOnly(true);
              }}
              className="text-left bg-white hover:bg-red-50/40 border border-red-200 rounded-2xl shadow-lg p-4 transition-colors cursor-pointer"
            >
              <p className="text-xs font-semibold text-red-700">Incomplete Forms / Kami</p>
              <p className="mt-1 font-display text-2xl font-bold text-red-600 tabular-nums">
                {incompleteTotalCount}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Click to inspect missing fields
              </p>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('Pending');
                setTodayOnly(false);
                setIncompleteOnly(false);
              }}
              className="text-left bg-white hover:bg-slate-50 border border-white/20 rounded-2xl shadow-lg p-4 transition-colors cursor-pointer"
            >
              <p className="text-xs font-semibold text-slate-500">Pending Job Approvals</p>
              <p className="mt-1 font-display text-2xl font-bold text-[#D96B0C] tabular-nums">
                {pendingCount}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500 tabular-nums">
                Live: {approvedCount} · Rejected: {rejectedCount}
              </p>
            </button>

            <div className="col-span-2 lg:col-span-1 bg-[#FBF4DC] border border-[#D4AF37] rounded-2xl shadow-lg p-4">
              <p className="text-xs font-semibold text-[#9A6F04]">Website Visitors (Cumulative Total)</p>
              <p className="mt-1 font-display text-2xl font-bold text-[#062856] tabular-nums">
                {visitorStats !== null ? visitorStats.totalCount.toLocaleString('en-IN') : '—'}
              </p>
              <p className="mt-0.5 text-[11px] font-medium text-[#9A6F04] tabular-nums">
                Running total across all days · +{visitorStats !== null ? visitorStats.todayCount.toLocaleString('en-IN') : '—'} today (IST)
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-8 sm:py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Auto-Approve Workflow Switch */}
          {onToggleAutoApprove && (
            <div className="mb-6 bg-white border border-slate-200 rounded-2xl shadow-xs p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-base font-bold text-[#063B7A]">
                  Job Publishing Workflow
                </h2>
                <p className="mt-1 text-xs sm:text-sm text-slate-600">
                  {autoApproveEnabled
                    ? 'Auto-Approve is ON: Newly posted jobs are published immediately to the Vardhman Consultancy Services Portal.'
                    : 'Manual Approval is ON: New jobs enter Pending Approval and go live on the Portal once approved.'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                {onSyncApprovedJobs && (
                  <button
                    type="button"
                    disabled={isSyncingApproved}
                    onClick={handleSyncApprovedClick}
                    className="min-h-[42px] px-4 py-2 rounded-xl bg-[#062856] hover:bg-[#041C3F] text-white text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer disabled:opacity-60"
                  >
                    {isSyncingApproved ? 'Publishing...' : 'Publish Approved Jobs'}
                  </button>
                )}

                <button
                  type="button"
                  disabled={isTogglingAutoApprove}
                  onClick={handleAutoApproveToggle}
                  className={`min-h-[42px] px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60 ${
                    autoApproveEnabled
                      ? 'bg-[#0A8E43] hover:bg-[#087537] text-white'
                      : 'bg-slate-100 hover:bg-slate-200 text-[#063B7A] border border-slate-300'
                  }`}
                >
                  {isTogglingAutoApprove
                    ? 'Updating...'
                    : autoApproveEnabled
                      ? 'Auto-Approve: ON (Switch to Manual)'
                      : 'Auto-Approve: OFF (Enable Instant Publish)'}
                </button>
              </div>
            </div>
          )}

          {syncNotice && (
            <p className="mb-5 text-sm font-medium text-[#062856] bg-[#FBF4DC] border border-[#D4AF37]/60 rounded-xl px-4 py-3">
              {syncNotice}
            </p>
          )}

          {/* Direct Email Forwarding Desk (cvforvcs@gmail.com & info@vardhmanconsultancy.com) */}
          <div className="mb-6 bg-white border border-slate-200 rounded-2xl shadow-xs p-4 sm:p-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Mail className="w-4 h-4 text-[#063B7A]" aria-hidden="true" />
                  <h2 className="font-display text-base font-bold text-[#063B7A]">
                    Direct Form &amp; Resume Email Forwarding
                  </h2>
                  {emailStatus && (
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        emailStatus.smtpConfigured
                          ? 'bg-[#0A8E43]/12 text-[#0A8E43]'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {emailStatus.smtpConfigured ? 'SMTP Ready' : 'SMTP Password Needed'}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs sm:text-sm text-slate-600">
                  Forwards candidate resume applications, registrations &amp; employer mandates to{' '}
                  <strong>info@vardhmanconsultancy.com</strong> &amp; authorized admin inbox.
                  {emailStatus && (
                    <span className="ml-1 text-slate-500">
                      (Sent: {emailStatus.sentCount} · Queued: {emailStatus.queuedCount})
                    </span>
                  )}
                </p>
                {emailStatus && !emailStatus.smtpConfigured && (
                  <p className="mt-1.5 text-xs font-medium text-amber-800">
                    Set <code className="px-1 py-0.5 bg-amber-50 rounded">SMTP_PASS</code> (Gmail App Password) or{' '}
                    <code className="px-1 py-0.5 bg-amber-50 rounded">PROD_SMTP_PASS</code> in Settings → Secrets to activate automatic email delivery.
                  </p>
                )}
                {emailStatusUnavailable && (
                  <p className="mt-1.5 text-xs font-medium text-slate-500">
                    Static host mode detected — ensure <code className="px-1 py-0.5 bg-slate-100 rounded">VITE_API_BASE_URL</code> points to your Node server or host via Cloud Run for direct SMTP delivery.
                  </p>
                )}
              </div>

              {!emailStatusUnavailable && (
                <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                  <button
                    type="button"
                    disabled={isTestingEmail}
                    onClick={() => void handleSendTestForwardEmail()}
                    className="min-h-[40px] px-4 py-2 rounded-xl bg-[#063B7A] hover:bg-[#042A58] text-white text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer disabled:opacity-60"
                  >
                    {isTestingEmail ? 'Sending Test...' : 'Send Test Email'}
                  </button>
                  {emailStatus && emailStatus.queuedCount > 0 && (
                    <button
                      type="button"
                      disabled={isRetryingEmails}
                      onClick={() => void handleRetryQueuedForwardEmails()}
                      className="min-h-[40px] px-4 py-2 rounded-xl bg-[#0A8E43] hover:bg-[#087537] text-white text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer disabled:opacity-60"
                    >
                      {isRetryingEmails
                        ? 'Retrying...'
                        : `Retry Queued (${emailStatus.queuedCount})`}
                    </button>
                  )}
                </div>
              )}
            </div>

            {emailActionFeedback && (
              <p className="mt-3 text-xs sm:text-sm font-medium text-[#062856] bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5">
                {emailActionFeedback}
              </p>
            )}
          </div>

          {/* Primary Owner Tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200">
            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-xl">
              {(
                [
                  {
                    id: 'AllActivity',
                    label: 'Owner Full Desk',
                    count: combinedJobseekers.length + combinedCompanies.length,
                  },
                  {
                    id: 'Jobseekers',
                    label: 'Jobseekers & Resumes',
                    count: combinedJobseekers.length,
                  },
                  {
                    id: 'Companies',
                    label: 'Companies & Employers',
                    count: combinedCompanies.length,
                  },
                  { id: 'Pending', label: 'Pending Jobs', count: pendingCount },
                  { id: 'Approved', label: 'Approved Jobs', count: approvedCount },
                  { id: 'Rejected', label: 'Rejected Jobs', count: rejectedCount },
                  { id: 'All', label: 'All Mandates', count: jobs.length },
                  { id: 'Inquiries', label: 'Client Inquiries', count: clientQueries.length },
                ] as Array<{ id: AdminFilterTab; label: string; count: number }>
              ).map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer tabular-nums ${
                      isActive
                        ? 'bg-white text-[#063B7A] shadow-sm'
                        : 'text-slate-600 hover:text-[#063B7A]'
                    }`}
                  >
                    {tab.label} ({tab.count})
                  </button>
                );
              })}
            </div>

            {activeItemsCount > 0 && (
              <p className="text-xs sm:text-sm text-slate-600 tabular-nums shrink-0">
                Page {safePage} of {totalPages} · {activeItemsCount} records
              </p>
            )}
          </div>

          {/* Search + Today / Incomplete Filters + Owner Export Bar */}
          <div className="mt-5 bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search
                  className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search candidate name, company, mobile, email, city, role, or missing field..."
                  className="w-full min-h-[42px] pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:border-[#063B7A] focus:outline-none focus:ring-2 focus:ring-[#063B7A]/15"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setTodayOnly((prev) => !prev)}
                  className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 border transition-colors cursor-pointer ${
                    todayOnly
                      ? 'bg-[#0A8E43] text-white border-[#0A8E43]'
                      : 'bg-slate-50 hover:bg-slate-100 text-[#063B7A] border-slate-200'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Today Only (IST)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIncompleteOnly((prev) => !prev)}
                  className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 border transition-colors cursor-pointer ${
                    incompleteOnly
                      ? 'bg-red-600 text-white border-red-600'
                      : 'bg-slate-50 hover:bg-slate-100 text-red-700 border-red-200'
                  }`}
                >
                  <Filter className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Incomplete Only ({incompleteTotalCount})</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportOwnerCsv}
                  className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#062856] hover:bg-[#041C3F] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-[#F6D574]" aria-hidden="true" />
                  <span>Download Owner Report (CSV)</span>
                </button>

                <button
                  type="button"
                  onClick={downloadOfflineDataJson}
                  className="min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-[#062856] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-[#0A8E43]" aria-hidden="true" />
                  <span>Backup JSON</span>
                </button>
              </div>
            </div>
          </div>

          {actionError && (
            <p
              className="mt-5 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3"
              role="alert"
            >
              {actionError}
            </p>
          )}

          {/* TAB CONTENT: ACTIVITY / JOBSEEKERS / COMPANIES */}
          {isActivityTab ? (
            isLoadingApplications && combinedJobseekers.length === 0 ? (
              <div className="mt-8">
                <DashboardCardSkeleton count={3} />
              </div>
            ) : filteredActivityEntries.length === 0 ? (
              <div className="mt-6 bg-white border border-slate-200 rounded-2xl shadow-sm px-6 py-14 text-center">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-[#063B7A]/8 text-[#063B7A] flex items-center justify-center">
                  <Users className="w-7 h-7" aria-hidden="true" />
                </div>
                <h2 className="mt-4 font-display text-xl font-bold text-[#063B7A]">
                  No Matching Activity Records
                </h2>
                <p className="mt-2 text-sm text-slate-600 max-w-md mx-auto">
                  {todayOnly || incompleteOnly || searchQuery
                    ? 'Try clearing Today Only, Incomplete Only, or search keywords to view all portal records.'
                    : 'All jobseeker applications, registrations, and company hiring forms appear here in real time.'}
                </p>
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                {paginatedActivity.map((entry) => {
                  if (entry.kind === 'company-requirement') {
                    const { req, audit, isToday } = entry;
                    return (
                      <article
                        key={entry.key}
                        className="bg-white border border-[#D4AF37]/60 rounded-2xl shadow-sm hover:shadow-md transition-shadow p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5"
                      >
                        <div className="min-w-0 flex-1 space-y-2.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-md bg-[#FBF4DC] border border-[#D4AF37]/60 text-[#9A6F04] text-xs font-bold">
                              Company Requirement
                            </span>
                            {isToday && (
                              <span className="px-2 py-0.5 rounded-md bg-[#0A8E43] text-white text-[11px] font-bold">
                                TODAY (IST)
                              </span>
                            )}
                            {renderAuditBadge(audit)}
                          </div>

                          <h3 className="font-display text-lg font-bold text-[#063B7A]">
                            {req.companyName} — {req.postRequired}
                            <span className="ml-2 text-xs font-semibold text-slate-600 tabular-nums">
                              (Vacancies: {req.vacancyCount})
                            </span>
                          </h3>

                          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs sm:text-sm text-slate-600">
                            <span className="inline-flex items-center gap-1.5 font-medium text-slate-800">
                              <User className="w-4 h-4 text-[#063B7A]" aria-hidden="true" />
                              <span>Contact: {req.contactPerson || 'Missing'}</span>
                            </span>
                            <span className="inline-flex items-center gap-1.5 tabular-nums font-medium text-slate-800">
                              <Phone className="w-4 h-4 text-[#063B7A]" aria-hidden="true" />
                              <span>{req.phone || 'Missing'}</span>
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <MapPin className="w-4 h-4 text-slate-400" aria-hidden="true" />
                              <span>{req.city || 'Missing'}</span>
                            </span>
                            <span className="inline-flex items-center gap-1.5 tabular-nums">
                              <IndianRupee className="w-4 h-4 text-[#0A8E43]" aria-hidden="true" />
                              <span>{req.salary || 'Negotiable'}</span>
                            </span>
                          </div>

                          {req.jobDescription && (
                            <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200/80 rounded-lg px-3 py-2 whitespace-pre-line">
                              {req.jobDescription}
                            </p>
                          )}

                          <p className="text-xs text-slate-500 tabular-nums">
                            Submitted: {formatIstDateTime(req.createdAt)}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              downloadCompleteCompanyFormPdf({
                                kind: 'requirement',
                                record: req,
                              })
                            }
                            className="min-h-[42px] px-4 py-2 rounded-xl bg-[#062856] hover:bg-[#041C3F] text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                          >
                            <Download className="w-4 h-4 text-[#F6D574]" aria-hidden="true" />
                            <span>Download Company Form (PDF)</span>
                          </button>
                        </div>
                      </article>
                    );
                  }

                  if (entry.kind === 'employer-account') {
                    const { emp, audit, isToday } = entry;
                    return (
                      <article
                        key={entry.key}
                        className="bg-white border border-blue-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5"
                      >
                        <div className="min-w-0 flex-1 space-y-2.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-md bg-[#063B7A]/10 border border-[#063B7A]/20 text-[#063B7A] text-xs font-bold">
                              Registered Employer Account
                            </span>
                            {isToday && (
                              <span className="px-2 py-0.5 rounded-md bg-[#0A8E43] text-white text-[11px] font-bold">
                                TODAY (IST)
                              </span>
                            )}
                            {renderAuditBadge(audit)}
                          </div>

                          <h3 className="font-display text-lg font-bold text-[#063B7A]">
                            {emp.companyName || emp.name || 'Unnamed Company'}
                          </h3>

                          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs sm:text-sm text-slate-600">
                            <span className="inline-flex items-center gap-1.5 font-medium text-slate-800">
                              <User className="w-4 h-4 text-[#063B7A]" aria-hidden="true" />
                              <span>HR / Contact: {emp.name || 'Missing'}</span>
                            </span>
                            <span className="inline-flex items-center gap-1.5 tabular-nums">
                              <Phone className="w-4 h-4 text-[#063B7A]" aria-hidden="true" />
                              <span>{emp.phone || 'Missing'}</span>
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <Mail className="w-4 h-4 text-slate-400" aria-hidden="true" />
                              <span>{emp.email || 'Missing'}</span>
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <MapPin className="w-4 h-4 text-slate-400" aria-hidden="true" />
                              <span>{emp.city || 'Missing'}</span>
                            </span>
                          </div>

                          <p className="text-xs text-slate-500 tabular-nums">
                            Registered: {formatIstDateTime(emp.createdAt)}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              downloadCompleteCompanyFormPdf({
                                kind: 'employer',
                                record: emp,
                              })
                            }
                            className="min-h-[42px] px-4 py-2 rounded-xl bg-[#062856] hover:bg-[#041C3F] text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                          >
                            <Download className="w-4 h-4 text-[#F6D574]" aria-hidden="true" />
                            <span>Download Registration (PDF)</span>
                          </button>
                        </div>
                      </article>
                    );
                  }

                  if (entry.kind === 'job-mandate') {
                    const { job, audit, isToday } = entry;
                    const status: JobApprovalStatus = job.status || 'Pending';
                    const isBusy = busyJobId === job.id;
                    return (
                      <article
                        key={entry.key}
                        className="bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5"
                      >
                        <div className="min-w-0 flex-1 space-y-2.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-md bg-slate-100 border border-slate-300 text-[#063B7A] text-xs font-bold">
                              Employer Job Mandate ({status})
                            </span>
                            {isToday && (
                              <span className="px-2 py-0.5 rounded-md bg-[#0A8E43] text-white text-[11px] font-bold">
                                TODAY (IST)
                              </span>
                            )}
                            {renderAuditBadge(audit)}
                          </div>

                          <h3 className="font-display text-lg font-bold text-[#063B7A]">
                            {job.company} — {job.title}
                          </h3>

                          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs sm:text-sm text-slate-600">
                            <span className="inline-flex items-center gap-1.5">
                              <MapPin className="w-4 h-4 text-slate-400" aria-hidden="true" />
                              <span>{job.location}</span>
                            </span>
                            <span className="inline-flex items-center gap-1.5 tabular-nums">
                              <IndianRupee className="w-4 h-4 text-[#0A8E43]" aria-hidden="true" />
                              <span>{job.salary}</span>
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <User className="w-4 h-4 text-[#063B7A]" aria-hidden="true" />
                              <span>Recruiter: {job.recruiterName || 'Missing'}</span>
                            </span>
                            <span className="inline-flex items-center gap-1.5 tabular-nums">
                              <Phone className="w-4 h-4 text-[#063B7A]" aria-hidden="true" />
                              <span>{job.recruiterPhone || 'Missing'}</span>
                            </span>
                          </div>

                          <p className="text-xs text-slate-500 tabular-nums">
                            Submitted: {formatIstDateTime(job.createdAt || job.postedAt)}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              downloadCompleteCompanyFormPdf({ kind: 'job', record: job })
                            }
                            className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#062856] hover:bg-[#041C3F] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                          >
                            <Download className="w-4 h-4 text-[#F6D574]" aria-hidden="true" />
                            <span>Download Mandate (PDF)</span>
                          </button>

                          {status !== 'Approved' && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => void handleDecision(job.id, 'Approved')}
                              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#0A8E43] hover:bg-[#087537] text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Check className="w-4 h-4" aria-hidden="true" />
                              <span>Approve</span>
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  }

                  const { app, linkedUser, audit, isToday } = entry;
                  const hasPdf = Boolean(app.resumeBase64 || (app.resumeId && !app.id.startsWith('reg_')));
                  const isBusyCv = busyCvAppId === app.id;
                  const qualExp =
                    app.qualificationExperience ||
                    app.experience ||
                    linkedUser?.qualification ||
                    linkedUser?.experience;
                  const cityOrLocation = app.city || app.location || linkedUser?.city;
                  const isRegistrationOnly = app.jobId === 'profile_registration';

                  return (
                    <article
                      key={entry.key}
                      className="bg-white border border-slate-200/90 rounded-2xl shadow-sm hover:shadow-md transition-shadow p-5 sm:p-6 flex flex-col xl:flex-row xl:items-center justify-between gap-5"
                    >
                      <div className="min-w-0 flex-1 space-y-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`px-2.5 py-0.5 rounded-md text-xs font-bold ${
                              isRegistrationOnly
                                ? 'bg-indigo-50 border border-indigo-200 text-indigo-800'
                                : 'bg-[#0A8E43]/10 text-[#0A8E43]'
                            }`}
                          >
                            {isRegistrationOnly
                              ? 'Candidate Registration'
                              : `Applied: ${app.jobTitle}`}
                          </span>
                          {isToday && (
                            <span className="px-2 py-0.5 rounded-md bg-[#0A8E43] text-white text-[11px] font-bold">
                              TODAY (IST)
                            </span>
                          )}
                          {renderAuditBadge(audit)}
                          {app.termsAccepted === true ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-[#FBF4DC] border border-[#D4AF37]/50 text-[#9A6F04] text-xs font-semibold">
                              <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>Terms Accepted</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-amber-50 border border-amber-300 text-amber-800 text-xs font-semibold">
                              <ShieldAlert className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>Terms Not Confirmed</span>
                            </span>
                          )}
                        </div>

                        <h3 className="font-display text-lg font-bold text-[#063B7A]">
                          {app.applicantName || linkedUser?.name || 'Unnamed Jobseeker'}
                        </h3>

                        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs sm:text-sm text-slate-600">
                          <span className="inline-flex items-center gap-1.5 tabular-nums font-medium text-slate-800">
                            <Phone className="w-4 h-4 text-[#063B7A]" aria-hidden="true" />
                            <span>{app.applicantPhone || linkedUser?.phone || 'Missing'}</span>
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <Mail className="w-4 h-4 text-slate-400" aria-hidden="true" />
                            <span>{app.applicantEmail || linkedUser?.email || 'Missing'}</span>
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <MapPin className="w-4 h-4 text-slate-400" aria-hidden="true" />
                            <span>{cityOrLocation || 'Missing'}</span>
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <GraduationCap className="w-4 h-4 text-[#9A6F04]" aria-hidden="true" />
                            <span>{qualExp || 'Missing Qual / Exp'}</span>
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <FileText className="w-4 h-4 text-[#0A8E43]" aria-hidden="true" />
                            <span>
                              {app.resumeFileName ||
                                linkedUser?.resumeFileName ||
                                'No PDF Uploaded'}
                            </span>
                          </span>
                        </div>

                        {app.resumeSummary && (
                          <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200/80 rounded-lg px-3 py-2">
                            {app.resumeSummary}
                          </p>
                        )}

                        <p className="text-xs text-slate-500 tabular-nums">
                          Submitted: {formatIstDateTime(app.appliedAt)}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            setInspectedJobseeker({ app, linkedUser, audit })
                          }
                          className="min-h-[40px] px-3.5 py-2 rounded-xl border border-[#063B7A]/30 bg-slate-50 hover:bg-slate-100 text-[#063B7A] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                        >
                          <FileCheck2 className="w-4 h-4" aria-hidden="true" />
                          <span>View Form &amp; T&amp;C</span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            downloadCompleteJobseekerApplicationPdf(app, linkedUser)
                          }
                          className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#062856] hover:bg-[#041C3F] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                        >
                          <Download className="w-4 h-4 text-[#F6D574]" aria-hidden="true" />
                          <span>Form + T&amp;C (PDF)</span>
                        </button>

                        <button
                          type="button"
                          disabled={!hasPdf || isBusyCv}
                          onClick={() => void handleViewCv(app)}
                          className="min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-45 text-[#062856] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                        >
                          <Eye className="w-4 h-4 text-[#063B7A]" aria-hidden="true" />
                          <span>{isBusyCv ? 'Loading...' : 'View CV'}</span>
                        </button>

                        <button
                          type="button"
                          disabled={!hasPdf || isBusyCv}
                          onClick={() => void handleDownloadCv(app)}
                          className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#0A8E43] hover:bg-[#087537] disabled:opacity-45 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                        >
                          <Download className="w-4 h-4" aria-hidden="true" />
                          <span>CV PDF</span>
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )
          ) : activeTab === 'Inquiries' ? (
            filteredQueries.length === 0 ? (
              <div className="mt-6 bg-white border border-slate-200 rounded-2xl shadow-sm px-6 py-14 text-center">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-[#063B7A]/8 text-[#063B7A] flex items-center justify-center">
                  <MessageSquare className="w-7 h-7" aria-hidden="true" />
                </div>
                <h2 className="mt-4 font-display text-xl font-bold text-[#063B7A]">
                  No Client Inquiries Found
                </h2>
                <p className="mt-2 text-sm text-slate-600 max-w-md mx-auto">
                  Contact desk inquiries from companies and candidates appear here in real time.
                </p>
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                {paginatedQueries.map((qry) => (
                  <article
                    key={qry.id}
                    className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 sm:p-6 space-y-2.5"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-md bg-blue-50 text-[#063B7A] text-xs font-bold">
                        Client Inquiry ({qry.status})
                      </span>
                      {isTodayIst(qry.createdAt) && (
                        <span className="px-2 py-0.5 rounded-md bg-[#0A8E43] text-white text-[11px] font-bold">
                          TODAY (IST)
                        </span>
                      )}
                    </div>
                    <h3 className="font-display text-lg font-bold text-[#063B7A]">
                      {qry.name} — <span className="tabular-nums">{qry.phone}</span>
                    </h3>
                    <p className="text-sm text-slate-700 whitespace-pre-line bg-slate-50 border border-slate-200 rounded-xl p-3">
                      {qry.message}
                    </p>
                    <p className="text-xs text-slate-500 tabular-nums">
                      Received: {formatIstDateTime(qry.createdAt)}
                    </p>
                  </article>
                ))}
              </div>
            )
          ) : isLoading ? (
            <div className="mt-8">
              <DashboardCardSkeleton count={3} />
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="mt-8 bg-white border border-slate-200 rounded-2xl shadow-sm px-6 py-14 text-center">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-[#063B7A]/8 text-[#063B7A] flex items-center justify-center">
                <Briefcase className="w-7 h-7" aria-hidden="true" />
              </div>

              <h2 className="mt-4 font-display text-xl font-bold text-[#063B7A]">
                No {activeTab === 'All' ? '' : activeTab} Jobs Found
              </h2>

              <p className="mt-2 text-sm sm:text-base text-slate-600 max-w-md mx-auto">
                {activeTab === 'Pending'
                  ? 'All submitted employer mandates have been reviewed, or no jobs have been posted yet.'
                  : 'No job mandates match this review filter.'}
              </p>
            </div>
          ) : (
            <div className="mt-6 space-y-5">
              {paginatedJobs.map((job) => {
                const status: JobApprovalStatus = job.status || 'Pending';
                const isBusy = busyJobId === job.id;
                const audit = auditJobMandateCompleteness(job);

                return (
                  <article
                    key={job.id}
                    className="bg-white border border-slate-200/90 rounded-2xl shadow-sm hover:shadow-lg transition-all duration-200 p-5 sm:p-7"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <h2 className="font-display text-xl font-bold text-[#063B7A]">
                            {job.title}
                          </h2>
                          {status === 'Approved' && (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#0A8E43]">
                              <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                              <span>Approved</span>
                            </span>
                          )}
                          {status === 'Rejected' && (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600">
                              <XCircle className="w-4 h-4" aria-hidden="true" />
                              <span>Rejected</span>
                            </span>
                          )}
                          {status === 'Pending' && (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#D96B0C]">
                              <Clock className="w-4 h-4" aria-hidden="true" />
                              <span>Pending</span>
                            </span>
                          )}
                          {renderAuditBadge(audit)}
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-slate-700">
                          <span className="inline-flex items-center gap-1.5 font-semibold">
                            <Building2 className="w-4 h-4 text-[#0A8E43]" aria-hidden="true" />
                            <span>
                              {job.company}{' '}
                              <span className="font-normal text-slate-500">
                                (Publicly Masked: {job.companyMasked})
                              </span>
                            </span>
                          </span>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs sm:text-sm text-slate-600">
                          <span className="inline-flex items-center gap-1.5">
                            <MapPin className="w-4 h-4 text-slate-400" aria-hidden="true" />
                            <span>{job.location}</span>
                          </span>
                          <span className="inline-flex items-center gap-1.5 tabular-nums">
                            <IndianRupee className="w-4 h-4 text-slate-400" aria-hidden="true" />
                            <span>{job.salary}</span>
                          </span>
                          <span className="inline-flex items-center gap-1.5 tabular-nums">
                            <Briefcase className="w-4 h-4 text-slate-400" aria-hidden="true" />
                            <span>{job.experience}</span>
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <span>Designation: {job.designation}</span>
                          </span>
                          {job.jobType && (
                            <span className="inline-flex items-center gap-1.5">
                              <span>Type: {job.jobType}</span>
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1.5 tabular-nums">
                            <Calendar className="w-4 h-4 text-slate-400" aria-hidden="true" />
                            <span>Posted {job.postedAt}</span>
                          </span>
                        </div>

                        {/* Recruiter Contact Details for Verification */}
                        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5">
                          <span className="inline-flex items-center gap-1.5 font-medium">
                            <User className="w-3.5 h-3.5 text-[#063B7A]" aria-hidden="true" />
                            <span>Recruiter: {job.recruiterName || 'N/A'}</span>
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <Mail className="w-3.5 h-3.5 text-[#063B7A]" aria-hidden="true" />
                            <span>{job.recruiterEmail || 'N/A'}</span>
                          </span>
                          <span className="inline-flex items-center gap-1.5 tabular-nums">
                            <Phone className="w-3.5 h-3.5 text-[#063B7A]" aria-hidden="true" />
                            <span>{job.recruiterPhone || 'N/A'}</span>
                          </span>
                        </div>

                        {/* Description & Skills */}
                        <p className="mt-3 text-sm text-slate-700 leading-relaxed whitespace-pre-line max-w-[75ch]">
                          {job.description}
                        </p>

                        {job.skills && job.skills.length > 0 && (
                          <div className="mt-3 text-xs text-slate-600">
                            <span className="font-semibold text-[#063B7A]">Skills:</span>{' '}
                            {job.skills.join(' · ')}
                          </div>
                        )}
                      </div>

                      {/* Approve / Reject / PDF Actions */}
                      <div className="flex flex-row flex-wrap lg:flex-col items-stretch gap-2.5 shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                        <button
                          type="button"
                          onClick={() =>
                            downloadCompleteCompanyFormPdf({ kind: 'job', record: job })
                          }
                          className="min-h-[42px] px-4 py-2 rounded-xl bg-[#062856] hover:bg-[#041C3F] text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Download className="w-4 h-4 text-[#F6D574]" aria-hidden="true" />
                          <span>Download PDF</span>
                        </button>

                        <button
                          type="button"
                          disabled={isBusy || status === 'Approved'}
                          onClick={() => handleDecision(job.id, 'Approved')}
                          className="flex-1 lg:flex-initial min-h-[44px] px-5 py-2.5 rounded-xl bg-[#0A8E43] hover:bg-[#087537] disabled:opacity-45 text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Check className="w-4 h-4" aria-hidden="true" />
                          <span>{status === 'Approved' ? 'Approved' : 'Approve'}</span>
                        </button>

                        <button
                          type="button"
                          disabled={isBusy || status === 'Rejected'}
                          onClick={() => handleDecision(job.id, 'Rejected')}
                          className="flex-1 lg:flex-initial min-h-[44px] px-5 py-2.5 rounded-xl border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-45 text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <X className="w-4 h-4" aria-hidden="true" />
                          <span>{status === 'Rejected' ? 'Rejected' : 'Reject'}</span>
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {totalPages > 1 && (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3">
              <p className="text-xs sm:text-sm text-slate-600 tabular-nums">
                Showing {(safePage - 1) * JOBS_PER_PAGE + 1}–
                {Math.min(safePage * JOBS_PER_PAGE, activeItemsCount)} of {activeItemsCount}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="min-h-[38px] px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-[#063B7A] hover:bg-slate-50 disabled:opacity-45 inline-flex items-center gap-1 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                  <span>Previous</span>
                </button>
                <span className="text-xs font-semibold text-slate-700 tabular-nums px-2">
                  Page {safePage} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="min-h-[38px] px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-[#063B7A] hover:bg-slate-50 disabled:opacity-45 inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>Next</span>
                  <ChevronRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Complete Jobseeker Form + Terms & Conditions Modal */}
      {inspectedJobseeker && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="owner-form-inspect-title"
          onClick={() => setInspectedJobseeker(null)}
        >
          <div
            className="w-full max-w-3xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4 bg-slate-50">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[#0A8E43]">
                  Owner Control Desk · Complete Jobseeker Form &amp; Terms Record
                </p>
                <h3
                  id="owner-form-inspect-title"
                  className="font-display text-base sm:text-lg font-bold text-[#063B7A] truncate"
                >
                  {inspectedJobseeker.app.applicantName || 'Candidate'} —{' '}
                  {inspectedJobseeker.app.jobTitle}
                </h3>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    downloadCompleteJobseekerApplicationPdf(
                      inspectedJobseeker.app,
                      inspectedJobseeker.linkedUser
                    )
                  }
                  className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-[#062856] hover:bg-[#041C3F] text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-4 h-4 text-[#F6D574]" aria-hidden="true" />
                  <span>Download Form + T&amp;C (PDF)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInspectedJobseeker(null)}
                  aria-label="Close form details"
                  className="w-9 h-9 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-[#063B7A] flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-sm">
              {/* Completeness Audit */}
              <div
                className={`rounded-xl border p-4 ${
                  inspectedJobseeker.audit.isComplete
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-red-50 border-red-200 text-red-900'
                }`}
              >
                <p className="font-bold">
                  {inspectedJobseeker.audit.isComplete
                    ? `Complete Application (${inspectedJobseeker.audit.completedCount}/${inspectedJobseeker.audit.totalChecks} verified)`
                    : `Incomplete Form (${inspectedJobseeker.audit.completedCount}/${inspectedJobseeker.audit.totalChecks}) — Missing: ${inspectedJobseeker.audit.missingFields.join(', ')}`}
                </p>
              </div>

              {/* Candidate Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs sm:text-sm">
                <div>
                  <span className="font-semibold text-slate-500 block">Full Name</span>
                  <span className="font-bold text-[#063B7A]">
                    {inspectedJobseeker.app.applicantName || 'Not Provided'}
                  </span>
                </div>
                <div>
                  <span className="font-semibold text-slate-500 block">Mobile Number</span>
                  <span className="font-bold text-slate-900 tabular-nums">
                    {inspectedJobseeker.app.applicantPhone || 'Not Provided'}
                  </span>
                </div>
                <div>
                  <span className="font-semibold text-slate-500 block">Email Address</span>
                  <span className="font-medium text-slate-900">
                    {inspectedJobseeker.app.applicantEmail || 'Not Provided'}
                  </span>
                </div>
                <div>
                  <span className="font-semibold text-slate-500 block">City / Location</span>
                  <span className="font-medium text-slate-900">
                    {inspectedJobseeker.app.city ||
                      inspectedJobseeker.app.location ||
                      'Not Provided'}
                  </span>
                </div>
                <div>
                  <span className="font-semibold text-slate-500 block">
                    Qualification &amp; Experience
                  </span>
                  <span className="font-medium text-slate-900">
                    {inspectedJobseeker.app.qualificationExperience ||
                      inspectedJobseeker.app.experience ||
                      'Not Provided'}
                  </span>
                </div>
                <div>
                  <span className="font-semibold text-slate-500 block">
                    Submitted Date &amp; Time (IST)
                  </span>
                  <span className="font-medium text-slate-900 tabular-nums">
                    {formatIstDateTime(inspectedJobseeker.app.appliedAt)}
                  </span>
                </div>
                <div className="sm:col-span-2">
                  <span className="font-semibold text-slate-500 block">Attached Resume</span>
                  <span className="font-medium text-slate-900">
                    {inspectedJobseeker.app.resumeFileName || 'Not Uploaded'}
                  </span>
                </div>
                {inspectedJobseeker.app.resumeSummary && (
                  <div className="sm:col-span-2">
                    <span className="font-semibold text-slate-500 block">
                      Profile / Resume Summary
                    </span>
                    <span className="text-slate-700 whitespace-pre-line">
                      {inspectedJobseeker.app.resumeSummary}
                    </span>
                  </div>
                )}
              </div>

              {/* Full 9-Point Terms & Conditions Included */}
              <div className="border border-[#D4AF37]/60 rounded-xl p-4 bg-[#FBF4DC]/40 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#D4AF37]/40">
                  <h4 className="font-display font-bold text-[#062856] text-sm">
                    {VCS_TERMS_DOCUMENT.title} ({VCS_TERMS_DOCUMENT.organization})
                  </h4>
                  <span
                    className={`px-2.5 py-0.5 rounded-md text-xs font-bold ${
                      inspectedJobseeker.app.termsAccepted === true
                        ? 'bg-[#0A8E43] text-white'
                        : 'bg-red-600 text-white'
                    }`}
                  >
                    {inspectedJobseeker.app.termsAccepted === true
                      ? 'ACCEPTED BY CANDIDATE'
                      : 'NOT CONFIRMED'}
                  </span>
                </div>
                <p className="text-xs text-slate-600">{VCS_TERMS_DOCUMENT.applicability}</p>
                <ol className="space-y-1.5 text-xs text-slate-700">
                  {VCS_TERMS_DOCUMENT.items.map((item) => (
                    <li key={item.number}>
                      <span className="font-bold text-[#062856]">
                        {item.number}. {item.title}:
                      </span>{' '}
                      {item.body}
                    </li>
                  ))}
                </ol>
                <p className="text-xs font-semibold text-[#062856] pt-1">
                  {VCS_TERMS_DOCUMENT.declarationLabel} {VCS_TERMS_DOCUMENT.declarationText}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* In-App PDF Resume Preview Modal (No window.open / iframe safe) */}
      {cvPreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cv-preview-title"
          onClick={closeCvPreview}
        >
          <div
            className="w-full max-w-4xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4 bg-slate-50">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[#0A8E43]">
                  Resume Repository · PDF Preview
                </p>
                <h3
                  id="cv-preview-title"
                  className="font-display text-base sm:text-lg font-bold text-[#063B7A] truncate"
                >
                  {cvPreview.applicantName} — {cvPreview.fileName}
                </h3>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={cvPreview.blobUrl}
                  download={cvPreview.fileName}
                  className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-[#0A8E43] hover:bg-[#087537] text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-4 h-4" aria-hidden="true" />
                  <span>Download PDF</span>
                </a>
                <button
                  type="button"
                  onClick={closeCvPreview}
                  aria-label="Close CV preview"
                  className="w-9 h-9 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-[#063B7A] flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-3 sm:p-4 bg-slate-100 flex-1 overflow-hidden">
              <iframe
                title={`Resume PDF - ${cvPreview.applicantName}`}
                src={cvPreview.blobUrl}
                className="w-full h-[72vh] rounded-xl border border-slate-200 bg-white"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
