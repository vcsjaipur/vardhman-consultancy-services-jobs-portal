export function AboutUsPage() {
  return (
    <div className="bg-slate-50 min-h-[calc(100vh-5rem)] border-b border-slate-200">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <article className="bg-white border border-slate-200 rounded-2xl shadow-lg overflow-hidden">
          <div className="bg-[#062856] px-6 sm:px-10 py-8 text-white border-b-2 border-[#D4AF37]">
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              About JobsNia
            </h1>
            <p className="mt-3 text-sm sm:text-base text-slate-200 leading-relaxed">
              JobsNia.com is a venture of Vardhman Consultancy Services (VCS) - a professionally managed recruitment &amp; placement consultant from Jaipur, Rajasthan. Founded in 2012, headed by Mr. Vikas Jain.
            </p>
          </div>

          <div className="p-6 sm:p-10 space-y-6 text-slate-700">
            <div>
              <h2 className="font-display text-lg font-bold text-[#062856]">
                Who We Are
              </h2>
              <p className="mt-1.5 text-sm sm:text-base leading-relaxed">
                We are a trusted recruitment and career platform connecting the right talent with the right opportunity - across India and globally.
              </p>
            </div>

            <div>
              <h2 className="font-display text-lg font-bold text-[#062856]">
                What We Do
              </h2>
              <p className="mt-1.5 text-sm sm:text-base leading-relaxed">
                We deliver world-class professional employment solutions for Senior, Middle &amp; Junior level hiring - fast, reliable and result-oriented.
              </p>
            </div>

            <div>
              <h2 className="font-display text-lg font-bold text-[#062856]">
                For Job Seekers
              </h2>
              <p className="mt-1.5 text-sm sm:text-base leading-relaxed">
                Find verified job opportunities near you. Whether you are a Doctor, Nurse, Medical Representative, Area Sales Manager, Regional Sales Manager, HR, IT Professional, or Factory / Plant Professional - JobsNia is built for you.
              </p>
            </div>

            <div>
              <h2 className="font-display text-lg font-bold text-[#062856]">
                For Employers
              </h2>
              <p className="mt-1.5 text-sm sm:text-base leading-relaxed">
                Focus on your business while we handle your recruitment. We help you find the Right People for the Right Jobs on the Right Time.
              </p>
            </div>

            <div>
              <h2 className="font-display text-lg font-bold text-[#062856]">
                Our Expertise
              </h2>
              <div className="mt-1.5 space-y-2 text-sm sm:text-base leading-relaxed">
                <p>
                  Doctors &amp; Medical: Doctors, Allopathic, Homeopathic, Ayurvedic, Nursing, Diagnostics, Oncology, Surgical, Hospitals, Clinics, Healthcare
                </p>
                <p>
                  Pharma: Sales, Marketing, Production, Plant, Factory, Quality, R&amp;D, MR
                </p>
                <p>
                  Life Sciences &amp; Corporate: Biotech, IT, NON-IT, HR, Staffing, Executive Search
                </p>
              </div>
            </div>

            <div>
              <h2 className="font-display text-lg font-bold text-[#062856]">
                Our Mission
              </h2>
              <p className="mt-1.5 text-sm sm:text-base leading-relaxed">
                To remove the friction from hiring and make hiring smooth, fast and painless.
              </p>
            </div>

            <div>
              <h2 className="font-display text-lg font-bold text-[#062856]">
                Our Promise
              </h2>
              <p className="mt-1.5 text-sm sm:text-base leading-relaxed">
                Cost saving, quick response, timely delivery, quality HR service.
              </p>
            </div>

            <div>
              <h2 className="font-display text-lg font-bold text-[#062856]">
                Our Belief
              </h2>
              <p className="mt-1.5 text-sm sm:text-base leading-relaxed">
                Whatever we do, we do 100%
              </p>
            </div>

            <div className="pt-4 border-t border-slate-200 text-sm sm:text-base font-semibold text-[#062856] leading-relaxed flex flex-col items-start gap-1">
              <a
                href="https://www.jobsnia.com"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[#9A6F04] underline underline-offset-2 transition-colors"
              >
                www.jobsnia.com
              </a>
              <a
                href="https://www.vardhmanconsultancy.com"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[#9A6F04] underline underline-offset-2 transition-colors"
              >
                www.vardhmanconsultancy.com
              </a>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}
