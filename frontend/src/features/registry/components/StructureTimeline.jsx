import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge.jsx';
import { FileText, Shield, Scale, Award, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { structuresApi } from '../lib/registryApi';

const TYPE_CONFIG = {
  license: { icon: Award, color: 'text-blue-600', bg: 'bg-blue-100', border: 'border-blue-300', label: 'Άδεια' },
  inspection: { icon: Shield, color: 'text-indigo-600', bg: 'bg-indigo-100', border: 'border-indigo-300', label: 'Έλεγχος' },
  report: { icon: FileText, color: 'text-teal-600', bg: 'bg-teal-100', border: 'border-teal-300', label: 'Έκθεση' },
  sanction: { icon: Scale, color: 'text-red-600', bg: 'bg-red-100', border: 'border-red-300', label: 'Κύρωση' },
};

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('el-GR', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

export default function StructureTimeline({ structureId }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    structuresApi.timeline(structureId)
      .then(({ data }) => setEvents(data))
      .catch(() => toast.error('Σφάλμα φόρτωσης χρονολογίου'))
      .finally(() => setLoading(false));
  }, [structureId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1a3aa3]" />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-16">
        <Clock className="w-12 h-12 text-[#b0a99e] mx-auto mb-4" />
        <p className="text-[#8a8580] text-lg">Κενό χρονολόγιο</p>
        <p className="text-[#b0a99e] text-sm mt-1">
          Δεν υπάρχουν καταγεγραμμένα γεγονότα για αυτή τη δομή.
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-5 top-0 bottom-0 w-px bg-[#e8e2d8]" />

      <div className="space-y-4">
        {events.map((event, i) => {
          const config = TYPE_CONFIG[event.type] || TYPE_CONFIG.report;
          const Icon = config.icon;

          return (
            <div key={`${event.type}-${event.id}-${i}`} className="relative flex items-start gap-4 pl-12">
              {/* Dot on timeline */}
              <div
                className={`absolute left-3 top-1 w-5 h-5 rounded-full flex items-center justify-center ${config.bg} ${config.border} border`}
              >
                <Icon className={`w-3 h-3 ${config.color}`} />
              </div>

              {/* Content */}
              <div className="flex-1 bg-white rounded-lg border border-[#e8e2d8] p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`text-xs ${config.bg} ${config.color} border-transparent`}>
                      {config.label}
                    </Badge>
                    <span className="font-medium text-[#2a2520] text-sm">
                      {event.title}
                    </span>
                  </div>
                  <span className="text-xs text-[#8a8580]">
                    {formatDate(event.date)}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1.5">
                  {event.status && (
                    <span className="text-xs text-[#6b6560]">
                      Κατάσταση: {event.status}
                    </span>
                  )}
                  {event.detail && (
                    <span className="text-xs text-[#8a8580] truncate">
                      {event.detail}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
