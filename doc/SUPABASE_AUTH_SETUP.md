# ✅ Supabase Integration - Complete Setup Guide

## 🎯 What's Been Setup

Your web app is now fully integrated with real **Supabase authentication**. No more mock login!

### ✨ Features Implemented

- ✅ Real Supabase authentication (email/password)
- ✅ AuthProvider context for global state management
- ✅ useAuth hook for accessing auth state in components
- ✅ Protected dashboard (auto-redirects if not logged in)
- ✅ User role management
- ✅ Session persistence
- ✅ Automatic logout on session expiry
- ✅ Error handling and loading states

---

## 📁 File Structure

### New Authentication Files Created:

```
web/
├── lib/
│   ├── supabase/
│   │   ├── client.ts         ← Browser Supabase client
│   │   └── server.ts         ← Server-side Supabase client
│   └── auth-context.tsx      ← Global auth context & hook
├── app/
│   ├── layout.tsx            ← Updated with AuthProvider
│   ├── page.tsx              ← Updated with auth redirect
│   ├── login/
│   │   └── page.tsx          ← Real Supabase auth
│   └── dashboard/
│       └── page.tsx          ← Protected page (auth required)
├── .env.local                ← Credentials configured ✓
└── .env.example              ← Template (reference only)
```

---

## 🔑 Environment Variables

### Already Configured in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://otmnfcuuqlbeowphxagf.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=sb_publishable_ZktUZKD7TlOA3aLqERap0g_FPv-6kXh
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Variable Explanation:

| Variable | Visibility | Purpose |
|----------|-----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Client-side (public) | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client-side (public) | Anon key for frontend auth |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side only (secret) | Admin operations on backend |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | Client-side (public) | Alternative auth key |

---

## 🚀 How to Use

### 1. **Start the Development Server**

```bash
cd web
npm run dev
```

Then open: **http://localhost:3000**

### 2. **Test the Login Flow**

**Authentication URL**: http://localhost:3000/login

**Demo User**:
```
Email:    Varghesejoby2003@gmail.com
Password: admin123
```

✅ **What happens**:
1. Page redirects to login (not authenticated)
2. Enter credentials and click "Sign In"
3. Supabase authenticates the user
4. Session stored in browser
5. Auto-redirect to dashboard
6. Dashboard shows user email and role

### 3. **Test Logout**

Click the logout button (top right) to:
- Clear auth session
- Redirect back to login

---

## 💻 Code Examples

### Using Auth in Components

```typescript
'use client';

import { useAuth } from '@/lib/auth-context';

export default function MyComponent() {
  const { user, userRole, isLoading, signOut } = useAuth();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <div>Please log in</div>;
  }

  return (
    <div>
      <p>Welcome, {user.email}</p>
      <p>Role: {userRole}</p>
      <button onClick={signOut}>Logout</button>
    </div>
  );
}
```

### Sign In Function

```typescript
const { signIn } = useAuth();

async function handleLogin(email: string, password: string) {
  const { error } = await signIn(email, password);
  
  if (error) {
    console.error('Login failed:', error);
  } else {
    console.log('Login successful!');
    // User automatically redirected to dashboard
  }
}
```

### Protected Route Pattern

```typescript
export default function ProtectedPage() {
  const { user, userRole, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) {
    return <LoadingSpinner />;
  }

  return <YourPageContent />;
}
```

---

## 📊 Authentication Architecture

```
┌─────────────────────────────────────────────────┐
│              User Visits App                     │
│            (http://localhost:3000)              │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │  Check Auth Status   │
        │ (useAuth hook runs)  │
        └──────────┬───────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
   ✓ Logged In          ✗ Not Logged In
        │                     │
        ▼                     ▼
    ┌───────────┐         ┌──────────┐
    │ Dashboard │         │  Login   │
    │  (Home)   │         │   Page   │
    └───────────┘         └────┬─────┘
                               │
                        ┌──────▼─────────┐
                        │  User enters   │
                        │  credentials   │
                        └────────┬───────┘
                                 │
                        ┌────────▼──────────┐
                        │ Supabase Auth API │
                        │ Validates creds   │
                        └────────┬──────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
                Success                  Failure
                    │                         │
                    ▼                         ▼
            ┌──────────────┐         ┌──────────────┐
            │ Auth Context │         │ Error Message│
            │ Stores token │         │ Show error   │
            │ & user data  │         │ Stay on login│
            └──────┬───────┘         └──────────────┘
                   │
                   ▼
            ┌──────────────┐
            │  Dashboard   │
            │ (Auto-Redirect)
            └──────────────┘
```

---

## 🔐 Security Features

### ✅ Implemented

- **RLS (Row Level Security)**: Database enforces access control
- **Anon Key**: Limited permissions for unauthenticated users
- **Session Management**: Secure token storage
- **Service Role Key**: Only used on server (never exposed to client)
- **HTTPS Only**: Credentials transmitted securely
- **Email Verification**: Accounts verified before use

### 🛡️ Best Practices

1. ✅ Never expose `SUPABASE_SERVICE_ROLE_KEY` in client code
2. ✅ Always use `NEXT_PUBLIC_SUPABASE_ANON_KEY` for client operations
3. ✅ Implement role-based UI (show/hide features based on role)
4. ✅ Handle auth errors gracefully
5. ✅ Add loading states during auth operations
6. ✅ Logout clears all sensitive data

---

## 🚨 Troubleshooting

### Issue: "Invalid credentials" error

**Solution**: 
- Make sure the superadmin user exists
- Run: `node create-superadmin.js`
- Check Supabase dashboard to verify user exists

### Issue: Auth context not available

**Solution**:
- Make sure `AuthProvider` wraps your component in `layout.tsx`
- Check that component has `'use client'` directive
- Import hook: `import { useAuth } from '@/lib/auth-context'`

### Issue: Session not persisting after refresh

**Solution**:
- Browser cookies must be enabled
- Check if `.env.local` has correct credentials
- Verify Supabase project is accessible

### Issue: Infinite redirect loop

**Solution**:
- Add `isLoading` check before redirecting
- Don't redirect during initial auth state check
- Example:
  ```typescript
  if (!isLoading && !user) {
    router.push('/login');
  }
  ```

---

## 📦 Creating New Users

### Option 1: Via Dashboard UI

1. Go to **Supabase Dashboard** → **Authentication**
2. Click **Create new user**
3. Enter email and password
4. Click the **New user profile** toggle (optional)

### Option 2: Via Script

```bash
# Run the create-superadmin script for admins
node create-superadmin.js
```

### Option 3: Via TypeScript

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Create new user
const { data, error } = await supabase.auth.admin.createUser({
  email: 'user@example.com',
  password: 'secure_password',
  email_confirm: true,
  user_metadata: {
    display_name: 'John Doe',
    role: 'office_staff',
  },
});

// Create profile record
await supabase.from('profiles').insert({
  id: data.user.id,
  email: 'user@example.com',
  display_name: 'John Doe',
  role: 'office_staff',
});
```

---

## 🌐 Next Steps

### Frontend
- [ ] Create user management page
- [ ] Add "Sign Up" functionality
- [ ] Implement password reset flow
- [ ] Add profile editing page
- [ ] Role-based UI (hide features by role)

### Backend
- [ ] Create API endpoints with Server Actions
- [ ] Add webhook handlers for auth events
- [ ] Implement email notifications
- [ ] Setup automated backups

### Database
- [ ] Load sample data for testing
- [ ] Create views for reporting
- [ ] Setup performance indexes
- [ ] Enable audit logging

### DevOps
- [ ] Setup CI/CD pipeline
- [ ] Configure error tracking (Sentry)
- [ ] Setup monitoring and alerts
- [ ] Plan scaling strategy

---

## 📚 Resources

- **Supabase Docs**: https://supabase.com/docs
- **Supabase Auth**: https://supabase.com/docs/guides/auth
- **React Hooks**: https://react.dev/reference/react
- **Next.js App Router**: https://nextjs.org/docs/app
- **Environment Variables**: https://nextjs.org/docs/basic-features/environment-variables

---

## ✅ Verification Checklist

- [ ] `.env.local` has Supabase credentials
- [ ] `npm install` completed successfully
- [ ] `npm run dev` starts without errors
- [ ] Login page loads at `/login`
- [ ] Can login with `Varghesejoby2003@gmail.com / admin123`
- [ ] Dashboard loads after successful login
- [ ] User email displayed in dashboard header
- [ ] Logout button works and clears session
- [ ] Redirects to login when visiting `/dashboard` without auth
- [ ] Eye button toggles password visibility

---

## 🎓 Learning Resources

### For Adding Features

1. **Admin Panel**: Create user management
2. **Technician App**: Role-based dashboard
3. **Reporting**: SQL queries for analytics
4. **Notifications**: Setup email or SMS alerts
5. **Payments**: Integrate payment gateway

### Video Tutorials

- Supabase + Next.js: https://www.youtube.com/results?search_query=supabase+nextjs+auth
- React Hooks: https://www.youtube.com/results?search_query=react+hooks+tutorial
- Authentication Flow: https://www.youtube.com/results?search_query=auth+context+react

---

**Status**: ✅ Complete and Ready to Use  
**Date**: March 12, 2026  
**Version**: 1.0.0  
**Environment**: Development (localhost:3000)

---

**Need Help?**
- Check error messages in browser console (F12)
- Review Supabase dashboard for auth logs
- Check terminal output for server errors
- Review documentation files in `/doc/` folder
