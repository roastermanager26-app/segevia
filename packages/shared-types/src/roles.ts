import { z } from "zod";

/** Roles de membresía. Deben coincidir con el enum `membership_role` en Postgres. */
export const MembershipRole = z.enum(["owner", "admin", "operator", "viewer"]);
export type MembershipRole = z.infer<typeof MembershipRole>;

/** Orden jerárquico: un rol incluye los permisos de los roles a su derecha. */
export const ROLE_RANK: Record<MembershipRole, number> = {
  owner: 4,
  admin: 3,
  operator: 2,
  viewer: 1,
};

export function hasAtLeastRole(role: MembershipRole | null | undefined, min: MembershipRole) {
  if (!role) return false;
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

export const ROLE_LABELS: Record<MembershipRole, string> = {
  owner: "Propietario",
  admin: "Administrador",
  operator: "Operador",
  viewer: "Lector",
};
