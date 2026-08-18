import { PageHeader } from "@/components/page-header";
import { ChangePasswordForm } from "./change-password-form";

export default function ChangePasswordPage() {
  return (
    <div>
      <PageHeader
        title="Schimbă parola"
        description="Ai nevoie de parola actuală pentru a o schimba."
      />
      <ChangePasswordForm />
    </div>
  );
}
