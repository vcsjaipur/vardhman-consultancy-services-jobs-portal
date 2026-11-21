import { FormEvent, useEffect, useState } from 'react';
import {
  Award,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  GraduationCap,
  IndianRupee,
  Mail,
  MapPin,
  Phone,
  Plus,
  Send,
  ShieldCheck,
  User,
  Users,
  XCircle,
} from 'lucide-react';
import { auth } from '../firebase';
import {
  CandidateProfile,
  EmailDispatchSummary,
  JobApplication,
  JobApprovalStatus,
  JobListing,
} from '../types/portal';
import { getStoredToken, postEmployerJob } from '../utils/candidateApi';
import {
  clearFormDraft,
  loadFormDraft,
  saveFormDraft,
} from '../utils/formDraftStorage';
import { createJobInFirestore, JOBS_PER_PAGE } from '../utils/firestorePortal';
import { toFriendlyPortalError } from '../utils/jobHelpers';
import { submitCompanyRequirementToSharedPortal } from '../utils/sharedPortalFirestore';
import { DashboardCardSkeleton } from './SkeletonLoaders';

const EMPLOYER_JD_DRAFT_KEY = 'vcs_draft_employer_jd_v1';

interface EmployerDashboardPageProps {
  candidate: CandidateProfile | null;
  jobs: JobListing[];
  applications?: JobApplication[];
  isLoading: boolean;
  isLoadingApplications?: boolean;
  onPostNewJob: () => void;
  onJobPosted?: (job: JobListing) => void;
  onSelectJob: (jobId: string) => void;
  onLogout: () => void;
  onGoToLogin: () => void;
  onGoToRegister: () => void;
}

const EXPERIENCE_OPTIONS = [
  '0 – 1 Years (Fresher)',
  '1 – 3 Years',
  '3 – 5 Years',
  '5 – 10 Years',
  '10 – 15 Years',
  '15 – 20 Years',
  '20 – 25 Years',
  '25 – 30 Years',
  '30+ Years',
];

const SALARY_OPTIONS = [
  'Up to ₹5 LPA',
  '₹5 – 10 LPA',
  '₹10 – 20 LPA',
  '₹20 – 35 LPA',
  '₹35+ LPA',
];

const JOB_TYPE_OPTIONS = ['Full-Time', 'Part-Time', 'Contract', 'Hybrid', 'Remote'];

function renderStatusLabel(status: JobApprovalStatus | undefined) {
  if (status === 'Approved') {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0A8E43]">
        <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span>Approved · Live on Portal</span>
      </span>
    );
  }
  if (status === 'Rejected') {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-600">
        <XCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span>Rejected / Closed</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#D96B0C]">
      <Clock className="w-4 h-4 shrink-0" aria-hidden="true" />
      <span>Pending Approval</span>
    </span>
  );
}

export function EmployerDashboardPage({
  candidate,
  jobs,
  applications = [],
  isLoading,
  isLoadingApplications = false,
  onPostNewJob,
  onJobPosted,
  onSelectJob: _onSelectJob,
  onLogout: _onLogout,
  onGoToLogin,
  onGoToRegister,
}: EmployerDashboardPageProps) {
  const [showInlineRequirementForm, setShowInlineRequirementForm] = useState(false);
  const [activeSectionTab, setActiveSectionTab] = useState<'requirements' | 'applications'>(
    'requirements'
  );
  const [reqPage, setReqPage] = useState(1);
  const [appPage, setAppPage] = useState(1);

  const initialDraft = loadFormDraft<{
    title: string;
    designation: string;
    location: string;
    experience: string;
    salary: string;
    jobType: string;
    skills: string;
    qualification: string;
    openings: string;
    description: string;
    lastDateToApply: string;
  }>(EMPLOYER_JD_DRAFT_KEY);

  // Inline Requirement / Complete JD Form State (Dashboard Only)
  const [title, setTitle] = useState(initialDraft?.title || '');
  const [designation, setDesignation] = useState(initialDraft?.designation || '');
  const [location, setLocation] = useState(
    initialDraft?.location || candidate?.city || ''
  );
  const [experience, setExperience] = useState(initialDraft?.experience || '');
  const [salary, setSalary] = useState(initialDraft?.salary || '');
  const [jobType, setJobType] = useState(initialDraft?.jobType || 'Full-Time');
  const [skills, setSkills] = useState(initialDraft?.skills || '');
  const [qualification, setQualification] = useState(initialDraft?.qualification || '');
  const [openings, setOpenings] = useState(initialDraft?.openings || '1');
  const [description, setDescription] = useState(initialDraft?.description || '');
  const [lastDateToApply, setLastDateToApply] = useState(
    initialDraft?.lastDateToApply || ''
  );
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [latestSubmittedJob, setLatestSubmittedJob] = useState<JobListing | null>(null);
  const [latestDispatches, setLatestDispatches] = useState<EmailDispatchSummary[]>([]);

  useEffect(() => {
    if (!showInlineRequirementForm) return;
    saveFormDraft(EMPLOYER_JD_DRAFT_KEY, {
      title,
      designation,
      location,
      experience,
      salary,
      jobType,
      skills,
      qualification,
      openings,
      description,
      lastDateToApply,
    });
  }, [
    showInlineRequirementForm,
    title,
    designation,
    location,
    experience,
    salary,
    jobType,
    skills,
    qualification,
    openings,
    description,
    lastDateToApply,
  ]);

  const totalReqPages = Math.max(1, Math.ceil(jobs.length / JOBS_PER_PAGE));
  const totalAppPages = Math.max(1, Math.ceil(applications.length / JOBS_PER_PAGE));

  useEffect(() => {
    if (reqPage > totalReqPages) setReqPage(totalReqPages);
  }, [reqPage, totalReqPages]);

  useEffect(() => {
    if (appPage > totalAppPages) setAppPage(totalAppPages);
  }, [appPage, totalAppPages]);

  if (!candidate) {
    return (
      <div className="bg-slate-50 min-h-[calc(100vh-5rem)] border-b border-slate-200">
        <div className="max-w-xl mx-auto px-4 sm:px-6 py-14 sm:py-20 text-center">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-10 shadow-lg">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-[#063B7A] text-white flex items-center justify-center shadow-sm">
              <Building2 className="w-7 h-7" aria-hidden="true" />
            </div>

            <h1 className="mt-5 font-display text-2xl font-extrabold text-[#063B7A]">
              Employer Login Required
            </h1>
            <p className="mt-2.5 text-sm sm:text-base text-slate-600 leading-relaxed">
              Please register or log in first to view your Employer Dashboard and submit confidential job requirements.
            </p>

            <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={onGoToLogin}
                className="w-full sm:w-auto min-h-[46px] px-6 py-2.5 rounded-xl bg-[#0A8E43] hover:bg-[#087537] text-white text-sm font-bold shadow-sm transition-colors cursor-pointer"
              >
                Employer Login
              </button>
              <button
                type="button"
                onClick={onGoToRegister}
                className="w-full sm:w-auto min-h-[46px] px-6 py-2.5 rounded-xl bg-[#063B7A] hover:bg-[#042A58] text-white text-sm font-bold shadow-sm transition-colors cursor-pointer"
              >
                Register Employer Account
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (candidate.role === 'candidate') {
    return (
      <div className="bg-slate-50 min-h-[calc(100vh-5rem)] border-b border-slate-200">
        <div className="max-w-xl mx-auto px-4 sm:px-6 py-14 sm:py-20 text-center">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-10 shadow-lg">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-[#063B7A] text-white flex items-center justify-center shadow-sm">
              <Building2 className="w-7 h-7" aria-hidden="true" />
            </div>

            <h1 className="mt-5 font-display text-2xl font-extrabold text-[#063B7A]">
              Employer Account Required
            </h1>
            <p className="mt-2.5 text-sm sm:text-base text-slate-600 leading-relaxed">
              Employer Dashboard is exclusively for registered Employer accounts.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const handleOpenPostRequirement = () => {
    setLatestSubmittedJob(null);
    setLatestDispatches([]);
    setFormError('');
    setShowInlineRequirementForm(true);
  };

  const handleInlineSubmitRequirement = async (e: FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!title.trim()) {
      setFormError('Job Title is required.');
      return;
    }
    if (!designation.trim()) {
      setFormError('Designation is required.');
      return;
    }
    if (!location.trim()) {
      setFormError('Job Location is required.');
      return;
    }
    if (!experience) {
      setFormError('Please select Experience range.');
      return;
    }
    if (!salary) {
      setFormError('Please select Salary range.');
      return;
    }
    if (!skills.trim()) {
      setFormError('Please enter required Skills.');
      return;
    }
    if (!description.trim()) {
      setFormError('Complete Job Description / Requirement is required.');
      return;
    }
    if (!lastDateToApply) {
      setFormError('Last Date To Apply is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const openingsNum = Number(openings) >= 1 ? Math.floor(Number(openings)) : 1;

      const reqId = await submitCompanyRequirementToSharedPortal({
        companyName: candidate.companyName || candidate.name,
        contactPerson: candidate.name,
        phone: candidate.phone || 'Not provided',
        city: location.trim(),
        postRequired: title.trim(),
        salary,
        vacancyCount: openingsNum,
        jobDescription: description.trim(),
      });

      const sharedJobRecord: JobListing = {
        id: reqId,
        title: title.trim(),
        jobTitle: title.trim(),
        designation: designation.trim(),
        company: candidate.companyName || candidate.name,
        clientName: candidate.companyName || candidate.name,
        location: location.trim(),
        experience,
        salary,
        jobType,
        skills: skills
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        description: description.trim(),
        jobDescription: description.trim(),
        qualification: qualification.trim(),
        openings: openingsNum,
        openingsCount: openingsNum,
        lastDateToApply,
        lastDate: lastDateToApply,
        postedAt: new Date().toISOString().slice(0, 10),
        status: 'Pending',
      };

      let dispatches: EmailDispatchSummary[] = [];
      if (getStoredToken()) {
        try {
          const response = await postEmployerJob({
            id: reqId,
            company: candidate.companyName || candidate.name,
            recruiterName: candidate.name,
            recruiterEmail: candidate.email,
            recruiterPhone: candidate.phone || '',
            title: title.trim(),
            designation: designation.trim(),
            location: location.trim(),
            experience,
            salary,
            jobType,
            skills: skills.trim(),
            description: description.trim(),
            lastDateToApply,
            qualification: qualification.trim() || undefined,
            openings: openingsNum,
          });
          dispatches = response.emailDispatches || [];
        } catch {
          dispatches = [];
        }
      }

      if (auth.currentUser?.emailVerified) {
        try {
          const firestoreSaved = await createJobInFirestore({
            jobId: reqId,
            company: candidate.companyName || candidate.name,
            recruiterName: candidate.name,
            recruiterEmail: candidate.email,
            recruiterPhone: candidate.phone || '',
            title: title.trim(),
            designation: designation.trim(),
            location: location.trim(),
            experience,
            salary,
            jobType,
            skills: skills.trim(),
            description: description.trim(),
            qualification: qualification.trim() || undefined,
            openings: openingsNum,
            lastDateToApply,
          });
          sharedJobRecord.status = firestoreSaved.status;
        } catch {
          // Keep pending summary when Cloud write is unavailable
        }
      }

      clearFormDraft(EMPLOYER_JD_DRAFT_KEY);
      setLatestSubmittedJob(sharedJobRecord);
      setLatestDispatches(dispatches);
      if (onJobPosted) {
        onJobPosted(sharedJobRecord);
      }

      setTitle('');
      setDesignation('');
      setExperience('');
      setSalary('');
      setJobType('Full-Time');
      setSkills('');
      setQualification('');
      setOpenings('1');
      setDescription('');
      setLastDateToApply('');
      setShowInlineRequirementForm(false);
      setReqPage(1);
    } catch (err) {
      setFormError(
        toFriendlyPortalError(err, 'Something went wrong, please try again.')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const pendingCount = jobs.filter((j) => (j.status || 'Pending') === 'Pending').length;
  const approvedCount = jobs.filter((j) => j.status === 'Approved').length;

  return (
    <div className="bg-slate-50 min-h-[calc(100vh-5rem)] border-b border-slate-200">
      {/* Employer Header Banner */}
      <section className="bg-[#063B7A] text-white py-8 sm:py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div>
              <p className="text-xs sm:text-sm font-semibold text-[#F58220]">
                Employer Dashboard · Confidential Hiring Desk
              </p>
              <h1 className="mt-1 font-display text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {candidate.companyName || candidate.name}
              </h1>
              <p className="mt-1.5 text-sm text-slate-200">
                Submit Complete Requirements / JDs directly inside your Dashboard. Employer posts stay confidential and are never exposed on the Public Portal.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={handleOpenPostRequirement}
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#0A8E43] hover:bg-[#087537] text-white text-sm font-bold inline-flex items-center gap-2 shadow-sm transition-colors whitespace-nowrap cursor-pointer"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                <span>Post Requirement / Complete JD</span>
              </button>
              <button
                type="button"
                onClick={onPostNewJob}
                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer"
              >
                Full-Page JD Form
              </button>
            </div>
          </div>

          <div className="mt-7 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white border border-white/20 rounded-2xl shadow-sm p-4">
              <p className="text-xs font-medium text-slate-500">Total Requirements Submitted</p>
              <p className="mt-1 font-display text-2xl font-bold text-[#063B7A] tabular-nums">
                {jobs.length}
              </p>
            </div>
            <div className="bg-white border border-white/20 rounded-2xl shadow-sm p-4">
              <p className="text-xs font-medium text-slate-500">Confidential Dashboard Queue</p>
              <p className="mt-1 font-display text-2xl font-bold text-[#D96B0C] tabular-nums">
                {pendingCount}
              </p>
            </div>
            <div className="bg-white border border-white/20 rounded-2xl shadow-sm p-4">
              <p className="text-xs font-medium text-slate-500">Active VCS Recruitment</p>
              <p className="mt-1 font-display text-2xl font-bold text-[#0A8E43] tabular-nums">
                {approvedCount}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-8">
        {/* Registered Employer KYC Profile Card */}
        <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-5 h-5 text-[#0A8E43]" aria-hidden="true" />
              <h2 className="font-display text-lg font-bold text-[#063B7A]">
                Organization &amp; Contact Details
              </h2>
            </div>
            <span className="text-xs font-semibold text-[#0A8E43] bg-[#0A8E43]/10 px-3 py-1 rounded-md">
              Attached to JD submissions (CC: info@vardhmanconsultancy.com)
            </span>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                <span>Company Name</span>
              </p>
              <p className="mt-0.5 font-semibold text-slate-900">
                {candidate.companyName || '—'}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                <span>Contact Person Name</span>
              </p>
              <p className="mt-0.5 font-semibold text-slate-900">{candidate.name}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                <span>Official Email ID</span>
              </p>
              <p className="mt-0.5 font-semibold text-slate-900 break-all">{candidate.email}</p>
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <p className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                <span>Full Address</span>
              </p>
              <p className="mt-0.5 font-semibold text-slate-900">
                {candidate.fullAddress || candidate.city || '—'}
              </p>
            </div>
          </div>
        </section>

        {/* Email Dispatch & Submission Confirmation Banner */}
        {latestSubmittedJob && (
          <section className="bg-white border-2 border-[#0A8E43] rounded-2xl shadow-sm p-5 sm:p-6 space-y-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-[#0A8E43] shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <h3 className="font-display text-lg font-bold text-[#063B7A]">
                  Email Sent Successfully — Complete Requirement / JD Submitted ({latestSubmittedJob.title})
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  {latestSubmittedJob.status === 'Approved'
                    ? 'Published live on the Vardhman Consultancy Services Portal (Confidential - Apply via VCS).'
                    : 'Submitted for Admin Approval — once approved, it automatically appears live on the Vardhman Consultancy Services Portal.'}{' '}
                  Full Employer KYC Details + Complete JD have been emailed to <strong>info@vardhmanconsultancy.com</strong> (CC) and an automatic reply email has been sent to <strong>{candidate.email}</strong>.
                </p>
              </div>
            </div>

            {latestDispatches.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                {latestDispatches.map((mail) => (
                  <div
                    key={mail.id}
                    className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs space-y-1"
                  >
                    <p className="font-bold text-[#063B7A]">{mail.subject}</p>
                    <p className="text-slate-600">
                      From: <span className="font-medium text-slate-800">{mail.from}</span>
                    </p>
                    <p className="text-slate-600">
                      To: <span className="font-medium text-slate-800">{mail.to}</span>
                      {mail.cc ? (
                        <>
                          {' '}
                          · CC: <span className="font-medium text-[#0A8E43]">{mail.cc}</span>
                        </>
                      ) : null}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Inline Requirement / Complete JD Submission Panel inside Dashboard */}
        {showInlineRequirementForm && (
          <section className="bg-white border border-slate-200 rounded-2xl shadow-md overflow-hidden">
            <div className="bg-[#063B7A] px-5 sm:px-6 py-4 flex items-center justify-between gap-3 text-white">
              <div>
                <h2 className="font-display text-lg font-bold">
                  Submit Complete Requirement / JD (Dashboard Only)
                </h2>
                <p className="text-xs text-slate-200 mt-0.5">
                  Auto-sends Full Employer Details + JD with CC to info@vardhmanconsultancy.com and reply email to {candidate.email}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowInlineRequirementForm(false)}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 cursor-pointer"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleInlineSubmitRequirement} className="p-5 sm:p-6 space-y-4" noValidate>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="dash-job-title" className="block text-xs font-semibold text-[#063B7A] mb-1.5">
                    Job Title *
                  </label>
                  <div className="relative flex items-center">
                    <Briefcase className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" aria-hidden="true" />
                    <input
                      id="dash-job-title"
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Regional Sales Manager - Pharma"
                      className="w-full min-h-[44px] pl-10 pr-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#0A8E43] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="dash-job-desig" className="block text-xs font-semibold text-[#063B7A] mb-1.5">
                    Designation *
                  </label>
                  <div className="relative flex items-center">
                    <Award className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" aria-hidden="true" />
                    <input
                      id="dash-job-desig"
                      type="text"
                      value={designation}
                      onChange={(e) => setDesignation(e.target.value)}
                      placeholder="e.g. Manager / Lead / Executive"
                      className="w-full min-h-[44px] pl-10 pr-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#0A8E43] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="dash-job-loc" className="block text-xs font-semibold text-[#063B7A] mb-1.5">
                    Job Location *
                  </label>
                  <div className="relative flex items-center">
                    <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" aria-hidden="true" />
                    <input
                      id="dash-job-loc"
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="e.g. Jaipur, Delhi, Mumbai"
                      className="w-full min-h-[44px] pl-10 pr-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#0A8E43] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="dash-job-type" className="block text-xs font-semibold text-[#063B7A] mb-1.5">
                    Job Type *
                  </label>
                  <select
                    id="dash-job-type"
                    value={jobType}
                    onChange={(e) => setJobType(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#0A8E43] focus:outline-none cursor-pointer"
                  >
                    {JOB_TYPE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="dash-job-exp" className="block text-xs font-semibold text-[#063B7A] mb-1.5">
                    Experience Required *
                  </label>
                  <select
                    id="dash-job-exp"
                    value={experience}
                    onChange={(e) => setExperience(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#0A8E43] focus:outline-none cursor-pointer"
                  >
                    <option value="">Select Experience</option>
                    {EXPERIENCE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="dash-job-sal" className="block text-xs font-semibold text-[#063B7A] mb-1.5">
                    Salary Package *
                  </label>
                  <select
                    id="dash-job-sal"
                    value={salary}
                    onChange={(e) => setSalary(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#0A8E43] focus:outline-none cursor-pointer"
                  >
                    <option value="">Select Salary Range</option>
                    {SALARY_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="dash-job-date" className="block text-xs font-semibold text-[#063B7A] mb-1.5">
                    Last Date To Apply *
                  </label>
                  <input
                    id="dash-job-date"
                    type="date"
                    value={lastDateToApply}
                    onChange={(e) => setLastDateToApply(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#0A8E43] focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="dash-job-openings" className="block text-xs font-semibold text-[#063B7A] mb-1.5">
                    Number of Openings
                  </label>
                  <div className="relative flex items-center">
                    <Users className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" aria-hidden="true" />
                    <input
                      id="dash-job-openings"
                      type="number"
                      min={1}
                      value={openings}
                      onChange={(e) => setOpenings(e.target.value)}
                      className="w-full min-h-[44px] pl-10 pr-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#0A8E43] focus:outline-none tabular-nums"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="dash-job-skills" className="block text-xs font-semibold text-[#063B7A] mb-1.5">
                    Required Skills (comma-separated) *
                  </label>
                  <input
                    id="dash-job-skills"
                    type="text"
                    value={skills}
                    onChange={(e) => setSkills(e.target.value)}
                    placeholder="e.g. Regulatory Affairs, GMP, Team Handling"
                    className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#0A8E43] focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="dash-job-qual" className="block text-xs font-semibold text-[#063B7A] mb-1.5">
                    Qualification
                  </label>
                  <div className="relative flex items-center">
                    <GraduationCap className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" aria-hidden="true" />
                    <input
                      id="dash-job-qual"
                      type="text"
                      value={qualification}
                      onChange={(e) => setQualification(e.target.value)}
                      placeholder="e.g. B.Pharm / MBA / Graduate"
                      className="w-full min-h-[44px] pl-10 pr-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#0A8E43] focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="dash-job-desc" className="block text-xs font-semibold text-[#063B7A] mb-1.5">
                  Complete Requirement / Job Description (JD) *
                </label>
                <div className="relative">
                  <FileText className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" aria-hidden="true" />
                  <textarea
                    id="dash-job-desc"
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Enter complete job description, KPIs, territory/shift details, and preferred background..."
                    className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#0A8E43] focus:outline-none"
                  />
                </div>
              </div>

              {formError && (
                <p
                  className="text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3"
                  role="alert"
                >
                  {formError}
                </p>
              )}

              <div className="flex flex-wrap items-center justify-end gap-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="min-h-[46px] px-6 py-2.5 rounded-xl bg-[#0A8E43] hover:bg-[#087537] disabled:opacity-60 text-white text-sm font-bold inline-flex items-center gap-2 shadow-sm cursor-pointer transition-colors"
                >
                  <Send className="w-4 h-4" aria-hidden="true" />
                  <span>{isSubmitting ? 'Submitting Requirement...' : 'Submit Complete JD'}</span>
                </button>
              </div>
            </form>
          </section>
        )}

        {/* Tabbed Employer Workspace: Requirements (20/page) & Received Applications */}
        <section>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-slate-200">
            <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-200/70 rounded-xl w-fit">
              <button
                type="button"
                onClick={() => setActiveSectionTab('requirements')}
                className={`min-h-[40px] px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer tabular-nums ${
                  activeSectionTab === 'requirements'
                    ? 'bg-white text-[#063B7A] shadow-xs'
                    : 'text-slate-600 hover:text-[#063B7A]'
                }`}
              >
                My Requirements / JDs ({jobs.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveSectionTab('applications')}
                className={`min-h-[40px] px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer tabular-nums ${
                  activeSectionTab === 'applications'
                    ? 'bg-white text-[#063B7A] shadow-xs'
                    : 'text-slate-600 hover:text-[#063B7A]'
                }`}
              >
                Received Applications ({applications.length})
              </button>
            </div>

            <div className="text-sm text-slate-600 tabular-nums whitespace-nowrap shrink-0">
              {activeSectionTab === 'requirements' ? (
                <>
                  Showing Page {reqPage} of {totalReqPages} · Total:{' '}
                  <span className="font-semibold text-[#063B7A]">{jobs.length}</span>
                </>
              ) : (
                <>
                  Showing Page {appPage} of {totalAppPages} · Total:{' '}
                  <span className="font-semibold text-[#063B7A]">{applications.length}</span>
                </>
              )}
            </div>
          </div>

          {activeSectionTab === 'requirements' ? (
            isLoading ? (
              <div className="mt-6">
                <DashboardCardSkeleton count={3} />
              </div>
            ) : jobs.length === 0 ? (
              <div className="mt-6 bg-white border border-slate-200 rounded-2xl shadow-sm px-6 py-12 text-center">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-[#0A8E43]/10 text-[#0A8E43] flex items-center justify-center">
                  <Briefcase className="w-7 h-7" aria-hidden="true" />
                </div>

                <h3 className="mt-4 font-display text-xl font-bold text-[#063B7A]">
                  No Requirements Submitted Yet
                </h3>

                <p className="mt-2 text-sm sm:text-base text-slate-600 max-w-md mx-auto">
                  Click &ldquo;Post Requirement / Complete JD&rdquo; to submit your hiring requirement for VCS review and publishing.
                </p>

                <div className="mt-6">
                  <button
                    type="button"
                    onClick={handleOpenPostRequirement}
                    className="min-h-[44px] px-6 py-2.5 rounded-xl bg-[#0A8E43] hover:bg-[#087537] text-white text-sm font-bold inline-flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" aria-hidden="true" />
                    <span>Post Requirement / Complete JD</span>
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="mt-6 space-y-4">
                  {jobs
                    .slice((reqPage - 1) * JOBS_PER_PAGE, reqPage * JOBS_PER_PAGE)
                    .map((job) => (
                      <article
                        key={job.id}
                        className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                      >
                        <div className="min-w-0 flex-1">
                          <h3 className="font-display text-lg sm:text-xl font-bold text-[#063B7A]">
                            {job.title}
                          </h3>

                          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-700">
                            <span className="inline-flex items-center gap-1.5 font-medium">
                              <Building2 className="w-4 h-4 text-[#0A8E43]" aria-hidden="true" />
                              <span>{job.company}</span>
                            </span>
                            <span aria-hidden="true" className="text-slate-300">
                              ·
                            </span>
                            <span>Designation: {job.designation}</span>
                            {job.jobType && (
                              <>
                                <span aria-hidden="true" className="text-slate-300">
                                  ·
                                </span>
                                <span>{job.jobType}</span>
                              </>
                            )}
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
                            <span className="inline-flex items-center gap-1.5 tabular-nums">
                              <Calendar className="w-4 h-4 text-slate-400" aria-hidden="true" />
                              <span>Submitted {job.postedAt}</span>
                            </span>
                            {job.lastDateToApply && (
                              <span className="inline-flex items-center gap-1.5 tabular-nums">
                                <Clock className="w-4 h-4 text-slate-400" aria-hidden="true" />
                                <span>Last Date: {job.lastDateToApply}</span>
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100 flex items-center justify-between lg:flex-col lg:items-end gap-2 shrink-0">
                          {renderStatusLabel(job.status)}
                          <p className="text-xs text-slate-500">
                            CC: info@vardhmanconsultancy.com
                          </p>
                        </div>
                      </article>
                    ))}
                </div>

                {totalReqPages > 1 && (
                  <div className="mt-6 flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3">
                    <p className="text-xs sm:text-sm text-slate-600 tabular-nums">
                      Showing {(reqPage - 1) * JOBS_PER_PAGE + 1}–
                      {Math.min(reqPage * JOBS_PER_PAGE, jobs.length)} of {jobs.length} requirements
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={reqPage <= 1}
                        onClick={() => setReqPage((p) => Math.max(1, p - 1))}
                        className="min-h-[38px] px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-[#063B7A] hover:bg-slate-50 disabled:opacity-45 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                        <span>Previous</span>
                      </button>
                      <span className="text-xs font-semibold text-slate-700 tabular-nums px-2">
                        Page {reqPage} / {totalReqPages}
                      </span>
                      <button
                        type="button"
                        disabled={reqPage >= totalReqPages}
                        onClick={() => setReqPage((p) => Math.min(totalReqPages, p + 1))}
                        className="min-h-[38px] px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-[#063B7A] hover:bg-slate-50 disabled:opacity-45 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <span>Next</span>
                        <ChevronRight className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )
          ) : isLoadingApplications ? (
            <div className="mt-6">
              <DashboardCardSkeleton count={3} />
            </div>
          ) : applications.length === 0 ? (
            <div className="mt-6 bg-white border border-slate-200 rounded-2xl shadow-sm px-6 py-12 text-center">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-[#063B7A]/10 text-[#063B7A] flex items-center justify-center">
                <Users className="w-7 h-7" aria-hidden="true" />
              </div>
              <h3 className="mt-4 font-display text-xl font-bold text-[#063B7A]">
                No Candidate Applications Yet
              </h3>
              <p className="mt-2 text-sm text-slate-600 max-w-md mx-auto">
                Once candidates apply to your approved job listings, their applications and resume details will appear here automatically.
              </p>
            </div>
          ) : (
            <>
              <div className="mt-6 space-y-4">
                {applications
                  .slice((appPage - 1) * JOBS_PER_PAGE, appPage * JOBS_PER_PAGE)
                  .map((app) => (
                    <article
                      key={app.id}
                      className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <h3 className="font-display text-lg font-bold text-[#063B7A]">
                            {app.applicantName}
                          </h3>
                          <span className="px-2.5 py-0.5 rounded-md bg-[#0A8E43]/10 text-[#0A8E43] text-xs font-semibold">
                            Applied for: {app.jobTitle}
                          </span>
                        </div>
                        <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs sm:text-sm text-slate-600">
                          <span className="inline-flex items-center gap-1.5">
                            <Mail className="w-4 h-4 text-slate-400" aria-hidden="true" />
                            <span>{app.applicantEmail}</span>
                          </span>
                          <span className="inline-flex items-center gap-1.5 tabular-nums">
                            <Phone className="w-4 h-4 text-slate-400" aria-hidden="true" />
                            <span>{app.applicantPhone}</span>
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <FileText className="w-4 h-4 text-[#0A8E43]" aria-hidden="true" />
                            <span>Resume: {app.resumeFileName}</span>
                          </span>
                        </div>
                      </div>
                      <div className="text-xs text-slate-500 shrink-0 tabular-nums">
                        Applied on{' '}
                        {new Date(app.appliedAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </div>
                    </article>
                  ))}
              </div>

              {totalAppPages > 1 && (
                <div className="mt-6 flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3">
                  <p className="text-xs sm:text-sm text-slate-600 tabular-nums">
                    Showing {(appPage - 1) * JOBS_PER_PAGE + 1}–
                    {Math.min(appPage * JOBS_PER_PAGE, applications.length)} of {applications.length}{' '}
                    applications
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={appPage <= 1}
                      onClick={() => setAppPage((p) => Math.max(1, p - 1))}
                      className="min-h-[38px] px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-[#063B7A] hover:bg-slate-50 disabled:opacity-45 inline-flex items-center gap-1 cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                      <span>Previous</span>
                    </button>
                    <span className="text-xs font-semibold text-slate-700 tabular-nums px-2">
                      Page {appPage} / {totalAppPages}
                    </span>
                    <button
                      type="button"
                      disabled={appPage >= totalAppPages}
                      onClick={() => setAppPage((p) => Math.min(totalAppPages, p + 1))}
                      className="min-h-[38px] px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-[#063B7A] hover:bg-slate-50 disabled:opacity-45 inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span>Next</span>
                      <ChevronRight className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
