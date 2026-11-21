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
  hindiTitle: string;
  hindiDesc: string;
  accent: 'blue' | 'orange' | 'green';
}

const INTERVIEW_TIPS: InterviewTip[] = [
  {
    number: '01',
    englishTitle: 'Dress Clean & Professional',
    englishDesc:
      'Wear neat, well-ironed formal or clean smart attire suitable for the job role.',
    hindiTitle: 'साफ और प्रोफेशनल कपड़े पहनें',
    hindiDesc:
      'इंटरव्यू के लिए साफ, प्रेस किए हुए फॉर्मल या शालीन कपड़े पहनकर जाएं।',
    accent: 'blue',
  },
  {
    number: '02',
    englishTitle: 'Reach On Time',
    englishDesc:
      'Arrive 15 minutes before your scheduled interview time or join online calls 5 minutes early.',
    hindiTitle: 'समय से पहले पहुंचें',
    hindiDesc:
      'तय समय से 15 मिनट पहले पहुंचें या ऑनलाइन इंटरव्यू में 5 मिनट पहले जुड़ें।',
    accent: 'orange',
  },
  {
    number: '03',
    englishTitle: 'Carry Printed Resume & Documents',
    englishDesc:
      'Keep 2–3 printed copies of your updated resume, ID proof, and education certificates ready.',
    hindiTitle: 'अपना रिज्यूमे और डॉक्यूमेंट साथ रखें',
    hindiDesc:
      'अपने अपडेटेड रिज्यूमे की 2–3 कॉपी, पहचान पत्र और सर्टिफिकेट फाइल में रखें।',
    accent: 'green',
  },
  {
    number: '04',
    englishTitle: 'Speak Confidently & Clearly',
    englishDesc:
      'Maintain a calm voice, speak clearly at a steady pace, and answer honestly.',
    hindiTitle: 'आत्मविश्वास और स्पष्टता से बात करें',
    hindiDesc:
      'शांत और साफ आवाज में बात करें, जल्दबाजी न करें और ईमानदारी से जवाब दें।',
    accent: 'blue',
  },
  {
    number: '05',
    englishTitle: 'Know About The Company',
    englishDesc:
      'Read about the company profile, products, services, and the job description before going.',
    hindiTitle: 'कंपनी के बारे में जानकारी पढ़ें',
    hindiDesc:
      'इंटरव्यू से पहले कंपनी क्या काम करती है और आपकी जॉब रोल क्या है, यह जरूर पढ़ें।',
    accent: 'orange',
  },
  {
    number: '06',
    englishTitle: 'Listen Carefully Before Answering',
    englishDesc:
      'Let the interviewer finish the question completely, pause briefly, and give a focused answer.',
    hindiTitle: 'सवाल ध्यान से सुनें, फिर जवाब दें',
    hindiDesc:
      'इंटरव्यू लेने वाले की बात पूरी सुनें, एक पल सोचें और फिर सटीक जवाब दें।',
    accent: 'green',
  },
  {
    number: '07',
    englishTitle: 'Maintain Positive Body Language',
    englishDesc:
      'Greet with a polite smile, sit straight, and keep natural eye contact while speaking.',
    hindiTitle: 'सकारात्मक बॉडी लैंग्वेज रखें',
    hindiDesc:
      'मुस्कान के साथ अभिवादन करें, सीधे बैठें और बात करते समय नजर मिलाकर बात करें।',
    accent: 'blue',
  },
  {
    number: '08',
    englishTitle: 'Highlight Your Skills & Experience',
    englishDesc:
      'Share real examples of past work, achievements, or college projects that match the job.',
    hindiTitle: 'अपनी स्किल्स और अनुभव सही से बताएं',
    hindiDesc:
      'अपने पिछले काम, अनुभव या प्रोजेक्ट के उदाहरण बताएं जो इस नौकरी से मेल खाते हों।',
    accent: 'orange',
  },
  {
    number: '09',
    englishTitle: 'Ask Thoughtful Questions',
    englishDesc:
      'At the end, ask polite questions about daily responsibilities, team structure, or growth.',
    hindiTitle: 'इंटरव्यू के अंत में सही सवाल पूछें',
    hindiDesc:
      'अंत में काम की जिम्मेदारियों, टीम और आगे बढ़ने के अवसरों के बारे में विनम्र सवाल पूछें।',
    accent: 'green',
  },
  {
    number: '10',
    englishTitle: 'Say Thank You Politely',
    englishDesc:
      'Thank the interviewer for their time before leaving and keep your phone reachable for updates.',
    hindiTitle: 'धन्यवाद कहें और फोन चालू रखें',
    hindiDesc:
      'इंटरव्यू खत्म होने पर धन्यवाद कहें और रिजल्ट या कॉल के लिए अपना फोन चालू रखें।',
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
        err instanceof Error ? err.message : 'Unable to generate interview prep right now.'
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
              Vardhman Consultancy Services · Candidate Career Guide
            </p>
            <h1 className="mt-1.5 font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight text-balance">
              10 Interview Tips (Hindi + English)
            </h1>
            <p className="mt-2 text-sm sm:text-base text-slate-200 leading-relaxed">
              Simple, practical preparation steps in English and Hindi to help you succeed in every interview.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-8">
        {/* AI Personalized Interview Coach */}
        <section className="bg-white border border-slate-200 rounded-2xl shadow-md p-5 sm:p-7 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[#F58220] flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" aria-hidden="true" />
                <span>AI Interview Coach (English + Hindi)</span>
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
              <span>{coachLoading ? 'Preparing...' : 'Generate AI Guide'}</span>
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
                    <p className="text-sm sm:text-base font-bold text-[#063B7A]">
                      {tip.hindiTitle}
                    </p>
                    <p className="mt-1 text-sm text-slate-600 leading-relaxed">
                      {tip.hindiDesc}
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

