import { useState, useEffect, useRef } from "react";

// ─── CONFIG ──────────────────────────────────────────────────
const const SUPABASE_URL = "https://xxxx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ2bW5sdHNxb3N0ZnN3ZG9iZXJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2MDQ5ODQsImV4cCI6MjA5NjE4MDk4NH0.DqKhf_RDJfWix6Rre7IFGEy9NJsbdgjkQ125lb9oS5c
  ";

// ─── DESIGN TOKENS ───────────────────────────────────────────
const C = {
  bg:      "#080C10",
  surface: "#0F1620",
  card:    "#111A26",
  border:  "#1C2A38",
  gold:    "#D4A843",
  goldDim: "#8B6914",
  cream:   "#EDE8DF",
  muted:   "#4A5C6A",
  green:   "#3DBA7A",
  red:     "#E04F4F",
  amber:   "#E8B84B",
  white:   "#FFFFFF",
};

// Google Fonts import via style tag
const fontLink = document.createElement("link");
fontLink.rel = "stylesheet";
fontLink.href = "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=DM+Sans:wght@300;400;500;600&display=swap";
document.head.appendChild(fontLink);

const TAGS = {
  Scripture: { bg:"#0F2010", text:"#52C96A", border:"#52C96A22" },
  Sermon:    { bg:"#0E0F20", text:"#6B9CF0", border:"#6B9CF022" },
  Devotion:  { bg:"#200F0F", text:"#E8906A", border:"#E8906A22" },
  Testimony: { bg:"#1E1A08", text:"#E8C85A", border:"#E8C85A22" },
  Prayer:    { bg:"#081820", text:"#5AC8E8", border:"#5AC8E822" },
  Worship:   { bg:"#160820", text:"#A870E8", border:"#A870E822" },
};

// ─── SUPABASE CLIENT ─────────────────────────────────────────
const sb = {
  h: (t) => ({ "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${t || SUPABASE_ANON_KEY}`, "Content-Type": "application/json", "Prefer": "return=representation" }),
  async signUp(email, password, username) { return (await fetch(`${SUPABASE_URL}/auth/v1/signup`, { method:"POST", headers:this.h(), body:JSON.stringify({ email, password, data:{ username } }) })).json(); },
  async signIn(email, password) { return (await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, { method:"POST", headers:this.h(), body:JSON.stringify({ email, password }) })).json(); },
  async signOut(t) { await fetch(`${SUPABASE_URL}/auth/v1/logout`, { method:"POST", headers:this.h(t) }); },
  async getPosts(t) { return (await fetch(`${SUPABASE_URL}/rest/v1/posts?status=eq.approved&order=created_at.desc&limit=50`, { headers:this.h(t) })).json(); },
  async createPost(t, d) { return (await fetch(`${SUPABASE_URL}/rest/v1/posts`, { method:"POST", headers:this.h(t), body:JSON.stringify(d) })).json(); },
  async uploadImage(t, userId, file) {
    const ext = file.name.split(".").pop();
    const path = `${userId}/${Date.now()}.${ext}`;
    await fetch(`${SUPABASE_URL}/storage/v1/object/post-images/${path}`, { method:"POST", headers:{ "apikey":SUPABASE_ANON_KEY, "Authorization":`Bearer ${t}`, "Content-Type":file.type }, body:file });
    return `${SUPABASE_URL}/storage/v1/object/public/post-images/${path}`;
  },
  async toggleLike(t, postId, userId, liked, count) {
    if (!liked) { await fetch(`${SUPABASE_URL}/rest/v1/likes`, { method:"POST", headers:this.h(t), body:JSON.stringify({ post_id:postId, user_id:userId }) }); }
    else { await fetch(`${SUPABASE_URL}/rest/v1/likes?post_id=eq.${postId}&user_id=eq.${userId}`, { method:"DELETE", headers:this.h(t) }); }
    await fetch(`${SUPABASE_URL}/rest/v1/posts?id=eq.${postId}`, { method:"PATCH", headers:this.h(t), body:JSON.stringify({ likes: Math.max(0, liked ? count-1 : count+1) }) });
  },
  async getMyLikes(t, uid) { const d = await (await fetch(`${SUPABASE_URL}/rest/v1/likes?user_id=eq.${uid}&select=post_id`, { headers:this.h(t) })).json(); return Array.isArray(d) ? d.map(x=>x.post_id) : []; },
  async getComments(t, pid) { return (await fetch(`${SUPABASE_URL}/rest/v1/comments?post_id=eq.${pid}&order=created_at.asc`, { headers:this.h(t) })).json(); },
  async addComment(t, d) { return (await fetch(`${SUPABASE_URL}/rest/v1/comments`, { method:"POST", headers:this.h(t), body:JSON.stringify(d) })).json(); },
  async getMyPosts(t, uid) { return (await fetch(`${SUPABASE_URL}/rest/v1/posts?user_id=eq.${uid}&order=created_at.desc`, { headers:this.h(t) })).json(); },
};

// ─── HELPERS ─────────────────────────────────────────────────
const timeAgo = (iso) => { const d=Date.now()-new Date(iso).getTime(),m=Math.floor(d/60000); if(m<1)return"now"; if(m<60)return`${m}m`; const h=Math.floor(m/60); return h<24?`${h}h`:`${Math.floor(h/24)}d`; };
const initials = (n="") => n.slice(0,2).toUpperCase()||"??";
const ACLRS = ["#7B4F2E","#2E5E4E","#4A3060","#5E3A1A","#1A3A5E","#5E1A3A","#3A5E1A","#1A4A4A"];
const aColor = (n="") => { let x=0; for(let c of n) x+=c.charCodeAt(0); return ACLRS[x%ACLRS.length]; };

// ─── AI MODERATION ────────────────────────────────────────────
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

// ─── SVG ICONS ────────────────────────────────────────────────
const Ic = ({ children, size=24, style={} }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>{children}</svg>
);
const CrossSvg = ({size=24,color=C.gold}) => <Ic size={size}><path d={`M12 3v18M5 8h14`} stroke={color} strokeWidth="2.2" strokeLinecap="round"/></Ic>;
const HeartSvg = ({filled,size=22}) => <Ic size={size}><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z" stroke={filled?"#FF4D6D":"#8899AA"} fill={filled?"#FF4D6D":"none"} strokeWidth="1.6" strokeLinejoin="round"/></Ic>;
const CommentSvg = ({size=22}) => <Ic size={size}><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="#8899AA" strokeWidth="1.6" strokeLinejoin="round"/></Ic>;
const ShareSvg = ({size=22}) => <Ic size={size}><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" stroke="#8899AA" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></Ic>;
const HomeSvg = ({on}) => <Ic size={26}><path d="M3 12L12 4l9 8v8a1 1 0 01-1 1H5a1 1 0 01-1-1v-8z" stroke={on?C.gold:"#4A5C6A"} fill={on?C.gold+"22":"none"} strokeWidth="1.8" strokeLinejoin="round"/><path d="M9 21V12h6v9" stroke={on?C.gold:"#4A5C6A"} strokeWidth="1.8" strokeLinejoin="round"/></Ic>;
const SearchSvg = ({on}) => <Ic size={26}><circle cx="11" cy="11" r="7" stroke={on?C.gold:"#4A5C6A"} strokeWidth="1.8"/><path d="M16.5 16.5L21 21" stroke={on?C.gold:"#4A5C6A"} strokeWidth="1.8" strokeLinecap="round"/></Ic>;
const BellSvg = ({on}) => <Ic size={26}><path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" stroke={on?C.gold:"#4A5C6A"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></Ic>;
const UserSvg = ({on}) => <Ic size={26}><circle cx="12" cy="8" r="4" stroke={on?C.gold:"#4A5C6A"} strokeWidth="1.8"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke={on?C.gold:"#4A5C6A"} strokeWidth="1.8" strokeLinecap="round"/></Ic>;
const ImgSvg = () => <Ic size={20}><rect x="3" y="3" width="18" height="18" rx="3" stroke={C.muted} strokeWidth="1.6"/><circle cx="8.5" cy="8.5" r="1.5" stroke={C.muted} strokeWidth="1.6"/><path d="M21 15l-5-5L5 21" stroke={C.muted} strokeWidth="1.6" strokeLinecap="round"/></Ic>;
const SendSvg = () => <Ic size={16}><path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" stroke={C.bg} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></Ic>;

// ─── AVATAR ───────────────────────────────────────────────────
const Avatar = ({name, size=42, showRing=false, story=false}) => (
  <div style={{
    width:size, height:size, borderRadius:"50%",
    background: story ? `linear-gradient(135deg, ${C.gold}, #E06B2E, #C8185A)` : aColor(name),
    display:"flex", alignItems:"center", justifyContent:"center",
    fontSize: size*0.33, fontWeight:700, color:"#fff",
    fontFamily:"'DM Sans',sans-serif",
    flexShrink:0,
    boxShadow: showRing ? `0 0 0 2px ${C.bg}, 0 0 0 3.5px ${C.gold}` : "none",
  }}>
    {story ? <CrossSvg size={size*0.42} color="#fff"/> : initials(name)}
  </div>
);

// ─── TAG PILL ─────────────────────────────────────────────────
const TagPill = ({tag}) => {
  const s = TAGS[tag]||{bg:"#111",text:"#888",border:"#88822"};
  return <span style={{background:s.bg,color:s.text,border:`1px solid ${s.border}`,fontSize:10,fontWeight:600,padding:"3px 10px",borderRadius:20,fontFamily:"'DM Sans',sans-serif",letterSpacing:"0.04em"}}>{tag}</span>;
};

// ─── COMMENTS SHEET ───────────────────────────────────────────
function CommentsSheet({post, token, user, onClose, onAdded}) {
  const [comments, setComments] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const bottomRef = useRef();

  useEffect(() => {
    sb.getComments(token, post.id).then(d => { if(Array.isArray(d)) setComments(d); }).finally(()=>setLoading(false));
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({behavior:"smooth"}); }, [comments]);

  const submit = async () => {
    if(!text.trim()||posting) return;
    setPosting(true);
    const username = user.user_metadata?.username || user.email?.split("@")[0] || "User";
    const c = { post_id:post.id, user_id:user.id, username, text:text.trim(), created_at:new Date().toISOString() };
    await sb.addComment(token, c);
    setComments(prev => [...prev, {...c, id:Date.now()}]);
    onAdded(post.id);
    setText(""); setPosting(false);
  };

  return (
    <div style={{position:"fixed",inset:0,zIndex:200,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}>
      <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.7)",backdropFilter:"blur(4px)"}} onClick={onClose}/>
      <div style={{position:"relative",background:C.surface,borderRadius:"20px 20px 0 0",maxHeight:"72vh",display:"flex",flexDirection:"column",border:`1px solid ${C.border}`}}>
        {/* Handle */}
        <div style={{display:"flex",justifyContent:"center",padding:"10px 0 0"}}>
          <div style={{width:36,height:4,borderRadius:2,background:C.border}}/>
        </div>
        <div style={{padding:"12px 20px 10px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{color:C.cream,fontSize:14,fontWeight:600,fontFamily:"'DM Sans',sans-serif"}}>{comments.length} comments</span>
          <button onClick={onClose} style={{background:"none",border:"none",color:C.muted,fontSize:22,cursor:"pointer",lineHeight:1,padding:0}}>×</button>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"12px 16px"}}>
          {loading ? (
            <div style={{display:"flex",justifyContent:"center",padding:30}}><div style={{width:24,height:24,border:`2px solid ${C.gold}33`,borderTop:`2px solid ${C.gold}`,borderRadius:"50%",animation:"spin .7s linear infinite"}}/></div>
          ) : comments.length===0 ? (
            <p style={{textAlign:"center",color:C.muted,fontFamily:"'DM Sans',sans-serif",fontSize:13,padding:"24px 0"}}>No comments yet. Start the conversation!</p>
          ) : comments.map(c=>(
            <div key={c.id} style={{display:"flex",gap:10,marginBottom:16}}>
              <Avatar name={c.username} size={32}/>
              <div style={{flex:1}}>
                <span style={{color:C.gold,fontSize:11,fontWeight:600,fontFamily:"'DM Sans',sans-serif",marginRight:8}}>@{c.username}</span>
                <span style={{color:C.muted,fontSize:10}}>{timeAgo(c.created_at)}</span>
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
            <button onClick={submit} disabled={!text.trim()||posting} style={{background:text.trim()?`linear-gradient(135deg,${C.gold},${C.goldDim})`:"#1A2530",border:"none",borderRadius:"50%",width:30,height:30,cursor:text.trim()?"pointer":"default",display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.2s",flexShrink:0}}>
              <SendSvg/>
            </button>
          </div>
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ─── POST CARD ────────────────────────────────────────────────
function PostCard({post, liked, onLike, token, user, onCommentAdded}) {
  const [showComments, setShowComments] = useState(false);
  const [commentCount, setCommentCount] = useState(post.comments||0);
  const [heartBurst, setHeartBurst] = useState(false);
  const lastTap = useRef(0);

  const handleLike = () => { setHeartBurst(true); setTimeout(()=>setHeartBurst(false),400); onLike(); };

  const handleDoubleTap = () => {
    const now = Date.now();
    if(now - lastTap.current < 300) { if(!liked) handleLike(); }
    lastTap.current = now;
  };

  const handleCommentAdded = (pid) => { setCommentCount(c=>c+1); onCommentAdded?.(pid); };

  return (
    <>
      <div onClick={handleDoubleTap} style={{background:C.card,borderRadius:16,marginBottom:2,overflow:"hidden",position:"relative",userSelect:"none"}}>
        {/* Author row */}
        <div style={{display:"flex",alignItems:"center",gap:10,padding:"14px 14px 10px"}}>
          <Avatar name={post.username} size={40} showRing/>
          <div style={{flex:1}}>
            <div style={{color:C.white,fontWeight:600,fontSize:14,fontFamily:"'DM Sans',sans-serif",letterSpacing:"-0.01em"}}>@{post.username}</div>
            <div style={{color:C.muted,fontSize:11,fontFamily:"'DM Sans',sans-serif",marginTop:1}}>{timeAgo(post.created_at)}</div>
          </div>
          <TagPill tag={post.tag}/>
        </div>

        {/* Caption */}
        <p style={{color:C.cream,fontSize:14.5,lineHeight:1.7,fontFamily:"'DM Sans',sans-serif",padding:"0 14px 12px",margin:0,fontWeight:400}}>
          {post.caption}
        </p>

        {/* Image */}
        {post.image_url && (
          <div style={{width:"100%",background:"#050A10"}}>
            <img src={post.image_url} alt="" style={{width:"100%",maxHeight:360,objectFit:"cover",display:"block"}} onError={e=>e.target.style.display="none"}/>
          </div>
        )}

        {/* Double tap heart burst */}
        {heartBurst && (
          <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"none"}}>
            <div style={{fontSize:72,animation:"heartPop .4s ease-out forwards"}}>❤️</div>
          </div>
        )}

        {/* Actions */}
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

      {showComments && <CommentsSheet post={post} token={token} user={user} onClose={()=>setShowComments(false)} onAdded={handleCommentAdded}/>}
      <style>{`@keyframes heartPop{0%{transform:scale(0);opacity:1}60%{transform:scale(1.2);opacity:1}100%{transform:scale(1);opacity:0}}`}</style>
    </>
  );
}

// ─── STORIES ROW ─────────────────────────────────────────────
function StoriesRow({username}) {
  const names = [username, "Adaeze","Pastor E","Tolu","Mercy","Ruth","David","John"];
  return (
    <div style={{display:"flex",gap:14,overflowX:"auto",padding:"16px 14px",scrollbarWidth:"none",borderBottom:`1px solid ${C.border}`}}>
      {names.map((n,i) => (
        <div key={i} style={{flexShrink:0,display:"flex",flexDirection:"column",alignItems:"center",gap:5}}>
          <div style={{padding:2,borderRadius:"50%",background:i===0?"none":`linear-gradient(135deg,${C.gold},#E06B2E)`,}}>
            <div style={{padding:2,borderRadius:"50%",background:C.bg}}>
              {i===0
                ? <div style={{width:52,height:52,borderRadius:"50%",background:`linear-gradient(135deg,${C.gold},${C.goldDim})`,display:"flex",alignItems:"center",justifyContent:"center",border:`2px dashed ${C.gold}88`}}><span style={{color:C.bg,fontSize:22,fontWeight:700}}>+</span></div>
                : <Avatar name={n} size={52}/>
              }
            </div>
          </div>
          <span style={{color:C.muted,fontSize:10,fontFamily:"'DM Sans',sans-serif",maxWidth:56,textAlign:"center",overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{i===0?"Your Story":n}</span>
        </div>
      ))}
    </div>
  );
}

// ─── FEED SCREEN ─────────────────────────────────────────────
function FeedScreen({posts, likedIds, onLike, token, user, loading, onCommentAdded}) {
  const username = user.user_metadata?.username || user.email?.split("@")[0] || "You";

  if(loading) return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"60vh",gap:16}}>
      <CrossSvg size={36}/>
      <span style={{color:C.muted,fontSize:13,fontFamily:"'DM Sans',sans-serif"}}>Loading your feed...</span>
    </div>
  );

  return (
    <div>
      <StoriesRow username={username}/>
      <div style={{padding:"12px 0"}}>
        {posts.length===0 ? (
          <div style={{textAlign:"center",padding:"60px 24px"}}>
            <div style={{fontSize:40,marginBottom:12}}>✝️</div>
            <p style={{color:C.muted,fontFamily:"'DM Sans',sans-serif",fontSize:14}}>No posts yet. Be the first to share your faith!</p>
          </div>
        ) : posts.map(p => (
          <PostCard key={p.id} post={p} liked={likedIds.includes(p.id)} onLike={()=>onLike(p)} token={token} user={user} onCommentAdded={onCommentAdded}/>
        ))}
      </div>
    </div>
  );
}

// ─── EXPLORE SCREEN ──────────────────────────────────────────
function ExploreScreen() {
  const [query, setQuery] = useState("");
  const trends = [
    {title:"40 Days of Prayer",members:"2.3k",tag:"Prayer",emoji:"🙏"},
    {title:"Book of Psalms",members:"1.8k",tag:"Scripture",emoji:"📖"},
    {title:"Sunday Testimonies",members:"4.1k",tag:"Testimony",emoji:"🔥"},
    {title:"Morning Devotions",members:"987",tag:"Devotion",emoji:"🌅"},
    {title:"Worship Night",members:"1.2k",tag:"Worship",emoji:"🎵"},
  ];
  return (
    <div style={{padding:"16px 14px"}}>
      <div style={{background:C.card,borderRadius:14,border:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:10,padding:"12px 16px",marginBottom:20}}>
        <SearchSvg on/>
        <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search faith content, people..." style={{background:"none",border:"none",outline:"none",color:C.cream,fontSize:14,flex:1,fontFamily:"'DM Sans',sans-serif"}}/>
      </div>

      <div style={{marginBottom:22}}>
        <p style={{color:C.muted,fontSize:11,fontFamily:"'DM Sans',sans-serif",fontWeight:600,letterSpacing:"0.1em",marginBottom:10}}>BROWSE BY TOPIC</p>
        <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
          {Object.entries(TAGS).map(([tag,s])=>(
            <button key={tag} style={{background:s.bg,color:s.text,border:`1px solid ${s.border}`,borderRadius:22,padding:"8px 16px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",letterSpacing:"0.02em"}}>{tag}</button>
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

// ─── CREATE POST SCREEN ───────────────────────────────────────
function CreateScreen({token, user, onPosted}) {
  const [text, setText] = useState("");
  const [tag, setTag] = useState("Scripture");
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [stage, setStage] = useState("idle"); // idle|checking|uploading|posting|done|flagged
  const [flagReason, setFlagReason] = useState("");
  const fileRef = useRef();
  const username = user.user_metadata?.username || user.email?.split("@")[0] || "User";

  const pickImage = (e) => {
    const f = e.target.files[0]; if(!f) return;
    setImage(f);
    const reader = new FileReader(); reader.onload = ev => setPreview(ev.target.result); reader.readAsDataURL(f);
  };

  const post = async () => {
    if(!text.trim()) return;
    setStage("checking");
    const mod = await moderate(text);
    if(mod.decision==="flagged") { setFlagReason(mod.reason||"Content does not meet community guidelines."); setStage("flagged"); return; }
    setStage("uploading");
    let image_url = null;
    if(image) { try { image_url = await sb.uploadImage(token, user.id, image); } catch(e){} }
    setStage("posting");
    const status = mod.decision==="approved" ? "approved" : "pending";
    const newPost = { caption:text, tag, user_id:user.id, username, status, likes:0, comments:0, image_url, created_at:new Date().toISOString() };
    await sb.createPost(token, newPost);
    setStage("done");
    onPosted({...newPost, id:Date.now()});
    setTimeout(()=>{ setText(""); setImage(null); setPreview(null); setStage("idle"); },1500);
  };

  const stageMsg = {idle:"Share",checking:"Reviewing...",uploading:"Uploading...",posting:"Posting...",done:"Posted ✓",flagged:"Try Again"};
  const busy = ["checking","uploading","posting"].includes(stage);

  return (
    <div style={{padding:"16px 14px"}}>
      {/* Author preview */}
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
        <Avatar name={username} size={42} showRing/>
        <div>
          <div style={{color:C.white,fontWeight:600,fontSize:14,fontFamily:"'DM Sans',sans-serif"}}>@{username}</div>
          <TagPill tag={tag}/>
        </div>
      </div>

      {/* Text input */}
      <textarea value={text} onChange={e=>setText(e.target.value)} placeholder="What's on your heart today? Share a scripture, testimony, or praise..." style={{width:"100%",minHeight:130,background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:"14px 16px",color:C.cream,fontSize:15,lineHeight:1.7,fontFamily:"'DM Sans',sans-serif",outline:"none",resize:"none",boxSizing:"border-box"}}/>

      {/* Image preview */}
      {preview && (
        <div style={{position:"relative",marginTop:10,borderRadius:12,overflow:"hidden"}}>
          <img src={preview} alt="preview" style={{width:"100%",maxHeight:240,objectFit:"cover",display:"block"}}/>
          <button onClick={()=>{setImage(null);setPreview(null);}} style={{position:"absolute",top:8,right:8,background:"rgba(0,0,0,0.7)",border:"none",borderRadius:"50%",width:28,height:28,color:"#fff",cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
        </div>
      )}

      {/* Tag selector */}
      <div style={{marginTop:14}}>
        <p style={{color:C.muted,fontSize:11,fontFamily:"'DM Sans',sans-serif",fontWeight:600,letterSpacing:"0.08em",marginBottom:8}}>CONTENT TYPE</p>
        <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
          {Object.entries(TAGS).map(([t,s])=>{
            const active = tag===t;
            return <button key={t} onClick={()=>setTag(t)} style={{background:active?s.text:s.bg,color:active?"#080C10":s.text,border:`1px solid ${active?s.text:s.border}`,borderRadius:22,padding:"7px 14px",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",transition:"all 0.18s"}}>{t}</button>;
          })}
        </div>
      </div>

      {/* Add photo */}
      <button onClick={()=>fileRef.current?.click()} style={{display:"flex",alignItems:"center",gap:8,background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"10px 14px",color:C.muted,fontSize:13,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",marginTop:14,width:"100%"}}>
        <ImgSvg/> Add a photo
      </button>
      <input ref={fileRef} type="file" accept="image/*" onChange={pickImage} style={{display:"none"}}/>

      {/* Flagged message */}
      {stage==="flagged" && (
        <div style={{background:"#1E0A0A",border:`1px solid ${C.red}44`,borderRadius:12,padding:"12px 14px",marginTop:14}}>
          <p style={{color:C.red,fontSize:13,fontFamily:"'DM Sans',sans-serif",margin:"0 0 8px",fontWeight:600}}>🚫 Post couldn't be published</p>
          <p style={{color:"#C08080",fontSize:12,fontFamily:"'DM Sans',sans-serif",margin:0,lineHeight:1.5}}>{flagReason}</p>
        </div>
      )}

      {/* Faith note */}
      {stage!=="flagged" && (
        <div style={{display:"flex",gap:8,padding:"10px 12px",background:"#0A0F18",borderRadius:10,marginTop:14,border:`1px solid ${C.border}`}}>
          <CrossSvg size={14}/>
          <p style={{color:"#3A4E5A",fontSize:11,fontFamily:"'DM Sans',sans-serif",margin:0,lineHeight:1.5}}>Posts are reviewed by our AI + faith moderators to keep this community Christ-centered.</p>
        </div>
      )}

      {/* Submit */}
      <button onClick={stage==="flagged"?()=>{setStage("idle");setFlagReason("");}:post} disabled={(!text.trim()&&stage!=="flagged")||busy} style={{width:"100%",padding:"15px",background:stage==="done"?"#0E2A1A":stage==="flagged"?C.card:`linear-gradient(135deg,${C.gold},${C.goldDim})`,color:stage==="done"?C.green:stage==="flagged"?C.muted:"#080C10",border:stage==="flagged"?`1px solid ${C.border}`:"none",borderRadius:16,fontSize:15,fontWeight:700,fontFamily:"'DM Sans',sans-serif",cursor:(!text.trim()&&stage!=="flagged")||busy?"not-allowed":"pointer",opacity:(!text.trim()&&stage==="idle")?0.5:1,marginTop:16,letterSpacing:"0.02em",transition:"all 0.25s"}}>
        {stageMsg[stage]||"Share"}
      </button>
    </div>
  );
}

// ─── PROFILE SCREEN ───────────────────────────────────────────
function ProfileScreen({user, token, onSignOut}) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const username = user.user_metadata?.username || user.email?.split("@")[0] || "Believer";

  useEffect(()=>{
    sb.getMyPosts(token, user.id).then(d=>{ if(Array.isArray(d)) setPosts(d); }).finally(()=>setLoading(false));
  },[]);

  const approved = posts.filter(p=>p.status==="approved").length;
  const pending = posts.filter(p=>p.status==="pending").length;
  const flagged = posts.filter(p=>p.status==="flagged").length;

  return (
    <div>
      {/* Cover gradient */}
      <div style={{height:120,background:`linear-gradient(160deg,${C.goldDim}22,${C.bg})`,position:"relative",marginBottom:56}}>
        <div style={{position:"absolute",bottom:-44,left:"50%",transform:"translateX(-50%)"}}>
          <div style={{width:88,height:88,borderRadius:"50%",background:`linear-gradient(135deg,${C.gold},${C.goldDim})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:30,fontWeight:700,color:C.bg,fontFamily:"'Playfair Display',serif",border:`3px solid ${C.bg}`,boxShadow:`0 0 0 3px ${C.gold}55`}}>
            {initials(username)}
          </div>
        </div>
      </div>

      <div style={{textAlign:"center",padding:"0 20px",marginBottom:20}}>
        <div style={{color:C.white,fontSize:18,fontWeight:700,fontFamily:"'Playfair Display',serif"}}>{username}</div>
        <div style={{color:C.gold,fontSize:11,fontFamily:"'DM Sans',sans-serif",marginTop:3,letterSpacing:"0.08em"}}>✝️ Verified Believer</div>
      </div>

      {/* Stats */}
      <div style={{display:"flex",margin:"0 14px 20px",background:C.card,border:`1px solid ${C.border}`,borderRadius:16,overflow:"hidden"}}>
        {[{l:"Posts",v:posts.length},{l:"Followers",v:"—"},{l:"Following",v:"—"}].map((s,i)=>(
          <div key={i} style={{flex:1,padding:"14px 8px",textAlign:"center",borderRight:i<2?`1px solid ${C.border}`:"none"}}>
            <div style={{color:C.gold,fontSize:20,fontWeight:700,fontFamily:"'Playfair Display',serif"}}>{s.v}</div>
            <div style={{color:C.muted,fontSize:10,fontFamily:"'DM Sans',sans-serif",marginTop:2,letterSpacing:"0.06em"}}>{s.l.toUpperCase()}</div>
          </div>
        ))}
      </div>

      {/* Moderation summary */}
      {(pending>0||flagged>0) && (
        <div style={{margin:"0 14px 16px",background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"12px 14px",display:"flex",gap:16}}>
          {pending>0&&<span style={{color:C.amber,fontSize:12,fontFamily:"'DM Sans',sans-serif"}}>⏳ {pending} under review</span>}
          {flagged>0&&<span style={{color:C.red,fontSize:12,fontFamily:"'DM Sans',sans-serif"}}>🚫 {flagged} flagged</span>}
        </div>
      )}

      {/* Post grid */}
      <div style={{padding:"0 14px"}}>
        <p style={{color:C.muted,fontSize:11,fontWeight:600,letterSpacing:"0.1em",fontFamily:"'DM Sans',sans-serif",marginBottom:10}}>MY POSTS</p>
        {loading ? <div style={{display:"flex",justifyContent:"center",padding:30}}><div style={{width:24,height:24,border:`2px solid ${C.gold}33`,borderTop:`2px solid ${C.gold}`,borderRadius:"50%",animation:"spin .7s linear infinite"}}/></div>
        : posts.length===0 ? <p style={{color:C.muted,textAlign:"center",fontFamily:"'DM Sans',sans-serif",fontSize:13,padding:"20px 0"}}>No posts yet</p>
        : posts.map(p=>(
          <div key={p.id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:"12px 14px",marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <TagPill tag={p.tag}/>
              <span style={{color:p.status==="approved"?C.green:p.status==="flagged"?C.red:C.amber,fontSize:10,fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>
                {p.status==="approved"?"✓ Live":p.status==="flagged"?"🚫 Flagged":"⏳ Reviewing"}
              </span>
            </div>
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

// ─── NOTIFICATIONS SCREEN ─────────────────────────────────────
function NotificationsScreen() {
  const items = [
    {text:"Your post went live ✓",sub:"Approved by our moderation team",time:"2m",icon:"✅",unread:true},
    {text:"Pastor_Emeka liked your testimony",sub:"",time:"18m",icon:"❤️",unread:true},
    {text:"Grace_Adaeze started following you",sub:"",time:"1h",icon:"🙏",unread:false},
    {text:"New community challenge",sub:"30 Days of Prayer — join 2.3k believers",time:"2h",icon:"📣",unread:false},
    {text:"FaithWalker_Tolu replied to your comment",sub:'"Amen! This really blessed me"',time:"3h",icon:"💬",unread:false},
    {text:"Your post was shared",sub:"Shared by 4 people in the community",time:"5h",icon:"📤",unread:false},
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
        if(d.error){setError(d.error.message);return;}
        setMode("login"); setError("✅ Account created! Check your email to verify, then sign in.");
      } else {
        const d = await sb.signIn(email, password);
        if(d.error){setError(d.error.message);return;}
        onAuth(d.user, d.access_token);
      }
    } catch(e) { setError("Connection error. Please try again."); }
    finally { setLoading(false); }
  };

  return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",flexDirection:"column",position:"relative",overflow:"hidden"}}>
      {/* Background decoration */}
      <div style={{position:"absolute",top:-100,right:-100,width:350,height:350,borderRadius:"50%",background:`radial-gradient(circle,${C.gold}08,transparent 70%)`,pointerEvents:"none"}}/>
      <div style={{position:"absolute",bottom:-80,left:-80,width:280,height:280,borderRadius:"50%",background:`radial-gradient(circle,${C.goldDim}06,transparent 70%)`,pointerEvents:"none"}}/>

      {/* Top logo area */}
      <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"40px 32px 24px"}}>
        <div style={{width:80,height:80,borderRadius:28,background:`linear-gradient(145deg,${C.gold},${C.goldDim})`,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:20,boxShadow:`0 12px 40px ${C.gold}33`}}>
          <CrossSvg size={36} color={C.bg}/>
        </div>
        <h1 style={{fontSize:36,fontWeight:700,color:C.white,fontFamily:"'Playfair Display',serif",margin:"0 0 6px",letterSpacing:"-0.02em"}}>Hallelujah</h1>
        <p style={{color:C.muted,fontSize:13,fontFamily:"'DM Sans',sans-serif",margin:0,letterSpacing:"0.08em"}}>A COMMUNITY OF FAITH</p>
      </div>

      {/* Form card */}
      <div style={{background:C.surface,borderRadius:"28px 28px 0 0",border:`1px solid ${C.border}`,padding:"28px 24px 40px"}}>
        <h2 style={{color:C.white,fontSize:20,fontWeight:600,fontFamily:"'Playfair Display',serif",margin:"0 0 20px",textAlign:"center"}}>
          {mode==="login"?"Welcome back":"Join the community"}
        </h2>

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

        <button onClick={submit} disabled={loading} style={{width:"100%",padding:16,background:`linear-gradient(135deg,${C.gold},${C.goldDim})`,color:C.bg,border:"none",borderRadius:16,fontSize:15,fontWeight:700,fontFamily:"'DM Sans',sans-serif",cursor:"pointer",letterSpacing:"0.02em",marginBottom:16,opacity:loading?0.7:1,transition:"opacity 0.2s"}}>
          {loading?"Please wait...":(mode==="login"?"Sign In":"Create Account")}
        </button>

        <p style={{textAlign:"center",color:C.muted,fontSize:13,fontFamily:"'DM Sans',sans-serif",margin:0}}>
          {mode==="login"?"Don't have an account? ":"Already have one? "}
          <button onClick={()=>{setMode(mode==="login"?"signup":"login");setError("");}} style={{background:"none",border:"none",color:C.gold,fontSize:13,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",textDecoration:"underline",textUnderlineOffset:2}}>
            {mode==="login"?"Sign up":"Sign in"}
          </button>
        </p>

        <p style={{textAlign:"center",color:"#283340",fontSize:11,fontFamily:"'DM Sans',sans-serif",marginTop:16,lineHeight:1.5}}>
          By joining, you agree to share only Christ-centered content.
        </p>
      </div>
    </div>
  );
}

// ─── BOTTOM NAV ───────────────────────────────────────────────
function BottomNav({tab, setTab}) {
  const items = [
    {id:"home",label:"Home",icon:(on)=><HomeSvg on={on}/>},
    {id:"explore",label:"Explore",icon:(on)=><SearchSvg on={on}/>},
    {id:"create",label:"",icon:()=>null},
    {id:"notifications",label:"Alerts",icon:(on)=><BellSvg on={on}/>},
    {id:"profile",label:"Me",icon:(on)=><UserSvg on={on}/>},
  ];
  return (
    <div style={{position:"fixed",bottom:0,left:0,right:0,width:"100%",background:`${C.bg}F2`,backdropFilter:"blur(16px)",WebkitBackdropFilter:"blur(16px)",borderTop:`1px solid ${C.border}`,display:"flex",alignItems:"center",padding:"8px 0 20px",zIndex:50}}>
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

// ─── ROOT APP ─────────────────────────────────────────────────
export default function App() {
  const [auth, setAuth] = useState(null);
  const [tab, setTab] = useState("home");
  const [posts, setPosts] = useState([]);
  const [likedIds, setLikedIds] = useState([]);
  const [feedLoading, setFeedLoading] = useState(false);

  const handleAuth = (user, token) => setAuth({user, token});
  const handleSignOut = async () => { await sb.signOut(auth.token); setAuth(null); setPosts([]); setLikedIds([]); };

  useEffect(()=>{
    if(!auth) return;
    setFeedLoading(true);
    Promise.all([sb.getPosts(auth.token), sb.getMyLikes(auth.token, auth.user.id)])
      .then(([p,l])=>{ if(Array.isArray(p)) setPosts(p); if(Array.isArray(l)) setLikedIds(l); })
      .finally(()=>setFeedLoading(false));
  },[auth]);

  const handleLike = async (post) => {
    const liked = likedIds.includes(post.id);
    setLikedIds(prev => liked ? prev.filter(id=>id!==post.id) : [...prev, post.id]);
    setPosts(prev => prev.map(p => p.id===post.id ? {...p, likes: liked ? p.likes-1 : p.likes+1} : p));
    await sb.toggleLike(auth.token, post.id, auth.user.id, liked, post.likes);
  };

  const handlePosted = (newPost) => { setPosts(prev=>[newPost,...prev]); setTab("home"); };
  const handleCommentAdded = (postId) => { setPosts(prev=>prev.map(p=>p.id===postId?{...p,comments:(p.comments||0)+1}:p)); };

  if(!auth) return <AuthScreen onAuth={handleAuth}/>;

  return (
    <div style={{minHeight:"100vh",background:C.bg,color:C.cream,position:"relative",fontFamily:"'DM Sans',sans-serif"}}>
      {/* Top bar */}
      <div style={{padding:"14px 18px 12px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,background:`${C.bg}F5`,backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)",zIndex:40,borderBottom:`1px solid ${C.border}33`}}>
        <div style={{display:"flex",alignItems:"center",gap:7}}>
          <CrossSvg size={20}/>
          <span style={{fontSize:20,fontWeight:700,color:C.gold,fontFamily:"'Playfair Display',serif",letterSpacing:"-0.01em"}}>Hallelujah</span>
        </div>
        <div style={{width:7,height:7,borderRadius:"50%",background:C.green,boxShadow:`0 0 8px ${C.green}`}}/>
      </div>

      {/* Screen content */}
      <div style={{paddingBottom:90}}>
        {tab==="home"        && <FeedScreen posts={posts} likedIds={likedIds} onLike={handleLike} token={auth.token} user={auth.user} loading={feedLoading} onCommentAdded={handleCommentAdded}/>}
        {tab==="explore"     && <ExploreScreen/>}
        {tab==="create"      && <CreateScreen token={auth.token} user={auth.user} onPosted={handlePosted}/>}
        {tab==="notifications"&&<NotificationsScreen/>}
        {tab==="profile"     && <ProfileScreen user={auth.user} token={auth.token} onSignOut={handleSignOut}/>}
      </div>

      <BottomNav tab={tab} setTab={setTab}/>
    </div>
  );
}
