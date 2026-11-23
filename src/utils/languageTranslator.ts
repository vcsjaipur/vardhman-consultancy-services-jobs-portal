export interface SupportedLanguage {
  code: string;
  label: string;
  nativeLabel: string;
}

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी (Hindi)' },
  { code: 'mr', label: 'Marathi', nativeLabel: 'मराठी (Marathi)' },
  { code: 'gu', label: 'Gujarati', nativeLabel: 'ગુજરાતી (Gujarati)' },
  { code: 'ta', label: 'Tamil', nativeLabel: 'தமிழ் (Tamil)' },
  { code: 'te', label: 'Telugu', nativeLabel: 'తెలుగు (Telugu)' },
  { code: 'bn', label: 'Bengali', nativeLabel: 'বাংলা (Bengali)' },
  { code: 'pa', label: 'Punjabi', nativeLabel: 'ਪੰਜਾਬੀ (Punjabi)' },
  { code: 'kn', label: 'Kannada', nativeLabel: 'ಕನ್ನಡ (Kannada)' },
  { code: 'ml', label: 'Malayalam', nativeLabel: 'മലയാളം (Malayalam)' },
  { code: 'ur', label: 'Urdu', nativeLabel: 'اردو (Urdu)' },
  { code: 'es', label: 'Spanish', nativeLabel: 'Español' },
  { code: 'fr', label: 'French', nativeLabel: 'Français' },
  { code: 'ar', label: 'Arabic', nativeLabel: 'العربية' },
];

export const LANGUAGE_STORAGE_KEY = 'vcs_portal_language_v1';
const TRANSLATION_CACHE_PREFIX = 'vcs_lang_cache_v1:';

const originalNodeText = new WeakMap<Text, string>();
const trackedNodes = new Set<Text>();
const memoryCache = new Map<string, Map<string, string>>();
let activeLanguage = 'en';
let observer: MutationObserver | null = null;
let pendingTimer: number | null = null;
let isApplying = false;

const BUILTIN_DICTIONARY: Record<string, Record<string, string>> = {
  hi: {
    'Jobs': 'नौकरियां',
    'About': 'हमारे बारे में',
    'Services': 'सेवाएं',
    'Contact': 'संपर्क करें',
    'Candidate Login': 'उम्मीदवार लॉगिन',
    'Employer Login': 'नियोक्ता लॉगिन',
    'Logout': 'लॉग आउट',
    'Dashboard': 'डैशबोर्ड',
    'Your Job Search Ends Here': 'आपकी नौकरी की तलाश यहाँ समाप्त होती है',
    'Welcome to JobsNia.com Job Portal': 'JobsNia.com जॉब पोर्टल में आपका स्वागत है',
    'Search Jobs': 'नौकरियां खोजें',
    'AI Job Finder Copilot': 'AI जॉब फाइंडर कोपायलट',
    'Get Job Alert Emails': 'जॉब अलर्ट ईमेल प्राप्त करें',
    'Verified Jobs Only · Easy Apply': 'केवल सत्यापित नौकरियां · आसान आवेदन',
    'Latest Verified Jobs': 'नवीनतम सत्यापित नौकरियां',
    'All Verified Jobs': 'सभी सत्यापित नौकरियां',
    'Saved Jobs': 'सहेजी गई नौकरियां',
    'Job Trends': 'जॉब ट्रेंड्स',
    'AI Job Finder': 'AI जॉब फाइंडर',
    'Job Alerts': 'जॉब अलर्ट्स',
    'Advanced Search': 'उन्नत खोज',
    'Apply Now': 'अभी आवेदन करें',
    'Share Job': 'नौकरी साझा करें',
    'Details': 'विवरण',
    'Our Recruitment Services': 'हमारी भर्ती सेवाएं',
    'Company Hiring & Employer Desk': 'कंपनी भर्ती एवं नियोक्ता डेस्क',
    'Hiring for Your Company or Hospital?': 'क्या आप अपनी कंपनी या अस्पताल के लिए भर्ती कर रहे हैं?',
    'Post A Job': 'नौकरी पोस्ट करें',
    'Company Register': 'कंपनी पंजीकरण',
    'Contact Desk': 'संपर्क डेस्क',
    'Submit Resume': 'रिज्यूमे सबमिट करें',
    'About JobsNia.com': 'JobsNia.com के बारे में',
    'Quick Links': 'त्वरित लिंक',
    'Home': 'होम',
    'About Us': 'हमारे बारे में',
    'Build Resume': 'रिज्यूमे बनाएं',
    'Interview Tips': 'इंटरव्यू टिप्स',
    'Terms & Conditions': 'नियम एवं शर्तें',
    'Contact Us': 'संपर्क करें',
    'Open Inquiry Form': 'पूछताछ फॉर्म खोलें',
    'Daily Visitors:': 'दैनिक आगंतुक:',
    '100% Free Placement Services for Every Candidate · Jaipur, India': 'प्रत्येक उम्मीदवार के लिए 100% निःशुल्क प्लेसमेंट सेवाएं · जयपुर, भारत',
    'View Job Details': 'नौकरी का विवरण देखें',
    'Back to Jobs': 'नौकरियों पर वापस जाएं',
    'Save Job': 'नौकरी सहेजें',
    'Saved': 'सहेजी गई',
  },
  mr: {
    'Jobs': 'नोकऱ्या',
    'About': 'आमच्याबद्दल',
    'Services': 'सेवा',
    'Contact': 'संपर्क',
    'Candidate Login': 'उमेदवार लॉगिन',
    'Employer Login': 'नियोक्ता लॉगिन',
    'Your Job Search Ends Here': 'तुमचा नोकरीचा शोध येथे संपतो',
    'Search Jobs': 'नोकऱ्या शोधा',
    'Latest Verified Jobs': 'नवीनतम सत्यापित नोकऱ्या',
    'Apply Now': 'आता अर्ज करा',
    'Share Job': 'नोकरी शेअर करा',
    'Details': 'तपशील',
    'Our Recruitment Services': 'आमच्या भरती सेवा',
    'Company Hiring & Employer Desk': 'कंपनी भरती आणि नियोक्ता डेस्क',
    'Post A Job': 'नोकरी पोस्ट करा',
    'Submit Resume': 'रेझ्युमे सबमिट करा',
    'Quick Links': 'त्वरित दुवे',
    'Contact Desk': 'संपर्क डेस्क',
    'Daily Visitors:': 'दैनिक भेट देणारे:',
  },
  gu: {
    'Jobs': 'નોકરીઓ',
    'About': 'અમારા વિશે',
    'Services': 'સેવાઓ',
    'Contact': 'સંપર્ક',
    'Candidate Login': 'ઉમેદવાર લૉગિન',
    'Employer Login': 'નોકરીદાતા લૉગિન',
    'Your Job Search Ends Here': 'તમારી નોકરીની શોધ અહીં પૂરી થાય છે',
    'Search Jobs': 'નોકરીઓ શોધો',
    'Latest Verified Jobs': 'નવીનતમ ચકાસાયેલ નોકરીઓ',
    'Apply Now': 'હમણાં જ અરજી કરો',
    'Share Job': 'નોકરી શેર કરો',
    'Details': 'વિગતો',
    'Our Recruitment Services': 'અમારી ભરતી સેવાઓ',
    'Company Hiring & Employer Desk': 'કંપની ભરતી અને એમ્પ્લોયર ડેસ્ક',
    'Post A Job': 'નોકરી પોસ્ટ કરો',
    'Submit Resume': 'રેઝ્યુમે સબમિટ કરો',
    'Quick Links': 'ઝડપી લિંક્સ',
    'Contact Desk': 'સંપર્ક ડેસ્ક',
    'Daily Visitors:': 'દૈનિક મુલાકાતીઓ:',
  },
  ta: {
    'Jobs': 'வேலைகள்',
    'About': 'எங்களை பற்றி',
    'Services': 'சேவைகள்',
    'Contact': 'தொடர்பு',
    'Candidate Login': 'விண்ணப்பதாரர் உள்நுழைவு',
    'Employer Login': 'நிறுவன உள்நுழைவு',
    'Your Job Search Ends Here': 'உங்கள் வேலை தேடல் இங்கே முடிகிறது',
    'Search Jobs': 'வேலைகளைத் தேடுங்கள்',
    'Latest Verified Jobs': 'சமீபத்திய சரிபார்க்கப்பட்ட வேலைகள்',
    'Apply Now': 'இப்போதே விண்ணப்பிக்கவும்',
    'Share Job': 'வேலையைப் பகிரவும்',
    'Details': 'விவரங்கள்',
    'Our Recruitment Services': 'எங்கள் ஆட்சேர்ப்பு சேவைகள்',
    'Company Hiring & Employer Desk': 'நிறுவன ஆட்சேர்ப்பு பிரிவு',
    'Post A Job': 'வேலை பதிவிடவும்',
    'Submit Resume': 'விண்ணப்பம் சமர்ப்பிக்கவும்',
    'Daily Visitors:': 'தினசரி பார்வையாளர்கள்:',
  },
  te: {
    'Jobs': 'ఉద్యోగాలు',
    'About': 'మా గురించి',
    'Services': 'సేవలు',
    'Contact': 'సంప్రదించండి',
    'Candidate Login': 'అభ్యర్థి లాగిన్',
    'Employer Login': 'సంస్థ లాగిన్',
    'Your Job Search Ends Here': 'మీ ఉద్యోగ అన్వేషణ ఇక్కడ ముగుస్తుంది',
    'Search Jobs': 'ఉద్యోగాలను వెతకండి',
    'Latest Verified Jobs': 'తాజా ధృవీకరించబడిన ఉద్యోగాలు',
    'Apply Now': 'ఇప్పుడే దరఖాస్తు చేయండి',
    'Share Job': 'ఉద్యోగాన్ని షేర్ చేయండి',
    'Details': 'వివరాలు',
    'Our Recruitment Services': 'మా నియామక సేవలు',
    'Company Hiring & Employer Desk': 'కంపెనీ నియామక విభాగం',
    'Post A Job': 'ఉద్యోగాన్ని పోస్ట్ చేయండి',
    'Submit Resume': 'రెజ్యూమ్ సమర్పించండి',
    'Daily Visitors:': 'రోజువారీ సందర్శకులు:',
  },
  bn: {
    'Jobs': 'চাকরি',
    'About': 'আমাদের সম্পর্কে',
    'Services': 'সেবা',
    'Contact': 'যোগাযোগ',
    'Candidate Login': 'প্রার্থী লগইন',
    'Employer Login': 'নিয়োগকর্তা লগইন',
    'Your Job Search Ends Here': 'আপনার চাকরির খোঁজ এখানেই শেষ',
    'Search Jobs': 'চাকরি খুঁজুন',
    'Latest Verified Jobs': 'সর্বশেষ যাচাইকৃত চাকরি',
    'Apply Now': 'এখনই আবেদন করুন',
    'Share Job': 'চাকরি শেয়ার করুন',
    'Details': 'বিস্তারিত',
    'Our Recruitment Services': 'আমাদের নিয়োগ সেবা',
    'Company Hiring & Employer Desk': 'কোম্পানি নিয়োগ ডেস্ক',
    'Post A Job': 'চাকরি পোস্ট করুন',
    'Submit Resume': 'জীবনবৃত্তান্ত জমা দিন',
    'Daily Visitors:': 'দৈনিক দর্শক:',
  },
  pa: {
    'Jobs': 'ਨੌਕਰੀਆਂ',
    'About': 'ਸਾਡੇ ਬਾਰੇ',
    'Services': 'ਸੇਵਾਵਾਂ',
    'Contact': 'ਸੰਪਰਕ',
    'Candidate Login': 'ਉਮੀਦਵਾਰ ਲੌਗਇਨ',
    'Employer Login': 'ਮਾਲਕ ਲੌਗਇਨ',
    'Your Job Search Ends Here': 'ਤੁਹਾਡੀ ਨੌਕਰੀ ਦੀ ਖੋਜ ਇੱਥੇ ਖਤਮ ਹੁੰਦੀ ਹੈ',
    'Search Jobs': 'ਨੌਕਰੀਆਂ ਖੋਜੋ',
    'Latest Verified Jobs': 'ਤਾਜ਼ਾ ਪ੍ਰਮਾਣਿਤ ਨੌਕਰੀਆਂ',
    'Apply Now': 'ਹੁਣੇ ਅਪਲਾਈ ਕਰੋ',
    'Share Job': 'ਨੌਕਰੀ ਸਾਂਝੀ ਕਰੋ',
    'Details': 'ਵੇਰਵੇ',
    'Post A Job': 'ਨੌਕਰੀ ਪੋਸਟ ਕਰੋ',
    'Submit Resume': 'ਰੈਜ਼ਿਊਮੇ ਜਮ੍ਹਾਂ ਕਰੋ',
    'Daily Visitors:': 'ਰੋਜ਼ਾਨਾ ਦਰਸ਼ਕ:',
  },
  kn: {
    'Jobs': 'ಉದ್ಯೋಗಗಳು',
    'About': 'ನಮ್ಮ ಬಗ್ಗೆ',
    'Services': 'ಸೇವೆಗಳು',
    'Contact': 'ಸಂಪರ್ಕಿಸಿ',
    'Candidate Login': 'ಅಭ್ಯರ್ಥಿ ಲಾಗಿನ್',
    'Employer Login': 'ಉದ್ಯೋಗದಾತ ಲಾಗಿನ್',
    'Your Job Search Ends Here': 'ನಿಮ್ಮ ಉದ್ಯೋಗ ಹುಡುಕಾಟ ಇಲ್ಲಿ ಕೊನೆಗೊಳ್ಳುತ್ತದೆ',
    'Search Jobs': 'ಉದ್ಯೋಗಗಳನ್ನು ಹುಡುಕಿ',
    'Latest Verified Jobs': 'ಇತ್ತೀಚಿನ ಪರಿಶೀಲಿಸಿದ ಉದ್ಯೋಗಗಳು',
    'Apply Now': 'ಈಗಲೇ ಅರ್ಜಿ ಸಲ್ಲಿಸಿ',
    'Share Job': 'ಉದ್ಯೋಗ ಹಂಚಿಕೊಳ್ಳಿ',
    'Details': 'ವಿವರಗಳು',
    'Post A Job': 'ಉದ್ಯೋಗ ಪೋಸ್ಟ್ ಮಾಡಿ',
    'Daily Visitors:': 'ದೈನಂದಿನ ಸಂದರ್ಶಕರು:',
  },
  ml: {
    'Jobs': 'ജോലികൾ',
    'About': 'ഞങ്ങളെക്കുറിച്ച്',
    'Services': 'സേവനങ്ങൾ',
    'Contact': 'ബന്ധപ്പെടുക',
    'Candidate Login': 'ഉദ്യോഗാർത്ഥി ലോഗിൻ',
    'Employer Login': 'തൊഴിലുടമ ലോഗിൻ',
    'Your Job Search Ends Here': 'നിങ്ങളുടെ തൊഴിൽ അന്വേഷണം ഇവിടെ അവസാനിക്കുന്നു',
    'Search Jobs': 'ജോലികൾ തിരയുക',
    'Latest Verified Jobs': 'ഏറ്റവും പുതിയ ജോലികൾ',
    'Apply Now': 'ഇപ്പോൾ അപേക്ഷിക്കുക',
    'Share Job': 'ജോലി പങ്കിടുക',
    'Details': 'വിശദാംശങ്ങൾ',
    'Post A Job': 'ജോലി പോസ്റ്റ് ചെയ്യുക',
    'Daily Visitors:': 'പ്രതിദിന സന്ദർശകർ:',
  },
  ur: {
    'Jobs': 'نوکریاں',
    'About': 'ہمارے بارے میں',
    'Services': 'خدمات',
    'Contact': 'رابطہ کریں',
    'Candidate Login': 'امیدوار لاگ ان',
    'Employer Login': 'آجر لاگ ان',
    'Your Job Search Ends Here': 'آپ کی نوکری کی تلاش یہاں ختم ہوتی ہے',
    'Search Jobs': 'نوکریاں تلاش کریں',
    'Latest Verified Jobs': 'تازہ ترین تصدیق شدہ نوکریاں',
    'Apply Now': 'ابھی درخواست دیں',
    'Share Job': 'نوکری شیئر کریں',
    'Details': 'تفصیلات',
    'Post A Job': 'نوکری پوسٹ کریں',
    'Daily Visitors:': 'روزانہ زائرین:',
  },
  es: {
    'Jobs': 'Empleos',
    'About': 'Nosotros',
    'Services': 'Servicios',
    'Contact': 'Contacto',
    'Candidate Login': 'Acceso Candidato',
    'Employer Login': 'Acceso Empresa',
    'Your Job Search Ends Here': 'Tu búsqueda de empleo termina aquí',
    'Search Jobs': 'Buscar Empleos',
    'Latest Verified Jobs': 'Últimos Empleos Verificados',
    'Apply Now': 'Postular Ahora',
    'Share Job': 'Compartir Empleo',
    'Details': 'Detalles',
    'Our Recruitment Services': 'Nuestros Servicios de Selección',
    'Company Hiring & Employer Desk': 'Sección de Empresas y Empleadores',
    'Post A Job': 'Publicar Empleo',
    'Submit Resume': 'Enviar Currículum',
    'Daily Visitors:': 'Visitantes Diarios:',
  },
  fr: {
    'Jobs': 'Emplois',
    'About': 'À propos',
    'Services': 'Services',
    'Contact': 'Contact',
    'Candidate Login': 'Connexion Candidat',
    'Employer Login': 'Connexion Employeur',
    'Your Job Search Ends Here': 'Votre recherche d’emploi s’arrête ici',
    'Search Jobs': 'Rechercher',
    'Latest Verified Jobs': 'Dernières Offres Vérifiées',
    'Apply Now': 'Postuler',
    'Share Job': 'Partager l’offre',
    'Details': 'Détails',
    'Our Recruitment Services': 'Nos Services de Recrutement',
    'Company Hiring & Employer Desk': 'Espace Entreprises & Recruteurs',
    'Post A Job': 'Publier une Offre',
    'Submit Resume': 'Envoyer CV',
    'Daily Visitors:': 'Visiteurs du jour :',
  },
  ar: {
    'Jobs': 'الوظائف',
    'About': 'من نحن',
    'Services': 'الخدمات',
    'Contact': 'اتصل بنا',
    'Candidate Login': 'دخول المرشحين',
    'Employer Login': 'دخول الشركات',
    'Your Job Search Ends Here': 'بحثك عن وظيفة ينتهي هنا',
    'Search Jobs': 'ابحث عن وظائف',
    'Latest Verified Jobs': 'أحدث الوظائف الموثقة',
    'Apply Now': 'قدّم الآن',
    'Share Job': 'مشاركة الوظيفة',
    'Details': 'التفاصيل',
    'Our Recruitment Services': 'خدمات التوظيف لدينا',
    'Company Hiring & Employer Desk': 'قسم الشركات وأصحاب العمل',
    'Post A Job': 'أعلن عن وظيفة',
    'Submit Resume': 'إرسال السيرة الذاتية',
    'Daily Visitors:': 'الزوار اليوميون:',
  },
};

function getLangCache(lang: string): Map<string, string> {
  let map = memoryCache.get(lang);
  if (map) return map;

  map = new Map<string, string>();
  const builtin = BUILTIN_DICTIONARY[lang];
  if (builtin) {
    for (const [k, v] of Object.entries(builtin)) {
      map.set(k, v);
    }
  }
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(`${TRANSLATION_CACHE_PREFIX}${lang}`);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, string>;
        for (const [k, v] of Object.entries(parsed || {})) {
          if (typeof v === 'string' && v.trim()) {
            map.set(k, v);
          }
        }
      }
    } catch {
      // Ignore corrupt cache entries
    }
  }
  memoryCache.set(lang, map);
  return map;
}

function persistLangCache(lang: string, map: Map<string, string>): void {
  if (typeof window === 'undefined') return;
  try {
    const entries = Array.from(map.entries()).slice(-600);
    window.localStorage.setItem(
      `${TRANSLATION_CACHE_PREFIX}${lang}`,
      JSON.stringify(Object.fromEntries(entries))
    );
  } catch {
    // Ignore storage quota errors
  }
}

export function getSavedLanguage(): string {
  if (typeof window === 'undefined') return 'en';
  try {
    const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (saved && SUPPORTED_LANGUAGES.some((l) => l.code === saved)) {
      return saved;
    }
  } catch {
    // Ignore storage errors
  }
  return 'en';
}

export function saveLanguagePreference(lang: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  } catch {
    // Ignore storage errors
  }
}

function shouldSkipElement(el: Element | null): boolean {
  if (!el) return true;
  const tag = el.tagName;
  if (
    tag === 'SCRIPT' ||
    tag === 'STYLE' ||
    tag === 'NOSCRIPT' ||
    tag === 'CODE' ||
    tag === 'PRE' ||
    tag === 'TEXTAREA' ||
    tag === 'INPUT' ||
    tag === 'SELECT' ||
    tag === 'OPTION'
  ) {
    return true;
  }
  if (el.closest('[data-no-translate="true"]')) {
    return true;
  }
  return false;
}

function isTranslatableText(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length < 2) return false;
  if (/^[\d\s.,:%+\-–—₹$€£/\\|·•()[\]{}]+$/.test(trimmed)) return false;
  if (/^https?:\/\//i.test(trimmed) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return false;
  }
  return /[a-zA-Z]/.test(trimmed);
}

function collectTextNodes(root: HTMLElement): Text[] {
  const result: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || shouldSkipElement(parent)) {
        return NodeFilter.FILTER_REJECT;
      }
      const val = node.nodeValue || '';
      if (!val.trim()) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let current = walker.nextNode();
  while (current) {
    result.push(current as Text);
    current = walker.nextNode();
  }
  return result;
}

function restoreOriginalText(): void {
  isApplying = true;
  try {
    for (const node of Array.from(trackedNodes)) {
      if (!node.isConnected) {
        trackedNodes.delete(node);
        continue;
      }
      const original = originalNodeText.get(node);
      if (typeof original === 'string' && node.nodeValue !== original) {
        node.nodeValue = original;
      }
    }
  } finally {
    isApplying = false;
  }
}

async function fetchBatchTranslations(
  targetLang: string,
  texts: string[]
): Promise<Record<string, string>> {
  const mapped: Record<string, string> = {};
  const chunkSize = 35;

  for (let i = 0; i < texts.length; i += chunkSize) {
    const chunk = texts.slice(i, i + chunkSize);
    try {
      const res = await fetch('/api/public/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetLang, texts: chunk }),
      });
      if (!res.ok) continue;
      const data = (await res.json()) as { translations?: string[] };
      if (Array.isArray(data.translations)) {
        chunk.forEach((src, idx) => {
          const translated = data.translations?.[idx];
          if (typeof translated === 'string' && translated.trim()) {
            mapped[src] = translated;
          }
        });
      }
    } catch {
      // Keep original text on transient translation errors
    }
  }

  return mapped;
}

async function translateRootNow(targetLang: string): Promise<void> {
  if (typeof document === 'undefined') return;
  const root = document.getElementById('root');
  if (!root) return;

  if (targetLang === 'en') {
    restoreOriginalText();
    return;
  }

  const cache = getLangCache(targetLang);
  const nodes = collectTextNodes(root);
  const missingSet = new Set<string>();
  const nodeMappings: Array<{ node: Text; orig: string; trimmed: string; leading: string; trailing: string }> = [];

  for (const node of nodes) {
    const currentValue = node.nodeValue ?? '';
    let orig = originalNodeText.get(node);
    if (orig === undefined) {
      if (!isTranslatableText(currentValue)) continue;
      orig = currentValue;
      originalNodeText.set(node, orig);
      trackedNodes.add(node);
    }

    const trimmed = orig.trim();
    if (!isTranslatableText(trimmed)) continue;

    const leadingMatch = orig.match(/^\s*/);
    const trailingMatch = orig.match(/\s*$/);
    const leading = leadingMatch ? leadingMatch[0] : '';
    const trailing = trailingMatch ? trailingMatch[0] : '';

    nodeMappings.push({ node, orig, trimmed, leading, trailing });

    if (!cache.has(trimmed)) {
      missingSet.add(trimmed);
    }
  }

  if (missingSet.size > 0) {
    const newlyTranslated = await fetchBatchTranslations(
      targetLang,
      Array.from(missingSet)
    );
    for (const [src, dest] of Object.entries(newlyTranslated)) {
      cache.set(src, dest);
    }
    persistLangCache(targetLang, cache);
  }

  if (activeLanguage !== targetLang) return;

  isApplying = true;
  try {
    for (const item of nodeMappings) {
      if (!item.node.isConnected) continue;
      const translated = cache.get(item.trimmed);
      if (translated) {
        const nextVal = `${item.leading}${translated}${item.trailing}`;
        if (item.node.nodeValue !== nextVal) {
          item.node.nodeValue = nextVal;
        }
      }
    }
  } finally {
    isApplying = false;
  }
}

function ensureObserver(): void {
  if (typeof document === 'undefined' || observer) return;
  const root = document.getElementById('root');
  if (!root) return;

  observer = new MutationObserver(() => {
    if (isApplying || activeLanguage === 'en') return;
    if (pendingTimer !== null) {
      window.clearTimeout(pendingTimer);
    }
    pendingTimer = window.setTimeout(() => {
      pendingTimer = null;
      if (activeLanguage !== 'en') {
        void translateRootNow(activeLanguage);
      }
    }, 220);
  });

  observer.observe(root, {
    childList: true,
    subtree: true,
  });
}

export async function applyWebsiteLanguage(lang: string): Promise<void> {
  activeLanguage = lang || 'en';
  saveLanguagePreference(activeLanguage);

  if (typeof document !== 'undefined') {
    document.documentElement.lang = activeLanguage;
    document.documentElement.dir =
      activeLanguage === 'ar' || activeLanguage === 'ur' ? 'rtl' : 'ltr';
  }

  if (activeLanguage === 'en') {
    if (pendingTimer !== null) {
      window.clearTimeout(pendingTimer);
      pendingTimer = null;
    }
    restoreOriginalText();
    return;
  }

  ensureObserver();
  await translateRootNow(activeLanguage);
}

export function stopLanguageObserver(): void {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
  if (pendingTimer !== null) {
    window.clearTimeout(pendingTimer);
    pendingTimer = null;
  }
}
