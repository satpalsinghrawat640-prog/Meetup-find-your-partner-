import React, { useMemo, useRef, useState } from 'react';
import {
  Bell,
  X,
  Heart,
  Star,
  MapPin,
  BadgeCheck,
  Search,
  SlidersHorizontal,
  Send,
  ExternalLink,
  Flag,
  Ban,
  RefreshCw,
  User as UserIcon
} from 'lucide-react';
import { INDIAN_STATES, INDIAN_STATES_DISTRICTS } from '../data/indianLocations';
import {
  GenderOption,
  SwipePromoConfig,
  TelegramPromotion,
  UserProfile
} from '../types/igmeet';

interface HomeSwipeProps {
  me: UserProfile;
  candidates: UserProfile[];
  promoConfig: SwipePromoConfig;
  unreadNotifications: number;
  loading: boolean;
  onOpenNotifications: () => void;
  onSwipe: (target: UserProfile, action: 'like' | 'pass' | 'super_like') => Promise<void>;
  onViewFullProfile: (user: UserProfile) => void;
  onRefresh: () => void;
}

export function HomeSwipeView({
  candidates,
  promoConfig,
  unreadNotifications,
  loading,
  onOpenNotifications,
  onSwipe,
  onViewFullProfile,
  onRefresh
}: HomeSwipeProps) {
  const [realSwipeCount, setRealSwipeCount] = useState(0);
  const [activePromo, setActivePromo] = useState<TelegramPromotion | null>(null);
  const [nextPromoSlot, setNextPromoSlot] = useState<0 | 1>(0);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);

  const enabledPromos = useMemo(
    () => promoConfig.promos.filter((p) => p.enabled && p.heading.trim()),
    [promoConfig]
  );

  const topProfile = candidates[0] || null;
  const nextProfile = candidates[1] || null;

  const triggerRealSwipe = async (action: 'like' | 'pass' | 'super_like') => {
    if (!topProfile) return;
    const nextCount = realSwipeCount + 1;
    setRealSwipeCount(nextCount);
    setDragOffset({ x: 0, y: 0 });
    await onSwipe(topProfile, action);

    const interval = Math.max(1, promoConfig.interval || 15);
    if (enabledPromos.length > 0 && nextCount % interval === 0) {
      const chosen = enabledPromos[nextPromoSlot % enabledPromos.length];
      setActivePromo(chosen);
      setNextPromoSlot((prev) => (prev === 0 ? 1 : 0));
    }
  };

  const dismissPromo = () => {
    // Dismissing a promotional card does NOT count as a real profile swipe
    setActivePromo(null);
    setDragOffset({ x: 0, y: 0 });
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button, a')) return;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragStartRef.current) return;
    setDragOffset({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y
    });
  };

  const handlePointerUp = () => {
    if (!dragStartRef.current) return;
    const { x, y } = dragOffset;
    dragStartRef.current = null;

    if (activePromo) {
      if (Math.abs(x) > 95) {
        dismissPromo();
      } else {
        setDragOffset({ x: 0, y: 0 });
      }
      return;
    }

    if (x > 100) {
      triggerRealSwipe('like');
    } else if (x < -100) {
      triggerRealSwipe('pass');
    } else if (y < -110 && Math.abs(x) < 80) {
      triggerRealSwipe('super_like');
    } else {
      setDragOffset({ x: 0, y: 0 });
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#FFF8FA] dark:bg-[#140E12]">
      {/* Home Header: IG Meet left + Notification Bell top-right (NO filter button on Home) */}
      <header className="h-14 px-4 flex items-center justify-between bg-white/95 dark:bg-[#1C1419]/95 border-b border-rose-100 dark:border-neutral-800 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#FF2D78] to-[#E91E4D] flex items-center justify-center">
            <Heart className="w-4 h-4 text-white fill-white" />
          </div>
          <span className="text-lg font-extrabold tracking-tight text-[#1A1015] dark:text-white">
            IG Meet
          </span>
        </div>

        <button
          type="button"
          onClick={onOpenNotifications}
          aria-label="Notifications"
          className="relative w-11 h-11 rounded-full flex items-center justify-center text-[#1A1015] dark:text-white hover:bg-rose-50 dark:hover:bg-neutral-800"
        >
          <Bell className="w-5 h-5" />
          {unreadNotifications > 0 && (
            <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#FF2D78] text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
              {unreadNotifications > 99 ? '99+' : unreadNotifications}
            </span>
          )}
        </button>
      </header>

      {/* Card Stack Area */}
      <div className="flex-1 px-3.5 pt-3 pb-2 flex flex-col min-h-0">
        <div className="relative flex-1 min-h-[340px]">
          {loading ? (
            <div className="h-full rounded-3xl bg-white dark:bg-[#1D151A] border border-rose-100 dark:border-neutral-800 flex flex-col items-center justify-center text-sm text-[#6E5A63] dark:text-neutral-400 gap-3">
              <RefreshCw className="w-6 h-6 text-[#FF2D78] animate-spin" />
              <span>Loading discovery profiles...</span>
            </div>
          ) : activePromo ? (
            /* Admin-Managed Telegram Promotional Card */
            <div
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              style={{
                transform: `translate3d(${dragOffset.x}px, ${dragOffset.y * 0.3}px, 0) rotate(${dragOffset.x * 0.05}deg)`
              }}
              className="absolute inset-0 rounded-3xl overflow-hidden bg-gradient-to-br from-[#FF2D78] via-[#E91E4D] to-[#7A1036] text-white shadow-xl touch-none select-none flex flex-col justify-between"
            >
              <a
                href={activePromo.inviteLink}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute inset-0 z-10"
                aria-label={activePromo.heading}
              />
              {activePromo.coverImageUrl && (
                <img
                  src={activePromo.coverImageUrl}
                  alt={activePromo.heading}
                  className="absolute inset-0 w-full h-full object-cover opacity-35 pointer-events-none"
                />
              )}
              <div className="relative z-20 p-4 flex items-center justify-between">
                <span className="text-xs font-bold tracking-wide uppercase text-white/90">
                  Sponsored Channel · Slot {activePromo.slot}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    dismissPromo();
                  }}
                  aria-label="Dismiss promotion"
                  className="w-10 h-10 rounded-full bg-black/35 flex items-center justify-center text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="relative z-20 p-6 space-y-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none">
                <h2 className="text-2xl font-extrabold leading-tight">{activePromo.heading}</h2>
                <p className="text-sm text-white/90">{activePromo.subheading}</p>
                <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-[#E91E4D] font-bold text-sm">
                  <span>{activePromo.ctaText || 'Open Link'}</span>
                  <ExternalLink className="w-4 h-4" />
                </div>
              </div>
            </div>
          ) : !topProfile ? (
            <div className="h-full rounded-3xl bg-white dark:bg-[#1D151A] border border-rose-100 dark:border-neutral-800 flex flex-col items-center justify-center text-center p-6 gap-3">
              <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-[#FF2D78] flex items-center justify-center">
                <UserIcon className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold">No more profiles right now</h3>
              <p className="text-xs text-[#6E5A63] dark:text-neutral-400 max-w-[260px]">
                You have reviewed all currently eligible profiles matching your preferences. Check Explore or refresh later.
              </p>
              <button
                type="button"
                onClick={onRefresh}
                className="px-5 h-11 rounded-xl bg-gradient-to-r from-[#FF2D78] to-[#E91E4D] text-white text-xs font-bold inline-flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Refresh Profiles</span>
              </button>
            </div>
          ) : (
            <>
              {/* Back card preview */}
              {nextProfile && (
                <div className="absolute inset-0 rounded-3xl overflow-hidden bg-neutral-900 scale-[0.96] translate-y-2 opacity-60 pointer-events-none">
                  {nextProfile.photoUrl && (
                    <img
                      src={nextProfile.photoUrl}
                      alt={nextProfile.fullName}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
              )}

              {/* Active top swipeable card */}
              <div
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                style={{
                  transform: `translate3d(${dragOffset.x}px, ${dragOffset.y}px, 0) rotate(${dragOffset.x * 0.055}deg)`
                }}
                className="absolute inset-0 rounded-3xl overflow-hidden bg-neutral-900 shadow-xl touch-none select-none cursor-grab active:cursor-grabbing"
              >
                {topProfile.photoUrl ? (
                  <img
                    src={topProfile.photoUrl}
                    alt={topProfile.fullName}
                    className="w-full h-full object-cover pointer-events-none"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-[#FF2D78] to-[#E91E4D] flex items-center justify-center text-white text-5xl font-extrabold">
                    {topProfile.fullName.charAt(0).toUpperCase()}
                  </div>
                )}

                {/* Swipe feedback overlays */}
                {dragOffset.x > 30 && (
                  <div className="absolute top-6 left-5 px-4 py-1.5 rounded-xl border-4 border-emerald-400 text-emerald-400 font-extrabold text-xl -rotate-12 bg-black/25">
                    LIKE
                  </div>
                )}
                {dragOffset.x < -30 && (
                  <div className="absolute top-6 right-5 px-4 py-1.5 rounded-xl border-4 border-rose-400 text-rose-400 font-extrabold text-xl rotate-12 bg-black/25">
                    PASS
                  </div>
                )}
                {dragOffset.y < -50 && Math.abs(dragOffset.x) < 60 && (
                  <div className="absolute bottom-36 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-xl border-4 border-sky-400 text-sky-300 font-extrabold text-lg bg-black/35">
                    SUPER LIKE
                  </div>
                )}

                {/* Scrim & Profile Details */}
                <div className="absolute inset-x-0 bottom-0 pt-24 pb-4 px-5 bg-gradient-to-t from-black/90 via-black/55 to-transparent text-white">
                  <div className="flex items-end justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h2 className="text-2xl font-extrabold truncate">{topProfile.fullName}</h2>
                        <span className="text-xl font-medium tabular-nums">{topProfile.age}</span>
                        {topProfile.verified && (
                          <BadgeCheck className="w-5 h-5 text-sky-400 fill-sky-400/20 shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-white/85">
                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">
                          {topProfile.district}, {topProfile.state} · {topProfile.gender}
                        </span>
                      </div>
                      {topProfile.bio && (
                        <p className="text-xs text-white/90 line-clamp-2 pt-0.5">{topProfile.bio}</p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => onViewFullProfile(topProfile)}
                      className="px-3.5 h-10 rounded-xl bg-white/20 backdrop-blur-md border border-white/30 text-xs font-bold whitespace-nowrap shrink-0"
                    >
                      View Full Profile
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Bottom Swipe Action Buttons: Pass (X), Super Like (Star), Like (Heart) */}
        <div className="pt-3 pb-1 flex items-center justify-center gap-5 shrink-0">
          <button
            type="button"
            disabled={!topProfile && !activePromo}
            onClick={() => (activePromo ? dismissPromo() : triggerRealSwipe('pass'))}
            aria-label="Pass"
            className="w-14 h-14 rounded-full bg-white dark:bg-[#1D151A] border border-rose-100 dark:border-neutral-800 shadow-md text-[#E91E4D] flex items-center justify-center active:scale-95 transition-transform disabled:opacity-40"
          >
            <X className="w-6 h-6" />
          </button>

          <button
            type="button"
            disabled={!topProfile || !!activePromo}
            onClick={() => triggerRealSwipe('super_like')}
            aria-label="Super Like"
            className="w-12 h-12 rounded-full bg-white dark:bg-[#1D151A] border border-rose-100 dark:border-neutral-800 shadow-md text-sky-500 flex items-center justify-center active:scale-95 transition-transform disabled:opacity-40"
          >
            <Star className="w-5 h-5 fill-sky-500" />
          </button>

          <button
            type="button"
            disabled={!topProfile || !!activePromo}
            onClick={() => triggerRealSwipe('like')}
            aria-label="Like"
            className="w-16 h-16 rounded-full bg-gradient-to-br from-[#FF2D78] to-[#E91E4D] shadow-lg shadow-rose-500/35 text-white flex items-center justify-center active:scale-95 transition-transform disabled:opacity-40"
          >
            <Heart className="w-7 h-7 fill-white" />
          </button>
        </div>
      </div>
    </div>
  );
}

interface ExploreProps {
  me: UserProfile;
  allProfiles: UserProfile[];
  onViewFullProfile: (user: UserProfile) => void;
}

export function ExploreView({ me, allProfiles, onViewFullProfile }: ExploreProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [category, setCategory] = useState<
    'Popular Profiles' | 'New Members' | 'Verified Profiles' | 'Nearby Profiles' | 'Suggested For You'
  >('Popular Profiles');

  const [minAge, setMinAge] = useState(18);
  const [maxAge, setMaxAge] = useState(50);
  const [filterState, setFilterState] = useState('');
  const [filterDistrict, setFilterDistrict] = useState('');
  const [filterGender, setFilterGender] = useState<'All' | GenderOption>('All');
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  const [applied, setApplied] = useState({
    minAge: 18,
    maxAge: 50,
    state: '',
    district: '',
    gender: 'All' as 'All' | GenderOption,
    verifiedOnly: false
  });

  const districts = filterState ? INDIAN_STATES_DISTRICTS[filterState] || [] : [];

  const filteredProfiles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = allProfiles.filter((u) => {
      if (u.age < Math.max(18, applied.minAge) || u.age > Math.max(applied.minAge, applied.maxAge)) {
        return false;
      }
      if (applied.state && u.state !== applied.state) return false;
      if (applied.district && u.district !== applied.district) return false;
      if (applied.gender !== 'All' && u.gender !== applied.gender) return false;
      if (applied.verifiedOnly && !u.verified) return false;
      if (q) {
        const hay = `${u.fullName} ${u.username} ${u.state} ${u.district}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (category === 'Verified Profiles' && !u.verified) return false;
      if (category === 'Nearby Profiles' && u.state !== me.state) return false;
      return true;
    });

    if (category === 'New Members') {
      return [...list].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }
    if (category === 'Popular Profiles') {
      return [...list].sort((a, b) => {
        const scoreA = (a.membershipTier !== 'free' ? 2 : 0) + (a.verified ? 1 : 0);
        const scoreB = (b.membershipTier !== 'free' ? 2 : 0) + (b.verified ? 1 : 0);
        return scoreB - scoreA;
      });
    }
    return list;
  }, [allProfiles, applied, searchQuery, category, me.state]);

  const applyFilters = () => {
    const safeMin = Math.max(18, minAge || 18);
    const safeMax = Math.max(safeMin, maxAge || safeMin);
    setMinAge(safeMin);
    setMaxAge(safeMax);
    setApplied({
      minAge: safeMin,
      maxAge: safeMax,
      state: filterState,
      district: filterDistrict,
      gender: filterGender,
      verifiedOnly
    });
    setShowFilters(false);
  };

  const resetFilters = () => {
    setMinAge(18);
    setMaxAge(50);
    setFilterState('');
    setFilterDistrict('');
    setFilterGender('All');
    setVerifiedOnly(false);
    setApplied({
      minAge: 18,
      maxAge: 50,
      state: '',
      district: '',
      gender: 'All',
      verifiedOnly: false
    });
    setShowFilters(false);
  };

  return (
    <div className="h-full flex flex-col bg-[#FFF8FA] dark:bg-[#140E12]">
      <div className="p-4 bg-white dark:bg-[#1C1419] border-b border-rose-100 dark:border-neutral-800 space-y-2.5 shrink-0">
        <h1 className="text-lg font-extrabold">Explore</h1>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or location..."
            className="w-full h-11 pl-10 pr-4 rounded-xl bg-[#FFF8FA] dark:bg-neutral-900 border border-rose-100 dark:border-neutral-800 text-sm outline-none focus:border-[#FF2D78]"
          />
        </div>

        {/* Filters Button directly below Search Bar */}
        <button
          type="button"
          onClick={() => setShowFilters((s) => !s)}
          className="w-full h-10 rounded-xl bg-rose-50 dark:bg-neutral-900 text-[#E91E4D] font-bold text-xs flex items-center justify-center gap-2 border border-rose-100 dark:border-neutral-800"
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span>Filters</span>
        </button>

        {/* Explore Categories */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pt-1">
          {(
            [
              'Popular Profiles',
              'New Members',
              'Verified Profiles',
              'Nearby Profiles',
              'Suggested For You'
            ] as const
          ).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`px-3.5 h-9 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${
                category === cat
                  ? 'bg-[#FF2D78] text-white'
                  : 'bg-[#FFF8FA] dark:bg-neutral-900 text-[#6E5A63] dark:text-neutral-300'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Expandable Search Filters Panel */}
      {showFilters && (
        <div className="p-4 bg-white dark:bg-[#1D151A] border-b border-rose-100 dark:border-neutral-800 space-y-3 shrink-0">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <label className="text-xs font-semibold">Minimum Age (18+)</label>
              <input
                type="number"
                min={18}
                max={90}
                value={minAge}
                onChange={(e) => setMinAge(Math.max(18, Number(e.target.value)))}
                className="w-full h-10 px-3 rounded-xl bg-[#FFF8FA] dark:bg-neutral-900 border border-rose-100 dark:border-neutral-800 text-sm tabular-nums"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">Maximum Age</label>
              <input
                type="number"
                min={minAge}
                max={99}
                value={maxAge}
                onChange={(e) => setMaxAge(Number(e.target.value))}
                className="w-full h-10 px-3 rounded-xl bg-[#FFF8FA] dark:bg-neutral-900 border border-rose-100 dark:border-neutral-800 text-sm tabular-nums"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <label className="text-xs font-semibold">State</label>
              <select
                value={filterState}
                onChange={(e) => {
                  setFilterState(e.target.value);
                  setFilterDistrict('');
                }}
                className="w-full h-10 px-2.5 rounded-xl bg-[#FFF8FA] dark:bg-neutral-900 border border-rose-100 dark:border-neutral-800 text-xs"
              >
                <option value="">All States</option>
                {INDIAN_STATES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">District</label>
              <select
                value={filterDistrict}
                onChange={(e) => setFilterDistrict(e.target.value)}
                disabled={!filterState}
                className="w-full h-10 px-2.5 rounded-xl bg-[#FFF8FA] dark:bg-neutral-900 border border-rose-100 dark:border-neutral-800 text-xs disabled:opacity-50"
              >
                <option value="">All Districts</option>
                {districts.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold">Gender</label>
            <div className="grid grid-cols-4 gap-1.5">
              {(['All', 'Male', 'Female', 'Other'] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setFilterGender(g)}
                  className={`h-9 rounded-xl text-xs font-bold border ${
                    filterGender === g
                      ? 'bg-[#FF2D78] text-white border-[#FF2D78]'
                      : 'bg-[#FFF8FA] dark:bg-neutral-900 border-rose-100 dark:border-neutral-800'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center justify-between py-1 cursor-pointer">
            <span className="text-xs font-semibold">Verified Profiles Only</span>
            <input
              type="checkbox"
              checked={verifiedOnly}
              onChange={(e) => setVerifiedOnly(e.target.checked)}
              className="w-4 h-4 accent-[#FF2D78]"
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={resetFilters}
              className="h-10 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-xs font-bold"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={applyFilters}
              className="h-10 rounded-xl bg-gradient-to-r from-[#FF2D78] to-[#E91E4D] text-white text-xs font-bold"
            >
              Apply
            </button>
          </div>
        </div>
      )}

      {/* Results Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredProfiles.length === 0 ? (
          <div className="h-full min-h-[240px] flex flex-col items-center justify-center text-center text-[#6E5A63] dark:text-neutral-400 gap-2">
            <Search className="w-8 h-8 text-[#FF80AB]" />
            <p className="text-sm font-semibold">No profiles match your search or filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filteredProfiles.map((u) => (
              <button
                key={u.uid}
                type="button"
                onClick={() => onViewFullProfile(u)}
                className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-neutral-900 text-left shadow-sm"
              >
                {u.photoUrl ? (
                  <img src={u.photoUrl} alt={u.fullName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-[#FF2D78] to-[#E91E4D] flex items-center justify-center text-white text-3xl font-bold">
                    {u.fullName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 pt-14 pb-2.5 px-3 bg-gradient-to-t from-black/85 to-transparent text-white">
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-bold truncate">
                      {u.fullName}, {u.age}
                    </span>
                    {u.verified && <BadgeCheck className="w-4 h-4 text-sky-400 shrink-0" />}
                  </div>
                  <p className="text-[11px] text-white/80 truncate">
                    {u.district}, {u.state}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface ProfileDetailModalProps {
  user: UserProfile;
  canDirectMessage: boolean;
  onClose: () => void;
  onMessage: (user: UserProfile) => void;
  onReport: (user: UserProfile) => void;
  onBlock: (user: UserProfile) => void;
}

export function ProfileDetailSheet({
  user,
  canDirectMessage,
  onClose,
  onMessage,
  onReport,
  onBlock
}: ProfileDetailModalProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-end justify-center">
      <div className="w-full max-w-[430px] max-h-[88dvh] bg-white dark:bg-[#1C1419] rounded-t-3xl overflow-y-auto p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-xl font-extrabold">
                {user.fullName}, {user.age}
              </h2>
              {user.verified && <BadgeCheck className="w-5 h-5 text-sky-500" />}
            </div>
            <p className="text-xs text-[#6E5A63] dark:text-neutral-400">
              @{user.username} · {user.district}, {user.state} · {user.gender}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-10 h-10 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {user.bio && <p className="text-sm leading-relaxed">{user.bio}</p>}

        <div className="space-y-2.5">
          {(user.gallery?.length ? user.gallery : [user.photoUrl]).filter(Boolean).map((url, i) => (
            <img
              key={i}
              src={url}
              alt={`${user.fullName} photo ${i + 1}`}
              className="w-full aspect-[4/5] object-cover rounded-2xl"
            />
          ))}
        </div>

        <div className="grid grid-cols-1 gap-2 pt-2">
          {canDirectMessage && (
            <button
              type="button"
              onClick={() => onMessage(user)}
              className="w-full h-11 rounded-xl bg-gradient-to-r from-[#FF2D78] to-[#E91E4D] text-white text-sm font-bold flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              <span>Send Message</span>
            </button>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onReport(user)}
              className="h-11 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-xs font-bold flex items-center justify-center gap-1.5"
            >
              <Flag className="w-4 h-4" />
              <span>Report User</span>
            </button>
            <button
              type="button"
              onClick={() => onBlock(user)}
              className="h-11 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-300 text-xs font-bold flex items-center justify-center gap-1.5"
            >
              <Ban className="w-4 h-4" />
              <span>Block User</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
