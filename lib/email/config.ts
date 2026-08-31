/**
 * Sender + a small branded HTML template shared by all outgoing emails.
 *
 * `EMAIL_FROM` defaults to Resend's shared test sender, which only delivers to
 * the Resend account owner. To reach real customers, verify a domain in Resend
 * and set EMAIL_FROM to an address on it, e.g.
 *   EMAIL_FROM="ONE x TMS <no-reply@your-domain.ro>"
 * No code change is then needed.
 */
export const EMAIL_FROM =
  process.env.EMAIL_FROM?.trim() || "ONE x TMS <onboarding@resend.dev>";

/** Minimal, inline-styled email that renders across mail clients. */
export function renderEmail(opts: {
  heading: string;
  intro: string;
  ctaLabel: string;
  ctaUrl: string;
  footer?: string;
}): string {
  return `<!doctype html>
<html>
  <body style="margin:0;background:#f6f7f8;padding:24px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#1a1d23;">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #e8eaed;border-radius:12px;overflow:hidden;">
      <div style="background:#1c1e22;padding:16px 24px;">
        <span style="color:#ffffff;font-size:18px;font-weight:800;letter-spacing:0.02em;">ONE<span style="color:#16a34a;">·</span>TMS</span>
      </div>
      <div style="padding:28px 24px;">
        <h1 style="margin:0 0 12px;font-size:19px;font-weight:700;">${opts.heading}</h1>
        <p style="margin:0 0 22px;font-size:14px;line-height:1.5;color:#4b5563;">${opts.intro}</p>
        <a href="${opts.ctaUrl}" style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:11px 20px;border-radius:8px;">${opts.ctaLabel}</a>
        ${opts.footer ? `<p style="margin:22px 0 0;font-size:12px;line-height:1.5;color:#9aa1ab;">${opts.footer}</p>` : ""}
        <p style="margin:22px 0 0;font-size:11px;color:#9aa1ab;word-break:break-all;">${opts.ctaUrl}</p>
      </div>
    </div>
  </body>
</html>`;
}
