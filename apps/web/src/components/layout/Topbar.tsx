import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { ROLE_LABELS } from "../../lib/types";
import { useAuth } from "../../auth/AuthProvider";
import { useTenant } from "../../tenant/TenantProvider";
import { Icon, cx } from "../ui";

function useClickOutside(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", esc);
    };
  }, [onClose]);
  return ref;
}

function TenantSwitcher() {
  const { memberships, active, setActiveTenant } = useTenant();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(() => setOpen(false));

  if (!active) return null;

  return (
    <div ref={ref} className="relative min-w-[220px]">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-space-sm rounded-lg px-space-sm py-1.5 text-left transition-colors hover:bg-surface-container-low"
      >
        <div className="flex flex-col">
          <span className="text-label-md font-semibold leading-tight text-on-surface">{active.tenant.name}</span>
          <span className="text-label-sm font-medium text-primary">{ROLE_LABELS[active.role]}</span>
        </div>
        <Icon name="unfold_more" className="text-lg text-on-surface-variant" />
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute left-0 top-full z-50 mt-1 w-72 rounded-xl border border-[#cbd5e1] bg-surface-container-lowest p-space-xs shadow-float"
        >
          <p className="px-space-sm py-space-xs text-label-sm uppercase text-outline">Organizaciones</p>
          {memberships.map((m) => (
            <button
              key={m.tenant.id}
              role="option"
              aria-selected={m.tenant.id === active.tenant.id}
              type="button"
              onClick={() => {
                setActiveTenant(m.tenant.id);
                setOpen(false);
                navigate("/");
              }}
              className={cx(
                "flex w-full items-center justify-between rounded-lg px-space-sm py-space-sm text-left hover:bg-surface-container-low",
                m.tenant.id === active.tenant.id && "bg-surface-container-low",
              )}
            >
              <span className="flex flex-col">
                <span className="text-label-md text-on-surface">{m.tenant.name}</span>
                <span className="text-body-sm text-on-surface-variant">{ROLE_LABELS[m.role]}</span>
              </span>
              {m.tenant.id === active.tenant.id && <Icon name="check" className="text-lg text-primary" />}
            </button>
          ))}
          <div className="my-space-xs h-px bg-surface-container" />
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              navigate("/onboarding");
            }}
            className="flex w-full items-center gap-space-sm rounded-lg px-space-sm py-space-sm text-label-md text-primary hover:bg-surface-container-low"
          >
            <Icon name="add" className="text-lg" /> Crear organización
          </button>
        </div>
      )}
    </div>
  );
}

function UserMenu() {
  const { session, signOut } = useAuth();
  const { profile } = useTenant();
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(() => setOpen(false));
  const name = profile?.full_name || session?.user.email || "Usuario";
  const initials = name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-space-sm rounded-lg py-1 pl-space-xs pr-space-sm hover:bg-surface-container-low"
      >
        {profile?.avatar_url ? (
          <img alt="" src={profile.avatar_url} className="h-8 w-8 rounded-full object-cover" />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-fixed text-label-sm text-primary">
            {initials}
          </span>
        )}
        <span className="hidden flex-col text-left md:flex">
          <span className="text-label-md font-semibold leading-tight text-on-surface">{name}</span>
          {profile?.job_title && (
            <span className="text-body-sm leading-tight text-on-surface-variant">{profile.job_title}</span>
          )}
        </span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1 w-56 rounded-xl border border-[#cbd5e1] bg-surface-container-lowest p-space-xs shadow-float"
        >
          <p className="truncate px-space-sm py-space-xs text-body-sm text-on-surface-variant">{session?.user.email}</p>
          <button
            role="menuitem"
            type="button"
            onClick={() => void signOut()}
            className="flex w-full items-center gap-space-sm rounded-lg px-space-sm py-space-sm text-label-md text-on-surface hover:bg-surface-container-low"
          >
            <Icon name="logout" className="text-lg" /> Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}

export function Topbar() {
  return (
    <header className="fixed left-64 right-0 top-0 z-40 flex h-16 items-center justify-between gap-space-md bg-surface-container-lowest/90 px-space-lg shadow-[0_1px_8px_rgba(0,0,0,0.03)] backdrop-blur-xl">
      <TenantSwitcher />
      <div className="max-w-xl flex-1">
        <div className="relative flex w-full items-center">
          <Icon name="search" className="pointer-events-none absolute left-3 text-outline" />
          <input
            type="search"
            disabled
            title="La búsqueda global llega con Knowledge Base y Content Studio"
            placeholder="Buscar conversaciones, contenido, leads o conocimiento…"
            className="w-full rounded-lg bg-surface-container-low py-2 pl-10 pr-14 text-body-md shadow-inner placeholder:text-outline disabled:cursor-not-allowed"
          />
          <span className="tabular pointer-events-none absolute right-3 rounded bg-surface-container px-1.5 py-0.5 text-body-sm text-on-surface-variant">
            ⌘K
          </span>
        </div>
      </div>
      <div className="flex items-center gap-space-md">
        <div className="hidden items-center gap-space-xs rounded-full bg-surface-container-low px-space-sm py-1 xl:flex">
          <Icon name="verified_user" className="text-base text-secondary" />
          <span className="text-label-sm font-medium text-secondary">Modo Supervisión: Humano en control</span>
        </div>
        <div className="h-6 w-px bg-surface-container" />
        <UserMenu />
      </div>
    </header>
  );
}
