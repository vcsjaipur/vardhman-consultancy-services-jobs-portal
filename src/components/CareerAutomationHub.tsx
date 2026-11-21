import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  Award,
  Bell,
  BellRing,
  Calendar,
  CalendarPlus,
  CheckCircle2,
  Clock,
  ExternalLink,
  Mail,
  MessageCircle,
  Play,
  Plus,
  Rocket,
  Save,
  Sparkles,
  Trash2,
  Zap,
} from 'lucide-react';
import {
  CandidateProfile,
  InterviewReminder,
  JobApplication,
  JobListing,
} from '../types/portal';
import {
  createInterviewReminder,
  deleteInterviewReminder,
  getStoredToken,
  runAutoApplyMode,
  sendInterviewReminderEmail,
  updateCandidatePreferences,
  updateInterviewReminderStatus,
} from '../utils/candidateApi';
import { createResumeGodamEntryInFirestore } from '../utils/firestorePortal';
import { maskCompanyName } from '../utils/jobHelpers';
import {
  MAX_SHARED_RESUME_BASE64_CHARS,
  submitCandidateApplicationToSharedPortal,
  syncResumeProfileToSharedCandidates,
} from '../utils/sharedPortalFirestore';
import { computeSmartMatch } from '../utils/smartMatch';

interface CareerAutomationHubProps {
  candidate: CandidateProfile;
  approvedJobs: JobListing[];
  applications: JobApplication[];
  onCandidateUpdated: (candidate: CandidateProfile) => void;
  onApplicationsAdded?: (newApps: JobApplication[]) => void;
  onSelectJob: (jobId: string) => void;
  onOpenSkillTest: (topic?: string) => void;
}

const ALERT_CATEGORIES = [
  'Pharmaceutical',
  'Medical Officers',
  'Consultant Doctors',
  'Medical Representatives',
  'Hospital',
  'Healthcare',
  'Life Science',
  'Accounts & Finance',
  'HR & Administration',
  'IT & Software',
];

function getReminderTimingTag(dateStr: string, status: InterviewReminder['status']) {
  if (status === 'Completed') {
    return { label: 'Completed', style: 'bg-slate-100 text-slate-600 border-slate-200' };
  }
  const todayStr = new Date().toISOString().slice(0, 10);
  if (dateStr === todayStr) {
    return { label: 'Today', style: 'bg-[#F58220]/15 text-[#D96B0C] border-[#F58220]/40' };
  }
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (dateStr === tomorrow.toISOString().slice(0, 10)) {
    return { label: 'Tomorrow', style: 'bg-[#0A8E43]/15 text-[#0A8E43] border-[#0A8E43]/40' };
  }
  return { label: 'Upcoming', style: 'bg-[#063B7A]/10 text-[#063B7A] border-[#063B7A]/25' };
}

function downloadIcsFile(rem: InterviewReminder) {
  const cleanDate = rem.interviewDate.replace(/-/g, '');
  const cleanTime = (rem.interviewTime || '10:00').replace(/:/g, '');
  const start = `${cleanDate}T${cleanTime}00`;
  const endHour = String((Number(rem.interviewTime.split(':')[0] || '10') + 1) % 24).padStart(
    2,
    '0'
  );
  const endMin = rem.interviewTime.split(':')[1] || '00';
  const end = `${cleanDate}T${endHour}${endMin}00`;

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Vardhman Consultancy Services//Interview Reminder//EN',
    'BEGIN:VEVENT',
    `UID:${rem.id}@vardhmanconsultancy.com`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:Interview: ${rem.jobTitle} (${rem.companyName})`,
    `DESCRIPTION:Mode: ${rem.mode}. ${rem.notes || 'Vardhman Consultancy Services Candidate Interview'}`,
    `LOCATION:${rem.locationOrLink}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Interview_${rem.jobTitle.replace(/[^a-zA-Z0-9]+/g, '_')}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function CareerAutomationHub({
  candidate,
  approvedJobs,
  applications,
  onCandidateUpdated,
  onApplicationsAdded,
  onSelectJob,
  onOpenSkillTest,
}: CareerAutomationHubProps) {
  const [activeTab, setActiveTab] = useState<
    'smart-match' | 'alerts' | 'skill-tests' | 'reminders'
  >('smart-match');

  // Notifications & Auto-apply config state
  const [emailNotifications, setEmailNotifications] = useState(
    candidate.emailNotificationsEnabled ?? true
  );
  const [whatsappAlerts, setWhatsappAlerts] = useState(
    candidate.whatsappAlertsEnabled ?? false
  );
  const [whatsappNumber, setWhatsappNumber] = useState(
    candidate.whatsappNumber || candidate.phone || ''
  );
  const [alertCity, setAlertCity] = useState(
    candidate.alertCity || candidate.preferredLocation || candidate.city || ''
  );
  const [alertCategory, setAlertCategory] = useState(
    candidate.alertCategory || candidate.preferredRole || 'Pharmaceutical'
  );

  const [autoApplyEnabled, setAutoApplyEnabled] = useState(
    candidate.autoApplyConfig?.enabled ?? false
  );
  const [minMatchScore, setMinMatchScore] = useState(
    candidate.autoApplyConfig?.minMatchScore ?? 75
  );
  const [preferredKeywords, setPreferredKeywords] = useState(
    candidate.autoApplyConfig?.preferredKeywords ||
      (candidate.keySkills || []).slice(0, 3).join(', ')
  );
  const [preferredLocations, setPreferredLocations] = useState(
    candidate.autoApplyConfig?.preferredLocations ||
      candidate.preferredLocation ||
      candidate.city ||
      ''
  );
  const [maxDailyApps, setMaxDailyApps] = useState(
    candidate.autoApplyConfig?.maxDailyApps ?? 3
  );

  const [prefBusy, setPrefBusy] = useState(false);
  const [autoApplyBusy, setAutoApplyBusy] = useState(false);
  const [prefMessage, setPrefMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Interview reminder form state
  const [remTitle, setRemTitle] = useState('');
  const [remCompany, setRemCompany] = useState('Confidential - Apply via VCS');
  const [remDate, setRemDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [remTime, setRemTime] = useState('11:00');
  const [remMode, setRemMode] = useState<'Video Call' | 'In-Person' | 'Phone Screen'>(
    'Video Call'
  );
  const [remLocation, setRemLocation] = useState('');
  const [remNotes, setRemNotes] = useState('');
  const [remSendEmail, setRemSendEmail] = useState(true);
  const [remBusy, setRemBusy] = useState(false);
  const [remFeedback, setRemFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [notifyingId, setNotifyingId] = useState<string | null>(null);

  useEffect(() => {
    setEmailNotifications(candidate.emailNotificationsEnabled ?? true);
    setWhatsappAlerts(candidate.whatsappAlertsEnabled ?? false);
    setWhatsappNumber(candidate.whatsappNumber || candidate.phone || '');
    setAlertCity(candidate.alertCity || candidate.preferredLocation || candidate.city || '');
    setAlertCategory(candidate.alertCategory || candidate.preferredRole || 'Pharmaceutical');
    setAutoApplyEnabled(candidate.autoApplyConfig?.enabled ?? false);
    setMinMatchScore(candidate.autoApplyConfig?.minMatchScore ?? 75);
    setPreferredKeywords(
      candidate.autoApplyConfig?.preferredKeywords ||
        (candidate.keySkills || []).slice(0, 3).join(', ')
    );
    setPreferredLocations(
      candidate.autoApplyConfig?.preferredLocations ||
        candidate.preferredLocation ||
        candidate.city ||
        ''
    );
    setMaxDailyApps(candidate.autoApplyConfig?.maxDailyApps ?? 3);
  }, [candidate]);

  const smartMatchedJobs = useMemo(() => {
    return approvedJobs
      .map((job) => ({
        job,
        match: computeSmartMatch(job, candidate),
      }))
      .filter((item) => item.match !== null)
      .sort((a, b) => (b.match?.score || 0) - (a.match?.score || 0))
      .slice(0, 6);
  }, [approvedJobs, candidate]);

  const appliedJobIdSet = useMemo(
    () => new Set(applications.map((a) => a.jobId)),
    [applications]
  );

  const handleSavePreferences = async (sendConfirmationEmail = false) => {
    setPrefBusy(true);
    setPrefMessage(null);
    try {
      const res = await updateCandidatePreferences({
        emailNotificationsEnabled: emailNotifications,
        whatsappAlertsEnabled: whatsappAlerts,
        whatsappNumber: whatsappNumber.trim(),
        alertCity: alertCity.trim(),
        alertCategory,
        autoApplyConfig: {
          enabled: autoApplyEnabled,
          minMatchScore: Number(minMatchScore) || 75,
          preferredKeywords: preferredKeywords.trim(),
          preferredLocations: preferredLocations.trim(),
          maxDailyApps: Number(maxDailyApps) || 3,
        },
        sendConfirmationEmail,
      });
      onCandidateUpdated(res.candidate);
      void syncResumeProfileToSharedCandidates({
        name: res.candidate.name,
        email: res.candidate.email,
        phone: res.candidate.phone || 'Not provided',
        city: alertCity.trim() || res.candidate.city || 'India',
        state: res.candidate.state || undefined,
        postApplied:
          preferredKeywords.trim() ||
          res.candidate.preferredRole ||
          res.candidate.designation ||
          alertCategory ||
          'Job Seeker',
        experience: res.candidate.experience,
        qualification: res.candidate.qualification,
        skills: res.candidate.keySkills,
        resumeHeadline: res.candidate.resumeHeadline,
        resumeSummary: res.candidate.resumeSummary,
        resumeFileName: res.candidate.resumeFileName || 'profile_resume.pdf',
        resumeBase64: '',
      }).catch(() => null);
      setPrefMessage({
        type: 'success',
        text: sendConfirmationEmail
          ? 'Preferences saved and confirmation email dispatched.'
          : 'Alert & Auto-Apply preferences saved successfully.',
      });
    } catch (err) {
      setPrefMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to save preferences.',
      });
    } finally {
      setPrefBusy(false);
    }
  };

  const handleRunAutoApply = async () => {
    setAutoApplyBusy(true);
    setPrefMessage(null);
    try {
      const saved = await updateCandidatePreferences({
        emailNotificationsEnabled: emailNotifications,
        autoApplyConfig: {
          enabled: true,
          minMatchScore: Number(minMatchScore) || 75,
          preferredKeywords: preferredKeywords.trim(),
          preferredLocations: preferredLocations.trim(),
          maxDailyApps: Number(maxDailyApps) || 3,
        },
      });
      setAutoApplyEnabled(true);
      onCandidateUpdated(saved.candidate);

      const eligibleJobs = approvedJobs.filter((j) => {
        const m = computeSmartMatch(j, saved.candidate);
        return m && m.score >= (Number(minMatchScore) || 75);
      });

      const runRes = await runAutoApplyMode(
        eligibleJobs.length > 0 ? eligibleJobs : approvedJobs
      );
      onCandidateUpdated(runRes.candidate);
      if (runRes.applications.length > 0) {
        if (onApplicationsAdded) {
          onApplicationsAdded(runRes.applications);
        }
        void (async () => {
          let savedPdfBase64 = '';
          const token = getStoredToken();
          if (
            token &&
            saved.candidate.resumeId &&
            (saved.candidate.resumeFileName || '').toLowerCase().endsWith('.pdf')
          ) {
            try {
              const res = await fetch(
                `/api/resumes/${encodeURIComponent(saved.candidate.resumeId)}`,
                { headers: { Authorization: `Bearer ${token}` } }
              );
              if (res.ok) {
                const blob = await res.blob();
                const dataUrl = await new Promise<string>((resolve) => {
                  const reader = new FileReader();
                  reader.onload = () =>
                    resolve(typeof reader.result === 'string' ? reader.result : '');
                  reader.onerror = () => resolve('');
                  reader.readAsDataURL(blob);
                });
                if (dataUrl.length <= MAX_SHARED_RESUME_BASE64_CHARS) {
                  savedPdfBase64 = dataUrl;
                }
              }
            } catch {
              savedPdfBase64 = '';
            }
          }

          const qualExp = [
            saved.candidate.qualification,
            saved.candidate.experience,
          ]
            .filter(Boolean)
            .join(' · ') || 'Qualified Candidate';

          for (const app of runRes.applications) {
            void submitCandidateApplicationToSharedPortal({
              name: app.applicantName || saved.candidate.name,
              email: app.applicantEmail || saved.candidate.email,
              phone: app.applicantPhone || saved.candidate.phone,
              city: app.location || saved.candidate.city || 'India',
              postApplied: app.jobTitle,
              qualificationExperience: qualExp,
              termsAccepted: true,
              jobId: app.jobId,
              resumeFileName:
                app.resumeFileName || saved.candidate.resumeFileName || 'resume.pdf',
              resumeBase64: savedPdfBase64,
            }).catch(() => null);

            if (savedPdfBase64) {
              void createResumeGodamEntryInFirestore({
                entryId: app.id,
                jobId: app.jobId,
                jobTitle: app.jobTitle,
                companyMasked: app.companyMasked,
                applicantName: app.applicantName || saved.candidate.name,
                applicantEmail: app.applicantEmail || saved.candidate.email,
                applicantPhone: app.applicantPhone || saved.candidate.phone,
                city: app.location || saved.candidate.city || 'India',
                qualificationExperience: qualExp,
                resumeFileName:
                  app.resumeFileName || saved.candidate.resumeFileName || 'resume.pdf',
                resumeBase64: savedPdfBase64,
                termsAccepted: true,
              }).catch(() => null);
            }
          }
        })();
      }
      setPrefMessage({
        type: 'success',
        text: runRes.message,
      });
    } catch (err) {
      setPrefMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Auto-apply run failed.',
      });
    } finally {
      setAutoApplyBusy(false);
    }
  };

  const handleCreateReminder = async (e: FormEvent) => {
    e.preventDefault();
    setRemFeedback(null);
    if (!remTitle.trim() || !remDate || !remTime) {
      setRemFeedback({
        type: 'error',
        text: 'Please provide Interview Role Title, Date, and Time.',
      });
      return;
    }

    setRemBusy(true);
    try {
      const res = await createInterviewReminder({
        jobTitle: remTitle.trim(),
        companyName: remCompany.trim() || 'Confidential - Apply via VCS',
        interviewDate: remDate,
        interviewTime: remTime,
        mode: remMode,
        locationOrLink: remLocation.trim() || 'VCS Coordination Call / Video Link',
        notes: remNotes.trim(),
        sendEmailReminder: remSendEmail && emailNotifications,
      });
      onCandidateUpdated(res.candidate);
      setRemTitle('');
      setRemLocation('');
      setRemNotes('');
      setRemFeedback({
        type: 'success',
        text:
          remSendEmail && emailNotifications
            ? 'Interview reminder scheduled and email confirmation sent.'
            : 'Interview reminder scheduled.',
      });
    } catch (err) {
      setRemFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to save interview reminder.',
      });
    } finally {
      setRemBusy(false);
    }
  };

  const handleBrowserNotify = async (rem: InterviewReminder) => {
    if (!('Notification' in window)) {
      setRemFeedback({
        type: 'error',
        text: 'Browser notifications are not supported on this device. Use .ics Calendar or Email instead.',
      });
      return;
    }
    const perm =
      Notification.permission === 'granted'
        ? 'granted'
        : await Notification.requestPermission();
    if (perm === 'granted') {
      new Notification(`Interview Reminder: ${rem.jobTitle}`, {
        body: `${rem.interviewDate} at ${rem.interviewTime} (${rem.mode}) — ${rem.locationOrLink}`,
      });
      setRemFeedback({
        type: 'success',
        text: `Test browser reminder shown for ${rem.jobTitle}.`,
      });
    } else {
      setRemFeedback({
        type: 'error',
        text: 'Browser notification permission denied. You can still use Email or .ics Calendar reminders.',
      });
    }
  };

  const handleEmailReminderNow = async (id: string) => {
    setNotifyingId(id);
    setRemFeedback(null);
    try {
      const res = await sendInterviewReminderEmail(id);
      onCandidateUpdated(res.candidate);
      setRemFeedback({
        type: 'success',
        text: `Interview reminder email sent to ${candidate.email}.`,
      });
    } catch (err) {
      setRemFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to send reminder email.',
      });
    } finally {
      setNotifyingId(null);
    }
  };

  const skillResults = candidate.skillTestResults || [];
  const reminders = candidate.interviewReminders || [];

  const whatsappOptInHref = `https://wa.me/917877250630?text=${encodeURIComponent(
    `Hello Vardhman Consultancy Services, please activate WhatsApp Job Alerts for ${candidate.name} (${whatsappNumber || candidate.phone}). Preferred Category: ${alertCategory}, City: ${alertCity || candidate.city}.`
  )}`;

  return (
    <section
      id="dashboard-automation-hub"
      aria-label="Smart Career Automation Hub"
      className="py-8 sm:py-10 bg-slate-50 border-b border-slate-200"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-5">
        {/* Header + Tabs */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 sm:p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[#F58220] flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" aria-hidden="true" />
                <span>Smart Career Hub · AI &amp; Notifications</span>
              </p>
              <h2 className="mt-1 font-display text-xl sm:text-2xl font-extrabold text-[#063B7A]">
                Smart Match, Auto-Apply, Skill Tests, Alerts &amp; Interview Reminders
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
              {[
                { id: 'smart-match', label: 'Smart Match & Auto-Apply', icon: Rocket },
                { id: 'alerts', label: 'WhatsApp & Email Alerts', icon: Bell },
                { id: 'skill-tests', label: `Skill Tests (${skillResults.length})`, icon: Award },
                {
                  id: 'reminders',
                  label: `Interview Reminders (${reminders.length})`,
                  icon: Calendar,
                },
              ].map((t) => {
                const Icon = t.icon;
                const active = activeTab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveTab(t.id as typeof activeTab)}
                    className={`min-h-[40px] px-3.5 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#063B7A] text-white shadow-xs'
                        : 'text-slate-600 hover:text-[#063B7A]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {prefMessage && (activeTab === 'smart-match' || activeTab === 'alerts') && (
            <div
              className={`mt-4 text-xs sm:text-sm font-semibold px-4 py-3 rounded-xl flex items-center gap-2 ${
                prefMessage.type === 'success'
                  ? 'bg-[#0A8E43]/10 text-[#0A8E43] border border-[#0A8E43]/30'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}
              role={prefMessage.type === 'error' ? 'alert' : 'status'}
            >
              {prefMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0" />}
              <span>{prefMessage.text}</span>
            </div>
          )}

          {/* TAB 1: Smart Match & Auto-Apply */}
          {activeTab === 'smart-match' && (
            <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Top Smart Matched Jobs */}
              <div className="lg:col-span-7 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-base font-bold text-[#063B7A]">
                    Top Smart Matched Roles For Your Profile
                  </h3>
                  <span className="text-xs font-medium text-slate-500">
                    Based on Skills, City &amp; Experience
                  </span>
                </div>

                {smartMatchedJobs.length === 0 ? (
                  <div className="p-6 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-600">
                    No active approved jobs found right now. Update your Key Skills below or check back soon.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {smartMatchedJobs.map(({ job, match }) => {
                      const alreadyApplied = appliedJobIdSet.has(job.id);
                      const score = match?.score || 0;
                      return (
                        <div
                          key={job.id}
                          className="p-4 rounded-xl bg-slate-50/70 border border-slate-200 hover:border-[#063B7A] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`px-2.5 py-0.5 rounded-md text-xs font-extrabold tabular-nums ${
                                  score >= 80
                                    ? 'bg-[#0A8E43] text-white'
                                    : score >= 65
                                      ? 'bg-[#D4AF37] text-[#041C3F]'
                                      : 'bg-[#063B7A]/10 text-[#063B7A]'
                                }`}
                              >
                                {score}% {match?.label}
                              </span>
                              <span className="text-xs font-medium text-slate-500 truncate">
                                {maskCompanyName(job.company, job.companyMasked)}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => onSelectJob(job.id)}
                              className="mt-1.5 font-display text-base font-bold text-[#063B7A] hover:text-[#D96B0C] text-left cursor-pointer"
                            >
                              {job.title}
                            </button>
                            <p className="mt-0.5 text-xs text-slate-600">
                              {job.location} · {job.salary} · {job.experience}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {alreadyApplied ? (
                              <span className="px-3 py-1.5 rounded-lg bg-[#0A8E43]/10 text-[#0A8E43] text-xs font-bold inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Applied</span>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onSelectJob(job.id)}
                                className="min-h-[38px] px-4 py-1.5 rounded-lg bg-[#063B7A] hover:bg-[#042A58] text-white text-xs font-semibold cursor-pointer"
                              >
                                View &amp; Apply
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Auto-Apply Mode Controls */}
              <div className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-base font-bold text-[#063B7A] flex items-center gap-1.5">
                      <Zap className="w-4 h-4 text-[#F58220]" aria-hidden="true" />
                      <span>Auto-Apply Mode</span>
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-600">
                      Automatically apply to high-matching verified jobs using your saved resume and send an email summary.
                    </p>
                  </div>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={autoApplyEnabled}
                    onClick={() => setAutoApplyEnabled((v) => !v)}
                    className={`min-w-[68px] h-8 px-2 rounded-full text-xs font-bold transition-colors cursor-pointer ${
                      autoApplyEnabled
                        ? 'bg-[#0A8E43] text-white'
                        : 'bg-slate-300 text-slate-700'
                    }`}
                  >
                    {autoApplyEnabled ? 'ON' : 'OFF'}
                  </button>
                </div>

                <div>
                  <label
                    htmlFor="auto-min-score"
                    className="block text-xs font-semibold text-[#063B7A] mb-1"
                  >
                    Minimum Smart Match Threshold: {minMatchScore}%
                  </label>
                  <input
                    id="auto-min-score"
                    type="range"
                    min={45}
                    max={95}
                    step={5}
                    value={minMatchScore}
                    onChange={(e) => setMinMatchScore(Number(e.target.value))}
                    className="w-full accent-[#063B7A] cursor-pointer"
                  />
                </div>

                <div>
                  <label
                    htmlFor="auto-keywords"
                    className="block text-xs font-semibold text-[#063B7A] mb-1"
                  >
                    Target Role / Keywords
                  </label>
                  <input
                    id="auto-keywords"
                    type="text"
                    value={preferredKeywords}
                    onChange={(e) => setPreferredKeywords(e.target.value)}
                    placeholder="e.g. QA, Pharma Sales, Accounts"
                    className="w-full min-h-[40px] px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:border-[#063B7A] focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="auto-locations"
                      className="block text-xs font-semibold text-[#063B7A] mb-1"
                    >
                      Preferred Cities
                    </label>
                    <input
                      id="auto-locations"
                      type="text"
                      value={preferredLocations}
                      onChange={(e) => setPreferredLocations(e.target.value)}
                      placeholder="e.g. Jaipur, Delhi"
                      className="w-full min-h-[40px] px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:border-[#063B7A] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="auto-max-daily"
                      className="block text-xs font-semibold text-[#063B7A] mb-1"
                    >
                      Max Per Run
                    </label>
                    <select
                      id="auto-max-daily"
                      value={maxDailyApps}
                      onChange={(e) => setMaxDailyApps(Number(e.target.value))}
                      className="w-full min-h-[40px] px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:border-[#063B7A] focus:outline-none cursor-pointer"
                    >
                      {[1, 2, 3, 5, 10].map((n) => (
                        <option key={n} value={n}>
                          Up to {n} jobs
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {!candidate.resumeFileName && (
                  <p className="text-xs font-medium text-[#D96B0C] bg-[#F58220]/10 border border-[#F58220]/30 rounded-lg px-3 py-2">
                    Upload your resume above first to run Auto-Apply Mode.
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  <button
                    type="button"
                    disabled={prefBusy}
                    onClick={() => void handleSavePreferences(false)}
                    className="min-h-[42px] px-4 py-2 rounded-xl border border-[#063B7A] text-[#063B7A] hover:bg-[#063B7A]/5 text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>{prefBusy ? 'Saving...' : 'Save Settings'}</span>
                  </button>

                  <button
                    type="button"
                    disabled={autoApplyBusy || !candidate.resumeFileName || approvedJobs.length === 0}
                    onClick={() => void handleRunAutoApply()}
                    className="flex-1 min-h-[42px] px-4 py-2 rounded-xl bg-gradient-to-r from-[#0A8E43] to-[#077235] hover:from-[#087537] hover:to-[#065E2B] disabled:opacity-50 text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <Play className="w-4 h-4" />
                    <span>{autoApplyBusy ? 'Applying...' : 'Run Auto-Apply Now'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: WhatsApp & Email Alerts */}
          {activeTab === 'alerts' && (
            <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-7 bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                <h3 className="font-display text-base font-bold text-[#063B7A]">
                  Notification Channels &amp; Preferences
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="p-4 rounded-xl bg-white border border-slate-200 flex items-start justify-between gap-3 cursor-pointer">
                    <div>
                      <span className="font-bold text-sm text-[#063B7A] flex items-center gap-1.5">
                        <Mail className="w-4 h-4 text-[#063B7A]" />
                        <span>Email Notifications</span>
                      </span>
                      <span className="mt-1 block text-xs text-slate-600">
                        Receive job alerts, interview reminders, auto-apply digests, and skill reports at {candidate.email}.
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={emailNotifications}
                      onChange={(e) => setEmailNotifications(e.target.checked)}
                      className="mt-1 rounded border-slate-300 text-[#0A8E43] focus:ring-[#0A8E43]"
                    />
                  </label>

                  <label className="p-4 rounded-xl bg-white border border-slate-200 flex items-start justify-between gap-3 cursor-pointer">
                    <div>
                      <span className="font-bold text-sm text-[#0A8E43] flex items-center gap-1.5">
                        <MessageCircle className="w-4 h-4 text-[#0A8E43]" />
                        <span>WhatsApp Job Alerts</span>
                      </span>
                      <span className="mt-1 block text-xs text-slate-600">
                        Receive instant WhatsApp mandate alerts matching your city and role category.
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={whatsappAlerts}
                      onChange={(e) => setWhatsappAlerts(e.target.checked)}
                      className="mt-1 rounded border-slate-300 text-[#0A8E43] focus:ring-[#0A8E43]"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label
                      htmlFor="hub-wa-number"
                      className="block text-xs font-semibold text-[#063B7A] mb-1"
                    >
                      WhatsApp Number
                    </label>
                    <input
                      id="hub-wa-number"
                      type="tel"
                      value={whatsappNumber}
                      onChange={(e) => setWhatsappNumber(e.target.value)}
                      placeholder="10-digit WhatsApp number"
                      className="w-full min-h-[42px] px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:border-[#063B7A] focus:outline-none tabular-nums"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="hub-alert-city"
                      className="block text-xs font-semibold text-[#063B7A] mb-1"
                    >
                      Preferred Alert City
                    </label>
                    <input
                      id="hub-alert-city"
                      type="text"
                      value={alertCity}
                      onChange={(e) => setAlertCity(e.target.value)}
                      placeholder="e.g. Jaipur, Delhi, Mumbai"
                      className="w-full min-h-[42px] px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:border-[#063B7A] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="hub-alert-cat"
                      className="block text-xs font-semibold text-[#063B7A] mb-1"
                    >
                      Job Category
                    </label>
                    <select
                      id="hub-alert-cat"
                      value={alertCategory}
                      onChange={(e) => setAlertCategory(e.target.value)}
                      className="w-full min-h-[42px] px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:border-[#063B7A] focus:outline-none cursor-pointer"
                    >
                      {ALERT_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  <button
                    type="button"
                    disabled={prefBusy}
                    onClick={() => void handleSavePreferences(false)}
                    className="min-h-[42px] px-5 py-2 rounded-xl bg-[#063B7A] hover:bg-[#042A58] text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>{prefBusy ? 'Saving...' : 'Save Alert Preferences'}</span>
                  </button>
                  <button
                    type="button"
                    disabled={prefBusy || !emailNotifications}
                    onClick={() => void handleSavePreferences(true)}
                    className="min-h-[42px] px-4 py-2 rounded-xl border border-[#0A8E43] text-[#0A8E43] hover:bg-[#0A8E43]/10 disabled:opacity-50 text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Mail className="w-4 h-4" />
                    <span>Save &amp; Send Confirmation Email</span>
                  </button>
                </div>
              </div>

              <div className="lg:col-span-5 bg-gradient-to-br from-[#0A8E43] to-[#077235] text-white rounded-2xl p-5 sm:p-6 space-y-4">
                <div className="flex items-center gap-2.5">
                  <MessageCircle className="w-6 h-6 shrink-0" aria-hidden="true" />
                  <h3 className="font-display text-lg font-bold">
                    Official VCS WhatsApp Alert Desk
                  </h3>
                </div>
                <p className="text-sm text-white/90 leading-relaxed">
                  Click below to start a WhatsApp alert thread directly with the Vardhman Consultancy Services placement desk (+91 78772 50630) for instant verified mandates in {alertCity || candidate.city || 'India'}.
                </p>
                <a
                  href={whatsappOptInHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full min-h-[44px] px-5 py-2.5 rounded-xl bg-white text-[#077235] hover:bg-slate-100 text-sm font-bold inline-flex items-center justify-center gap-2 shadow-sm transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Activate on WhatsApp Now</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          )}

          {/* TAB 3: Skill Tests & Badges */}
          {activeTab === 'skill-tests' && (
            <div className="mt-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5">
                <div>
                  <h3 className="font-display text-base font-bold text-[#063B7A]">
                    Verified Skill Assessments
                  </h3>
                  <p className="mt-0.5 text-xs sm:text-sm text-slate-600">
                    Take a quick 5-question AI assessment in your specialty. Scoring 60%+ adds a Verified Skill badge to boost Smart Match!
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenSkillTest(candidate.preferredRole || candidate.designation || '')}
                  className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#062856] hover:bg-[#041C3F] text-white text-xs sm:text-sm font-bold inline-flex items-center gap-2 shrink-0 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-[#F6D574]" />
                  <span>Start New Skill Test</span>
                </button>
              </div>

              {skillResults.length === 0 ? (
                <div className="p-8 rounded-xl border border-dashed border-slate-300 text-center">
                  <Award className="w-8 h-8 text-slate-400 mx-auto" />
                  <p className="mt-2 text-sm font-semibold text-[#063B7A]">
                    No skill tests completed yet
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Click &ldquo;Start New Skill Test&rdquo; above to earn your first verified skill badge.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {skillResults.map((res) => (
                    <div
                      key={res.id}
                      className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`px-2.5 py-0.5 rounded-md text-xs font-bold ${
                            res.badgeLabel === 'Top Performer'
                              ? 'bg-[#D4AF37] text-[#041C3F]'
                              : res.badgeLabel === 'Verified Skill'
                                ? 'bg-[#0A8E43]/15 text-[#0A8E43]'
                                : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {res.badgeLabel}
                        </span>
                        <span className="text-xs font-bold text-[#063B7A] tabular-nums">
                          {res.scorePercent}%
                        </span>
                      </div>
                      <h4 className="font-display text-sm font-bold text-[#063B7A]">
                        {res.topic}
                      </h4>
                      <p className="text-xs text-slate-500">
                        {res.difficulty} · {res.correctAnswers}/{res.totalQuestions} correct
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: Interview Reminders */}
          {activeTab === 'reminders' && (
            <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Schedule Form */}
              <form
                onSubmit={handleCreateReminder}
                className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3.5"
              >
                <h3 className="font-display text-base font-bold text-[#063B7A] flex items-center gap-2">
                  <CalendarPlus className="w-4 h-4 text-[#F58220]" />
                  <span>Schedule Interview Reminder</span>
                </h3>

                <div>
                  <label
                    htmlFor="rem-title"
                    className="block text-xs font-semibold text-[#063B7A] mb-1"
                  >
                    Interview Role / Job Title *
                  </label>
                  <input
                    id="rem-title"
                    type="text"
                    required
                    value={remTitle}
                    onChange={(e) => setRemTitle(e.target.value)}
                    placeholder="e.g. QA Executive / Area Manager"
                    className="w-full min-h-[40px] px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:border-[#063B7A] focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="rem-company"
                    className="block text-xs font-semibold text-[#063B7A] mb-1"
                  >
                    Company / Coordinator
                  </label>
                  <input
                    id="rem-company"
                    type="text"
                    value={remCompany}
                    onChange={(e) => setRemCompany(e.target.value)}
                    placeholder="Confidential - Apply via VCS"
                    className="w-full min-h-[40px] px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:border-[#063B7A] focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="rem-date"
                      className="block text-xs font-semibold text-[#063B7A] mb-1"
                    >
                      Date *
                    </label>
                    <input
                      id="rem-date"
                      type="date"
                      required
                      value={remDate}
                      onChange={(e) => setRemDate(e.target.value)}
                      className="w-full min-h-[40px] px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:border-[#063B7A] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="rem-time"
                      className="block text-xs font-semibold text-[#063B7A] mb-1"
                    >
                      Time *
                    </label>
                    <input
                      id="rem-time"
                      type="time"
                      required
                      value={remTime}
                      onChange={(e) => setRemTime(e.target.value)}
                      className="w-full min-h-[40px] px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:border-[#063B7A] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="rem-mode"
                      className="block text-xs font-semibold text-[#063B7A] mb-1"
                    >
                      Interview Mode
                    </label>
                    <select
                      id="rem-mode"
                      value={remMode}
                      onChange={(e) =>
                        setRemMode(e.target.value as 'Video Call' | 'In-Person' | 'Phone Screen')
                      }
                      className="w-full min-h-[40px] px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:border-[#063B7A] focus:outline-none cursor-pointer"
                    >
                      <option value="Video Call">Video Call</option>
                      <option value="In-Person">In-Person</option>
                      <option value="Phone Screen">Phone Screen</option>
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="rem-loc"
                      className="block text-xs font-semibold text-[#063B7A] mb-1"
                    >
                      Meeting Link / Address
                    </label>
                    <input
                      id="rem-loc"
                      type="text"
                      value={remLocation}
                      onChange={(e) => setRemLocation(e.target.value)}
                      placeholder="Link or Office Address"
                      className="w-full min-h-[40px] px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:border-[#063B7A] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="rem-notes"
                    className="block text-xs font-semibold text-[#063B7A] mb-1"
                  >
                    Preparation Notes
                  </label>
                  <input
                    id="rem-notes"
                    type="text"
                    value={remNotes}
                    onChange={(e) => setRemNotes(e.target.value)}
                    placeholder="Carry 2 printed resumes, certificates..."
                    className="w-full min-h-[40px] px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:border-[#063B7A] focus:outline-none"
                  />
                </div>

                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={remSendEmail}
                    onChange={(e) => setRemSendEmail(e.target.checked)}
                    className="rounded border-slate-300 text-[#063B7A]"
                  />
                  <span>Send email confirmation immediately to {candidate.email}</span>
                </label>

                {remFeedback && (
                  <p
                    className={`text-xs font-semibold px-3 py-2 rounded-lg ${
                      remFeedback.type === 'success'
                        ? 'bg-[#0A8E43]/10 text-[#0A8E43]'
                        : 'bg-red-50 text-red-600'
                    }`}
                  >
                    {remFeedback.text}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={remBusy}
                  className="w-full min-h-[42px] px-4 py-2 rounded-xl bg-[#063B7A] hover:bg-[#042A58] text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>{remBusy ? 'Scheduling...' : 'Add Interview Reminder'}</span>
                </button>
              </form>

              {/* Scheduled Reminders List */}
              <div className="lg:col-span-7 space-y-3">
                <h3 className="font-display text-base font-bold text-[#063B7A]">
                  Upcoming &amp; Scheduled Interviews ({reminders.length})
                </h3>

                {reminders.length === 0 ? (
                  <div className="p-8 rounded-xl border border-dashed border-slate-300 text-center">
                    <Clock className="w-8 h-8 text-slate-400 mx-auto" />
                    <p className="mt-2 text-sm font-semibold text-[#063B7A]">
                      No interview reminders scheduled
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Add your upcoming interview date &amp; time on the left to get Calendar (.ics), Email, Browser, and WhatsApp reminders.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {reminders.map((rem) => {
                      const tag = getReminderTimingTag(rem.interviewDate, rem.status);
                      const waSelfHref = `https://wa.me/?text=${encodeURIComponent(
                        `Interview Reminder: ${rem.jobTitle} (${rem.companyName}) on ${rem.interviewDate} at ${rem.interviewTime} (${rem.mode}). Location/Link: ${rem.locationOrLink}`
                      )}`;

                      return (
                        <div
                          key={rem.id}
                          className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs space-y-3"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`px-2 py-0.5 rounded-md border text-[11px] font-bold ${tag.style}`}
                                >
                                  {tag.label}
                                </span>
                                <span className="text-xs font-semibold text-slate-500 tabular-nums">
                                  {rem.interviewDate} · {rem.interviewTime} ({rem.mode})
                                </span>
                              </div>
                              <h4 className="mt-1 font-display text-base font-bold text-[#063B7A]">
                                {rem.jobTitle}
                              </h4>
                              <p className="text-xs text-slate-600">
                                {rem.companyName} · {rem.locationOrLink}
                              </p>
                              {rem.notes && (
                                <p className="mt-1 text-xs text-slate-500">Notes: {rem.notes}</p>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5">
                              {rem.status !== 'Completed' && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    void updateInterviewReminderStatus(rem.id, 'Completed').then(
                                      (res) => onCandidateUpdated(res.candidate)
                                    )
                                  }
                                  className="px-2.5 py-1 rounded-lg bg-[#0A8E43]/10 text-[#0A8E43] text-xs font-semibold cursor-pointer"
                                >
                                  Mark Done
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() =>
                                  void deleteInterviewReminder(rem.id).then((res) =>
                                    onCandidateUpdated(res.candidate)
                                  )
                                }
                                aria-label="Delete reminder"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => downloadIcsFile(rem)}
                              className="px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-[#063B7A] inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Calendar className="w-3.5 h-3.5" />
                              <span>Add to Calendar (.ics)</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => void handleBrowserNotify(rem)}
                              className="px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-[#063B7A] inline-flex items-center gap-1 cursor-pointer"
                            >
                              <BellRing className="w-3.5 h-3.5 text-[#F58220]" />
                              <span>Browser Alert</span>
                            </button>

                            <button
                              type="button"
                              disabled={notifyingId === rem.id}
                              onClick={() => void handleEmailReminderNow(rem.id)}
                              className="px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-[#063B7A] inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Mail className="w-3.5 h-3.5 text-[#0A8E43]" />
                              <span>
                                {notifyingId === rem.id ? 'Sending...' : 'Email Reminder Now'}
                              </span>
                            </button>

                            <a
                              href={waSelfHref}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1.5 rounded-lg bg-[#0A8E43]/10 hover:bg-[#0A8E43]/20 text-xs font-semibold text-[#0A8E43] inline-flex items-center gap-1"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              <span>WhatsApp Self-Reminder</span>
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
