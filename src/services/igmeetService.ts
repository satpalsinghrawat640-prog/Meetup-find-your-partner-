import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  runTransaction,
  arrayUnion,
  onSnapshot,
  Unsubscribe
} from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { ref as rtdbRef, set as rtdbSet, onDisconnect, onValue } from 'firebase/database';
import { httpsCallable } from 'firebase/functions';
import { User } from 'firebase/auth';
import { db, storage, rtdb, functions } from '../lib/firebase';
import {
  UserProfile,
  UserPost,
  MatchRecord,
  ChatMessage,
  MembershipPlan,
  PaymentConfig,
  SwipePromoConfig,
  SupportContactSlot,
  CouponCode,
  PaymentRequest,
  VerificationRequest,
  SupportRequest,
  AnnouncementItem,
  AppNotification,
  ReportRecord,
  AdminActivityLog,
  SavedDeviceAccount
} from '../types/igmeet';
import {
  DEFAULT_PLANS,
  DEFAULT_PAYMENT_CONFIG,
  DEFAULT_PROMO_CONFIG,
  DEFAULT_SUPPORT_SLOTS
} from '../lib/constants';

const SAVED_ACCOUNTS_KEY = 'igmeet_saved_accounts_v1';
const CHAT_THEMES_KEY = 'igmeet_chat_themes_v1';

export function calculateExactAge(day: number, month: number, year: number): number {
  if (!day || !month || !year) return 0;
  const dob = new Date(year, month - 1, day);
  if (dob.getFullYear() !== year || dob.getMonth() !== month - 1 || dob.getDate() !== day) {
    return 0;
  }
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

export function isPaidActive(profile: UserProfile | null | undefined): boolean {
  if (!profile) return false;
  if (profile.membershipTier === 'free') return false;
  if (!profile.membershipExpiresAt) return true;
  return profile.membershipExpiresAt > Date.now();
}

export function sortedPairId(uidA: string, uidB: string): string {
  return [uidA, uidB].sort().join('_');
}

export async function getAuthRoleFromClaims(user: User): Promise<'owner' | 'admin' | 'user'> {
  try {
    const token = await user.getIdTokenResult(true);
    const claimRole = token.claims.role;
    if (claimRole === 'owner' || claimRole === 'admin') return claimRole;
  } catch {
    // Ignore claim fetch errors offline
  }
  return 'user';
}

export async function uploadToFirebaseStorage(path: string, file: File): Promise<string> {
  const allowedPrefixes = ['image/', 'video/', 'audio/'];
  if (!allowedPrefixes.some((prefix) => file.type.startsWith(prefix))) {
    throw new Error('Unsupported file format. Upload a valid image, video, or audio file.');
  }
  const maxBytes = file.type.startsWith('video/') ? 20 * 1024 * 1024 : 8 * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error('File size exceeds the maximum allowed limit.');
  }
  const fileRef = storageRef(storage, path);
  await uploadBytes(fileRef, file, { contentType: file.type });
  return getDownloadURL(fileRef);
}

export async function isUsernameAvailable(username: string, excludeUid?: string): Promise<boolean> {
  const normalized = username.trim().toLowerCase();
  if (!/^[a-z0-9._]{3,24}$/.test(normalized)) return false;
  const q = query(collection(db, 'users'), where('username', '==', normalized), limit(2));
  const snap = await getDocs(q);
  if (snap.empty) return true;
  return snap.docs.every((d) => d.id === excludeUid);
}

export async function saveCompletedProfile(profile: UserProfile, initialPosts: { imageUrl: string; caption: string }[]): Promise<void> {
  const age = calculateExactAge(profile.dobDay, profile.dobMonth, profile.dobYear);
  if (age < 18) {
    throw new Error('Only adults aged 18 or above can register on IG Meet.');
  }

  // Attempt server-side Cloud Function verification & Owner Admin atomic bootstrap first
  try {
    const fn = httpsCallable(functions, 'completeProfileRegistration');
    await fn({ profile, initialPosts });
    return;
  } catch {
    // If Cloud Functions are not yet deployed, persist directly while respecting Firestore Rules (never escalating role on client)
    const safeProfile: UserProfile = {
      ...profile,
      age,
      username: profile.username.trim().toLowerCase(),
      role: 'user',
      status: 'active',
      verified: false,
      membershipTier: 'free',
      profileComplete: true,
      createdAt: profile.createdAt || Date.now(),
      updatedAt: Date.now()
    };
    await setDoc(doc(db, 'users', profile.uid), safeProfile, { merge: true });
    await setDoc(doc(db, 'profiles', profile.uid), {
      uid: safeProfile.uid,
      fullName: safeProfile.fullName,
      username: safeProfile.username,
      age: safeProfile.age,
      state: safeProfile.state,
      district: safeProfile.district,
      gender: safeProfile.gender,
      interestedIn: safeProfile.interestedIn,
      bio: safeProfile.bio,
      photoUrl: safeProfile.photoUrl,
      gallery: safeProfile.gallery,
      verified: false,
      membershipTier: 'free',
      status: 'active',
      createdAt: safeProfile.createdAt
    }, { merge: true });

    for (const post of initialPosts.slice(0, 2)) {
      await addDoc(collection(db, 'posts'), {
        uid: profile.uid,
        imageUrl: post.imageUrl,
        caption: post.caption.trim(),
        createdAt: Date.now()
      });
    }
  }
}

export async function fetchUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  return { ...(snap.data() as UserProfile), uid: snap.id };
}

export async function fetchUserPosts(uid: string): Promise<UserPost[]> {
  const q = query(collection(db, 'posts'), where('uid', '==', uid), limit(30));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<UserPost, 'id'>) }))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function createUserPost(uid: string, imageUrl: string, caption: string): Promise<void> {
  await addDoc(collection(db, 'posts'), {
    uid,
    imageUrl,
    caption: caption.trim(),
    createdAt: Date.now()
  });
}

export async function recordSwipeWithMatch(
  fromProfile: UserProfile,
  targetProfile: UserProfile,
  action: 'like' | 'pass' | 'super_like'
): Promise<{ matched: boolean; matchId?: string }> {
  const pairDocId = `${fromProfile.uid}_${targetProfile.uid}`;
  const targetCollection = action === 'pass' ? 'passes' : action === 'super_like' ? 'superLikes' : 'likes';

  await setDoc(doc(db, targetCollection, pairDocId), {
    fromUid: fromProfile.uid,
    toUid: targetProfile.uid,
    action,
    createdAt: Date.now()
  });

  if (action === 'pass') {
    return { matched: false };
  }

  // Create notification for target user
  await addDoc(collection(db, 'notifications'), {
    uid: targetProfile.uid,
    type: action === 'super_like' ? 'super_like' : 'like',
    title: action === 'super_like' ? 'New Super Like' : 'New Like',
    description:
      action === 'super_like'
        ? `${fromProfile.fullName} sent you a Super Like.`
        : `${fromProfile.fullName} liked your profile.`,
    actorId: fromProfile.uid,
    actorAvatar: fromProfile.photoUrl,
    targetRoute: 'explore',
    read: false,
    createdAt: Date.now()
  }).catch(() => {});

  // Check reciprocal like or super_like
  const [revLike, revSuper] = await Promise.all([
    getDoc(doc(db, 'likes', `${targetProfile.uid}_${fromProfile.uid}`)),
    getDoc(doc(db, 'superLikes', `${targetProfile.uid}_${fromProfile.uid}`))
  ]);

  if (!revLike.exists() && !revSuper.exists()) {
    return { matched: false };
  }

  // Atomic transaction to prevent duplicate matches
  const matchId = sortedPairId(fromProfile.uid, targetProfile.uid);
  const matchRef = doc(db, 'matches', matchId);
  const chatRef = doc(db, 'personalChats', matchId);
  const usersSorted = [fromProfile.uid, targetProfile.uid].sort() as [string, string];

  await runTransaction(db, async (tx) => {
    const existing = await tx.get(matchRef);
    if (!existing.exists()) {
      tx.set(matchRef, {
        users: usersSorted,
        createdAt: Date.now()
      });
    }
    const existingChat = await tx.get(chatRef);
    if (!existingChat.exists()) {
      tx.set(chatRef, {
        users: usersSorted,
        createdAt: Date.now(),
        lastMessage: '',
        lastMessageAt: Date.now(),
        lastMessageSender: '',
        unreadBy: { [fromProfile.uid]: 0, [targetProfile.uid]: 0 }
      });
    }
  });

  await Promise.all([
    addDoc(collection(db, 'notifications'), {
      uid: targetProfile.uid,
      type: 'match',
      title: "It's a Match!",
      description: `You and ${fromProfile.fullName} liked each other.`,
      actorId: fromProfile.uid,
      actorAvatar: fromProfile.photoUrl,
      targetRoute: `chat:${matchId}`,
      read: false,
      createdAt: Date.now()
    }).catch(() => {}),
    addDoc(collection(db, 'notifications'), {
      uid: fromProfile.uid,
      type: 'match',
      title: "It's a Match!",
      description: `You and ${targetProfile.fullName} liked each other.`,
      actorId: targetProfile.uid,
      actorAvatar: targetProfile.photoUrl,
      targetRoute: `chat:${matchId}`,
      read: false,
      createdAt: Date.now()
    }).catch(() => {})
  ]);

  return { matched: true, matchId };
}

export async function ensurePersonalChat(myUid: string, peerUid: string): Promise<string> {
  const chatId = sortedPairId(myUid, peerUid);
  const chatRef = doc(db, 'personalChats', chatId);
  const usersSorted = [myUid, peerUid].sort() as [string, string];
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(chatRef);
    if (!snap.exists()) {
      tx.set(chatRef, {
        users: usersSorted,
        createdAt: Date.now(),
        lastMessage: '',
        lastMessageAt: Date.now(),
        lastMessageSender: '',
        unreadBy: { [myUid]: 0, [peerUid]: 0 }
      });
    }
  });
  return chatId;
}

export async function sendPersonalMessage(
  chatId: string,
  sender: UserProfile,
  peerUid: string,
  payload: {
    type: 'text' | 'image' | 'video' | 'voice';
    text?: string;
    mediaUrl?: string;
    replyTo?: ChatMessage['replyTo'];
  }
): Promise<void> {
  const now = Date.now();
  await addDoc(collection(db, 'personalMessages'), {
    chatId,
    senderId: sender.uid,
    senderName: sender.fullName,
    senderPhoto: sender.photoUrl,
    type: payload.type,
    text: payload.text?.trim() || '',
    mediaUrl: payload.mediaUrl || '',
    replyTo: payload.replyTo || null,
    reactions: {},
    readBy: [sender.uid],
    deletedForEveryone: false,
    createdAt: now
  });

  const preview =
    payload.type === 'image'
      ? 'Shared a photo'
      : payload.type === 'voice'
      ? 'Sent a voice message'
      : payload.type === 'video'
      ? 'Shared a video'
      : payload.text?.trim() || '';

  const chatRef = doc(db, 'personalChats', chatId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(chatRef);
    const currentUnread = snap.exists() ? (snap.data()?.unreadBy?.[peerUid] || 0) : 0;
    tx.set(
      chatRef,
      {
        lastMessage: preview,
        lastMessageAt: now,
        lastMessageSender: sender.uid,
        [`unreadBy.${peerUid}`]: currentUnread + 1
      },
      { merge: true }
    );
  });

  // Notify peer of genuinely new message
  await addDoc(collection(db, 'notifications'), {
    uid: peerUid,
    type: 'message',
    title: sender.fullName,
    description: preview,
    actorId: sender.uid,
    actorAvatar: sender.photoUrl,
    targetRoute: `chat:${chatId}`,
    read: false,
    createdAt: now
  }).catch(() => {});
}

export async function sendGlobalMessage(
  sender: UserProfile,
  payload: { type: 'text' | 'image' | 'video'; text?: string; mediaUrl?: string }
): Promise<void> {
  await addDoc(collection(db, 'globalChatMessages'), {
    chatId: 'global',
    senderId: sender.uid,
    senderName: sender.fullName,
    senderPhoto: sender.photoUrl,
    type: payload.type,
    text: payload.text?.trim() || '',
    mediaUrl: payload.mediaUrl || '',
    deletedForEveryone: false,
    createdAt: Date.now()
  });
}

export async function blockUserAccount(blockerUid: string, blockedUser: UserProfile): Promise<void> {
  await setDoc(doc(db, 'blockedUsers', `${blockerUid}_${blockedUser.uid}`), {
    blockerUid,
    blockedUid: blockedUser.uid,
    blockedName: blockedUser.fullName,
    blockedUsername: blockedUser.username,
    blockedPhoto: blockedUser.photoUrl,
    createdAt: Date.now()
  });
}

export async function unblockUserAccount(blockerUid: string, blockedUid: string): Promise<void> {
  await deleteDoc(doc(db, 'blockedUsers', `${blockerUid}_${blockedUid}`));
}

export async function submitReportRecord(report: Omit<ReportRecord, 'id' | 'status' | 'createdAt'>): Promise<void> {
  await addDoc(collection(db, 'reports'), {
    ...report,
    status: 'pending',
    createdAt: Date.now()
  });
}

export async function submitSupportTicket(
  ticket: Omit<SupportRequest, 'id' | 'status' | 'createdAt'>
): Promise<void> {
  await addDoc(collection(db, 'supportRequests'), {
    ...ticket,
    status: 'Pending',
    createdAt: Date.now()
  });
}

export async function submitVerificationApplication(
  uid: string,
  username: string,
  submittedName: string,
  selfieUrl: string
): Promise<void> {
  // Enforce one pending request per user
  const existing = await getDocs(
    query(
      collection(db, 'verificationRequests'),
      where('uid', '==', uid),
      where('status', '==', 'pending'),
      limit(1)
    )
  );
  if (!existing.empty) {
    throw new Error('You already have a verification request pending review.');
  }
  await addDoc(collection(db, 'verificationRequests'), {
    uid,
    username,
    submittedName: submittedName.trim(),
    selfieUrl,
    status: 'pending',
    createdAt: Date.now()
  });
}

export async function fetchMembershipPlans(): Promise<MembershipPlan[]> {
  try {
    const snap = await getDocs(collection(db, 'membershipPlans'));
    if (snap.empty) return DEFAULT_PLANS;
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<MembershipPlan, 'id'>) }));
  } catch {
    return DEFAULT_PLANS;
  }
}

export async function fetchPaymentConfig(): Promise<PaymentConfig> {
  try {
    const snap = await getDoc(doc(db, 'adminSettings', 'payment'));
    if (!snap.exists()) return DEFAULT_PAYMENT_CONFIG;
    return { ...DEFAULT_PAYMENT_CONFIG, ...(snap.data() as Partial<PaymentConfig>) };
  } catch {
    return DEFAULT_PAYMENT_CONFIG;
  }
}

export async function fetchSwipePromoConfig(): Promise<SwipePromoConfig> {
  try {
    const snap = await getDoc(doc(db, 'swipePromotions', 'config'));
    if (!snap.exists()) return DEFAULT_PROMO_CONFIG;
    return { ...DEFAULT_PROMO_CONFIG, ...(snap.data() as Partial<SwipePromoConfig>) };
  } catch {
    return DEFAULT_PROMO_CONFIG;
  }
}

export async function fetchSupportContacts(): Promise<SupportContactSlot[]> {
  try {
    const snap = await getDoc(doc(db, 'supportContacts', 'slots'));
    if (!snap.exists()) return DEFAULT_SUPPORT_SLOTS;
    const data = snap.data()?.slots as SupportContactSlot[] | undefined;
    return Array.isArray(data) && data.length ? data : DEFAULT_SUPPORT_SLOTS;
  } catch {
    return DEFAULT_SUPPORT_SLOTS;
  }
}

export async function validateCouponForPlan(code: string, planTier: 'plus' | 'elite'): Promise<CouponCode> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) throw new Error('Enter a coupon code.');
  const snap = await getDocs(query(collection(db, 'coupons'), where('code', '==', normalized), limit(1)));
  if (snap.empty) throw new Error('Coupon code not found.');
  const coupon = { id: snap.docs[0].id, ...(snap.docs[0].data() as Omit<CouponCode, 'id'>) };
  if (!coupon.enabled) throw new Error('This coupon is currently disabled.');
  if (coupon.expiresAt && coupon.expiresAt < Date.now()) throw new Error('This coupon has expired.');
  if (coupon.usedCount >= coupon.maxUses) throw new Error('This coupon has reached its maximum usage limit.');
  if (coupon.applicablePlan !== 'both' && coupon.applicablePlan !== planTier) {
    throw new Error(`This coupon is valid only for ${coupon.applicablePlan.toUpperCase()} plans.`);
  }
  return coupon;
}

export async function submitMembershipPaymentRequest(
  req: Omit<PaymentRequest, 'id' | 'status' | 'createdAt'>,
  couponId?: string
): Promise<void> {
  // Never activate membership on submission — always pending admin verification
  await addDoc(collection(db, 'paymentRequests'), {
    ...req,
    status: 'pending',
    createdAt: Date.now()
  });

  if (couponId) {
    const couponRef = doc(db, 'coupons', couponId);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(couponRef);
      if (snap.exists()) {
        const used = snap.data().usedCount || 0;
        const max = snap.data().maxUses || 1;
        if (used < max) {
          tx.update(couponRef, { usedCount: used + 1 });
        }
      }
    }).catch(() => {});
  }
}

// Presence & Typing via Realtime Database (only when RTDB URL is provided)
export function bindUserPresence(uid: string, showOnline: boolean): () => void {
  const updateFirestoreLastSeen = () => {
    updateDoc(doc(db, 'users', uid), {
      online: showOnline,
      lastSeen: Date.now()
    }).catch(() => {});
  };
  updateFirestoreLastSeen();
  const interval = window.setInterval(updateFirestoreLastSeen, 60000);

  if (rtdb) {
    const statusRef = rtdbRef(rtdb, `presence/${uid}`);
    rtdbSet(statusRef, { online: showOnline, lastSeen: Date.now() }).catch(() => {});
    onDisconnect(statusRef).set({ online: false, lastSeen: Date.now() }).catch(() => {});
  }

  return () => {
    window.clearInterval(interval);
    if (rtdb) {
      rtdbSet(rtdbRef(rtdb, `presence/${uid}`), { online: false, lastSeen: Date.now() }).catch(() => {});
    }
  };
}

export function setTypingIndicator(chatId: string, uid: string, isTyping: boolean): void {
  if (!rtdb) return;
  rtdbSet(rtdbRef(rtdb, `typing/${chatId}/${uid}`), isTyping ? Date.now() : null).catch(() => {});
}

export function subscribeTypingIndicator(
  chatId: string,
  peerUid: string,
  callback: (typing: boolean) => void
): Unsubscribe {
  if (!rtdb) {
    callback(false);
    return () => {};
  }
  const ref = rtdbRef(rtdb, `typing/${chatId}/${peerUid}`);
  return onValue(ref, (snap) => {
    const val = snap.val();
    callback(typeof val === 'number' && Date.now() - val < 8000);
  });
}

// Per-chat theme persistence
export function getSavedChatTheme(chatId: string): { colorId: string; customBgUrl?: string } {
  try {
    const raw = localStorage.getItem(CHAT_THEMES_KEY);
    const map = raw ? JSON.parse(raw) : {};
    return map[chatId] || { colorId: 'rose_blush' };
  } catch {
    return { colorId: 'rose_blush' };
  }
}

export function saveChatTheme(chatId: string, pref: { colorId: string; customBgUrl?: string }): void {
  try {
    const raw = localStorage.getItem(CHAT_THEMES_KEY);
    const map = raw ? JSON.parse(raw) : {};
    map[chatId] = pref;
    localStorage.setItem(CHAT_THEMES_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage errors
  }
}

// Device account switcher (max 3 accounts)
export function getSavedDeviceAccounts(): SavedDeviceAccount[] {
  try {
    const raw = localStorage.getItem(SAVED_ACCOUNTS_KEY);
    const list = raw ? (JSON.parse(raw) as SavedDeviceAccount[]) : [];
    return Array.isArray(list) ? list.slice(0, 3) : [];
  } catch {
    return [];
  }
}

export function upsertSavedDeviceAccount(account: SavedDeviceAccount): SavedDeviceAccount[] {
  const list = getSavedDeviceAccounts().filter((a) => a.uid !== account.uid);
  const next = [account, ...list].slice(0, 3);
  try {
    localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage errors
  }
  return next;
}

export function removeSavedDeviceAccount(uid: string): SavedDeviceAccount[] {
  const next = getSavedDeviceAccounts().filter((a) => a.uid !== uid);
  try {
    localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage errors
  }
  return next;
}

// Admin operations with audit logging
export async function logAdminAction(
  adminUid: string,
  action: string,
  target: string,
  result: string
): Promise<void> {
  await addDoc(collection(db, 'adminLogs'), {
    adminUid,
    action,
    target,
    result,
    createdAt: Date.now()
  }).catch(() => {});
}

export async function adminApprovePayment(adminUid: string, req: PaymentRequest): Promise<void> {
  const now = Date.now();
  const expiresAt = now + req.validityDays * 24 * 60 * 60 * 1000;

  await updateDoc(doc(db, 'paymentRequests', req.id), {
    status: 'approved',
    approvedAt: now,
    approvedBy: adminUid
  });

  await updateDoc(doc(db, 'users', req.uid), {
    membershipTier: req.planTier,
    membershipExpiresAt: expiresAt,
    updatedAt: now
  });

  await updateDoc(doc(db, 'profiles', req.uid), {
    membershipTier: req.planTier
  }).catch(() => {});

  await addDoc(collection(db, 'subscriptions'), {
    uid: req.uid,
    planId: req.planId,
    planTier: req.planTier,
    planName: req.planName,
    amountPaid: req.finalAmount,
    startDate: now,
    endDate: expiresAt,
    approvedBy: adminUid,
    createdAt: now
  });

  await addDoc(collection(db, 'paymentHistory'), {
    uid: req.uid,
    userName: req.userName,
    planName: req.planName,
    amount: req.finalAmount,
    utrReference: req.utrReference,
    status: 'approved',
    approvedBy: adminUid,
    createdAt: now
  });

  await addDoc(collection(db, 'notifications'), {
    uid: req.uid,
    type: 'membership',
    title: 'Membership Activated',
    description: `Your ${req.planName} plan has been approved and activated.`,
    targetRoute: 'upgrade',
    read: false,
    createdAt: now
  });

  await logAdminAction(adminUid, 'APPROVE_PAYMENT', `${req.uid} (${req.planName})`, 'Success');
}

export async function adminRejectPayment(adminUid: string, req: PaymentRequest, reason: string): Promise<void> {
  const now = Date.now();
  await updateDoc(doc(db, 'paymentRequests', req.id), {
    status: 'rejected',
    rejectionReason: reason.trim(),
    approvedBy: adminUid,
    approvedAt: now
  });
  await addDoc(collection(db, 'notifications'), {
    uid: req.uid,
    type: 'membership',
    title: 'Payment Rejected',
    description: reason.trim() || 'Your payment request could not be verified.',
    targetRoute: 'upgrade',
    read: false,
    createdAt: now
  });
  await logAdminAction(adminUid, 'REJECT_PAYMENT', req.uid, reason.trim());
}

export async function adminReviewVerification(
  adminUid: string,
  req: VerificationRequest,
  approve: boolean,
  rejectionReason = ''
): Promise<void> {
  const now = Date.now();
  await updateDoc(doc(db, 'verificationRequests', req.id), {
    status: approve ? 'approved' : 'rejected',
    rejectionReason: approve ? '' : rejectionReason.trim(),
    reviewedBy: adminUid,
    reviewedAt: now
  });

  if (approve) {
    await updateDoc(doc(db, 'users', req.uid), { verified: true, updatedAt: now });
    await updateDoc(doc(db, 'profiles', req.uid), { verified: true }).catch(() => {});
  }

  await addDoc(collection(db, 'notifications'), {
    uid: req.uid,
    type: 'verification',
    title: approve ? 'Blue Tick Approved' : 'Verification Request Rejected',
    description: approve
      ? 'Your identity verification was approved. Your Blue Badge is now active.'
      : rejectionReason.trim() || 'Please submit a clear selfie and try again.',
    targetRoute: 'verification',
    read: false,
    createdAt: now
  });

  await logAdminAction(
    adminUid,
    approve ? 'APPROVE_VERIFICATION' : 'REJECT_VERIFICATION',
    req.uid,
    approve ? 'Verified' : rejectionReason
  );
}

export async function adminPublishAnnouncement(adminUid: string, title: string, message: string): Promise<void> {
  const now = Date.now();
  await addDoc(collection(db, 'announcements'), {
    title: title.trim(),
    message: message.trim(),
    createdBy: adminUid,
    createdAt: now
  });
  await logAdminAction(adminUid, 'PUBLISH_ANNOUNCEMENT', title.trim(), 'Published');
}

export function subscribeUserNotifications(
  uid: string,
  onData: (list: AppNotification[]) => void
): Unsubscribe {
  const q = query(collection(db, 'notifications'), where('uid', '==', uid), limit(60));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<AppNotification, 'id'>) }))
        .sort((a, b) => b.createdAt - a.createdAt);
      onData(list);
    },
    () => onData([])
  );
}

export async function markAllNotificationsRead(notifications: AppNotification[]): Promise<void> {
  const unread = notifications.filter((n) => !n.read);
  await Promise.all(
    unread.map((n) => updateDoc(doc(db, 'notifications', n.id), { read: true }).catch(() => {}))
  );
}

export async function fetchAllAdminCollections() {
  const [usersS, reportsS, paymentsS, verifS, supportS, couponsS, announcementsS, logsS, historyS] =
    await Promise.all([
      getDocs(query(collection(db, 'users'), limit(150))),
      getDocs(query(collection(db, 'reports'), limit(100))),
      getDocs(query(collection(db, 'paymentRequests'), limit(100))),
      getDocs(query(collection(db, 'verificationRequests'), limit(100))),
      getDocs(query(collection(db, 'supportRequests'), limit(100))),
      getDocs(query(collection(db, 'coupons'), limit(100))),
      getDocs(query(collection(db, 'announcements'), limit(50))),
      getDocs(query(collection(db, 'adminLogs'), limit(100))),
      getDocs(query(collection(db, 'paymentHistory'), limit(100)))
    ]);

  return {
    users: usersS.docs.map((d) => ({ ...(d.data() as UserProfile), uid: d.id })),
    reports: reportsS.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ReportRecord, 'id'>) })).sort((a, b) => b.createdAt - a.createdAt),
    payments: paymentsS.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PaymentRequest, 'id'>) })).sort((a, b) => b.createdAt - a.createdAt),
    verifications: verifS.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<VerificationRequest, 'id'>) })).sort((a, b) => b.createdAt - a.createdAt),
    supportTickets: supportS.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SupportRequest, 'id'>) })).sort((a, b) => b.createdAt - a.createdAt),
    coupons: couponsS.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CouponCode, 'id'>) })),
    announcements: announcementsS.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AnnouncementItem, 'id'>) })).sort((a, b) => b.createdAt - a.createdAt),
    logs: logsS.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AdminActivityLog, 'id'>) })).sort((a, b) => b.createdAt - a.createdAt),
    paymentHistory: historyS.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }))
  };
}

export async function reactToMessage(messageId: string, uid: string, reactionLabel: string): Promise<void> {
  await updateDoc(doc(db, 'personalMessages', messageId), {
    [`reactions.${uid}`]: reactionLabel
  });
}

export async function deleteMessageForEveryone(messageId: string): Promise<void> {
  await updateDoc(doc(db, 'personalMessages', messageId), {
    deletedForEveryone: true,
    text: '',
    mediaUrl: ''
  });
}

export async function markMessageRead(messageId: string, uid: string): Promise<void> {
  await updateDoc(doc(db, 'personalMessages', messageId), {
    readBy: arrayUnion(uid)
  }).catch(() => {});
}
