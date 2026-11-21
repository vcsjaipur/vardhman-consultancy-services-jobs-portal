import { FormEvent, useEffect, useState } from 'react';
import { jsPDF } from 'jspdf';
import {
  ArrowLeft,
  Briefcase,
  CheckCircle2,
  Download,
  FileText,
  GraduationCap,
  Loader2,
  Mail,
  MapPin,
  Phone,
  RotateCcw,
  Sparkles,
  User,
} from 'lucide-react';
import { CandidateProfile } from '../types/portal';
import { generateAiResumeAssist } from '../utils/candidateApi';
import {
  clearFormDraft,
  loadFormDraft,
  saveFormDraft,
} from '../utils/formDraftStorage';
import {
  MAX_SHARED_RESUME_BASE64_CHARS,
  syncResumeProfileToSharedCandidates,
} from '../utils/sharedPortalFirestore';
import { AiPanelSkeleton } from './SkeletonLoaders';

const BUILD_RESUME_DRAFT_KEY = 'vcs_draft_build_resume_v1';

interface BuildResumePageProps {
  candidate: CandidateProfile | null;
  onBackHome: () => void;
}

interface ResumeFormState {
  fullName: string;
  phone: string;
  email: string;
  city: string;
  education: string;
  experience: string;
  skills: string;
  careerObjective: string;
}

export function BuildResumePage({ candidate, onBackHome }: BuildResumePageProps) {
  const initialDraft = loadFormDraft<ResumeFormState>(BUILD_RESUME_DRAFT_KEY);
  const [form, setForm] = useState<ResumeFormState>({
    fullName: initialDraft?.fullName || candidate?.name || '',
    phone: initialDraft?.phone || candidate?.phone || '',
    email: initialDraft?.email || candidate?.email || '',
    city: initialDraft?.city || candidate?.city || '',
    education: initialDraft?.education || '',
    experience: initialDraft?.experience || candidate?.experience || '',
    skills: initialDraft?.skills || '',
    careerObjective: initialDraft?.careerObjective || '',
  });
  const [error, setError] = useState('');
  const [downloadedFileName, setDownloadedFileName] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiAssisting, setAiAssisting] = useState(false);

  useEffect(() => {
    if (!candidate) return;
    setForm((prev) => ({
      ...prev,
      fullName: prev.fullName || candidate.name || '',
      phone: prev.phone || candidate.phone || '',
      email: prev.email || candidate.email || '',
      city: prev.city || candidate.city || '',
      experience: prev.experience || candidate.experience || '',
    }));
  }, [candidate]);

  useEffect(() => {
    saveFormDraft(BUILD_RESUME_DRAFT_KEY, { ...form });
  }, [form]);

  const parsedSkills = form.skills
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const handleReset = () => {
    clearFormDraft(BUILD_RESUME_DRAFT_KEY);
    setForm({
      fullName: candidate?.name || '',
      phone: candidate?.phone || '',
      email: candidate?.email || '',
      city: candidate?.city || '',
      education: '',
      experience: candidate?.experience || '',
      skills: '',
      careerObjective: '',
    });
    setError('');
    setDownloadedFileName(null);
  };

  const handleAiSuggest = async () => {
    setError('');
    setAiAssisting(true);
    try {
      const res = await generateAiResumeAssist({
        name: form.fullName.trim(),
        role: candidate?.preferredRole || candidate?.designation || '',
        experience: form.experience.trim(),
        education: form.education.trim(),
        skills: form.skills.trim(),
        city: form.city.trim(),
      });
      setForm((prev) => {
        const mergedSkills = Array.from(
          new Set([
            ...prev.skills
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
            ...(res.suggestedSkills || []),
          ])
        ).join(', ');
        return {
          ...prev,
          skills: mergedSkills,
          careerObjective: res.careerObjective || prev.careerObjective,
        };
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to generate AI suggestions right now.'
      );
    } finally {
      setAiAssisting(false);
    }
  };

  const generatePdfResume = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setDownloadedFileName(null);

    if (!form.fullName.trim()) {
      setError('Please enter your Full Name.');
      return;
    }
    if (form.phone.replace(/\D/g, '').length < 10) {
      setError('Please enter a valid 10-digit Phone number.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setError('Please enter a valid Email address.');
      return;
    }
    if (!form.city.trim()) {
      setError('Please enter your City.');
      return;
    }
    if (!form.education.trim()) {
      setError('Please enter your Education details.');
      return;
    }
    if (!form.experience.trim()) {
      setError('Please enter your Experience details.');
      return;
    }
    if (!form.skills.trim()) {
      setError('Please enter your Skills.');
      return;
    }
    if (!form.careerObjective.trim()) {
      setError('Please enter your Career Objective.');
      return;
    }

    setIsGenerating(true);
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const marginX = 18;
      const contentWidth = pageWidth - marginX * 2;
      let y = 20;

      // Clean white background
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');

      // Subtle Dark Blue top accent bar
      doc.setFillColor(6, 59, 122);
      doc.rect(0, 0, pageWidth, 4, 'F');

      const ensureSpace = (neededMm: number) => {
        if (y + neededMm > pageHeight - 18) {
          doc.addPage();
          doc.setFillColor(255, 255, 255);
          doc.rect(0, 0, pageWidth, pageHeight, 'F');
          y = 20;
        }
      };

      // Candidate Name — Dark Blue Heading
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.setTextColor(6, 59, 122);
      const nameLines = doc.splitTextToSize(form.fullName.trim(), contentWidth);
      doc.text(nameLines, marginX, y);
      y += nameLines.length * 8.5 + 1;

      // Contact Row
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10.5);
      doc.setTextColor(51, 65, 85);
      const contactLine = `${form.phone.trim()}   |   ${form.email.trim()}   |   ${form.city.trim()}`;
      const contactLines = doc.splitTextToSize(contactLine, contentWidth);
      doc.text(contactLines, marginX, y);
      y += contactLines.length * 5.2 + 4;

      // Hairline Divider
      doc.setDrawColor(6, 59, 122);
      doc.setLineWidth(0.5);
      doc.line(marginX, y, pageWidth - marginX, y);
      y += 9;

      const addSection = (heading: string, bodyText: string) => {
        ensureSpace(22);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(6, 59, 122);
        doc.text(heading.toUpperCase(), marginX, y);
        y += 2.2;

        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.35);
        doc.line(marginX, y, pageWidth - marginX, y);
        y += 5.5;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10.5);
        doc.setTextColor(30, 41, 59);
        const lines = doc.splitTextToSize(bodyText.trim(), contentWidth) as string[];
        for (const line of lines) {
          ensureSpace(6);
          doc.text(line, marginX, y);
          y += 5.3;
        }
        y += 5;
      };

      addSection('Career Objective', form.careerObjective);
      addSection('Experience', form.experience);
      addSection('Education', form.education);
      addSection(
        'Skills',
        parsedSkills.length > 0 ? parsedSkills.map((s) => `• ${s}`).join('\n') : form.skills
      );

      const safeBaseName =
        form.fullName
          .trim()
          .replace(/[^a-zA-Z0-9]+/g, '_')
          .replace(/^_+|_+$/g, '') || 'Candidate';
      const fileName = `${safeBaseName}_Resume.pdf`;
      const rawDataUri = doc.output('datauristring');
      const normalizedPdfBase64 = rawDataUri.replace(
        /^data:application\/pdf[^;]*;base64,/i,
        'data:application/pdf;base64,'
      );
      doc.save(fileName);
      setDownloadedFileName(fileName);

      void syncResumeProfileToSharedCandidates({
        name: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        city: form.city.trim(),
        postApplied: candidate?.preferredRole || candidate?.designation || parsedSkills[0] || 'Job Seeker',
        experience: form.experience.trim(),
        qualification: form.education.trim(),
        skills: parsedSkills,
        resumeHeadline: parsedSkills.slice(0, 3).join(' · ') || undefined,
        resumeSummary: form.careerObjective.trim(),
        resumeFullText: [
          `Candidate: ${form.fullName.trim()}`,
          `Phone: ${form.phone.trim()}`,
          `Email: ${form.email.trim()}`,
          `City: ${form.city.trim()}`,
          `Career Objective: ${form.careerObjective.trim()}`,
          `Experience: ${form.experience.trim()}`,
          `Education: ${form.education.trim()}`,
          `Skills: ${parsedSkills.join(', ')}`,
          `Generated Resume PDF: ${fileName}`,
        ].join('\n'),
        resumeFileName: fileName,
        resumeBase64:
          normalizedPdfBase64.length <= MAX_SHARED_RESUME_BASE64_CHARS
            ? normalizedPdfBase64
            : '',
      }).catch(() => null);
    } catch {
      setError('Unable to generate PDF resume. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-slate-100 via-[#F4F7FB] to-[#E6EEF8] min-h-[calc(100vh-5rem)] border-b border-slate-200">
      <div className="bg-gradient-to-br from-[#063B7A] via-[#053166] to-[#042147] text-white">
        <div className="grid grid-cols-3 h-1 w-full" aria-hidden="true">
          <div className="bg-[#063B7A]" />
          <div className="bg-[#F58220]" />
          <div className="bg-[#0A8E43]" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
          <button
            type="button"
            onClick={onBackHome}
            className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-sm font-semibold text-white transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span>Back to Home</span>
          </button>

          <div className="mt-5 max-w-3xl">
            <p className="text-xs sm:text-sm font-semibold text-[#F58220]">
              Vardhman Consultancy Services · Free Resume Builder
            </p>
            <h1 className="mt-1.5 font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight text-balance">
              Build Resume
            </h1>
            <p className="mt-2 text-sm sm:text-base text-slate-200 leading-relaxed">
              Fill in your details below to create a clean, recruiter-ready resume with Dark Blue headings on a crisp white layout and download it instantly as a PDF.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Form Column */}
          <form
            onSubmit={generatePdfResume}
            noValidate
            className="lg:col-span-6 bg-white border border-slate-200/90 rounded-2xl shadow-xl p-5 sm:p-7 space-y-4"
          >
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#063B7A] to-[#042A58] text-white flex items-center justify-center shadow-sm"
                  aria-hidden="true"
                >
                  <FileText className="w-4 h-4" />
                </div>
                <h2 className="font-display text-lg font-bold text-[#063B7A]">
                  Resume Details
                </h2>
              </div>
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 min-h-[36px] px-2.5 text-xs font-semibold text-slate-600 hover:text-[#063B7A] transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Clear Form</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Full Name */}
              <div>
                <label
                  htmlFor="resume-full-name"
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
                    id="resume-full-name"
                    type="text"
                    required
                    value={form.fullName}
                    onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                    placeholder="Enter your full name"
                    className="w-full min-h-[46px] pl-10 pr-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 bg-slate-50/70 border border-slate-200 rounded-xl focus:bg-white focus:border-[#063B7A] focus:outline-none focus:ring-2 focus:ring-[#063B7A]/15"
                  />
                </div>
              </div>

              {/* Phone */}
              <div>
                <label
                  htmlFor="resume-phone"
                  className="block text-xs font-semibold text-[#063B7A] mb-1.5"
                >
                  Phone *
                </label>
                <div className="relative flex items-center">
                  <Phone
                    className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    id="resume-phone"
                    type="tel"
                    required
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="10-digit mobile number"
                    className="w-full min-h-[46px] pl-10 pr-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 bg-slate-50/70 border border-slate-200 rounded-xl focus:bg-white focus:border-[#063B7A] focus:outline-none focus:ring-2 focus:ring-[#063B7A]/15"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label
                  htmlFor="resume-email"
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
                    id="resume-email"
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="you@example.com"
                    className="w-full min-h-[46px] pl-10 pr-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 bg-slate-50/70 border border-slate-200 rounded-xl focus:bg-white focus:border-[#063B7A] focus:outline-none focus:ring-2 focus:ring-[#063B7A]/15"
                  />
                </div>
              </div>

              {/* City */}
              <div>
                <label
                  htmlFor="resume-city"
                  className="block text-xs font-semibold text-[#063B7A] mb-1.5"
                >
                  City *
                </label>
                <div className="relative flex items-center">
                  <MapPin
                    className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    id="resume-city"
                    type="text"
                    required
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    placeholder="e.g. Mumbai, Pune, Delhi"
                    className="w-full min-h-[46px] pl-10 pr-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 bg-slate-50/70 border border-slate-200 rounded-xl focus:bg-white focus:border-[#063B7A] focus:outline-none focus:ring-2 focus:ring-[#063B7A]/15"
                  />
                </div>
              </div>
            </div>

            {/* Education */}
            <div>
              <label
                htmlFor="resume-education"
                className="block text-xs font-semibold text-[#063B7A] mb-1.5"
              >
                Education *
              </label>
              <div className="relative">
                <GraduationCap
                  className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none"
                  aria-hidden="true"
                />
                <textarea
                  id="resume-education"
                  rows={2}
                  required
                  value={form.education}
                  onChange={(e) => setForm({ ...form, education: e.target.value })}
                  placeholder="Degree, University/College, Passing Year"
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 bg-slate-50/70 border border-slate-200 rounded-xl focus:bg-white focus:border-[#063B7A] focus:outline-none focus:ring-2 focus:ring-[#063B7A]/15"
                />
              </div>
            </div>

            {/* Experience */}
            <div>
              <label
                htmlFor="resume-experience"
                className="block text-xs font-semibold text-[#063B7A] mb-1.5"
              >
                Experience *
              </label>
              <div className="relative">
                <Briefcase
                  className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none"
                  aria-hidden="true"
                />
                <textarea
                  id="resume-experience"
                  rows={3}
                  required
                  value={form.experience}
                  onChange={(e) => setForm({ ...form, experience: e.target.value })}
                  placeholder="Role, Company, Duration & Key Responsibilities (or Fresher)"
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 bg-slate-50/70 border border-slate-200 rounded-xl focus:bg-white focus:border-[#063B7A] focus:outline-none focus:ring-2 focus:ring-[#063B7A]/15"
                />
              </div>
            </div>

            {/* Skills */}
            <div>
              <label
                htmlFor="resume-skills"
                className="block text-xs font-semibold text-[#063B7A] mb-1.5"
              >
                Skills * (comma separated)
              </label>
              <div className="relative flex items-center">
                <Sparkles
                  className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  id="resume-skills"
                  type="text"
                  required
                  value={form.skills}
                  onChange={(e) => setForm({ ...form, skills: e.target.value })}
                  placeholder="e.g. Clinical Practice, Pharma Sales, Diagnostics, EMR"
                  className="w-full min-h-[46px] pl-10 pr-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 bg-slate-50/70 border border-slate-200 rounded-xl focus:bg-white focus:border-[#063B7A] focus:outline-none focus:ring-2 focus:ring-[#063B7A]/15"
                />
              </div>
            </div>

            {/* Career Objective */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                <label
                  htmlFor="resume-objective"
                  className="block text-xs font-semibold text-[#063B7A]"
                >
                  Career Objective *
                </label>
                <button
                  type="button"
                  disabled={aiAssisting}
                  onClick={() => void handleAiSuggest()}
                  className="px-3 py-1 rounded-lg bg-[#063B7A] hover:bg-[#042A58] disabled:opacity-60 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  {aiAssisting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5 text-[#F6D574]" />
                  )}
                  <span>
                    {aiAssisting ? 'AI Assisting...' : 'AI Auto-Fill Objective & Suggest Skills'}
                  </span>
                </button>
              </div>
              {aiAssisting && (
                <div className="mb-2">
                  <AiPanelSkeleton />
                </div>
              )}
              <div className="relative">
                <FileText
                  className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none"
                  aria-hidden="true"
                />
                <textarea
                  id="resume-objective"
                  rows={3}
                  required
                  value={form.careerObjective}
                  onChange={(e) =>
                    setForm({ ...form, careerObjective: e.target.value })
                  }
                  placeholder="Write 2-3 lines about your career goal and strengths"
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 bg-slate-50/70 border border-slate-200 rounded-xl focus:bg-white focus:border-[#063B7A] focus:outline-none focus:ring-2 focus:ring-[#063B7A]/15"
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

            {downloadedFileName && (
              <div className="p-4 rounded-xl bg-[#0A8E43]/8 border border-[#0A8E43]/30 flex items-center gap-2.5 text-sm font-semibold text-[#0A8E43]">
                <CheckCircle2 className="w-5 h-5 shrink-0" aria-hidden="true" />
                <span>Resume downloaded as {downloadedFileName}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isGenerating}
              className="w-full min-h-[48px] px-6 py-3 rounded-xl bg-gradient-to-r from-[#F58220] to-[#D96B0C] hover:from-[#e07214] hover:to-[#c25d09] disabled:opacity-60 text-white font-semibold text-sm inline-flex items-center justify-center gap-2 shadow-md shadow-[#F58220]/25 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#063B7A] focus-visible:ring-offset-2"
            >
              <Download className="w-4 h-4" aria-hidden="true" />
              <span>
                {isGenerating ? 'Generating PDF...' : 'Download Resume As PDF'}
              </span>
            </button>
          </form>

          {/* Clean Live Resume Preview Column */}
          <div className="lg:col-span-6 lg:sticky lg:top-24">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-[#063B7A]">
                Resume Preview (Clean White &amp; Dark Blue)
              </p>
            </div>

            <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xl overflow-hidden">
              <div className="h-2 w-full bg-[#063B7A]" aria-hidden="true" />
              <div className="p-6 sm:p-8 space-y-6">
                {/* Dark Blue Name Heading */}
                <header className="pb-4 border-b border-[#063B7A]/30">
                  <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-[#063B7A] tracking-tight break-words">
                    {form.fullName.trim() || 'Your Full Name'}
                  </h2>

                  <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs sm:text-sm text-slate-700">
                    <span className="tabular-nums">
                      {form.phone.trim() || 'Phone Number'}
                    </span>
                    <span aria-hidden="true" className="text-slate-300">
                      |
                    </span>
                    <span className="break-all">
                      {form.email.trim() || 'Email Address'}
                    </span>
                    <span aria-hidden="true" className="text-slate-300">
                      |
                    </span>
                    <span>{form.city.trim() || 'City'}</span>
                  </div>
                </header>

                {/* Career Objective */}
                <section>
                  <h3 className="font-display text-sm font-bold uppercase tracking-wide text-[#063B7A] pb-1.5 border-b border-slate-200">
                    Career Objective
                  </h3>
                  <p className="mt-2.5 text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                    {form.careerObjective.trim() ||
                      'Your career objective will appear here.'}
                  </p>
                </section>

                {/* Experience */}
                <section>
                  <h3 className="font-display text-sm font-bold uppercase tracking-wide text-[#063B7A] pb-1.5 border-b border-slate-200">
                    Experience
                  </h3>
                  <p className="mt-2.5 text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                    {form.experience.trim() ||
                      'Your work experience or fresher summary will appear here.'}
                  </p>
                </section>

                {/* Education */}
                <section>
                  <h3 className="font-display text-sm font-bold uppercase tracking-wide text-[#063B7A] pb-1.5 border-b border-slate-200">
                    Education
                  </h3>
                  <p className="mt-2.5 text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                    {form.education.trim() ||
                      'Your degree, college/university, and year will appear here.'}
                  </p>
                </section>

                {/* Skills */}
                <section>
                  <h3 className="font-display text-sm font-bold uppercase tracking-wide text-[#063B7A] pb-1.5 border-b border-slate-200">
                    Skills
                  </h3>
                  {parsedSkills.length > 0 ? (
                    <ul className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-sm text-slate-700">
                      {parsedSkills.map((skill, idx) => (
                        <li key={`${skill}-${idx}`} className="flex items-start gap-2">
                          <span className="text-[#063B7A] font-bold" aria-hidden="true">
                            •
                          </span>
                          <span>{skill}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2.5 text-sm text-slate-500">
                      Your listed skills will appear here.
                    </p>
                  )}
                </section>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
