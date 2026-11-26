export type GenderOption = 'Male' | 'Female' | 'Other';
export type InterestedInOption = 'Male' | 'Female' | 'Everyone';
export type AppearanceTheme = 'light' | 'dark' | 'bw';
export type MessagePermission = 'Everyone' | 'Only My Matches';
export type MembershipTier = 'free' | 'plus' | 'elite';

export interface NotificationPrefs {
  allNotifications: boolean;
  likes: boolean;
  messages: boolean;
  newMatches: boolean;
  announcements: boolean;
}

export interface PrivacyPrefs {
  whoCanMessageMe: MessagePermission;
  showOnlineStatus: boolean;
  showLastSeen: boolean;
}

export interface UserProfile {
  uid: string;
  email: string;
  phoneNumber?: string;
  fullName: string;
  username: string;
  dobDay: number;
  dobMonth: number;
  dobYear: number;
  age: number;
  state: string;
  district: string;
  gender: GenderOption;
  interestedIn: InterestedInOption;
  bio: string;
  photoUrl: string;
  gallery: string[];
  verified: boolean;
  membershipTier: MembershipTier;
  membershipExpiresAt?: number | null;
  profileTheme?: string;
  role: 'user' | 'admin' | 'owner';
  status: 'active' | 'suspended' | 'banned';
  profileComplete: boolean;
  privacy: PrivacyPrefs;
  notifications: NotificationPrefs;
  online?: boolean;
  lastSeen?: number;
  createdAt: number;
  updatedAt?: number;
  authProviders?: string[];
}

export interface UserPost {
  id: string;
  uid: string;
  imageUrl: string;
  caption: string;
  createdAt: number;
}

export interface TelegramPromotion {
  id: 'promo_1' | 'promo_2';
  slot: 1 | 2;
  enabled: boolean;
  coverImageUrl: string;
  heading: string;
  subheading: string;
  ctaText: string;
  inviteLink: string;
}

export interface SwipePromoConfig {
  interval: number;
  promos: TelegramPromotion[];
}

export interface MatchRecord {
  id: string;
  users: [string, string];
  createdAt: number;
  lastMessage?: string;
  lastMessageAt?: number;
  lastMessageSender?: string;
  unreadBy?: Record<string, number>;
}

export interface ChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  senderName?: string;
  senderPhoto?: string;
  type: 'text' | 'image' | 'video' | 'voice';
  text?: string;
  mediaUrl?: string;
  replyTo?: {
    id: string;
    senderName: string;
    preview: string;
  } | null;
  reactions?: Record<string, string>;
  readBy?: string[];
  deletedForEveryone?: boolean;
  createdAt: number;
}

export interface ChatThemePref {
  colorId: string;
  customBgUrl?: string;
}

export interface MembershipPlan {
  id: string;
  tier: 'plus' | 'elite';
  name: string;
  priceInr: number;
  validityDays: number;
  description: string;
  benefits: string[];
  enabled: boolean;
}

export interface PaymentConfig {
  upiId: string;
  merchantName: string;
  instructions: string;
}

export interface CouponCode {
  id: string;
  code: string;
  discountPercent: number;
  applicablePlan: 'plus' | 'elite' | 'both';
  expiresAt: number;
  maxUses: number;
  usedCount: number;
  enabled: boolean;
}

export interface PaymentRequest {
  id: string;
  uid: string;
  userName: string;
  userEmail: string;
  planId: string;
  planTier: 'plus' | 'elite';
  planName: string;
  validityDays: number;
  originalAmount: number;
  discountAmount: number;
  finalAmount: number;
  couponCode?: string;
  whatsappNumber: string;
  utrReference: string;
  screenshotUrl: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  approvedBy?: string;
  approvedAt?: number;
  createdAt: number;
}

export interface VerificationRequest {
  id: string;
  uid: string;
  username: string;
  submittedName: string;
  selfieUrl: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  reviewedBy?: string;
  reviewedAt?: number;
  createdAt: number;
}

export interface SupportRequest {
  id: string;
  uid: string;
  userName: string;
  category: string;
  reportedTarget?: string;
  description: string;
  screenshotUrl?: string;
  status: 'Pending' | 'Under Review' | 'Resolved' | 'Rejected';
  adminResponse?: string;
  createdAt: number;
  updatedAt?: number;
}

export interface SupportContactSlot {
  id: string;
  label: string;
  platform: 'Instagram' | 'Telegram' | 'WhatsApp';
  enabled: boolean;
  value: string;
}

export interface AnnouncementItem {
  id: string;
  title: string;
  message: string;
  createdBy: string;
  createdAt: number;
}

export interface AppNotification {
  id: string;
  uid: string;
  type: 'like' | 'match' | 'message' | 'super_like' | 'announcement' | 'membership' | 'verification' | 'system';
  title: string;
  description: string;
  actorId?: string;
  actorAvatar?: string;
  targetRoute?: string;
  read: boolean;
  createdAt: number;
}

export interface ReportRecord {
  id: string;
  reporterId: string;
  reporterName: string;
  reportedId: string;
  reportedName: string;
  context: 'profile' | 'personal_chat' | 'global_chat';
  reason: string;
  details: string;
  status: 'pending' | 'investigating' | 'resolved' | 'dismissed';
  resolution?: string;
  createdAt: number;
}

export interface AdminActivityLog {
  id: string;
  adminUid: string;
  action: string;
  target: string;
  result: string;
  createdAt: number;
}

export interface SavedDeviceAccount {
  uid: string;
  email: string;
  fullName: string;
  username: string;
  photoUrl: string;
  provider: string;
}
