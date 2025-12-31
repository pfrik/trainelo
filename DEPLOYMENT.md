# Trainelo Deployment Guide - Vercel

This guide will walk you through deploying Trainelo to Vercel.

## Prerequisites

1. A Vercel account (https://vercel.com/signup)
2. A Supabase project (https://app.supabase.com)
3. Git repository with your code
4. Node.js 18+ installed locally

## Environment Variables

You'll need the following environment variables from your Supabase project:

- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` - Your Supabase anon/public key

### Getting Supabase Credentials

1. Go to https://app.supabase.com
2. Select your project
3. Navigate to Settings → API
4. Copy the following values:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **Anon/Public Key** → `VITE_SUPABASE_PUBLISHABLE_KEY`

## Deployment Methods

### Method 1: Deploy via Vercel Dashboard (Recommended)

1. **Push your code to GitHub/GitLab/Bitbucket**
   ```bash
   git add .
   git commit -m "Prepare for Vercel deployment"
   git push origin main
   ```

2. **Import to Vercel**
   - Go to https://vercel.com/dashboard
   - Click "Add New..." → "Project"
   - Import your Git repository
   - Select the repository containing Trainelo

3. **Configure Project**
   - Framework Preset: **Vite** (should be auto-detected)
   - Build Command: `npm run build` (default)
   - Output Directory: `dist` (default)
   - Install Command: `npm install` (default)

4. **Add Environment Variables**
   - Click on "Environment Variables"
   - Add the following variables:
     ```
     VITE_SUPABASE_URL=your-supabase-url
     VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-anon-key
     ```

5. **Deploy**
   - Click "Deploy"
   - Wait for the build to complete (usually 1-2 minutes)

### Method 2: Deploy via Vercel CLI

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**
   ```bash
   vercel login
   ```

3. **Create .env file locally** (for testing)
   ```bash
   cp .env.example .env
   # Edit .env with your actual Supabase credentials
   ```

4. **Deploy to Vercel**
   ```bash
   vercel
   ```

   Follow the prompts:
   - Set up and deploy: **Y**
   - Which scope: Select your account
   - Link to existing project? **N** (for first deployment)
   - Project name: **trainelo** (or your preference)
   - Directory: **./** (current directory)
   - Override settings? **N**

5. **Set Environment Variables**
   ```bash
   # Set production environment variables
   vercel env add VITE_SUPABASE_URL production
   vercel env add VITE_SUPABASE_PUBLISHABLE_KEY production

   # Set preview environment variables (for branch deployments)
   vercel env add VITE_SUPABASE_URL preview
   vercel env add VITE_SUPABASE_PUBLISHABLE_KEY preview
   ```

6. **Deploy to Production**
   ```bash
   vercel --prod
   ```

## Post-Deployment Configuration

### 1. Update Supabase Allowed URLs

1. Go to Supabase Dashboard → Authentication → URL Configuration
2. Add your Vercel domains to:
   - **Site URL**: `https://your-app.vercel.app`
   - **Redirect URLs**:
     ```
     https://your-app.vercel.app/**
     https://your-custom-domain.com/**
     ```

### 2. Configure Custom Domain (Optional)

1. In Vercel Dashboard → Your Project → Settings → Domains
2. Add your custom domain
3. Follow DNS configuration instructions

### 3. Enable CORS for Supabase (if needed)

If you encounter CORS issues:

1. Go to Supabase Dashboard → Settings → API
2. Add your Vercel domains to allowed origins

## Monitoring & Troubleshooting

### Viewing Logs

- **Vercel Dashboard**: Project → Functions → Logs
- **CLI**: `vercel logs`

### Common Issues

1. **Build Failures**
   - Check Node.js version (should be 18+)
   - Ensure all dependencies are in package.json
   - Check build logs for specific errors

2. **Environment Variables Not Working**
   - Ensure variables start with `VITE_` for Vite apps
   - Redeploy after adding/changing environment variables
   - Check variables are set for the correct environment (production/preview)

3. **Supabase Connection Issues**
   - Verify credentials are correct
   - Check Supabase allowed URLs include your Vercel domain
   - Ensure RLS policies are properly configured

4. **PWA Not Installing**
   - Ensure HTTPS is enabled (automatic on Vercel)
   - Check manifest.json is accessible at `/manifest.json`
   - Verify service worker is served with correct headers

## Continuous Deployment

Once connected to Git:

- **Main branch**: Auto-deploys to production
- **Other branches**: Create preview deployments
- **Pull requests**: Automatic preview deployments with comments

## Security Checklist

- [x] Environment variables are set in Vercel (not committed to Git)
- [x] `.env` file is in `.gitignore`
- [x] Supabase RLS (Row Level Security) is enabled
- [x] HTTPS is enforced (automatic on Vercel)
- [x] Security headers are configured in `vercel.json`

## Build Optimization

The app is optimized for production with:

- Tree shaking and minification
- Code splitting for better performance
- PWA assets pre-cached by service worker
- Compressed assets (handled by Vercel)

## Support

- Vercel Documentation: https://vercel.com/docs
- Supabase Documentation: https://supabase.com/docs
- Vite Documentation: https://vitejs.dev/guide/

---

**Note**: Remember to test your deployment thoroughly, especially authentication flows and data operations.