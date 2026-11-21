import { useEffect, useState } from 'react';
import {
  Award,
  CheckCircle2,
  Clock,
  HelpCircle,
  Loader2,
  Mail,
  RotateCcw,
  Sparkles,
  X,
  XCircle,
} from 'lucide-react';
import { CandidateProfile, SkillTestQuestion, SkillTestResult } from '../types/portal';
import { generateAiSkillTest, saveSkillTestResult } from '../utils/candidateApi';
import { AiPanelSkeleton } from './SkeletonLoaders';

interface SkillTestModalProps {
  isOpen: boolean;
  initialTopic?: string;
  candidate: CandidateProfile | null;
  onClose: () => void;
  onCandidateUpdated?: (candidate: CandidateProfile) => void;
}

const PRESET_TOPICS = [
  'Pharmaceutical QA / QC & GMP Compliance',
  'Pharma Sales & Medical Representative',
  'Medical & Clinical Hospital Practice',
  'Accounts, Finance, GST & Tally Prime',
  'HR Operations & Talent Acquisition',
  'IT, Software Engineering & AI',
];

const DIFFICULTIES: Array<'Beginner' | 'Intermediate' | 'Advanced'> = [
  'Beginner',
  'Intermediate',
  'Advanced',
];

export function SkillTestModal({
  isOpen,
  initialTopic = '',
  candidate,
  onClose,
  onCandidateUpdated,
}: SkillTestModalProps) {
  const [topic, setTopic] = useState(initialTopic || PRESET_TOPICS[0]);
  const [difficulty, setDifficulty] = useState<'Beginner' | 'Intermediate' | 'Advanced'>(
    'Intermediate'
  );
  const [sendEmailReport, setSendEmailReport] = useState(true);

  const [step, setStep] = useState<'setup' | 'loading' | 'quiz' | 'result'>('setup');
  const [questions, setQuestions] = useState<SkillTestQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [currentIdx, setCurrentIdx] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(300);
  const [error, setError] = useState('');
  const [savedResult, setSavedResult] = useState<SkillTestResult | null>(null);
  const [savingScore, setSavingScore] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setTopic(initialTopic?.trim() || PRESET_TOPICS[0]);
    setDifficulty('Intermediate');
    setStep('setup');
    setQuestions([]);
    setAnswers({});
    setCurrentIdx(0);
    setSecondsLeft(300);
    setError('');
    setSavedResult(null);
  }, [isOpen, initialTopic]);

  useEffect(() => {
    if (!isOpen || step !== 'quiz') return;
    if (secondsLeft <= 0) {
      void handleFinishQuiz();
      return;
    }
    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, step, secondsLeft]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleStartTest = async () => {
    if (!topic.trim()) {
      setError('Please enter or select a skill topic to begin.');
      return;
    }
    setError('');
    setStep('loading');
    try {
      const response = await generateAiSkillTest({
        topic: topic.trim(),
        difficulty,
      });
      if (!response.questions || response.questions.length === 0) {
        throw new Error('Could not generate assessment questions. Please try again.');
      }
      setQuestions(response.questions);
      setAnswers({});
      setCurrentIdx(0);
      setSecondsLeft(response.questions.length * 60);
      setStep('quiz');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to start AI skill test right now.'
      );
      setStep('setup');
    }
  };

  const correctCount = questions.reduce((acc, q) => {
    return acc + (answers[q.id] === q.correctIndex ? 1 : 0);
  }, 0);

  const scorePercent =
    questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;

  const handleFinishQuiz = async () => {
    setStep('result');
    if (!candidate || candidate.role !== 'candidate') return;
    setSavingScore(true);
    try {
      const res = await saveSkillTestResult({
        topic: topic.trim(),
        difficulty,
        totalQuestions: questions.length,
        correctAnswers: correctCount,
        sendEmailReport: Boolean(candidate.emailNotificationsEnabled ?? true) && sendEmailReport,
      });
      setSavedResult(res.result);
      if (onCandidateUpdated) {
        onCandidateUpdated(res.candidate);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Score evaluated, but saving failed.');
    } finally {
      setSavingScore(false);
    }
  };

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const activeQuestion = questions[currentIdx];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/55 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="skill-test-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-r from-[#041C3F] via-[#062856] to-[#083B7E] px-5 sm:px-6 py-4 flex items-center justify-between gap-4 text-white shrink-0">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#F6D574] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              <span>VCS Portal Skill Assessment</span>
            </p>
            <h2 id="skill-test-modal-title" className="font-display text-lg sm:text-xl font-extrabold">
              AI Verified Skill Test
            </h2>
          </div>

          <div className="flex items-center gap-2.5">
            {step === 'quiz' && (
              <span className="px-3 py-1 rounded-lg bg-white/15 border border-white/25 text-xs font-bold tabular-nums inline-flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#F6D574]" aria-hidden="true" />
                <span>
                  {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
                </span>
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close skill test modal"
              className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {step === 'setup' && (
            <>
              <p className="text-sm text-slate-600 leading-relaxed">
                Earn a verified skill badge on your Vardhman Consultancy Services profile to boost your Smart Match score and stand out to hiring managers.
              </p>

              <div>
                <span className="block text-xs font-bold text-[#062856] mb-2">
                  Choose a Role / Domain Preset
                </span>
                <div className="flex flex-wrap gap-2">
                  {PRESET_TOPICS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setTopic(preset)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                        topic === preset
                          ? 'bg-[#062856] border-[#062856] text-white'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-[#062856]'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label
                  htmlFor="skill-test-topic"
                  className="block text-xs font-bold text-[#062856] mb-1.5"
                >
                  Or Enter Any Specific Skill / Role Topic
                </label>
                <input
                  id="skill-test-topic"
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. Regulatory Affairs, Tally Prime, Cardiology ICU"
                  className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#062856] focus:outline-none"
                />
              </div>

              <div>
                <span className="block text-xs font-bold text-[#062856] mb-2">
                  Difficulty Level
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {DIFFICULTIES.map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setDifficulty(lvl)}
                      className={`min-h-[40px] px-3 py-2 rounded-xl border text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
                        difficulty === lvl
                          ? 'bg-[#D4AF37] border-[#D4AF37] text-[#041C3F]'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-[#062856]'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              {candidate && candidate.role === 'candidate' && (
                <label className="flex items-center gap-2 text-xs sm:text-sm text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sendEmailReport}
                    onChange={(e) => setSendEmailReport(e.target.checked)}
                    className="rounded border-slate-300 text-[#062856] focus:ring-[#062856]"
                  />
                  <Mail className="w-4 h-4 text-[#0A8E43]" aria-hidden="true" />
                  <span>Email skill test certificate &amp; score report to {candidate.email}</span>
                </label>
              )}

              {error && (
                <p
                  className="text-xs sm:text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5"
                  role="alert"
                >
                  {error}
                </p>
              )}

              <div className="pt-2 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleStartTest()}
                  className="min-h-[44px] px-6 py-2 rounded-xl bg-[#062856] hover:bg-[#041C3F] text-white text-sm font-bold inline-flex items-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-[#F6D574]" aria-hidden="true" />
                  <span>Generate 5-Question AI Test</span>
                </button>
              </div>
            </>
          )}

          {step === 'loading' && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-2.5 text-sm font-semibold text-[#062856]">
                <Loader2 className="w-4 h-4 animate-spin text-[#F58220]" aria-hidden="true" />
                <span>Generating AI assessment for &ldquo;{topic}&rdquo; ({difficulty})...</span>
              </div>
              <AiPanelSkeleton />
              <AiPanelSkeleton />
            </div>
          )}

          {step === 'quiz' && activeQuestion && (
            <div className="space-y-5">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                <span>
                  Question {currentIdx + 1} of {questions.length}
                </span>
                <span className="text-[#062856]">
                  Answered: {Object.keys(answers).length}/{questions.length}
                </span>
              </div>

              <div className="p-4 sm:p-5 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-sm sm:text-base font-bold text-[#062856] leading-snug flex items-start gap-2">
                  <HelpCircle className="w-5 h-5 text-[#F58220] shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{activeQuestion.question}</span>
                </p>

                <div className="mt-4 space-y-2.5">
                  {activeQuestion.options.map((opt, idx) => {
                    const selected = answers[activeQuestion.id] === idx;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() =>
                          setAnswers((prev) => ({
                            ...prev,
                            [activeQuestion.id]: idx,
                          }))
                        }
                        className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-all cursor-pointer flex items-center gap-3 ${
                          selected
                            ? 'bg-[#062856] border-[#062856] text-white shadow-sm'
                            : 'bg-white border-slate-200 text-slate-800 hover:border-[#062856]'
                        }`}
                      >
                        <span
                          className={`w-6 h-6 rounded-md text-xs font-bold flex items-center justify-center shrink-0 ${
                            selected
                              ? 'bg-[#D4AF37] text-[#041C3F]'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {String.fromCharCode(65 + idx)}
                        </span>
                        <span>{opt}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  disabled={currentIdx === 0}
                  onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
                  className="min-h-[42px] px-4 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold text-[#062856] disabled:opacity-40 cursor-pointer"
                >
                  Previous
                </button>

                {currentIdx < questions.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setCurrentIdx((i) => Math.min(questions.length - 1, i + 1))}
                    className="min-h-[42px] px-5 py-2 rounded-xl bg-[#062856] hover:bg-[#041C3F] text-white text-xs sm:text-sm font-semibold cursor-pointer"
                  >
                    Next Question
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleFinishQuiz()}
                    className="min-h-[42px] px-6 py-2 rounded-xl bg-[#0A8E43] hover:bg-[#087537] text-white text-xs sm:text-sm font-bold cursor-pointer"
                  >
                    Submit &amp; View Score
                  </button>
                )}
              </div>
            </div>
          )}

          {step === 'result' && (
            <div className="space-y-5">
              <div className="p-5 rounded-2xl bg-gradient-to-br from-[#062856] to-[#083B7E] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-[#F6D574]">
                    Assessment Completed · {topic}
                  </p>
                  <h3 className="mt-1 font-display text-2xl font-extrabold tabular-nums">
                    Score: {scorePercent}% ({correctCount}/{questions.length})
                  </h3>
                  <p className="mt-1 text-xs sm:text-sm text-slate-200">
                    {savingScore
                      ? 'Saving verified badge to your profile...'
                      : savedResult
                        ? `Badge Earned: ${savedResult.badgeLabel} (Saved to Profile)`
                        : scorePercent >= 80
                          ? 'Badge Level: Top Performer'
                          : scorePercent >= 60
                            ? 'Badge Level: Verified Skill'
                            : 'Keep practicing! Score 60%+ to earn a Verified Skill badge.'}
                  </p>
                </div>

                <div className="w-16 h-16 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center shrink-0">
                  <Award className="w-8 h-8 text-[#F6D574]" aria-hidden="true" />
                </div>
              </div>

              {error && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
                  {error}
                </p>
              )}

              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#062856]">
                  Answer Review &amp; Explanations
                </h4>
                {questions.map((q, idx) => {
                  const chosen = answers[q.id];
                  const isCorrect = chosen === q.correctIndex;
                  return (
                    <div
                      key={q.id}
                      className={`p-4 rounded-xl border ${
                        isCorrect
                          ? 'bg-[#0A8E43]/5 border-[#0A8E43]/30'
                          : 'bg-red-50/50 border-red-200'
                      }`}
                    >
                      <p className="text-sm font-bold text-[#062856] flex items-start gap-2">
                        {isCorrect ? (
                          <CheckCircle2 className="w-4 h-4 text-[#0A8E43] shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                        )}
                        <span>
                          {idx + 1}. {q.question}
                        </span>
                      </p>
                      <p className="mt-1.5 text-xs text-slate-700">
                        <span className="font-semibold">Correct Answer:</span>{' '}
                        {q.options[q.correctIndex]}
                      </p>
                      {!isCorrect && typeof chosen === 'number' && (
                        <p className="text-xs text-red-700">
                          <span className="font-semibold">Your Answer:</span> {q.options[chosen]}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                        {q.explanation}
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="pt-2 flex flex-wrap items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setStep('setup')}
                  className="min-h-[42px] px-4 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold text-[#062856] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" aria-hidden="true" />
                  <span>Take Another Test</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[42px] px-5 py-2 rounded-xl bg-[#062856] hover:bg-[#041C3F] text-white text-xs sm:text-sm font-semibold cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
