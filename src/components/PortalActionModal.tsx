import { FormEvent, useEffect, useState } from 'react';
import { CheckCircle2, Mail, X } from 'lucide-react';
import { JobListing, PortalModalType } from '../types/portal';
import {
  clearFormDraft,
  loadFormDraft,
  saveFormDraft,
} from '../utils/formDraftStorage';
import { maskCompanyName, toFriendlyPortalError } from '../utils/jobHelpers';
import { submitClientQueryToSharedPortal } from '../utils/sharedPortalFirestore';

const PORTAL_CONTACT_DRAFT_KEY = 'vcs_draft_portal_contact_v1';

interface PortalActionModalProps {
  activeModal: PortalModalType;
  selectedJob?: JobListing | null;
  onClose: () => void;
}

const MODAL_CONTENT: Record<
  Exclude<PortalModalType, null>,
  {
    title: string;
    subtitle: string;
    description: string;
    emailSubject: string;
    ctaLabel: string;
  }
> = {
  apply: {
    title: 'Apply Now',
    subtitle: 'Candidate Application Desk',
    description:
      'All job applications are processed exclusively through our official Job Portal. Select any open position and complete the portal Apply Form with your PDF Resume.',
    emailSubject: 'Job Portal Inquiry — Vardhman Consultancy Services',
    ctaLabel: 'Explore Portal Jobs',
  },
  'upload-resume': {
    title: 'Submit Resume',
    subtitle: 'Executive Candidate Registry',
    description:
      'Submit your complete profile and PDF Resume through the Portal Submit Resume form for upcoming verified mandates.',
    emailSubject: 'Candidate Portal Inquiry — Vardhman Consultancy Services',
    ctaLabel: 'Continue on Portal',
  },
  'post-job': {
    title: 'Post A Job',
    subtitle: 'Employer Hiring Mandate',
    description:
      'All job listings on our portal are verified prior to publication. Employers wishing to list a verified mandate can send role specifications directly to our corporate team.',
    emailSubject: 'New Job Mandate Inquiry — Vardhman Consultancy Services',
    ctaLabel: 'Submit Mandate via Email',
  },
  register: {
    title: 'Register',
    subtitle: 'Candidate & Employer Accounts',
    description:
      'For priority onboarding with Vardhman Consultancy Services, contact our official desk.',
    emailSubject: 'Portal Registration Inquiry — Vardhman Consultancy Services',
    ctaLabel: 'Contact Onboarding Desk',
  },
  login: {
    title: 'Login',
    subtitle: 'Portal Account Access',
    description:
      'Please reach out to our team if you require immediate assistance.',
    emailSubject: 'Account Access Support — Vardhman Consultancy Services',
    ctaLabel: 'Contact Support',
  },
  contact: {
    title: 'Contact Us',
    subtitle: 'Vardhman Consultancy Services',
    description:
      'Reach out to India’s Leading Executive Search Firm for hiring mandates, candidate inquiries, or portal support.',
    emailSubject: 'General Inquiry — Vardhman Consultancy Services',
    ctaLabel: 'Email Us Directly',
  },
};

export function PortalActionModal({
  activeModal,
  selectedJob,
  onClose,
}: PortalActionModalProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (activeModal === 'contact') {
      const draft = loadFormDraft<{ name: string; phone: string; message: string }>(
        PORTAL_CONTACT_DRAFT_KEY
      );
      setName(draft?.name || '');
      setPhone(draft?.phone || '');
      setMessage(draft?.message || '');
    } else {
      setName('');
      setPhone('');
      setMessage('');
    }
    setError('');
    setIsSubmitting(false);
    setSubmitted(false);
  }, [activeModal]);

  useEffect(() => {
    if (activeModal !== 'contact' || submitted) return;
    saveFormDraft(PORTAL_CONTACT_DRAFT_KEY, { name, phone, message });
  }, [activeModal, submitted, name, phone, message]);

  useEffect(() => {
    if (!activeModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeModal, onClose]);

  if (!activeModal) return null;

  const baseContent = MODAL_CONTENT[activeModal];
  const content =
    activeModal === 'apply' && selectedJob
      ? {
          title: `Apply Now: ${selectedJob.title}`,
          subtitle: `${maskCompanyName(selectedJob.company, selectedJob.companyMasked)} · ${selectedJob.location}`,
          description: `Submit your application for ${selectedJob.title} (${selectedJob.designation}, ${selectedJob.experience}, ${selectedJob.salary}) directly to our executive recruitment desk.`,
          emailSubject: `Application for ${selectedJob.title} (Ref: ${selectedJob.id}) — Vardhman Consultancy Services`,
          ctaLabel: 'Send Application via Email',
        }
      : baseContent;

  const handleContactSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (phone.replace(/\D/g, '').length < 10) {
      setError('Please enter a valid 10-digit phone number.');
      return;
    }
    if (!message.trim()) {
      setError('Please enter your inquiry message.');
      return;
    }

    setError('');
    setIsSubmitting(true);
    try {
      await submitClientQueryToSharedPortal({
        name: name.trim(),
        phone: phone.trim(),
        message: message.trim(),
      });
      clearFormDraft(PORTAL_CONTACT_DRAFT_KEY);
      setSubmitted(true);
    } catch (err) {
      setError(
        toFriendlyPortalError(err, 'Something went wrong, please try again.')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="portal-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="grid grid-cols-3 h-1 w-full" aria-hidden="true">
          <div className="bg-[#063B7A]" />
          <div className="bg-[#F58220]" />
          <div className="bg-[#0A8E43]" />
        </div>

        <div className="p-6 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-[#0A8E43]">
                {content.subtitle}
              </p>
              <h3
                id="portal-modal-title"
                className="mt-1 font-display text-xl sm:text-2xl font-bold text-[#063B7A]"
              >
                {content.title}
              </h3>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="w-10 h-10 rounded-lg border border-slate-200 text-slate-500 hover:text-[#063B7A] hover:bg-slate-50 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed">
            {content.description}
          </p>

          {activeModal === 'contact' ? (
            submitted ? (
              <div className="mt-6 p-4 rounded-xl bg-[#0A8E43]/8 border border-[#0A8E43]/25 text-sm text-slate-800">
                <div className="flex items-center gap-2 font-semibold text-[#0A8E43]">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Inquiry Submitted</span>
                </div>
                <p className="mt-1.5 text-slate-600">
                  Thank you, {name}. Vardhman Consultancy Services - Est 2012 ·{' '}
                  <a
                    href="mailto:Info@vardhmanconsultancy.com"
                    className="font-semibold text-[#063B7A] underline"
                  >
                    Email: Info@vardhmanconsultancy.com
                  </a>
                  .
                </p>
              </div>
            ) : (
              <form onSubmit={handleContactSubmit} className="mt-5 space-y-3.5" noValidate>
                <div>
                  <label htmlFor="contact-name" className="block text-xs font-semibold text-slate-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    id="contact-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your name"
                    className="w-full min-h-[42px] px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:border-[#063B7A] focus:outline-none focus:ring-2 focus:ring-[#063B7A]/15"
                  />
                </div>

                <div>
                  <label htmlFor="contact-phone" className="block text-xs font-semibold text-slate-700 mb-1">
                    Phone Number *
                  </label>
                  <input
                    id="contact-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="10-digit phone number"
                    className="w-full min-h-[42px] px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:border-[#063B7A] focus:outline-none focus:ring-2 focus:ring-[#063B7A]/15"
                  />
                </div>

                <div>
                  <label htmlFor="contact-message" className="block text-xs font-semibold text-slate-700 mb-1">
                    Message *
                  </label>
                  <textarea
                    id="contact-message"
                    rows={3}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Share your hiring or career inquiry"
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:border-[#063B7A] focus:outline-none focus:ring-2 focus:ring-[#063B7A]/15 resize-none"
                  />
                </div>

                {error && (
                  <p className="text-xs font-medium text-red-600" role="alert">
                    {error}
                  </p>
                )}

                <div className="pt-1 flex flex-wrap items-center justify-between gap-3">
                  <a
                    href={`mailto:Info@vardhmanconsultancy.com?subject=${encodeURIComponent(
                      content.emailSubject
                    )}`}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#063B7A] hover:text-[#D96B0C] transition-colors"
                  >
                    <Mail className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Email: Info@vardhmanconsultancy.com</span>
                  </a>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="min-h-[42px] px-5 py-2 rounded-xl bg-[#063B7A] hover:bg-[#042A58] disabled:opacity-60 text-white text-sm font-semibold transition-colors cursor-pointer"
                  >
                    {isSubmitting ? 'Sending...' : 'Send Inquiry'}
                  </button>
                </div>
              </form>
            )
          ) : (
            <div className="mt-6 pt-5 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs text-slate-600">
                <p className="font-semibold text-[#063B7A]">
                  Vardhman Consultancy Services - Est 2012
                </p>
                {activeModal !== 'apply' && activeModal !== 'upload-resume' ? (
                  <a
                    href="mailto:Info@vardhmanconsultancy.com"
                    className="font-semibold text-[#063B7A] hover:underline"
                  >
                    Email: Info@vardhmanconsultancy.com
                  </a>
                ) : (
                  <p className="text-slate-500">
                    All applications &amp; CVs are processed strictly via Portal System.
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[42px] px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-medium transition-colors cursor-pointer"
                >
                  Close
                </button>
                {activeModal !== 'apply' && activeModal !== 'upload-resume' && (
                  <a
                    href={`mailto:Info@vardhmanconsultancy.com?subject=${encodeURIComponent(
                      content.emailSubject
                    )}`}
                    className="min-h-[42px] px-5 py-2 rounded-xl bg-[#063B7A] hover:bg-[#042A58] text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap"
                  >
                    <Mail className="w-4 h-4" aria-hidden="true" />
                    <span>{content.ctaLabel}</span>
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
