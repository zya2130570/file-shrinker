'use client';

import { Search, X } from 'lucide-react';
import type { FileCategory } from '@/types';

const CATEGORIES: { value: FileCategory; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'images', label: 'Images' },
  { value: 'pdfs', label: 'PDFs' },
  { value: 'audio', label: 'Audio' },
  { value: 'video', label: 'Video' },
  { value: 'documents', label: 'Documents' },
  { value: 'no_savings', label: 'No Savings' },
];

interface SearchFilterProps {
  search: string;
  category: FileCategory;
  onSearchChange: (value: string) => void;
  onCategoryChange: (value: FileCategory) => void;
  total: number;
}

export default function SearchFilter({
  search,
  category,
  onSearchChange,
  onCategoryChange,
  total,
}: SearchFilterProps) {
  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={16} />
        <input
          type="text"
          placeholder="Search by filename…"
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          className="w-full pl-9 pr-8 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {search && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map(cat => (
          <button
            key={cat.value}
            onClick={() => onCategoryChange(cat.value)}
            className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
              category === cat.value
                ? 'bg-blue-600 text-white border-blue-600 dark:bg-blue-500 dark:border-blue-500'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Result count */}
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {total} {total === 1 ? 'file' : 'files'}
      </p>
    </div>
  );
}
