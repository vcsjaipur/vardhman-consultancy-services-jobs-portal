import { FormEvent, useEffect, useState } from 'react';
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Mail,
  MessageSquare,
  Phone,
  Send,
  User,
} from 'lucide-react';
import { submitContactInquiry } from '../utils/candidateApi';
import {
  clearFormDraft,
  loadFormDraft,
  saveFormDraft,
} from '../utils/formDraftStorage';
import { toFriendlyPortalError } from '../utils/jobHelpers';
import { submitClientQueryToSharedPortal } from '../utils/sharedPortalFirestore';

const CONTACT_DRAFT_KEY = 'vcs_draft_contact_us_v1';

interface ContactUsPageProps {
  onBackHome: () => void;
}

export function ContactUsPage({ onBackHome }: ContactUsPageProps) {
  const initialDraft = loadFormDraft<{
    name: string;
    email: string;
    phone: string;
    companyName: string;
    message: string;
  }>(CONTACT_DRAFT_KEY);

  const [name, setName] = useState(initialDraft?.name || '');
  const [email, setEmail] = useState(initialDraft?.email || '');
  const [phone, setPhone] = useState(initialDraft?.phone || '');
  const [companyName, setCompanyName] = useState(initialDraft?.companyName || '');
  const [message, setMessage] = useState(initialDraft?.message || '');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedName, setSubmittedName] = useState<string | null>(null);

  useEffect(() => {
    if (submittedName) return;
    saveFormDraft(CONTACT_DRAFT_KEY, {
      name,
      email,
      phone,
      companyName,
      message,
    });
  }, [submittedName, name, email, phone, companyName, message]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Please enter your name.');
      return;
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    if (phone.replace(/\D/g, '').length < 10) {
      setError('Please enter a valid phone number (at least 10 digits).');
      return;
    }
    if (!message.trim()) {
      setError('Please enter your message.');
      return;
    }

    setIsSubmitting(true);
    try {
      const fullQueryMessage = [
        message.trim(),
        companyName.trim() ? `Company: ${companyName.trim()}` : '',
        email.trim() ? `Email: ${email.trim()}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      await submitClientQueryToSharedPortal({
        name: name.trim(),
        phone: phone.trim(),
        message: fullQueryMessage,
      });

      if (email.trim()) {
        void submitContactInquiry({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          companyName: companyName.trim() || undefined,
          message: message.trim(),
        }).catch(() => null);
      }

      clearFormDraft(CONTACT_DRAFT_KEY);
      setSubmittedName(name.trim());
    } catch (err) {
      setError(
        toFriendlyPortalError(err, 'Something went wrong, please try again.')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendAnother = () => {
    clearFormDraft(CONTACT_DRAFT_KEY);
    setName('');
    setEmail('');
    setPhone('');
    setCompanyName('');
    setMessage('');
    setError('');
    setSubmittedName(null);
  };

  return (
    <div className="bg-slate-50 min-h-[calc(100vh-5rem)] border-b border-slate-200">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <button
          type="button"
          onClick={onBackHome}
          className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-xl bg-white border border-slate-200 shadow-xs text-sm font-semibold text-[#063B7A] hover:text-[#0A8E43] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>Back to Home</span>
        </button>

        <div className="mt-5 bg-white border border-slate-200 rounded-2xl shadow-lg overflow-hidden">
          <div className="bg-[#063B7A] px-5 sm:px-8 py-6 text-white">
            <p className="text-xs sm:text-sm font-semibold text-[#F58220]">
              Vardhman Consultancy Services · Est. 2012
            </p>
            <h1 className="mt-1 font-display text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Contact Us
            </h1>
            <p className="mt-2 text-sm text-slate-200 leading-relaxed">
              info@vardhmanconsultancy.com | Mobile &amp; WhatsApp: 7877250630 — Reach out for hiring mandates or career inquiries.
            </p>
          </div>

          <div className="p-5 sm:p-8">
            {submittedName ? (
              <div className="p-6 sm:p-8 rounded-2xl bg-[#0A8E43]/8 border border-[#0A8E43]/30 text-center">
                <div className="w-12 h-12 mx-auto rounded-xl bg-white border border-[#0A8E43]/30 text-[#0A8E43] flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6" aria-hidden="true" />
                </div>

                <h2 className="mt-4 font-display text-xl sm:text-2xl font-bold text-[#063B7A]">
                  Inquiry Submitted — Thank You, {submittedName}!
                </h2>

                <p className="mt-2 text-sm sm:text-base text-slate-700 max-w-md mx-auto leading-relaxed">
                  Your message has been received by the Vardhman Consultancy Services team. Our desk will reach out to you on <strong>{phone}</strong> shortly.
                </p>

                <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={handleSendAnother}
                    className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl border border-slate-300 bg-white hover:border-[#063B7A] text-[#063B7A] text-sm font-semibold transition-colors cursor-pointer"
                  >
                    Send Another Message
                  </button>
                  <button
                    type="button"
                    onClick={onBackHome}
                    className="w-full sm:w-auto min-h-[44px] px-6 py-2.5 rounded-xl bg-[#0A8E43] hover:bg-[#087537] text-white text-sm font-semibold transition-colors cursor-pointer"
                  >
                    Back to Home
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Name */}
                  <div>
                    <label
                      htmlFor="contact-page-name"
                      className="block text-xs font-semibold text-[#063B7A] mb-1.5"
                    >
                      Name *
                    </label>
                    <div className="relative flex items-center">
                      <User
                        className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none"
                        aria-hidden="true"
                      />
                      <input
                        id="contact-page-name"
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Enter your full name"
                        className="w-full min-h-[46px] pl-10 pr-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#0A8E43] focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Phone */}
                  <div>
                    <label
                      htmlFor="contact-page-phone"
                      className="block text-xs font-semibold text-[#063B7A] mb-1.5"
                    >
                      Phone *
                    </label>
                    <div className="relative flex items-center">
                      <Phone
                        className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none"
                        aria-hidden="true"
                      />
                      <input
                        id="contact-page-phone"
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="10-digit phone number"
                        className="w-full min-h-[46px] pl-10 pr-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#0A8E43] focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Email (Optional) */}
                  <div>
                    <label
                      htmlFor="contact-page-email"
                      className="block text-xs font-semibold text-[#063B7A] mb-1.5"
                    >
                      Email ID (Optional)
                    </label>
                    <div className="relative flex items-center">
                      <Mail
                        className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none"
                        aria-hidden="true"
                      />
                      <input
                        id="contact-page-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@company.com or personal email"
                        className="w-full min-h-[46px] pl-10 pr-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#0A8E43] focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Company Name */}
                  <div>
                    <label
                      htmlFor="contact-page-company"
                      className="block text-xs font-semibold text-[#063B7A] mb-1.5"
                    >
                      Company Name (Optional)
                    </label>
                    <div className="relative flex items-center">
                      <Building2
                        className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none"
                        aria-hidden="true"
                      />
                      <input
                        id="contact-page-company"
                        type="text"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="Organization / Company name"
                        className="w-full min-h-[46px] pl-10 pr-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#0A8E43] focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Message */}
                <div>
                  <label
                    htmlFor="contact-page-message"
                    className="block text-xs font-semibold text-[#063B7A] mb-1.5"
                  >
                    Message *
                  </label>
                  <div className="relative">
                    <MessageSquare
                      className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none"
                      aria-hidden="true"
                    />
                    <textarea
                      id="contact-page-message"
                      rows={4}
                      required
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Share your career inquiry, hiring requirement, or message..."
                      className="w-full pl-10 pr-3.5 py-3 text-sm text-slate-900 placeholder:text-slate-400 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#0A8E43] focus:outline-none"
                    />
                  </div>
                </div>

                {error && (
                  <p
                    className="text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3"
                    role="alert"
                  >
                    {error}
                  </p>
                )}

                <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <a
                    href="mailto:info@vardhmanconsultancy.com"
                    className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-[#063B7A] hover:text-[#0A8E43] transition-colors"
                  >
                    <Mail className="w-4 h-4 text-[#0A8E43] shrink-0" aria-hidden="true" />
                    <span>info@vardhmanconsultancy.com · Mobile &amp; WhatsApp: 7877250630</span>
                  </a>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full sm:w-auto min-h-[48px] px-7 py-3 rounded-xl bg-[#0A8E43] hover:bg-[#087537] disabled:opacity-60 text-white font-bold text-sm inline-flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
                  >
                    <Send className="w-4 h-4" aria-hidden="true" />
                    <span>{isSubmitting ? 'Submitting...' : 'Submit Message'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
