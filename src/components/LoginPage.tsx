import { FormEvent, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  LogIn,
  Mail,
  Smartphone,
  Unlock,
  User,
} from 'lucide-react';
import { signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { CandidateProfile, UserRole } from '../types/portal';
import {
  AccountStatusResponse,
  ApiRequestError,
  checkAccountStatus,
  loginCandidate,
  loginCandidateWithOtp,
  loginCandidateWithPin,
  loginWithGoogleToken,
  normalizeLoginIdentifier,
  resetCandidateCredentials,
  sendAuthOtp,
  setStoredToken,
  verifyAuthOtp,
} from '../utils/candidateApi';
import { syncUserProfileToFirestore } from '../utils/firestorePortal';
import { toFriendlyPortalError } from '../utils/jobHelpers';

interface LoginPageProps {
  portalRole?: UserRole;
  pendingJobTitle?: string | null;
  onSuccess: (candidate: CandidateProfile) => void;
  onGoToRegister: () => void;
  onBackHome: () => void;
}

type LoginTab = 'password' | 'pin' | 'otp';

export function LoginPage({
  portalRole = 'candidate',
  pendingJobTitle,
  onSuccess,
  onGoToRegister,
  onBackHome,
}: LoginPageProps) {
  const [activeTab, setActiveTab] = useState<LoginTab>('password');
  const [showResetFlow, setShowResetFlow] = useState(false);

  // Tab 1: Password Login
  const [pwdIdentifier, setPwdIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Tab 2: PIN Login
  const [pinIdentifier, setPinIdentifier] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);

  // Tab 3: OTP Login
  const [otpTarget, setOtpTarget] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSentForLogin, setOtpSentForLogin] = useState(false);
  const [otpLoginNotice, setOtpLoginNotice] = useState('');
  const [notRegisteredOnOtp, setNotRegisteredOnOtp] = useState(false);

  // Unlock Account Helper ("Stuck? Click here to Unlock Account")
  const [showUnlockFlow, setShowUnlockFlow] = useState(false);
  const [unlockIdentifier, setUnlockIdentifier] = useState('');
  const [unlockResult, setUnlockResult] = useState<AccountStatusResponse | null>(null);
  const [unlockChecked, setUnlockChecked] = useState(false);

  // Forgot / Reset Password + PIN (3-Step Flow)
  const [resetStep, setResetStep] = useState<1 | 2 | 3 | 4>(1);
  const [resetTarget, setResetTarget] = useState('');
  const [resetOtp, setResetOtp] = useState('');
  const [resetNotice, setResetNotice] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showNewPin, setShowNewPin] = useState(false);

  const [error, setError] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  const validatePortalAccess = (loggedInUser: CandidateProfile): boolean => {
    if (portalRole === 'admin' && loggedInUser.role !== 'admin') {
      setStoredToken(null);
      setError('Access Denied: Authorized Admin accounts only.');
      return false;
    }
    if (portalRole === 'employer' && loggedInUser.role !== 'employer') {
      setStoredToken(null);
      setError('Employer Login only. Please sign in with a registered Employer account.');
      return false;
    }
    if (portalRole === 'candidate' && loggedInUser.role === 'admin') {
      setStoredToken(null);
      setError('Access denied on Candidate Login. Please use your authorized login link.');
      return false;
    }
    if (portalRole === 'candidate' && loggedInUser.role === 'employer') {
      setStoredToken(null);
      setError('Employer accounts must sign in on the Employer Login page.');
      return false;
    }
    return true;
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setIsBusy(true);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const idToken = await cred.user.getIdToken();
      const { candidate } = await loginWithGoogleToken(idToken, portalRole);
      if (!validatePortalAccess(candidate)) {
        await signOut(auth).catch(() => {});
        return;
      }
      void syncUserProfileToFirestore(candidate).catch(() => {});
      onSuccess(candidate);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.toLowerCase().includes('popup-closed-by-user')) {
        setError('Sign-in was cancelled. Please try again.');
      } else {
        setError(toFriendlyPortalError(err, 'Something went wrong, please try again.'));
      }
    } finally {
      setIsBusy(false);
    }
  };

  const handlePasswordLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!pwdIdentifier.trim()) {
      setError('Please enter your Username, Email, or Mobile number.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }
    setIsBusy(true);
    try {
      const { candidate } = await loginCandidate(pwdIdentifier.trim(), password);
      if (validatePortalAccess(candidate)) {
        onSuccess(candidate);
      }
    } catch (err) {
      setError(
        toFriendlyPortalError(
          err,
          'Invalid credentials. Please check your details or register first.'
        )
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handlePinLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!pinIdentifier.trim()) {
      setError('Please enter your Username, Email, or Mobile number.');
      return;
    }
    if (!/^\d{4}$/.test(pin.trim())) {
      setError('Please enter your 4-digit PIN.');
      return;
    }
    setIsBusy(true);
    try {
      const { candidate } = await loginCandidateWithPin(pinIdentifier.trim(), pin.trim());
      if (validatePortalAccess(candidate)) {
        onSuccess(candidate);
      }
    } catch (err) {
      setError(toFriendlyPortalError(err, 'Invalid account or 4-digit PIN.'));
    } finally {
      setIsBusy(false);
    }
  };

  const handleSendLoginOtp = async (overrideTarget?: string) => {
    setError('');
    setOtpLoginNotice('');
    setNotRegisteredOnOtp(false);
    const targetToUse = normalizeLoginIdentifier(overrideTarget ?? otpTarget);
    if (!targetToUse) {
      setError('Please enter your registered Email or 10-digit Mobile number.');
      return;
    }
    setOtpTarget(targetToUse);
    setIsBusy(true);
    try {
      const res = await sendAuthOtp(targetToUse, 'login');
      setOtpSentForLogin(true);
      setOtpLoginNotice(
        `OTP sent to ${res.targetDisplay}. Verification Code: ${res.verificationCode}`
      );
    } catch (err) {
      if (err instanceof ApiRequestError && (err.status === 404 || err.code === 'NOT_REGISTERED')) {
        setNotRegisteredOnOtp(true);
        setOtpSentForLogin(false);
      }
      setError(toFriendlyPortalError(err, 'Unable to send OTP.'));
    } finally {
      setIsBusy(false);
    }
  };

  const handleOpenUnlockFlow = () => {
    try {
      window.localStorage.removeItem('vcs_candidate_register_draft_v1');
    } catch {
      // ignore
    }
    setStoredToken(null);
    const prefill = normalizeLoginIdentifier(otpTarget || pwdIdentifier || pinIdentifier || '');
    setUnlockIdentifier(prefill);
    setUnlockResult(null);
    setUnlockChecked(false);
    setError('');
    setNotRegisteredOnOtp(false);
    setShowUnlockFlow(true);
  };

  const handleUnlockCheckSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setUnlockResult(null);
    setUnlockChecked(false);
    const normalized = normalizeLoginIdentifier(unlockIdentifier);
    if (!normalized) {
      setError('Please enter your Email or Mobile number (+91 or 10-digit).');
      return;
    }
    setUnlockIdentifier(normalized);
    setIsBusy(true);
    try {
      const status = await checkAccountStatus({ identifier: normalized });
      setUnlockResult(status);
      setUnlockChecked(true);
    } catch (err) {
      setError(toFriendlyPortalError(err, 'Unable to check account.'));
    } finally {
      setIsBusy(false);
    }
  };

  const handleOtpLoginSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!otpSentForLogin) {
      await handleSendLoginOtp();
      return;
    }
    if (!/^\d{6}$/.test(otpCode.trim())) {
      setError('Please enter the 6-digit OTP.');
      return;
    }
    setIsBusy(true);
    try {
      const { candidate } = await loginCandidateWithOtp(otpTarget.trim(), otpCode.trim());
      if (validatePortalAccess(candidate)) {
        onSuccess(candidate);
      }
    } catch (err) {
      setError(toFriendlyPortalError(err, 'Invalid OTP.'));
    } finally {
      setIsBusy(false);
    }
  };

  // Forgot / Reset Handlers
  const handleResetStep1SendOtp = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setResetNotice('');
    if (!resetTarget.trim()) {
      setError('Please enter your registered Email or 10-digit Mobile number.');
      return;
    }
    setIsBusy(true);
    try {
      const res = await sendAuthOtp(resetTarget.trim(), 'reset');
      setResetNotice(
        `OTP sent to ${res.targetDisplay}. Verification Code: ${res.verificationCode}`
      );
      setResetStep(2);
    } catch (err) {
      setError(toFriendlyPortalError(err, 'Account not found.'));
    } finally {
      setIsBusy(false);
    }
  };

  const handleResetStep2VerifyOtp = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!/^\d{6}$/.test(resetOtp.trim())) {
      setError('Please enter the 6-digit OTP.');
      return;
    }
    setIsBusy(true);
    try {
      await verifyAuthOtp(resetTarget.trim(), resetOtp.trim(), 'reset');
      setResetNotice('OTP verified! Please set your new Password and 4-Digit PIN below.');
      setResetStep(3);
    } catch (err) {
      setError(toFriendlyPortalError(err, 'Incorrect OTP.'));
    } finally {
      setIsBusy(false);
    }
  };

  const handleResetStep3Save = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError('New password and Confirm password do not match.');
      return;
    }
    if (!/^\d{4}$/.test(newPin)) {
      setError('New PIN must be exactly 4 digits.');
      return;
    }
    if (newPin !== confirmNewPin) {
      setError('New PIN and Confirm PIN do not match.');
      return;
    }
    setIsBusy(true);
    try {
      await resetCandidateCredentials({
        target: resetTarget.trim(),
        otp: resetOtp.trim(),
        newPassword,
        newPin,
      });
      setResetStep(4);
    } catch (err) {
      setError(toFriendlyPortalError(err, 'Unable to reset credentials.'));
    } finally {
      setIsBusy(false);
    }
  };

  const exitResetToLogin = () => {
    setShowResetFlow(false);
    setResetStep(1);
    setResetTarget('');
    setResetOtp('');
    setResetNotice('');
    setNewPassword('');
    setConfirmNewPassword('');
    setNewPin('');
    setConfirmNewPin('');
    setError('');
  };

  return (
    <div className="bg-gradient-to-br from-slate-100 via-[#F4F7FB] to-[#E6EEF8] min-h-[calc(100vh-5rem)] border-b border-slate-200">
      <div className="grid grid-cols-3 h-1 w-full" aria-hidden="true">
        <div className="bg-[#063B7A]" />
        <div className="bg-[#F58220]" />
        <div className="bg-[#0A8E43]" />
      </div>

      <div className="max-w-lg mx-auto px-4 sm:px-6 py-8 sm:py-14">
        <button
          type="button"
          onClick={showResetFlow ? exitResetToLogin : onBackHome}
          className="inline-flex items-center gap-2 min-h-[44px] px-3.5 py-2 rounded-xl bg-white border border-slate-200 shadow-xs text-sm font-semibold text-[#063B7A] hover:text-[#D96B0C] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>
            {showResetFlow
              ? portalRole === 'employer'
                ? 'Back to Employer Login'
                : portalRole === 'admin'
                  ? 'Back to Admin Login'
                  : 'Back to Candidate Login'
              : 'Back to Home'}
          </span>
        </button>

        <div className="mt-5 bg-white border border-slate-200/90 rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-[#063B7A] to-[#042A58] px-5 sm:px-8 py-6 text-white">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs sm:text-sm font-semibold text-[#F58220]">
                Vardhman Consultancy Services · Est. 2012
              </p>
              <p className="text-[11px] sm:text-xs text-slate-200 whitespace-nowrap">
                info@vardhmanconsultancy.com | Mobile &amp; WhatsApp: 7877250630
              </p>
            </div>

            <h1 className="mt-1.5 font-display text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {showResetFlow
                ? 'Forgot / Reset Password + PIN'
                : portalRole === 'employer'
                  ? 'Employer Login'
                  : portalRole === 'admin'
                    ? 'Admin Login'
                    : 'Candidate Login'}
            </h1>
            <p className="mt-2 text-sm text-slate-200 leading-relaxed">
              {showResetFlow
                ? 'Verify your registered Email or Mobile via OTP to set a new Password and 4-Digit PIN.'
                : portalRole === 'employer'
                  ? 'Sign in to your Employer Dashboard to submit confidential job mandates & complete JDs.'
                  : portalRole === 'admin'
                    ? 'Admin Login - Owner Only.'
                    : pendingJobTitle
                      ? `Sign in to continue applying for "${pendingJobTitle}".`
                      : 'Sign in with Password, PIN, or OTP to access your Candidate Dashboard and My Applications.'}
            </p>
          </div>

          <div className="p-5 sm:p-8">
            {showUnlockFlow ? (
              /* UNLOCK ACCOUNT RECOVERY FLOW */
              <div className="space-y-5">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-1.5">
                  <h2 className="font-display text-base font-bold text-[#063B7A] flex items-center gap-2">
                    <Unlock className="w-4 h-4 text-[#0A8E43]" aria-hidden="true" />
                    <span>Unlock Account &amp; Clear Stuck Session</span>
                  </h2>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Temporary registration drafts have been cleared. Enter your 10-digit mobile number (or +91) or email address to verify your account status.
                  </p>
                </div>

                <form onSubmit={handleUnlockCheckSubmit} className="space-y-4">
                  <div>
                    <label
                      htmlFor="unlock-id"
                      className="block text-xs font-semibold text-[#063B7A] mb-1.5"
                    >
                      Mobile Number or Email *
                    </label>
                    <input
                      id="unlock-id"
                      type="text"
                      value={unlockIdentifier}
                      onChange={(e) => setUnlockIdentifier(e.target.value)}
                      placeholder="e.g. 9982100966 or +91-9982100966 or email"
                      className="w-full min-h-[46px] px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#063B7A] focus:outline-none"
                    />
                  </div>

                  {error && (
                    <p className="text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3" role="alert">
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={isBusy}
                    className="w-full min-h-[48px] px-6 py-3 rounded-xl bg-gradient-to-r from-[#063B7A] to-[#042A58] text-white font-semibold text-sm shadow-md cursor-pointer"
                  >
                    {isBusy ? 'Checking Account...' : 'Check & Unlock Account'}
                  </button>
                </form>

                {unlockChecked && unlockResult && (
                  <div
                    className={`rounded-xl p-4 border space-y-3 ${
                      unlockResult.exists
                        ? 'bg-[#0A8E43]/8 border-[#0A8E43]/35'
                        : 'bg-amber-50 border-amber-200'
                    }`}
                  >
                    {unlockResult.exists ? (
                      <>
                        <p className="text-xs sm:text-sm font-semibold text-[#0A8E43]">
                          Account Found! Registered Mobile: {unlockResult.normalizedPhone} ({unlockResult.normalizedEmail})
                        </p>
                        <div className="flex flex-col sm:flex-row gap-2.5">
                          <button
                            type="button"
                            onClick={() => {
                              const target = unlockResult.normalizedPhone || unlockResult.normalizedEmail || unlockIdentifier;
                              setShowUnlockFlow(false);
                              setActiveTab('otp');
                              setOtpTarget(target);
                              void handleSendLoginOtp(target);
                            }}
                            className="flex-1 min-h-[44px] px-4 py-2 rounded-xl bg-[#0A8E43] hover:bg-[#087537] text-white text-xs sm:text-sm font-semibold cursor-pointer"
                          >
                            Send OTP &amp; Login Now
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const target = unlockResult.normalizedPhone || unlockResult.normalizedEmail || unlockIdentifier;
                              setShowUnlockFlow(false);
                              setResetTarget(target);
                              setResetStep(1);
                              setShowResetFlow(true);
                            }}
                            className="flex-1 min-h-[44px] px-4 py-2 rounded-xl border border-[#063B7A] text-[#063B7A] hover:bg-white text-xs sm:text-sm font-semibold cursor-pointer"
                          >
                            Reset Password / PIN
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="text-xs sm:text-sm font-semibold text-slate-800">
                          No registered account found for this Mobile or Email. Your form cache is unlocked — register fresh now.
                        </p>
                        <button
                          type="button"
                          onClick={onGoToRegister}
                          className="w-full min-h-[44px] px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#F58220] to-[#D96B0C] text-white text-sm font-semibold cursor-pointer"
                        >
                          Register Now
                        </button>
                      </>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setShowUnlockFlow(false);
                    setError('');
                  }}
                  className="w-full min-h-[42px] px-4 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold text-[#063B7A] hover:bg-slate-50 cursor-pointer"
                >
                  Back to Login Tabs
                </button>
              </div>
            ) : showResetFlow ? (
              /* FORGOT / RESET PASSWORD + PIN (3 STEPS + SUCCESS) */
              <div className="space-y-5">
                {resetStep < 4 && (
                  <div className="flex items-center justify-between text-xs font-semibold text-[#063B7A] bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5">
                    <span>Reset Step {resetStep} of 3</span>
                    <span className="text-[#0A8E43]">
                      {resetStep === 1
                        ? 'Send OTP'
                        : resetStep === 2
                          ? 'Verify OTP'
                          : 'Set New Password & PIN'}
                    </span>
                  </div>
                )}

                {resetStep === 1 && (
                  <form onSubmit={handleResetStep1SendOtp} className="space-y-4">
                    <div>
                      <label
                        htmlFor="reset-target"
                        className="block text-xs font-semibold text-[#063B7A] mb-1.5"
                      >
                        Registered Email / Mobile *
                      </label>
                      <div className="relative flex items-center">
                        <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" aria-hidden="true" />
                        <input
                          id="reset-target"
                          type="text"
                          value={resetTarget}
                          onChange={(e) => setResetTarget(e.target.value)}
                          placeholder="Enter registered email or 10-digit mobile"
                          className="w-full min-h-[46px] pl-10 pr-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#063B7A] focus:outline-none"
                        />
                      </div>
                    </div>

                    {error && (
                      <p className="text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3" role="alert">
                        {error}
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={isBusy}
                      className="w-full min-h-[48px] px-6 py-3 rounded-xl bg-gradient-to-r from-[#063B7A] to-[#042A58] text-white font-semibold text-sm shadow-md cursor-pointer"
                    >
                      {isBusy ? 'Sending OTP...' : 'Send OTP'}
                    </button>
                  </form>
                )}

                {resetStep === 2 && (
                  <form onSubmit={handleResetStep2VerifyOtp} className="space-y-4">
                    {resetNotice && (
                      <p className="text-xs sm:text-sm font-semibold text-[#0A8E43] bg-[#0A8E43]/10 border border-[#0A8E43]/25 rounded-xl px-4 py-3">
                        {resetNotice}
                      </p>
                    )}

                    <div>
                      <label
                        htmlFor="reset-otp"
                        className="block text-xs font-semibold text-[#063B7A] mb-1.5"
                      >
                        Enter 6-Digit OTP *
                      </label>
                      <input
                        id="reset-otp"
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={resetOtp}
                        onChange={(e) =>
                          setResetOtp(e.target.value.replace(/\D/g, '').slice(0, 6))
                        }
                        placeholder="Enter 6-digit OTP"
                        className="w-full min-h-[46px] px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#063B7A] focus:outline-none tabular-nums"
                      />
                    </div>

                    {error && (
                      <p className="text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3" role="alert">
                        {error}
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={isBusy}
                      className="w-full min-h-[48px] px-6 py-3 rounded-xl bg-[#0A8E43] hover:bg-[#087537] text-white font-semibold text-sm shadow-md cursor-pointer"
                    >
                      {isBusy ? 'Verifying...' : 'Verify OTP'}
                    </button>
                  </form>
                )}

                {resetStep === 3 && (
                  <form onSubmit={handleResetStep3Save} className="space-y-4">
                    {resetNotice && (
                      <p className="text-xs sm:text-sm font-semibold text-[#0A8E43] bg-[#0A8E43]/10 border border-[#0A8E43]/25 rounded-xl px-4 py-3">
                        {resetNotice}
                      </p>
                    )}

                    <div>
                      <label
                        htmlFor="reset-new-pwd"
                        className="block text-xs font-semibold text-[#063B7A] mb-1.5"
                      >
                        Create New Password (Min 6) *
                      </label>
                      <div className="relative flex items-center">
                        <input
                          id="reset-new-pwd"
                          type={showNewPassword ? 'text' : 'password'}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Minimum 6 characters"
                          className="w-full min-h-[46px] pl-3.5 pr-11 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#063B7A] focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword((p) => !p)}
                          aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                          className="absolute right-1 w-10 h-10 flex items-center justify-center text-slate-500 cursor-pointer"
                        >
                          {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="reset-confirm-pwd"
                        className="block text-xs font-semibold text-[#063B7A] mb-1.5"
                      >
                        Confirm New Password *
                      </label>
                      <input
                        id="reset-confirm-pwd"
                        type={showNewPassword ? 'text' : 'password'}
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        placeholder="Re-enter new password"
                        className="w-full min-h-[46px] px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#063B7A] focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label
                          htmlFor="reset-new-pin"
                          className="block text-xs font-semibold text-[#063B7A] mb-1.5"
                        >
                          Create New PIN (4-Digit) *
                        </label>
                        <div className="relative flex items-center">
                          <input
                            id="reset-new-pin"
                            type={showNewPin ? 'text' : 'password'}
                            inputMode="numeric"
                            maxLength={4}
                            value={newPin}
                            onChange={(e) =>
                              setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))
                            }
                            placeholder="4-digit PIN"
                            className="w-full min-h-[46px] pl-3.5 pr-11 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#063B7A] focus:outline-none tabular-nums"
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewPin((p) => !p)}
                            aria-label={showNewPin ? 'Hide PIN' : 'Show PIN'}
                            className="absolute right-1 w-10 h-10 flex items-center justify-center text-slate-500 cursor-pointer"
                          >
                            {showNewPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label
                          htmlFor="reset-confirm-pin"
                          className="block text-xs font-semibold text-[#063B7A] mb-1.5"
                        >
                          Confirm New PIN *
                        </label>
                        <input
                          id="reset-confirm-pin"
                          type={showNewPin ? 'text' : 'password'}
                          inputMode="numeric"
                          maxLength={4}
                          value={confirmNewPin}
                          onChange={(e) =>
                            setConfirmNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))
                          }
                          placeholder="Confirm 4-digit PIN"
                          className="w-full min-h-[46px] px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#063B7A] focus:outline-none tabular-nums"
                        />
                      </div>
                    </div>

                    {error && (
                      <p className="text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3" role="alert">
                        {error}
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={isBusy}
                      className="w-full min-h-[48px] px-6 py-3 rounded-xl bg-gradient-to-r from-[#063B7A] to-[#042A58] text-white font-semibold text-sm shadow-md cursor-pointer"
                    >
                      {isBusy ? 'Saving...' : 'Reset Password & PIN'}
                    </button>
                  </form>
                )}

                {resetStep === 4 && (
                  <div className="text-center space-y-5 py-4">
                    <div className="w-16 h-16 mx-auto rounded-full bg-[#0A8E43]/12 text-[#0A8E43] flex items-center justify-center">
                      <CheckCircle2 className="w-9 h-9" aria-hidden="true" />
                    </div>
                    <div>
                      <h2 className="font-display text-xl font-bold text-[#063B7A]">
                        Password &amp; PIN Updated Successfully
                      </h2>
                      <p className="mt-1.5 text-sm text-slate-600">
                        You can now sign in using your updated Password or 4-Digit PIN.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={exitResetToLogin}
                      className="w-full min-h-[48px] px-6 py-3 rounded-xl bg-gradient-to-r from-[#063B7A] to-[#042A58] text-white font-semibold text-sm shadow-md cursor-pointer"
                    >
                      Go To Login
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* WORLD-CLASS CANDIDATE LOGIN (3 TABS) */
              <div className="space-y-5">
                <div
                  className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl"
                  role="tablist"
                  aria-label="Login Method"
                >
                  {(
                    [
                      { id: 'password', label: 'Password' },
                      { id: 'pin', label: 'PIN Login' },
                      { id: 'otp', label: 'OTP Login' },
                    ] as const
                  ).map((tab) => {
                    const active = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => {
                          setActiveTab(tab.id);
                          setError('');
                          setNotRegisteredOnOtp(false);
                        }}
                        className={`min-h-[40px] px-2.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
                          active
                            ? 'bg-white text-[#063B7A] shadow-sm'
                            : 'text-slate-600 hover:text-[#063B7A]'
                        }`}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                {/* TAB 1: PASSWORD LOGIN */}
                {activeTab === 'password' && (
                  <form onSubmit={handlePasswordLogin} className="space-y-4" noValidate>
                    <div>
                      <label
                        htmlFor="login-pwd-id"
                        className="block text-xs font-semibold text-[#063B7A] mb-1.5"
                      >
                        Username / Email / Mobile
                      </label>
                      <div className="relative flex items-center">
                        <User className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" aria-hidden="true" />
                        <input
                          id="login-pwd-id"
                          type="text"
                          value={pwdIdentifier}
                          onChange={(e) => setPwdIdentifier(e.target.value)}
                          placeholder="Enter username, email, or 10-digit mobile"
                          className="w-full min-h-[46px] pl-10 pr-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#063B7A] focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="login-password"
                        className="block text-xs font-semibold text-[#063B7A] mb-1.5"
                      >
                        Password
                      </label>
                      <div className="relative flex items-center">
                        <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" aria-hidden="true" />
                        <input
                          id="login-password"
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Enter your password"
                          className="w-full min-h-[46px] pl-10 pr-11 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#063B7A] focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((prev) => !prev)}
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                          className="absolute right-1 w-10 h-10 flex items-center justify-center text-slate-500 hover:text-[#063B7A] rounded-lg cursor-pointer"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {error && (
                      <p className="text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3" role="alert">
                        {error}
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={isBusy}
                      className="w-full min-h-[48px] px-6 py-3 rounded-xl bg-[#0A8E43] hover:bg-[#087537] disabled:opacity-60 text-white font-bold text-sm inline-flex items-center justify-center gap-2 shadow-sm cursor-pointer transition-colors"
                    >
                      <LogIn className="w-4 h-4" aria-hidden="true" />
                      <span>{isBusy ? 'Signing In...' : 'Login'}</span>
                    </button>
                  </form>
                )}

                {/* TAB 2: 4-DIGIT PIN LOGIN */}
                {activeTab === 'pin' && (
                  <form onSubmit={handlePinLogin} className="space-y-4" noValidate>
                    <div>
                      <label
                        htmlFor="login-pin-id"
                        className="block text-xs font-semibold text-[#063B7A] mb-1.5"
                      >
                        Username / Email / Mobile
                      </label>
                      <div className="relative flex items-center">
                        <User className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" aria-hidden="true" />
                        <input
                          id="login-pin-id"
                          type="text"
                          value={pinIdentifier}
                          onChange={(e) => setPinIdentifier(e.target.value)}
                          placeholder="Enter username, email, or 10-digit mobile"
                          className="w-full min-h-[46px] pl-10 pr-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#063B7A] focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="login-pin-code"
                        className="block text-xs font-semibold text-[#063B7A] mb-1.5"
                      >
                        4-Digit PIN
                      </label>
                      <div className="relative flex items-center">
                        <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" aria-hidden="true" />
                        <input
                          id="login-pin-code"
                          type={showPin ? 'text' : 'password'}
                          inputMode="numeric"
                          maxLength={4}
                          value={pin}
                          onChange={(e) =>
                            setPin(e.target.value.replace(/\D/g, '').slice(0, 4))
                          }
                          placeholder="Enter 4-digit PIN"
                          className="w-full min-h-[46px] pl-10 pr-11 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#063B7A] focus:outline-none tabular-nums"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPin((prev) => !prev)}
                          aria-label={showPin ? 'Hide PIN' : 'Show PIN'}
                          className="absolute right-1 w-10 h-10 flex items-center justify-center text-slate-500 hover:text-[#063B7A] rounded-lg cursor-pointer"
                        >
                          {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {error && (
                      <p className="text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3" role="alert">
                        {error}
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={isBusy}
                      className="w-full min-h-[48px] px-6 py-3 rounded-xl bg-[#0A8E43] hover:bg-[#087537] disabled:opacity-60 text-white font-bold text-sm inline-flex items-center justify-center gap-2 shadow-sm cursor-pointer transition-colors"
                    >
                      <LogIn className="w-4 h-4" aria-hidden="true" />
                      <span>{isBusy ? 'Signing In...' : 'Login'}</span>
                    </button>
                  </form>
                )}

                {/* TAB 3: OTP LOGIN */}
                {activeTab === 'otp' && (
                  <form onSubmit={handleOtpLoginSubmit} className="space-y-4" noValidate>
                    <div>
                      <label
                        htmlFor="login-otp-target"
                        className="block text-xs font-semibold text-[#063B7A] mb-1.5"
                      >
                        Email / Mobile
                      </label>
                      <div className="flex flex-col sm:flex-row gap-2.5">
                        <div className="relative flex items-center flex-1">
                          <Smartphone className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" aria-hidden="true" />
                          <input
                            id="login-otp-target"
                            type="text"
                            value={otpTarget}
                            onChange={(e) => {
                              setOtpTarget(e.target.value);
                              setNotRegisteredOnOtp(false);
                            }}
                            placeholder="Registered email or 10-digit mobile"
                            className="w-full min-h-[46px] pl-10 pr-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#063B7A] focus:outline-none"
                          />
                        </div>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleSendLoginOtp()}
                          className="min-h-[46px] px-4 py-2.5 rounded-xl bg-[#063B7A] hover:bg-[#042A58] text-white text-xs sm:text-sm font-semibold whitespace-nowrap cursor-pointer"
                        >
                          {otpSentForLogin ? 'Resend OTP' : 'Send OTP'}
                        </button>
                      </div>
                    </div>

                    {otpLoginNotice && (
                      <p className="text-xs sm:text-sm font-semibold text-[#0A8E43] bg-[#0A8E43]/10 border border-[#0A8E43]/25 rounded-xl px-4 py-3">
                        {otpLoginNotice}
                      </p>
                    )}

                    {notRegisteredOnOtp && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2.5">
                        <p className="text-xs sm:text-sm font-semibold text-slate-800">
                          {error || 'No registered account found with this email or mobile number.'}
                        </p>
                        <button
                          type="button"
                          onClick={onGoToRegister}
                          className="w-full min-h-[44px] px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#F58220] to-[#D96B0C] hover:from-[#D96B0C] hover:to-[#BF5A06] text-white text-sm font-semibold shadow-sm cursor-pointer"
                        >
                          Register Now
                        </button>
                      </div>
                    )}

                    <div>
                      <label
                        htmlFor="login-otp-code"
                        className="block text-xs font-semibold text-[#063B7A] mb-1.5"
                      >
                        Enter OTP
                      </label>
                      <input
                        id="login-otp-code"
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={otpCode}
                        onChange={(e) =>
                          setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                        }
                        placeholder="Enter 6-digit OTP"
                        className="w-full min-h-[46px] px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#063B7A] focus:outline-none tabular-nums"
                      />
                    </div>

                    {error && !notRegisteredOnOtp && (
                      <p className="text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3" role="alert">
                        {error}
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={isBusy}
                      className="w-full min-h-[48px] px-6 py-3 rounded-xl bg-gradient-to-r from-[#0A8E43] to-[#087537] hover:from-[#087537] hover:to-[#065E2C] disabled:opacity-60 text-white font-semibold text-sm inline-flex items-center justify-center gap-2 shadow-md cursor-pointer"
                    >
                      <LogIn className="w-4 h-4" aria-hidden="true" />
                      <span>{isBusy ? 'Verifying...' : 'Verify & Login'}</span>
                    </button>
                  </form>
                )}

                {/* Verified Google Sign-In Option */}
                <div className="pt-2">
                  <div className="relative flex py-2 items-center">
                    <div className="flex-grow border-t border-slate-200" />
                    <span className="shrink mx-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Or Quick Sign In
                    </span>
                    <div className="flex-grow border-t border-slate-200" />
                  </div>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={handleGoogleSignIn}
                    className="w-full min-h-[46px] px-5 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-sm font-semibold inline-flex items-center justify-center gap-2.5 shadow-xs transition-colors cursor-pointer disabled:opacity-60"
                  >
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        fill="#4285F4"
                        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                      />
                    </svg>
                    <span>Continue with Google</span>
                  </button>
                </div>

                {/* Forgot Password / PIN + New Registration + Unlock Account */}
                <div className="pt-4 border-t border-slate-200 space-y-3.5 text-center text-sm text-slate-600">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5">
                    <p className="text-xs sm:text-sm font-semibold text-slate-700">
                      {portalRole === 'employer'
                        ? 'New Employer on Vardhman Consultancy?'
                        : portalRole === 'admin'
                          ? 'Authorized Owner Setup?'
                          : 'New Job Seeker? Create Your Free Account'}
                    </p>
                    <button
                      type="button"
                      onClick={onGoToRegister}
                      className="w-full min-h-[44px] px-5 py-2.5 rounded-xl bg-white border-2 border-[#0A8E43] text-[#0A8E43] hover:bg-[#0A8E43] hover:text-white text-sm font-bold transition-colors cursor-pointer"
                    >
                      {portalRole === 'employer'
                        ? 'Register Employer Account'
                        : portalRole === 'admin'
                          ? 'Admin Register'
                          : 'Register & Upload Resume'}
                    </button>
                  </div>

                  <p>
                    Forgot Password / PIN?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setShowResetFlow(true);
                        setError('');
                        setNotRegisteredOnOtp(false);
                      }}
                      className="font-semibold text-[#063B7A] hover:text-[#0A8E43] underline cursor-pointer"
                    >
                      Reset Via OTP
                    </button>
                  </p>

                  <div>
                    <button
                      type="button"
                      onClick={handleOpenUnlockFlow}
                      className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-[#063B7A] hover:text-[#0A8E43] bg-slate-100 hover:bg-slate-200/70 px-3.5 py-2 rounded-lg transition-colors cursor-pointer"
                    >
                      <Unlock className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Stuck? Click here to Unlock Account</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
