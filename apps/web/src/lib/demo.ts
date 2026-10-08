/**
 * Utilidades para distinguir entre el entorno de demostración (mock data)
 * y el entorno de producción / usuario real (datos reales de Supabase).
 */

export function isDemoTenant(
  tenant?: { slug?: string } | null,
  userEmail?: string | null,
): boolean {
  if (userEmail === "demo@segevia.local") return true;
  if (!tenant?.slug) return false;
  return tenant.slug === "acme-argentina" || tenant.slug === "demo-industrial";
}
