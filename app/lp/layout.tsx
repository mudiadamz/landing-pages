export default function LpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 w-full h-full overflow-hidden">
      {children}
    </div>
  );
}
