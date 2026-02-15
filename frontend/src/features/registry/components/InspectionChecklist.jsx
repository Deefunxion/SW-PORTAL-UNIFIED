import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { ClipboardCheck, CheckCircle, AlertTriangle, XCircle, Minus, Loader2 } from 'lucide-react';
import { INSPECTION_CRITERIA } from '../lib/constants';
import { checklistApi } from '../lib/registryApi';

const RATINGS = [
  { value: 'pass', label: '\u0395\u03c0\u03b1\u03c1\u03ba\u03ad\u03c2', icon: CheckCircle, color: 'text-green-600 bg-green-50 border-green-200 hover:bg-green-100' },
  { value: 'partial', label: '\u039c\u03b5\u03c1\u03b9\u03ba\u03cc', icon: AlertTriangle, color: 'text-orange-600 bg-orange-50 border-orange-200 hover:bg-orange-100' },
  { value: 'fail', label: '\u0391\u03bd\u03b5\u03c0\u03b1\u03c1\u03ba\u03ad\u03c2', icon: XCircle, color: 'text-red-600 bg-red-50 border-red-200 hover:bg-red-100' },
  { value: null, label: '\u0394/\u0395', icon: Minus, color: 'text-gray-400 bg-gray-50 border-gray-200 hover:bg-gray-100' },
];

/**
 * Convert API checklist template items to the flat criteria format used by the component.
 * API format: [{ category, items: [{ id, description, is_required, legal_ref }] }]
 * Component format: { label, categories: [...], criteria: [{ id, label, category, legal_ref }] }
 */
function convertApiTemplate(template) {
  const categories = template.items.map(g => g.category);
  const criteria = [];
  template.items.forEach(group => {
    group.items.forEach(item => {
      criteria.push({
        id: item.id,
        label: item.description,
        category: group.category,
        legal_ref: item.legal_ref,
        is_required: item.is_required,
      });
    });
  });
  return {
    label: template.name,
    categories,
    criteria,
    fromApi: true,
  };
}

export default function InspectionChecklist({ structureTypeCode, structureTypeId, value, onChange, readOnly = false }) {
  const [apiConfig, setApiConfig] = useState(null);
  const [loading, setLoading] = useState(false);

  // Try to fetch checklist template from API
  useEffect(() => {
    if (!structureTypeId) return;
    setLoading(true);
    checklistApi.forType(structureTypeId)
      .then(resp => {
        setApiConfig(convertApiTemplate(resp.data));
      })
      .catch(() => {
        // Fall back to hardcoded criteria
        setApiConfig(null);
      })
      .finally(() => setLoading(false));
  }, [structureTypeId]);

  // Use API config if available, otherwise fall back to hardcoded constants
  const config = apiConfig || INSPECTION_CRITERIA[structureTypeCode] || INSPECTION_CRITERIA.DEFAULT;

  const [checklist, setChecklist] = useState(() => {
    if (value) return value;
    const initial = {};
    config.criteria.forEach((c) => {
      initial[c.id] = { rating: null, note: '' };
    });
    return initial;
  });

  // Reset checklist when config changes (e.g., API data loads)
  useEffect(() => {
    if (!value) {
      const initial = {};
      config.criteria.forEach((c) => {
        initial[c.id] = checklist[c.id] || { rating: null, note: '' };
      });
      setChecklist(initial);
    }
  }, [config]); // eslint-disable-line react-hooks/exhaustive-deps

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

  if (loading) {
    return (
      <Card className="border-[#e8e2d8]">
        <CardContent className="py-12 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#1a3aa3]" />
          <p className="text-sm text-[#8a8580]">\u03a6\u03cc\u03c1\u03c4\u03c9\u03c3\u03b7 \u03c0\u03c1\u03bf\u03c4\u03cd\u03c0\u03bf\u03c5 \u03b5\u03bb\u03ad\u03b3\u03c7\u03bf\u03c5...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-[#e8e2d8]">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg text-[#2a2520] flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-[#1a3aa3]" />
            \u039a\u03c1\u03b9\u03c4\u03ae\u03c1\u03b9\u03b1 \u0395\u03bb\u03ad\u03b3\u03c7\u03bf\u03c5 \u2014 {config.label}
            {config.fromApi && (
              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200 ml-2">
                API
              </Badge>
            )}
          </CardTitle>
          <div className="flex gap-2">
            {stats.pass > 0 && (
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                {stats.pass} \u0395\u03c0\u03b1\u03c1\u03ba\u03ae
              </Badge>
            )}
            {stats.partial > 0 && (
              <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                {stats.partial} \u039c\u03b5\u03c1\u03b9\u03ba\u03ac
              </Badge>
            )}
            {stats.fail > 0 && (
              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                {stats.fail} \u0391\u03bd\u03b5\u03c0\u03b1\u03c1\u03ba\u03ae
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
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-medium text-[#2a2520]">{c.label}</span>
                        {c.is_required && (
                          <Badge variant="outline" className="text-[10px] bg-red-50 text-red-600 border-red-200 shrink-0">
                            \u03a5\u03c0\u03bf\u03c7\u03c1.
                          </Badge>
                        )}
                      </div>
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
                          {RATINGS.find((r) => r.value === entry.rating)?.label || '\u0394/\u0395'}
                        </Badge>
                      )}
                    </div>
                    {c.legal_ref && (
                      <p className="text-[10px] text-[#8a8580] mb-1">{c.legal_ref}</p>
                    )}
                    {!readOnly && (
                      <Textarea
                        value={entry.note}
                        onChange={(e) => updateCriterion(c.id, 'note', e.target.value)}
                        placeholder="\u03a3\u03b7\u03bc\u03b5\u03af\u03c9\u03c3\u03b7 (\u03c0\u03c1\u03bf\u03b1\u03b9\u03c1\u03b5\u03c4\u03b9\u03ba\u03cc)..."
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
