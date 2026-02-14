import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select.jsx';
import {
  Save, Send, Loader2, Upload, X, FileText, Bot
} from 'lucide-react';
import { toast } from 'sonner';
import RichTextEditor from '@/components/RichTextEditor';
import AiSidebar from './AiSidebar';
import { oversightApi } from '../lib/registryApi';
import { ADVISOR_REPORT_TYPES } from '../lib/constants';

export default function AdvisorReportForm({ structureId, structureName, report, onSuccess }) {
  const isEditing = !!report;
  const [reportType, setReportType] = useState(report?.type || 'regular');
  const [draftedDate, setDraftedDate] = useState(
    report?.drafted_date || new Date().toISOString().slice(0, 10)
  );
  const [assessment, setAssessment] = useState(report?.assessment || '');
  const [recommendations, setRecommendations] = useState(report?.recommendations || '');
  const [file, setFile] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  const aiContext = `Δομή: ${structureName || ''}. Τύπος αναφοράς: ${ADVISOR_REPORT_TYPES[reportType] || reportType}. Ρόλος: Κοινωνικός Σύμβουλος. Η αναφορά αφορά αξιολόγηση δομής κοινωνικής φροντίδας.`;

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (selected) {
      const allowedTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ];
      if (!allowedTypes.includes(selected.type)) {
        toast.error('Επιτρέπονται μόνο αρχεία PDF και DOCX.');
        return;
      }
      if (selected.size > 16 * 1024 * 1024) {
        toast.error('Μέγιστο μέγεθος αρχείου: 16MB');
        return;
      }
      setFile(selected);
    }
  };

  const handleSubmit = async (submitStatus) => {
    if (!assessment.trim()) {
      toast.error('Η αξιολόγηση είναι υποχρεωτική.');
      return;
    }

    setIsSaving(true);
    try {
      if (isEditing) {
        // Update existing report
        const data = {
          type: reportType,
          drafted_date: draftedDate,
          assessment,
          recommendations,
        };
        if (submitStatus === 'submitted') data.status = 'submitted';
        await oversightApi.updateAdvisorReport(report.id, data);
      } else {
        // Create new report
        const formData = new FormData();
        formData.append('type', reportType);
        formData.append('drafted_date', draftedDate);
        formData.append('assessment', assessment);
        formData.append('recommendations', recommendations);
        if (file) formData.append('file', file);
        await oversightApi.submitAdvisorReport(structureId, formData);
      }
      toast.success(
        submitStatus === 'submitted'
          ? 'Η αναφορά υποβλήθηκε.'
          : 'Η αναφορά αποθηκεύτηκε.'
      );
      onSuccess?.();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Σφάλμα αποθήκευσης.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleInsertText = (text) => {
    setRecommendations((prev) => (prev ? prev + '\n\n' + text : text));
    toast.success('Το κείμενο εισήχθη στις συστάσεις.');
  };

  return (
    <div className="flex gap-0">
      {/* Main form */}
      <div className={`flex-1 space-y-6 transition-all ${aiOpen ? 'pr-4' : ''}`}>
        {/* AI toggle button */}
        <div className="flex justify-end">
          <Button
            variant={aiOpen ? 'default' : 'outline'}
            onClick={() => setAiOpen(!aiOpen)}
            className={aiOpen
              ? 'bg-[#1a3aa3] hover:bg-[#152e82] text-white'
              : 'border-[#1a3aa3] text-[#1a3aa3] hover:bg-[#eef1f8]'}
          >
            <Bot className="w-4 h-4 mr-2" />
            Βοηθός AI
          </Button>
        </div>

        {/* Report Type */}
        <Card className="border-[#e8e2d8]">
          <CardHeader>
            <CardTitle className="text-lg text-[#2a2520]">Τύπος Αναφοράς</CardTitle>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-[#2a2520]">Τύπος</label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger className="mt-1 min-h-[44px] border-[#e8e2d8]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ADVISOR_REPORT_TYPES).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-[#2a2520]">Ημερομηνία</label>
              <Input
                type="date"
                value={draftedDate}
                onChange={(e) => setDraftedDate(e.target.value)}
                className="mt-1 min-h-[44px] border-[#e8e2d8]"
              />
            </div>
          </CardContent>
        </Card>

        {/* Assessment */}
        <Card className="border-[#e8e2d8]">
          <CardHeader>
            <CardTitle className="text-lg text-[#2a2520]">Αξιολόγηση *</CardTitle>
          </CardHeader>
          <CardContent>
            <RichTextEditor
              value={assessment}
              onChange={setAssessment}
              placeholder="Περιγράψτε την αξιολόγηση της δομής..."
              minHeight="200px"
            />
          </CardContent>
        </Card>

        {/* Recommendations */}
        <Card className="border-[#e8e2d8]">
          <CardHeader>
            <CardTitle className="text-lg text-[#2a2520]">Συστάσεις / Προτάσεις</CardTitle>
          </CardHeader>
          <CardContent>
            <RichTextEditor
              value={recommendations}
              onChange={setRecommendations}
              placeholder="Προτάσεις βελτίωσης..."
              minHeight="150px"
            />
          </CardContent>
        </Card>

        {/* File Upload (only for new reports) */}
        {!isEditing && (
          <Card className="border-[#e8e2d8]">
            <CardHeader>
              <CardTitle className="text-lg text-[#2a2520]">Επισυναπτόμενο Αρχείο</CardTitle>
            </CardHeader>
            <CardContent>
              {file ? (
                <div className="flex items-center gap-3 p-3 bg-[#f5f2ec] rounded-lg">
                  <FileText className="w-5 h-5 text-[#1a3aa3]" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#2a2520] truncate">{file.name}</p>
                    <p className="text-xs text-[#8a8580]">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setFile(null)}
                    className="text-[#8a8580] hover:text-red-600"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-[#e8e2d8] rounded-lg bg-[#faf8f4] cursor-pointer hover:border-[#1a3aa3] hover:bg-[#eef1f8] transition-colors">
                  <Upload className="w-10 h-10 text-[#8a8580] mb-3" />
                  <p className="text-sm text-[#6b6560]">Κάντε κλικ για επιλογή αρχείου</p>
                  <p className="text-xs text-[#8a8580] mt-1">PDF ή DOCX, μέχρι 16MB</p>
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.docx"
                    onChange={handleFileChange}
                  />
                </label>
              )}
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleSubmit('draft')}
            disabled={isSaving}
            className="min-h-[48px] px-6 border-[#e8e2d8]"
          >
            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Αποθήκευση Πρόχειρου
          </Button>
          <Button
            type="button"
            onClick={() => handleSubmit('submitted')}
            disabled={isSaving}
            className="bg-[#1a3aa3] hover:bg-[#152e82] text-white min-h-[48px] px-8"
          >
            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            Υποβολή Αναφοράς
          </Button>
        </div>
      </div>

      {/* AI Sidebar */}
      {aiOpen && (
        <div className="w-80 shrink-0 h-[calc(100vh-200px)] sticky top-24">
          <AiSidebar
            context={aiContext}
            onInsertText={handleInsertText}
            isOpen={aiOpen}
            onClose={() => setAiOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
