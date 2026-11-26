import React, { useEffect, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  updateDoc
} from 'firebase/firestore';
import {
  ArrowLeft,
  Users,
  Flag,
  Globe,
  Headphones,
  Crown,
  BadgeCheck,
  BarChart3,
  CreditCard,
  Megaphone,
  Send,
  HelpCircle,
  Wallet,
  Activity,
  History,
  ShieldAlert,
  Download,
  Settings,
  RefreshCw,
  Trash2,
  Check,
  X,
  Plus
} from 'lucide-react';
import { db } from '../lib/firebase';
import {
  AdminActivityLog,
  AnnouncementItem,
  ChatMessage,
  CouponCode,
  MembershipPlan,
  PaymentConfig,
  PaymentRequest,
  ReportRecord,
  SupportContactSlot,
  SupportRequest,
  SwipePromoConfig,
  UserProfile,
  VerificationRequest
} from '../types/igmeet';
import {
  adminApprovePayment,
  adminPublishAnnouncement,
  adminRejectPayment,
  adminReviewVerification,
  fetchAllAdminCollections,
  logAdminAction
} from '../services/igmeetService';

interface AdminPanelProps {
  me: UserProfile;
  plans: MembershipPlan[];
  paymentConfig: PaymentConfig;
  promoConfig: SwipePromoConfig;
  supportSlots: SupportContactSlot[];
  onReloadConfig: () => Promise<void>;
  onBack: () => void;
  onToast: (msg: string, tone?: 'success' | 'error' | 'info') => void;
}

type AdminSection =
  | 'dashboard'
  | 'users'
  | 'reports'
  | 'global_chat'
  | 'support_team'
  | 'plans'
  | 'verification'
  | 'analytics'
  | 'payment_requests'
  | 'announcements'
  | 'swipe_promos'
  | 'help_tickets'
  | 'payment_management'
  | 'activity_logs'
  | 'report_history'
  | 'moderation'
  | 'backup'
  | 'app_settings';

export function AdminPanelView({
  me,
  plans,
  paymentConfig,
  promoConfig,
  supportSlots,
  onReloadConfig,
  onBack,
  onToast
}: AdminPanelProps) {
  const [section, setSection] = useState<AdminSection>('dashboard');
  const [loading, setLoading] = useState(true);
  const [searchUser, setSearchUser] = useState('');

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [payments, setPayments] = useState<PaymentRequest[]>([]);
  const [verifications, setVerifications] = useState<VerificationRequest[]>([]);
  const [supportTickets, setSupportTickets] = useState<SupportRequest[]>([]);
  const [coupons, setCoupons] = useState<CouponCode[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [logs, setLogs] = useState<AdminActivityLog[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<Record<string, unknown>[]>([]);
  const [globalMessages, setGlobalMessages] = useState<ChatMessage[]>([]);

  // Editable states
  const [slotDraft, setSlotDraft] = useState<SupportContactSlot[]>(supportSlots);
  const [planDraft, setPlanDraft] = useState<MembershipPlan[]>(plans);
  const [payCfgDraft, setPayCfgDraft] = useState<PaymentConfig>(paymentConfig);
  const [promoDraft, setPromoDraft] = useState<SwipePromoConfig>(promoConfig);

  // Forms
  const [annTitle, setAnnTitle] = useState('');
  const [annMsg, setAnnMsg] = useState('');
  const [newCouponCode, setNewCouponCode] = useState('');
  const [newCouponPercent, setNewCouponPercent] = useState(20);
  const [newCouponPlan, setNewCouponPlan] = useState<'plus' | 'elite' | 'both'>('both');
  const [newCouponMaxUses, setNewCouponMaxUses] = useState(50);
  const [newCouponDays, setNewCouponDays] = useState(30);
  const [rejectReasonMap, setRejectReasonMap] = useState<Record<string, string>>({});
  const [ticketReplyMap, setTicketReplyMap] = useState<Record<string, string>>({});

  useEffect(() => {
    setSlotDraft(supportSlots);
    setPlanDraft(plans);
    setPayCfgDraft(paymentConfig);
    setPromoDraft(promoConfig);
  }, [supportSlots, plans, paymentConfig, promoConfig]);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchAllAdminCollections();
      setUsers(data.users);
      setReports(data.reports);
      setPayments(data.payments);
      setVerifications(data.verifications);
      setSupportTickets(data.supportTickets);
      setCoupons(data.coupons);
      setAnnouncements(data.announcements);
      setLogs(data.logs);
      setPaymentHistory(data.paymentHistory);

      const gSnap = await getDocs(
        query(collection(db, 'globalChatMessages'), orderBy('createdAt', 'desc'), limit(40))
      );
      setGlobalMessages(
        gSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ChatMessage, 'id'>) }))
      );
    } catch {
      onToast('Unable to load some admin collections. Verify Owner Admin claims and Firestore rules.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const totalUsers = users.length;
  const activeUsers = users.filter((u) => u.status === 'active').length;
  const pendingReports = reports.filter((r) => r.status === 'pending').length;
  const premiumMembers = users.filter((u) => u.membershipTier !== 'free').length;

  const setUserStatus = async (target: UserProfile, status: 'active' | 'suspended' | 'banned') => {
    try {
      await updateDoc(doc(db, 'users', target.uid), { status, updatedAt: Date.now() });
      await updateDoc(doc(db, 'profiles', target.uid), { status }).catch(() => {});
      await logAdminAction(me.uid, `USER_${status.toUpperCase()}`, target.uid, status);
      setUsers((prev) => prev.map((u) => (u.uid === target.uid ? { ...u, status } : u)));
      onToast(`${target.fullName} is now ${status}.`, 'success');
    } catch {
      onToast('Permission denied or failed updating user status.', 'error');
    }
  };

  const handleSaveSupportSlots = async () => {
    for (const slot of slotDraft) {
      if (slot.enabled && !slot.value.trim()) {
        onToast(`${slot.label} is enabled but empty. Enter a contact value or turn it off.`, 'error');
        return;
      }
    }
    try {
      await setDoc(doc(db, 'supportContacts', 'slots'), { slots: slotDraft, updatedAt: Date.now() });
      await logAdminAction(me.uid, 'UPDATE_SUPPORT_SLOTS', 'supportContacts', 'Saved');
      await onReloadConfig();
      onToast('Support Team contacts saved.', 'success');
    } catch {
      onToast('Unable to save support contacts.', 'error');
    }
  };

  const handleSavePlans = async () => {
    try {
      for (const plan of planDraft) {
        await setDoc(doc(db, 'membershipPlans', plan.id), plan);
      }
      await logAdminAction(me.uid, 'UPDATE_MEMBERSHIP_PLANS', 'membershipPlans', 'Saved');
      await onReloadConfig();
      onToast('Membership plans updated.', 'success');
    } catch {
      onToast('Unable to update membership plans.', 'error');
    }
  };

  const handleSavePaymentConfig = async () => {
    if (!payCfgDraft.upiId.trim()) {
      onToast('UPI ID cannot be empty.', 'error');
      return;
    }
    try {
      await setDoc(doc(db, 'adminSettings', 'payment'), payCfgDraft, { merge: true });
      await logAdminAction(me.uid, 'UPDATE_PAYMENT_CONFIG', payCfgDraft.upiId, 'Saved');
      await onReloadConfig();
      onToast('Payment settings saved.', 'success');
    } catch {
      onToast('Unable to save payment settings.', 'error');
    }
  };

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = newCouponCode.trim().toUpperCase();
    if (!code) return;
    try {
      await addDoc(collection(db, 'coupons'), {
        code,
        discountPercent: Number(newCouponPercent),
        applicablePlan: newCouponPlan,
        expiresAt: Date.now() + Number(newCouponDays) * 86400000,
        maxUses: Number(newCouponMaxUses),
        usedCount: 0,
        enabled: true
      });
      await logAdminAction(me.uid, 'CREATE_COUPON', code, 'Created');
      setNewCouponCode('');
      await loadData();
      onToast(`Coupon ${code} created.`, 'success');
    } catch {
      onToast('Unable to create coupon.', 'error');
    }
  };

  const handleSavePromos = async () => {
    try {
      await setDoc(doc(db, 'swipePromotions', 'config'), promoDraft);
      await logAdminAction(me.uid, 'UPDATE_SWIPE_PROMOS', `Interval ${promoDraft.interval}`, 'Saved');
      await onReloadConfig();
      onToast('Swipe promotional cards updated.', 'success');
    } catch {
      onToast('Unable to update swipe promotions.', 'error');
    }
  };

  const handleExportBackup = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      users,
      reports,
      payments,
      verifications,
      supportTickets,
      coupons,
      announcements,
      plans: planDraft,
      paymentConfig: payCfgDraft,
      promoConfig: promoDraft,
      supportSlots: slotDraft
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ig-meet-backup-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onToast('JSON backup exported.', 'success');
  };

  const adminTiles: { id: AdminSection; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'users', label: '1. Manage Users', icon: Users },
    { id: 'reports', label: '2. Reports', icon: Flag },
    { id: 'global_chat', label: '3. Global Chat', icon: Globe },
    { id: 'support_team', label: '4. Support Team', icon: Headphones },
    { id: 'plans', label: '5. Membership Plans', icon: Crown },
    { id: 'verification', label: '6. Verification', icon: BadgeCheck },
    { id: 'analytics', label: '7. Analytics', icon: BarChart3 },
    { id: 'payment_requests', label: '8. Payment Requests', icon: CreditCard },
    { id: 'announcements', label: '9. Announcements', icon: Megaphone },
    { id: 'swipe_promos', label: '10. Swipe Promotions', icon: Send },
    { id: 'help_tickets', label: '11. Help & Support', icon: HelpCircle },
    { id: 'payment_management', label: '12. Payment Management', icon: Wallet },
    { id: 'activity_logs', label: '13. User Activity Logs', icon: Activity },
    { id: 'report_history', label: '14. Report History', icon: History },
    { id: 'moderation', label: '15. Moderation', icon: ShieldAlert },
    { id: 'backup', label: '16. Backup & Recovery', icon: Download },
    { id: 'app_settings', label: '17. App Settings', icon: Settings }
  ];

  return (
    <div className="flex flex-col h-full bg-[#FFF8FA] dark:bg-[#140E12]">
      <header className="flex items-center justify-between px-4 py-3 bg-white dark:bg-[#1B1318] border-b border-pink-100 dark:border-white/10">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => (section === 'dashboard' ? onBack() : setSection('dashboard'))}
            className="p-1.5 rounded-xl hover:bg-pink-50 dark:hover:bg-white/5"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-base font-extrabold">Owner Admin Panel</h1>
            <p className="text-[11px] text-[#6E5A63] dark:text-neutral-400">
              {section === 'dashboard' ? 'Control Center' : adminTiles.find((t) => t.id === section)?.label}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={loadData}
          aria-label="Refresh admin data"
          className="p-2 rounded-xl bg-pink-50 dark:bg-white/10 text-[#FF2D78]"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-12">
        {section === 'dashboard' && (
          <>
            {/* Live Stats */}
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { label: 'Total Users', value: totalUsers },
                { label: 'Active Users', value: activeUsers },
                { label: 'Pending Reports', value: pendingReports },
                { label: 'Premium Members', value: premiumMembers }
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl bg-white dark:bg-[#1C1419] border border-pink-100 dark:border-white/10 p-3.5"
                >
                  <p className="text-[11px] font-semibold text-[#6E5A63] dark:text-neutral-400">
                    {stat.label}
                  </p>
                  <p className="text-2xl font-black text-[#FF2D78] tabular-nums mt-0.5">
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>

            {/* 17 Sections Grid */}
            <div className="grid grid-cols-2 gap-2.5">
              {adminTiles.map((tile) => {
                const Icon = tile.icon;
                return (
                  <button
                    key={tile.id}
                    type="button"
                    onClick={() => setSection(tile.id)}
                    className="p-3.5 rounded-2xl bg-white dark:bg-[#1C1419] border border-pink-100 dark:border-white/10 text-left flex items-center gap-2.5 hover:border-[#FF2D78] transition"
                  >
                    <Icon className="w-4.5 h-4.5 text-[#FF2D78] shrink-0" />
                    <span className="text-xs font-bold leading-snug">{tile.label}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* 1. Manage Users */}
        {section === 'users' && (
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Search by name, username, or email..."
              value={searchUser}
              onChange={(e) => setSearchUser(e.target.value)}
              className="w-full rounded-xl border border-pink-200 dark:border-white/15 bg-white dark:bg-[#1C1419] px-3.5 py-2.5 text-sm outline-none"
            />
            {users
              .filter((u) => {
                const q = searchUser.trim().toLowerCase();
                if (!q) return true;
                return (
                  u.fullName.toLowerCase().includes(q) ||
                  u.username.toLowerCase().includes(q) ||
                  u.email.toLowerCase().includes(q)
                );
              })
              .map((u) => (
                <div
                  key={u.uid}
                  className="rounded-2xl bg-white dark:bg-[#1C1419] border border-pink-100 dark:border-white/10 p-3.5 space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate">
                        {u.fullName} (@{u.username})
                      </p>
                      <p className="text-[11px] text-[#6E5A63] dark:text-neutral-400 truncate">
                        {u.email} &middot; {u.membershipTier.toUpperCase()} &middot; {u.status.toUpperCase()}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setUserStatus(u, 'active')}
                      className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-600 text-[11px] font-bold"
                    >
                      Activate
                    </button>
                    <button
                      type="button"
                      onClick={() => setUserStatus(u, 'suspended')}
                      className="px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-600 text-[11px] font-bold"
                    >
                      Suspend
                    </button>
                    <button
                      type="button"
                      onClick={() => setUserStatus(u, 'banned')}
                      className="px-2.5 py-1 rounded-lg bg-red-500/15 text-red-600 text-[11px] font-bold"
                    >
                      Ban
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* 2. Reports */}
        {section === 'reports' && (
          <div className="space-y-3">
            {reports.filter((r) => r.status === 'pending' || r.status === 'investigating').length === 0 ? (
              <p className="text-xs text-[#6E5A63]">No open reports.</p>
            ) : (
              reports
                .filter((r) => r.status === 'pending' || r.status === 'investigating')
                .map((r) => (
                  <div
                    key={r.id}
                    className="rounded-2xl bg-white dark:bg-[#1C1419] border border-pink-100 dark:border-white/10 p-4 space-y-2"
                  >
                    <p className="text-xs font-extrabold">
                      {r.reportedName} reported by {r.reporterName} ({r.context})
                    </p>
                    <p className="text-xs text-[#6E5A63] dark:text-neutral-300">
                      Reason: {r.reason} {r.details ? `— ${r.details}` : ''}
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          await updateDoc(doc(db, 'reports', r.id), {
                            status: 'resolved',
                            resolution: 'Resolved by Admin'
                          });
                          await logAdminAction(me.uid, 'RESOLVE_REPORT', r.id, 'Resolved');
                          await loadData();
                        }}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold"
                      >
                        Resolve
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await updateDoc(doc(db, 'reports', r.id), {
                            status: 'dismissed',
                            resolution: 'Dismissed by Admin'
                          });
                          await logAdminAction(me.uid, 'DISMISS_REPORT', r.id, 'Dismissed');
                          await loadData();
                        }}
                        className="px-3 py-1.5 rounded-xl bg-neutral-200 dark:bg-white/10 text-xs font-bold"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                ))
            )}
          </div>
        )}

        {/* 3. Global Chat Moderation */}
        {section === 'global_chat' && (
          <div className="space-y-2.5">
            {globalMessages.map((msg) => (
              <div
                key={msg.id}
                className="rounded-2xl bg-white dark:bg-[#1C1419] border border-pink-100 dark:border-white/10 p-3 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold">{msg.senderName}</p>
                  <p className="text-xs text-[#6E5A63] dark:text-neutral-300 truncate">
                    {msg.text || `[${msg.type}]`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await deleteDoc(doc(db, 'globalChatMessages', msg.id));
                    setGlobalMessages((prev) => prev.filter((m) => m.id !== msg.id));
                    await logAdminAction(me.uid, 'DELETE_GLOBAL_MESSAGE', msg.id, 'Deleted');
                  }}
                  className="p-2 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 4. Support Team (6 Slots) */}
        {section === 'support_team' && (
          <div className="space-y-3">
            {slotDraft.map((slot, idx) => (
              <div
                key={slot.id}
                className="rounded-2xl bg-white dark:bg-[#1C1419] border border-pink-100 dark:border-white/10 p-3.5 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold">{slot.label}</span>
                  <input
                    type="checkbox"
                    checked={slot.enabled}
                    onChange={(e) =>
                      setSlotDraft((prev) =>
                        prev.map((s, i) => (i === idx ? { ...s, enabled: e.target.checked } : s))
                      )
                    }
                    className="w-4 h-4 accent-[#FF2D78]"
                  />
                </div>
                <input
                  type="text"
                  placeholder={`Enter ${slot.platform} username, link, or phone`}
                  value={slot.value}
                  onChange={(e) =>
                    setSlotDraft((prev) =>
                      prev.map((s, i) => (i === idx ? { ...s, value: e.target.value } : s))
                    )
                  }
                  className="w-full rounded-xl border border-pink-200 dark:border-white/15 bg-transparent px-3 py-2 text-xs outline-none"
                />
              </div>
            ))}
            <button
              type="button"
              onClick={handleSaveSupportSlots}
              className="w-full py-3 rounded-2xl bg-[#FF2D78] text-white text-sm font-bold"
            >
              Save Support Team Contacts
            </button>
          </div>
        )}

        {/* 5. Membership Plans */}
        {section === 'plans' && (
          <div className="space-y-3">
            {planDraft.map((plan, idx) => (
              <div
                key={plan.id}
                className="rounded-2xl bg-white dark:bg-[#1C1419] border border-pink-100 dark:border-white/10 p-4 space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <input
                    type="text"
                    value={plan.name}
                    onChange={(e) =>
                      setPlanDraft((prev) =>
                        prev.map((p, i) => (i === idx ? { ...p, name: e.target.value } : p))
                      )
                    }
                    className="font-extrabold text-sm bg-transparent border-b border-pink-200 outline-none"
                  />
                  <label className="text-xs flex items-center gap-1.5">
                    <span>Enabled</span>
                    <input
                      type="checkbox"
                      checked={plan.enabled}
                      onChange={(e) =>
                        setPlanDraft((prev) =>
                          prev.map((p, i) => (i === idx ? { ...p, enabled: e.target.checked } : p))
                        )
                      }
                      className="accent-[#FF2D78]"
                    />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-bold">Price (INR)</label>
                    <input
                      type="number"
                      value={plan.priceInr}
                      onChange={(e) =>
                        setPlanDraft((prev) =>
                          prev.map((p, i) => (i === idx ? { ...p, priceInr: Number(e.target.value) } : p))
                        )
                      }
                      className="w-full rounded-xl border border-pink-200 dark:border-white/15 bg-transparent px-3 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold">Validity (Days)</label>
                    <input
                      type="number"
                      value={plan.validityDays}
                      onChange={(e) =>
                        setPlanDraft((prev) =>
                          prev.map((p, i) =>
                            i === idx ? { ...p, validityDays: Number(e.target.value) } : p
                          )
                        )
                      }
                      className="w-full rounded-xl border border-pink-200 dark:border-white/15 bg-transparent px-3 py-2 text-xs"
                    />
                  </div>
                </div>
                <textarea
                  rows={2}
                  value={plan.description}
                  onChange={(e) =>
                    setPlanDraft((prev) =>
                      prev.map((p, i) => (i === idx ? { ...p, description: e.target.value } : p))
                    )
                  }
                  className="w-full rounded-xl border border-pink-200 dark:border-white/15 bg-transparent px-3 py-2 text-xs"
                />
              </div>
            ))}
            <button
              type="button"
              onClick={handleSavePlans}
              className="w-full py-3 rounded-2xl bg-[#FF2D78] text-white text-sm font-bold"
            >
              Save Membership Plans
            </button>
          </div>
        )}

        {/* 6. Verification Requests */}
        {section === 'verification' && (
          <div className="space-y-3">
            {verifications.length === 0 ? (
              <p className="text-xs text-[#6E5A63]">No verification requests found.</p>
            ) : (
              verifications.map((req) => (
                <div
                  key={req.id}
                  className="rounded-2xl bg-white dark:bg-[#1C1419] border border-pink-100 dark:border-white/10 p-4 space-y-3"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={req.selfieUrl}
                      alt={req.submittedName}
                      className="w-16 h-16 rounded-2xl object-cover"
                    />
                    <div>
                      <p className="text-sm font-extrabold">{req.submittedName}</p>
                      <p className="text-xs text-[#6E5A63]">@{req.username}</p>
                      <span className="text-[10px] font-extrabold uppercase text-[#FF2D78]">
                        {req.status}
                      </span>
                    </div>
                  </div>
                  {req.status === 'pending' && (
                    <div className="space-y-2">
                      <input
                        type="text"
                        placeholder="Rejection reason (if rejecting)"
                        value={rejectReasonMap[req.id] || ''}
                        onChange={(e) =>
                          setRejectReasonMap((prev) => ({ ...prev, [req.id]: e.target.value }))
                        }
                        className="w-full rounded-xl border border-pink-200 dark:border-white/15 bg-transparent px-3 py-2 text-xs"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            await adminReviewVerification(me.uid, req, true);
                            await loadData();
                            onToast('Blue Tick approved.', 'success');
                          }}
                          className="py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center justify-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve</span>
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await adminReviewVerification(
                              me.uid,
                              req,
                              false,
                              rejectReasonMap[req.id] || 'Selfie did not match profile.'
                            );
                            await loadData();
                            onToast('Verification rejected.', 'info');
                          }}
                          className="py-2 rounded-xl bg-red-600 text-white text-xs font-bold flex items-center justify-center gap-1"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* 7. Analytics */}
        {section === 'analytics' && (
          <div className="rounded-2xl bg-white dark:bg-[#1C1419] border border-pink-100 dark:border-white/10 p-4 space-y-3 text-xs">
            <p className="font-extrabold text-sm">Platform Overview</p>
            <div className="flex justify-between"><span>Total Users</span><strong>{totalUsers}</strong></div>
            <div className="flex justify-between"><span>Verified Users</span><strong>{users.filter((u) => u.verified).length}</strong></div>
            <div className="flex justify-between"><span>IG Meet Plus</span><strong>{users.filter((u) => u.membershipTier === 'plus').length}</strong></div>
            <div className="flex justify-between"><span>IG Meet Elite</span><strong>{users.filter((u) => u.membershipTier === 'elite').length}</strong></div>
            <div className="flex justify-between"><span>Pending Payments</span><strong>{payments.filter((p) => p.status === 'pending').length}</strong></div>
            <div className="flex justify-between"><span>Open Support Tickets</span><strong>{supportTickets.filter((t) => t.status === 'Pending').length}</strong></div>
          </div>
        )}

        {/* 8. Payment Requests */}
        {section === 'payment_requests' && (
          <div className="space-y-3">
            {payments.length === 0 ? (
              <p className="text-xs text-[#6E5A63]">No payment requests submitted yet.</p>
            ) : (
              payments.map((req) => (
                <div
                  key={req.id}
                  className="rounded-2xl bg-white dark:bg-[#1C1419] border border-pink-100 dark:border-white/10 p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-extrabold">
                        {req.userName} &middot; {req.planName}
                      </p>
                      <p className="text-xs text-[#6E5A63] dark:text-neutral-400">
                        Amount: ₹{req.finalAmount} &middot; UTR: {req.utrReference}
                      </p>
                      <p className="text-xs text-[#6E5A63] dark:text-neutral-400">
                        WhatsApp: {req.whatsappNumber}
                      </p>
                    </div>
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-lg bg-pink-50 text-[#FF2D78]">
                      {req.status}
                    </span>
                  </div>
                  {req.screenshotUrl && (
                    <a
                      href={req.screenshotUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block"
                    >
                      <img
                        src={req.screenshotUrl}
                        alt="Payment screenshot"
                        className="w-full max-h-56 object-contain rounded-xl bg-black/5"
                      />
                    </a>
                  )}
                  {req.status === 'pending' && (
                    <div className="space-y-2">
                      <input
                        type="text"
                        placeholder="Rejection reason (if rejecting)"
                        value={rejectReasonMap[req.id] || ''}
                        onChange={(e) =>
                          setRejectReasonMap((prev) => ({ ...prev, [req.id]: e.target.value }))
                        }
                        className="w-full rounded-xl border border-pink-200 dark:border-white/15 bg-transparent px-3 py-2 text-xs"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            await adminApprovePayment(me.uid, req);
                            await loadData();
                            onToast('Payment approved and membership activated.', 'success');
                          }}
                          className="py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await adminRejectPayment(
                              me.uid,
                              req,
                              rejectReasonMap[req.id] || 'Payment could not be verified.'
                            );
                            await loadData();
                            onToast('Payment rejected.', 'info');
                          }}
                          className="py-2 rounded-xl bg-red-600 text-white text-xs font-bold"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* 9. Announcements */}
        {section === 'announcements' && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-white dark:bg-[#1C1419] border border-pink-100 dark:border-white/10 p-4 space-y-2.5">
              <input
                type="text"
                placeholder="Announcement Title"
                value={annTitle}
                onChange={(e) => setAnnTitle(e.target.value)}
                className="w-full rounded-xl border border-pink-200 dark:border-white/15 bg-transparent px-3 py-2 text-sm"
              />
              <textarea
                rows={3}
                placeholder="Announcement Message"
                value={annMsg}
                onChange={(e) => setAnnMsg(e.target.value)}
                className="w-full rounded-xl border border-pink-200 dark:border-white/15 bg-transparent px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={async () => {
                  if (!annTitle.trim() || !annMsg.trim()) return;
                  await adminPublishAnnouncement(me.uid, annTitle, annMsg);
                  setAnnTitle('');
                  setAnnMsg('');
                  await loadData();
                  onToast('Announcement published.', 'success');
                }}
                className="w-full py-2.5 rounded-xl bg-[#FF2D78] text-white text-xs font-bold"
              >
                Publish Announcement
              </button>
            </div>
            {announcements.map((a) => (
              <div
                key={a.id}
                className="rounded-2xl bg-white dark:bg-[#1C1419] border border-pink-100 dark:border-white/10 p-3.5 flex items-start justify-between gap-2"
              >
                <div>
                  <p className="text-xs font-extrabold">{a.title}</p>
                  <p className="text-xs text-[#6E5A63] dark:text-neutral-300 mt-0.5">{a.message}</p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await deleteDoc(doc(db, 'announcements', a.id));
                    await loadData();
                  }}
                  className="text-red-500 p-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 10. Swipe Promotions */}
        {section === 'swipe_promos' && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-white dark:bg-[#1C1419] border border-pink-100 dark:border-white/10 p-4 space-y-2">
              <label className="text-xs font-bold">Display Interval (every N real swipes)</label>
              <input
                type="number"
                min={1}
                max={100}
                value={promoDraft.interval}
                onChange={(e) =>
                  setPromoDraft((prev) => ({ ...prev, interval: Math.max(1, Number(e.target.value)) }))
                }
                className="w-full rounded-xl border border-pink-200 dark:border-white/15 bg-transparent px-3 py-2 text-sm"
              />
            </div>

            {promoDraft.promos.map((promo, idx) => (
              <div
                key={promo.id}
                className="rounded-2xl bg-white dark:bg-[#1C1419] border border-pink-100 dark:border-white/10 p-4 space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-extrabold">Telegram Group {promo.slot}</p>
                  <input
                    type="checkbox"
                    checked={promo.enabled}
                    onChange={(e) =>
                      setPromoDraft((prev) => ({
                        ...prev,
                        promos: prev.promos.map((p, i) =>
                          i === idx ? { ...p, enabled: e.target.checked } : p
                        )
                      }))
                    }
                    className="accent-[#FF2D78]"
                  />
                </div>
                <input
                  type="text"
                  placeholder="Heading"
                  value={promo.heading}
                  onChange={(e) =>
                    setPromoDraft((prev) => ({
                      ...prev,
                      promos: prev.promos.map((p, i) =>
                        i === idx ? { ...p, heading: e.target.value } : p
                      )
                    }))
                  }
                  className="w-full rounded-xl border border-pink-200 dark:border-white/15 bg-transparent px-3 py-2 text-xs"
                />
                <input
                  type="text"
                  placeholder="Subheading"
                  value={promo.subheading}
                  onChange={(e) =>
                    setPromoDraft((prev) => ({
                      ...prev,
                      promos: prev.promos.map((p, i) =>
                        i === idx ? { ...p, subheading: e.target.value } : p
                      )
                    }))
                  }
                  className="w-full rounded-xl border border-pink-200 dark:border-white/15 bg-transparent px-3 py-2 text-xs"
                />
                <input
                  type="text"
                  placeholder="CTA Button Text"
                  value={promo.ctaText}
                  onChange={(e) =>
                    setPromoDraft((prev) => ({
                      ...prev,
                      promos: prev.promos.map((p, i) =>
                        i === idx ? { ...p, ctaText: e.target.value } : p
                      )
                    }))
                  }
                  className="w-full rounded-xl border border-pink-200 dark:border-white/15 bg-transparent px-3 py-2 text-xs"
                />
                <input
                  type="url"
                  placeholder="Telegram Invite Link"
                  value={promo.inviteLink}
                  onChange={(e) =>
                    setPromoDraft((prev) => ({
                      ...prev,
                      promos: prev.promos.map((p, i) =>
                        i === idx ? { ...p, inviteLink: e.target.value } : p
                      )
                    }))
                  }
                  className="w-full rounded-xl border border-pink-200 dark:border-white/15 bg-transparent px-3 py-2 text-xs"
                />
                <input
                  type="url"
                  placeholder="Cover Image URL (Optional)"
                  value={promo.coverImageUrl}
                  onChange={(e) =>
                    setPromoDraft((prev) => ({
                      ...prev,
                      promos: prev.promos.map((p, i) =>
                        i === idx ? { ...p, coverImageUrl: e.target.value } : p
                      )
                    }))
                  }
                  className="w-full rounded-xl border border-pink-200 dark:border-white/15 bg-transparent px-3 py-2 text-xs"
                />
              </div>
            ))}

            <button
              type="button"
              onClick={handleSavePromos}
              className="w-full py-3 rounded-2xl bg-[#FF2D78] text-white text-sm font-bold"
            >
              Save Swipe Promotions
            </button>
          </div>
        )}

        {/* 11. Help & Support Management */}
        {section === 'help_tickets' && (
          <div className="space-y-3">
            {supportTickets.map((t) => (
              <div
                key={t.id}
                className="rounded-2xl bg-white dark:bg-[#1C1419] border border-pink-100 dark:border-white/10 p-4 space-y-2.5"
              >
                <div className="flex justify-between">
                  <p className="text-xs font-extrabold">
                    {t.userName} &middot; {t.category}
                  </p>
                  <span className="text-[10px] font-bold text-[#FF2D78]">{t.status}</span>
                </div>
                <p className="text-xs text-[#6E5A63] dark:text-neutral-300">{t.description}</p>
                <input
                  type="text"
                  placeholder="Write admin response..."
                  value={ticketReplyMap[t.id] ?? t.adminResponse ?? ''}
                  onChange={(e) =>
                    setTicketReplyMap((prev) => ({ ...prev, [t.id]: e.target.value }))
                  }
                  className="w-full rounded-xl border border-pink-200 dark:border-white/15 bg-transparent px-3 py-2 text-xs"
                />
                <div className="flex gap-1.5 flex-wrap">
                  {(['Under Review', 'Resolved', 'Rejected'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={async () => {
                        await updateDoc(doc(db, 'supportRequests', t.id), {
                          status: st,
                          adminResponse: ticketReplyMap[t.id] ?? t.adminResponse ?? '',
                          updatedAt: Date.now()
                        });
                        await logAdminAction(me.uid, 'UPDATE_SUPPORT_TICKET', t.id, st);
                        await loadData();
                        onToast(`Ticket marked ${st}.`, 'success');
                      }}
                      className="px-2.5 py-1 rounded-lg bg-pink-50 dark:bg-white/10 text-[#FF2D78] text-[11px] font-bold"
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 12. Payment Management (UPI, Coupons, Payment History) */}
        {section === 'payment_management' && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-white dark:bg-[#1C1419] border border-pink-100 dark:border-white/10 p-4 space-y-2.5">
              <p className="text-xs font-extrabold">UPI &amp; QR Configuration</p>
              <input
                type="text"
                placeholder="UPI ID"
                value={payCfgDraft.upiId}
                onChange={(e) => setPayCfgDraft((p) => ({ ...p, upiId: e.target.value }))}
                className="w-full rounded-xl border border-pink-200 dark:border-white/15 bg-transparent px-3 py-2 text-xs"
              />
              <input
                type="text"
                placeholder="Merchant Display Name"
                value={payCfgDraft.merchantName}
                onChange={(e) => setPayCfgDraft((p) => ({ ...p, merchantName: e.target.value }))}
                className="w-full rounded-xl border border-pink-200 dark:border-white/15 bg-transparent px-3 py-2 text-xs"
              />
              <textarea
                rows={2}
                placeholder="Payment Instructions"
                value={payCfgDraft.instructions}
                onChange={(e) => setPayCfgDraft((p) => ({ ...p, instructions: e.target.value }))}
                className="w-full rounded-xl border border-pink-200 dark:border-white/15 bg-transparent px-3 py-2 text-xs"
              />
              <button
                type="button"
                onClick={handleSavePaymentConfig}
                className="w-full py-2.5 rounded-xl bg-[#FF2D78] text-white text-xs font-bold"
              >
                Save UPI Settings
              </button>
            </div>

            <form
              onSubmit={handleCreateCoupon}
              className="rounded-2xl bg-white dark:bg-[#1C1419] border border-pink-100 dark:border-white/10 p-4 space-y-2.5"
            >
              <p className="text-xs font-extrabold">Create Coupon Code</p>
              <input
                type="text"
                required
                placeholder="Code (e.g. WELCOME20)"
                value={newCouponCode}
                onChange={(e) => setNewCouponCode(e.target.value.toUpperCase())}
                className="w-full rounded-xl border border-pink-200 dark:border-white/15 bg-transparent px-3 py-2 text-xs uppercase"
              />
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={newCouponPercent}
                  onChange={(e) => setNewCouponPercent(Number(e.target.value))}
                  placeholder="% Off"
                  className="rounded-xl border border-pink-200 dark:border-white/15 bg-transparent px-2.5 py-2 text-xs"
                />
                <input
                  type="number"
                  min={1}
                  value={newCouponMaxUses}
                  onChange={(e) => setNewCouponMaxUses(Number(e.target.value))}
                  placeholder="Max Uses"
                  className="rounded-xl border border-pink-200 dark:border-white/15 bg-transparent px-2.5 py-2 text-xs"
                />
                <input
                  type="number"
                  min={1}
                  value={newCouponDays}
                  onChange={(e) => setNewCouponDays(Number(e.target.value))}
                  placeholder="Days"
                  className="rounded-xl border border-pink-200 dark:border-white/15 bg-transparent px-2.5 py-2 text-xs"
                />
              </div>
              <select
                value={newCouponPlan}
                onChange={(e) => setNewCouponPlan(e.target.value as 'plus' | 'elite' | 'both')}
                className="w-full rounded-xl border border-pink-200 dark:border-white/15 bg-transparent px-3 py-2 text-xs"
              >
                <option value="both" className="text-black">Both Plans</option>
                <option value="plus" className="text-black">Plus Only</option>
                <option value="elite" className="text-black">Elite Only</option>
              </select>
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-[#FF2D78] text-white text-xs font-bold flex items-center justify-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Coupon</span>
              </button>
            </form>

            <div className="space-y-2">
              <p className="text-xs font-extrabold">Active Coupons ({coupons.length})</p>
              {coupons.map((c) => (
                <div
                  key={c.id}
                  className="rounded-2xl bg-white dark:bg-[#1C1419] border border-pink-100 dark:border-white/10 p-3 flex items-center justify-between text-xs"
                >
                  <div>
                    <p className="font-bold">
                      {c.code} ({c.discountPercent}% off)
                    </p>
                    <p className="text-[11px] text-[#6E5A63]">
                      Used {c.usedCount}/{c.maxUses} &middot; {c.applicablePlan}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        await updateDoc(doc(db, 'coupons', c.id), { enabled: !c.enabled });
                        await loadData();
                      }}
                      className="px-2 py-1 rounded-lg bg-pink-50 text-[#FF2D78] font-bold"
                    >
                      {c.enabled ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await deleteDoc(doc(db, 'coupons', c.id));
                        await loadData();
                      }}
                      className="text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-extrabold">Approved Payment History ({paymentHistory.length})</p>
              {paymentHistory.map((h, i) => (
                <div
                  key={String(h.id || i)}
                  className="rounded-xl bg-white dark:bg-[#1C1419] border border-pink-100 dark:border-white/10 p-3 text-xs flex justify-between"
                >
                  <span>{String(h.userName || '')} &middot; {String(h.planName || '')}</span>
                  <strong>₹{String(h.amount || 0)}</strong>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 13. Activity Logs */}
        {section === 'activity_logs' && (
          <div className="space-y-2">
            {logs.map((log) => (
              <div
                key={log.id}
                className="rounded-xl bg-white dark:bg-[#1C1419] border border-pink-100 dark:border-white/10 p-3 text-xs"
              >
                <p className="font-bold">{log.action}</p>
                <p className="text-[#6E5A63] dark:text-neutral-400">
                  Target: {log.target} &middot; {log.result}
                </p>
                <p className="text-[10px] opacity-60 mt-0.5">
                  {new Date(log.createdAt).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* 14. Report History */}
        {section === 'report_history' && (
          <div className="space-y-2">
            {reports.map((r) => (
              <div
                key={r.id}
                className="rounded-xl bg-white dark:bg-[#1C1419] border border-pink-100 dark:border-white/10 p-3 text-xs"
              >
                <p className="font-bold">
                  {r.reportedName} ({r.status})
                </p>
                <p className="text-[#6E5A63] dark:text-neutral-400">{r.reason}</p>
              </div>
            ))}
          </div>
        )}

        {/* 15. Moderation */}
        {section === 'moderation' && (
          <div className="rounded-2xl bg-white dark:bg-[#1C1419] border border-pink-100 dark:border-white/10 p-4 space-y-2 text-xs">
            <p className="text-sm font-extrabold">Moderation Queue Summary</p>
            <p>Suspended accounts: {users.filter((u) => u.status === 'suspended').length}</p>
            <p>Banned accounts: {users.filter((u) => u.status === 'banned').length}</p>
            <p>Open reports: {pendingReports}</p>
            <p>Pending verifications: {verifications.filter((v) => v.status === 'pending').length}</p>
          </div>
        )}

        {/* 16. Backup & Data Recovery */}
        {section === 'backup' && (
          <div className="rounded-2xl bg-white dark:bg-[#1C1419] border border-pink-100 dark:border-white/10 p-5 space-y-3">
            <h2 className="text-sm font-extrabold">Backup &amp; Data Recovery</h2>
            <p className="text-xs text-[#6E5A63] dark:text-neutral-400">
              Export a JSON snapshot of IG Meet users, plans, payment requests, verification queue, support tickets, and admin settings.
            </p>
            <button
              type="button"
              onClick={handleExportBackup}
              className="w-full py-3 rounded-2xl bg-[#FF2D78] text-white text-sm font-bold flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>Download JSON Backup</span>
            </button>
          </div>
        )}

        {/* 17. App Settings */}
        {section === 'app_settings' && (
          <div className="rounded-2xl bg-white dark:bg-[#1C1419] border border-pink-100 dark:border-white/10 p-4 space-y-2 text-xs">
            <p className="text-sm font-extrabold">IG Meet Runtime Configuration</p>
            <p>Firebase Project: <strong>ig-meet--find-your-partner</strong></p>
            <p>Android Package: <strong>Ig_meet.in</strong></p>
            <p>Age Enforcement: <strong>Strictly 18+</strong></p>
            <p>Owner Admin UID: <strong>{me.uid}</strong></p>
          </div>
        )}
      </div>
    </div>
  );
}
