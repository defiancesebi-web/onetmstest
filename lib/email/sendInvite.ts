import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendInviteEmail(to: string, companyName: string, token: string) {
  const url = `${process.env.APP_URL}/invitatie/${token}`;
  await resend.emails.send({
    from: "ONE x TMS <onboarding@resend.dev>",
    to,
    subject: `Ai fost invitat în ${companyName} pe ONE x TMS`,
    html: `<p>Ai fost invitat să te alături firmei <strong>${companyName}</strong> pe ONE x TMS.</p><p><a href="${url}">Acceptă invitația</a></p>`,
  });
}
