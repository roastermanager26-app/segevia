import { ACIZER_CONTACT_EMAIL, ACIZER_WEBSITE, APP_COPYRIGHT } from "../lib/appInfo";

export function AppCopyright({ className = "" }: { className?: string }) {
  return <p className={`text-label-sm text-on-surface-variant ${className}`.trim()}>
    {APP_COPYRIGHT} <a href={ACIZER_WEBSITE} target="_blank" rel="noreferrer" className="font-semibold text-primary hover:underline">www.acizer.com</a>{" · "}<a href={`mailto:${ACIZER_CONTACT_EMAIL}`} className="font-semibold text-primary hover:underline">{ACIZER_CONTACT_EMAIL}</a>
  </p>;
}
