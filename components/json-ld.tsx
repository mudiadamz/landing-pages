/**
 * Renders a schema.org JSON-LD block. Server component — drop it anywhere in
 * the tree. `data` is serialized as-is, so only pass trusted, app-built objects.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
