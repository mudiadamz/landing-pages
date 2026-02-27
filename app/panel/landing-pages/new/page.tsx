import Link from "next/link";
import { NewPageForm } from "./new-page-form";

export default function NewPagePage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/panel"
          className="text-foreground/70 hover:text-foreground text-sm"
        >
          ← Back
        </Link>
        <h1 className="text-xl font-semibold">New landing page</h1>
      </div>
      <NewPageForm />
    </div>
  );
}
