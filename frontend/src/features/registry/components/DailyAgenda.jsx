import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import {
  CalendarDays, Shield, FileWarning, CreditCard, AlertTriangle, ExternalLink
} from 'lucide-react';
import { oversightApi } from '../lib/registryApi';

const TYPE_CONFIG = {
  inspection: {
    icon: Shield,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    label: 'Έλεγχος',
  },
  license_expiring: {
    icon: FileWarning,
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    label: 'Λήξη Άδειας',
  },
  pending_approval: {
    icon: CalendarDays,
    color: 'text-yellow-600',
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    label: 'Εκκρεμεί',
  },
  overdue_payment: {
    icon: CreditCard,
    color: 'text-red-600',
    bg: 'bg-red-50',
    border: 'border-red-200',
    label: 'Εκπρόθεσμη',
  },
};

const PRIORITY_STYLES = {
  critical: 'border-l-4 border-l-red-500',
  high: 'border-l-4 border-l-orange-400',
  medium: 'border-l-4 border-l-blue-300',
  low: 'border-l-4 border-l-gray-300',
};

export default function DailyAgenda() {
  const [agenda, setAgenda] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    oversightApi.dailyAgenda()
      .then(r => setAgenda(r.data))
      .catch(() => setAgenda({ items: [], summary: { total: 0, critical: 0, high: 0 } }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Card className="border-[#e8e2d8]">
        <CardContent className="py-8 text-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#1a3aa3] mx-auto" />
        </CardContent>
      </Card>
    );
  }

  if (!agenda || agenda.items.length === 0) {
    return (
      <Card className="border-[#e8e2d8]">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg text-[#2a2520] flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-[#1a3aa3]" />
            Ατζέντα Ημέρας
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[#8a8580] text-center py-4">
            Δεν υπάρχουν εκκρεμότητες για σήμερα.
          </p>
        </CardContent>
      </Card>
    );
  }

  const today = agenda.date
    ? new Date(agenda.date).toLocaleDateString('el-GR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('el-GR');

  return (
    <Card className="border-[#e8e2d8]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg text-[#2a2520] flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-[#1a3aa3]" />
            Ατζέντα Ημέρας
          </CardTitle>
          <div className="flex items-center gap-2">
            {agenda.summary.critical > 0 && (
              <Badge className="bg-red-100 text-red-800 border-red-200">
                <AlertTriangle className="w-3 h-3 mr-1" />
                {agenda.summary.critical} κρίσιμα
              </Badge>
            )}
            {agenda.summary.high > 0 && (
              <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                {agenda.summary.high} υψηλής
              </Badge>
            )}
            <Badge variant="outline" className="text-xs">
              {agenda.summary.total} εκκρεμότητες
            </Badge>
          </div>
        </div>
        <p className="text-sm text-[#8a8580] mt-1 capitalize">{today}</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {agenda.items.map((item, i) => {
            const config = TYPE_CONFIG[item.type] || TYPE_CONFIG.pending_approval;
            const Icon = config.icon;
            return (
              <Link
                key={i}
                to={item.link}
                className={`flex items-start gap-3 p-3 rounded-lg border ${config.bg} ${config.border} ${PRIORITY_STYLES[item.priority] || ''} hover:shadow-sm transition-shadow group`}
              >
                <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${config.color}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#2a2520] truncate">{item.title}</p>
                  <p className="text-xs text-[#6b6560] mt-0.5">{item.subtitle}</p>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-[#8a8580] opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" />
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
