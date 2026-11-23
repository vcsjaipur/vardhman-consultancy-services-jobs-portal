import { FormEvent, useEffect, useState } from 'react';
import {
  ArrowLeft,
  Briefcase,
  Building2,
  CheckCircle2,
  FileText,
  IndianRupee,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Send,
  Sparkles,
  User,
  Users,
} from 'lucide-react';
import { auth } from '../firebase';
import { CandidateProfile, JobListing } from '../types/portal';
import {
  draftAiJobDescription,
  getStoredToken,
  postEmployerJob,
  submitPublicCompanyRequirement,
} from '../utils/candidateApi';
import {
  clearFormDraft,
  loadFormDraft,
  saveFormDraft,
} from '../utils/formDraftStorage';
import { createJobInFirestore } from '../utils/firestorePortal';
import { toFriendlyPortalError } from '../utils/jobHelpers';
import { submitCompanyRequirementToSharedPortal } from '../utils/sharedPortalFirestore';
import { PORTAL_BRAND_LOGO_SRC } from './Header';

const POST_JOB_DRAFT_KEY = 'vcs_draft_post_job_v1';

interface PostJobPageProps {
  candidate: CandidateProfile | null;
  onJobPosted: (job: JobListing) => void;
  onGoToEmployerDashboard: () => void;
  onGoToLogin: () => void;
  onGoToRegister: () => void;
  onBackHome: () => void;
}

const SALARY_OPTIONS = [
  'Up to ₹5 LPA',
  '₹5 – 10 LPA',
  '₹10 – 20 LPA',
  '₹20 – 35 LPA',
  '₹35+ LPA',
  'Negotiable',
];

export function PostJobPage({
  candidate,
  onJobPosted,
  onGoToEmployerDashboard,
  onBackHome,
}: PostJobPageProps) {
  const initialDraft = loadFormDraft<{
    companyName: string;
    contactPerson: string;
    recruiterEmail: string;
    phone: string;
    city: string;
    postRequired: string;
    salary: string;
    vacancyCount: string;
    jobDescription: string;
  }>(POST_JOB_DRAFT_KEY);

  const [companyName, setCompanyName] = useState(
    candidate?.companyName || initialDraft?.companyName || ''
  );
  const [contactPerson, setContactPerson] = useState(
    candidate?.name || initialDraft?.contactPerson || ''
  );
  const [recruiterEmail, setRecruiterEmail] = useState(
    candidate?.email || initialDraft?.recruiterEmail || ''
  );
  const [phone, setPhone] = useState(candidate?.phone || initialDraft?.phone || '');
  const [city, setCity] = useState(candidate?.city || initialDraft?.city || '');
  const [postRequired, setPostRequired] = useState(initialDraft?.postRequired || '');
  const [salary, setSalary] = useState(initialDraft?.salary || '');
  const [vacancyCount, setVacancyCount] = useState(initialDraft?.vacancyCount || '1');
  const [jobDescription, setJobDescription] = useState(
    initialDraft?.jobDescription || ''
  );

  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDraftingJd, setIsDraftingJd] = useState(false);
  const [submittedTitle, setSubmittedTitle] = useState<string | null>(null);
  const [submittedCompany, setSubmittedCompany] = useState<string>('');

  useEffect(() => {
    if (!candidate) return;
    setCompanyName((prev) => prev || candidate.companyName || '');
    setContactPerson((prev) => prev || candidate.name || '');
    setRecruiterEmail((prev) => prev || candidate.email || '');
    setPhone((prev) => prev || candidate.phone || '');
    setCity((prev) => prev || candidate.city || '');
  }, [candidate]);

  useEffect(() => {
    if (submittedTitle) return;
    saveFormDraft(POST_JOB_DRAFT_KEY, {
      companyName,
      contactPerson,
      recruiterEmail,
      phone,
      city,
      postRequired,
      salary,
      vacancyCount,
      jobDescription,
    });
  }, [
    submittedTitle,
    companyName,
    contactPerson,
    recruiterEmail,
    phone,
    city,
    postRequired,
    salary,
    vacancyCount,
    jobDescription,
  ]);

  if (candidate?.role === 'candidate') {
    return (
      <div className="bg-slate-50 min-h-[calc(100vh-5rem)] border-b border-slate-200">
        <div className="max-w-xl mx-auto px-4 sm:px-6 py-14 sm:py-20 text-center">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-10 shadow-lg">
            <img
              src={PORTAL_BRAND_LOGO_SRC}
              alt="JobsNia.com — Jobs With Purpose"
              decoding="sync"
              className="h-16 sm:h-20 w-auto mx-auto object-contain mb-4 select-none"
            />
            <div className="w-14 h-14 mx-auto rounded-2xl bg-[#063B7A] text-white flex items-center justify-center shadow-sm">
              <Building2 className="w-7 h-7" aria-hidden="true" />
            </div>

            <h1 className="mt-5 font-display text-2xl font-extrabold text-[#063B7A]">
              Employer Requirement Desk
            </h1>
            <p className="mt-2.5 text-sm sm:text-base text-slate-600 leading-relaxed">
              Submit Requirement is for employers and hiring managers. Job seekers can browse active opportunities on Search Jobs.
            </p>

            <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={onBackHome}
                className="w-full sm:w-auto min-h-[46px] px-6 py-2.5 rounded-xl bg-[#063B7A] hover:bg-[#042A58] text-white text-sm font-bold shadow-sm transition-colors cursor-pointer"
              >
                Back to Home
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleResetForAnother = () => {
    setPostRequired('');
    setSalary('');
    setVacancyCount('1');
    setJobDescription('');
    setError('');
    setSubmittedTitle(null);
  };

  const handleDraftJdWithAi = async () => {
    setError('');
    if (!postRequired.trim()) {
      setError('Enter Post Required / Job Title first to draft JD with AI.');
      return;
    }
    setIsDraftingJd(true);
    try {
      const res = await draftAiJobDescription({
        jobTitle: postRequired.trim(),
        city: city.trim(),
        salary: salary.trim(),
      });
      if (res.description) {
        setJobDescription(res.description);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to draft JD right now.'
      );
    } finally {
      setIsDraftingJd(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!companyName.trim()) {
      setError('Company Name is required.');
      return;
    }
    if (!contactPerson.trim()) {
      setError('Contact Person Name is required.');
      return;
    }
    if (phone.replace(/\D/g, '').length < 10) {
      setError('Please enter a valid 10-digit phone number.');
      return;
    }
    if (
      recruiterEmail.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recruiterEmail.trim())
    ) {
      setError('Please enter a valid Official Email ID.');
      return;
    }
    if (!city.trim()) {
      setError('City / Location is required.');
      return;
    }
    if (!postRequired.trim()) {
      setError('Post Required / Job Title is required.');
      return;
    }
    if (!salary) {
      setError('Please select a Salary range.');
      return;
    }
    if (!jobDescription.trim()) {
      setError('Complete Job Description / Requirement is required.');
      return;
    }

    const openingsNum =
      Number(vacancyCount) >= 1 ? Math.floor(Number(vacancyCount)) : 1;

    setIsSubmitting(true);
    try {
      const fullJdDescription = recruiterEmail.trim()
        ? `${jobDescription.trim()}\n\nOfficial Recruiter Email: ${recruiterEmail.trim()}`
        : jobDescription.trim();

      const reqId = await submitCompanyRequirementToSharedPortal({
        companyName: companyName.trim(),
        contactPerson: contactPerson.trim(),
        phone: phone.trim(),
        city: city.trim(),
        postRequired: postRequired.trim(),
        salary,
        vacancyCount: openingsNum,
        jobDescription: fullJdDescription,
      });

      if (candidate && getStoredToken()) {
        void postEmployerJob({
          id: reqId,
          company: companyName.trim(),
          recruiterName: contactPerson.trim(),
          recruiterEmail: recruiterEmail.trim() || candidate.email,
          recruiterPhone: phone.trim(),
          title: postRequired.trim(),
          designation: postRequired.trim(),
          location: city.trim(),
          experience: 'As per JD',
          salary,
          jobType: 'Full-Time',
          skills: postRequired.trim(),
          description: jobDescription.trim(),
          lastDateToApply: 'Open Until Filled',
          openings: openingsNum,
        }).catch(() =>
          submitPublicCompanyRequirement({
            id: reqId,
            companyName: companyName.trim(),
            contactPerson: contactPerson.trim(),
            phone: phone.trim(),
            email: recruiterEmail.trim() || candidate.email,
            city: city.trim(),
            postRequired: postRequired.trim(),
            salary,
            vacancyCount: openingsNum,
            jobDescription: jobDescription.trim(),
          }).catch(() => null)
        );
      } else {
        void submitPublicCompanyRequirement({
          id: reqId,
          companyName: companyName.trim(),
          contactPerson: contactPerson.trim(),
          phone: phone.trim(),
          email: recruiterEmail.trim(),
          city: city.trim(),
          postRequired: postRequired.trim(),
          salary,
          vacancyCount: openingsNum,
          jobDescription: jobDescription.trim(),
        }).catch(() => null);
      }

      let primaryJobSummary: JobListing | null = null;
      if (auth.currentUser?.emailVerified) {
        try {
          primaryJobSummary = await createJobInFirestore({
            jobId: reqId,
            company: companyName.trim(),
            recruiterName: contactPerson.trim(),
            recruiterEmail: recruiterEmail.trim() || candidate?.email || 'hr@company.com',
            recruiterPhone: phone.trim(),
            title: postRequired.trim(),
            designation: postRequired.trim(),
            location: city.trim(),
            experience: 'As per JD',
            salary,
            jobType: 'Full-Time',
            skills: postRequired.trim(),
            description: jobDescription.trim(),
            openings: openingsNum,
            lastDateToApply: 'Open Until Filled',
          });
        } catch {
          primaryJobSummary = null;
        }
      }

      const postedSummary: JobListing = primaryJobSummary || {
        id: reqId,
        title: postRequired.trim(),
        jobTitle: postRequired.trim(),
        designation: postRequired.trim(),
        company: companyName.trim(),
        clientName: companyName.trim(),
        location: city.trim(),
        experience: 'As per JD',
        salary,
        skills: [postRequired.trim()],
        description: jobDescription.trim(),
        jobDescription: jobDescription.trim(),
        qualification: '',
        openings: openingsNum,
        openingsCount: openingsNum,
        postedAt: new Date().toISOString().slice(0, 10),
        status: 'Pending',
      };

      clearFormDraft(POST_JOB_DRAFT_KEY);
      setSubmittedTitle(postRequired.trim());
      setSubmittedCompany(companyName.trim());
      onJobPosted(postedSummary);
    } catch (err) {
      setError(
        toFriendlyPortalError(err, 'Something went wrong, please try again.')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-slate-50 min-h-[calc(100vh-5rem)] border-b border-slate-200">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBackHome}
            className="inline-flex items-center gap-2 min-h-[44px] px-3.5 py-2 rounded-xl bg-white border border-slate-200 shadow-xs text-sm font-semibold text-[#063B7A] hover:text-[#0A8E43] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span>Back to Home</span>
          </button>

          {candidate && (
            <button
              type="button"
              onClick={onGoToEmployerDashboard}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-white border border-slate-200 shadow-xs hover:border-[#0A8E43] text-[#063B7A] text-sm font-semibold transition-colors cursor-pointer"
            >
              Employer Dashboard
            </button>
          )}
        </div>

        {submittedTitle ? (
          <div className="mt-5 bg-white border border-slate-200 rounded-2xl shadow-lg p-6 sm:p-10 space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-[#0A8E43] text-white flex items-center justify-center shadow-sm">
                <CheckCircle2 className="w-8 h-8" aria-hidden="true" />
              </div>

              <p className="mt-4 text-xs font-bold tracking-widest uppercase text-[#0A8E43]">
                Requirement Received · Vardhman Consultancy Services
              </p>

              <h1 className="mt-2 font-display text-2xl sm:text-3xl font-extrabold text-[#063B7A]">
                Hiring Requirement Submitted Successfully
              </h1>

              <p className="mt-3 text-sm sm:text-base text-slate-600 max-w-xl mx-auto leading-relaxed">
                Thank you! Your requirement for{' '}
                <span className="font-semibold text-slate-900">{submittedTitle}</span>{' '}
                ({submittedCompany}) has been shared with the Vardhman Consultancy Services recruitment team. We will connect with you on{' '}
                <span className="font-semibold text-slate-900">{phone}</span> shortly.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={onBackHome}
                className="w-full sm:w-auto min-h-[46px] px-6 py-2.5 rounded-xl bg-[#0A8E43] hover:bg-[#087537] text-white text-sm font-bold shadow-sm transition-colors cursor-pointer"
              >
                Back to Home
              </button>
              <button
                type="button"
                onClick={handleResetForAnother}
                className="w-full sm:w-auto min-h-[46px] px-6 py-2.5 rounded-xl bg-[#063B7A] hover:bg-[#042A58] text-white text-sm font-bold shadow-sm transition-colors cursor-pointer"
              >
                Submit Another Requirement
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-5 bg-white border border-slate-200 rounded-2xl shadow-lg overflow-hidden">
            <div className="bg-[#063B7A] px-5 sm:px-8 py-6 text-white">
              <div className="bg-white rounded-xl px-3.5 py-2 inline-flex items-center mb-3 shadow-sm">
                <img
                  src={PORTAL_BRAND_LOGO_SRC}
                  alt="JobsNia.com — Jobs With Purpose"
                  decoding="sync"
                  className="h-16 sm:h-20 w-auto object-contain select-none"
                />
              </div>
              <p className="text-xs sm:text-sm font-semibold text-[#F58220]">
                JobsNia.com · Vardhman Consultancy Services · Confidential Employer Desk
              </p>
              <h1 className="mt-1 font-display text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Submit Company Hiring Requirement
              </h1>
              <p className="mt-2 text-sm text-slate-200 leading-relaxed">
                Share your manpower requirement with Vardhman Consultancy Services. All mandates are reviewed and published confidentially as &quot;Confidential - Apply via VCS&quot;.
              </p>
            </div>

            <div className="p-5 sm:p-8">
              <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="post-company"
                      className="block text-xs font-semibold text-[#063B7A] mb-1.5"
                    >
                      Company Name *
                    </label>
                    <div className="relative flex items-center">
                      <Building2
                        className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none"
                        aria-hidden="true"
                      />
                      <input
                        id="post-company"
                        type="text"
                        required
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="Organization / Hospital / Company name"
                        className="w-full min-h-[46px] pl-10 pr-3.5 py-2.5 text-sm text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#0A8E43] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="post-recruiter"
                      className="block text-xs font-semibold text-[#063B7A] mb-1.5"
                    >
                      Contact Person Name *
                    </label>
                    <div className="relative flex items-center">
                      <User
                        className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none"
                        aria-hidden="true"
                      />
                      <input
                        id="post-recruiter"
                        type="text"
                        required
                        value={contactPerson}
                        onChange={(e) => setContactPerson(e.target.value)}
                        placeholder="Contact person name"
                        className="w-full min-h-[46px] pl-10 pr-3.5 py-2.5 text-sm text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#0A8E43] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="post-phone"
                      className="block text-xs font-semibold text-[#063B7A] mb-1.5"
                    >
                      Phone Number *
                    </label>
                    <div className="relative flex items-center">
                      <Phone
                        className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none"
                        aria-hidden="true"
                      />
                      <input
                        id="post-phone"
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="10-digit contact number"
                        className="w-full min-h-[46px] pl-10 pr-3.5 py-2.5 text-sm text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#0A8E43] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="post-email"
                      className="block text-xs font-semibold text-[#063B7A] mb-1.5"
                    >
                      Official Email ID (Optional)
                    </label>
                    <div className="relative flex items-center">
                      <Mail
                        className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none"
                        aria-hidden="true"
                      />
                      <input
                        id="post-email"
                        type="email"
                        value={recruiterEmail}
                        onChange={(e) => setRecruiterEmail(e.target.value)}
                        placeholder="hr@company.com"
                        className="w-full min-h-[46px] pl-10 pr-3.5 py-2.5 text-sm text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#0A8E43] focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                <hr className="border-slate-200" />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="post-title"
                      className="block text-xs font-semibold text-[#063B7A] mb-1.5"
                    >
                      Post Required / Job Title *
                    </label>
                    <div className="relative flex items-center">
                      <Briefcase
                        className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none"
                        aria-hidden="true"
                      />
                      <input
                        id="post-title"
                        type="text"
                        required
                        value={postRequired}
                        onChange={(e) => setPostRequired(e.target.value)}
                        placeholder="e.g. Radiologist / Area Manager"
                        className="w-full min-h-[46px] pl-10 pr-3.5 py-2.5 text-sm text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#0A8E43] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="post-location"
                      className="block text-xs font-semibold text-[#063B7A] mb-1.5"
                    >
                      City / Location *
                    </label>
                    <div className="relative flex items-center">
                      <MapPin
                        className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none"
                        aria-hidden="true"
                      />
                      <input
                        id="post-location"
                        type="text"
                        required
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="e.g. Jaipur, Mumbai, Delhi"
                        className="w-full min-h-[46px] pl-10 pr-3.5 py-2.5 text-sm text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#0A8E43] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="post-salary"
                      className="block text-xs font-semibold text-[#063B7A] mb-1.5"
                    >
                      Salary / CTC Range *
                    </label>
                    <div className="relative flex items-center">
                      <IndianRupee
                        className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none"
                        aria-hidden="true"
                      />
                      <select
                        id="post-salary"
                        required
                        value={salary}
                        onChange={(e) => setSalary(e.target.value)}
                        className="w-full min-h-[46px] pl-10 pr-8 py-2.5 text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#0A8E43] focus:outline-none cursor-pointer"
                      >
                        <option value="">Select Salary Range</option>
                        {SALARY_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="post-openings"
                      className="block text-xs font-semibold text-[#063B7A] mb-1.5"
                    >
                      Vacancy Count *
                    </label>
                    <div className="relative flex items-center">
                      <Users
                        className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none"
                        aria-hidden="true"
                      />
                      <input
                        id="post-openings"
                        type="number"
                        min={1}
                        required
                        value={vacancyCount}
                        onChange={(e) => setVacancyCount(e.target.value)}
                        className="w-full min-h-[46px] pl-10 pr-3.5 py-2.5 text-sm text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#0A8E43] focus:outline-none tabular-nums"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                    <label
                      htmlFor="post-description"
                      className="block text-xs font-semibold text-[#063B7A]"
                    >
                      Complete Job Description / Requirement *
                    </label>
                    <button
                      type="button"
                      disabled={isDraftingJd}
                      onClick={() => void handleDraftJdWithAi()}
                      className="px-3 py-1 rounded-lg bg-[#063B7A] hover:bg-[#042A58] disabled:opacity-60 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      {isDraftingJd ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5 text-[#F58220]" />
                      )}
                      <span>{isDraftingJd ? 'Drafting JD...' : 'AI Draft JD'}</span>
                    </button>
                  </div>
                  <div className="relative">
                    <FileText
                      className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none"
                      aria-hidden="true"
                    />
                    <textarea
                      id="post-description"
                      rows={5}
                      required
                      value={jobDescription}
                      onChange={(e) => setJobDescription(e.target.value)}
                      placeholder="Describe key responsibilities, required qualification, experience, and role expectations..."
                      className="w-full pl-10 pr-3.5 py-3 text-sm text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#0A8E43] focus:outline-none"
                    />
                  </div>
                </div>

                {error && (
                  <p
                    className="text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3"
                    role="alert"
                  >
                    {error}
                  </p>
                )}

                <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-end gap-3">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full sm:w-auto min-h-[48px] px-7 py-3 rounded-xl bg-[#0A8E43] hover:bg-[#087537] disabled:opacity-60 text-white font-bold text-sm inline-flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
                  >
                    <Send className="w-4 h-4" aria-hidden="true" />
                    <span>
                      {isSubmitting
                        ? 'Submitting Requirement...'
                        : 'Submit Requirement'}
                    </span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
