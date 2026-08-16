import "dotenv/config";
import { sendInviteEmail } from "../lib/email/sendInvite";

async function main() {
  const to = process.argv[2];
  if (!to) {
    console.error("Utilizare: npx tsx scripts/testResend.ts <email>");
    process.exit(1);
  }
  await sendInviteEmail(to, "Transport Demo SRL", "token-de-test-123");
  console.log(`Email trimis cu succes către ${to}.`);
}

main().catch((e) => {
  console.error("EȘEC:", e.message);
  process.exit(1);
});
