import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import {
  Briefcase,
  CheckCircle2,
  ExternalLink,
  FileText,
  GraduationCap,
  Mail,
  MapPin,
  Phone,
  Send,
  ShieldCheck,
  Upload,
  User,
  X,
} from 'lucide-react';
import { VCS_TERMS_DOCUMENT } from '../constants/jobSeekerTerms';
import { auth } from '../firebase';
import { CandidateProfile, JobApplication, JobListing } from '../types/portal';
import {
  getStoredToken,
  readPdfFileAsBase64,
  submitJobApplication,
  submitPublicApplication,
} from '../utils/candidateApi';
import {
  createApplicationInFirestore,
  createResumeGodamEntryInFirestore,
  generatePortalRecordId,
  publicJobExistsInFirestore,
} from '../utils/firestorePortal';
import {
  clearFormDraft,
  loadFormDraft,
  saveFormDraft,
} from '../utils/formDraftStorage';
import { maskCompanyName, toFriendlyPortalError } from '../utils/jobHelpers';
import {
  MAX_SHARED_RESUME_BASE64_CHARS,
  submitCandidateApplicationToSharedPortal,
} from '../utils/sharedPortalFirestore';

const APPLY_MODAL_DRAFT_KEY = 'vcs_draft_apply_modal_v1';

interface ApplyJobModalProps {
  isOpen: boolean;
  mode: 'apply-job' | 'submit-resume';
  job: JobListing | null;
  candidate: CandidateProfile | null;
  onClose: () => void;
  onApplicationSubmitted: (application: JobApplication) => void;
  onGoToDashboard?: () => void;
  onViewFullTerms?: () => void;
}

async function fetchSavedProfileResumeAsBase64(
  resumeId: string
): Promise<string | null> {
  const token = getStoredToken();
  if (!token || !resumeId) return null;
  try {
    const res = await fetch(`/api/resumes/${encodeURIComponent(resumeId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve(typeof reader.result === 'string' ? reader.result : null);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export function ApplyJobModal({
  isOpen,
  mode,
  job,
  candidate,
  onClose,
  onApplicationSubmitted,
  onViewFullTerms,
}: ApplyJobModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [qualificationExperience, setQualificationExperience] = useState('');
  const [postApplied, setPostApplied] = useState('');
  const [resumeSummary, setResumeSummary] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTermsDetails, setShowTermsDetails] = useState(true);
  const [useProfileResume, setUseProfileResume] = useState(false);
  const [customResume, setCustomResume] = useState<{
    fileName: string;
    base64: string;
    sizeBytes: number;
  } | null>(null);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedApp, setSubmittedApp] = useState<JobApplication | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isJobApply = mode === 'apply-job' && Boolean(job);

  useEffect(() => {
    if (!isOpen) return;
    const draft = loadFormDraft<{
      name: string;
      email: string;
      phone: string;
      city: string;
      qualificationExperience: string;
      postApplied: string;
      resumeSummary: string;
    }>(APPLY_MODAL_DRAFT_KEY);

    setName(candidate?.name || draft?.name || '');
    setEmail(candidate?.email || draft?.email || '');
    setPhone(candidate?.phone || draft?.phone || '');
    setCity(candidate?.city || draft?.city || '');
    const initialQualExp = [candidate?.qualification, candidate?.experience]
      .filter((v): v is string => Boolean(v && v.trim()))
      .join(' · ');
    setQualificationExperience(initialQualExp || draft?.qualificationExperience || '');
    setPostApplied(job ? job.jobTitle || job.title : draft?.postApplied || '');
    setResumeSummary(draft?.resumeSummary || '');
    setTermsAccepted(false);
    setShowTermsDetails(true);
    setUseProfileResume(Boolean(candidate?.resumeId && candidate?.resumeFileName));
    setCustomResume(null);
    setError('');
    setSubmittedApp(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [isOpen, job?.id, job?.title, job?.jobTitle, candidate, mode]);

  useEffect(() => {
    if (!isOpen || submittedApp) return;
    saveFormDraft(APPLY_MODAL_DRAFT_KEY, {
      name,
      email,
      phone,
      city,
      qualificationExperience,
      postApplied,
      resumeSummary,
    });
  }, [
    isOpen,
    submittedApp,
    name,
    email,
    phone,
    city,
    qualificationExperience,
    postApplied,
    resumeSummary,
  ]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    try {
      const parsed = await readPdfFileAsBase64(file);
      if (parsed.base64.length > MAX_SHARED_RESUME_BASE64_CHARS) {
        setCustomResume(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        setError('Please upload a PDF file smaller than 580 KB.');
        return;
      }
      setCustomResume(parsed);
      setUseProfileResume(false);
    } catch (err) {
      setCustomResume(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setError(
        toFriendlyPortalError(
          err,
          'Please select a valid PDF (.pdf) resume file.'
        )
      );
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanName = name.trim();
    const cleanEmail = email.trim();
    const cleanPhone = phone.trim();
    const cleanCity = city.trim() || job?.location || 'India';
    const cleanQualExp = qualificationExperience.trim();
    const cleanPost = (
      isJobApply ? job?.jobTitle || job?.title || postApplied : postApplied
    ).trim();

    if (!cleanName) {
      setError('Please enter your Full Name.');
      return;
    }
    if (cleanPhone.replace(/\D/g, '').length < 10) {
      setError('Please enter a valid Mobile Number (at least 10 digits).');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Please enter a valid Email Address.');
      return;
    }
    if (!cleanQualExp) {
      setError('Please enter your Qualification / Experience.');
      return;
    }
    if (!cleanPost) {
      setError('Please enter the post or role you are applying for.');
      return;
    }

    const usingSaved =
      useProfileResume &&
      Boolean(candidate?.resumeId && candidate?.resumeFileName);

    if (!usingSaved && !customResume) {
      setError('Please upload your Resume / CV in PDF format only.');
      return;
    }

    if (!termsAccepted) {
      setError(
        'Please read and tick the mandatory Terms & Conditions checkbox before submitting.'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const finalResumeFileName =
        customResume?.fileName || candidate?.resumeFileName || 'resume.pdf';
      if (!finalResumeFileName.toLowerCase().endsWith('.pdf')) {
        setIsSubmitting(false);
        setError('Only PDF files (.pdf) are allowed for Resume / CV upload.');
        return;
      }

      let finalResumeBase64 = customResume?.base64 || '';

      if (!finalResumeBase64 && usingSaved && candidate?.resumeId) {
        const fetched = await fetchSavedProfileResumeAsBase64(candidate.resumeId);
        if (!fetched) {
          setIsSubmitting(false);
          setError('Please upload your Resume / CV PDF file below to continue.');
          return;
        }
        if (fetched.length > MAX_SHARED_RESUME_BASE64_CHARS) {
          setIsSubmitting(false);
          setError('Saved PDF exceeds 580 KB. Please upload a smaller PDF file.');
          return;
        }
        finalResumeBase64 = fetched;
      }

      if (!finalResumeBase64) {
        setIsSubmitting(false);
        setError('Please upload your Resume / CV in PDF format.');
        return;
      }

      const targetJobId = job?.id || 'general_resume';
      const companyMasked = job
        ? maskCompanyName(job.company, job.companyMasked)
        : 'Vardhman Consultancy Services';
      const entryId = generatePortalRecordId('app');

      // 1. Primary Firebase Resume Godam save (stores complete form data + PDF Base64)
      const godamEntry = await createResumeGodamEntryInFirestore({
        entryId,
        jobId: targetJobId,
        jobTitle: cleanPost,
        companyMasked,
        applicantName: cleanName,
        applicantEmail: cleanEmail,
        applicantPhone: cleanPhone,
        city: cleanCity,
        qualificationExperience: cleanQualExp,
        resumeSummary: resumeSummary.trim() || undefined,
        resumeFileName: finalResumeFileName,
        resumeBase64: finalResumeBase64,
        termsAccepted: true,
      });

      // 2. Sync to shared external portal DB & backend server DB (graceful fallback if secondary sync rejects)
      await Promise.allSettled([
        submitCandidateApplicationToSharedPortal({
          name: cleanName,
          email: cleanEmail,
          phone: cleanPhone,
          city: cleanCity,
          postApplied: cleanPost,
          qualificationExperience: cleanQualExp,
          termsAccepted: true,
          jobId: targetJobId,
          resumeFileName: finalResumeFileName,
          resumeBase64: finalResumeBase64,
          resumeSummary: resumeSummary.trim() || undefined,
        }),
        candidate && getStoredToken() && job
          ? submitJobApplication({
              id: entryId,
              jobId: job.id,
              jobTitle: cleanPost,
              companyMasked,
              location: job.location,
              salary: job.salary,
              experience: job.experience,
              city: cleanCity,
              qualificationExperience: cleanQualExp,
              resumeSummary: resumeSummary.trim() || undefined,
              applicantName: cleanName,
              applicantEmail: cleanEmail,
              applicantPhone: cleanPhone,
              useProfileResume: usingSaved,
              resumeFileName: finalResumeFileName,
              resumeBase64: finalResumeBase64,
              termsAccepted: true,
            })
          : submitPublicApplication({
              id: entryId,
              jobId: targetJobId,
              jobTitle: cleanPost,
              companyMasked,
              location: job?.location || cleanCity,
              salary: job?.salary || 'As per Industry Standards',
              experience: job?.experience || cleanQualExp,
              city: cleanCity,
              qualificationExperience: cleanQualExp,
              resumeSummary: resumeSummary.trim() || undefined,
              applicantName: cleanName,
              applicantEmail: cleanEmail,
              applicantPhone: cleanPhone,
              resumeFileName: finalResumeFileName,
              resumeBase64: finalResumeBase64,
              termsAccepted: true,
            }),
      ]);

      // 3. Also sync to primary /applications collection when verified candidate applies to a local public_jobs doc
      if (job && auth.currentUser?.emailVerified) {
        const existsInPublic = await publicJobExistsInFirestore(job.id);
        if (existsInPublic) {
          await createApplicationInFirestore({
            applicationId: entryId,
            job,
            applicantName: cleanName,
            applicantEmail: cleanEmail,
            applicantPhone: cleanPhone,
            resumeId: candidate?.resumeId || entryId,
            resumeFileName: finalResumeFileName,
          }).catch(() => null);
        }
      }

      clearFormDraft(APPLY_MODAL_DRAFT_KEY);
      setSubmittedApp(godamEntry);
      onApplicationSubmitted(godamEntry);
    } catch (err) {
      setError(
        toFriendlyPortalError(err, 'Something went wrong, please try again.')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="apply-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="h-1 w-full bg-gradient-to-r from-[#062856] via-[#D4AF37] to-[#062856]"
          aria-hidden="true"
        />

        <div className="p-5 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-[#0A8E43]">
                {submittedApp
                  ? 'Portal Application Confirmed'
                  : isJobApply && job
                    ? `${maskCompanyName(job.company, job.companyMasked)} · ${job.location}`
                    : 'Vardhman Consultancy Services · Candidate Portal'}
              </p>
              <h2
                id="apply-modal-title"
                className="mt-1 font-display text-xl sm:text-2xl font-bold text-[#063B7A]"
              >
                {submittedApp
                  ? 'Application Submitted Successfully ✅'
                  : isJobApply && job
                    ? `Apply Now: ${job.jobTitle || job.title}`
                    : 'Submit Resume (Portal Only)'}
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

          {submittedApp ? (
            <div className="mt-5">
              <div className="p-4 sm:p-5 rounded-xl bg-[#0A8E43]/8 border border-[#0A8E43]/30">
                <div className="flex items-center gap-2 font-bold text-[#0A8E43]">
                  <CheckCircle2 className="w-5 h-5 shrink-0" aria-hidden="true" />
                  <span>Application Submitted Successfully ✅</span>
                </div>
                <p className="mt-2 text-sm text-slate-700 leading-relaxed">
                  Thank you, <span className="font-semibold">{submittedApp.applicantName}</span>. Your application and PDF resume (
                  <span className="font-semibold">{submittedApp.resumeFileName}</span>) for{' '}
                  <span className="font-semibold">{submittedApp.jobTitle}</span> have been saved in{' '}
                  <span className="font-semibold text-[#063B7A]">Resume Godam / Applications</span>.
                </p>
                {submittedApp.qualificationExperience && (
                  <p className="mt-2 text-xs text-slate-600">
                    Qualification / Experience:{' '}
                    <span className="font-semibold text-slate-800">
                      {submittedApp.qualificationExperience}
                    </span>
                  </p>
                )}
              </div>

              <div className="mt-6 flex justify-end">
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
              {/* 1. Full Name */}
              <div>
                <label
                  htmlFor="apply-name"
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
                    id="apply-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your full name"
                    className="w-full min-h-[44px] pl-10 pr-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:border-[#063B7A] focus:outline-none focus:ring-2 focus:ring-[#063B7A]/15"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* 2. Mobile Number */}
                <div>
                  <label
                    htmlFor="apply-phone"
                    className="block text-xs font-semibold text-[#063B7A] mb-1.5"
                  >
                    Mobile Number *
                  </label>
                  <div className="relative flex items-center">
                    <Phone
                      className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none"
                      aria-hidden="true"
                    />
                    <input
                      id="apply-phone"
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="10-digit mobile number"
                      className="w-full min-h-[44px] pl-10 pr-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:border-[#063B7A] focus:outline-none focus:ring-2 focus:ring-[#063B7A]/15"
                    />
                  </div>
                </div>

                {/* 3. Email */}
                <div>
                  <label
                    htmlFor="apply-email"
                    className="block text-xs font-semibold text-[#063B7A] mb-1.5"
                  >
                    Email *
                  </label>
                  <div className="relative flex items-center">
                    <Mail
                      className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none"
                      aria-hidden="true"
                    />
                    <input
                      id="apply-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full min-h-[44px] pl-10 pr-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:border-[#063B7A] focus:outline-none focus:ring-2 focus:ring-[#063B7A]/15"
                    />
                  </div>
                </div>
              </div>

              {/* 4. Qualification / Experience */}
              <div>
                <label
                  htmlFor="apply-qual-exp"
                  className="block text-xs font-semibold text-[#063B7A] mb-1.5"
                >
                  Qualification / Experience *
                </label>
                <div className="relative flex items-center">
                  <GraduationCap
                    className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    id="apply-qual-exp"
                    type="text"
                    required
                    value={qualificationExperience}
                    onChange={(e) => setQualificationExperience(e.target.value)}
                    placeholder="e.g. B.Pharm / 4 Years in Pharma Sales"
                    className="w-full min-h-[44px] pl-10 pr-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:border-[#063B7A] focus:outline-none focus:ring-2 focus:ring-[#063B7A]/15"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* City */}
                <div>
                  <label
                    htmlFor="apply-city"
                    className="block text-xs font-semibold text-[#063B7A] mb-1.5"
                  >
                    City / Current Location *
                  </label>
                  <div className="relative flex items-center">
                    <MapPin
                      className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none"
                      aria-hidden="true"
                    />
                    <input
                      id="apply-city"
                      type="text"
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="e.g. Jaipur, Mumbai, Delhi"
                      className="w-full min-h-[44px] pl-10 pr-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:border-[#063B7A] focus:outline-none focus:ring-2 focus:ring-[#063B7A]/15"
                    />
                  </div>
                </div>

                {/* Post Applied */}
                <div>
                  <label
                    htmlFor="apply-post"
                    className="block text-xs font-semibold text-[#063B7A] mb-1.5"
                  >
                    Post Applied *
                  </label>
                  <div className="relative flex items-center">
                    <Briefcase
                      className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none"
                      aria-hidden="true"
                    />
                    <input
                      id="apply-post"
                      type="text"
                      required
                      readOnly={isJobApply}
                      value={postApplied}
                      onChange={(e) => setPostApplied(e.target.value)}
                      placeholder="e.g. Radiologist, Area Manager"
                      className={`w-full min-h-[44px] pl-10 pr-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:border-[#063B7A] focus:outline-none focus:ring-2 focus:ring-[#063B7A]/15 ${
                        isJobApply ? 'bg-slate-50 text-slate-700 font-medium' : ''
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Optional Summary */}
              <div>
                <label
                  htmlFor="apply-summary"
                  className="block text-xs font-semibold text-[#063B7A] mb-1.5"
                >
                  Brief Skills / Work Summary (Optional)
                </label>
                <textarea
                  id="apply-summary"
                  rows={2}
                  value={resumeSummary}
                  onChange={(e) => setResumeSummary(e.target.value)}
                  placeholder="Current company, notice period, or key achievements..."
                  className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:border-[#063B7A] focus:outline-none focus:ring-2 focus:ring-[#063B7A]/15 resize-none"
                />
              </div>

              {/* 5. Upload Resume / CV - PDF Only */}
              <div>
                <span className="block text-xs font-semibold text-[#063B7A] mb-1.5">
                  Upload Resume / CV - PDF Only (max 580 KB) *
                </span>

                {candidate?.resumeId && candidate?.resumeFileName && (
                  <div className="mb-2.5">
                    <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50/70 cursor-pointer">
                      <input
                        type="radio"
                        name="resumeChoice"
                        checked={useProfileResume}
                        onChange={() => {
                          setUseProfileResume(true);
                          setCustomResume(null);
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                        className="accent-[#063B7A]"
                      />
                      <FileText
                        className="w-4 h-4 text-[#0A8E43] shrink-0"
                        aria-hidden="true"
                      />
                      <span className="text-sm text-slate-800 truncate">
                        Use saved PDF: <strong>{candidate.resumeFileName}</strong>
                      </span>
                    </label>
                  </div>
                )}

                <label
                  htmlFor="apply-resume-pdf"
                  className="flex items-center justify-center gap-2 min-h-[48px] px-4 py-2.5 border border-dashed border-slate-300 hover:border-[#063B7A] rounded-xl bg-slate-50/50 hover:bg-white transition-colors cursor-pointer text-sm"
                >
                  <Upload
                    className="w-4 h-4 text-[#F58220] shrink-0"
                    aria-hidden="true"
                  />
                  <span className="font-semibold text-[#063B7A] truncate">
                    {customResume
                      ? `Selected: ${customResume.fileName}`
                      : candidate?.resumeFileName
                        ? 'Or upload a different Resume / CV (PDF Only)'
                        : 'Select Resume / CV PDF (.pdf only)'}
                  </span>
                </label>
                <input
                  ref={fileInputRef}
                  id="apply-resume-pdf"
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handleFileChange}
                  className="sr-only"
                />
              </div>

              {/* 6. Terms & Conditions Popup Preview + Full Page Link + Mandatory Checkbox */}
              <div className="p-3.5 sm:p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <ShieldCheck
                      className="w-4 h-4 text-[#0A8E43] shrink-0"
                      aria-hidden="true"
                    />
                    <span className="text-xs font-bold text-[#063B7A] truncate">
                      {VCS_TERMS_DOCUMENT.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowTermsDetails((prev) => !prev)}
                      className="font-semibold text-[#063B7A] hover:text-[#D96B0C] underline cursor-pointer"
                    >
                      {showTermsDetails ? 'Hide Terms' : 'Show Terms'}
                    </button>

                    <a
                      href="#job-seeker-terms"
                      onClick={(e) => {
                        if (onViewFullTerms) {
                          e.preventDefault();
                          onViewFullTerms();
                        }
                      }}
                      className="inline-flex items-center gap-1 font-semibold text-[#0A8E43] hover:text-[#087537] underline"
                    >
                      <span>Full Page</span>
                      <ExternalLink className="w-3 h-3" aria-hidden="true" />
                    </a>
                  </div>
                </div>

                {showTermsDetails && (
                  <div className="p-3 rounded-lg bg-white border border-slate-200 text-xs text-slate-700 space-y-2 leading-relaxed max-h-48 overflow-y-auto">
                    <div className="pb-2 border-b border-slate-100">
                      <p className="font-bold text-[#063B7A]">
                        {VCS_TERMS_DOCUMENT.organization}
                      </p>
                      <p className="text-[11px] font-semibold text-[#0A8E43]">
                        {VCS_TERMS_DOCUMENT.email}
                      </p>
                      <p className="mt-1 text-[11px] font-medium text-slate-600">
                        {VCS_TERMS_DOCUMENT.applicability}
                      </p>
                      <p className="mt-1 font-semibold text-slate-800">
                        {VCS_TERMS_DOCUMENT.intro}
                      </p>
                    </div>

                    {VCS_TERMS_DOCUMENT.items.map((item) => (
                      <p key={item.number}>
                        <strong className="text-[#063B7A]">
                          {item.number}. {item.title}:
                        </strong>{' '}
                        {item.body}
                      </p>
                    ))}

                    <p className="pt-2 border-t border-slate-100 font-semibold text-slate-800">
                      <strong className="text-[#063B7A]">
                        {VCS_TERMS_DOCUMENT.declarationLabel}
                      </strong>{' '}
                      {VCS_TERMS_DOCUMENT.declarationText}
                    </p>
                  </div>
                )}

                <label className="flex items-start gap-2.5 pt-1 cursor-pointer select-none">
                  <input
                    id="apply-terms-checkbox"
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-slate-300 accent-[#0A8E43] cursor-pointer shrink-0"
                  />
                  <span className="text-xs font-semibold text-[#063B7A] leading-relaxed">
                    {VCS_TERMS_DOCUMENT.checkboxText} *
                  </span>
                </label>
              </div>

              {error && (
                <p
                  className="text-xs sm:text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5"
                  role="alert"
                >
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
                  className="min-h-[46px] px-6 py-2.5 rounded-xl bg-[#0A8E43] hover:bg-[#087537] disabled:opacity-60 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
                >
                  <Send className="w-4 h-4" aria-hidden="true" />
                  <span>
                    {isSubmitting
                      ? 'Submitting...'
                      : isJobApply
                        ? 'Submit Application'
                        : 'Submit Resume'}
                  </span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

