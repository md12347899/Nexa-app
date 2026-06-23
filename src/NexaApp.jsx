import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Home, Store, Briefcase, User, LogOut, Plus, Image as ImageIcon,
  Video, Megaphone, Heart, MessageCircle, Share2, Search, Settings,
  MapPin, Star, CheckCircle2, X, Edit3, Trash2, Send, ChevronLeft,
  ChevronRight, Coffee, HelpCircle, Eye, EyeOff, ShoppingBag, Sparkles,
  Clock, DollarSign, Tag, Filter, Bell, Camera, Link2, ArrowRight,
  Loader2, AlertCircle, Info, UserPlus, UserCheck, ShieldCheck, MoreVertical,
  Upload, Globe, Aperture as InstagramIcon, Play as YoutubeIcon, AtSign as TwitterIcon, Users as FacebookIcon, MessageSquare, Music2
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
    hasShop: r.has_shop || false, isVerified: r.is_verified || false, socialLinks: r.social_links || [],
    createdAt: r.created_at,
  };
}
function userToRow(u) {
  return {
    id: u.id, username: u.username, full_name: u.fullName, pass_hash: u.passHash,
    bio: u.bio || "", avatar: u.avatar || "", cover: u.cover || "", location: u.location || "",
    has_shop: u.hasShop || false, is_verified: u.isVerified || false, social_links: u.socialLinks || [],
    created_at: u.createdAt,
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
    createdAt: r.created_at,
  };
}
function postToRow(p) {
  return {
    id: p.id, author_id: p.authorId, type: p.type, text: p.text || "", media_url: p.mediaUrl || "",
    product_name: p.productName || "", price: p.price || "", likes: p.likes || [], comments: p.comments || [],
    created_at: p.createdAt,
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

// خاص بالمستخدم الحالي فقط (جهازه) — لتذكر تسجيل الدخول محليًا
const LOCAL_SESSION_KEY = "nexa_local_session_v1";


export default function NexaApp() {
  const [booting, setBooting] = useState(true);
  const [currentUser, setCurrentUser] = useState(null); // { id, username, ... }
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
          if (u) setCurrentUser(u);
        }
      } catch {}
      setBooting(false);
    })();
  }, []);

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
      .verified-icon { color: var(--gold-2); flex-shrink: 0; }
      .shop-card-cat { font-size: 11px; color: var(--ink-soft); display: block; margin-bottom: 7px; }
      .shop-card-stats { display: flex; gap: 10px; font-size: 11px; color: var(--ink-soft); }
      .shop-card-stats span { display: flex; align-items: center; gap: 3px; }

      /* ---- صفحة المتجر المميزة ---- */
      .shop-page { max-width: 640px; margin: 0 auto; padding-bottom: 30px; }
      .shop-hero { position: relative; min-height: 230px; background: linear-gradient(135deg, var(--teal-2), var(--teal)); display: flex; align-items: flex-end; padding: 20px 18px; background-size: cover; background-position: center; }
      .edit-shop-btn { position: absolute; top: 14px; left: 14px; background: rgba(255,255,255,0.92); border: none; border-radius: 10px; padding: 8px 13px; font-size: 12.5px; font-weight: 700; display: flex; align-items: center; gap: 6px; color: var(--teal); }
      .shop-hero-content { display: flex; align-items: flex-end; gap: 13px; width: 100%; }
      .shop-logo-wrap { border-radius: 14px; border: 3px solid #fff; box-shadow: var(--shadow); overflow: hidden; flex-shrink: 0; }
      .shop-hero-text { color: #fff; padding-bottom: 4px; }
      .shop-hero-name-row { display: flex; align-items: center; gap: 8px; }
      .shop-hero-name-row h1 { font-size: 21px; font-weight: 800; text-shadow: 0 2px 8px rgba(0,0,0,0.3); }
      .verified-pill { background: rgba(232,176,75,0.95); color: var(--teal); font-size: 10.5px; font-weight: 800; padding: 3px 9px; border-radius: 999px; display: flex; align-items: center; gap: 3px; }
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
        await dbSet(KEYS.users(id), newUser, true);
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

  const tabs = [
    { key: "feed", label: "الرئيسية", icon: Home },
    { key: "shops", label: "المتاجر", icon: Store },
    { key: "jobs", label: "الوظائف", icon: Briefcase },
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
            <button onClick={() => { goTo("support"); setMenuOpen(false); }}>
              <Coffee size={16} /> دعم نِكسا
            </button>
            <button onClick={() => { setShowHelp(true); setMenuOpen(false); }}>
              <HelpCircle size={16} /> كيف يعمل التطبيق؟
            </button>
            <button onClick={onLogout} className="menu-danger">
              <LogOut size={16} /> تسجيل الخروج
            </button>
          </div>
        )}
      </header>

      <main className="shell-main">
        {view === "feed" && <FeedView currentUser={currentUser} goTo={goTo} notify={notify} />}
        {view === "shops" && <ShopsDirectory currentUser={currentUser} goTo={goTo} notify={notify} />}
        {view === "shopPage" && <ShopPage shopOwnerId={viewParam} currentUser={currentUser} goTo={goTo} notify={notify} />}
        {view === "jobs" && <JobsView currentUser={currentUser} goTo={goTo} notify={notify} />}
        {view === "jobDetail" && <JobDetailView jobId={viewParam} currentUser={currentUser} goTo={goTo} notify={notify} />}
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
      </main>

      <nav className="bottom-nav">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = view === t.key || (t.key === "shops" && view === "shopPage") || (t.key === "jobs" && view === "jobDetail") || (t.key === "profile" && view === "userProfile");
          return (
            <button key={t.key} className={`nav-tab ${active ? "active" : ""}`} onClick={() => goTo(t.key)}>
              <Icon size={22} strokeWidth={active ? 2.4 : 1.8} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </nav>
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

  useEffect(() => { loadPosts(); }, []);

  const handleCreated = () => {
    setComposerOpen(false);
    loadPosts();
    notify("تم نشر منشورك");
  };

  return (
    <div className="feed-wrap">
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

      {posts === null && <FeedSkeleton />}
      {posts && posts.length === 0 && (
        <EmptyState icon={MessageCircle} title="لا توجد منشورات بعد" hint="كن أول من يشارك شيئًا في مجتمع نِكسا" />
      )}
      {posts && posts.map((p) => (
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
    if (liked) likes.delete(currentUser.id);
    else likes.add(currentUser.id);
    const updated = { ...post, likes: [...likes] };
    await dbSet(KEYS.post(post.id), updated, true);
    onChanged();
  };

  const addComment = async () => {
    if (!commentText.trim()) return;
    const comments = [...(post.comments || []), {
      id: uid("c"), authorId: currentUser.id, text: commentText.trim(), createdAt: Date.now(),
    }];
    await dbSet(KEYS.post(post.id), { ...post, comments }, true);
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

  return (
    <div className="post-card">
      <div className="post-head">
        <div className="post-head-clickable" onClick={() => goTo("userProfile", author?.id)}>
          <Avatar user={author} size={42} />
          <div className="post-head-meta">
            <span className="post-author">
              {author?.fullName || "مستخدم نِكسا"}
              {author?.isVerified && <CheckCircle2 size={13} className="verified-icon" style={{ marginRight: 4 }} />}
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
                {(s.verified || s.owner?.isVerified) && <CheckCircle2 size={14} className="verified-icon" />}
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
  const isOwner = currentUser.id === shopOwnerId;

  const load = useCallback(async () => {
    setLoading(true);
    const [s, u] = await Promise.all([dbGet(KEYS.shop(shopOwnerId), true), dbGet(KEYS.users(shopOwnerId), true)]);
    setShop(s);
    setOwner(u);
    setLoading(false);
  }, [shopOwnerId]);

  useEffect(() => { load(); }, [load]);

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
          <button className="edit-shop-btn" onClick={() => setEditOpen(true)}><Edit3 size={15} /> تعديل المتجر</button>
        )}
        <div className="shop-hero-content">
          <div className="shop-logo-wrap">
            <Avatar user={{ avatar: shop.logo || owner?.avatar, fullName: shop.name }} size={72} square />
          </div>
          <div className="shop-hero-text">
            <div className="shop-hero-name-row">
              <h1>{shop.name}</h1>
              {(shop.verified || owner?.isVerified) && <span className="verified-pill"><CheckCircle2 size={13} /> موثّق</span>}
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
            <div className="product-card" key={p.id} onClick={() => isOwner ? setProductModal(p) : setProductModal({ ...p, viewOnly: true })}>
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
    </div>
  );
}

function ProductModal({ product, isOwner, onClose, onSave, onDelete }) {
  const isNew = !product.id;
  const viewOnly = product.viewOnly;
  const [name, setName] = useState(product.name || "");
  const [price, setPrice] = useState(product.price || "");
  const [desc, setDesc] = useState(product.description || "");
  const [image, setImage] = useState(product.image || "");
  const [error, setError] = useState("");

  const save = () => {
    if (!name.trim()) { setError("اكتب اسم المنتج"); return; }
    onSave({
      id: product.id || uid("prod"),
      name: name.trim(),
      price: price.trim(),
      description: desc.trim(),
      image: image.trim(),
      createdAt: product.createdAt || Date.now(),
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-handle" />
        <div className="modal-head">
          <h3>{viewOnly ? "تفاصيل المنتج" : isNew ? "منتج جديد" : "تعديل المنتج"}</h3>
          <button className="icon-btn" onClick={onClose}><X size={20} /></button>
        </div>

        {viewOnly && image && <img src={image} alt="" className="composer-preview" style={{ marginBottom: 10 }} />}

        {viewOnly ? (
          <div>
            <h4 style={{ margin: "4px 0" }}>{name}</h4>
            {price && <div className="product-price" style={{ fontSize: 15, marginBottom: 8 }}>{price}</div>}
            <p style={{ color: "var(--ink-soft)", lineHeight: 1.7, fontSize: 14 }}>{desc || "لا يوجد وصف."}</p>
          </div>
        ) : (
          <>
            <div className="field-group">
              <label className="field-label">صورة المنتج</label>
              <MediaUploader value={image} onChange={setImage} folder="products" height={150} />
            </div>
            <div className="field-group">
              <label className="field-label">اسم المنتج أو الخدمة</label>
              <input className="field-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: تصميم شعار احترافي" />
            </div>
            <div className="field-group">
              <label className="field-label">السعر (اختياري)</label>
              <input className="field-input" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="مثال: 15$ أو يُحدد بعد التواصل" />
            </div>
            <div className="field-group">
              <label className="field-label">الوصف</label>
              <textarea className="field-input" rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="اشرح منتجك أو خدمتك بإيجاز" />
            </div>
            {error && <div className="field-error"><AlertCircle size={14} /> {error}</div>}
            <button className="btn-primary" onClick={save} style={{ marginTop: 8 }}>حفظ المنتج</button>
            {!isNew && (
              <button className="btn-ghost danger-ghost" style={{ marginTop: 10 }} onClick={() => onDelete(product.id)}>
                <Trash2 size={15} /> حذف المنتج
              </button>
            )}
          </>
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
          <button className="header-add-btn" onClick={() => setCom…
