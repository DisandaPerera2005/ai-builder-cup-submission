/**
 * Personal email providers are never allowed to sign in, regardless of what
 * the Firestore `config/domains` allowlist says — that allowlist is only for
 * school/company domains waiting on institution rollout. Kept as a single
 * hardcoded source so login-form.tsx and (bare)/page.tsx can't drift apart.
 */
export const PERSONAL_EMAIL_DOMAINS = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com"]
