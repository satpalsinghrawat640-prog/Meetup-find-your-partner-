import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';

admin.initializeApp();
const db = admin.firestore();

function calculateExactAge(day: number, month: number, year: number): number {
  const dob = new Date(year, month - 1, day);
  if (dob.getFullYear() !== year || dob.getMonth() !== month - 1 || dob.getDate() !== day) {
    return 0;
  }
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

function assertAdmin(auth: { uid: string; token: Record<string, unknown> } | undefined): string {
  if (!auth) throw new HttpsError('unauthenticated', 'Authentication required.');
  const role = auth.token.role;
  if (role !== 'owner' && role !== 'admin') {
    throw new HttpsError('permission-denied', 'Owner Admin privileges required.');
  }
  return auth.uid;
}

/**
 * Completes profile registration with server-side 18+ verification and
 * atomic first-registered-user Owner Admin assignment via Firebase Auth Custom Claims.
 */
export const completeProfileRegistration = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in to complete profile registration.');
  }

  const uid = request.auth.uid;
  const { profile, initialPosts } = request.data as {
    profile: Record<string, unknown>;
    initialPosts?: { imageUrl: string; caption: string }[];
  };

  const dobDay = Number(profile.dobDay);
  const dobMonth = Number(profile.dobMonth);
  const dobYear = Number(profile.dobYear);
  const age = calculateExactAge(dobDay, dobMonth, dobYear);

  if (age < 18) {
    throw new HttpsError('invalid-argument', 'Only adults aged 18 or above may join IG Meet.');
  }

  const username = String(profile.username || '').trim().toLowerCase();
  if (!/^[a-z0-9._]{3,24}$/.test(username)) {
    throw new HttpsError('invalid-argument', 'Invalid username format.');
  }

  // Enforce unique username
  const existingUser = await db
    .collection('users')
    .where('username', '==', username)
    .limit(2)
    .get();
  if (!existingUser.empty && existingUser.docs.some((d) => d.id !== uid)) {
    throw new HttpsError('already-exists', 'Username is already taken.');
  }

  // Atomic Owner Admin bootstrap: first registered user becomes Owner Admin
  const ownerConfigRef = db.collection('adminConfig').doc('owner');

  const assignedRole = await db.runTransaction(async (tx): Promise<'owner' | 'user'> => {
    let role: 'owner' | 'user' = 'user';
    const ownerSnap = await tx.get(ownerConfigRef);
    if (!ownerSnap.exists) {
      role = 'owner';
      tx.set(ownerConfigRef, {
        ownerUid: uid,
        assignedAt: Date.now()
      });
    } else if (ownerSnap.data()?.ownerUid === uid) {
      role = 'owner';
    }

    const now = Date.now();
    const safeUser = {
      uid,
      email: request.auth?.token.email || String(profile.email || ''),
      fullName: String(profile.fullName || '').trim(),
      username,
      dobDay,
      dobMonth,
      dobYear,
      age,
      state: String(profile.state || ''),
      district: String(profile.district || ''),
      gender: String(profile.gender || 'Other'),
      interestedIn: String(profile.interestedIn || 'Everyone'),
      bio: String(profile.bio || '').trim(),
      photoUrl: String(profile.photoUrl || ''),
      gallery: Array.isArray(profile.gallery) ? profile.gallery.slice(0, 6) : [],
      verified: false,
      membershipTier: 'free',
      membershipExpiresAt: null,
      role,
      status: 'active',
      profileComplete: true,
      privacy: profile.privacy || {
        whoCanMessageMe: 'Everyone',
        showOnlineStatus: true,
        showLastSeen: true
      },
      notifications: profile.notifications || {
        allNotifications: true,
        likes: true,
        messages: true,
        newMatches: true,
        announcements: true
      },
      createdAt: now,
      updatedAt: now
    };

    tx.set(db.collection('users').doc(uid), safeUser, { merge: true });
    tx.set(
      db.collection('profiles').doc(uid),
      {
        uid,
        fullName: safeUser.fullName,
        username: safeUser.username,
        age: safeUser.age,
        state: safeUser.state,
        district: safeUser.district,
        gender: safeUser.gender,
        interestedIn: safeUser.interestedIn,
        bio: safeUser.bio,
        photoUrl: safeUser.photoUrl,
        gallery: safeUser.gallery,
        verified: false,
        membershipTier: 'free',
        status: 'active',
        createdAt: now
      },
      { merge: true }
    );

    return role;
  });

  if (assignedRole === 'owner') {
    await admin.auth().setCustomUserClaims(uid, { role: 'owner' });
  }

  if (Array.isArray(initialPosts)) {
    for (const post of initialPosts.slice(0, 2)) {
      if (post.imageUrl) {
        await db.collection('posts').add({
          uid,
          imageUrl: String(post.imageUrl),
          caption: String(post.caption || '').trim(),
          createdAt: Date.now()
        });
      }
    }
  }

  return { ok: true, role: assignedRole };
});

/**
 * Server-side payment approval activating membership only upon Owner Admin decision.
 */
export const approvePaymentRequest = onCall(async (request) => {
  const adminUid = assertAdmin(request.auth);
  const { requestId, approve, rejectionReason } = request.data as {
    requestId: string;
    approve: boolean;
    rejectionReason?: string;
  };

  const reqRef = db.collection('paymentRequests').doc(requestId);
  const reqSnap = await reqRef.get();
  if (!reqSnap.exists) throw new HttpsError('not-found', 'Payment request not found.');
  const data = reqSnap.data()!;
  const now = Date.now();

  if (!approve) {
    await reqRef.update({
      status: 'rejected',
      rejectionReason: String(rejectionReason || 'Payment could not be verified.'),
      approvedBy: adminUid,
      approvedAt: now
    });
    await db.collection('adminLogs').add({
      adminUid,
      action: 'REJECT_PAYMENT',
      target: data.uid,
      result: String(rejectionReason || 'Rejected'),
      createdAt: now
    });
    return { ok: true, status: 'rejected' };
  }

  const expiresAt = now + Number(data.validityDays || 30) * 86400000;
  const batch = db.batch();
  batch.update(reqRef, { status: 'approved', approvedBy: adminUid, approvedAt: now });
  batch.update(db.collection('users').doc(data.uid), {
    membershipTier: data.planTier,
    membershipExpiresAt: expiresAt,
    updatedAt: now
  });
  batch.update(db.collection('profiles').doc(data.uid), { membershipTier: data.planTier });
  await batch.commit();

  await db.collection('subscriptions').add({
    uid: data.uid,
    planId: data.planId,
    planTier: data.planTier,
    planName: data.planName,
    amountPaid: data.finalAmount,
    startDate: now,
    endDate: expiresAt,
    approvedBy: adminUid,
    createdAt: now
  });

  await db.collection('adminLogs').add({
    adminUid,
    action: 'APPROVE_PAYMENT',
    target: data.uid,
    result: `${data.planName} activated`,
    createdAt: now
  });

  return { ok: true, status: 'approved' };
});

/**
 * Server-side Blue Tick verification review.
 */
export const reviewVerificationRequest = onCall(async (request) => {
  const adminUid = assertAdmin(request.auth);
  const { requestId, approve, rejectionReason } = request.data as {
    requestId: string;
    approve: boolean;
    rejectionReason?: string;
  };

  const ref = db.collection('verificationRequests').doc(requestId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Verification request not found.');
  const data = snap.data()!;
  const now = Date.now();

  await ref.update({
    status: approve ? 'approved' : 'rejected',
    rejectionReason: approve ? '' : String(rejectionReason || 'Verification rejected.'),
    reviewedBy: adminUid,
    reviewedAt: now
  });

  if (approve) {
    await db.collection('users').doc(data.uid).update({ verified: true, updatedAt: now });
    await db.collection('profiles').doc(data.uid).update({ verified: true });
  }

  await db.collection('adminLogs').add({
    adminUid,
    action: approve ? 'APPROVE_VERIFICATION' : 'REJECT_VERIFICATION',
    target: data.uid,
    result: approve ? 'Verified' : String(rejectionReason || 'Rejected'),
    createdAt: now
  });

  return { ok: true };
});

/**
 * Secure full account deletion across Firestore and Firebase Auth.
 */
export const deleteUserAccountSecurely = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Authentication required.');
  const uid = request.auth.uid;

  const postsSnap = await db.collection('posts').where('uid', '==', uid).get();
  const batch = db.batch();
  postsSnap.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(db.collection('profiles').doc(uid));
  batch.delete(db.collection('users').doc(uid));
  await batch.commit();

  await admin.auth().deleteUser(uid);
  return { ok: true };
});
