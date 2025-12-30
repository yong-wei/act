
'use client';

import React from 'react';
import 'katex/dist/katex.min.css';
import { BlockMath, InlineMath } from 'react-katex';
import { TeachingResource } from '@prisma/client';
import { getRegisteredResource } from '@/lib/resource-registry';

interface ResourceRendererProps {
  resource: TeachingResource;
}

// Simple Markdown + LaTeX Renderer
const SimpleMarkdown = ({ content }: { content: string }) => {
    if (!content) return null;

    // Split by newlines
    const lines = content.split('\n');
    return (
        <div className="space-y-4 text-slate-300">
            {lines.map((line, idx) => {
                // Headers
                if (line.startsWith('# ')) return <h1 key={idx} className="text-3xl font-bold text-white mb-4">{line.replace('# ', '')}</h1>;
                if (line.startsWith('## ')) return <h2 key={idx} className="text-2xl font-bold text-white mb-3">{line.replace('## ', '')}</h2>;
                if (line.startsWith('### ')) return <h3 key={idx} className="text-xl font-bold text-white mb-2">{line.replace('### ', '')}</h3>;
                
                // LaTeX Block $$...$$
                if (line.trim().startsWith('$$') && line.trim().endsWith('$$')) {
                    const math = line.trim().replace(/\$\$/g, '');
                    return <BlockMath key={idx} math={math} />;
                }

                // List items
                if (line.trim().startsWith('- ')) {
                    return <li key={idx} className="ml-4">{line.replace('- ', '')}</li>;
                }

                // Default paragraph
                if (line.trim() === '') return <br key={idx} />;
                
                return <p key={idx} className="leading-relaxed">{line}</p>;
            })}
        </div>
    );
};

export function ResourceRenderer({ resource }: ResourceRendererProps) {
  if (!resource) return <div>No Resource</div>;

  // 1. Static Text (Markdown)
  if (resource.type === 'STATIC_TEXT') {
    return (
      <div className="max-w-4xl mx-auto p-8">
        <SimpleMarkdown content={resource.content || ''} />
      </div>
    );
  }

  // 2. Static Media
  if (resource.type === 'STATIC_MEDIA') {
      return (
          <div className="flex items-center justify-center h-full bg-black">
              {/* Simplified media handling */}
              {resource.content?.endsWith('.mp4') ? (
                  <video src={resource.content} controls className="max-h-full max-w-full" />
              ) : (
                  <img src={resource.content || ''} alt={resource.title} className="max-h-full max-w-full object-contain" />
              )}
          </div>
      );
  }

  // 3. Dynamic Components (Simulations, Interactive)
  if (['INTERACTIVE_COMP', 'SIMULATION_APP', 'ETHICS_SCENARIO'].includes(resource.type)) {
      if (!resource.registryId) return <div>Missing Registry ID</div>;
      
      const config = getRegisteredResource(resource.registryId);
      if (!config) return <div>Component Not Found: {resource.registryId}</div>;

      const Component = config.component;
      // Merge default config with resource config
      const props = { ...(config.defaultConfig || {}), ...(resource.config as any || {}) };

      return (
          <div className="h-full w-full flex flex-col bg-slate-950">
              <Component {...props} />
          </div>
      );
  }

  return <div>Unknown Resource Type</div>;
}

