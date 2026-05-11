# UseSifter - Testing & Bug Fix Progress

## Auth Pages
- [x] Login Page (Sign In / Sign Up) — `/`
- [x] OTP Verification Page — `/verify-otp`

## Onboarding Pages
- [x] Name Entry — `/onboarding/name`
- [x] User Type Selection — `/onboarding/type`
- [x] Freelancer Onboarding — `/onboarding/freelancer`

## Client Pages
- [x] AI Chat / Main Menu — `/chat`
- [x] Dashboard — `/dashboard`
- [ ] Explore — `/explore`
- [ ] Deal Rooms List — `/dealrooms`
- [ ] Deal Room Detail — `/dealroom`
- [ ] Projects — `/projects`
- [ ] Freelancer Profile View — `/profile/:id`

## Freelancer Pages
- [x] Freelancer Dashboard — `/freelancer/dashboard`
- [ ] Freelancer Deal Rooms — `/freelancer/dealrooms`
- [ ] Freelancer Opportunities — `/freelancer/opportunities`
- [ ] Freelancer My Profile — `/freelancer/profile`

## Shared Pages
- [x] Settings — `/settings`
- [ ] Join Workspace — `/join/:token`

## Admin Panel (localhost:5174)
- [ ] Admin pages (TBD)

---

## Completed Fixes Log

### Login Page (`/`) — Fixed
- **Bug**: Sign up silently failed and redirected back to login with no error message
- **Cause**: `sendOtp()` in authStore swallowed errors and returned `false`; LoginPage never checked the return value
- **Fix**: Removed try/catch in `login()`, `sendOtp()`, and `loginWithGoogle()` so errors propagate to the UI
- **Bug**: Google sign-in showed generic "Google sign-in failed" error
- **Cause**: Firebase Admin SDK had no service account credentials to verify ID tokens
- **Fix**: Added support for `GOOGLE_APPLICATION_CREDENTIALS` / `FIREBASE_SERVICE_ACCOUNT` env vars; improved server error messages
- **Improvements**: Changed email input to `type="email"`, added input trimming/lowercasing, added empty field validation, errors clear on mode switch
- **Files changed**: `src/stores/authStore.ts`, `src/pages/LoginPage.tsx`, `server/index.ts`

### OTP Verification Page (`/verify-otp`) — Tested
- Working correctly after auth store fixes. OTP sends and verifies successfully.

### Onboarding Pages (`/onboarding/*`) — Fixed
- **Bug**: Freelancer onboarding steps (5-step profile form) were completely skipped
- **Cause**: `setUserType()` in authStore set `onboardingComplete: true` for ALL users immediately. When freelancers navigated to `/onboarding/freelancer`, the `ProtectedRoute` guard saw `onboardingComplete=true` and redirected them to the dashboard instantly.
- **Fix**: `setUserType()` now only sets `onboardingComplete: true` for clients. Freelancers remain `onboardingComplete: false` until they finish all 5 onboarding steps (handled by FreelancerOnboardingPage line 773).
- **Files changed**: `src/stores/authStore.ts`, `src/components/ProtectedRoute.tsx`

### Infrastructure Fixes
- **Database**: Neon DB was unreachable due to Jio hotspot DNS blocking the hostname. Fixed by switching Windows DNS to Google DNS (8.8.8.8).
- **Firebase**: Added `firebase-service-account.json` and `GOOGLE_APPLICATION_CREDENTIALS` to `.env` for Google sign-in support.
- **Env**: Removed `channel_binding=require` from DATABASE_URL to improve connection reliability.

### AI Chat / Main Menu (`/chat`) — Fixed
- **Bug**: Progress sidebar showed header ("PROGRESS" + Close button) but content area was blank/invisible
- **Cause**: Sidebar content rendered simultaneously with the `w-0` → `w-[340px]` CSS transition. The browser laid out the content at zero width during the transition, and never recalculated after the animation completed. Zooming in/out forced a reflow which accidentally fixed the layout.
- **Fix**: Added `sidebarReady` state that delays content rendering by 320ms (after the 300ms sidebar transition). Content now mounts when the sidebar is already at full width, ensuring correct layout calculation.
- **Files changed**: `src/pages/MainMenuPage.tsx`

### Client Dashboard (`/dashboard`) — Enhanced
- **Enhancement**: Added dummy data with `VITE_FORCE_DUMMY` env variable (5 projects, 5 transactions, 3 freelancers, $24,700 escrow balance)
- **Backend**: Already fully implemented — queries escrows, builds transactions, freelancer list, project cards
- **Files changed**: `src/pages/DashboardPage.tsx`, `.env`

### Freelancer Dashboard (`/freelancer/dashboard`) — Enhanced
- **Enhancement**: Restyled entire page to match client dashboard design system (font sizes, colors, border radius, padding, button styles)
- **Fix**: Replaced hardcoded `FORCE_DUMMY = true` with `VITE_FORCE_DUMMY` env variable
- **Backend**: Already fully implemented — queries escrows, negotiations, deal rooms for earnings, projects, messages, proposals, agenda
- **Files changed**: `src/pages/freelancer/FreelancerDashboardPage.tsx`

### Escrow — Wallet Request Flow (Deal Room)
- **Feature**: When client creates escrow and freelancer has no wallet, "Continue" button is blocked. Shows "Request Wallet Connection" button instead.
- **Flow**: Client sends wallet request → message card appears in deal room chat → Freelancer connects via MetaMask or manual paste → wallet saved to profile → message card updates to "Connected" → client can proceed with escrow
- **Schema**: Added `messageType` and `metadata` fields to `WorkspaceMessage` model
- **Files changed**: `src/components/dealroom/EscrowModal.tsx`, `src/components/dealroom/WalletRequestCard.tsx` (new), `src/hooks/useWorkspace.ts`, `src/pages/DealRoomPage.tsx`, `src/lib/api.ts`, `server/workspaces.ts`, `prisma/schema.prisma`

### Settings Page (`/settings`) — Cleaned Up
- **Removed**: Phone number + country code picker, backup email with OTP, company/organization field, location field, active sessions display, notifications tab (both client and freelancer)
- **Reason**: None of these had working backends or real use cases in the app. Phone had no SMS feature, backup email had no recovery flow, notifications had no email system, active sessions was hardcoded.
- **Kept**: Profile photo (working), Full name (working), Email display (working), Change password (working), 2FA setup/disable (working), Wallet address (working), Default payment token (client)
- **Improvement**: Merged separate ClientAccountTab and FreelancerAccountTab into one shared AccountTab (identical functionality)
- **Result**: 3 tabs each — Client: Account, Security, Billing | Freelancer: Account, Security, Wallet — all fully backed by working APIs
- **Files changed**: `src/pages/SettingsPage.tsx` (rewritten, reduced from 1323 lines to ~530 lines)
