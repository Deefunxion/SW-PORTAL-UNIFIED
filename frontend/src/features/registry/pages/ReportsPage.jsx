import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select.jsx';
import { Download, FileText, Loader2, ArrowLeft, ClipboardList, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import { oversightApi } from '../lib/registryApi';

const REPORT_TYPES = [
  {
    value: 'registry',
    label: 'Μητρώο Δομών',
    description: 'Συνολική κατάσταση δομών με στοιχεία αδειοδότησης',
  },
  {
    value: 'inspections',
    label: 'Έλεγχοι',
    description: 'Αναφορά ελέγχων ανά περίοδο, τύπο και αποτέλεσμα',
  },
  {
    value: 'sanctions',
    label: 'Κυρώσεις',
    description: 'Αναφορά κυρώσεων ανά περίοδο και κατάσταση',
  },
];

const REPORT_STATUS_STYLES = {
  draft: { label: 'Πρόχειρο', className: 'bg-gray-50 text-gray-700 border-gray-200' },
  submitted: { label: 'Υποβληθείσα', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  approved: { label: 'Εγκεκριμένη', className: 'bg-green-50 text-green-700 border-green-200' },
  finalized: { label: 'Οριστικοποιημένη', className: 'bg-green-50 text-green-700 border-green-200' },
};

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('el-GR');
}

export default function ReportsPage() {
  const [reportType, setReportType] = useState('registry');
  const [format, setFormat] = useState('pdf');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [downloading, setDownloading] = useState(false);

  const [recentInspections, setRecentInspections] = useState([]);
  const [advisorReports, setAdvisorReports] = useState([]);

  useEffect(() => {
    oversightApi.dashboard()
      .then(({ data }) => {
        setRecentInspections(data.recent_inspections || []);
        setAdvisorReports(data.recent_reports || []);
      })
      .catch(() => {});
  }, []);

  const selectedReport = REPORT_TYPES.find((r) => r.value === reportType);
  const showDateFilter = reportType !== 'registry';

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const params = { format };
      if (showDateFilter && dateFrom) params.date_from = dateFrom;
      if (showDateFilter && dateTo) params.date_to = dateTo;

      const response = await oversightApi.reports(reportType, params);
      const blob = new Blob([response.data], {
        type: format === 'pdf'
          ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${reportType}_${new Date().toISOString().slice(0, 10)}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Η αναφορά δημιουργήθηκε.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Σφάλμα δημιουργίας αναφοράς.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <Link to="/registry" className="inline-flex items-center gap-1 text-sm text-[#1a3aa3] hover:underline mb-4">
        <ArrowLeft className="w-4 h-4" />
        Μητρώο Δομών
      </Link>
      <div className="mb-8">
        <h1
          className="text-3xl font-bold text-[#2a2520]"
          style={{ fontFamily: "'Literata', serif" }}
        >
          Αναφορές
        </h1>
        <p className="text-[#6b6560] mt-1">
          Δημιουργία αναφορών σε μορφή PDF ή XLSX
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Report Generator */}
        <Card className="border-[#e8e2d8]">
          <CardHeader>
            <CardTitle className="text-lg text-[#2a2520] flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#1a3aa3]" />
              Παραμετροποίηση Αναφοράς
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Report type */}
            <div>
              <label className="text-sm font-medium text-[#2a2520]">Τύπος αναφοράς</label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger className="mt-1 min-h-[44px] border-[#e8e2d8]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_TYPES.map((rt) => (
                    <SelectItem key={rt.value} value={rt.value}>
                      {rt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedReport && (
                <p className="text-xs text-[#8a8580] mt-1.5">{selectedReport.description}</p>
              )}
            </div>

            {/* Date range (only for inspections/sanctions) */}
            {showDateFilter && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-[#2a2520]">Από</label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="mt-1 min-h-[44px] border-[#e8e2d8]"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-[#2a2520]">Έως</label>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="mt-1 min-h-[44px] border-[#e8e2d8]"
                  />
                </div>
              </div>
            )}

            {/* Format */}
            <div>
              <label className="text-sm font-medium text-[#2a2520]">Μορφή αρχείου</label>
              <div className="flex gap-3 mt-2">
                <Button
                  variant={format === 'pdf' ? 'default' : 'outline'}
                  onClick={() => setFormat('pdf')}
                  className={format === 'pdf'
                    ? 'bg-[#1a3aa3] hover:bg-[#152e82] text-white min-h-[44px]'
                    : 'border-[#e8e2d8] min-h-[44px]'}
                >
                  PDF
                </Button>
                <Button
                  variant={format === 'xlsx' ? 'default' : 'outline'}
                  onClick={() => setFormat('xlsx')}
                  className={format === 'xlsx'
                    ? 'bg-[#1a3aa3] hover:bg-[#152e82] text-white min-h-[44px]'
                    : 'border-[#e8e2d8] min-h-[44px]'}
                >
                  XLSX
                </Button>
              </div>
            </div>

            {/* Download */}
            <Button
              onClick={handleDownload}
              disabled={downloading}
              className="w-full bg-[#1a3aa3] hover:bg-[#152e82] text-white min-h-[48px] text-base"
            >
              {downloading ? (
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <Download className="w-5 h-5 mr-2" />
              )}
              Λήψη Αναφοράς
            </Button>
          </CardContent>
        </Card>

        {/* Right: Recent Reports */}
        <div className="space-y-6">
          {/* Recent Inspection Reports */}
          <Card className="border-[#e8e2d8]">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-[#2a2520] flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-[#1a3aa3]" />
                Πρόσφατοι Έλεγχοι
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentInspections.length === 0 ? (
                <p className="text-sm text-[#8a8580] text-center py-4">Δεν βρέθηκαν έλεγχοι</p>
              ) : (
                <div className="space-y-2">
                  {recentInspections.map(insp => {
                    const statusStyle = REPORT_STATUS_STYLES[insp.report?.status] || REPORT_STATUS_STYLES.draft;
                    return (
                      <div key={insp.id} className="flex items-center justify-between text-sm py-2 border-b border-[#e8e2d8] last:border-0">
                        <div className="min-w-0">
                          <p className="font-medium text-[#2a2520] truncate">
                            {insp.structure_name || `Δομή #${insp.structure_id}`}
                          </p>
                          <p className="text-xs text-[#8a8580]">
                            {formatDate(insp.scheduled_date)} — {insp.report?.protocol_number || 'Χωρίς έκθεση'}
                          </p>
                        </div>
                        {insp.report ? (
                          <Badge variant="outline" className={statusStyle.className}>
                            {statusStyle.label}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-gray-50 text-gray-500 border-gray-200">
                            Εκκρεμεί
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Advisor Reports */}
          <Card className="border-[#e8e2d8]">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-[#2a2520] flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-[#1a3aa3]" />
                Εκθέσεις Κοινωνικών Συμβούλων
              </CardTitle>
            </CardHeader>
            <CardContent>
              {advisorReports.length === 0 ? (
                <p className="text-sm text-[#8a8580] text-center py-4">Δεν βρέθηκαν εκθέσεις</p>
              ) : (
                <div className="space-y-2">
                  {advisorReports.map(report => {
                    const statusStyle = REPORT_STATUS_STYLES[report.status] || REPORT_STATUS_STYLES.draft;
                    return (
                      <div key={report.id} className="flex items-center justify-between text-sm py-2 border-b border-[#e8e2d8] last:border-0">
                        <div className="min-w-0">
                          <p className="font-medium text-[#2a2520] truncate">
                            {report.structure_name || `Δομή #${report.structure_id}`}
                          </p>
                          <p className="text-xs text-[#8a8580]">
                            {report.author_name || 'Σύμβουλος'} — {formatDate(report.created_at)}
                          </p>
                        </div>
                        <Badge variant="outline" className={statusStyle.className}>
                          {statusStyle.label}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
