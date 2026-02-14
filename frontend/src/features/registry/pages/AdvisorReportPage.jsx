import { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { structuresApi, oversightApi } from '../lib/registryApi';
import AdvisorReportForm from '../components/AdvisorReportForm';

export default function AdvisorReportPage() {
  const { structureId, reportId } = useParams();
  const navigate = useNavigate();
  const [structure, setStructure] = useState(null);
  const [report, setReport] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const { data: s } = await structuresApi.get(structureId);
        setStructure(s);
        if (reportId) {
          const { data: r } = await oversightApi.getAdvisorReport(reportId);
          setReport(r);
        }
      } catch {
        toast.error('Σφάλμα φόρτωσης.');
        navigate('/registry');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [structureId, reportId, navigate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1a3aa3]" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <Link
        to={`/registry/${structureId}`}
        className="inline-flex items-center text-[#1a3aa3] hover:text-[#152e82] text-sm mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        Επιστροφή στη δομή
      </Link>

      <div className="mb-6">
        <h1
          className="text-3xl font-bold text-[#2a2520]"
          style={{ fontFamily: "'Literata', serif" }}
        >
          {reportId ? 'Επεξεργασία Αναφοράς' : 'Νέα Αναφορά Κοιν. Συμβούλου'}
        </h1>
        {structure && (
          <p className="text-[#6b6560] mt-1">
            Δομή: {structure.name}
          </p>
        )}
      </div>

      <AdvisorReportForm
        structureId={structureId}
        structureName={structure?.name}
        report={report}
        onSuccess={() => navigate(`/registry/${structureId}`)}
      />
    </div>
  );
}
