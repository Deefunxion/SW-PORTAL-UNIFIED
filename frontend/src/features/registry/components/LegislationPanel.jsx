import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { ScrollText, ExternalLink, Loader2, Search } from 'lucide-react';
import api from '@/lib/api';
import { LEGISLATION_TAGS } from '../lib/constants';

export default function LegislationPanel({ structureTypeCode }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const tagConfig = LEGISLATION_TAGS[structureTypeCode];

  useEffect(() => {
    if (!tagConfig) return;

    const searchLegislation = async () => {
      setLoading(true);
      try {
        // Search knowledge base with the first (most relevant) query
        const { data } = await api.post('/api/knowledge/search', {
          query: tagConfig.queries[0],
          limit: 5,
        });
        setResults(data.results || []);
      } catch {
        // Knowledge base may not be available — fail silently
        setResults([]);
      } finally {
        setLoading(false);
        setSearched(true);
      }
    };

    searchLegislation();
  }, [structureTypeCode, tagConfig]);

  if (!tagConfig) return null;

  return (
    <Card className="border-[#e8e2d8]">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg text-[#2a2520] flex items-center gap-2">
          <ScrollText className="w-5 h-5 text-[#1a3aa3]" />
          Σχετική Νομοθεσία
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {tagConfig.queries.map((q, i) => (
            <Badge
              key={i}
              variant="outline"
              className="bg-blue-50 text-blue-700 border-blue-200 text-xs"
            >
              <Search className="w-3 h-3 mr-1" />
              {q}
            </Badge>
          ))}
        </div>

        {/* Results */}
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-[#1a3aa3]" />
            <span className="ml-2 text-sm text-[#8a8580]">Αναζήτηση νομοθεσίας...</span>
          </div>
        ) : results.length > 0 ? (
          <div className="space-y-2">
            {results.map((r, i) => (
              <div
                key={i}
                className="p-3 rounded-lg bg-[#faf8f4] border border-[#e8e2d8] hover:border-[#1a3aa3] transition-colors"
              >
                <div className="flex items-start gap-2">
                  <FileIcon className="w-4 h-4 text-[#1a3aa3] mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-[#1a3aa3] truncate">
                      {r.source_path?.split('/').pop() || 'Έγγραφο'}
                    </p>
                    <p className="text-sm text-[#2a2520] mt-1 line-clamp-3">
                      {r.content?.slice(0, 200)}
                      {r.content?.length > 200 ? '...' : ''}
                    </p>
                    {r.similarity != null && (
                      <span className="text-xs text-[#8a8580] mt-1 inline-block">
                        Συνάφεια: {Math.round(r.similarity * 100)}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : searched ? (
          <p className="text-sm text-[#8a8580] py-4 text-center">
            Δεν βρέθηκαν σχετικά νομοθετικά κείμενα στη βάση γνώσεων.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function FileIcon(props) {
  return <ExternalLink {...props} />;
}
