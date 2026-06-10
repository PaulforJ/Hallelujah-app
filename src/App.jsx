import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

// ─── CONFIG ──────────────────────────────────────────────────
const SUPABASE_URL = "https://vvmnltsqostfswdobern.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ2bW5sdHNxb3N0ZnN3ZG9iZXJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2MDQ5ODQsImV4cCI6MjA5NjE4MDk4NH0.DqKhf_RDJfWix6Rre7IFGEy9NJsbdgjkQ125lb9oS5c";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const ADMIN_EMAIL = "ikwuegbupaul426@gmail.com";

// ─── DESIGN TOKENS ───────────────────────────────────────────
const C = {
  bg:"#080C10", surface:"#0F1620", card:"#111A26", border:"#1C2A38",
  gold:"#D4A843", goldDim:"#8B6914", cream:"#EDE8DF", muted:"#4A5C6A",
  green:"#3DBA7A", red:"#E04F4F", amber:"#E8B84B", white:"#FFFFFF",
};

const fontLink = document.createElement("link");
fontLink.rel = "stylesheet";
fontLink.href = "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=DM+Sans:wght@300;400;500;600&display=swap";
document.head.appendChild(fontLink);
const placeholderStyle = document.createElement("style");
placeholderStyle.textContent = "textarea::placeholder, input::placeholder { color: #4A5C6A !important; }";
document.head.appendChild(placeholderStyle);

const TAGS = {
  Scripture:{ bg:"#0F2010", text:"#52C96A", border:"#52C96A22" },
  Sermon:   { bg:"#0E0F20", text:"#6B9CF0", border:"#6B9CF022" },
  Devotion: { bg:"#200F0F", text:"#E8906A", border:"#E8906A22" },
  Testimony:{ bg:"#1E1A08", text:"#E8C85A", border:"#E8C85A22" },
  Prayer:   { bg:"#081820", text:"#5AC8E8", border:"#5AC8E822" },
  Worship:  { bg:"#160820", text:"#A870E8", border:"#A870E822" },
};

// ─── SUPABASE HELPERS ────────────────────────────────────────
const sb = {
  async signUp(email, password, username) {
    const { data, error } = await supabase.auth.signUp({ email, password, options:{ data:{ username } } });
    if(error) return { error };
    return data;
  },
  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if(error) return { error };
    return { user: data.user, access_token: data.session.access_token };
  },
  async signOut() { await supabase.auth.signOut(); },
  async getPosts() {
    const { data } = await supabase.from("posts").select("*").eq("status","approved").order("created_at",{ascending:false}).limit(50);
    return data||[];
  },
  async getAllPosts() {
    const { data, error } = await supabase.from("posts").select("*").order("created_at",{ascending:false});
    if(error) console.error("getAllPosts error:", error.message);
    return data||[];
  },
  async updatePostStatus(id, status) {
    await supabase.from("posts").update({ status }).eq("id", id);
  },
  async createPost(d) {
    const { data } = await supabase.from("posts").insert(d).select();
    return data?.[0];
  },
  async uploadMedia(userId, file) {
    const ext = file.name.split(".").pop().toLowerCase();
    const path = `${userId}/${Date.now()}.${ext}`;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || SUPABASE_ANON_KEY;
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/post-images/${path}`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "apikey": SUPABASE_ANON_KEY,
        "Content-Type": file.type,
        "x-upsert": "true",
      },
      body: file,
    });
    if(!res.ok) {
      const err = await res.text();
      throw new Error(`Upload failed: ${err}`);
    }
    return `${SUPABASE_URL}/storage/v1/object/public/post-images/${path}`;
  },
  async toggleLike(postId, userId, liked, count) {
    if(!liked) { await supabase.from("likes").insert({ post_id:postId, user_id:userId }); }
    else { await supabase.from("likes").delete().eq("post_id",postId).eq("user_id",userId); }
    await supabase.from("posts").update({ likes: Math.max(0, liked ? count-1 : count+1) }).eq("id",postId);
  },
  async getMyLikes(uid) {
    const { data } = await supabase.from("likes").select("post_id").eq("user_id",uid);
    return Array.isArray(data) ? data.map(x=>x.post_id) : [];
  },
  async getComments(pid) {
    const { data } = await supabase.from("comments").select("*").eq("post_id",pid).order("created_at",{ascending:true});
    return data||[];
  },
  async deleteComment(commentId, postId) {
    await supabase.from("comments").delete().eq("id", commentId);
    const { data: post } = await supabase.from("posts").select("comments").eq("id", postId).single();
    await supabase.from("posts").update({ comments: Math.max(0, (post?.comments||1)-1) }).eq("id", postId);
  },
  async addComment(d) {
    const { data } = await supabase.from("comments").insert(d).select();
    // Update comment count on post
    const { data: post } = await supabase.from("posts").select("comments").eq("id", d.post_id).single();
    await supabase.from("posts").update({ comments: (post?.comments || 0) + 1 }).eq("id", d.post_id);
    return data?.[0];
  },
  async getMyPosts(uid) {
    const { data } = await supabase.from("posts").select("*").eq("user_id",uid).order("created_at",{ascending:false});
    return data||[];
  },
  async getConversations(uid) {
    const { data } = await supabase.from("messages")
      .select("*").or(`sender_id.eq.${uid},receiver_id.eq.${uid}`)
      .order("created_at",{ascending:false});
    if(!data) return [];
    const seen = new Set(); const convos = [];
    for(const m of data) {
      const other = m.sender_id === uid ? m.receiver_id : m.sender_id;
      const otherName = m.sender_id === uid ? m.receiver_username : m.sender_username;
      if(!seen.has(other)) { seen.add(other); convos.push({ userId:other, username:otherName, lastMsg:m.text, time:m.created_at }); }
    }
    return convos;
  },
  async getMessages(uid, otherId) {
    const { data } = await supabase.from("messages").select("*")
      .or(`and(sender_id.eq.${uid},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${uid})`)
      .order("created_at",{ascending:true});
    return data||[];
  },
  async sendMessage(d) {
    const { data } = await supabase.from("messages").insert(d).select();
    return data?.[0];
  },
  async getUsers() {
    const { data } = await supabase.from("profiles").select("*").order("username");
    return data||[];
  },
  async getFollowing(uid) {
    const { data } = await supabase.from("follows").select("following_id").eq("follower_id", uid);
    return (data||[]).map(x=>x.following_id);
  },
  async getFollowers(uid) {
    const { data } = await supabase.from("follows").select("follower_id").eq("following_id", uid);
    return (data||[]).length;
  },
  async toggleFollow(followerId, followingId, isFollowing) {
    if(isFollowing) {
      await supabase.from("follows").delete().eq("follower_id", followerId).eq("following_id", followingId);
    } else {
      await supabase.from("follows").insert({ follower_id: followerId, following_id: followingId });
    }
  },
  async getProfilesWithAvatars(uids) {
    if(!uids.length) return [];
    const { data } = await supabase.from("profiles").select("id,username,avatar_url").in("id", uids);
    return data||[];
  },
  async getProfile(uid) {
    if(!uid) return null;
    const { data } = await supabase.from("profiles").select("*").eq("id", uid).single();
    return data;
  },
  async deletePost(postId) {
    await supabase.from("likes").delete().eq("post_id", postId);
    await supabase.from("comments").delete().eq("post_id", postId);
    const { error } = await supabase.from("posts").delete().eq("id", postId);
    return !error;
  },
  async updateProfile(uid, updates) {
    // upsert in case row doesn't exist
    const { data, error } = await supabase.from("profiles").upsert({ id: uid, ...updates }, { onConflict: "id" }).select().single();
    if(error) console.error("Profile update error:", error.message);
    return { data, error };
  },
  async uploadAvatar(userId, file) {
    const ext = file.name.split(".").pop().toLowerCase();
    const path = `avatars/${userId}.${ext}`;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || SUPABASE_ANON_KEY;
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/post-images/${path}`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "apikey": SUPABASE_ANON_KEY,
        "Content-Type": file.type,
        "x-upsert": "true",
      },
      body: file,
    });
    if(!res.ok) return null;
    return `${SUPABASE_URL}/storage/v1/object/public/post-images/${path}`;
  },
};

// ─── HELPERS ─────────────────────────────────────────────────
const timeAgo = (iso) => { const d=Date.now()-new Date(iso).getTime(),m=Math.floor(d/60000); if(m<1)return"now"; if(m<60)return`${m}m`; const h=Math.floor(m/60); return h<24?`${h}h`:`${Math.floor(h/24)}d`; };
const initials = (n="") => n.slice(0,2).toUpperCase()||"??";
const ACLRS = ["#7B4F2E","#2E5E4E","#4A3060","#5E3A1A","#1A3A5E","#5E1A3A","#3A5E1A","#1A4A4A"];
const aColor = (n="") => { let x=0; for(let c of n) x+=c.charCodeAt(0); return ACLRS[x%ACLRS.length]; };

// ─── AI MODERATION ───────────────────────────────────────────
async function moderate(text) {
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        model:"claude-sonnet-4-20250514", max_tokens:150,
        system:`Content moderator for Hallelujah, a Christian-only social platform. APPROVED: scripture, prayer, testimony, sermon, worship, devotion, faith encouragement. FLAGGED: sexual content, violence, hate, profanity, spam, non-Christian proselytizing, zero faith relevance. Respond ONLY with JSON: {"decision":"approved"|"flagged"|"pending","reason":"..."}`,
        messages:[{role:"user",content:`Moderate: "${text}"`}],
      }),
    });
    const d = await r.json();
    return JSON.parse((d.content?.[0]?.text||"{}").replace(/```json|```/g,"").trim());
  } catch { return {decision:"pending",reason:"Manual review queued"}; }
}

// ─── SVG ICONS ───────────────────────────────────────────────
const Ic = ({children,size=24,style={}}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>{children}</svg>;
const CrossSvg = ({size=24,color=C.gold}) => <Ic size={size}><path d={`M12 3v18M5 8h14`} stroke={color} strokeWidth="2.2" strokeLinecap="round"/></Ic>;
const HeartSvg = ({filled,size=22}) => <Ic size={size}><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z" stroke={filled?"#FF4D6D":"#8899AA"} fill={filled?"#FF4D6D":"none"} strokeWidth="1.6" strokeLinejoin="round"/></Ic>;
const CommentSvg = ({size=22}) => <Ic size={size}><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="#8899AA" strokeWidth="1.6" strokeLinejoin="round"/></Ic>;
const ShareSvg = ({size=22}) => <Ic size={size}><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" stroke="#8899AA" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></Ic>;
const HomeSvg = ({on}) => <Ic size={26}><path d="M3 12L12 4l9 8v8a1 1 0 01-1 1H5a1 1 0 01-1-1v-8z" stroke={on?C.gold:"#4A5C6A"} fill={on?C.gold+"22":"none"} strokeWidth="1.8" strokeLinejoin="round"/><path d="M9 21V12h6v9" stroke={on?C.gold:"#4A5C6A"} strokeWidth="1.8" strokeLinejoin="round"/></Ic>;
const SearchSvg = ({on}) => <Ic size={26}><circle cx="11" cy="11" r="7" stroke={on?C.gold:"#4A5C6A"} strokeWidth="1.8"/><path d="M16.5 16.5L21 21" stroke={on?C.gold:"#4A5C6A"} strokeWidth="1.8" strokeLinecap="round"/></Ic>;
const BellSvg = ({on}) => <Ic size={26}><path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" stroke={on?C.gold:"#4A5C6A"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></Ic>;
const UserSvg = ({on}) => <Ic size={26}><circle cx="12" cy="8" r="4" stroke={on?C.gold:"#4A5C6A"} strokeWidth="1.8"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke={on?C.gold:"#4A5C6A"} strokeWidth="1.8" strokeLinecap="round"/></Ic>;
const ChatSvg = ({on}) => <Ic size={26}><path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" stroke={on?C.gold:"#4A5C6A"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></Ic>;
const ImgSvg = () => <Ic size={20}><rect x="3" y="3" width="18" height="18" rx="3" stroke={C.muted} strokeWidth="1.6"/><circle cx="8.5" cy="8.5" r="1.5" stroke={C.muted} strokeWidth="1.6"/><path d="M21 15l-5-5L5 21" stroke={C.muted} strokeWidth="1.6" strokeLinecap="round"/></Ic>;
const VidSvg = () => <Ic size={20}><rect x="2" y="4" width="15" height="16" rx="2" stroke={C.muted} strokeWidth="1.6"/><path d="M17 8.5l5-3v13l-5-3V8.5z" stroke={C.muted} strokeWidth="1.6" strokeLinejoin="round"/></Ic>;
const SendSvg = () => <Ic size={16}><path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" stroke={C.bg} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></Ic>;
const AdminSvg = ({on}) => <Ic size={26}><path d="M12 2l3 6.5L22 9l-5 5 1.5 7L12 18l-6.5 3L7 14 2 9l7-.5L12 2z" stroke={on?C.gold:"#4A5C6A"} fill={on?C.gold+"22":"none"} strokeWidth="1.8" strokeLinejoin="round"/></Ic>;

// ─── AVATAR ──────────────────────────────────────────────────
const Avatar = ({name, size=42, showRing=false}) => (
  <div style={{width:size,height:size,borderRadius:"50%",background:aColor(name),display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*0.33,fontWeight:700,color:"#fff",fontFamily:"'DM Sans',sans-serif",flexShrink:0,boxShadow:showRing?`0 0 0 2px ${C.bg}, 0 0 0 3.5px ${C.gold}`:"none"}}>
    {initials(name)}
  </div>
);

const TagPill = ({tag}) => {
  const s = TAGS[tag]||{bg:"#111",text:"#888",border:"#88822"};
  return <span style={{background:s.bg,color:s.text,border:`1px solid ${s.border}`,fontSize:10,fontWeight:600,padding:"3px 10px",borderRadius:20,fontFamily:"'DM Sans',sans-serif",letterSpacing:"0.04em"}}>{tag}</span>;
};

// ─── COMMENTS SHEET ──────────────────────────────────────────
function CommentsSheet({post, user, onClose, onAdded}) {
  const [comments, setComments] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const bottomRef = useRef();

  useEffect(() => { sb.getComments(post.id).then(d=>setComments(d)).finally(()=>setLoading(false)); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({behavior:"smooth"}); }, [comments]);

  const submit = async () => {
    if(!text.trim()||posting) return;
    setPosting(true);
    const username = user.user_metadata?.username || user.email?.split("@")[0] || "User";
    const c = { post_id:post.id, user_id:user.id, username, text:text.trim(), created_at:new Date().toISOString() };
    await sb.addComment(c);
    setComments(prev=>[...prev,{...c,id:Date.now()}]);
    onAdded(post.id); setText(""); setPosting(false);
  };

  return (
    <div style={{position:"fixed",inset:0,zIndex:200,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}>
      <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.7)",backdropFilter:"blur(4px)"}} onClick={onClose}/>
      <div style={{position:"relative",background:C.surface,borderRadius:"20px 20px 0 0",maxHeight:"72vh",display:"flex",flexDirection:"column",border:`1px solid ${C.border}`}}>
        <div style={{display:"flex",justifyContent:"center",padding:"10px 0 0"}}><div style={{width:36,height:4,borderRadius:2,background:C.border}}/></div>
        <div style={{padding:"12px 20px 10px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{color:C.cream,fontSize:14,fontWeight:600,fontFamily:"'DM Sans',sans-serif"}}>{comments.length} comments</span>
          <button onClick={onClose} style={{background:"none",border:"none",color:C.muted,fontSize:22,cursor:"pointer"}}>×</button>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"12px 16px"}}>
          {loading ? <div style={{display:"flex",justifyContent:"center",padding:30}}><div style={{width:24,height:24,border:`2px solid ${C.gold}33`,borderTop:`2px solid ${C.gold}`,borderRadius:"50%",animation:"spin .7s linear infinite"}}/></div>
          : comments.length===0 ? <p style={{textAlign:"center",color:C.muted,fontFamily:"'DM Sans',sans-serif",fontSize:13,padding:"24px 0"}}>No comments yet. Start the conversation!</p>
          : comments.map(c=>(
            <div key={c.id} style={{display:"flex",gap:10,marginBottom:16}}>
              <Avatar name={c.username} size={32}/>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <div>
                    <span style={{color:C.gold,fontSize:11,fontWeight:600,fontFamily:"'DM Sans',sans-serif",marginRight:8}}>@{c.username}</span>
                    <span style={{color:C.muted,fontSize:10}}>{timeAgo(c.created_at)}</span>
                  </div>
                  {c.user_id===user.id && (
                    <button onClick={async()=>{
                      await sb.deleteComment(c.id, post.id);
                      setComments(prev=>prev.filter(x=>x.id!==c.id));
                    }} style={{background:"none",border:"none",color:C.muted,fontSize:11,cursor:"pointer",padding:"2px 6px",fontFamily:"'DM Sans',sans-serif"}}>🗑</button>
                  )}
                </div>
                <p style={{color:C.cream,fontSize:13.5,fontFamily:"'DM Sans',sans-serif",lineHeight:1.5,margin:"3px 0 0"}}>{c.text}</p>
              </div>
            </div>
          ))}
          <div ref={bottomRef}/>
        </div>
        <div style={{padding:"10px 14px",borderTop:`1px solid ${C.border}`,display:"flex",gap:10,alignItems:"center",background:C.surface}}>
          <Avatar name={user.user_metadata?.username||"You"} size={32}/>
          <div style={{flex:1,background:C.card,borderRadius:24,border:`1px solid ${C.border}`,display:"flex",alignItems:"center",padding:"9px 14px",gap:8}}>
            <input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} placeholder="Add a comment..." style={{background:"none",border:"none",outline:"none",color:C.cream,fontSize:13,flex:1,fontFamily:"'DM Sans',sans-serif"}}/>
            <button onClick={submit} disabled={!text.trim()||posting} style={{background:text.trim()?`linear-gradient(135deg,${C.gold},${C.goldDim})`:"#1A2530",border:"none",borderRadius:"50%",width:30,height:30,cursor:text.trim()?"pointer":"default",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <SendSvg/>
            </button>
          </div>
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ─── POST CARD ───────────────────────────────────────────────
function PostCard({post, liked, onLike, user, onCommentAdded, authorAvatar, onViewProfile}) {
  const [showComments, setShowComments] = useState(false);
  const [commentCount, setCommentCount] = useState(post.comments||0);
  const [heartBurst, setHeartBurst] = useState(false);
  const lastTap = useRef(0);

  const handleLike = () => { setHeartBurst(true); setTimeout(()=>setHeartBurst(false),400); onLike(); };
  const handleDoubleTap = () => { const now=Date.now(); if(now-lastTap.current<300){if(!liked)handleLike();} lastTap.current=now; };
  const handleCommentAdded = (pid) => { setCommentCount(c=>c+1); onCommentAdded?.(pid); };

  return (
    <>
      <div onClick={handleDoubleTap} style={{background:C.bg,borderBottom:`1px solid ${C.border}44`,marginBottom:0,overflow:"hidden",position:"relative",userSelect:"none"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,padding:"14px 14px 10px"}}>
          {authorAvatar
          ? <img src={authorAvatar} alt="" style={{width:40,height:40,borderRadius:"50%",objectFit:"cover",border:`2px solid ${C.gold}55`,flexShrink:0}}/>
          : <Avatar name={post.username} size={40} showRing/>}
          <div style={{flex:1}}>
            <div style={{display:"flex",alignItems:"center",gap:5}}>
              <span style={{color:C.white,fontWeight:700,fontSize:14,fontFamily:"'DM Sans',sans-serif"}}>@{post.username}</span>
              <span style={{fontSize:11}}>✝️</span>
            </div>
            <div style={{color:C.muted,fontSize:11,fontFamily:"'DM Sans',sans-serif",marginTop:1}}>{timeAgo(post.created_at)}</div>
          </div>
          <TagPill tag={post.tag}/>
        </div>
        <p style={{color:C.cream,fontSize:14.5,lineHeight:1.7,fontFamily:"'DM Sans',sans-serif",padding:"0 14px 12px",margin:0}}>{post.caption}</p>
        {post.image_url && (
          <div style={{width:"100%",background:"#050A10"}}>
            {post.media_type==="video"
              ? <video src={post.image_url} controls playsInline style={{width:"100%",maxHeight:480,display:"block",background:"#000"}}/>
              : <img src={post.image_url} alt="" style={{width:"100%",maxHeight:400,objectFit:"cover",display:"block"}} onError={e=>e.target.style.display="none"}/>}
          </div>
        )}
        {heartBurst && <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"none"}}><div style={{fontSize:72,animation:"heartPop .4s ease-out forwards"}}>❤️</div></div>}
        <div style={{display:"flex",alignItems:"center",gap:4,padding:"10px 10px 14px"}}>
          <button onClick={e=>{e.stopPropagation();handleLike();}} style={{background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:5,padding:"6px 8px",borderRadius:10}}>
            <HeartSvg filled={liked} size={22}/>
            <span style={{color:liked?"#FF4D6D":C.muted,fontSize:13,fontFamily:"'DM Sans',sans-serif",fontWeight:500}}>{post.likes||0}</span>
          </button>
          <button onClick={e=>{e.stopPropagation();setShowComments(true);}} style={{background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:5,padding:"6px 8px",borderRadius:10}}>
            <CommentSvg size={22}/>
            <span style={{color:C.muted,fontSize:13,fontFamily:"'DM Sans',sans-serif",fontWeight:500}}>{commentCount}</span>
          </button>
          <button onClick={e=>e.stopPropagation()} style={{background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:5,padding:"6px 8px",borderRadius:10,marginLeft:"auto"}}>
            <ShareSvg size={22}/>
          </button>
        </div>
      </div>
      {showComments && <CommentsSheet post={post} user={user} onClose={()=>setShowComments(false)} onAdded={handleCommentAdded}/>}
      <style>{`@keyframes heartPop{0%{transform:scale(0);opacity:1}60%{transform:scale(1.2);opacity:1}100%{transform:scale(1);opacity:0}} @keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </>
  );
}

// ─── STORIES ROW ─────────────────────────────────────────────
function StoriesRow({username, avatarMap, userId}) {
  const [realUsers, setRealUsers] = useState([]);
  useEffect(()=>{ sb.getUsers().then(d=>setRealUsers(d.filter(u=>u.id!==userId).slice(0,8))); },[]);
  return (
    <div style={{display:"flex",gap:16,overflowX:"auto",padding:"14px 16px 12px",scrollbarWidth:"none",msOverflowStyle:"none",borderBottom:`1px solid ${C.border}55`}}>
      {/* Your story */}
      <div style={{flexShrink:0,display:"flex",flexDirection:"column",alignItems:"center",gap:5}}>
        <div style={{width:56,height:56,borderRadius:"50%",background:`linear-gradient(135deg,${C.gold},${C.goldDim})`,display:"flex",alignItems:"center",justifyContent:"center",border:`2px dashed ${C.gold}88`,position:"relative"}}>
          {avatarMap?.[userId] ? <img src={avatarMap[userId]} alt="" style={{width:56,height:56,borderRadius:"50%",objectFit:"cover",display:"block"}}/> : <Avatar name={username} size={52}/>}
          <div style={{position:"absolute",bottom:0,right:0,width:18,height:18,borderRadius:"50%",background:C.gold,display:"flex",alignItems:"center",justifyContent:"center",border:`2px solid ${C.bg}`,fontSize:11,fontWeight:700,color:C.bg}}>+</div>
        </div>
        <span style={{color:C.muted,fontSize:10,fontFamily:"'DM Sans',sans-serif",maxWidth:56,textAlign:"center",overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>Your Story</span>
      </div>
      {/* Real users */}
      {realUsers.map((u,i)=>(
        <div key={i} style={{flexShrink:0,display:"flex",flexDirection:"column",alignItems:"center",gap:5}}>
          <div style={{padding:2,borderRadius:"50%",background:`linear-gradient(135deg,${C.gold},#E06B2E)`}}>
            <div style={{padding:2,borderRadius:"50%",background:C.bg}}>
              {u.avatar_url
                ? <img src={u.avatar_url} alt="" style={{width:52,height:52,borderRadius:"50%",objectFit:"cover",display:"block"}} onError={e=>{e.target.style.display="none";}}/>
                : <Avatar name={u.username} size={52}/>}
            </div>
          </div>
          <span style={{color:C.muted,fontSize:10,fontFamily:"'DM Sans',sans-serif",maxWidth:56,textAlign:"center",overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{u.username}</span>
        </div>
      ))}
    </div>
  );
}

// ─── FEED SCREEN ─────────────────────────────────────────────
function FeedScreen({posts, likedIds, onLike, user, loading, onCommentAdded, avatarMap}) {
  const username = user.user_metadata?.username || user.email?.split("@")[0] || "You";
  const [viewProfile, setViewProfile] = useState(null);
  if(viewProfile) return <UserProfileScreen userId={viewProfile.id} username={viewProfile.username} onBack={()=>setViewProfile(null)} currentUser={user}/>;
  if(loading) return <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"60vh",gap:16}}><CrossSvg size={36}/><span style={{color:C.muted,fontSize:13,fontFamily:"'DM Sans',sans-serif"}}>Loading your feed...</span></div>;
  return (
    <div>
      <StoriesRow username={username} avatarMap={avatarMap} userId={user.id}/>
      <div style={{padding:"4px 0"}}>
        {posts.length===0
          ? <div style={{textAlign:"center",padding:"60px 24px"}}><div style={{fontSize:40,marginBottom:12}}>✝️</div><p style={{color:C.muted,fontFamily:"'DM Sans',sans-serif",fontSize:14}}>No posts yet. Be the first to share your faith!</p></div>
          : posts.map(p=><PostCard key={p.id} post={p} liked={likedIds.includes(p.id)} onLike={()=>onLike(p)} user={user} onCommentAdded={onCommentAdded} authorAvatar={avatarMap?.[p.user_id]} onViewProfile={setViewProfile}/>)}
      </div>
    </div>
  );
}


// ─── USER PROFILE SCREEN ─────────────────────────────────────
function UserProfileScreen({userId, username, onBack, currentUser}) {
  const [posts, setPosts] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);

  useEffect(()=>{
    if(!userId){ setLoading(false); return; }
    Promise.all([
      sb.getProfile(userId).catch(()=>null),
      sb.getMyPosts(userId).catch(()=>[]),
    ]).then(([prof, p])=>{
      setProfile(prof||{username, id:userId});
      setPosts((p||[]).filter(x=>x.status==="approved"));
    }).finally(()=>setLoading(false));
    if(currentUser){
      sb.getFollowing(currentUser.id).then(ids=>setFollowing(ids.includes(userId)));
      sb.getFollowers(userId).then(c=>setFollowerCount(c));
    }
  },[userId]);

  const handleFollow = async () => {
    if(!currentUser) return;
    await sb.toggleFollow(currentUser.id, userId, following);
    setFollowing(!following);
    setFollowerCount(c=>following?c-1:c+1);
  };

  const name = profile?.username || username || "Believer";

  if(loading) return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{width:30,height:30,border:`2px solid ${C.gold}33`,borderTop:`2px solid ${C.gold}`,borderRadius:"50%",animation:"spin .7s linear infinite"}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{minHeight:"100vh",background:C.bg,paddingBottom:80}}>
      <div style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",borderBottom:`1px solid ${C.border}44`,position:"sticky",top:0,background:`${C.bg}EE`,backdropFilter:"blur(12px)",zIndex:10}}>
        <button onClick={onBack} style={{background:"none",border:"none",color:C.gold,fontSize:22,cursor:"pointer",padding:"0 4px"}}>\u2190</button>
        <span style={{color:C.white,fontWeight:600,fontSize:16,fontFamily:"'DM Sans',sans-serif"}}>@{name}</span>
      </div>
      <div style={{height:120,background:`linear-gradient(160deg,${C.gold}33,${C.goldDim}22,${C.bg})`,position:"relative",marginBottom:52}}>
        <div style={{position:"absolute",bottom:-44,left:"50%",transform:"translateX(-50%)"}}>
          {profile?.avatar_url
            ? <img src={profile.avatar_url} alt="" style={{width:88,height:88,borderRadius:"50%",objectFit:"cover",border:`3px solid ${C.bg}`,boxShadow:`0 0 0 3px ${C.gold}55`}}/>
            : <div style={{width:88,height:88,borderRadius:"50%",background:`linear-gradient(135deg,${C.gold},${C.goldDim})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:30,fontWeight:700,color:C.bg,border:`3px solid ${C.bg}`,boxShadow:`0 0 0 3px ${C.gold}55`,fontFamily:"'Playfair Display',serif"}}>{initials(name)}</div>}
        </div>
      </div>
      <div style={{textAlign:"center",padding:"0 20px 16px"}}>
        <div style={{color:C.white,fontSize:18,fontWeight:700,fontFamily:"'Playfair Display',serif"}}>@{name}</div>
        {profile?.bio && <div style={{color:C.muted,fontSize:13,fontFamily:"'DM Sans',sans-serif",marginTop:4,lineHeight:1.5}}>{profile.bio}</div>}
      </div>
      <div style={{display:"flex",margin:"0 14px 14px",background:C.card,border:`1px solid ${C.border}`,borderRadius:16,overflow:"hidden"}}>
        {[{l:"Posts",v:posts.length},{l:"Followers",v:followerCount},{l:"Following",v:"\u2014"}].map((s,i)=>(
          <div key={i} style={{flex:1,padding:"14px 8px",textAlign:"center",borderRight:i<2?`1px solid ${C.border}`:"none"}}>
            <div style={{color:C.gold,fontSize:20,fontWeight:700,fontFamily:"'Playfair Display',serif"}}>{s.v}</div>
            <div style={{color:C.muted,fontSize:10,fontFamily:"'DM Sans',sans-serif",marginTop:2,letterSpacing:"0.06em"}}>{s.l.toUpperCase()}</div>
          </div>
        ))}
      </div>
      {currentUser && currentUser.id !== userId && (
        <div style={{padding:"0 14px 16px"}}>
          <button onClick={handleFollow} style={{width:"100%",padding:"12px",background:following?C.card:`linear-gradient(135deg,${C.gold},${C.goldDim})`,border:following?`1px solid ${C.border}`:"none",borderRadius:14,color:following?C.muted:C.bg,fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>
            {following?"\u2713 Following":"+ Follow"}
          </button>
        </div>
      )}
      <div style={{padding:"0 14px"}}>
        <p style={{color:C.muted,fontSize:11,fontWeight:600,letterSpacing:"0.1em",fontFamily:"'DM Sans',sans-serif",marginBottom:10}}>POSTS</p>
        {posts.length===0
          ? <p style={{color:C.muted,textAlign:"center",fontFamily:"'DM Sans',sans-serif",fontSize:13,padding:"30px 0"}}>No posts yet</p>
          : posts.map(p=>(
            <div key={p.id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,marginBottom:10,overflow:"hidden"}}>
              {p.image_url && (p.media_type==="video"
                ? <video src={p.image_url} controls playsInline style={{width:"100%",maxHeight:300,display:"block"}}/>
                : <img src={p.image_url} alt="" style={{width:"100%",maxHeight:300,objectFit:"cover",display:"block"}} onError={e=>e.target.style.display="none"}/>)}
              <div style={{padding:"10px 14px"}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <TagPill tag={p.tag}/>
                  <span style={{color:C.muted,fontSize:10,fontFamily:"'DM Sans',sans-serif"}}>{timeAgo(p.created_at)}</span>
                </div>
                {p.caption && <p style={{color:C.cream,fontSize:13,fontFamily:"'DM Sans',sans-serif",lineHeight:1.5,margin:"6px 0 0"}}>{p.caption}</p>}
                <div style={{display:"flex",gap:12,marginTop:8}}>
                  <span style={{color:C.muted,fontSize:11}}>{String.fromCodePoint(0x2764)} {p.likes||0}</span>
                  <span style={{color:C.muted,fontSize:11}}>{String.fromCodePoint(0x1F4AC)} {p.comments||0}</span>
                </div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

// ─── EXPLORE SCREEN ──────────────────────────────────────────
function ExploreScreen({currentUser}) {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState([]);
  const [searching, setSearching] = useState(false);
  const [viewProfile, setViewProfile] = useState(null);

  useEffect(() => {
    if(!query.trim()) { setUsers([]); return; }
    setSearching(true);
    const timer = setTimeout(async () => {
      const { data } = await supabase.from("profiles").select("*").ilike("username", `%${query}%`).limit(10);
      setUsers(data || []);
      setSearching(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  if(viewProfile) return <UserProfileScreen userId={viewProfile.id} username={viewProfile.username} onBack={()=>setViewProfile(null)} currentUser={currentUser}/>;

  const trends = [
    {title:"40 Days of Prayer",members:"2.3k",tag:"Prayer",emoji:"🙏"},
    {title:"Book of Psalms",members:"1.8k",tag:"Scripture",emoji:"📖"},
    {title:"Sunday Testimonies",members:"4.1k",tag:"Testimony",emoji:"🔥"},
    {title:"Morning Devotions",members:"987",tag:"Devotion",emoji:"🌅"},
    {title:"Worship Night",members:"1.2k",tag:"Worship",emoji:"🎵"},
  ];
  return (
    <div style={{padding:"16px 14px"}}>
      <div style={{background:C.card,borderRadius:14,border:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:10,padding:"12px 16px",marginBottom:12}}>
        <SearchSvg on/>
        <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search people..." style={{background:"none",border:"none",outline:"none",color:C.cream,fontSize:14,flex:1,fontFamily:"'DM Sans',sans-serif"}}/>
        {query && <button onClick={()=>setQuery("")} style={{background:"none",border:"none",color:C.muted,fontSize:18,cursor:"pointer"}}>×</button>}
      </div>
      {query.trim() && (
        <div style={{marginBottom:16}}>
          {searching && <p style={{color:C.muted,fontSize:13,fontFamily:"'DM Sans',sans-serif",textAlign:"center",padding:"12px 0"}}>Searching...</p>}
          {!searching && users.length===0 && <p style={{color:C.muted,fontSize:13,fontFamily:"'DM Sans',sans-serif",textAlign:"center",padding:"12px 0"}}>No users found for "{query}"</p>}
          {users.map((u,i)=>(
            <div key={i} onClick={()=>setViewProfile(u)} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",background:C.card,border:`1px solid ${C.border}`,borderRadius:14,marginBottom:8,cursor:"pointer"}}>
              {u.avatar_url
                ? <img src={u.avatar_url} alt="" style={{width:44,height:44,borderRadius:"50%",objectFit:"cover",border:`2px solid ${C.gold}55`}}/>
                : <Avatar name={u.username} size={44} showRing/>}
              <div style={{flex:1}}>
                <div style={{color:C.white,fontWeight:600,fontSize:14,fontFamily:"'DM Sans',sans-serif"}}>@{u.username}</div>
                <div style={{color:C.muted,fontSize:11,fontFamily:"'DM Sans',sans-serif",marginTop:2}}>{u.bio||"✝️ Verified Believer"}</div>
              </div>
              <span style={{color:C.gold,fontSize:12,fontFamily:"'DM Sans',sans-serif"}}>›</span>
            </div>
          ))}
        </div>
      )}
      <div style={{marginBottom:22}}>
        <p style={{color:C.muted,fontSize:11,fontFamily:"'DM Sans',sans-serif",fontWeight:600,letterSpacing:"0.1em",marginBottom:10}}>BROWSE BY TOPIC</p>
        <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
          {Object.entries(TAGS).map(([tag,s])=>(
            <button key={tag} style={{background:s.bg,color:s.text,border:`1px solid ${s.border}`,borderRadius:22,padding:"8px 16px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>{tag}</button>
          ))}
        </div>
      </div>
      <p style={{color:C.muted,fontSize:11,fontFamily:"'DM Sans',sans-serif",fontWeight:600,letterSpacing:"0.1em",marginBottom:12}}>TRENDING IN THE COMMUNITY</p>
      {trends.map((t,i)=>(
        <div key={i} style={{display:"flex",alignItems:"center",gap:14,padding:"14px 16px",background:C.card,border:`1px solid ${C.border}`,borderRadius:16,marginBottom:10,cursor:"pointer"}}>
          <div style={{width:46,height:46,borderRadius:14,background:`linear-gradient(135deg,${C.gold}33,${C.goldDim}22)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>{t.emoji}</div>
          <div style={{flex:1}}>
            <div style={{color:C.white,fontSize:14,fontWeight:600,fontFamily:"'DM Sans',sans-serif"}}>{t.title}</div>
            <div style={{color:C.muted,fontSize:11,fontFamily:"'DM Sans',sans-serif",marginTop:2}}>{t.members} members joined</div>
          </div>
          <TagPill tag={t.tag}/>
        </div>
      ))}
    </div>
  );
}

// ─── CREATE POST SCREEN ──────────────────────────────────────
function CreateScreen({user, onPosted}) {
  const [text, setText] = useState("");
  const [tag, setTag] = useState("Scripture");
  const [media, setMedia] = useState(null);
  const [preview, setPreview] = useState(null);
  const [mediaType, setMediaType] = useState("image"); // image | video
  const [stage, setStage] = useState("idle");
  const [flagReason, setFlagReason] = useState("");
  const fileRef = useRef();
  const username = user.user_metadata?.username || user.email?.split("@")[0] || "User";

  const pickMedia = (e) => {
    const f = e.target.files[0]; if(!f) return;
    const isVideo = f.type.startsWith("video/");
    setMedia(f); setMediaType(isVideo?"video":"image");
    if(isVideo){ setPreview(URL.createObjectURL(f)); }
    else { const reader = new FileReader(); reader.onload = ev=>setPreview(ev.target.result); reader.readAsDataURL(f); }
  };

  const post = async () => {
    if(!text.trim() && !media) { alert("Please write something or add a photo/video."); return; }
    try {
      setStage("checking");
      let mod = { decision: "pending" };
      if(text.trim()) {
        try { mod = await moderate(text); } catch(e) { mod = { decision: "pending" }; }
      }
      if(mod.decision==="flagged"){ setFlagReason(mod.reason||"Content does not meet community guidelines."); setStage("flagged"); return; }
      setStage("uploading");
      let image_url = null;
      if(media) {
        image_url = await sb.uploadMedia(user.id, media);
        if(!image_url) { setFlagReason("Upload failed. Please try again."); setStage("flagged"); return; }
      }
      setStage("posting");
      const status = mod.decision==="approved"?"approved":"pending";
      const newPost = { caption:text||"", tag, user_id:user.id, username, status, likes:0, comments:0, image_url, media_type:media?mediaType:null, created_at:new Date().toISOString() };
      const created = await sb.createPost(newPost);
      setStage("done");
      onPosted({...newPost, id:created?.id||Date.now()});
      setTimeout(()=>{ setText(""); setMedia(null); setPreview(null); setStage("idle"); },1500);
    } catch(e) {
      alert("Post failed: " + (e?.message || String(e)));
      setStage("idle");
    }
  };

  const busy = ["checking","uploading","posting"].includes(stage);
  const stageMsg = {idle:"Share",checking:"Reviewing...",uploading:"Uploading...",posting:"Posting...",done:"Posted ✓",flagged:"Try Again"};

  return (
    <div style={{padding:"16px 14px"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
        <Avatar name={username} size={42} showRing/>
        <div>
          <div style={{color:C.white,fontWeight:600,fontSize:14,fontFamily:"'DM Sans',sans-serif"}}>@{username}</div>
          <TagPill tag={tag}/>
        </div>
      </div>
      <textarea value={text} onChange={e=>setText(e.target.value)} placeholder="What's on your heart today? Share a scripture, testimony, or praise..." style={{width:"100%",minHeight:140,background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:"14px 16px",color:C.cream,fontSize:15,lineHeight:1.8,fontFamily:"'DM Sans',sans-serif",outline:"none",resize:"none",boxSizing:"border-box",display:"block"}}/>
      {preview && (
        <div style={{position:"relative",marginTop:10,borderRadius:12,overflow:"hidden"}}>
          {mediaType==="video"
            ? <video src={preview} controls playsInline style={{width:"100%",maxHeight:300,display:"block",background:"#000"}}/>
            : <img src={preview} alt="preview" style={{width:"100%",maxHeight:300,objectFit:"cover",display:"block"}}/>}
          <button onClick={()=>{setMedia(null);setPreview(null);}} style={{position:"absolute",top:8,right:8,background:"rgba(0,0,0,0.7)",border:"none",borderRadius:"50%",width:28,height:28,color:"#fff",cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
        </div>
      )}
      <div style={{marginTop:14}}>
        <p style={{color:C.muted,fontSize:11,fontFamily:"'DM Sans',sans-serif",fontWeight:600,letterSpacing:"0.08em",marginBottom:8}}>CONTENT TYPE</p>
        <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
          {Object.entries(TAGS).map(([t,s])=>{
            const active=tag===t;
            return <button key={t} onClick={()=>setTag(t)} style={{background:active?s.text:s.bg,color:active?"#080C10":s.text,border:`1px solid ${active?s.text:s.border}`,borderRadius:22,padding:"7px 14px",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",transition:"all 0.18s"}}>{t}</button>;
          })}
        </div>
      </div>
      <div style={{display:"flex",gap:8,marginTop:14}}>
        <button onClick={()=>{ fileRef.current.accept="image/*"; fileRef.current?.click(); }} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:8,background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"10px 14px",color:C.muted,fontSize:13,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>
          <ImgSvg/> Photo
        </button>
        <button onClick={()=>{ fileRef.current.accept="video/*"; fileRef.current?.click(); }} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:8,background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"10px 14px",color:C.muted,fontSize:13,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>
          <VidSvg/> Video
        </button>
      </div>
      <input ref={fileRef} type="file" accept="image/*,video/*" onChange={pickMedia} style={{display:"none"}}/>
      {stage==="flagged" && (
        <div style={{background:"#1E0808",border:`1px solid ${C.red}33`,borderRadius:12,padding:"12px 14px",marginTop:14}}>
          <p style={{color:"#C08080",fontSize:12,fontFamily:"'DM Sans',sans-serif",margin:0,lineHeight:1.5}}>{flagReason}</p>
        </div>
      )}

      <button onClick={stage==="flagged"?()=>{setStage("idle");setFlagReason("");}:post} disabled={(!text.trim()&&!media&&stage!=="flagged")||busy} style={{width:"100%",padding:"15px",background:stage==="done"?"#0E2A1A":stage==="flagged"?C.card:`linear-gradient(135deg,${C.gold},${C.goldDim})`,color:stage==="done"?C.green:stage==="flagged"?C.muted:"#080C10",border:stage==="flagged"?`1px solid ${C.border}`:"none",borderRadius:16,fontSize:15,fontWeight:700,fontFamily:"'DM Sans',sans-serif",cursor:"pointer",marginTop:16,transition:"all 0.25s"}}>
        {stageMsg[stage]||"Share"}
      </button>
    </div>
  );
}

// ─── DM CHAT SCREEN ──────────────────────────────────────────
function ChatScreen({user}) {
  const [view, setView] = useState("list"); // list | thread | newChat
  const [convos, setConvos] = useState([]);
  const [users, setUsers] = useState([]);
  const [activeConvo, setActiveConvo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef();
  const myUsername = user.user_metadata?.username || user.email?.split("@")[0] || "You";

  useEffect(()=>{
    if(view==="list") { sb.getConversations(user.id).then(d=>setConvos(d)).finally(()=>setLoading(false)); }
    if(view==="newChat") { sb.getUsers().then(d=>setUsers(d.filter(u=>u.id!==user.id))); }
  },[view]);

  useEffect(()=>{
    if(view==="thread"&&activeConvo) {
      sb.getMessages(user.id, activeConvo.userId).then(d=>setMessages(d));
    }
  },[view, activeConvo]);

  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:"smooth"}); },[messages]);

  const openConvo = (convo) => { setActiveConvo(convo); setView("thread"); };
  const startNew = (u) => { setActiveConvo({userId:u.id, username:u.username}); setView("thread"); };

  const send = async () => {
    if(!text.trim()) return;
    const msg = { sender_id:user.id, receiver_id:activeConvo.userId, sender_username:myUsername, receiver_username:activeConvo.username, text:text.trim(), created_at:new Date().toISOString() };
    setText("");
    setMessages(prev=>[...prev,{...msg,id:Date.now()}]);
    await sb.sendMessage(msg);
  };

  if(view==="thread") return (
    <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 140px)"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderBottom:`1px solid ${C.border}`,background:C.surface}}>
        <button onClick={()=>setView("list")} style={{background:"none",border:"none",color:C.gold,fontSize:20,cursor:"pointer",padding:"0 4px"}}>←</button>
        <Avatar name={activeConvo.username} size={36}/>
        <span style={{color:C.white,fontWeight:600,fontFamily:"'DM Sans',sans-serif"}}>@{activeConvo.username}</span>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"16px 14px",display:"flex",flexDirection:"column",gap:10}}>
        {messages.length===0 && <p style={{textAlign:"center",color:C.muted,fontFamily:"'DM Sans',sans-serif",fontSize:13,marginTop:40}}>Send a message to start the conversation 🙏</p>}
        {messages.map(m=>{
          const mine = m.sender_id===user.id;
          return (
            <div key={m.id} style={{display:"flex",flexDirection:mine?"row-reverse":"row",alignItems:"flex-end",gap:8}}>
              {!mine && <Avatar name={m.sender_username} size={28}/>}
              <div style={{maxWidth:"72%"}}>
                <div style={{background:mine?`linear-gradient(135deg,${C.gold},${C.goldDim})`:C.card,color:mine?C.bg:C.cream,borderRadius:mine?"18px 18px 4px 18px":"18px 18px 18px 4px",padding:"10px 14px",fontSize:14,fontFamily:"'DM Sans',sans-serif",lineHeight:1.5,border:mine?"none":`1px solid ${C.border}`}}>{m.text}</div>
                <div style={{color:C.muted,fontSize:10,fontFamily:"'DM Sans',sans-serif",marginTop:3,textAlign:mine?"right":"left"}}>{timeAgo(m.created_at)}</div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef}/>
      </div>
      <div style={{padding:"10px 14px",borderTop:`1px solid ${C.border}`,display:"flex",gap:10,alignItems:"center",background:C.surface}}>
        <div style={{flex:1,background:C.card,borderRadius:24,border:`1px solid ${C.border}`,display:"flex",alignItems:"center",padding:"10px 16px",gap:8}}>
          <input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder="Type a message..." style={{background:"none",border:"none",outline:"none",color:C.cream,fontSize:13,flex:1,fontFamily:"'DM Sans',sans-serif"}}/>
          <button onClick={send} disabled={!text.trim()} style={{background:text.trim()?`linear-gradient(135deg,${C.gold},${C.goldDim})`:"#1A2530",border:"none",borderRadius:"50%",width:32,height:32,cursor:text.trim()?"pointer":"default",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.2s"}}>
            <SendSvg/>
          </button>
        </div>
      </div>
    </div>
  );

  if(view==="newChat") return (
    <div style={{padding:"16px 14px"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
        <button onClick={()=>setView("list")} style={{background:"none",border:"none",color:C.gold,fontSize:20,cursor:"pointer"}}>←</button>
        <span style={{color:C.white,fontWeight:600,fontSize:16,fontFamily:"'DM Sans',sans-serif"}}>New Message</span>
      </div>
      {users.length===0 ? <p style={{textAlign:"center",color:C.muted,fontFamily:"'DM Sans',sans-serif",fontSize:13,padding:"30px 0"}}>No other members yet</p>
      : users.map(u=>(
        <div key={u.id} onClick={()=>startNew(u)} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",background:C.card,border:`1px solid ${C.border}`,borderRadius:14,marginBottom:8,cursor:"pointer"}}>
          <Avatar name={u.username} size={42}/>
          <div>
            <div style={{color:C.white,fontWeight:600,fontSize:14,fontFamily:"'DM Sans',sans-serif"}}>@{u.username}</div>
            <div style={{color:C.muted,fontSize:11,fontFamily:"'DM Sans',sans-serif",marginTop:2}}>✝️ Verified Believer</div>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div style={{padding:"16px 14px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <p style={{color:C.muted,fontSize:11,fontWeight:600,letterSpacing:"0.1em",fontFamily:"'DM Sans',sans-serif",margin:0}}>MESSAGES</p>
        <button onClick={()=>setView("newChat")} style={{background:`linear-gradient(135deg,${C.gold},${C.goldDim})`,border:"none",borderRadius:10,padding:"6px 14px",color:C.bg,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>+ New</button>
      </div>
      {loading ? <div style={{display:"flex",justifyContent:"center",padding:40}}><div style={{width:24,height:24,border:`2px solid ${C.gold}33`,borderTop:`2px solid ${C.gold}`,borderRadius:"50%",animation:"spin .7s linear infinite"}}/></div>
      : convos.length===0 ? (
        <div style={{textAlign:"center",padding:"50px 20px"}}>
          <div style={{fontSize:40,marginBottom:12}}>💬</div>
          <p style={{color:C.muted,fontFamily:"'DM Sans',sans-serif",fontSize:14,marginBottom:16}}>No messages yet</p>
          <button onClick={()=>setView("newChat")} style={{background:`linear-gradient(135deg,${C.gold},${C.goldDim})`,border:"none",borderRadius:12,padding:"12px 24px",color:C.bg,fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>Start a conversation</button>
        </div>
      ) : convos.map((c,i)=>(
        <div key={i} onClick={()=>openConvo(c)} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",background:C.card,border:`1px solid ${C.border}`,borderRadius:14,marginBottom:8,cursor:"pointer"}}>
          <Avatar name={c.username} size={46}/>
          <div style={{flex:1,overflow:"hidden"}}>
            <div style={{color:C.white,fontWeight:600,fontSize:14,fontFamily:"'DM Sans',sans-serif"}}>@{c.username}</div>
            <div style={{color:C.muted,fontSize:12,fontFamily:"'DM Sans',sans-serif",marginTop:2,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{c.lastMsg}</div>
          </div>
          <span style={{color:C.muted,fontSize:10,fontFamily:"'DM Sans',sans-serif",flexShrink:0}}>{timeAgo(c.time)}</span>
        </div>
      ))}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ─── ADMIN PANEL ─────────────────────────────────────────────
function AdminScreen() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending");

  useEffect(()=>{ sb.getAllPosts().then(d=>setPosts(d)).finally(()=>setLoading(false)); },[]);

  const approve = async (id) => {
    await sb.updatePostStatus(id, "approved");
    setPosts(prev=>prev.map(p=>p.id===id?{...p,status:"approved"}:p));
  };
  const reject = async (id) => {
    await sb.updatePostStatus(id, "flagged");
    setPosts(prev=>prev.map(p=>p.id===id?{...p,status:"flagged"}:p));
  };

  const filtered = posts.filter(p=>filter==="all"?true:p.status===filter);
  const counts = { pending:posts.filter(p=>p.status==="pending").length, approved:posts.filter(p=>p.status==="approved").length, flagged:posts.filter(p=>p.status==="flagged").length };

  return (
    <div style={{padding:"16px 14px"}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
        <AdminSvg on/>
        <span style={{color:C.gold,fontSize:16,fontWeight:700,fontFamily:"'Playfair Display',serif"}}>Admin Panel</span>
      </div>

      {/* Stats */}
      <div style={{display:"flex",gap:8,marginBottom:16}}>
        {[{l:"Pending",v:counts.pending,c:C.amber},{l:"Approved",v:counts.approved,c:C.green},{l:"Flagged",v:counts.flagged,c:C.red}].map((s,i)=>(
          <div key={i} style={{flex:1,background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"10px 8px",textAlign:"center"}}>
            <div style={{color:s.c,fontSize:20,fontWeight:700,fontFamily:"'Playfair Display',serif"}}>{s.v}</div>
            <div style={{color:C.muted,fontSize:9,fontFamily:"'DM Sans',sans-serif",marginTop:2,letterSpacing:"0.06em"}}>{s.l.toUpperCase()}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{display:"flex",gap:6,marginBottom:14}}>
        {["pending","approved","flagged","all"].map(f=>(
          <button key={f} onClick={()=>setFilter(f)} style={{flex:1,padding:"7px 4px",background:filter===f?`linear-gradient(135deg,${C.gold},${C.goldDim})`:C.card,border:`1px solid ${filter===f?C.gold:C.border}`,borderRadius:10,color:filter===f?C.bg:C.muted,fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",textTransform:"capitalize"}}>{f}</button>
        ))}
      </div>

      {loading ? <div style={{display:"flex",justifyContent:"center",padding:40}}><div style={{width:24,height:24,border:`2px solid ${C.gold}33`,borderTop:`2px solid ${C.gold}`,borderRadius:"50%",animation:"spin .7s linear infinite"}}/></div>
      : filtered.length===0 ? <p style={{textAlign:"center",color:C.muted,fontFamily:"'DM Sans',sans-serif",padding:"30px 0"}}>No {filter} posts</p>
      : filtered.map(p=>(
        <div key={p.id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:"12px 14px",marginBottom:10}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <Avatar name={p.username} size={28}/>
              <span style={{color:C.white,fontSize:12,fontWeight:600,fontFamily:"'DM Sans',sans-serif"}}>@{p.username}</span>
            </div>
            <TagPill tag={p.tag}/>
          </div>
          <p style={{color:C.cream,fontSize:13,fontFamily:"'DM Sans',sans-serif",lineHeight:1.5,margin:"0 0 10px",display:"-webkit-box",WebkitLineClamp:3,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{p.caption}</p>
          {p.image_url && <img src={p.image_url} alt="" style={{width:"100%",maxHeight:160,objectFit:"cover",borderRadius:8,marginBottom:10}} onError={e=>e.target.style.display="none"}/>}
          <div style={{display:"flex",gap:8}}>
            {p.status!=="approved" && (
              <button onClick={()=>approve(p.id)} style={{flex:1,padding:"8px",background:"#0E2A1A",border:`1px solid ${C.green}44`,borderRadius:10,color:C.green,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>✓ Approve</button>
            )}
            {p.status!=="flagged" && (
              <button onClick={()=>reject(p.id)} style={{flex:1,padding:"8px",background:"#2A0E0E",border:`1px solid ${C.red}44`,borderRadius:10,color:C.red,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>✕ Reject</button>
            )}
            <div style={{padding:"8px 10px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,color:p.status==="approved"?C.green:p.status==="flagged"?C.red:C.amber,fontSize:11,fontFamily:"'DM Sans',sans-serif",fontWeight:600,display:"flex",alignItems:"center"}}>
              {p.status==="approved"?"✓ Live":p.status==="flagged"?"🚫 Rejected":"⏳ Pending"}
            </div>
          </div>
        </div>
      ))}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ─── PROFILE SCREEN ──────────────────────────────────────────
function ProfileScreen({user, onSignOut}) {
  const [posts, setPosts] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState("");
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [bannerFile, setBannerFile] = useState(null);
  const [bannerPreview, setBannerPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const avatarRef = useRef();
  const bannerRef = useRef();
  const username = user.user_metadata?.username || user.email?.split("@")[0] || "Believer";

  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  useEffect(()=>{
    setLoading(true);
    Promise.all([
      sb.getMyPosts(user.id),
      sb.getProfile(user.id),
      sb.getFollowers(user.id),
      sb.getFollowing(user.id),
    ]).then(([p, prof, followers, following])=>{
      setPosts(p);
      setProfile(prof);
      setBio(prof?.bio||"");
      setFollowerCount(followers||0);
      setFollowingCount((following||[]).length);
    }).finally(()=>setLoading(false));
  },[user.id]);

  const pickAvatar = (e) => {
    const f = e.target.files[0]; if(!f) return;
    setAvatarFile(f);
    const reader = new FileReader(); reader.onload = ev=>setAvatarPreview(ev.target.result); reader.readAsDataURL(f);
  };

  const pickBanner = (e) => {
    const f = e.target.files[0]; if(!f) return;
    setBannerFile(f);
    const reader = new FileReader(); reader.onload = ev=>setBannerPreview(ev.target.result); reader.readAsDataURL(f);
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      let avatar_url = profile?.avatar_url || null;
      let banner_url = profile?.banner_url || null;
      if(avatarFile) {
        const up = await sb.uploadAvatar(user.id, avatarFile);
        if(up) avatar_url = up;
      }
      if(bannerFile) {
        const up = await sb.uploadAvatar(user.id + "_banner", bannerFile);
        if(up) banner_url = up;
      }
      const { data, error } = await sb.updateProfile(user.id, { bio: bio.trim(), avatar_url, banner_url });
      if(error) { alert("Save failed: " + error.message); }
      else {
        setProfile(prev=>({...prev, bio: bio.trim(), avatar_url, banner_url}));
        setEditing(false); setAvatarFile(null); setAvatarPreview(null); setBannerFile(null); setBannerPreview(null);
      }
    } catch(e) { alert("Error: " + e.message); }
    finally { setSaving(false); }
  };

  const approved = posts.filter(p=>p.status==="approved").length;
  const pending = posts.filter(p=>p.status==="pending").length;
  const flagged = posts.filter(p=>p.status==="flagged").length;

  return (
    <div>
      <div style={{height:140,position:"relative",marginBottom:56,overflow:"hidden",cursor:editing?"pointer":"default"}} onClick={()=>editing&&bannerRef.current?.click()}>
        {(bannerPreview||profile?.banner_url)
          ? <img src={bannerPreview||profile?.banner_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>
          : <div style={{width:"100%",height:"100%",background:`linear-gradient(160deg,${C.gold}33,${C.goldDim}22,${C.bg})`}}/>}
        {editing && <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.3)"}}><span style={{color:"#fff",fontSize:13,fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>📷 Change Cover</span></div>}
        <input ref={bannerRef} type="file" accept="image/*" onChange={pickBanner} style={{display:"none"}}/>
        <div style={{position:"absolute",bottom:-44,left:"50%",transform:"translateX(-50%)",cursor:"pointer"}} onClick={e=>{e.stopPropagation();editing&&avatarRef.current?.click();}}>
          {(avatarPreview||profile?.avatar_url)
            ? <img src={avatarPreview||profile?.avatar_url} alt="" style={{width:88,height:88,borderRadius:"50%",objectFit:"cover",border:`3px solid ${C.bg}`,boxShadow:`0 0 0 3px ${C.gold}55`}}/>
            : <div style={{width:88,height:88,borderRadius:"50%",background:`linear-gradient(135deg,${C.gold},${C.goldDim})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:30,fontWeight:700,color:C.bg,fontFamily:"'Playfair Display',serif",border:`3px solid ${C.bg}`,boxShadow:`0 0 0 3px ${C.gold}55`}}>{initials(username)}</div>}
          {editing && <div style={{position:"absolute",bottom:0,right:0,width:26,height:26,borderRadius:"50%",background:C.gold,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>📷</div>}
        </div>
          <input ref={avatarRef} type="file" accept="image/*" onChange={pickAvatar} style={{display:"none"}}/>
        </div>
      </div>
      <div style={{textAlign:"center",padding:"0 20px",marginBottom:16}}>
        <div style={{color:C.white,fontSize:18,fontWeight:700,fontFamily:"'Playfair Display',serif"}}>{username}</div>
        {editing
          ? <textarea value={bio} onChange={e=>setBio(e.target.value)} placeholder="Write your bio..." maxLength={120} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"8px 12px",color:C.cream,fontSize:13,fontFamily:"'DM Sans',sans-serif",width:"100%",marginTop:8,resize:"none",outline:"none",lineHeight:1.5}}/>
          : <div style={{color:C.muted,fontSize:13,fontFamily:"'DM Sans',sans-serif",marginTop:4,lineHeight:1.5}}>{profile?.bio || (editing ? "" : "Tap Edit Profile to add a bio")}</div>}
        <div style={{display:"flex",justifyContent:"center",gap:8,marginTop:10}}>
          {editing
            ? <>
                <button onClick={saveProfile} disabled={saving} style={{background:`linear-gradient(135deg,${C.gold},${C.goldDim})`,border:"none",borderRadius:10,padding:"7px 20px",color:C.bg,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>{saving?"Saving...":"Save"}</button>
                <button onClick={()=>{setEditing(false);setAvatarFile(null);setAvatarPreview(null);}} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"7px 20px",color:C.muted,fontSize:12,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>Cancel</button>
              </>
            : <button onClick={()=>setEditing(true)} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"7px 20px",color:C.cream,fontSize:12,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>✏️ Edit Profile</button>}
        </div>
      </div>
      <div style={{display:"flex",margin:"0 14px 16px",background:C.card,border:`1px solid ${C.border}`,borderRadius:16,overflow:"hidden"}}>
        {[{l:"Posts",v:posts.length},{l:"Followers",v:followerCount},{l:"Following",v:followingCount}].map((s,i)=>(
          <div key={i} style={{flex:1,padding:"14px 8px",textAlign:"center",borderRight:i<2?`1px solid ${C.border}`:"none"}}>
            <div style={{color:C.gold,fontSize:20,fontWeight:700,fontFamily:"'Playfair Display',serif"}}>{s.v}</div>
            <div style={{color:C.muted,fontSize:10,fontFamily:"'DM Sans',sans-serif",marginTop:2,letterSpacing:"0.06em"}}>{s.l.toUpperCase()}</div>
          </div>
        ))}
      </div>
      {(pending>0||flagged>0) && (
        <div style={{margin:"0 14px 16px",background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"12px 14px",display:"flex",gap:16}}>
          {pending>0&&<span style={{color:C.amber,fontSize:12,fontFamily:"'DM Sans',sans-serif"}}>⏳ {pending} under review</span>}
          {flagged>0&&<span style={{color:C.red,fontSize:12,fontFamily:"'DM Sans',sans-serif"}}>🚫 {flagged} flagged</span>}
        </div>
      )}
      <div style={{padding:"0 14px"}}>
        <p style={{color:C.muted,fontSize:11,fontWeight:600,letterSpacing:"0.1em",fontFamily:"'DM Sans',sans-serif",marginBottom:10}}>MY POSTS</p>
        {loading ? <div style={{display:"flex",justifyContent:"center",padding:30}}><div style={{width:24,height:24,border:`2px solid ${C.gold}33`,borderTop:`2px solid ${C.gold}`,borderRadius:"50%",animation:"spin .7s linear infinite"}}/></div>
        : posts.length===0 ? <p style={{color:C.muted,textAlign:"center",fontFamily:"'DM Sans',sans-serif",fontSize:13,padding:"20px 0"}}>No posts yet</p>
        : posts.map(p=>(
          <div key={p.id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:"12px 14px",marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <TagPill tag={p.tag}/>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{color:p.status==="approved"?C.green:p.status==="flagged"?C.red:C.amber,fontSize:10,fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>
                  {p.status==="approved"?"✓ Live":p.status==="flagged"?"🚫 Flagged":"⏳ Reviewing"}
                </span>
                <button onClick={async()=>{
                  if(!window.confirm("Delete this post?")) return;
                  const ok = await sb.deletePost(p.id);
                  if(ok) setPosts(prev=>prev.filter(x=>x.id!==p.id));
                }} style={{background:"none",border:"none",color:C.muted,fontSize:13,cursor:"pointer",padding:"2px 4px"}}>🗑</button>
              </div>
            </div>
            {p.image_url && (p.media_type==="video"
              ? <video src={p.image_url} controls playsInline style={{width:"100%",maxHeight:180,borderRadius:8,marginBottom:8}}/>
              : <img src={p.image_url} alt="" style={{width:"100%",maxHeight:180,objectFit:"cover",borderRadius:8,marginBottom:8}} onError={e=>e.target.style.display="none"}/>)}
            <p style={{color:C.cream,fontSize:13,fontFamily:"'DM Sans',sans-serif",lineHeight:1.5,margin:0,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{p.caption}</p>
          </div>
        ))}
      </div>
      <div style={{padding:"8px 14px 24px"}}>
        <button onClick={onSignOut} style={{width:"100%",background:"#1A0808",border:`1px solid ${C.red}33`,borderRadius:14,padding:13,color:C.red,fontSize:14,fontFamily:"'DM Sans',sans-serif",cursor:"pointer"}}>Sign Out</button>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ─── NOTIFICATIONS SCREEN ────────────────────────────────────
function NotificationsScreen() {
  const items = [
    {text:"Your post went live ✓",sub:"Approved by our moderation team",time:"2m",icon:"✅",unread:true},
    {text:"Pastor_Emeka liked your testimony",sub:"",time:"18m",icon:"❤️",unread:true},
    {text:"Grace_Adaeze started following you",sub:"",time:"1h",icon:"🙏",unread:false},
    {text:"New community challenge",sub:"30 Days of Prayer — join 2.3k believers",time:"2h",icon:"📣",unread:false},
    {text:"FaithWalker_Tolu replied to your comment",sub:'"Amen! This really blessed me"',time:"3h",icon:"💬",unread:false},
  ];
  return (
    <div style={{padding:"16px 14px"}}>
      <p style={{color:C.muted,fontSize:11,fontWeight:600,letterSpacing:"0.1em",fontFamily:"'DM Sans',sans-serif",marginBottom:14}}>NOTIFICATIONS</p>
      {items.map((n,i)=>(
        <div key={i} style={{display:"flex",gap:12,padding:"12px 14px",background:n.unread?C.card:C.surface,border:`1px solid ${n.unread?C.border+"88":C.border+"44"}`,borderRadius:14,marginBottom:8,position:"relative",overflow:"hidden"}}>
          {n.unread&&<div style={{position:"absolute",left:0,top:0,bottom:0,width:3,background:C.gold,borderRadius:"3px 0 0 3px"}}/>}
          <div style={{width:40,height:40,borderRadius:"50%",background:C.card,border:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{n.icon}</div>
          <div style={{flex:1}}>
            <div style={{color:n.unread?C.white:C.cream,fontSize:13,fontFamily:"'DM Sans',sans-serif",fontWeight:n.unread?600:400}}>{n.text}</div>
            {n.sub&&<div style={{color:C.muted,fontSize:11,fontFamily:"'DM Sans',sans-serif",marginTop:2}}>{n.sub}</div>}
            <div style={{color:C.muted,fontSize:10,fontFamily:"'DM Sans',sans-serif",marginTop:3}}>{n.time} ago</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── AUTH SCREEN ─────────────────────────────────────────────
function AuthScreen({onAuth}) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setError(""); setLoading(true);
    try {
      if(mode==="signup") {
        if(!username.trim()){setError("Username is required.");setLoading(false);return;}
        const d = await sb.signUp(email, password, username);
        if(d.error){setError(d.error.message);setLoading(false);return;}
        const s = await sb.signIn(email, password);
        if(s.error){setError("✅ Account created! Please sign in.");setMode("login");setLoading(false);return;}
        onAuth(s.user, s.access_token);
      } else {
        const d = await sb.signIn(email, password);
        if(d.error){setError(d.error.message);setLoading(false);return;}
        if(d.user&&d.access_token){ onAuth(d.user, d.access_token); }
        else { setError("Login failed. Please try again."); }
      }
    } catch(e) { setError("Error: "+(e?.message||String(e))); }
    finally { setLoading(false); }
  };

  return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",flexDirection:"column",position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",top:-100,right:-100,width:350,height:350,borderRadius:"50%",background:`radial-gradient(circle,${C.gold}08,transparent 70%)`,pointerEvents:"none"}}/>
      <div style={{position:"absolute",bottom:-80,left:-80,width:280,height:280,borderRadius:"50%",background:`radial-gradient(circle,${C.goldDim}06,transparent 70%)`,pointerEvents:"none"}}/>
      <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"40px 32px 24px"}}>
        <div style={{width:90,height:90,borderRadius:32,background:`linear-gradient(145deg,${C.gold},${C.goldDim})`,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:24,boxShadow:`0 16px 48px ${C.gold}44, 0 0 0 8px ${C.gold}11`}}>
          <CrossSvg size={40} color={C.bg}/>
        </div>
        <h1 style={{fontSize:40,fontWeight:700,color:C.white,fontFamily:"'Playfair Display',serif",margin:"0 0 8px",letterSpacing:"-0.03em"}}>Hallelujah</h1>
        <p style={{color:C.goldDim,fontSize:12,fontFamily:"'DM Sans',sans-serif",margin:0,letterSpacing:"0.14em",fontWeight:500}}>A COMMUNITY OF FAITH</p>
      </div>
      <div style={{background:C.surface,borderRadius:"28px 28px 0 0",border:`1px solid ${C.border}`,padding:"28px 24px 40px"}}>
        <h2 style={{color:C.white,fontSize:20,fontWeight:600,fontFamily:"'Playfair Display',serif",margin:"0 0 20px",textAlign:"center"}}>{mode==="login"?"Welcome back":"Join the community"}</h2>
        {mode==="signup" && (
          <div style={{background:C.card,borderRadius:14,border:`1px solid ${C.border}`,padding:"14px 16px",marginBottom:12}}>
            <input placeholder="Username" value={username} onChange={e=>setUsername(e.target.value)} style={{background:"none",border:"none",outline:"none",color:C.cream,fontSize:14.5,width:"100%",fontFamily:"'DM Sans',sans-serif"}}/>
          </div>
        )}
        <div style={{background:C.card,borderRadius:14,border:`1px solid ${C.border}`,padding:"14px 16px",marginBottom:12}}>
          <input type="email" placeholder="Email address" value={email} onChange={e=>setEmail(e.target.value)} style={{background:"none",border:"none",outline:"none",color:C.cream,fontSize:14.5,width:"100%",fontFamily:"'DM Sans',sans-serif"}}/>
        </div>
        <div style={{background:C.card,borderRadius:14,border:`1px solid ${C.border}`,padding:"14px 16px",marginBottom:16}}>
          <input type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} style={{background:"none",border:"none",outline:"none",color:C.cream,fontSize:14.5,width:"100%",fontFamily:"'DM Sans',sans-serif"}}/>
        </div>
        {error && (
          <div style={{background:error.startsWith("✅")?"#0A1E0F":"#1E0A0A",border:`1px solid ${error.startsWith("✅")?C.green:C.red}33`,borderRadius:12,padding:"10px 14px",marginBottom:14}}>
            <span style={{color:error.startsWith("✅")?C.green:"#E08080",fontSize:12.5,fontFamily:"'DM Sans',sans-serif"}}>{error}</span>
          </div>
        )}
        <button onClick={submit} disabled={loading} style={{width:"100%",padding:16,background:`linear-gradient(135deg,${C.gold},${C.goldDim})`,color:C.bg,border:"none",borderRadius:16,fontSize:15,fontWeight:700,fontFamily:"'DM Sans',sans-serif",cursor:"pointer",marginBottom:16,opacity:loading?0.7:1}}>
          {loading?"Please wait...":(mode==="login"?"Sign In":"Create Account")}
        </button>
        <p style={{textAlign:"center",color:C.muted,fontSize:13,fontFamily:"'DM Sans',sans-serif",margin:0}}>
          {mode==="login"?"Don't have an account? ":"Already have one? "}
          <button onClick={()=>{setMode(mode==="login"?"signup":"login");setError("");}} style={{background:"none",border:"none",color:C.gold,fontSize:13,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",textDecoration:"underline"}}>
            {mode==="login"?"Sign up":"Sign in"}
          </button>
        </p>
        <p style={{textAlign:"center",color:"#283340",fontSize:11,fontFamily:"'DM Sans',sans-serif",marginTop:16,lineHeight:1.5}}>By joining, you agree to share only Christ-centered content.</p>
      </div>
    </div>
  );
}

// ─── BOTTOM NAV ──────────────────────────────────────────────
function BottomNav({tab, setTab, isAdmin}) {
  const items = [
    {id:"home",label:"Home",icon:(on)=><HomeSvg on={on}/>},
    {id:"explore",label:"Explore",icon:(on)=><SearchSvg on={on}/>},
    {id:"create",label:"",icon:()=>null},
    {id:"chat",label:"Messages",icon:(on)=><ChatSvg on={on}/>},
    {id:"profile",label:"Me",icon:(on)=><UserSvg on={on}/>},
  ];
  if(isAdmin) items.splice(3,0,{id:"admin",label:"Admin",icon:(on)=><AdminSvg on={on}/>});

  return (
    <div style={{position:"fixed",bottom:0,left:0,right:0,width:"100vw",background:`${C.bg}F8`,backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",borderTop:`1px solid ${C.border}77`,display:"flex",alignItems:"center",padding:"10px 0 24px",zIndex:50,boxSizing:"border-box"}}>
      {items.map(item => item.id==="create" ? (
        <div key="create" style={{flex:1,display:"flex",justifyContent:"center",alignItems:"center"}}>
          <button onClick={()=>setTab("create")} style={{width:50,height:50,borderRadius:16,background:`linear-gradient(135deg,${C.gold},${C.goldDim})`,border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:`0 4px 20px ${C.gold}44`,transform:tab==="create"?"scale(0.92)":"scale(1)",transition:"transform 0.15s"}}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke={C.bg} strokeWidth="2.6" strokeLinecap="round"/></svg>
          </button>
        </div>
      ) : (
        <button key={item.id} onClick={()=>setTab(item.id)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4,background:"none",border:"none",cursor:"pointer",padding:"4px 0"}}>
          {item.icon(tab===item.id)}
          {item.label && <span style={{fontSize:9,color:tab===item.id?C.gold:C.muted,fontFamily:"'DM Sans',sans-serif",fontWeight:500,letterSpacing:"0.04em"}}>{item.label.toUpperCase()}</span>}
        </button>
      ))}
    </div>
  );
}

// ─── ROOT APP ────────────────────────────────────────────────
export default function App() {
  useEffect(() => {
    // Remove white space, ensure full width
    document.documentElement.style.cssText = "margin:0;padding:0;width:100%;overflow-x:hidden;";
    document.body.style.cssText = "margin:0;padding:0;width:100%;overflow-x:hidden;background:#080C10;";
    let meta = document.querySelector("meta[name=viewport]");
    if(!meta){ meta = document.createElement("meta"); meta.name="viewport"; document.head.appendChild(meta); }
    meta.content = "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no";
  }, []);
  const [auth, setAuth] = useState(null);
  const [tab, setTab] = useState("home");
  const [posts, setPosts] = useState([]);
  const [likedIds, setLikedIds] = useState([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [avatarMap, setAvatarMap] = useState({});

  const isAdmin = auth?.user?.email?.trim().toLowerCase() === ADMIN_EMAIL.trim().toLowerCase();
  const handleAuth = (user, token) => setAuth({user, token});
  const handleSignOut = async () => { await sb.signOut(); setAuth(null); setPosts([]); setLikedIds([]); };

  useEffect(()=>{
    if(!auth) return;
    setFeedLoading(true);
    Promise.all([sb.getPosts(), sb.getMyLikes(auth.user.id)])
      .then(([p,l])=>{
        if(Array.isArray(p)) {
          setPosts(p);
          // Load avatars for all post authors
          const uids = [...new Set(p.map(x=>x.user_id).filter(Boolean))];
          if(uids.length) {
            sb.getProfilesWithAvatars(uids).then(profiles=>{
              const map = {};
              profiles.forEach(pr=>{ if(pr.avatar_url) map[pr.id]=pr.avatar_url; });
              // Add own avatar
              sb.getProfile(auth.user.id).then(own=>{ if(own?.avatar_url) map[own.id]=own.avatar_url; setAvatarMap({...map}); });
            });
          }
        }
        if(Array.isArray(l)) setLikedIds(l);
      })
      .finally(()=>setFeedLoading(false));
  },[auth]);

  const handleLike = async (post) => {
    const liked = likedIds.includes(post.id);
    setLikedIds(prev=>liked?prev.filter(id=>id!==post.id):[...prev,post.id]);
    setPosts(prev=>prev.map(p=>p.id===post.id?{...p,likes:liked?p.likes-1:p.likes+1}:p));
    await sb.toggleLike(post.id, auth.user.id, liked, post.likes);
  };

  const handlePosted = (newPost) => { setPosts(prev=>[newPost,...prev]); setTab("home"); };
  const handleCommentAdded = (postId) => { setPosts(prev=>prev.map(p=>p.id===postId?{...p,comments:(p.comments||0)+1}:p)); };

  if(!auth) return <AuthScreen onAuth={handleAuth}/>;

  return (
    <div style={{minHeight:"100vh",width:"100vw",maxWidth:"100vw",background:C.bg,color:C.cream,fontFamily:"'DM Sans',sans-serif",overflowX:"hidden",boxSizing:"border-box"}}>
      <div style={{padding:"12px 16px 10px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,background:`${C.bg}EE`,backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",zIndex:40,borderBottom:`1px solid ${C.border}55`}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:32,height:32,borderRadius:10,background:`linear-gradient(135deg,${C.gold},${C.goldDim})`,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <CrossSvg size={16} color={C.bg}/>
          </div>
          <span style={{fontSize:22,fontWeight:700,color:C.white,fontFamily:"'Playfair Display',serif",letterSpacing:"-0.02em"}}>Hallelujah</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          {isAdmin && <span style={{background:`${C.gold}22`,color:C.gold,fontSize:9,fontWeight:700,padding:"3px 10px",borderRadius:20,fontFamily:"'DM Sans',sans-serif",letterSpacing:"0.08em",border:`1px solid ${C.gold}33`}}>ADMIN</span>}
          <button onClick={()=>setTab("notifications")} style={{background:"none",border:"none",cursor:"pointer",position:"relative",padding:4}}>
            <BellSvg on={tab==="notifications"}/>
            <div style={{position:"absolute",top:2,right:2,width:7,height:7,borderRadius:"50%",background:C.red,border:`1.5px solid ${C.bg}`}}/>
          </button>
        </div>
      </div>
      <div style={{paddingBottom:100}}>
        {tab==="home"          && <FeedScreen posts={posts} likedIds={likedIds} onLike={handleLike} user={auth.user} loading={feedLoading} onCommentAdded={handleCommentAdded} avatarMap={avatarMap}/>}
        {tab==="explore"       && <ExploreScreen currentUser={auth.user}/>}
        {tab==="create"        && <CreateScreen user={auth.user} onPosted={handlePosted}/>}
        {tab==="chat"          && <ChatScreen user={auth.user}/>}
        {tab==="notifications" && <NotificationsScreen/>}
        {tab==="admin"         && isAdmin && <AdminScreen/>}
        {tab==="profile"       && <ProfileScreen user={auth.user} onSignOut={handleSignOut}/>}
      </div>
      <BottomNav tab={tab} setTab={setTab} isAdmin={isAdmin}/>
    </div>
  );
}
