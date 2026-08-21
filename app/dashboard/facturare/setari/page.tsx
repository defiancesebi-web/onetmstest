import { redirect } from "next/navigation";

// Company details moved to the unified settings screen. Kept as a redirect so
// old links (and the invoices list) still land in the right place.
export default function InvoicingSettingsRedirect() {
  redirect("/dashboard/setari");
}
