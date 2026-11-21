export interface CandidateTermItem {
  number: number;
  title: string;
  body: string;
}

export const VCS_TERMS_DOCUMENT = {
  title: 'TERMS & CONDITIONS AND CANDIDATE DECLARATION',
  organization: 'VARDHMAN CONSULTANCY SERVICES - EST 2012',
  email: 'info@vardhmanconsultancy.com',
  applicability:
    'Applicable to Every Candidate / Every Job Seeker - Common for All Levels',
  intro:
    'By submitting your resume through Email, WhatsApp, Portal or Website, you agree to:',
  items: [
    {
      number: 1,
      title: 'FREE SERVICE',
      body: 'Our service is 100% FREE for every candidate. We never charge any fee. Our fee is paid by the employer.',
    },
    {
      number: 2,
      title: 'TRUTHFUL INFORMATION',
      body: 'You declare that all information in your resume and documents is true and authentic. Please share correct information so we can help you better.',
    },
    {
      number: 3,
      title: 'INTERVIEW FEEDBACK',
      body: 'You are requested to share your interview feedback on the same day of interview via WhatsApp and Email on info@vardhmanconsultancy.com. Feedback must include interview date, company name, interviewer name and outcome. Your feedback helps us to support you better for next opportunities.',
    },
    {
      number: 4,
      title: 'JOINING INFORMATION',
      body: 'If selected, kindly inform us within 24 hours and share a copy of Offer Letter / Appointment Letter / CTC on WhatsApp and Email info@vardhmanconsultancy.com. Sharing your success with us helps us to serve you and other candidates better.',
    },
    {
      number: 5,
      title: 'TRANSPARENCY',
      body: 'Kindly inform the employer that you are sourced through Vardhman Consultancy Services, Jaipur. Please keep us in loop, so we can coordinate smoothly for you.',
    },
    {
      number: 6,
      title: 'DISCLOSURE',
      body: 'Kindly disclose if you have applied through other sources for the same requirement. This helps us to avoid duplicate follow-ups.',
    },
    {
      number: 7,
      title: 'MUTUAL COOPERATION & TRUST',
      body: 'We believe in long-term relationship with every candidate. Your timely feedback and updates help us to provide you continuous, priority support and more good opportunities from our wide network of top-class companies. Non-sharing of feedback may affect priority support for future opportunities.',
    },
    {
      number: 8,
      title: 'DATA CONSENT',
      body: 'You give consent to store and share your resume with verified employers for job purposes only. Your data will be kept confidential.',
    },
    {
      number: 9,
      title: 'NO JOB GUARANTEE & JURISDICTION',
      body: 'Selection depends on employer. All disputes subject to Jaipur jurisdiction only.',
    },
  ] as CandidateTermItem[],
  declarationLabel: 'DECLARATION:',
  declarationText:
    'I have read and accepted all terms. I agree to provide same-day interview feedback and share offer letter within 24 hours on info@vardhmanconsultancy.com.',
  checkboxText:
    'I Have Read and Accepted Terms & Conditions. I Agree to Provide Same-Day Interview Feedback and Share Offer Letter Copy Within 24 Hours on info@vardhmanconsultancy.com. I Accept for Every Level.',
} as const;
