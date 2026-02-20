import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card.jsx';
import FaIcon from '@/components/FaIcon';

const CARDS = [
  { key: 'total_structures', label: 'Συνολικές Δομές', icon: 'landmark-dome', color: 'text-[#1a3aa3]', bg: 'bg-blue-50', link: '/registry' },
  { key: 'active_structures', label: 'Ενεργές Δομές', icon: 'building-circle-check', color: 'text-green-600', bg: 'bg-green-50', link: '/registry?status=active' },
  { key: 'total_inspections', label: 'Έλεγχοι', icon: 'magnifying-glass', color: 'text-indigo-600', bg: 'bg-indigo-50', link: '/committees' },
  { key: 'completed_inspections', label: 'Ολοκληρωμένοι', icon: 'list-check', color: 'text-teal-600', bg: 'bg-teal-50', link: '/committees' },
  { key: 'submitted_reports', label: 'Εκκρεμείς Εκθέσεις', icon: 'file-circle-exclamation', color: 'text-orange-600', bg: 'bg-orange-50', link: '/reports' },
  { key: 'total_sanctions', label: 'Κυρώσεις', icon: 'gavel', color: 'text-red-600', bg: 'bg-red-50', link: '/sanctions' },
];

const DECISION_CARDS = [
  { key: 'submitted', label: 'Αναμένουν Έγκριση', icon: 'stamp', color: 'text-amber-600', bg: 'bg-amber-50', link: '/sanctions/decisions' },
  { key: 'overdue', label: 'Εκπρόθεσμες', icon: 'calendar-xmark', color: 'text-red-600', bg: 'bg-red-50', link: '/sanctions/decisions' },
  { key: 'total_amount_pending', label: 'Εκκρεμή (€)', icon: 'sack-dollar', color: 'text-orange-600', bg: 'bg-orange-50', format: 'currency', link: '/sanctions/decisions' },
  { key: 'total_amount_paid', label: 'Εισπράχθηκαν (€)', icon: 'vault', color: 'text-green-600', bg: 'bg-green-50', format: 'currency', link: '/sanctions/decisions' },
];

function formatValue(value, format) {
  if (format === 'currency') {
    return (value || 0).toLocaleString('el-GR', { maximumFractionDigits: 0 });
  }
  return value ?? 0;
}

export default function StatsCards({ stats, decisionStats }) {
  if (!stats) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {CARDS.map(({ key, label, icon, color, bg, link }) => (
          <Link to={link} key={key} className="block hover:scale-[1.02] transition-transform">
            <Card className="border-[#e8e2d8] cursor-pointer hover:shadow-md hover:border-[#1a3aa3]/30 transition-all h-full">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${bg}`}>
                    <FaIcon name={icon} className={`w-5 h-5 ${color}`} />
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
          </Link>
        ))}
      </div>
      {decisionStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {DECISION_CARDS.map(({ key, label, icon, color, bg, link, format }) => {
            const content = (
              <Card key={key} className={`border-[#e8e2d8] ${link ? 'hover:border-[#1a3aa3]/30 transition-colors cursor-pointer' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${bg}`}>
                      <FaIcon name={icon} className={`w-5 h-5 ${color}`} />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-[#2a2520]">
                        {formatValue(decisionStats[key], format)}
                      </p>
                      <p className="text-xs text-[#8a8580] leading-tight">{label}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
            return link ? <Link key={key} to={link}>{content}</Link> : <div key={key}>{content}</div>;
          })}
        </div>
      )}
    </div>
  );
}
