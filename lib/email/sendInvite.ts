import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export class InviteEmailError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InviteEmailError";
  }
}

export async function sendInviteEmail(to: string, companyName: string, token: string) {
  const url = `${process.env.APP_URL}/invitatie/${token}`;
  // The Resend SDK reports failures in the response rather than throwing, so
  // an unchecked call silently "succeeds" while no email is ever delivered.
  const { error } = await resend.emails.send({
    from: "ONE x TMS <onboarding@resend.dev>",
    to,
    subject: `Ai fost invitat în ${companyName} pe ONE x TMS`,
    html: `<p>Ai fost invitat să te alături firmei <strong>${companyName}</strong> pe ONE x TMS.</p><p><a href="${url}">Acceptă invitația</a></p>`,
  });

  if (error) {
    throw new InviteEmailError(error.message);
  }
}
