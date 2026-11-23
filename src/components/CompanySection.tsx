import {
  ArrowRight,
  BadgeCheck,
  Briefcase,
  Building2,
  Factory,
  FlaskConical,
  Laptop,
  MessageSquare,
  PlusCircle,
  Stethoscope,
  UserPlus,
} from 'lucide-react';
import { CandidateProfile } from '../types/portal';

interface CompanySectionProps {
  candidate: CandidateProfile | null;
  onPostJobAction: () => void;
  onEmployerLogin: () => void;
  onEmployerRegister: () => void;
  onContactUs: () => void;
}

const COMPANY_VERTICALS = [
  {
    title: 'Pharmaceuticals & Life Sciences',
    roles: 'MR, ASM, RSM, ZSM, NSM, Product Management (PMT), Regulatory Affairs & International Marketing.',
    icon: FlaskConical,
  },
  {
    title: 'Hospitals & Clinical Healthcare',
    roles: 'Cardiologists, Gynecologists, Nephrologists, Radiologists, Physicians, MBBS Doctors & Nursing Heads.',
    icon: Stethoscope,
  },
  {
    title: 'Manufacturing, Plant & QA / QC',
    roles: 'Plant Heads, Production Managers, QA/QC Leads, R&D Scientists, Purchase & Supply Chain.',
    icon: Factory,
  },
  {
    title: 'IT, Software & Corporate Functions',
    roles: 'Software & AI Engineers, Finance Controllers, Chartered Accountants, HR & Administration.',
    icon: Laptop,
  },
];

export function CompanySection({
  candidate,
  onPostJobAction,
  onEmployerLogin,
  onEmployerRegister,
  onContactUs,
}: CompanySectionProps) {
  const isCandidateOnly = candidate?.role === 'candidate';

  return (
    <section
      id="companies"
      aria-labelledby="company-section-heading"
      className="bg-white py-12 sm:py-16 border-b border-slate-200"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Heading */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-wider text-[#9A6F04]">
              For Companies &amp; Hiring Partners · Pan India
            </p>
            <h2
              id="company-section-heading"
              className="mt-1 font-display text-2xl sm:text-3xl font-extrabold text-[#062856] tracking-tight"
            >
              Company Hiring &amp; Employer Desk
            </h2>
            <p className="mt-2 text-sm sm:text-base text-slate-600 leading-relaxed">
              Partner with Vardhman Consultancy Services to source pre-screened talent across Junior, Middle, and Senior leadership mandates.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0A8E43]/10 border border-[#0A8E43]/25 text-xs font-bold text-[#065F2C]">
              <BadgeCheck className="w-4 h-4 text-[#0A8E43]" aria-hidden="true" />
              <span>Confidential Executive Search</span>
            </span>
          </div>
        </div>

        {/* Company Hiring Verticals */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {COMPANY_VERTICALS.map((item) => {
            const Icon = item.icon;
            return (
              <article
                key={item.title}
                className="bg-slate-50/70 border border-slate-200 hover:border-[#062856]/40 rounded-2xl p-5 flex flex-col justify-between transition-all"
              >
                <div>
                  <div className="w-11 h-11 rounded-xl bg-[#062856] text-[#F6D574] flex items-center justify-center">
                    <Icon className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <h3 className="mt-4 font-display text-base sm:text-lg font-bold text-[#062856] leading-snug">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
                    {item.roles}
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-200/80 flex items-center gap-1.5 text-xs font-semibold text-[#9A6F04]">
                  <Briefcase className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>Verified Hiring Mandates</span>
                </div>
              </article>
            );
          })}
        </div>

        {/* Employer Call-to-Action Banner */}
        <div className="mt-8 rounded-2xl bg-gradient-to-br from-[#041C3F] via-[#062856] to-[#083B7E] border border-[#D4AF37]/60 shadow-lg p-6 sm:p-8 text-white">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-start gap-4 max-w-2xl">
              <div className="w-12 h-12 rounded-xl bg-white/10 border border-[#D4AF37]/50 text-[#F6D574] flex items-center justify-center shrink-0">
                <Building2 className="w-6 h-6" aria-hidden="true" />
              </div>
              <div>
                <h3 className="font-display text-lg sm:text-2xl font-extrabold text-white">
                  Hiring for Your Company or Hospital?
                </h3>
                <p className="mt-1.5 text-xs sm:text-sm text-slate-200 leading-relaxed">
                  Share your open positions directly with our recruitment specialists or access your Employer Account to publish mandates and review verified candidate profiles.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              {!isCandidateOnly && (
                <button
                  type="button"
                  onClick={onPostJobAction}
                  className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#D4AF37] hover:bg-[#C39E27] text-[#041C3F] font-bold text-xs sm:text-sm inline-flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>Post A Job</span>
                </button>
              )}

              {!candidate && (
                <>
                  <button
                    type="button"
                    onClick={onEmployerLogin}
                    className="min-h-[44px] px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/25 text-white font-semibold text-xs sm:text-sm inline-flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <span>Employer Login</span>
                    <ArrowRight className="w-4 h-4 text-[#F6D574]" aria-hidden="true" />
                  </button>

                  <button
                    type="button"
                    onClick={onEmployerRegister}
                    className="min-h-[44px] px-4 py-2.5 rounded-xl border border-[#D4AF37]/60 hover:bg-[#D4AF37]/15 text-[#F6D574] font-semibold text-xs sm:text-sm inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <UserPlus className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>Company Register</span>
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={onContactUs}
                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-white text-[#062856] hover:bg-slate-100 font-semibold text-xs sm:text-sm inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <MessageSquare className="w-4 h-4 text-[#9A6F04]" aria-hidden="true" />
                <span>Contact Desk</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
