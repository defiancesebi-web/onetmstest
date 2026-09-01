"use client";

import { type ChangeEvent, useActionState, useRef, useState } from "react";
import { CheckCircle2, ImagePlus, Trash2, Briefcase } from "lucide-react";
import { saveProfileAction, type ProfileState } from "./actions";
import type { Dictionary } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

export function ProfileForm({
  values,
  email,
  jobTitle,
  t,
}: {
  values: { name: string; phone: string; avatar: string | null };
  email: string;
  jobTitle: string | null;
  t: Dictionary["profile"];
}) {
  const [state, formAction, pending] = useActionState<ProfileState, FormData>(saveProfileAction, {
    error: null,
    saved: false,
  });
  const [name, setName] = useState(values.name);
  const [phone, setPhone] = useState(values.phone);
  const [avatar, setAvatar] = useState<string | null>(values.avatar);
  const fileRef = useRef<HTMLInputElement>(null);

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const size = 160;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const scale = Math.max(size / img.width, size / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        setAvatar(canvas.toDataURL("image/webp", 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  return (
    <form action={formAction} className="bg-card w-full space-y-6 rounded-xl border p-6 shadow-sm sm:p-8">
      <input type="hidden" name="avatar" value={avatar ?? ""} />

      {/* Avatar */}
      <div className="flex items-center gap-4">
        <span className="bg-primary/10 text-primary grid size-20 shrink-0 place-items-center overflow-hidden rounded-full text-2xl font-bold">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt="" className="size-full object-cover" />
          ) : (
            initials(name) || "?"
          )}
        </span>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <ImagePlus className="mr-1.5 size-4" />
              {avatar ? t.photoChange : t.photoAdd}
            </Button>
            {avatar && (
              <Button type="button" variant="outline" size="sm" onClick={() => setAvatar(null)}>
                <Trash2 className="mr-1.5 size-4" />
                {t.photoRemove}
              </Button>
            )}
          </div>
          <p className="text-muted-foreground text-xs">{t.photo}</p>
        </div>
        <input ref={fileRef} type="file" accept="image/*" onChange={onPick} className="hidden" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="name">{t.name}</Label>
          <Input id="name" name="name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">{t.phone}</Label>
          <Input id="phone" name="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>{t.email}</Label>
          <Input value={email} disabled />
        </div>
        <div className="space-y-1.5">
          <Label>{t.jobTitle}</Label>
          <div className="border-input bg-muted/40 flex h-10 items-center gap-2 rounded-md border px-3 text-sm">
            <Briefcase className="text-muted-foreground size-4 shrink-0" />
            <span className={jobTitle ? "font-medium" : "text-muted-foreground"}>
              {jobTitle || t.jobTitleNone}
            </span>
          </div>
          <p className="text-muted-foreground text-xs">{t.jobTitleHint}</p>
        </div>
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.saved && !state.error && (
        <p className="inline-flex items-center gap-1.5 text-sm text-emerald-600">
          <CheckCircle2 className="size-4" /> {t.saved}
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? t.saving : t.save}
      </Button>
    </form>
  );
}
