import { jsPDF } from 'jspdf';
import { VCS_TERMS_DOCUMENT } from '../constants/jobSeekerTerms';
import { CandidateProfile, JobApplication, JobListing } from '../types/portal';
import { getIstDateKey } from './firestorePortal';
import { CONFIDENTIAL_COMPANY_LABEL, OFFICIAL_EMAIL } from './jobHelpers';
import {
  SharedClientQueryRecord,
  SharedCompanyRequirementRecord,
} from './sharedPortalFirestore';

export interface CompletenessAuditResult {
  isComplete: boolean;
  completedCount: number;
  totalChecks: number;
  missingFields: string[];
}

export function isTodayIst(isoDate?: string | null): boolean {
  if (!isoDate) return false;
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return false;
  return getIstDateKey(parsed) === getIstDateKey();
}

export function formatIstDateTime(isoDate?: string | null): string {
  if (!isoDate) return 'N/A';
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return String(isoDate);
  return (
    parsed.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }) + ' IST'
  );
}

function isValidEmail(raw?: string | null): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(raw ?? '').trim());
}

function isValidIndianMobile(raw?: string | null): boolean {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.length < 10) return false;
  const last10 = digits.slice(-10);
  if (/^0{10}$/.test(last10)) return false;
  return true;
}

function isNonPlaceholderText(raw?: string | null): boolean {
  const clean = String(raw ?? '').trim();
  if (!clean) return false;
  const lower = clean.toLowerCase();
  return lower !== 'n/a' && lower !== 'na' && lower !== 'not provided' && lower !== '-';
}

export function auditJobseekerCompleteness(
  app: JobApplication,
  linkedUser?: CandidateProfile | null
): CompletenessAuditResult {
  const missingFields: string[] = [];
  const name = app.applicantName || linkedUser?.name;
  const phone = app.applicantPhone || linkedUser?.phone;
  const email = app.applicantEmail || linkedUser?.email;
  const city = app.city || app.location || linkedUser?.city;
  const qualExp =
    app.qualificationExperience ||
    app.experience ||
    linkedUser?.qualification ||
    linkedUser?.experience;
  const postRole = app.jobTitle || linkedUser?.preferredRole || linkedUser?.designation;
  const hasResume = Boolean(
    app.resumeBase64 ||
      isNonPlaceholderText(app.resumeFileName) ||
      isNonPlaceholderText(linkedUser?.resumeFileName)
  );
  const termsAccepted = app.termsAccepted === true;

  if (!isNonPlaceholderText(name)) missingFields.push('Full Name');
  if (!isValidIndianMobile(phone)) missingFields.push('10-Digit Mobile');
  if (!isValidEmail(email)) missingFields.push('Valid Email');
  if (!isNonPlaceholderText(city) || String(city).trim().toLowerCase() === 'india') {
    missingFields.push('City / Location');
  }
  if (!isNonPlaceholderText(qualExp)) missingFields.push('Qualification / Experience');
  if (!isNonPlaceholderText(postRole)) missingFields.push('Target Role / Post');
  if (!hasResume) missingFields.push('PDF Resume');
  if (!termsAccepted) missingFields.push('Terms & Conditions');

  const totalChecks = 8;
  return {
    isComplete: missingFields.length === 0,
    completedCount: totalChecks - missingFields.length,
    totalChecks,
    missingFields,
  };
}

export function auditCompanyRequirementCompleteness(
  req: SharedCompanyRequirementRecord
): CompletenessAuditResult {
  const missingFields: string[] = [];
  if (!isNonPlaceholderText(req.companyName)) missingFields.push('Company Name');
  if (!isNonPlaceholderText(req.contactPerson)) missingFields.push('Contact Person');
  if (!isValidIndianMobile(req.phone)) missingFields.push('10-Digit Mobile');
  if (!isNonPlaceholderText(req.city)) missingFields.push('City');
  if (!isNonPlaceholderText(req.postRequired)) missingFields.push('Post Required');
  if (!isNonPlaceholderText(req.salary)) missingFields.push('Salary / CTC');
  if (!Number.isFinite(req.vacancyCount) || req.vacancyCount < 1) {
    missingFields.push('Vacancies Count');
  }
  if (!isNonPlaceholderText(req.jobDescription)) missingFields.push('Job Description (JD)');

  const totalChecks = 8;
  return {
    isComplete: missingFields.length === 0,
    completedCount: totalChecks - missingFields.length,
    totalChecks,
    missingFields,
  };
}

export function auditEmployerProfileCompleteness(
  emp: CandidateProfile
): CompletenessAuditResult {
  const missingFields: string[] = [];
  if (!isNonPlaceholderText(emp.companyName || emp.name)) {
    missingFields.push('Company Name');
  }
  if (!isNonPlaceholderText(emp.name)) missingFields.push('HR / Contact Person');
  if (!isValidEmail(emp.email)) missingFields.push('Official Email');
  if (!isValidIndianMobile(emp.phone)) missingFields.push('10-Digit Mobile');
  if (!isNonPlaceholderText(emp.city)) missingFields.push('City');

  const totalChecks = 5;
  return {
    isComplete: missingFields.length === 0,
    completedCount: totalChecks - missingFields.length,
    totalChecks,
    missingFields,
  };
}

export function auditJobMandateCompleteness(job: JobListing): CompletenessAuditResult {
  const missingFields: string[] = [];
  if (!isNonPlaceholderText(job.company || job.clientName)) {
    missingFields.push('Company Name');
  }
  if (!isNonPlaceholderText(job.title)) missingFields.push('Job Title');
  if (!isNonPlaceholderText(job.location)) missingFields.push('Location');
  if (!isNonPlaceholderText(job.experience)) missingFields.push('Experience');
  if (!isNonPlaceholderText(job.salary)) missingFields.push('Salary');
  if (!isNonPlaceholderText(job.description)) missingFields.push('Job Description');
  if (!isNonPlaceholderText(job.recruiterName)) missingFields.push('Recruiter Name');
  if (!isValidIndianMobile(job.recruiterPhone) && !isValidEmail(job.recruiterEmail)) {
    missingFields.push('Recruiter Phone / Email');
  }

  const totalChecks = 8;
  return {
    isComplete: missingFields.length === 0,
    completedCount: totalChecks - missingFields.length,
    totalChecks,
    missingFields,
  };
}

function createPdfBuilder(docTitle: string) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 16;
  const contentWidth = pageWidth - marginX * 2;
  let y = 18;

  const paintPageFrame = (isFirstPage: boolean) => {
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
    doc.setFillColor(6, 40, 86);
    doc.rect(0, 0, pageWidth, 4, 'F');
    doc.setFillColor(212, 175, 55);
    doc.rect(0, 4, pageWidth, 1.2, 'F');
    if (isFirstPage) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(6, 40, 86);
      doc.text('JobsNia.com — A Venture of Vardhman Consultancy Services', marginX, 14);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      doc.text(
        `Established 2012 · Official Portal Record · ${OFFICIAL_EMAIL} · Generated ${formatIstDateTime(new Date().toISOString())}`,
        marginX,
        19
      );
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(marginX, 22, contentWidth, 9, 1.5, 1.5, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(6, 40, 86);
      doc.text(docTitle, marginX + 3, 27.8);
      y = 37;
    } else {
      y = 14;
    }
  };

  paintPageFrame(true);

  const ensureSpace = (neededMm: number) => {
    if (y + neededMm > pageHeight - 16) {
      doc.addPage();
      paintPageFrame(false);
    }
  };

  const addSectionHeading = (title: string) => {
    ensureSpace(12);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(6, 40, 86);
    doc.text(title.toUpperCase(), marginX, y);
    y += 1.8;
    doc.setDrawColor(212, 175, 55);
    doc.setLineWidth(0.5);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 5;
  };

  const addKeyValueRow = (label: string, value: string) => {
    const cleanValue = value.trim() || 'Not Provided (Incomplete)';
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    const valLines = doc.splitTextToSize(cleanValue, contentWidth - 48) as string[];
    const rowHeight = Math.max(5.5, valLines.length * 4.5 + 1.5);
    ensureSpace(rowHeight + 2);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.2);
    doc.setTextColor(71, 85, 105);
    doc.text(`${label}:`, marginX, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(
      cleanValue.includes('Not Provided') ? 185 : 15,
      cleanValue.includes('Not Provided') ? 28 : 23,
      cleanValue.includes('Not Provided') ? 28 : 42
    );
    doc.text(valLines, marginX + 48, y);
    y += rowHeight;
  };

  const addAuditBanner = (audit: CompletenessAuditResult) => {
    const bannerText = audit.isComplete
      ? `COMPLETENESS AUDIT: COMPLETE (${audit.completedCount}/${audit.totalChecks} checks verified)`
      : `COMPLETENESS AUDIT: INCOMPLETE (${audit.completedCount}/${audit.totalChecks}) · Missing: ${audit.missingFields.join(', ')}`;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(bannerText, contentWidth - 6) as string[];
    const boxHeight = lines.length * 4.5 + 5;
    ensureSpace(boxHeight + 4);

    if (audit.isComplete) {
      doc.setFillColor(236, 253, 245);
      doc.setDrawColor(10, 142, 67);
      doc.setTextColor(6, 95, 70);
    } else {
      doc.setFillColor(254, 242, 242);
      doc.setDrawColor(220, 38, 38);
      doc.setTextColor(153, 27, 27);
    }
    doc.roundedRect(marginX, y, contentWidth, boxHeight, 1.5, 1.5, 'FD');
    doc.text(lines, marginX + 3, y + 5.2);
    y += boxHeight + 5;
  };

  const addParagraph = (text: string, bold = false, fontSize = 9.2) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(fontSize);
    doc.setTextColor(30, 41, 59);
    const lines = doc.splitTextToSize(text.trim(), contentWidth) as string[];
    for (const line of lines) {
      ensureSpace(5);
      doc.text(line, marginX, y);
      y += 4.4;
    }
    y += 1.5;
  };

  return {
    doc,
    marginX,
    contentWidth,
    getY: () => y,
    setY: (nextY: number) => {
      y = nextY;
    },
    ensureSpace,
    addSectionHeading,
    addKeyValueRow,
    addAuditBanner,
    addParagraph,
  };
}

function safeFileSlug(raw: string, fallback: string): string {
  const cleaned = String(raw || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return (cleaned || fallback).slice(0, 60);
}

export function downloadCompleteJobseekerApplicationPdf(
  app: JobApplication,
  linkedUser?: CandidateProfile | null
): void {
  const audit = auditJobseekerCompleteness(app, linkedUser);
  const builder = createPdfBuilder(
    'COMPLETE JOBSEEKER APPLICATION FORM + TERMS & CONDITIONS'
  );

  builder.addAuditBanner(audit);

  builder.addSectionHeading('1. Application & Registration Metadata');
  builder.addKeyValueRow('Application / Record ID', app.id || 'N/A');
  builder.addKeyValueRow('Submitted On (IST)', formatIstDateTime(app.appliedAt));
  builder.addKeyValueRow(
    'Record Source',
    app.jobId === 'profile_registration'
      ? 'Candidate Profile Registration'
      : app.source === 'shared-portal'
        ? 'JobsNia Portal (Live Sync)'
        : app.source === 'resume-godam'
          ? 'JobsNia Resume Repository'
          : 'JobsNia Application Desk'
  );
  builder.addKeyValueRow('Post Applied / Target Role', app.jobTitle || '');
  builder.addKeyValueRow(
    'Company (Masked Label)',
    app.companyMasked || CONFIDENTIAL_COMPANY_LABEL
  );
  builder.addKeyValueRow('Expected Salary / Package', app.salary || 'As per Industry Standards');

  builder.setY(builder.getY() + 2);
  builder.addSectionHeading('2. Candidate Personal & Qualification Details');
  builder.addKeyValueRow('Full Name', app.applicantName || linkedUser?.name || '');
  builder.addKeyValueRow('Mobile Number', app.applicantPhone || linkedUser?.phone || '');
  builder.addKeyValueRow('Email Address', app.applicantEmail || linkedUser?.email || '');
  builder.addKeyValueRow(
    'City / Location',
    app.city || app.location || linkedUser?.city || ''
  );
  builder.addKeyValueRow(
    'Qualification & Experience',
    app.qualificationExperience ||
      app.experience ||
      linkedUser?.qualification ||
      linkedUser?.experience ||
      ''
  );
  builder.addKeyValueRow(
    'Attached Resume File',
    app.resumeFileName || linkedUser?.resumeFileName || ''
  );
  builder.addKeyValueRow(
    'Resume Attachment Status',
    app.resumeBase64
      ? 'PDF Binary Attached in Portal Record'
      : app.resumeId
        ? `Linked Resume ID: ${app.resumeId}`
        : 'Not Provided (Incomplete)'
  );
  if (app.resumeSummary || linkedUser?.resumeSummary) {
    builder.addKeyValueRow(
      'Profile / Resume Summary',
      app.resumeSummary || linkedUser?.resumeSummary || ''
    );
  }

  builder.setY(builder.getY() + 3);
  builder.addSectionHeading('3. Jobseeker Terms & Conditions and Candidate Declaration');
  builder.addParagraph(
    `${VCS_TERMS_DOCUMENT.title} · ${VCS_TERMS_DOCUMENT.organization} (${VCS_TERMS_DOCUMENT.email})`,
    true,
    9.5
  );
  builder.addParagraph(
    `${VCS_TERMS_DOCUMENT.applicability}. ${VCS_TERMS_DOCUMENT.intro}`,
    false,
    8.8
  );

  for (const item of VCS_TERMS_DOCUMENT.items) {
    builder.addParagraph(`${item.number}. ${item.title}: ${item.body}`, false, 8.6);
  }

  builder.addParagraph(
    `${VCS_TERMS_DOCUMENT.declarationLabel} ${VCS_TERMS_DOCUMENT.declarationText}`,
    true,
    8.8
  );

  builder.ensureSpace(18);
  const yNow = builder.getY();
  const accepted = app.termsAccepted === true;
  if (accepted) {
    builder.doc.setFillColor(236, 253, 245);
    builder.doc.setDrawColor(10, 142, 67);
    builder.doc.setTextColor(6, 95, 70);
  } else {
    builder.doc.setFillColor(254, 242, 242);
    builder.doc.setDrawColor(220, 38, 38);
    builder.doc.setTextColor(153, 27, 27);
  }
  builder.doc.roundedRect(
    builder.marginX,
    yNow,
    builder.contentWidth,
    14,
    1.5,
    1.5,
    'FD'
  );
  builder.doc.setFont('helvetica', 'bold');
  builder.doc.setFontSize(9.2);
  builder.doc.text(
    accepted
      ? `TERMS STATUS: ACCEPTED BY CANDIDATE (${app.applicantName || 'Candidate'})`
      : 'TERMS STATUS: NOT CONFIRMED / INCOMPLETE',
    builder.marginX + 3,
    yNow + 5.5
  );
  builder.doc.setFont('helvetica', 'normal');
  builder.doc.setFontSize(8.4);
  builder.doc.text(
    `Timestamp: ${formatIstDateTime(app.appliedAt)} · Contact: ${app.applicantPhone || 'N/A'} · ${app.applicantEmail || 'N/A'}`,
    builder.marginX + 3,
    yNow + 10.8
  );

  const fileSlug = safeFileSlug(app.applicantName || app.id, 'candidate');
  builder.doc.save(`${fileSlug}_Application_With_Terms_JobsNia.pdf`);
}

export function downloadCompleteCompanyFormPdf(
  payload:
    | { kind: 'requirement'; record: SharedCompanyRequirementRecord }
    | { kind: 'employer'; record: CandidateProfile }
    | { kind: 'job'; record: JobListing }
): void {
  if (payload.kind === 'requirement') {
    const req = payload.record;
    const audit = auditCompanyRequirementCompleteness(req);
    const builder = createPdfBuilder('COMPLETE COMPANY HIRING REQUIREMENT FORM');
    builder.addAuditBanner(audit);

    builder.addSectionHeading('1. Company & Submission Details');
    builder.addKeyValueRow('Requirement ID', req.id);
    builder.addKeyValueRow('Submitted On (IST)', formatIstDateTime(req.createdAt));
    builder.addKeyValueRow('Company Name', req.companyName);
    builder.addKeyValueRow('HR / Contact Person', req.contactPerson);
    builder.addKeyValueRow('Contact Phone', req.phone);
    builder.addKeyValueRow('City / Location', req.city);

    builder.setY(builder.getY() + 2);
    builder.addSectionHeading('2. Position & Job Description');
    builder.addKeyValueRow('Post Required', req.postRequired);
    builder.addKeyValueRow('Vacancies Count', String(req.vacancyCount || 1));
    builder.addKeyValueRow('Salary / CTC Offered', req.salary);
    builder.addKeyValueRow('Current Status', req.status || 'new');
    builder.addKeyValueRow('Job Description (JD)', req.jobDescription || '');

    const slug = safeFileSlug(req.companyName || req.id, 'company');
    builder.doc.save(`${slug}_Requirement_Form_JobsNia.pdf`);
    return;
  }

  if (payload.kind === 'employer') {
    const emp = payload.record;
    const audit = auditEmployerProfileCompleteness(emp);
    const builder = createPdfBuilder('COMPLETE EMPLOYER REGISTRATION RECORD');
    builder.addAuditBanner(audit);

    builder.addSectionHeading('1. Registered Employer / Company Profile');
    builder.addKeyValueRow('Employer ID', emp.id);
    builder.addKeyValueRow('Registered On (IST)', formatIstDateTime(emp.createdAt));
    builder.addKeyValueRow('Company Name', emp.companyName || emp.name || '');
    builder.addKeyValueRow('Authorized Contact', emp.name || '');
    builder.addKeyValueRow('Official Email', emp.email || '');
    builder.addKeyValueRow('Mobile Number', emp.phone || '');
    builder.addKeyValueRow('City / Location', emp.city || '');
    if (emp.fullAddress) builder.addKeyValueRow('Full Address', emp.fullAddress);
    if (emp.gstNumber) builder.addKeyValueRow('GST Number', emp.gstNumber);
    if (emp.panNumber) builder.addKeyValueRow('PAN Number', emp.panNumber);

    const slug = safeFileSlug(emp.companyName || emp.name || emp.id, 'employer');
    builder.doc.save(`${slug}_Employer_Registration_JobsNia.pdf`);
    return;
  }

  const job = payload.record;
  const audit = auditJobMandateCompleteness(job);
  const builder = createPdfBuilder('COMPLETE EMPLOYER JOB MANDATE FORM');
  builder.addAuditBanner(audit);

  builder.addSectionHeading('1. Employer & Approval Metadata');
  builder.addKeyValueRow('Job ID', job.id);
  builder.addKeyValueRow('Approval Status', job.status || 'Pending');
  builder.addKeyValueRow('Posted Date', formatIstDateTime(job.createdAt || job.postedAt));
  builder.addKeyValueRow('Actual Company Name', job.company || job.clientName || '');
  builder.addKeyValueRow(
    'Publicly Masked Name',
    job.companyMasked || CONFIDENTIAL_COMPANY_LABEL
  );
  builder.addKeyValueRow('Recruiter Name', job.recruiterName || '');
  builder.addKeyValueRow('Recruiter Email', job.recruiterEmail || '');
  builder.addKeyValueRow('Recruiter Phone', job.recruiterPhone || '');

  builder.setY(builder.getY() + 2);
  builder.addSectionHeading('2. Job Role & Mandate Details');
  builder.addKeyValueRow('Job Title', job.title || '');
  builder.addKeyValueRow('Designation', job.designation || '');
  builder.addKeyValueRow('Location', job.location || '');
  builder.addKeyValueRow('Experience Required', job.experience || '');
  builder.addKeyValueRow('Salary / CTC', job.salary || '');
  builder.addKeyValueRow('Openings Count', String(job.openings || 1));
  builder.addKeyValueRow('Qualification', job.qualification || '');
  builder.addKeyValueRow('Key Skills', (job.skills || []).join(', '));
  builder.addKeyValueRow('Job Description', job.description || '');

  const slug = safeFileSlug(job.company || job.title || job.id, 'job_mandate');
  builder.doc.save(`${slug}_Job_Mandate_JobsNia.pdf`);
}

function escapeCsvCell(raw: unknown): string {
  const str = String(raw ?? '');
  return `"${str.replace(/"/g, '""')}"`;
}

export function downloadOwnerActivityCsv(params: {
  applications: JobApplication[];
  registeredUsers: CandidateProfile[];
  companyRequirements: SharedCompanyRequirementRecord[];
  jobs: JobListing[];
  clientQueries: SharedClientQueryRecord[];
}): void {
  const userByEmail = new Map<string, CandidateProfile>();
  const userById = new Map<string, CandidateProfile>();
  for (const u of params.registeredUsers) {
    userById.set(u.id, u);
    if (u.email) userByEmail.set(u.email.toLowerCase(), u);
  }

  const rows: string[][] = [
    [
      'Category',
      'Record ID',
      'Name / Company',
      'Contact / Role / Post',
      'Mobile',
      'Email',
      'City',
      'Qualification / Salary / Vacancies',
      'Resume / Description',
      'Terms Accepted',
      'Completeness Status',
      'Completeness Score',
      'Missing Fields',
      'Is Today (IST)',
      'Timestamp (IST)',
    ],
  ];

  for (const app of params.applications) {
    const linked =
      userById.get(app.candidateId) ||
      (app.applicantEmail ? userByEmail.get(app.applicantEmail.toLowerCase()) : undefined);
    const audit = auditJobseekerCompleteness(app, linked);
    rows.push([
      app.jobId === 'profile_registration'
        ? 'Jobseeker Registration'
        : 'Jobseeker Application',
      app.id,
      app.applicantName,
      app.jobTitle,
      app.applicantPhone,
      app.applicantEmail,
      app.city || app.location,
      app.qualificationExperience || app.experience,
      app.resumeFileName || 'Not Attached',
      app.termsAccepted === true ? 'YES' : 'NO',
      audit.isComplete ? 'COMPLETE' : 'INCOMPLETE',
      `${audit.completedCount}/${audit.totalChecks}`,
      audit.missingFields.join('; '),
      isTodayIst(app.appliedAt) ? 'TODAY' : 'EARLIER',
      formatIstDateTime(app.appliedAt),
    ]);
  }

  for (const req of params.companyRequirements) {
    const audit = auditCompanyRequirementCompleteness(req);
    rows.push([
      'Company Hiring Requirement',
      req.id,
      req.companyName,
      `${req.postRequired} (Contact: ${req.contactPerson})`,
      req.phone,
      '',
      req.city,
      `${req.salary} · Vacancies: ${req.vacancyCount}`,
      req.jobDescription,
      'N/A',
      audit.isComplete ? 'COMPLETE' : 'INCOMPLETE',
      `${audit.completedCount}/${audit.totalChecks}`,
      audit.missingFields.join('; '),
      isTodayIst(req.createdAt) ? 'TODAY' : 'EARLIER',
      formatIstDateTime(req.createdAt),
    ]);
  }

  for (const emp of params.registeredUsers.filter((u) => u.role === 'employer')) {
    const audit = auditEmployerProfileCompleteness(emp);
    rows.push([
      'Registered Employer Account',
      emp.id,
      emp.companyName || emp.name,
      emp.name,
      emp.phone,
      emp.email,
      emp.city,
      emp.gstNumber || '',
      emp.fullAddress || '',
      'N/A',
      audit.isComplete ? 'COMPLETE' : 'INCOMPLETE',
      `${audit.completedCount}/${audit.totalChecks}`,
      audit.missingFields.join('; '),
      isTodayIst(emp.createdAt) ? 'TODAY' : 'EARLIER',
      formatIstDateTime(emp.createdAt),
    ]);
  }

  for (const job of params.jobs) {
    const audit = auditJobMandateCompleteness(job);
    rows.push([
      `Job Mandate (${job.status || 'Pending'})`,
      job.id,
      job.company,
      job.title,
      job.recruiterPhone || '',
      job.recruiterEmail || '',
      job.location,
      `${job.salary} · ${job.experience}`,
      job.description,
      'N/A',
      audit.isComplete ? 'COMPLETE' : 'INCOMPLETE',
      `${audit.completedCount}/${audit.totalChecks}`,
      audit.missingFields.join('; '),
      isTodayIst(job.createdAt || job.postedAt) ? 'TODAY' : 'EARLIER',
      formatIstDateTime(job.createdAt || job.postedAt),
    ]);
  }

  for (const qry of params.clientQueries) {
    rows.push([
      'Client Inquiry',
      qry.id,
      qry.name,
      qry.status,
      qry.phone,
      '',
      '',
      '',
      qry.message,
      'N/A',
      qry.name && qry.phone && qry.message ? 'COMPLETE' : 'INCOMPLETE',
      '',
      '',
      isTodayIst(qry.createdAt) ? 'TODAY' : 'EARLIER',
      formatIstDateTime(qry.createdAt),
    ]);
  }

  const csvBody = '\uFEFF' + rows.map((row) => row.map(escapeCsvCell).join(',')).join('\n');
  const blob = new Blob([csvBody], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `JobsNia_Owner_Full_Activity_${getIstDateKey()}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}
