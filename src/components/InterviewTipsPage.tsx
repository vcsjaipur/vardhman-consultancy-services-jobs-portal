import { FormEvent, useState } from 'react';
import { ArrowLeft, FileText, Loader2, Search, Sparkles } from 'lucide-react';
import { AiInterviewCoachResponse } from '../types/portal';
import { generateAiInterviewCoach } from '../utils/candidateApi';
import { AiPanelSkeleton } from './SkeletonLoaders';

interface InterviewTipsPageProps {
  onBackHome: () => void;
  onGoToSearchJobs: () => void;
  onGoToBuildResume: () => void;
}

interface InterviewTip {
  number: string;
  englishTitle: string;
  englishDesc: string;
  actionTitle: string;
  actionDesc: string;
  accent: 'blue' | 'orange' | 'green';
}

const INTERVIEW_TIPS: InterviewTip[] = [
  {
    number: '01',
    englishTitle: 'Dress Clean & Professional',
    englishDesc:
      'Wear neat, well-ironed formal or smart business attire suitable for the industry and role.',
    actionTitle: 'Key Action Step: Prepare Your Attire a Day Early',
    actionDesc:
      'Select and press your interview outfit the evening before so you arrive composed and confident.',
    accent: 'blue',
  },
  {
    number: '02',
    englishTitle: 'Arrive Punctually',
    englishDesc:
      'Reach the venue 15 minutes before your scheduled interview time, or join virtual interviews 5 minutes early.',
    actionTitle: 'Key Action Step: Verify Route or Meeting Link',
    actionDesc:
      'Confirm the office address, contact desk, or video call link and internet stability well ahead of schedule.',
    accent: 'orange',
  },
  {
    number: '03',
    englishTitle: 'Carry Printed Resume & Credentials',
    englishDesc:
      'Keep 2 to 3 printed copies of your updated resume, valid government ID proof, and academic certificates organized.',
    actionTitle: 'Key Action Step: Organize an Interview Portfolio',
    actionDesc:
      'Place all documents in a clean folder and keep a digital PDF copy accessible on your phone.',
    accent: 'green',
  },
  {
    number: '04',
    englishTitle: 'Speak Clearly & Professionally',
    englishDesc:
      'Maintain a calm, composed tone, articulate clearly at a steady pace, and respond with integrity.',
    actionTitle: 'Key Action Step: Structure Your Introduction',
    actionDesc:
      'Prepare a concise 60-second overview covering your background, core strengths, and career goals.',
    accent: 'blue',
  },
  {
    number: '05',
    englishTitle: 'Research the Organization',
    englishDesc:
      'Review the employer profile, products, services, therapeutic focus, and key job responsibilities beforehand.',
    actionTitle: 'Key Action Step: Align Skills to the Role',
    actionDesc:
      'Identify three ways your past achievements directly support the objectives listed in the job description.',
    accent: 'orange',
  },
  {
    number: '06',
    englishTitle: 'Listen Attentively Before Answering',
    englishDesc:
      'Allow the interviewer to finish each question completely, pause thoughtfully, and deliver a focused response.',
    actionTitle: 'Key Action Step: Stay Concise & Relevant',
    actionDesc:
      'Address the exact question first using specific results before sharing supporting context.',
    accent: 'green',
  },
  {
    number: '07',
    englishTitle: 'Maintain Confident Body Language',
    englishDesc:
      'Greet the panel courteously, maintain upright posture, and keep natural, respectful eye contact.',
    actionTitle: 'Key Action Step: Project Calm Professionalism',
    actionDesc:
      'Stay composed throughout the discussion, nodding attentively while interviewers explain role expectations.',
    accent: 'blue',
  },
  {
    number: '08',
    englishTitle: 'Highlight Measurable Experience & Skills',
    englishDesc:
      'Share concrete examples of past responsibilities, territory growth, operational wins, or academic projects.',
    actionTitle: 'Key Action Step: Use Result-Driven Examples',
    actionDesc:
      'Describe the situation, your specific action, and the measurable outcome achieved.',
    accent: 'orange',
  },
  {
    number: '09',
    englishTitle: 'Ask Informed Questions',
    englishDesc:
      'At the conclusion of the interview, ask thoughtful questions about role deliverables, team structure, and growth.',
    actionTitle: 'Key Action Step: Demonstrate Long-Term Interest',
    actionDesc:
      'Ask what key milestones the hiring manager expects in the first 90 days of joining.',
    accent: 'green',
  },
  {
    number: '10',
    englishTitle: 'Follow Up Professionally & Share Feedback',
    englishDesc:
      'Thank the interviewer courteously before leaving, keep your phone reachable, and share same-day interview feedback.',
    actionTitle: 'Key Action Step: Update JobsNia / VCS Promptly',
    actionDesc:
      'Send your interview outcome and feedback on the same day to info@vardhmanconsultancy.com for seamless coordination.',
    accent: 'blue',
  },
];

const ACCENT_STYLES: Record<
  InterviewTip['accent'],
  { badgeBg: string; bar: string }
> = {
  blue: {
    badgeBg: 'bg-gradient-to-br from-[#063B7A] to-[#042A58] text-white',
    bar: 'bg-[#063B7A]',
  },
  orange: {
    badgeBg: 'bg-gradient-to-br from-[#F58220] to-[#D96B0C] text-white',
    bar: 'bg-[#F58220]',
  },
  green: {
    badgeBg: 'bg-gradient-to-br from-[#0A8E43] to-[#077235] text-white',
    bar: 'bg-[#0A8E43]',
  },
};

export function InterviewTipsPage({
  onBackHome,
  onGoToSearchJobs,
  onGoToBuildResume,
}: InterviewTipsPageProps) {
  const [roleTitle, setRoleTitle] = useState('');
  const [skills, setSkills] = useState('');
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachError, setCoachError] = useState('');
  const [coachResult, setCoachResult] = useState<AiInterviewCoachResponse | null>(null);

  const handleGenerateCoach = async (e: FormEvent) => {
    e.preventDefault();
    setCoachError('');
    if (!roleTitle.trim()) {
      setCoachError('Please enter your target job role.');
      return;
    }
    setCoachLoading(true);
    try {
      const res = await generateAiInterviewCoach({
        roleTitle: roleTitle.trim(),
        skills: skills.trim(),
      });
      setCoachResult(res);
    } catch (err) {
      setCoachError(
        err instanceof Error ? err.message : 'Unable to generate interview guide right now.'
      );
    } finally {
      setCoachLoading(false);
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
              JobsNia.com · Vardhman Consultancy Services Candidate Guide
            </p>
            <h1 className="mt-1.5 font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight text-balance">
              10 Essential Interview Preparation Tips
            </h1>
            <p className="mt-2 text-sm sm:text-base text-slate-200 leading-relaxed">
              Clear, structured best practices to help you perform with poise and confidence in every corporate or clinical interview.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-8">
        {/* Role-Specific Interview Coach */}
        <section className="bg-white border border-slate-200 rounded-2xl shadow-md p-5 sm:p-7 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[#F58220] flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" aria-hidden="true" />
                <span>Smart Interview Preparation Coach</span>
              </p>
              <h2 className="mt-0.5 font-display text-lg sm:text-xl font-bold text-[#063B7A]">
                Get Role-Specific Interview Questions &amp; Preparation Guide
              </h2>
            </div>
          </div>

          <form onSubmit={handleGenerateCoach} className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <input
              type="text"
              value={roleTitle}
              onChange={(e) => setRoleTitle(e.target.value)}
              placeholder="Target Job Role (e.g. QA Executive, Medical Representative, Accountant)"
              className="sm:col-span-5 min-h-[44px] px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#063B7A] focus:outline-none"
            />
            <input
              type="text"
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
              placeholder="Key Skills (optional, e.g. GMP, Tally, Territory Sales)"
              className="sm:col-span-4 min-h-[44px] px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#063B7A] focus:outline-none"
            />
            <button
              type="submit"
              disabled={coachLoading}
              className="sm:col-span-3 min-h-[44px] px-5 py-2 rounded-xl bg-[#063B7A] hover:bg-[#042A58] disabled:opacity-60 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              {coachLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 text-[#F58220]" />
              )}
              <span>{coachLoading ? 'Preparing...' : 'Generate Prep Guide'}</span>
            </button>
          </form>

          {coachError && (
            <p className="text-xs sm:text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
              {coachError}
            </p>
          )}

          {coachLoading && <AiPanelSkeleton />}

          {coachResult && (
            <div className="space-y-3 pt-2">
              <div className="flex flex-wrap gap-1.5">
                {coachResult.keyTopics.map((topic, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 rounded-md bg-[#063B7A]/8 text-[#063B7A] text-xs font-semibold"
                  >
                    {topic}
                  </span>
                ))}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {coachResult.questionsAndAnswers.map((qa, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs sm:text-sm"
                  >
                    <p className="font-bold text-[#063B7A]">
                      Q{idx + 1}: {qa.question}
                    </p>
                    <p className="text-slate-700">{qa.englishTip}</p>
                    <p className="text-slate-600 font-medium">{qa.hindiTip}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* 10 Interview Tip Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
          {INTERVIEW_TIPS.map((tip) => {
            const style = ACCENT_STYLES[tip.accent];
            return (
              <article
                key={tip.number}
                className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-10 h-10 rounded-xl font-display text-sm font-extrabold tabular-nums flex items-center justify-center shrink-0 shadow-xs ${style.badgeBg}`}
                    >
                      {tip.number}
                    </span>
                    <h2 className="font-display text-lg sm:text-xl font-bold text-[#063B7A] leading-snug">
                      {tip.englishTitle}
                    </h2>
                  </div>

                  <p className="mt-3 text-sm sm:text-base text-slate-700 leading-relaxed">
                    {tip.englishDesc}
                  </p>

                  <div className="mt-4 pt-3.5 border-t border-slate-100 bg-slate-50/70 -mx-2 px-3 py-2.5 rounded-xl">
                    <p className="text-sm font-bold text-[#063B7A]">
                      {tip.actionTitle}
                    </p>
                    <p className="mt-1 text-sm text-slate-600 leading-relaxed">
                      {tip.actionDesc}
                    </p>
                  </div>
                </div>

                <div
                  className={`mt-5 h-1 w-14 rounded-full ${style.bar}`}
                  aria-hidden="true"
                />
              </article>
            );
          })}
        </div>

        {/* Bottom Helpful Actions */}
        <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xl p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-lg sm:text-xl font-bold text-[#063B7A]">
              Ready for Your Next Interview?
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Prepare a clean PDF resume or explore verified openings now.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onGoToBuildResume}
              className="min-h-[46px] px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#063B7A] to-[#042A58] hover:from-[#053166] hover:to-[#031F42] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 shadow-sm transition-all whitespace-nowrap cursor-pointer"
            >
              <FileText className="w-4 h-4" aria-hidden="true" />
              <span>Build Resume</span>
            </button>
            <button
              type="button"
              onClick={onGoToSearchJobs}
              className="min-h-[46px] px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#F58220] to-[#D96B0C] hover:from-[#e07214] hover:to-[#c25d09] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 shadow-md shadow-[#F58220]/25 transition-all whitespace-nowrap cursor-pointer"
            >
              <Search className="w-4 h-4" aria-hidden="true" />
              <span>Search Jobs</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
