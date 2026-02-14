import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card.jsx';
import { inspectionsApi } from '../lib/registryApi';
import InspectionForm from '../components/InspectionForm';
import InspectionChecklist from '../components/InspectionChecklist';

export default function InspectionReportPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [inspection, setInspection] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    inspectionsApi.get(id)
      .then(({ data }) => setInspection(data))
      .catch(() => {
        toast.error('Ο έλεγχος δεν βρέθηκε.');
        navigate('/registry');
      })
      .finally(() => setIsLoading(false));
  }, [id, navigate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1a3aa3]" />
      </div>
    );
  }

  if (!inspection) return null;

  // If report already exists, show it read-only
  if (inspection.report) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Link
          to={`/registry/${inspection.structure_id}`}
          className="inline-flex items-center text-[#1a3aa3] hover:text-[#152e82] text-sm mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Επιστροφή στη δομή
        </Link>

        <h1 className="text-3xl font-bold text-[#2a2520] mb-6" style={{ fontFamily: "'Literata', serif" }}>
          Έκθεση Ελέγχου
        </h1>

        <Card className="border-[#e8e2d8] bg-[#f5f2ec]">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5" />
              <div>
                <p className="font-medium text-[#2a2520]">Η έκθεση έχει ήδη υποβληθεί</p>
                <p className="text-sm text-[#6b6560] mt-1">
                  Αρ. Πρωτοκόλλου: {inspection.report.protocol_number || '—'} |
                  Κατάσταση: {inspection.report.status} |
                  Ημερομηνία: {inspection.report.drafted_date
                    ? new Date(inspection.report.drafted_date).toLocaleDateString('el-GR')
                    : '—'}
                </p>
                {inspection.report.findings && (
                  <div className="mt-4 p-4 bg-white rounded-lg border border-[#e8e2d8]">
                    <h3 className="text-sm font-semibold text-[#2a2520] mb-2">Ευρήματα</h3>
                    <div
                      className="prose prose-sm text-[#6b6560]"
                      dangerouslySetInnerHTML={{ __html: inspection.report.findings }}
                    />
                  </div>
                )}
                {inspection.report.recommendations && (
                  <div className="mt-3 p-4 bg-white rounded-lg border border-[#e8e2d8]">
                    <h3 className="text-sm font-semibold text-[#2a2520] mb-2">Συστάσεις</h3>
                    <div
                      className="prose prose-sm text-[#6b6560]"
                      dangerouslySetInnerHTML={{ __html: inspection.report.recommendations }}
                    />
                  </div>
                )}
                {inspection.report.checklist_data && inspection.structure?.type?.code && (
                  <div className="mt-4">
                    <InspectionChecklist
                      structureTypeCode={inspection.structure.type.code}
                      value={inspection.report.checklist_data}
                      readOnly
                    />
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Link
        to={`/registry/${inspection.structure_id}`}
        className="inline-flex items-center text-[#1a3aa3] hover:text-[#152e82] text-sm mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        Επιστροφή στη δομή
      </Link>

      <h1 className="text-3xl font-bold text-[#2a2520] mb-6" style={{ fontFamily: "'Literata', serif" }}>
        Νέα Έκθεση Ελέγχου
      </h1>

      <InspectionForm
        inspection={inspection}
        onSuccess={() => navigate(`/registry/${inspection.structure_id}`)}
      />
    </div>
  );
}
