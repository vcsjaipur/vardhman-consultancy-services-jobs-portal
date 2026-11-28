import { ChangeEvent, FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react';
import {
  Award,
  BookOpen,
  Briefcase,
  Building2,
  Calendar,
  Camera,
  CheckCircle2,
  Download,
  FileText,
  GraduationCap,
  HeartHandshake,
  IndianRupee,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Plus,
  RotateCcw,
  Save,
  Search,
  Sparkles,
  Trash2,
  Upload,
  User,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import {
  AcademicEntry,
  CandidateProfile,
  JobApplication,
  JobListing,
  WorkExperienceEntry,
} from '../types/portal';
import {
  ApiRequestError,
  downloadResumePdf,
  generateAiResumeAssist,
  normalizeEmailInput,
  normalizeMobileInput,
  readImageFileAsBase64,
  readResumeFileAsBase64,
  setCachedCandidateProfile,
  updateCandidateProfile,
  uploadCandidatePhoto,
  uploadCandidateResume,
} from '../utils/candidateApi';
import { syncUserProfileToFirestore } from '../utils/firestorePortal';
import { toFriendlyPortalError } from '../utils/jobHelpers';
import {
  MAX_SHARED_RESUME_BASE64_CHARS,
  syncResumeProfileToSharedCandidates,
} from '../utils/sharedPortalFirestore';
import { CareerAutomationHub } from './CareerAutomationHub';
import { DashboardCardSkeleton } from './SkeletonLoaders';

const EXPERIENCE_OPTIONS = [
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

const NOTICE_PERIOD_OPTIONS = ['Immediate', '15 Days', '30 Days', '60 Days', '90 Days'];
const JOB_TYPE_OPTIONS = ['Full Time', 'Part Time', 'Work From Home'];
const MARITAL_STATUS_OPTIONS = ['Single', 'Married', 'Other'];

const INDIAN_STATES = [
  'Rajasthan',
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jammu & Kashmir',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Chandigarh',
];

const SUGGESTED_SKILLS = [
  'Tally Prime',
  'GST Filing',
  'MS Excel',
  'Sales & Marketing',
  'Communication',
  'HR Operations',
  'MIS Reporting',
  'Customer Support',
  'Inventory Management',
  'Pharma Production / QA',
  'Medical Representation',
  'Clinical Operations',
  'Data Entry',
];

function formatExperienceLabel(exp: string): string {
  if (!exp) return '';
  if (exp === 'Fresher') return 'Fresher';
  if (exp === '0-1') return '0-1 Year';
  if (exp === '1') return '1 Year';
  if (exp.toLowerCase().includes('year') || exp.toLowerCase().includes('fresher')) return exp;
  return `${exp} Years`;
}

function formatDate(isoString: string | null): string {
  if (!isoString) return 'Not uploaded';
  const parsed = new Date(isoString);
  if (Number.isNaN(parsed.getTime())) return isoString;
  return parsed.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function createEmptyAcademic(): AcademicEntry {
  return {
    id: `acad_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    degree: '',
    institution: '',
    specialization: '',
    yearOfPassing: '',
    percentageOrGrade: '',
  };
}

function createEmptyWork(): WorkExperienceEntry {
  return {
    id: `work_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    company: '',
    designation: '',
    fromDate: '',
    toDate: '',
    currentlyWorking: false,
    responsibilities: '',
  };
}

interface DashboardPageProps {
  candidate: CandidateProfile | null;
  applications: JobApplication[];
  approvedJobs?: JobListing[];
  isLoadingApplications: boolean;
  onCandidateUpdated: (candidate: CandidateProfile) => void;
  onApplicationsAdded?: (apps: JobApplication[]) => void;
  onOpenSkillTest?: (topic?: string) => void;
  onLogout: () => void;
  onGoToLogin: () => void;
  onGoToRegister: () => void;
  onGoToSearchJobs: () => void;
  onGoToBuildResume: () => void;
  onGoToCandidateProfile?: () => void;
  onSelectJob: (jobId: string) => void;
}

export function DashboardPage({
  candidate,
  applications,
  approvedJobs = [],
  isLoadingApplications,
  onCandidateUpdated,
  onApplicationsAdded,
  onOpenSkillTest,
  onLogout: _onLogout,
  onGoToLogin,
  onGoToRegister,
  onGoToSearchJobs,
  onGoToBuildResume,
  onGoToCandidateProfile: _onGoToCandidateProfile,
  onSelectJob,
}: DashboardPageProps) {
  const [resumeStatus, setResumeStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [resumeMessage, setResumeMessage] = useState('');
  const [downloadError, setDownloadError] = useState('');
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
  const [aiSummaryError, setAiSummaryError] = useState('');
  const resumeInputRef = useRef<HTMLInputElement | null>(null);

  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoMessage, setPhotoMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  // Personal Details
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [dob, setDob] = useState('');
  const [stateName, setStateName] = useState('Rajasthan');
  const [districtCity, setDistrictCity] = useState('');
  const [city, setCity] = useState('');
  const [pinCode, setPinCode] = useState('');

  // Family Details
  const [fatherName, setFatherName] = useState('');
  const [motherName, setMotherName] = useState('');
  const [maritalStatus, setMaritalStatus] = useState('');
  const [spouseName, setSpouseName] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');

  // Headline & Summaries
  const [resumeHeadline, setResumeHeadline] = useState('');
  const [profileSummary, setProfileSummary] = useState('');
  const [careerSummary, setCareerSummary] = useState('');
  const [resumeSummary, setResumeSummary] = useState('');

  // Professional Details
  const [qualification, setQualification] = useState('');
  const [currentCompany, setCurrentCompany] = useState('');
  const [designation, setDesignation] = useState('');
  const [experience, setExperience] = useState('Fresher');
  const [currentCtc, setCurrentCtc] = useState('');
  const [expectedSalary, setExpectedSalary] = useState('');
  const [noticePeriod, setNoticePeriod] = useState('');
  const [jobType, setJobType] = useState('Full Time');

  // Skills & Preferences
  const [preferredLocation, setPreferredLocation] = useState('');
  const [preferredRole, setPreferredRole] = useState('');
  const [keySkills, setKeySkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState('');

  // Academic Details List & Work Experience List
  const [academicDetails, setAcademicDetails] = useState<AcademicEntry[]>([]);
  const [workExperience, setWorkExperience] = useState<WorkExperienceEntry[]>([]);

  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const syncFromCandidate = (c: CandidateProfile) => {
    setName(c.name || '');
    setEmail(c.email || '');
    setPhone(c.phone || '');
    setDob(c.dob || '');
    setStateName(c.state || 'Rajasthan');
    setDistrictCity(c.districtCity || c.city || '');
    setCity(c.city || c.districtCity || '');
    setPinCode(c.pinCode || '');

    setFatherName(c.fatherName || '');
    setMotherName(c.motherName || '');
    setMaritalStatus(c.maritalStatus || '');
    setSpouseName(c.spouseName || '');
    setEmergencyContact(c.emergencyContact || '');

    setResumeHeadline(c.resumeHeadline || '');
    setProfileSummary(c.profileSummary || '');
    setCareerSummary(c.careerSummary || '');
    setResumeSummary(c.resumeSummary || '');

    setQualification(c.qualification || '');
    setCurrentCompany(c.currentCompany || '');
    setDesignation(c.designation || '');
    setExperience(c.experience || 'Fresher');
    setCurrentCtc(c.currentCtc || '');
    setExpectedSalary(c.expectedSalary || '');
    setNoticePeriod(c.noticePeriod || '');
    setJobType(c.jobType || 'Full Time');

    setPreferredLocation(c.preferredLocation || '');
    setPreferredRole(c.preferredRole || '');
    setKeySkills(Array.isArray(c.keySkills) ? c.keySkills : []);

    const existingAcademics = Array.isArray(c.academicDetails) ? c.academicDetails : [];
    if (existingAcademics.length > 0) {
      setAcademicDetails(existingAcademics);
    } else if (c.qualification) {
      setAcademicDetails([
        {
          id: `acad_init_${c.id}`,
          degree: c.qualification,
          institution: '',
          specialization: '',
          yearOfPassing: '',
          percentageOrGrade: '',
        },
      ]);
    } else {
      setAcademicDetails([]);
    }

    const existingWork = Array.isArray(c.workExperience) ? c.workExperience : [];
    if (existingWork.length > 0) {
      setWorkExperience(existingWork);
    } else if (c.currentCompany || c.designation) {
      setWorkExperience([
        {
          id: `work_init_${c.id}`,
          company: c.currentCompany || '',
          designation: c.designation || '',
          fromDate: '',
          toDate: c.currentCompany ? 'Present' : '',
          currentlyWorking: Boolean(c.currentCompany),
          responsibilities: '',
        },
      ]);
    } else {
      setWorkExperience([]);
    }
  };

  useEffect(() => {
    if (candidate) {
      syncFromCandidate(candidate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidate?.id]);

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
              <UserCheck className="w-7 h-7" aria-hidden="true" />
            </div>

            <h1 className="mt-5 font-display text-2xl font-extrabold text-[#063B7A]">
              Register or Login Required
            </h1>
            <p className="mt-2.5 text-sm sm:text-base text-slate-600 leading-relaxed">
              Please register as a candidate or log in to access your Dashboard, Complete Candidate Profile, Resume PDF, and My Applications.
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

  if (candidate.role === 'employer') {
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
              <UserCheck className="w-7 h-7" aria-hidden="true" />
            </div>

            <h1 className="mt-5 font-display text-2xl font-extrabold text-[#063B7A]">
              Candidate Dashboard Only
            </h1>
            <p className="mt-2.5 text-sm sm:text-base text-slate-600 leading-relaxed">
              This dashboard is exclusively for Job Seeker accounts. Please use your Employer Dashboard.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const handlePhotoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoUploading(true);
    setPhotoMessage(null);
    try {
      const parsed = await readImageFileAsBase64(file);
      const updated = await uploadCandidatePhoto({ photoBase64: parsed.base64 });
      onCandidateUpdated(updated);
      setPhotoMessage({ type: 'success', text: 'Profile photo updated successfully.' });
    } catch (err) {
      setPhotoMessage({
        type: 'error',
        text: toFriendlyPortalError(err, 'Failed to upload profile photo.'),
      });
    } finally {
      setPhotoUploading(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  const handleRemovePhoto = async () => {
    setPhotoUploading(true);
    setPhotoMessage(null);
    try {
      const updated = await uploadCandidatePhoto({ removePhoto: true });
      onCandidateUpdated(updated);
      setPhotoMessage({ type: 'success', text: 'Profile photo removed.' });
    } catch (err) {
      setPhotoMessage({
        type: 'error',
        text: toFriendlyPortalError(err, 'Could not remove photo.'),
      });
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleResumeUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResumeStatus('uploading');
    setResumeMessage('');

    try {
      const parsed = await readResumeFileAsBase64(file);
      let updatedCandidate: CandidateProfile;
      try {
        updatedCandidate = await uploadCandidateResume(parsed.fileName, parsed.base64);
      } catch (apiErr) {
        if (!(apiErr instanceof ApiRequestError && apiErr.code === 'BACKEND_UNAVAILABLE')) {
          throw apiErr;
        }
        updatedCandidate = {
          ...candidate,
          resumeId: candidate.resumeId || candidate.id,
          resumeFileName: parsed.fileName,
          resumeUpdatedAt: new Date().toISOString(),
        };
        setCachedCandidateProfile(updatedCandidate);
      }
      void syncResumeProfileToSharedCandidates({
        name: updatedCandidate.name || candidate.name,
        email: updatedCandidate.email || candidate.email,
        phone: updatedCandidate.phone || candidate.phone,
        city: updatedCandidate.city || candidate.city || 'India',
        state: updatedCandidate.state || candidate.state || undefined,
        postApplied:
          updatedCandidate.preferredRole ||
          updatedCandidate.designation ||
          candidate.designation ||
          candidate.preferredRole ||
          'Job Seeker',
        experience: updatedCandidate.experience || candidate.experience,
        qualification: updatedCandidate.qualification || candidate.qualification,
        currentCompany: updatedCandidate.currentCompany || candidate.currentCompany,
        designation: updatedCandidate.designation || candidate.designation,
        skills: updatedCandidate.keySkills || candidate.keySkills,
        resumeHeadline: updatedCandidate.resumeHeadline || candidate.resumeHeadline,
        resumeSummary: updatedCandidate.resumeSummary || candidate.resumeSummary,
        resumeFileName: parsed.fileName,
        resumeBase64:
          parsed.base64.length <= MAX_SHARED_RESUME_BASE64_CHARS
            ? parsed.base64
            : '',
      }).catch(() => null);
      void syncUserProfileToFirestore(updatedCandidate).catch(() => null);
      onCandidateUpdated(updatedCandidate);
      setResumeStatus('success');
      setResumeMessage(`Resume "${parsed.fileName}" updated successfully.`);
    } catch (err) {
      setResumeStatus('error');
      setResumeMessage(toFriendlyPortalError(err, 'Failed to upload resume file.'));
    } finally {
      if (resumeInputRef.current) resumeInputRef.current.value = '';
    }
  };

  const handleDownloadResume = async (resumeId: string, fileName: string) => {
    setDownloadError('');
    try {
      await downloadResumePdf(resumeId, fileName);
    } catch (err) {
      setDownloadError(toFriendlyPortalError(err, 'Download failed.'));
    }
  };

  const addSkillTag = (raw: string) => {
    const parts = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    setKeySkills((prev) => {
      const existingLower = new Set(prev.map((s) => s.toLowerCase()));
      const additions = parts.filter((s) => !existingLower.has(s.toLowerCase()));
      return [...prev, ...additions].slice(0, 30);
    });
    setSkillInput('');
  };

  const handleSkillKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addSkillTag(skillInput);
    }
  };

  const removeSkill = (skillToRemove: string) => {
    setKeySkills((prev) => prev.filter((s) => s !== skillToRemove));
  };

  const handleAddAcademic = () => {
    setAcademicDetails((prev) => [...prev, createEmptyAcademic()]);
  };

  const handleAcademicChange = (
    id: string,
    field: keyof AcademicEntry,
    value: string
  ) => {
    setAcademicDetails((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleRemoveAcademic = (id: string) => {
    setAcademicDetails((prev) => prev.filter((item) => item.id !== id));
  };

  const handleAddWork = () => {
    setWorkExperience((prev) => [...prev, createEmptyWork()]);
  };

  const handleWorkChange = (
    id: string,
    field: keyof WorkExperienceEntry,
    value: string | boolean
  ) => {
    setWorkExperience((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        if (field === 'currentlyWorking') {
          const checked = Boolean(value);
          return {
            ...item,
            currentlyWorking: checked,
            toDate: checked ? 'Present' : item.toDate === 'Present' ? '' : item.toDate,
          };
        }
        return { ...item, [field]: value };
      })
    );
  };

  const handleRemoveWork = (id: string) => {
    setWorkExperience((prev) => prev.filter((item) => item.id !== id));
  };

  const handleAiGenerateSummaries = async () => {
    setAiSummaryError('');
    setAiSummaryLoading(true);
    try {
      const aiRes = await generateAiResumeAssist({
        name: name || candidate?.name,
        role: preferredRole || designation || 'Candidate',
        experience,
        education: qualification,
        skills: keySkills.join(', '),
        city: city || districtCity,
      });
      if (aiRes.resumeHeadline) setResumeHeadline(aiRes.resumeHeadline);
      if (aiRes.profileSummary || aiRes.careerObjective) {
        setProfileSummary(aiRes.profileSummary || aiRes.careerObjective);
      }
      if (aiRes.careerSummary || aiRes.careerObjective) {
        setCareerSummary(aiRes.careerSummary || aiRes.careerObjective);
      }
      if (aiRes.resumeSummary || aiRes.careerObjective) {
        setResumeSummary(aiRes.resumeSummary || aiRes.careerObjective);
      }
      if (Array.isArray(aiRes.suggestedSkills) && aiRes.suggestedSkills.length > 0) {
        addSkillTag(aiRes.suggestedSkills.join(', '));
      }
    } catch (err) {
      setAiSummaryError(
        toFriendlyPortalError(err, 'Unable to generate AI summaries right now.')
      );
    } finally {
      setAiSummaryLoading(false);
    }
  };

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setProfileMessage(null);

    const cleanName = name.trim();
    const cleanEmail = normalizeEmailInput(email);
    const cleanPhone = normalizeMobileInput(phone);
    const cleanDistrict = districtCity.trim() || city.trim();
    const cleanCity = city.trim() || cleanDistrict;

    if (!cleanName) {
      setProfileMessage({ type: 'error', text: 'Full Name is required.' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setProfileMessage({ type: 'error', text: 'Please enter a valid Email address.' });
      return;
    }
    if (cleanPhone.length !== 10) {
      setProfileMessage({ type: 'error', text: 'Please enter a valid 10-digit Mobile number.' });
      return;
    }
    if (!cleanCity) {
      setProfileMessage({ type: 'error', text: 'City / District is required.' });
      return;
    }
    if (!experience) {
      setProfileMessage({ type: 'error', text: 'Please select your Total Experience.' });
      return;
    }

    setProfileSaving(true);
    try {
      let updated: CandidateProfile;
      try {
        updated = await updateCandidateProfile({
          name: cleanName,
          email: cleanEmail,
          phone: cleanPhone,
          city: cleanCity,
          districtCity: cleanDistrict,
          state: stateName.trim(),
          pinCode: pinCode.trim(),
          dob: dob.trim(),
          fatherName: fatherName.trim(),
          motherName: motherName.trim(),
          maritalStatus: maritalStatus.trim(),
          spouseName: spouseName.trim(),
          emergencyContact: emergencyContact.trim(),
          experience,
          qualification: qualification.trim(),
          currentCompany: currentCompany.trim(),
          designation: designation.trim(),
          currentCtc: currentCtc.trim(),
          expectedSalary: expectedSalary.trim(),
          noticePeriod: noticePeriod.trim(),
          jobType: jobType.trim(),
          preferredLocation: preferredLocation.trim(),
          preferredRole: preferredRole.trim(),
          resumeHeadline: resumeHeadline.trim(),
          profileSummary: profileSummary.trim(),
          careerSummary: careerSummary.trim(),
          resumeSummary: resumeSummary.trim(),
          keySkills,
          academicDetails,
          workExperience,
        });
      } catch (apiErr) {
        if (!(apiErr instanceof ApiRequestError && apiErr.code === 'BACKEND_UNAVAILABLE')) {
          throw apiErr;
        }
        updated = {
          ...candidate,
          name: cleanName,
          email: cleanEmail,
          phone: cleanPhone,
          city: cleanCity,
          districtCity: cleanDistrict,
          state: stateName.trim() || null,
          pinCode: pinCode.trim() || null,
          dob: dob.trim() || null,
          fatherName: fatherName.trim() || null,
          motherName: motherName.trim() || null,
          maritalStatus: maritalStatus.trim() || null,
          spouseName: spouseName.trim() || null,
          emergencyContact: emergencyContact.trim() || null,
          experience,
          qualification: qualification.trim() || null,
          currentCompany: currentCompany.trim() || null,
          designation: designation.trim() || null,
          currentCtc: currentCtc.trim() || null,
          expectedSalary: expectedSalary.trim() || null,
          noticePeriod: noticePeriod.trim() || null,
          jobType: jobType.trim() || null,
          preferredLocation: preferredLocation.trim() || null,
          preferredRole: preferredRole.trim() || null,
          resumeHeadline: resumeHeadline.trim() || null,
          profileSummary: profileSummary.trim() || null,
          careerSummary: careerSummary.trim() || null,
          resumeSummary: resumeSummary.trim() || null,
          keySkills,
          academicDetails,
          workExperience,
        };
        setCachedCandidateProfile(updated);
      }
      const workHistoryStrings = workExperience
        .filter((w) => w.company.trim() || w.designation.trim())
        .map((w) =>
          [
            w.designation.trim(),
            w.company.trim() ? `at ${w.company.trim()}` : '',
            w.fromDate || w.toDate ? `(${w.fromDate || '?'} - ${w.toDate || 'Present'})` : '',
          ]
            .filter(Boolean)
            .join(' ')
        );

      const academicText = academicDetails
        .filter((a) => a.degree.trim() || a.institution.trim())
        .map((a) =>
          [a.degree.trim(), a.specialization?.trim(), a.institution.trim(), a.yearOfPassing.trim()]
            .filter(Boolean)
            .join(', ')
        )
        .join(' | ');

      void syncResumeProfileToSharedCandidates({
        name: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        city: cleanCity,
        state: stateName.trim() || cleanCity,
        postApplied: preferredRole.trim() || designation.trim() || 'Job Seeker',
        experience,
        qualification: [qualification.trim(), academicText].filter(Boolean).join(' · ') || undefined,
        currentCompany: currentCompany.trim() || undefined,
        designation: designation.trim() || undefined,
        currentCtc: currentCtc.trim() || undefined,
        expectedSalary: expectedSalary.trim() || undefined,
        noticePeriod: noticePeriod.trim() || undefined,
        skills: keySkills,
        resumeHeadline: resumeHeadline.trim() || undefined,
        resumeSummary:
          resumeSummary.trim() ||
          careerSummary.trim() ||
          profileSummary.trim() ||
          undefined,
        workHistory: workHistoryStrings,
        resumeFileName: updated.resumeFileName || 'profile_resume.pdf',
        resumeBase64: '',
      }).catch(() => null);
      void syncUserProfileToFirestore(updated).catch(() => null);

      onCandidateUpdated(updated);
      syncFromCandidate(updated);
      setProfileMessage({
        type: 'success',
        text: 'Complete Candidate Profile saved successfully across all sections.',
      });
    } catch (err) {
      setProfileMessage({
        type: 'error',
        text: toFriendlyPortalError(err, 'Could not save complete profile.'),
      });
    } finally {
      setProfileSaving(false);
    }
  };

  const initials = (candidate.name || 'C')
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');

  const completeness =
    typeof candidate.profileCompleteness === 'number' ? candidate.profileCompleteness : 100;

  return (
    <div className="bg-slate-100/70 min-h-[calc(100vh-5rem)] border-b border-slate-200">
      <div className="grid grid-cols-3 h-1 w-full" aria-hidden="true">
        <div className="bg-[#063B7A]" />
        <div className="bg-[#F58220]" />
        <div className="bg-[#0A8E43]" />
      </div>

      {/* Candidate Gradient Summary Banner */}
      <section className="bg-gradient-to-br from-[#063B7A] via-[#053166] to-[#042147] text-white py-8 sm:py-11">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start sm:items-center gap-4 sm:gap-5">
              <div className="relative shrink-0">
                {candidate.photoUrl ? (
                  <img
                    src={candidate.photoUrl}
                    alt={`${candidate.name} profile`}
                    className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-white/80 shadow-lg bg-white"
                  />
                ) : (
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-[#F58220] to-[#D96B0C] text-white flex items-center justify-center font-display text-xl sm:text-2xl font-extrabold border-2 border-white/40 shadow-lg">
                    {initials}
                  </div>
                )}
              </div>

              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-semibold text-[#F58220]">
                  Candidate Dashboard · Complete A-to-Z Profile
                </p>
                <h1 className="mt-0.5 font-display text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  Welcome, {candidate.name}
                </h1>
                {(candidate.resumeHeadline || candidate.designation) && (
                  <p className="mt-1 text-xs sm:text-sm text-slate-200 font-medium">
                    {candidate.resumeHeadline ||
                      `${candidate.designation}${candidate.currentCompany ? ` at ${candidate.currentCompany}` : ''}`}
                  </p>
                )}

                <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs sm:text-sm text-slate-200">
                  <span className="inline-flex items-center gap-1.5">
                    <Mail className="w-4 h-4 text-[#F58220]" aria-hidden="true" />
                    <span>{candidate.email}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 tabular-nums">
                    <Phone className="w-4 h-4 text-[#F58220]" aria-hidden="true" />
                    <span>{candidate.phone}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-[#F58220]" aria-hidden="true" />
                    <span>
                      {candidate.city}
                      {candidate.state ? `, ${candidate.state}` : ''}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Briefcase className="w-4 h-4 text-[#F58220]" aria-hidden="true" />
                    <span>{formatExperienceLabel(candidate.experience)}</span>
                  </span>
                </div>

                <div className="mt-3 max-w-xs">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-200 mb-1">
                    <span>Profile Completeness</span>
                    <span className="text-[#F58220] tabular-nums">{completeness}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-white/15 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#F58220] to-[#0A8E43] transition-all duration-300"
                      style={{ width: `${completeness}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={onGoToSearchJobs}
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#F58220] to-[#D96B0C] hover:from-[#D96B0C] hover:to-[#BF5A06] text-white text-sm font-semibold inline-flex items-center gap-2 shadow-md transition-all whitespace-nowrap cursor-pointer"
              >
                <Search className="w-4 h-4" aria-hidden="true" />
                <span>Search Jobs</span>
              </button>
            </div>
          </div>

          {/* Elevated My Resume Card */}
          <div
            id="dashboard-resume-section"
            className="mt-7 bg-white text-slate-900 border border-white/20 rounded-2xl shadow-xl p-5 sm:p-6 space-y-4"
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5 min-w-0 flex-1">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#0A8E43] to-[#077235] text-white flex items-center justify-center shrink-0 shadow-sm">
                  <FileText className="w-6 h-6" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-display text-base sm:text-lg font-bold text-[#063B7A]">
                    My Resume
                  </h2>
                  {candidate.resumeFileName ? (
                    <p className="mt-1 text-sm text-slate-700 break-all whitespace-normal">
                      <span className="font-semibold">{candidate.resumeFileName}</span>{' '}
                      <span className="text-slate-500 text-xs whitespace-nowrap">
                        · Updated {formatDate(candidate.resumeUpdatedAt)}
                      </span>
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-slate-600">
                      No resume uploaded yet. Upload your resume (PDF, DOC, DOCX) to apply quickly.
                    </p>
                  )}

                  {resumeStatus === 'success' && resumeMessage && (
                    <p className="mt-2 text-xs font-semibold text-[#0A8E43] flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>{resumeMessage}</span>
                    </p>
                  )}
                  {resumeStatus === 'error' && resumeMessage && (
                    <p className="mt-2 text-xs font-medium text-red-600" role="alert">
                      {resumeMessage}
                    </p>
                  )}
                  {downloadError && (
                    <p className="mt-2 text-xs font-medium text-red-600" role="alert">
                      {downloadError}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <a
                  href="#dashboard-full-profile"
                  className="min-h-[44px] px-4 py-2 rounded-xl border border-[#063B7A]/30 hover:border-[#063B7A] text-[#063B7A] hover:bg-[#063B7A]/5 text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap"
                >
                  <User className="w-4 h-4" aria-hidden="true" />
                  <span>Full Profile Below</span>
                </a>

                <button
                  type="button"
                  onClick={onGoToBuildResume}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-[#0A8E43] hover:bg-[#087537] text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <FileText className="w-4 h-4" aria-hidden="true" />
                  <span>Build Resume</span>
                </button>

                {candidate.resumeId && candidate.resumeFileName && (
                  <button
                    type="button"
                    onClick={() =>
                      handleDownloadResume(candidate.resumeId!, candidate.resumeFileName!)
                    }
                    className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 hover:border-[#063B7A] text-[#063B7A] text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <Download className="w-4 h-4" aria-hidden="true" />
                    <span>Download Resume</span>
                  </button>
                )}

                <label
                  htmlFor="dashboard-resume-upload"
                  className="min-h-[44px] px-5 py-2 rounded-xl bg-[#063B7A] hover:bg-[#042A58] text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Upload className="w-4 h-4" aria-hidden="true" />
                  <span>
                    {resumeStatus === 'uploading'
                      ? 'Uploading...'
                      : candidate.resumeFileName
                        ? 'Replace Resume'
                        : 'Upload Resume'}
                  </span>
                </label>
                <input
                  ref={resumeInputRef}
                  id="dashboard-resume-upload"
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={handleResumeUpload}
                  className="sr-only"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <CareerAutomationHub
        candidate={candidate}
        approvedJobs={approvedJobs}
        applications={applications}
        onCandidateUpdated={onCandidateUpdated}
        onApplicationsAdded={onApplicationsAdded}
        onSelectJob={onSelectJob}
        onOpenSkillTest={(topic) => onOpenSkillTest?.(topic)}
      />

      {/* Complete A-to-Z Candidate Registration & Profile Form */}
      <section id="dashboard-full-profile" className="py-8 sm:py-12 border-b border-slate-200 bg-white/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <form onSubmit={handleSaveProfile} className="space-y-6">
            {/* Form Header Bar */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-[#F58220]">
                  100% Free Candidate Profile · Complete Registration Record
                </p>
                <h2 className="mt-1 font-display text-xl sm:text-2xl font-extrabold text-[#063B7A]">
                  My Complete Candidate Profile (A to Z)
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Every detail filled during Registration is available here. Edit or update any field anytime and save.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    syncFromCandidate(candidate);
                    setProfileMessage(null);
                  }}
                  className="min-h-[42px] px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" aria-hidden="true" />
                  <span>Reset</span>
                </button>
                <button
                  type="submit"
                  disabled={profileSaving}
                  className="min-h-[42px] px-5 py-2 rounded-xl bg-gradient-to-r from-[#0A8E43] to-[#077235] hover:from-[#087537] hover:to-[#065E2B] disabled:opacity-60 text-white text-sm font-semibold inline-flex items-center gap-2 shadow-sm cursor-pointer"
                >
                  <Save className="w-4 h-4" aria-hidden="true" />
                  <span>{profileSaving ? 'Saving Profile...' : 'Save Complete Profile'}</span>
                </button>
              </div>
            </div>

            {profileMessage && (
              <div
                className={`text-sm font-semibold px-4 py-3 rounded-xl flex items-center gap-2.5 ${
                  profileMessage.type === 'success'
                    ? 'bg-[#0A8E43]/10 text-[#0A8E43] border border-[#0A8E43]/30'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}
                role={profileMessage.type === 'error' ? 'alert' : 'status'}
              >
                {profileMessage.type === 'success' && <CheckCircle2 className="w-5 h-5 shrink-0" />}
                <span>{profileMessage.text}</span>
              </div>
            )}

            {/* 1. Profile Photo & Personal Details */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="bg-[#063B7A] px-5 sm:px-6 py-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2.5 text-white">
                  <User className="w-5 h-5 text-[#F58220]" aria-hidden="true" />
                  <h3 className="font-display text-base sm:text-lg font-bold">
                    1. Personal Details &amp; Profile Photo
                  </h3>
                </div>
                <span className="text-xs font-medium text-slate-200">Mandatory fields marked *</span>
              </div>

              <div className="p-5 sm:p-6 space-y-6">
                {/* Profile Photo Upload Row */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-5 pb-6 border-b border-slate-200">
                  <div className="shrink-0">
                    {candidate.photoUrl ? (
                      <img
                        src={candidate.photoUrl}
                        alt={candidate.name}
                        className="w-24 h-24 rounded-2xl object-cover border-2 border-[#063B7A]/20 shadow-sm bg-slate-50"
                      />
                    ) : (
                      <div className="w-24 h-24 rounded-2xl bg-slate-100 border-2 border-dashed border-slate-300 text-[#063B7A] flex flex-col items-center justify-center font-display text-xl font-bold">
                        <Camera className="w-6 h-6 text-slate-400 mb-1" aria-hidden="true" />
                        <span className="text-xs text-slate-500 font-sans">No Photo</span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 space-y-2">
                    <h4 className="text-sm font-bold text-[#063B7A]">Candidate Profile Photo</h4>
                    <p className="text-xs text-slate-600">
                      Upload a clear formal photograph (PNG, JPG, WebP, or GIF, max 5 MB). Stored securely on your profile.
                    </p>
                    <div className="flex flex-wrap items-center gap-2.5 pt-1">
                      <label
                        htmlFor="dashboard-photo-upload"
                        className="min-h-[38px] px-4 py-2 rounded-xl bg-[#063B7A] hover:bg-[#042A58] text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Camera className="w-4 h-4" aria-hidden="true" />
                        <span>
                          {photoUploading
                            ? 'Uploading...'
                            : candidate.photoUrl
                              ? 'Change Photo'
                              : 'Upload Photo'}
                        </span>
                      </label>
                      <input
                        ref={photoInputRef}
                        id="dashboard-photo-upload"
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        onChange={handlePhotoUpload}
                        className="sr-only"
                      />

                      {candidate.photoUrl && (
                        <button
                          type="button"
                          disabled={photoUploading}
                          onClick={handleRemovePhoto}
                          className="min-h-[38px] px-3.5 py-2 rounded-xl border border-red-200 hover:bg-red-50 text-red-600 text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Remove Photo</span>
                        </button>
                      )}
                    </div>
                    {photoMessage && (
                      <p
                        className={`text-xs font-semibold ${
                          photoMessage.type === 'success' ? 'text-[#0A8E43]' : 'text-red-600'
                        }`}
                      >
                        {photoMessage.text}
                      </p>
                    )}
                  </div>
                </div>

                {/* Personal Details Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label htmlFor="prof-name" className="block text-xs font-semibold text-[#063B7A] mb-1">
                      Full Name *
                    </label>
                    <input
                      id="prof-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Full Name"
                      className="w-full min-h-[42px] px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#063B7A] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label htmlFor="prof-email" className="block text-xs font-semibold text-[#063B7A] mb-1">
                      Email Address *
                    </label>
                    <input
                      id="prof-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@email.com"
                      className="w-full min-h-[42px] px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#063B7A] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label htmlFor="prof-phone" className="block text-xs font-semibold text-[#063B7A] mb-1">
                      Mobile Number (10-digit) *
                    </label>
                    <input
                      id="prof-phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="10-digit mobile number"
                      className="w-full min-h-[42px] px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#063B7A] focus:outline-none tabular-nums"
                    />
                  </div>

                  <div>
                    <label htmlFor="prof-dob" className="block text-xs font-semibold text-[#063B7A] mb-1">
                      Date of Birth (DOB)
                    </label>
                    <input
                      id="prof-dob"
                      type="date"
                      value={dob}
                      onChange={(e) => setDob(e.target.value)}
                      className="w-full min-h-[42px] px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#063B7A] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label htmlFor="prof-state" className="block text-xs font-semibold text-[#063B7A] mb-1">
                      State
                    </label>
                    <select
                      id="prof-state"
                      value={stateName}
                      onChange={(e) => setStateName(e.target.value)}
                      className="w-full min-h-[42px] px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#063B7A] focus:outline-none cursor-pointer"
                    >
                      <option value="">Select State</option>
                      {stateName && !INDIAN_STATES.includes(stateName) && (
                        <option value={stateName}>{stateName}</option>
                      )}
                      {INDIAN_STATES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="prof-district" className="block text-xs font-semibold text-[#063B7A] mb-1">
                      District / City *
                    </label>
                    <input
                      id="prof-district"
                      type="text"
                      value={districtCity}
                      onChange={(e) => {
                        setDistrictCity(e.target.value);
                        if (!city || city === districtCity) setCity(e.target.value);
                      }}
                      placeholder="e.g., Jaipur"
                      className="w-full min-h-[42px] px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#063B7A] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label htmlFor="prof-city" className="block text-xs font-semibold text-[#063B7A] mb-1">
                      Current City *
                    </label>
                    <input
                      id="prof-city"
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Current City"
                      className="w-full min-h-[42px] px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#063B7A] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label htmlFor="prof-pincode" className="block text-xs font-semibold text-[#063B7A] mb-1">
                      Pin Code
                    </label>
                    <input
                      id="prof-pincode"
                      type="text"
                      maxLength={6}
                      value={pinCode}
                      onChange={(e) => setPinCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="6-digit Pin Code"
                      className="w-full min-h-[42px] px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#063B7A] focus:outline-none tabular-nums"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Family Details */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="bg-[#063B7A] px-5 sm:px-6 py-3.5 flex items-center gap-2.5 text-white">
                <Users className="w-5 h-5 text-[#F58220]" aria-hidden="true" />
                <h3 className="font-display text-base sm:text-lg font-bold">2. Family Details</h3>
              </div>

              <div className="p-5 sm:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div>
                  <label htmlFor="prof-father" className="block text-xs font-semibold text-[#063B7A] mb-1">
                    Father&apos;s Name
                  </label>
                  <input
                    id="prof-father"
                    type="text"
                    value={fatherName}
                    onChange={(e) => setFatherName(e.target.value)}
                    placeholder="Father's Name"
                    className="w-full min-h-[42px] px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#063B7A] focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="prof-mother" className="block text-xs font-semibold text-[#063B7A] mb-1">
                    Mother&apos;s Name
                  </label>
                  <input
                    id="prof-mother"
                    type="text"
                    value={motherName}
                    onChange={(e) => setMotherName(e.target.value)}
                    placeholder="Mother's Name"
                    className="w-full min-h-[42px] px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#063B7A] focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="prof-marital" className="block text-xs font-semibold text-[#063B7A] mb-1">
                    Marital Status
                  </label>
                  <select
                    id="prof-marital"
                    value={maritalStatus}
                    onChange={(e) => setMaritalStatus(e.target.value)}
                    className="w-full min-h-[42px] px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#063B7A] focus:outline-none cursor-pointer"
                  >
                    <option value="">Select Status</option>
                    {MARITAL_STATUS_OPTIONS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="prof-spouse" className="block text-xs font-semibold text-[#063B7A] mb-1">
                    Spouse / Guardian Name
                  </label>
                  <input
                    id="prof-spouse"
                    type="text"
                    value={spouseName}
                    onChange={(e) => setSpouseName(e.target.value)}
                    placeholder="Optional"
                    className="w-full min-h-[42px] px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#063B7A] focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="prof-emergency" className="block text-xs font-semibold text-[#063B7A] mb-1">
                    Emergency / Family Contact
                  </label>
                  <input
                    id="prof-emergency"
                    type="tel"
                    value={emergencyContact}
                    onChange={(e) => setEmergencyContact(e.target.value)}
                    placeholder="10-digit Family Mobile"
                    className="w-full min-h-[42px] px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#063B7A] focus:outline-none tabular-nums"
                  />
                </div>
              </div>
            </div>

            {/* 3. Headline, Professional Summary, Career Summary & Resume Summary */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="bg-[#063B7A] px-5 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-2.5 text-white">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-5 h-5 text-[#F58220]" aria-hidden="true" />
                  <h3 className="font-display text-base sm:text-lg font-bold">
                    3. Headline, Professional Summary, Career Summary &amp; Resume Summary
                  </h3>
                </div>
                <button
                  type="button"
                  disabled={aiSummaryLoading}
                  onClick={handleAiGenerateSummaries}
                  className="min-h-[34px] px-3 py-1 rounded-lg bg-[#F58220] hover:bg-[#D96B0C] disabled:opacity-60 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  {aiSummaryLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                  )}
                  <span>{aiSummaryLoading ? 'Generating...' : 'AI Generate Summaries'}</span>
                </button>
              </div>

              <div className="p-5 sm:p-6 space-y-4">
                {aiSummaryError && (
                  <p className="text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2" role="alert">
                    {aiSummaryError}
                  </p>
                )}
                <div>
                  <label htmlFor="prof-headline" className="block text-xs font-semibold text-[#063B7A] mb-1">
                    Resume Headline
                  </label>
                  <input
                    id="prof-headline"
                    type="text"
                    value={resumeHeadline}
                    onChange={(e) => setResumeHeadline(e.target.value)}
                    placeholder="e.g., Experienced QA / Production Executive | Pharma Manufacturing & GMP Compliance"
                    className="w-full min-h-[42px] px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#063B7A] focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="prof-summary" className="block text-xs font-semibold text-[#063B7A] mb-1">
                      Professional Summary
                    </label>
                    <textarea
                      id="prof-summary"
                      rows={4}
                      value={profileSummary}
                      onChange={(e) => setProfileSummary(e.target.value)}
                      placeholder="Summarize your core domain expertise, achievements, and current role..."
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#063B7A] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label htmlFor="prof-career-summary" className="block text-xs font-semibold text-[#063B7A] mb-1">
                      Career Summary
                    </label>
                    <textarea
                      id="prof-career-summary"
                      rows={4}
                      value={careerSummary}
                      onChange={(e) => setCareerSummary(e.target.value)}
                      placeholder="Highlight your career progression, key roles handled, and career objectives..."
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#063B7A] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label htmlFor="prof-resume-summary" className="block text-xs font-semibold text-[#063B7A] mb-1">
                      Resume Summary
                    </label>
                    <textarea
                      id="prof-resume-summary"
                      rows={4}
                      value={resumeSummary}
                      onChange={(e) => setResumeSummary(e.target.value)}
                      placeholder="Concise recruiter-ready overview shown on top of your resume profile..."
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#063B7A] focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 4. Professional Details & Salary / Notice Period */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="bg-[#063B7A] px-5 sm:px-6 py-3.5 flex items-center gap-2.5 text-white">
                <Briefcase className="w-5 h-5 text-[#F58220]" aria-hidden="true" />
                <h3 className="font-display text-base sm:text-lg font-bold">
                  4. Professional Details (Company, Designation, Experience, CTC &amp; Notice Period)
                </h3>
              </div>

              <div className="p-5 sm:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label htmlFor="prof-qualification" className="block text-xs font-semibold text-[#063B7A] mb-1">
                    Highest Qualification
                  </label>
                  <input
                    id="prof-qualification"
                    type="text"
                    value={qualification}
                    onChange={(e) => setQualification(e.target.value)}
                    placeholder="e.g., B.Pharm, M.Pharm, MBA, B.Com"
                    className="w-full min-h-[42px] px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#063B7A] focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="prof-company" className="block text-xs font-semibold text-[#063B7A] mb-1">
                    Current / Last Company
                  </label>
                  <input
                    id="prof-company"
                    type="text"
                    value={currentCompany}
                    onChange={(e) => setCurrentCompany(e.target.value)}
                    placeholder="Company Name (or Fresher)"
                    className="w-full min-h-[42px] px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#063B7A] focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="prof-designation" className="block text-xs font-semibold text-[#063B7A] mb-1">
                    Current / Last Designation
                  </label>
                  <input
                    id="prof-designation"
                    type="text"
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    placeholder="e.g., QA Officer, Accountant"
                    className="w-full min-h-[42px] px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#063B7A] focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="prof-experience" className="block text-xs font-semibold text-[#063B7A] mb-1">
                    Total Experience *
                  </label>
                  <select
                    id="prof-experience"
                    value={experience}
                    onChange={(e) => setExperience(e.target.value)}
                    className="w-full min-h-[42px] px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#063B7A] focus:outline-none cursor-pointer"
                  >
                    {!EXPERIENCE_OPTIONS.includes(experience) && experience && (
                      <option value={experience}>{experience}</option>
                    )}
                    {EXPERIENCE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {formatExperienceLabel(opt)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="prof-current-ctc" className="block text-xs font-semibold text-[#063B7A] mb-1">
                    Current CTC
                  </label>
                  <input
                    id="prof-current-ctc"
                    type="text"
                    value={currentCtc}
                    onChange={(e) => setCurrentCtc(e.target.value)}
                    placeholder="e.g., ₹4.2 LPA or Fresher"
                    className="w-full min-h-[42px] px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#063B7A] focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="prof-expected-ctc" className="block text-xs font-semibold text-[#063B7A] mb-1">
                    Expected CTC / Salary
                  </label>
                  <input
                    id="prof-expected-ctc"
                    type="text"
                    value={expectedSalary}
                    onChange={(e) => setExpectedSalary(e.target.value)}
                    placeholder="e.g., ₹5.5 LPA / ₹30,000 PM"
                    className="w-full min-h-[42px] px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#063B7A] focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="prof-notice" className="block text-xs font-semibold text-[#063B7A] mb-1">
                    Notice Period
                  </label>
                  <select
                    id="prof-notice"
                    value={noticePeriod}
                    onChange={(e) => setNoticePeriod(e.target.value)}
                    className="w-full min-h-[42px] px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#063B7A] focus:outline-none cursor-pointer"
                  >
                    <option value="">Select Notice Period</option>
                    {noticePeriod && !NOTICE_PERIOD_OPTIONS.includes(noticePeriod) && (
                      <option value={noticePeriod}>{noticePeriod}</option>
                    )}
                    {NOTICE_PERIOD_OPTIONS.map((np) => (
                      <option key={np} value={np}>
                        {np}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="prof-job-type" className="block text-xs font-semibold text-[#063B7A] mb-1">
                    Preferred Job Type
                  </label>
                  <select
                    id="prof-job-type"
                    value={jobType}
                    onChange={(e) => setJobType(e.target.value)}
                    className="w-full min-h-[42px] px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#063B7A] focus:outline-none cursor-pointer"
                  >
                    <option value="">Select Job Type</option>
                    {JOB_TYPE_OPTIONS.map((jt) => (
                      <option key={jt} value={jt}>
                        {jt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* 5. Key Skills & Preferred Location / Role */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="bg-[#063B7A] px-5 sm:px-6 py-3.5 flex items-center gap-2.5 text-white">
                <Award className="w-5 h-5 text-[#F58220]" aria-hidden="true" />
                <h3 className="font-display text-base sm:text-lg font-bold">
                  5. Key Skills &amp; Preferred Location / Role
                </h3>
              </div>

              <div className="p-5 sm:p-6 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="prof-pref-location" className="block text-xs font-semibold text-[#063B7A] mb-1">
                      Preferred Location(s)
                    </label>
                    <input
                      id="prof-pref-location"
                      type="text"
                      value={preferredLocation}
                      onChange={(e) => setPreferredLocation(e.target.value)}
                      placeholder="e.g., Jaipur, Bhiwadi, Ahmedabad, Pan India"
                      className="w-full min-h-[42px] px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#063B7A] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label htmlFor="prof-pref-role" className="block text-xs font-semibold text-[#063B7A] mb-1">
                      Preferred Role / Department
                    </label>
                    <input
                      id="prof-pref-role"
                      type="text"
                      value={preferredRole}
                      onChange={(e) => setPreferredRole(e.target.value)}
                      placeholder="e.g., Quality Assurance, Sales Manager, Accounts Executive"
                      className="w-full min-h-[42px] px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#063B7A] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="prof-skill-input" className="block text-xs font-semibold text-[#063B7A] mb-1.5">
                    Key Skills (Type a skill and press Enter, or click suggestions below)
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      id="prof-skill-input"
                      type="text"
                      value={skillInput}
                      onChange={(e) => setSkillInput(e.target.value)}
                      onKeyDown={handleSkillKeyDown}
                      placeholder="Add skill e.g., GMP Audits, Tally Prime, Medical Sales"
                      className="flex-1 min-h-[42px] px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#063B7A] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => addSkillTag(skillInput)}
                      className="min-h-[42px] px-4 py-2 rounded-xl bg-[#063B7A] hover:bg-[#042A58] text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" aria-hidden="true" />
                      <span>Add Skill</span>
                    </button>
                  </div>

                  {keySkills.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {keySkills.map((skill) => (
                        <span
                          key={skill}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#063B7A]/10 text-[#063B7A] border border-[#063B7A]/20 text-xs font-semibold"
                        >
                          <span>{skill}</span>
                          <button
                            type="button"
                            onClick={() => removeSkill(skill)}
                            aria-label={`Remove ${skill}`}
                            className="text-[#063B7A]/70 hover:text-red-600 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-slate-500 mr-1">
                      Quick Add:
                    </span>
                    {SUGGESTED_SKILLS.filter(
                      (s) => !keySkills.some((k) => k.toLowerCase() === s.toLowerCase())
                    ).map((suggested) => (
                      <button
                        key={suggested}
                        type="button"
                        onClick={() => addSkillTag(suggested)}
                        className="px-2.5 py-1 rounded-md border border-slate-200 bg-slate-50 hover:border-[#063B7A] hover:text-[#063B7A] text-[11px] font-medium text-slate-700 transition-colors cursor-pointer"
                      >
                        + {suggested}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 6. Academic Details List */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="bg-[#063B7A] px-5 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 text-white">
                  <GraduationCap className="w-5 h-5 text-[#F58220]" aria-hidden="true" />
                  <h3 className="font-display text-base sm:text-lg font-bold">
                    6. Academic Details
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={handleAddAcademic}
                  className="min-h-[36px] px-3.5 py-1.5 rounded-lg bg-[#F58220] hover:bg-[#D96B0C] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Add Qualification</span>
                </button>
              </div>

              <div className="p-5 sm:p-6 space-y-4">
                {academicDetails.length === 0 ? (
                  <div className="text-center py-6 px-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/70">
                    <BookOpen className="w-7 h-7 text-slate-400 mx-auto" aria-hidden="true" />
                    <p className="mt-2 text-sm font-medium text-slate-600">
                      No detailed academic entries added yet. Add your 10th, 12th, Graduation, or Post-Graduation details.
                    </p>
                    <button
                      type="button"
                      onClick={handleAddAcademic}
                      className="mt-3 min-h-[38px] px-4 py-1.5 rounded-xl bg-[#063B7A] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" aria-hidden="true" />
                      <span>Add Academic Detail</span>
                    </button>
                  </div>
                ) : (
                  academicDetails.map((entry, idx) => (
                    <div
                      key={entry.id}
                      className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-[#063B7A]">
                          Qualification #{idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveAcademic(entry.id)}
                          className="text-xs font-semibold text-red-600 hover:underline inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Remove</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Degree / Course
                          </label>
                          <input
                            type="text"
                            value={entry.degree}
                            onChange={(e) =>
                              handleAcademicChange(entry.id, 'degree', e.target.value)
                            }
                            placeholder="e.g., B.Pharm / MBA / 12th"
                            className="w-full min-h-[40px] px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:border-[#063B7A] focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Specialization / Stream
                          </label>
                          <input
                            type="text"
                            value={entry.specialization || ''}
                            onChange={(e) =>
                              handleAcademicChange(entry.id, 'specialization', e.target.value)
                            }
                            placeholder="e.g., Pharmacy / Finance"
                            className="w-full min-h-[40px] px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:border-[#063B7A] focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            College / University / Board
                          </label>
                          <input
                            type="text"
                            value={entry.institution}
                            onChange={(e) =>
                              handleAcademicChange(entry.id, 'institution', e.target.value)
                            }
                            placeholder="University / Institution"
                            className="w-full min-h-[40px] px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:border-[#063B7A] focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Year of Passing
                          </label>
                          <input
                            type="text"
                            value={entry.yearOfPassing}
                            onChange={(e) =>
                              handleAcademicChange(entry.id, 'yearOfPassing', e.target.value)
                            }
                            placeholder="e.g., 2022"
                            className="w-full min-h-[40px] px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:border-[#063B7A] focus:outline-none tabular-nums"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Percentage / CGPA
                          </label>
                          <input
                            type="text"
                            value={entry.percentageOrGrade || ''}
                            onChange={(e) =>
                              handleAcademicChange(entry.id, 'percentageOrGrade', e.target.value)
                            }
                            placeholder="e.g., 78% or 8.2 CGPA"
                            className="w-full min-h-[40px] px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:border-[#063B7A] focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 7. Work Experience List */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="bg-[#063B7A] px-5 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 text-white">
                  <Building2 className="w-5 h-5 text-[#F58220]" aria-hidden="true" />
                  <h3 className="font-display text-base sm:text-lg font-bold">
                    7. Work Experience History
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={handleAddWork}
                  className="min-h-[36px] px-3.5 py-1.5 rounded-lg bg-[#F58220] hover:bg-[#D96B0C] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Add Experience</span>
                </button>
              </div>

              <div className="p-5 sm:p-6 space-y-4">
                {workExperience.length === 0 ? (
                  <div className="text-center py-6 px-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/70">
                    <Briefcase className="w-7 h-7 text-slate-400 mx-auto" aria-hidden="true" />
                    <p className="mt-2 text-sm font-medium text-slate-600">
                      No work experience entries added yet. Freshers can leave this blank or add internships; experienced candidates can add all past/current roles.
                    </p>
                    <button
                      type="button"
                      onClick={handleAddWork}
                      className="mt-3 min-h-[38px] px-4 py-1.5 rounded-xl bg-[#063B7A] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" aria-hidden="true" />
                      <span>Add Work Experience</span>
                    </button>
                  </div>
                ) : (
                  workExperience.map((item, idx) => (
                    <div
                      key={item.id}
                      className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-[#063B7A]">
                          Experience #{idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveWork(item.id)}
                          className="text-xs font-semibold text-red-600 hover:underline inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Remove</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Company Name
                          </label>
                          <input
                            type="text"
                            value={item.company}
                            onChange={(e) => handleWorkChange(item.id, 'company', e.target.value)}
                            placeholder="Company / Hospital / Organization"
                            className="w-full min-h-[40px] px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:border-[#063B7A] focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Designation / Role
                          </label>
                          <input
                            type="text"
                            value={item.designation}
                            onChange={(e) =>
                              handleWorkChange(item.id, 'designation', e.target.value)
                            }
                            placeholder="e.g., QA Executive, Accountant"
                            className="w-full min-h-[40px] px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:border-[#063B7A] focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            From Date / Year
                          </label>
                          <input
                            type="text"
                            value={item.fromDate}
                            onChange={(e) => handleWorkChange(item.id, 'fromDate', e.target.value)}
                            placeholder="e.g., Jan 2021"
                            className="w-full min-h-[40px] px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:border-[#063B7A] focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            To Date / Year
                          </label>
                          <input
                            type="text"
                            value={item.currentlyWorking ? 'Present' : item.toDate}
                            disabled={Boolean(item.currentlyWorking)}
                            onChange={(e) => handleWorkChange(item.id, 'toDate', e.target.value)}
                            placeholder="e.g., Mar 2025"
                            className="w-full min-h-[40px] px-3 py-2 text-sm bg-white disabled:bg-slate-100 border border-slate-200 rounded-lg focus:border-[#063B7A] focus:outline-none"
                          />
                          <label className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={Boolean(item.currentlyWorking)}
                              onChange={(e) =>
                                handleWorkChange(item.id, 'currentlyWorking', e.target.checked)
                              }
                              className="rounded border-slate-300 text-[#063B7A] focus:ring-[#063B7A]"
                            />
                            <span>Currently working here</span>
                          </label>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Key Responsibilities &amp; Achievements
                        </label>
                        <textarea
                          rows={2}
                          value={item.responsibilities || ''}
                          onChange={(e) =>
                            handleWorkChange(item.id, 'responsibilities', e.target.value)
                          }
                          placeholder="Briefly describe your duties, systems/tools handled, and key outcomes..."
                          className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:border-[#063B7A] focus:outline-none"
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Bottom Save Bar */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <HeartHandshake className="w-5 h-5 text-[#0A8E43] shrink-0 mt-0.5" aria-hidden="true" />
                <div className="text-xs sm:text-sm text-slate-600">
                  <p className="font-semibold text-[#063B7A]">
                    Our Services Is 100% FREE · Transparent Process Since 2012
                  </p>
                  <p className="mt-0.5">
                    Need assistance? Email{' '}
                    <a
                      href="mailto:info@vardhmanconsultancy.com"
                      className="text-[#063B7A] font-semibold hover:underline"
                    >
                      info@vardhmanconsultancy.com
                    </a>
                    .
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    syncFromCandidate(candidate);
                    setProfileMessage(null);
                  }}
                  className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" aria-hidden="true" />
                  <span>Reset Changes</span>
                </button>
                <button
                  type="submit"
                  disabled={profileSaving}
                  className="min-h-[44px] px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#0A8E43] to-[#077235] hover:from-[#087537] hover:to-[#065E2B] disabled:opacity-60 text-white text-sm font-semibold inline-flex items-center gap-2 shadow-md cursor-pointer"
                >
                  <Save className="w-4 h-4" aria-hidden="true" />
                  <span>{profileSaving ? 'Saving Complete Profile...' : 'Save Complete Profile'}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </section>

      {/* My Applications Section */}
      <section id="dashboard-applications-section" className="py-10 sm:py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-5 border-b border-slate-200">
            <div>
              <h2 className="font-display text-xl sm:text-2xl font-bold text-[#063B7A] tracking-tight">
                My Applications
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Track all verified job mandates you have applied for.
              </p>
            </div>

            <div className="text-sm text-slate-600 tabular-nums whitespace-nowrap shrink-0">
              Total Applications:{' '}
              <span className="font-semibold text-[#063B7A]">{applications.length}</span>
            </div>
          </div>

          {isLoadingApplications ? (
            <div className="mt-8">
              <DashboardCardSkeleton count={3} />
            </div>
          ) : applications.length === 0 ? (
            <div className="mt-8 bg-white border border-slate-200 rounded-2xl shadow-sm px-6 py-14 text-center">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-[#063B7A]/8 text-[#063B7A] flex items-center justify-center">
                <Briefcase className="w-7 h-7" aria-hidden="true" />
              </div>

              <p className="mt-5 text-xs font-bold tracking-widest uppercase text-[#D96B0C]">
                EMPTY
              </p>

              <h3 className="mt-2 font-display text-xl font-bold text-[#063B7A]">
                No Applications Submitted Yet
              </h3>

              <p className="mt-2 text-sm sm:text-base text-slate-600 max-w-md mx-auto">
                Explore verified openings on Search Jobs and click Apply Now on any job details page to submit an application.
              </p>

              <div className="mt-6">
                <button
                  type="button"
                  onClick={onGoToSearchJobs}
                  className="min-h-[44px] px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#F58220] to-[#D96B0C] text-white text-sm font-semibold inline-flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                >
                  <Search className="w-4 h-4" aria-hidden="true" />
                  <span>Search Jobs</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {applications.map((app) => (
                <article
                  key={app.id}
                  className="bg-white border border-slate-200/90 hover:border-[#063B7A]/40 rounded-2xl shadow-sm hover:shadow-lg transition-all duration-200 p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <button
                        type="button"
                        onClick={() => onSelectJob(app.jobId)}
                        className="font-display text-lg sm:text-xl font-bold text-[#063B7A] hover:text-[#D96B0C] transition-colors text-left cursor-pointer"
                      >
                        {app.jobTitle}
                      </button>
                      {app.autoApplied && (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold">
                          Auto-Applied
                        </span>
                      )}
                    </div>

                    <div className="mt-1.5 flex items-center gap-2 text-sm font-medium text-slate-700">
                      <Building2
                        className="w-4 h-4 text-[#0A8E43] shrink-0"
                        aria-hidden="true"
                      />
                      <span>{app.companyMasked}</span>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs sm:text-sm text-slate-600">
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 text-slate-400" aria-hidden="true" />
                        <span>{app.location}</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5 tabular-nums">
                        <IndianRupee className="w-4 h-4 text-slate-400" aria-hidden="true" />
                        <span>{app.salary}</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5 tabular-nums">
                        <Briefcase className="w-4 h-4 text-slate-400" aria-hidden="true" />
                        <span>{app.experience}</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5 tabular-nums">
                        <Calendar className="w-4 h-4 text-slate-400" aria-hidden="true" />
                        <span>Applied {formatDate(app.appliedAt)}</span>
                      </span>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span>Applicant: {app.applicantName}</span>
                      <span aria-hidden="true">·</span>
                      <span>{app.applicantEmail}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{app.applicantPhone}</span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end justify-between gap-2.5 shrink-0">
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0A8E43]">
                      <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>{app.status}</span>
                    </span>

                    <button
                      type="button"
                      onClick={() => handleDownloadResume(app.resumeId, app.resumeFileName)}
                      className="min-h-[40px] px-3.5 py-2 rounded-lg border border-slate-200 hover:border-[#063B7A] text-xs font-semibold text-[#063B7A] inline-flex items-center gap-1.5 transition-colors cursor-pointer text-left max-w-full"
                    >
                      <FileText className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span className="break-all whitespace-normal">{app.resumeFileName}</span>
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
