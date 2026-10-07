const usd = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "USD",
  currencyDisplay: "code",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Moneda siempre explícita (design.md §2). */
export function formatUsd(value: number | string | null | undefined) {
  return usd.format(Number(value ?? 0));
}

export function formatPct(value: number | string | null | undefined) {
  return `${Number(value ?? 0).toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`;
}

const dateTime = new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" });
export function formatDateTime(value: string | null | undefined) {
  return value ? dateTime.format(new Date(value)) : "—";
}

export function slugify(input: string) {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}
