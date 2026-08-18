import { Resend } from "resend";

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
    from: "ONE x TMS <onboarding@resend.dev>",
    to,
    subject: "Resetare parolă ONE x TMS",
    html: `<p>Ai cerut resetarea parolei pentru contul tău ONE x TMS.</p><p><a href="${url}">Setează o parolă nouă</a></p><p>Linkul este valabil o oră și poate fi folosit o singură dată. Dacă nu tu ai cerut resetarea, ignoră acest email — parola ta rămâne neschimbată.</p>`,
  });

  if (error) {
    throw new PasswordResetEmailError(error.message);
  }
}
