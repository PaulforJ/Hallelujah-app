import { useState, useEffect, useRef } from "react";

// ============================================================
// CONFIGURATION — Replace these with your real keys
// ============================================================
const SUPABASE_URL = "YOUR_SUPABASE_URL";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";
// AI moderation runs through Claude API (handled server-side via Supabase Edge Function)
// See SETUP.md for full instructions
// ============================================================

const GOLD = "#C9A84C";
const DEEP = "#0D1B2A";
const CREAM = "#F5F0E8";
const WARM = "#8B6914";
const GREEN = "#4CAF7D";
const RED = "#E05555";

// ─── Supabase client (no npm needed — uses REST directly) ───
const sb = {
  headers: {
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json",
    "Prefer": "return=representation",
  },

  async signUp(email, password, username) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: "POST", headers: this.headers,
      body: JSON.stringify({ email, password, data: { username } }),
    });
    return r.json();
  },

  async signIn(email, password) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST", headers: this.headers,
      body: JSON.stringify({ email, password }),
    });
    return r.json();
  },

  async signOut(token) {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: "POST",
      headers: { ...this.headers, "Authorization": `Bearer ${token}` },
    });
  },

  async getPosts(token) {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/posts?status=eq.approved&order=created_at.desc&limit=30`,
      { headers: { ...this.headers, "Authorization": `Bearer ${token}` } }
    );
    return r.json();
  },

  async createPost(token, { caption, tag, user_id, username }) {
    // Posts start as "pending" — Edge Function moderates them
    const r = await fetch(`${SUPABASE_URL}/rest/v1/posts`, {
      method: "POST",
      headers: { ...this.headers, "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ caption, tag, user_id, username, status: "pending", likes: 0, comments: 0 }),
    });
    return r.json();
  },

  async toggleLike(token, postId, userId, currentlyLiked, currentCount) {
    if (!currentlyLiked) {
      await fetch(`${SUPABASE_URL}/rest/v1/likes`, {
        method: "POST",
        headers: { ...this.headers, "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ post_id: postId, user_id: userId }),
      });
      await fetch(`${SUPABASE_URL}/rest/v1/posts?id=eq.${postId}`, {
        method: "PATCH",
        headers: { ...this.headers, "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ likes: currentCount + 1 }),
      });
    } else {
      await fetch(`${SUPABASE_URL}/rest/v1/likes?post_id=eq.${postId}&user_id=eq.${userId}`, {
        method: "DELETE",
        headers: { ...this.headers, "Authorization": `Bearer ${token}` },
      });
      await fetch(`${SUPABASE_URL}/rest/v1/posts?id=eq.${postId}`, {
        method: "PATCH",
        headers: { ...this.headers, "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ likes: Math.max(0, currentCount - 1) }),
      });
    }
  },

  async getMyLikes(token, userId) {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/likes?user_id=eq.${userId}&select=post_id`,
      { headers: { ...this.headers, "Authorization": `Bearer ${token}` } }
    );
    const data = await r.json();
    return Array.isArray(data) ? data.map(d => d.post_id) : [];
  },

  async getMyPosts(token, userId) {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/posts?user_id=eq.${userId}&order=created_at.desc`,
      { headers: { ...this.headers, "Authorization": `Bearer ${token}` } }
    );
    return r.json();
  },
};

// ─── Demo mode (works without Supabase keys) ───
const DEMO_POSTS = [
  { id: 1, username: "Grace_Adaeze", caption: '"I can do all things through Christ who strengthens me." — Philippians 4:13 🙏', tag: "Scripture", likes: 142, comments: 18, status: "approved", created_at: new Date(Date.now() - 3600000).toISOString() },
  { id: 2, username: "Pastor_Emeka", caption: "Sunday sermon recap: Walking in faith even when the path isn't clear. God's plan is always perfect. Drop a 🙌 if this blessed you!", tag: "Sermon", likes: 89, comments: 12, status: "approved", created_at: new Date(Date.now() - 7200000).toISOString() },
  { id: 3, username: "Mercy_Okonkwo", caption: "Morning devotion: Start your day in His presence. His mercies are new every morning. 🌅", tag: "Devotion", likes: 211, comments: 31, status: "approved", created_at: new Date(Date.now() - 10800000).toISOString() },
  { id: 4, username: "FaithWalker_Tolu", caption: "God came through again when I least expected it. Never stop praying. Your breakthrough is near! 🔥", tag: "Testimony", likes: 503, comments: 77, status: "approved", created_at: new Date(Date.now() - 14400000).toISOString() },
];

const isDemo = SUPABASE_URL === "YOUR_SUPABASE_URL";

const TAG_COLORS = {
  Scripture: { bg: "#1A2E1A", text: "#6FCF6F" },
  Sermon: { bg: "#1A1A2E", text: "#7EA8F0" },
  Devotion: { bg: "#2E1A1A", text: "#F0A07E" },
  Testimony: { bg: "#2E2A1A", text: "#F0D07E" },
  Prayer: { bg: "#1A2A2E", text: "#7EDDF0" },
  Worship: { bg: "#2A1A2E", text: "#C07EF0" },
};

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function initials(name = "") {
  return name.slice(0, 2).toUpperCase() || "??";
}

const AVATAR_COLORS = ["#7B4F2E","#2E5E4E","#4A3060","#5E3A1A","#1A3A5E","#5E1A3A","#3A5E1A"];
function avatarColor(name = "") {
  let n = 0;
  for (let i = 0; i < name.length; i++) n += name.charCodeAt(i);
  return AVATAR_COLORS[n % AVATAR_COLORS.length];
}

// ─── Icons ───
const CrossIcon = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M12 3v18M5 8h14" stroke={GOLD} strokeWidth="2.5" strokeLinecap="round"/>
  </svg>
);
const Icon = ({ d, active, stroke, size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d={d} stroke={stroke || (active ? GOLD : "#666")} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// ─── Auth Screen ───
function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setError(""); setLoading(true);
    try {
      if (isDemo) {
        await new Promise(r => setTimeout(r, 800));
        onAuth({ id: "demo-user", email: "demo@hallelujah.app", user_metadata: { username: username || "DemoUser" } }, "demo-token");
        return;
      }
      if (mode === "signup") {
        const data = await sb.signUp(email, password, username);
        if (data.error) { setError(data.error.message); return; }
        setMode("login");
        setError("✅ Account created! Please check your email to verify, then log in.");
      } else {
        const data = await sb.signIn(email, password);
        if (data.error) { setError(data.error.message); return; }
        onAuth(data.user, data.access_token);
      }
    } catch (e) {
      setError("Connection error. Check your Supabase config.");
    } finally {
      setLoading(false);
    }
  };

  const field = (placeholder, value, onChange, type = "text") => (
    <div style={{ background:"#141E2C", border:"1px solid #1E2E42", borderRadius:12, padding:"12px 14px", marginBottom:10 }}>
      <input type={type} placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)}
        style={{ background:"none", border:"none", outline:"none", color:CREAM, fontSize:14, width:"100%", fontFamily:"Georgia, serif" }}/>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:DEEP, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"0 24px" }}>
      {/* Logo */}
      <div style={{ marginBottom:32, textAlign:"center" }}>
        <div style={{ display:"flex", justifyContent:"center", marginBottom:12 }}>
          <div style={{ width:72, height:72, borderRadius:24, background:`linear-gradient(135deg, ${GOLD}, ${WARM})`, display:"flex", alignItems:"center", justifyContent:"center", boxShadow:`0 8px 32px rgba(0,0,0,0.3)` }}>
            <CrossIcon size={32}/>
          </div>
        </div>
        <div style={{ fontSize:28, fontWeight:700, color:GOLD, fontFamily:"Georgia, serif", letterSpacing:"0.04em" }}>Hallelujah</div>
        <div style={{ color:"#667", fontSize:12, marginTop:4, fontFamily:"'Courier New', monospace", letterSpacing:"0.1em" }}>A COMMUNITY OF FAITH</div>
      </div>

      {/* Form */}
      <div style={{ width:"100%", maxWidth:360 }}>
        {isDemo && (
          <div style={{ background:"#1A2E1A", border:"1px solid #4CAF7D44", borderRadius:12, padding:"10px 14px", marginBottom:16, display:"flex", gap:8 }}>
            <span>🔧</span>
            <span style={{ color:"#6FCF6F", fontSize:11.5, fontFamily:"Georgia, serif" }}>Demo mode — running without Supabase. See SETUP.md to connect your backend.</span>
          </div>
        )}

        {mode === "signup" && field("Username", username, setUsername)}
        {field("Email address", email, setEmail, "email")}
        {field("Password", password, setPassword, "password")}

        {error && (
          <div style={{ background: error.startsWith("✅") ? "#1A2E1A" : "#2E1A1A", border:`1px solid ${error.startsWith("✅") ? "#4CAF7D" : RED}44`, borderRadius:10, padding:"10px 12px", marginBottom:14 }}>
            <span style={{ color: error.startsWith("✅") ? GREEN : "#F07E7E", fontSize:12, fontFamily:"Georgia, serif" }}>{error}</span>
          </div>
        )}

        <button onClick={handleSubmit} disabled={loading} style={{
          width:"100%", padding:14, background:`linear-gradient(135deg, ${GOLD}, ${WARM})`,
          color:DEEP, border:"none", borderRadius:14, fontSize:14, fontWeight:700,
          fontFamily:"Georgia, serif", cursor:"pointer", letterSpacing:"0.05em", marginBottom:14,
          opacity: loading ? 0.7 : 1,
        }}>
          {loading ? "Please wait..." : mode === "login" ? "Enter the Community" : "Join Hallelujah"}
        </button>

        <div style={{ textAlign:"center" }}>
          <span style={{ color:"#556", fontSize:12, fontFamily:"Georgia, serif" }}>
            {mode === "login" ? "New believer? " : "Already have an account? "}
          </span>
          <button onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }}
            style={{ background:"none", border:"none", color:GOLD, fontSize:12, cursor:"pointer", fontFamily:"Georgia, serif", textDecoration:"underline" }}>
            {mode === "login" ? "Create account" : "Sign in"}
          </button>
        </div>

        <div style={{ marginTop:20, textAlign:"center" }}>
          <p style={{ color:"#3A4A5A", fontSize:10.5, fontFamily:"Georgia, serif", fontStyle:"italic", lineHeight:1.5 }}>
            By joining, you agree to share only Christ-centered content.<br/>All posts are reviewed by our Faith Moderation team.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Post Card ───
function PostCard({ post, liked, onLike }) {
  const tag = TAG_COLORS[post.tag] || { bg:"#1A2535", text:"#88A" };
  const [likeAnim, setLikeAnim] = useState(false);

  const handleLike = () => {
    setLikeAnim(true);
    setTimeout(() => setLikeAnim(false), 300);
    onLike();
  };

  return (
    <div style={{ background:"linear-gradient(160deg,#141E2C,#0F1924)", border:"1px solid #1E2E42", borderRadius:20, padding:"18px 18px 14px", marginBottom:14, position:"relative", overflow:"hidden" }}>
      <div style={{ position:"absolute", top:0, left:0, right:0, height:2, background:`linear-gradient(90deg,transparent,${GOLD}44,transparent)` }}/>

      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
        <div style={{ width:40, height:40, borderRadius:"50%", background:avatarColor(post.username), display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:700, color:"#fff" }}>
          {initials(post.username)}
        </div>
        <div style={{ flex:1 }}>
          <div style={{ color:"#EEE", fontWeight:600, fontSize:14, fontFamily:"Georgia, serif" }}>@{post.username}</div>
          <div style={{ color:"#556", fontSize:11, marginTop:1 }}>{timeAgo(post.created_at)}</div>
        </div>
        <span style={{ background:tag.bg, color:tag.text, fontSize:10, fontWeight:600, padding:"3px 9px", borderRadius:20, fontFamily:"'Courier New', monospace", letterSpacing:"0.05em", border:`1px solid ${tag.text}33` }}>
          {post.tag}
        </span>
      </div>

      <p style={{ color:"#D4C9B8", fontSize:14.5, lineHeight:1.65, fontFamily:"Georgia, serif", margin:"0 0 14px", fontStyle:"italic" }}>{post.caption}</p>

      {post.status === "pending" && (
        <div style={{ background:"#2E2A1A", border:"1px solid #F0D07E44", borderRadius:8, padding:"6px 10px", marginBottom:10 }}>
          <span style={{ color:"#F0D07E", fontSize:11, fontFamily:"'Courier New', monospace" }}>⏳ Under moderation review</span>
        </div>
      )}
      {post.status === "flagged" && (
        <div style={{ background:"#2E1A1A", border:"1px solid #E0555544", borderRadius:8, padding:"6px 10px", marginBottom:10 }}>
          <span style={{ color:"#F07E7E", fontSize:11, fontFamily:"'Courier New', monospace" }}>🚫 Flagged — does not meet community guidelines</span>
        </div>
      )}

      <div style={{ display:"flex", gap:18, alignItems:"center" }}>
        <button onClick={handleLike} style={{ background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", gap:5, padding:0, transform: likeAnim ? "scale(1.3)" : "scale(1)", transition: "transform 0.3s" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill={liked ? "#E85D5D" : "none"}>
            <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z" stroke={liked ? "#E85D5D" : "#888"} strokeWidth="1.8" strokeLinejoin="round"/>
          </svg>
          <span style={{ color: liked ? "#E85D5D" : "#888", fontSize:12 }}>{post.likes}</span>
        </button>
        <button style={{ background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", gap:5, padding:0 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="#888" strokeWidth="1.8" strokeLinejoin="round"/></svg>
          <span style={{ color:"#888", fontSize:12 }}>{post.comments}</span>
        </button>
        <button style={{ background:"none", border:"none", cursor:"pointer", padding:0, marginLeft:"auto" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="18" cy="5" r="3" stroke="#888" strokeWidth="1.8"/><circle cx="6" cy="12" r="3" stroke="#888" strokeWidth="1.8"/><circle cx="18" cy="19" r="3" stroke="#888" strokeWidth="1.8"/></svg>
        </button>
      </div>
    </div>
  );
}

// ─── Feed ───
function FeedScreen({ posts, likedIds, onLike, loading }) {
  if (loading) return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", paddingTop:60, gap:12 }}>
      <CrossIcon size={32}/>
      <span style={{ color:"#556", fontSize:13, fontFamily:"Georgia, serif" }}>Loading community posts...</span>
    </div>
  );

  return (
    <div style={{ paddingBottom:20 }}>
      <div style={{ display:"flex", gap:12, overflowX:"auto", padding:"4px 0 16px", scrollbarWidth:"none" }}>
        {["You","Adaeze","Pastor E","Tolu","Mercy","Ruth","David"].map((name, i) => (
          <div key={i} style={{ flexShrink:0, display:"flex", flexDirection:"column", alignItems:"center", gap:5 }}>
            <div style={{ width:52, height:52, borderRadius:"50%", background: i===0 ? `linear-gradient(135deg,${GOLD},${WARM})` : "#1A2535", border: i===0 ? "none" : `2px solid ${GOLD}66`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontWeight:700, color:"#fff", cursor:"pointer" }}>
              {i===0 ? "+" : name.slice(0,2).toUpperCase()}
            </div>
            <span style={{ color:"#778", fontSize:10, maxWidth:52, textAlign:"center", overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis" }}>{name}</span>
          </div>
        ))}
      </div>
      {posts.length === 0 && (
        <div style={{ textAlign:"center", paddingTop:40 }}>
          <div style={{ fontSize:32, marginBottom:12 }}>✝️</div>
          <p style={{ color:"#556", fontFamily:"Georgia, serif", fontStyle:"italic" }}>No posts yet. Be the first to share!</p>
        </div>
      )}
      {posts.map(post => (
        <PostCard key={post.id} post={post} liked={likedIds.includes(post.id)} onLike={() => onLike(post)}/>
      ))}
    </div>
  );
}

// ─── Post (Create) ───
function PostScreen({ token, user, onPosted }) {
  const [text, setText] = useState("");
  const [tag, setTag] = useState("Scripture");
  const [stage, setStage] = useState("idle"); // idle | submitting | moderating | done | error
  const [moderationResult, setModerationResult] = useState(null);

  const tags = ["Scripture","Sermon","Devotion","Testimony","Prayer","Worship"];

  // AI moderation via Claude (runs in-browser using the Anthropic API)
  const moderateWithAI = async (caption) => {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": "YOUR_ANTHROPIC_API_KEY" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 200,
          system: `You are a content moderator for Hallelujah, a Christian social media platform. 
Your job: decide if a post is appropriate for a Christ-centered community.

APPROVED: Scripture quotes, prayers, testimonies, sermons, worship, devotions, faith encouragement, Christian events.
FLAGGED: Sexual content, violence, hate speech, profanity, political propaganda, non-Christian religious content meant to convert away from Christianity, or content with no Christian relevance.

Respond ONLY with valid JSON like: {"decision":"approved","reason":"Scripture quote with encouragement"} or {"decision":"flagged","reason":"Contains profanity"}`,
          messages: [{ role: "user", content: `Moderate this post: "${caption}"` }],
        }),
      });
      const data = await res.json();
      const text = data.content?.[0]?.text || '{"decision":"pending","reason":"Could not assess"}';
      const clean = text.replace(/```json|```/g, "").trim();
      return JSON.parse(clean);
    } catch {
      return { decision: "pending", reason: "Moderation service unavailable — sent for manual review" };
    }
  };

  const handlePost = async () => {
    if (!text.trim()) return;
    setStage("moderating");

    const result = await moderateWithAI(text);
    setModerationResult(result);

    if (result.decision === "flagged") {
      setStage("flagged");
      return;
    }

    setStage("submitting");
    const status = result.decision === "approved" ? "approved" : "pending";

    if (!isDemo) {
      await sb.createPost(token, {
        caption: text,
        tag,
        user_id: user.id,
        username: user.user_metadata?.username || user.email?.split("@")[0] || "User",
        status,
      });
    }

    setTimeout(() => {
      setStage("done");
      onPosted({
        id: Date.now(),
        username: user.user_metadata?.username || "You",
        caption: text,
        tag,
        likes: 0,
        comments: 0,
        status,
        created_at: new Date().toISOString(),
      });
      setTimeout(() => { setText(""); setStage("idle"); setModerationResult(null); }, 2000);
    }, 600);
  };

  return (
    <div>
      <div style={{ color:GOLD, fontSize:11, fontWeight:700, letterSpacing:"0.12em", marginBottom:16, fontFamily:"'Courier New', monospace" }}>SHARE YOUR FAITH</div>

      <div style={{ background:"#141E2C", border:"1px solid #1E2E42", borderRadius:18, padding:16, marginBottom:14 }}>
        <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Share a scripture, testimony, devotion or praise..." style={{ background:"none", border:"none", outline:"none", color:CREAM, fontSize:14, width:"100%", minHeight:100, fontFamily:"Georgia, serif", resize:"none" }}/>
      </div>

      <div style={{ marginBottom:18 }}>
        <div style={{ color:"#556", fontSize:11, marginBottom:8, fontFamily:"'Courier New', monospace", letterSpacing:"0.08em" }}>TAG YOUR CONTENT</div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:7 }}>
          {tags.map(t => {
            const s = TAG_COLORS[t];
            const active = tag === t;
            return <button key={t} onClick={() => setTag(t)} style={{ background: active ? s.text : s.bg, color: active ? DEEP : s.text, border:`1px solid ${s.text}66`, borderRadius:20, padding:"6px 12px", fontSize:11, fontWeight:600, cursor:"pointer" }}>
              {t}
            </button>
          })}
        </div>
      </div>

      {/* Moderation status messages */}
      {stage === "moderating" && (
        <div style={{ background:"#1A2535", border:`1px solid ${GOLD}44`, borderRadius:14, padding:"14px 16px", marginBottom:16, display:"flex", gap:10, alignItems:"center" }}>
          <span style={{ fontSize:20 }}>🤖</span>
          <div>
            <div style={{ color:GOLD, fontSize:13, fontFamily:"Georgia, serif", fontWeight:600 }}>AI Faith Review</div>
            <div style={{ color:"#778", fontSize:11, marginTop:2 }}>Checking your post against community guidelines...</div>
          </div>
        </div>
      )}

      {stage === "flagged" && moderationResult && (
        <div style={{ background:"#2E1A1A", border:`1px solid ${RED}66`, borderRadius:14, padding:"14px 16px", marginBottom:16 }}>
          <div style={{ color:RED, fontSize:13, fontFamily:"Georgia, serif", fontWeight:600, marginBottom:4 }}>🚫 Post Flagged</div>
          <div style={{ color:"#C09090", fontSize:12, fontFamily:"Georgia, serif" }}>{moderationResult.reason}</div>
          <button onClick={() => { setStage("idle"); setModerationResult(null); }} style={{ background:"none", border:`1px solid ${RED}44`, borderRadius:8, padding:"6px 12px", color:RED, fontSize:11, marginTop:8, cursor:"pointer" }}>
            Try Again
          </button>
        </div>
      )}

      {stage !== "flagged" && (
        <div style={{ background:"#0F161E", border:"1px solid #C9A84C33", borderRadius:14, padding:"12px 14px", marginBottom:18, display:"flex", gap:10 }}>
          <span style={{ fontSize:16 }}>✝️</span>
          <p style={{ color:"#8A7A5A", fontSize:11.5, lineHeight:1.5, margin:0, fontFamily:"Georgia, serif" }}>
            Every post is reviewed by our AI + human moderation team to keep this community Christ-centered.
          </p>
        </div>
      )}

      {stage !== "flagged" && (
        <button onClick={handlePost} disabled={!text.trim() || stage !== "idle"} style={{
          width:"100%", padding:14,
          background: stage === "done" ? "#2E5E2E" : `linear-gradient(135deg,${GOLD},${WARM})`,
          color: stage === "done" ? GREEN : DEEP,
          border:"none", borderRadius:14, fontSize:14, fontWeight:700,
          fontFamily:"Georgia, serif", cursor: text.trim() && stage==="idle" ? "pointer" : "not-allowed",
          opacity: text.trim() && stage==="idle" ? 1 : 0.6, transition:"all 0.3s", letterSpacing:"0.05em",
        }}>
          {stage === "done" ? "✓ Posted to Community" : stage === "submitting" ? "Publishing..." : stage === "moderating" ? "Reviewing..." : "Post to Community"}
        </button>
      )}
    </div>
  );
}

// ─── Profile ───
function ProfileScreen({ user, token, onSignOut }) {
  const [myPosts, setMyPosts] = useState([]);
  const username = user.user_metadata?.username || user.email?.split("@")[0] || "Believer";

  useEffect(() => {
    if (isDemo) { setMyPosts(DEMO_POSTS.slice(0, 2)); return; }
    sb.getMyPosts(token, user.id).then(data => Array.isArray(data) && setMyPosts(data));
  }, []);

  return (
    <div>
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", paddingTop:8, marginBottom:24 }}>
        <div style={{ width:80, height:80, borderRadius:"50%", background:`linear-gradient(135deg,${GOLD},${WARM})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:28, fontWeight:700, color:"#fff" }}>
          {initials(username)}
        </div>
        <div style={{ color:CREAM, fontSize:17, fontWeight:700, fontFamily:"Georgia, serif" }}>{username}</div>
        <div style={{ color:GOLD, fontSize:11, fontFamily:"'Courier New', monospace", marginTop:3, letterSpacing:"0.08em" }}>✝️ Verified Believer</div>
        {isDemo && <div style={{ color:"#556", fontSize:10, marginTop:4, fontFamily:"'Courier New', monospace" }}>DEMO MODE</div>}
      </div>

      <div style={{ display:"flex", gap:0, marginBottom:24, background:"#141E2C", border:"1px solid #1E2E42", borderRadius:16, overflow:"hidden" }}>
        {[{ label:"Posts", val: myPosts.length }, { label:"Followers", val:"—" }, { label:"Following", val:"—" }].map((s, i) => (
          <div key={i} style={{ flex:1, padding:"14px 8px", textAlign:"center", borderRight: i<2 ? "1px solid #1E2E42" : "none" }}>
            <div style={{ color:GOLD, fontSize:18, fontWeight:700, fontFamily:"Georgia, serif" }}>{s.val}</div>
            <div style={{ color:"#667", fontSize:11, marginTop:2, fontFamily:"'Courier New', monospace" }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ color:GOLD, fontSize:11, fontWeight:700, letterSpacing:"0.12em", marginBottom:12, fontFamily:"'Courier New', monospace" }}>MY POSTS</div>
      {myPosts.map(post => (
        <div key={post.id} style={{ background:"#141E2C", border:"1px solid #1E2E42", borderRadius:14, padding:"12px 14px", marginBottom:8 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
            <span style={{ background: TAG_COLORS[post.tag]?.bg || "#1A2535", color: TAG_COLORS[post.tag]?.text || "#88A", fontSize:10, padding:"2px 8px", borderRadius:20, fontFamily:"'Courier New', monospace" }}>
              {post.tag}
            </span>
            <span style={{ color: post.status==="approved" ? GREEN : post.status==="flagged" ? RED : "#F0D07E", fontSize:10, fontFamily:"'Courier New', monospace" }}>
              {post.status === "approved" ? "✓ Live" : post.status === "flagged" ? "🚫 Flagged" : "⏳ Pending"}
            </span>
          </div>
          <p style={{ color:"#C4B9A8", fontSize:13, fontFamily:"Georgia, serif", fontStyle:"italic", margin:0, lineHeight:1.5, display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden" }}>
            {post.caption}
          </p>
        </div>
      ))}

      <div style={{ marginTop:16 }}>
        <button onClick={onSignOut} style={{ width:"100%", background:"#2E1A1A", border:"1px solid #E0555544", borderRadius:14, padding:13, color:RED, fontSize:14, fontFamily:"Georgia, serif", cursor:"pointer", fontWeight:600 }}>
          Sign Out
        </button>
      </div>
    </div>
  );
}

// ─── Notifications ───
function NotificationsScreen() {
  const items = [
    { text:"Your post was approved ✓", time:"5m", icon:"✅" },
    { text:"Pastor_Emeka liked your testimony", time:"20m", icon:"❤️" },
    { text:"Grace_Adaeze started following you", time:"1h", icon:"✝️" },
    { text:"New community challenge: 30 Days of Prayer", time:"2h", icon:"🙏" },
    { text:"FaithWalker_Tolu commented on your devotion", time:"3h", icon:"💬" },
  ];
  return (
    <div>
      <div style={{ color:GOLD, fontSize:11, fontWeight:700, letterSpacing:"0.12em", marginBottom:16, fontFamily:"'Courier New', monospace" }}>NOTIFICATIONS</div>
      {items.map((n, i) => (
        <div key={i} style={{ background:"#141E2C", border:"1px solid #1E2E42", borderRadius:14, padding:"12px 14px", marginBottom:8, display:"flex", gap:12, alignItems:"center" }}>
          <span style={{ fontSize:18 }}>{n.icon}</span>
          <div style={{ flex:1 }}>
            <div style={{ color:CREAM, fontSize:13, fontFamily:"Georgia, serif" }}>{n.text}</div>
            <div style={{ color:"#556", fontSize:11, marginTop:2 }}>{n.time} ago</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Bottom Nav ───
function BottomNav({ tab, setTab }) {
  const navItems = [
    { id:"home", label:"Home", d:"M3 12L12 4l9 8v8a1 1 0 01-1 1H5a1 1 0 01-1-1v-8zM9 21V12h6v9" },
    { id:"explore", label:"Explore", d:"M11 11m-7 0a7 7 0 1014 0 7 7 0 00-14 0M16.5 16.5L21 21" },
    { id:"post", label:"", d:"" },
    { id:"notifications", label:"Alerts", d:"M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" },
    { id:"profile", label:"Me", d:"M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z" },
  ];

  return (
    <div style={{ position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)", width:"100%", maxWidth:430, background:`${DEEP}EE`, backdropFilter:"blur(12px)", borderTop:"1px solid #1E2E42", display:"flex", justifyContent:"space-around", paddingBottom:"env(safe-area-inset-bottom)" }}>
      {navItems.map(item => item.id === "post" ? (
        <div key="post" style={{ flex:1, display:"flex", justifyContent:"center" }}>
          <button onClick={() => setTab("post")} style={{ width:48, height:48, borderRadius:"50%", background:`linear-gradient(135deg,${GOLD},${WARM})`, border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:`0 4px 16px rgba(0,0,0,0.3)` }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke={DEEP} strokeWidth="2.5" strokeLinecap="round"/></svg>
          </button>
        </div>
      ) : (
        <button key={item.id} onClick={() => setTab(item.id)} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:3, background:"none", border:"none", cursor:"pointer", padding:"8px 0 12px" }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            {item.d.split("M").filter(Boolean).map((seg, i) => (
              <path key={i} d={"M"+seg} stroke={tab===item.id ? GOLD : "#666"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            ))}
          </svg>
          <span style={{ fontSize:9.5, color: tab===item.id ? GOLD : "#556", fontFamily:"'Courier New', monospace", letterSpacing:"0.05em" }}>{item.label}</span>
        </button>
      ))}
    </div>
  );
}

// ─── Main App ───
export default function App() {
  const [auth, setAuth] = useState(null); // { user, token }
  const [tab, setTab] = useState("home");
  const [posts, setPosts] = useState([]);
  const [likedIds, setLikedIds] = useState([]);
  const [feedLoading, setFeedLoading] = useState(false);

  const handleAuth = (user, token) => setAuth({ user, token });

  const handleSignOut = async () => {
    if (!isDemo) await sb.signOut(auth.token);
    setAuth(null); setPosts([]); setLikedIds([]);
  };

  // Load posts after login
  useEffect(() => {
    if (!auth) return;
    setFeedLoading(true);
    if (isDemo) {
      setTimeout(() => { setPosts(DEMO_POSTS); setFeedLoading(false); }, 600);
      return;
    }
    Promise.all([
      sb.getPosts(auth.token),
      sb.getMyLikes(auth.token, auth.user.id),
    ]).then(([postsData, likesData]) => {
      if (Array.isArray(postsData)) setPosts(postsData);
      if (Array.isArray(likesData)) setLikedIds(likesData);
    }).finally(() => setFeedLoading(false));
  }, [auth]);

  const handleLike = async (post) => {
    const alreadyLiked = likedIds.includes(post.id);
    setLikedIds(prev => alreadyLiked ? prev.filter(id => id !== post.id) : [...prev, post.id]);
    setPosts(prev => prev.map(p => p.id === post.id ? { ...p, likes: alreadyLiked ? p.likes - 1 : p.likes + 1 } : p));
    if (!isDemo) await sb.toggleLike(auth.token, post.id, auth.user.id, alreadyLiked, post.likes);
  };

  const handlePosted = (newPost) => {
    setPosts(prev => [newPost, ...prev]);
    setTab("home");
  };

  if (!auth) return <AuthScreen onAuth={handleAuth}/>;

  return (
    <div style={{ minHeight:"100vh", background:DEEP, color:CREAM, fontFamily:"Georgia, serif", maxWidth:430, margin:"0 auto", position:"relative", display:"flex", flexDirection:"column" }}>
      {/* Header */}
      <div style={{ padding:"16px 20px 12px", borderBottom:"1px solid #1E2E42", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, background:DEEP, zIndex:100 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <CrossIcon/>
          <span style={{ fontSize:20, fontWeight:700, color:GOLD, fontFamily:"Georgia, serif", letterSpacing:"0.02em" }}>Hallelujah</span>
        </div>
        <div style={{ display:"flex", gap:10, alignItems:"center" }}>
          {isDemo && <span style={{ color:"#556", fontSize:9, fontFamily:"'Courier New', monospace", background:"#1A2535", padding:"3px 7px", borderRadius:20 }}>DEMO</span>}
          <div style={{ width:8, height:8, borderRadius:"50%", background:GREEN, boxShadow:`0 0 6px ${GREEN}` }}/>
        </div>
      </div>

      {/* Screen */}
      <div style={{ flex:1, padding:"16px 16px 90px", overflowY:"auto" }}>
        {tab === "home" && <FeedScreen posts={posts} likedIds={likedIds} onLike={handleLike} loading={feedLoading}/>}
        {tab === "explore" && (
          <div>
            <div style={{ color:GOLD, fontSize:11, fontWeight:700, letterSpacing:"0.12em", marginBottom:16, fontFamily:"'Courier New', monospace" }}>EXPLORE</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:20 }}>
              {Object.entries(TAG_COLORS).map(([tag, s]) => (
                <button key={tag} style={{ background:s.bg, color:s.text, border:`1px solid ${s.text}44`, borderRadius:20, padding:"7px 14px", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"'Courier New', monospace" }}>
                  {tag}
                </button>
              ))}
            </div>
            {[{ title:"40 Days of Prayer", members:"2.3k" }, { title:"Psalms Daily Reading", members:"1.8k" }, { title:"Sunday Testimonies", members:"4.1k" }].map((c, i) => (
              <div key={i} style={{ background:"#141E2C", border:"1px solid #1E2E42", borderRadius:16, padding:"14px 16px", marginBottom:10, display:"flex", alignItems:"center", gap:12 }}>
                <div style={{ width:44, height:44, borderRadius:12, background:`linear-gradient(135deg,${GOLD}44,${WARM}33)`, display:"flex", alignItems:"center", justifyContent:"center" }}><CrossIcon size={24}/></div>
                <div style={{ flex:1 }}>
                  <div style={{ color:CREAM, fontSize:13, fontWeight:600, fontFamily:"Georgia, serif" }}>{c.title}</div>
                  <div style={{ color:"#667", fontSize:11, marginTop:2 }}>{c.members} joined</div>
                </div>
              </div>
            ))}
          </div>
        )}
        {tab === "post" && <PostScreen token={auth.token} user={auth.user} onPosted={handlePosted}/>}
        {tab === "notifications" && <NotificationsScreen/>}
        {tab === "profile" && <ProfileScreen user={auth.user} token={auth.token} onSignOut={handleSignOut}/>}
      </div>

      <BottomNav tab={tab} setTab={setTab}/>
    </div>
  );
}
