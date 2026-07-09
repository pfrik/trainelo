/**
 * Waitlist plumbing for the private beta.
 *
 * Zero-infrastructure waitlist: "Join the waitlist" opens a pre-filled
 * email instead of hitting an endpoint (the Vercel function budget is
 * spoken for). hello@trainelo.io must forward somewhere real — Porkbun
 * email forwarding is free — before this goes live.
 */

const WAITLIST_EMAIL = "hello@trainelo.io";

const SUBJECT = "Trainelo waitlist";

const BODY = `Hi Pascal,

I'd like to join the Trainelo waitlist.

My watch:
What I train for:
`;

export const WAITLIST_URL = `mailto:${WAITLIST_EMAIL}?subject=${encodeURIComponent(
  SUBJECT,
)}&body=${encodeURIComponent(BODY)}`;
