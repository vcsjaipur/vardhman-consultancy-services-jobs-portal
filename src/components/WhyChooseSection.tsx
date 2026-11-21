import { Building2, FileCheck2, ShieldCheck, Stethoscope } from 'lucide-react';

const SERVICE_BOXES = [
  {
    code: '01.',
    title: 'Pharmaceutical & Leadership Search',
    description:
      'Dedicated placement across Sales Leadership (MR to NSM), PMT, Production, QA, QC, R&D, and Corporate Finance.',
    icon: ShieldCheck,
  },
  {
    code: '02.',
    title: 'Hospital & Clinical Staffing',
    description:
      'Specialized recruitment for Gynecologists, Orthopedicians, Cardiologists, Nephrologists, Oncopathologists, Physicians, and MBBS Doctors.',
    icon: Stethoscope,
  },
  {
    code: '03.',
    title: 'Verified Mandates & Easy Apply',
    description:
      'Direct coordination with hiring organizations across India with one-click Easy Apply, Portal Resume Submission, and instant interview coordination.',
    icon: Building2,
  },
  {
    code: '04.',
    title: 'Free Candidate Resume Desk',
    description:
      'Zero charges for job seekers. Submit your CV once for direct matching with confidential executive openings.',
    icon: FileCheck2,
  },
];

export function WhyChooseSection() {
  return (
    <section
      id="services"
      className="bg-slate-50/70 py-12 sm:py-16 border-b border-slate-200"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-wider text-[#9A6F04]">
            Vardhman Consultancy Services · Est. 2012
          </p>
          <h2 className="mt-1 font-display text-2xl sm:text-3xl font-extrabold text-[#062856] tracking-tight">
            Our Recruitment Services
          </h2>
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {SERVICE_BOXES.map((box) => {
            const Icon = box.icon;
            return (
              <article
                key={box.title}
                className="bg-white border border-slate-200 hover:border-[#062856]/40 rounded-2xl shadow-xs hover:shadow-md p-6 flex flex-col justify-between transition-all"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div
                      className="w-11 h-11 rounded-xl bg-[#062856] text-[#F6D574] flex items-center justify-center"
                      aria-hidden="true"
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="font-display text-sm font-bold text-[#9A6F04] tabular-nums">
                      {box.code}
                    </span>
                  </div>

                  <h3 className="mt-5 font-display text-lg font-bold text-[#062856] leading-snug">
                    {box.title}
                  </h3>

                  <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                    {box.description}
                  </p>
                </div>

                <div className="mt-5 h-[3px] w-12 rounded-full bg-[#D4AF37]" aria-hidden="true" />
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
