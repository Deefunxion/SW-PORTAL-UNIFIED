import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select.jsx';
import {
  FileText, ArrowLeft, ArrowRight, Save, Download,
  Send, Eye, CheckCircle, Building2,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import DocumentPreview from '@/components/DocumentPreview';

const STEPS = [
  { id: 'template', label: 'Πρότυπο' },
  { id: 'structure', label: 'Δομή' },
  { id: 'fields', label: 'Στοιχεία' },
  { id: 'preview', label: 'Προεπισκόπηση' },
];

function DocumentComposePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = !!id;

  const [step, setStep] = useState(isEditing ? 2 : 0);
  const [templates, setTemplates] = useState([]);
  const [structures, setStructures] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [selectedStructureId, setSelectedStructureId] = useState('');
  const [formData, setFormData] = useState({});
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');
  const [decisionId, setDecisionId] = useState(id ? parseInt(id) : null);
  const [decisionStatus, setDecisionStatus] = useState('draft');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchTemplates();
    fetchStructures();
    if (isEditing) {
      fetchDecision(id);
    }
  }, []);

  const fetchTemplates = async () => {
    try {
      const { data } = await api.get('/api/templates');
      setTemplates(data);
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

  const fetchStructures = async () => {
    try {
      const { data } = await api.get('/api/structures');
      setStructures(Array.isArray(data.structures) ? data.structures : Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching structures:', error);
    }
  };

  const fetchDecision = async (decId) => {
    setIsLoading(true);
    try {
      const { data } = await api.get(`/api/decisions/${decId}`);
      setFormData(data.data || {});
      setDecisionStatus(data.status);
      setSelectedStructureId(data.structure_id ? String(data.structure_id) : '');
      setDecisionId(data.id);
      if (data.template_schema) {
        setSelectedTemplate({
          id: data.template_id,
          title: data.template_title,
          type: data.template_type,
          schema: data.template_schema,
          legal_references: data.legal_references,
          recipients_template: data.recipients_template,
        });
      }
      // Load preview
      const preview = await api.get(`/api/decisions/${decId}/preview`);
      setPreviewHtml(preview.data.html);
      setPreviewTitle(preview.data.title);
    } catch (error) {
      console.error('Error fetching decision:', error);
      toast.error('Σφάλμα φόρτωσης εγγράφου');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectTemplate = (template) => {
    setSelectedTemplate(template);
    // Initialize form data from schema defaults
    const initial = {};
    (template.schema?.fields || []).forEach(f => {
      initial[f.key] = '';
    });
    setFormData(initial);
    setStep(1);
  };

  const handleFieldChange = (key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveDraft = async () => {
    if (!selectedTemplate) return;
    setIsSaving(true);
    try {
      if (decisionId) {
        // Update existing
        const { data } = await api.put(`/api/decisions/${decisionId}`, {
          data: formData,
        });
        setDecisionStatus(data.status);
        toast.success('Αποθηκεύτηκε');
      } else {
        // Create new
        const { data } = await api.post('/api/decisions', {
          template_id: selectedTemplate.id,
          structure_id: selectedStructureId ? parseInt(selectedStructureId) : null,
          data: formData,
        });
        setDecisionId(data.id);
        setDecisionStatus(data.status);
        toast.success('Δημιουργήθηκε ως πρόχειρο');
        // Update URL without reload
        window.history.replaceState(null, '', `/documents/${data.id}/edit`);
      }
    } catch (error) {
      console.error('Error saving:', error);
      toast.error('Σφάλμα αποθήκευσης');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePreview = async () => {
    // Save first if needed
    await handleSaveDraft();
    if (decisionId) {
      try {
        const { data } = await api.get(`/api/decisions/${decisionId}/preview`);
        setPreviewHtml(data.html);
        setPreviewTitle(data.title);
        setStep(3);
      } catch (error) {
        console.error('Error loading preview:', error);
      }
    }
  };

  const handleDownloadPdf = async () => {
    if (!decisionId) return;
    try {
      const response = await api.get(`/api/decisions/${decisionId}/pdf`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `decision_${decisionId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('PDF δημιουργήθηκε');
    } catch (error) {
      toast.error('Σφάλμα δημιουργίας PDF');
    }
  };

  const handleDownloadDocx = async () => {
    if (!decisionId) return;
    try {
      const response = await api.get(`/api/decisions/${decisionId}/docx`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `decision_${decisionId}.docx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('DOCX δημιουργήθηκε');
    } catch (error) {
      toast.error('Σφάλμα δημιουργίας DOCX');
    }
  };

  const handleSendToIrida = async () => {
    if (!decisionId) return;
    try {
      const { data } = await api.post(`/api/decisions/${decisionId}/send-to-irida`);
      setDecisionStatus(data.status);
      toast.success('Εστάλη στο ΙΡΙΔΑ');
    } catch (error) {
      const msg = error.response?.data?.error || 'Σφάλμα αποστολής';
      toast.error(msg);
    }
  };

  const fields = selectedTemplate?.schema?.fields || [];
  const isReadonly = decisionStatus !== 'draft';

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1a3aa3]" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" onClick={() => navigate('/documents')} className="min-h-[44px]">
          <ArrowLeft className="w-5 h-5 mr-2" />
          Πίσω
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-[#2a2520]" style={{ fontFamily: "'Literata', serif" }}>
            {isEditing ? (selectedTemplate?.title || 'Επεξεργασία Εγγράφου') : 'Σύνταξη Νέου Εγγράφου'}
          </h1>
          {decisionId && (
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className={
                decisionStatus === 'draft' ? 'bg-gray-100 text-gray-700 border-gray-200' :
                decisionStatus === 'sent_to_irida' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                'bg-green-100 text-green-700 border-green-200'
              }>
                {decisionStatus === 'draft' ? 'Πρόχειρο' :
                 decisionStatus === 'sent_to_irida' ? 'Σε ΙΡΙΔΑ' : 'Πρωτοκολλήθηκε'}
              </Badge>
            </div>
          )}
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center">
            <button
              onClick={() => {
                if (i <= step || (isEditing && i >= 2)) setStep(i);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                i === step
                  ? 'bg-[#1a3aa3] text-white'
                  : i < step
                  ? 'bg-green-100 text-green-700'
                  : 'bg-[#f8f5f0] text-[#8a8580]'
              }`}
            >
              {i < step ? <CheckCircle className="w-4 h-4" /> : null}
              {s.label}
            </button>
            {i < STEPS.length - 1 && (
              <div className={`w-8 h-0.5 mx-1 ${i < step ? 'bg-green-300' : 'bg-[#e8e2d8]'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step 0: Template Selection */}
      {step === 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.length === 0 ? (
            <Card className="col-span-full border-[#e8e2d8]">
              <CardContent className="py-12 text-center">
                <FileText className="w-12 h-12 text-[#c4bfb8] mx-auto mb-4" />
                <p className="text-[#6b6560]">Δεν βρέθηκαν πρότυπα. Επικοινωνήστε με τον διαχειριστή.</p>
              </CardContent>
            </Card>
          ) : templates.map(t => (
            <Card
              key={t.id}
              className="border-[#e8e2d8] hover:border-[#1a3aa3] hover:shadow-md transition-all cursor-pointer"
              onClick={() => handleSelectTemplate(t)}
            >
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-[#2a2520]">{t.title}</CardTitle>
                <CardDescription className="text-sm">{t.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-xs text-[#8a8580]">
                  <FileText className="w-3 h-3" />
                  <span>{(t.schema?.fields || []).length} πεδία</span>
                  <span className="ml-2">v{t.version || 1}</span>
                  {t.structure_type_code && (
                    <>
                      <Building2 className="w-3 h-3 ml-2" />
                      <span>{t.structure_type_code}</span>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Step 1: Structure Selection */}
      {step === 1 && (
        <Card className="border-[#e8e2d8]">
          <CardHeader>
            <CardTitle className="text-lg text-[#2a2520]">Επιλογή Δομής (προαιρετικό)</CardTitle>
            <CardDescription>
              Επιλέξτε δομή για αυτόματη συμπλήρωση στοιχείων. Μπορείτε να παραλείψετε αυτό το βήμα.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select value={selectedStructureId} onValueChange={setSelectedStructureId}>
              <SelectTrigger className="min-h-[48px] border-[#e8e2d8]">
                <SelectValue placeholder="Επιλέξτε δομή..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">Χωρίς δομή</SelectItem>
                {structures.map(s => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.name} ({s.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(0)} className="min-h-[44px] border-[#e8e2d8]">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Πίσω
              </Button>
              <Button
                onClick={() => {
                  if (selectedStructureId === '_none') setSelectedStructureId('');
                  setStep(2);
                }}
                className="bg-[#1a3aa3] hover:bg-[#152e82] text-white min-h-[44px]"
              >
                Συνέχεια
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Form Fields */}
      {step === 2 && (
        <Card className="border-[#e8e2d8]">
          <CardHeader>
            <CardTitle className="text-lg text-[#2a2520]">
              Συμπλήρωση Στοιχείων — {selectedTemplate?.title}
            </CardTitle>
            <CardDescription>
              Συμπληρώστε τα μεταβλητά πεδία του εγγράφου.
              {isReadonly && ' (Μόνο ανάγνωση — το έγγραφο δεν είναι πρόχειρο)'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {fields.map(field => (
                <div key={field.key} className={field.type === 'text' && field.key.includes('περιγραφή') ? 'md:col-span-2' : ''}>
                  <label className="block text-sm font-medium text-[#2a2520] mb-1.5">
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  {field.type === 'select' ? (
                    <Select
                      value={formData[field.key] || ''}
                      onValueChange={(v) => handleFieldChange(field.key, v)}
                      disabled={isReadonly}
                    >
                      <SelectTrigger className="min-h-[44px] border-[#e8e2d8]">
                        <SelectValue placeholder={`Επιλέξτε ${field.label}...`} />
                      </SelectTrigger>
                      <SelectContent>
                        {(field.options || []).map(opt => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : field.type === 'date' ? (
                    <Input
                      type="date"
                      value={formData[field.key] || ''}
                      onChange={(e) => handleFieldChange(field.key, e.target.value)}
                      className="min-h-[44px] border-[#e8e2d8]"
                      disabled={isReadonly}
                    />
                  ) : field.type === 'number' ? (
                    <Input
                      type="number"
                      value={formData[field.key] || ''}
                      onChange={(e) => handleFieldChange(field.key, e.target.value)}
                      className="min-h-[44px] border-[#e8e2d8]"
                      disabled={isReadonly}
                    />
                  ) : field.key.includes('περιγραφή') ? (
                    <Textarea
                      value={formData[field.key] || ''}
                      onChange={(e) => handleFieldChange(field.key, e.target.value)}
                      className="min-h-[80px] border-[#e8e2d8]"
                      disabled={isReadonly}
                    />
                  ) : (
                    <Input
                      type="text"
                      value={formData[field.key] || ''}
                      onChange={(e) => handleFieldChange(field.key, e.target.value)}
                      className="min-h-[44px] border-[#e8e2d8]"
                      disabled={isReadonly}
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-between pt-6 border-t border-[#e8e2d8] mt-6">
              {!isEditing && (
                <Button variant="outline" onClick={() => setStep(1)} className="min-h-[44px] border-[#e8e2d8]">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Πίσω
                </Button>
              )}
              <div className="flex gap-3 ml-auto">
                {!isReadonly && (
                  <Button
                    variant="outline"
                    onClick={handleSaveDraft}
                    disabled={isSaving}
                    className="min-h-[44px] border-[#e8e2d8]"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {isSaving ? 'Αποθήκευση...' : 'Αποθήκευση'}
                  </Button>
                )}
                <Button
                  onClick={handlePreview}
                  className="bg-[#1a3aa3] hover:bg-[#152e82] text-white min-h-[44px]"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Προεπισκόπηση
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Preview */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="overflow-auto bg-[#f0ece6] p-8 rounded-lg">
            <DocumentPreview
              title={previewTitle}
              renderedBody={previewHtml}
              protocolNumber={null}
              date={null}
              legalReferences={selectedTemplate?.legal_references || []}
              recipients={selectedTemplate?.recipients_template || []}
              status={decisionStatus}
            />
          </div>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(2)} className="min-h-[44px] border-[#e8e2d8]">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Πίσω στα στοιχεία
            </Button>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleDownloadDocx}
                className="min-h-[44px] border-[#e8e2d8]"
              >
                <Download className="w-4 h-4 mr-2" />
                Λήψη DOCX
              </Button>
              <Button
                variant="outline"
                onClick={handleDownloadPdf}
                className="min-h-[44px] border-[#e8e2d8]"
              >
                <Download className="w-4 h-4 mr-2" />
                Λήψη PDF
              </Button>
              {decisionStatus === 'draft' && (
                <Button
                  onClick={handleSendToIrida}
                  className="bg-[#0891b2] hover:bg-[#0e7490] text-white min-h-[44px]"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Αποστολή στο ΙΡΙΔΑ
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DocumentComposePage;
