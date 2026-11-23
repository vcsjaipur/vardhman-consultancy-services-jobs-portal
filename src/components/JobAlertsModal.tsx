import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Briefcase,
  CheckCircle2,
  Mail,
  MapPin,
  User,
  X,
} from 'lucide-react';
import {
  CandidateProfile,
  EmailDispatchSummary,
  JobAlertPreviewJob,
  JobListing,
} from '../types/portal';
import { submitJobAlert } from '../utils/candidateApi';
import {
  clearFormDraft,
  loadFormDraft,
  saveFormDraft,
} from '../utils/formDraftStorage';
import { submitClientQueryToSharedPortal } from '../utils/sharedPortalFirestore';
import { SearchSuggestionInput } from './SearchSuggestionInput';

const JOB_ALERTS_DRAFT_KEY = 'vcs_draft_job_alerts_v1';

interface JobAlertsModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidate?: CandidateProfile | null;
  jobs?: JobListing[];
  onSelectJob?: (jobId: string) => void;
}

const JOB_CATEGORIES = [
  'Medical Officers',
  'Consultant Doctors',
  'Medical Representatives',
  'Pharmaceutical',
  'Hospital',
  'Healthcare',
  'Life Science',
  'Biotech',
  'Diagnostics',
  'Nutraceuticals',
  'Ayurveda',
  'Homeopathy',
  'Healthcare IT',
  'Healthcare Non-IT',
];

function countLiveMatchingJobs(jobs: JobListing[], city: string, category: string): number {
  if (jobs.length === 0) return 0;
  const cleanCity = city.trim().toLowerCase();
  const catTokens = category
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2 && t !== 'and');
  return jobs.filter((job) => {
    const loc = (job.location || '').toLowerCase();
    const cityOk =
      !cleanCity ||
      cleanCity.includes('pan india') ||
      cleanCity.includes('all india') ||
      loc.includes('pan india') ||
      loc.includes(cleanCity);
    const haystack = [
      job.title,
      job.designation,
      job.qualification,
      job.skills.join(' '),
      job.description,
    ]
      .join(' ')
      .toLowerCase();
    const catOk = catTokens.length === 0 || catTokens.some((t) => haystack.includes(t));
    return cityOk && catOk;
  }).length;
}

export function JobAlertsModal({
  isOpen,
  onClose,
  candidate,
  jobs = [],
  onSelectJob,
}: JobAlertsModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [category, setCategory] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedResult, setSubmittedResult] = useState<{
    message: string;
    emailDispatch?: EmailDispatchSummary | null;
    matchedJobsCount: number;
    matchedJobsPreview: JobAlertPreviewJob[];
  } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const draft = loadFormDraft<{
      name: string;
      email: string;
      city: string;
      category: string;
    }>(JOB_ALERTS_DRAFT_KEY);
    setName(candidate?.name || draft?.name || '');
    setEmail(candidate?.email || draft?.email || '');
    setCity(
      candidate?.alertCity ||
        candidate?.preferredLocation ||
        candidate?.city ||
        draft?.city ||
        ''
    );
    setCategory(candidate?.alertCategory || draft?.category || '');
    setError('');
    setSubmittedResult(null);
  }, [isOpen, candidate]);

  useEffect(() => {
    if (!isOpen || submittedResult) return;
    saveFormDraft(JOB_ALERTS_DRAFT_KEY, {
      name,
      email,
      city,
      category,
    });
  }, [isOpen, submittedResult, name, email, city, category]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const liveMatchCount = useMemo(
    () => countLiveMatchingJobs(jobs, city, category),
    [jobs, city, category]
  );

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address for job alerts.');
      return;
    }
    if (!city.trim()) {
      setError('Please enter your preferred city.');
      return;
    }
    if (!category) {
      setError('Please select a job category.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await submitJobAlert({
        name: name.trim(),
        email: email.trim(),
        channels: ['email'],
        city: city.trim(),
        category,
        jobs,
      });
      void submitClientQueryToSharedPortal({
        name: name.trim(),
        phone: candidate?.phone || 'Portal Subscriber',
        message: [
          `Email Job Alert Subscription Request`,
          `Category: ${category}`,
          `Preferred City: ${city.trim()}`,
          `Email: ${email.trim()}`,
        ].join(' | '),
      }).catch(() => null);
      clearFormDraft(JOB_ALERTS_DRAFT_KEY);
      setSubmittedResult({
        message: response.message,
        emailDispatch: response.emailDispatch,
        matchedJobsCount: response.matchedJobsCount ?? 0,
        matchedJobsPreview: response.matchedJobsPreview ?? [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save job alert.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="job-alerts-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="grid grid-cols-3 h-1 w-full" aria-hidden="true">
          <div className="bg-[#063B7A]" />
          <div className="bg-[#F58220]" />
          <div className="bg-[#0A8E43]" />
        </div>

        <div className="p-5 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-[#0A8E43]">
                Verified Email Job Alerts · JobsNia.com
              </p>
              <h2
                id="job-alerts-modal-title"
                className="mt-1 font-display text-xl sm:text-2xl font-bold text-[#063B7A]"
              >
                Get Job Alert Emails
              </h2>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="w-10 h-10 rounded-lg border border-slate-200 text-slate-500 hover:text-[#063B7A] hover:bg-slate-50 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {submittedResult ? (
            <div className="mt-5 space-y-4">
              <div className="p-5 rounded-xl bg-[#0A8E43]/8 border border-[#0A8E43]/30 space-y-2">
                <div className="flex items-center gap-2.5 font-bold text-[#0A8E43] text-base">
                  <CheckCircle2 className="w-5 h-5 shrink-0" aria-hidden="true" />
                  <span>{submittedResult.message}</span>
                </div>
                <p className="text-sm text-slate-700 leading-relaxed">
                  Thank you, <span className="font-semibold">{name}</span>. Verified openings in{' '}
                  <span className="font-semibold">{category}</span> ({city}) will be emailed directly to{' '}
                  <span className="font-semibold">{email}</span>.
                </p>
                {submittedResult.emailDispatch && (
                  <p className="text-xs font-medium text-slate-600">
                    Dispatch status:{' '}
                    <span className="font-semibold text-[#063B7A]">
                      {submittedResult.emailDispatch.deliveredVia === 'smtp'
                        ? 'Email sent to your inbox'
                        : 'Email queued for delivery'}
                    </span>
                  </p>
                )}
              </div>

              {submittedResult.matchedJobsPreview.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#063B7A]">
                    Matching Verified Jobs Included in Your Email ({submittedResult.matchedJobsPreview.length})
                  </p>
                  <div className="space-y-2">
                    {submittedResult.matchedJobsPreview.map((job) => (
                      <button
                        key={job.id}
                        type="button"
                        onClick={() => {
                          if (onSelectJob) {
                            onSelectJob(job.id);
                            onClose();
                          }
                        }}
                        className="w-full text-left p-3 rounded-xl bg-slate-50 hover:bg-[#FBF4DC]/60 border border-slate-200 hover:border-[#062856] transition-colors cursor-pointer"
                      >
                        <p className="font-display text-sm font-bold text-[#062856]">
                          {job.title}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-600">
                          {job.location} · {job.salary}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[44px] px-6 py-2.5 rounded-xl bg-[#063B7A] hover:bg-[#042A58] text-white text-sm font-semibold transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
              <p className="text-sm text-slate-600 leading-relaxed">
                Receive verified job alert emails immediately for matching roles and whenever new mandates are approved.
              </p>

              {/* Name */}
              <div>
                <label
                  htmlFor="alert-name"
                  className="block text-xs font-semibold text-[#063B7A] mb-1.5"
                >
                  Full Name *
                </label>
                <div className="relative flex items-center">
                  <User
                    className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    id="alert-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your full name"
                    className="w-full min-h-[44px] pl-10 pr-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:border-[#063B7A] focus:outline-none focus:ring-2 focus:ring-[#063B7A]/15"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label
                  htmlFor="alert-email"
                  className="block text-xs font-semibold text-[#063B7A] mb-1.5"
                >
                  Email Address *
                </label>
                <div className="relative flex items-center">
                  <Mail
                    className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    id="alert-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full min-h-[44px] pl-10 pr-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:border-[#063B7A] focus:outline-none focus:ring-2 focus:ring-[#063B7A]/15"
                  />
                </div>
              </div>

              {/* City with Autocomplete */}
              <div>
                <label
                  htmlFor="alert-city"
                  className="block text-xs font-semibold text-[#063B7A] mb-1.5"
                >
                  Preferred City *
                </label>
                <SearchSuggestionInput
                  id="alert-city"
                  value={city}
                  onChange={setCity}
                  field="location"
                  jobs={jobs}
                  enableAiExpand={false}
                  ariaLabel="Preferred City"
                  placeholder="e.g. Mumbai, Delhi NCR, Jaipur, Pan India"
                  icon={
                    <MapPin
                      className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none"
                      aria-hidden="true"
                    />
                  }
                  inputClassName="w-full min-h-[44px] pl-10 pr-8 py-2 text-sm border border-slate-200 rounded-xl focus:border-[#063B7A] focus:outline-none focus:ring-2 focus:ring-[#063B7A]/15"
                />
              </div>

              {/* Category */}
              <div>
                <label
                  htmlFor="alert-category"
                  className="block text-xs font-semibold text-[#063B7A] mb-1.5"
                >
                  Job Category *
                </label>
                <div className="relative flex items-center">
                  <Briefcase
                    className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none"
                    aria-hidden="true"
                  />
                  <select
                    id="alert-category"
                    required
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full min-h-[44px] pl-10 pr-8 py-2 text-sm text-slate-800 bg-white border border-slate-200 rounded-xl focus:border-[#063B7A] focus:outline-none focus:ring-2 focus:ring-[#063B7A]/15 cursor-pointer"
                  >
                    <option value="">Select Job Category</option>
                    {JOB_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Live Match Count Preview */}
              {(city.trim() || category) && jobs.length > 0 && (
                <div className="px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 tabular-nums">
                  <span className="font-bold text-[#063B7A]">
                    {liveMatchCount}
                  </span>{' '}
                  {liveMatchCount === 1 ? 'verified opening matches' : 'verified openings match'}{' '}
                  your alert filter right now — we&apos;ll include matching roles in your confirmation email.
                </div>
              )}

              {error && (
                <p className="text-xs sm:text-sm font-medium text-red-600" role="alert">
                  {error}
                </p>
              )}

              <div className="pt-2 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-medium transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="min-h-[46px] px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#0A8E43] to-[#077235] hover:from-[#087537] hover:to-[#065E2B] disabled:opacity-60 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 shadow-md shadow-[#0A8E43]/25 transition-all cursor-pointer"
                >
                  <Bell className="w-4 h-4" aria-hidden="true" />
                  <span>{isSubmitting ? 'Subscribing...' : 'Subscribe & Email Matching Jobs'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
