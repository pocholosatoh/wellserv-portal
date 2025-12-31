export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-800">
      <div className="text-center space-y-2">
        <div className="text-3xl font-semibold">Page not found</div>
        <p className="text-sm text-slate-600">
          The page you&apos;re looking for doesn&apos;t exist or was moved.
        </p>
      </div>
    </div>
  );
}
