import { MembershipPlan, PaymentConfig, SupportContactSlot, SwipePromoConfig } from '../types/igmeet';

export const MEMBERSHIP_BENEFITS: string[] = [
  'Blue Verification Badge eligibility and priority review',
  'Profile Theme Customization',
  'Personal Chat Theme with custom backgrounds',
  'Search Priority across Explore discovery',
  'Global Chat Photo and Video sharing',
  'Personal Chat Photo Sharing for both participants',
  'Voice Messages in personal chats',
  'Voice Calling access (SDK preview until connected)',
  'Video Calling access (SDK preview until connected)'
];

export const DEFAULT_PLANS: MembershipPlan[] = [
  {
    id: 'ig_meet_plus',
    tier: 'plus',
    name: 'IG Meet Plus',
    priceInr: 49,
    validityDays: 30,
    description: 'Essential premium discovery and chat upgrades for 30 days.',
    benefits: MEMBERSHIP_BENEFITS,
    enabled: true
  },
  {
    id: 'ig_meet_elite',
    tier: 'elite',
    name: 'IG Meet Elite',
    priceInr: 199,
    validityDays: 365,
    description: 'Full year of all premium IG Meet features at the best annual value.',
    benefits: MEMBERSHIP_BENEFITS,
    enabled: true
  }
];

export const DEFAULT_PAYMENT_CONFIG: PaymentConfig = {
  upiId: 'satpal.rawat01@fam',
  merchantName: 'IG Meet Membership',
  instructions: 'Scan the QR code or pay using the UPI ID above, then submit your payment screenshot, WhatsApp number, and 12-digit UTR reference for admin verification.'
};

export const DEFAULT_PROMO_CONFIG: SwipePromoConfig = {
  interval: 15,
  promos: [
    {
      id: 'promo_1',
      slot: 1,
      enabled: true,
      coverImageUrl: '',
      heading: 'IG Meet Official Community',
      subheading: 'Connect with verified members and stay updated with new releases.',
      ctaText: 'Open Community Channel',
      inviteLink: 'https://t.me/igmeet_official_1'
    },
    {
      id: 'promo_2',
      slot: 2,
      enabled: true,
      coverImageUrl: '',
      heading: 'IG Meet Events & Updates',
      subheading: 'Discover announcements, safety tips, and member highlights.',
      ctaText: 'Join Updates Group',
      inviteLink: 'https://t.me/igmeet_official_2'
    }
  ]
};

export const DEFAULT_SUPPORT_SLOTS: SupportContactSlot[] = [
  { id: 'instagram_1', label: 'Instagram 1', platform: 'Instagram', enabled: false, value: '' },
  { id: 'instagram_2', label: 'Instagram 2', platform: 'Instagram', enabled: false, value: '' },
  { id: 'telegram_1', label: 'Telegram 1', platform: 'Telegram', enabled: false, value: '' },
  { id: 'telegram_2', label: 'Telegram 2', platform: 'Telegram', enabled: false, value: '' },
  { id: 'whatsapp_1', label: 'WhatsApp 1', platform: 'WhatsApp', enabled: false, value: '' },
  { id: 'whatsapp_2', label: 'WhatsApp 2', platform: 'WhatsApp', enabled: false, value: '' }
];

export const SUPPORT_CATEGORIES: string[] = [
  'Fake Account',
  'Spam or Harassment',
  'Report a User',
  'Block User Issue',
  'Safety & Privacy Issue',
  'Payment or Membership Issue',
  'App Technical Problem',
  'Other Issue'
];

export const CHAT_THEMES = [
  { id: 'rose_blush', name: 'Rose Blush', bgClass: 'bg-[#FFF8FA] dark:bg-[#191116]', bubbleMe: 'bg-gradient-to-r from-[#FF2D78] to-[#E91E4D] text-white' },
  { id: 'crimson_velvet', name: 'Crimson Velvet', bgClass: 'bg-[#FFF0F3] dark:bg-[#230E15]', bubbleMe: 'bg-[#C2185B] text-white' },
  { id: 'midnight_indigo', name: 'Midnight Indigo', bgClass: 'bg-[#F0F4FF] dark:bg-[#0F172A]', bubbleMe: 'bg-[#3730A3] text-white' },
  { id: 'emerald_mist', name: 'Emerald Mist', bgClass: 'bg-[#ECFDF5] dark:bg-[#0B1F17]', bubbleMe: 'bg-[#047857] text-white' },
  { id: 'amber_sunset', name: 'Amber Sunset', bgClass: 'bg-[#FFFBEB] dark:bg-[#24180B]', bubbleMe: 'bg-[#C2410C] text-white' },
  { id: 'lavender_dusk', name: 'Lavender Dusk', bgClass: 'bg-[#F5F3FF] dark:bg-[#1A1228]', bubbleMe: 'bg-[#6D28D9] text-white' },
  { id: 'slate_minimal', name: 'Slate Minimal', bgClass: 'bg-[#F8FAFC] dark:bg-[#111318]', bubbleMe: 'bg-[#1E293B] text-white' }
];
