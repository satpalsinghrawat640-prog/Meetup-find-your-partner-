import React, { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import {
  ArrowLeft,
  BadgeCheck,
  Bell,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Crown,
  ExternalLink,
  Gem,
  Loader2,
  Sparkles,
  Tag,
  Upload,
  XCircle
} from 'lucide-react';
import { db } from '../lib/firebase';
import { MEMBERSHIP_BENEFITS } from '../lib/constants';
import {
  AppNotification,
  CouponCode,
  MembershipPlan,
  PaymentConfig,
  PaymentRequest,
  UserProfile,
  VerificationRequest
} from '../types/igmeet';
import {
  markAllNotificationsRead,
  submitMembershipPaymentRequest,
  submitVerificationApplication,
  uploadToFirebaseStorage,
  validateCouponForPlan
} from '../services/igmeetService';

interface MembershipUpgradeProps {
  me: UserProfile;
  plans: MembershipPlan[];
  paymentConfig: PaymentConfig;
  onBack: () => void;
  onToast: (msg: string, tone?: 'success' | 'error' | 'info') => void;
}

export function MembershipUpgradeFlow({
  me,
  plans,
  paymentConfig,
  onBack,
  onToast
}: MembershipUpgradeProps) {
  const [step, setStep] = useState<'plans' | 'confirm' | 'pay' | 'submitted'>('plans');
  const [selectedPlan, setSelectedPlan] = useState<MembershipPlan | null>(null);
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);

  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<CouponCode | null>(null);
  const [couponError, setCouponError] = useState('');
  const [checkingCoupon, setCheckingCoupon] = useState(false);

  const [qrDataUrl, setQrDataUrl] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [utrReference, setUtrReference] = useState('');
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [myRequests, setMyRequests] = useState<PaymentRequest[]>([]);

  const activePlans = useMemo(() => plans.filter((p) => p.enabled), [plans]);

  const loadMyRequests = async () => {
    try {
      const snap = await getDocs(
        query(collection(db, 'paymentRequests'), where('uid', '==', me.uid), limit(20))
      );
      setMyRequests(
        snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<PaymentRequest, 'id'>) }))
          .sort((a, b) => b.createdAt - a.createdAt)
      );
    } catch {
      setMyRequests([]);
    }
  };

  useEffect(() => {
    loadMyRequests();
  }, [me.uid]);

  const pricing = useMemo(() => {
    const base = selectedPlan?.priceInr || 0;
    const discount = appliedCoupon ? Math.round((base * appliedCoupon.discountPercent) / 100) : 0;
    const finalAmount = Math.max(1, base - discount);
    return { base, discount, finalAmount };
  }, [selectedPlan, appliedCoupon]);

  const upiLink = useMemo(() => {
    const pa = encodeURIComponent(paymentConfig.upiId.trim());
    const pn = encodeURIComponent(paymentConfig.merchantName.trim() || 'IG Meet');
    const am = encodeURIComponent(String(pricing.finalAmount));
    return `upi://pay?pa=${pa}&pn=${pn}&am=${am}&cu=INR`;
  }, [paymentConfig, pricing.finalAmount]);

  useEffect(() => {
    if (step === 'pay' && selectedPlan) {
      QRCode.toDataURL(upiLink, { width: 240, margin: 2 })
        .then(setQrDataUrl)
        .catch(() => setQrDataUrl(''));
    }
  }, [step, selectedPlan, upiLink]);

  const handleApplyCoupon = async () => {
    if (!selectedPlan) return;
    setCouponError('');
    setCheckingCoupon(true);
    try {
      const valid = await validateCouponForPlan(couponInput, selectedPlan.tier);
      setAppliedCoupon(valid);
      onToast(`Coupon ${valid.code} applied (${valid.discountPercent}% off).`, 'success');
    } catch (err: unknown) {
      setAppliedCoupon(null);
      setCouponError(err instanceof Error ? err.message : 'Invalid coupon code.');
    } finally {
      setCheckingCoupon(false);
    }
  };

  const handleCopyUpi = async () => {
    try {
      await navigator.clipboard.writeText(paymentConfig.upiId);
      onToast('UPI ID copied to clipboard.', 'success');
    } catch {
      onToast('Copy failed. Please copy the UPI ID manually.', 'error');
    }
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlan) return;
    if (!screenshotFile) {
      onToast('Please upload your UPI payment screenshot.', 'error');
      return;
    }
    if (!whatsappNumber.trim() || whatsappNumber.replace(/[^0-9]/g, '').length < 10) {
      onToast('Please enter a valid 10-digit WhatsApp number.', 'error');
      return;
    }
    if (!utrReference.trim() || utrReference.trim().length < 6) {
      onToast('Please enter your UPI UTR / Transaction Reference ID.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const screenshotUrl = await uploadToFirebaseStorage(
        `paymentScreenshots/${me.uid}/${Date.now()}_${screenshotFile.name}`,
        screenshotFile
      );

      await submitMembershipPaymentRequest(
        {
          uid: me.uid,
          userName: me.fullName,
          userEmail: me.email,
          planId: selectedPlan.id,
          planTier: selectedPlan.tier,
          planName: selectedPlan.name,
          validityDays: selectedPlan.validityDays,
          originalAmount: pricing.base,
          discountAmount: pricing.discount,
          finalAmount: pricing.finalAmount,
          couponCode: appliedCoupon?.code || '',
          whatsappNumber: whatsappNumber.trim(),
          utrReference: utrReference.trim(),
          screenshotUrl
        },
        appliedCoupon?.id
      );

      await loadMyRequests();
      setStep('submitted');
    } catch (err: unknown) {
      onToast(err instanceof Error ? err.message : 'Unable to submit payment request.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#FFF8FA] dark:bg-[#140E12]">
      <header className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-[#1B1318] border-b border-pink-100 dark:border-white/10">
        <button
          type="button"
          onClick={() => {
            if (step === 'plans' || step === 'submitted') onBack();
            else if (step === 'confirm') setStep('plans');
            else if (step === 'pay') setStep('confirm');
          }}
          className="p-1.5 rounded-xl hover:bg-pink-50 dark:hover:bg-white/5"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-extrabold">IG Meet Upgrade</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5 pb-12">
        {step === 'plans' && (
          <>
            <div className="rounded-3xl p-5 bg-gradient-to-br from-[#FF2D78] to-[#E91E4D] text-white space-y-1.5 shadow-md">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-200" />
                <span className="text-xs font-bold uppercase tracking-wider">Premium Access</span>
              </div>
              <h2 className="text-xl font-extrabold">Upgrade Your IG Meet Experience</h2>
              <p className="text-xs text-white/90">
                Current Plan: <strong className="uppercase">{me.membershipTier}</strong>
                {me.membershipExpiresAt && me.membershipExpiresAt > Date.now()
                  ? ` (Active until ${new Date(me.membershipExpiresAt).toLocaleDateString()})`
                  : ''}
              </p>
            </div>

            {/* Side-by-side plan comparison */}
            <div className="grid grid-cols-2 gap-3">
              {activePlans.map((plan) => {
                const isElite = plan.tier === 'elite';
                const expanded = expandedPlanId === plan.id;
                const benefits = plan.benefits?.length ? plan.benefits : MEMBERSHIP_BENEFITS;
                const shown = expanded ? benefits : benefits.slice(0, 3);
                return (
                  <div
                    key={plan.id}
                    className={`rounded-3xl p-3.5 flex flex-col justify-between border ${
                      isElite
                        ? 'bg-gradient-to-b from-amber-50 to-white dark:from-amber-950/30 dark:to-[#1C1419] border-amber-300 dark:border-amber-500/40'
                        : 'bg-white dark:bg-[#1C1419] border-pink-200 dark:border-pink-500/30'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                            isElite ? 'bg-amber-500/15 text-amber-500' : 'bg-pink-500/15 text-[#FF2D78]'
                          }`}
                        >
                          {isElite ? <Crown className="w-5 h-5" /> : <Gem className="w-5 h-5" />}
                        </div>
                        <span className="text-[10px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded-lg bg-black/5 dark:bg-white/10">
                          {plan.validityDays} Days
                        </span>
                      </div>

                      <div>
                        <h3 className="text-sm font-extrabold">{plan.name}</h3>
                        <p className="text-2xl font-black tabular-nums mt-0.5">
                          ₹{plan.priceInr}
                        </p>
                      </div>

                      <ul className="space-y-1.5">
                        {shown.map((b) => (
                          <li key={b} className="flex items-start gap-1.5 text-[11px] leading-snug">
                            <Check className="w-3.5 h-3.5 text-[#FF2D78] shrink-0 mt-0.5" />
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>

                      {benefits.length > 3 && (
                        <button
                          type="button"
                          onClick={() => setExpandedPlanId(expanded ? null : plan.id)}
                          className="text-[11px] font-bold text-[#FF2D78]"
                        >
                          {expanded ? 'Show Less' : 'See All'}
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPlan(plan);
                        setAppliedCoupon(null);
                        setCouponInput('');
                        setCouponError('');
                        setStep('confirm');
                      }}
                      className={`mt-4 w-full py-2.5 rounded-2xl text-xs font-extrabold text-white ${
                        isElite
                          ? 'bg-gradient-to-r from-amber-500 to-orange-600'
                          : 'bg-gradient-to-r from-[#FF2D78] to-[#E91E4D]'
                      }`}
                    >
                      Select Plan
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Previous Payment Requests */}
            {myRequests.length > 0 && (
              <div className="space-y-2.5">
                <h3 className="text-sm font-extrabold">Your Payment Requests</h3>
                {myRequests.map((req) => (
                  <div
                    key={req.id}
                    className="rounded-2xl bg-white dark:bg-[#1C1419] border border-pink-100 dark:border-white/10 p-3.5 space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-extrabold">
                        {req.planName} &middot; ₹{req.finalAmount}
                      </p>
                      <span
                        className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-lg ${
                          req.status === 'approved'
                            ? 'bg-emerald-500/15 text-emerald-600'
                            : req.status === 'rejected'
                            ? 'bg-red-500/15 text-red-600'
                            : 'bg-amber-500/15 text-amber-600'
                        }`}
                      >
                        {req.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#6E5A63] dark:text-neutral-400">
                      UTR: {req.utrReference} &middot; {new Date(req.createdAt).toLocaleDateString()}
                    </p>
                    {req.status === 'rejected' && req.rejectionReason && (
                      <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                        Reason: {req.rejectionReason}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {step === 'confirm' && selectedPlan && (
          <div className="rounded-3xl bg-white dark:bg-[#1C1419] border border-pink-100 dark:border-white/10 p-5 space-y-4">
            <h2 className="text-lg font-extrabold">Confirm Your Plan</h2>
            <div className="p-4 rounded-2xl bg-pink-50/70 dark:bg-white/5 space-y-1.5">
              <p className="text-sm font-extrabold">{selectedPlan.name}</p>
              <p className="text-xs text-[#6E5A63] dark:text-neutral-400">
                Validity: {selectedPlan.validityDays} Days
              </p>
              <p className="text-2xl font-black text-[#FF2D78] tabular-nums">
                ₹{selectedPlan.priceInr}
              </p>
            </div>
            <ul className="space-y-2">
              {(selectedPlan.benefits || MEMBERSHIP_BENEFITS).map((b) => (
                <li key={b} className="flex items-start gap-2 text-xs">
                  <Check className="w-4 h-4 text-[#FF2D78] shrink-0" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-[#6E5A63] dark:text-neutral-400">
              Note: Membership activates only after Owner Admin verifies your UPI payment screenshot and UTR reference.
            </p>
            <button
              type="button"
              onClick={() => setStep('pay')}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-[#FF2D78] to-[#E91E4D] text-white text-sm font-bold"
            >
              Proceed to UPI Payment
            </button>
          </div>
        )}

        {step === 'pay' && selectedPlan && (
          <div className="space-y-4">
            {/* Coupon Box */}
            <div className="rounded-2xl bg-white dark:bg-[#1C1419] border border-pink-100 dark:border-white/10 p-4 space-y-2.5">
              <label className="text-xs font-bold flex items-center gap-1.5">
                <Tag className="w-4 h-4 text-[#FF2D78]" />
                <span>Have a Coupon Code?</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter code"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                  className="flex-1 rounded-xl border border-pink-200 dark:border-white/15 bg-transparent px-3 py-2 text-sm uppercase outline-none"
                />
                <button
                  type="button"
                  disabled={checkingCoupon}
                  onClick={handleApplyCoupon}
                  className="px-4 py-2 rounded-xl bg-[#FF2D78] text-white text-xs font-bold"
                >
                  {checkingCoupon ? 'Checking...' : 'Apply'}
                </button>
              </div>
              {couponError && <p className="text-xs text-red-500">{couponError}</p>}
              {appliedCoupon && (
                <p className="text-xs text-emerald-600 font-bold">
                  Applied {appliedCoupon.code}: -₹{pricing.discount} ({appliedCoupon.discountPercent}% off)
                </p>
              )}
            </div>

            {/* Dynamic UPI QR & Pay Box */}
            <div className="rounded-3xl bg-white dark:bg-[#1C1419] border border-pink-100 dark:border-white/10 p-5 text-center space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-[#FF2D78]">
                Pay ₹{pricing.finalAmount} via UPI
              </p>
              {qrDataUrl && (
                <img
                  src={qrDataUrl}
                  alt="UPI QR Code"
                  className="w-48 h-48 mx-auto rounded-2xl border border-pink-100"
                />
              )}
              <div className="flex items-center justify-center gap-2 bg-pink-50 dark:bg-white/5 rounded-xl px-3 py-2">
                <span className="text-xs font-bold select-all">{paymentConfig.upiId}</span>
                <button
                  type="button"
                  onClick={handleCopyUpi}
                  className="p-1.5 rounded-lg bg-white dark:bg-white/10 text-[#FF2D78]"
                  aria-label="Copy UPI ID"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
              <a
                href={upiLink}
                className="inline-flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Tap to Pay in UPI App</span>
              </a>
              <p className="text-[11px] text-[#6E5A63] dark:text-neutral-400">
                {paymentConfig.instructions}
              </p>
            </div>

            {/* Payment Proof Form */}
            <form
              onSubmit={handleSubmitPayment}
              className="rounded-3xl bg-white dark:bg-[#1C1419] border border-pink-100 dark:border-white/10 p-5 space-y-3.5"
            >
              <h3 className="text-sm font-extrabold">Submit Payment Verification Details</h3>
              <label className="flex items-center justify-between px-3.5 py-3 rounded-xl border border-dashed border-pink-300 dark:border-white/20 text-xs cursor-pointer">
                <span className="truncate">
                  {screenshotFile ? screenshotFile.name : 'Upload Payment Screenshot (Required)'}
                </span>
                <Upload className="w-4 h-4 text-[#FF2D78] shrink-0" />
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setScreenshotFile(e.target.files?.[0] || null)}
                />
              </label>

              <input
                type="tel"
                required
                placeholder="WhatsApp Number"
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                className="w-full rounded-xl border border-pink-200 dark:border-white/15 bg-transparent px-3.5 py-2.5 text-sm outline-none"
              />

              <input
                type="text"
                required
                placeholder="UTR / UPI Transaction Reference Number"
                value={utrReference}
                onChange={(e) => setUtrReference(e.target.value)}
                className="w-full rounded-xl border border-pink-200 dark:border-white/15 bg-transparent px-3.5 py-2.5 text-sm outline-none"
              />

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-[#FF2D78] to-[#E91E4D] text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>{submitting ? 'Submitting...' : 'Submit Payment for Approval'}</span>
              </button>
            </form>
          </div>
        )}

        {step === 'submitted' && (
          <div className="rounded-3xl bg-white dark:bg-[#1C1419] border border-pink-100 dark:border-white/10 p-6 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500" />
            <h2 className="text-lg font-extrabold">Payment Submitted Successfully</h2>
            <p className="text-sm font-bold text-[#FF2D78]">Please Wait for 24 Hours</p>
            <p className="text-xs text-[#6E5A63] dark:text-neutral-400">
              Your payment is pending admin approval.
            </p>
            <button
              type="button"
              onClick={onBack}
              className="mt-3 w-full py-3 rounded-2xl bg-[#FF2D78] text-white text-sm font-bold"
            >
              Return to App
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

interface FreeBlueTickProps {
  me: UserProfile;
  onBack: () => void;
  onToast: (msg: string, tone?: 'success' | 'error' | 'info') => void;
}

export function FreeBlueTickFlow({ me, onBack, onToast }: FreeBlueTickProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [selfiePreview, setSelfiePreview] = useState('');
  const [submittedName, setSubmittedName] = useState(me.fullName);
  const [submitting, setSubmitting] = useState(false);
  const [latestRequest, setLatestRequest] = useState<VerificationRequest | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  const loadExisting = async () => {
    setLoadingStatus(true);
    try {
      const snap = await getDocs(
        query(collection(db, 'verificationRequests'), where('uid', '==', me.uid), limit(10))
      );
      const list = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<VerificationRequest, 'id'>) }))
        .sort((a, b) => b.createdAt - a.createdAt);
      setLatestRequest(list[0] || null);
      if (list[0]?.status === 'pending') {
        setStep(6);
      }
    } catch {
      setLatestRequest(null);
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    loadExisting();
  }, [me.uid]);

  const handleSubmitVerification = async () => {
    if (!selfieFile || !submittedName.trim()) {
      onToast('Selfie and full name are required.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const url = await uploadToFirebaseStorage(
        `verificationSelfies/${me.uid}/${Date.now()}_${selfieFile.name}`,
        selfieFile
      );
      await submitVerificationApplication(me.uid, me.username, submittedName.trim(), url);
      await loadExisting();
      setStep(6);
      onToast('Verification request submitted.', 'success');
    } catch (err: unknown) {
      onToast(err instanceof Error ? err.message : 'Unable to submit verification.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#FFF8FA] dark:bg-[#140E12]">
      <header className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-[#1B1318] border-b border-pink-100 dark:border-white/10">
        <button type="button" onClick={onBack} className="p-1.5 rounded-xl hover:bg-pink-50 dark:hover:bg-white/5">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-extrabold">Free Blue Tick Verification</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5">
        {loadingStatus ? (
          <div className="py-12 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-sky-500" />
          </div>
        ) : me.verified ? (
          <div className="rounded-3xl bg-white dark:bg-[#1C1419] border border-sky-200 dark:border-sky-500/30 p-6 text-center space-y-3">
            <BadgeCheck className="w-12 h-12 mx-auto text-sky-500" />
            <h2 className="text-lg font-extrabold">Profile Verified</h2>
            <p className="text-xs text-[#6E5A63] dark:text-neutral-400">
              Your Blue Verification Badge is active and visible across IG Meet.
            </p>
          </div>
        ) : latestRequest?.status === 'pending' || step === 6 ? (
          <div className="rounded-3xl bg-white dark:bg-[#1C1419] border border-sky-200 dark:border-sky-500/30 p-6 text-center space-y-3">
            <Clock className="w-12 h-12 mx-auto text-sky-500" />
            <h2 className="text-lg font-extrabold">Request Submitted &middot; Pending Review</h2>
            <p className="text-xs text-[#6E5A63] dark:text-neutral-400">
              Our Owner Admin team will review your selfie and full name before approving your Blue Tick badge.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {latestRequest?.status === 'rejected' && (
              <div className="rounded-2xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 p-4 flex items-start gap-2.5">
                <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <p className="font-bold text-red-600 dark:text-red-400">Previous Request Rejected</p>
                  <p>{latestRequest.rejectionReason || 'Please capture a clearer selfie and reapply.'}</p>
                </div>
              </div>
            )}

            {/* Progress indicator */}
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((num) => (
                <div
                  key={num}
                  className={`h-1.5 flex-1 rounded-full ${
                    step >= num ? 'bg-sky-500' : 'bg-sky-100 dark:bg-white/10'
                  }`}
                />
              ))}
            </div>

            {step === 1 && (
              <div className="rounded-3xl bg-white dark:bg-[#1C1419] border border-pink-100 dark:border-white/10 p-5 space-y-4 text-center">
                <BadgeCheck className="w-10 h-10 mx-auto text-sky-500" />
                <h2 className="text-base font-extrabold">Step 1: Take a Live Selfie</h2>
                <p className="text-xs text-[#6E5A63] dark:text-neutral-400">
                  Capture a well-lit front-facing selfie so our team can confirm your identity. Selfies are private and never shown publicly.
                </p>
                <label className="block w-full py-3.5 rounded-2xl bg-sky-500 text-white text-sm font-bold cursor-pointer">
                  <span className="inline-flex items-center gap-2">
                    <Camera className="w-4 h-4" />
                    <span>Capture or Upload Selfie</span>
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="user"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        setSelfieFile(f);
                        setSelfiePreview(URL.createObjectURL(f));
                        setStep(2);
                      }
                    }}
                  />
                </label>
              </div>
            )}

            {step === 2 && (
              <div className="rounded-3xl bg-white dark:bg-[#1C1419] border border-pink-100 dark:border-white/10 p-5 space-y-4 text-center">
                <h2 className="text-base font-extrabold">Step 2: Review Your Selfie</h2>
                {selfiePreview && (
                  <img
                    src={selfiePreview}
                    alt="Verification selfie"
                    className="w-48 h-48 mx-auto rounded-2xl object-cover"
                  />
                )}
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="py-2.5 rounded-xl border border-pink-200 dark:border-white/15 text-xs font-bold"
                  >
                    Retake Selfie
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="py-2.5 rounded-xl bg-sky-500 text-white text-xs font-bold"
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="rounded-3xl bg-white dark:bg-[#1C1419] border border-pink-100 dark:border-white/10 p-5 space-y-4">
                <h2 className="text-base font-extrabold">Step 3: Enter Your Full Name</h2>
                <input
                  type="text"
                  value={submittedName}
                  onChange={(e) => setSubmittedName(e.target.value)}
                  placeholder="Enter your real full name"
                  className="w-full rounded-xl border border-pink-200 dark:border-white/15 bg-transparent px-3.5 py-2.5 text-sm outline-none focus:border-sky-500"
                />
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="py-2.5 rounded-xl border border-pink-200 dark:border-white/15 text-xs font-bold"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!submittedName.trim()) {
                        onToast('Enter your full name to continue.', 'error');
                        return;
                      }
                      setStep(4);
                    }}
                    className="py-2.5 rounded-xl bg-sky-500 text-white text-xs font-bold"
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="rounded-3xl bg-white dark:bg-[#1C1419] border border-pink-100 dark:border-white/10 p-5 space-y-4 text-center">
                <h2 className="text-base font-extrabold">Step 4: Confirm Selfie &amp; Name</h2>
                {selfiePreview && (
                  <img
                    src={selfiePreview}
                    alt="Confirm selfie"
                    className="w-36 h-36 mx-auto rounded-2xl object-cover"
                  />
                )}
                <p className="text-sm font-bold">{submittedName}</p>
                <p className="text-xs text-[#6E5A63] dark:text-neutral-400">@{me.username}</p>
                <button
                  type="button"
                  onClick={() => setStep(5)}
                  className="w-full py-3 rounded-2xl bg-sky-500 text-white text-sm font-bold"
                >
                  Looks Good &rarr; Continue
                </button>
              </div>
            )}

            {step === 5 && (
              <div className="rounded-3xl bg-white dark:bg-[#1C1419] border border-pink-100 dark:border-white/10 p-5 space-y-4 text-center">
                <h2 className="text-base font-extrabold">Step 5: Final Submission</h2>
                <p className="text-xs text-[#6E5A63] dark:text-neutral-400">
                  By submitting, you confirm that this selfie belongs to you and matches your IG Meet profile.
                </p>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleSubmitVerification}
                  className="w-full py-3 rounded-2xl bg-sky-500 text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{submitting ? 'Submitting...' : 'Confirm & Submit'}</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface NotificationsProps {
  notifications: AppNotification[];
  onBack: () => void;
  onSelectNotification: (notif: AppNotification) => void;
}

export function NotificationsScreen({
  notifications,
  onBack,
  onSelectNotification
}: NotificationsProps) {
  const startOfToday = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  }, []);

  const todayList = notifications.filter((n) => n.createdAt >= startOfToday);
  const earlierList = notifications.filter((n) => n.createdAt < startOfToday);

  const renderGroup = (label: string, items: AppNotification[]) => {
    if (items.length === 0) return null;
    return (
      <section className="space-y-2">
        <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#6E5A63] dark:text-neutral-400">
          {label}
        </h2>
        {items.map((n) => (
          <button
            key={n.id}
            type="button"
            onClick={() => onSelectNotification(n)}
            className={`w-full text-left p-3.5 rounded-2xl border flex items-start gap-3 transition ${
              n.read
                ? 'bg-white dark:bg-[#1C1419] border-pink-100 dark:border-white/10'
                : 'bg-pink-50/90 dark:bg-pink-500/10 border-[#FF2D78]/40'
            }`}
          >
            {n.actorAvatar ? (
              <img src={n.actorAvatar} alt={n.title} className="w-10 h-10 rounded-xl object-cover shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-pink-100 dark:bg-white/10 flex items-center justify-center shrink-0">
                <Bell className="w-5 h-5 text-[#FF2D78]" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold truncate">{n.title}</p>
                {!n.read && <span className="w-2 h-2 rounded-full bg-[#FF2D78] shrink-0" />}
              </div>
              <p className="text-xs text-[#6E5A63] dark:text-neutral-300 mt-0.5">{n.description}</p>
              <p className="text-[10px] text-[#6E5A63] dark:text-neutral-400 mt-1">
                {new Date(n.createdAt).toLocaleString()}
              </p>
            </div>
          </button>
        ))}
      </section>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#FFF8FA] dark:bg-[#140E12]">
      <header className="flex items-center justify-between px-4 py-3 bg-white dark:bg-[#1B1318] border-b border-pink-100 dark:border-white/10">
        <div className="flex items-center gap-2.5">
          <button type="button" onClick={onBack} className="p-1.5 rounded-xl hover:bg-pink-50 dark:hover:bg-white/5">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-base font-extrabold">Notifications</h1>
        </div>
        <button
          type="button"
          onClick={() => markAllNotificationsRead(notifications)}
          className="text-xs font-bold text-[#FF2D78]"
        >
          Mark All as Read
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {notifications.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <Bell className="w-8 h-8 mx-auto text-[#FF80AB]" />
            <p className="text-sm font-bold">No Notifications Yet</p>
            <p className="text-xs text-[#6E5A63] dark:text-neutral-400">
              Likes, matches, messages, and announcements will appear here.
            </p>
          </div>
        ) : (
          <>
            {renderGroup('Today', todayList)}
            {renderGroup('Earlier', earlierList)}
          </>
        )}
      </div>
    </div>
  );
}
