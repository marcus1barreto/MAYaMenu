// Fonte única para e-mails autorizados do SuperAdmin / HQ
export const EMAILS_SUPERADMIN_AUTORIZADOS: readonly string[] = [
  "admin@mayamenu.com",
  "marcus1fialho@gmail.com",
];

export function isEmailSuperAdmin(email?: string | null): boolean {
  if (!email) return false;
  return EMAILS_SUPERADMIN_AUTORIZADOS.includes(email.trim().toLowerCase());
}
