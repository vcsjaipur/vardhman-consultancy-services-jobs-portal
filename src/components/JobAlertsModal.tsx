import { FormEvent, useEffect, useState } from 'react';
import {
  Bell,
  Briefcase,
  CheckCircle2,
  ExternalLink,
  Mail,
  MapPin,
  MessageCircle,
  User,
  X,
} from 'lucide-react';
import { CandidateProfile } from '../types/portal';
import { submitJobAlert } from '../utils/candidateApi';
import {
  clearFormDraft,
  loadFormDraft,
  saveFormDraft,
} from '../utils/formDraftStorage';
import { submitClientQueryToSharedPortal } from '../utils/sharedPortalFirestore';

const JOB_ALERTS_DRAFT_KEY = 'vcs_draft_job_alerts_v1';

interface JobAlertsModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidate?: CandidateProfile | null;
}

const JOB_CATEGORIES = [
  'Medical Officers',
  'Consultant Doctors',
  'Medical Representatives',
  'Pharmaceutical',
  'Hospital',
  'Healthcare',
  'Life Science',
  'Biotech',
  'Diagnostics',
  'Nutraceuticals',
  'Ayurveda',
  'Homeopathy',
  'Healthcare IT',
  'Healthcare Non-IT',
];

export function JobAlertsModal({ isOpen, onClose, candidate }: JobAlertsModalProps) {
  const [name, setName] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [email, setEmail] = useState('');
  const [enableWhatsapp, setEnableWhatsapp] = useState(true);
  const [enableEmail, setEnableEmail] = useState(true);
  const [city, setCity] = useState('');
  const [category, setCategory] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const draft = loadFormDraft<{
      name: string;
      whatsappNumber: string;
      email: string;
      enableWhatsapp: boolean;
      enableEmail: boolean;
      city: string;
      category: string;
    }>(JOB_ALERTS_DRAFT_KEY);
    setName(candidate?.name || draft?.name || '');
    setWhatsappNumber(
      candidate?.whatsappNumber || candidate?.phone || draft?.whatsappNumber || ''
    );
    setEmail(candidate?.email || draft?.email || '');
    setEnableWhatsapp(
      candidate?.whatsappAlertsEnabled ?? draft?.enableWhatsapp ?? true
    );
    setEnableEmail(
      candidate?.emailNotificationsEnabled ?? draft?.enableEmail ?? true
    );
    setCity(
      candidate?.alertCity ||
        candidate?.preferredLocation ||
        candidate?.city ||
        draft?.city ||
        ''
    );
    setCategory(candidate?.alertCategory || draft?.category || '');
    setError('');
    setSubmitted(false);
  }, [isOpen, candidate]);

  useEffect(() => {
    if (!isOpen || submitted) return;
    saveFormDraft(JOB_ALERTS_DRAFT_KEY, {
      name,
      whatsappNumber,
      email,
      enableWhatsapp,
      enableEmail,
      city,
      category,
    });
  }, [
    isOpen,
    submitted,
    name,
    whatsappNumber,
    email,
    enableWhatsapp,
    enableEmail,
    city,
    category,
  ]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (!enableWhatsapp && !enableEmail) {
      setError('Please select at least one alert channel (WhatsApp or Email).');
      return;
    }
    if (enableWhatsapp && whatsappNumber.replace(/\D/g, '').length < 10) {
      setError('Please enter a valid 10-digit WhatsApp number.');
      return;
    }
    if (enableEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid Email address for Email Notifications.');
      return;
    }
    if (!city.trim()) {
      setError('Please enter your preferred city.');
      return;
    }
    if (!category) {
      setError('Please select a job category.');
      return;
    }

    const channels: Array<'whatsapp' | 'email'> = [];
    if (enableWhatsapp) channels.push('whatsapp');
    if (enableEmail) channels.push('email');

    setIsSubmitting(true);
    try {
      await submitJobAlert({
        name: name.trim(),
        whatsappNumber: whatsappNumber.trim() || '0000000000',
        email: enableEmail ? email.trim() : undefined,
        channels,
        city: city.trim(),
        category,
      });
      void submitClientQueryToSharedPortal({
        name: name.trim(),
        phone: whatsappNumber.trim() || 'Not provided',
        message: [
          `Job Alert Subscription Request`,
          `Category: ${category}`,
          `Preferred City: ${city.trim()}`,
          `Channels: ${channels.join(', ')}`,
          enableEmail && email.trim() ? `Email: ${email.trim()}` : '',
        ]
          .filter(Boolean)
          .join(' | '),
      }).catch(() => null);
      clearFormDraft(JOB_ALERTS_DRAFT_KEY);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save job alert.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const whatsappDirectUrl = `https://wa.me/917877250630?text=${encodeURIComponent(
    `Hello Vardhman Consultancy Services, I subscribed for WhatsApp Job Alerts. Name: ${name}, City: ${city}, Category: ${category}.`
  )}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="job-alerts-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="grid grid-cols-3 h-1 w-full" aria-hidden="true">
          <div className="bg-[#063B7A]" />
          <div className="bg-[#F58220]" />
          <div className="bg-[#0A8E43]" />
        </div>

        <div className="p-5 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-[#0A8E43]">
                WhatsApp &amp; Email Job Alerts
              </p>
              <h2
                id="job-alerts-modal-title"
                className="mt-1 font-display text-xl sm:text-2xl font-bold text-[#063B7A]"
              >
                Get Job Alerts
              </h2>
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

          {submitted ? (
            <div className="mt-5">
              <div className="p-5 rounded-xl bg-[#0A8E43]/8 border border-[#0A8E43]/30">
                <div className="flex items-center gap-2.5 font-bold text-[#0A8E43] text-base">
                  <CheckCircle2 className="w-5 h-5 shrink-0" aria-hidden="true" />
                  <span>Your Job Alerts Are Active!</span>
                </div>
                <p className="mt-2 text-sm text-slate-700 leading-relaxed">
                  Thank you, <span className="font-semibold">{name}</span>. Verified openings in{' '}
                  <span className="font-semibold">{category}</span> ({city}) will be shared via{' '}
                  {enableWhatsapp && enableEmail
                    ? `WhatsApp (${whatsappNumber}) & Email (${email})`
                    : enableWhatsapp
                      ? `WhatsApp (${whatsappNumber})`
                      : `Email (${email})`}
                  .
                </p>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-end gap-2.5">
                {enableWhatsapp && (
                  <a
                    href={whatsappDirectUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#0A8E43] hover:bg-[#087537] text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors"
                  >
                    <MessageCircle className="w-4 h-4" aria-hidden="true" />
                    <span>Activate on WhatsApp</span>
                    <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[44px] px-6 py-2.5 rounded-xl bg-[#063B7A] hover:bg-[#042A58] text-white text-sm font-semibold transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
              <p className="text-sm text-slate-600 leading-relaxed">
                Receive verified mandate notifications directly on WhatsApp and/or Email when matching opportunities are published.
              </p>

              {/* Notification Channels */}
              <div className="grid grid-cols-2 gap-2.5">
                <label className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 flex items-center gap-2 text-xs sm:text-sm font-semibold text-[#0A8E43] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableWhatsapp}
                    onChange={(e) => setEnableWhatsapp(e.target.checked)}
                    className="rounded border-slate-300 text-[#0A8E43]"
                  />
                  <MessageCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>WhatsApp Alerts</span>
                </label>

                <label className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 flex items-center gap-2 text-xs sm:text-sm font-semibold text-[#063B7A] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableEmail}
                    onChange={(e) => setEnableEmail(e.target.checked)}
                    className="rounded border-slate-300 text-[#063B7A]"
                  />
                  <Mail className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>Email Alerts</span>
                </label>
              </div>

              {/* Name */}
              <div>
                <label
                  htmlFor="alert-name"
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
                    id="alert-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your full name"
                    className="w-full min-h-[44px] pl-10 pr-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:border-[#063B7A] focus:outline-none focus:ring-2 focus:ring-[#063B7A]/15"
                  />
                </div>
              </div>

              {/* WhatsApp Number */}
              {enableWhatsapp && (
                <div>
                  <label
                    htmlFor="alert-whatsapp"
                    className="block text-xs font-semibold text-[#063B7A] mb-1.5"
                  >
                    WhatsApp Number *
                  </label>
                  <div className="relative flex items-center">
                    <MessageCircle
                      className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none"
                      aria-hidden="true"
                    />
                    <input
                      id="alert-whatsapp"
                      type="tel"
                      required
                      value={whatsappNumber}
                      onChange={(e) => setWhatsappNumber(e.target.value)}
                      placeholder="10-digit WhatsApp mobile number"
                      className="w-full min-h-[44px] pl-10 pr-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:border-[#063B7A] focus:outline-none focus:ring-2 focus:ring-[#063B7A]/15"
                    />
                  </div>
                </div>
              )}

              {/* Email */}
              {enableEmail && (
                <div>
                  <label
                    htmlFor="alert-email"
                    className="block text-xs font-semibold text-[#063B7A] mb-1.5"
                  >
                    Email Address *
                  </label>
                  <div className="relative flex items-center">
                    <Mail
                      className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none"
                      aria-hidden="true"
                    />
                    <input
                      id="alert-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full min-h-[44px] pl-10 pr-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:border-[#063B7A] focus:outline-none focus:ring-2 focus:ring-[#063B7A]/15"
                    />
                  </div>
                </div>
              )}

              {/* City */}
              <div>
                <label
                  htmlFor="alert-city"
                  className="block text-xs font-semibold text-[#063B7A] mb-1.5"
                >
                  City *
                </label>
                <div className="relative flex items-center">
                  <MapPin
                    className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    id="alert-city"
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. Mumbai, Delhi, Bengaluru"
                    className="w-full min-h-[44px] pl-10 pr-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:border-[#063B7A] focus:outline-none focus:ring-2 focus:ring-[#063B7A]/15"
                  />
                </div>
              </div>

              {/* Category */}
              <div>
                <label
                  htmlFor="alert-category"
                  className="block text-xs font-semibold text-[#063B7A] mb-1.5"
                >
                  Category *
                </label>
                <div className="relative flex items-center">
                  <Briefcase
                    className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none"
                    aria-hidden="true"
                  />
                  <select
                    id="alert-category"
                    required
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full min-h-[44px] pl-10 pr-8 py-2 text-sm text-slate-800 bg-white border border-slate-200 rounded-xl focus:border-[#063B7A] focus:outline-none focus:ring-2 focus:ring-[#063B7A]/15 cursor-pointer"
                  >
                    <option value="">Select Job Category</option>
                    {JOB_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {error && (
                <p className="text-xs sm:text-sm font-medium text-red-600" role="alert">
                  {error}
                </p>
              )}

              <div className="pt-2 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-medium transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="min-h-[46px] px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#0A8E43] to-[#077235] hover:from-[#087537] hover:to-[#065E2B] disabled:opacity-60 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 shadow-md shadow-[#0A8E43]/25 transition-all cursor-pointer"
                >
                  <Bell className="w-4 h-4" aria-hidden="true" />
                  <span>{isSubmitting ? 'Subscribing...' : 'Subscribe to Job Alerts'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

