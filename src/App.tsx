import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  where
} from 'firebase/firestore';
import {
  Compass,
  Flame,
  Heart,
  Loader2,
  MessageCircle,
  ShieldAlert,
  User as UserIcon,
  X
} from 'lucide-react';
import { auth, db } from './lib/firebase';
import {
  DEFAULT_PAYMENT_CONFIG,
  DEFAULT_PLANS,
  DEFAULT_PROMO_CONFIG,
  DEFAULT_SUPPORT_SLOTS
} from './lib/constants';
import {
  AppearanceTheme,
  AppNotification,
  MatchRecord,
  MembershipPlan,
  PaymentConfig,
  SupportContactSlot,
  SwipePromoConfig,
  UserProfile
} from './types/igmeet';
import {
  bindUserPresence,
  blockUserAccount,
  ensurePersonalChat,
  fetchMembershipPlans,
  fetchPaymentConfig,
  fetchSupportContacts,
  fetchSwipePromoConfig,
  fetchUserProfile,
  getAuthRoleFromClaims,
  recordSwipeWithMatch,
  submitReportRecord,
  subscribeUserNotifications,
  upsertSavedDeviceAccount
} from './services/igmeetService';
import { AuthFlow, CreateProfileScreen } from './components/AuthViews';
import { ExploreView, HomeSwipeView, ProfileDetailSheet } from './components/DiscoveryViews';
import { GlobalChatScreen, MessagesTabView, PersonalChatScreen } from './components/MessagingViews';
import {
  EditProfileScreen,
  ProfileTabView,
  SettingsHub
} from './components/ProfileSettingsViews';
import {
  FreeBlueTickFlow,
  MembershipUpgradeFlow,
  NotificationsScreen
} from './components/MembershipVerifyNotifViews';
import { AdminPanelView } from './components/AdminPanelView';

type BottomTab = 'home' | 'explore' | 'messages' | 'profile';
type OverlayRoute =
  | null
  | { type: 'notifications' }
  | { type: 'global_chat' }
  | { type: 'personal_chat'; chatId: string; peer: UserProfile }
  | { type: 'edit_profile' }
  | { type: 'settings'; initialSubView?: 'menu' | 'support_team' }
  | { type: 'upgrade' }
  | { type: 'verification' }
  | { type: 'admin' };

const THEME_STORAGE_KEY = 'igmeet_appearance_theme_v1';

export default function App() {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [claimRole, setClaimRole] = useState<'owner' | 'admin' | 'user'>('user');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);

  const [activeTab, setActiveTab] = useState<BottomTab>('home');
  const [overlay, setOverlay] = useState<OverlayRoute>(null);
  const [theme, setTheme] = useState<AppearanceTheme>(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return saved === 'dark' || saved === 'bw' ? saved : 'light';
  });

  // Live collections
  const [allProfiles, setAllProfiles] = useState<UserProfile[]>([]);
  const [swipedUids, setSwipedUids] = useState<Set<string>>(new Set());
  const [blockedUids, setBlockedUids] = useState<Set<string>>(new Set());
  const [matchedUids, setMatchedUids] = useState<Set<string>>(new Set());
  const [personalChats, setPersonalChats] = useState<MatchRecord[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [globalPreview, setGlobalPreview] = useState({ lastMessage: '', time: 0, unread: 0 });
  const [discoveryLoading, setDiscoveryLoading] = useState(false);

  // Admin-driven dynamic configs
  const [plans, setPlans] = useState<MembershipPlan[]>(DEFAULT_PLANS);
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig>(DEFAULT_PAYMENT_CONFIG);
  const [promoConfig, setPromoConfig] = useState<SwipePromoConfig>(DEFAULT_PROMO_CONFIG);
  const [supportSlots, setSupportSlots] = useState<SupportContactSlot[]>(DEFAULT_SUPPORT_SLOTS);

  // Modals & Toasts
  const [selectedProfileSheet, setSelectedProfileSheet] = useState<UserProfile | null>(null);
  const [matchModal, setMatchModal] = useState<{ peer: UserProfile; chatId: string } | null>(null);
  const [reportTarget, setReportTarget] = useState<{
    uid: string;
    name: string;
    context: 'profile' | 'personal_chat' | 'global_chat';
  } | null>(null);
  const [reportReason, setReportReason] = useState('Harassment or abusive behavior');
  const [reportDetails, setReportDetails] = useState('');
  const [toast, setToast] = useState<{ msg: string; tone: 'success' | 'error' | 'info' } | null>(null);

  const showToast = useCallback((msg: string, tone: 'success' | 'error' | 'info' = 'info') => {
    setToast({ msg, tone });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

  // Apply Appearance theme to documentElement
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark', 'theme-bw');
    if (theme === 'dark') root.classList.add('dark');
    if (theme === 'bw') root.classList.add('theme-bw');
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setAuthUser(user);
      setAuthReady(true);
      if (!user) {
        setProfile(null);
        setProfileLoaded(true);
        setClaimRole('user');
        setOverlay(null);
        return;
      }
      setProfileLoaded(false);
      const role = await getAuthRoleFromClaims(user);
      setClaimRole(role);
      try {
        const fetched = await fetchUserProfile(user.uid);
        setProfile(fetched);
        if (fetched && fetched.profileComplete) {
          upsertSavedDeviceAccount({
            uid: fetched.uid,
            email: fetched.email,
            fullName: fetched.fullName,
            username: fetched.username,
            photoUrl: fetched.photoUrl,
            provider: user.providerData[0]?.providerId || 'password'
          });
        }
      } catch {
        setProfile(null);
      } finally {
        setProfileLoaded(true);
      }
    });
    return () => unsub();
  }, []);

  // Live subscription to current user's profile doc (for verification/membership/status updates)
  useEffect(() => {
    if (!authUser) return;
    return onSnapshot(
      doc(db, 'users', authUser.uid),
      (snap) => {
        if (snap.exists()) {
          setProfile({ ...(snap.data() as UserProfile), uid: snap.id });
        }
      },
      () => {}
    );
  }, [authUser]);

  // Load admin-configured dynamic data
  const reloadDynamicConfigs = useCallback(async () => {
    const [p, pay, promo, sup] = await Promise.all([
      fetchMembershipPlans(),
      fetchPaymentConfig(),
      fetchSwipePromoConfig(),
      fetchSupportContacts()
    ]);
    setPlans(p);
    setPaymentConfig(pay);
    setPromoConfig(promo);
    setSupportSlots(sup);
  }, []);

  useEffect(() => {
    if (authUser && profile?.profileComplete) {
      reloadDynamicConfigs();
    }
  }, [authUser, profile?.profileComplete, reloadDynamicConfigs]);

  // Presence binding
  useEffect(() => {
    if (!profile?.profileComplete || profile.status !== 'active') return;
    return bindUserPresence(profile.uid, profile.privacy?.showOnlineStatus ?? true);
  }, [profile?.uid, profile?.profileComplete, profile?.status, profile?.privacy?.showOnlineStatus]);

  // Load discovery profiles, swipes, blocks
  const loadDiscovery = useCallback(async () => {
    if (!profile?.profileComplete) return;
    setDiscoveryLoading(true);
    try {
      const [usersSnap, likesSnap, passesSnap, superSnap, blockedSnap, matchesSnap] = await Promise.all([
        getDocs(query(collection(db, 'users'), limit(120))),
        getDocs(query(collection(db, 'likes'), where('fromUid', '==', profile.uid), limit(200))),
        getDocs(query(collection(db, 'passes'), where('fromUid', '==', profile.uid), limit(200))),
        getDocs(query(collection(db, 'superLikes'), where('fromUid', '==', profile.uid), limit(200))),
        getDocs(query(collection(db, 'blockedUsers'), where('blockerUid', '==', profile.uid), limit(100))),
        getDocs(query(collection(db, 'matches'), where('users', 'array-contains', profile.uid), limit(100)))
      ]);

      const blockedSet = new Set<string>(blockedSnap.docs.map((d) => String(d.data().blockedUid || '')));
      setBlockedUids(blockedSet);

      const swiped = new Set<string>([
        ...likesSnap.docs.map((d) => String(d.data().toUid || '')),
        ...passesSnap.docs.map((d) => String(d.data().toUid || '')),
        ...superSnap.docs.map((d) => String(d.data().toUid || ''))
      ]);
      setSwipedUids(swiped);

      const mSet = new Set<string>();
      matchesSnap.docs.forEach((d) => {
        const arr = (d.data().users as string[]) || [];
        arr.forEach((id) => {
          if (id !== profile.uid) mSet.add(id);
        });
      });
      setMatchedUids(mSet);

      const list = usersSnap.docs
        .map((d) => ({ ...(d.data() as UserProfile), uid: d.id }))
        .filter(
          (u) =>
            u.uid !== profile.uid &&
            u.profileComplete &&
            u.status === 'active' &&
            u.age >= 18 &&
            !blockedSet.has(u.uid)
        );
      setAllProfiles(list);
    } catch {
      setAllProfiles([]);
    } finally {
      setDiscoveryLoading(false);
    }
  }, [profile?.uid, profile?.profileComplete]);

  useEffect(() => {
    if (profile?.profileComplete && profile.status === 'active') {
      loadDiscovery();
    }
  }, [profile?.profileComplete, profile?.status, loadDiscovery]);

  // Real-time notifications
  useEffect(() => {
    if (!profile?.profileComplete) return;
    return subscribeUserNotifications(profile.uid, setNotifications);
  }, [profile?.uid, profile?.profileComplete]);

  // Real-time personal chats
  useEffect(() => {
    if (!profile?.profileComplete) return;
    const q = query(
      collection(db, 'personalChats'),
      where('users', 'array-contains', profile.uid),
      limit(60)
    );
    return onSnapshot(
      q,
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<MatchRecord, 'id'>) }))
          .sort((a, b) => (b.lastMessageAt || b.createdAt) - (a.lastMessageAt || a.createdAt));
        setPersonalChats(list);
      },
      () => setPersonalChats([])
    );
  }, [profile?.uid, profile?.profileComplete]);

  // Real-time global chat latest preview
  useEffect(() => {
    if (!profile?.profileComplete) return;
    const q = query(collection(db, 'globalChatMessages'), orderBy('createdAt', 'desc'), limit(1));
    return onSnapshot(
      q,
      (snap) => {
        if (!snap.empty) {
          const data = snap.docs[0].data();
          setGlobalPreview({
            lastMessage: data.text || (data.type === 'image' ? 'Shared a photo' : 'Shared media'),
            time: data.createdAt || 0,
            unread: 0
          });
        }
      },
      () => {}
    );
  }, [profile?.profileComplete]);

  const isAdmin =
    claimRole === 'owner' ||
    claimRole === 'admin' ||
    profile?.role === 'owner' ||
    profile?.role === 'admin';

  const profileMap = useMemo(() => {
    const m = new Map<string, UserProfile>();
    allProfiles.forEach((u) => m.set(u.uid, u));
    return m;
  }, [allProfiles]);

  // Home swipe candidates filtered by gender preference, not yet swiped, not blocked
  const swipeCandidates = useMemo(() => {
    if (!profile) return [];
    return allProfiles.filter((u) => {
      if (swipedUids.has(u.uid) || blockedUids.has(u.uid)) return false;
      if (profile.interestedIn !== 'Everyone' && u.gender !== profile.interestedIn) return false;
      return true;
    });
  }, [allProfiles, swipedUids, blockedUids, profile]);

  const chatRows = useMemo(() => {
    if (!profile) return [];
    return personalChats
      .map((chat) => {
        const peerUid = chat.users.find((id) => id !== profile.uid) || '';
        const peer = profileMap.get(peerUid);
        if (!peer || blockedUids.has(peer.uid)) return null;
        return { chat, peer };
      })
      .filter((x): x is { chat: MatchRecord; peer: UserProfile } => Boolean(x));
  }, [personalChats, profile, profileMap, blockedUids]);

  const horizontalProfiles = useMemo(() => {
    const matchedPeers = allProfiles.filter((u) => matchedUids.has(u.uid) && !blockedUids.has(u.uid));
    if (matchedPeers.length > 0) return matchedPeers;
    return allProfiles.filter((u) => !blockedUids.has(u.uid)).slice(0, 12);
  }, [allProfiles, matchedUids, blockedUids]);

  const unreadNotifications = notifications.filter((n) => !n.read).length;
  const unreadMessagesCount = useMemo(() => {
    if (!profile) return 0;
    return chatRows.reduce((sum, row) => sum + (row.chat.unreadBy?.[profile.uid] || 0), 0);
  }, [chatRows, profile]);

  const handleSwipe = async (target: UserProfile, action: 'like' | 'pass' | 'super_like') => {
    if (!profile) return;
    setSwipedUids((prev) => new Set(prev).add(target.uid));
    try {
      const res = await recordSwipeWithMatch(profile, target, action);
      if (res.matched && res.matchId) {
        setMatchedUids((prev) => new Set(prev).add(target.uid));
        setMatchModal({ peer: target, chatId: res.matchId });
      }
    } catch {
      showToast('Unable to save swipe right now.', 'error');
    }
  };

  const canDirectMessage = (target: UserProfile): boolean => {
    if (!profile) return false;
    if (target.privacy?.whoCanMessageMe === 'Only My Matches') {
      return matchedUids.has(target.uid);
    }
    return true;
  };

  const openChatWithUser = async (target: UserProfile) => {
    if (!profile) return;
    if (!canDirectMessage(target)) {
      showToast(`${target.fullName} only accepts messages from mutual matches.`, 'info');
      return;
    }
    try {
      const chatId = await ensurePersonalChat(profile.uid, target.uid);
      setSelectedProfileSheet(null);
      setOverlay({ type: 'personal_chat', chatId, peer: target });
    } catch {
      showToast('Unable to open chat.', 'error');
    }
  };

  const handleBlockPeer = async (target: UserProfile) => {
    if (!profile) return;
    try {
      await blockUserAccount(profile.uid, target);
      setBlockedUids((prev) => new Set(prev).add(target.uid));
      setSelectedProfileSheet(null);
      if (overlay?.type === 'personal_chat' && overlay.peer.uid === target.uid) {
        setOverlay(null);
      }
      showToast(`${target.fullName} has been blocked.`, 'info');
    } catch {
      showToast('Unable to block user.', 'error');
    }
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !reportTarget) return;
    try {
      await submitReportRecord({
        reporterId: profile.uid,
        reporterName: profile.fullName,
        reportedId: reportTarget.uid,
        reportedName: reportTarget.name,
        context: reportTarget.context,
        reason: reportReason,
        details: reportDetails.trim()
      });
      setReportTarget(null);
      setReportDetails('');
      showToast('Report submitted for Owner Admin review.', 'success');
    } catch {
      showToast('Unable to submit report.', 'error');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setOverlay(null);
      setActiveTab('home');
      showToast('Logged out successfully.', 'info');
    } catch {
      showToast('Unable to log out.', 'error');
    }
  };

  const renderMainContent = () => {
    if (!authReady || (authUser && !profileLoaded)) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-3 bg-[#FFF8FA] dark:bg-[#140E12]">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#FF2D78] to-[#E91E4D] flex items-center justify-center shadow-lg">
            <Heart className="w-7 h-7 text-white fill-white" />
          </div>
          <Loader2 className="w-5 h-5 animate-spin text-[#FF2D78]" />
          <p className="text-xs font-semibold text-[#6E5A63] dark:text-neutral-400">Loading IG Meet...</p>
        </div>
      );
    }

    if (!authUser) {
      return <AuthFlow onToast={showToast} />;
    }

    if (!profile || !profile.profileComplete) {
      return (
        <CreateProfileScreen
          uid={authUser.uid}
          email={authUser.email || ''}
          initialName={authUser.displayName || ''}
          providers={authUser.providerData.map((p) => p.providerId)}
          onBack={handleLogout}
          onCompleted={(completed) => {
            setProfile(completed);
            upsertSavedDeviceAccount({
              uid: completed.uid,
              email: completed.email,
              fullName: completed.fullName,
              username: completed.username,
              photoUrl: completed.photoUrl,
              provider: authUser.providerData[0]?.providerId || 'password'
            });
          }}
          onToast={showToast}
        />
      );
    }

    if (profile.status === 'banned' || profile.status === 'suspended') {
      return (
        <div className="flex flex-col items-center justify-center h-full px-6 text-center space-y-4 bg-[#FFF8FA] dark:bg-[#140E12]">
          <ShieldAlert className="w-12 h-12 text-red-500" />
          <h1 className="text-xl font-extrabold">
            Account {profile.status === 'banned' ? 'Banned' : 'Suspended'}
          </h1>
          <p className="text-sm text-[#6E5A63] dark:text-neutral-400">
            Your IG Meet account is currently {profile.status} by moderation. Contact our support team if you believe this is a mistake.
          </p>
          <button
            type="button"
            onClick={handleLogout}
            className="px-6 py-3 rounded-2xl bg-[#FF2D78] text-white text-sm font-bold"
          >
            Sign Out
          </button>
        </div>
      );
    }

    // Full-screen overlay routes
    if (overlay) {
      if (overlay.type === 'notifications') {
        return (
          <NotificationsScreen
            notifications={notifications}
            onBack={() => setOverlay(null)}
            onSelectNotification={(n) => {
              setOverlay(null);
              if (n.targetRoute?.startsWith('chat:')) {
                const cid = n.targetRoute.replace('chat:', '');
                const found = chatRows.find((r) => r.chat.id === cid);
                if (found) {
                  setOverlay({ type: 'personal_chat', chatId: cid, peer: found.peer });
                } else {
                  setActiveTab('messages');
                }
              } else if (n.targetRoute === 'upgrade') {
                setOverlay({ type: 'upgrade' });
              } else if (n.targetRoute === 'verification') {
                setOverlay({ type: 'verification' });
              } else if (n.targetRoute === 'explore') {
                setActiveTab('explore');
              }
            }}
          />
        );
      }

      if (overlay.type === 'global_chat') {
        return (
          <GlobalChatScreen
            me={profile}
            onlineCount={allProfiles.filter((u) => u.online).length + 1}
            blockedUids={blockedUids}
            onBack={() => setOverlay(null)}
            onReportUser={(uid, name) =>
              setReportTarget({ uid, name, context: 'global_chat' })
            }
            onBlockUid={(uid, name) => {
              const found = profileMap.get(uid);
              if (found) {
                handleBlockPeer(found);
              } else {
                blockUserAccount(profile.uid, {
                  ...profile,
                  uid,
                  fullName: name,
                  username: name.toLowerCase().replace(/\s+/g, ''),
                  photoUrl: ''
                }).then(() => {
                  setBlockedUids((prev) => new Set(prev).add(uid));
                  showToast(`${name} blocked.`, 'info');
                });
              }
            }}
            onOpenUpgrade={() => setOverlay({ type: 'upgrade' })}
            onToast={showToast}
          />
        );
      }

      if (overlay.type === 'personal_chat') {
        return (
          <PersonalChatScreen
            chatId={overlay.chatId}
            me={profile}
            peer={overlay.peer}
            onBack={() => setOverlay(null)}
            onViewProfile={(peer) => setSelectedProfileSheet(peer)}
            onBlockPeer={handleBlockPeer}
            onReportPeer={(peer) =>
              setReportTarget({ uid: peer.uid, name: peer.fullName, context: 'personal_chat' })
            }
            onOpenUpgrade={() => setOverlay({ type: 'upgrade' })}
            onToast={showToast}
          />
        );
      }

      if (overlay.type === 'edit_profile') {
        return (
          <EditProfileScreen
            me={profile}
            onBack={() => setOverlay(null)}
            onSaved={(updated) => {
              setProfile(updated);
              setOverlay(null);
            }}
            onOpenUpgrade={() => setOverlay({ type: 'upgrade' })}
            onOpenVerification={() => setOverlay({ type: 'verification' })}
            onToast={showToast}
          />
        );
      }

      if (overlay.type === 'settings') {
        return (
          <SettingsHub
            me={profile}
            theme={theme}
            initialSubView={overlay.initialSubView || 'menu'}
            supportSlots={supportSlots}
            onBack={() => setOverlay(null)}
            onChangeTheme={setTheme}
            onUpdateProfile={setProfile}
            onOpenEditProfile={() => setOverlay({ type: 'edit_profile' })}
            onOpenUpgrade={() => setOverlay({ type: 'upgrade' })}
            onLogoutCurrent={handleLogout}
            onAddAnotherAccount={handleLogout}
            onToast={showToast}
          />
        );
      }

      if (overlay.type === 'upgrade') {
        return (
          <MembershipUpgradeFlow
            me={profile}
            plans={plans}
            paymentConfig={paymentConfig}
            onBack={() => setOverlay(null)}
            onToast={showToast}
          />
        );
      }

      if (overlay.type === 'verification') {
        return (
          <FreeBlueTickFlow
            me={profile}
            onBack={() => setOverlay(null)}
            onToast={showToast}
          />
        );
      }

      if (overlay.type === 'admin' && isAdmin) {
        return (
          <AdminPanelView
            me={profile}
            plans={plans}
            paymentConfig={paymentConfig}
            promoConfig={promoConfig}
            supportSlots={supportSlots}
            onReloadConfig={reloadDynamicConfigs}
            onBack={() => setOverlay(null)}
            onToast={showToast}
          />
        );
      }
    }

    // 4-tab primary navigation views
    return (
      <div className="flex flex-col h-full">
        <main className="flex-1 min-h-0 overflow-hidden">
          {activeTab === 'home' && (
            <HomeSwipeView
              me={profile}
              candidates={swipeCandidates}
              promoConfig={promoConfig}
              unreadNotifications={unreadNotifications}
              loading={discoveryLoading}
              onOpenNotifications={() => setOverlay({ type: 'notifications' })}
              onSwipe={handleSwipe}
              onViewFullProfile={(u) => setSelectedProfileSheet(u)}
              onRefresh={loadDiscovery}
            />
          )}

          {activeTab === 'explore' && (
            <ExploreView
              me={profile}
              allProfiles={allProfiles}
              onViewFullProfile={(u) => setSelectedProfileSheet(u)}
            />
          )}

          {activeTab === 'messages' && (
            <MessagesTabView
              me={profile}
              matches={chatRows}
              horizontalProfiles={horizontalProfiles}
              globalPreview={globalPreview}
              onOpenGlobalChat={() => setOverlay({ type: 'global_chat' })}
              onOpenPersonalChat={(chatId, peer) =>
                setOverlay({ type: 'personal_chat', chatId, peer })
              }
              onOpenProfile={(peer) => setSelectedProfileSheet(peer)}
            />
          )}

          {activeTab === 'profile' && (
            <ProfileTabView
              me={profile}
              isAdmin={isAdmin}
              onOpenEditProfile={() => setOverlay({ type: 'edit_profile' })}
              onOpenSettings={() => setOverlay({ type: 'settings', initialSubView: 'menu' })}
              onOpenAdminPanel={() => setOverlay({ type: 'admin' })}
              onOpenSupportTeam={() => setOverlay({ type: 'settings', initialSubView: 'support_team' })}
              onLogout={handleLogout}
              onToast={showToast}
            />
          )}
        </main>

        {/* Bottom Navigation Bar (4 Tabs: Home, Explore, Messages, Profile) */}
        <nav className="shrink-0 bg-white dark:bg-[#1B1318] border-t border-pink-100 dark:border-white/10 px-2 py-2 grid grid-cols-4">
          {(
            [
              { id: 'home', label: 'Home', icon: Flame },
              { id: 'explore', label: 'Explore', icon: Compass },
              { id: 'messages', label: 'Messages', icon: MessageCircle, badge: unreadMessagesCount },
              { id: 'profile', label: 'Profile', icon: UserIcon }
            ] as {
              id: BottomTab;
              label: string;
              icon: React.ComponentType<{ className?: string }>;
              badge?: number;
            }[]
          ).map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex flex-col items-center justify-center gap-0.5 py-1 rounded-xl transition ${
                  active
                    ? 'text-[#FF2D78] font-bold'
                    : 'text-[#6E5A63] dark:text-neutral-400 font-medium'
                }`}
              >
                <div className="relative">
                  <Icon className="w-5 h-5" />
                  {tab.badge && tab.badge > 0 ? (
                    <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-[#E91E4D] text-white text-[10px] font-bold flex items-center justify-center">
                      {tab.badge > 99 ? '99+' : tab.badge}
                    </span>
                  ) : null}
                </div>
                <span className="text-[11px]">{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    );
  };

  return (
    <div className="min-h-[100dvh] w-full bg-[#F5E9EE] dark:bg-[#0C080A] flex items-center justify-center">
      {/* Mobile-first 360px-430px Shell */}
      <div className="relative w-full max-w-[430px] h-[100dvh] bg-[#FFF8FA] dark:bg-[#140E12] text-[#1F1218] dark:text-white shadow-2xl overflow-hidden flex flex-col">
        {renderMainContent()}

        {/* Profile Detail Sheet */}
        {selectedProfileSheet && (
          <ProfileDetailSheet
            user={selectedProfileSheet}
            canDirectMessage={canDirectMessage(selectedProfileSheet)}
            onClose={() => setSelectedProfileSheet(null)}
            onMessage={openChatWithUser}
            onReport={(u) => {
              setSelectedProfileSheet(null);
              setReportTarget({ uid: u.uid, name: u.fullName, context: 'profile' });
            }}
            onBlock={handleBlockPeer}
          />
        )}

        {/* It's a Match! Modal */}
        {matchModal && profile && (
          <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-5">
            <div className="w-full max-w-[360px] rounded-3xl bg-white dark:bg-[#1C1419] p-6 text-center space-y-4 shadow-2xl">
              <div className="flex items-center justify-center -space-x-3">
                <img
                  src={profile.photoUrl}
                  alt={profile.fullName}
                  className="w-20 h-20 rounded-full object-cover ring-4 ring-white dark:ring-[#1C1419]"
                />
                <img
                  src={matchModal.peer.photoUrl}
                  alt={matchModal.peer.fullName}
                  className="w-20 h-20 rounded-full object-cover ring-4 ring-white dark:ring-[#1C1419]"
                />
              </div>
              <div className="space-y-1">
                <h2 className="text-2xl font-black text-[#FF2D78]">It&apos;s a Match!</h2>
                <p className="text-xs text-[#6E5A63] dark:text-neutral-300">
                  You and {matchModal.peer.fullName} liked each other.
                </p>
              </div>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    const m = matchModal;
                    setMatchModal(null);
                    setOverlay({ type: 'personal_chat', chatId: m.chatId, peer: m.peer });
                  }}
                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-[#FF2D78] to-[#E91E4D] text-white text-sm font-bold"
                >
                  Send Message
                </button>
                <button
                  type="button"
                  onClick={() => setMatchModal(null)}
                  className="w-full py-2.5 rounded-2xl border border-pink-200 dark:border-white/15 text-xs font-bold"
                >
                  Continue Exploring
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Report Modal */}
        {reportTarget && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center">
            <form
              onSubmit={handleSubmitReport}
              className="w-full max-w-[430px] rounded-t-3xl bg-white dark:bg-[#1C1419] p-5 space-y-3.5"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-extrabold">Report {reportTarget.name}</h3>
                <button type="button" onClick={() => setReportTarget(null)}>
                  <X className="w-5 h-5" />
                </button>
              </div>
              <select
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                className="w-full rounded-xl border border-pink-200 dark:border-white/15 bg-transparent px-3 py-2.5 text-sm"
              >
                {[
                  'Harassment or abusive behavior',
                  'Fake or impersonation profile',
                  'Spam or scam',
                  'Inappropriate content',
                  'Underage user concern'
                ].map((r) => (
                  <option key={r} value={r} className="text-black">
                    {r}
                  </option>
                ))}
              </select>
              <textarea
                rows={3}
                placeholder="Additional details (optional)..."
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
                className="w-full rounded-xl border border-pink-200 dark:border-white/15 bg-transparent px-3 py-2.5 text-sm outline-none"
              />
              <button
                type="submit"
                className="w-full py-3 rounded-2xl bg-red-600 text-white text-sm font-bold"
              >
                Submit Report
              </button>
            </form>
          </div>
        )}

        {/* Toast Notification */}
        {toast && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] w-[92%] max-w-[390px] pointer-events-none">
            <div
              className={`px-4 py-3 rounded-2xl text-xs font-bold text-white shadow-xl text-center ${
                toast.tone === 'error'
                  ? 'bg-red-600'
                  : toast.tone === 'success'
                  ? 'bg-emerald-600'
                  : 'bg-[#1F1218]'
              }`}
            >
              {toast.msg}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
