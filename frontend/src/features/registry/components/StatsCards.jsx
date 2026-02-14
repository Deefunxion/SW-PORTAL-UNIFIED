import { Card, CardContent } from '@/components/ui/card.jsx';
import {
  Building2, CheckCircle, ClipboardList, FileText, AlertTriangle, Scale
} from 'lucide-react';

const CARDS = [
  { key: 'total_structures', label: 'Συνολικές Δομές', icon: Building2, color: 'text-[#1a3aa3]', bg: 'bg-blue-50' },
  { key: 'active_structures', label: 'Ενεργές Δομές', icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
  { key: 'total_inspections', label: 'Έλεγχοι', icon: ClipboardList, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  { key: 'completed_inspections', label: 'Ολοκληρωμένοι', icon: CheckCircle, color: 'text-teal-600', bg: 'bg-teal-50' },
  { key: 'submitted_reports', label: 'Εκκρεμείς Εκθέσεις', icon: FileText, color: 'text-orange-600', bg: 'bg-orange-50' },
  { key: 'total_sanctions', label: 'Κυρώσεις', icon: Scale, color: 'text-red-600', bg: 'bg-red-50' },
];

export default function StatsCards({ stats }) {
  if (!stats) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {CARDS.map(({ key, label, icon: Icon, color, bg }) => (
        <Card key={key} className="border-[#e8e2d8]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${bg}`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#2a2520]">
                  {stats[key] ?? 0}
                </p>
                <p className="text-xs text-[#8a8580] leading-tight">{label}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
