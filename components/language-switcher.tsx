"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LOCALE_COOKIE, LOCALES, type Locale } from "@/lib/i18n";

/**
 * RO / EN toggle. Writes the locale cookie client-side and refreshes so server
 * components re-render in the new language — no page navigation, no reload.
 */
export function LanguageSwitcher({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function choose(next: Locale) {
    if (next === locale) return;
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    startTransition(() => router.refresh());
  }

  return (
    <div
      className="flex items-center rounded-md border p-0.5 text-xs font-semibold"
      aria-busy={pending}
    >
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => choose(l)}
          aria-pressed={l === locale}
          className={
            l === locale
              ? "bg-primary text-primary-foreground rounded px-2 py-1"
              : "text-muted-foreground hover:text-foreground rounded px-2 py-1"
          }
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
