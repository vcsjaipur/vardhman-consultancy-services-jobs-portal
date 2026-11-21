import { useEffect, useMemo, useState } from 'react';
import {
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
  FileText,
  GraduationCap,
  IndianRupee,
  LogOut,
  Mail,
  MapPin,
  Newspaper,
  Phone,
  Search,
  ShieldCheck,
  User,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import {
  CandidateProfile,
  JobApplication,
  JobApprovalStatus,
  JobListing,
} from '../types/portal';
import { fetchResumeBlobUrl } from '../utils/candidateApi';
import { JOBS_PER_PAGE } from '../utils/firestorePortal';
import { base64ToPdfBlobUrl, toFriendlyPortalError } from '../utils/jobHelpers';
import { DashboardCardSkeleton } from './SkeletonLoaders';

interface AdminDashboardPageProps {
  candidate: CandidateProfile | null;
  jobs: JobListing[];
  applications?: JobApplication[];
  isLoading: boolean;
  isLoadingApplications?: boolean;
  autoApproveEnabled?: boolean;
  onToggleAutoApprove?: (enabled: boolean) => Promise<void>;
  onSyncApprovedJobs?: () => Promise<number>;
  onPostNewJob?: () => void;
  onUpdateStatus: (jobId: string, status: 'Approved' | 'Rejected') => Promise<void>;
  onManageVcsInsights: () => void;
  onLogout: () => void;
  onGoToLogin: () => void;
  onGoToRegister: () => void;
  onBackHome: () => void;
}

type AdminFilterTab = 'Pending' | 'Approved' | 'Rejected' | 'All' | 'Applications';

export function AdminDashboardPage({
  candidate,
  jobs,
  applications = [],
  isLoading,
  isLoadingApplications = false,
  autoApproveEnabled = false,
  onToggleAutoApprove,
  onSyncApprovedJobs,
  onPostNewJob,
  onUpdateStatus,
  onManageVcsInsights,
  onLogout,
  onGoToLogin,
  onGoToRegister,
  onBackHome,
}: AdminDashboardPageProps) {
  const [activeTab, setActiveTab] = useState<AdminFilterTab>('Pending');
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [busyJobId, setBusyJobId] = useState<string | null>(null);
  const [busyCvAppId, setBusyCvAppId] = useState<string | null>(null);
  const [isTogglingAutoApprove, setIsTogglingAutoApprove] = useState(false);
  const [isSyncingApproved, setIsSyncingApproved] = useState(false);
  const [syncNotice, setSyncNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const [cvPreview, setCvPreview] = useState<{
    applicantName: string;
    fileName: string;
    blobUrl: string;
  } | null>(null);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchQuery]);

  useEffect(() => {
    return () => {
      if (cvPreview?.blobUrl) {
        URL.revokeObjectURL(cvPreview.blobUrl);
      }
    };
  }, [cvPreview]);

  const filteredApplications = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return applications;
    return applications.filter((app) =>
      [
        app.applicantName,
        app.applicantPhone,
        app.applicantEmail,
        app.qualificationExperience,
        app.experience,
        app.city,
        app.location,
        app.jobTitle,
        app.resumeFileName,
      ]
        .filter(Boolean)
        .some((val) => String(val).toLowerCase().includes(q))
    );
  }, [applications, searchQuery]);

  if (!candidate) {
    return (
      <div className="bg-gradient-to-br from-slate-100 via-[#F4F7FB] to-[#E6EEF8] min-h-[calc(100vh-5rem)] border-b border-slate-200">
        <div className="grid grid-cols-3 h-1 w-full" aria-hidden="true">
          <div className="bg-[#063B7A]" />
          <div className="bg-[#F58220]" />
          <div className="bg-[#0A8E43]" />
        </div>

        <div className="max-w-xl mx-auto px-4 sm:px-6 py-14 sm:py-20 text-center">
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-10 shadow-xl">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-[#063B7A] to-[#042A58] text-white flex items-center justify-center shadow-md">
              <ShieldCheck className="w-7 h-7" aria-hidden="true" />
            </div>

            <h1 className="mt-5 font-display text-2xl font-extrabold text-[#063B7A]">
              Admin Login Required
            </h1>
            <p className="mt-2.5 text-sm sm:text-base text-slate-600 leading-relaxed">
              Please register or log in with an Admin account to review pending job mandates and approve or reject listings.
            </p>

            <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={onGoToLogin}
                className="w-full sm:w-auto min-h-[46px] px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#063B7A] to-[#042A58] text-white text-sm font-semibold shadow-sm transition-all cursor-pointer"
              >
                Login
              </button>
              <button
                type="button"
                onClick={onGoToRegister}
                className="w-full sm:w-auto min-h-[46px] px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#F58220] to-[#D96B0C] text-white text-sm font-semibold shadow-sm transition-all cursor-pointer"
              >
                Register
              </button>
            </div>
          </div>
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
            <div className="w-14 h-14 mx-auto rounded-2xl bg-red-50 text-red-600 flex items-center justify-center shadow-xs">
              <ShieldCheck className="w-7 h-7" aria-hidden="true" />
            </div>

            <h1 className="mt-5 font-display text-2xl font-extrabold text-[#063B7A]">
              Admin Access Only
            </h1>
            <p className="mt-2.5 text-sm sm:text-base text-slate-600 leading-relaxed">
              You are currently signed in as <span className="font-semibold">{candidate.email}</span> ({candidate.role}). Please sign in with an Admin account to approve or reject pending jobs.
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

  const filteredJobs = jobs.filter((job) => {
    if (activeTab === 'Applications') return false;
    const status: JobApprovalStatus = job.status || 'Pending';
    if (activeTab === 'All') return true;
    return status === activeTab;
  });

  const activeItemsCount =
    activeTab === 'Applications' ? filteredApplications.length : filteredJobs.length;
  const totalPages = Math.max(1, Math.ceil(activeItemsCount / JOBS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedJobs = filteredJobs.slice(
    (safePage - 1) * JOBS_PER_PAGE,
    safePage * JOBS_PER_PAGE
  );
  const paginatedApplications = filteredApplications.slice(
    (safePage - 1) * JOBS_PER_PAGE,
    safePage * JOBS_PER_PAGE
  );

  const resolveApplicationPdfBlobUrl = async (app: JobApplication): Promise<string> => {
    if (app.resumeBase64) {
      const fromBase64 = base64ToPdfBlobUrl(app.resumeBase64);
      if (fromBase64) return fromBase64;
    }
    if (app.resumeId) {
      return fetchResumeBlobUrl(app.resumeId);
    }
    throw new Error('PDF file is not attached to this older record.');
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
      anchor.download = app.resumeFileName || `${app.applicantName || 'candidate'}_resume.pdf`;
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

  return (
    <div className="bg-slate-100/70 min-h-[calc(100vh-5rem)] border-b border-slate-200">
      <div className="h-[3px] w-full bg-gradient-to-r from-[#062856] via-[#D4AF37] to-[#062856]" aria-hidden="true" />

      {/* Gradient Admin Header */}
      <section className="bg-gradient-to-br from-[#041C3F] via-[#062856] to-[#083B7E] text-white py-8 sm:py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div>
              <p className="text-xs sm:text-sm font-semibold text-[#F6D574]">
                Vardhman Consultancy Services · Admin Verification Desk
              </p>
              <h1 className="mt-1 font-display text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Admin Dashboard
              </h1>
              <p className="mt-1.5 text-sm text-slate-200">
                Verify job mandates. Approved jobs appear live on the Vardhman Consultancy Services Portal.
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

          {/* Stats Strip */}
          <div className="mt-7 grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white border border-white/20 rounded-2xl shadow-lg p-4">
              <p className="text-xs font-medium text-slate-500">Pending Approval</p>
              <p className="mt-1 font-display text-2xl font-bold text-[#D96B0C] tabular-nums">
                {pendingCount}
              </p>
            </div>
            <div className="bg-white border border-white/20 rounded-2xl shadow-lg p-4">
              <p className="text-xs font-medium text-slate-500">Approved (Live)</p>
              <p className="mt-1 font-display text-2xl font-bold text-[#0A8E43] tabular-nums">
                {approvedCount}
              </p>
            </div>
            <div className="bg-white border border-white/20 rounded-2xl shadow-lg p-4">
              <p className="text-xs font-medium text-slate-500">Rejected</p>
              <p className="mt-1 font-display text-2xl font-bold text-red-600 tabular-nums">
                {rejectedCount}
              </p>
            </div>
            <div className="bg-white border border-white/20 rounded-2xl shadow-lg p-4">
              <p className="text-xs font-medium text-slate-500">Total Submitted</p>
              <p className="mt-1 font-display text-2xl font-bold text-[#063B7A] tabular-nums">
                {jobs.length}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('Applications')}
              className="col-span-2 lg:col-span-1 text-left bg-[#FBF4DC] hover:bg-[#F7ECC4] border border-[#D4AF37] rounded-2xl shadow-lg p-4 transition-colors cursor-pointer"
            >
              <p className="text-xs font-semibold text-[#9A6F04]">Resume Godam (CVs)</p>
              <p className="mt-1 font-display text-2xl font-bold text-[#062856] tabular-nums">
                {applications.length}
              </p>
            </button>
          </div>
        </div>
      </section>

      {/* Pending / All Jobs Review List */}
      <section className="py-10 sm:py-14">
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

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200">
            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-xl">
              {(['Pending', 'Approved', 'Rejected', 'All', 'Applications'] as AdminFilterTab[]).map(
                (tab) => {
                  const count =
                    tab === 'Applications'
                      ? applications.length
                      : tab === 'All'
                        ? jobs.length
                        : tab === 'Pending'
                          ? pendingCount
                          : tab === 'Approved'
                            ? approvedCount
                            : rejectedCount;
                  const label = tab === 'Applications' ? 'Resume Godam / Applications' : tab;
                  const isActive = activeTab === tab;
                  return (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveTab(tab)}
                      className={`min-h-[40px] px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer tabular-nums ${
                        isActive
                          ? 'bg-white text-[#063B7A] shadow-sm'
                          : 'text-slate-600 hover:text-[#063B7A]'
                      }`}
                    >
                      {label} ({count})
                    </button>
                  );
                }
              )}
            </div>

            {activeItemsCount > 0 && (
              <p className="text-xs sm:text-sm text-slate-600 tabular-nums">
                Page {safePage} of {totalPages} · {activeItemsCount} total
              </p>
            )}
          </div>

          {actionError && (
            <p
              className="mt-5 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3"
              role="alert"
            >
              {actionError}
            </p>
          )}

          {activeTab === 'Applications' ? (
            isLoadingApplications ? (
              <div className="mt-8">
                <DashboardCardSkeleton count={3} />
              </div>
            ) : (
              <div className="mt-6 space-y-5">
                {/* Resume Godam Search Bar */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="relative flex-1">
                    <Search
                      className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                      aria-hidden="true"
                    />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search Resume Godam by candidate name, mobile, email, qualification, city, or job role..."
                      className="w-full min-h-[42px] pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:border-[#063B7A] focus:outline-none focus:ring-2 focus:ring-[#063B7A]/15"
                    />
                  </div>
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="min-h-[40px] px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer shrink-0"
                    >
                      Clear Search
                    </button>
                  )}
                </div>

                {filteredApplications.length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-2xl shadow-sm px-6 py-14 text-center">
                    <div className="w-14 h-14 mx-auto rounded-2xl bg-[#063B7A]/8 text-[#063B7A] flex items-center justify-center">
                      <Users className="w-7 h-7" aria-hidden="true" />
                    </div>
                    <h2 className="mt-4 font-display text-xl font-bold text-[#063B7A]">
                      {applications.length === 0
                        ? 'No Entries in Resume Godam Yet'
                        : 'No Matching Candidate Entries'}
                    </h2>
                    <p className="mt-2 text-sm text-slate-600 max-w-md mx-auto">
                      {applications.length === 0
                        ? 'When candidates submit applications or resumes through the portal, their complete details and PDF CVs appear here immediately.'
                        : 'Try adjusting your search keywords to see all Resume Godam entries.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {paginatedApplications.map((app) => {
                      const hasPdf = Boolean(app.resumeBase64 || app.resumeId);
                      const isBusyCv = busyCvAppId === app.id;
                      const qualExp = app.qualificationExperience || app.experience;
                      const cityOrLocation = app.city || app.location;
                      return (
                        <article
                          key={app.id}
                          className="bg-white border border-slate-200/90 rounded-2xl shadow-sm hover:shadow-md transition-shadow p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5"
                        >
                          <div className="min-w-0 flex-1 space-y-2.5">
                            <div className="flex flex-wrap items-center gap-2.5">
                              <h3 className="font-display text-lg font-bold text-[#063B7A]">
                                {app.applicantName}
                              </h3>
                              <span className="px-2.5 py-0.5 rounded-md bg-[#0A8E43]/10 text-[#0A8E43] text-xs font-semibold">
                                {app.jobTitle}
                              </span>
                              {app.termsAccepted !== false && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-[#FBF4DC] border border-[#D4AF37]/50 text-[#9A6F04] text-xs font-semibold">
                                  <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                                  <span>Terms Accepted</span>
                                </span>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs sm:text-sm text-slate-600">
                              <span className="inline-flex items-center gap-1.5 tabular-nums font-medium text-slate-800">
                                <Phone className="w-4 h-4 text-[#063B7A]" aria-hidden="true" />
                                <span>{app.applicantPhone || 'N/A'}</span>
                              </span>
                              {app.applicantEmail && (
                                <span className="inline-flex items-center gap-1.5">
                                  <Mail className="w-4 h-4 text-slate-400" aria-hidden="true" />
                                  <span>{app.applicantEmail}</span>
                                </span>
                              )}
                              {cityOrLocation && (
                                <span className="inline-flex items-center gap-1.5">
                                  <MapPin className="w-4 h-4 text-slate-400" aria-hidden="true" />
                                  <span>{cityOrLocation}</span>
                                </span>
                              )}
                              {qualExp && (
                                <span className="inline-flex items-center gap-1.5">
                                  <GraduationCap className="w-4 h-4 text-[#9A6F04]" aria-hidden="true" />
                                  <span>{qualExp}</span>
                                </span>
                              )}
                              <span className="inline-flex items-center gap-1.5">
                                <FileText className="w-4 h-4 text-[#0A8E43]" aria-hidden="true" />
                                <span>{app.resumeFileName || 'resume.pdf'}</span>
                              </span>
                            </div>

                            {app.resumeSummary && (
                              <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200/80 rounded-lg px-3 py-2">
                                {app.resumeSummary}
                              </p>
                            )}

                            <p className="text-xs text-slate-500 tabular-nums">
                              Submitted on{' '}
                              {new Date(app.appliedAt).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </p>
                          </div>

                          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 shrink-0">
                            <button
                              type="button"
                              disabled={!hasPdf || isBusyCv}
                              onClick={() => void handleViewCv(app)}
                              className="flex-1 sm:flex-initial min-h-[42px] px-4 py-2 rounded-xl bg-[#062856] hover:bg-[#041C3F] disabled:opacity-45 text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                            >
                              <Eye className="w-4 h-4 text-[#F6D574]" aria-hidden="true" />
                              <span>{isBusyCv ? 'Loading...' : 'View CV'}</span>
                            </button>

                            <button
                              type="button"
                              disabled={!hasPdf || isBusyCv}
                              onClick={() => void handleDownloadCv(app)}
                              className="flex-1 sm:flex-initial min-h-[42px] px-4 py-2 rounded-xl bg-[#0A8E43] hover:bg-[#087537] disabled:opacity-45 text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                            >
                              <Download className="w-4 h-4" aria-hidden="true" />
                              <span>Download CV</span>
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
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

                return (
                  <article
                    key={job.id}
                    className="bg-white border border-slate-200/90 rounded-2xl shadow-sm hover:shadow-lg transition-all duration-200 p-5 sm:p-7"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-3">
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
                          {job.lastDateToApply && (
                            <span className="inline-flex items-center gap-1.5 tabular-nums">
                              <Clock className="w-4 h-4 text-slate-400" aria-hidden="true" />
                              <span>Last Date: {job.lastDateToApply}</span>
                            </span>
                          )}
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

                      {/* Approve / Reject Actions */}
                      <div className="flex flex-row lg:flex-col items-stretch gap-2.5 shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100">
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
                  Resume Godam · PDF Preview
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
