import { Resend } from "resend";
import { EMAIL_FROM, renderEmail } from "./config";

const resend = new Resend(process.env.RESEND_API_KEY);

export class PasswordResetEmailError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PasswordResetEmailError";
  }
}

export async function sendPasswordResetEmail(to: string, token: string) {
  const url = `${process.env.APP_URL}/parola-noua/${token}`;
  // The Resend SDK reports failures in the response rather than throwing, so an
  // unchecked call silently "succeeds" while no email is ever delivered.
  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to,
    subject: "Resetare parolă ONE x TMS",
    html: renderEmail({
      heading: "Resetare parolă",
      intro: "Ai cerut resetarea parolei pentru contul tău ONE x TMS.",
      ctaLabel: "Setează o parolă nouă",
      ctaUrl: url,
      footer:
        "Linkul este valabil o oră și poate fi folosit o singură dată. Dacă nu tu ai cerut resetarea, ignoră acest email — parola ta rămâne neschimbată.",
    }),
  });

  if (error) {
    throw new PasswordResetEmailError(error.message);
  }
}
