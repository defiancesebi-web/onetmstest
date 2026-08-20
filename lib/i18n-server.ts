import { cookies } from "next/headers";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  dictionaryFor,
  isLocale,
  type Dictionary,
  type Locale,
} from "@/lib/i18n";

/** Server-only locale helpers — read the cookie via next/headers. */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export async function getDictionary(): Promise<Dictionary> {
  return dictionaryFor(await getLocale());
}
