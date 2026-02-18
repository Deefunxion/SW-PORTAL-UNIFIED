import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { ScrollText, Download, FileText, Loader2 } from 'lucide-react';
import api from '@/lib/api';

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const API_BASE = import.meta.env.VITE_API_URL || '';

export default function LegislationPanel({ structureTypeCode }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    if (!structureTypeCode) return;

    setLoading(true);
    api
      .get(`/api/legislation/${structureTypeCode}`)
      .then(({ data }) => setFiles(data.files || []))
      .catch(() => setFiles([]))
      .finally(() => {
        setLoading(false);
        setFetched(true);
      });
  }, [structureTypeCode]);

  if (!structureTypeCode) return null;

  return (
    <Card className="border-[#e8e2d8]">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg text-[#2a2520] flex items-center gap-2">
          <ScrollText className="w-5 h-5 text-[#1a3aa3]" />
          Σχετική Νομοθεσία
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-[#1a3aa3]" />
            <span className="ml-2 text-sm text-[#8a8580]">Φόρτωση αρχείων...</span>
          </div>
        ) : files.length > 0 ? (
          <div className="space-y-1.5">
            {files.map((f, i) => (
              <a
                key={i}
                href={`${API_BASE}/content/${encodeURI(f.path)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-2.5 rounded-lg bg-[#faf8f4] border border-[#e8e2d8] hover:border-[#1a3aa3] hover:bg-blue-50/40 transition-colors group"
              >
                <FileText className="w-4 h-4 text-red-500 shrink-0" />
                <span className="flex-1 min-w-0 text-sm text-[#2a2520] truncate group-hover:text-[#1a3aa3]">
                  {f.name}
                </span>
                <span className="text-xs text-[#8a8580] shrink-0">{formatSize(f.size)}</span>
                <Download className="w-3.5 h-3.5 text-[#8a8580] group-hover:text-[#1a3aa3] shrink-0" />
              </a>
            ))}
          </div>
        ) : fetched ? (
          <p className="text-sm text-[#8a8580] py-4 text-center">
            Δεν βρέθηκαν αρχεία νομοθεσίας για αυτόν τον τύπο δομής.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
