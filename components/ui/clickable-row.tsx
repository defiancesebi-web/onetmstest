"use client";

import { useRouter } from "next/navigation";

/**
 * The one interactive piece of DataTable: a table row that navigates on click.
 * Kept tiny and client-only so DataTable itself can stay a Server Component and
 * invoke its column `cell` renderers server-side (functions never cross the
 * server → client boundary, which React forbids).
 */
export function ClickableRow({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <tr
      className={className}
      onClick={(e) => {
        // Let clicks on real links/buttons inside a cell win.
        if ((e.target as HTMLElement).closest("a,button")) return;
        router.push(href);
      }}
    >
      {children}
    </tr>
  );
}
