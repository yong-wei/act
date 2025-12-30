'use client';

interface PresetExamplesProps {
  onSelectExample: (numerator: string, denominator: string) => void;
}

const examples = [
  {
    id: '1',
    label: 'F(s) = (s-1)/(s+2)',
    numerator: '1, -1',
    denominator: '1, 2',
  },
  {
    id: '2',
    label: 'F(s) = (s²+1)/(s²+2s+2)',
    numerator: '1, 0, 1',
    denominator: '1, 2, 2',
  },
  {
    id: '3',
    label: 'F(s) = (s+1)²/(s²-2s+2)',
    numerator: '1, 2, 1',
    denominator: '1, -2, 2',
  },
  {
    id: '4',
    label: 'F(s) = 1/(s³+2s²+2s+1)',
    numerator: '1',
    denominator: '1, 2, 2, 1',
  },
];

export function PresetExamples({ onSelectExample }: PresetExamplesProps) {
  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-900/80 p-4 backdrop-blur-sm">
      <h3 className="mb-3 text-sm font-semibold text-white">预设示例</h3>
      <div className="flex flex-wrap gap-2">
        {examples.map((example) => (
          <button
            key={example.id}
            onClick={() => onSelectExample(example.numerator, example.denominator)}
            className="rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-1.5 text-xs text-slate-300 transition-colors hover:border-blue-500/50 hover:bg-slate-800 hover:text-white"
          >
            {example.label}
          </button>
        ))}
      </div>
    </div>
  );
}
