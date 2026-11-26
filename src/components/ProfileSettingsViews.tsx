import React, { useEffect, useState } from 'react';
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  deleteUser,
  signOut
} from 'firebase/auth';
import {
  collection,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
  deleteDoc,
  limit
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import {
  Menu,
  X,
  BadgeCheck,
  MapPin,
  Edit3,
  Plus,
  Image as ImageIcon,
  Settings,
  Shield,
  Headphones,
  LogOut,
  ChevronRight,
  ArrowLeft,
  User as UserIcon,
  Lock,
  KeyRound,
  Trash2,
  Crown,
  Palette,
  Eye,
  Bell,
  HelpCircle,
  Ban,
  Users,
  Check,
  Camera,
  ExternalLink,
  Loader2,
  AlertTriangle,
  Send
} from 'lucide-react';
import { auth, db, functions } from '../lib/firebase';
import { INDIAN_STATES, INDIAN_STATES_DISTRICTS } from '../data/indianLocations';
import { SUPPORT_CATEGORIES } from '../lib/constants';
import {
  AppearanceTheme,
  GenderOption,
  InterestedInOption,
  MessagePermission,
  SavedDeviceAccount,
  SupportContactSlot,
  SupportRequest,
  UserPost,
  UserProfile
} from '../types/igmeet';
import {
  calculateExactAge,
  createUserPost,
  fetchUserPosts,
  getSavedDeviceAccounts,
  isUsernameAvailable,
  removeSavedDeviceAccount,
  submitSupportTicket,
  unblockUserAccount,
  uploadToFirebaseStorage
} from '../services/igmeetService';

interface BlockedRow {
  blockedUid: string;
  blockedName: string;
  blockedUsername: string;
  blockedPhoto: string;
  createdAt: number;
}

interface ProfileTabProps {
  me: UserProfile;
  isAdmin: boolean;
  onOpenEditProfile: () => void;
  onOpenSettings: () => void;
  onOpenAdminPanel: () => void;
  onOpenSupportTeam: () => void;
  onLogout: () => void;
  onToast: (msg: string, tone?: 'success' | 'error' | 'info') => void;
}

export function ProfileTabView({
  me,
  isAdmin,
  onOpenEditProfile,
  onOpenSettings,
  onOpenAdminPanel,
  onOpenSupportTeam,
  onLogout,
  onToast
}: ProfileTabProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [posts, setPosts] = useState<UserPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [addPostOpen, setAddPostOpen] = useState(false);
  const [postFile, setPostFile] = useState<File | null>(null);
  const [postPreview, setPostPreview] = useState('');
  const [postCaption, setPostCaption] = useState('');
  const [uploadingPost, setUploadingPost] = useState(false);

  const loadPosts = async () => {
    setLoadingPosts(true);
    try {
      const list = await fetchUserPosts(me.uid);
      setPosts(list);
    } catch {
      setPosts([]);
    } finally {
      setLoadingPosts(false);
    }
  };

  useEffect(() => {
    loadPosts();
  }, [me.uid]);

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postFile) {
      onToast('Please choose an image for your post.', 'error');
      return;
    }
    setUploadingPost(true);
    try {
      const url = await uploadToFirebaseStorage(
        `posts/${me.uid}/${Date.now()}_${postFile.name}`,
        postFile
      );
      await createUserPost(me.uid, url, postCaption);
      setPostFile(null);
      setPostPreview('');
      setPostCaption('');
      setAddPostOpen(false);
      await loadPosts();
      onToast('Post published successfully.', 'success');
    } catch (err: unknown) {
      onToast(err instanceof Error ? err.message : 'Unable to upload post.', 'error');
    } finally {
      setUploadingPost(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    try {
      await deleteDoc(doc(db, 'posts', postId));
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      onToast('Post removed.', 'info');
    } catch {
      onToast('Unable to remove post.', 'error');
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#FFF8FA] dark:bg-[#140E12]">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-white dark:bg-[#1B1318] border-b border-pink-100 dark:border-white/10">
        <div className="min-w-0">
          <h1 className="text-lg font-extrabold tracking-tight truncate">@{me.username}</h1>
          <p className="text-[11px] text-[#6E5A63] dark:text-neutral-400">My Profile</p>
        </div>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
          className="w-10 h-10 rounded-xl flex items-center justify-center bg-pink-50 dark:bg-white/5 text-[#1F1218] dark:text-white active:scale-95 transition"
        >
          <Menu className="w-5 h-5" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5 pb-24">
        {/* Profile Hero Card */}
        <section className="rounded-3xl bg-white dark:bg-[#1C1419] border border-pink-100 dark:border-white/10 p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              {me.photoUrl ? (
                <img
                  src={me.photoUrl}
                  alt={me.fullName}
                  className="w-20 h-20 rounded-2xl object-cover ring-2 ring-[#FF2D78]/30"
                />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-pink-100 dark:bg-white/10 flex items-center justify-center">
                  <UserIcon className="w-9 h-9 text-[#FF2D78]" />
                </div>
              )}
              {me.verified && (
                <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white dark:bg-[#1C1419] flex items-center justify-center shadow">
                  <BadgeCheck className="w-5 h-5 text-sky-500" />
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2 className="text-xl font-extrabold truncate">
                  {me.fullName}, {me.age}
                </h2>
                {me.verified && <BadgeCheck className="w-5 h-5 text-sky-500 shrink-0" />}
              </div>
              <p className="text-xs font-medium text-[#6E5A63] dark:text-neutral-400">
                @{me.username} &middot; {me.gender}
              </p>
              <div className="flex items-center gap-1 text-xs text-[#6E5A63] dark:text-neutral-400">
                <MapPin className="w-3.5 h-3.5 text-[#FF2D78] shrink-0" />
                <span className="truncate">
                  {me.district}, {me.state}
                </span>
              </div>
            </div>
          </div>

          <p className="text-sm leading-relaxed text-[#2D1B22] dark:text-neutral-200">
            {me.bio || 'No bio added yet.'}
          </p>

          <button
            type="button"
            onClick={onOpenEditProfile}
            className="w-full py-2.5 px-4 rounded-2xl bg-gradient-to-r from-[#FF2D78] to-[#E91E4D] text-white text-sm font-bold flex items-center justify-center gap-2 shadow-sm active:scale-[0.99] transition"
          >
            <Edit3 className="w-4 h-4" />
            <span>Edit Profile</span>
          </button>
        </section>

        {/* Photo Gallery */}
        <section className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold tracking-tight">Photo Gallery</h3>
            <button
              type="button"
              onClick={onOpenEditProfile}
              className="text-xs font-semibold text-[#FF2D78]"
            >
              Manage Photos
            </button>
          </div>
          {me.gallery && me.gallery.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {me.gallery.map((url, idx) => (
                <div
                  key={`${url}-${idx}`}
                  className="aspect-square rounded-2xl overflow-hidden bg-pink-50 dark:bg-white/5 border border-pink-100 dark:border-white/10"
                >
                  <img src={url} alt={`Gallery ${idx + 1}`} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl bg-white dark:bg-[#1C1419] border border-pink-100 dark:border-white/10 p-4 text-center text-xs text-[#6E5A63] dark:text-neutral-400">
              No gallery photos yet. Use Edit Profile to add photos.
            </div>
          )}
        </section>

        {/* My Posts */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold tracking-tight">My Posts</h3>
            <button
              type="button"
              onClick={() => setAddPostOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-pink-50 dark:bg-white/10 text-[#FF2D78] text-xs font-bold flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Post</span>
            </button>
          </div>

          {loadingPosts ? (
            <div className="py-8 flex justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-[#FF2D78]" />
            </div>
          ) : posts.length === 0 ? (
            <div className="rounded-2xl bg-white dark:bg-[#1C1419] border border-pink-100 dark:border-white/10 p-6 text-center space-y-2">
              <ImageIcon className="w-7 h-7 mx-auto text-[#FF80AB]" />
              <p className="text-xs text-[#6E5A63] dark:text-neutral-400">
                Share moments on your profile so matches can get to know you better.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {posts.map((post) => (
                <article
                  key={post.id}
                  className="rounded-2xl overflow-hidden bg-white dark:bg-[#1C1419] border border-pink-100 dark:border-white/10"
                >
                  <img
                    src={post.imageUrl}
                    alt={post.caption || 'Profile post'}
                    className="w-full max-h-80 object-cover"
                  />
                  <div className="p-3 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      {post.caption && (
                        <p className="text-sm text-[#2D1B22] dark:text-neutral-100 break-words">
                          {post.caption}
                        </p>
                      )}
                      <p className="text-[11px] text-[#6E5A63] dark:text-neutral-400 mt-1">
                        {new Date(post.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeletePost(post.id)}
                      aria-label="Delete post"
                      className="p-1.5 rounded-lg text-neutral-400 hover:text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Add Post Modal */}
      {addPostOpen && (
        <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-end justify-center">
          <form
            onSubmit={handleCreatePost}
            className="w-full max-w-[430px] bg-white dark:bg-[#1C1419] rounded-t-3xl p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold">Add New Post</h3>
              <button type="button" onClick={() => setAddPostOpen(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <label className="block w-full rounded-2xl border-2 border-dashed border-pink-200 dark:border-white/15 p-4 text-center cursor-pointer">
              {postPreview ? (
                <img
                  src={postPreview}
                  alt="Preview"
                  className="w-full max-h-56 object-cover rounded-xl"
                />
              ) : (
                <div className="py-6 space-y-2">
                  <Camera className="w-7 h-7 mx-auto text-[#FF2D78]" />
                  <p className="text-xs font-semibold">Tap to choose an image</p>
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setPostFile(file);
                    setPostPreview(URL.createObjectURL(file));
                  }
                }}
              />
            </label>
            <textarea
              value={postCaption}
              onChange={(e) => setPostCaption(e.target.value)}
              rows={2}
              maxLength={220}
              placeholder="Write a short caption..."
              className="w-full rounded-xl border border-pink-200 dark:border-white/15 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-[#FF2D78]"
            />
            <button
              type="submit"
              disabled={uploadingPost}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-[#FF2D78] to-[#E91E4D] text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {uploadingPost && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{uploadingPost ? 'Publishing...' : 'Publish Post'}</span>
            </button>
          </form>
        </div>
      )}

      {/* Hamburger Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex justify-end">
          <div
            className="flex-1"
            onClick={() => setDrawerOpen(false)}
            role="presentation"
          />
          <aside className="w-72 max-w-[82vw] h-full bg-white dark:bg-[#1B1318] p-5 flex flex-col justify-between shadow-2xl">
            <div className="space-y-5">
              <div className="flex items-center justify-between border-b border-pink-100 dark:border-white/10 pb-4">
                <div>
                  <p className="text-base font-extrabold text-[#FF2D78]">IG Meet</p>
                  <p className="text-xs text-[#6E5A63] dark:text-neutral-400">@{me.username}</p>
                </div>
                <button type="button" onClick={() => setDrawerOpen(false)}>
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setDrawerOpen(false);
                    onOpenSettings();
                  }}
                  className="w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl hover:bg-pink-50 dark:hover:bg-white/5 text-sm font-semibold text-left"
                >
                  <Settings className="w-5 h-5 text-[#FF2D78]" />
                  <span>Settings</span>
                </button>

                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setDrawerOpen(false);
                      onOpenAdminPanel();
                    }}
                    className="w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl bg-pink-50/80 dark:bg-pink-500/10 text-[#E91E4D] dark:text-pink-300 text-sm font-bold text-left"
                  >
                    <Shield className="w-5 h-5" />
                    <span>Admin Panel</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setDrawerOpen(false);
                    onOpenSupportTeam();
                  }}
                  className="w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl hover:bg-pink-50 dark:hover:bg-white/5 text-sm font-semibold text-left"
                >
                  <Headphones className="w-5 h-5 text-[#FF2D78]" />
                  <span>Support Team</span>
                </button>
              </nav>
            </div>

            <button
              type="button"
              onClick={() => {
                setDrawerOpen(false);
                onLogout();
              }}
              className="w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 text-sm font-bold"
            >
              <LogOut className="w-5 h-5" />
              <span>Logout</span>
            </button>
          </aside>
        </div>
      )}
    </div>
  );
}

interface EditProfileProps {
  me: UserProfile;
  onBack: () => void;
  onSaved: (updated: UserProfile) => void;
  onOpenUpgrade: () => void;
  onOpenVerification: () => void;
  onToast: (msg: string, tone?: 'success' | 'error' | 'info') => void;
}

export function EditProfileScreen({
  me,
  onBack,
  onSaved,
  onOpenUpgrade,
  onOpenVerification,
  onToast
}: EditProfileProps) {
  const [fullName, setFullName] = useState(me.fullName);
  const [username, setUsername] = useState(me.username);
  const [dobDay, setDobDay] = useState(String(me.dobDay));
  const [dobMonth, setDobMonth] = useState(String(me.dobMonth));
  const [dobYear, setDobYear] = useState(String(me.dobYear));
  const [gender, setGender] = useState<GenderOption>(me.gender);
  const [interestedIn, setInterestedIn] = useState<InterestedInOption>(me.interestedIn);
  const [stateVal, setStateVal] = useState(me.state);
  const [districtVal, setDistrictVal] = useState(me.district);
  const [bio, setBio] = useState(me.bio);
  const [photoUrl, setPhotoUrl] = useState(me.photoUrl);
  const [gallery, setGallery] = useState<string[]>(me.gallery || []);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const districts = stateVal ? INDIAN_STATES_DISTRICTS[stateVal] || [] : [];

  const handleAvatarUpload = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadToFirebaseStorage(
        `profilePhotos/${me.uid}/${Date.now()}_${file.name}`,
        file
      );
      setPhotoUrl(url);
      onToast('Profile photo updated. Save changes to apply.', 'info');
    } catch (err: unknown) {
      onToast(err instanceof Error ? err.message : 'Upload failed.', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleAddGallery = async (file: File) => {
    if (gallery.length >= 6) {
      onToast('You can keep up to 6 gallery photos.', 'info');
      return;
    }
    setUploading(true);
    try {
      const url = await uploadToFirebaseStorage(
        `gallery/${me.uid}/${Date.now()}_${file.name}`,
        file
      );
      setGallery((prev) => [...prev, url]);
    } catch (err: unknown) {
      onToast(err instanceof Error ? err.message : 'Upload failed.', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const d = Number(dobDay);
    const m = Number(dobMonth);
    const y = Number(dobYear);
    const computedAge = calculateExactAge(d, m, y);
    if (computedAge < 18) {
      onToast('IG Meet is strictly for adults aged 18 and above.', 'error');
      return;
    }
    const normalizedUser = username.trim().toLowerCase();
    if (!/^[a-z0-9._]{3,24}$/.test(normalizedUser)) {
      onToast('Username must be 3 to 24 characters using letters, numbers, dot, or underscore.', 'error');
      return;
    }
    if (!fullName.trim() || !stateVal || !districtVal) {
      onToast('Please complete all required profile fields.', 'error');
      return;
    }

    setSaving(true);
    try {
      if (normalizedUser !== me.username) {
        const available = await isUsernameAvailable(normalizedUser, me.uid);
        if (!available) {
          onToast('That username is already taken.', 'error');
          setSaving(false);
          return;
        }
      }

      const patch = {
        fullName: fullName.trim(),
        username: normalizedUser,
        dobDay: d,
        dobMonth: m,
        dobYear: y,
        age: computedAge,
        gender,
        interestedIn,
        state: stateVal,
        district: districtVal,
        bio: bio.trim(),
        photoUrl,
        gallery,
        updatedAt: Date.now()
      };

      await updateDoc(doc(db, 'users', me.uid), patch);
      await updateDoc(doc(db, 'profiles', me.uid), {
        fullName: patch.fullName,
        username: patch.username,
        age: patch.age,
        gender: patch.gender,
        interestedIn: patch.interestedIn,
        state: patch.state,
        district: patch.district,
        bio: patch.bio,
        photoUrl: patch.photoUrl,
        gallery: patch.gallery
      }).catch(() => {});

      onSaved({ ...me, ...patch });
      onToast('Profile changes saved.', 'success');
    } catch {
      onToast('Unable to save profile changes right now.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#FFF8FA] dark:bg-[#140E12]">
      <header className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-[#1B1318] border-b border-pink-100 dark:border-white/10">
        <button type="button" onClick={onBack} className="p-1.5 rounded-xl hover:bg-pink-50 dark:hover:bg-white/5">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-extrabold">Edit Profile</h1>
      </header>

      <form onSubmit={handleSave} className="flex-1 overflow-y-auto px-4 py-5 space-y-5 pb-12">
        {/* Profile Photo */}
        <div className="flex items-center gap-4">
          <div className="relative">
            {photoUrl ? (
              <img src={photoUrl} alt="Avatar" className="w-20 h-20 rounded-2xl object-cover" />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-pink-100 dark:bg-white/10 flex items-center justify-center">
                <UserIcon className="w-8 h-8 text-[#FF2D78]" />
              </div>
            )}
            <label className="absolute -bottom-1.5 -right-1.5 w-8 h-8 rounded-full bg-[#FF2D78] text-white flex items-center justify-center cursor-pointer shadow">
              <Camera className="w-4 h-4" />
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleAvatarUpload(file);
                }}
              />
            </label>
          </div>
          <div className="text-xs text-[#6E5A63] dark:text-neutral-400">
            <p className="font-bold text-sm text-[#1F1218] dark:text-white">Profile Photo</p>
            <p>{uploading ? 'Uploading image...' : 'Upload a clear portrait photo.'}</p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold mb-1">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-xl border border-pink-200 dark:border-white/15 bg-white dark:bg-[#1C1419] px-3.5 py-2.5 text-sm outline-none focus:border-[#FF2D78]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, ''))}
              className="w-full rounded-xl border border-pink-200 dark:border-white/15 bg-white dark:bg-[#1C1419] px-3.5 py-2.5 text-sm outline-none focus:border-[#FF2D78]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold mb-1">Date of Birth (18+ Only)</label>
            <div className="grid grid-cols-3 gap-2">
              <input
                type="number"
                min={1}
                max={31}
                placeholder="Day"
                value={dobDay}
                onChange={(e) => setDobDay(e.target.value)}
                className="rounded-xl border border-pink-200 dark:border-white/15 bg-white dark:bg-[#1C1419] px-3 py-2.5 text-sm outline-none focus:border-[#FF2D78]"
              />
              <input
                type="number"
                min={1}
                max={12}
                placeholder="Month"
                value={dobMonth}
                onChange={(e) => setDobMonth(e.target.value)}
                className="rounded-xl border border-pink-200 dark:border-white/15 bg-white dark:bg-[#1C1419] px-3 py-2.5 text-sm outline-none focus:border-[#FF2D78]"
              />
              <input
                type="number"
                min={1940}
                max={new Date().getFullYear() - 18}
                placeholder="Year"
                value={dobYear}
                onChange={(e) => setDobYear(e.target.value)}
                className="rounded-xl border border-pink-200 dark:border-white/15 bg-white dark:bg-[#1C1419] px-3 py-2.5 text-sm outline-none focus:border-[#FF2D78]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold mb-1.5">Gender</label>
            <div className="grid grid-cols-3 gap-2">
              {(['Male', 'Female', 'Other'] as GenderOption[]).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setGender(opt)}
                  className={`py-2.5 rounded-xl text-xs font-bold border transition ${
                    gender === opt
                      ? 'bg-[#FF2D78] text-white border-[#FF2D78]'
                      : 'bg-white dark:bg-[#1C1419] border-pink-200 dark:border-white/15'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold mb-1.5">Interested In</label>
            <div className="grid grid-cols-3 gap-2">
              {(['Male', 'Female', 'Everyone'] as InterestedInOption[]).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setInterestedIn(opt)}
                  className={`py-2.5 rounded-xl text-xs font-bold border transition ${
                    interestedIn === opt
                      ? 'bg-[#FF2D78] text-white border-[#FF2D78]'
                      : 'bg-white dark:bg-[#1C1419] border-pink-200 dark:border-white/15'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-xs font-bold mb-1">State</label>
              <select
                value={stateVal}
                onChange={(e) => {
                  setStateVal(e.target.value);
                  setDistrictVal('');
                }}
                className="w-full rounded-xl border border-pink-200 dark:border-white/15 bg-white dark:bg-[#1C1419] px-3 py-2.5 text-sm outline-none focus:border-[#FF2D78]"
              >
                <option value="">Select State</option>
                {INDIAN_STATES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold mb-1">District</label>
              <select
                value={districtVal}
                disabled={!stateVal}
                onChange={(e) => setDistrictVal(e.target.value)}
                className="w-full rounded-xl border border-pink-200 dark:border-white/15 bg-white dark:bg-[#1C1419] px-3 py-2.5 text-sm outline-none focus:border-[#FF2D78] disabled:opacity-50"
              >
                <option value="">Select District</option>
                {districts.map((dist) => (
                  <option key={dist} value={dist}>
                    {dist}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold mb-1">Bio</label>
            <textarea
              rows={3}
              maxLength={300}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full rounded-xl border border-pink-200 dark:border-white/15 bg-white dark:bg-[#1C1419] px-3.5 py-2.5 text-sm outline-none focus:border-[#FF2D78]"
            />
          </div>

          {/* Manage Gallery Photos */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold">Manage Photos ({gallery.length}/6)</label>
              <label className="text-xs font-bold text-[#FF2D78] cursor-pointer flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" />
                <span>Add Photo</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleAddGallery(f);
                  }}
                />
              </label>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {gallery.map((url, index) => (
                <div key={`${url}-${index}`} className="relative aspect-square rounded-xl overflow-hidden">
                  <img src={url} alt={`Photo ${index + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setGallery((prev) => prev.filter((_, idx) => idx !== index))}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 text-white flex items-center justify-center"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving || uploading}
          className="w-full py-3 rounded-2xl bg-gradient-to-r from-[#FF2D78] to-[#E91E4D] text-white text-sm font-bold flex items-center justify-center gap-2 shadow-md disabled:opacity-60"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          <span>{saving ? 'Saving Changes...' : 'Save Changes'}</span>
        </button>

        {/* Two Separate Action Cards at the bottom of Edit Profile */}
        <div className="pt-2 space-y-3">
          {/* Card 1: IG Meet Upgrade */}
          <button
            type="button"
            onClick={onOpenUpgrade}
            className="w-full text-left rounded-2xl p-4 bg-gradient-to-r from-[#FF2D78] via-[#E91E4D] to-[#D97706] text-white shadow-md flex items-center justify-between gap-3 active:scale-[0.99] transition"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <Crown className="w-6 h-6 text-amber-200" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-extrabold">IG Meet Upgrade</p>
                <p className="text-xs text-white/90">
                  Unlock IG Meet Plus and Elite membership features
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 shrink-0" />
          </button>

          {/* Card 2: Free Blue Tick Verification */}
          <button
            type="button"
            onClick={onOpenVerification}
            className="w-full text-left rounded-2xl p-4 bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md flex items-center justify-between gap-3 active:scale-[0.99] transition"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <BadgeCheck className="w-6 h-6 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-extrabold">Free Blue Tick Verification</p>
                <p className="text-xs text-white/90">
                  {me.verified
                    ? 'Your profile is verified with the Blue Badge'
                    : 'Verify your identity with a quick selfie review'}
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 shrink-0" />
          </button>
        </div>
      </form>
    </div>
  );
}

interface SettingsHubProps {
  me: UserProfile;
  theme: AppearanceTheme;
  initialSubView?: 'menu' | 'support_team';
  supportSlots: SupportContactSlot[];
  onBack: () => void;
  onChangeTheme: (next: AppearanceTheme) => void;
  onUpdateProfile: (updated: UserProfile) => void;
  onOpenEditProfile: () => void;
  onOpenUpgrade: () => void;
  onLogoutCurrent: () => void;
  onAddAnotherAccount: () => void;
  onToast: (msg: string, tone?: 'success' | 'error' | 'info') => void;
}

type SettingsScreen =
  | 'menu'
  | 'personal_info'
  | 'account_security'
  | 'change_password'
  | 'delete_account'
  | 'appearance'
  | 'privacy'
  | 'notifications'
  | 'help_support'
  | 'blocked_users'
  | 'switch_account'
  | 'support_team';

export function SettingsHub({
  me,
  theme,
  initialSubView = 'menu',
  supportSlots,
  onBack,
  onChangeTheme,
  onUpdateProfile,
  onOpenEditProfile,
  onOpenUpgrade,
  onLogoutCurrent,
  onAddAnotherAccount,
  onToast
}: SettingsHubProps) {
  const [screen, setScreen] = useState<SettingsScreen>(initialSubView);
  const [blockedList, setBlockedList] = useState<BlockedRow[]>([]);
  const [tickets, setTickets] = useState<SupportRequest[]>([]);
  const [savedAccounts, setSavedAccounts] = useState<SavedDeviceAccount[]>(() =>
    getSavedDeviceAccounts()
  );

  // Change password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  // Delete account state
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Help & Support state
  const [category, setCategory] = useState(SUPPORT_CATEGORIES[0]);
  const [reportedTarget, setReportedTarget] = useState('');
  const [description, setDescription] = useState('');
  const [ticketFile, setTicketFile] = useState<File | null>(null);
  const [submittingTicket, setSubmittingTicket] = useState(false);

  const isPasswordAccount = (auth.currentUser?.providerData || []).some(
    (p) => p.providerId === 'password'
  );

  useEffect(() => {
    if (screen === 'blocked_users') {
      getDocs(query(collection(db, 'blockedUsers'), where('blockerUid', '==', me.uid), limit(100)))
        .then((snap) => {
          setBlockedList(snap.docs.map((d) => d.data() as BlockedRow));
        })
        .catch(() => setBlockedList([]));
    }
    if (screen === 'help_support') {
      getDocs(query(collection(db, 'supportRequests'), where('uid', '==', me.uid), limit(50)))
        .then((snap) => {
          const rows = snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<SupportRequest, 'id'>) }))
            .sort((a, b) => b.createdAt - a.createdAt);
          setTickets(rows);
        })
        .catch(() => setTickets([]));
    }
    if (screen === 'switch_account') {
      setSavedAccounts(getSavedDeviceAccounts());
    }
  }, [screen, me.uid]);

  const handleBack = () => {
    if (screen === 'menu' || (initialSubView === 'support_team' && screen === 'support_team')) {
      onBack();
    } else {
      setScreen('menu');
    }
  };

  const handleUpdatePrivacy = async (patch: Partial<UserProfile['privacy']>) => {
    const nextPrivacy = { ...me.privacy, ...patch };
    try {
      await updateDoc(doc(db, 'users', me.uid), { privacy: nextPrivacy, updatedAt: Date.now() });
      onUpdateProfile({ ...me, privacy: nextPrivacy });
      onToast('Privacy settings updated.', 'success');
    } catch {
      onToast('Unable to update privacy settings.', 'error');
    }
  };

  const handleUpdateNotifications = async (patch: Partial<UserProfile['notifications']>) => {
    const nextNotif = { ...me.notifications, ...patch };
    try {
      await updateDoc(doc(db, 'users', me.uid), {
        notifications: nextNotif,
        updatedAt: Date.now()
      });
      onUpdateProfile({ ...me, notifications: nextNotif });
      onToast('Notification preferences updated.', 'success');
    } catch {
      onToast('Unable to save notification preferences.', 'error');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !auth.currentUser.email) return;
    if (newPassword.length < 6) {
      onToast('New password must be at least 6 characters.', 'error');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      onToast('New password and confirmation do not match.', 'error');
      return;
    }
    setPwLoading(true);
    try {
      const cred = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
      await reauthenticateWithCredential(auth.currentUser, cred);
      await updatePassword(auth.currentUser, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      onToast('Password updated successfully.', 'success');
      setScreen('menu');
    } catch {
      onToast('Current password is incorrect or re-authentication failed.', 'error');
    } finally {
      setPwLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText.trim().toUpperCase() !== 'DELETE') {
      onToast('Type DELETE to confirm permanent account removal.', 'error');
      return;
    }
    const user = auth.currentUser;
    if (!user) return;
    setDeleting(true);
    try {
      if (isPasswordAccount && user.email) {
        if (!deletePassword) {
          onToast('Enter your current password to verify deletion.', 'error');
          setDeleting(false);
          return;
        }
        const cred = EmailAuthProvider.credential(user.email, deletePassword);
        await reauthenticateWithCredential(user, cred);
      }

      try {
        const fn = httpsCallable(functions, 'deleteUserAccountSecurely');
        await fn({});
      } catch {
        // Fallback cleanup if Cloud Function is not yet deployed
        await deleteDoc(doc(db, 'profiles', me.uid)).catch(() => {});
        await deleteDoc(doc(db, 'users', me.uid)).catch(() => {});
        await deleteUser(user);
      }

      removeSavedDeviceAccount(me.uid);
      onToast('Your account has been permanently deleted.', 'info');
    } catch {
      onToast('Recent sign-in is required before deleting your account. Please log in again and retry.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      onToast('Please describe your issue.', 'error');
      return;
    }
    setSubmittingTicket(true);
    try {
      let screenshotUrl = '';
      if (ticketFile) {
        screenshotUrl = await uploadToFirebaseStorage(
          `supportScreenshots/${me.uid}/${Date.now()}_${ticketFile.name}`,
          ticketFile
        );
      }
      await submitSupportTicket({
        uid: me.uid,
        userName: me.fullName,
        category,
        reportedTarget: reportedTarget.trim(),
        description: description.trim(),
        screenshotUrl
      });
      setReportedTarget('');
      setDescription('');
      setTicketFile(null);
      onToast('Support request submitted.', 'success');
      const snap = await getDocs(
        query(collection(db, 'supportRequests'), where('uid', '==', me.uid), limit(50))
      );
      setTickets(
        snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<SupportRequest, 'id'>) }))
          .sort((a, b) => b.createdAt - a.createdAt)
      );
    } catch (err: unknown) {
      onToast(err instanceof Error ? err.message : 'Unable to submit ticket.', 'error');
    } finally {
      setSubmittingTicket(false);
    }
  };

  const handleUnblock = async (uidToUnblock: string) => {
    try {
      await unblockUserAccount(me.uid, uidToUnblock);
      setBlockedList((prev) => prev.filter((item) => item.blockedUid !== uidToUnblock));
      onToast('User unblocked.', 'success');
    } catch {
      onToast('Unable to unblock user.', 'error');
    }
  };

  const formatContactLink = (slot: SupportContactSlot): string => {
    const val = slot.value.trim();
    if (/^https?:\/\//i.test(val)) return val;
    if (slot.platform === 'Instagram') return `https://instagram.com/${val.replace(/^@/, '')}`;
    if (slot.platform === 'Telegram') return `https://t.me/${val.replace(/^@/, '')}`;
    const digits = val.replace(/[^0-9]/g, '');
    return `https://wa.me/${digits}`;
  };

  const enabledSupportContacts = supportSlots.filter((s) => s.enabled && s.value.trim().length > 0);

  const titleMap: Record<SettingsScreen, string> = {
    menu: 'Settings',
    personal_info: 'Personal Information',
    account_security: 'Account & Security',
    change_password: 'Change Password',
    delete_account: 'Delete Account',
    appearance: 'Appearance',
    privacy: 'Account Privacy',
    notifications: 'Notification Settings',
    help_support: 'Help & Support',
    blocked_users: 'Block Users',
    switch_account: 'Switch Account',
    support_team: 'Support Team'
  };

  return (
    <div className="flex flex-col h-full bg-[#FFF8FA] dark:bg-[#140E12]">
      <header className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-[#1B1318] border-b border-pink-100 dark:border-white/10">
        <button type="button" onClick={handleBack} className="p-1.5 rounded-xl hover:bg-pink-50 dark:hover:bg-white/5">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-extrabold">{titleMap[screen]}</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-10">
        {screen === 'menu' && (
          <div className="space-y-2">
            {[
              { label: 'Personal Information', icon: UserIcon, onClick: () => setScreen('personal_info') },
              { label: 'Edit Profile', icon: Edit3, onClick: onOpenEditProfile },
              { label: 'Account & Security', icon: Shield, onClick: () => setScreen('account_security') },
              { label: 'Change Password', icon: KeyRound, onClick: () => setScreen('change_password') },
              { label: 'Delete Account', icon: Trash2, onClick: () => setScreen('delete_account') },
              { label: 'IG Meet Upgrade', icon: Crown, onClick: onOpenUpgrade },
              { label: 'Appearance', icon: Palette, onClick: () => setScreen('appearance') },
              { label: 'Account Privacy', icon: Eye, onClick: () => setScreen('privacy') },
              { label: 'Notification Settings', icon: Bell, onClick: () => setScreen('notifications') },
              { label: 'Help & Support', icon: HelpCircle, onClick: () => setScreen('help_support') },
              { label: 'Block Users', icon: Ban, onClick: () => setScreen('blocked_users') },
              { label: 'Switch Account', icon: Users, onClick: () => setScreen('switch_account') },
              { label: 'Logout', icon: LogOut, onClick: onLogoutCurrent, danger: true }
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.onClick}
                  className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl bg-white dark:bg-[#1C1419] border border-pink-100 dark:border-white/10 text-sm font-semibold active:scale-[0.99] transition ${
                    item.danger ? 'text-red-600 dark:text-red-400' : ''
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Icon className={`w-4.5 h-4.5 ${item.danger ? 'text-red-500' : 'text-[#FF2D78]'}`} />
                    <span>{item.label}</span>
                  </span>
                  <ChevronRight className="w-4 h-4 opacity-50" />
                </button>
              );
            })}
          </div>
        )}

        {screen === 'personal_info' && (
          <div className="rounded-2xl bg-white dark:bg-[#1C1419] border border-pink-100 dark:border-white/10 divide-y divide-pink-100 dark:divide-white/10">
            {[
              { label: 'Full Name', value: me.fullName },
              { label: 'Username', value: `@${me.username}` },
              { label: 'Email', value: me.email },
              { label: 'Date of Birth', value: `${me.dobDay}/${me.dobMonth}/${me.dobYear} (${me.age} yrs)` },
              { label: 'Gender', value: me.gender },
              { label: 'Location', value: `${me.district}, ${me.state}` },
              { label: 'Membership', value: me.membershipTier.toUpperCase() }
            ].map((row) => (
              <div key={row.label} className="px-4 py-3 flex items-center justify-between gap-2 text-sm">
                <span className="text-[#6E5A63] dark:text-neutral-400">{row.label}</span>
                <span className="font-bold text-right">{row.value}</span>
              </div>
            ))}
          </div>
        )}

        {screen === 'account_security' && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-white dark:bg-[#1C1419] border border-pink-100 dark:border-white/10 p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-bold">
                <Lock className="w-4 h-4 text-[#FF2D78]" />
                <span>Sign-In Method</span>
              </div>
              <p className="text-xs text-[#6E5A63] dark:text-neutral-400">
                {isPasswordAccount
                  ? 'Your account uses Email & Password authentication. You can update your password anytime.'
                  : 'Your account uses Google Sign-In. Password changes are managed directly in your Google Account security settings.'}
              </p>
            </div>
            <div className="rounded-2xl bg-white dark:bg-[#1C1419] border border-pink-100 dark:border-white/10 p-4 space-y-2">
              <p className="text-sm font-bold">Account Status</p>
              <p className="text-xs text-[#6E5A63] dark:text-neutral-400">
                Status: <span className="font-bold text-emerald-600 uppercase">{me.status}</span> &middot; Verification:{' '}
                <span className="font-bold">{me.verified ? 'Verified' : 'Not Verified'}</span>
              </p>
            </div>
          </div>
        )}

        {screen === 'change_password' && (
          <div className="rounded-2xl bg-white dark:bg-[#1C1419] border border-pink-100 dark:border-white/10 p-4 space-y-4">
            {!isPasswordAccount ? (
              <div className="space-y-2 text-sm">
                <p className="font-bold">Google-Only Account</p>
                <p className="text-xs text-[#6E5A63] dark:text-neutral-400 leading-relaxed">
                  You signed in with Google. IG Meet does not store a separate password for Google-only accounts. Manage your password from your Google Account security page.
                </p>
              </div>
            ) : (
              <form onSubmit={handleChangePassword} className="space-y-3">
                <input
                  type="password"
                  required
                  placeholder="Current Password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full rounded-xl border border-pink-200 dark:border-white/15 bg-transparent px-3.5 py-2.5 text-sm outline-none focus:border-[#FF2D78]"
                />
                <input
                  type="password"
                  required
                  placeholder="New Password (min 6 characters)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-xl border border-pink-200 dark:border-white/15 bg-transparent px-3.5 py-2.5 text-sm outline-none focus:border-[#FF2D78]"
                />
                <input
                  type="password"
                  required
                  placeholder="Confirm New Password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  className="w-full rounded-xl border border-pink-200 dark:border-white/15 bg-transparent px-3.5 py-2.5 text-sm outline-none focus:border-[#FF2D78]"
                />
                <button
                  type="submit"
                  disabled={pwLoading}
                  className="w-full py-3 rounded-2xl bg-[#FF2D78] text-white text-sm font-bold disabled:opacity-60"
                >
                  {pwLoading ? 'Updating...' : 'Update Password'}
                </button>
              </form>
            )}
          </div>
        )}

        {screen === 'delete_account' && (
          <div className="rounded-2xl bg-white dark:bg-[#1C1419] border border-red-200 dark:border-red-500/30 p-5 space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h2 className="text-sm font-extrabold text-red-600 dark:text-red-400">
                  Permanent Account Deletion
                </h2>
                <p className="text-xs text-[#6E5A63] dark:text-neutral-400 leading-relaxed">
                  Deleting your account permanently removes your profile, posts, matches, and personal settings. This action cannot be undone.
                </p>
              </div>
            </div>

            {deleteStep === 1 ? (
              <button
                type="button"
                onClick={() => setDeleteStep(2)}
                className="w-full py-3 rounded-2xl bg-red-600 text-white text-sm font-bold"
              >
                Continue to Confirmation
              </button>
            ) : (
              <div className="space-y-3">
                {isPasswordAccount && (
                  <input
                    type="password"
                    placeholder="Enter current password"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    className="w-full rounded-xl border border-red-200 dark:border-red-500/30 bg-transparent px-3.5 py-2.5 text-sm outline-none"
                  />
                )}
                <input
                  type="text"
                  placeholder="Type DELETE to confirm"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  className="w-full rounded-xl border border-red-200 dark:border-red-500/30 bg-transparent px-3.5 py-2.5 text-sm outline-none"
                />
                <button
                  type="button"
                  disabled={deleting}
                  onClick={handleDeleteAccount}
                  className="w-full py-3 rounded-2xl bg-red-600 text-white text-sm font-bold disabled:opacity-60"
                >
                  {deleting ? 'Deleting Account...' : 'Permanently Delete My Account'}
                </button>
              </div>
            )}
          </div>
        )}

        {screen === 'appearance' && (
          <div className="space-y-2.5">
            {(
              [
                { id: 'light', label: 'Light Mode', desc: 'Bright pink and rose white palette (Default)' },
                { id: 'dark', label: 'Dark Mode', desc: 'Deep charcoal surface optimized for night reading' },
                { id: 'bw', label: 'Black & White', desc: 'High-contrast monochrome appearance across all screens' }
              ] as { id: AppearanceTheme; label: string; desc: string }[]
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => onChangeTheme(opt.id)}
                className={`w-full p-4 rounded-2xl border text-left flex items-center justify-between gap-3 ${
                  theme === opt.id
                    ? 'bg-pink-50 dark:bg-pink-500/15 border-[#FF2D78]'
                    : 'bg-white dark:bg-[#1C1419] border-pink-100 dark:border-white/10'
                }`}
              >
                <div>
                  <p className="text-sm font-bold">{opt.label}</p>
                  <p className="text-xs text-[#6E5A63] dark:text-neutral-400">{opt.desc}</p>
                </div>
                {theme === opt.id && <Check className="w-5 h-5 text-[#FF2D78]" />}
              </button>
            ))}
          </div>
        )}

        {screen === 'privacy' && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-white dark:bg-[#1C1419] border border-pink-100 dark:border-white/10 p-4 space-y-3">
              <p className="text-sm font-bold">Who Can Message Me?</p>
              <div className="grid grid-cols-2 gap-2">
                {(['Everyone', 'Only My Matches'] as MessagePermission[]).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => handleUpdatePrivacy({ whoCanMessageMe: opt })}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold border ${
                      me.privacy.whoCanMessageMe === opt
                        ? 'bg-[#FF2D78] text-white border-[#FF2D78]'
                        : 'border-pink-200 dark:border-white/15'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-white dark:bg-[#1C1419] border border-pink-100 dark:border-white/10 divide-y divide-pink-100 dark:divide-white/10">
              <label className="px-4 py-3.5 flex items-center justify-between cursor-pointer">
                <div>
                  <p className="text-sm font-bold">Online Status</p>
                  <p className="text-xs text-[#6E5A63] dark:text-neutral-400">Show when you are active on IG Meet</p>
                </div>
                <input
                  type="checkbox"
                  checked={me.privacy.showOnlineStatus}
                  onChange={(e) => handleUpdatePrivacy({ showOnlineStatus: e.target.checked })}
                  className="w-5 h-5 accent-[#FF2D78]"
                />
              </label>

              <label className="px-4 py-3.5 flex items-center justify-between cursor-pointer">
                <div>
                  <p className="text-sm font-bold">Last Seen</p>
                  <p className="text-xs text-[#6E5A63] dark:text-neutral-400">Allow others to see your last active time</p>
                </div>
                <input
                  type="checkbox"
                  checked={me.privacy.showLastSeen}
                  onChange={(e) => handleUpdatePrivacy({ showLastSeen: e.target.checked })}
                  className="w-5 h-5 accent-[#FF2D78]"
                />
              </label>
            </div>
          </div>
        )}

        {screen === 'notifications' && (
          <div className="rounded-2xl bg-white dark:bg-[#1C1419] border border-pink-100 dark:border-white/10 divide-y divide-pink-100 dark:divide-white/10">
            {[
              { key: 'allNotifications', label: 'Master Notifications', desc: 'Enable or pause all IG Meet alerts' },
              { key: 'likes', label: 'Likes & Super Likes', desc: 'Alerts when members like your profile' },
              { key: 'messages', label: 'Messages', desc: 'Alerts for new personal messages' },
              { key: 'newMatches', label: 'New Matches', desc: 'Alerts when a mutual match is created' },
              { key: 'announcements', label: 'Announcements', desc: 'Important IG Meet updates and notices' }
            ].map((item) => {
              const k = item.key as keyof UserProfile['notifications'];
              return (
                <label key={item.key} className="px-4 py-3.5 flex items-center justify-between cursor-pointer">
                  <div>
                    <p className="text-sm font-bold">{item.label}</p>
                    <p className="text-xs text-[#6E5A63] dark:text-neutral-400">{item.desc}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={Boolean(me.notifications[k])}
                    onChange={(e) => handleUpdateNotifications({ [k]: e.target.checked })}
                    className="w-5 h-5 accent-[#FF2D78]"
                  />
                </label>
              );
            })}
          </div>
        )}

        {screen === 'help_support' && (
          <div className="space-y-5">
            <form
              onSubmit={handleSubmitTicket}
              className="rounded-2xl bg-white dark:bg-[#1C1419] border border-pink-100 dark:border-white/10 p-4 space-y-3"
            >
              <h2 className="text-sm font-extrabold">Submit a Support Request</h2>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl border border-pink-200 dark:border-white/15 bg-transparent px-3 py-2.5 text-sm outline-none"
              >
                {SUPPORT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat} className="text-black">
                    {cat}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Username or Reference (Optional)"
                value={reportedTarget}
                onChange={(e) => setReportedTarget(e.target.value)}
                className="w-full rounded-xl border border-pink-200 dark:border-white/15 bg-transparent px-3.5 py-2.5 text-sm outline-none"
              />
              <textarea
                rows={3}
                required
                placeholder="Describe your issue in detail..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-xl border border-pink-200 dark:border-white/15 bg-transparent px-3.5 py-2.5 text-sm outline-none"
              />
              <label className="flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-dashed border-pink-200 dark:border-white/20 text-xs cursor-pointer">
                <span>{ticketFile ? ticketFile.name : 'Attach Screenshot (Optional)'}</span>
                <Camera className="w-4 h-4 text-[#FF2D78]" />
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setTicketFile(e.target.files?.[0] || null)}
                />
              </label>
              <button
                type="submit"
                disabled={submittingTicket}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-[#FF2D78] to-[#E91E4D] text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <Send className="w-4 h-4" />
                <span>{submittingTicket ? 'Submitting...' : 'Submit Ticket'}</span>
              </button>
            </form>

            <div className="space-y-2.5">
              <h3 className="text-sm font-extrabold">Your Support Tickets</h3>
              {tickets.length === 0 ? (
                <p className="text-xs text-[#6E5A63] dark:text-neutral-400">
                  No support requests submitted yet.
                </p>
              ) : (
                tickets.map((t) => (
                  <div
                    key={t.id}
                    className="rounded-2xl bg-white dark:bg-[#1C1419] border border-pink-100 dark:border-white/10 p-3.5 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-bold">{t.category}</p>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-pink-50 dark:bg-white/10 text-[#FF2D78]">
                        {t.status}
                      </span>
                    </div>
                    <p className="text-xs text-[#6E5A63] dark:text-neutral-300">{t.description}</p>
                    {t.adminResponse && (
                      <div className="mt-2 p-2.5 rounded-xl bg-pink-50/70 dark:bg-white/5 text-xs">
                        <span className="font-bold">Admin Reply: </span>
                        {t.adminResponse}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {screen === 'blocked_users' && (
          <div className="space-y-2.5">
            {blockedList.length === 0 ? (
              <div className="rounded-2xl bg-white dark:bg-[#1C1419] border border-pink-100 dark:border-white/10 p-6 text-center text-xs text-[#6E5A63] dark:text-neutral-400">
                You have not blocked any users.
              </div>
            ) : (
              blockedList.map((b) => (
                <div
                  key={b.blockedUid}
                  className="rounded-2xl bg-white dark:bg-[#1C1419] border border-pink-100 dark:border-white/10 p-3.5 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {b.blockedPhoto ? (
                      <img src={b.blockedPhoto} alt={b.blockedName} className="w-11 h-11 rounded-xl object-cover" />
                    ) : (
                      <div className="w-11 h-11 rounded-xl bg-pink-100 flex items-center justify-center">
                        <UserIcon className="w-5 h-5 text-[#FF2D78]" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate">{b.blockedName}</p>
                      <p className="text-xs text-[#6E5A63] dark:text-neutral-400 truncate">
                        @{b.blockedUsername} &middot; {new Date(b.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleUnblock(b.blockedUid)}
                    className="px-3 py-1.5 rounded-xl bg-pink-50 dark:bg-white/10 text-[#FF2D78] text-xs font-bold shrink-0"
                  >
                    Unblock
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {screen === 'switch_account' && (
          <div className="space-y-4">
            <p className="text-xs text-[#6E5A63] dark:text-neutral-400">
              You can keep up to 3 accounts on this device ({savedAccounts.length}/3).
            </p>
            <div className="space-y-2.5">
              {savedAccounts.map((acc) => {
                const isActive = acc.uid === me.uid;
                return (
                  <div
                    key={acc.uid}
                    className="rounded-2xl bg-white dark:bg-[#1C1419] border border-pink-100 dark:border-white/10 p-3.5 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {acc.photoUrl ? (
                        <img src={acc.photoUrl} alt={acc.fullName} className="w-11 h-11 rounded-xl object-cover" />
                      ) : (
                        <div className="w-11 h-11 rounded-xl bg-pink-100 flex items-center justify-center">
                          <UserIcon className="w-5 h-5 text-[#FF2D78]" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-bold truncate">{acc.fullName}</p>
                        <p className="text-xs text-[#6E5A63] dark:text-neutral-400 truncate">
                          @{acc.username} &middot; {acc.email}
                        </p>
                      </div>
                    </div>
                    {isActive ? (
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-600 text-[11px] font-bold">
                        Active
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={async () => {
                          await signOut(auth);
                          onToast(`Sign in as ${acc.email} to switch account.`, 'info');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-pink-50 dark:bg-white/10 text-[#FF2D78] text-xs font-bold"
                      >
                        Switch
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {savedAccounts.length < 3 && (
              <button
                type="button"
                onClick={onAddAnotherAccount}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-[#FF2D78] to-[#E91E4D] text-white text-sm font-bold flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Add Account</span>
              </button>
            )}

            <button
              type="button"
              onClick={onLogoutCurrent}
              className="w-full py-3 rounded-2xl border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 text-sm font-bold"
            >
              Logout Current Account Only
            </button>
          </div>
        )}

        {screen === 'support_team' && (
          <div className="space-y-3">
            <p className="text-xs text-[#6E5A63] dark:text-neutral-400">
              Reach out directly to our official IG Meet Support Team channels below.
            </p>
            {enabledSupportContacts.length === 0 ? (
              <div className="rounded-2xl bg-white dark:bg-[#1C1419] border border-pink-100 dark:border-white/10 p-6 text-center space-y-2">
                <Headphones className="w-8 h-8 mx-auto text-[#FF80AB]" />
                <p className="text-sm font-bold">Support Channels Unavailable</p>
                <p className="text-xs text-[#6E5A63] dark:text-neutral-400">
                  No direct support links are configured yet. You can still submit a ticket from Settings &rarr; Help &amp; Support.
                </p>
              </div>
            ) : (
              enabledSupportContacts.map((slot) => (
                <a
                  key={slot.id}
                  href={formatContactLink(slot)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-[#1C1419] border border-pink-100 dark:border-white/10 hover:border-[#FF2D78] transition"
                >
                  <div>
                    <p className="text-sm font-bold">{slot.label}</p>
                    <p className="text-xs text-[#6E5A63] dark:text-neutral-400">
                      {slot.platform} &middot; {slot.value}
                    </p>
                  </div>
                  <ExternalLink className="w-4 h-4 text-[#FF2D78]" />
                </a>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
