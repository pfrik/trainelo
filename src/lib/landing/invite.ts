/**
 * Invite-request plumbing for the private beta.
 *
 * Zero-infrastructure waitlist: "Request an invite" opens a pre-filled
 * email instead of hitting an endpoint (the Vercel function budget is
 * spoken for). hello@trainelo.io must forward somewhere real — Porkbun
 * email forwarding is free — before this goes live.
 */

const INVITE_EMAIL = "hello@trainelo.io";

const SUBJECT = "Trainelo invite request";

const BODY = `Hi Pascal,

I'd like an invite to Trainelo.

My watch:
What I train for:
`;

export const REQUEST_INVITE_URL = `mailto:${INVITE_EMAIL}?subject=${encodeURIComponent(
  SUBJECT,
)}&body=${encodeURIComponent(BODY)}`;
