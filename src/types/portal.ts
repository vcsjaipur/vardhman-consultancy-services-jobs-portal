export interface JobSearchFilters {
  keyword: string;
  location: string;
  experience: string;
  salary: string;
}

export interface SearchPageFilters extends JobSearchFilters {
  designation: string;
}

export type UserRole = 'candidate' | 'employer' | 'admin';
export type JobApprovalStatus = 'Pending' | 'Approved' | 'Rejected';

export interface JobListing {
  id: string;
  title: string;
  jobTitle?: string;
  designation: string;
  company: string;
  clientName?: string;
  companyMasked?: string;
  location: string;
  experience: string;
  salary: string;
  postedAt: string;
  createdAt?: string;
  description: string;
  jobDescription?: string;
  qualification: string;
  skills: string[];
  openings: number;
  openingsCount?: number;
  jobType?: string;
  lastDateToApply?: string;
  lastDate?: string;
  recruiterName?: string;
  recruiterEmail?: string;
  recruiterPhone?: string;
  employerId?: string;
  status?: JobApprovalStatus;
}

export type PortalPageView =
  | 'home'
  | 'about-us'
  | 'search-jobs'
  | 'job-details'
  | 'register'
  | 'login'
  | 'dashboard'
  | 'post-job'
  | 'employer-dashboard'
  | 'admin-dashboard'
  | 'contact-us'
  | 'build-resume'
  | 'interview-tips'
  | 'job-seeker-terms'
  | 'congratulations'
  | 'vcs-insights';

export interface CongratulationsContext {
  type: 'register' | 'apply';
  candidateName?: string;
  jobTitle?: string;
  companyMasked?: string;
}

export type PortalModalType =
  | 'apply'
  | 'upload-resume'
  | 'post-job'
  | 'register'
  | 'login'
  | 'contact'
  | null;

export interface AcademicEntry {
  id: string;
  degree: string;
  institution: string;
  specialization?: string;
  yearOfPassing: string;
  percentageOrGrade?: string;
}

export interface WorkExperienceEntry {
  id: string;
  company: string;
  designation: string;
  fromDate: string;
  toDate: string;
  currentlyWorking?: boolean;
  responsibilities?: string;
}

export interface CandidateProfile {
  id: string;
  role: UserRole;
  name: string;
  email: string;
  phone: string;
  city: string;
  experience: string;
  companyName?: string | null;
  fullAddress?: string | null;
  gstNumber?: string | null;
  tanNumber?: string | null;
  panNumber?: string | null;
  accountDetails?: string | null;
  photoUrl?: string | null;
  resumeId: string | null;
  resumeFileName: string | null;
  resumeUpdatedAt: string | null;
  createdAt: string;
  hasPin?: boolean;
  fatherName?: string | null;
  motherName?: string | null;
  maritalStatus?: string | null;
  spouseName?: string | null;
  emergencyContact?: string | null;
  dob?: string | null;
  state?: string | null;
  districtCity?: string | null;
  pinCode?: string | null;
  qualification?: string | null;
  designation?: string | null;
  currentCompany?: string | null;
  currentCtc?: string | null;
  expectedSalary?: string | null;
  noticePeriod?: string | null;
  keySkills?: string[];
  preferredLocation?: string | null;
  preferredRole?: string | null;
  jobType?: string | null;
  resumeHeadline?: string | null;
  profileSummary?: string | null;
  careerSummary?: string | null;
  resumeSummary?: string | null;
  academicDetails?: AcademicEntry[];
  workExperience?: WorkExperienceEntry[];
  termsAccepted?: boolean;
  profileCompleteness?: number;
  emailNotificationsEnabled?: boolean;
  whatsappAlertsEnabled?: boolean;
  whatsappNumber?: string | null;
  alertCity?: string | null;
  alertCategory?: string | null;
  autoApplyConfig?: AutoApplyConfig;
  skillTestResults?: SkillTestResult[];
  interviewReminders?: InterviewReminder[];
  searchHistory?: SearchHistoryItem[];
}

export interface SearchHistoryItem {
  id: string;
  keyword: string;
  location: string;
  experience?: string;
  salary?: string;
  designation?: string;
  createdAt: string;
}

export interface SkillTestQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface SkillTestResult {
  id: string;
  topic: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  totalQuestions: number;
  correctAnswers: number;
  scorePercent: number;
  badgeLabel: 'Top Performer' | 'Verified Skill' | 'Completed';
  completedAt: string;
}

export interface AutoApplyConfig {
  enabled: boolean;
  minMatchScore: number;
  preferredKeywords: string;
  preferredLocations: string;
  maxDailyApps: number;
  lastRunAt?: string | null;
  lastRunCount?: number;
}

export interface AutoApplyLogEntry {
  id: string;
  jobId: string;
  jobTitle: string;
  matchScore: number;
  appliedAt: string;
}

export interface InterviewReminder {
  id: string;
  jobId?: string | null;
  jobTitle: string;
  companyName: string;
  interviewDate: string; // YYYY-MM-DD
  interviewTime: string; // HH:mm
  mode: 'Video Call' | 'In-Person' | 'Phone Screen';
  locationOrLink: string;
  notes?: string;
  emailSentAt?: string | null;
  status: 'Scheduled' | 'Completed' | 'Cancelled';
  createdAt: string;
}

export interface NotificationPreferences {
  emailNotificationsEnabled: boolean;
  whatsappAlertsEnabled: boolean;
  whatsappNumber: string;
  alertCity: string;
  alertCategory: string;
  autoApplyConfig: AutoApplyConfig;
}

export interface SmartMatchResult {
  score: number; // 0-100
  label: 'Top Match' | 'Strong Match' | 'Good Fit' | 'Moderate Fit';
  matchedSkills: string[];
  reasons: string[];
}

export interface AiJobAnalysis {
  fitScore: number;
  summary: string;
  matchedStrengths: string[];
  missingOrImproveSkills: string[];
  applicationTip: string;
}

export interface AiResumeAssistResponse {
  resumeHeadline: string;
  profileSummary: string;
  careerSummary: string;
  resumeSummary: string;
  careerObjective: string;
  suggestedSkills: string[];
}

export interface AiInterviewCoachResponse {
  roleTitle: string;
  keyTopics: string[];
  questionsAndAnswers: Array<{
    question: string;
    englishTip: string;
    hindiTip: string;
  }>;
  closingChecklist: string[];
}

export interface EmailDispatchSummary {
  id: string;
  type:
    | 'employer-requirement'
    | 'employer-autoreply'
    | 'candidate-application'
    | 'contact-inquiry'
    | 'job-alert'
    | 'auto-apply-digest'
    | 'interview-reminder'
    | 'skill-test-report'
    | 'auth-otp';
  from: string;
  replyTo?: string | null;
  to: string;
  cc?: string | null;
  subject: string;
  deliveredVia: 'smtp' | 'queued';
  environmentMode?: 'published-domain' | 'dev-gmail';
  smtpHostUsed?: string | null;
  lastError?: string | null;
  createdAt: string;
}

export interface AdminEmailStatusResponse {
  smtpConfigured: boolean;
  primaryMode: 'published-domain' | 'dev-gmail';
  configuredTransports: Array<{
    mode: 'published-domain' | 'dev-gmail';
    host: string;
    port: number;
    user: string;
  }>;
  forwardRecipients: string[];
  totalDispatches: number;
  sentCount: number;
  queuedCount: number;
  recentDispatches: Array<{
    id: string;
    type: string;
    to: string;
    cc?: string | null;
    subject: string;
    deliveredVia: 'smtp' | 'queued';
    smtpHostUsed?: string | null;
    lastError?: string | null;
    createdAt: string;
  }>;
}

export interface SearchSuggestionItem {
  value: string;
  label: string;
  category: 'Recent' | 'Live Jobs' | 'Popular' | 'AI';
  matchCount?: number;
}

export interface AiCareerCopilotRecommendation {
  jobId: string;
  fitScore: number;
  reason: string;
}

export interface AiCareerCopilotResponse {
  summary: string;
  recommendations: AiCareerCopilotRecommendation[];
  suggestedFilters: {
    keyword: string;
    location: string;
    experience: string;
  };
  suggestedQueries: string[];
}

export interface AiCoverLetterResponse {
  subjectLine: string;
  coverNote: string;
  pitchHighlights: string[];
}

export interface JobAlertPreviewJob {
  id: string;
  title: string;
  location: string;
  salary: string;
}

export interface JobAlertSubscriberSummary {
  id: string;
  name: string;
  email: string;
  city: string;
  category: string;
  createdAt: string;
}

export interface AdminJobAlertsOverview {
  subscribers: JobAlertSubscriberSummary[];
  subscribersCount: number;
  optedInCandidatesCount: number;
  totalAlertsSent: number;
}

export interface JobApplication {
  id: string;
  candidateId: string;
  jobId: string;
  jobTitle: string;
  companyMasked: string;
  location: string;
  salary: string;
  experience: string;
  applicantName: string;
  applicantEmail: string;
  applicantPhone: string;
  city?: string;
  qualificationExperience?: string;
  resumeSummary?: string;
  resumeId: string;
  resumeFileName: string;
  resumeBase64?: string;
  termsAccepted?: boolean;
  appliedAt: string;
  status: 'Submitted';
  autoApplied?: boolean;
  source?: 'resume-godam' | 'applications' | 'shared-portal' | 'server';
}

export type InsightCategory =
  | 'Official Update'
  | 'Industry Insights'
  | 'Career Guidance'
  | 'Verified Opportunities';

export interface InsightComment {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  authorRole: UserRole;
  content: string;
  createdAt: string;
}

export interface InsightPost {
  id: string;
  title: string;
  description: string;
  category: InsightCategory;
  hashtags?: string[];
  ctaLabel?: string | null;
  imageUrl: string | null;
  authorId: string;
  authorName: string;
  likesCount: number;
  likedByViewer: boolean;
  comments: InsightComment[];
  createdAt: string;
  updatedAt: string | null;
}

export type FirestoreErrorDatabase = 'primary' | 'shared' | 'api';

export interface FirestoreSubscriptionError {
  feedKey: string;
  sourceLabel: string;
  database: FirestoreErrorDatabase;
  operationType: string;
  path: string;
  code: string;
  friendlyMessage: string;
  rawMessage: string;
  severity: 'critical' | 'warning';
  timestamp: string;
}

export interface AdminErrorNotification extends FirestoreSubscriptionError {
  id: string;
  occurrences: number;
  firstOccurredAt: string;
  lastOccurredAt: string;
  resolved: boolean;
  resolvedAt?: string;
  dismissed: boolean;
}


