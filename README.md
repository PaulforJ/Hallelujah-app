# 🙏 Hallelujah — A Community of Faith

A beautiful, Christ-centered social media platform built with React, Supabase, and Claude AI for community moderation.

![Hallelujah](https://img.shields.io/badge/Faith-Community-gold?style=flat-square)
![Status](https://img.shields.io/badge/Status-Ready%20for%20Deployment-green?style=flat-square)
![React](https://img.shields.io/badge/React-18-blue?style=flat-square)
![Vite](https://img.shields.io/badge/Build-Vite-purple?style=flat-square)

---

## ✨ Features

- 🔐 **Secure Authentication** — Supabase Auth with email verification
- 📱 **Mobile-First Design** — Responsive, touch-optimized interface
- ✝️ **Faith-Centered Feed** — Share Scripture, testimonies, devotions, and sermons
- 🤖 **AI Moderation** — Claude-powered content review (approved/flagged)
- ❤️ **Engagement** — Like posts, follow users, get notifications
- 🏷️ **Smart Tagging** — Organize posts: Scripture, Sermon, Devotion, Testimony, Prayer, Worship
- 🌙 **Beautiful Theme** — Gold & deep blue design for a contemplative experience

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Environment Variables
Create `.env.local`:
```env
VITE_SUPABASE_URL=https://vvmnltsqostfswdobern.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ2bW5sdHNxb3N0ZnN3ZG9iZXJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2MDQ5ODQsImV4cCI6MjA5NjE4MDk4NH0.DqKhf_RDJfWix6Rre7IFGEy9NJsbdgjkQ125lb9oS5c
VITE_ANTHROPIC_API_KEY=your_claude_api_key_here
```

### 3. Run Locally
```bash
npm run dev
```
Visit: http://localhost:3000

### 4. Build for Production
```bash
npm run build
npm run preview
```

---

## 📋 Project Structure

```
hallelujah-app/
├── src/
│   ├── App.jsx           # Main React component
│   └── main.jsx          # React entry point
├── index.html            # HTML entry point
├── vite.config.js        # Vite configuration
├── package.json          # Dependencies
├── .env.local            # Local environment (not committed)
├── .env.example          # Template for env vars
├── .gitignore            # Git ignore rules
├── vercel.json           # Vercel deployment config
├── DEPLOYMENT.md         # Vercel deployment guide
└── README.md             # This file
```

---

## 🔧 Tech Stack

| Technology | Purpose |
|-----------|--------|
| **React 18** | Frontend framework |
| **Vite** | Fast build tool & dev server |
| **Supabase** | Backend (Auth + Database) |
| **Claude API** | AI content moderation |
| **CSS-in-JS** | Inline styling (no external CSS) |

---

## 📱 Demo Mode

The app works without Supabase keys! It includes sample posts from:
- Grace_Adaeze: Scripture shares
- Pastor_Emeka: Sermon recaps
- Mercy_Okonkwo: Devotions
- FaithWalker_Tolu: Testimonies

Create an account with any email in demo mode (no verification needed).

---

## 🔐 Authentication Flow

```
1. User signs up with email + password + username
2. Supabase sends verification email
3. User logs in with email + password
4. JWT token stored in browser
5. All API calls authenticated with Bearer token
```

---

## 🤖 AI Moderation System

Posts are automatically reviewed by Claude AI:

**APPROVED**: Scripture, prayers, testimonies, sermons, worship, devotions, faith encouragement
**FLAGGED**: Sexual content, violence, hate speech, profanity, propaganda, non-Christian content

Status indicators:
- ✅ **Approved** — Immediately live on feed
- ⏳ **Pending** — Awaiting human review
- 🚫 **Flagged** — Doesn't meet community guidelines

---

## 📊 Database Schema

### `posts` table
```sql
id (Primary Key)
user_id (Foreign Key → users)
username (Text)
caption (Text)
tag (Enum: Scripture, Sermon, Devotion, Testimony, Prayer, Worship)
status (Enum: pending, approved, flagged)
likes (Integer)
comments (Integer)
created_at (Timestamp)
```

### `likes` table
```sql
id (Primary Key)
post_id (Foreign Key → posts)
user_id (Foreign Key → users)
created_at (Timestamp)
UNIQUE constraint on (post_id, user_id)
```

---

## 🌐 Deploy to Vercel

### Step 1: Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/hallelujah-app.git
git push -u origin main
```

### Step 2: Deploy via Vercel
- Go to https://vercel.com
- Click "New Project"
- Import your GitHub repository
- Vercel will auto-detect Vite configuration
- Click "Deploy"

### Step 3: Add Secrets
In Vercel Dashboard → Settings → Environment Variables, add:

```
VITE_SUPABASE_URL=https://vvmnltsqostfswdobern.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_ANTHROPIC_API_KEY=sk-ant-...
```

### Step 4: Redeploy
Click "Redeploy" after adding secrets to pick up environment variables.

---

## 🎨 Design System

### Color Palette
- **Gold (#C9A84C)** — Primary accent, interactive elements
- **Deep Blue (#0D1B2A)** — Background, structural elements
- **Cream (#F5F0E8)** — Text, foreground
- **Green (#4CAF7D)** — Success states, approvals
- **Red (#E05555)** — Error states, flagged content
- **Warm Brown (#8B6914)** — Secondary accent

### Typography
- **Georgia serif** — Main font, elegant and readable
- **Courier New monospace** — Labels, tags, technical text

### UI Components
- 5-tab bottom navigation (Home, Explore, Create, Alerts, Profile)
- Post cards with rich metadata
- Contextual tag system with color coding
- Moderation status badges
- Mobile-optimized forms

---

## 🛡️ Security Checklist

- ✅ API keys stored in environment variables (never hardcoded)
- ✅ JWT authentication with Bearer tokens
- ✅ `.env.local` protected in `.gitignore`
- ✅ HTTPS enforced by Vercel
- ✅ Supabase Row-Level Security (RLS) available
- ✅ CORS configured for Vercel domains

---

## 📞 Troubleshooting

| Issue | Solution |
|-------|----------|
| "Cannot find module" | Run `npm install` |
| Auth not working | Verify Supabase URL/key in `.env.local` |
| Build fails | Run `npm run build` locally to debug |
| Styling broken | Clear browser cache, hard refresh (Ctrl+Shift+R) |
| AI moderation errors | Check Claude API key has credits at console.anthropic.com |
| Posts not saving | Check Supabase database tables exist (see DEPLOYMENT.md) |

---

## 🚀 Roadmap (Coming Soon)

- [ ] Profile image uploads (Supabase Storage)
- [ ] Comments system with threaded replies
- [ ] Follow/unfollow functionality
- [ ] User search and discovery
- [ ] Trending posts and hashtags
- [ ] Admin moderation dashboard
- [ ] Push notifications
- [ ] Dark/light mode toggle
- [ ] PWA support (installable app)
- [ ] Post scheduling

---

## 📄 License

MIT License — Free for personal and commercial use

---

## 🙏 Contributing

We welcome contributions! Areas we need help:

- 🐛 Bug fixes and testing
- 🎨 UI/UX improvements
- ⚡ Performance optimization
- 📝 Documentation improvements
- ✨ Feature implementations

---

## ✝️ Mission

Hallelujah is built to create a safe, Christ-centered space where believers can share their faith, encourage one another, and build community around Scripture, prayer, and worship.

> "Let the peace of Christ rule in your hearts, since as members of one body you were called to peace." — Colossians 3:15

---

## 📖 Getting Help

- 📚 [Vercel Documentation](https://vercel.com/docs)
- 🗄️ [Supabase Documentation](https://supabase.com/docs)
- 🤖 [Claude API Documentation](https://docs.anthropic.com)
- 💬 [Vite Documentation](https://vitejs.dev)

---

**Ready to launch your community? Follow the [DEPLOYMENT.md](./DEPLOYMENT.md) guide!**

🌟 **Share this project if you believe in building faith-centered communities.**