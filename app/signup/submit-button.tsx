"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

export function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      size="md"
      fullWidth
      loading={pending}
      disabled={pending}
      className="py-3 text-base shadow-sm hover:scale-[1.02] hover:shadow-md hover:opacity-100 disabled:opacity-70"
    >
      {pending ? "Memproses…" : "Daftar"}
    </Button>
  );
}
