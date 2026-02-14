import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select.jsx';
import { Download, FileText, Loader2 } from 'lucide-react';
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

export default function ReportsPage() {
  const [reportType, setReportType] = useState('registry');
  const [format, setFormat] = useState('pdf');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [downloading, setDownloading] = useState(false);

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
    <div className="container mx-auto px-4 py-8 max-w-3xl">
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
    </div>
  );
}
