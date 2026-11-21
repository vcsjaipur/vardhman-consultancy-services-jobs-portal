import { ChangeEvent, DragEvent, FormEvent, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  FileText,
  Lock,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Upload,
  User,
  X,
} from 'lucide-react';
import { signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { CandidateProfile, JobListing, UserRole } from '../types/portal';
import {
  ApiRequestError,
  loginWithGoogleToken,
  normalizeEmailInput,
  normalizeMobileInput,
  readResumeFileAsBase64,
  registerCandidate,
  setStoredToken,
} from '../utils/candidateApi';
import {
  clearFormDraft,
  loadFormDraft,
  saveFormDraft,
} from '../utils/formDraftStorage';
import { createJobInFirestore, syncUserProfileToFirestore } from '../utils/firestorePortal';
import { toFriendlyPortalError } from '../utils/jobHelpers';
import {
  MAX_SHARED_RESUME_BASE64_CHARS,
  submitCompanyRequirementToSharedPortal,
  syncResumeProfileToSharedCandidates,
} from '../utils/sharedPortalFirestore';

const REGISTER_DRAFT_KEY = 'vcs_draft_register_v1';

interface RegisterPageProps {
  defaultRole?: UserRole;
  pendingJobTitle?: string | null;
  onSuccess: (candidate: CandidateProfile, initialJob?: JobListing | null) => void;
  onBrowseJobs?: (candidate: CandidateProfile) => void;
  onGoToLogin: () => void;
  onBackHome: () => void;
}

const CANDIDATE_EXPERIENCE_OPTIONS = [
  'Fresher',
  '0-1',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  '11',
  '12',
  '13',
  '14',
  '15',
  '16',
  '17',
  '18',
  '19',
  '20',
  '21',
  '22',
  '23',
  '24',
  '25',
  '26',
  '27',
  '28',
  '29',
  '30',
  '30+',
];

function evaluatePasswordStrength(pwd: string): {
  score: number;
  label: string;
  barClass: string;
  textClass: string;
} {
  if (!pwd) {
    return {
      score: 0,
      label: 'Enter password',
      barClass: 'bg-slate-200',
      textClass: 'text-slate-400',
    };
  }
  let score = 0;
  if (pwd.length >= 6) score += 1;
  if (pwd.length >= 8) score += 1;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score += 1;
  if (/\d/.test(pwd) || /[^A-Za-z0-9]/.test(pwd)) score += 1;

  if (pwd.length < 6 || score <= 1) {
    return { score: 1, label: 'Weak', barClass: 'bg-red-500', textClass: 'text-red-600' };
  }
  if (score === 2) {
    return { score: 2, label: 'Fair', barClass: 'bg-[#F58220]', textClass: 'text-[#D96B0C]' };
  }
  if (score === 3) {
    return { score: 3, label: 'Good', barClass: 'bg-[#063B7A]', textClass: 'text-[#063B7A]' };
  }
  return { score: 4, label: 'Strong', barClass: 'bg-[#0A8E43]', textClass: 'text-[#0A8E43]' };
}

export function RegisterPage({
  defaultRole = 'candidate',
  pendingJobTitle,
  onSuccess,
  onBrowseJobs,
  onGoToLogin,
  onBackHome,
}: RegisterPageProps) {
  const [role, setRole] = useState<UserRole>(defaultRole);
  const [createdUser, setCreatedUser] = useState<CandidateProfile | null>(null);

  const initialDraft = loadFormDraft<{
    fullName: string;
    email: string;
    phone: string;
    city: string;
    experience: string;
    companyName: string;
    fullAddress: string;
    currentRequirements: string;
  }>(REGISTER_DRAFT_KEY);

  // Common Account Fields
  const [fullName, setFullName] = useState(initialDraft?.fullName || '');
  const [email, setEmail] = useState(initialDraft?.email || '');
  const [phone, setPhone] = useState(initialDraft?.phone || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [city, setCity] = useState(initialDraft?.city || '');
  const [experience, setExperience] = useState(initialDraft?.experience || 'Fresher');

  // Job Seeker Resume & Terms
  const [termsAccepted, setTermsAccepted] = useState(true);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [resumeFile, setResumeFile] = useState<{
    fileName: string;
    base64: string;
    sizeBytes: number;
  } | null>(null);
  const resumeInputRef = useRef<HTMLInputElement | null>(null);

  // Employer Fields
  const [companyName, setCompanyName] = useState(initialDraft?.companyName || '');
  const [fullAddress, setFullAddress] = useState(initialDraft?.fullAddress || '');
  const [currentRequirements, setCurrentRequirements] = useState(
    initialDraft?.currentRequirements || ''
  );
  const [jdFile, setJdFile] = useState<{
    fileName: string;
    base64: string;
    sizeBytes: number;
  } | null>(null);
  const jdInputRef = useRef<HTMLInputElement | null>(null);

  // Feedback States
  const [submitError, setSubmitError] = useState('');
  const [alreadyRegisteredNotice, setAlreadyRegisteredNotice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setRole(defaultRole);
  }, [defaultRole]);

  useEffect(() => {
    if (createdUser) return;
    saveFormDraft(REGISTER_DRAFT_KEY, {
      fullName,
      email,
      phone,
      city,
      experience,
      companyName,
      fullAddress,
      currentRequirements,
    });
  }, [
    createdUser,
    fullName,
    email,
    phone,
    city,
    experience,
    companyName,
    fullAddress,
    currentRequirements,
  ]);

  const passwordStrength = evaluatePasswordStrength(password);

  const handleGoogleContinue = async () => {
    setSubmitError('');
    setAlreadyRegisteredNotice('');
    setIsSubmitting(true);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const idToken = await cred.user.getIdToken();
      const { candidate } = await loginWithGoogleToken(idToken, role);
      if (role === 'admin' && candidate.role !== 'admin') {
        setStoredToken(null);
        await signOut(auth).catch(() => {});
        setSubmitError('Access Denied: Authorized Admin accounts only.');
        return;
      }
      if (role === 'employer' && candidate.role !== 'employer') {
        setStoredToken(null);
        await signOut(auth).catch(() => {});
        setSubmitError('This account is registered as a Candidate. Please use Candidate Login.');
        return;
      }
      if (role === 'candidate' && candidate.role !== 'candidate') {
        setStoredToken(null);
        await signOut(auth).catch(() => {});
        setSubmitError('Please use your authorized login portal for this account.');
        return;
      }
      void syncUserProfileToFirestore(candidate).catch(() => {});
      if (candidate.role === 'candidate') {
        void syncResumeProfileToSharedCandidates({
          name: candidate.name,
          email: candidate.email,
          phone: candidate.phone || 'Not provided',
          city: candidate.city || 'India',
          postApplied: candidate.preferredRole || candidate.designation || 'Job Seeker',
          experience: candidate.experience,
          qualification: candidate.qualification,
          skills: candidate.keySkills,
          resumeFileName: candidate.resumeFileName || 'google_profile.pdf',
          resumeBase64: '',
        }).catch(() => null);
      }
      clearFormDraft(REGISTER_DRAFT_KEY);
      onSuccess(candidate);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.toLowerCase().includes('popup-closed-by-user')) {
        setSubmitError('Sign-in was cancelled. Please try again.');
      } else {
        setSubmitError(toFriendlyPortalError(err, 'Something went wrong, please try again.'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const processCandidateResumeFile = async (file: File) => {
    setSubmitError('');
    try {
      const parsed = await readResumeFileAsBase64(file);
      setResumeFile(parsed);
    } catch (err) {
      setResumeFile(null);
      if (resumeInputRef.current) resumeInputRef.current.value = '';
      setSubmitError(
        err instanceof Error
          ? err.message
          : 'Invalid file. Only PDF, DOC, and DOCX files up to 10 MB are accepted.'
      );
    }
  };

  const handleResumeFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processCandidateResumeFile(file);
  };

  const handleDropResume = async (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await processCandidateResumeFile(file);
    }
  };

  const handleJdFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSubmitError('');
    try {
      const parsed = await readResumeFileAsBase64(file);
      setJdFile(parsed);
    } catch (err) {
      setJdFile(null);
      if (jdInputRef.current) jdInputRef.current.value = '';
      setSubmitError(
        err instanceof Error
          ? err.message
          : 'Invalid JD file. Only PDF, DOC, and DOCX files up to 10 MB are accepted.'
      );
    }
  };

  const handleCandidateSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    setAlreadyRegisteredNotice('');

    const cleanName = fullName.trim();
    const cleanPhone = normalizeMobileInput(phone);
    const cleanEmail = normalizeEmailInput(email);

    if (cleanName.length < 2) {
      setSubmitError('Please enter your Full Name.');
      return;
    }
    if (cleanPhone.length !== 10) {
      setSubmitError('Please enter a valid 10-digit Mobile Number.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setSubmitError('Please enter a valid Email ID.');
      return;
    }
    if (password.length < 6) {
      setSubmitError('Password must be at least 6 characters long.');
      return;
    }
    if (pin.trim() && !/^\d{4}$/.test(pin.trim())) {
      setSubmitError('Quick Login PIN must be 4 numeric digits (or leave blank).');
      return;
    }
    if (!resumeFile) {
      setSubmitError('Please upload your Resume (PDF, DOC, or DOCX) to complete registration.');
      return;
    }
    if (!termsAccepted) {
      setSubmitError('Please accept Terms & Conditions to continue.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { candidate } = await registerCandidate({
        role: 'candidate',
        name: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        password,
        pin: pin.trim() || undefined,
        city: city.trim() || 'India',
        experience: experience || 'Fresher',
        resumeFileName: resumeFile.fileName,
        resumeBase64: resumeFile.base64,
        termsAccepted: true,
      });
      void syncResumeProfileToSharedCandidates({
        name: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        city: city.trim() || 'India',
        postApplied: 'Job Seeker',
        experience: experience || 'Fresher',
        resumeFileName: resumeFile.fileName,
        resumeBase64:
          resumeFile.base64.length <= MAX_SHARED_RESUME_BASE64_CHARS
            ? resumeFile.base64
            : '',
      }).catch(() => null);
      clearFormDraft(REGISTER_DRAFT_KEY);
      setCreatedUser(candidate);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      if (
        err instanceof ApiRequestError &&
        (err.status === 409 || err.code === 'ALREADY_REGISTERED')
      ) {
        setAlreadyRegisteredNotice(
          toFriendlyPortalError(
            err,
            'You are already registered with this mobile number or email.'
          )
        );
      } else {
        setSubmitError(toFriendlyPortalError(err, 'Something went wrong, please try again.'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmployerOrAdminSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    setAlreadyRegisteredNotice('');

    const cleanEmail = normalizeEmailInput(email);
    const cleanPhone = normalizeMobileInput(phone);

    if (role === 'employer') {
      if (!companyName.trim()) {
        setSubmitError('Company Name is required.');
        return;
      }
      if (!fullAddress.trim()) {
        setSubmitError('Full Address is required.');
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        setSubmitError('Please enter a valid Official Email ID.');
        return;
      }
      if (!fullName.trim()) {
        setSubmitError('Contact Person Name is required.');
        return;
      }
      if (password.length < 6) {
        setSubmitError('Password must be at least 6 characters long.');
        return;
      }
      if (pin.trim() && !/^\d{4}$/.test(pin.trim())) {
        setSubmitError('Quick Login PIN must be 4 numeric digits (or leave blank).');
        return;
      }
    } else {
      if (!fullName.trim()) {
        setSubmitError('Please enter your full name.');
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        setSubmitError('Please enter a valid email address.');
        return;
      }
      if (cleanPhone.length !== 10) {
        setSubmitError('Please enter a valid 10-digit mobile number.');
        return;
      }
      if (password.length < 6) {
        setSubmitError('Password must be at least 6 characters long.');
        return;
      }
      if (!/^\d{4}$/.test(pin.trim())) {
        setSubmitError('Please create a 4-digit numeric PIN for quick login.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const { candidate, initialJob } = await registerCandidate({
        role,
        name: fullName.trim(),
        email: cleanEmail,
        phone: role === 'admin' ? cleanPhone : undefined,
        password,
        pin: pin.trim() || undefined,
        city: city.trim() || undefined,
        companyName: role === 'employer' ? companyName.trim() : undefined,
        fullAddress: role === 'employer' ? fullAddress.trim() : undefined,
        currentRequirements:
          role === 'employer' && currentRequirements.trim()
            ? currentRequirements.trim()
            : undefined,
        jdFileName: role === 'employer' && jdFile ? jdFile.fileName : undefined,
        jdBase64: role === 'employer' && jdFile ? jdFile.base64 : undefined,
      });

      let syncedInitialJob = initialJob || null;
      if (initialJob && auth.currentUser?.emailVerified) {
        try {
          syncedInitialJob = await createJobInFirestore({
            jobId: initialJob.id,
            company: initialJob.company,
            recruiterName: initialJob.recruiterName || fullName.trim(),
            recruiterEmail: initialJob.recruiterEmail || cleanEmail,
            recruiterPhone: initialJob.recruiterPhone || '',
            title: initialJob.title,
            designation: initialJob.designation,
            location: initialJob.location,
            experience: initialJob.experience,
            salary: initialJob.salary,
            jobType: initialJob.jobType || 'Full-Time',
            skills: initialJob.skills,
            description: initialJob.description,
            qualification: initialJob.qualification || 'As per JD',
            openings: initialJob.openings,
            lastDateToApply: initialJob.lastDateToApply || 'Open Until Filled',
          });
        } catch {
          // Retain server job entry when Cloud verification is deferred
        }
      }

      if (role === 'employer' && (currentRequirements.trim() || jdFile || initialJob)) {
        const jdBody = [
          currentRequirements.trim() || initialJob?.description || '',
          jdFile ? `Attached JD File: ${jdFile.fileName}` : '',
          `Official Email: ${cleanEmail}`,
          `Address: ${fullAddress.trim()}`,
        ]
          .filter(Boolean)
          .join('\n\n');

        void submitCompanyRequirementToSharedPortal({
          companyName: companyName.trim(),
          contactPerson: fullName.trim(),
          phone: cleanPhone || cleanEmail,
          city: city.trim() || fullAddress.trim() || 'Pan India',
          postRequired:
            initialJob?.title || `${companyName.trim()} Hiring Requirement`,
          salary: initialJob?.salary || 'Negotiable',
          vacancyCount: initialJob?.openings || 1,
          jobDescription: jdBody,
        }).catch(() => null);
      }

      clearFormDraft(REGISTER_DRAFT_KEY);
      onSuccess(candidate, syncedInitialJob);
    } catch (err) {
      if (
        err instanceof ApiRequestError &&
        (err.status === 409 || err.code === 'ALREADY_REGISTERED')
      ) {
        setAlreadyRegisteredNotice(
          toFriendlyPortalError(
            err,
            'You are already registered with this mobile number or email.'
          )
        );
      } else {
        setSubmitError(toFriendlyPortalError(err, 'Something went wrong, please try again.'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (createdUser) {
    return (
      <div className="bg-white min-h-[calc(100vh-5rem)] border-b border-slate-200">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-lg overflow-hidden text-center">
            <div className="bg-[#063B7A] px-6 py-5 text-white">
              <p className="text-xs sm:text-sm font-bold text-[#F58220]">
                Vardhman Consultancy Services · Est. 2012
              </p>
              <p className="mt-1 text-xs text-slate-200">
                info@vardhmanconsultancy.com | Mobile &amp; WhatsApp: 7877250630
              </p>
            </div>

            <div className="p-6 sm:p-10 space-y-6">
              <div className="w-16 h-16 mx-auto rounded-full bg-[#0A8E43]/12 border-2 border-[#0A8E43] text-[#0A8E43] flex items-center justify-center">
                <CheckCircle2 className="w-9 h-9" aria-hidden="true" />
              </div>

              <div>
                <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#063B7A]">
                  Welcome! Your Candidate Account Is Ready.
                </h1>
                <p className="mt-2 text-sm sm:text-base text-slate-600">
                  Thank you, <span className="font-semibold text-slate-900">{createdUser.name}</span>. Your profile and resume ({createdUser.resumeFileName}) are saved on the portal. You can edit complete career details anytime from your Dashboard.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => onSuccess(createdUser)}
                  className="w-full sm:w-auto min-h-[48px] px-7 py-3 rounded-xl bg-[#0A8E43] hover:bg-[#087537] text-white text-sm font-bold shadow-sm transition-colors cursor-pointer"
                >
                  Go To Dashboard
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (onBrowseJobs) {
                      onBrowseJobs(createdUser);
                    } else {
                      onSuccess(createdUser);
                    }
                  }}
                  className="w-full sm:w-auto min-h-[48px] px-7 py-3 rounded-xl bg-[#063B7A] hover:bg-[#042A58] text-white text-sm font-bold shadow-sm transition-colors cursor-pointer"
                >
                  Search Jobs
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 min-h-[calc(100vh-5rem)] border-b border-slate-200">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <button
          type="button"
          onClick={onBackHome}
          className="inline-flex items-center gap-2 min-h-[44px] px-3.5 py-2 rounded-xl bg-white border border-slate-200 shadow-xs text-sm font-semibold text-[#063B7A] hover:text-[#0A8E43] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>Back to Home</span>
        </button>

        <div className="mt-5 bg-white border border-slate-200 rounded-2xl shadow-lg overflow-hidden">
          <div className="bg-[#063B7A] px-5 sm:px-8 py-6 text-white">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <p className="text-xs sm:text-sm font-bold text-[#F58220]">
                {role === 'employer'
                  ? 'Vardhman Consultancy Services · Employer Portal'
                  : role === 'admin'
                    ? 'Vardhman Consultancy Services · Authorized Owner Portal'
                    : 'Join 100% FREE — Our Services Is 100% FREE'}
              </p>
              <p className="text-xs text-slate-200 whitespace-nowrap">
                info@vardhmanconsultancy.com | Mobile &amp; WhatsApp: 7877250630
              </p>
            </div>

            <h1 className="mt-1.5 font-display text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {role === 'employer'
                ? 'Employer Registration'
                : role === 'admin'
                  ? 'Admin Registration'
                  : 'Job Seeker Registration'}
            </h1>
            <p className="mt-1.5 text-sm text-slate-200 leading-relaxed">
              {pendingJobTitle
                ? `Register with your Resume to apply for "${pendingJobTitle}" and track your applications.`
                : role === 'employer'
                  ? 'Register your company and submit your current hiring requirements or JD directly to our recruitment desk.'
                  : role === 'admin'
                    ? 'Authorized Owner Only — Register an administrator account.'
                    : 'Create your account with Name, Mobile Number, Email ID, and Resume in seconds.'}
            </p>
          </div>

          <div className="p-5 sm:p-8">
            <div className="mb-6">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleGoogleContinue}
                className="w-full min-h-[46px] px-5 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-sm font-semibold inline-flex items-center justify-center gap-2.5 shadow-xs transition-colors cursor-pointer disabled:opacity-60"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>
              <div className="relative flex py-3 items-center">
                <div className="flex-grow border-t border-slate-200" />
                <span className="shrink mx-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Or Fill Registration Form
                </span>
                <div className="flex-grow border-t border-slate-200" />
              </div>
            </div>

            {role !== 'candidate' ? (
              /* EMPLOYER & ADMIN REGISTRATION */
              <form onSubmit={handleEmployerOrAdminSubmit} className="space-y-4" noValidate>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {role === 'employer' && (
                    <div className="sm:col-span-2">
                      <label
                        htmlFor="reg-emp-company"
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
                          id="reg-emp-company"
                          type="text"
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          placeholder="Enter company or organization name"
                          className="w-full min-h-[46px] pl-10 pr-3.5 py-2.5 text-sm text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#063B7A] focus:outline-none"
                        />
                      </div>
                    </div>
                  )}

                  {role === 'employer' && (
                    <div className="sm:col-span-2">
                      <label
                        htmlFor="reg-emp-address"
                        className="block text-xs font-semibold text-[#063B7A] mb-1.5"
                      >
                        Full Address *
                      </label>
                      <div className="relative">
                        <MapPin
                          className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none"
                          aria-hidden="true"
                        />
                        <textarea
                          id="reg-emp-address"
                          rows={2}
                          value={fullAddress}
                          onChange={(e) => setFullAddress(e.target.value)}
                          placeholder="Enter complete office address with city, state, and PIN code"
                          className="w-full pl-10 pr-3.5 py-2.5 text-sm text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#063B7A] focus:outline-none"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label
                      htmlFor="reg-ea-email"
                      className="block text-xs font-semibold text-[#063B7A] mb-1.5"
                    >
                      {role === 'employer' ? 'Email ID (Official) *' : 'Email Address *'}
                    </label>
                    <div className="relative flex items-center">
                      <Mail
                        className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none"
                        aria-hidden="true"
                      />
                      <input
                        id="reg-ea-email"
                        type="email"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          setAlreadyRegisteredNotice('');
                        }}
                        placeholder="hr@company.com"
                        className="w-full min-h-[46px] pl-10 pr-3.5 py-2.5 text-sm text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#063B7A] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="reg-ea-name"
                      className="block text-xs font-semibold text-[#063B7A] mb-1.5"
                    >
                      {role === 'employer' ? 'Contact Person Name *' : 'Full Name *'}
                    </label>
                    <div className="relative flex items-center">
                      <User
                        className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none"
                        aria-hidden="true"
                      />
                      <input
                        id="reg-ea-name"
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder={
                          role === 'employer' ? 'HR / Authorized contact person' : 'Enter full name'
                        }
                        className="w-full min-h-[46px] pl-10 pr-3.5 py-2.5 text-sm text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#063B7A] focus:outline-none"
                      />
                    </div>
                  </div>

                  {role === 'admin' && (
                    <div className="sm:col-span-2">
                      <label
                        htmlFor="reg-ea-phone"
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
                          id="reg-ea-phone"
                          type="tel"
                          maxLength={18}
                          value={phone}
                          onChange={(e) => {
                            setPhone(normalizeMobileInput(e.target.value));
                            setAlreadyRegisteredNotice('');
                          }}
                          placeholder="10-digit contact number"
                          className="w-full min-h-[46px] pl-10 pr-3.5 py-2.5 text-sm text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#063B7A] focus:outline-none tabular-nums"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label
                      htmlFor="reg-ea-password"
                      className="block text-xs font-semibold text-[#063B7A] mb-1.5"
                    >
                      Password (Min 6 chars) *
                    </label>
                    <div className="relative flex items-center">
                      <Lock
                        className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none"
                        aria-hidden="true"
                      />
                      <input
                        id="reg-ea-password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Create strong password"
                        className="w-full min-h-[46px] pl-10 pr-11 py-2.5 text-sm text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#063B7A] focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((p) => !p)}
                        className="absolute right-1 w-10 h-10 flex items-center justify-center text-slate-500 cursor-pointer"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="reg-ea-pin"
                      className="block text-xs font-semibold text-[#063B7A] mb-1.5"
                    >
                      {role === 'employer' ? '4-Digit Quick PIN (Optional)' : 'Create 4-Digit PIN *'}
                    </label>
                    <div className="relative flex items-center">
                      <input
                        id="reg-ea-pin"
                        type={showPin ? 'text' : 'password'}
                        inputMode="numeric"
                        maxLength={4}
                        value={pin}
                        onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        placeholder="4-digit numeric PIN"
                        className="w-full min-h-[46px] pl-3.5 pr-11 py-2.5 text-sm text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#063B7A] focus:outline-none tabular-nums"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPin((p) => !p)}
                        className="absolute right-1 w-10 h-10 flex items-center justify-center text-slate-500 cursor-pointer"
                        aria-label={showPin ? 'Hide PIN' : 'Show PIN'}
                      >
                        {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {role === 'employer' && (
                    <div className="sm:col-span-2">
                      <label
                        htmlFor="reg-emp-requirements"
                        className="block text-xs font-semibold text-[#063B7A] mb-1.5"
                      >
                        Current Requirements / Paste Job Description
                      </label>
                      <textarea
                        id="reg-emp-requirements"
                        rows={6}
                        value={currentRequirements}
                        onChange={(e) => setCurrentRequirements(e.target.value)}
                        placeholder="Paste your full job requirement here (Role, Experience, Location, Salary, Key Skills, Responsibilities). On submit, this job post comes directly to us."
                        className="w-full px-3.5 py-3 text-sm text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#063B7A] focus:outline-none"
                      />
                    </div>
                  )}

                  {role === 'employer' && (
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-[#063B7A] mb-1.5">
                        Attach JD (Attach Job Description) — .pdf, .doc, .docx
                      </label>

                      {jdFile ? (
                        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-[#0A8E43] bg-[#0A8E43]/8">
                          <div className="flex items-center gap-3 min-w-0">
                            <FileText className="w-5 h-5 text-[#0A8E43] shrink-0" aria-hidden="true" />
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-[#063B7A] truncate">
                                {jdFile.fileName}
                              </p>
                              <p className="text-xs text-slate-600 tabular-nums">
                                {(jdFile.sizeBytes / 1024).toFixed(0)} KB · Ready to send
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setJdFile(null);
                              if (jdInputRef.current) jdInputRef.current.value = '';
                            }}
                            className="p-2 rounded-lg text-slate-500 hover:text-red-600 hover:bg-white cursor-pointer"
                            aria-label="Remove attached JD"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-xl border border-dashed border-slate-300 bg-slate-50">
                          <button
                            type="button"
                            onClick={() => jdInputRef.current?.click()}
                            className="min-h-[40px] px-4 py-2 rounded-xl bg-white hover:bg-slate-100 border border-[#063B7A]/30 text-[#063B7A] text-xs font-semibold inline-flex items-center gap-2 shadow-xs cursor-pointer"
                          >
                            <Upload className="w-4 h-4 text-[#0A8E43]" aria-hidden="true" />
                            <span>Choose File</span>
                          </button>
                          <span className="text-xs text-slate-500">
                            Upload .pdf, .doc, or .docx Job Description (Max 10 MB)
                          </span>
                        </div>
                      )}

                      <input
                        ref={jdInputRef}
                        id="reg-emp-jd-upload"
                        type="file"
                        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        onChange={handleJdFileChange}
                        className="sr-only"
                      />
                    </div>
                  )}
                </div>

                {alreadyRegisteredNotice && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2.5">
                    <p className="text-xs sm:text-sm font-semibold text-slate-800">
                      {alreadyRegisteredNotice}
                    </p>
                    <button
                      type="button"
                      onClick={onGoToLogin}
                      className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl bg-[#0A8E43] hover:bg-[#087537] text-white text-sm font-semibold shadow-sm cursor-pointer"
                    >
                      Login Now - You are already registered
                    </button>
                  </div>
                )}

                {submitError && !alreadyRegisteredNotice && (
                  <p
                    className="text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3"
                    role="alert"
                  >
                    {submitError}
                  </p>
                )}

                <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full sm:w-auto min-h-[48px] px-7 py-3 rounded-xl bg-[#0A8E43] hover:bg-[#087537] disabled:opacity-60 text-white font-bold text-sm shadow-sm cursor-pointer transition-colors"
                  >
                    {isSubmitting
                      ? 'Creating Account...'
                      : role === 'employer'
                        ? 'Register Employer Account'
                        : 'Register Admin Account'}
                  </button>
                  <p className="text-sm text-slate-600">
                    Already registered?{' '}
                    <button
                      type="button"
                      onClick={onGoToLogin}
                      className="font-semibold text-[#063B7A] hover:text-[#0A8E43] underline cursor-pointer"
                    >
                      {role === 'employer' ? 'Employer Login' : 'Admin Login'}
                    </button>
                  </p>
                </div>
              </form>
            ) : (
              /* JOB SEEKER STREAMLINED WORLD-CLASS REGISTRATION */
              <form onSubmit={handleCandidateSubmit} className="space-y-5" noValidate>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Full Name */}
                  <div>
                    <label
                      htmlFor="cand-name"
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
                        id="cand-name"
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Enter your full name"
                        className="w-full min-h-[46px] pl-10 pr-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#0A8E43] focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Mobile Number */}
                  <div>
                    <label
                      htmlFor="cand-phone"
                      className="block text-xs font-semibold text-[#063B7A] mb-1.5"
                    >
                      Mobile Number (10-digit) *
                    </label>
                    <div className="relative flex items-center">
                      <Phone
                        className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none"
                        aria-hidden="true"
                      />
                      <input
                        id="cand-phone"
                        type="tel"
                        inputMode="numeric"
                        maxLength={18}
                        required
                        value={phone}
                        onChange={(e) => {
                          setPhone(normalizeMobileInput(e.target.value));
                          setAlreadyRegisteredNotice('');
                        }}
                        placeholder="10-digit mobile number"
                        className="w-full min-h-[46px] pl-10 pr-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#0A8E43] focus:outline-none tabular-nums"
                      />
                    </div>
                  </div>

                  {/* Email ID */}
                  <div>
                    <label
                      htmlFor="cand-email"
                      className="block text-xs font-semibold text-[#063B7A] mb-1.5"
                    >
                      Email ID *
                    </label>
                    <div className="relative flex items-center">
                      <Mail
                        className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none"
                        aria-hidden="true"
                      />
                      <input
                        id="cand-email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          setAlreadyRegisteredNotice('');
                        }}
                        placeholder="you@example.com"
                        className="w-full min-h-[46px] pl-10 pr-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#0A8E43] focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* City */}
                  <div>
                    <label
                      htmlFor="cand-city"
                      className="block text-xs font-semibold text-[#063B7A] mb-1.5"
                    >
                      Current City
                    </label>
                    <div className="relative flex items-center">
                      <MapPin
                        className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none"
                        aria-hidden="true"
                      />
                      <input
                        id="cand-city"
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="e.g. Jaipur, Delhi, Mumbai"
                        className="w-full min-h-[46px] pl-10 pr-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#0A8E43] focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Experience */}
                  <div>
                    <label
                      htmlFor="cand-exp"
                      className="block text-xs font-semibold text-[#063B7A] mb-1.5"
                    >
                      Total Experience
                    </label>
                    <select
                      id="cand-exp"
                      value={experience}
                      onChange={(e) => setExperience(e.target.value)}
                      className="w-full min-h-[46px] px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#0A8E43] focus:outline-none cursor-pointer"
                    >
                      {CANDIDATE_EXPERIENCE_OPTIONS.map((exp) => (
                        <option key={exp} value={exp}>
                          {exp === 'Fresher' ? 'Fresher (0 Years)' : `${exp} Years`}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Quick 4-digit PIN */}
                  <div>
                    <label
                      htmlFor="cand-pin"
                      className="block text-xs font-semibold text-[#063B7A] mb-1.5"
                    >
                      4-Digit Quick PIN (Optional)
                    </label>
                    <div className="relative flex items-center">
                      <input
                        id="cand-pin"
                        type={showPin ? 'text' : 'password'}
                        inputMode="numeric"
                        maxLength={4}
                        value={pin}
                        onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        placeholder="Optional 4-digit PIN"
                        className="w-full min-h-[46px] pl-3.5 pr-11 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#0A8E43] focus:outline-none tabular-nums"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPin((p) => !p)}
                        className="absolute right-1 w-10 h-10 flex items-center justify-center text-slate-500 cursor-pointer"
                        aria-label={showPin ? 'Hide PIN' : 'Show PIN'}
                      >
                        {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Password */}
                  <div className="sm:col-span-2">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <label
                        htmlFor="cand-password"
                        className="text-xs font-semibold text-[#063B7A]"
                      >
                        Create Password (Min 6 chars) *
                      </label>
                      {password && (
                        <span className={`text-[11px] font-bold ${passwordStrength.textClass}`}>
                          Strength: {passwordStrength.label}
                        </span>
                      )}
                    </div>
                    <div className="relative flex items-center">
                      <Lock
                        className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none"
                        aria-hidden="true"
                      />
                      <input
                        id="cand-password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Minimum 6 characters"
                        className="w-full min-h-[46px] pl-10 pr-11 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#0A8E43] focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((p) => !p)}
                        className="absolute right-1 w-10 h-10 flex items-center justify-center text-slate-500 cursor-pointer"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {password && (
                      <div className="mt-1.5 h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${passwordStrength.barClass}`}
                          style={{ width: `${(passwordStrength.score / 4) * 100}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Upload Resume */}
                <div>
                  <label className="block text-xs font-semibold text-[#063B7A] mb-1.5">
                    Upload Resume (PDF, DOC, DOCX — Max 10 MB) *
                  </label>

                  {resumeFile ? (
                    <div className="flex items-center justify-between gap-3 px-4 py-3.5 rounded-xl border border-[#0A8E43] bg-[#0A8E43]/8">
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText className="w-5 h-5 text-[#0A8E43] shrink-0" aria-hidden="true" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#063B7A] truncate">
                            {resumeFile.fileName}
                          </p>
                          <p className="text-xs text-slate-600 tabular-nums">
                            {(resumeFile.sizeBytes / 1024).toFixed(0)} KB · Ready to upload
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setResumeFile(null);
                          if (resumeInputRef.current) resumeInputRef.current.value = '';
                        }}
                        className="p-2 rounded-lg text-slate-500 hover:text-red-600 hover:bg-white cursor-pointer"
                        aria-label="Remove uploaded resume"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <label
                      htmlFor="cand-resume-upload"
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDraggingFile(true);
                      }}
                      onDragLeave={() => setIsDraggingFile(false)}
                      onDrop={handleDropResume}
                      className={`flex flex-col items-center justify-center gap-2 px-4 py-6 rounded-xl border-2 border-dashed text-center transition-colors cursor-pointer ${
                        isDraggingFile
                          ? 'border-[#0A8E43] bg-[#0A8E43]/8'
                          : 'border-slate-300 bg-slate-50 hover:border-[#0A8E43] hover:bg-white'
                      }`}
                    >
                      <Upload className="w-6 h-6 text-[#0A8E43]" aria-hidden="true" />
                      <span className="text-sm font-semibold text-[#063B7A]">
                        Click or Drag &amp; Drop Resume (PDF, DOC, DOCX)
                      </span>
                      <span className="text-xs text-slate-500">Maximum file size: 10 MB</span>
                    </label>
                  )}

                  <input
                    ref={resumeInputRef}
                    id="cand-resume-upload"
                    type="file"
                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={handleResumeFileChange}
                    className="sr-only"
                  />
                </div>

                {/* Inline Terms & 100% Free Commitment */}
                <label className="flex items-start gap-2.5 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-3.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-[#0A8E43] cursor-pointer"
                  />
                  <span>
                    I confirm all details provided are accurate and agree to the{' '}
                    <a
                      href="#job-seeker-terms"
                      onClick={(e) => e.stopPropagation()}
                      className="font-semibold text-[#063B7A] hover:text-[#0A8E43] underline"
                    >
                      Terms &amp; Conditions
                    </a>{' '}
                    of Vardhman Consultancy Services.{' '}
                    <strong className="text-[#0A8E43]">Our Services Is 100% FREE.</strong>
                  </span>
                </label>

                {alreadyRegisteredNotice && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2.5">
                    <p className="text-xs sm:text-sm font-semibold text-slate-800">
                      {alreadyRegisteredNotice}
                    </p>
                    <button
                      type="button"
                      onClick={onGoToLogin}
                      className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl bg-[#0A8E43] hover:bg-[#087537] text-white text-sm font-semibold shadow-sm cursor-pointer"
                    >
                      Login Now - You are already registered
                    </button>
                  </div>
                )}

                {submitError && !alreadyRegisteredNotice && (
                  <p
                    className="text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3"
                    role="alert"
                  >
                    {submitError}
                  </p>
                )}

                <div className="pt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full sm:w-auto min-h-[48px] px-7 py-3 rounded-xl bg-[#0A8E43] hover:bg-[#087537] disabled:opacity-60 text-white font-bold text-sm inline-flex items-center justify-center gap-2 shadow-sm cursor-pointer transition-colors"
                  >
                    <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                    <span>
                      {isSubmitting ? 'Creating Account...' : 'Register & Create Account'}
                    </span>
                  </button>

                  <p className="text-sm text-slate-600">
                    Already registered?{' '}
                    <button
                      type="button"
                      onClick={onGoToLogin}
                      className="font-semibold text-[#063B7A] hover:text-[#0A8E43] underline cursor-pointer"
                    >
                      Candidate Login
                    </button>
                  </p>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
