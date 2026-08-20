import { Clock } from "lucide-react";
import { type Dictionary } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n-server";

export default async function ComingSoonPage({
  params,
}: {
  params: Promise<{ modul: string }>;
}) {
  const { modul } = await params;
  const dict = await getDictionary();
  const navKey = modul as keyof Dictionary["nav"];
  const label = dict.nav[navKey] ?? modul;

  return (
    <div className="mx-auto max-w-xl pt-6">
      <div className="bg-card rounded-xl border p-10 text-center shadow-sm">
        <span className="bg-primary/10 text-primary mx-auto mb-5 grid size-14 place-items-center rounded-full">
          <Clock className="size-7" />
        </span>
        <p className="text-primary text-xs font-semibold tracking-wide uppercase">{label}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">{dict.soon.title}</h1>
        <p className="text-muted-foreground mx-auto mt-3 max-w-sm text-sm">{dict.soon.body}</p>
      </div>
    </div>
  );
}
