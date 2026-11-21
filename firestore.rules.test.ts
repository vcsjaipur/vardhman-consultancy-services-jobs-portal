/**
 * Payload-First Security TDD Spec Verification Matrix ("Dirty Dozen")
 * Verifies all 12 adversarial payloads against the Eight Pillars in firestore.rules.
 */
export interface DirtyPayloadCase {
  name: string;
  collection: string;
  docId: string;
  auth: { uid: string; email?: string; email_verified?: boolean } | null;
  payload: Record<string, unknown>;
  expected: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_CASES: DirtyPayloadCase[] = [
  {
    name: '1. Unauthenticated Job Creation',
    collection: 'jobs',
    docId: 'job_unauth_1',
    auth: null,
    payload: { id: 'job_unauth_1', status: 'Pending' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '2. Unverified Email Job Write',
    collection: 'jobs',
    docId: 'job_unverified_1',
    auth: { uid: 'emp_1', email: 'hr@pharma.example', email_verified: false },
    payload: { id: 'job_unverified_1', employerUid: 'emp_1', status: 'Pending' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '3. Employer Bypassing Pending Approval on /jobs',
    collection: 'jobs',
    docId: 'job_bypass_1',
    auth: { uid: 'emp_1', email: 'hr@pharma.example', email_verified: true },
    payload: { id: 'job_bypass_1', employerUid: 'emp_1', status: 'Approved' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '4. Employer Direct Write to /public_jobs When Auto-Approve Disabled',
    collection: 'public_jobs',
    docId: 'job_bypass_2',
    auth: { uid: 'emp_1', email: 'hr@pharma.example', email_verified: true },
    payload: { id: 'job_bypass_2', employerUid: 'emp_1', status: 'Approved' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '5. Shadow / Ghost Field Injection on /public_jobs',
    collection: 'public_jobs',
    docId: 'job_shadow_1',
    auth: { uid: 'admin_1', email: 'cvforvcs@gmail.com', email_verified: true },
    payload: { id: 'job_shadow_1', isFeatured: true, status: 'Approved' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '6. ID Poisoning with Illegal Characters',
    collection: 'jobs',
    docId: 'bad$id!@#',
    auth: { uid: 'emp_1', email: 'hr@pharma.example', email_verified: true },
    payload: { id: 'bad$id!@#', employerUid: 'emp_1', status: 'Pending' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '7. Cross-User Application Spoofing',
    collection: 'applications',
    docId: 'app_spoof_1',
    auth: { uid: 'cand_A', email: 'a@example.com', email_verified: true },
    payload: { id: 'app_spoof_1', candidateUid: 'cand_B', jobId: 'job_1', status: 'Submitted' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '8. Orphan Application Referencing Non-Existent Public Job',
    collection: 'applications',
    docId: 'app_orphan_1',
    auth: { uid: 'cand_A', email: 'a@example.com', email_verified: true },
    payload: { id: 'app_orphan_1', candidateUid: 'cand_A', jobId: 'missing_job_999', status: 'Submitted' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '9. Unowned Application List Scrape',
    collection: 'applications',
    docId: 'app_scrape_1',
    auth: { uid: 'cand_C', email: 'c@example.com', email_verified: true },
    payload: {},
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '10. Self Role Escalation to Admin in /users',
    collection: 'users',
    docId: 'cand_A',
    auth: { uid: 'cand_A', email: 'a@example.com', email_verified: true },
    payload: { uid: 'cand_A', role: 'admin', name: 'Attacker', email: 'a@example.com' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '11. Non-Admin Toggling Auto-Approve Setting',
    collection: 'portal_settings',
    docId: 'jobs',
    auth: { uid: 'emp_1', email: 'hr@pharma.example', email_verified: true },
    payload: { autoApprove: true, updatedByUid: 'emp_1' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '12. Client Timestamp Forgery on Application',
    collection: 'applications',
    docId: 'app_time_1',
    auth: { uid: 'cand_A', email: 'a@example.com', email_verified: true },
    payload: {
      id: 'app_time_1',
      candidateUid: 'cand_A',
      jobId: 'job_1',
      appliedAt: '2020-01-01T00:00:00.000Z',
      status: 'Submitted',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '13. Resume Godam Submission Without Terms Acceptance',
    collection: 'resume_godam',
    docId: 'rg_no_terms_1',
    auth: null,
    payload: {
      id: 'rg_no_terms_1',
      jobId: 'general_resume',
      jobTitle: 'Area Manager',
      termsAccepted: false,
      status: 'Submitted',
    },
    expected: 'PERMISSION_DENIED',
  },
];
