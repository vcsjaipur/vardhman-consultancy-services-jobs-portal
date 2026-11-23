import { useState } from 'react';
import {
  ArrowLeft,
  Award,
  BadgeCheck,
  Bookmark,
  Briefcase,
  Building2,
  CalendarPlus,
  CheckCircle2,
  GraduationCap,
  IndianRupee,
  Loader2,
  Lock,
  MapPin,
  Send,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import {
  AiInterviewCoachResponse,
  AiJobAnalysis,
  CandidateProfile,
  JobListing,
  PortalModalType,
} from '../types/portal';
import {
  analyzeAiSmartMatch,
  createInterviewReminder,
  generateAiInterviewCoach,
} from '../utils/candidateApi';
import {
  buildJobShareUrl,
  maskCompanyName,
} from '../utils/jobHelpers';
import { computeSmartMatch } from '../utils/smartMatch';
import { AiPanelSkeleton } from './SkeletonLoaders';
import { SocialShareMenu } from './SocialShareMenu';

interface JobDetailsPageProps {
  job: JobListing | null;
  candidate?: CandidateProfile | null;
  isSaved?: boolean;
  onToggleSaveJob?: (jobId: string) => void;
  onTakeSkillTest?: (topic: string) => void;
  onCandidateUpdated?: (candidate: CandidateProfile) => void;
  onBackToSearch: () => void;
  onApplyJob: (job: JobListing) => void;
  onOpenModal: (modal: PortalModalType) => void;
}

export function JobDetailsPage({
  job,
  candidate = null,
  isSaved = false,
  onToggleSaveJob,
  onTakeSkillTest,
  onCandidateUpdated,
  onBackToSearch,
  onApplyJob,
  onOpenModal,
}: JobDetailsPageProps) {
  const [aiFitLoading, setAiFitLoading] = useState(false);
  const [aiFitError, setAiFitError] = useState('');
  const [aiFitResult, setAiFitResult] = useState<AiJobAnalysis | null>(null);

  const [coachLoading, setCoachLoading] = useState(false);
  const [coachError, setCoachError] = useState('');
  const [coachResult, setCoachResult] = useState<AiInterviewCoachResponse | null>(null);

  const [showReminderForm, setShowReminderForm] = useState(false);
  const [remDate, setRemDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().slice(0, 10);
  });
  const [remTime, setRemTime] = useState('11:00');
  const [remMode, setRemMode] = useState<'Video Call' | 'In-Person' | 'Phone Screen'>(
    'Video Call'
  );
  const [remBusy, setRemBusy] = useState(false);
  const [remSavedMessage, setRemSavedMessage] = useState('');

  if (!job) {
    return (
      <div className="bg-slate-50 min-h-[calc(100vh-5rem)] border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
          <button
            type="button"
            onClick={onBackToSearch}
            className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-xl bg-white border border-slate-200 shadow-xs text-sm font-semibold text-[#062856] hover:border-[#062856] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span>Back to Jobs</span>
          </button>

          <div className="mt-8 bg-white border border-slate-200 rounded-2xl shadow-md px-6 py-14 text-center">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-[#062856] text-[#F6D574] flex items-center justify-center">
              <Briefcase className="w-7 h-7" aria-hidden="true" />
            </div>

            <h1 className="mt-5 font-display text-xl sm:text-2xl font-bold text-[#062856]">
              Job Details Not Available
            </h1>

            <p className="mt-2.5 text-sm sm:text-base text-slate-600 max-w-lg mx-auto">
              This mandate is currently closed or unavailable. Browse active openings or submit your resume directly.
            </p>

            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={onBackToSearch}
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#062856] hover:bg-[#041C3F] text-white text-sm font-semibold transition-colors cursor-pointer"
              >
                Browse Jobs
              </button>
              <button
                type="button"
                onClick={() => onOpenModal('upload-resume')}
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#D4AF37] hover:bg-[#C39E27] text-[#041C3F] text-sm font-bold transition-colors cursor-pointer"
              >
                Submit Resume
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const companyOrHospitalName = maskCompanyName(job.company, job.companyMasked);
  const shareUrl = buildJobShareUrl(job.id);
  const shareText = `${job.title} (${job.location} · ${job.salary}) via Vardhman Consultancy Services`;
  const smartMatch = computeSmartMatch(job, candidate);
  const isVerifiedEmployer = job.status !== 'Pending' && job.status !== 'Rejected';
  const openingsCount = Math.max(
    1,
    Number(job.openings ?? job.openingsCount ?? 1) || 1
  );
  const applyWindow = (job.lastDateToApply || job.lastDate || '').trim() || 'Open Until Filled';
  const postedLabel = (() => {
    const raw = (job.postedAt || job.createdAt || '').trim();
    if (!raw) return 'Recently Verified';
    const parsed = Date.parse(raw);
    if (Number.isNaN(parsed)) return raw;
    return new Date(parsed).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  })();

  const handleScrollToVerifiedBadge = () => {
    const el = document.getElementById('verified-employer-badge');
    if (!el) return;
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      block: 'center',
    });
  };

  const handleAnalyzeFit = async () => {
    setAiFitLoading(true);
    setAiFitError('');
    try {
      const res = await analyzeAiSmartMatch(job, candidate);
      setAiFitResult(res);
    } catch (err) {
      setAiFitError(
        err instanceof Error ? err.message : 'Unable to analyze job fit right now.'
      );
    } finally {
      setAiFitLoading(false);
    }
  };

  const handlePrepareInterview = async () => {
    setCoachLoading(true);
    setCoachError('');
    try {
      const res = await generateAiInterviewCoach({
        roleTitle: job.title,
        skills: job.skills.join(', '),
        experience: job.experience,
      });
      setCoachResult(res);
    } catch (err) {
      setCoachError(
        err instanceof Error ? err.message : 'Unable to load interview coach right now.'
      );
    } finally {
      setCoachLoading(false);
    }
  };

  const handleQuickSaveReminder = async () => {
    setRemSavedMessage('');
    if (!candidate || candidate.role !== 'candidate') {
      // Download .ics directly for guests
      const cleanDate = remDate.replace(/-/g, '');
      const cleanTime = remTime.replace(/:/g, '');
      const ics = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'BEGIN:VEVENT',
        `DTSTART:${cleanDate}T${cleanTime}00`,
        `SUMMARY:Interview Reminder: ${job.title}`,
        `DESCRIPTION:Role at ${companyOrHospitalName} (${job.location})`,
        `LOCATION:${remMode}`,
        'END:VEVENT',
        'END:VCALENDAR',
      ].join('\r\n');
      const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Interview_${job.title.replace(/[^a-zA-Z0-9]+/g, '_')}.ics`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
      setRemSavedMessage('Calendar reminder (.ics) downloaded!');
      return;
    }

    setRemBusy(true);
    try {
      const res = await createInterviewReminder({
        jobId: job.id,
        jobTitle: job.title,
        companyName: companyOrHospitalName,
        interviewDate: remDate,
        interviewTime: remTime,
        mode: remMode,
        locationOrLink: job.location,
        notes: `VCS Verified Role (${job.salary})`,
        sendEmailReminder: Boolean(candidate.emailNotificationsEnabled ?? true),
      });
      if (onCandidateUpdated) {
        onCandidateUpdated(res.candidate);
      }
      setRemSavedMessage('Interview reminder saved to your Dashboard & email notification sent.');
    } catch (err) {
      setRemSavedMessage(
        err instanceof Error ? err.message : 'Unable to save reminder.'
      );
    } finally {
      setRemBusy(false);
    }
  };

  return (
    <div className="bg-slate-50 min-h-[calc(100vh-5rem)] pb-24 md:pb-14 border-b border-slate-200">
      {/* Navy & Gold Header Backdrop */}
      <div className="bg-gradient-to-br from-[#041C3F] via-[#062856] to-[#083B7E] border-b-2 border-[#D4AF37] pt-6 pb-20 sm:pt-8 sm:pb-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={onBackToSearch}
            className="inline-flex items-center gap-2 min-h-[42px] px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-semibold text-white transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
          >
            <ArrowLeft className="w-4 h-4 text-[#F6D574]" aria-hidden="true" />
            <span>Back to Jobs</span>
          </button>

          <div className="flex items-center gap-2">
            {onToggleSaveJob && (
              <button
                type="button"
                onClick={() => onToggleSaveJob(job.id)}
                aria-pressed={isSaved}
                className={`min-h-[42px] px-3.5 py-2 rounded-xl border text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                  isSaved
                    ? 'bg-[#D4AF37] border-[#D4AF37] text-[#041C3F]'
                    : 'bg-white/10 border-white/20 text-white hover:bg-white/20'
                }`}
              >
                <Bookmark
                  className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`}
                  aria-hidden="true"
                />
                <span>{isSaved ? 'Saved' : 'Save Job'}</span>
              </button>
            )}

            <SocialShareMenu
              title={job.title}
              text={shareText}
              url={shareUrl}
              variant="hero"
            />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-14 sm:-mt-16">
        {/* Elevated Job Summary Header Card */}
        <section className="bg-white border border-slate-200 rounded-2xl shadow-xl p-5 sm:p-8">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div className="flex items-start gap-4 min-w-0 flex-1">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#062856] text-[#F6D574] flex items-center justify-center shrink-0">
                <Building2 className="w-7 h-7" aria-hidden="true" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#9A6F04]">
                    Verified Mandate · {job.jobType || 'Full-Time'}
                  </p>
                  {smartMatch && (
                    <span className="px-2.5 py-0.5 rounded-md bg-[#0A8E43] text-white text-xs font-bold tabular-nums">
                      {smartMatch.score}% {smartMatch.label}
                    </span>
                  )}
                </div>

                <h1 className="mt-1 font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#062856] tracking-tight text-balance">
                  {job.title}
                </h1>

                <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-700">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-slate-900">
                    <Building2 className="w-4 h-4 text-[#9A6F04] shrink-0" aria-hidden="true" />
                    <span>{companyOrHospitalName}</span>
                  </span>

                  <span aria-hidden="true" className="text-slate-300 hidden sm:inline">
                    ·
                  </span>

                  <button
                    type="button"
                    onClick={handleScrollToVerifiedBadge}
                    className={`inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 cursor-pointer hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#062856] rounded-sm ${
                      isVerifiedEmployer ? 'text-[#065F2C]' : 'text-[#9A6F04]'
                    }`}
                  >
                    <BadgeCheck
                      className={`w-4 h-4 shrink-0 ${
                        isVerifiedEmployer ? 'text-[#0A8E43]' : 'text-[#9A6F04]'
                      }`}
                      aria-hidden="true"
                    />
                    <span>
                      {isVerifiedEmployer ? 'Verified Employer' : 'Verification Pending'}
                    </span>
                  </button>

                  <span aria-hidden="true" className="text-slate-300 hidden sm:inline">
                    ·
                  </span>

                  <span className="inline-flex items-center gap-1.5 text-slate-700">
                    <Award className="w-4 h-4 text-[#062856] shrink-0" aria-hidden="true" />
                    <span>Designation: {job.designation}</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="hidden md:flex items-center shrink-0">
              <button
                type="button"
                onClick={() => onApplyJob(job)}
                className="min-h-[48px] px-7 py-3 rounded-xl bg-[#062856] hover:bg-[#041C3F] text-white font-semibold text-sm inline-flex items-center justify-center gap-2 shadow-md transition-all whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#062856]"
              >
                <Send className="w-4 h-4 text-[#F6D574]" aria-hidden="true" />
                <span>Apply Now</span>
              </button>
            </div>
          </div>

          {/* Complete Mandate Key Fields: Location, Salary / CTC, Experience Required, Qualification */}
          <div className="mt-6 pt-6 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <p className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#062856]" aria-hidden="true" />
                <span>Location</span>
              </p>
              <p className="mt-1 text-sm sm:text-base font-bold text-[#062856]">
                {job.location}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#FBF4DC]/70 border border-[#D4AF37]/50">
              <p className="text-xs font-semibold text-[#9A6F04] flex items-center gap-1.5">
                <IndianRupee className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Salary / CTC</span>
              </p>
              <p className="mt-1 text-sm sm:text-base font-bold text-[#062856] tabular-nums">
                {job.salary}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <p className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-[#062856]" aria-hidden="true" />
                <span>Experience Required</span>
              </p>
              <p className="mt-1 text-sm sm:text-base font-bold text-[#062856] tabular-nums">
                {job.experience}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <p className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5 text-[#9A6F04]" aria-hidden="true" />
                <span>Qualification</span>
              </p>
              <p className="mt-1 text-sm font-bold text-[#062856] line-clamp-2">
                {job.qualification || 'Relevant Degree / Specialization'}
              </p>
            </div>
          </div>
        </section>

        {/* Detailed Job Specifications */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Complete Job Description, Qualification, Skills, AI Tools */}
          <div className="lg:col-span-8 space-y-6">
            <section className="bg-white border border-slate-200 rounded-2xl shadow-xs p-5 sm:p-7">
              <h2 className="font-display text-lg sm:text-xl font-bold text-[#062856]">
                Complete Job Description
              </h2>
              <div className="mt-3.5 text-sm sm:text-base text-slate-700 leading-relaxed whitespace-pre-line max-w-[72ch]">
                {job.description}
              </div>
            </section>

            <section className="bg-white border border-slate-200 rounded-2xl shadow-xs p-5 sm:p-7">
              <h2 className="font-display text-lg sm:text-xl font-bold text-[#062856] flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-[#9A6F04]" aria-hidden="true" />
                <span>Qualification</span>
              </h2>
              <p className="mt-3 text-sm sm:text-base text-slate-700 leading-relaxed max-w-[72ch]">
                {job.qualification}
              </p>
            </section>

            <section className="bg-white border border-slate-200 rounded-2xl shadow-xs p-5 sm:p-7">
              <h2 className="font-display text-lg sm:text-xl font-bold text-[#062856]">
                Key Skills Required
              </h2>
              {job.skills.length > 0 ? (
                <ul className="mt-4 flex flex-wrap gap-2">
                  {job.skills.map((skill) => (
                    <li
                      key={skill}
                      className="px-3.5 py-2 rounded-xl bg-slate-100 border border-slate-200 text-sm font-medium text-[#062856]"
                    >
                      {skill}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-slate-600">
                  Relevant domain experience.
                </p>
              )}
            </section>

            {/* AI Smart Match, Skill Test & Interview Preparation Suite */}
            <section className="bg-white border border-[#062856]/25 rounded-2xl shadow-sm p-5 sm:p-7 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-[#9A6F04] flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" aria-hidden="true" />
                    <span>Smart Career Tools</span>
                  </p>
                  <h2 className="mt-0.5 font-display text-lg sm:text-xl font-bold text-[#062856]">
                    AI Fit Analysis, Skill Test &amp; Interview Prep
                  </h2>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  disabled={aiFitLoading}
                  onClick={() => void handleAnalyzeFit()}
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-[#062856] hover:bg-[#041C3F] text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  {aiFitLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-[#F6D574]" />
                  ) : (
                    <Sparkles className="w-4 h-4 text-[#F6D574]" />
                  )}
                  <span>{aiFitLoading ? 'Analyzing...' : 'Analyze Job Fit with AI'}</span>
                </button>

                <button
                  type="button"
                  disabled={coachLoading}
                  onClick={() => void handlePrepareInterview()}
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-[#F58220] hover:bg-[#D96B0C] text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  {coachLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  <span>{coachLoading ? 'Loading Coach...' : 'AI Interview Questions'}</span>
                </button>

                {onTakeSkillTest && (
                  <button
                    type="button"
                    onClick={() => onTakeSkillTest(job.title)}
                    className="min-h-[42px] px-4 py-2 rounded-xl bg-[#D4AF37] hover:bg-[#C39E27] text-[#041C3F] text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Award className="w-4 h-4" />
                    <span>Take Role Skill Test</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setShowReminderForm((p) => !p)}
                  className="min-h-[42px] px-4 py-2 rounded-xl border border-[#062856] text-[#062856] hover:bg-slate-50 text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <CalendarPlus className="w-4 h-4" />
                  <span>Set Interview Reminder</span>
                </button>
              </div>

              {showReminderForm && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <p className="text-xs font-bold text-[#062856]">
                    Schedule Interview Reminder for {job.title}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <input
                      type="date"
                      value={remDate}
                      onChange={(e) => setRemDate(e.target.value)}
                      className="min-h-[38px] px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg"
                    />
                    <input
                      type="time"
                      value={remTime}
                      onChange={(e) => setRemTime(e.target.value)}
                      className="min-h-[38px] px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg"
                    />
                    <select
                      value={remMode}
                      onChange={(e) =>
                        setRemMode(
                          e.target.value as 'Video Call' | 'In-Person' | 'Phone Screen'
                        )
                      }
                      className="min-h-[38px] px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg cursor-pointer"
                    >
                      <option value="Video Call">Video Call</option>
                      <option value="In-Person">In-Person</option>
                      <option value="Phone Screen">Phone Screen</option>
                    </select>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      disabled={remBusy}
                      onClick={() => void handleQuickSaveReminder()}
                      className="min-h-[38px] px-4 py-1.5 rounded-lg bg-[#0A8E43] text-white text-xs font-bold cursor-pointer"
                    >
                      {remBusy
                        ? 'Saving...'
                        : candidate?.role === 'candidate'
                          ? 'Save & Email Reminder'
                          : 'Download Calendar (.ics)'}
                    </button>
                    {remSavedMessage && (
                      <span className="text-xs font-semibold text-[#0A8E43] inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{remSavedMessage}</span>
                      </span>
                    )}
                  </div>
                </div>
              )}

              {aiFitLoading && <AiPanelSkeleton />}
              {aiFitError && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
                  {aiFitError}
                </p>
              )}
              {aiFitResult && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-display text-sm sm:text-base font-bold text-[#062856]">
                      AI Fit Evaluation
                    </h3>
                    <span className="px-3 py-1 rounded-lg bg-[#0A8E43] text-white text-xs font-bold tabular-nums">
                      {aiFitResult.fitScore}% Fit Score
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed">{aiFitResult.summary}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="font-bold text-[#0A8E43] mb-1">Key Strengths</p>
                      <ul className="space-y-1 text-slate-700">
                        {aiFitResult.matchedStrengths.map((s, i) => (
                          <li key={i}>• {s}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="font-bold text-[#D96B0C] mb-1">Focus / Prep Areas</p>
                      <ul className="space-y-1 text-slate-700">
                        {aiFitResult.missingOrImproveSkills.map((s, i) => (
                          <li key={i}>• {s}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <p className="text-xs font-semibold text-[#062856] bg-[#FBF4DC] border border-[#D4AF37]/50 rounded-lg px-3 py-2">
                    Tip: {aiFitResult.applicationTip}
                  </p>
                </div>
              )}

              {coachLoading && <AiPanelSkeleton />}
              {coachError && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
                  {coachError}
                </p>
              )}
              {coachResult && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <h3 className="font-display text-sm sm:text-base font-bold text-[#062856]">
                    AI Interview Prep Questions for {coachResult.roleTitle}
                  </h3>
                  <div className="space-y-2.5">
                    {coachResult.questionsAndAnswers.map((qa, idx) => (
                      <div key={idx} className="p-3 rounded-lg bg-white border border-slate-200 text-xs space-y-1">
                        <p className="font-bold text-[#062856]">
                          Q{idx + 1}: {qa.question}
                        </p>
                        <p className="text-slate-700">
                          <span className="font-semibold">Tip:</span> {qa.englishTip}
                        </p>
                        <p className="text-slate-600">
                          <span className="font-semibold">Action Step:</span> {qa.hindiTip}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </div>

          {/* Right Apply & Verified Employer Trust Sidebar */}
          <aside className="lg:col-span-4 space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-md p-5 sm:p-6">
              <h2 className="font-display text-lg font-bold text-[#062856]">
                Apply for this Position
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-slate-600">
                {companyOrHospitalName}
              </p>

              <dl className="mt-4 pt-4 border-t border-slate-100 space-y-2.5 text-xs sm:text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-slate-500">Openings</dt>
                  <dd className="font-semibold text-[#062856] tabular-nums">
                    {openingsCount} {openingsCount === 1 ? 'Position' : 'Positions'}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-slate-500">Employment Type</dt>
                  <dd className="font-semibold text-[#062856]">
                    {job.jobType || 'Full-Time'}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-slate-500">Apply Window</dt>
                  <dd className="font-semibold text-[#062856] tabular-nums">
                    {applyWindow}
                  </dd>
                </div>
              </dl>

              <div className="mt-5">
                <button
                  type="button"
                  onClick={() => onApplyJob(job)}
                  className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-[#062856] hover:bg-[#041C3F] text-white font-semibold text-sm inline-flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#062856]"
                >
                  <Send className="w-4 h-4 text-[#F6D574]" aria-hidden="true" />
                  <span>Apply Now</span>
                </button>
              </div>
            </div>

            {/* Verified Employer Badge Section */}
            <section
              id="verified-employer-badge"
              aria-labelledby="verified-employer-heading"
              className="bg-white border border-slate-200 rounded-2xl shadow-xs p-5 sm:p-6"
            >
              <div className="flex items-start gap-3.5">
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                    isVerifiedEmployer
                      ? 'bg-[#062856] text-[#F6D574]'
                      : 'bg-[#FBF4DC] text-[#9A6F04] border border-[#D4AF37]/40'
                  }`}
                >
                  <ShieldCheck className="w-6 h-6" aria-hidden="true" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h2
                      id="verified-employer-heading"
                      className="font-display text-base sm:text-lg font-bold text-[#062856] leading-snug"
                    >
                      {isVerifiedEmployer ? 'Verified Employer' : 'Employer Verification'}
                    </h2>
                    <BadgeCheck
                      className={`w-5 h-5 shrink-0 ${
                        isVerifiedEmployer ? 'text-[#0A8E43]' : 'text-[#9A6F04]'
                      }`}
                      aria-hidden="true"
                    />
                  </div>
                  <p className="mt-0.5 text-xs font-medium text-slate-600">
                    {isVerifiedEmployer
                      ? 'Screened & authenticated by Vardhman Consultancy Services'
                      : 'Pending final VCS compliance review before public activation'}
                  </p>
                </div>
              </div>

              <ul className="mt-4 pt-4 border-t border-slate-100 space-y-3 text-xs sm:text-sm text-slate-700">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2
                    className="w-4 h-4 text-[#0A8E43] shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <div>
                    <p className="font-semibold text-[#062856]">
                      Business &amp; Tax Credentials Checked
                    </p>
                    <p className="text-xs text-slate-600 leading-relaxed mt-0.5">
                      Employer identity, GST/PAN registration, and mandate authorization verified prior to listing.
                    </p>
                  </div>
                </li>

                <li className="flex items-start gap-2.5">
                  <CheckCircle2
                    className="w-4 h-4 text-[#0A8E43] shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <div>
                    <p className="font-semibold text-[#062856]">
                      Confirmed Active Hiring Mandate
                    </p>
                    <p className="text-xs text-slate-600 leading-relaxed mt-0.5">
                      Validated directly with the hiring team for {openingsCount}{' '}
                      {openingsCount === 1 ? 'active vacancy' : 'active vacancies'}.
                    </p>
                  </div>
                </li>

                <li className="flex items-start gap-2.5">
                  <CheckCircle2
                    className="w-4 h-4 text-[#0A8E43] shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <div>
                    <p className="font-semibold text-[#062856]">
                      Zero Candidate Placement Fees
                    </p>
                    <p className="text-xs text-slate-600 leading-relaxed mt-0.5">
                      100% free direct application with no charges or hidden deductions for job seekers.
                    </p>
                  </div>
                </li>
              </ul>

              <dl className="mt-4 pt-4 border-t border-slate-100 space-y-2 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-slate-500">Hiring Entity</dt>
                  <dd className="font-semibold text-[#062856] text-right truncate max-w-[190px]">
                    {companyOrHospitalName}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-slate-500">Verification Status</dt>
                  <dd
                    className={`font-bold inline-flex items-center gap-1 ${
                      isVerifiedEmployer ? 'text-[#065F2C]' : 'text-[#9A6F04]'
                    }`}
                  >
                    <BadgeCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>{isVerifiedEmployer ? 'Verified Active' : 'Pending Review'}</span>
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-slate-500">Posted Date</dt>
                  <dd className="font-semibold text-[#062856] tabular-nums">
                    {postedLabel}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-slate-500">Candidate Cost</dt>
                  <dd className="font-semibold text-[#065F2C]">
                    Free Direct Apply
                  </dd>
                </div>
              </dl>

              <div className="mt-4 pt-4 border-t border-slate-100 space-y-2.5">
                <p className="text-xs text-slate-600 flex items-start gap-2 leading-relaxed">
                  <Lock className="w-3.5 h-3.5 text-[#062856] shrink-0 mt-0.5" aria-hidden="true" />
                  <span>
                    Your resume and contact details are shared confidentially only with authorized hiring leads for this mandate.
                  </span>
                </p>
                <button
                  type="button"
                  onClick={() => onOpenModal('contact')}
                  className="text-xs font-semibold text-[#062856] hover:text-[#9A6F04] underline underline-offset-2 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#062856] rounded-sm"
                >
                  Questions about this employer? Contact VCS Support
                </button>
              </div>
            </section>
          </aside>
        </div>
      </div>

      {/* Mobile Sticky Apply Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/98 backdrop-blur-md border-t border-slate-200 px-4 py-2.5 shadow-lg">
        <div className="grid grid-cols-1">
          <button
            type="button"
            onClick={() => onApplyJob(job)}
            className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-[#062856] hover:bg-[#041C3F] text-white font-semibold text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            <Send className="w-4 h-4 text-[#F6D574]" aria-hidden="true" />
            <span>Apply Now</span>
          </button>
        </div>
      </div>
    </div>
  );
}

