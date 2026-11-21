# Firestore Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Default Deny**: Any unmatched path defaults to `allow read, write: if false;`.
2. **PII Isolation**:
   - `/users/{userId}` contains email/phone PII and is readable/writable ONLY by the owner (`request.auth.uid == userId`) or Admin (`isAdmin()`).
   - `/jobs/{jobId}` contains employer company name and recruiter contact details and is readable ONLY by the owning employer (`resource.data.employerUid == request.auth.uid`) or Admin (`isAdmin()`).
   - `/public_jobs/{jobId}` contains ZERO PII and is readable ONLY when `resource.data.status == 'Approved'`.
   - `/applications/{applicationId}` contains candidate contact details and is readable ONLY by the applying candidate (`resource.data.candidateUid == request.auth.uid`), the job's employer (`resource.data.employerUid == request.auth.uid`), or Admin (`isAdmin()`).
   - `/resume_godam/{entryId}` contains candidate contact details and PDF resumes (`resumeBase64`) and is readable ONLY by Admin (`isAdmin()`) or the owning candidate (`resource.data.candidateUid == request.auth.uid`), while `create` enforces `termsAccepted == true`, `resumeFileType == 'pdf'`, and `createdAt == request.time`.
3. **Workflow Integrity (Pending -> Approved / Auto-Approve)**:
   - An employer creating `/jobs/{jobId}` can ONLY set `status == 'Pending'` unless `isAdmin()` or `/portal_settings/jobs.data.autoApprove == true`.
   - An employer CANNOT directly write `/public_jobs/{jobId}` as `Approved` unless `isAdmin()` or `/portal_settings/jobs.data.autoApprove == true` AND the corresponding `/jobs/{jobId}` document exists atomically (`existsAfter`).
   - Only `isAdmin()` can update `status` between `'Pending'`, `'Approved'`, and `'Rejected'` on `/jobs/{jobId}`, and only `isAdmin()` can delete `/public_jobs/{jobId}` on rejection.
4. **Application Integrity**:
   - A candidate application MUST reference an existing approved `/public_jobs/{jobId}` (`exists(...)`), enforce `candidateUid == request.auth.uid`, enforce `status == 'Submitted'`, and enforce `appliedAt == request.time`.
5. **Temporal Integrity & Field Bounds**:
   - Every `create` timestamps `createdAt == request.time` (or `appliedAt == request.time`), every `update` enforces `updatedAt == request.time`, and every string/array enforces explicit `.size()` bounds and `keys().hasAll(...)` + `keys().hasOnly(...)` checks.

## 2. "Dirty Dozen" Attack Payloads (Expected: PERMISSION_DENIED)
1. **Unauthenticated Job Creation**: Write to `/jobs/job_1` with `request.auth == null`.
2. **Unverified Email Write**: Write to `/jobs/job_1` with `request.auth.token.email_verified == false`.
3. **Employer Bypassing Pending Approval**: Non-admin employer creates `/jobs/job_2` with `status: 'Approved'` while `/portal_settings/jobs.autoApprove == false`.
4. **Employer Bypassing Public Jobs Gate**: Non-admin employer writes directly to `/public_jobs/job_2` when `/portal_settings/jobs.autoApprove == false`.
5. **Shadow / Ghost Field Injection**: Write to `/public_jobs/job_3` adding unexpected `"isFeatured": true`.
6. **ID Poisoning**: Write to `/jobs/bad$id/path` or 200-char ID violating `^[a-zA-Z0-9_\\-]+$`.
7. **Cross-User Application Spoofing**: Candidate A creates `/applications/app_1` with `candidateUid: "candidateB"`.
8. **Orphan Application Creation**: Candidate creates `/applications/app_2` referencing non-existent `/public_jobs/nonexistent_job`.
9. **Candidate PII Scrape**: Non-owner authenticated user attempts `list` or `get` on `/applications` without `candidateUid == request.auth.uid` or `employerUid == request.auth.uid`.
10. **Employer Role Escalation on `/users/{uid}`**: Candidate updates `/users/{uid}` setting `role: 'admin'`.
11. **Non-Admin Toggling Auto-Approve**: Employer updates `/portal_settings/jobs` setting `autoApprove: true`.
12. **Client Timestamp Forgery**: Candidate creates `/applications/app_3` with a forged `appliedAt` not matching `request.time`.
