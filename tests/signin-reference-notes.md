# Account entry reference refresh

Reference: user supplied split illustration/form screen. Uses existing original Al Saeed SVG scenes and identity, not Alison imagery, trademarks, user counts, or claims. Desktop art left/form right, compact mobile art, Arabic RTL and English LTR. Tabs, visible labels, autocomplete, password visibility, keyboard focus trap/return, reduced motion, inline errors and duplicate-submit lock remain. Help navigates to the existing contact page; it does not imply a password reset was sent. No new persistence or remember-me promise.

## Actual authentication capability audit
- server.js exposes email/password registration and login, and authenticated password change. Successful login timestamp recording is unchanged.
- No OAuth/social login/callback, magic link, or forgot-password/email-reset backend exists in this repository. No supported provider configuration keys are declared in .env.example. Secret values were not read.
- Therefore no social provider buttons or provider-availability endpoint were added. An empty provider catalogue would add an unnecessary endpoint; there is no implemented provider to enable. This review does not assert the contents of the production environment.
- To add social sign-in: select the intended provider(s), implement and test the verified authorization-code flow (state, PKCE and provider-appropriate nonce/issuer validation), define safe account-linking rules and exact callback URL, then obtain per-action approval for provider app registration/credential installation/persistent access. Existing-account linkage must not rely on an unverified email. Do not publish a working-looking icon before the provider is configured and validated.
- No backend routes, OAuth grants, environment variables, session policy, signing credentials, accounts, or production settings changed. No production login attempted.

## Verification
- node tests/signin-reference-dom.mjs: Arabic/English rendering, labels/autocomplete, password show/hide, mode-switch draft preservation, single request, pending state, failed login, successful session/progress hydration, contact help, responsive/reduced-motion source contracts.
- All inline scripts parse with node vm.Script; auth-visual.js passes node --check.
- Pixel/browser screenshots remain unavailable because the approved local browser cannot launch in this environment; DOM checks are not pixel QA.

## Returning-user navigation correction (2026-10-23)
The public mobile stylesheet hid both account buttons under680px, leaving them only inside the collapsed menu. Removed that hiding rule. A dedicated second mobile header row now keeps Log in / Create account visible while signed out, or My dashboard / Logout while signed in. Desktop also has an explicit dashboard destination instead of a noninteractive first-name label. Logout clears the existing session/token/cache, closes stale menus, routes to the public homepage and opens the login form; dismissing that form still leaves visible header entry points. No protected-content guest access added.

Added account-navigation-dom.mjs and extended signin-reference-dom.mjs for real register endpoint selection, duplicate submission suppression, interrupted request completion and reopening. Both pass in AR/EN. Existing public-experience-dom.mjs passes. Pixel test public-experience.mjs is blocked at Chromium launch (sandbox socket permission); no screenshot acceptance claim.

Provider readiness remains blocked before setup: repository only implements email/password; no Google, Apple or LinkedIn callback/token validation/account-linking implementation or declared provider keys exists. Metadata-only production configuration inquiry is pending with the deployment owner. Existing email login or a Gmail integration is not evidence that the website has a Google OAuth client. No secrets read or new credentials/grants/settings changed.
