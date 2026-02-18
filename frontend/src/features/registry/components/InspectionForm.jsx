import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select.jsx';
import { Input } from '@/components/ui/input.jsx';
import {
  Calendar, Building2, Users, FileText, Send, Save, Loader2, Upload, X, ClipboardCheck
} from 'lucide-react';
import { toast } from 'sonner';
import RichTextEditor from '@/components/RichTextEditor';
import { inspectionsApi } from '../lib/registryApi';
import {
  INSPECTION_TYPES, INSPECTION_CONCLUSIONS, INSPECTION_STATUS, INSPECTION_CRITERIA
} from '../lib/constants';
import InspectionChecklist from './InspectionChecklist';

export default function InspectionForm({ inspection, existingReport, onSuccess }) {
  const [findings, setFindings] = useState(existingReport?.findings || '');
  const [recommendations, setRecommendations] = useState(existingReport?.recommendations || '');
  const [conclusion, setConclusion] = useState(existingReport?.conclusion || inspection?.conclusion || '');
  const [protocolNumber, setProtocolNumber] = useState(existingReport?.protocol_number || '');
  const [checklistData, setChecklistData] = useState(existingReport?.checklist_data || null);
  const [file, setFile] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const structureTypeCode = inspection?.structure?.type?.code;

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
    if (!findings.trim()) {
      toast.error('Τα ευρήματα είναι υποχρεωτικά.');
      return;
    }
    if (submitStatus === 'submitted' && !conclusion) {
      toast.error('Επιλέξτε συμπέρασμα για υποβολή.');
      return;
    }

    setIsSaving(true);
    try {
      const formData = new FormData();
      formData.append('findings', findings);
      formData.append('recommendations', recommendations);
      formData.append('protocol_number', protocolNumber);
      formData.append('status', submitStatus);
      if (conclusion) formData.append('conclusion', conclusion);
      if (checklistData) formData.append('checklist_data', JSON.stringify(checklistData));
      if (file) formData.append('file', file);

      await inspectionsApi.submitReport(inspection.id, formData);
      toast.success(
        submitStatus === 'submitted'
          ? 'Η έκθεση υποβλήθηκε.'
          : 'Η έκθεση αποθηκεύτηκε.'
      );
      onSuccess?.();
    } catch (err) {
      const msg = err.response?.data?.error || 'Σφάλμα αποθήκευσης.';
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const statusInfo = INSPECTION_STATUS[inspection.status] || { label: inspection.status, color: 'gray' };

  return (
    <div className="space-y-6">
      {/* Inspection Info Header (read-only) */}
      <Card className="border-[#e8e2d8] bg-[#f5f2ec]">
        <CardContent className="pt-6">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex items-start gap-2">
              <Building2 className="w-4 h-4 text-[#8a8580] mt-0.5" />
              <div>
                <p className="text-xs text-[#8a8580] uppercase tracking-wide">Δομή</p>
                <p className="font-medium text-[#2a2520]">{inspection.structure?.name || '—'}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Users className="w-4 h-4 text-[#8a8580] mt-0.5" />
              <div>
                <p className="text-xs text-[#8a8580] uppercase tracking-wide">Επιτροπή</p>
                <p className="font-medium text-[#2a2520]">
                  {inspection.committee?.decision_number || `#${inspection.committee_id}`}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Calendar className="w-4 h-4 text-[#8a8580] mt-0.5" />
              <div>
                <p className="text-xs text-[#8a8580] uppercase tracking-wide">Ημερομηνία</p>
                <p className="font-medium text-[#2a2520]">
                  {inspection.scheduled_date
                    ? new Date(inspection.scheduled_date).toLocaleDateString('el-GR')
                    : '—'}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <FileText className="w-4 h-4 text-[#8a8580] mt-0.5" />
              <div>
                <p className="text-xs text-[#8a8580] uppercase tracking-wide">Τύπος / Κατάσταση</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[#2a2520]">{INSPECTION_TYPES[inspection.type] || inspection.type}</span>
                  <Badge variant="outline" className={
                    statusInfo.color === 'blue' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                    statusInfo.color === 'green' ? 'bg-green-100 text-green-800 border-green-200' :
                    'bg-gray-100 text-gray-800 border-gray-200'
                  }>
                    {statusInfo.label}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ministerial Decision Template Info */}
      {structureTypeCode && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <ClipboardCheck className="w-5 h-5 text-[#1a3aa3]" />
              <div>
                <p className="text-sm font-semibold text-[#1a3aa3]">
                  Πρότυπο Υπουργικής Απόφασης
                </p>
                <p className="text-xs text-[#6b6560]">
                  Έκθεση Αξιολόγησης — {INSPECTION_CRITERIA[structureTypeCode]?.label || INSPECTION_CRITERIA.DEFAULT.label}
                  {INSPECTION_CRITERIA[structureTypeCode]?.legal_ref && (
                    <span className="ml-2 text-[#8a8580]">({INSPECTION_CRITERIA[structureTypeCode].legal_ref})</span>
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Protocol Number */}
      <Card className="border-[#e8e2d8]">
        <CardHeader>
          <CardTitle className="text-lg text-[#2a2520]">Αρ. Πρωτοκόλλου</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            value={protocolNumber}
            onChange={(e) => setProtocolNumber(e.target.value)}
            placeholder="Αριθμός πρωτοκόλλου (προαιρετικό)"
            className="min-h-[44px] border-[#e8e2d8] max-w-md"
          />
        </CardContent>
      </Card>

      {/* Structured Checklist */}
      {structureTypeCode && (
        <InspectionChecklist
          structureTypeCode={structureTypeCode}
          value={checklistData}
          onChange={setChecklistData}
        />
      )}

      {/* Findings */}
      <Card className="border-[#e8e2d8]">
        <CardHeader>
          <CardTitle className="text-lg text-[#2a2520]">Ευρήματα *</CardTitle>
        </CardHeader>
        <CardContent>
          <RichTextEditor
            value={findings}
            onChange={setFindings}
            placeholder="Περιγράψτε τα ευρήματα του ελέγχου..."
            minHeight="200px"
          />
        </CardContent>
      </Card>

      {/* Conclusion */}
      <Card className="border-[#e8e2d8]">
        <CardHeader>
          <CardTitle className="text-lg text-[#2a2520]">Συμπέρασμα</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={conclusion} onValueChange={setConclusion}>
            <SelectTrigger className="min-h-[44px] border-[#e8e2d8] max-w-md">
              <SelectValue placeholder="Επιλέξτε συμπέρασμα..." />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(INSPECTION_CONCLUSIONS).map(([key, { label }]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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
            placeholder="Προτάσεις και συστάσεις βελτίωσης..."
            minHeight="150px"
          />
        </CardContent>
      </Card>

      {/* File Upload */}
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
          Υποβολή Έκθεσης
        </Button>
      </div>
    </div>
  );
}
