# Hallelujah App — Vercel Deployment Guide

## ✅ Pre-Deployment Checklist

Your app is now configured for deployment! Here's what to do next:

### 1. **Local Testing**
```bash
npm install
npm run dev
```
- Test login/signup in demo mode
- Verify all UI components render correctly
- Test responsive design on mobile

### 2. **Get Claude API Key** (for AI moderation)
- Go to https://console.anthropic.com
- Create an account or sign in
- Generate an API key
- Save it somewhere safe

### 3. **Set Up Supabase Database** (if not already done)
Your Supabase URL is already configured. You need to create tables:

#### Create `posts` table:
```sql
CREATE TABLE posts (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  username TEXT NOT NULL,
  caption TEXT NOT NULL,
  tag TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  likes INT DEFAULT 0,
  comments INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### Create `likes` table:
```sql
CREATE TABLE likes (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);
```

Run these in Supabase SQL Editor.

### 4. **Deploy to Vercel**

#### Option A: Via Vercel CLI
```bash
npm install -g vercel
vercel
```

#### Option B: Via GitHub
1. Push your repo to GitHub
2. Go to https://vercel.com
3. Click "New Project"
4. Import your GitHub repository
5. Click "Deploy"

### 5. **Add Environment Variables to Vercel**

After deployment, add these in Vercel Dashboard:

**Settings → Environment Variables**

```
VITE_SUPABASE_URL = https://vvmnltsqostfswdobern.supabase.co
VITE_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ2bW5sdHNxb3N0ZnN3ZG9iZXJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2MDQ5ODQsImV4cCI6MjA5NjE4MDk4NH0.DqKhf_RDJfWix6Rre7IFGEy9NJsbdgjkQ125lb9oS5c
VITE_ANTHROPIC_API_KEY = your_claude_api_key_here
```

### 6. **Redeploy After Adding Secrets**
After adding environment variables, redeploy your project.

---

## 🔐 Security Best Practices

✅ **DO:**
- Store secrets in Vercel's environment variables
- Never commit `.env.local` to GitHub
- Regenerate keys if they're ever exposed
- Use Row-Level Security (RLS) in Supabase

❌ **DON'T:**
- Hardcode API keys in source code
- Share `.env.local` files
- Expose keys in GitHub issues/commits
- Use the same key across multiple projects

---

## 📱 Mobile Optimization

Your app is already configured for mobile:
- Responsive viewport meta tag in `index.html`
- Mobile-first design (max-width: 430px)
- Bottom navigation with safe area insets
- Touch-friendly buttons (48px minimum)

---

## 🚀 After Deployment

1. **Test the live site**
   - Test signup/login
   - Create posts (make sure moderation works)
   - Like/comment
   - Check mobile view

2. **Monitor Performance**
   - Check Vercel Analytics
   - Monitor API response times
   - Set up error tracking (optional: Sentry)

3. **Next Steps**
   - Add profile image upload
   - Implement comments feature
   - Add follow/unfollow
   - Create admin dashboard

---

## 🛠 Troubleshooting

### "Module not found" errors
```bash
npm install
npm run build
```

### Supabase authentication not working
- Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are correct
- Check Supabase project settings → Auth → Redirect URLs
- Add your Vercel domain: `https://your-app.vercel.app/`

### AI moderation not working
- Verify `VITE_ANTHROPIC_API_KEY` is set
- Check Claude API account has credits
- Test API key at https://console.anthropic.com

### Build fails
```bash
npm run build  # Test locally first
```

---

## 📞 Support

- **Vercel Docs**: https://vercel.com/docs
- **Supabase Docs**: https://supabase.com/docs
- **Claude API Docs**: https://docs.anthropic.com

---

**Your app is ready! 🚀**