# Trainelo Deployment Checklist

## Pre-Deployment
- [ ] All code changes committed and pushed to Git
- [ ] `.env` file is NOT committed (check .gitignore)
- [ ] Build works locally (`npm run build`)
- [ ] Tests pass (if applicable)
- [ ] PWA icons are generated

## Supabase Setup
- [ ] Database migrations are applied
- [ ] RLS (Row Level Security) is enabled on all tables
- [ ] Authentication providers are configured
- [ ] Get and note down:
  - [ ] Project URL
  - [ ] Anon/Public Key

## Vercel Deployment
- [ ] Repository connected to Vercel
- [ ] Environment variables added:
  - [ ] `VITE_SUPABASE_URL`
  - [ ] `VITE_SUPABASE_PUBLISHABLE_KEY`
- [ ] Build settings confirmed:
  - Framework: Vite
  - Build Command: `npm run build`
  - Output Directory: `dist`

## Post-Deployment Verification
- [ ] Site loads without errors
- [ ] Authentication works (sign up, sign in, sign out)
- [ ] Database operations work (create, read, update, delete)
- [ ] PWA installs correctly
- [ ] Service worker registers and caches assets
- [ ] All routes work (no 404s)

## Supabase Configuration
- [ ] Add Vercel domain to Supabase allowed URLs:
  - [ ] Site URL
  - [ ] Redirect URLs
- [ ] Test email authentication (if using)

## Performance & Security
- [ ] HTTPS is working (automatic on Vercel)
- [ ] Security headers are applied
- [ ] No console errors in production
- [ ] No exposed API keys in source code

## Optional
- [ ] Custom domain configured
- [ ] Analytics setup (if using)
- [ ] Error tracking setup (e.g., Sentry)
- [ ] Backup strategy in place

## Quick Commands

```bash
# Deploy to preview
vercel

# Deploy to production
vercel --prod

# Check deployment status
vercel ls

# View logs
vercel logs
```