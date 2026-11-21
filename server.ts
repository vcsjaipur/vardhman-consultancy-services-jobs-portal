import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import nodemailer from 'nodemailer';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const RESUMES_DIR = path.join(DATA_DIR, 'resumes');
const INSIGHTS_IMAGES_DIR = path.join(DATA_DIR, 'insight-images');
const PROFILE_PHOTOS_DIR = path.join(DATA_DIR, 'profile-photos');
const DB_PATH = path.join(DATA_DIR, 'portal-db.json');
const SECRET_PATH = path.join(DATA_DIR, '.session-secret');
const MAX_PDF_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
const DESIGNATED_ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'cvforvcs@gmail.com').trim().toLowerCase();
const VCS_OFFICIAL_EMAIL = 'info@vardhmanconsultancy.com';
const GMAIL_SMTP_SENDER = 'contact2vardhmanconsultancy@gmail.com';
const CONFIDENTIAL_COMPANY_LABEL = 'Confidential - Apply via VCS';

type UserRole = 'candidate' | 'employer' | 'admin';
type JobApprovalStatus = 'Pending' | 'Approved' | 'Rejected';
type InsightCategory =
  | 'Official Update'
  | 'Industry Insights'
  | 'Career Guidance'
  | 'Verified Opportunities';

interface StoredAcademicEntry {
  id: string;
  degree: string;
  institution: string;
  specialization?: string;
  yearOfPassing: string;
  percentageOrGrade?: string;
}

interface StoredWorkExperienceEntry {
  id: string;
  company: string;
  designation: string;
  fromDate: string;
  toDate: string;
  currentlyWorking?: boolean;
  responsibilities?: string;
}

interface StoredCandidate {
  id: string;
  role?: UserRole;
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
  photoFileName?: string | null;
  photoUrl?: string | null;
  passwordSalt: string;
  passwordHash: string;
  pinSalt?: string | null;
  pinHash?: string | null;
  resumeId: string | null;
  resumeFileName: string | null;
  resumeUpdatedAt: string | null;
  createdAt: string;
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
  academicDetails?: StoredAcademicEntry[];
  workExperience?: StoredWorkExperienceEntry[];
  termsAccepted?: boolean;
  termsAcceptedAt?: string | null;
  profileCompleteness?: number;
  emailNotificationsEnabled?: boolean;
  whatsappAlertsEnabled?: boolean;
  whatsappNumber?: string | null;
  alertCity?: string | null;
  alertCategory?: string | null;
  autoApplyConfig?: StoredAutoApplyConfig;
  skillTestResults?: StoredSkillTestResult[];
  interviewReminders?: StoredInterviewReminder[];
  searchHistory?: StoredSearchHistoryItem[];
}

interface StoredSearchHistoryItem {
  id: string;
  keyword: string;
  location: string;
  experience?: string;
  salary?: string;
  designation?: string;
  createdAt: string;
}

interface StoredSkillTestResult {
  id: string;
  topic: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  totalQuestions: number;
  correctAnswers: number;
  scorePercent: number;
  badgeLabel: 'Top Performer' | 'Verified Skill' | 'Completed';
  completedAt: string;
}

interface StoredAutoApplyConfig {
  enabled: boolean;
  minMatchScore: number;
  preferredKeywords: string;
  preferredLocations: string;
  maxDailyApps: number;
  lastRunAt?: string | null;
  lastRunCount?: number;
}

interface StoredInterviewReminder {
  id: string;
  jobId?: string | null;
  jobTitle: string;
  companyName: string;
  interviewDate: string;
  interviewTime: string;
  mode: 'Video Call' | 'In-Person' | 'Phone Screen';
  locationOrLink: string;
  notes?: string;
  emailSentAt?: string | null;
  status: 'Scheduled' | 'Completed' | 'Cancelled';
  createdAt: string;
}

interface StoredApplication {
  id: string;
  candidateId: string;
  jobId: string;
  jobTitle: string;
  companyMasked: string;
  location: string;
  salary: string;
  experience: string;
  city?: string;
  qualificationExperience?: string;
  resumeSummary?: string;
  applicantName: string;
  applicantEmail: string;
  applicantPhone: string;
  resumeId: string;
  resumeFileName: string;
  termsAccepted?: boolean;
  appliedAt: string;
  status: 'Submitted';
  autoApplied?: boolean;
}

interface StoredJob {
  id: string;
  employerId: string;
  company: string;
  companyMasked: string;
  recruiterName: string;
  recruiterEmail: string;
  recruiterPhone: string;
  title: string;
  designation: string;
  location: string;
  experience: string;
  salary: string;
  jobType: string;
  skills: string[];
  description: string;
  qualification: string;
  openings: number;
  lastDateToApply: string;
  postedAt: string;
  createdAt: string;
  status: JobApprovalStatus;
}

interface StoredJobAlert {
  id: string;
  name: string;
  whatsappNumber: string;
  email?: string | null;
  channels?: Array<'whatsapp' | 'email'>;
  city: string;
  category: string;
  createdAt: string;
}

interface StoredContactInquiry {
  id: string;
  name: string;
  email: string;
  phone: string;
  companyName?: string | null;
  message: string;
  createdAt: string;
}

interface StoredInsightComment {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  authorRole: UserRole;
  content: string;
  createdAt: string;
}

interface StoredInsightPost {
  id: string;
  title: string;
  description: string;
  category: InsightCategory;
  hashtags?: string[];
  ctaLabel?: string | null;
  imageFileName: string | null;
  imageUrl: string | null;
  authorId: string;
  authorName: string;
  likedByIds: string[];
  comments: StoredInsightComment[];
  createdAt: string;
  updatedAt: string | null;
}

interface StoredEmailDispatch {
  id: string;
  type:
    | 'employer-requirement'
    | 'employer-autoreply'
    | 'candidate-application'
    | 'contact-inquiry'
    | 'job-alert'
    | 'auto-apply-digest'
    | 'interview-reminder'
    | 'skill-test-report';
  from: string;
  replyTo?: string | null;
  to: string;
  cc: string | null;
  subject: string;
  text: string;
  deliveredVia: 'smtp' | 'queued';
  environmentMode?: 'published-domain' | 'dev-gmail';
  relatedEntityId: string;
  createdAt: string;
}

interface PortalDatabase {
  candidates: StoredCandidate[];
  applications: StoredApplication[];
  jobs: StoredJob[];
  jobAlerts: StoredJobAlert[];
  contacts: StoredContactInquiry[];
  insightsPosts: StoredInsightPost[];
  emailDispatches: StoredEmailDispatch[];
}

interface AuthenticatedRequest extends Request {
  candidate?: StoredCandidate;
}

function ensureDataDirs(): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(RESUMES_DIR, { recursive: true });
  fs.mkdirSync(INSIGHTS_IMAGES_DIR, { recursive: true });
  fs.mkdirSync(PROFILE_PHOTOS_DIR, { recursive: true });
  if (!fs.existsSync(DB_PATH)) {
    const emptyDb: PortalDatabase = {
      candidates: [],
      applications: [],
      jobs: [],
      jobAlerts: [],
      contacts: [],
      insightsPosts: [],
      emailDispatches: [],
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(emptyDb, null, 2), 'utf8');
  }
}

function getSessionSecret(): string {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.trim().length >= 16) {
    return process.env.SESSION_SECRET.trim();
  }
  ensureDataDirs();
  if (fs.existsSync(SECRET_PATH)) {
    const existing = fs.readFileSync(SECRET_PATH, 'utf8').trim();
    if (existing.length >= 32) return existing;
  }
  const generated = crypto.randomBytes(48).toString('hex');
  fs.writeFileSync(SECRET_PATH, generated, 'utf8');
  return generated;
}

const SESSION_SECRET = getSessionSecret();

function normalizeEmail(raw: unknown): string {
  return String(raw ?? '').trim().toLowerCase();
}

function normalizeMobileNumber(raw: unknown): string {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length > 10) {
    return digits.slice(-10);
  }
  return digits;
}

function readDb(): PortalDatabase {
  ensureDataDirs();
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<PortalDatabase>;
    const rawCandidates = Array.isArray(parsed.candidates) ? parsed.candidates : [];
    const candidates = rawCandidates.map((c) => {
      const normalizedPhone = normalizeMobileNumber(c.phone);
      return {
        ...c,
        email: normalizeEmail(c.email),
        phone: normalizedPhone.length === 10 ? normalizedPhone : String(c.phone || '').trim(),
      };
    });
    return {
      candidates,
      applications: Array.isArray(parsed.applications) ? parsed.applications : [],
      jobs: Array.isArray(parsed.jobs) ? parsed.jobs : [],
      jobAlerts: Array.isArray(parsed.jobAlerts) ? parsed.jobAlerts : [],
      contacts: Array.isArray(parsed.contacts) ? parsed.contacts : [],
      insightsPosts: Array.isArray(parsed.insightsPosts) ? parsed.insightsPosts : [],
      emailDispatches: Array.isArray(parsed.emailDispatches) ? parsed.emailDispatches : [],
    };
  } catch {
    return {
      candidates: [],
      applications: [],
      jobs: [],
      jobAlerts: [],
      contacts: [],
      insightsPosts: [],
      emailDispatches: [],
    };
  }
}

function writeDb(db: PortalDatabase): void {
  ensureDataDirs();
  const tmpPath = `${DB_PATH}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(db, null, 2), 'utf8');
  fs.renameSync(tmpPath, DB_PATH);
}

const DOMAIN_SMTP_HOST = 'mail.vardhmanconsultancy.com';

function isPublishedEnvironment(): boolean {
  if (process.env.NODE_ENV === 'production') return true;
  const appUrl = (process.env.APP_URL || '').toLowerCase();
  if (appUrl.includes('ais-pre-')) return true;
  if (
    appUrl &&
    !appUrl.includes('ais-dev-') &&
    !appUrl.includes('localhost') &&
    !appUrl.includes('127.0.0.1')
  ) {
    return true;
  }
  return false;
}

function cleanSmtpHostString(rawHost: string | undefined): string {
  return String(rawHost ?? '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '')
    .toLowerCase();
}

function sanitizeDisplayName(rawName: string | undefined): string {
  return String(rawName ?? '')
    .replace(/[\r\n"<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatFromHeader(displayName: string | undefined, senderEmail: string): string {
  const safeName = sanitizeDisplayName(displayName) || 'Vardhman Consultancy Services';
  return `"${safeName}" <${senderEmail}>`;
}

function resolveActiveSmtpConfig(): {
  mode: 'published-domain' | 'dev-gmail';
  host: string;
  port: number;
  secure: boolean;
  user: string;
  fromEmail: string;
  pass: string;
} {
  if (isPublishedEnvironment()) {
    const candidateHost =
      cleanSmtpHostString(process.env.PROD_SMTP_HOST) ||
      cleanSmtpHostString(process.env.DOMAIN_SMTP_HOST) ||
      cleanSmtpHostString(process.env.SMTP_HOST);
    const host =
      !candidateHost || candidateHost.includes('gmail.com')
        ? DOMAIN_SMTP_HOST
        : candidateHost;
    const port =
      Number(
        process.env.PROD_SMTP_PORT || process.env.DOMAIN_SMTP_PORT || process.env.SMTP_PORT
      ) || 587;
    const secure =
      String(
        process.env.PROD_SMTP_SECURE ??
          process.env.DOMAIN_SMTP_SECURE ??
          process.env.SMTP_SECURE ??
          'false'
      ).toLowerCase() === 'true';

    const rawUser = (
      process.env.PROD_SMTP_USER ||
      process.env.DOMAIN_SMTP_USER ||
      process.env.SMTP_USER ||
      ''
    )
      .trim()
      .toLowerCase();
    const user = !rawUser || rawUser.endsWith('@gmail.com') ? VCS_OFFICIAL_EMAIL : rawUser;

    const rawFrom = (
      process.env.PROD_SMTP_FROM ||
      process.env.DOMAIN_SMTP_FROM ||
      process.env.SMTP_FROM ||
      ''
    )
      .trim()
      .toLowerCase();
    const fromEmail =
      !rawFrom || rawFrom.endsWith('@gmail.com') ? VCS_OFFICIAL_EMAIL : rawFrom;

    const pass = (
      process.env.PROD_SMTP_PASS ||
      process.env.DOMAIN_SMTP_PASS ||
      process.env.SMTP_PASS ||
      ''
    ).trim();

    return {
      mode: 'published-domain',
      host,
      port,
      secure,
      user,
      fromEmail,
      pass,
    };
  }

  // Dev/Preview Mode -> Gmail SMTP
  const candidateHost = cleanSmtpHostString(process.env.SMTP_HOST);
  const host =
    !candidateHost || candidateHost.includes('vardhmanconsultancy.com')
      ? 'smtp.gmail.com'
      : candidateHost;
  const port = Number(process.env.SMTP_PORT) || 587;
  const secure = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';
  const rawUser = (process.env.SMTP_USER || '').trim().toLowerCase();
  const user = !rawUser || rawUser === VCS_OFFICIAL_EMAIL ? GMAIL_SMTP_SENDER : rawUser;
  const rawFrom = (process.env.SMTP_FROM || '').trim().toLowerCase();
  const fromEmail = !rawFrom || rawFrom === VCS_OFFICIAL_EMAIL ? user : rawFrom;
  const pass = (process.env.SMTP_PASS || process.env.GOOGLE_APP_PASSWORD || '')
    .replace(/\s+/g, '')
    .trim();

  return {
    mode: 'dev-gmail',
    host,
    port,
    secure,
    user,
    fromEmail,
    pass,
  };
}

function resolveResumeAttachment(
  resumeId: string | null | undefined,
  resumeFileName: string | null | undefined
): Array<{ filename: string; path: string }> {
  if (!resumeId || !/^[a-zA-Z0-9_]+$/.test(resumeId)) return [];
  for (const ext of ['pdf', 'docx', 'doc'] as const) {
    const candidatePath = path.join(RESUMES_DIR, `${resumeId}.${ext}`);
    if (fs.existsSync(candidatePath)) {
      return [
        {
          filename: resumeFileName || `resume.${ext}`,
          path: candidatePath,
        },
      ];
    }
  }
  return [];
}

async function dispatchPortalEmail(params: {
  db: PortalDatabase;
  type: StoredEmailDispatch['type'];
  fromDisplayName?: string;
  from?: string;
  to: string;
  cc?: string | null;
  replyTo?: string | null;
  subject: string;
  text: string;
  attachments?: Array<{ filename: string; path: string }>;
  relatedEntityId: string;
}): Promise<StoredEmailDispatch> {
  const smtp = resolveActiveSmtpConfig();
  const ccAddress = params.cc === undefined ? VCS_OFFICIAL_EMAIL : params.cc;
  const formattedFrom = formatFromHeader(params.fromDisplayName, smtp.fromEmail);
  const replyToOnly = params.replyTo ? params.replyTo.trim() : null;

  let deliveredVia: 'smtp' | 'queued' = 'queued';
  if (smtp.host && smtp.user && smtp.pass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        auth: {
          user: smtp.user,
          pass: smtp.pass,
        },
      });
      await transporter.sendMail({
        from: formattedFrom,
        sender: smtp.fromEmail,
        to: params.to,
        cc: ccAddress || undefined,
        replyTo: replyToOnly || undefined,
        subject: params.subject,
        text: params.text,
        attachments: params.attachments,
      });
      deliveredVia = 'smtp';
    } catch (err) {
      console.warn('SMTP dispatch fallback to queued:', err instanceof Error ? err.message : err);
    }
  }

  const record: StoredEmailDispatch = {
    id: `mail_${crypto.randomUUID().replace(/-/g, '')}`,
    type: params.type,
    from: formattedFrom,
    replyTo: replyToOnly,
    to: params.to,
    cc: ccAddress || null,
    subject: params.subject,
    text: params.text,
    deliveredVia,
    environmentMode: smtp.mode,
    relatedEntityId: params.relatedEntityId,
    createdAt: new Date().toISOString(),
  };

  if (!Array.isArray(params.db.emailDispatches)) {
    params.db.emailDispatches = [];
  }
  params.db.emailDispatches.push(record);
  return record;
}

function sanitizeAcademicDetails(raw: unknown): StoredAcademicEntry[] {
  if (!Array.isArray(raw)) return [];
  const entries: StoredAcademicEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const degree = String(obj.degree ?? '').trim();
    const institution = String(obj.institution ?? '').trim();
    const specialization = String(obj.specialization ?? '').trim();
    const yearOfPassing = String(obj.yearOfPassing ?? '').trim();
    const percentageOrGrade = String(obj.percentageOrGrade ?? '').trim();
    if (!degree && !institution && !specialization && !yearOfPassing && !percentageOrGrade) {
      continue;
    }
    const rawId = String(obj.id ?? '').trim();
    entries.push({
      id: rawId || `acad_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`,
      degree,
      institution,
      specialization,
      yearOfPassing,
      percentageOrGrade,
    });
  }
  return entries.slice(0, 15);
}

function sanitizeWorkExperience(raw: unknown): StoredWorkExperienceEntry[] {
  if (!Array.isArray(raw)) return [];
  const entries: StoredWorkExperienceEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const company = String(obj.company ?? '').trim();
    const designation = String(obj.designation ?? '').trim();
    const fromDate = String(obj.fromDate ?? '').trim();
    const toDate = String(obj.toDate ?? '').trim();
    const currentlyWorking = Boolean(obj.currentlyWorking);
    const responsibilities = String(obj.responsibilities ?? '').trim();
    if (!company && !designation && !fromDate && !toDate && !responsibilities) {
      continue;
    }
    const rawId = String(obj.id ?? '').trim();
    entries.push({
      id: rawId || `work_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`,
      company,
      designation,
      fromDate,
      toDate: currentlyWorking ? 'Present' : toDate,
      currentlyWorking,
      responsibilities,
    });
  }
  return entries.slice(0, 20);
}

function calculateProfileCompleteness(c: StoredCandidate): number {
  if ((c.role || 'candidate') !== 'candidate') return 100;
  const checks = [
    Boolean(c.name?.trim()),
    Boolean(c.email?.trim()),
    Boolean(c.phone?.trim()),
    Boolean(c.dob?.trim()),
    Boolean(c.city?.trim() || c.districtCity?.trim()),
    Boolean(c.state?.trim() && c.pinCode?.trim()),
    Boolean(c.fatherName?.trim() || c.motherName?.trim()),
    Boolean(c.resumeHeadline?.trim()),
    Boolean(c.profileSummary?.trim() || c.careerSummary?.trim() || c.resumeSummary?.trim()),
    Boolean(c.qualification?.trim() || (c.academicDetails && c.academicDetails.length > 0)),
    Boolean(c.experience?.trim()),
    Boolean(c.expectedSalary?.trim() && c.noticePeriod?.trim()),
    Boolean(Array.isArray(c.keySkills) && c.keySkills.length > 0),
    Boolean(c.preferredLocation?.trim() || c.preferredRole?.trim()),
    Boolean(c.resumeId && c.resumeFileName),
  ];
  const score = Math.round((checks.filter(Boolean).length / checks.length) * 100);
  return Math.max(0, Math.min(100, score));
}

function toPublicCandidate(c: StoredCandidate) {
  return {
    id: c.id,
    role: c.role || 'candidate',
    name: c.name,
    email: c.email,
    phone: c.phone,
    city: c.city,
    experience: c.experience,
    companyName: c.companyName || null,
    fullAddress: c.fullAddress || null,
    gstNumber: c.gstNumber || null,
    tanNumber: c.tanNumber || null,
    panNumber: c.panNumber || null,
    accountDetails: c.accountDetails || null,
    photoUrl: c.photoUrl || null,
    resumeId: c.resumeId,
    resumeFileName: c.resumeFileName,
    resumeUpdatedAt: c.resumeUpdatedAt,
    createdAt: c.createdAt,
    hasPin: Boolean(c.pinHash && c.pinSalt),
    fatherName: c.fatherName || null,
    motherName: c.motherName || null,
    maritalStatus: c.maritalStatus || null,
    spouseName: c.spouseName || null,
    emergencyContact: c.emergencyContact || null,
    dob: c.dob || null,
    state: c.state || null,
    districtCity: c.districtCity || null,
    pinCode: c.pinCode || null,
    qualification: c.qualification || null,
    designation: c.designation || null,
    currentCompany: c.currentCompany || null,
    currentCtc: c.currentCtc || null,
    expectedSalary: c.expectedSalary || null,
    noticePeriod: c.noticePeriod || null,
    keySkills: Array.isArray(c.keySkills) ? c.keySkills : [],
    preferredLocation: c.preferredLocation || null,
    preferredRole: c.preferredRole || null,
    jobType: c.jobType || null,
    resumeHeadline: c.resumeHeadline || null,
    profileSummary: c.profileSummary || null,
    careerSummary: c.careerSummary || null,
    resumeSummary: c.resumeSummary || null,
    academicDetails: Array.isArray(c.academicDetails) ? c.academicDetails : [],
    workExperience: Array.isArray(c.workExperience) ? c.workExperience : [],
    termsAccepted: Boolean(c.termsAccepted),
    profileCompleteness:
      typeof c.profileCompleteness === 'number'
        ? c.profileCompleteness
        : calculateProfileCompleteness(c),
    emailNotificationsEnabled:
      typeof c.emailNotificationsEnabled === 'boolean' ? c.emailNotificationsEnabled : true,
    whatsappAlertsEnabled: Boolean(c.whatsappAlertsEnabled),
    whatsappNumber: c.whatsappNumber || c.phone || null,
    alertCity: c.alertCity || c.city || null,
    alertCategory: c.alertCategory || null,
    autoApplyConfig: c.autoApplyConfig || {
      enabled: false,
      minMatchScore: 65,
      preferredKeywords: Array.isArray(c.keySkills) ? c.keySkills.join(', ') : '',
      preferredLocations: c.preferredLocation || c.city || '',
      maxDailyApps: 5,
      lastRunAt: null,
      lastRunCount: 0,
    },
    skillTestResults: Array.isArray(c.skillTestResults) ? c.skillTestResults : [],
    interviewReminders: Array.isArray(c.interviewReminders) ? c.interviewReminders : [],
    searchHistory: Array.isArray(c.searchHistory) ? c.searchHistory : [],
  };
}

function toPublicApprovedJob(job: StoredJob) {
  return {
    id: job.id,
    title: job.title,
    designation: job.designation,
    company: CONFIDENTIAL_COMPANY_LABEL,
    companyMasked: CONFIDENTIAL_COMPANY_LABEL,
    location: job.location,
    experience: job.experience,
    salary: job.salary,
    postedAt: job.postedAt,
    description: job.description,
    qualification: job.qualification,
    skills: job.skills,
    openings: job.openings,
    jobType: job.jobType,
    lastDateToApply: job.lastDateToApply,
    status: job.status,
  };
}

function hashPassword(password: string, salt?: string): { salt: string; hash: string } {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, actualSalt, 64).toString('hex');
  return { salt: actualSalt, hash: derived };
}

function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  const derived = crypto.scryptSync(password, salt, 64);
  const expectedBuf = Buffer.from(expectedHash, 'hex');
  if (derived.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(derived, expectedBuf);
}

function signToken(candidateId: string): string {
  const payload = Buffer.from(
    JSON.stringify({
      sub: candidateId,
      exp: Date.now() + 1000 * 60 * 60 * 24 * 7,
    }),
    'utf8'
  ).toString('base64url');
  const sig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payload)
    .digest('base64url');
  return `${payload}.${sig}`;
}

function verifyToken(token: string): string | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payload)
    .digest('base64url');
  const sigBuf = Buffer.from(sig, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      sub?: string;
      exp?: number;
    };
    if (!decoded.sub || typeof decoded.exp !== 'number' || decoded.exp < Date.now()) {
      return null;
    }
    return decoded.sub;
  } catch {
    return null;
  }
}

function sanitizeFileName(name: string): string {
  const base = path.basename(name).replace(/[^a-zA-Z0-9._\- ]/g, '_').trim();
  if (!base) return 'resume.pdf';
  const lower = base.toLowerCase();
  if (lower.endsWith('.pdf') || lower.endsWith('.doc') || lower.endsWith('.docx')) {
    return base;
  }
  return `${base}.pdf`;
}

function detectResumeExtension(
  buffer: Buffer,
  fileName: string
): 'pdf' | 'doc' | 'docx' | null {
  const lower = fileName.toLowerCase();
  const pdfHeader = buffer.subarray(0, 5).toString('ascii');
  if (pdfHeader === '%PDF-') return 'pdf';

  // DOCX is ZIP (PK\x03\x04)
  if (
    lower.endsWith('.docx') &&
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04
  ) {
    return 'docx';
  }

  // DOC is OLE2 Compound File (D0 CF 11 E0) or legacy Word text/RTF
  if (lower.endsWith('.doc')) {
    const isOle =
      buffer.length >= 4 &&
      buffer[0] === 0xd0 &&
      buffer[1] === 0xcf &&
      buffer[2] === 0x11 &&
      buffer[3] === 0xe0;
    const isRtf = buffer.subarray(0, 5).toString('ascii') === '{\\rtf';
    if (isOle || isRtf || buffer.length > 0) {
      return 'doc';
    }
  }

  return null;
}

function savePdfFromBase64(
  rawFileName: string,
  rawBase64: string
): { resumeId: string; resumeFileName: string } {
  if (!rawFileName || !rawBase64) {
    throw new Error('Please upload a Resume file (PDF, DOC, or DOCX).');
  }

  const cleanBase64 = rawBase64.includes(',')
    ? rawBase64.slice(rawBase64.indexOf(',') + 1)
    : rawBase64;

  const buffer = Buffer.from(cleanBase64, 'base64');
  if (buffer.length === 0) {
    throw new Error('Uploaded resume file is empty.');
  }
  if (buffer.length > MAX_PDF_BYTES) {
    throw new Error('Resume file must be 10 MB or smaller.');
  }

  const ext = detectResumeExtension(buffer, rawFileName);
  if (!ext) {
    throw new Error('Invalid file format. Only PDF, DOC, and DOCX files are accepted.');
  }

  const resumeId = `res_${crypto.randomUUID().replace(/-/g, '')}`;
  const resumeFileName = sanitizeFileName(rawFileName);
  ensureDataDirs();
  fs.writeFileSync(path.join(RESUMES_DIR, `${resumeId}.${ext}`), buffer);
  return { resumeId, resumeFileName };
}

type OtpPurpose = 'register' | 'login' | 'reset';

interface OtpEntry {
  code: string;
  expiresAt: number;
  verified: boolean;
  purpose: OtpPurpose;
}

const otpStore = new Map<string, OtpEntry>();

function normalizeOtpTarget(raw: string): { key: string; display: string; type: 'email' | 'phone' | 'invalid' } {
  const trimmed = String(raw ?? '').trim();
  const emailCandidate = normalizeEmail(trimmed);
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailCandidate)) {
    return { key: `email:${emailCandidate}`, display: emailCandidate, type: 'email' };
  }
  const mobile10 = normalizeMobileNumber(trimmed);
  if (mobile10.length === 10) {
    return { key: `phone:${mobile10}`, display: mobile10, type: 'phone' };
  }
  return { key: '', display: '', type: 'invalid' };
}

function findUserByIdentifier(candidates: StoredCandidate[], rawIdentifier: string): StoredCandidate | undefined {
  const trimmed = String(rawIdentifier ?? '').trim();
  if (!trimmed) return undefined;
  const emailNorm = normalizeEmail(trimmed);
  const byEmail = candidates.find((c) => normalizeEmail(c.email) === emailNorm);
  if (byEmail) return byEmail;

  const mobile10 = normalizeMobileNumber(trimmed);
  if (mobile10.length === 10) {
    const byPhone = candidates.find((c) => normalizeMobileNumber(c.phone) === mobile10);
    if (byPhone) return byPhone;
  }

  const byNameMatches = candidates.filter((c) => c.name.trim().toLowerCase() === emailNorm);
  if (byNameMatches.length === 1) return byNameMatches[0];
  return undefined;
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const bearer =
    authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length).trim()
      : null;

  if (!bearer) {
    res.status(401).json({ error: 'Authentication required. Please register or log in first.' });
    return;
  }

  const candidateId = verifyToken(bearer);
  if (!candidateId) {
    res.status(401).json({ error: 'Session expired or invalid. Please log in again.' });
    return;
  }

  const db = readDb();
  const candidate = db.candidates.find((c) => c.id === candidateId);
  if (!candidate) {
    res.status(401).json({ error: 'Account not found. Please register or log in again.' });
    return;
  }

  req.candidate = candidate;
  next();
}

function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.candidate) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  const role = req.candidate.role || 'candidate';
  if (role !== 'admin') {
    res.status(403).json({ error: 'Admin privileges are required to access this resource.' });
    return;
  }
  next();
}

const VALID_INSIGHT_CATEGORIES = new Set<InsightCategory>([
  'Official Update',
  'Industry Insights',
  'Career Guidance',
  'Verified Opportunities',
]);

function normalizeInsightCategory(raw: unknown): InsightCategory {
  const val = String(raw ?? '').trim() as InsightCategory;
  return VALID_INSIGHT_CATEGORIES.has(val) ? val : 'Official Update';
}

function detectImageExtension(buffer: Buffer): 'png' | 'jpg' | 'webp' | 'gif' | null {
  if (buffer.length < 12) return null;
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return 'png';
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpg';
  }
  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'webp';
  }
  const gifHeader = buffer.subarray(0, 6).toString('ascii');
  if (gifHeader === 'GIF87a' || gifHeader === 'GIF89a') {
    return 'gif';
  }
  return null;
}

function saveInsightImageFromBase64(rawBase64: string): { imageFileName: string; imageUrl: string } {
  const cleanBase64 = rawBase64.includes(',')
    ? rawBase64.slice(rawBase64.indexOf(',') + 1)
    : rawBase64;
  const buffer = Buffer.from(cleanBase64, 'base64');
  if (buffer.length === 0) {
    throw new Error('Selected image file is empty.');
  }
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new Error('Post image must be 5 MB or smaller.');
  }
  const ext = detectImageExtension(buffer);
  if (!ext) {
    throw new Error('Unsupported image format. Please upload PNG, JPG, WebP, or GIF.');
  }
  const imageFileName = `img_${crypto.randomUUID().replace(/-/g, '')}.${ext}`;
  ensureDataDirs();
  fs.writeFileSync(path.join(INSIGHTS_IMAGES_DIR, imageFileName), buffer);
  return {
    imageFileName,
    imageUrl: `/api/insights/images/${imageFileName}`,
  };
}

function removeInsightImageFile(imageFileName: string | null): void {
  if (!imageFileName || !/^[a-zA-Z0-9_]+\.(png|jpg|jpeg|webp|gif)$/.test(imageFileName)) return;
  const target = path.join(INSIGHTS_IMAGES_DIR, imageFileName);
  if (fs.existsSync(target)) {
    try {
      fs.unlinkSync(target);
    } catch {
      // Ignore cleanup errors
    }
  }
}

function saveProfilePhotoFromBase64(rawBase64: string): {
  photoFileName: string;
  photoUrl: string;
} {
  const cleanBase64 = rawBase64.includes(',')
    ? rawBase64.slice(rawBase64.indexOf(',') + 1)
    : rawBase64;
  const buffer = Buffer.from(cleanBase64, 'base64');
  if (buffer.length === 0) {
    throw new Error('Selected photo file is empty.');
  }
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new Error('Profile photo must be 5 MB or smaller.');
  }
  const ext = detectImageExtension(buffer);
  if (!ext) {
    throw new Error('Unsupported photo format. Please upload PNG, JPG, WebP, or GIF.');
  }
  const photoFileName = `photo_${crypto.randomUUID().replace(/-/g, '')}.${ext}`;
  ensureDataDirs();
  fs.writeFileSync(path.join(PROFILE_PHOTOS_DIR, photoFileName), buffer);
  return {
    photoFileName,
    photoUrl: `/api/candidate/photo/${photoFileName}`,
  };
}

function removeProfilePhotoFile(photoFileName: string | null | undefined): void {
  if (!photoFileName || !/^[a-zA-Z0-9_]+\.(png|jpg|jpeg|webp|gif)$/.test(photoFileName)) return;
  const target = path.join(PROFILE_PHOTOS_DIR, photoFileName);
  if (fs.existsSync(target)) {
    try {
      fs.unlinkSync(target);
    } catch {
      // Ignore cleanup errors
    }
  }
}

function getOptionalAuthenticatedCandidateId(req: Request, db: PortalDatabase): string | null {
  const authHeader = req.headers.authorization;
  const bearer =
    authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length).trim()
      : null;
  if (!bearer) return null;
  const candidateId = verifyToken(bearer);
  if (!candidateId) return null;
  const exists = db.candidates.some((c) => c.id === candidateId);
  return exists ? candidateId : null;
}

function getViewerActorId(req: Request, db: PortalDatabase): string | null {
  const candidateId = getOptionalAuthenticatedCandidateId(req, db);
  if (candidateId) return `user:${candidateId}`;
  const rawVisitor = String(req.headers['x-visitor-id'] ?? '').trim();
  if (/^[a-zA-Z0-9_-]{8,64}$/.test(rawVisitor)) {
    return `visitor:${rawVisitor}`;
  }
  return null;
}

function normalizeHashtags(raw: unknown): string[] {
  const list = Array.isArray(raw)
    ? raw.map((item) => String(item).trim())
    : String(raw ?? '')
        .split(/[\s,]+/)
        .map((item) => item.trim());
  const cleaned = list
    .filter(Boolean)
    .map((tag) => (tag.startsWith('#') ? tag : `#${tag}`))
    .slice(0, 8);
  return Array.from(new Set(cleaned));
}

function toPublicInsightPost(post: StoredInsightPost, viewerActorId: string | null) {
  const likedByIds = Array.isArray(post.likedByIds) ? post.likedByIds : [];
  const comments = Array.isArray(post.comments) ? post.comments : [];
  const hashtags = Array.isArray(post.hashtags) ? post.hashtags : [];
  return {
    id: post.id,
    title: post.title,
    description: post.description,
    category: post.category,
    hashtags,
    ctaLabel: post.ctaLabel || null,
    imageUrl: post.imageUrl,
    authorId: post.authorId,
    authorName: post.authorName,
    likesCount: likedByIds.length,
    likedByViewer: viewerActorId ? likedByIds.includes(viewerActorId) : false,
    comments: [...comments].sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1)),
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  };
}

async function startServer() {
  ensureDataDirs();
  const app = express();
  app.use(express.json({ limit: '16mb' }));

  // Check if Account Already Exists in Unified Users Table (for Register Pre-Check & Unlock Account)
  app.post('/api/auth/account-status', (req: Request, res: Response) => {
    const body = (req.body || {}) as Record<string, unknown>;
    const identifier = String(body.identifier ?? '').trim();
    const emailRaw = normalizeEmail(body.email);
    const phone10 = normalizeMobileNumber(body.phone);

    const db = readDb();
    let matched: StoredCandidate | undefined;
    let matchedBy: 'email' | 'phone' | undefined;

    if (emailRaw) {
      matched = db.candidates.find((c) => normalizeEmail(c.email) === emailRaw);
      if (matched) matchedBy = 'email';
    }
    if (!matched && phone10.length === 10) {
      matched = db.candidates.find((c) => normalizeMobileNumber(c.phone) === phone10);
      if (matched) matchedBy = 'phone';
    }
    if (!matched && identifier) {
      matched = findUserByIdentifier(db.candidates, identifier);
      if (matched) {
        matchedBy = identifier.includes('@') ? 'email' : 'phone';
      }
    }

    if (!matched) {
      res.json({ exists: false });
      return;
    }

    res.json({
      exists: true,
      matchedBy,
      normalizedEmail: normalizeEmail(matched.email),
      normalizedPhone: normalizeMobileNumber(matched.phone),
      role: matched.role || 'candidate',
    });
  });

  // Send OTP (Register Mobile / Login / Forgot Password & PIN)
  app.post('/api/auth/otp/send', (req: Request, res: Response) => {
    const body = (req.body || {}) as Record<string, unknown>;
    const targetRaw = String(body.target ?? '').trim();
    const purposeRaw = String(body.purpose ?? 'register').trim().toLowerCase();
    const purpose: OtpPurpose =
      purposeRaw === 'login' || purposeRaw === 'reset' ? purposeRaw : 'register';

    const target = normalizeOtpTarget(targetRaw);
    if (target.type === 'invalid') {
      res.status(400).json({ error: 'Please enter a valid 10-digit mobile number or email address.' });
      return;
    }

    const db = readDb();
    if (purpose === 'login' || purpose === 'reset') {
      const matched = findUserByIdentifier(db.candidates, targetRaw);
      if (!matched) {
        res.status(404).json({
          error: 'No registered account found with this email or mobile number.',
          code: 'NOT_REGISTERED',
        });
        return;
      }
    } else if (purpose === 'register') {
      const existing = findUserByIdentifier(db.candidates, targetRaw);
      if (existing) {
        res.status(409).json({
          error: 'You are already registered with this mobile number or email.',
          code: 'ALREADY_REGISTERED',
        });
        return;
      }
    }

    const code = String(crypto.randomInt(100000, 999999));
    otpStore.set(`${purpose}:${target.key}`, {
      code,
      expiresAt: Date.now() + 10 * 60 * 1000,
      verified: false,
      purpose,
    });

    res.json({
      sent: true,
      targetDisplay: target.display,
      verificationCode: code,
      expiresInSeconds: 600,
      message: `OTP sent to ${target.display}.`,
    });
  });

  // Verify OTP (Register Mobile or Reset Password Step 2)
  app.post('/api/auth/otp/verify', (req: Request, res: Response) => {
    const body = (req.body || {}) as Record<string, unknown>;
    const targetRaw = String(body.target ?? '').trim();
    const otp = String(body.otp ?? '').trim();
    const purposeRaw = String(body.purpose ?? 'register').trim().toLowerCase();
    const purpose: OtpPurpose =
      purposeRaw === 'login' || purposeRaw === 'reset' ? purposeRaw : 'register';

    const target = normalizeOtpTarget(targetRaw);
    if (target.type === 'invalid') {
      res.status(400).json({ error: 'Invalid mobile number or email.' });
      return;
    }
    if (!/^\d{6}$/.test(otp)) {
      res.status(400).json({ error: 'Please enter the valid 6-digit OTP.' });
      return;
    }

    const storeKey = `${purpose}:${target.key}`;
    const entry = otpStore.get(storeKey);
    if (!entry || entry.expiresAt < Date.now()) {
      res.status(400).json({ error: 'OTP has expired. Please request a new OTP.' });
      return;
    }
    if (entry.code !== otp) {
      res.status(400).json({ error: 'Incorrect OTP. Please verify and try again.' });
      return;
    }

    otpStore.set(storeKey, { ...entry, verified: true });
    res.json({ verified: true, message: 'OTP verified successfully.' });
  });

  // Candidate / Employer / Admin Registration
  app.post('/api/auth/register', async (req: Request, res: Response) => {
    try {
      const body = (req.body || {}) as Record<string, unknown>;
      const requestedRole = String(body.role ?? 'candidate').trim().toLowerCase();
      const role: UserRole =
        requestedRole === 'employer' || requestedRole === 'admin'
          ? requestedRole
          : 'candidate';

      const name = String(body.name ?? '').trim();
      const email = normalizeEmail(body.email);
      const mobile10 = normalizeMobileNumber(body.phone);
      const password = String(body.password ?? '');
      const pin = String(body.pin ?? '').trim();
      const cityInput = String(body.city ?? '').trim();
      const experienceInput = String(body.experience ?? '').trim();
      const companyName = String(body.companyName ?? '').trim();
      const fullAddress = String(body.fullAddress ?? '').trim();
      const gstNumber = String(body.gstNumber ?? '').trim().toUpperCase();
      const tanNumber = String(body.tanNumber ?? '').trim().toUpperCase();
      const panNumber = String(body.panNumber ?? '').trim().toUpperCase();
      const accountDetails = String(body.accountDetails ?? '').trim();
      const resumeFileNameRaw = String(body.resumeFileName ?? '').trim();
      const resumeBase64 = String(body.resumeBase64 ?? '').trim();
      const currentRequirements = String(body.currentRequirements ?? '').trim();
      const jdFileNameRaw = String(body.jdFileName ?? '').trim();
      const jdBase64 = String(body.jdBase64 ?? '').trim();

      const effectiveRole: UserRole = email === DESIGNATED_ADMIN_EMAIL ? 'admin' : role;
      const city = cityInput || (effectiveRole === 'employer' && fullAddress ? fullAddress.split(',').slice(-2, -1)[0]?.trim() || 'India' : 'India');
      const experience = experienceInput || (effectiveRole === 'candidate' ? 'Fresher' : 'Not Applicable');

      if (!name) {
        res.status(400).json({
          error:
            effectiveRole === 'employer'
              ? 'Contact Person Name is required.'
              : 'Full Name is required.',
        });
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        res.status(400).json({ error: 'Please enter a valid Email ID.' });
        return;
      }
      if (effectiveRole === 'candidate' && mobile10.length !== 10) {
        res.status(400).json({ error: 'Please enter a valid 10-digit Mobile Number.' });
        return;
      }
      if (effectiveRole !== 'candidate' && mobile10.length > 0 && mobile10.length !== 10) {
        res.status(400).json({ error: 'Please enter a valid 10-digit Mobile Number.' });
        return;
      }
      if (password.length < 6) {
        res.status(400).json({ error: 'Password must be at least 6 characters long.' });
        return;
      }
      if (pin && !/^\d{4}$/.test(pin)) {
        res.status(400).json({ error: 'PIN must be exactly 4 numeric digits.' });
        return;
      }
      if (effectiveRole === 'employer') {
        if (!companyName) {
          res.status(400).json({ error: 'Company Name is required.' });
          return;
        }
        if (!fullAddress) {
          res.status(400).json({ error: 'Full Address is required.' });
          return;
        }
      }

      const db = readDb();
      if (db.candidates.some((c) => normalizeEmail(c.email) === email)) {
        res.status(409).json({
          error: 'You are already registered with this email address.',
          code: 'ALREADY_REGISTERED',
          field: 'email',
        });
        return;
      }

      if (
        mobile10.length === 10 &&
        db.candidates.some((c) => normalizeMobileNumber(c.phone) === mobile10)
      ) {
        res.status(409).json({
          error: 'You are already registered with this mobile number.',
          code: 'ALREADY_REGISTERED',
          field: 'phone',
        });
        return;
      }

      let resumeId: string | null = null;
      let resumeFileName: string | null = null;
      let resumeUpdatedAt: string | null = null;

      if (effectiveRole === 'candidate' || resumeBase64) {
        const saved = savePdfFromBase64(resumeFileNameRaw, resumeBase64);
        resumeId = saved.resumeId;
        resumeFileName = saved.resumeFileName;
        resumeUpdatedAt = new Date().toISOString();
      }

      let jdFileId: string | null = null;
      let jdFileName: string | null = null;
      if (effectiveRole === 'employer' && jdBase64) {
        const savedJd = savePdfFromBase64(jdFileNameRaw || 'job-description.pdf', jdBase64);
        jdFileId = savedJd.resumeId;
        jdFileName = savedJd.resumeFileName;
      }

      const { salt, hash } = hashPassword(password);
      const pinCreds = /^\d{4}$/.test(pin) ? hashPassword(pin) : null;
      const now = new Date().toISOString();

      const rawSkills = body.keySkills;
      const keySkills = Array.isArray(rawSkills)
        ? rawSkills.map((s) => String(s).trim()).filter(Boolean)
        : [];

      const qualificationVal = String(body.qualification ?? '').trim();
      const designationVal = String(body.designation ?? '').trim();
      const currentCompanyVal = String(body.currentCompany ?? '').trim();

      let academicDetails = sanitizeAcademicDetails(body.academicDetails);
      if (academicDetails.length === 0 && qualificationVal) {
        academicDetails = [
          {
            id: `acad_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`,
            degree: qualificationVal,
            institution: '',
            specialization: '',
            yearOfPassing: '',
            percentageOrGrade: '',
          },
        ];
      }

      let workExperience = sanitizeWorkExperience(body.workExperience);
      if (workExperience.length === 0 && (currentCompanyVal || designationVal)) {
        workExperience = [
          {
            id: `work_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`,
            company: currentCompanyVal,
            designation: designationVal,
            fromDate: '',
            toDate: currentCompanyVal ? 'Present' : '',
            currentlyWorking: Boolean(currentCompanyVal),
            responsibilities: '',
          },
        ];
      }

      const draftCandidate: StoredCandidate = {
        id: `cand_${crypto.randomUUID().replace(/-/g, '')}`,
        role: effectiveRole,
        name,
        email,
        phone: mobile10,
        city,
        experience,
        companyName: companyName || null,
        fullAddress: fullAddress || null,
        gstNumber: gstNumber || null,
        tanNumber: tanNumber || null,
        panNumber: panNumber || null,
        accountDetails: accountDetails || null,
        photoFileName: null,
        photoUrl: null,
        passwordSalt: salt,
        passwordHash: hash,
        pinSalt: pinCreds ? pinCreds.salt : null,
        pinHash: pinCreds ? pinCreds.hash : null,
        resumeId,
        resumeFileName,
        resumeUpdatedAt,
        createdAt: now,
        fatherName: String(body.fatherName ?? '').trim() || null,
        motherName: String(body.motherName ?? '').trim() || null,
        maritalStatus: String(body.maritalStatus ?? '').trim() || null,
        spouseName: String(body.spouseName ?? '').trim() || null,
        emergencyContact: String(body.emergencyContact ?? '').trim() || null,
        dob: String(body.dob ?? '').trim() || null,
        state: String(body.state ?? '').trim() || null,
        districtCity: String(body.districtCity ?? '').trim() || null,
        pinCode: String(body.pinCode ?? '').trim() || null,
        qualification: qualificationVal || null,
        designation: designationVal || null,
        currentCompany: currentCompanyVal || null,
        currentCtc: String(body.currentCtc ?? '').trim() || null,
        expectedSalary: String(body.expectedSalary ?? '').trim() || null,
        noticePeriod: String(body.noticePeriod ?? '').trim() || null,
        keySkills,
        preferredLocation: String(body.preferredLocation ?? '').trim() || null,
        preferredRole: String(body.preferredRole ?? '').trim() || null,
        jobType: String(body.jobType ?? '').trim() || null,
        resumeHeadline: String(body.resumeHeadline ?? '').trim() || null,
        profileSummary: String(body.profileSummary ?? '').trim() || null,
        careerSummary: String(body.careerSummary ?? '').trim() || null,
        resumeSummary: String(body.resumeSummary ?? '').trim() || null,
        academicDetails,
        workExperience,
        termsAccepted: body.termsAccepted !== undefined ? Boolean(body.termsAccepted) : true,
        termsAcceptedAt: now,
      };
      const newCandidate: StoredCandidate = {
        ...draftCandidate,
        profileCompleteness: calculateProfileCompleteness(draftCandidate),
      };

      db.candidates.push(newCandidate);

      let initialJob: StoredJob | null = null;
      if (effectiveRole === 'employer' && (currentRequirements || jdFileId)) {
        const firstLine = currentRequirements
          .split(/\r?\n/)
          .map((line) => line.trim())
          .find(Boolean);
        const derivedTitle = firstLine
          ? firstLine.slice(0, 90)
          : `${companyName} Hiring Requirement`;
        const postedAt = new Date().toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        });

        initialJob = {
          id: `job_${crypto.randomUUID().replace(/-/g, '')}`,
          employerId: newCandidate.id,
          company: companyName,
          companyMasked: CONFIDENTIAL_COMPANY_LABEL,
          recruiterName: name,
          recruiterEmail: email,
          recruiterPhone: mobile10 || '',
          title: derivedTitle,
          designation: 'Hiring Mandate',
          location: city || 'India',
          experience: 'As per JD',
          salary: 'Competitive / As per JD',
          jobType: 'Full-Time',
          skills: ['Relevant Experience'],
          description: currentRequirements || `Attached Job Description: ${jdFileName}`,
          qualification: 'As per JD',
          openings: 1,
          lastDateToApply: 'Open Until Filled',
          postedAt,
          createdAt: now,
          status: 'Pending',
        };
        db.jobs.push(initialJob);

        const jdAttachments = resolveResumeAttachment(jdFileId, jdFileName);
        const registrationJdBody = [
          'NEW EMPLOYER REGISTRATION & JOB REQUIREMENT - VARDHMAN CONSULTANCY SERVICES',
          '',
          '=== EMPLOYER DETAILS ===',
          `Company Name: ${companyName}`,
          `Full Address: ${fullAddress}`,
          `Official Email ID: ${email}`,
          `Contact Person Name: ${name}`,
          ...(jdFileName ? [`Attached JD File: ${jdFileName}`] : []),
          '',
          '=== CURRENT REQUIREMENTS / JOB DESCRIPTION ===',
          currentRequirements || `See attached Job Description file: ${jdFileName}`,
        ].join('\n');

        await dispatchPortalEmail({
          db,
          type: 'employer-requirement',
          fromDisplayName: `${name} - ${companyName}`,
          to: DESIGNATED_ADMIN_EMAIL,
          cc: VCS_OFFICIAL_EMAIL,
          replyTo: email,
          subject: `New Employer Requirement: ${derivedTitle} - ${companyName}`,
          text: registrationJdBody,
          attachments: jdAttachments,
          relatedEntityId: initialJob.id,
        });

        const autoReplyBody = [
          `Dear ${name},`,
          '',
          'Thank you for registering your employer account with Vardhman Consultancy Services.',
          '',
          `We have received your hiring requirement (${initialJob.id}) for "${companyName}"${jdFileName ? ` along with your attached JD (${jdFileName})` : ''}.`,
          'Our executive recruitment desk will review and connect with you shortly.',
          '',
          'Warm Regards,',
          'Vardhman Consultancy Services',
          'Email: info@vardhmanconsultancy.com',
          'Mobile & WhatsApp: 7877250630',
        ].join('\n');

        await dispatchPortalEmail({
          db,
          type: 'employer-autoreply',
          fromDisplayName: 'Vardhman Consultancy Services',
          to: email,
          cc: VCS_OFFICIAL_EMAIL,
          replyTo: VCS_OFFICIAL_EMAIL,
          subject: `Employer Registration & Requirement Received - ${companyName}`,
          text: autoReplyBody,
          relatedEntityId: initialJob.id,
        });
      }

      writeDb(db);

      if (mobile10) {
        otpStore.delete(`register:phone:${mobile10}`);
      }

      const token = signToken(newCandidate.id);
      res.status(201).json({ token, candidate: toPublicCandidate(newCandidate), initialJob });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Registration failed.';
      res.status(400).json({ error: message });
    }
  });

  // Password Login (Supports Username / Email / Mobile + Password)
  app.post('/api/auth/login', (req: Request, res: Response) => {
    const body = (req.body || {}) as Record<string, unknown>;
    const identifier = String(body.identifier ?? body.email ?? '').trim();
    const password = String(body.password ?? '');

    if (!identifier || !password) {
      res.status(400).json({ error: 'Username / Email / Mobile and password are required.' });
      return;
    }

    const db = readDb();
    const candidate = findUserByIdentifier(db.candidates, identifier);
    if (!candidate || !verifyPassword(password, candidate.passwordSalt, candidate.passwordHash)) {
      res.status(401).json({
        error: 'Invalid credentials. Please verify your details or register first.',
      });
      return;
    }

    const token = signToken(candidate.id);
    res.json({ token, candidate: toPublicCandidate(candidate) });
  });

  // 4-Digit PIN Login (Username / Email / Mobile + 4-Digit PIN)
  app.post('/api/auth/pin-login', (req: Request, res: Response) => {
    const body = (req.body || {}) as Record<string, unknown>;
    const identifier = String(body.identifier ?? '').trim();
    const pin = String(body.pin ?? '').trim();

    if (!identifier) {
      res.status(400).json({ error: 'Please enter your Username, Email, or Mobile number.' });
      return;
    }
    if (!/^\d{4}$/.test(pin)) {
      res.status(400).json({ error: 'Please enter your 4-digit PIN.' });
      return;
    }

    const db = readDb();
    const candidate = findUserByIdentifier(db.candidates, identifier);
    if (
      !candidate ||
      !candidate.pinSalt ||
      !candidate.pinHash ||
      !verifyPassword(pin, candidate.pinSalt, candidate.pinHash)
    ) {
      res.status(401).json({
        error: 'Invalid account or 4-digit PIN. Use Forgot Password / PIN if needed.',
      });
      return;
    }

    const token = signToken(candidate.id);
    res.json({ token, candidate: toPublicCandidate(candidate) });
  });

  // OTP Login (Email / Mobile + OTP)
  app.post('/api/auth/otp/login', (req: Request, res: Response) => {
    const body = (req.body || {}) as Record<string, unknown>;
    const targetRaw = String(body.target ?? '').trim();
    const otp = String(body.otp ?? '').trim();

    const target = normalizeOtpTarget(targetRaw);
    if (target.type === 'invalid') {
      res.status(400).json({ error: 'Please enter your registered email or 10-digit mobile number.' });
      return;
    }
    if (!/^\d{6}$/.test(otp)) {
      res.status(400).json({ error: 'Please enter the 6-digit OTP.' });
      return;
    }

    const storeKey = `login:${target.key}`;
    const entry = otpStore.get(storeKey);
    if (!entry || entry.expiresAt < Date.now()) {
      res.status(400).json({ error: 'OTP has expired. Please request a new OTP.' });
      return;
    }
    if (entry.code !== otp) {
      res.status(400).json({ error: 'Incorrect OTP. Please try again.' });
      return;
    }

    const db = readDb();
    const candidate = findUserByIdentifier(db.candidates, targetRaw);
    if (!candidate) {
      res.status(404).json({ error: 'Account not found. Please register first.' });
      return;
    }

    otpStore.delete(storeKey);
    const token = signToken(candidate.id);
    res.json({ token, candidate: toPublicCandidate(candidate) });
  });

  // Reset Password + 4-Digit PIN via Verified OTP
  app.post('/api/auth/reset-credentials', (req: Request, res: Response) => {
    const body = (req.body || {}) as Record<string, unknown>;
    const targetRaw = String(body.target ?? '').trim();
    const otp = String(body.otp ?? '').trim();
    const newPassword = String(body.newPassword ?? '');
    const newPin = String(body.newPin ?? '').trim();

    const target = normalizeOtpTarget(targetRaw);
    if (target.type === 'invalid') {
      res.status(400).json({ error: 'Invalid email or mobile number.' });
      return;
    }
    if (!/^\d{6}$/.test(otp)) {
      res.status(400).json({ error: 'Please provide the verified 6-digit OTP.' });
      return;
    }
    if (newPassword.length < 6) {
      res.status(400).json({ error: 'New password must be at least 6 characters long.' });
      return;
    }
    if (!/^\d{4}$/.test(newPin)) {
      res.status(400).json({ error: 'New PIN must be exactly 4 digits.' });
      return;
    }

    const storeKey = `reset:${target.key}`;
    const entry = otpStore.get(storeKey);
    if (!entry || entry.expiresAt < Date.now() || entry.code !== otp || !entry.verified) {
      res.status(400).json({ error: 'Please verify a valid OTP before resetting credentials.' });
      return;
    }

    const db = readDb();
    const candidate = findUserByIdentifier(db.candidates, targetRaw);
    if (!candidate) {
      res.status(404).json({ error: 'Account not found.' });
      return;
    }

    const idx = db.candidates.findIndex((c) => c.id === candidate.id);
    const passCreds = hashPassword(newPassword);
    const pinCreds = hashPassword(newPin);
    db.candidates[idx] = {
      ...db.candidates[idx],
      passwordSalt: passCreds.salt,
      passwordHash: passCreds.hash,
      pinSalt: pinCreds.salt,
      pinHash: pinCreds.hash,
    };
    writeDb(db);
    otpStore.delete(storeKey);

    res.json({
      reset: true,
      message: 'Your Password and 4-Digit PIN have been updated successfully.',
    });
  });

  // Verified Google Sign-In Session Exchange (Links Firebase Google Auth -> Portal Session)
  app.post('/api/auth/google', async (req: Request, res: Response) => {
    try {
      const body = (req.body || {}) as Record<string, unknown>;
      const idToken = String(body.idToken ?? '').trim();
      const preferredRoleRaw = String(body.preferredRole ?? 'candidate').trim().toLowerCase();
      const preferredRole: UserRole =
        preferredRoleRaw === 'employer' ? 'employer' : 'candidate';

      if (!idToken) {
        res.status(400).json({ error: 'Google verification token is missing.' });
        return;
      }

      const configPath = path.join(__dirname, 'firebase-applet-config.json');
      if (!fs.existsSync(configPath)) {
        res.status(500).json({ error: 'Authentication service is unavailable.' });
        return;
      }
      const configRaw = JSON.parse(fs.readFileSync(configPath, 'utf8')) as { apiKey?: string };
      const apiKey = String(configRaw.apiKey ?? '').trim();
      if (!apiKey) {
        res.status(500).json({ error: 'Authentication service is unavailable.' });
        return;
      }

      const lookupRes = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
        }
      );

      if (!lookupRes.ok) {
        res.status(401).json({ error: 'Google verification failed. Please sign in again.' });
        return;
      }

      const lookupJson = (await lookupRes.json()) as {
        users?: Array<{
          localId?: string;
          email?: string;
          emailVerified?: boolean;
          displayName?: string;
          photoUrl?: string;
        }>;
      };

      const googleUser = lookupJson.users?.[0];
      const email = normalizeEmail(googleUser?.email);
      if (!googleUser || !googleUser.emailVerified || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        res.status(401).json({ error: 'A verified Google email address is required.' });
        return;
      }

      const db = readDb();
      let idx = db.candidates.findIndex((c) => normalizeEmail(c.email) === email);
      const isDesignatedAdmin = email === DESIGNATED_ADMIN_EMAIL;

      if (idx === -1) {
        const assignedRole: UserRole = isDesignatedAdmin ? 'admin' : preferredRole;
        const { salt, hash } = hashPassword(crypto.randomBytes(24).toString('hex'));
        const now = new Date().toISOString();
        const fallbackName = String(googleUser.displayName || email.split('@')[0] || 'User').trim();
        const draftCandidate: StoredCandidate = {
          id: `cand_${crypto.randomUUID().replace(/-/g, '')}`,
          role: assignedRole,
          name: fallbackName,
          email,
          phone: '',
          city: 'India',
          experience: assignedRole === 'candidate' ? 'Fresher' : 'Not Applicable',
          companyName: assignedRole === 'employer' ? fallbackName : null,
          fullAddress: null,
          gstNumber: null,
          tanNumber: null,
          panNumber: null,
          accountDetails: null,
          photoFileName: null,
          photoUrl: googleUser.photoUrl || null,
          passwordSalt: salt,
          passwordHash: hash,
          pinSalt: null,
          pinHash: null,
          resumeId: null,
          resumeFileName: null,
          resumeUpdatedAt: null,
          createdAt: now,
          termsAccepted: true,
          termsAcceptedAt: now,
        };
        draftCandidate.profileCompleteness = calculateProfileCompleteness(draftCandidate);
        db.candidates.push(draftCandidate);
        idx = db.candidates.length - 1;
        writeDb(db);
      } else if (isDesignatedAdmin && db.candidates[idx].role !== 'admin') {
        db.candidates[idx] = {
          ...db.candidates[idx],
          role: 'admin',
        };
        writeDb(db);
      }

      const matched = db.candidates[idx];
      const token = signToken(matched.id);
      res.json({ token, candidate: toPublicCandidate(matched) });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Unable to complete Google sign-in.',
      });
    }
  });

  // Current Authenticated Profile
  app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    if (!req.candidate) {
      res.status(401).json({ error: 'Not authenticated.' });
      return;
    }
    res.json({ candidate: toPublicCandidate(req.candidate) });
  });

  // Upload / Replace Profile Resume PDF/DOC/DOCX
  app.post('/api/candidate/resume', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.candidate) {
        res.status(401).json({ error: 'Authentication required.' });
        return;
      }
      const body = (req.body || {}) as Record<string, unknown>;
      const resumeFileNameRaw = String(body.resumeFileName ?? '').trim();
      const resumeBase64 = String(body.resumeBase64 ?? '').trim();

      const { resumeId, resumeFileName } = savePdfFromBase64(resumeFileNameRaw, resumeBase64);
      const db = readDb();
      const idx = db.candidates.findIndex((c) => c.id === req.candidate!.id);
      if (idx === -1) {
        res.status(404).json({ error: 'User profile not found.' });
        return;
      }

      const now = new Date().toISOString();
      db.candidates[idx] = {
        ...db.candidates[idx],
        resumeId,
        resumeFileName,
        resumeUpdatedAt: now,
      };
      writeDb(db);

      res.json({ candidate: toPublicCandidate(db.candidates[idx]) });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Resume upload failed.';
      res.status(400).json({ error: message });
    }
  });

  // Serve Candidate Profile Photo
  app.get('/api/candidate/photo/:fileName', (req: Request, res: Response) => {
    const fileName = String(req.params.fileName || '').trim();
    if (!/^[a-zA-Z0-9_]+\.(png|jpg|jpeg|webp|gif)$/.test(fileName)) {
      res.status(400).json({ error: 'Invalid photo filename.' });
      return;
    }
    const target = path.join(PROFILE_PHOTOS_DIR, fileName);
    if (!fs.existsSync(target)) {
      res.status(404).json({ error: 'Profile photo not found.' });
      return;
    }
    res.sendFile(target);
  });

  // Upload or Remove Candidate Profile Photo
  app.post('/api/candidate/photo', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.candidate) {
        res.status(401).json({ error: 'Authentication required.' });
        return;
      }
      const body = (req.body || {}) as Record<string, unknown>;
      const removePhoto = Boolean(body.removePhoto);
      const photoBase64 = String(body.photoBase64 ?? '').trim();

      const db = readDb();
      const idx = db.candidates.findIndex((c) => c.id === req.candidate!.id);
      if (idx === -1) {
        res.status(404).json({ error: 'User profile not found.' });
        return;
      }

      const existingFile = db.candidates[idx].photoFileName;

      if (removePhoto) {
        removeProfilePhotoFile(existingFile);
        const updated: StoredCandidate = {
          ...db.candidates[idx],
          photoFileName: null,
          photoUrl: null,
        };
        updated.profileCompleteness = calculateProfileCompleteness(updated);
        db.candidates[idx] = updated;
        writeDb(db);
        res.json({ candidate: toPublicCandidate(updated) });
        return;
      }

      if (!photoBase64) {
        res.status(400).json({ error: 'Please select a PNG, JPG, WebP, or GIF image.' });
        return;
      }

      const { photoFileName, photoUrl } = saveProfilePhotoFromBase64(photoBase64);
      removeProfilePhotoFile(existingFile);

      const updated: StoredCandidate = {
        ...db.candidates[idx],
        photoFileName,
        photoUrl,
      };
      updated.profileCompleteness = calculateProfileCompleteness(updated);
      db.candidates[idx] = updated;
      writeDb(db);

      res.json({ candidate: toPublicCandidate(updated) });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Photo upload failed.';
      res.status(400).json({ error: message });
    }
  });

  // Update Complete Candidate Profile (All Registration & Dashboard Sections A-to-Z)
  app.patch('/api/candidate/profile', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    if (!req.candidate) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    const body = (req.body || {}) as Record<string, unknown>;
    const existing = req.candidate;
    const role = existing.role || 'candidate';

    const name = String(body.name ?? existing.name ?? '').trim();
    const email =
      body.email !== undefined ? normalizeEmail(body.email) : normalizeEmail(existing.email);
    const phoneInput = String(body.phone ?? existing.phone ?? '').trim();
    const mobile10 = normalizeMobileNumber(phoneInput);
    const districtCity =
      body.districtCity !== undefined
        ? String(body.districtCity ?? '').trim()
        : (existing.districtCity || '').trim();
    const city = String(body.city ?? districtCity ?? existing.city ?? '').trim();
    const experience = String(body.experience ?? existing.experience ?? '').trim();

    if (!name) {
      res.status(400).json({ error: 'Full Name is required.' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }
    if (mobile10.length !== 10) {
      res.status(400).json({ error: 'Please enter a valid 10-digit mobile number.' });
      return;
    }
    if (!city) {
      res.status(400).json({ error: 'City / District is required.' });
      return;
    }
    if (role === 'candidate' && !experience) {
      res.status(400).json({ error: 'Total Experience is required.' });
      return;
    }

    const db = readDb();
    if (
      db.candidates.some(
        (c) => c.id !== existing.id && normalizeEmail(c.email) === email
      )
    ) {
      res.status(409).json({
        error: 'This email address is already registered with another account.',
      });
      return;
    }
    if (
      db.candidates.some(
        (c) => c.id !== existing.id && normalizeMobileNumber(c.phone) === mobile10
      )
    ) {
      res.status(409).json({
        error: 'This mobile number is already registered with another account.',
      });
      return;
    }

    const idx = db.candidates.findIndex((c) => c.id === existing.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Account not found.' });
      return;
    }

    const optStr = (val: unknown, fallback?: string | null): string | null => {
      if (val === undefined) return fallback ?? null;
      const trimmed = String(val ?? '').trim();
      return trimmed || null;
    };

    const rawSkills = body.keySkills;
    const keySkills = Array.isArray(rawSkills)
      ? Array.from(new Set(rawSkills.map((s) => String(s).trim()).filter(Boolean))).slice(0, 30)
      : Array.isArray(existing.keySkills)
        ? existing.keySkills
        : [];

    const academicDetails =
      body.academicDetails !== undefined
        ? sanitizeAcademicDetails(body.academicDetails)
        : Array.isArray(existing.academicDetails)
          ? existing.academicDetails
          : [];

    const workExperience =
      body.workExperience !== undefined
        ? sanitizeWorkExperience(body.workExperience)
        : Array.isArray(existing.workExperience)
          ? existing.workExperience
          : [];

    const updatedCandidate: StoredCandidate = {
      ...db.candidates[idx],
      name,
      email,
      phone: mobile10,
      city,
      districtCity: districtCity || city,
      experience: experience || db.candidates[idx].experience,
      dob: optStr(body.dob, existing.dob),
      state: optStr(body.state, existing.state),
      pinCode: optStr(body.pinCode, existing.pinCode),
      fatherName: optStr(body.fatherName, existing.fatherName),
      motherName: optStr(body.motherName, existing.motherName),
      maritalStatus: optStr(body.maritalStatus, existing.maritalStatus),
      spouseName: optStr(body.spouseName, existing.spouseName),
      emergencyContact: optStr(body.emergencyContact, existing.emergencyContact),
      resumeHeadline: optStr(body.resumeHeadline, existing.resumeHeadline),
      profileSummary: optStr(body.profileSummary, existing.profileSummary),
      careerSummary: optStr(body.careerSummary, existing.careerSummary),
      resumeSummary: optStr(body.resumeSummary, existing.resumeSummary),
      qualification: optStr(body.qualification, existing.qualification),
      currentCompany: optStr(body.currentCompany, existing.currentCompany),
      designation: optStr(body.designation, existing.designation),
      currentCtc: optStr(body.currentCtc, existing.currentCtc),
      expectedSalary: optStr(body.expectedSalary, existing.expectedSalary),
      noticePeriod: optStr(body.noticePeriod, existing.noticePeriod),
      jobType: optStr(body.jobType, existing.jobType),
      preferredLocation: optStr(body.preferredLocation, existing.preferredLocation),
      preferredRole: optStr(body.preferredRole, existing.preferredRole),
      keySkills,
      academicDetails,
      workExperience,
    };

    updatedCandidate.profileCompleteness = calculateProfileCompleteness(updatedCandidate);
    db.candidates[idx] = updatedCandidate;
    writeDb(db);

    res.json({ candidate: toPublicCandidate(updatedCandidate) });
  });

  // Download Candidate's Own Resume File (or Admin Resume Godam CV View/Download)
  app.get('/api/resumes/:resumeId', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    if (!req.candidate) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    const resumeId = String(req.params.resumeId || '').trim();
    if (!/^[a-zA-Z0-9_]+$/.test(resumeId)) {
      res.status(400).json({ error: 'Invalid resume identifier.' });
      return;
    }

    const db = readDb();
    const isAdminUser = (req.candidate.role || 'candidate') === 'admin';
    const ownsProfileResume = req.candidate.resumeId === resumeId;
    const ownsAppResume = db.applications.some(
      (a) => a.candidateId === req.candidate!.id && a.resumeId === resumeId
    );

    if (!isAdminUser && !ownsProfileResume && !ownsAppResume) {
      res.status(403).json({ error: 'Access denied.' });
      return;
    }

    const matchingApp =
      db.applications.find(
        (a) =>
          a.resumeId === resumeId &&
          (isAdminUser || a.candidateId === req.candidate!.id)
      ) || null;
    const matchingProfile = isAdminUser
      ? db.candidates.find((c) => c.resumeId === resumeId) || null
      : null;
    const downloadName =
      (ownsProfileResume
        ? req.candidate.resumeFileName
        : matchingApp?.resumeFileName || matchingProfile?.resumeFileName) ||
      'resume.pdf';

    const possibleExts: Array<{ ext: 'pdf' | 'docx' | 'doc'; mime: string }> = [
      { ext: 'pdf', mime: 'application/pdf' },
      {
        ext: 'docx',
        mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      },
      { ext: 'doc', mime: 'application/msword' },
    ];

    let foundPath: string | null = null;
    let foundMime = 'application/pdf';
    for (const candidateExt of possibleExts) {
      const candidatePath = path.join(RESUMES_DIR, `${resumeId}.${candidateExt.ext}`);
      if (fs.existsSync(candidatePath)) {
        foundPath = candidatePath;
        foundMime = candidateExt.mime;
        break;
      }
    }

    if (!foundPath) {
      res.status(404).json({ error: 'Resume file not found.' });
      return;
    }

    res.setHeader('Content-Type', foundMime);
    res.setHeader('Content-Disposition', `attachment; filename="${downloadName.replace(/"/g, '')}"`);
    res.sendFile(foundPath);
  });

  // Get My Applications
  app.get('/api/applications', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    if (!req.candidate) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    const db = readDb();
    const myApps = db.applications
      .filter((a) => a.candidateId === req.candidate!.id)
      .sort((a, b) => (a.appliedAt < b.appliedAt ? 1 : -1));
    res.json({ applications: myApps });
  });

  // Admin: Get All Portal Applications (Resume Godam)
  app.get('/api/admin/applications', requireAuth, requireAdmin, (_req: AuthenticatedRequest, res: Response) => {
    const db = readDb();
    const allApps = [...db.applications].sort((a, b) =>
      a.appliedAt < b.appliedAt ? 1 : -1
    );
    res.json({ applications: allApps });
  });

  // Portal Public Application Submission (No login required; saves PDF + form data to Resume Godam & notifies Admin)
  app.post('/api/public/applications', async (req: Request, res: Response) => {
    try {
      const body = (req.body || {}) as Record<string, unknown>;
      const jobId = String(body.jobId ?? 'general_resume').trim() || 'general_resume';
      const jobTitle = String(body.jobTitle ?? '').trim();
      const companyMasked =
        String(body.companyMasked ?? '').trim() || CONFIDENTIAL_COMPANY_LABEL;
      const location = String(body.location ?? '').trim();
      const salary = String(body.salary ?? '').trim();
      const experience = String(body.experience ?? '').trim();
      const city = String(body.city ?? location).trim();
      const qualificationExperience = String(
        body.qualificationExperience ?? experience ?? ''
      ).trim();
      const resumeSummary = String(body.resumeSummary ?? '').trim();
      const applicantName = String(body.applicantName ?? '').trim();
      const applicantEmail = normalizeEmail(body.applicantEmail);
      const applicantPhone = String(body.applicantPhone ?? '').trim();
      const resumeFileNameRaw = String(body.resumeFileName ?? '').trim();
      const resumeBase64 = String(body.resumeBase64 ?? '').trim();
      const termsAccepted = body.termsAccepted === true;

      if (!jobTitle) {
        res.status(400).json({ error: 'Post / role applied for is required.' });
        return;
      }
      if (!applicantName) {
        res.status(400).json({ error: 'Full name is required.' });
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(applicantEmail)) {
        res.status(400).json({ error: 'Please enter a valid email address.' });
        return;
      }
      if (applicantPhone.replace(/\D/g, '').length < 10) {
        res.status(400).json({ error: 'Please enter a valid 10-digit mobile number.' });
        return;
      }
      if (!qualificationExperience) {
        res.status(400).json({ error: 'Qualification / Experience is required.' });
        return;
      }
      if (!termsAccepted) {
        res.status(400).json({
          error: 'Please accept Job Secure Terms & Conditions to submit.',
        });
        return;
      }
      if (!resumeBase64 || !resumeFileNameRaw.toLowerCase().endsWith('.pdf')) {
        res.status(400).json({ error: 'Please upload your Resume / CV in PDF format only.' });
        return;
      }

      const saved = savePdfFromBase64(resumeFileNameRaw, resumeBase64);
      const db = readDb();
      const requestedAppId = String(body.id ?? '').trim();
      const appId = /^[a-zA-Z0-9_-]{6,128}$/.test(requestedAppId)
        ? requestedAppId
        : `app_${crypto.randomUUID().replace(/-/g, '')}`;

      const newApp: StoredApplication = {
        id: appId,
        candidateId: 'portal_guest',
        jobId,
        jobTitle,
        companyMasked,
        location: location || city || 'India',
        salary: salary || 'As per Industry Standards',
        experience: experience || qualificationExperience,
        city: city || location || 'India',
        qualificationExperience,
        resumeSummary: resumeSummary || undefined,
        applicantName,
        applicantEmail,
        applicantPhone,
        resumeId: saved.resumeId,
        resumeFileName: saved.resumeFileName,
        termsAccepted: true,
        appliedAt: new Date().toISOString(),
        status: 'Submitted',
      };

      db.applications.push(newApp);

      const emailText = [
        'New Candidate Job Application Received (Resume Godam) - Vardhman Consultancy Services',
        '',
        '=== APPLICANT DETAILS ===',
        `Name: ${newApp.applicantName}`,
        `Official Email: ${newApp.applicantEmail}`,
        `Mobile Number: ${newApp.applicantPhone}`,
        `City: ${newApp.city || newApp.location}`,
        `Qualification / Experience: ${newApp.qualificationExperience}`,
        `Job Secure Terms Accepted: Yes`,
        '',
        '=== APPLIED POSITION ===',
        `Application ID: ${newApp.id}`,
        `Post Applied / Job Title: ${newApp.jobTitle}`,
        `Job Location: ${newApp.location}`,
        `Resume File: ${newApp.resumeFileName}`,
        resumeSummary ? `Summary: ${resumeSummary}` : '',
        `Submitted At: ${newApp.appliedAt}`,
      ]
        .filter(Boolean)
        .join('\n');

      const emailDispatch = await dispatchPortalEmail({
        db,
        type: 'candidate-application',
        fromDisplayName: newApp.applicantName,
        to: DESIGNATED_ADMIN_EMAIL,
        cc: VCS_OFFICIAL_EMAIL,
        replyTo: newApp.applicantEmail,
        subject: `New Application: ${newApp.jobTitle} - ${newApp.applicantName}`,
        text: emailText,
        attachments: resolveResumeAttachment(saved.resumeId, saved.resumeFileName),
        relatedEntityId: newApp.id,
      });

      writeDb(db);

      res.status(201).json({
        application: newApp,
        message: 'Application Submitted Successfully.',
        emailDispatch,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to submit application.';
      res.status(400).json({ error: message });
    }
  });

  // Submit Job Application (+ Auto-send Email to info@vardhmanconsultancy.com)
  app.post('/api/applications', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.candidate) {
        res.status(401).json({ error: 'Please register or log in first to apply.' });
        return;
      }

      const body = (req.body || {}) as Record<string, unknown>;
      const jobId = String(body.jobId ?? '').trim();
      const jobTitle = String(body.jobTitle ?? '').trim();
      const location = String(body.location ?? '').trim();
      const salary = String(body.salary ?? '').trim();
      const experience = String(body.experience ?? '').trim();
      const city = String(body.city ?? location).trim();
      const qualificationExperience = String(
        body.qualificationExperience ?? req.candidate.qualification ?? req.candidate.experience ?? experience ?? ''
      ).trim();
      const resumeSummary = String(body.resumeSummary ?? '').trim();
      const applicantName = String(body.applicantName ?? '').trim();
      const applicantEmail = String(body.applicantEmail ?? '').trim();
      const applicantPhone = String(body.applicantPhone ?? '').trim();
      const useProfileResume = Boolean(body.useProfileResume);
      const resumeFileNameRaw = String(body.resumeFileName ?? '').trim();
      const resumeBase64 = String(body.resumeBase64 ?? '').trim();
      const termsAccepted = body.termsAccepted === undefined ? true : Boolean(body.termsAccepted);

      if (!jobId || !jobTitle) {
        res.status(400).json({ error: 'Job details are missing.' });
        return;
      }
      if (!applicantName) {
        res.status(400).json({ error: 'Full name is required.' });
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(applicantEmail)) {
        res.status(400).json({ error: 'Please enter a valid email address.' });
        return;
      }
      if (applicantPhone.replace(/\D/g, '').length < 10) {
        res.status(400).json({ error: 'Please enter a valid phone number (at least 10 digits).' });
        return;
      }
      if (!termsAccepted) {
        res.status(400).json({
          error: 'Please accept Job Secure Terms & Conditions to submit.',
        });
        return;
      }

      let finalResumeId = '';
      let finalResumeFileName = '';

      if (resumeBase64) {
        const saved = savePdfFromBase64(resumeFileNameRaw, resumeBase64);
        finalResumeId = saved.resumeId;
        finalResumeFileName = saved.resumeFileName;
      } else if (useProfileResume && req.candidate.resumeId && req.candidate.resumeFileName) {
        finalResumeId = req.candidate.resumeId;
        finalResumeFileName = req.candidate.resumeFileName;
      } else {
        res.status(400).json({ error: 'Please upload your Resume PDF to submit this application.' });
        return;
      }

      const db = readDb();
      const requestedAppId = String(body.id ?? '').trim();
      const appId = /^[a-zA-Z0-9_-]{6,128}$/.test(requestedAppId)
        ? requestedAppId
        : `app_${crypto.randomUUID().replace(/-/g, '')}`;

      const newApp: StoredApplication = {
        id: appId,
        candidateId: req.candidate.id,
        jobId,
        jobTitle,
        companyMasked: CONFIDENTIAL_COMPANY_LABEL,
        location,
        salary,
        experience,
        city: city || undefined,
        qualificationExperience: qualificationExperience || undefined,
        resumeSummary: resumeSummary || undefined,
        applicantName,
        applicantEmail,
        applicantPhone,
        resumeId: finalResumeId,
        resumeFileName: finalResumeFileName,
        termsAccepted: true,
        appliedAt: new Date().toISOString(),
        status: 'Submitted',
      };

      db.applications.push(newApp);

      const candidateCompany =
        String(body.companyName ?? req.candidate.currentCompany ?? '').trim() ||
        'Candidate / Individual';

      const emailText = [
        'New Candidate Job Application Received - Vardhman Consultancy Services',
        '',
        '=== APPLICANT DETAILS ===',
        `Name: ${newApp.applicantName}`,
        `Official Email: ${newApp.applicantEmail}`,
        `Phone: ${newApp.applicantPhone}`,
        city ? `City: ${city}` : '',
        qualificationExperience ? `Qualification / Experience: ${qualificationExperience}` : '',
        `Company Name: ${candidateCompany}`,
        '',
        '=== APPLIED POSITION ===',
        `Application ID: ${newApp.id}`,
        `Job Title: ${newApp.jobTitle}`,
        `Location: ${newApp.location}`,
        `Salary: ${newApp.salary}`,
        `Experience Required: ${newApp.experience}`,
        `Resume File: ${newApp.resumeFileName}`,
        resumeSummary ? `Summary: ${resumeSummary}` : '',
        `Submitted At: ${newApp.appliedAt}`,
      ]
        .filter(Boolean)
        .join('\n');

      const displayLabel =
        candidateCompany && candidateCompany !== 'Candidate / Individual'
          ? `${newApp.applicantName} (${candidateCompany})`
          : newApp.applicantName;

      const emailDispatch = await dispatchPortalEmail({
        db,
        type: 'candidate-application',
        fromDisplayName: displayLabel,
        to: DESIGNATED_ADMIN_EMAIL,
        cc: VCS_OFFICIAL_EMAIL,
        replyTo: newApp.applicantEmail,
        subject: `New Application: ${newApp.jobTitle} - ${newApp.applicantName}`,
        text: emailText,
        attachments: resolveResumeAttachment(finalResumeId, finalResumeFileName),
        relatedEntityId: newApp.id,
      });

      writeDb(db);

      res.status(201).json({
        application: newApp,
        message: 'Email Sent Successfully. Application submitted to Admin with CC to info@vardhmanconsultancy.com.',
        emailDispatch,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to submit application.';
      res.status(400).json({ error: message });
    }
  });

  // Public Approved Jobs Only (for Search Jobs & Job Details Pages)
  app.get('/api/jobs/approved', (_req: Request, res: Response) => {
    const db = readDb();
    const approved = db.jobs
      .filter((job) => job.status === 'Approved')
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .map(toPublicApprovedJob);
    res.json({ jobs: approved });
  });

  // Employer Post Complete Requirement / JD (Dashboard Only - Never Exposed on Public Portal)
  // Auto-sends Full Employer Details + JD with CC to info@vardhmanconsultancy.com, plus Auto-Reply to Employer Official Email
  app.post('/api/jobs', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    if (!req.candidate) {
      res.status(401).json({ error: 'Please register or log in first to submit a requirement.' });
      return;
    }
    const userRole = req.candidate.role || 'candidate';
    if (userRole !== 'employer' && userRole !== 'admin') {
      res.status(403).json({ error: 'Only Employer accounts can post job requirements.' });
      return;
    }

    const body = (req.body || {}) as Record<string, unknown>;
    const company = String(body.company ?? req.candidate.companyName ?? '').trim();
    const recruiterName = String(body.recruiterName ?? req.candidate.name ?? '').trim();
    const recruiterEmail = normalizeEmail(body.recruiterEmail ?? req.candidate.email);
    const recruiterPhone = String(body.recruiterPhone ?? req.candidate.phone ?? '').trim();
    const title = String(body.title ?? '').trim();
    const designation = String(body.designation ?? '').trim();
    const location = String(body.location ?? '').trim();
    const experience = String(body.experience ?? '').trim();
    const salary = String(body.salary ?? '').trim();
    const jobType = String(body.jobType ?? '').trim();
    const rawSkills = body.skills;
    const description = String(body.description ?? '').trim();
    const lastDateToApply = String(body.lastDateToApply ?? '').trim();
    const qualification = String(body.qualification ?? '').trim() || 'Graduate / Relevant Qualification';
    const rawOpenings = Number(body.openings);
    const openings = Number.isFinite(rawOpenings) && rawOpenings >= 1 ? Math.floor(rawOpenings) : 1;

    const skills: string[] = Array.isArray(rawSkills)
      ? rawSkills.map((s) => String(s).trim()).filter(Boolean)
      : String(rawSkills ?? '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);

    if (!company) {
      res.status(400).json({ error: 'Company Name is required.' });
      return;
    }
    if (!recruiterName) {
      res.status(400).json({ error: 'Contact Person Name is required.' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recruiterEmail)) {
      res.status(400).json({ error: 'Please enter a valid Official Email ID.' });
      return;
    }
    if (!title) {
      res.status(400).json({ error: 'Job Title is required.' });
      return;
    }
    if (!designation) {
      res.status(400).json({ error: 'Designation is required.' });
      return;
    }
    if (!location) {
      res.status(400).json({ error: 'Location is required.' });
      return;
    }
    if (!experience) {
      res.status(400).json({ error: 'Experience is required.' });
      return;
    }
    if (!salary) {
      res.status(400).json({ error: 'Salary is required.' });
      return;
    }
    if (!jobType) {
      res.status(400).json({ error: 'Job Type is required.' });
      return;
    }
    if (skills.length === 0) {
      res.status(400).json({ error: 'Please enter at least one required skill.' });
      return;
    }
    if (!description) {
      res.status(400).json({ error: 'Complete Job Description / Requirement is required.' });
      return;
    }
    if (!lastDateToApply) {
      res.status(400).json({ error: 'Last Date To Apply is required.' });
      return;
    }

    const nowIso = new Date().toISOString();
    const postedAt = new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    const requestedJobId = String(body.id ?? '').trim();
    const jobId = /^[a-zA-Z0-9_-]{6,128}$/.test(requestedJobId)
      ? requestedJobId
      : `job_${crypto.randomUUID().replace(/-/g, '')}`;
    const autoApprove = Boolean(body.autoApprove);
    const initialStatus: JobApprovalStatus = autoApprove ? 'Approved' : 'Pending';

    const newJob: StoredJob = {
      id: jobId,
      employerId: req.candidate.id,
      company,
      companyMasked: CONFIDENTIAL_COMPANY_LABEL,
      recruiterName,
      recruiterEmail,
      recruiterPhone,
      title,
      designation,
      location,
      experience,
      salary,
      jobType,
      skills,
      description,
      qualification,
      openings,
      lastDateToApply,
      postedAt,
      createdAt: nowIso,
      status: initialStatus,
    };

    const db = readDb();
    db.jobs.push(newJob);

    const officialEmployerEmail = (recruiterEmail || req.candidate.email).trim().toLowerCase();
    const employerCompany = req.candidate.companyName || company;
    const employerContactPerson = req.candidate.name || recruiterName;
    const employerPhone = recruiterPhone || req.candidate.phone || 'Not provided';

    const employerRequirementBody = [
      'EMPLOYER REQUIREMENT / COMPLETE JD SUBMISSION - VARDHMAN CONSULTANCY SERVICES',
      '',
      '=== APPLICANT / EMPLOYER DETAILS ===',
      `Name: ${employerContactPerson}`,
      `Official Email: ${officialEmployerEmail}`,
      `Phone: ${employerPhone}`,
      `Company Name: ${employerCompany}`,
      `Full Address: ${req.candidate.fullAddress || req.candidate.city || 'Not provided'}`,
      '',
      '=== COMPLETE REQUIREMENT / JD ===',
      `Requirement ID: ${newJob.id}`,
      `Job Title: ${newJob.title}`,
      `Designation: ${newJob.designation}`,
      `Location: ${newJob.location}`,
      `Experience: ${newJob.experience}`,
      `Salary: ${newJob.salary}`,
      `Job Type: ${newJob.jobType}`,
      `Openings: ${newJob.openings}`,
      `Qualification: ${newJob.qualification}`,
      `Key Skills: ${newJob.skills.join(', ')}`,
      `Last Date To Apply: ${newJob.lastDateToApply}`,
      '',
      'Complete Job Description:',
      newJob.description,
    ].join('\n');

    const requirementDispatch = await dispatchPortalEmail({
      db,
      type: 'employer-requirement',
      fromDisplayName: `${employerContactPerson} - ${employerCompany}`,
      to: DESIGNATED_ADMIN_EMAIL,
      cc: VCS_OFFICIAL_EMAIL,
      replyTo: officialEmployerEmail,
      subject: `Employer Requirement: ${newJob.title} - ${employerCompany}`,
      text: employerRequirementBody,
      relatedEntityId: newJob.id,
    });

    const autoReplyBody = [
      `Dear ${employerContactPerson},`,
      '',
      'Thank you for submitting your hiring requirement with Vardhman Consultancy Services (Est. 2012).',
      '',
      `We have received your complete requirement / JD for "${newJob.title}" (${employerCompany}) with Reference ID: ${newJob.id}.`,
      'Your requirement stays confidential inside your Employer Dashboard and will never be displayed with your company name on the public portal.',
      '',
      'Our recruitment desk will connect with you shortly regarding candidate screening and shortlisting.',
      '',
      'Warm Regards,',
      'Vardhman Consultancy Services',
      'Email: info@vardhmanconsultancy.com',
      'Mobile & WhatsApp: 7877250630',
    ].join('\n');

    const autoReplyDispatch = await dispatchPortalEmail({
      db,
      type: 'employer-autoreply',
      fromDisplayName: 'Vardhman Consultancy Services',
      to: officialEmployerEmail,
      cc: VCS_OFFICIAL_EMAIL,
      replyTo: VCS_OFFICIAL_EMAIL,
      subject: `Requirement Received: ${newJob.title} - Vardhman Consultancy Services`,
      text: autoReplyBody,
      relatedEntityId: newJob.id,
    });

    writeDb(db);

    res.status(201).json({
      job: newJob,
      message:
        initialStatus === 'Approved'
          ? 'Email Sent Successfully. Job is published live on the Vardhman Consultancy Services Portal, and Full Employer Details + JD emailed to Admin with CC to info@vardhmanconsultancy.com.'
          : 'Email Sent Successfully. Requirement submitted for Admin Approval and Full Employer Details + JD emailed to Admin with CC to info@vardhmanconsultancy.com.',
      emailDispatches: [requirementDispatch, autoReplyDispatch],
    });
  });

  // Employer Dashboard: My Posted Jobs
  app.get('/api/employer/jobs', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    if (!req.candidate) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    const db = readDb();
    const myJobs = db.jobs
      .filter((job) => job.employerId === req.candidate!.id)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    res.json({ jobs: myJobs });
  });

  // Admin Dashboard: All Jobs (Pending, Approved, Rejected)
  app.get('/api/admin/jobs', requireAuth, requireAdmin, (_req: AuthenticatedRequest, res: Response) => {
    const db = readDb();
    const allJobs = [...db.jobs].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    res.json({ jobs: allJobs });
  });

  // Admin Approve / Reject Job
  app.patch(
    '/api/admin/jobs/:jobId/status',
    requireAuth,
    requireAdmin,
    (req: AuthenticatedRequest, res: Response) => {
      const jobId = String(req.params.jobId || '').trim();
      const body = (req.body || {}) as Record<string, unknown>;
      const status = String(body.status ?? '').trim();

      if (status !== 'Approved' && status !== 'Rejected') {
        res.status(400).json({ error: 'Status must be Approved or Rejected.' });
        return;
      }

      const db = readDb();
      const idx = db.jobs.findIndex((j) => j.id === jobId);
      if (idx === -1) {
        res.status(404).json({ error: 'Job mandate not found.' });
        return;
      }

      db.jobs[idx] = {
        ...db.jobs[idx],
        status,
      };
      writeDb(db);

      res.json({ job: db.jobs[idx] });
    }
  );

  // WhatsApp & Email Job Alerts Subscription
  app.post('/api/job-alerts', async (req: Request, res: Response) => {
    const body = (req.body || {}) as Record<string, unknown>;
    const name = String(body.name ?? '').trim();
    const whatsappNumber = String(body.whatsappNumber ?? '').trim();
    const email = normalizeEmail(body.email);
    const city = String(body.city ?? '').trim();
    const category = String(body.category ?? '').trim();
    const rawChannels = Array.isArray(body.channels)
      ? body.channels.filter((ch): ch is 'whatsapp' | 'email' => ch === 'whatsapp' || ch === 'email')
      : [];
    const channels: Array<'whatsapp' | 'email'> =
      rawChannels.length > 0 ? rawChannels : ['whatsapp'];

    if (!name) {
      res.status(400).json({ error: 'Name is required.' });
      return;
    }
    if (channels.includes('whatsapp') && whatsappNumber.replace(/\D/g, '').length < 10) {
      res.status(400).json({ error: 'Please enter a valid 10-digit WhatsApp number.' });
      return;
    }
    if (channels.includes('email') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Please enter a valid email address for Email Alerts.' });
      return;
    }
    if (!city) {
      res.status(400).json({ error: 'City is required.' });
      return;
    }
    if (!category) {
      res.status(400).json({ error: 'Please select a job category.' });
      return;
    }

    const db = readDb();
    const entry: StoredJobAlert = {
      id: `alert_${crypto.randomUUID().replace(/-/g, '')}`,
      name,
      whatsappNumber,
      email: email || null,
      channels,
      city,
      category,
      createdAt: new Date().toISOString(),
    };
    db.jobAlerts.push(entry);

    // Sync alert preferences if viewer is logged in
    const loggedInId = getOptionalAuthenticatedCandidateId(req, db);
    if (loggedInId) {
      const cIdx = db.candidates.findIndex((c) => c.id === loggedInId);
      if (cIdx !== -1) {
        db.candidates[cIdx] = {
          ...db.candidates[cIdx],
          whatsappAlertsEnabled: channels.includes('whatsapp')
            ? true
            : Boolean(db.candidates[cIdx].whatsappAlertsEnabled),
          emailNotificationsEnabled: channels.includes('email')
            ? true
            : Boolean(db.candidates[cIdx].emailNotificationsEnabled),
          whatsappNumber: whatsappNumber || db.candidates[cIdx].whatsappNumber,
          alertCity: city,
          alertCategory: category,
        };
      }
    }

    let emailDispatch: StoredEmailDispatch | null = null;
    if (channels.includes('email') && email) {
      emailDispatch = await dispatchPortalEmail({
        db,
        type: 'job-alert',
        fromDisplayName: 'Vardhman Consultancy Services',
        to: email,
        cc: null,
        replyTo: VCS_OFFICIAL_EMAIL,
        subject: `Job Alert Activated: ${category} in ${city} - VCS Portal`,
        text: [
          `Dear ${name},`,
          '',
          'Your Job Alert subscription on Vardhman Consultancy Services is now active.',
          '',
          `Category: ${category}`,
          `Preferred City: ${city}`,
          `Channels Enabled: ${channels.map((c) => (c === 'whatsapp' ? 'WhatsApp' : 'Email')).join(', ')}`,
          '',
          'You will receive updates as soon as matching verified mandates are published.',
          '',
          'Regards,',
          'Vardhman Consultancy Services (Est. 2012)',
          'Email: info@vardhmanconsultancy.com',
          'WhatsApp & Helpline: 7877250630',
        ].join('\n'),
        relatedEntityId: entry.id,
      });
    }

    writeDb(db);

    res.status(201).json({
      alert: entry,
      emailDispatch,
      message: channels.includes('whatsapp') && channels.includes('email')
        ? 'You Will Get Job Alerts On WhatsApp & Email'
        : channels.includes('email')
          ? 'Email Job Alert Subscription Activated'
          : 'You Will Get Job Alerts On WhatsApp',
    });
  });

  // Contact Us Inquiry Submission (+ Email to Admin with CC to info@vardhmanconsultancy.com)
  app.post('/api/contact', async (req: Request, res: Response) => {
    const body = (req.body || {}) as Record<string, unknown>;
    const name = String(body.name ?? '').trim();
    const email = normalizeEmail(body.email);
    const phone = String(body.phone ?? '').trim();
    const companyName = String(body.companyName ?? '').trim();
    const message = String(body.message ?? '').trim();

    if (!name) {
      res.status(400).json({ error: 'Please enter your name.' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Please enter a valid Official Email ID.' });
      return;
    }
    if (phone.replace(/\D/g, '').length < 10) {
      res.status(400).json({ error: 'Please enter a valid phone number (at least 10 digits).' });
      return;
    }
    if (!message) {
      res.status(400).json({ error: 'Please enter your message.' });
      return;
    }

    const db = readDb();
    const entry: StoredContactInquiry = {
      id: `contact_${crypto.randomUUID().replace(/-/g, '')}`,
      name,
      email,
      phone,
      companyName: companyName || null,
      message,
      createdAt: new Date().toISOString(),
    };
    db.contacts.push(entry);

    const contactEmailText = [
      'New Contact Form Inquiry - Vardhman Consultancy Services',
      '',
      '=== APPLICANT DETAILS ===',
      `Inquiry ID: ${entry.id}`,
      `Name: ${entry.name}`,
      `Official Email: ${entry.email}`,
      `Phone: ${entry.phone}`,
      `Company Name: ${companyName || 'Individual / Candidate'}`,
      `Submitted At: ${entry.createdAt}`,
      '',
      'Message:',
      entry.message,
    ].join('\n');

    const contactDisplayLabel = companyName ? `${entry.name} (${companyName})` : entry.name;

    const emailDispatch = await dispatchPortalEmail({
      db,
      type: 'contact-inquiry',
      fromDisplayName: contactDisplayLabel,
      to: DESIGNATED_ADMIN_EMAIL,
      cc: VCS_OFFICIAL_EMAIL,
      replyTo: entry.email,
      subject: `Contact Form Inquiry: ${contactDisplayLabel} - Vardhman Consultancy Services`,
      text: contactEmailText,
      relatedEntityId: entry.id,
    });

    writeDb(db);

    res.status(201).json({
      contact: entry,
      message:
        'Email Sent Successfully. Your inquiry has been sent to Admin with CC to info@vardhmanconsultancy.com.',
      emailDispatch,
    });
  });

  // Serve Uploaded Insight Post Images
  app.get('/api/insights/images/:fileName', (req: Request, res: Response) => {
    const fileName = String(req.params.fileName || '').trim();
    if (!/^[a-zA-Z0-9_]+\.(png|jpg|jpeg|webp|gif)$/.test(fileName)) {
      res.status(400).json({ error: 'Invalid image path.' });
      return;
    }
    const filePath = path.join(INSIGHTS_IMAGES_DIR, fileName);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'Image not found.' });
      return;
    }
    res.sendFile(filePath);
  });

  // Public VCS Insights Feed (Latest Posts First — All Visitors Can View Without Login)
  app.get('/api/insights', (req: Request, res: Response) => {
    const db = readDb();
    const viewerActorId = getViewerActorId(req, db);
    const posts = [...db.insightsPosts]
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .map((post) => toPublicInsightPost(post, viewerActorId));
    res.json({ posts });
  });

  // Admin-Only: Create Official VCS Insights Post
  app.post('/api/insights', requireAuth, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.candidate) {
        res.status(401).json({ error: 'Authentication required.' });
        return;
      }

      const body = (req.body || {}) as Record<string, unknown>;
      const title = String(body.title ?? '').trim();
      const description = String(body.description ?? '').trim();
      const category = normalizeInsightCategory(body.category);
      const hashtags = normalizeHashtags(body.hashtags);
      const ctaLabel = String(body.ctaLabel ?? '').trim() || null;
      const imageBase64 = String(body.imageBase64 ?? '').trim();

      if (!title || title.length < 3) {
        res.status(400).json({ error: 'Please enter a professional post title (at least 3 characters).' });
        return;
      }
      if (!description || description.length < 10) {
        res.status(400).json({ error: 'Please enter a clear post description (at least 10 characters).' });
        return;
      }

      let imageFileName: string | null = null;
      let imageUrl: string | null = null;
      if (imageBase64) {
        const saved = saveInsightImageFromBase64(imageBase64);
        imageFileName = saved.imageFileName;
        imageUrl = saved.imageUrl;
      }

      const now = new Date().toISOString();
      const newPost: StoredInsightPost = {
        id: `post_${crypto.randomUUID().replace(/-/g, '')}`,
        title,
        description,
        category,
        hashtags,
        ctaLabel,
        imageFileName,
        imageUrl,
        authorId: req.candidate.id,
        authorName: req.candidate.name || 'VCS Team',
        likedByIds: [],
        comments: [],
        createdAt: now,
        updatedAt: null,
      };

      const db = readDb();
      db.insightsPosts.push(newPost);
      writeDb(db);

      const viewerActorId = `user:${req.candidate.id}`;
      res.status(201).json({ post: toPublicInsightPost(newPost, viewerActorId) });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to publish insight post.';
      res.status(400).json({ error: message });
    }
  });

  // Admin-Only: Edit Official VCS Insights Post
  app.patch(
    '/api/insights/:postId',
    requireAuth,
    requireAdmin,
    (req: AuthenticatedRequest, res: Response) => {
      try {
        if (!req.candidate) {
          res.status(401).json({ error: 'Authentication required.' });
          return;
        }
        const postId = String(req.params.postId || '').trim();
        const body = (req.body || {}) as Record<string, unknown>;
        const title = String(body.title ?? '').trim();
        const description = String(body.description ?? '').trim();
        const category = normalizeInsightCategory(body.category);
        const hashtags =
          body.hashtags !== undefined ? normalizeHashtags(body.hashtags) : undefined;
        const ctaLabel =
          body.ctaLabel !== undefined
            ? String(body.ctaLabel ?? '').trim() || null
            : undefined;
        const imageBase64 = String(body.imageBase64 ?? '').trim();
        const removeImage = Boolean(body.removeImage);

        if (!title || title.length < 3) {
          res.status(400).json({ error: 'Post title is required (at least 3 characters).' });
          return;
        }
        if (!description || description.length < 10) {
          res.status(400).json({ error: 'Post description is required (at least 10 characters).' });
          return;
        }

        const db = readDb();
        const idx = db.insightsPosts.findIndex((p) => p.id === postId);
        if (idx === -1) {
          res.status(404).json({ error: 'Insight post not found.' });
          return;
        }

        const existing = db.insightsPosts[idx];
        let imageFileName = existing.imageFileName;
        let imageUrl = existing.imageUrl;

        if (imageBase64) {
          const saved = saveInsightImageFromBase64(imageBase64);
          removeInsightImageFile(existing.imageFileName);
          imageFileName = saved.imageFileName;
          imageUrl = saved.imageUrl;
        } else if (removeImage) {
          removeInsightImageFile(existing.imageFileName);
          imageFileName = null;
          imageUrl = null;
        }

        const updated: StoredInsightPost = {
          ...existing,
          title,
          description,
          category,
          hashtags: hashtags !== undefined ? hashtags : existing.hashtags || [],
          ctaLabel: ctaLabel !== undefined ? ctaLabel : existing.ctaLabel || null,
          imageFileName,
          imageUrl,
          updatedAt: new Date().toISOString(),
        };

        db.insightsPosts[idx] = updated;
        writeDb(db);

        const viewerActorId = `user:${req.candidate.id}`;
        res.json({ post: toPublicInsightPost(updated, viewerActorId) });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to update post.';
        res.status(400).json({ error: message });
      }
    }
  );

  // Admin-Only: Delete Official VCS Insights Post
  app.delete(
    '/api/insights/:postId',
    requireAuth,
    requireAdmin,
    (req: AuthenticatedRequest, res: Response) => {
      const postId = String(req.params.postId || '').trim();
      const db = readDb();
      const idx = db.insightsPosts.findIndex((p) => p.id === postId);
      if (idx === -1) {
        res.status(404).json({ error: 'Insight post not found.' });
        return;
      }

      const [removed] = db.insightsPosts.splice(idx, 1);
      removeInsightImageFile(removed.imageFileName);
      writeDb(db);

      res.json({ deletedId: postId });
    }
  );

  // Toggle Like on VCS Insights Post (Logged-in Users or Visitors)
  app.post('/api/insights/:postId/like', (req: Request, res: Response) => {
    const postId = String(req.params.postId || '').trim();
    const db = readDb();
    const idx = db.insightsPosts.findIndex((p) => p.id === postId);
    if (idx === -1) {
      res.status(404).json({ error: 'Insight post not found.' });
      return;
    }

    const viewerActorId = getViewerActorId(req, db);
    if (!viewerActorId) {
      res.status(400).json({ error: 'Unable to identify session for reaction.' });
      return;
    }

    const existing = db.insightsPosts[idx];
    const likedByIds = Array.isArray(existing.likedByIds) ? [...existing.likedByIds] : [];
    const existingIdx = likedByIds.indexOf(viewerActorId);
    if (existingIdx >= 0) {
      likedByIds.splice(existingIdx, 1);
    } else {
      likedByIds.push(viewerActorId);
    }

    const updated: StoredInsightPost = {
      ...existing,
      likedByIds,
    };
    db.insightsPosts[idx] = updated;
    writeDb(db);

    res.json({ post: toPublicInsightPost(updated, viewerActorId) });
  });

  // Logged-In Users Only: Add Comment on VCS Insights Post
  app.post('/api/insights/:postId/comments', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    if (!req.candidate) {
      res.status(401).json({ error: 'Please log in to post a comment.' });
      return;
    }

    const postId = String(req.params.postId || '').trim();
    const body = (req.body || {}) as Record<string, unknown>;
    const content = String(body.content ?? '').trim();

    if (!content) {
      res.status(400).json({ error: 'Please enter a comment before posting.' });
      return;
    }
    if (content.length > 1500) {
      res.status(400).json({ error: 'Comment must be 1500 characters or fewer.' });
      return;
    }

    const db = readDb();
    const idx = db.insightsPosts.findIndex((p) => p.id === postId);
    if (idx === -1) {
      res.status(404).json({ error: 'Insight post not found.' });
      return;
    }

    const newComment: StoredInsightComment = {
      id: `cmt_${crypto.randomUUID().replace(/-/g, '')}`,
      postId,
      authorId: req.candidate.id,
      authorName: req.candidate.name,
      authorRole: req.candidate.role || 'candidate',
      content,
      createdAt: new Date().toISOString(),
    };

    const existing = db.insightsPosts[idx];
    const comments = Array.isArray(existing.comments) ? [...existing.comments, newComment] : [newComment];
    const updated: StoredInsightPost = {
      ...existing,
      comments,
    };

    db.insightsPosts[idx] = updated;
    writeDb(db);

    const viewerActorId = `user:${req.candidate.id}`;
    res.status(201).json({ post: toPublicInsightPost(updated, viewerActorId), comment: newComment });
  });

  // Admin-Only: Moderate & Delete Comment on VCS Insights Post
  app.delete(
    '/api/insights/:postId/comments/:commentId',
    requireAuth,
    requireAdmin,
    (req: AuthenticatedRequest, res: Response) => {
      if (!req.candidate) {
        res.status(401).json({ error: 'Authentication required.' });
        return;
      }

      const postId = String(req.params.postId || '').trim();
      const commentId = String(req.params.commentId || '').trim();
      const db = readDb();
      const idx = db.insightsPosts.findIndex((p) => p.id === postId);
      if (idx === -1) {
        res.status(404).json({ error: 'Insight post not found.' });
        return;
      }

      const existing = db.insightsPosts[idx];
      const comments = Array.isArray(existing.comments) ? existing.comments : [];
      const nextComments = comments.filter((c) => c.id !== commentId);
      if (nextComments.length === comments.length) {
        res.status(404).json({ error: 'Comment not found.' });
        return;
      }

      const updated: StoredInsightPost = {
        ...existing,
        comments: nextComments,
      };
      db.insightsPosts[idx] = updated;
      writeDb(db);

      const viewerActorId = `user:${req.candidate.id}`;
      res.json({ post: toPublicInsightPost(updated, viewerActorId) });
    }
  );

  // =========================================================================
  // SERVER-SIDE GEMINI AI FEATURES (/api/ai/*) - Uses gemini-4-hydrogen
  // =========================================================================
  function getGeminiAiClient(): GoogleGenAI {
    const apiKey = (process.env.GEMINI_API_KEY || '').trim();
    if (!apiKey) {
      throw new Error(
        'Gemini API key is not configured on the server. Please check Settings > Secrets.'
      );
    }
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }

  function extractGeminiErrorMessage(error: unknown): { status: number; message: string } {
    const rawMsg = error instanceof Error ? error.message : String(error || 'AI request failed.');
    if (rawMsg.includes('API key is not configured')) {
      return { status: 503, message: rawMsg };
    }
    if (rawMsg.includes('RESOURCE_EXHAUSTED') || rawMsg.includes('429')) {
      return {
        status: 429,
        message: 'AI rate limit temporarily reached. Please wait a moment and try again.',
      };
    }
    if (rawMsg.includes('API_KEY_INVALID') || rawMsg.includes('PERMISSION_DENIED')) {
      return {
        status: 403,
        message: 'Gemini API key permission error. Please verify your API key in Settings > Secrets.',
      };
    }
    return { status: 502, message: rawMsg || 'Unable to reach AI service right now.' };
  }

  // AI Resume & Profile Assistant
  app.post('/api/ai/resume-assist', async (req: Request, res: Response) => {
    try {
      const body = (req.body || {}) as Record<string, unknown>;
      const name = String(body.name ?? '').trim() || 'Candidate';
      const role = String(body.role ?? body.designation ?? '').trim();
      const experience = String(body.experience ?? 'Fresher').trim();
      const education = String(body.education ?? body.qualification ?? '').trim();
      const skills = String(body.skills ?? '').trim();
      const city = String(body.city ?? '').trim();

      const ai = getGeminiAiClient();
      const prompt = [
        'Write concise, professional, recruiter-ready Indian job-market copy for this candidate.',
        `Candidate Name: ${name}`,
        `Target/Current Role: ${role || 'Healthcare / Pharma / Corporate Professional'}`,
        `Experience: ${experience}`,
        `Education: ${education || 'Relevant Qualification'}`,
        `Skills: ${skills || 'Domain Expertise, Communication'}`,
        `City: ${city || 'India'}`,
        'Return JSON only with fields: resumeHeadline (1 crisp line under 110 chars), profileSummary (2-3 sentences), careerSummary (2-3 sentences), resumeSummary (2 crisp sentences), careerObjective (2 sentences suitable for CV top), suggestedSkills (array of 6 relevant concise skill strings).',
      ].join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction:
            'You are an expert executive recruitment advisor at Vardhman Consultancy Services. Produce crisp, authentic, ATS-friendly career copy without exaggeration.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              resumeHeadline: { type: Type.STRING },
              profileSummary: { type: Type.STRING },
              careerSummary: { type: Type.STRING },
              resumeSummary: { type: Type.STRING },
              careerObjective: { type: Type.STRING },
              suggestedSkills: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim()) as Record<string, unknown>;
      res.json({
        resumeHeadline: String(parsed.resumeHeadline ?? ''),
        profileSummary: String(parsed.profileSummary ?? ''),
        careerSummary: String(parsed.careerSummary ?? ''),
        resumeSummary: String(parsed.resumeSummary ?? ''),
        careerObjective: String(parsed.careerObjective ?? ''),
        suggestedSkills: Array.isArray(parsed.suggestedSkills)
          ? parsed.suggestedSkills.map((s) => String(s)).filter(Boolean)
          : [],
      });
    } catch (err) {
      const info = extractGeminiErrorMessage(err);
      res.status(info.status).json({ error: info.message });
    }
  });

  // AI Smart Match & Job Fit Analyzer
  app.post('/api/ai/smart-match', async (req: Request, res: Response) => {
    try {
      const body = (req.body || {}) as Record<string, unknown>;
      const job = (body.job || {}) as Record<string, unknown>;
      const candidateInfo = (body.candidate || {}) as Record<string, unknown>;

      if (!job.title) {
        res.status(400).json({ error: 'Job details are required for AI fit analysis.' });
        return;
      }

      const ai = getGeminiAiClient();
      const prompt = [
        'Evaluate how well this candidate matches the job opening and give actionable advice.',
        'JOB:',
        `Title: ${String(job.title || '')}`,
        `Designation: ${String(job.designation || '')}`,
        `Location: ${String(job.location || '')}`,
        `Experience Required: ${String(job.experience || '')}`,
        `Qualification: ${String(job.qualification || '')}`,
        `Skills Required: ${Array.isArray(job.skills) ? job.skills.join(', ') : String(job.skills || '')}`,
        `Description: ${String(job.description || '').slice(0, 1200)}`,
        '',
        'CANDIDATE:',
        `Name: ${String(candidateInfo.name || 'Candidate')}`,
        `Role/Designation: ${String(candidateInfo.designation || candidateInfo.preferredRole || 'Not specified')}`,
        `Experience: ${String(candidateInfo.experience || 'Not specified')}`,
        `Qualification: ${String(candidateInfo.qualification || 'Not specified')}`,
        `City: ${String(candidateInfo.city || 'Not specified')}`,
        `Skills: ${Array.isArray(candidateInfo.keySkills) ? candidateInfo.keySkills.join(', ') : String(candidateInfo.keySkills || 'Not specified')}`,
      ].join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction:
            'You are a recruitment matching specialist. Output honest, constructive JSON match analysis with fitScore (integer 0-100), summary (2 sentences), matchedStrengths (2-4 bullet phrases), missingOrImproveSkills (1-3 items), and applicationTip (1 practical tip).',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              fitScore: { type: Type.INTEGER },
              summary: { type: Type.STRING },
              matchedStrengths: { type: Type.ARRAY, items: { type: Type.STRING } },
              missingOrImproveSkills: { type: Type.ARRAY, items: { type: Type.STRING } },
              applicationTip: { type: Type.STRING },
            },
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim()) as Record<string, unknown>;
      res.json({
        fitScore: Math.max(0, Math.min(100, Number(parsed.fitScore) || 70)),
        summary: String(parsed.summary ?? ''),
        matchedStrengths: Array.isArray(parsed.matchedStrengths)
          ? parsed.matchedStrengths.map(String)
          : [],
        missingOrImproveSkills: Array.isArray(parsed.missingOrImproveSkills)
          ? parsed.missingOrImproveSkills.map(String)
          : [],
        applicationTip: String(parsed.applicationTip ?? ''),
      });
    } catch (err) {
      const info = extractGeminiErrorMessage(err);
      res.status(info.status).json({ error: info.message });
    }
  });

  // AI Skill Test Generator (Portal Skill Assessment)
  app.post('/api/ai/skill-test/generate', async (req: Request, res: Response) => {
    try {
      const body = (req.body || {}) as Record<string, unknown>;
      const topic = String(body.topic ?? '').trim() || 'Pharmaceutical QA & GMP';
      const difficulty = String(body.difficulty ?? 'Intermediate').trim();

      const ai = getGeminiAiClient();
      const prompt = [
        `Generate 6 practical multiple-choice skill assessment questions for the topic: "${topic}" at "${difficulty}" difficulty level.`,
        'Each question must have exactly 4 distinct options, a valid zero-based correctIndex (0, 1, 2, or 3), and a short clear 1-sentence explanation.',
      ].join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction:
            'You are a technical & clinical recruitment examiner in India. Generate accurate, unambiguous, practical MCQ questions in JSON.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                correctIndex: { type: Type.INTEGER },
                explanation: { type: Type.STRING },
              },
            },
          },
        },
      });

      const rawList = JSON.parse((response.text ?? '[]').trim()) as Array<Record<string, unknown>>;
      const questions = rawList
        .filter(
          (q) =>
            typeof q.question === 'string' &&
            Array.isArray(q.options) &&
            q.options.length >= 2
        )
        .slice(0, 8)
        .map((q, idx) => {
          const opts = (q.options as unknown[]).slice(0, 4).map(String);
          const rawIdx = Number(q.correctIndex);
          const correctIndex =
            Number.isInteger(rawIdx) && rawIdx >= 0 && rawIdx < opts.length ? rawIdx : 0;
          return {
            id: `q_${idx + 1}_${crypto.randomUUID().slice(0, 6)}`,
            question: String(q.question),
            options: opts,
            correctIndex,
            explanation: String(q.explanation || 'Correct answer verified.'),
          };
        });

      if (questions.length === 0) {
        throw new Error('Could not generate valid questions for this topic. Please retry.');
      }

      res.json({ topic, difficulty, questions });
    } catch (err) {
      const info = extractGeminiErrorMessage(err);
      res.status(info.status).json({ error: info.message });
    }
  });

  // AI Interview Prep Coach (Bilingual English + Hindi)
  app.post('/api/ai/interview-coach', async (req: Request, res: Response) => {
    try {
      const body = (req.body || {}) as Record<string, unknown>;
      const roleTitle = String(body.roleTitle ?? '').trim() || 'Healthcare & Pharma Professional';
      const skills = String(body.skills ?? '').trim();
      const experience = String(body.experience ?? '').trim();

      const ai = getGeminiAiClient();
      const prompt = [
        `Prepare a focused interview coaching brief for the role: "${roleTitle}".`,
        skills ? `Key Skills: ${skills}` : '',
        experience ? `Experience Level: ${experience}` : '',
        'Include: roleTitle, keyTopics (4 items), questionsAndAnswers (4 likely interview questions, each with a concise englishTip and practical hindiTip in Devanagari Hindi), and closingChecklist (3 short action items).',
      ]
        .filter(Boolean)
        .join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction:
            'You are a senior career mentor at Vardhman Consultancy Services. Keep answers encouraging, realistic, and concise.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              roleTitle: { type: Type.STRING },
              keyTopics: { type: Type.ARRAY, items: { type: Type.STRING } },
              questionsAndAnswers: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    question: { type: Type.STRING },
                    englishTip: { type: Type.STRING },
                    hindiTip: { type: Type.STRING },
                  },
                },
              },
              closingChecklist: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim()) as Record<string, unknown>;
      res.json({
        roleTitle: String(parsed.roleTitle || roleTitle),
        keyTopics: Array.isArray(parsed.keyTopics) ? parsed.keyTopics.map(String) : [],
        questionsAndAnswers: Array.isArray(parsed.questionsAndAnswers)
          ? parsed.questionsAndAnswers.map((qa) => {
              const item = qa as Record<string, unknown>;
              return {
                question: String(item.question || ''),
                englishTip: String(item.englishTip || ''),
                hindiTip: String(item.hindiTip || ''),
              };
            })
          : [],
        closingChecklist: Array.isArray(parsed.closingChecklist)
          ? parsed.closingChecklist.map(String)
          : [],
      });
    } catch (err) {
      const info = extractGeminiErrorMessage(err);
      res.status(info.status).json({ error: info.message });
    }
  });

  // AI Job Description Drafter (for Employers posting requirements)
  app.post('/api/ai/job-description', async (req: Request, res: Response) => {
    try {
      const body = (req.body || {}) as Record<string, unknown>;
      const jobTitle = String(body.jobTitle ?? '').trim();
      const city = String(body.city ?? '').trim();
      const salary = String(body.salary ?? '').trim();
      if (!jobTitle) {
        res.status(400).json({ error: 'Please enter the Post Required / Job Title first.' });
        return;
      }

      const ai = getGeminiAiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Draft a crisp, structured confidential Job Description for "${jobTitle}"${city ? ` in ${city}` : ''}${salary ? ` (Salary: ${salary})` : ''}. Include Role Overview, Key Responsibilities (4-5 bullet points), and Required Qualifications & Skills. Do NOT invent any company name.`,
        config: {
          systemInstruction:
            'You are an executive HR consultant. Write clear plain-text JDs suitable for Indian healthcare, pharma, and corporate recruitment.',
        },
      });

      res.json({ description: (response.text ?? '').trim() });
    } catch (err) {
      const info = extractGeminiErrorMessage(err);
      res.status(info.status).json({ error: info.message });
    }
  });

  // =========================================================================
  // CANDIDATE CAREER TOOLS: Preferences, Search History, Skill Tests,
  // Auto-Apply Mode, Email Notifications & Interview Reminders
  // =========================================================================

  // Update Notification Preferences (Email, WhatsApp Alert, Auto-Apply Config)
  app.put(
    '/api/candidate/preferences',
    requireAuth,
    async (req: AuthenticatedRequest, res: Response) => {
      if (!req.candidate) {
        res.status(401).json({ error: 'Authentication required.' });
        return;
      }
      const body = (req.body || {}) as Record<string, unknown>;
      const db = readDb();
      const idx = db.candidates.findIndex((c) => c.id === req.candidate!.id);
      if (idx === -1) {
        res.status(404).json({ error: 'Account not found.' });
        return;
      }

      const existing = db.candidates[idx];
      const nextEmailPref =
        body.emailNotificationsEnabled !== undefined
          ? Boolean(body.emailNotificationsEnabled)
          : Boolean(existing.emailNotificationsEnabled ?? true);
      const nextWhatsappPref =
        body.whatsappAlertsEnabled !== undefined
          ? Boolean(body.whatsappAlertsEnabled)
          : Boolean(existing.whatsappAlertsEnabled);
      const nextWhatsappNum =
        body.whatsappNumber !== undefined
          ? String(body.whatsappNumber ?? '').trim()
          : existing.whatsappNumber || existing.phone;
      const nextAlertCity =
        body.alertCity !== undefined
          ? String(body.alertCity ?? '').trim()
          : existing.alertCity || existing.city;
      const nextAlertCategory =
        body.alertCategory !== undefined
          ? String(body.alertCategory ?? '').trim()
          : existing.alertCategory || null;

      const prevAuto = existing.autoApplyConfig || {
        enabled: false,
        minMatchScore: 65,
        preferredKeywords: Array.isArray(existing.keySkills) ? existing.keySkills.join(', ') : '',
        preferredLocations: existing.preferredLocation || existing.city || '',
        maxDailyApps: 5,
        lastRunAt: null,
        lastRunCount: 0,
      };
      const rawAuto = (body.autoApplyConfig || {}) as Record<string, unknown>;
      const nextAuto: StoredAutoApplyConfig = {
        enabled:
          rawAuto.enabled !== undefined ? Boolean(rawAuto.enabled) : prevAuto.enabled,
        minMatchScore:
          rawAuto.minMatchScore !== undefined
            ? Math.max(40, Math.min(95, Number(rawAuto.minMatchScore) || 65))
            : prevAuto.minMatchScore,
        preferredKeywords:
          rawAuto.preferredKeywords !== undefined
            ? String(rawAuto.preferredKeywords ?? '').trim()
            : prevAuto.preferredKeywords,
        preferredLocations:
          rawAuto.preferredLocations !== undefined
            ? String(rawAuto.preferredLocations ?? '').trim()
            : prevAuto.preferredLocations,
        maxDailyApps:
          rawAuto.maxDailyApps !== undefined
            ? Math.max(1, Math.min(15, Number(rawAuto.maxDailyApps) || 5))
            : prevAuto.maxDailyApps,
        lastRunAt: prevAuto.lastRunAt || null,
        lastRunCount: prevAuto.lastRunCount || 0,
      };

      db.candidates[idx] = {
        ...existing,
        emailNotificationsEnabled: nextEmailPref,
        whatsappAlertsEnabled: nextWhatsappPref,
        whatsappNumber: nextWhatsappNum || null,
        alertCity: nextAlertCity || null,
        alertCategory: nextAlertCategory || null,
        autoApplyConfig: nextAuto,
      };

      let emailDispatch: StoredEmailDispatch | null = null;
      if (Boolean(body.sendConfirmationEmail) && nextEmailPref && existing.email) {
        emailDispatch = await dispatchPortalEmail({
          db,
          type: 'job-alert',
          fromDisplayName: 'Vardhman Consultancy Services',
          to: existing.email,
          cc: null,
          replyTo: VCS_OFFICIAL_EMAIL,
          subject: 'Email & Career Alert Preferences Updated - VCS Portal',
          text: [
            `Dear ${existing.name},`,
            '',
            'Your notification & career automation preferences on Vardhman Consultancy Services have been updated:',
            `- Email Notifications: ${nextEmailPref ? 'Enabled' : 'Disabled'}`,
            `- WhatsApp Alerts: ${nextWhatsappPref ? `Enabled (${nextWhatsappNum || existing.phone})` : 'Disabled'}`,
            `- Auto-Apply Mode: ${nextAuto.enabled ? `Active (Min Smart Match: ${nextAuto.minMatchScore}%)` : 'Off'}`,
            nextAlertCategory ? `- Target Category: ${nextAlertCategory}` : '',
            nextAlertCity ? `- Preferred City: ${nextAlertCity}` : '',
            '',
            'Warm Regards,',
            'Vardhman Consultancy Services',
          ]
            .filter(Boolean)
            .join('\n'),
          relatedEntityId: existing.id,
        });
      }

      writeDb(db);
      res.json({ candidate: toPublicCandidate(db.candidates[idx]), emailDispatch });
    }
  );

  // Candidate Search History CRUD
  app.get('/api/candidate/search-history', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const list = Array.isArray(req.candidate?.searchHistory) ? req.candidate!.searchHistory : [];
    res.json({ history: list });
  });

  app.post('/api/candidate/search-history', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const body = (req.body || {}) as Record<string, unknown>;
    const keyword = String(body.keyword ?? '').trim();
    const location = String(body.location ?? '').trim();
    const experience = String(body.experience ?? '').trim();
    const salary = String(body.salary ?? '').trim();
    const designation = String(body.designation ?? '').trim();

    if (!keyword && !location && !experience && !salary && !designation) {
      res.json({ history: req.candidate?.searchHistory || [] });
      return;
    }

    const db = readDb();
    const idx = db.candidates.findIndex((c) => c.id === req.candidate!.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Account not found.' });
      return;
    }

    const current = Array.isArray(db.candidates[idx].searchHistory)
      ? db.candidates[idx].searchHistory!
      : [];
    const entry: StoredSearchHistoryItem = {
      id: `sh_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`,
      keyword,
      location,
      experience: experience || undefined,
      salary: salary || undefined,
      designation: designation || undefined,
      createdAt: new Date().toISOString(),
    };

    const deduped = current.filter(
      (item) =>
        !(
          item.keyword.toLowerCase() === keyword.toLowerCase() &&
          item.location.toLowerCase() === location.toLowerCase() &&
          (item.experience || '') === experience
        )
    );
    const updated = [entry, ...deduped].slice(0, 12);
    db.candidates[idx] = { ...db.candidates[idx], searchHistory: updated };
    writeDb(db);
    res.json({ history: updated, candidate: toPublicCandidate(db.candidates[idx]) });
  });

  app.delete('/api/candidate/search-history', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const itemId = String(req.query.id || '').trim();
    const db = readDb();
    const idx = db.candidates.findIndex((c) => c.id === req.candidate!.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Account not found.' });
      return;
    }
    const current = Array.isArray(db.candidates[idx].searchHistory)
      ? db.candidates[idx].searchHistory!
      : [];
    const updated = itemId ? current.filter((h) => h.id !== itemId) : [];
    db.candidates[idx] = { ...db.candidates[idx], searchHistory: updated };
    writeDb(db);
    res.json({ history: updated, candidate: toPublicCandidate(db.candidates[idx]) });
  });

  // Save Candidate Skill Test Result (+ Optional Email Certificate Summary)
  app.post(
    '/api/candidate/skill-tests',
    requireAuth,
    async (req: AuthenticatedRequest, res: Response) => {
      if (!req.candidate) {
        res.status(401).json({ error: 'Authentication required.' });
        return;
      }
      const body = (req.body || {}) as Record<string, unknown>;
      const topic = String(body.topic ?? '').trim() || 'General Assessment';
      const rawDiff = String(body.difficulty ?? 'Intermediate').trim();
      const difficulty: StoredSkillTestResult['difficulty'] =
        rawDiff === 'Beginner' || rawDiff === 'Advanced' ? rawDiff : 'Intermediate';
      const totalQuestions = Math.max(1, Number(body.totalQuestions) || 6);
      const correctAnswers = Math.max(0, Math.min(totalQuestions, Number(body.correctAnswers) || 0));
      const scorePercent = Math.round((correctAnswers / totalQuestions) * 100);
      const badgeLabel: StoredSkillTestResult['badgeLabel'] =
        scorePercent >= 80 ? 'Top Performer' : scorePercent >= 60 ? 'Verified Skill' : 'Completed';

      const db = readDb();
      const idx = db.candidates.findIndex((c) => c.id === req.candidate!.id);
      if (idx === -1) {
        res.status(404).json({ error: 'Account not found.' });
        return;
      }

      const result: StoredSkillTestResult = {
        id: `test_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`,
        topic,
        difficulty,
        totalQuestions,
        correctAnswers,
        scorePercent,
        badgeLabel,
        completedAt: new Date().toISOString(),
      };

      const existingTests = Array.isArray(db.candidates[idx].skillTestResults)
        ? db.candidates[idx].skillTestResults!
        : [];
      db.candidates[idx] = {
        ...db.candidates[idx],
        skillTestResults: [result, ...existingTests].slice(0, 25),
      };

      let emailDispatch: StoredEmailDispatch | null = null;
      if (
        (db.candidates[idx].emailNotificationsEnabled ?? true) &&
        db.candidates[idx].email &&
        Boolean(body.sendEmailReport)
      ) {
        emailDispatch = await dispatchPortalEmail({
          db,
          type: 'skill-test-report',
          fromDisplayName: 'Vardhman Consultancy Services',
          to: db.candidates[idx].email,
          cc: null,
          replyTo: VCS_OFFICIAL_EMAIL,
          subject: `Skill Assessment Result: ${topic} (${scorePercent}%) - VCS Portal`,
          text: [
            `Dear ${db.candidates[idx].name},`,
            '',
            `You have completed the Skill Assessment on Vardhman Consultancy Services Portal.`,
            `Topic: ${topic} (${difficulty})`,
            `Score: ${correctAnswers}/${totalQuestions} (${scorePercent}%)`,
            `Badge Earned: ${badgeLabel}`,
            '',
            'Your verified skill result is now attached to your Candidate Dashboard profile.',
            '',
            'Regards,',
            'Vardhman Consultancy Services',
          ].join('\n'),
          relatedEntityId: result.id,
        });
      }

      writeDb(db);
      res.status(201).json({
        result,
        candidate: toPublicCandidate(db.candidates[idx]),
        emailDispatch,
      });
    }
  );

  // Interview Reminders CRUD + Email Dispatch
  app.post(
    '/api/candidate/interview-reminders',
    requireAuth,
    async (req: AuthenticatedRequest, res: Response) => {
      const body = (req.body || {}) as Record<string, unknown>;
      const jobTitle = String(body.jobTitle ?? '').trim();
      const companyName = String(body.companyName ?? '').trim() || CONFIDENTIAL_COMPANY_LABEL;
      const interviewDate = String(body.interviewDate ?? '').trim();
      const interviewTime = String(body.interviewTime ?? '').trim() || '11:00';
      const rawMode = String(body.mode ?? 'Video Call').trim();
      const mode: StoredInterviewReminder['mode'] =
        rawMode === 'In-Person' || rawMode === 'Phone Screen' ? rawMode : 'Video Call';
      const locationOrLink = String(body.locationOrLink ?? '').trim() || 'Details shared via VCS';
      const notes = String(body.notes ?? '').trim();
      const jobId = body.jobId ? String(body.jobId).trim() : null;

      if (!jobTitle || !interviewDate) {
        res.status(400).json({ error: 'Job Role and Interview Date are required.' });
        return;
      }

      const db = readDb();
      const idx = db.candidates.findIndex((c) => c.id === req.candidate!.id);
      if (idx === -1) {
        res.status(404).json({ error: 'Account not found.' });
        return;
      }

      const reminder: StoredInterviewReminder = {
        id: `int_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`,
        jobId,
        jobTitle,
        companyName,
        interviewDate,
        interviewTime,
        mode,
        locationOrLink,
        notes: notes || undefined,
        emailSentAt: null,
        status: 'Scheduled',
        createdAt: new Date().toISOString(),
      };

      if (Boolean(body.sendEmailReminder) && db.candidates[idx].email) {
        await dispatchPortalEmail({
          db,
          type: 'interview-reminder',
          fromDisplayName: 'Vardhman Consultancy Services',
          to: db.candidates[idx].email,
          cc: null,
          replyTo: VCS_OFFICIAL_EMAIL,
          subject: `Interview Reminder: ${jobTitle} on ${interviewDate} at ${interviewTime}`,
          text: [
            `Dear ${db.candidates[idx].name},`,
            '',
            'This is your scheduled Interview Reminder on Vardhman Consultancy Services Portal:',
            `Position: ${jobTitle}`,
            `Company: ${companyName}`,
            `Date & Time: ${interviewDate} at ${interviewTime}`,
            `Mode: ${mode}`,
            `Venue / Link: ${locationOrLink}`,
            notes ? `Notes: ${notes}` : '',
            '',
            'Best Wishes for your interview!',
            'Vardhman Consultancy Services (Est. 2012)',
          ]
            .filter(Boolean)
            .join('\n'),
          relatedEntityId: reminder.id,
        });
        reminder.emailSentAt = new Date().toISOString();
      }

      const existingList = Array.isArray(db.candidates[idx].interviewReminders)
        ? db.candidates[idx].interviewReminders!
        : [];
      db.candidates[idx] = {
        ...db.candidates[idx],
        interviewReminders: [reminder, ...existingList].slice(0, 40),
      };
      writeDb(db);

      res.status(201).json({
        reminder,
        candidate: toPublicCandidate(db.candidates[idx]),
      });
    }
  );

  app.patch(
    '/api/candidate/interview-reminders/:id',
    requireAuth,
    (req: AuthenticatedRequest, res: Response) => {
      const reminderId = String(req.params.id || '').trim();
      const body = (req.body || {}) as Record<string, unknown>;
      const status = String(body.status ?? '').trim();
      if (status !== 'Scheduled' && status !== 'Completed' && status !== 'Cancelled') {
        res.status(400).json({ error: 'Invalid status.' });
        return;
      }

      const db = readDb();
      const idx = db.candidates.findIndex((c) => c.id === req.candidate!.id);
      if (idx === -1) {
        res.status(404).json({ error: 'Account not found.' });
        return;
      }

      const existing = Array.isArray(db.candidates[idx].interviewReminders)
        ? db.candidates[idx].interviewReminders!
        : [];
      db.candidates[idx] = {
        ...db.candidates[idx],
        interviewReminders: existing.map((item) =>
          item.id === reminderId ? { ...item, status } : item
        ),
      };
      writeDb(db);
      res.json({ candidate: toPublicCandidate(db.candidates[idx]) });
    }
  );

  app.delete(
    '/api/candidate/interview-reminders/:id',
    requireAuth,
    (req: AuthenticatedRequest, res: Response) => {
      const reminderId = String(req.params.id || '').trim();
      const db = readDb();
      const idx = db.candidates.findIndex((c) => c.id === req.candidate!.id);
      if (idx === -1) {
        res.status(404).json({ error: 'Account not found.' });
        return;
      }
      const existing = Array.isArray(db.candidates[idx].interviewReminders)
        ? db.candidates[idx].interviewReminders!
        : [];
      db.candidates[idx] = {
        ...db.candidates[idx],
        interviewReminders: existing.filter((item) => item.id !== reminderId),
      };
      writeDb(db);
      res.json({ candidate: toPublicCandidate(db.candidates[idx]) });
    }
  );

  app.post(
    '/api/candidate/interview-reminders/:id/notify',
    requireAuth,
    async (req: AuthenticatedRequest, res: Response) => {
      const reminderId = String(req.params.id || '').trim();
      const db = readDb();
      const idx = db.candidates.findIndex((c) => c.id === req.candidate!.id);
      if (idx === -1) {
        res.status(404).json({ error: 'Account not found.' });
        return;
      }

      const existingList = Array.isArray(db.candidates[idx].interviewReminders)
        ? db.candidates[idx].interviewReminders!
        : [];
      const reminder = existingList.find((r) => r.id === reminderId);
      if (!reminder) {
        res.status(404).json({ error: 'Interview reminder not found.' });
        return;
      }

      const emailDispatch = await dispatchPortalEmail({
        db,
        type: 'interview-reminder',
        fromDisplayName: 'Vardhman Consultancy Services',
        to: db.candidates[idx].email,
        cc: null,
        replyTo: VCS_OFFICIAL_EMAIL,
        subject: `Interview Reminder: ${reminder.jobTitle} on ${reminder.interviewDate} at ${reminder.interviewTime}`,
        text: [
          `Dear ${db.candidates[idx].name},`,
          '',
          'Reminder for your upcoming interview:',
          `Position: ${reminder.jobTitle}`,
          `Company: ${reminder.companyName}`,
          `Date & Time: ${reminder.interviewDate} at ${reminder.interviewTime}`,
          `Mode: ${reminder.mode}`,
          `Venue / Link: ${reminder.locationOrLink}`,
          reminder.notes ? `Notes: ${reminder.notes}` : '',
          '',
          'Regards,',
          'Vardhman Consultancy Services',
        ]
          .filter(Boolean)
          .join('\n'),
        relatedEntityId: reminder.id,
      });

      const updatedList = existingList.map((r) =>
        r.id === reminderId ? { ...r, emailSentAt: new Date().toISOString() } : r
      );
      db.candidates[idx] = { ...db.candidates[idx], interviewReminders: updatedList };
      writeDb(db);

      res.json({ emailDispatch, candidate: toPublicCandidate(db.candidates[idx]) });
    }
  );

  // Auto-Apply Mode Execution (Submits matched un-applied jobs with candidate saved resume + sends email digest)
  app.post(
    '/api/candidate/auto-apply/run',
    requireAuth,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        if (!req.candidate) {
          res.status(401).json({ error: 'Authentication required.' });
          return;
        }
        const candidate = req.candidate;
        if (!candidate.resumeId || !candidate.resumeFileName) {
          res.status(400).json({
            error:
              'Please upload your Resume (PDF/DOC/DOCX) on your Dashboard before running Auto-Apply Mode.',
          });
          return;
        }

        const body = (req.body || {}) as Record<string, unknown>;
        const rawJobs = Array.isArray(body.jobs) ? body.jobs : [];
        if (rawJobs.length === 0) {
          res.status(400).json({ error: 'No matching jobs provided for Auto-Apply.' });
          return;
        }

        const db = readDb();
        const existingAppliedJobIds = new Set(
          db.applications
            .filter((a) => a.candidateId === candidate.id)
            .map((a) => a.jobId)
        );

        const maxAllowed = Math.max(
          1,
          Math.min(10, Number(candidate.autoApplyConfig?.maxDailyApps) || 5)
        );

        const createdApps: StoredApplication[] = [];
        const resumeAttachments = resolveResumeAttachment(
          candidate.resumeId,
          candidate.resumeFileName
        );

        for (const item of rawJobs) {
          if (createdApps.length >= maxAllowed) break;
          if (!item || typeof item !== 'object') continue;
          const jobObj = item as Record<string, unknown>;
          const jobId = String(jobObj.id ?? '').trim();
          const jobTitle = String(jobObj.title ?? '').trim();
          if (!jobId || !jobTitle || existingAppliedJobIds.has(jobId)) continue;

          existingAppliedJobIds.add(jobId);
          const newApp: StoredApplication = {
            id: `app_${crypto.randomUUID().replace(/-/g, '')}`,
            candidateId: candidate.id,
            jobId,
            jobTitle,
            companyMasked: CONFIDENTIAL_COMPANY_LABEL,
            location: String(jobObj.location ?? 'Pan India').trim(),
            salary: String(jobObj.salary ?? 'Negotiable').trim(),
            experience: String(jobObj.experience ?? 'As per JD').trim(),
            applicantName: candidate.name,
            applicantEmail: candidate.email,
            applicantPhone: candidate.phone,
            resumeId: candidate.resumeId,
            resumeFileName: candidate.resumeFileName,
            appliedAt: new Date().toISOString(),
            status: 'Submitted',
            autoApplied: true,
          };
          db.applications.push(newApp);
          createdApps.push(newApp);

          await dispatchPortalEmail({
            db,
            type: 'candidate-application',
            fromDisplayName: `${candidate.name} (Auto-Apply)`,
            to: DESIGNATED_ADMIN_EMAIL,
            cc: VCS_OFFICIAL_EMAIL,
            replyTo: candidate.email,
            subject: `Auto-Apply Application: ${newApp.jobTitle} - ${candidate.name}`,
            text: [
              'Candidate Auto-Apply Job Application - Vardhman Consultancy Services',
              `Applicant: ${candidate.name} (${candidate.email}, ${candidate.phone})`,
              `Job Title: ${newApp.jobTitle}`,
              `Location: ${newApp.location}`,
              `Salary: ${newApp.salary}`,
              `Resume File: ${newApp.resumeFileName}`,
              `Submitted At: ${newApp.appliedAt}`,
            ].join('\n'),
            attachments: resumeAttachments,
            relatedEntityId: newApp.id,
          });
        }

        const cIdx = db.candidates.findIndex((c) => c.id === candidate.id);
        if (cIdx !== -1) {
          const prevAuto = db.candidates[cIdx].autoApplyConfig || {
            enabled: true,
            minMatchScore: 65,
            preferredKeywords: '',
            preferredLocations: '',
            maxDailyApps: 5,
          };
          db.candidates[cIdx] = {
            ...db.candidates[cIdx],
            autoApplyConfig: {
              ...prevAuto,
              enabled: true,
              lastRunAt: new Date().toISOString(),
              lastRunCount: createdApps.length,
            },
          };
        }

        let digestDispatch: StoredEmailDispatch | null = null;
        if (
          createdApps.length > 0 &&
          (candidate.emailNotificationsEnabled ?? true) &&
          candidate.email
        ) {
          digestDispatch = await dispatchPortalEmail({
            db,
            type: 'auto-apply-digest',
            fromDisplayName: 'Vardhman Consultancy Services',
            to: candidate.email,
            cc: null,
            replyTo: VCS_OFFICIAL_EMAIL,
            subject: `Auto-Apply Summary: Applied to ${createdApps.length} Matching Job(s)`,
            text: [
              `Dear ${candidate.name},`,
              '',
              `Auto-Apply Mode has submitted your saved resume (${candidate.resumeFileName}) for ${createdApps.length} verified role(s):`,
              '',
              ...createdApps.map(
                (a, i) => `${i + 1}. ${a.jobTitle} — ${a.location} (${a.salary})`
              ),
              '',
              'Track your applications anytime in your Candidate Dashboard.',
              '',
              'Regards,',
              'Vardhman Consultancy Services',
            ].join('\n'),
            relatedEntityId: candidate.id,
          });
        }

        writeDb(db);

        res.json({
          applications: createdApps,
          appliedCount: createdApps.length,
          candidate: cIdx !== -1 ? toPublicCandidate(db.candidates[cIdx]) : toPublicCandidate(candidate),
          emailDispatch: digestDispatch,
          message:
            createdApps.length > 0
              ? `Auto-Apply submitted ${createdApps.length} matching application(s) using ${candidate.resumeFileName}.`
              : 'All selected matching jobs have already been applied to.',
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Auto-Apply run failed.';
        res.status(400).json({ error: message });
      }
    }
  );

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Vardhman Consultancy Services portal server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
