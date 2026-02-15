import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table.jsx';
import { Button } from '@/components/ui/button.jsx';
import {
  AlertTriangle, AlertCircle, Info, ExternalLink, FileText, Shield,
  Scale, Building2, Users
} from 'lucide-react';
import { toast } from 'sonner';
import { oversightApi } from '../lib/registryApi';
import {
  INSPECTION_TYPES, INSPECTION_STATUS, INSPECTION_CONCLUSIONS,
  ADVISOR_REPORT_TYPES, REPORT_STATUS,
} from '../lib/constants';
import StatsCards from '../components/StatsCards';
import OversightCharts from '../components/OversightCharts';

const SEVERITY_STYLES = {
  critical: { icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
  warning: { icon: AlertCircle, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
  info: { icon: Info, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
};

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('el-GR');
}

function StatusBadge({ status, map }) {
  const info = map[status] || { label: status, color: 'gray' };
  const colorClasses = {
    green: 'bg-green-100 text-green-800 border-green-200',
    orange: 'bg-orange-100 text-orange-800 border-orange-200',
    red: 'bg-red-100 text-red-800 border-red-200',
    blue: 'bg-blue-100 text-blue-800 border-blue-200',
    gray: 'bg-gray-100 text-gray-800 border-gray-200',
  };
  return (
    <Badge variant="outline" className={colorClasses[info.color] || colorClasses.gray}>
      {info.label}
    </Badge>
  );
}

export default function OversightDashboardPage() {
  const [dashboard, setDashboard] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      oversightApi.dashboard(),
      oversightApi.alerts(),
    ])
      .then(([dashRes, alertsRes]) => {
        setDashboard(dashRes.data);
        setAlerts(alertsRes.data);
      })
      .catch(() => toast.error('Σφάλμα φόρτωσης dashboard.'))
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1a3aa3]" />
      </div>
    );
  }

  if (!dashboard) return null;

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1
          className="text-3xl font-bold text-[#2a2520]"
          style={{ fontFamily: "'Literata', serif" }}
        >
          Πίνακας Εποπτείας
        </h1>
        <p className="text-[#6b6560] mt-1">
          Συγκεντρωτική εικόνα δομών, ελέγχων, εκθέσεων και κυρώσεων
        </p>
        <div className="flex gap-2 mt-3">
          <Link to="/registry">
            <Button variant="outline" size="sm" className="border-[#e8e2d8] min-h-[36px]">
              <Building2 className="w-4 h-4 mr-1.5" />
              Μητρώο
            </Button>
          </Link>
          <Link to="/sanctions">
            <Button variant="outline" size="sm" className="border-[#e8e2d8] min-h-[36px]">
              <Scale className="w-4 h-4 mr-1.5" />
              Κυρώσεις
            </Button>
          </Link>
          <Link to="/committees">
            <Button variant="outline" size="sm" className="border-[#e8e2d8] min-h-[36px]">
              <Users className="w-4 h-4 mr-1.5" />
              Επιτροπές
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="mb-8">
        <StatsCards stats={dashboard.stats} />
      </div>

      {/* Alerts Panel */}
      {alerts.length > 0 && (
        <Card className="border-[#e8e2d8] mb-8">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-[#2a2520] flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              Ειδοποιήσεις ({alerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {alerts.map((alert, i) => {
                const style = SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.info;
                const Icon = style.icon;
                return (
                  <div
                    key={i}
                    className={`flex items-start gap-3 p-3 rounded-lg border ${style.bg} ${style.border}`}
                  >
                    <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${style.color}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#2a2520]">{alert.message}</p>
                    </div>
                    {alert.structure_id && (
                      <Link
                        to={`/registry/${alert.structure_id}`}
                        className="text-[#1a3aa3] hover:text-[#152e82] shrink-0"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      <div className="mb-8">
        <OversightCharts
          inspectionsByMonth={dashboard.inspections_by_month}
          structuresByType={dashboard.structures_by_type}
          sanctionsByStatus={dashboard.sanctions_by_status}
        />
      </div>

      {/* Recent Activity */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Recent Inspections */}
        <Card className="border-[#e8e2d8]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-[#2a2520] flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#1a3aa3]" />
              Πρόσφατοι Έλεγχοι
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dashboard.recent_inspections.length === 0 ? (
              <p className="text-sm text-[#8a8580] text-center py-6">
                Δεν υπάρχουν έλεγχοι.
              </p>
            ) : (
              <div className="rounded-lg border border-[#e8e2d8] overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#f5f2ec] hover:bg-[#f5f2ec]">
                      <TableHead className="text-xs">Τύπος</TableHead>
                      <TableHead className="text-xs">Ημ/νία</TableHead>
                      <TableHead className="text-xs">Κατάσταση</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dashboard.recent_inspections.map((insp) => (
                      <TableRow key={insp.id}>
                        <TableCell className="text-sm">
                          <Link
                            to={`/inspections/${insp.id}/report`}
                            className="text-[#1a3aa3] hover:text-[#152e82] hover:underline transition-colors"
                          >
                            {INSPECTION_TYPES[insp.type] || insp.type}
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatDate(insp.scheduled_date)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={insp.status} map={INSPECTION_STATUS} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Reports */}
        <Card className="border-[#e8e2d8]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-[#2a2520] flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#1a3aa3]" />
              Πρόσφατες Εκθέσεις
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dashboard.recent_reports.length === 0 ? (
              <p className="text-sm text-[#8a8580] text-center py-6">
                Δεν υπάρχουν εκθέσεις.
              </p>
            ) : (
              <div className="rounded-lg border border-[#e8e2d8] overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#f5f2ec] hover:bg-[#f5f2ec]">
                      <TableHead className="text-xs">Τύπος</TableHead>
                      <TableHead className="text-xs">Ημ/νία</TableHead>
                      <TableHead className="text-xs">Κατάσταση</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dashboard.recent_reports.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="text-sm">
                          {ADVISOR_REPORT_TYPES[r.type] || r.type}
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatDate(r.drafted_date)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={r.status} map={REPORT_STATUS} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
