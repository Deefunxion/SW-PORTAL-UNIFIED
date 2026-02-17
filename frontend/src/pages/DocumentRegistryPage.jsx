import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select.jsx';
import {
  Plus, Search, FileText, ChevronLeft, ChevronRight,
  Download, Eye, Edit, Filter,
} from 'lucide-react';
import api from '@/lib/api';

const STATUS_LABELS = {
  draft: 'Πρόχειρο',
  sent_to_irida: 'Σε ΙΡΙΔΑ',
  protocol_received: 'Πρωτοκολλήθηκε',
  submitted: 'Υποβληθέν',
  approved: 'Εγκρίθηκε',
};

const STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-700 border-gray-200',
  sent_to_irida: 'bg-blue-100 text-blue-700 border-blue-200',
  protocol_received: 'bg-green-100 text-green-700 border-green-200',
  submitted: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  approved: 'bg-green-100 text-green-700 border-green-200',
};

const TYPE_LABELS = {
  all: 'Όλα',
  decision: 'Αποφάσεις',
  inspection_report: 'Εκθέσεις Ελέγχου',
  advisor_report: 'Εκθέσεις Συμβούλου',
  sanction_decision: 'Αποφάσεις Κυρώσεων',
};

function DocumentRegistryPage() {
  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    fetchDocuments();
  }, [page, search, typeFilter, statusFilter]);

  const fetchDocuments = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', page);
      params.set('per_page', '20');
      params.set('type', typeFilter);
      if (statusFilter) params.set('status', statusFilter);
      if (search) params.set('search', search);

      const { data } = await api.get(`/api/document-registry?${params}`);
      setDocuments(data.documents || []);
      setTotal(data.total || 0);
      setTotalPages(data.pages || 1);
    } catch (error) {
      console.error('Error fetching documents:', error);
      setDocuments([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  };

  const handleDownloadPdf = async (doc) => {
    if (doc.source !== 'decision_record') return;
    try {
      const response = await api.get(`/api/decisions/${doc.id}/pdf`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `decision_${doc.id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading PDF:', error);
    }
  };

  const formatDate = (iso) => {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('el-GR');
    } catch {
      return iso;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#2a2520]" style={{ fontFamily: "'Literata', serif" }}>
            Μητρώο Εγγράφων
          </h1>
          <p className="text-[#6b6560] mt-1">
            Ενιαίο μητρώο αποφάσεων, εκθέσεων και εγγράφων — {total} εγγραφές
          </p>
        </div>
        <Link to="/documents/new">
          <Button className="bg-[#1a3aa3] hover:bg-[#152e82] text-white min-h-[48px] px-6">
            <Plus className="w-5 h-5 mr-2" />
            Νέο Έγγραφο
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <Card className="mb-6 border-[#e8e2d8]">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <form onSubmit={handleSearch} className="flex-1 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8a8580]" />
                <Input
                  placeholder="Αναζήτηση αρ. πρωτοκόλλου, δομής ή τύπου..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pl-10 min-h-[44px] border-[#e8e2d8]"
                />
              </div>
              <Button type="submit" variant="outline" className="min-h-[44px] border-[#e8e2d8]">
                <Search className="w-4 h-4" />
              </Button>
            </form>

            {/* Type filter */}
            <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
              <SelectTrigger className="w-full md:w-[200px] min-h-[44px] border-[#e8e2d8]">
                <Filter className="w-4 h-4 mr-2 text-[#8a8580]" />
                <SelectValue placeholder="Τύπος" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status filter */}
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v === '_all' ? '' : v); setPage(1); }}>
              <SelectTrigger className="w-full md:w-[180px] min-h-[44px] border-[#e8e2d8]">
                <SelectValue placeholder="Κατάσταση" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">Όλες</SelectItem>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1a3aa3]" />
        </div>
      ) : documents.length === 0 ? (
        <Card className="border-[#e8e2d8]">
          <CardContent className="py-16 text-center">
            <FileText className="w-12 h-12 text-[#c4bfb8] mx-auto mb-4" />
            <h3 className="text-lg font-medium text-[#2a2520] mb-2">Δεν βρέθηκαν έγγραφα</h3>
            <p className="text-[#6b6560]">Δοκιμάστε διαφορετικά φίλτρα ή δημιουργήστε ένα νέο έγγραφο.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Table */}
          <Card className="border-[#e8e2d8] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#f8f5f0] border-b border-[#e8e2d8]">
                    <th className="text-left px-4 py-3 text-sm font-semibold text-[#2a2520]">Α/Α</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-[#2a2520]">Τύπος</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-[#2a2520]">Αρ. Πρωτ.</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-[#2a2520]">Δομή</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-[#2a2520]">Ημ/νία</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-[#2a2520]">Κατάσταση</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-[#2a2520]">Συντάκτης</th>
                    <th className="text-right px-4 py-3 text-sm font-semibold text-[#2a2520]">Ενέργειες</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc, idx) => (
                    <tr key={`${doc.source}-${doc.id}`} className="border-b border-[#e8e2d8] hover:bg-[#faf8f5] transition-colors">
                      <td className="px-4 py-3 text-sm text-[#6b6560]">{(page - 1) * 20 + idx + 1}</td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-[#2a2520]">{doc.type_label}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-[#2a2520] font-mono">
                        {doc.protocol_number || '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-[#6b6560]">
                        {doc.structure_name || '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-[#6b6560]">
                        {formatDate(doc.date)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className={`text-xs ${STATUS_COLORS[doc.status] || 'bg-gray-100 text-gray-600 border-gray-200'}`}
                        >
                          {STATUS_LABELS[doc.status] || doc.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-[#6b6560]">
                        {doc.author || '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          {doc.source === 'decision_record' && (
                            <>
                              <Link to={`/documents/${doc.id}/edit`}>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Προβολή/Επεξεργασία">
                                  {doc.status === 'draft' ? (
                                    <Edit className="w-4 h-4 text-[#6b6560]" />
                                  ) : (
                                    <Eye className="w-4 h-4 text-[#6b6560]" />
                                  )}
                                </Button>
                              </Link>
                              <Button
                                variant="ghost" size="sm" className="h-8 w-8 p-0"
                                onClick={() => handleDownloadPdf(doc)}
                                title="Λήψη PDF"
                              >
                                <Download className="w-4 h-4 text-[#6b6560]" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <p className="text-sm text-[#6b6560]">
                Σελίδα {page} από {totalPages} ({total} σύνολο)
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page <= 1}
                  className="min-h-[36px] border-[#e8e2d8]"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Προηγούμενη
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page >= totalPages}
                  className="min-h-[36px] border-[#e8e2d8]"
                >
                  Επόμενη
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default DocumentRegistryPage;
