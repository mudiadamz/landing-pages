import Link from "next/link";
import { UploadForm } from "../upload-form";

export default function UploadPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/panel"
          className="text-foreground/70 hover:text-foreground text-sm"
        >
          ← Back
        </Link>
        <h1 className="text-xl font-semibold">Upload HTML landing page</h1>
      </div>
      <UploadForm />
    </div>
  );
}
