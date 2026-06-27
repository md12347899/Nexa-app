import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Home, Store, Briefcase, User, LogOut, Plus, Image as ImageIcon,
  Video, Megaphone, Heart, MessageCircle, Share2, Search, Settings,
  MapPin, Star, CheckCircle2, X, Edit3, Trash2, Send, ChevronLeft,
  ChevronRight, Coffee, HelpCircle, Eye, EyeOff, ShoppingBag, Sparkles,
  Clock, DollarSign, Tag, Filter, Bell, Camera, Link2, ArrowRight,
  Loader2, AlertCircle, Info, UserPlus, UserCheck, ShieldCheck, MoreVertical,
  Upload, Globe, Aperture as InstagramIcon, Play as YoutubeIcon, AtSign as TwitterIcon, Users as FacebookIcon, MessageSquare, Music2,
  Play, Pause, Users
} from "lucide-react";
import { supabase } from "./supabaseClient.js";

/* ============================================================
   NEXA — منصة اجتماعية للمتاجر والمهارات والوظائف
   ============================================================ */

// ---------- أدوات مساعدة ----------
const KEYS = {
  users: (id) => `user:${id}`,
  userIndex: "index:users",
  shop: (uid) => `shop:${uid}`,
  posts: "index:posts",
  post: (id) => `post:${id}`,
  jobs: "index:jobs",
  job: (id) => `job:${id}`,
  jobApps: (jobId) => `jobapps:${jobId}`,
  session: "session:current",
};

const SOCIAL_PLATFORMS = [
  { key: "instagram", label: "إنستغرام", icon: InstagramIcon, placeholder: "رابط حسابك على إنستغرام" },
  { key: "tiktok", label: "تيك توك", icon: Music2, placeholder: "رابط حسابك على تيك توك" },
  { key: "youtube", label: "يوتيوب", icon: YoutubeIcon, placeholder: "رابط قناتك على يوتيوب" },
  { key: "twitter", label: "X (تويتر)", icon: TwitterIcon, placeholder: "رابط حسابك على X" },
  { key: "facebook", label: "فيسبوك", icon: FacebookIcon, placeholder: "رابط صفحتك على فيسبوك" },
  { key: "whatsapp", label: "واتساب", icon: MessageSquare, placeholder: "رابط واتساب أو رقمك" },
  { key: "website", label: "موقع / رابط آخر", icon: Globe, placeholder: "أي رابط تريد إضافته" },
];

function uid(prefix = "id") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

async function sha256(text) {
  try {
    const enc = new TextEncoder().encode(text);
    const buf = await crypto.subtle.digest("SHA-256", enc);
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    // fallback بسيط إن لم يتوفر crypto.subtle
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = (hash << 5) - hash + text.charCodeAt(i);
      hash |= 0;
    }
    return "fb_" + Math.abs(hash).toString(16);
  }
}

function timeAgo(ts) {
  const diff = Math.max(0, Date.now() - ts);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "الآن";
  if (m < 60) return `منذ ${m} د`;
  const h = Math.floor(m / 60);
  if (h < 24) return `منذ ${h} س`;
  const d = Math.floor(h / 24);
  if (d < 30) return `منذ ${d} يوم`;
  const mo = Math.floor(d / 30);
  return `منذ ${mo} شهر`;
}

function isImageUrl(url) {
  return /\.(jpe?g|png|gif|webp|avif)(\?.*)?$/i.test(url || "") || /imgur|images\.unsplash|cloudinary|i\.ibb\.co/i.test(url || "");
}

function isVideoEmbed(url) {
  if (!url) return null;
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{6,})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const dm = url.match(/dailymotion\.com\/video\/([a-zA-Z0-9]+)/);
  if (dm) return `https://www.dailymotion.com/embed/video/${dm[1]}`;
  if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(url)) return url;
  return null;
}

// ---------- تخزين عام (مدعوم بـ Supabase) ----------
// هذه الطبقة تحافظ على نفس الواجهة (dbGet/dbSet/dbDelete/dbList بنفس المفاتيح)
// التي يستخدمها بقية الكود، لكنها تترجمها فعليًا لاستدعاءات Supabase الحقيقية.

function rowToUser(r) {
  if (!r) return null;
  return {
    id: r.id, username: r.username, fullName: r.full_name, passHash: r.pass_hash,
    bio: r.bio || "", avatar: r.avatar || "", cover: r.cover || "", location: r.location || "",
    hasShop: r.has_shop || false, isVerified: r.is_verified || false, isAdmin: r.is_admin || false,
    suspended: r.suspended || false, socialLinks: r.social_links || [], createdAt: r.created_at,
  };
}
function userToRow(u) {
  return {
    id: u.id, username: u.username, full_name: u.fullName, pass_hash: u.passHash,
    bio: u.bio || "", avatar: u.avatar || "", cover: u.cover || "", location: u.location || "",
    has_shop: u.hasShop || false, is_verified: u.isVerified || false, is_admin: u.isAdmin || false,
    social_links: u.socialLinks || [], suspended: u.suspended || false, created_at: u.createdAt,
  };
}
function rowToShop(r) {
  if (!r) return null;
  return {
    ownerId: r.owner_id, name: r.name, category: r.category, description: r.description || "",
    location: r.location || "", coverImage: r.cover_image || "", logo: r.logo || "",
    paymentInfo: r.payment_info || "", products: r.products || [], published: r.published || false,
    verified: r.verified || false, rating: Number(r.rating || 0), salesCount: r.sales_count || 0,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}
function shopToRow(s) {
  return {
    owner_id: s.ownerId, name: s.name, category: s.category, description: s.description || "",
    location: s.location || "", cover_image: s.coverImage || "", logo: s.logo || "",
    payment_info: s.paymentInfo || "", products: s.products || [], published: !!s.published,
    verified: !!s.verified, rating: s.rating || 0, sales_count: s.salesCount || 0,
    created_at: s.createdAt, updated_at: s.updatedAt,
  };
}
function rowToPost(r) {
  if (!r) return null;
  return {
    id: r.id, authorId: r.author_id, type: r.type, text: r.text || "", mediaUrl: r.media_url || "",
    productName: r.product_name || "", price: r.price || "", likes: r.likes || [], comments: r.comments || [],
    pinned: r.pinned || false, createdAt: r.created_at,
  };
}
function postToRow(p) {
  return {
    id: p.id, author_id: p.authorId, type: p.type, text: p.text || "", media_url: p.mediaUrl || "",
    product_name: p.productName || "", price: p.price || "", likes: p.likes || [], comments: p.comments || [],
    pinned: p.pinned || false, created_at: p.createdAt,
  };
}
function rowToJob(r) {
  if (!r) return null;
  return {
    id: r.id, authorId: r.author_id, jobType: r.job_type, title: r.title, description: r.description,
    budget: r.budget || "", location: r.location || "", createdAt: r.created_at,
  };
}
function jobToRow(j) {
  return {
    id: j.id, author_id: j.authorId, job_type: j.jobType, title: j.title, description: j.description,
    budget: j.budget || "", location: j.location || "", created_at: j.createdAt,
  };
}

// dbGet/dbSet يحافظان على نفس التوقيع المستخدم في كل الملف: (key, shared)
// لكن المفتاح الآن يُفسَّر إلى جدول وعملية Supabase مناسبة.
// يحفظ نص آخر خطأ حدث فعليًا من Supabase، لعرضه في الواجهة عند الحاجة بدل الفشل الصامت
let lastDbErrorMessage = "";
function getLastDbError() {
  return lastDbErrorMessage;
}

async function dbGet(key, shared = true) {
  try {
    if (key === KEYS.userIndex) {
      const { data, error } = await supabase.from("users").select("id");
      if (error) throw error;
      return data.map((r) => r.id);
    }
    if (key === KEYS.posts) {
      const { data, error } = await supabase.from("posts").select("id").order("created_at", { ascending: false });
      if (error) throw error;
      return data.map((r) => r.id);
    }
    if (key === KEYS.jobs) {
      const { data, error } = await supabase.from("jobs").select("id").order("created_at", { ascending: false });
      if (error) throw error;
      return data.map((r) => r.id);
    }
    if (key.startsWith("user:")) {
      const id = key.slice(5);
      const { data, error } = await supabase.from("users").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return rowToUser(data);
    }
    if (key.startsWith("uname:")) {
      const username = key.slice(6);
      const { data, error } = await supabase.from("users").select("id").eq("username", username).maybeSingle();
      if (error) throw error;
      return data ? data.id : null;
    }
    if (key.startsWith("shop:")) {
      const ownerId = key.slice(5);
      const { data, error } = await supabase.from("shops").select("*").eq("owner_id", ownerId).maybeSingle();
      if (error) throw error;
      return rowToShop(data);
    }
    if (key.startsWith("post:")) {
      const id = key.slice(5);
      const { data, error } = await supabase.from("posts").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return rowToPost(data);
    }
    if (key.startsWith("job:") && !key.startsWith("jobapps:")) {
      const id = key.slice(4);
      const { data, error } = await supabase.from("jobs").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return rowToJob(data);
    }
    if (key.startsWith("jobapps:")) {
      const jobId = key.slice(8);
      const { data, error } = await supabase.from("job_applications").select("*").eq("job_id", jobId).order("created_at", { ascending: true });
      if (error) throw error;
      return data.map((r) => ({ userId: r.user_id, message: r.message, createdAt: r.created_at }));
    }
    return null;
  } catch (e) {
    console.error("dbGet failed", key, e);
    lastDbErrorMessage = (e && e.message) ? e.message : String(e);
    return null;
  }
}

async function dbSet(key, value, shared = true) {
  try {
    // فهارس المعرفات لا تُكتب مباشرة في Supabase؛ الإدخال الفعلي يحدث عبر إدخال الصف نفسه.
    if (key === KEYS.userIndex || key === KEYS.posts || key === KEYS.jobs) {
      return { key, value, shared };
    }
    if (key.startsWith("user:")) {
      const row = userToRow(value);
      const { error } = await supabase.from("users").upsert(row);
      if (error) throw error;
      return { key, value, shared };
    }
    if (key.startsWith("uname:")) {
      // الربط اسم المستخدم -> id يتم تلقائيًا عبر عمود username الفريد في جدول users
      return { key, value, shared };
    }
    if (key.startsWith("shop:")) {
      const row = shopToRow(value);
      const { error } = await supabase.from("shops").upsert(row);
      if (error) throw error;
      return { key, value, shared };
    }
    if (key.startsWith("post:")) {
      const row = postToRow(value);
      const { error } = await supabase.from("posts").upsert(row);
      if (error) throw error;
      return { key, value, shared };
    }
    if (key.startsWith("job:") && !key.startsWith("jobapps:")) {
      const row = jobToRow(value);
      const { error } = await supabase.from("jobs").upsert(row);
      if (error) throw error;
      return { key, value, shared };
    }
    if (key.startsWith("jobapps:")) {
      const jobId = key.slice(8);
      // value هو المصفوفة الكاملة؛ نضيف فقط آخر عنصر (الأحدث) لتجنب التكرار
      const last = value[value.length - 1];
      if (last) {
        const { error } = await supabase.from("job_applications").insert({
          job_id: jobId, user_id: last.userId, message: last.message, created_at: last.createdAt,
        });
        if (error) throw error;
      }
      return { key, value, shared };
    }
    return null;
  } catch (e) {
    console.error("dbSet failed", key, e);
    lastDbErrorMessage = (e && e.message) ? e.message : String(e);
    return null;
  }
}

async function dbDelete(key, shared = true) {
  try {
    if (key.startsWith("user:")) {
      const id = key.slice(5);
      await supabase.from("users").delete().eq("id", id);
      return { key, deleted: true, shared };
    }
    if (key.startsWith("post:")) {
      const id = key.slice(5);
      await supabase.from("posts").delete().eq("id", id);
      return { key, deleted: true, shared };
    }
    if (key.startsWith("job:")) {
      const id = key.slice(4);
      await supabase.from("jobs").delete().eq("id", id);
      return { key, deleted: true, shared };
    }
    return null;
  } catch {
    return null;
  }
}

async function dbList(prefix, shared = true) {
  return [];
}

// ---------- رفع الملفات (صور وفيديو) إلى Supabase Storage ----------
const MEDIA_BUCKET = "nexa-media";

async function uploadMediaFile(file, folder = "general") {
  try {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${folder}/${uid("media")}.${ext}`;
    const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });
    if (error) throw error;
    const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  } catch (e) {
    console.error("uploadMediaFile failed", e);
    return null;
  }
}

// ---------- وظائف متخصصة: المتابعة، الحذف، التوثيق ----------
const ADMIN_USERNAME = "nexa_admin";

async function followUser(followerId, followingId) {
  try {
    const { error } = await supabase.from("follows").insert({
      follower_id: followerId, following_id: followingId, created_at: Date.now(),
    });
    if (error) throw error;
    return true;
  } catch (e) {
    console.error("followUser failed", e);
    return false;
  }
}

async function unfollowUser(followerId, followingId) {
  try {
    const { error } = await supabase.from("follows")
      .delete().eq("follower_id", followerId).eq("following_id", followingId);
    if (error) throw error;
    return true;
  } catch (e) {
    console.error("unfollowUser failed", e);
    return false;
  }
}

async function isFollowing(followerId, followingId) {
  try {
    const { data, error } = await supabase.from("follows")
      .select("follower_id").eq("follower_id", followerId).eq("following_id", followingId).maybeSingle();
    if (error) throw error;
    return !!data;
  } catch {
    return false;
  }
}

async function getFollowCounts(userId) {
  try {
    const [followers, following] = await Promise.all([
      supabase.from("follows").select("follower_id", { count: "exact", head: true }).eq("following_id", userId),
      supabase.from("follows").select("following_id", { count: "exact", head: true }).eq("follower_id", userId),
    ]);
    return { followers: followers.count || 0, following: following.count || 0 };
  } catch {
    return { followers: 0, following: 0 };
  }
}

async function getFollowingIds(userId) {
  try {
    const { data, error } = await supabase.from("follows").select("following_id").eq("follower_id", userId);
    if (error) throw error;
    return data.map((r) => r.following_id);
  } catch {
    return [];
  }
}

async function getFollowersIds(userId) {
  try {
    const { data, error } = await supabase.from("follows").select("follower_id").eq("following_id", userId);
    if (error) throw error;
    return data.map((r) => r.follower_id);
  } catch {
    return [];
  }
}

async function getFollowListUsers(userId, type) {
  // type: "followers" | "following"
  const ids = type === "followers" ? await getFollowersIds(userId) : await getFollowingIds(userId);
  if (ids.length === 0) return [];
  const users = await Promise.all(ids.map((id) => dbGet(KEYS.users(id), true)));
  return users.filter(Boolean);
}

async function deletePost(postId, authorId, requesterId) {
  // الحذف مسموح فقط لصاحب المنشور (يُفحص أيضًا في الواجهة، وهنا كحارس إضافي)
  if (authorId !== requesterId) return false;
  try {
    const { error } = await supabase.from("posts").delete().eq("id", postId);
    if (error) throw error;
    return true;
  } catch (e) {
    console.error("deletePost failed", e);
    return false;
  }
}

async function setUserVerified(userId, verified, requesterUsername) {
  // التوثيق مسموح فقط لحساب الأدمن (يُفحص أيضًا في الواجهة، وهنا كحارس إضافي)
  if (requesterUsername !== ADMIN_USERNAME) return false;
  try {
    const { error } = await supabase.from("users").update({ is_verified: verified }).eq("id", userId);
    if (error) throw error;
    return true;
  } catch (e) {
    console.error("setUserVerified failed", e);
    return false;
  }
}

// ---------- الستوريز ----------
const STORY_LIFETIME_MS = 24 * 60 * 60 * 1000; // 24 ساعة

async function createStory(authorId, mediaUrl, mediaType = "image") {
  try {
    const id = uid("story");
    const { error } = await supabase.from("stories").insert({
      id, author_id: authorId, media_url: mediaUrl, media_type: mediaType,
      views: [], created_at: Date.now(),
    });
    if (error) throw error;
    return true;
  } catch (e) {
    console.error("createStory failed", e);
    lastDbErrorMessage = (e && e.message) ? e.message : String(e);
    return false;
  }
}

async function getActiveStoriesGrouped() {
  try {
    const cutoff = Date.now() - STORY_LIFETIME_MS;
    const { data, error } = await supabase
      .from("stories")
      .select("*")
      .gt("created_at", cutoff)
      .order("created_at", { ascending: true });
    if (error) throw error;
    const byAuthor = new Map();
    for (const r of data) {
      const story = {
        id: r.id, authorId: r.author_id, mediaUrl: r.media_url, mediaType: r.media_type,
        views: r.views || [], createdAt: r.created_at,
      };
      if (!byAuthor.has(story.authorId)) byAuthor.set(story.authorId, []);
      byAuthor.get(story.authorId).push(story);
    }
    return byAuthor; // Map<authorId, story[]>
  } catch (e) {
    console.error("getActiveStoriesGrouped failed", e);
    return new Map();
  }
}

async function markStoryViewed(storyId, viewerId) {
  try {
    const { data } = await supabase.from("stories").select("views").eq("id", storyId).maybeSingle();
    const views = new Set(data?.views || []);
    if (!views.has(viewerId)) {
      views.add(viewerId);
      await supabase.from("stories").update({ views: [...views] }).eq("id", storyId);
    }
    return true;
  } catch {
    return false;
  }
}

async function deleteStory(storyId, authorId, requesterId) {
  if (authorId !== requesterId) return false;
  try {
    await supabase.from("stories").delete().eq("id", storyId);
    return true;
  } catch {
    return false;
  }
}

// ---------- تحليلات المتجر (للموثقين) ----------
async function recordShopVisit(shopOwnerId, visitorId) {
  if (shopOwnerId === visitorId) return; // لا نسجّل زيارة المالك لمتجره
  try {
    await supabase.from("shop_visits").insert({
      shop_owner_id: shopOwnerId, visitor_id: visitorId, created_at: Date.now(),
    });
  } catch (e) {
    console.error("recordShopVisit failed", e);
  }
}

async function getShopAnalytics(shopOwnerId) {
  try {
    const sevenDaysAgo = Date.now() - 7 * 86400000;
    const { data, error } = await supabase
      .from("shop_visits")
      .select("created_at, visitor_id")
      .eq("shop_owner_id", shopOwnerId)
      .gt("created_at", sevenDaysAgo);
    if (error) throw error;

    const totalVisits = data.length;
    const uniqueVisitors = new Set(data.map((r) => r.visitor_id)).size;

    // تجميع الزيارات حسب اليوم لآخر 7 أيام
    const dayBuckets = Array.from({ length: 7 }, (_, i) => {
      const dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);
      dayStart.setDate(dayStart.getDate() - (6 - i));
      return { date: dayStart, count: 0 };
    });
    for (const row of data) {
      const d = new Date(row.created_at);
      d.setHours(0, 0, 0, 0);
      const bucket = dayBuckets.find((b) => b.date.getTime() === d.getTime());
      if (bucket) bucket.count++;
    }

    return {
      totalVisits,
      uniqueVisitors,
      dailyData: dayBuckets.map((b) => ({
        label: b.date.toLocaleDateString("ar", { weekday: "short" }),
        count: b.count,
      })),
    };
  } catch (e) {
    console.error("getShopAnalytics failed", e);
    return { totalVisits: 0, uniqueVisitors: 0, dailyData: [] };
  }
}

// ---------- لوحة تحكم الأدمن ----------
async function getAllUsersForAdmin() {
  try {
    const { data, error } = await supabase.from("users").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data.map(rowToUser);
  } catch (e) {
    console.error("getAllUsersForAdmin failed", e);
    return [];
  }
}

async function setUserSuspended(userId, suspended, requesterUsername) {
  if (requesterUsername !== ADMIN_USERNAME) return false;
  try {
    const { error } = await supabase.from("users").update({ suspended }).eq("id", userId);
    if (error) throw error;
    return true;
  } catch (e) {
    console.error("setUserSuspended failed", e);
    return false;
  }
}

async function adminDeleteUser(userId, requesterUsername) {
  if (requesterUsername !== ADMIN_USERNAME) return false;
  try {
    const { error } = await supabase.from("users").delete().eq("id", userId);
    if (error) throw error;
    return true;
  } catch (e) {
    console.error("adminDeleteUser failed", e);
    return false;
  }
}

async function getAllPostsForAdmin() {
  try {
    const ids = (await dbGet(KEYS.posts, true)) || [];
    const all = await Promise.all(ids.map((id) => dbGet(KEYS.post(id), true)));
    return all.filter(Boolean).sort((a, b) => b.createdAt - a.createdAt);
  } catch (e) {
    console.error("getAllPostsForAdmin failed", e);
    return [];
  }
}

async function adminDeletePost(postId, requesterUsername) {
  if (requesterUsername !== ADMIN_USERNAME) return false;
  try {
    const { error } = await supabase.from("posts").delete().eq("id", postId);
    if (error) throw error;
    return true;
  } catch (e) {
    console.error("adminDeletePost failed", e);
    return false;
  }
}

// ---------- تسجيل الدخول بجوجل ----------
async function signInWithGoogle() {
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + window.location.pathname },
    });
    if (error) throw error;
    return true;
  } catch (e) {
    console.error("signInWithGoogle failed", e);
    return false;
  }
}

async function getGoogleAuthSession() {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  } catch (e) {
    console.error("getGoogleAuthSession failed", e);
    return null;
  }
}

async function findUserByAuthId(authUserId) {
  try {
    const { data, error } = await supabase.from("users").select("*").eq("auth_user_id", authUserId).maybeSingle();
    if (error) throw error;
    return rowToUser(data);
  } catch (e) {
    console.error("findUserByAuthId failed", e);
    return null;
  }
}

async function createUserFromGoogle(authUserId, email, suggestedUsername, fullName) {
  try {
    const id = uid("u");
    const newUser = {
      id, username: suggestedUsername, fullName: fullName || suggestedUsername,
      passHash: "", bio: "", avatar: "", cover: "", location: "",
      createdAt: Date.now(), hasShop: false,
    };
    const row = { ...userToRow(newUser), auth_user_id: authUserId, email };
    const { error } = await supabase.from("users").insert(row);
    if (error) throw error;
    return newUser;
  } catch (e) {
    console.error("createUserFromGoogle failed", e);
    lastDbErrorMessage = (e && e.message) ? e.message : String(e);
    return null;
  }
}

async function isUsernameTaken(username) {
  try {
    const { data } = await supabase.from("users").select("id").eq("username", username).maybeSingle();
    return !!data;
  } catch {
    return false;
  }
}

async function signOutGoogle() {
  try {
    await supabase.auth.signOut();
  } catch {}
}

// ---------- الرسائل الخاصة ----------
function conversationId(userIdA, userIdB) {
  return [userIdA, userIdB].sort().join("__");
}

async function sendMessage(senderId, receiverId, text, imageUrl = "") {
  try {
    const id = uid("msg");
    const { error } = await supabase.from("messages").insert({
      id, sender_id: senderId, receiver_id: receiverId,
      text: text || "", image_url: imageUrl || "", read: false, created_at: Date.now(),
    });
    if (error) throw error;
    return true;
  } catch (e) {
    console.error("sendMessage failed", e);
    lastDbErrorMessage = (e && e.message) ? e.message : String(e);
    return false;
  }
}

async function getConversation(userIdA, userIdB) {
  try {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .or(`and(sender_id.eq.${userIdA},receiver_id.eq.${userIdB}),and(sender_id.eq.${userIdB},receiver_id.eq.${userIdA})`)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data.map((r) => ({
      id: r.id, senderId: r.sender_id, receiverId: r.receiver_id,
      text: r.text || "", imageUrl: r.image_url || "", read: r.read || false, createdAt: r.created_at,
    }));
  } catch (e) {
    console.error("getConversation failed", e);
    return [];
  }
}

async function getMyConversationsList(userId) {
  try {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order("created_at", { ascending: false });
    if (error) throw error;
    const seen = new Map();
    for (const r of data) {
      const otherId = r.sender_id === userId ? r.receiver_id : r.sender_id;
      if (!seen.has(otherId)) {
        seen.set(otherId, {
          otherUserId: otherId,
          lastText: r.text || (r.image_url ? "📷 صورة" : ""),
          lastAt: r.created_at,
          unread: r.receiver_id === userId && !r.read,
        });
      }
    }
    return Array.from(seen.values());
  } catch (e) {
    console.error("getMyConversationsList failed", e);
    return [];
  }
}

async function markConversationRead(otherUserId, myUserId) {
  try {
    await supabase.from("messages").update({ read: true })
      .eq("sender_id", otherUserId).eq("receiver_id", myUserId).eq("read", false);
    return true;
  } catch {
    return false;
  }
}

async function getUnreadMessagesCount(userId) {
  try {
    const { count, error } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("receiver_id", userId).eq("read", false);
    if (error) throw error;
    return count || 0;
  } catch {
    return 0;
  }
}

// ---------- البحث الشامل ----------
async function searchNexa(query) {
  const q = query.trim();
  if (!q) return { users: [], shops: [], products: [] };
  try {
    const [usersRes, shopsRes] = await Promise.all([
      supabase.from("users").select("*").or(`username.ilike.%${q}%,full_name.ilike.%${q}%`).limit(10),
      supabase.from("shops").select("*").eq("published", true).or(`name.ilike.%${q}%,description.ilike.%${q}%`).limit(10),
    ]);
    const users = (usersRes.data || []).map(rowToUser);
    const shops = (shopsRes.data || []).map(rowToShop);

    // البحث داخل منتجات كل المتاجر المنشورة (تُفحص في الذاكرة لأنها JSONB)
    const { data: allShops } = await supabase.from("shops").select("*").eq("published", true);
    const products = [];
    for (const s of allShops || []) {
      const shopObj = rowToShop(s);
      for (const p of shopObj.products || []) {
        if (p.name?.toLowerCase().includes(q.toLowerCase()) || p.description?.toLowerCase().includes(q.toLowerCase())) {
          products.push({ ...p, shopOwnerId: shopObj.ownerId, shopName: shopObj.name });
        }
      }
    }

    return { users, shops, products: products.slice(0, 10) };
  } catch (e) {
    console.error("searchNexa failed", e);
    return { users: [], shops: [], products: [] };
  }
}

// خاص بالمستخدم الحالي فقط (جهازه) — لتذكر تسجيل الدخول محليًا
const LOCAL_SESSION_KEY = "nexa_local_session_v1";
const SOUND_PREF_KEY = "nexa_sound_enabled_v1";

function isSoundEnabled() {
  try {
    const v = localStorage.getItem(SOUND_PREF_KEY);
    return v === null ? true : v === "true";
  } catch {
    return true;
  }
}
function setSoundEnabled(enabled) {
  try {
    localStorage.setItem(SOUND_PREF_KEY, String(enabled));
  } catch {}
}

// تشغيل صوت تنبيه قصير عند وصول رسالة جديدة، باستخدام Web Audio API
// (لا يعتمد على أي ملف صوتي خارجي، فيعمل دائمًا بدون اتصال بالإنترنت)
function playMessageSound() {
  if (!isSoundEnabled()) return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const playTone = (freq, startTime, duration) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.exponentialRampToValueAtTime(0.18, startTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };
    const now = ctx.currentTime;
    playTone(880, now, 0.12);
    playTone(1320, now + 0.09, 0.15);
    setTimeout(() => ctx.close(), 400);
  } catch {}
}




export default function NexaApp() {
  const [booting, setBooting] = useState(true);
  const [currentUser, setCurrentUser] = useState(null); // { id, username, ... }
  const [googleSignupSession, setGoogleSignupSession] = useState(null);
  const [view, setView] = useState("feed"); // feed | shop | jobs | profile | shopPage | jobDetail | auth
  const [viewParam, setViewParam] = useState(null);
  const [toast, setToast] = useState(null);
  const [showHelp, setShowHelp] = useState(false);

  const showToast = useCallback((msg, type = "ok") => {
    setToast({ msg, type, id: Date.now() });
    setTimeout(() => setToast((t) => (t && t.id === Date.now() ? null : t)), 2600);
  }, []);

  const notify = useCallback((msg, type = "ok") => {
    const id = Date.now();
    setToast({ msg, type, id });
    setTimeout(() => {
      setToast((cur) => (cur && cur.id === id ? null : cur));
    }, 2600);
  }, []);

  // محاولة استرجاع الجلسة محليًا عند الإقلاع
  useEffect(() => {
    (async () => {
      try {
        const localId = localStorage.getItem(LOCAL_SESSION_KEY);
        if (localId) {
          const u = await dbGet(KEYS.users(localId), true);
          if (u) {
            setCurrentUser(u);
            setBooting(false);
            return;
          }
        }
        // تحقق من وجود جلسة جوجل نشطة (المستخدم رجع من شاشة موافقة جوجل)
        const session = await getGoogleAuthSession();
        if (session?.user) {
          const existingUser = await findUserByAuthId(session.user.id);
          if (existingUser) {
            setCurrentUser(existingUser);
            try { localStorage.setItem(LOCAL_SESSION_KEY, existingUser.id); } catch {}
          } else {
            // حساب جوجل جديد، يحتاج اختيار اسم مستخدم لإكمال التسجيل
            setGoogleSignupSession(session);
          }
        }
      } catch {}
      setBooting(false);
    })();
  }, []);

  // فتح متجر مباشرة عبر رابط مختصر (مثل ?s=username)، إذا كان موجودًا في الرابط
  useEffect(() => {
    if (booting || !currentUser) return;
    try {
      const params = new URLSearchParams(window.location.search);
      const shopUsername = params.get("s");
      if (shopUsername) {
        (async () => {
          const ownerId = await dbGet(`uname:${shopUsername}`, true);
          if (ownerId) {
            setView("shopPage");
            setViewParam(ownerId);
          }
        })();
      }
    } catch {}
  }, [booting, currentUser]);

  const handleLogin = (userObj) => {
    setCurrentUser(userObj);
    try {
      localStorage.setItem(LOCAL_SESSION_KEY, userObj.id);
    } catch {}
    setView("feed");
  };

  const handleLogout = () => {
    setCurrentUser(null);
    try {
      localStorage.removeItem(LOCAL_SESSION_KEY);
    } catch {}
    signOutGoogle();
    setView("feed");
  };

  const goTo = (v, param = null) => {
    setView(v);
    setViewParam(param);
  };

  if (booting) {
    return (
      <div className="nexa-root nexa-boot">
        <NexaStyles />
        <div className="boot-logo">
          <NexaLogo size={56} />
          <div className="boot-bar"><div className="boot-bar-fill" /></div>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    if (googleSignupSession) {
      return (
        <div className="nexa-root">
          <NexaStyles />
          <GoogleSignupCompleteScreen
            session={googleSignupSession}
            onComplete={(user) => { setGoogleSignupSession(null); handleLogin(user); }}
            onCancel={async () => { await signOutGoogle(); setGoogleSignupSession(null); }}
            notify={notify}
          />
          {toast && <Toast toast={toast} />}
        </div>
      );
    }
    return (
      <div className="nexa-root">
        <NexaStyles />
        <AuthScreen onLogin={handleLogin} notify={notify} />
        {toast && <Toast toast={toast} />}
      </div>
    );
  }

  return (
    <div className="nexa-root">
      <NexaStyles />
      <AppShell
        currentUser={currentUser}
        setCurrentUser={setCurrentUser}
        view={view}
        viewParam={viewParam}
        goTo={goTo}
        onLogout={handleLogout}
        notify={notify}
        showHelp={showHelp}
        setShowHelp={setShowHelp}
      />
      {toast && <Toast toast={toast} />}
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </div>
  );
}

function Toast({ toast }) {
  return (
    <div className={`nx-toast ${toast.type === "error" ? "nx-toast-err" : "nx-toast-ok"}`} key={toast.id}>
      {toast.type === "error" ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
      <span>{toast.msg}</span>
    </div>
  );
}

function NexaLogo({ size = 28, mono = false }) {
  return (
    <div className="nexa-logo" style={{ width: size, height: size }}>
      <svg viewBox="0 0 48 48" width={size} height={size}>
        <defs>
          <linearGradient id="nxg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#E8B04B" />
            <stop offset="100%" stopColor="#C77F2B" />
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="44" height="44" rx="13" fill={mono ? "none" : "#103B36"} stroke={mono ? "currentColor" : "none"} strokeWidth={mono ? 2 : 0} />
        <path d="M14 33V15.5L34 33V15.5" stroke="url(#nxg)" strokeWidth="4.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    </div>
  );
}

function NexaStyles() {
  return (
    <style>{`
      @import url('https://fonts.cdnfonts.com/css/ibm-plex-sans-arabic');
      .nexa-root {
        --ink: #0E2E2A;
        --ink-soft: #4B6661;
        --paper: #FAF7F1;
        --paper-2: #F1EBDD;
        --line: #E4DCC8;
        --teal: #103B36;
        --teal-2: #1A5048;
        --gold: #E8B04B;
        --gold-2: #C77F2B;
        --red: #C0473A;
        --green: #2E7D5B;
        --shadow: 0 8px 24px -8px rgba(16,59,54,0.18);
        --radius: 16px;
        font-family: 'IBM Plex Sans Arabic', 'Segoe UI', Tahoma, sans-serif;
        direction: rtl;
        background: var(--paper);
        color: var(--ink);
        min-height: 100vh;
        width: 100%;
        position: relative;
        font-size: 15px;
      }
      .nexa-root * { box-sizing: border-box; }
      .nexa-root button { font-family: inherit; cursor: pointer; }
      .nexa-root input, .nexa-root textarea, .nexa-root select {
        font-family: inherit; direction: rtl;
      }
      .nexa-root ::selection { background: var(--gold); color: var(--teal); }

      .nexa-boot {
        display: flex; align-items: center; justify-content: center;
        background: var(--teal);
      }
      .boot-logo { display: flex; flex-direction: column; align-items: center; gap: 18px; }
      .boot-bar { width: 120px; height: 3px; background: rgba(255,255,255,0.15); border-radius: 4px; overflow: hidden; }
      .boot-bar-fill { width: 40%; height: 100%; background: var(--gold); border-radius: 4px; animation: boot 1.1s ease-in-out infinite; }
      @keyframes boot { 0%{transform:translateX(-100%)} 50%{transform:translateX(150%)} 100%{transform:translateX(280%)} }

      .nx-toast {
        position: fixed; top: 18px; left: 50%; transform: translateX(-50%);
        z-index: 999; display: flex; align-items: center; gap: 8px;
        padding: 11px 18px; border-radius: 999px; font-size: 13.5px; font-weight: 600;
        box-shadow: var(--shadow); animation: toastIn 0.25s ease-out;
        max-width: 90vw;
      }
      .nx-toast-ok { background: var(--teal); color: #fff; }
      .nx-toast-err { background: var(--red); color: #fff; }
      @keyframes toastIn { from { opacity:0; transform: translateX(-50%) translateY(-12px);} to {opacity:1; transform: translateX(-50%) translateY(0);} }

      /* ---- شاشة الدخول ---- */
      .auth-screen {
        min-height: 100vh; display: flex; flex-direction: column;
        background: radial-gradient(circle at 30% 0%, #16544c 0%, var(--teal) 55%, #081f1c 100%);
        color: #fff; position: relative; overflow: hidden;
      }
      .auth-pattern {
        position: absolute; inset: 0; opacity: 0.06; pointer-events: none;
        background-image: radial-gradient(circle, #E8B04B 1.5px, transparent 1.5px);
        background-size: 26px 26px;
      }
      .auth-top { padding: 48px 24px 12px; text-align: center; position: relative; z-index: 2; }
      .auth-brand-row { display:flex; align-items:center; justify-content:center; gap:10px; margin-bottom: 14px; }
      .auth-brand-name { font-size: 26px; font-weight: 800; letter-spacing: 0.5px; }
      .auth-tagline { font-size: 14.5px; color: #CFE3DE; max-width: 320px; margin: 0 auto; line-height: 1.7; }
      .auth-card {
        background: var(--paper); color: var(--ink); border-radius: 22px 22px 0 0;
        margin-top: 28px; flex: 1; padding: 28px 22px 90px; position: relative; z-index: 2;
        box-shadow: 0 -16px 40px rgba(0,0,0,0.25);
      }
      .auth-tabs { display: flex; background: var(--paper-2); border-radius: 12px; padding: 4px; margin-bottom: 22px; }
      .auth-tab { flex:1; padding: 10px; border: none; background: transparent; border-radius: 9px; font-weight: 700; font-size: 14px; color: var(--ink-soft); transition: all .15s; }
      .auth-tab.active { background: var(--teal); color: #fff; box-shadow: 0 4px 10px rgba(16,59,54,0.25); }
      .field-group { margin-bottom: 14px; }
      .field-label { font-size: 12.5px; font-weight: 700; color: var(--ink-soft); margin-bottom: 6px; display:block; }
      .field-input-wrap { position: relative; }
      .field-input {
        width: 100%; padding: 13px 14px; border-radius: 12px; border: 1.5px solid var(--line);
        background: #fff; font-size: 14.5px; outline: none; transition: border-color .15s;
      }
      .field-input:focus { border-color: var(--gold-2); }
      .field-input.with-icon { padding-left: 40px; }
      .field-icon-btn { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; color: var(--ink-soft); padding: 4px; }
      .field-error { color: var(--red); font-size: 12.5px; margin-top: 5px; display:flex; align-items:center; gap:4px; }
      .btn-primary {
        width: 100%; padding: 14px; border-radius: 12px; border: none; background: var(--teal);
        color: #fff; font-weight: 700; font-size: 15px; display: flex; align-items:center; justify-content:center; gap:8px;
        transition: filter .15s, transform .1s; box-shadow: 0 6px 16px rgba(16,59,54,0.25);
      }
      .btn-primary:hover { filter: brightness(1.08); }
      .btn-primary:active { transform: scale(0.98); }
      .btn-primary:disabled { opacity: 0.6; cursor: default; }
      .btn-gold {
        background: linear-gradient(135deg, var(--gold), var(--gold-2)); color: var(--teal);
        box-shadow: 0 6px 16px rgba(199,127,43,0.3);
      }
      .btn-ghost {
        width: 100%; padding: 13px; border-radius: 12px; border: 1.5px solid var(--line); background: #fff;
        font-weight: 700; font-size: 14.5px; color: var(--ink); display:flex; align-items:center; justify-content:center; gap:8px;
      }
      .auth-divider { display: flex; align-items: center; text-align: center; margin: 16px 0; color: var(--ink-soft); font-size: 12px; }
      .auth-divider::before, .auth-divider::after { content: ""; flex: 1; height: 1px; background: var(--line); }
      .auth-divider span { padding: 0 10px; }
      .btn-google {
        width: 100%; padding: 13px; border-radius: 12px; border: 1.5px solid var(--line); background: #fff;
        font-weight: 700; font-size: 14px; color: var(--ink); display: flex; align-items: center; justify-content: center; gap: 10px;
      }
      .btn-google:hover { background: var(--paper-2); }
      .auth-hint { text-align:center; font-size: 12.5px; color: var(--ink-soft); margin-top: 16px; line-height: 1.8; }
      .auth-disclaimer {
        background: #FFF6E3; border: 1px solid #F0DCA0; border-radius: 12px; padding: 11px 13px;
        font-size: 12px; color: #6B5419; display:flex; gap: 8px; margin-top: 18px; line-height: 1.7;
      }

      /* ---- الهيكل العام ---- */
      .nx-spin { animation: spin 0.8s linear infinite; }
      @keyframes spin { to { transform: rotate(360deg); } }
      .shell { min-height: 100vh; display: flex; flex-direction: column; padding-bottom: 70px; }
      .shell-header {
        position: sticky; top: 0; z-index: 50; background: rgba(250,247,241,0.96);
        backdrop-filter: blur(8px); border-bottom: 1px solid var(--line);
      }
      .shell-header-inner { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; }
      .brand-btn { display: flex; align-items: center; gap: 8px; background: none; border: none; padding: 0; }
      .brand-text { font-size: 18px; font-weight: 800; color: var(--teal); }
      .shell-header-actions { display: flex; gap: 6px; }
      .icon-btn { background: none; border: none; color: var(--ink); padding: 7px; border-radius: 10px; display:flex; }
      .icon-btn:hover { background: var(--paper-2); }
      .icon-btn-solid { background: var(--teal); color: #fff; border: none; padding: 10px; border-radius: 10px; display:flex; align-items:center; justify-content:center; }
      .header-menu {
        position: absolute; left: 16px; top: 58px; background: #fff; border-radius: 14px; box-shadow: var(--shadow);
        border: 1px solid var(--line); padding: 6px; display: flex; flex-direction: column; min-width: 190px; z-index: 60;
        animation: toastIn 0.18s ease-out;
      }
      .header-menu button {
        display: flex; align-items: center; gap: 9px; background: none; border: none; padding: 11px 12px;
        border-radius: 10px; font-size: 13.5px; font-weight: 600; text-align: right; color: var(--ink);
      }
      .header-menu button:hover { background: var(--paper-2); }
      .header-menu .menu-danger { color: var(--red); }
      .shell-main { flex: 1; padding-bottom: 12px; }
      .page-pad { padding: 14px 16px 24px; max-width: 640px; margin: 0 auto; width: 100%; }
      .page-header { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; min-height: 36px; }
      .page-header h2 { font-size: 19px; font-weight: 800; flex: 1; }
      .back-btn { background: var(--paper-2); border: none; border-radius: 10px; padding: 7px; display: flex; }
      .back-btn.floating { position: absolute; top: 14px; right: 14px; background: rgba(255,255,255,0.92); z-index: 5; }
      .header-add-btn {
        background: var(--teal); color: #fff; border: none; border-radius: 10px; padding: 8px 13px;
        font-size: 13px; font-weight: 700; display: flex; align-items: center; gap: 5px;
      }

      .bottom-nav {
        position: fixed; bottom: 0; left: 0; right: 0; z-index: 50; display: flex;
        background: #fff; border-top: 1px solid var(--line); padding: 7px 6px 10px;
        box-shadow: 0 -4px 16px rgba(0,0,0,0.04);
      }
      .nav-tab {
        flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px;
        background: none; border: none; color: var(--ink-soft); padding: 6px 2px; font-size: 11px; font-weight: 600;
        transition: color 0.15s;
      }
      .nav-tab.active { color: var(--teal); }

      .empty-state { text-align: center; padding: 44px 18px; color: var(--ink-soft); }
      .empty-icon {
        width: 52px; height: 52px; border-radius: 50%; background: var(--paper-2); display: flex;
        align-items: center; justify-content: center; margin: 0 auto 14px; color: var(--gold-2);
      }
      .empty-state h4 { font-size: 15px; color: var(--ink); margin-bottom: 5px; }
      .empty-state p { font-size: 13px; line-height: 1.7; max-width: 280px; margin: 0 auto; }

      .skel-block { background: linear-gradient(90deg, #ECE6D6 25%, #F4EFE2 37%, #ECE6D6 63%); background-size: 400% 100%; animation: shimmer 1.4s ease infinite; border-radius: 14px; }
      .skel-circle { width: 42px; height: 42px; border-radius: 50%; background: linear-gradient(90deg, #ECE6D6 25%, #F4EFE2 37%, #ECE6D6 63%); background-size: 400% 100%; animation: shimmer 1.4s ease infinite; flex-shrink:0; }
      .skel-row { display: flex; gap: 10px; align-items: center; margin-bottom: 12px; }
      .skel-lines { flex: 1; display: flex; flex-direction: column; gap: 6px; }
      .skel-line { height: 9px; border-radius: 5px; background: linear-gradient(90deg, #ECE6D6 25%, #F4EFE2 37%, #ECE6D6 63%); background-size: 400% 100%; animation: shimmer 1.4s ease infinite; }
      .skel-line.w60 { width: 60%; } .skel-line.w30 { width: 30%; }
      @keyframes shimmer { 0% { background-position: 100% 0; } 100% { background-position: -100% 0; } }

      .support-card { background: #fff; border-radius: var(--radius); padding: 22px; text-align: center; box-shadow: var(--shadow); border: 1px solid var(--line); }
      .support-card h3 { margin: 10px 0 6px; font-size: 16px; }
      .support-card p { font-size: 13px; color: var(--ink-soft); line-height: 1.8; }
      .support-placeholder { margin-top: 14px; background: var(--paper-2); border: 1.5px dashed var(--line); border-radius: 10px; padding: 12px; font-size: 12.5px; color: var(--ink-soft); display: flex; align-items: center; justify-content: center; gap: 7px; }
      .ad-slot { margin-top: 14px; background: var(--paper-2); border: 1.5px dashed var(--line); border-radius: 10px; padding: 30px; font-size: 12.5px; color: var(--ink-soft); text-align: center; }

      /* ---- الخلاصة الاجتماعية ---- */
      .feed-wrap { max-width: 640px; margin: 0 auto; padding: 14px 16px 24px; }
      .composer-trigger { background: #fff; border-radius: 16px; padding: 11px 14px; display: flex; align-items: center; gap: 10px; box-shadow: var(--shadow); border: 1px solid var(--line); margin-bottom: 10px; }
      .composer-fake-input { flex: 1; color: var(--ink-soft); font-size: 13.5px; }
      .composer-quick-actions { display: flex; gap: 8px; margin-bottom: 16px; }
      .composer-quick-actions button { flex: 1; background: #fff; border: 1px solid var(--line); border-radius: 11px; padding: 9px; font-size: 12.5px; font-weight: 700; color: var(--ink-soft); display: flex; align-items: center; justify-content: center; gap: 6px; }
      .composer-quick-actions button:hover { border-color: var(--gold-2); color: var(--gold-2); }

      .post-card { background: #fff; border-radius: 18px; padding: 15px; margin-bottom: 14px; box-shadow: var(--shadow); border: 1px solid var(--line); }
      .post-card.pinned { border-color: var(--gold-2); border-width: 1.5px; }
      .pinned-banner {
        display: flex; align-items: center; gap: 5px; color: var(--gold-2); font-size: 11.5px; font-weight: 700;
        margin-bottom: 10px;
      }
      .post-card.skel { padding: 16px; }
      .post-head { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
      .post-head-clickable { display: flex; align-items: center; gap: 10px; cursor: pointer; flex: 1; min-width: 0; }
      .post-head-meta { display: flex; flex-direction: column; flex: 1; min-width: 0; }
      .post-menu-wrap { position: relative; flex-shrink: 0; }
      .post-menu {
        position: absolute; left: 0; top: 38px; background: #fff; border-radius: 12px; box-shadow: var(--shadow);
        border: 1px solid var(--line); padding: 5px; min-width: 150px; z-index: 30; animation: toastIn 0.15s ease-out;
      }
      .post-menu button { display: flex; align-items: center; gap: 8px; width: 100%; background: none; border: none;
        padding: 9px 11px; border-radius: 9px; font-size: 13px; font-weight: 600; text-align: right; }
      .post-menu button:hover { background: var(--paper-2); }
      .post-menu .menu-danger { color: var(--red); }
      .post-author { font-weight: 700; font-size: 14px; display: inline-flex; align-items: center; }
      .post-time { font-size: 11.5px; color: var(--ink-soft); }
      .badge-product { background: #FFF3DC; color: var(--gold-2); font-size: 11px; font-weight: 700; padding: 4px 9px; border-radius: 999px; display: flex; align-items: center; gap: 3px; }
      .post-text { font-size: 14px; line-height: 1.8; margin-bottom: 10px; white-space: pre-wrap; }
      .post-product-card { display: flex; align-items: center; gap: 10px; background: linear-gradient(135deg, #FFF8EA, #FDF1D8); border: 1px solid #F0DCA0; border-radius: 13px; padding: 12px; margin-bottom: 10px; cursor: pointer; }
      .ppc-name { font-weight: 700; font-size: 13.5px; }
      .ppc-price { font-size: 12.5px; color: var(--gold-2); font-weight: 700; margin-top: 2px; }
      .post-product-card svg:first-child { color: var(--gold-2); }
      .post-media { width: 100%; border-radius: 13px; max-height: 420px; object-fit: cover; margin-bottom: 10px; }
      .post-link-fallback { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--teal-2); background: var(--paper-2); padding: 10px 12px; border-radius: 10px; margin-bottom: 10px; }
      .post-video-wrap { border-radius: 13px; overflow: hidden; margin-bottom: 10px; background: #000; aspect-ratio: 16/9; }
      .post-video-frame { width: 100%; height: 100%; border: none; }
      .post-actions { display: flex; gap: 6px; border-top: 1px solid var(--line); padding-top: 8px; }
      .post-action { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; background: none; border: none; padding: 8px; border-radius: 10px; font-size: 12.5px; font-weight: 700; color: var(--ink-soft); }
      .post-action:hover { background: var(--paper-2); }
      .post-action.liked { color: var(--red); }
      .comments-box { border-top: 1px solid var(--line); margin-top: 10px; padding-top: 10px; }
      .comment-row { display: flex; gap: 8px; margin-bottom: 8px; align-items: flex-start; }
      .comment-bubble { background: var(--paper-2); border-radius: 12px; padding: 8px 11px; font-size: 13px; line-height: 1.6; flex: 1; }
      .comment-input-row { display: flex; gap: 8px; margin-top: 6px; }
      .comment-input-row .field-input { padding: 9px 12px; font-size: 13px; }

      .avatar-img { object-fit: cover; flex-shrink: 0; }
      .avatar-fallback { background: linear-gradient(135deg, var(--teal-2), var(--teal)); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; flex-shrink: 0; }

      /* ---- رافع الصور ---- */
      .media-uploader { margin-bottom: 4px; }
      .uploader-box {
        position: relative; width: 100%; border-radius: 14px; background: var(--paper-2);
        border: 1.5px dashed var(--line); overflow: hidden; cursor: pointer; display: flex;
        align-items: center; justify-content: center; transition: border-color .15s;
      }
      .uploader-box:hover { border-color: var(--gold-2); }
      .uploader-box.circle { border-radius: 50%; margin: 0 auto; }
      .uploader-empty { display: flex; flex-direction: column; align-items: center; gap: 6px; color: var(--ink-soft); font-size: 12px; font-weight: 600; }
      .uploader-preview-media { width: 100%; height: 100%; object-fit: cover; }
      .uploader-overlay {
        position: absolute; inset: 0; background: rgba(16,59,54,0.55); color: #fff; display: flex;
        flex-direction: column; align-items: center; justify-content: center; gap: 4px; font-size: 11.5px; font-weight: 700;
        opacity: 0; transition: opacity .15s;
      }
      .uploader-box:hover .uploader-overlay { opacity: 1; }
      .uploader-overlay-loading { position: absolute; inset: 0; background: rgba(16,59,54,0.55); color: #fff; display: flex; align-items: center; justify-content: center; }
      .uploader-remove-btn {
        margin-top: 6px; background: none; border: none; color: var(--red); font-size: 12px; font-weight: 700;
        display: flex; align-items: center; gap: 4px; padding: 2px;
      }
      .uploader-hint { font-size: 11.5px; color: var(--ink-soft); margin: 10px 0 6px; }

      /* ---- النوافذ المنبثقة (Modals) ---- */
      .modal-overlay { position: fixed; inset: 0; background: rgba(14,30,28,0.55); z-index: 200; display: flex; align-items: flex-end; justify-content: center; animation: fadeIn 0.15s; }
      @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      .modal-sheet { background: var(--paper); width: 100%; max-width: 480px; max-height: 88vh; overflow-y: auto; border-radius: 22px 22px 0 0; padding: 10px 20px 28px; animation: sheetUp 0.22s ease-out; }
      .modal-sheet.tall { max-height: 92vh; }
      @keyframes sheetUp { from { transform: translateY(40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      .modal-handle { width: 38px; height: 4px; background: var(--line); border-radius: 4px; margin: 4px auto 14px; }
      .modal-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
      .modal-head h3 { font-size: 17px; font-weight: 800; }
      .composer-type-row { display: flex; gap: 7px; margin-bottom: 14px; flex-wrap: wrap; }
      .type-chip { background: #fff; border: 1.5px solid var(--line); border-radius: 999px; padding: 7px 13px; font-size: 12.5px; font-weight: 700; color: var(--ink-soft); display: flex; align-items: center; gap: 5px; }
      .type-chip.active { background: var(--teal); border-color: var(--teal); color: #fff; }
      .composer-textarea { resize: none; min-height: 80px; }
      .composer-product-fields { display: flex; gap: 8px; margin-top: 10px; }
      .composer-preview { width: 100%; max-height: 180px; object-fit: cover; border-radius: 12px; margin-top: 8px; }
      .danger-ghost { color: var(--red); border-color: #F0C9C2; }

      /* ---- المتاجر ---- */
      .shops-search-row { position: relative; margin-bottom: 12px; }
      .search-icon { position: absolute; right: 13px; top: 50%; transform: translateY(-50%); color: var(--ink-soft); }
      .search-input { padding-right: 38px; }
      .cat-scroll { display: flex; gap: 7px; overflow-x: auto; padding-bottom: 4px; margin-bottom: 14px; scrollbar-width: none; }
      .cat-scroll::-webkit-scrollbar { display: none; }
      .cat-chip { flex-shrink: 0; background: #fff; border: 1.5px solid var(--line); border-radius: 999px; padding: 8px 14px; font-size: 12.5px; font-weight: 700; color: var(--ink-soft); white-space: nowrap; }
      .cat-chip.active { background: var(--gold-2); border-color: var(--gold-2); color: #fff; }

      .shop-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      .shop-card { background: #fff; border-radius: 16px; overflow: hidden; box-shadow: var(--shadow); border: 1px solid var(--line); cursor: pointer; transition: transform 0.15s; }
      .shop-card:active { transform: scale(0.98); }
      .shop-card-cover { height: 84px; background: linear-gradient(135deg, var(--teal-2), var(--teal)); background-size: cover; background-position: center; display: flex; align-items: center; justify-content: center; color: rgba(255,255,255,0.5); }
      .shop-card-body { padding: 11px; }
      .shop-card-title-row { display: flex; align-items: center; gap: 6px; margin-bottom: 5px; }
      .shop-card-name { font-weight: 700; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
      .verified-icon { color: #1D9BF0; flex-shrink: 0; }
      .verified-icon-bg { fill: #1D9BF0; }
      .shop-card-cat { font-size: 11px; color: var(--ink-soft); display: block; margin-bottom: 7px; }
      .shop-card-stats { display: flex; gap: 10px; font-size: 11px; color: var(--ink-soft); }
      .shop-card-stats span { display: flex; align-items: center; gap: 3px; }

      /* ---- صفحة المتجر المميزة ---- */
      .shop-page { max-width: 640px; margin: 0 auto; padding-bottom: 30px; }
      .shop-hero { position: relative; min-height: 230px; background: linear-gradient(135deg, var(--teal-2), var(--teal)); display: flex; align-items: flex-end; padding: 20px 18px; background-size: cover; background-position: center; }
      .shop-owner-actions { position: absolute; top: 14px; left: 14px; right: 56px; display: flex; flex-wrap: wrap; gap: 7px; justify-content: flex-end; }
      .shop-owner-actions .edit-shop-btn, .shop-owner-actions .analytics-btn { padding: 7px 10px; font-size: 11.5px; }
      .edit-shop-btn { background: rgba(255,255,255,0.92); border: none; border-radius: 10px; padding: 8px 13px; font-size: 12.5px; font-weight: 700; display: flex; align-items: center; gap: 6px; color: var(--teal); }
      .profile-cover .edit-shop-btn, .shop-hero > .edit-shop-btn { position: absolute; top: 14px; left: 14px; }
      .analytics-btn { background: rgba(255,255,255,0.92); border: none; border-radius: 10px; padding: 8px 13px; font-size: 12.5px; font-weight: 700; display: flex; align-items: center; gap: 6px; color: var(--gold-2); }

      /* ---- تحليلات المتجر ---- */
      .analytics-stats-row { display: flex; gap: 10px; margin-bottom: 18px; }
      .analytics-stat-card { flex: 1; background: var(--paper-2); border-radius: 14px; padding: 14px; display: flex; flex-direction: column; align-items: center; gap: 4px; }
      .analytics-stat-card b { font-size: 20px; font-weight: 800; color: var(--ink); }
      .analytics-stat-card span { font-size: 11px; color: var(--ink-soft); }
      .analytics-section-title { font-size: 13px; font-weight: 700; margin: 14px 0 10px; color: var(--ink); }
      .analytics-chart { display: flex; justify-content: space-between; gap: 6px; height: 100px; margin-bottom: 10px; }
      .analytics-bar-col { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; gap: 6px; height: 100%; }
      .analytics-bar-track { width: 100%; height: 100%; display: flex; align-items: flex-end; }
      .analytics-bar-fill { width: 100%; background: linear-gradient(180deg, var(--gold), var(--gold-2)); border-radius: 5px 5px 0 0; min-height: 3px; transition: height 0.3s; }
      .analytics-bar-label { font-size: 10px; color: var(--ink-soft); }
      .analytics-product-row { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--line); }
      .analytics-views-badge { font-size: 11px; font-weight: 700; color: var(--ink-soft); display: flex; align-items: center; gap: 3px; flex-shrink: 0; }
      .shop-hero-content { display: flex; align-items: flex-end; gap: 13px; width: 100%; }
      .shop-logo-wrap { border-radius: 14px; border: 3px solid #fff; box-shadow: var(--shadow); overflow: hidden; flex-shrink: 0; }
      .shop-hero-text { color: #fff; padding-bottom: 4px; }
      .shop-hero-name-row { display: flex; align-items: center; gap: 8px; }
      .shop-hero-name-row h1 { font-size: 21px; font-weight: 800; text-shadow: 0 2px 8px rgba(0,0,0,0.3); }
      .verified-pill { background: #1D9BF0; color: #fff; font-size: 10.5px; font-weight: 800; padding: 3px 9px; border-radius: 999px; display: flex; align-items: center; gap: 3px; }
      .verified-pill.admin-pill { background: linear-gradient(135deg, var(--gold), var(--gold-2)); }
      .shop-hero-cat { font-size: 12.5px; opacity: 0.9; margin-top: 3px; }
      .shop-hero-location { font-size: 11.5px; opacity: 0.85; display: flex; align-items: center; gap: 3px; margin-top: 3px; }

      .shop-stats-bar { display: flex; background: #fff; margin: -1px 16px 0; border-radius: 14px; box-shadow: var(--shadow); position: relative; z-index: 2; padding: 14px 0; }
      .shop-stats-bar div { flex: 1; text-align: center; border-right: 1px solid var(--line); }
      .shop-stats-bar div:last-child { border-right: none; }
      .shop-stats-bar b { display: block; font-size: 17px; font-weight: 800; color: var(--teal); }
      .shop-stats-bar span { font-size: 11px; color: var(--ink-soft); }

      .shop-description { padding: 16px 18px 0; font-size: 13.5px; line-height: 1.8; color: var(--ink-soft); }
      .shop-payment-card { display: flex; gap: 10px; background: #FFF8EA; border: 1px solid #F0DCA0; border-radius: 13px; padding: 13px; margin: 14px 18px 0; }
      .shop-payment-card svg { color: var(--gold-2); flex-shrink: 0; margin-top: 1px; }
      .spc-title { font-size: 11.5px; font-weight: 700; color: var(--gold-2); margin-bottom: 3px; }
      .spc-value { font-size: 13px; line-height: 1.6; }

      .shop-tabs-bar { display: flex; gap: 8px; padding: 16px 16px 4px; }
      .shop-tab {
        flex: 1; background: #fff; border: 1.5px solid var(--line); border-radius: 12px; padding: 10px;
        font-size: 12.5px; font-weight: 700; color: var(--ink-soft);
      }
      .shop-tab.active { background: var(--gold-2); border-color: var(--gold-2); color: #fff; }

      .shop-section-head { display: flex; align-items: center; justify-content: space-between; padding: 20px 18px 12px; }
      .shop-section-head h3 { font-size: 15.5px; font-weight: 800; }
      .add-product-btn { background: var(--teal); color: #fff; border: none; border-radius: 10px; padding: 7px 12px; font-size: 12px; font-weight: 700; display: flex; align-items: center; gap: 5px; }

      .products-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 0 18px; }
      .product-card { background: #fff; border-radius: 14px; overflow: hidden; box-shadow: var(--shadow); border: 1px solid var(--line); cursor: pointer; }
      .product-img { height: 100px; background: var(--paper-2); background-size: cover; background-position: center; display: flex; align-items: center; justify-content: center; color: var(--ink-soft); }
      .product-info { padding: 9px 10px; }
      .product-name { display: block; font-size: 12.5px; font-weight: 700; margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .product-price { color: var(--gold-2); font-weight: 700; font-size: 12px; }

      /* ---- الوظائف ---- */
      .job-card { background: #fff; border-radius: 15px; padding: 13px 15px; margin-bottom: 11px; box-shadow: var(--shadow); border: 1px solid var(--line); cursor: pointer; }
      .job-card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 7px; }
      .job-type-pill { font-size: 10.5px; font-weight: 800; padding: 4px 10px; border-radius: 999px; }
      .jt-job { background: #E3EEEC; color: var(--teal-2); }
      .jt-svc { background: #FFF3DC; color: var(--gold-2); }
      .jt-free { background: #F0E6F5; color: #7B4B96; }
      .job-time { font-size: 11px; color: var(--ink-soft); }
      .job-title { font-size: 14.5px; font-weight: 700; margin-bottom: 4px; }
      .job-desc-preview { font-size: 12.5px; color: var(--ink-soft); line-height: 1.6; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; margin-bottom: 9px; }
      .job-card-bottom { display: flex; justify-content: space-between; align-items: center; }
      .job-author { font-size: 11.5px; color: var(--ink-soft); display: flex; align-items: center; gap: 6px; }
      .job-budget { font-size: 11.5px; font-weight: 700; color: var(--gold-2); display: flex; align-items: center; gap: 3px; }

      .job-detail-card { background: #fff; border-radius: 16px; padding: 18px; box-shadow: var(--shadow); border: 1px solid var(--line); margin-bottom: 18px; }
      .job-detail-title { font-size: 18px; font-weight: 800; margin: 10px 0 12px; }
      .job-detail-meta { display: flex; align-items: center; gap: 9px; margin-bottom: 14px; cursor: pointer; }
      .job-author-name { font-size: 13.5px; font-weight: 700; }
      .job-detail-desc { font-size: 13.5px; line-height: 1.85; color: var(--ink-soft); margin-bottom: 12px; white-space: pre-wrap; }
      .job-detail-tags { display: flex; gap: 8px; }
      .job-tag { background: var(--paper-2); font-size: 12px; font-weight: 700; padding: 6px 11px; border-radius: 999px; display: flex; align-items: center; gap: 4px; }
      .section-title { font-size: 14.5px; font-weight: 800; margin-bottom: 10px; }
      .applicant-card { display: flex; gap: 10px; background: #fff; border-radius: 13px; padding: 11px; margin-bottom: 9px; border: 1px solid var(--line); cursor: pointer; }
      .applicant-name { font-weight: 700; font-size: 13px; margin-bottom: 3px; }
      .applicant-msg { font-size: 12.5px; color: var(--ink-soft); line-height: 1.6; }
      .apply-box { background: #fff; border-radius: 16px; padding: 16px; border: 1px solid var(--line); }
      .applied-confirm { display: flex; align-items: center; gap: 8px; color: var(--green); font-weight: 700; font-size: 13.5px; justify-content: center; padding: 8px; }

      /* ---- الملف الشخصي ---- */
      .profile-page { max-width: 640px; margin: 0 auto; padding-bottom: 24px; }
      .profile-cover { position: relative; height: 120px; background: linear-gradient(135deg, var(--gold), var(--gold-2)); background-size: cover; background-position: center; }
      .profile-card {
        background: #fff; border-radius: 20px; margin: -36px 14px 0; padding: 0 18px 18px;
        box-shadow: var(--shadow); border: 1px solid var(--line); position: relative; z-index: 2;
        display: flex; flex-direction: column; align-items: center; text-align: center;
      }
      .profile-avatar-wrap { margin-top: -36px; margin-bottom: 10px; }
      .profile-avatar-wrap .avatar-fallback, .profile-avatar-wrap .avatar-img { border: 4px solid #fff; box-shadow: var(--shadow); }
      .profile-identity h2 { font-size: 18px; font-weight: 800; }
      .profile-username { font-size: 12.5px; color: var(--ink-soft); }
      .profile-location { font-size: 11.5px; color: var(--ink-soft); display: inline-flex; align-items: center; gap: 4px; margin-top: 5px; }
      .profile-bio { font-size: 13px; line-height: 1.7; margin-top: 10px; color: var(--ink); max-width: 380px; padding: 0 6px; }

      .follow-counts-row { display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 13px; color: var(--ink-soft); margin-top: 12px; }
      .follow-counts-row b { color: var(--ink); font-weight: 800; }
      .fc-dot { opacity: 0.5; }

      .profile-social-row { display: flex; gap: 8px; justify-content: center; margin-top: 12px; flex-wrap: wrap; }
      .profile-social-pill {
        width: 36px; height: 36px; border-radius: 50%; background: var(--paper-2); color: var(--teal-2);
        display: flex; align-items: center; justify-content: center; transition: transform .12s, background .15s;
      }
      .profile-social-pill:hover { background: var(--teal); color: #fff; transform: translateY(-2px); }

      .profile-actions-row { display: flex; gap: 9px; margin-top: 16px; justify-content: center; width: 100%; }
      .profile-action-btn { background: #fff; border: 1.5px solid var(--line); border-radius: 11px; padding: 10px 16px; font-size: 13px; font-weight: 700; display: flex; align-items: center; gap: 6px; }
      .profile-action-btn.primary { background: var(--teal); color: #fff; border-color: var(--teal); }
      .profile-action-btn.gold { background: linear-gradient(135deg, var(--gold), var(--gold-2)); color: var(--teal); border-color: transparent; }
      .follow-btn {
        background: var(--teal); color: #fff; border: none; border-radius: 11px;
        padding: 10px 18px; font-size: 13px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px;
      }
      .follow-btn.is-following { background: #fff; color: var(--teal); border: 1.5px solid var(--teal); }
      .follow-btn:disabled { opacity: 0.7; }

      .profile-support-link {
        margin-top: 12px; background: none; border: none; color: var(--ink-soft); font-size: 12px; font-weight: 600;
        display: inline-flex; align-items: center; gap: 5px; text-decoration: underline; text-decoration-color: var(--line);
      }
      .verify-admin-btn {
        margin-top: 12px; background: #fff; color: var(--gold-2); border: 1.5px solid var(--gold-2);
        border-radius: 11px; padding: 9px 16px; font-size: 13px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px;
      }
      .verify-admin-btn.active { background: var(--gold-2); color: #fff; }
      .verify-admin-btn:disabled { opacity: 0.7; }

      .profile-posts-section { padding: 22px 16px 0; }
      .profile-posts-section .section-title { display: flex; align-items: center; gap: 6px; margin-bottom: 12px; color: var(--ink-soft); text-transform: uppercase; font-size: 12px; letter-spacing: 0.3px; }

      .profile-tabs-bar { display: flex; gap: 8px; padding: 16px 16px 0; }
      .profile-tab {
        flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; background: #fff;
        border: 1.5px solid var(--line); border-radius: 12px; padding: 10px; font-size: 12.5px; font-weight: 700; color: var(--ink-soft);
      }
      .profile-tab.active { background: var(--teal); border-color: var(--teal); color: #fff; }

      /* ---- محرر الروابط الاجتماعية ---- */
      .social-link-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
      .social-link-icon { width: 34px; height: 34px; border-radius: 10px; background: var(--paper-2); color: var(--teal-2); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
      .social-link-remove { background: none; border: none; color: var(--ink-soft); flex-shrink: 0; padding: 6px; }
      .add-link-btn {
        background: var(--paper-2); border: 1.5px dashed var(--line); border-radius: 11px; padding: 10px;
        font-size: 13px; font-weight: 700; color: var(--ink-soft); display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%;
      }
      .link-picker {
        position: absolute; top: calc(100% + 6px); left: 0; right: 0; background: #fff; border-radius: 12px;
        box-shadow: var(--shadow); border: 1px solid var(--line); padding: 6px; z-index: 20; max-height: 220px; overflow-y: auto;
      }
      .link-picker button { display: flex; align-items: center; gap: 9px; width: 100%; background: none; border: none; padding: 10px 11px; border-radius: 9px; font-size: 13px; font-weight: 600; text-align: right; color: var(--ink); }
      .link-picker button:hover { background: var(--paper-2); }

      /* ---- المساعدة ---- */
      .help-step { display: flex; gap: 12px; margin-bottom: 16px; align-items: flex-start; }
      .help-step-icon { width: 36px; height: 36px; border-radius: 10px; background: var(--paper-2); color: var(--teal-2); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
      .help-step h4 { font-size: 13.5px; font-weight: 700; margin-bottom: 3px; }
      .help-step p { font-size: 12.5px; color: var(--ink-soft); line-height: 1.7; }

      /* ---- شارة عدد الرسائل في الشريط السفلي ---- */
      .nav-tab-icon-wrap { position: relative; display: inline-flex; }
      .nav-badge {
        position: absolute; top: -6px; left: -10px; background: var(--red); color: #fff; font-size: 9.5px;
        font-weight: 800; min-width: 16px; height: 16px; border-radius: 999px; display: flex; align-items: center;
        justify-content: center; padding: 0 3px; border: 1.5px solid #fff;
      }

      /* ---- جرس الإشعارات في الهيدر ---- */
      .notif-bell-btn { position: relative; }
      .header-badge { position: absolute; top: -2px; left: -4px; }

      /* ---- صفحة الإشعارات ---- */
      .notif-group { margin-bottom: 18px; }
      .notif-group-title { font-size: 12px; font-weight: 700; color: var(--ink-soft); text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 6px; padding: 0 4px; }
      .notif-row {
        display: flex; align-items: center; gap: 12px; padding: 11px 8px; border-radius: 14px; cursor: pointer;
        transition: background .15s;
      }
      .notif-row:hover { background: var(--paper-2); }
      .notif-row.unread { background: #FFF8EA; }
      .notif-avatar-stack { position: relative; flex-shrink: 0; }
      .notif-icon {
        position: absolute; bottom: -3px; left: -3px; width: 20px; height: 20px; border-radius: 50%;
        display: flex; align-items: center; justify-content: center; border: 2px solid #fff;
      }
      .notif-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
      .notif-text { font-size: 13.5px; line-height: 1.5; color: var(--ink); }
      .notif-text b { font-weight: 700; }
      .notif-time { font-size: 11px; color: var(--ink-soft); }
      .notif-dot { width: 9px; height: 9px; border-radius: 50%; background: var(--gold-2); flex-shrink: 0; }

      /* ---- نافذة البحث ---- */
      .search-overlay { align-items: flex-start; padding-top: 0; }
      .search-sheet {
        background: var(--paper); width: 100%; max-width: 480px; height: 100vh; display: flex; flex-direction: column;
        animation: sheetUp 0.18s ease-out;
      }
      .search-input-row { display: flex; align-items: center; gap: 8px; padding: 14px 16px; border-bottom: 1px solid var(--line); background: #fff; }
      .search-input-row .search-icon { color: var(--ink-soft); flex-shrink: 0; }
      .search-input-row .search-input { flex: 1; border: none; background: var(--paper-2); padding: 10px 14px; }
      .search-results-scroll { flex: 1; overflow-y: auto; padding: 10px 16px 30px; }
      .search-loading { display: flex; justify-content: center; padding: 30px; color: var(--ink-soft); }
      .search-section { margin-bottom: 18px; }
      .search-section-title { font-size: 12px; font-weight: 700; color: var(--ink-soft); text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 8px; }
      .search-result-row { display: flex; align-items: center; gap: 11px; padding: 9px 6px; border-radius: 12px; cursor: pointer; }
      .search-result-row:hover { background: var(--paper-2); }
      .search-shop-icon { width: 38px; height: 38px; border-radius: 10px; background: var(--paper-2); color: var(--teal-2); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
      .search-result-body { display: flex; flex-direction: column; flex: 1; min-width: 0; }
      .search-result-name { font-size: 13.5px; font-weight: 700; display: inline-flex; align-items: center; }
      .search-result-sub { font-size: 11.5px; color: var(--ink-soft); }
      .search-result-price { font-size: 12px; font-weight: 700; color: var(--gold-2); flex-shrink: 0; }

      /* ---- قائمة المحادثات ---- */
      .conv-search-row { position: relative; margin-bottom: 10px; }
      .conv-search-row .search-icon { position: absolute; right: 13px; top: 50%; transform: translateY(-50%); color: var(--ink-soft); }
      .conv-search-row .search-input { padding-right: 38px; }
      .conv-row { display: flex; align-items: center; gap: 12px; padding: 12px 6px; border-bottom: 1px solid var(--line); cursor: pointer; }
      .conv-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
      .conv-top-row { display: flex; justify-content: space-between; align-items: center; }
      .conv-name { font-size: 14px; font-weight: 700; display: inline-flex; align-items: center; }
      .conv-time { font-size: 11px; color: var(--ink-soft); flex-shrink: 0; }
      .conv-preview { font-size: 12.5px; color: var(--ink-soft); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .conv-preview.unread { color: var(--ink); font-weight: 700; }
      .conv-dot { width: 9px; height: 9px; border-radius: 50%; background: var(--gold-2); flex-shrink: 0; }

      /* ---- صفحة الدردشة ---- */
      .chat-page {
        position: fixed; inset: 0; z-index: 60; display: flex; flex-direction: column;
        max-width: 640px; margin: 0 auto; background: var(--paper);
      }
      .chat-header { display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-bottom: 1px solid var(--line); background: #fff; position: sticky; top: 0; z-index: 5; }
      .chat-header-user { display: flex; align-items: center; gap: 10px; cursor: pointer; flex: 1; }
      .chat-header-name { font-size: 14px; font-weight: 700; display: inline-flex; align-items: center; }
      .chat-header-username { font-size: 11.5px; color: var(--ink-soft); }
      .chat-messages { flex: 1; overflow-y: auto; padding: 14px 16px; display: flex; flex-direction: column; gap: 8px; }
      .chat-bubble-row { display: flex; justify-content: flex-start; }
      .chat-bubble-row.mine { justify-content: flex-end; }
      .chat-bubble {
        max-width: 78%; background: #fff; border: 1px solid var(--line); border-radius: 16px 16px 16px 4px;
        padding: 9px 13px; font-size: 13.5px; line-height: 1.6; position: relative;
      }
      .chat-bubble.mine { background: var(--teal); color: #fff; border-color: var(--teal); border-radius: 16px 16px 4px 16px; }
      .chat-bubble p { margin: 0; white-space: pre-wrap; }
      .chat-bubble-img { width: 100%; max-width: 220px; border-radius: 10px; margin-bottom: 6px; display: block; }
      .chat-bubble-time { display: block; font-size: 10px; opacity: 0.65; margin-top: 4px; text-align: left; }
      .chat-image-uploader { padding: 10px 16px; border-top: 1px solid var(--line); background: #fff; }
      .chat-cancel-image { margin-top: 6px; background: none; border: none; color: var(--red); font-size: 12px; font-weight: 700; }
      .chat-input-bar { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-top: 1px solid var(--line); background: #fff; }
      .chat-text-input { flex: 1; border: 1.5px solid var(--line); border-radius: 999px; padding: 10px 16px; font-size: 13.5px; outline: none; }
      .chat-text-input:focus { border-color: var(--gold-2); }

      /* ---- صفحة الإعدادات ---- */
      .settings-section { background: #fff; border-radius: 16px; margin-bottom: 16px; border: 1px solid var(--line); overflow: hidden; }
      .settings-section-title { font-size: 12px; font-weight: 700; color: var(--ink-soft); text-transform: uppercase; letter-spacing: 0.3px; padding: 12px 16px 4px; }
      .settings-section-title.danger-title { color: var(--red); }
      .settings-row { display: flex; align-items: center; justify-content: space-between; padding: 13px 16px; border-top: 1px solid var(--line); gap: 12px; }
      .settings-row-text { display: flex; flex-direction: column; gap: 3px; }
      .settings-row-label { font-size: 13.5px; font-weight: 700; }
      .settings-row-hint { font-size: 11.5px; color: var(--ink-soft); }
      .settings-link-row {
        display: flex; align-items: center; justify-content: space-between; width: 100%; background: none; border: none;
        padding: 14px 16px; border-top: 1px solid var(--line); font-size: 13.5px; font-weight: 600; color: var(--ink);
      }
      .settings-link-row:hover { background: var(--paper-2); }
      .settings-link-row.danger { color: var(--red); }

      .donate-card-box { display: flex; align-items: center; gap: 10px; padding: 13px 16px; border-top: 1px solid var(--line); }
      .donate-card-text { display: flex; flex-direction: column; gap: 3px; flex: 1; min-width: 0; }
      .donate-card-label { font-size: 12px; color: var(--ink-soft); }
      .donate-card-number { font-size: 14px; font-weight: 700; letter-spacing: 0.5px; color: var(--teal); }
      .donate-copy-btn {
        background: var(--paper-2); border: none; border-radius: 9px; padding: 7px 12px; font-size: 11.5px;
        font-weight: 700; color: var(--teal-2); display: flex; align-items: center; gap: 4px; flex-shrink: 0;
      }

      .toggle-switch {
        width: 44px; height: 26px; border-radius: 999px; background: var(--line); border: none; position: relative;
        flex-shrink: 0; transition: background .2s;
      }
      .toggle-switch.on { background: var(--teal); }
      .toggle-knob {
        position: absolute; top: 3px; right: 3px; width: 20px; height: 20px; border-radius: 50%; background: #fff;
        box-shadow: 0 1px 3px rgba(0,0,0,0.25); transition: transform .2s;
      }
      .toggle-switch.on .toggle-knob { transform: translateX(-18px); }

      /* ---- شريط الستوريز ---- */
      .stories-bar { display: flex; gap: 14px; overflow-x: auto; padding: 4px 2px 14px; scrollbar-width: none; }
      .stories-bar::-webkit-scrollbar { display: none; }
      .story-item { display: flex; flex-direction: column; align-items: center; gap: 5px; flex-shrink: 0; cursor: pointer; width: 64px; }
      .story-ring { position: relative; width: 60px; height: 60px; border-radius: 50%; display: flex; align-items: center; justify-content: center; padding: 2px; }
      .story-ring.has-story { background: linear-gradient(135deg, var(--gold), var(--gold-2)); }
      .story-ring.add-story { background: var(--paper-2); border: 1.5px dashed var(--line); }
      .story-ring .avatar-img, .story-ring .avatar-fallback { border: 2px solid #fff; }
      .story-add-badge {
        position: absolute; bottom: -2px; left: -2px; width: 20px; height: 20px; border-radius: 50%; background: var(--teal);
        color: #fff; display: flex; align-items: center; justify-content: center; border: 2px solid #fff;
      }
      .story-label { font-size: 11px; color: var(--ink-soft); max-width: 60px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .story-skel { width: 60px; height: 60px; border-radius: 50%; background: linear-gradient(90deg, #ECE6D6 25%, #F4EFE2 37%, #ECE6D6 63%); background-size: 400% 100%; animation: shimmer 1.4s ease infinite; flex-shrink: 0; }

      /* ---- نافذة عرض القصة (كامل الشاشة) ---- */
      .story-viewer-overlay { position: fixed; inset: 0; background: #000; z-index: 300; display: flex; align-items: center; justify-content: center; }
      .story-viewer { position: relative; width: 100%; max-width: 480px; height: 100%; background: #111; overflow: hidden; }
      .story-progress-row { position: absolute; top: 10px; left: 10px; right: 10px; display: flex; gap: 4px; z-index: 5; }
      .story-progress-track { flex: 1; height: 3px; background: rgba(255,255,255,0.3); border-radius: 3px; overflow: hidden; }
      .story-progress-fill { height: 100%; width: 0%; background: #fff; animation-play-state: running; }
      .story-progress-fill.done { width: 100%; }
      .story-progress-fill.active { width: 100%; animation-name: storyFill; animation-timing-function: linear; animation-fill-mode: forwards; }
      .story-progress-fill.active.paused { animation-play-state: paused; }
      @keyframes storyFill { from { width: 0%; } to { width: 100%; } }
      .story-viewer-head { position: absolute; top: 22px; left: 12px; right: 12px; display: flex; align-items: center; gap: 9px; z-index: 5; }
      .story-viewer-name { color: #fff; font-size: 13px; font-weight: 700; }
      .story-viewer-time { color: rgba(255,255,255,0.75); font-size: 11.5px; }
      .story-nav-zones { position: absolute; inset: 0; display: flex; z-index: 3; }
      .story-nav-zone { flex: 1; }
      .story-media { width: 100%; height: 100%; object-fit: contain; background: #000; }
      .story-views-bar { position: absolute; bottom: 16px; left: 16px; color: #fff; font-size: 12.5px; display: flex; align-items: center; gap: 5px; background: rgba(0,0,0,0.4); padding: 6px 12px; border-radius: 999px; z-index: 5; }

      /* ---- تبويبات الخلاصة الفرعية ---- */
      .feed-tabs-row { display: flex; gap: 7px; overflow-x: auto; padding-bottom: 4px; margin-bottom: 14px; scrollbar-width: none; }
      .feed-tabs-row::-webkit-scrollbar { display: none; }
      .feed-tab { flex-shrink: 0; background: #fff; border: 1.5px solid var(--line); border-radius: 999px; padding: 7px 15px; font-size: 12.5px; font-weight: 700; color: var(--ink-soft); white-space: nowrap; }
      .feed-tab.active { background: var(--teal); border-color: var(--teal); color: #fff; }

      /* ---- معالج خطوات إضافة المنتج ---- */
      .step-indicator-row { display: flex; align-items: center; margin-bottom: 20px; padding: 0 2px; }
      .step-dot-wrap { display: flex; flex-direction: column; align-items: center; gap: 5px; }
      .step-dot {
        width: 28px; height: 28px; border-radius: 50%; background: var(--paper-2); color: var(--ink-soft);
        display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700;
        border: 2px solid var(--line); transition: all .2s;
      }
      .step-dot.active { background: var(--gold-2); color: #fff; border-color: var(--gold-2); }
      .step-dot.done { background: var(--teal); color: #fff; border-color: var(--teal); }
      .step-dot-label { font-size: 10px; color: var(--ink-soft); font-weight: 600; white-space: nowrap; }
      .step-connector { flex: 1; height: 2px; background: var(--line); margin: 0 4px; margin-bottom: 16px; }
      .step-connector.done { background: var(--teal); }
      .wizard-step { min-height: 200px; }
      .wizard-actions { display: flex; gap: 10px; margin-top: 16px; }
      .review-card { background: var(--paper-2); border-radius: 14px; overflow: hidden; border: 1px solid var(--line); }
      .review-image { width: 100%; height: 160px; object-fit: cover; display: block; }
      .review-body { padding: 14px; }
      .review-body h4 { font-size: 15px; font-weight: 800; margin-bottom: 4px; }
      .review-desc { font-size: 12.5px; color: var(--ink-soft); line-height: 1.7; margin-top: 8px; }

      /* ---- لوحة تحكم الأدمن ---- */
      .admin-row { display: flex; align-items: center; gap: 10px; padding: 12px; background: #fff; border-radius: 14px; margin-bottom: 9px; border: 1px solid var(--line); }
      .admin-row-main { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; cursor: pointer; }
      .admin-row-text { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
      .admin-row-name { font-size: 13px; font-weight: 700; display: inline-flex; align-items: center; gap: 5px; }
      .admin-row-sub { font-size: 11px; color: var(--ink-soft); font-weight: 500; }
      .admin-post-preview { font-size: 12px; color: var(--ink-soft); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 220px; }
      .admin-row-actions { display: flex; flex-direction: column; gap: 6px; flex-shrink: 0; }
      .admin-action-btn {
        background: var(--paper-2); border: none; border-radius: 9px; padding: 6px 10px; font-size: 11px;
        font-weight: 700; color: var(--ink-soft); display: flex; align-items: center; gap: 4px; white-space: nowrap;
      }
      .admin-action-btn.danger { background: #FBE8E6; color: var(--red); }
      .suspended-tag { background: var(--red); color: #fff; font-size: 9.5px; font-weight: 800; padding: 2px 7px; border-radius: 999px; }

      @media (max-width: 380px) {
        .shop-grid, .products-grid { grid-template-columns: 1fr 1fr; gap: 9px; }
      }
    `}</style>
  );
}

/* ============================================================
   شاشة المصادقة (تسجيل / دخول)
   ============================================================ */
function AuthScreen({ onLogin, notify }) {
  const [mode, setMode] = useState("login"); // login | signup
  const [form, setForm] = useState({ username: "", fullName: "", password: "", confirm: "" });
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const normalizeUsername = (s) =>
    s.trim().toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9_\u0600-\u06FF]/g, "");

  const submit = async () => {
    setError("");
    const username = normalizeUsername(form.username);
    if (!username || username.length < 3) {
      setError("اسم المستخدم يجب أن يكون 3 أحرف على الأقل");
      return;
    }
    if (!form.password || form.password.length < 4) {
      setError("كلمة المرور يجب أن تكون 4 أحرف على الأقل");
      return;
    }
    setLoading(true);
    try {
      if (mode === "signup") {
        if (form.password !== form.confirm) {
          setError("كلمتا المرور غير متطابقتين");
          setLoading(false);
          return;
        }
        const existing = await dbGet(`uname:${username}`, true);
        if (existing) {
          setError("اسم المستخدم هذا محجوز، جرّب اسمًا آخر");
          setLoading(false);
          return;
        }
        const id = uid("u");
        const passHash = await sha256(form.password + "::nexa::" + username);
        const newUser = {
          id,
          username,
          fullName: form.fullName.trim() || username,
          passHash,
          bio: "",
          avatar: "",
          cover: "",
          location: "",
          createdAt: Date.now(),
          hasShop: false,
        };
        const saveResult = await dbSet(KEYS.users(id), newUser, true);
        if (!saveResult) {
          const detail = getLastDbError();
          setError("تعذّر إنشاء الحساب فعليًا في قاعدة البيانات." + (detail ? ` (تفصيل الخطأ: ${detail})` : " تأكد من اتصال الإنترنت وحاول مجددًا."));
          setLoading(false);
          return;
        }
        await dbSet(`uname:${username}`, id, true);
        // فهرس المستخدمين
        const idx = (await dbGet(KEYS.userIndex, true)) || [];
        idx.push(id);
        await dbSet(KEYS.userIndex, idx, true);

        notify("تم إنشاء حسابك بنجاح، مرحبًا بك في نِكسا 🎉");
        onLogin(newUser);
      } else {
        const userId = await dbGet(`uname:${username}`, true);
        if (!userId) {
          setError("لا يوجد حساب بهذا الاسم");
          setLoading(false);
          return;
        }
        const userObj = await dbGet(KEYS.users(userId), true);
        if (!userObj) {
          setError("تعذّر العثور على الحساب");
          setLoading(false);
          return;
        }
        const passHash = await sha256(form.password + "::nexa::" + username);
        if (passHash !== userObj.passHash) {
          setError("كلمة المرور غير صحيحة");
          setLoading(false);
          return;
        }
        if (userObj.suspended) {
          setError("هذا الحساب معلَّق حاليًا ولا يمكن تسجيل الدخول إليه. تواصل مع الإدارة لمزيد من المعلومات.");
          setLoading(false);
          return;
        }
        notify(`أهلًا بعودتك، ${userObj.fullName} 👋`);
        onLogin(userObj);
      }
    } catch (e) {
      setError("حدث خطأ غير متوقع، حاول مجددًا");
    }
    setLoading(false);
  };

  return (
    <div className="auth-screen">
      <div className="auth-pattern" />
      <div className="auth-top">
        <div className="auth-brand-row">
          <NexaLogo size={42} />
          <span className="auth-brand-name">نِكسا</span>
        </div>
        <p className="auth-tagline">سوقك ومهاراتك ومجتمعك، في مكان واحد. أنشئ حسابك، افتح متجرك، وابدأ بالتواصل.</p>
      </div>

      <div className="auth-card">
        <div className="auth-tabs">
          <button className={`auth-tab ${mode === "login" ? "active" : ""}`} onClick={() => { setMode("login"); setError(""); }}>
            تسجيل الدخول
          </button>
          <button className={`auth-tab ${mode === "signup" ? "active" : ""}`} onClick={() => { setMode("signup"); setError(""); }}>
            حساب جديد
          </button>
        </div>

        {mode === "signup" && (
          <div className="field-group">
            <label className="field-label">الاسم الكامل</label>
            <input
              className="field-input"
              placeholder="مثال: سارة أحمد"
              value={form.fullName}
              onChange={(e) => update("fullName", e.target.value)}
            />
          </div>
        )}

        <div className="field-group">
          <label className="field-label">اسم المستخدم</label>
          <input
            className="field-input"
            placeholder="بدون مسافات، مثل: sara_ahmad"
            value={form.username}
            onChange={(e) => update("username", e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
        </div>

        <div className="field-group">
          <label className="field-label">كلمة المرور</label>
          <div className="field-input-wrap">
            <input
              className="field-input with-icon"
              type={showPass ? "text" : "password"}
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
            <button className="field-icon-btn" onClick={() => setShowPass((s) => !s)} type="button">
              {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
        </div>

        {mode === "signup" && (
          <div className="field-group">
            <label className="field-label">تأكيد كلمة المرور</label>
            <input
              className="field-input"
              type={showPass ? "text" : "password"}
              placeholder="••••••••"
              value={form.confirm}
              onChange={(e) => update("confirm", e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
          </div>
        )}

        {error && <div className="field-error"><AlertCircle size={14} /> {error}</div>}

        <div style={{ marginTop: 18 }}>
          <button className="btn-primary" onClick={submit} disabled={loading}>
            {loading ? <Loader2 size={18} className="nx-spin" /> : mode === "login" ? "دخول" : "إنشاء الحساب"}
          </button>
        </div>

        <div className="auth-divider"><span>أو</span></div>

        <button className="btn-google" onClick={async () => {
          setError("");
          const ok = await signInWithGoogle();
          if (!ok) setError("تعذّر بدء تسجيل الدخول بجوجل، حاول مجددًا");
        }}>
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.1 8.1 3l5.7-5.7C34.5 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z"/>
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.4 18.9 12 24 12c3.1 0 5.9 1.1 8.1 3l5.7-5.7C34.5 6.1 29.5 4 24 4c-7.6 0-14.1 4.3-17.7 10.7z"/>
            <path fill="#4CAF50" d="M24 44c5.4 0 10.3-2.1 14-5.4l-6.4-5.4C29.5 34.6 26.9 35.5 24 35.5c-5.2 0-9.6-3.3-11.3-8l-6.6 5.1C9.9 39.6 16.4 44 24 44z"/>
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.6l6.4 5.4C40.9 36 44 30.5 44 24c0-1.2-.1-2.4-.4-3.5z"/>
          </svg>
          الدخول باستخدام جوجل
        </button>

        <p className="auth-hint">
          {mode === "login" ? "لا تملك حسابًا؟" : "لديك حساب بالفعل؟"}{" "}
          <a href="#" onClick={(e) => { e.preventDefault(); setMode(mode === "login" ? "signup" : "login"); setError(""); }} style={{ color: "var(--gold-2)", fontWeight: 700 }}>
            {mode === "login" ? "أنشئ حسابًا جديدًا" : "سجّل الدخول"}
          </a>
        </p>

        <div className="auth-disclaimer">
          <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>بياناتك تُحفظ ضمن نظام تخزين نِكسا الخاص بهذا التطبيق. استخدم كلمة مرور لا تستعملها في حسابات حساسة أخرى.</span>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   الهيكل العام للتطبيق (Shell)
   ============================================================ */
function AppShell({ currentUser, setCurrentUser, view, viewParam, goTo, onLogout, notify, showHelp, setShowHelp }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const hasLoadedUnreadOnce = useRef(false);

  const refreshUnread = useCallback(async () => {
    const c = await getUnreadMessagesCount(currentUser.id);
    setUnreadCount((prev) => {
      if (hasLoadedUnreadOnce.current && view !== "chat" && c > prev) playMessageSound();
      hasLoadedUnreadOnce.current = true;
      return c;
    });
  }, [currentUser.id, view]);

  const refreshNotifUnread = useCallback(async () => {
    const c = await getUnreadNotificationsCount(currentUser.id);
    setUnreadNotifCount(c);
  }, [currentUser.id]);

  useEffect(() => {
    refreshUnread();
    refreshNotifUnread();
    const interval = setInterval(() => { refreshUnread(); refreshNotifUnread(); }, 15000);
    return () => clearInterval(interval);
  }, [refreshUnread, refreshNotifUnread]);

  const tabs = [
    { key: "feed", label: "الرئيسية", icon: Home },
    { key: "shops", label: "المتاجر", icon: Store },
    { key: "jobs", label: "الوظائف", icon: Briefcase },
    { key: "messages", label: "الرسائل", icon: MessageSquare, badge: unreadCount },
    { key: "profile", label: "حسابي", icon: User },
  ];

  return (
    <div className="shell">
      <header className="shell-header">
        <div className="shell-header-inner">
          <button className="brand-btn" onClick={() => goTo("feed")}>
            <NexaLogo size={30} />
            <span className="brand-text">نِكسا</span>
          </button>
          <div className="shell-header-actions">
            <button className="icon-btn" onClick={() => setSearchOpen(true)} title="بحث">
              <Search size={20} />
            </button>
            <button className="icon-btn notif-bell-btn" onClick={() => goTo("notifications")} title="الإشعارات">
              <Bell size={20} />
              {unreadNotifCount > 0 && <span className="nav-badge header-badge">{unreadNotifCount > 9 ? "9+" : unreadNotifCount}</span>}
            </button>
            <button className="icon-btn" onClick={() => setShowHelp(true)} title="مساعدة">
              <HelpCircle size={20} />
            </button>
            <button className="icon-btn" onClick={() => setMenuOpen((m) => !m)} title="القائمة">
              <Settings size={20} />
            </button>
          </div>
        </div>
        {menuOpen && (
          <div className="header-menu">
            <button onClick={() => { goTo("profile"); setMenuOpen(false); }}>
              <User size={16} /> حسابي
            </button>
            {currentUser.username === ADMIN_USERNAME && (
              <button onClick={() => { goTo("adminDashboard"); setMenuOpen(false); }}>
                <ShieldCheck size={16} /> لوحة تحكم الأدمن
              </button>
            )}
            <button onClick={() => { goTo("settings"); setMenuOpen(false); }}>
              <Settings size={16} /> الإعدادات
            </button>
            <button onClick={() => { goTo("support"); setMenuOpen(false); }}>
              <Coffee size={16} /> دعم نِكسا
            </button>
            <button onClick={() => { setShowHelp(true); setMenuOpen(false); }}>
              <HelpCircle size={16} /> كيف يعمل التطبيق؟
            </button>
            <button onClick={() => { setMenuOpen(false); setConfirmLogout(true); }} className="menu-danger">
              <LogOut size={16} /> تسجيل الخروج
            </button>
          </div>
        )}
      </header>

      {confirmLogout && (
        <ConfirmModal
          title="تسجيل الخروج؟"
          text="ستحتاج لتسجيل الدخول مجددًا للوصول لحسابك."
          confirmLabel="تسجيل الخروج"
          danger
          onConfirm={() => { setConfirmLogout(false); onLogout(); }}
          onCancel={() => setConfirmLogout(false)}
        />
      )}

      <main className="shell-main">
        {view === "feed" && <FeedView currentUser={currentUser} goTo={goTo} notify={notify} />}
        {view === "shops" && <ShopsDirectory currentUser={currentUser} goTo={goTo} notify={notify} />}
        {view === "shopPage" && <ShopPage shopOwnerId={viewParam} currentUser={currentUser} goTo={goTo} notify={notify} />}
        {view === "jobs" && <JobsView currentUser={currentUser} goTo={goTo} notify={notify} />}
        {view === "jobDetail" && <JobDetailView jobId={viewParam} currentUser={currentUser} goTo={goTo} notify={notify} />}
        {view === "messages" && <ConversationsListView currentUser={currentUser} goTo={goTo} notify={notify} onRead={refreshUnread} />}
        {view === "chat" && <ChatView currentUser={currentUser} otherUserId={viewParam} goTo={goTo} notify={notify} onRead={refreshUnread} />}
        {view === "notifications" && <NotificationsView currentUser={currentUser} goTo={goTo} onRead={refreshNotifUnread} />}
        {view === "profile" && (
          <ProfileView
            currentUser={currentUser}
            setCurrentUser={setCurrentUser}
            goTo={goTo}
            notify={notify}
          />
        )}
        {view === "userProfile" && (
          <ProfileView
            currentUser={currentUser}
            setCurrentUser={setCurrentUser}
            goTo={goTo}
            notify={notify}
            viewUserId={viewParam}
          />
        )}
        {view === "support" && <SupportView goTo={goTo} />}
        {view === "settings" && <SettingsView currentUser={currentUser} setCurrentUser={setCurrentUser} goTo={goTo} notify={notify} onLogout={onLogout} />}
        {view === "adminDashboard" && currentUser.username === ADMIN_USERNAME && (
          <AdminDashboardView currentUser={currentUser} goTo={goTo} notify={notify} />
        )}
      </main>

      <nav className="bottom-nav">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = view === t.key
            || (t.key === "shops" && view === "shopPage")
            || (t.key === "jobs" && view === "jobDetail")
            || (t.key === "profile" && view === "userProfile")
            || (t.key === "messages" && view === "chat");
          return (
            <button key={t.key} className={`nav-tab ${active ? "active" : ""}`} onClick={() => goTo(t.key)}>
              <span className="nav-tab-icon-wrap">
                <Icon size={22} strokeWidth={active ? 2.4 : 1.8} />
                {t.badge > 0 && <span className="nav-badge">{t.badge > 9 ? "9+" : t.badge}</span>}
              </span>
              <span>{t.label}</span>
            </button>
          );
        })}
      </nav>

      {searchOpen && (
        <SearchModal currentUser={currentUser} goTo={goTo} onClose={() => setSearchOpen(false)} />
      )}
    </div>
  );
}

function SupportView({ goTo }) {
  return (
    <div className="page-pad">
      <PageHeader title="دعم نِكسا" onBack={() => goTo("feed")} />
      <div className="support-card">
        <Coffee size={34} style={{ color: "var(--gold-2)" }} />
        <h3>نِكسا مجاني بالكامل</h3>
        <p>
          هذا التطبيق لا يحتوي أي اشتراكات أو مدفوعات داخلية. إذا أحببت الفكرة وتريد دعم استمراره،
          يمكنك ذلك عبر رابط دعم يضعه القائمون على المنصة هنا لاحقًا.
        </p>
        <div className="support-placeholder">
          <Link2 size={16} /> سيتم إضافة رابط الدعم هنا
        </div>
      </div>
      <div className="support-card" style={{ marginTop: 14 }}>
        <Megaphone size={30} style={{ color: "var(--teal-2)" }} />
        <h3>إعلانات</h3>
        <p>هذا المكان مخصص لعرض إعلانات Google أو شركاء آخرين عند نشر التطبيق على استضافة مستقلة.</p>
        <div className="ad-slot">مساحة إعلانية</div>
      </div>
    </div>
  );
}

function PageHeader({ title, onBack, action }) {
  return (
    <div className="page-header">
      {onBack && (
        <button className="back-btn" onClick={onBack}>
          <ChevronRight size={20} />
        </button>
      )}
      <h2>{title}</h2>
      {action}
    </div>
  );
}

function EmptyState({ icon: Icon, title, hint, action }) {
  return (
    <div className="empty-state">
      <div className="empty-icon"><Icon size={26} /></div>
      <h4>{title}</h4>
      {hint && <p>{hint}</p>}
      {action}
    </div>
  );
}

/* ============================================================
   الخلاصة الاجتماعية (Feed)
   ============================================================ */
function FeedView({ currentUser, goTo, notify }) {
  const [posts, setPosts] = useState(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [usersCache, setUsersCache] = useState({});
  const [activeTab, setActiveTab] = useState("all"); // all | recent | shops | following
  const [followingIds, setFollowingIds] = useState(null);
  const [shopOwnerIds, setShopOwnerIds] = useState(null);

  const loadPosts = useCallback(async () => {
    const ids = (await dbGet(KEYS.posts, true)) || [];
    const loaded = await Promise.all(ids.map((id) => dbGet(KEYS.post(id), true)));
    const valid = loaded.filter(Boolean).sort((a, b) => b.createdAt - a.createdAt);
    setPosts(valid);
    const authorIds = [...new Set(valid.map((p) => p.authorId))];
    const missing = authorIds.filter((id) => !usersCache[id]);
    if (missing.length) {
      const fetched = await Promise.all(missing.map((id) => dbGet(KEYS.users(id), true)));
      const map = {};
      missing.forEach((id, i) => { if (fetched[i]) map[id] = fetched[i]; });
      setUsersCache((c) => ({ ...c, ...map }));
    }
  }, [usersCache]);

  const loadFilters = useCallback(async () => {
    const [followIds, userIdx] = await Promise.all([
      getFollowingIds(currentUser.id),
      dbGet(KEYS.userIndex, true),
    ]);
    setFollowingIds(new Set(followIds));
    const allShops = await Promise.all((userIdx || []).map((id) => dbGet(KEYS.shop(id), true)));
    setShopOwnerIds(new Set(allShops.filter((s) => s && s.published).map((s) => s.ownerId)));
  }, [currentUser.id]);

  useEffect(() => { loadPosts(); loadFilters(); }, []);

  const handleCreated = () => {
    setComposerOpen(false);
    loadPosts();
    notify("تم نشر منشورك");
  };

  const filteredPosts = useMemo(() => {
    if (!posts) return null;
    if (activeTab === "recent") return posts.slice(0, 20);
    if (activeTab === "shops") return posts.filter((p) => shopOwnerIds?.has(p.authorId));
    if (activeTab === "following") return posts.filter((p) => followingIds?.has(p.authorId));
    return posts;
  }, [posts, activeTab, followingIds, shopOwnerIds]);

  const feedTabs = [
    { key: "all", label: "الكل" },
    { key: "recent", label: "الأحدث" },
    { key: "shops", label: "متاجر مميزة" },
    { key: "following", label: "متابَع" },
  ];

  return (
    <div className="feed-wrap">
      <StoriesBar currentUser={currentUser} notify={notify} />

      <div className="feed-tabs-row">
        {feedTabs.map((t) => (
          <button key={t.key} className={`feed-tab ${activeTab === t.key ? "active" : ""}`} onClick={() => setActiveTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="composer-trigger" onClick={() => setComposerOpen(true)}>
        <div className="composer-avatar"><Avatar user={currentUser} size={38} /></div>
        <div className="composer-fake-input">شاركنا بخاطرك، منتجك، أو مهارتك...</div>
        <Plus size={18} />
      </div>

      <div className="composer-quick-actions">
        <button onClick={() => setComposerOpen(true)}><ImageIcon size={16} /> صورة</button>
        <button onClick={() => setComposerOpen(true)}><Video size={16} /> فيديو</button>
        <button onClick={() => setComposerOpen(true)}><Megaphone size={16} /> إعلان منتج</button>
      </div>

      {filteredPosts === null && <FeedSkeleton />}
      {filteredPosts && filteredPosts.length === 0 && (
        <EmptyState icon={MessageCircle} title="لا توجد منشورات هنا" hint={activeTab === "following" ? "تابع بعض الحسابات لترى منشوراتها هنا" : "كن أول من يشارك شيئًا في مجتمع نِكسا"} />
      )}
      {filteredPosts && filteredPosts.map((p) => (
        <PostCard key={p.id} post={p} author={usersCache[p.authorId]} currentUser={currentUser} goTo={goTo} onChanged={loadPosts} notify={notify} />
      ))}

      {composerOpen && (
        <PostComposer
          currentUser={currentUser}
          onClose={() => setComposerOpen(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div>
      {[1, 2].map((i) => (
        <div className="post-card skel" key={i}>
          <div className="skel-row">
            <div className="skel-circle" />
            <div className="skel-lines"><div className="skel-line w60" /><div className="skel-line w30" /></div>
          </div>
          <div className="skel-block" />
        </div>
      ))}
    </div>
  );
}

/* ============================================================
   شريط الستوريز
   ============================================================ */
function StoriesBar({ currentUser, notify }) {
  const [storiesMap, setStoriesMap] = useState(null); // Map<authorId, story[]>
  const [usersCache, setUsersCache] = useState({});
  const [composerOpen, setComposerOpen] = useState(false);
  const [viewingAuthorId, setViewingAuthorId] = useState(null);

  const load = useCallback(async () => {
    const map = await getActiveStoriesGrouped();
    setStoriesMap(map);
    const ids = [...map.keys()];
    const fetched = await Promise.all(ids.map((id) => dbGet(KEYS.users(id), true)));
    const cache = {};
    ids.forEach((id, i) => { if (fetched[i]) cache[id] = fetched[i]; });
    setUsersCache(cache);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (storiesMap === null) {
    return (
      <div className="stories-bar">
        {[1, 2, 3, 4].map((i) => <div key={i} className="story-skel" />)}
      </div>
    );
  }

  const authorIds = [...storiesMap.keys()].filter((id) => id !== currentUser.id);
  const myStories = storiesMap.get(currentUser.id) || [];

  return (
    <div className="stories-bar">
      <div className="story-item" onClick={() => (myStories.length ? setViewingAuthorId(currentUser.id) : setComposerOpen(true))}>
        <div className={`story-ring ${myStories.length ? "has-story" : "add-story"}`}>
          <Avatar user={currentUser} size={56} />
          {!myStories.length && (
            <span className="story-add-badge" onClick={(e) => { e.stopPropagation(); setComposerOpen(true); }}>
              <Plus size={12} />
            </span>
          )}
        </div>
        <span className="story-label">إضافة</span>
      </div>

      {authorIds.map((id) => {
        const u = usersCache[id];
        return (
          <div className="story-item" key={id} onClick={() => setViewingAuthorId(id)}>
            <div className="story-ring has-story">
              <Avatar user={u} size={56} />
            </div>
            <span className="story-label">{(u?.fullName || "مستخدم").split(" ")[0]}</span>
          </div>
        );
      })}

      {composerOpen && (
        <StoryComposer
          currentUser={currentUser}
          onClose={() => setComposerOpen(false)}
          onCreated={() => { setComposerOpen(false); load(); notify("تم نشر قصتك"); }}
        />
      )}
      {viewingAuthorId && (
        <StoryViewer
          authorId={viewingAuthorId}
          stories={storiesMap.get(viewingAuthorId) || []}
          author={usersCache[viewingAuthorId] || currentUser}
          currentUser={currentUser}
          onClose={() => { setViewingAuthorId(null); load(); }}
          notify={notify}
        />
      )}
    </div>
  );
}

function StoryComposer({ currentUser, onClose, onCreated }) {
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState("image");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!mediaUrl) { setError("أضف صورة أو فيديو للقصة"); return; }
    setPosting(true);
    const ok = await createStory(currentUser.id, mediaUrl, mediaType);
    setPosting(false);
    if (ok) onCreated();
    else setError("تعذّر نشر القصة، حاول مجددًا");
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-handle" />
        <div className="modal-head">
          <h3>قصة جديدة</h3>
          <button className="icon-btn" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="composer-type-row">
          <button className={`type-chip ${mediaType === "image" ? "active" : ""}`} onClick={() => { setMediaType("image"); setMediaUrl(""); }}>
            <ImageIcon size={15} /> صورة
          </button>
          <button className={`type-chip ${mediaType === "video" ? "active" : ""}`} onClick={() => { setMediaType("video"); setMediaUrl(""); }}>
            <Video size={15} /> فيديو
          </button>
        </div>
        <MediaUploader
          value={mediaUrl}
          onChange={setMediaUrl}
          folder="stories"
          accept={mediaType === "video" ? "video/*" : "image/*"}
          height={220}
        />
        {error && <div className="field-error"><AlertCircle size={14} /> {error}</div>}
        <button className="btn-primary btn-gold" style={{ marginTop: 14 }} onClick={submit} disabled={posting}>
          {posting ? <Loader2 size={18} className="nx-spin" /> : "نشر القصة"}
        </button>
        <p className="uploader-hint" style={{ textAlign: "center" }}>تختفي القصة تلقائيًا بعد 24 ساعة</p>
      </div>
    </div>
  );
}

function StoryViewer({ authorId, stories, author, currentUser, onClose, notify }) {
  const [index, setIndex] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [paused, setPaused] = useState(false);
  const [progressKey, setProgressKey] = useState(0); // لإعادة تشغيل أنيميشن الشريط عند كل قصة
  const timerRef = useRef(null);
  const videoRef = useRef(null);
  const remainingRef = useRef(0);
  const startedAtRef = useRef(0);
  const isOwner = authorId === currentUser.id;
  const current = stories[index];

  const STORY_MAX_DURATION_MS = 60000; // حد أقصى دقيقة كاملة لأي قصة (صورة أو فيديو)
  const STORY_IMAGE_DURATION_MS = 6000; // مدة عرض الصورة الثابتة

  const goNext = useCallback(() => {
    if (index < stories.length - 1) setIndex((i) => i + 1);
    else onClose();
  }, [index, stories.length, onClose]);

  useEffect(() => {
    if (!current) { onClose(); return; }
    markStoryViewed(current.id, currentUser.id);
    setProgressKey((k) => k + 1);
    setPaused(false);
    clearTimeout(timerRef.current);

    const duration = current.mediaType === "video" ? STORY_MAX_DURATION_MS : STORY_IMAGE_DURATION_MS;
    remainingRef.current = duration;
    startedAtRef.current = Date.now();
    timerRef.current = setTimeout(goNext, duration);
    return () => clearTimeout(timerRef.current);
  }, [index, current, goNext]);

  if (!current) return null;

  const handleVideoEnded = () => {
    clearTimeout(timerRef.current);
    goNext();
  };

  const togglePause = () => {
    setPaused((p) => {
      const next = !p;
      if (next) {
        // إيقاف مؤقت: نحسب الوقت المتبقي ونوقف المؤقت
        clearTimeout(timerRef.current);
        const elapsed = Date.now() - startedAtRef.current;
        remainingRef.current = Math.max(0, remainingRef.current - elapsed);
        if (current.mediaType === "video" && videoRef.current) videoRef.current.pause();
      } else {
        // استئناف: نعيد تشغيل المؤقت بالوقت المتبقي فقط
        startedAtRef.current = Date.now();
        timerRef.current = setTimeout(goNext, remainingRef.current);
        if (current.mediaType === "video" && videoRef.current) videoRef.current.play();
      }
      return next;
    });
  };

  const handleDelete = async () => {
    await deleteStory(current.id, current.authorId, currentUser.id);
    notify("تم حذف القصة");
    if (stories.length === 1) onClose();
    else setIndex((i) => Math.max(0, i - 1));
    setConfirmDelete(false);
  };

  return (
    <div className="story-viewer-overlay" onClick={onClose}>
      <div className="story-viewer" onClick={(e) => e.stopPropagation()}>
        <div className="story-progress-row">
          {stories.map((s, i) => (
            <div key={s.id} className="story-progress-track">
              <div
                key={i === index ? progressKey : undefined}
                className={`story-progress-fill ${i < index ? "done" : i === index ? "active" : ""} ${i === index && paused ? "paused" : ""}`}
                style={i === index ? { animationDuration: `${current.mediaType === "video" ? STORY_MAX_DURATION_MS : STORY_IMAGE_DURATION_MS}ms` } : {}}
              />
            </div>
          ))}
        </div>
        <div className="story-viewer-head">
          <Avatar user={author} size={32} />
          <span className="story-viewer-name">{author?.fullName || "مستخدم"}</span>
          <span className="story-viewer-time">{timeAgo(current.createdAt)}</span>
          <div style={{ flex: 1 }} />
          <button className="icon-btn" style={{ color: "#fff" }} onClick={togglePause}>
            {paused ? <Play size={18} /> : <Pause size={18} />}
          </button>
          {isOwner && (
            <button className="icon-btn" style={{ color: "#fff" }} onClick={() => setConfirmDelete(true)}><Trash2 size={18} /></button>
          )}
          <button className="icon-btn" style={{ color: "#fff" }} onClick={onClose}><X size={22} /></button>
        </div>

        <div className="story-nav-zones">
          <div className="story-nav-zone" onClick={() => setIndex((i) => Math.max(0, i - 1))} />
          <div className="story-nav-zone" onClick={() => (index < stories.length - 1 ? setIndex((i) => i + 1) : onClose())} />
        </div>

        {current.mediaType === "video" ? (
          <video
            ref={videoRef}
            src={current.mediaUrl}
            className="story-media"
            autoPlay
            playsInline
            onEnded={handleVideoEnded}
          />
        ) : (
          <img src={current.mediaUrl} className="story-media" alt="" />
        )}

        {isOwner && (
          <div className="story-views-bar">
            <Eye size={14} /> {current.views?.length || 0} مشاهدة
          </div>
        )}
      </div>

      {confirmDelete && (
        <ConfirmModal
          title="حذف القصة؟"
          text="سيتم حذف هذه القصة نهائيًا."
          confirmLabel="حذف"
          danger
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}

function Avatar({ user, size = 40, square = false }) {
  const initials = (user?.fullName || user?.username || "؟").trim().slice(0, 1);
  if (user?.avatar) {
    return (
      <img
        src={user.avatar}
        alt={user.fullName || user.username}
        style={{ width: size, height: size, borderRadius: square ? 10 : "50%" }}
        className="avatar-img"
        onError={(e) => { e.target.style.display = "none"; }}
      />
    );
  }
  return (
    <div className="avatar-fallback" style={{ width: size, height: size, borderRadius: square ? 10 : "50%", fontSize: size * 0.4 }}>
      {initials}
    </div>
  );
}

/* شارة التوثيق الزرقاء — تصميم دائرة مملوءة بعلامة صح بيضاء، أنيق مثل المنصات الكبرى */
function VerifiedBadge({ size = 15, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" style={{ flexShrink: 0, ...style }}>
      <path
        fill="#1D9BF0"
        d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568-.54.354-.972.853-1.245 1.44-.607-.223-1.264-.27-1.897-.14-.634.131-1.218.437-1.687.882-.445.469-.749 1.053-.88 1.687-.131.633-.084 1.29.137 1.897-.586.274-1.084.706-1.438 1.246-.354.54-.551 1.17-.569 1.816.018.646.215 1.276.57 1.817.354.54.852.972 1.438 1.245-.224.607-.27 1.264-.139 1.898.131.634.435 1.218.88 1.687.469.444 1.053.749 1.687.880.633.131 1.29.083 1.897-.139.274.586.706 1.084 1.246 1.438.54.354 1.17.551 1.816.569.646-.018 1.276-.215 1.817-.57.54-.354.972-.852 1.245-1.438.607.224 1.264.27 1.898.14.634-.131 1.218-.436 1.687-.881.444-.469.748-1.053.88-1.687.131-.633.083-1.29-.14-1.897.586-.274 1.084-.706 1.438-1.246.354-.54.551-1.17.569-1.816zm-11.39 3.667-3.07-3.07 1.062-1.062 2.007 2.006 4.396-4.396 1.062 1.061-5.457 5.461z"
      />
    </svg>
  );
}

/* شارة الأدمن — تصميم متميز (تاج/درع ذهبي) لتمييزه عن التوثيق العادي */
function AdminBadge({ size = 15, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ flexShrink: 0, ...style }}>
      <defs>
        <linearGradient id="adminGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F0C36E" />
          <stop offset="100%" stopColor="#C77F2B" />
        </linearGradient>
      </defs>
      <path
        fill="url(#adminGrad)"
        d="M12 1l3 5 5.5-1-1.5 5.5L23 14l-4 3 1 6-6-2-2 3-2-3-6 2 1-6-4-3 4-3.5L4.5 5 10 6z"
      />
      <path d="M9 12.2l2 2 4-4.4" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* شارة ذكية: تعرض شارة الأدمن إن كان الحساب هو nexa_admin، أو شارة التوثيق العادية، أو لا شيء */
function UserBadge({ user, size = 14, style }) {
  if (!user) return null;
  if (user.username === ADMIN_USERNAME) return <AdminBadge size={size} style={style} />;
  if (user.isVerified) return <VerifiedBadge size={size} style={style} />;
  return null;
}

/* ============================================================
   رافع الصور/الفيديو من الجهاز (Supabase Storage)
   ============================================================ */
function MediaUploader({ value, onChange, folder = "general", accept = "image/*", label, shape = "rect", height = 140 }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const isVideo = accept.includes("video");

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    const maxMb = isVideo ? 50 : 8;
    if (file.size > maxMb * 1024 * 1024) {
      setError(`حجم الملف كبير جدًا (الحد الأقصى ${maxMb} ميجا)`);
      return;
    }
    setUploading(true);
    const url = await uploadMediaFile(file, folder);
    setUploading(false);
    if (url) {
      onChange(url);
    } else {
      setError("تعذّر رفع الملف، حاول مجددًا");
    }
  };

  return (
    <div className="media-uploader">
      {label && <label className="field-label">{label}</label>}
      <div
        className={`uploader-box ${shape === "circle" ? "circle" : ""}`}
        style={shape === "circle" ? { width: height, height: height } : { height }}
        onClick={() => !uploading && inputRef.current?.click()}
      >
        {value ? (
          isVideo ? (
            <video src={value} className="uploader-preview-media" muted />
          ) : (
            <img src={value} alt="" className="uploader-preview-media" />
          )
        ) : (
          <div className="uploader-empty">
            {uploading ? <Loader2 size={22} className="nx-spin" /> : <Upload size={22} />}
            <span>{uploading ? "جارٍ الرفع..." : isVideo ? "اضغط لرفع فيديو" : "اضغط لرفع صورة"}</span>
          </div>
        )}
        {value && !uploading && (
          <div className="uploader-overlay">
            <Camera size={18} />
            <span>تغيير</span>
          </div>
        )}
        {uploading && value && (
          <div className="uploader-overlay-loading"><Loader2 size={20} className="nx-spin" /></div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        style={{ display: "none" }}
        onChange={handleFile}
      />
      {value && !uploading && (
        <button type="button" className="uploader-remove-btn" onClick={() => onChange("")}>
          <Trash2 size={13} /> إزالة
        </button>
      )}
      {error && <div className="field-error"><AlertCircle size={14} /> {error}</div>}
    </div>
  );
}

function PostComposer({ currentUser, onClose, onCreated, prefill }) {
  const [type, setType] = useState(prefill?.type || "text"); // text | image | video | product
  const [text, setText] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [videoLink, setVideoLink] = useState("");
  const [price, setPrice] = useState("");
  const [productName, setProductName] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    const finalMedia = type === "video" ? (mediaUrl || videoLink.trim()) : mediaUrl;
    if (!text.trim() && !finalMedia) {
      setError("اكتب نصًا أو أضف صورة/فيديو");
      return;
    }
    if (type === "product" && !productName.trim()) {
      setError("اكتب اسم المنتج أو المهارة");
      return;
    }
    setPosting(true);
    const id = uid("post");
    const newPost = {
      id,
      authorId: currentUser.id,
      type,
      text: text.trim(),
      mediaUrl: finalMedia,
      productName: productName.trim(),
      price: price.trim(),
      likes: [],
      comments: [],
      createdAt: Date.now(),
    };
    await dbSet(KEYS.post(id), newPost, true);
    const idx = (await dbGet(KEYS.posts, true)) || [];
    idx.push(id);
    await dbSet(KEYS.posts, idx, true);
    setPosting(false);
    onCreated();
  };

  const typeOptions = [
    { key: "text", label: "منشور", icon: MessageCircle },
    { key: "image", label: "صورة", icon: ImageIcon },
    { key: "video", label: "فيديو", icon: Video },
    { key: "product", label: "إعلان منتج", icon: Megaphone },
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-handle" />
        <div className="modal-head">
          <h3>منشور جديد</h3>
          <button className="icon-btn" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="composer-type-row">
          {typeOptions.map((t) => {
            const Icon = t.icon;
            return (
              <button key={t.key} className={`type-chip ${type === t.key ? "active" : ""}`} onClick={() => setType(t.key)}>
                <Icon size={15} /> {t.label}
              </button>
            );
          })}
        </div>

        <textarea
          className="field-input composer-textarea"
          placeholder={type === "product" ? "اكتب وصف منتجك أو مهارتك..." : "بماذا تفكر؟"}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
        />

        {type === "product" && (
          <div className="composer-product-fields">
            <input className="field-input" placeholder="اسم المنتج / المهارة" value={productName} onChange={(e) => setProductName(e.target.value)} />
            <input className="field-input" placeholder="السعر (اختياري)" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
        )}

        {(type === "image" || type === "product") && (
          <div className="field-group" style={{ marginTop: 10 }}>
            <label className="field-label">صورة (اختياري)</label>
            <MediaUploader value={mediaUrl} onChange={setMediaUrl} folder="posts" accept="image/*" height={160} />
          </div>
        )}

        {type === "video" && (
          <div className="field-group" style={{ marginTop: 10 }}>
            <label className="field-label">رفع فيديو من جهازك</label>
            <MediaUploader value={mediaUrl} onChange={setMediaUrl} folder="posts" accept="video/*" height={160} />
            <p className="uploader-hint">أو الصق رابط فيديو يوتيوب بدلاً من الرفع:</p>
            <input
              className="field-input"
              placeholder="https://youtube.com/watch?v=..."
              value={videoLink}
              onChange={(e) => setVideoLink(e.target.value)}
              disabled={!!mediaUrl}
            />
          </div>
        )}

        {error && <div className="field-error"><AlertCircle size={14} /> {error}</div>}

        <button className="btn-primary" style={{ marginTop: 14 }} onClick={submit} disabled={posting}>
          {posting ? <Loader2 size={18} className="nx-spin" /> : <><Send size={16} /> نشر</>}
        </button>
      </div>
    </div>
  );
}

function PostCard({ post, author, currentUser, goTo, onChanged, notify }) {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const liked = post.likes?.includes(currentUser.id);
  const videoEmbed = post.type === "video" ? isVideoEmbed(post.mediaUrl) : null;
  const isOwnPost = post.authorId === currentUser.id;

  const toggleLike = async () => {
    const likes = new Set(post.likes || []);
    const wasLiked = likes.has(currentUser.id);
    if (wasLiked) likes.delete(currentUser.id);
    else likes.add(currentUser.id);
    const updated = { ...post, likes: [...likes] };
    await dbSet(KEYS.post(post.id), updated, true);
    if (!wasLiked) createNotification(post.authorId, "like", currentUser.id, { postId: post.id });
    onChanged();
  };

  const addComment = async () => {
    if (!commentText.trim()) return;
    const comments = [...(post.comments || []), {
      id: uid("c"), authorId: currentUser.id, text: commentText.trim(), createdAt: Date.now(),
    }];
    await dbSet(KEYS.post(post.id), { ...post, comments }, true);
    createNotification(post.authorId, "comment", currentUser.id, { postId: post.id });
    setCommentText("");
    onChanged();
  };

  const sharePost = async () => {
    try {
      await navigator.clipboard.writeText(`منشور على نِكسا من ${author?.fullName || "مستخدم"}: ${post.text || post.productName || ""}`);
      notify("تم نسخ نص المنشور للمشاركة");
    } catch {
      notify("تعذّر النسخ", "error");
    }
  };

  const handleDelete = async () => {
    const ok = await deletePost(post.id, post.authorId, currentUser.id);
    if (ok) {
      notify("تم حذف المنشور");
      onChanged();
    } else {
      notify("تعذّر حذف المنشور", "error");
    }
    setConfirmDelete(false);
  };

  const canPin = isOwnPost && currentUser.username === ADMIN_USERNAME;

  const togglePin = async () => {
    setMenuOpen(false);
    const updated = { ...post, pinned: !post.pinned };
    const result = await dbSet(KEYS.post(post.id), updated, true);
    if (result) {
      notify(updated.pinned ? "تم تثبيت المنشور" : "تم إلغاء التثبيت");
      onChanged();
    } else {
      notify("تعذّر تنفيذ الإجراء", "error");
    }
  };

  return (
    <div className={`post-card ${post.pinned ? "pinned" : ""}`}>
      {post.pinned && (
        <div className="pinned-banner"><Star size={12} fill="currentColor" /> منشور مثبّت</div>
      )}
      <div className="post-head">
        <div className="post-head-clickable" onClick={() => goTo("userProfile", author?.id)}>
          <Avatar user={author} size={42} />
          <div className="post-head-meta">
            <span className="post-author">
              {author?.fullName || "مستخدم نِكسا"}
              <UserBadge user={author} size={13} style={{ marginRight: 4 }} />
            </span>
            <span className="post-time">{timeAgo(post.createdAt)} · @{author?.username}</span>
          </div>
        </div>
        {post.type === "product" && <span className="badge-product"><Tag size={11} /> منتج</span>}
        {isOwnPost && (
          <div className="post-menu-wrap">
            <button className="icon-btn" onClick={() => setMenuOpen((m) => !m)}><MoreVertical size={17} /></button>
            {menuOpen && (
              <div className="post-menu">
                {canPin && (
                  <button onClick={togglePin}>
                    <Star size={14} /> {post.pinned ? "إلغاء التثبيت" : "تثبيت المنشور"}
                  </button>
                )}
                <button className="menu-danger" onClick={() => { setMenuOpen(false); setConfirmDelete(true); }}>
                  <Trash2 size={14} /> حذف المنشور
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {post.text && <p className="post-text">{post.text}</p>}

      {post.type === "product" && post.productName && (
        <div className="post-product-card" onClick={() => goTo("shopPage", author?.id)}>
          <ShoppingBag size={18} />
          <div>
            <div className="ppc-name">{post.productName}</div>
            {post.price && <div className="ppc-price">{post.price}</div>}
          </div>
          <ArrowRight size={16} />
        </div>
      )}

      {post.mediaUrl && post.type !== "video" && isImageUrl(post.mediaUrl) && (
        <img src={post.mediaUrl} alt="" className="post-media" onError={(e) => (e.target.style.display = "none")} />
      )}
      {post.mediaUrl && post.type !== "video" && !isImageUrl(post.mediaUrl) && (
        <a href={post.mediaUrl} target="_blank" rel="noopener noreferrer" className="post-link-fallback">
          <Link2 size={14} /> عرض الرابط المرفق
        </a>
      )}

      {videoEmbed && (
        <div className="post-video-wrap">
          {videoEmbed.includes("youtube") || videoEmbed.includes("dailymotion") ? (
            <iframe src={videoEmbed} title="فيديو" className="post-video-frame" allowFullScreen />
          ) : (
            <video src={videoEmbed} controls className="post-video-frame" />
          )}
        </div>
      )}
      {post.type === "video" && post.mediaUrl && !videoEmbed && (
        <a href={post.mediaUrl} target="_blank" rel="noopener noreferrer" className="post-link-fallback">
          <Video size={14} /> فتح الفيديو
        </a>
      )}

      <div className="post-actions">
        <button className={`post-action ${liked ? "liked" : ""}`} onClick={toggleLike}>
          <Heart size={17} fill={liked ? "currentColor" : "none"} /> {post.likes?.length || 0}
        </button>
        <button className="post-action" onClick={() => setShowComments((s) => !s)}>
          <MessageCircle size={17} /> {post.comments?.length || 0}
        </button>
        <button className="post-action" onClick={sharePost}>
          <Share2 size={17} /> مشاركة
        </button>
      </div>

      {showComments && (
        <div className="comments-box">
          {(post.comments || []).map((c) => (
            <div className="comment-row" key={c.id}>
              <Avatar user={author && author.id === c.authorId ? author : { fullName: "مستخدم" }} size={26} />
              <div className="comment-bubble"><b>{c.authorId === currentUser.id ? "أنت" : "مستخدم"}</b> {c.text}</div>
            </div>
          ))}
          <div className="comment-input-row">
            <input
              className="field-input"
              placeholder="أضف تعليقًا..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addComment()}
            />
            <button className="icon-btn-solid" onClick={addComment}><Send size={15} /></button>
          </div>
        </div>
      )}
      {confirmDelete && (
        <ConfirmModal
          title="حذف المنشور؟"
          text="سيتم حذف هذا المنشور نهائيًا ولا يمكن التراجع عن ذلك."
          confirmLabel="حذف"
          danger
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}

function ConfirmModal({ title, text, confirmLabel, onConfirm, onCancel, danger }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()} style={{ paddingBottom: 22 }}>
        <div className="modal-handle" />
        <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>{title}</h3>
        <p style={{ fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 1.7, marginBottom: 18 }}>{text}</p>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn-ghost" onClick={onCancel} style={{ flex: 1 }}>إلغاء</button>
          <button
            className="btn-primary"
            style={{ flex: 1, background: danger ? "var(--red)" : "var(--teal)" }}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
function ShopsDirectory({ currentUser, goTo, notify }) {
  const [shops, setShops] = useState(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("الكل");

  const load = useCallback(async () => {
    const userIds = (await dbGet(KEYS.userIndex, true)) || [];
    const allShops = await Promise.all(userIds.map((id) => dbGet(KEYS.shop(id), true)));
    const users = await Promise.all(userIds.map((id) => dbGet(KEYS.users(id), true)));
    const merged = allShops
      .map((s, i) => (s && s.published ? { ...s, owner: users[i] } : null))
      .filter(Boolean)
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    setShops(merged);
  }, []);

  useEffect(() => { load(); }, [load]);

  const categories = ["الكل", "منتجات رقمية", "تصميم", "برمجة وتقنية", "كتابة وترجمة", "تعليم", "حِرف ومهارات", "أخرى"];

  const filtered = (shops || []).filter((s) => {
    const matchesCat = category === "الكل" || s.category === category;
    const q = query.trim().toLowerCase();
    const matchesQ = !q || s.name?.toLowerCase().includes(q) || s.owner?.fullName?.toLowerCase().includes(q);
    return matchesCat && matchesQ;
  });

  return (
    <div className="page-pad">
      <PageHeader title="المتاجر" />
      <div className="shops-search-row">
        <Search size={17} className="search-icon" />
        <input
          className="field-input search-input"
          placeholder="ابحث عن متجر أو شخص..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="cat-scroll">
        {categories.map((c) => (
          <button key={c} className={`cat-chip ${category === c ? "active" : ""}`} onClick={() => setCategory(c)}>{c}</button>
        ))}
      </div>

      {shops === null && <div className="shop-grid">{[1,2,3,4].map(i => <div key={i} className="shop-card skel-block" style={{height: 150}} />)}</div>}

      {shops && filtered.length === 0 && (
        <EmptyState icon={Store} title="لا توجد متاجر مطابقة" hint="جرّب كلمة بحث أخرى أو افتح متجرك الخاص من صفحة حسابك" />
      )}

      <div className="shop-grid">
        {filtered.map((s) => (
          <div className="shop-card" key={s.ownerId} onClick={() => goTo("shopPage", s.ownerId)}>
            <div className="shop-card-cover" style={s.coverImage ? { backgroundImage: `url(${s.coverImage})` } : {}}>
              {!s.coverImage && <Store size={26} />}
            </div>
            <div className="shop-card-body">
              <div className="shop-card-title-row">
                <Avatar user={s.owner} size={30} />
                <span className="shop-card-name">{s.name}</span>
                <UserBadge user={s.owner} size={14} />
              </div>
              <span className="shop-card-cat">{s.category}</span>
              <div className="shop-card-stats">
                <span><ShoppingBag size={12} /> {s.products?.length || 0} منتج</span>
                {s.rating > 0 && <span><Star size={12} fill="currentColor" /> {s.rating.toFixed(1)}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   صفحة المتجر المميزة (صفحة كاملة لكل مستخدم)
   ============================================================ */
function ShopPage({ shopOwnerId, currentUser, goTo, notify }) {
  const [shop, setShop] = useState(null);
  const [owner, setOwner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [productModal, setProductModal] = useState(null); // null | {} | product
  const [shopTab, setShopTab] = useState("products"); // posts | about | products
  const [shopPosts, setShopPosts] = useState(null);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const isOwner = currentUser.id === shopOwnerId;

  const load = useCallback(async () => {
    setLoading(true);
    const [s, u] = await Promise.all([dbGet(KEYS.shop(shopOwnerId), true), dbGet(KEYS.users(shopOwnerId), true)]);
    setShop(s);
    setOwner(u);
    setLoading(false);
  }, [shopOwnerId]);

  const loadShopPosts = useCallback(async () => {
    const ids = (await dbGet(KEYS.posts, true)) || [];
    const all = await Promise.all(ids.map((id) => dbGet(KEYS.post(id), true)));
    const ownPosts = all.filter((p) => p && p.authorId === shopOwnerId);
    ownPosts.sort((a, b) => (b.pinned - a.pinned) || (b.createdAt - a.createdAt));
    setShopPosts(ownPosts);
  }, [shopOwnerId]);

  useEffect(() => { load(); loadShopPosts(); }, [load, loadShopPosts]);
  useEffect(() => { recordShopVisit(shopOwnerId, currentUser.id); }, [shopOwnerId, currentUser.id]);

  const handleProductClick = async (p) => {
    if (isOwner) {
      setProductModal(p);
      return;
    }
    // تسجيل مشاهدة للمنتج (لإحصائيات "الأكثر مشاهدة")
    const updatedProducts = (shop.products || []).map((prod) =>
      prod.id === p.id ? { ...prod, views: (prod.views || 0) + 1 } : prod
    );
    const updatedShop = { ...shop, products: updatedProducts };
    setShop(updatedShop); // تحديث فوري في الواجهة
    dbSet(KEYS.shop(shopOwnerId), updatedShop, true); // حفظ في الخلفية بدون انتظار
    setProductModal({ ...p, viewOnly: true });
  };

  if (loading) {
    return <div className="page-pad"><PageHeader title="المتجر" onBack={() => goTo("shops")} /><div className="skel-block" style={{ height: 200 }} /></div>;
  }

  if (!shop || !shop.published) {
    if (isOwner) {
      return (
        <div className="page-pad">
          <PageHeader title="متجرك" onBack={() => goTo("profile")} />
          <EmptyState
            icon={Store}
            title="لم تنشئ متجرك بعد"
            hint="افتح متجرك الآن واعرض منتجاتك الرقمية أو مهاراتك للجميع"
            action={<button className="btn-primary btn-gold" style={{ marginTop: 14, width: "auto", padding: "12px 24px" }} onClick={() => setEditOpen(true)}><Plus size={16} /> إنشاء المتجر</button>}
          />
          {editOpen && <ShopEditModal shop={shop} ownerId={shopOwnerId} onClose={() => setEditOpen(false)} onSaved={() => { setEditOpen(false); load(); notify("تم إنشاء متجرك بنجاح 🎉"); }} />}
        </div>
      );
    }
    return (
      <div className="page-pad">
        <PageHeader title="المتجر" onBack={() => goTo("shops")} />
        <EmptyState icon={Store} title="لا يوجد متجر هنا" hint="هذا المستخدم لم يفتح متجره بعد" />
      </div>
    );
  }

  return (
    <div className="shop-page">
      <div className="shop-hero" style={shop.coverImage ? { backgroundImage: `linear-gradient(180deg, rgba(16,59,54,0.15), rgba(16,59,54,0.75)), url(${shop.coverImage})` } : {}}>
        <button className="back-btn floating" onClick={() => goTo("shops")}><ChevronRight size={20} /></button>
        {isOwner && (
          <div className="shop-owner-actions">
            {(owner?.isVerified || owner?.username === ADMIN_USERNAME) && (
              <>
                <button className="analytics-btn" onClick={() => setAnalyticsOpen(true)}><Eye size={15} /> تحليلات</button>
                <button
                  className="analytics-btn"
                  onClick={async () => {
                    try {
                      const shortUrl = `${window.location.origin}${window.location.pathname}?s=${owner.username}`;
                      await navigator.clipboard.writeText(shortUrl);
                      notify("تم نسخ رابط متجرك المختصر");
                    } catch {
                      notify("تعذّر نسخ الرابط", "error");
                    }
                  }}
                >
                  <Link2 size={15} /> رابط المتجر
                </button>
              </>
            )}
            <button className="edit-shop-btn" onClick={() => setEditOpen(true)}><Edit3 size={15} /> تعديل المتجر</button>
          </div>
        )}
        <div className="shop-hero-content">
          <div className="shop-logo-wrap">
            <Avatar user={{ avatar: shop.logo || owner?.avatar, fullName: shop.name }} size={72} square />
          </div>
          <div className="shop-hero-text">
            <div className="shop-hero-name-row">
              <h1>{shop.name}</h1>
              {(shop.verified || owner?.isVerified || owner?.username === ADMIN_USERNAME) && (
                <span className={`verified-pill ${owner?.username === ADMIN_USERNAME ? "admin-pill" : ""}`}>
                  <UserBadge user={owner} size={13} style={{ color: "#fff" }} /> {owner?.username === ADMIN_USERNAME ? "حساب نِكسا" : "موثّق"}
                </span>
              )}
            </div>
            <p className="shop-hero-cat">{shop.category} · بواسطة {owner?.fullName}</p>
            {shop.location && <p className="shop-hero-location"><MapPin size={12} /> {shop.location}</p>}
          </div>
        </div>
      </div>

      <div className="shop-stats-bar">
        <div><b>{shop.products?.length || 0}</b><span>منتج/خدمة</span></div>
        <div><b>{shop.rating ? shop.rating.toFixed(1) : "—"}</b><span>تقييم</span></div>
        <div><b>{shop.salesCount || 0}</b><span>عملية</span></div>
      </div>

      <div className="shop-tabs-bar">
        <button className={`shop-tab ${shopTab === "posts" ? "active" : ""}`} onClick={() => setShopTab("posts")}>المنشورات</button>
        <button className={`shop-tab ${shopTab === "about" ? "active" : ""}`} onClick={() => setShopTab("about")}>المتجر</button>
        <button className={`shop-tab ${shopTab === "products" ? "active" : ""}`} onClick={() => setShopTab("products")}>المنتجات</button>
      </div>

      {shopTab === "about" && (
        <>
          {shop.description && <p className="shop-description">{shop.description}</p>}
          {shop.paymentInfo && (
            <div className="shop-payment-card">
              <DollarSign size={16} />
              <div>
                <div className="spc-title">طريقة الدفع / التواصل للشراء</div>
                <div className="spc-value">{shop.paymentInfo}</div>
              </div>
            </div>
          )}
          {!shop.description && !shop.paymentInfo && (
            <EmptyState icon={Store} title="لا توجد معلومات إضافية بعد" />
          )}
        </>
      )}

      {shopTab === "posts" && (
        <div style={{ padding: "0 16px" }}>
          {shopPosts === null && <div className="skel-block" style={{ height: 120 }} />}
          {shopPosts && shopPosts.length === 0 && <EmptyState icon={MessageCircle} title="لا توجد منشورات من هذا المتجر بعد" />}
          {shopPosts && shopPosts.map((p) => (
            <PostCard key={p.id} post={p} author={owner} currentUser={currentUser} goTo={goTo} onChanged={loadShopPosts} notify={notify} />
          ))}
        </div>
      )}

      {shopTab === "products" && (
        <>
          <div className="shop-section-head">
            <h3>المنتجات والخدمات</h3>
            {isOwner && (
              <button className="add-product-btn" onClick={() => setProductModal({})}>
                <Plus size={15} /> إضافة منتج
              </button>
            )}
          </div>

          {(!shop.products || shop.products.length === 0) ? (
            <EmptyState icon={ShoppingBag} title="لا توجد منتجات بعد" hint={isOwner ? "أضف أول منتج أو خدمة لمتجرك" : "هذا المتجر لم يضف منتجات بعد"} />
          ) : (
            <div className="products-grid">
              {shop.products.map((p) => (
                <div className="product-card" key={p.id} onClick={() => handleProductClick(p)}>
                  <div className="product-img" style={p.image ? { backgroundImage: `url(${p.image})` } : {}}>
                    {!p.image && <ImageIcon size={22} />}
                  </div>
                  <div className="product-info">
                    <span className="product-name">{p.name}</span>
                    {p.price && <span className="product-price">{p.price}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {editOpen && <ShopEditModal shop={shop} ownerId={shopOwnerId} onClose={() => setEditOpen(false)} onSaved={() => { setEditOpen(false); load(); notify("تم تحديث متجرك"); }} />}
      {productModal !== null && (
        <ProductModal
          product={productModal}
          isOwner={isOwner}
          onClose={() => setProductModal(null)}
          onSave={async (prod) => {
            const products = shop.products ? [...shop.products] : [];
            const i = products.findIndex((x) => x.id === prod.id);
            if (i >= 0) products[i] = prod; else products.push(prod);
            const updated = { ...shop, products, updatedAt: Date.now() };
            await dbSet(KEYS.shop(shopOwnerId), updated, true);
            setProductModal(null);
            load();
            notify("تم حفظ المنتج");
          }}
          onDelete={async (prodId) => {
            const products = (shop.products || []).filter((x) => x.id !== prodId);
            const updated = { ...shop, products, updatedAt: Date.now() };
            await dbSet(KEYS.shop(shopOwnerId), updated, true);
            setProductModal(null);
            load();
            notify("تم حذف المنتج");
          }}
        />
      )}
      {analyticsOpen && (
        <ShopAnalyticsModal shopOwnerId={shopOwnerId} shop={shop} onClose={() => setAnalyticsOpen(false)} />
      )}
    </div>
  );
}

function ProductModal({ product, isOwner, onClose, onSave, onDelete }) {
  const isNew = !product.id;
  const viewOnly = product.viewOnly;
  const [step, setStep] = useState(1); // 1=المنتج 2=التفاصيل 3=الشحن 4=نشر
  const [name, setName] = useState(product.name || "");
  const [image, setImage] = useState(product.image || "");
  const [price, setPrice] = useState(product.price || "");
  const [desc, setDesc] = useState(product.description || "");
  const [category, setCategory] = useState(product.category || "");
  const [shippingInfo, setShippingInfo] = useState(product.shippingInfo || "");
  const [error, setError] = useState("");

  const totalSteps = 4;
  const stepLabels = ["المنتج", "التفاصيل", "الشحن", "نشر"];

  const goNext = () => {
    setError("");
    if (step === 1 && !name.trim()) { setError("اكتب اسم المنتج أولًا"); return; }
    setStep((s) => Math.min(totalSteps, s + 1));
  };
  const goBack = () => setStep((s) => Math.max(1, s - 1));

  const save = () => {
    if (!name.trim()) { setError("اكتب اسم المنتج"); return; }
    onSave({
      id: product.id || uid("prod"),
      name: name.trim(),
      price: price.trim(),
      description: desc.trim(),
      image: image.trim(),
      category: category.trim(),
      shippingInfo: shippingInfo.trim(),
      createdAt: product.createdAt || Date.now(),
    });
  };

  if (viewOnly) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
          <div className="modal-handle" />
          <div className="modal-head">
            <h3>تفاصيل المنتج</h3>
            <button className="icon-btn" onClick={onClose}><X size={20} /></button>
          </div>
          {image && <img src={image} alt="" className="composer-preview" style={{ marginBottom: 10 }} />}
          <h4 style={{ margin: "4px 0" }}>{name}</h4>
          {price && <div className="product-price" style={{ fontSize: 15, marginBottom: 8 }}>{price}</div>}
          <p style={{ color: "var(--ink-soft)", lineHeight: 1.7, fontSize: 14 }}>{desc || "لا يوجد وصف."}</p>
          {shippingInfo && (
            <div className="shop-payment-card" style={{ marginTop: 12, marginInline: 0 }}>
              <ShoppingBag size={16} />
              <div>
                <div className="spc-title">معلومات الشحن</div>
                <div className="spc-value">{shippingInfo}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet tall" onClick={(e) => e.stopPropagation()}>
        <div className="modal-handle" />
        <div className="modal-head">
          <h3>{isNew ? "منتج جديد" : "تعديل المنتج"}</h3>
          <button className="icon-btn" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="step-indicator-row">
          {stepLabels.map((label, i) => {
            const num = i + 1;
            const isDone = num < step;
            const isActive = num === step;
            return (
              <React.Fragment key={num}>
                <div className="step-dot-wrap">
                  <div className={`step-dot ${isActive ? "active" : ""} ${isDone ? "done" : ""}`}>
                    {isDone ? <CheckCircle2 size={14} /> : num}
                  </div>
                  <span className="step-dot-label">{label}</span>
                </div>
                {num < totalSteps && <div className={`step-connector ${isDone ? "done" : ""}`} />}
              </React.Fragment>
            );
          })}
        </div>

        {step === 1 && (
          <div className="wizard-step">
            <div className="field-group">
              <label className="field-label">صور المنتج</label>
              <MediaUploader value={image} onChange={setImage} folder="products" height={170} />
            </div>
            <div className="field-group">
              <label className="field-label">اسم المنتج أو الخدمة</label>
              <input className="field-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: تصميم شعار احترافي" />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="wizard-step">
            <div className="field-group">
              <label className="field-label">السعر (اختياري)</label>
              <input className="field-input" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="مثال: 15$ أو يُحدد بعد التواصل" />
            </div>
            <div className="field-group">
              <label className="field-label">التصنيف (اختياري)</label>
              <input className="field-input" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="مثال: تصميم، إلكترونيات، أزياء" />
            </div>
            <div className="field-group">
              <label className="field-label">الوصف</label>
              <textarea className="field-input" rows={4} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="اشرح منتجك أو خدمتك بإيجاز" />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="wizard-step">
            <div className="field-group">
              <label className="field-label">معلومات الشحن أو التوصيل (اختياري)</label>
              <textarea
                className="field-input" rows={4} value={shippingInfo} onChange={(e) => setShippingInfo(e.target.value)}
                placeholder="مثال: توصيل داخل المدينة خلال يومين، أو منتج رقمي يُرسل فورًا عبر البريد"
              />
            </div>
            <p className="uploader-hint">إذا كان منتجك رقميًا أو خدمة، يمكنك ترك هذا الحقل فاضيًا أو كتابة طريقة التسليم.</p>
          </div>
        )}

        {step === 4 && (
          <div className="wizard-step wizard-review">
            <div className="review-card">
              {image && <img src={image} alt="" className="review-image" />}
              <div className="review-body">
                <h4>{name || "بدون اسم"}</h4>
                {price && <div className="product-price">{price}</div>}
                {category && <span className="job-tag" style={{ marginTop: 6 }}>{category}</span>}
                {desc && <p className="review-desc">{desc}</p>}
                {shippingInfo && <p className="review-desc"><b>الشحن:</b> {shippingInfo}</p>}
              </div>
            </div>
            <p className="uploader-hint" style={{ textAlign: "center" }}>راجع منتجك جيدًا قبل النشر</p>
          </div>
        )}

        {error && <div className="field-error"><AlertCircle size={14} /> {error}</div>}

        <div className="wizard-actions">
          {step > 1 && (
            <button className="btn-ghost" onClick={goBack} style={{ flex: 1 }}>
              <ChevronRight size={15} /> رجوع
            </button>
          )}
          {step < totalSteps ? (
            <button className="btn-primary" onClick={goNext} style={{ flex: 1 }}>
              التالي <ChevronLeft size={15} />
            </button>
          ) : (
            <button className="btn-primary btn-gold" onClick={save} style={{ flex: 1 }}>
              <CheckCircle2 size={15} /> نشر المنتج
            </button>
          )}
        </div>

        {!isNew && step === 1 && (
          <button className="btn-ghost danger-ghost" style={{ marginTop: 10 }} onClick={() => onDelete(product.id)}>
            <Trash2 size={15} /> حذف المنتج
          </button>
        )}
      </div>
    </div>
  );
}

function ShopEditModal({ shop, ownerId, onClose, onSaved }) {
  const [name, setName] = useState(shop?.name || "");
  const [category, setCategory] = useState(shop?.category || "منتجات رقمية");
  const [description, setDescription] = useState(shop?.description || "");
  const [location, setLocation] = useState(shop?.location || "");
  const [coverImage, setCoverImage] = useState(shop?.coverImage || "");
  const [logo, setLogo] = useState(shop?.logo || "");
  const [paymentInfo, setPaymentInfo] = useState(shop?.paymentInfo || "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const categories = ["منتجات رقمية", "تصميم", "برمجة وتقنية", "كتابة وترجمة", "تعليم", "حِرف ومهارات", "أخرى"];

  const save = async () => {
    if (!name.trim()) { setError("اكتب اسم المتجر"); return; }
    setSaving(true);
    const updated = {
      ownerId,
      name: name.trim(),
      category,
      description: description.trim(),
      location: location.trim(),
      coverImage: coverImage.trim(),
      logo: logo.trim(),
      paymentInfo: paymentInfo.trim(),
      products: shop?.products || [],
      published: true,
      verified: shop?.verified || false,
      rating: shop?.rating || 0,
      salesCount: shop?.salesCount || 0,
      createdAt: shop?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };
    await dbSet(KEYS.shop(ownerId), updated, true);
    const u = await dbGet(KEYS.users(ownerId), true);
    if (u && !u.hasShop) await dbSet(KEYS.users(ownerId), { ...u, hasShop: true }, true);
    setSaving(false);
    onSaved();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet tall" onClick={(e) => e.stopPropagation()}>
        <div className="modal-handle" />
        <div className="modal-head">
          <h3>{shop?.published ? "تعديل متجرك" : "إنشاء متجرك"}</h3>
          <button className="icon-btn" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="field-group">
          <label className="field-label">اسم المتجر</label>
          <input className="field-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: استوديو لمسة للتصميم" />
        </div>

        <div className="field-group">
          <label className="field-label">التصنيف</label>
          <div className="cat-scroll" style={{ margin: "4px 0 0" }}>
            {categories.map((c) => (
              <button key={c} type="button" className={`cat-chip ${category === c ? "active" : ""}`} onClick={() => setCategory(c)}>{c}</button>
            ))}
          </div>
        </div>

        <div className="field-group">
          <label className="field-label">وصف المتجر</label>
          <textarea className="field-input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="عرّف بمتجرك وما تقدمه..." />
        </div>

        <div className="field-group">
          <label className="field-label">الموقع (اختياري)</label>
          <input className="field-input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="مثال: عمّان، الأردن" />
        </div>

        <div className="field-group">
          <label className="field-label">صورة غلاف المتجر</label>
          <MediaUploader value={coverImage} onChange={setCoverImage} folder="shop-covers" height={130} />
        </div>

        <div className="field-group" style={{ textAlign: "center" }}>
          <label className="field-label" style={{ textAlign: "center", display: "block" }}>شعار المتجر</label>
          <MediaUploader value={logo} onChange={setLogo} folder="shop-logos" shape="circle" height={84} />
        </div>

        <div className="field-group">
          <label className="field-label">طريقة الدفع / التواصل للشراء</label>
          <textarea className="field-input" rows={2} value={paymentInfo} onChange={(e) => setPaymentInfo(e.target.value)} placeholder="مثال: تواصل عبر واتساب 07xxxxxxx، أو رابط PayPal.me الخاص بك" />
        </div>

        {error && <div className="field-error"><AlertCircle size={14} /> {error}</div>}
        <button className="btn-primary btn-gold" style={{ marginTop: 10 }} onClick={save} disabled={saving}>
          {saving ? <Loader2 size={18} className="nx-spin" /> : "حفظ المتجر"}
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   قسم الوظائف والخدمات
   ============================================================ */
function JobsView({ currentUser, goTo, notify }) {
  const [jobs, setJobs] = useState(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [filter, setFilter] = useState("الكل");
  const [usersCache, setUsersCache] = useState({});

  const load = useCallback(async () => {
    const ids = (await dbGet(KEYS.jobs, true)) || [];
    const loaded = await Promise.all(ids.map((id) => dbGet(KEYS.job(id), true)));
    const valid = loaded.filter(Boolean).sort((a, b) => b.createdAt - a.createdAt);
    setJobs(valid);
    const authorIds = [...new Set(valid.map((j) => j.authorId))];
    const fetched = await Promise.all(authorIds.map((id) => dbGet(KEYS.users(id), true)));
    const map = {};
    authorIds.forEach((id, i) => { if (fetched[i]) map[id] = fetched[i]; });
    setUsersCache(map);
  }, []);

  useEffect(() => { load(); }, [load]);

  const types = ["الكل", "وظيفة", "خدمة مطلوبة", "عمل حر"];
  const filtered = (jobs || []).filter((j) => filter === "الكل" || j.jobType === filter);

  return (
    <div className="page-pad">
      <PageHeader
        title="الوظائف والخدمات"
        action={
          <button className="header-add-btn" onClick={() => setComposerOpen(true)}>
            <Plus size={16} /> طلب جديد
          </button>
        }
      />

      <div className="cat-scroll">
        {types.map((t) => (
          <button key={t} className={`cat-chip ${filter === t ? "active" : ""}`} onClick={() => setFilter(t)}>{t}</button>
        ))}
      </div>

      {jobs === null && <div>{[1,2,3].map(i => <div key={i} className="job-card skel-block" style={{height: 90, marginBottom: 12}} />)}</div>}

      {jobs && filtered.length === 0 && (
        <EmptyState icon={Briefcase} title="لا توجد طلبات حاليًا" hint="كن أول من ينشر طلب وظيفة أو خدمة" />
      )}

      {filtered.map((j) => (
        <div className="job-card" key={j.id} onClick={() => goTo("jobDetail", j.id)}>
          <div className="job-card-top">
            <span className={`job-type-pill jt-${j.jobType === "وظيفة" ? "job" : j.jobType === "خدمة مطلوبة" ? "svc" : "free"}`}>{j.jobType}</span>
            <span className="job-time">{timeAgo(j.createdAt)}</span>
          </div>
          <h4 className="job-title">{j.title}</h4>
          <p className="job-desc-preview">{j.description}</p>
          <div className="job-card-bottom">
            <span className="job-author"><Avatar user={usersCache[j.authorId]} size={20} /> {usersCache[j.authorId]?.fullName || "مستخدم"}</span>
            {j.budget && <span className="job-budget"><DollarSign size={12} /> {j.budget}</span>}
          </div>
        </div>
      ))}

      {composerOpen && (
        <JobComposer
          currentUser={currentUser}
          onClose={() => setComposerOpen(false)}
          onCreated={() => { setComposerOpen(false); load(); notify("تم نشر طلبك بنجاح"); }}
        />
      )}
    </div>
  );
}

function JobComposer({ currentUser, onClose, onCreated }) {
  const [jobType, setJobType] = useState("وظيفة");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [location, setLocation] = useState("");
  const [error, setError] = useState("");
  const [posting, setPosting] = useState(false);

  const submit = async () => {
    if (!title.trim() || !description.trim()) { setError("اكتب العنوان والوصف على الأقل"); return; }
    setPosting(true);
    const id = uid("job");
    const job = {
      id, authorId: currentUser.id, jobType, title: title.trim(), description: description.trim(),
      budget: budget.trim(), location: location.trim(), createdAt: Date.now(), applicants: [],
    };
    await dbSet(KEYS.job(id), job, true);
    const idx = (await dbGet(KEYS.jobs, true)) || [];
    idx.push(id);
    await dbSet(KEYS.jobs, idx, true);
    setPosting(false);
    onCreated();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet tall" onClick={(e) => e.stopPropagation()}>
        <div className="modal-handle" />
        <div className="modal-head">
          <h3>طلب جديد</h3>
          <button className="icon-btn" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="composer-type-row">
          {["وظيفة", "خدمة مطلوبة", "عمل حر"].map((t) => (
            <button key={t} className={`type-chip ${jobType === t ? "active" : ""}`} onClick={() => setJobType(t)}>{t}</button>
          ))}
        </div>

        <div className="field-group">
          <label className="field-label">العنوان</label>
          <input className="field-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: مطلوب مصمم واجهات لمشروع تطبيق" />
        </div>
        <div className="field-group">
          <label className="field-label">التفاصيل</label>
          <textarea className="field-input" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="اشرح المطلوب بالتفصيل..." />
        </div>
        <div className="composer-product-fields">
          <input className="field-input" placeholder="الميزانية (اختياري)" value={budget} onChange={(e) => setBudget(e.target.value)} />
          <input className="field-input" placeholder="الموقع (اختياري)" value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>

        {error && <div className="field-error"><AlertCircle size={14} /> {error}</div>}
        <button className="btn-primary" style={{ marginTop: 14 }} onClick={submit} disabled={posting}>
          {posting ? <Loader2 size={18} className="nx-spin" /> : "نشر الطلب"}
        </button>
      </div>
    </div>
  );
}

function JobDetailView({ jobId, currentUser, goTo, notify }) {
  const [job, setJob] = useState(null);
  const [author, setAuthor] = useState(null);
  const [applicants, setApplicants] = useState([]);
  const [message, setMessage] = useState("");
  const [applied, setApplied] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const j = await dbGet(KEYS.job(jobId), true);
    setJob(j);
    if (j) {
      const a = await dbGet(KEYS.users(j.authorId), true);
      setAuthor(a);
      const apps = (await dbGet(KEYS.jobApps(jobId), true)) || [];
      const appUsers = await Promise.all(apps.map(async (app) => ({ ...app, user: await dbGet(KEYS.users(app.userId), true) })));
      setApplicants(appUsers);
      setApplied(apps.some((app) => app.userId === currentUser.id));
    }
    setLoading(false);
  }, [jobId, currentUser.id]);

  useEffect(() => { load(); }, [load]);

  const apply = async () => {
    if (!message.trim()) { notify("اكتب رسالة قصيرة للتقديم", "error"); return; }
    const apps = (await dbGet(KEYS.jobApps(jobId), true)) || [];
    apps.push({ userId: currentUser.id, message: message.trim(), createdAt: Date.now() });
    await dbSet(KEYS.jobApps(jobId), apps, true);
    setMessage("");
    notify("تم إرسال طلبك بنجاح");
    load();
  };

  if (loading) return <div className="page-pad"><PageHeader title="تفاصيل الطلب" onBack={() => goTo("jobs")} /><div className="skel-block" style={{ height: 200 }} /></div>;
  if (!job) return <div className="page-pad"><PageHeader title="تفاصيل الطلب" onBack={() => goTo("jobs")} /><EmptyState icon={Briefcase} title="هذا الطلب غير موجود" /></div>;

  const isOwner = job.authorId === currentUser.id;

  return (
    <div className="page-pad">
      <PageHeader title="تفاصيل الطلب" onBack={() => goTo("jobs")} />
      <div className="job-detail-card">
        <span className={`job-type-pill jt-${job.jobType === "وظيفة" ? "job" : job.jobType === "خدمة مطلوبة" ? "svc" : "free"}`}>{job.jobType}</span>
        <h2 className="job-detail-title">{job.title}</h2>
        <div className="job-detail-meta" onClick={() => goTo("userProfile", author?.id)}>
          <Avatar user={author} size={32} />
          <div>
            <div className="job-author-name">{author?.fullName}</div>
            <div className="job-time">{timeAgo(job.createdAt)}</div>
          </div>
        </div>
        <p className="job-detail-desc">{job.description}</p>
        <div className="job-detail-tags">
          {job.budget && <span className="job-tag"><DollarSign size={12} /> {job.budget}</span>}
          {job.location && <span className="job-tag"><MapPin size={12} /> {job.location}</span>}
        </div>
      </div>

      {isOwner ? (
        <div>
          <h3 className="section-title">المتقدمون ({applicants.length})</h3>
          {applicants.length === 0 && <EmptyState icon={User} title="لا يوجد متقدمون بعد" />}
          {applicants.map((app, i) => (
            <div className="applicant-card" key={i} onClick={() => goTo("userProfile", app.userId)}>
              <Avatar user={app.user} size={36} />
              <div className="applicant-body">
                <div className="applicant-name">{app.user?.fullName}</div>
                <div className="applicant-msg">{app.message}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="apply-box">
          {applied ? (
            <div className="applied-confirm"><CheckCircle2 size={18} /> تم إرسال طلبك مسبقًا لهذا المنشور</div>
          ) : (
            <>
              <label className="field-label">رسالة التقديم</label>
              <textarea className="field-input" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="عرّف عن نفسك ولماذا أنت مناسب لهذا الطلب..." />
              <button className="btn-primary btn-gold" style={{ marginTop: 10 }} onClick={apply}>
                <Send size={15} /> تقديم على الطلب
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   الملف الشخصي
   ============================================================ */
function ProfileView({ currentUser, setCurrentUser, goTo, notify, viewUserId }) {
  const targetId = viewUserId || currentUser.id;
  const isSelf = targetId === currentUser.id;
  const isAdmin = currentUser.username === ADMIN_USERNAME;
  const [user, setUser] = useState(isSelf ? currentUser : null);
  const [shop, setShop] = useState(null);
  const [myPosts, setMyPosts] = useState([]);
  const [editOpen, setEditOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [counts, setCounts] = useState({ followers: 0, following: 0 });
  const [followBusy, setFollowBusy] = useState(false);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [followListType, setFollowListType] = useState(null); // null | "followers" | "following"
  const [profileTab, setProfileTab] = useState("posts"); // posts | products

  const load = useCallback(async () => {
    setLoading(true);
    const u = await dbGet(KEYS.users(targetId), true);
    setUser(u);
    const s = await dbGet(KEYS.shop(targetId), true);
    setShop(s);
    const ids = (await dbGet(KEYS.posts, true)) || [];
    const all = await Promise.all(ids.map((id) => dbGet(KEYS.post(id), true)));
    const ownPosts = all.filter((p) => p && p.authorId === targetId);
    ownPosts.sort((a, b) => (b.pinned - a.pinned) || (b.createdAt - a.createdAt));
    setMyPosts(ownPosts);
    const c = await getFollowCounts(targetId);
    setCounts(c);
    if (!isSelf) {
      const f = await isFollowing(currentUser.id, targetId);
      setFollowing(f);
    }
    setLoading(false);
  }, [targetId, isSelf, currentUser.id]);

  useEffect(() => { load(); }, [load]);

  const toggleFollow = async () => {
    setFollowBusy(true);
    if (following) {
      const ok = await unfollowUser(currentUser.id, targetId);
      if (ok) { setFollowing(false); setCounts((c) => ({ ...c, followers: Math.max(0, c.followers - 1) })); }
    } else {
      const ok = await followUser(currentUser.id, targetId);
      if (ok) {
        setFollowing(true);
        setCounts((c) => ({ ...c, followers: c.followers + 1 }));
        notify(`أصبحت تتابع ${user.fullName}`);
        createNotification(targetId, "follow", currentUser.id);
      }
    }
    setFollowBusy(false);
  };

  const toggleVerify = async () => {
    setVerifyBusy(true);
    const ok = await setUserVerified(targetId, !user.isVerified, currentUser.username);
    if (ok) {
      setUser((u) => ({ ...u, isVerified: !u.isVerified }));
      notify(!user.isVerified ? "تم توثيق هذا الحساب ✓" : "تم إلغاء التوثيق");
      if (!user.isVerified) createNotification(targetId, "verify", currentUser.id);
    } else {
      notify("تعذّر تنفيذ الإجراء", "error");
    }
    setVerifyBusy(false);
  };

  if (loading || !user) {
    return <div className="page-pad"><PageHeader title="الملف الشخصي" onBack={!isSelf ? () => goTo("feed") : undefined} /><div className="skel-block" style={{ height: 200 }} /></div>;
  }

  return (
    <div className="profile-page">
      <div className="profile-cover" style={user.cover ? { backgroundImage: `url(${user.cover})` } : {}}>
        {!isSelf && <button className="back-btn floating" onClick={() => goTo("feed")}><ChevronRight size={20} /></button>}
        {isSelf && (
          <button className="edit-shop-btn" onClick={() => setEditOpen(true)}><Edit3 size={15} /> تعديل الملف</button>
        )}
      </div>

      <div className="profile-card">
        <div className="profile-avatar-wrap">
          <Avatar user={user} size={88} />
        </div>

        <div className="profile-identity">
          <h2>
            {user.fullName}
            <UserBadge user={user} size={17} style={{ marginRight: 5, verticalAlign: -2 }} />
          </h2>
          <span className="profile-username">@{user.username}</span>
          {user.location && <span className="profile-location"><MapPin size={13} /> {user.location}</span>}
        </div>

        {user.bio && <p className="profile-bio">{user.bio}</p>}

        <div className="follow-counts-row">
          <button className="fc-clickable" onClick={() => setFollowListType("followers")}>
            <b>{counts.followers}</b> متابِع
          </button>
          <span className="fc-dot">·</span>
          <button className="fc-clickable" onClick={() => setFollowListType("following")}>
            <b>{counts.following}</b> يتابع
          </button>
        </div>

        {user.socialLinks && user.socialLinks.length > 0 && (
          <div className="profile-social-row">
            {user.socialLinks.map((link, i) => {
              const platform = SOCIAL_PLATFORMS.find((p) => p.key === link.platform) || SOCIAL_PLATFORMS[6];
              const Icon = platform.icon;
              const href = /^https?:\/\//.test(link.url) ? link.url : `https://${link.url}`;
              return (
                <a key={i} href={href} target="_blank" rel="noopener noreferrer" className="profile-social-pill" title={platform.label}>
                  <Icon size={16} />
                </a>
              );
            })}
          </div>
        )}

        <div className="profile-actions-row">
          {!isSelf && (
            <button
              className={`follow-btn ${following ? "is-following" : ""}`}
              onClick={toggleFollow}
              disabled={followBusy}
            >
              {followBusy ? <Loader2 size={15} className="nx-spin" /> : following ? <><UserCheck size={15} /> متابَع</> : <><UserPlus size={15} /> متابعة</>}
            </button>
          )}
          {!isSelf && (
            <button className="profile-action-btn" onClick={() => goTo("chat", targetId)}>
              <MessageSquare size={16} /> رسالة
            </button>
          )}
          {shop?.published ? (
            <button className="profile-action-btn primary" onClick={() => goTo("shopPage", targetId)}>
              <Store size={16} /> زيارة المتجر
            </button>
          ) : isSelf ? (
            <button className="profile-action-btn gold" onClick={() => goTo("shopPage", targetId)}>
              <Plus size={16} /> إنشاء متجر
            </button>
          ) : null}
        </div>

        {isSelf && (
          <button className="profile-support-link" onClick={() => goTo("support")}>
            <Coffee size={14} /> دعم نِكسا
          </button>
        )}

        {isAdmin && (
          <button className={`verify-admin-btn ${user.isVerified ? "active" : ""}`} onClick={toggleVerify} disabled={verifyBusy}>
            {verifyBusy ? <Loader2 size={14} className="nx-spin" /> : <ShieldCheck size={15} />}
            {user.isVerified ? "إلغاء التوثيق" : "توثيق هذا الحساب"}
          </button>
        )}
      </div>

      <div className="profile-tabs-bar">
        <button className={`profile-tab ${profileTab === "posts" ? "active" : ""}`} onClick={() => setProfileTab("posts")}>
          <MessageCircle size={15} /> المنشورات
        </button>
        {shop?.published && (
          <button className={`profile-tab ${profileTab === "products" ? "active" : ""}`} onClick={() => setProfileTab("products")}>
            <ShoppingBag size={15} /> المنتجات
          </button>
        )}
      </div>

      <div className="profile-posts-section">
        {profileTab === "posts" && (
          <>
            {myPosts.length === 0 && <EmptyState icon={MessageCircle} title="لا توجد منشورات" />}
            {myPosts.map((p) => (
              <PostCard key={p.id} post={p} author={user} currentUser={currentUser} goTo={goTo} onChanged={load} notify={notify} />
            ))}
          </>
        )}
        {profileTab === "products" && shop && (
          <div className="products-grid" style={{ padding: 0 }}>
            {(shop.products || []).length === 0 && <EmptyState icon={ShoppingBag} title="لا توجد منتجات بعد" />}
            {(shop.products || []).map((p) => (
              <div className="product-card" key={p.id} onClick={() => goTo("shopPage", targetId)}>
                <div className="product-img" style={p.image ? { backgroundImage: `url(${p.image})` } : {}}>
                  {!p.image && <ImageIcon size={22} />}
                </div>
                <div className="product-info">
                  <span className="product-name">{p.name}</span>
                  {p.price && <span className="product-price">{p.price}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editOpen && (
        <ProfileEditModal
          user={user}
          onClose={() => setEditOpen(false)}
          onSaved={(updated) => { setEditOpen(false); setUser(updated); setCurrentUser(updated); notify("تم تحديث ملفك الشخصي"); }}
        />
      )}

      {followListType && (
        <FollowListModal
          userId={targetId}
          type={followListType}
          currentUser={currentUser}
          goTo={(view, param) => { setFollowListType(null); goTo(view, param); }}
          onClose={() => setFollowListType(null)}
        />
      )}
    </div>
  );
}

function SocialLinksEditor({ links, onChange }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const usedKeys = new Set(links.map((l) => l.platform));
  const available = SOCIAL_PLATFORMS.filter((p) => !usedKeys.has(p.key));

  const addLink = (platformKey) => {
    onChange([...links, { platform: platformKey, url: "" }]);
    setPickerOpen(false);
  };
  const updateLink = (i, url) => {
    const next = [...links];
    next[i] = { ...next[i], url };
    onChange(next);
  };
  const removeLink = (i) => {
    onChange(links.filter((_, idx) => idx !== i));
  };

  return (
    <div className="field-group">
      <label className="field-label">روابطك (اختياري — أضف ما تريد فقط)</label>
      {links.map((link, i) => {
        const platform = SOCIAL_PLATFORMS.find((p) => p.key === link.platform) || SOCIAL_PLATFORMS[6];
        const Icon = platform.icon;
        return (
          <div className="social-link-row" key={link.platform + i}>
            <div className="social-link-icon"><Icon size={16} /></div>
            <input
              className="field-input"
              value={link.url}
              onChange={(e) => updateLink(i, e.target.value)}
              placeholder={platform.placeholder}
            />
            <button type="button" className="social-link-remove" onClick={() => removeLink(i)}><X size={15} /></button>
          </div>
        );
      })}

      {available.length > 0 && (
        <div style={{ position: "relative" }}>
          <button type="button" className="add-link-btn" onClick={() => setPickerOpen((p) => !p)}>
            <Plus size={15} /> إضافة رابط
          </button>
          {pickerOpen && (
            <div className="link-picker">
              {available.map((p) => {
                const Icon = p.icon;
                return (
                  <button type="button" key={p.key} onClick={() => addLink(p.key)}>
                    <Icon size={15} /> {p.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ProfileEditModal({ user, onClose, onSaved }) {
  const [fullName, setFullName] = useState(user.fullName || "");
  const [bio, setBio] = useState(user.bio || "");
  const [location, setLocation] = useState(user.location || "");
  const [avatar, setAvatar] = useState(user.avatar || "");
  const [cover, setCover] = useState(user.cover || "");
  const [socialLinks, setSocialLinks] = useState(user.socialLinks || []);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const cleanLinks = socialLinks.filter((l) => l.url && l.url.trim());
    const updated = {
      ...user, fullName: fullName.trim() || user.username, bio: bio.trim(), location: location.trim(),
      avatar: avatar.trim(), cover: cover.trim(), socialLinks: cleanLinks,
    };
    await dbSet(KEYS.users(user.id), updated, true);
    setSaving(false);
    onSaved(updated);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet tall" onClick={(e) => e.stopPropagation()}>
        <div className="modal-handle" />
        <div className="modal-head">
          <h3>تعديل الملف الشخصي</h3>
          <button className="icon-btn" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="field-group">
          <label className="field-label">صورة الغلاف</label>
          <MediaUploader value={cover} onChange={setCover} folder="covers" height={110} />
        </div>

        <div className="field-group" style={{ textAlign: "center" }}>
          <label className="field-label" style={{ textAlign: "center", display: "block" }}>صورة الملف الشخصي</label>
          <MediaUploader value={avatar} onChange={setAvatar} folder="avatars" shape="circle" height={84} />
        </div>

        <div className="field-group">
          <label className="field-label">الاسم الكامل</label>
          <input className="field-input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div className="field-group">
          <label className="field-label">نبذة عنك</label>
          <textarea className="field-input" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="اكتب نبذة قصيرة عنك أو عن مهاراتك (اختياري)" />
        </div>
        <div className="field-group">
          <label className="field-label">الموقع</label>
          <input className="field-input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="مثال: دبي، الإمارات (اختياري)" />
        </div>

        <SocialLinksEditor links={socialLinks} onChange={setSocialLinks} />

        <button className="btn-primary" onClick={save} disabled={saving} style={{ marginTop: 8 }}>
          {saving ? <Loader2 size={18} className="nx-spin" /> : "حفظ التعديلات"}
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   نافذة المساعدة (شرح الاستخدام)
   ============================================================ */
function HelpModal({ onClose }) {
  const steps = [
    { icon: User, title: "أنشئ حسابك", text: "سجّل باسم مستخدم وكلمة مرور خاصة بك. حسابك محفوظ ويمكنك الدخول منه في أي وقت." },
    { icon: MessageCircle, title: "شارك في المجتمع", text: "من الصفحة الرئيسية، انشر منشورات نصية، صور، فيديوهات، أو أعلن عن منتج لديك." },
    { icon: Store, title: "افتح متجرك", text: "من صفحة حسابك، أنشئ متجرك الخاص وأضف منتجاتك الرقمية أو خدماتك مع صور وأسعار." },
    { icon: Briefcase, title: "اطلب أو قدّم خدمة", text: "في قسم الوظائف، انشر طلب وظيفة أو خدمة، أو تقدّم لطلبات الآخرين برسالة قصيرة." },
    { icon: DollarSign, title: "الدفع والتواصل", text: "كل تاجر يحدد طريقة الدفع أو التواصل الخاصة به داخل متجره — نِكسا لا يتدخل في عمليات الدفع." },
  ];
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet tall" onClick={(e) => e.stopPropagation()}>
        <div className="modal-handle" />
        <div className="modal-head">
          <h3>كيف يعمل نِكسا؟</h3>
          <button className="icon-btn" onClick={onClose}><X size={20} /></button>
        </div>
        {steps.map((s, i) => {
          const Icon = s.icon;
          return (
            <div className="help-step" key={i}>
              <div className="help-step-icon"><Icon size={18} /></div>
              <div>
                <h4>{s.title}</h4>
                <p>{s.text}</p>
              </div>
            </div>
          );
        })}
        <button className="btn-primary" style={{ marginTop: 8 }} onClick={onClose}>فهمت، شكرًا</button>
      </div>
    </div>
  );
}

/* ============================================================
   نافذة البحث الشامل
   ============================================================ */
function SearchModal({ currentUser, goTo, onClose }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults(null);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      const r = await searchNexa(query);
      setResults(r);
      setSearching(false);
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const goToUser = (id) => { onClose(); goTo("userProfile", id); };
  const goToShop = (id) => { onClose(); goTo("shopPage", id); };

  const hasAny = results && (results.users.length || results.shops.length || results.products.length);

  return (
    <div className="modal-overlay search-overlay" onClick={onClose}>
      <div className="search-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="search-input-row">
          <Search size={18} className="search-icon" />
          <input
            className="field-input search-input"
            autoFocus
            placeholder="ابحث عن أشخاص، متاجر، أو منتجات..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className="icon-btn" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="search-results-scroll">
          {!query.trim() && (
            <EmptyState icon={Search} title="ابحث في نِكسا" hint="اكتب اسم شخص، متجر، أو منتج تبحث عنه" />
          )}
          {searching && <div className="search-loading"><Loader2 size={20} className="nx-spin" /></div>}

          {results && !searching && !hasAny && (
            <EmptyState icon={Search} title="لا نتائج" hint="جرّب كلمة بحث أخرى" />
          )}

          {results && results.users.length > 0 && (
            <div className="search-section">
              <h4 className="search-section-title">أشخاص</h4>
              {results.users.map((u) => (
                <div className="search-result-row" key={u.id} onClick={() => goToUser(u.id)}>
                  <Avatar user={u} size={38} />
                  <div className="search-result-body">
                    <span className="search-result-name">
                      {u.fullName}
                      <UserBadge user={u} size={13} style={{ marginRight: 4 }} />
                    </span>
                    <span className="search-result-sub">@{u.username}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {results && results.shops.length > 0 && (
            <div className="search-section">
              <h4 className="search-section-title">متاجر</h4>
              {results.shops.map((s) => (
                <div className="search-result-row" key={s.ownerId} onClick={() => goToShop(s.ownerId)}>
                  <div className="search-shop-icon"><Store size={17} /></div>
                  <div className="search-result-body">
                    <span className="search-result-name">{s.name}</span>
                    <span className="search-result-sub">{s.category}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {results && results.products.length > 0 && (
            <div className="search-section">
              <h4 className="search-section-title">منتجات وخدمات</h4>
              {results.products.map((p, i) => (
                <div className="search-result-row" key={p.id + i} onClick={() => goToShop(p.shopOwnerId)}>
                  <div className="search-shop-icon"><ShoppingBag size={17} /></div>
                  <div className="search-result-body">
                    <span className="search-result-name">{p.name}</span>
                    <span className="search-result-sub">في متجر {p.shopName}</span>
                  </div>
                  {p.price && <span className="search-result-price">{p.price}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   قائمة المحادثات
   ============================================================ */
function ConversationsListView({ currentUser, goTo, notify, onRead }) {
  const [conversations, setConversations] = useState(null);
  const [usersCache, setUsersCache] = useState({});
  const [shopOwnerIds, setShopOwnerIds] = useState(new Set());
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all"); // all | unread | shops

  const load = useCallback(async () => {
    const list = await getMyConversationsList(currentUser.id);
    setConversations(list);
    const ids = list.map((c) => c.otherUserId);
    const fetched = await Promise.all(ids.map((id) => dbGet(KEYS.users(id), true)));
    const map = {};
    ids.forEach((id, i) => { if (fetched[i]) map[id] = fetched[i]; });
    setUsersCache(map);

    const shopsChecks = await Promise.all(ids.map((id) => dbGet(KEYS.shop(id), true)));
    const shopSet = new Set();
    ids.forEach((id, i) => { if (shopsChecks[i]?.published) shopSet.add(id); });
    setShopOwnerIds(shopSet);
  }, [currentUser.id]);

  useEffect(() => { load(); }, [load]);

  const filterTabs = [
    { key: "all", label: "الكل" },
    { key: "unread", label: "غير مقروء" },
    { key: "shops", label: "المتاجر" },
  ];

  const filtered = useMemo(() => {
    if (!conversations) return null;
    let list = conversations;
    if (filter === "unread") list = list.filter((c) => c.unread);
    if (filter === "shops") list = list.filter((c) => shopOwnerIds.has(c.otherUserId));
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((c) => {
        const u = usersCache[c.otherUserId];
        return u?.fullName?.toLowerCase().includes(q) || u?.username?.toLowerCase().includes(q);
      });
    }
    return list;
  }, [conversations, filter, query, usersCache, shopOwnerIds]);

  return (
    <div className="page-pad">
      <PageHeader title="الرسائل" />

      <div className="conv-search-row">
        <Search size={16} className="search-icon" />
        <input
          className="field-input search-input"
          placeholder="ابحث في الرسائل..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="cat-scroll" style={{ marginBottom: 10 }}>
        {filterTabs.map((t) => (
          <button key={t.key} className={`cat-chip ${filter === t.key ? "active" : ""}`} onClick={() => setFilter(t.key)}>{t.label}</button>
        ))}
      </div>

      {filtered === null && <div className="skel-block" style={{ height: 200 }} />}
      {filtered && filtered.length === 0 && (
        <EmptyState icon={MessageSquare} title="لا توجد محادثات" hint="ابدأ محادثة من الملف الشخصي لأي مستخدم" />
      )}
      {filtered && filtered.map((c) => {
        const u = usersCache[c.otherUserId];
        const isShop = shopOwnerIds.has(c.otherUserId);
        return (
          <div key={c.otherUserId} className="conv-row" onClick={() => goTo("chat", c.otherUserId)}>
            <Avatar user={u} size={48} />
            <div className="conv-body">
              <div className="conv-top-row">
                <span className="conv-name">
                  {u?.fullName || "مستخدم"}
                  <UserBadge user={u} size={12} style={{ marginRight: 3 }} />
                  {isShop && <Store size={12} style={{ marginRight: 3, color: "var(--gold-2)" }} />}
                </span>
                <span className="conv-time">{timeAgo(c.lastAt)}</span>
              </div>
              <span className={`conv-preview ${c.unread ? "unread" : ""}`}>{c.lastText || "..."}</span>
            </div>
            {c.unread && <span className="conv-dot" />}
          </div>
        );
      })}
    </div>
  );
}

/* ============================================================
   صفحة المحادثة (الدردشة الخاصة)
   ============================================================ */
function ChatView({ currentUser, otherUserId, goTo, notify, onRead }) {
  const [otherUser, setOtherUser] = useState(null);
  const [messages, setMessages] = useState(null);
  const [text, setText] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [showImageUploader, setShowImageUploader] = useState(false);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);
  const pollRef = useRef(null);
  const lastMsgIdRef = useRef(null);

  const load = useCallback(async (silent = false) => {
    const [u, msgs] = await Promise.all([
      dbGet(KEYS.users(otherUserId), true),
      getConversation(currentUser.id, otherUserId),
    ]);
    setOtherUser(u);

    // تشغيل صوت تنبيه إذا وصلت رسالة جديدة فعليًا من الطرف الآخر أثناء الاستماع الصامت
    if (silent && msgs.length > 0) {
      const newest = msgs[msgs.length - 1];
      if (
        lastMsgIdRef.current &&
        newest.id !== lastMsgIdRef.current &&
        newest.senderId === otherUserId
      ) {
        playMessageSound();
      }
    }
    if (msgs.length > 0) lastMsgIdRef.current = msgs[msgs.length - 1].id;

    setMessages(msgs);
    await markConversationRead(otherUserId, currentUser.id);
    if (onRead) onRead();
    if (!silent) {
      setTimeout(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
      }, 100);
    }
  }, [currentUser.id, otherUserId, onRead]);

  useEffect(() => {
    load();
    pollRef.current = setInterval(() => load(true), 8000);
    return () => clearInterval(pollRef.current);
  }, [load]);

  const send = async () => {
    if (!text.trim() && !imageUrl) return;
    setSending(true);
    const ok = await sendMessage(currentUser.id, otherUserId, text.trim(), imageUrl);
    if (ok) {
      setText("");
      setImageUrl("");
      setShowImageUploader(false);
      createNotification(otherUserId, "message", currentUser.id);
      await load();
    } else {
      notify("تعذّر إرسال الرسالة", "error");
    }
    setSending(false);
  };

  if (messages === null) {
    return <div className="page-pad"><PageHeader title="محادثة" onBack={() => goTo("messages")} /><div className="skel-block" style={{ height: 300 }} /></div>;
  }

  return (
    <div className="chat-page">
      <div className="chat-header">
        <button className="back-btn" onClick={() => goTo("messages")}><ChevronRight size={20} /></button>
        <div className="chat-header-user" onClick={() => goTo("userProfile", otherUserId)}>
          <Avatar user={otherUser} size={36} />
          <div>
            <div className="chat-header-name">
              {otherUser?.fullName || "مستخدم"}
              <UserBadge user={otherUser} size={12} style={{ marginRight: 3 }} />
            </div>
            <div className="chat-header-username">@{otherUser?.username}</div>
          </div>
        </div>
      </div>

      <div className="chat-messages" ref={scrollRef}>
        {messages.length === 0 && (
          <EmptyState icon={MessageSquare} title="ابدأ المحادثة" hint={`أرسل أول رسالة إلى ${otherUser?.fullName || "هذا المستخدم"}`} />
        )}
        {messages.map((m) => {
          const isMine = m.senderId === currentUser.id;
          return (
            <div key={m.id} className={`chat-bubble-row ${isMine ? "mine" : ""}`}>
              <div className={`chat-bubble ${isMine ? "mine" : ""}`}>
                {m.imageUrl && <img src={m.imageUrl} alt="" className="chat-bubble-img" />}
                {m.text && <p>{m.text}</p>}
                <span className="chat-bubble-time">{new Date(m.createdAt).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
            </div>
          );
        })}
      </div>

      {showImageUploader && (
        <div className="chat-image-uploader">
          <MediaUploader value={imageUrl} onChange={setImageUrl} folder="messages" accept="image/*" height={110} />
          <button className="chat-cancel-image" onClick={() => { setShowImageUploader(false); setImageUrl(""); }}>إلغاء</button>
        </div>
      )}

      <div className="chat-input-bar">
        <button className="icon-btn" onClick={() => setShowImageUploader((s) => !s)}>
          <ImageIcon size={20} />
        </button>
        <input
          className="chat-text-input"
          placeholder="اكتب رسالة..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
        />
        <button className="icon-btn-solid" onClick={send} disabled={sending}>
          {sending ? <Loader2 size={16} className="nx-spin" /> : <Send size={16} />}
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   نافذة قائمة المتابعين / المتابَعين
   ============================================================ */
function FollowListModal({ userId, type, currentUser, goTo, onClose }) {
  const [users, setUsers] = useState(null);

  useEffect(() => {
    (async () => {
      const list = await getFollowListUsers(userId, type);
      setUsers(list);
    })();
  }, [userId, type]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet tall" onClick={(e) => e.stopPropagation()}>
        <div className="modal-handle" />
        <div className="modal-head">
          <h3>{type === "followers" ? "المتابِعون" : "يتابع"}</h3>
          <button className="icon-btn" onClick={onClose}><X size={20} /></button>
        </div>

        {users === null && <div className="skel-block" style={{ height: 160 }} />}
        {users && users.length === 0 && (
          <EmptyState icon={User} title={type === "followers" ? "لا يوجد متابِعون بعد" : "لا يتابع أي حساب بعد"} />
        )}
        {users && users.map((u) => (
          <div className="search-result-row" key={u.id} onClick={() => goTo("userProfile", u.id)}>
            <Avatar user={u} size={40} />
            <div className="search-result-body">
              <span className="search-result-name">
                {u.fullName}
                <UserBadge user={u} size={13} style={{ marginRight: 4 }} />
              </span>
              <span className="search-result-sub">@{u.username}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   نظام الإشعارات
   ============================================================ */
async function createNotification(userId, type, fromUserId, extra = {}) {
  // لا حاجة لإشعار النفس
  if (userId === fromUserId) return true;
  try {
    const id = uid("notif");
    const { error } = await supabase.from("notifications").insert({
      id, user_id: userId, type, from_user_id: fromUserId,
      post_id: extra.postId || null, message: extra.message || "",
      read: false, created_at: Date.now(),
    });
    if (error) throw error;
    return true;
  } catch (e) {
    console.error("createNotification failed", e);
    return false;
  }
}

async function getMyNotifications(userId) {
  try {
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return data.map((r) => ({
      id: r.id, type: r.type, fromUserId: r.from_user_id, postId: r.post_id,
      message: r.message || "", read: r.read || false, createdAt: r.created_at,
    }));
  } catch (e) {
    console.error("getMyNotifications failed", e);
    return [];
  }
}

async function getUnreadNotificationsCount(userId) {
  try {
    const { count, error } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId).eq("read", false);
    if (error) throw error;
    return count || 0;
  } catch {
    return 0;
  }
}

async function markAllNotificationsRead(userId) {
  try {
    await supabase.from("notifications").update({ read: true }).eq("user_id", userId).eq("read", false);
    return true;
  } catch {
    return false;
  }
}

const NOTIF_META = {
  follow: { icon: UserPlus, text: "بدأ بمتابعتك", color: "#1D9BF0" },
  like: { icon: Heart, text: "أعجب بمنشورك", color: "#E0245E" },
  comment: { icon: MessageCircle, text: "علّق على منشورك", color: "#17BF63" },
  message: { icon: MessageSquare, text: "أرسل لك رسالة", color: "var(--teal-2)" },
  verify: { icon: ShieldCheck, text: "تم توثيق حسابك", color: "var(--gold-2)" },
};

function NotificationsView({ currentUser, goTo, onRead }) {
  const [items, setItems] = useState(null);
  const [usersCache, setUsersCache] = useState({});

  const load = useCallback(async () => {
    const list = await getMyNotifications(currentUser.id);
    setItems(list);
    const ids = [...new Set(list.map((n) => n.fromUserId).filter(Boolean))];
    const fetched = await Promise.all(ids.map((id) => dbGet(KEYS.users(id), true)));
    const map = {};
    ids.forEach((id, i) => { if (fetched[i]) map[id] = fetched[i]; });
    setUsersCache(map);
    await markAllNotificationsRead(currentUser.id);
    if (onRead) onRead();
  }, [currentUser.id, onRead]);

  useEffect(() => { load(); }, [load]);

  const handleClick = (n) => {
    if (n.type === "message") goTo("chat", n.fromUserId);
    else if (n.type === "follow") goTo("userProfile", n.fromUserId);
    else if (n.type === "like" || n.type === "comment") goTo("feed");
    else goTo("profile");
  };

  const groups = useMemo(() => {
    if (!items) return [];
    const now = Date.now();
    const oneDay = 86400000;
    const today = [], week = [], earlier = [];
    for (const n of items) {
      const diff = now - n.createdAt;
      if (diff < oneDay) today.push(n);
      else if (diff < oneDay * 7) week.push(n);
      else earlier.push(n);
    }
    return [
      { label: "اليوم", list: today },
      { label: "هذا الأسبوع", list: week },
      { label: "سابقًا", list: earlier },
    ].filter((g) => g.list.length > 0);
  }, [items]);

  const renderRow = (n) => {
    const meta = NOTIF_META[n.type] || NOTIF_META.follow;
    const Icon = meta.icon;
    const fromUser = usersCache[n.fromUserId];
    return (
      <div key={n.id} className={`notif-row ${!n.read ? "unread" : ""}`} onClick={() => handleClick(n)}>
        <div className="notif-avatar-stack">
          <Avatar user={fromUser} size={42} />
          <div className="notif-icon" style={{ background: meta.color }}>
            <Icon size={11} color="#fff" />
          </div>
        </div>
        <div className="notif-body">
          <span className="notif-text">
            <b>{fromUser?.fullName || "مستخدم نِكسا"}</b> {meta.text}
          </span>
          <span className="notif-time">{timeAgo(n.createdAt)}</span>
        </div>
        {!n.read && <span className="notif-dot" />}
      </div>
    );
  };

  return (
    <div className="page-pad">
      <PageHeader title="الإشعارات" onBack={() => goTo("feed")} />
      {items === null && (
        <div>
          {[1, 2, 3].map((i) => (
            <div className="skel-row" key={i} style={{ marginBottom: 14 }}>
              <div className="skel-circle" />
              <div className="skel-lines"><div className="skel-line w60" /><div className="skel-line w30" /></div>
            </div>
          ))}
        </div>
      )}
      {items && items.length === 0 && (
        <EmptyState icon={Bell} title="لا توجد إشعارات بعد" hint="ستظهر هنا أي متابعة جديدة، رسالة، أو تفاعل مع منشوراتك" />
      )}
      {groups.map((g) => (
        <div className="notif-group" key={g.label}>
          <h4 className="notif-group-title">{g.label}</h4>
          {g.list.map(renderRow)}
        </div>
      ))}
    </div>
  );
}

/* ============================================================
   صفحة الإعدادات
   ============================================================ */
function SettingsView({ currentUser, setCurrentUser, goTo, notify, onLogout }) {
  const [soundOn, setSoundOn] = useState(isSoundEnabled());
  const [pwOpen, setPwOpen] = useState(false);
  const [usernameOpen, setUsernameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
    if (next) playMessageSound();
  };

  return (
    <div className="page-pad">
      <PageHeader title="الإعدادات" onBack={() => goTo("profile")} />

      <div className="settings-section">
        <h4 className="settings-section-title">التنبيهات</h4>
        <div className="settings-row">
          <div className="settings-row-text">
            <span className="settings-row-label">صوت الرسائل</span>
            <span className="settings-row-hint">تشغيل صوت تنبيه عند استقبال رسالة جديدة</span>
          </div>
          <button className={`toggle-switch ${soundOn ? "on" : ""}`} onClick={toggleSound}>
            <span className="toggle-knob" />
          </button>
        </div>
      </div>

      <div className="settings-section">
        <h4 className="settings-section-title">الحساب</h4>
        <button className="settings-link-row" onClick={() => setUsernameOpen(true)}>
          <span>تغيير اسم المستخدم (@{currentUser.username})</span>
          <ChevronLeft size={17} />
        </button>
        <button className="settings-link-row" onClick={() => setPwOpen(true)}>
          <span>تغيير كلمة المرور</span>
          <ChevronLeft size={17} />
        </button>
        <button className="settings-link-row" onClick={() => goTo("profile")}>
          <span>تعديل الملف الشخصي</span>
          <ChevronLeft size={17} />
        </button>
      </div>

      <div className="settings-section">
        <h4 className="settings-section-title">دعم نِكسا</h4>
        <div className="donate-card-box">
          <Coffee size={20} style={{ color: "var(--gold-2)" }} />
          <div className="donate-card-text">
            <span className="donate-card-label">للتبرع لدعم استمرار نِكسا، عبر ماستركارد:</span>
            <span className="donate-card-number" dir="ltr">9101 2968 0245</span>
          </div>
          <button
            className="donate-copy-btn"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText("910129680245");
                notify("تم نسخ رقم البطاقة");
              } catch {
                notify("تعذّر النسخ", "error");
              }
            }}
          >
            <Link2 size={14} /> نسخ
          </button>
        </div>
      </div>

      <div className="settings-section">
        <h4 className="settings-section-title">عن نِكسا</h4>
        <button className="settings-link-row" onClick={() => goTo("support")}>
          <span>دعم نِكسا</span>
          <ChevronLeft size={17} />
        </button>
      </div>

      <div className="settings-section">
        <h4 className="settings-section-title danger-title">منطقة الخطر</h4>
        <button className="settings-link-row danger" onClick={() => setDeleteOpen(true)}>
          <span>حذف الحساب نهائيًا</span>
          <Trash2 size={16} />
        </button>
      </div>

      {usernameOpen && (
        <ChangeUsernameModal
          currentUser={currentUser}
          onClose={() => setUsernameOpen(false)}
          onChanged={(updated) => { setUsernameOpen(false); setCurrentUser(updated); notify("تم تغيير اسم المستخدم بنجاح"); }}
          notify={notify}
        />
      )}

      {pwOpen && (
        <ChangePasswordModal
          currentUser={currentUser}
          onClose={() => setPwOpen(false)}
          notify={notify}
        />
      )}

      {deleteOpen && (
        <DeleteAccountModal
          currentUser={currentUser}
          onClose={() => setDeleteOpen(false)}
          onDeleted={onLogout}
          notify={notify}
        />
      )}
    </div>
  );
}

function ChangeUsernameModal({ currentUser, onClose, onChanged, notify }) {
  const [newUsername, setNewUsername] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const normalize = (s) => s.trim().toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9_\u0600-\u06FF]/g, "");

  const save = async () => {
    setError("");
    const clean = normalize(newUsername);
    if (!clean || clean.length < 3) { setError("اسم المستخدم يجب أن يكون 3 أحرف على الأقل"); return; }
    if (clean === currentUser.username) { setError("هذا هو اسم المستخدم الحالي بالفعل"); return; }
    setSaving(true);
    const existing = await dbGet(`uname:${clean}`, true);
    if (existing) {
      setError("اسم المستخدم هذا محجوز، جرّب اسمًا آخر");
      setSaving(false);
      return;
    }
    const updated = { ...currentUser, username: clean };
    const result = await dbSet(KEYS.users(currentUser.id), updated, true);
    setSaving(false);
    if (result) {
      onChanged(updated);
    } else {
      setError("تعذّر حفظ الاسم الجديد، حاول مجددًا");
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-handle" />
        <div className="modal-head">
          <h3>تغيير اسم المستخدم</h3>
          <button className="icon-btn" onClick={onClose}><X size={20} /></button>
        </div>
        <p style={{ fontSize: 12.5, color: "var(--ink-soft)", marginBottom: 12, lineHeight: 1.7 }}>
          اسمك الحالي: <b>@{currentUser.username}</b>. تغييره يغيّر رابط ملفك الشخصي فورًا.
        </p>
        <div className="field-group">
          <label className="field-label">اسم المستخدم الجديد</label>
          <input
            className="field-input"
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            placeholder="مثال: sara_ahmad"
            onKeyDown={(e) => e.key === "Enter" && save()}
          />
        </div>
        {error && <div className="field-error"><AlertCircle size={14} /> {error}</div>}
        <button className="btn-primary" onClick={save} disabled={saving} style={{ marginTop: 8 }}>
          {saving ? <Loader2 size={18} className="nx-spin" /> : "حفظ الاسم الجديد"}
        </button>
      </div>
    </div>
  );
}

function ChangePasswordModal({ currentUser, onClose, notify }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setError("");
    if (!current || !next || !confirm) { setError("عبّئ كل الحقول"); return; }
    if (next.length < 4) { setError("كلمة المرور الجديدة قصيرة جدًا"); return; }
    if (next !== confirm) { setError("كلمتا المرور الجديدتان غير متطابقتين"); return; }
    setSaving(true);
    const currentHash = await sha256(current + "::nexa::" + currentUser.username);
    if (currentHash !== currentUser.passHash) {
      setError("كلمة المرور الحالية غير صحيحة");
      setSaving(false);
      return;
    }
    const newHash = await sha256(next + "::nexa::" + currentUser.username);
    const result = await dbSet(KEYS.users(currentUser.id), { ...currentUser, passHash: newHash }, true);
    setSaving(false);
    if (result) {
      notify("تم تغيير كلمة المرور بنجاح");
      onClose();
    } else {
      setError("تعذّر حفظ كلمة المرور الجديدة، حاول مجددًا");
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-handle" />
        <div className="modal-head">
          <h3>تغيير كلمة المرور</h3>
          <button className="icon-btn" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="field-group">
          <label className="field-label">كلمة المرور الحالية</label>
          <input className="field-input" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </div>
        <div className="field-group">
          <label className="field-label">كلمة المرور الجديدة</label>
          <input className="field-input" type="password" value={next} onChange={(e) => setNext(e.target.value)} />
        </div>
        <div className="field-group">
          <label className="field-label">تأكيد كلمة المرور الجديدة</label>
          <input className="field-input" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
        {error && <div className="field-error"><AlertCircle size={14} /> {error}</div>}
        <button className="btn-primary" onClick={save} disabled={saving} style={{ marginTop: 8 }}>
          {saving ? <Loader2 size={18} className="nx-spin" /> : "حفظ كلمة المرور"}
        </button>
      </div>
    </div>
  );
}

function DeleteAccountModal({ currentUser, onClose, onDeleted, notify }) {
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const matches = confirmText.trim() === currentUser.username;

  const doDelete = async () => {
    if (!matches) return;
    setDeleting(true);
    const result = await dbDelete(KEYS.users(currentUser.id), true);
    setDeleting(false);
    if (result) {
      notify("تم حذف حسابك نهائيًا");
      onDeleted();
    } else {
      notify("تعذّر حذف الحساب، حاول مجددًا", "error");
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-handle" />
        <div className="modal-head">
          <h3>حذف الحساب نهائيًا</h3>
          <button className="icon-btn" onClick={onClose}><X size={20} /></button>
        </div>
        <p style={{ fontSize: 13.5, color: "var(--red)", lineHeight: 1.7, marginBottom: 14, fontWeight: 600 }}>
          تحذير: سيتم حذف حسابك ومتجرك ومنشوراتك ومحادثاتك نهائيًا، ولا يمكن التراجع عن هذا الإجراء.
        </p>
        <div className="field-group">
          <label className="field-label">اكتب اسم المستخدم "{currentUser.username}" للتأكيد</label>
          <input className="field-input" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder={currentUser.username} />
        </div>
        <button className="btn-primary" style={{ background: "var(--red)", marginTop: 8 }} onClick={doDelete} disabled={!matches || deleting}>
          {deleting ? <Loader2 size={18} className="nx-spin" /> : <><Trash2 size={15} /> حذف حسابي نهائيًا</>}
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   نافذة تحليلات المتجر (للحسابات الموثقة)
   ============================================================ */
function ShopAnalyticsModal({ shopOwnerId, shop, onClose }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    (async () => {
      const result = await getShopAnalytics(shopOwnerId);
      setData(result);
    })();
  }, [shopOwnerId]);

  const products = shop?.products || [];
  const topProducts = [...products]
    .map((p) => ({ ...p, views: p.views || 0 }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 3);

  const maxCount = data ? Math.max(1, ...data.dailyData.map((d) => d.count)) : 1;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet tall" onClick={(e) => e.stopPropagation()}>
        <div className="modal-handle" />
        <div className="modal-head">
          <h3>تحليلات المتجر</h3>
          <button className="icon-btn" onClick={onClose}><X size={20} /></button>
        </div>

        {!data ? (
          <div className="skel-block" style={{ height: 180 }} />
        ) : (
          <>
            <div className="analytics-stats-row">
              <div className="analytics-stat-card">
                <Eye size={18} style={{ color: "var(--teal-2)" }} />
                <b>{data.totalVisits}</b>
                <span>زيارة (٧ أيام)</span>
              </div>
              <div className="analytics-stat-card">
                <Users size={18} style={{ color: "var(--gold-2)" }} />
                <b>{data.uniqueVisitors}</b>
                <span>زائر مختلف</span>
              </div>
            </div>

            <h4 className="analytics-section-title">نشاط آخر 7 أيام</h4>
            <div className="analytics-chart">
              {data.dailyData.map((d, i) => (
                <div key={i} className="analytics-bar-col">
                  <div className="analytics-bar-track">
                    <div className="analytics-bar-fill" style={{ height: `${(d.count / maxCount) * 100}%` }} />
                  </div>
                  <span className="analytics-bar-label">{d.label}</span>
                </div>
              ))}
            </div>

            <h4 className="analytics-section-title">الأكثر مشاهدة</h4>
            {topProducts.length === 0 && <EmptyState icon={ShoppingBag} title="لا توجد بيانات منتجات كافية بعد" />}
            {topProducts.map((p) => (
              <div key={p.id} className="analytics-product-row">
                <div className="product-img" style={{ width: 40, height: 40, flexShrink: 0, ...(p.image ? { backgroundImage: `url(${p.image})` } : {}) }}>
                  {!p.image && <ImageIcon size={16} />}
                </div>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{p.name}</span>
                <span className="analytics-views-badge"><Eye size={12} /> {p.views}</span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   لوحة تحكم الأدمن
   ============================================================ */
function AdminDashboardView({ currentUser, goTo, notify }) {
  const [tab, setTab] = useState("users"); // users | posts
  const [users, setUsers] = useState(null);
  const [posts, setPosts] = useState(null);
  const [usersCache, setUsersCache] = useState({});
  const [query, setQuery] = useState("");
  const [confirmAction, setConfirmAction] = useState(null); // { type, target }

  const loadUsers = useCallback(async () => {
    const list = await getAllUsersForAdmin();
    setUsers(list);
  }, []);

  const loadPosts = useCallback(async () => {
    const list = await getAllPostsForAdmin();
    setPosts(list);
    const authorIds = [...new Set(list.map((p) => p.authorId))];
    const fetched = await Promise.all(authorIds.map((id) => dbGet(KEYS.users(id), true)));
    const map = {};
    authorIds.forEach((id, i) => { if (fetched[i]) map[id] = fetched[i]; });
    setUsersCache(map);
  }, []);

  useEffect(() => {
    loadUsers();
    loadPosts();
  }, [loadUsers, loadPosts]);

  const filteredUsers = useMemo(() => {
    if (!users) return null;
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => u.username.toLowerCase().includes(q) || u.fullName.toLowerCase().includes(q));
  }, [users, query]);

  const filteredPosts = useMemo(() => {
    if (!posts) return null;
    const q = query.trim().toLowerCase();
    if (!q) return posts;
    return posts.filter((p) => {
      const author = usersCache[p.authorId];
      return p.text?.toLowerCase().includes(q) || author?.username?.toLowerCase().includes(q) || author?.fullName?.toLowerCase().includes(q);
    });
  }, [posts, query, usersCache]);

  const handleToggleSuspend = async (user) => {
    const ok = await setUserSuspended(user.id, !user.suspended, currentUser.username);
    if (ok) {
      notify(!user.suspended ? `تم تعليق حساب ${user.username}` : `تم إلغاء تعليق حساب ${user.username}`);
      loadUsers();
    } else {
      notify("تعذّر تنفيذ الإجراء", "error");
    }
    setConfirmAction(null);
  };

  const handleDeleteUser = async (user) => {
    const ok = await adminDeleteUser(user.id, currentUser.username);
    if (ok) {
      notify(`تم حذف حساب ${user.username} نهائيًا`);
      loadUsers();
    } else {
      notify("تعذّر حذف الحساب", "error");
    }
    setConfirmAction(null);
  };

  const handleDeletePost = async (post) => {
    const ok = await adminDeletePost(post.id, currentUser.username);
    if (ok) {
      notify("تم حذف المنشور");
      loadPosts();
    } else {
      notify("تعذّر حذف المنشور", "error");
    }
    setConfirmAction(null);
  };

  return (
    <div className="page-pad">
      <PageHeader title="لوحة تحكم الأدمن" onBack={() => goTo("feed")} />

      <div className="cat-scroll" style={{ marginBottom: 12 }}>
        <button className={`cat-chip ${tab === "users" ? "active" : ""}`} onClick={() => setTab("users")}>
          <Users size={13} style={{ marginLeft: 4 }} /> المستخدمون ({users?.length ?? "…"})
        </button>
        <button className={`cat-chip ${tab === "posts" ? "active" : ""}`} onClick={() => setTab("posts")}>
          <MessageCircle size={13} style={{ marginLeft: 4 }} /> المنشورات ({posts?.length ?? "…"})
        </button>
      </div>

      <div className="shops-search-row">
        <Search size={17} className="search-icon" />
        <input
          className="field-input search-input"
          placeholder={tab === "users" ? "ابحث باسم المستخدم..." : "ابحث في نص المنشورات..."}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {tab === "users" && (
        <>
          {filteredUsers === null && <div className="skel-block" style={{ height: 200 }} />}
          {filteredUsers && filteredUsers.length === 0 && <EmptyState icon={Users} title="لا يوجد مستخدمون مطابقون" />}
          {filteredUsers && filteredUsers.map((u) => (
            <div key={u.id} className="admin-row">
              <div className="admin-row-main" onClick={() => goTo("userProfile", u.id)}>
                <Avatar user={u} size={42} />
                <div className="admin-row-text">
                  <span className="admin-row-name">
                    {u.fullName}
                    <UserBadge user={u} size={12} style={{ marginRight: 3 }} />
                    {u.suspended && <span className="suspended-tag">معلَّق</span>}
                  </span>
                  <span className="admin-row-sub">@{u.username}</span>
                </div>
              </div>
              {u.username !== ADMIN_USERNAME && (
                <div className="admin-row-actions">
                  <button
                    className="admin-action-btn"
                    onClick={() => setConfirmAction({ type: "suspend", target: u })}
                  >
                    {u.suspended ? <UserCheck size={14} /> : <EyeOff size={14} />}
                    {u.suspended ? "إلغاء التعليق" : "تعليق"}
                  </button>
                  <button
                    className="admin-action-btn danger"
                    onClick={() => setConfirmAction({ type: "deleteUser", target: u })}
                  >
                    <Trash2 size={14} /> حذف
                  </button>
                </div>
              )}
            </div>
          ))}
        </>
      )}

      {tab === "posts" && (
        <>
          {filteredPosts === null && <div className="skel-block" style={{ height: 200 }} />}
          {filteredPosts && filteredPosts.length === 0 && <EmptyState icon={MessageCircle} title="لا توجد منشورات مطابقة" />}
          {filteredPosts && filteredPosts.map((p) => {
            const author = usersCache[p.authorId];
            return (
              <div key={p.id} className="admin-row">
                <div className="admin-row-main" onClick={() => goTo("userProfile", p.authorId)}>
                  <Avatar user={author} size={36} />
                  <div className="admin-row-text">
                    <span className="admin-row-name">{author?.fullName || "مستخدم"} <span className="admin-row-sub">@{author?.username}</span></span>
                    <span className="admin-post-preview">{p.text || (p.mediaUrl ? "📷 يحتوي صورة/فيديو" : "")}</span>
                  </div>
                </div>
                <button className="admin-action-btn danger" onClick={() => setConfirmAction({ type: "deletePost", target: p })}>
                  <Trash2 size={14} /> حذف
                </button>
              </div>
            );
          })}
        </>
      )}

      {confirmAction && confirmAction.type === "suspend" && (
        <ConfirmModal
          title={confirmAction.target.suspended ? "إلغاء تعليق الحساب؟" : "تعليق الحساب؟"}
          text={confirmAction.target.suspended ? `سيتمكن @${confirmAction.target.username} من تسجيل الدخول مجددًا.` : `لن يتمكن @${confirmAction.target.username} من تسجيل الدخول حتى تُلغي التعليق.`}
          confirmLabel={confirmAction.target.suspended ? "إلغاء التعليق" : "تعليق"}
          danger={!confirmAction.target.suspended}
          onConfirm={() => handleToggleSuspend(confirmAction.target)}
          onCancel={() => setConfirmAction(null)}
        />
      )}
      {confirmAction && confirmAction.type === "deleteUser" && (
        <ConfirmModal
          title="حذف الحساب نهائيًا؟"
          text={`سيتم حذف حساب @${confirmAction.target.username} ومتجره ومنشوراته ومحادثاته نهائيًا. لا يمكن التراجع.`}
          confirmLabel="حذف نهائيًا"
          danger
          onConfirm={() => handleDeleteUser(confirmAction.target)}
          onCancel={() => setConfirmAction(null)}
        />
      )}
      {confirmAction && confirmAction.type === "deletePost" && (
        <ConfirmModal
          title="حذف المنشور؟"
          text="سيتم حذف هذا المنشور نهائيًا."
          confirmLabel="حذف"
          danger
          onConfirm={() => handleDeletePost(confirmAction.target)}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
}

/* ============================================================
   شاشة إكمال التسجيل بعد الدخول بجوجل (اختيار اسم مستخدم)
   ============================================================ */
function GoogleSignupCompleteScreen({ session, onComplete, onCancel, notify }) {
  const googleEmail = session?.user?.email || "";
  const googleName = session?.user?.user_metadata?.full_name || session?.user?.user_metadata?.name || "";
  const suggested = (googleEmail.split("@")[0] || "user").toLowerCase().replace(/[^a-z0-9_]/g, "");

  const [username, setUsername] = useState(suggested);
  const [fullName, setFullName] = useState(googleName);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const normalize = (s) => s.trim().toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9_\u0600-\u06FF]/g, "");

  const finish = async () => {
    setError("");
    const clean = normalize(username);
    if (!clean || clean.length < 3) { setError("اسم المستخدم يجب أن يكون 3 أحرف على الأقل"); return; }
    setSaving(true);
    const taken = await isUsernameTaken(clean);
    if (taken) {
      setError("اسم المستخدم هذا محجوز، جرّب اسمًا آخر");
      setSaving(false);
      return;
    }
    const newUser = await createUserFromGoogle(session.user.id, googleEmail, clean, fullName.trim() || clean);
    setSaving(false);
    if (newUser) {
      notify("تم إنشاء حسابك بنجاح، مرحبًا بك في نِكسا 🎉");
      onComplete(newUser);
    } else {
      setError("تعذّر إنشاء الحساب، حاول مجددًا");
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-pattern" />
      <div className="auth-top">
        <div className="auth-brand-row">
          <NexaLogo size={42} />
          <span className="auth-brand-name">نِكسا</span>
        </div>
        <p className="auth-tagline">خطوة أخيرة لإكمال حسابك المرتبط بـ {googleEmail}</p>
      </div>

      <div className="auth-card">
        <div className="field-group">
          <label className="field-label">الاسم الكامل</label>
          <input className="field-input" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="مثال: سارة أحمد" />
        </div>
        <div className="field-group">
          <label className="field-label">اختر اسم مستخدم</label>
          <input
            className="field-input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="بدون مسافات، مثل: sara_ahmad"
            onKeyDown={(e) => e.key === "Enter" && finish()}
          />
        </div>
        {error && <div className="field-error"><AlertCircle size={14} /> {error}</div>}
        <button className="btn-primary" onClick={finish} disabled={saving} style={{ marginTop: 8 }}>
          {saving ? <Loader2 size={18} className="nx-spin" /> : "إكمال إنشاء الحساب"}
        </button>
        <button className="btn-ghost" onClick={onCancel} style={{ marginTop: 10 }}>
          إلغاء
        </button>
      </div>
    </div>
  );
}
