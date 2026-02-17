import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button.jsx';
import { ArrowLeft, Printer } from 'lucide-react';
import api from '@/lib/api';
import DocumentPreview from '@/components/DocumentPreview';

function DocumentPreviewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [decision, setDecision] = useState(null);
  const [previewHtml, setPreviewHtml] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [decRes, prevRes] = await Promise.all([
          api.get(`/api/decisions/${id}`),
          api.get(`/api/decisions/${id}/preview`),
        ]);
        setDecision(decRes.data);
        setPreviewHtml(prevRes.data.html);
      } catch (error) {
        console.error('Error loading preview:', error);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1a3aa3]" />
      </div>
    );
  }

  if (!decision) {
    return <div className="container mx-auto px-4 py-8 text-center text-[#6b6560]">Δεν βρέθηκε το έγγραφο.</div>;
  }

  return (
    <div className="bg-[#f0ece6] min-h-screen py-8">
      <div className="container mx-auto px-4 max-w-5xl">
        <div className="flex items-center justify-between mb-6 no-print">
          <Button variant="outline" onClick={() => navigate(-1)} className="min-h-[44px] bg-white border-[#e8e2d8]">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Πίσω
          </Button>
          <Button onClick={() => window.print()} className="bg-[#1a3aa3] hover:bg-[#152e82] text-white min-h-[44px]">
            <Printer className="w-4 h-4 mr-2" />
            Εκτύπωση
          </Button>
        </div>
        <DocumentPreview
          title={decision.template_title || ''}
          renderedBody={previewHtml}
          protocolNumber={decision.protocol_number}
          internalNumber={decision.internal_number}
          legalReferences={decision.legal_references || []}
          recipients={decision.recipients_template || []}
          status={decision.status}
        />
      </div>
    </div>
  );
}

export default DocumentPreviewPage;
