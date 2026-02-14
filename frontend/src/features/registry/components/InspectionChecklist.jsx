import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { ClipboardCheck, CheckCircle, AlertTriangle, XCircle, Minus } from 'lucide-react';
import { INSPECTION_CRITERIA } from '../lib/constants';

const RATINGS = [
  { value: 'pass', label: 'Επαρκές', icon: CheckCircle, color: 'text-green-600 bg-green-50 border-green-200 hover:bg-green-100' },
  { value: 'partial', label: 'Μερικό', icon: AlertTriangle, color: 'text-orange-600 bg-orange-50 border-orange-200 hover:bg-orange-100' },
  { value: 'fail', label: 'Ανεπαρκές', icon: XCircle, color: 'text-red-600 bg-red-50 border-red-200 hover:bg-red-100' },
  { value: null, label: 'Δ/Ε', icon: Minus, color: 'text-gray-400 bg-gray-50 border-gray-200 hover:bg-gray-100' },
];

export default function InspectionChecklist({ structureTypeCode, value, onChange, readOnly = false }) {
  const config = INSPECTION_CRITERIA[structureTypeCode] || INSPECTION_CRITERIA.DEFAULT;
  const [checklist, setChecklist] = useState(() => {
    if (value) return value;
    const initial = {};
    config.criteria.forEach((c) => {
      initial[c.id] = { rating: null, note: '' };
    });
    return initial;
  });

  const updateCriterion = (criterionId, field, val) => {
    const updated = {
      ...checklist,
      [criterionId]: { ...checklist[criterionId], [field]: val },
    };
    setChecklist(updated);
    onChange?.(updated);
  };

  const grouped = useMemo(() => {
    const groups = {};
    config.categories.forEach((cat) => { groups[cat] = []; });
    config.criteria.forEach((c) => {
      if (groups[c.category]) groups[c.category].push(c);
    });
    return groups;
  }, [config]);

  // Summary stats
  const stats = useMemo(() => {
    const counts = { pass: 0, partial: 0, fail: 0, unevaluated: 0 };
    config.criteria.forEach((c) => {
      const r = checklist[c.id]?.rating;
      if (r === 'pass') counts.pass++;
      else if (r === 'partial') counts.partial++;
      else if (r === 'fail') counts.fail++;
      else counts.unevaluated++;
    });
    return counts;
  }, [checklist, config]);

  return (
    <Card className="border-[#e8e2d8]">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg text-[#2a2520] flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-[#1a3aa3]" />
            Κριτήρια Ελέγχου — {config.label}
          </CardTitle>
          <div className="flex gap-2">
            {stats.pass > 0 && (
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                {stats.pass} Επαρκή
              </Badge>
            )}
            {stats.partial > 0 && (
              <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                {stats.partial} Μερικά
              </Badge>
            )}
            {stats.fail > 0 && (
              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                {stats.fail} Ανεπαρκή
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {Object.entries(grouped).map(([category, criteria]) => (
          <div key={category}>
            <h4 className="text-sm font-semibold text-[#2a2520] uppercase tracking-wide mb-3 border-b border-[#e8e2d8] pb-1">
              {category}
            </h4>
            <div className="space-y-3">
              {criteria.map((c) => {
                const entry = checklist[c.id] || { rating: null, note: '' };
                return (
                  <div key={c.id} className="rounded-lg border border-[#e8e2d8] p-3">
                    <div className="flex items-center justify-between gap-4 mb-1">
                      <span className="text-sm font-medium text-[#2a2520]">{c.label}</span>
                      {!readOnly && (
                        <div className="flex gap-1 shrink-0">
                          {RATINGS.map((r) => {
                            const Icon = r.icon;
                            const isActive = entry.rating === r.value;
                            return (
                              <button
                                key={r.value ?? 'none'}
                                type="button"
                                onClick={() => updateCriterion(c.id, 'rating', r.value)}
                                className={`flex items-center gap-1 px-2 py-1 text-xs rounded border transition-all
                                  ${isActive ? r.color + ' font-semibold ring-1 ring-offset-1' : 'text-gray-400 bg-white border-gray-200 hover:bg-gray-50'}`}
                                title={r.label}
                              >
                                <Icon className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">{r.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {readOnly && (
                        <Badge variant="outline" className={
                          entry.rating === 'pass' ? 'bg-green-50 text-green-700 border-green-200' :
                          entry.rating === 'partial' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                          entry.rating === 'fail' ? 'bg-red-50 text-red-700 border-red-200' :
                          'bg-gray-50 text-gray-500 border-gray-200'
                        }>
                          {RATINGS.find((r) => r.value === entry.rating)?.label || 'Δ/Ε'}
                        </Badge>
                      )}
                    </div>
                    {!readOnly && (
                      <Textarea
                        value={entry.note}
                        onChange={(e) => updateCriterion(c.id, 'note', e.target.value)}
                        placeholder="Σημείωση (προαιρετικό)..."
                        className="mt-2 min-h-[36px] text-xs border-[#e8e2d8] resize-none"
                        rows={1}
                      />
                    )}
                    {readOnly && entry.note && (
                      <p className="text-xs text-[#6b6560] mt-1 italic">{entry.note}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
