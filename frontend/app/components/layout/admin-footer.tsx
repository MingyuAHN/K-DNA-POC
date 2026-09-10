export default function AdminFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white/70 px-6 py-4 backdrop-blur">
      <div className="flex flex-col items-center justify-between gap-2 text-sm text-slate-500 sm:flex-row">
        <p>© 2026 Admin System. All rights reserved.</p>
        <p>Next.js · FastAPI · Supabase</p>
      </div>
    </footer>
  );
}