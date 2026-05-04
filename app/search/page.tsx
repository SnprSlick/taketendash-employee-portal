import { Suspense } from 'react';
import SearchPageInner from './SearchPageInner';

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">Loading…</div>}>
      <SearchPageInner />
    </Suspense>
  );
}
