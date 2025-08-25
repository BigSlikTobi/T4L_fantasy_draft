import React from 'react';
import { GroundingSource } from '../types';
import { LinkIcon } from './icons/LinkIcon';

interface SourcesProps {
  sources: GroundingSource[];
}

const Sources: React.FC<SourcesProps> = ({ sources }) => {
  const webSources = sources
    .map(s => s.web)
    .filter((web): web is { uri: string; title: string } => !!web);

  if (webSources.length === 0) {
    return null;
  }

  return (
    <details className="mt-4 bg-gray-900/50 rounded-lg border border-gray-700 group">
      <summary className="p-3 cursor-pointer flex justify-between items-center text-gray-300 hover:text-white transition-colors">
        <span className="font-semibold text-sm">View AI Research Sources ({webSources.length})</span>
        <svg className="w-5 h-5 transform group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </summary>
      <div className="p-4 border-t border-gray-700 max-h-48 overflow-y-auto">
        <ul className="space-y-2">
          {webSources.map((source, index) => (
            <li key={index}>
              <a
                href={source.uri}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-teal-400 hover:text-teal-300 hover:underline"
              >
                <LinkIcon className="w-4 h-4 flex-shrink-0" />
                <span className="truncate" title={source.title}>{source.title || new URL(source.uri).hostname}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
};

export default Sources;
