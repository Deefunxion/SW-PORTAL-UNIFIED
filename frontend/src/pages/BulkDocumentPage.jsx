import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select.jsx';
import {
  ArrowLeft, ArrowRight, Upload, FileSpreadsheet,
  CheckCircle, AlertCircle, FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import * as XLSX from 'xlsx';

const STEPS = [
  { id: 'template', label: 'Πρότυπο' },
  { id: 'upload', label: 'Αρχείο Excel' },
  { id: 'mapping', label: 'Αντιστοίχιση' },
  { id: 'confirm', label: 'Επιβεβαίωση' },
];

function BulkDocumentPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [excelRows, setExcelRows] = useState([]);
  const [excelHeaders, setExcelHeaders] = useState([]);
  const [columnMapping, setColumnMapping] = useState({});
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    api.get('/api/templates').then(({ data }) => setTemplates(data));
  }, []);

  const handleFileUpload = useCallback((e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const wb = XLSX.read(evt.target.result, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws);
      if (data.length === 0) {
        toast.error('Το αρχείο δεν περιέχει δεδομένα');
        return;
      }
      setExcelHeaders(Object.keys(data[0]));
      setExcelRows(data);
      // Auto-map columns by matching header names to field keys/labels
      const fields = selectedTemplate?.schema?.fields || [];
      const autoMap = {};
      fields.forEach(f => {
        const match = Object.keys(data[0]).find(
          h => h.toLowerCase() === f.key.toLowerCase()
            || h.toLowerCase() === f.label.toLowerCase()
        );
        if (match) autoMap[f.key] = match;
      });
      setColumnMapping(autoMap);
      setStep(2);
    };
    reader.readAsArrayBuffer(file);
  }, [selectedTemplate]);

  const handleCreate = async () => {
    const fields = selectedTemplate?.schema?.fields || [];
    const records = excelRows.map(row => {
      const data = {};
      fields.forEach(f => {
        const col = columnMapping[f.key];
        if (col && row[col] !== undefined) {
          data[f.key] = String(row[col]);
        }
      });
      return { data };
    });

    setIsCreating(true);
    try {
      const { data } = await api.post('/api/decisions/bulk', {
        template_id: selectedTemplate.id,
        records,
      });
      toast.success(`Δημιουργήθηκαν ${data.count} έγγραφα`);
      navigate('/documents');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Σφάλμα δημιουργίας');
    } finally {
      setIsCreating(false);
    }
  };

  const fields = selectedTemplate?.schema?.fields || [];

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" onClick={() => navigate('/documents')} className="min-h-[44px]">
          <ArrowLeft className="w-5 h-5 mr-2" />
          Πίσω
        </Button>
        <h1 className="text-2xl font-bold text-[#2a2520]" style={{ fontFamily: "'Literata', serif" }}>
          Μαζική Δημιουργία Εγγράφων
        </h1>
      </div>

      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
              i === step ? 'bg-[#1a3aa3] text-white'
                : i < step ? 'bg-green-100 text-green-700'
                : 'bg-[#f8f5f0] text-[#8a8580]'
            }`}>
              {i < step ? <CheckCircle className="w-4 h-4" /> : null}
              {s.label}
            </div>
            {i < STEPS.length - 1 && (
              <div className={`w-8 h-0.5 mx-1 ${i < step ? 'bg-green-300' : 'bg-[#e8e2d8]'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step 0: Template */}
      {step === 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map(t => (
            <Card
              key={t.id}
              className="border-[#e8e2d8] hover:border-[#1a3aa3] hover:shadow-md transition-all cursor-pointer"
              onClick={() => { setSelectedTemplate(t); setStep(1); }}
            >
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-[#2a2520]">{t.title}</CardTitle>
                <CardDescription className="text-sm">{t.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-xs text-[#8a8580]">
                  <FileText className="w-3 h-3" />
                  <span>{(t.schema?.fields || []).length} πεδία</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Step 1: Upload */}
      {step === 1 && (
        <Card className="border-[#e8e2d8]">
          <CardHeader>
            <CardTitle className="text-lg text-[#2a2520]">Φόρτωση Αρχείου Excel</CardTitle>
            <CardDescription>
              Ανεβάστε .xlsx με μία γραμμή ανά έγγραφο. Οι στήλες θα αντιστοιχιστούν στα πεδία του προτύπου.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Required fields */}
            <div>
              <h3 className="text-sm font-medium text-[#2a2520] mb-2">Πεδία προτύπου «{selectedTemplate?.title}»:</h3>
              <div className="flex flex-wrap gap-2">
                {fields.map(f => (
                  <Badge key={f.key} variant="outline" className="border-[#e8e2d8]">
                    {f.label} {f.required && <span className="text-red-500 ml-0.5">*</span>}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Upload zone */}
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-[#e8e2d8] rounded-lg p-12 cursor-pointer hover:border-[#1a3aa3] transition-colors">
              <FileSpreadsheet className="w-12 h-12 text-[#8a8580] mb-4" />
              <span className="text-[#2a2520] font-medium">Σύρετε ή κάντε κλικ για αρχείο .xlsx</span>
              <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileUpload} />
            </label>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(0)} className="min-h-[44px] border-[#e8e2d8]">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Πίσω
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Mapping */}
      {step === 2 && (
        <Card className="border-[#e8e2d8]">
          <CardHeader>
            <CardTitle className="text-lg text-[#2a2520]">Αντιστοίχιση Στηλών</CardTitle>
            <CardDescription>
              Βρέθηκαν {excelRows.length} γραμμές. Αντιστοιχίστε τις στήλες του Excel στα πεδία του προτύπου.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {fields.map(f => (
              <div key={f.key} className="flex items-center gap-4">
                <div className="w-48 text-sm font-medium text-[#2a2520]">
                  {f.label} {f.required && <span className="text-red-500">*</span>}
                </div>
                <Select
                  value={columnMapping[f.key] || '_unmapped'}
                  onValueChange={(v) => setColumnMapping(prev => ({
                    ...prev, [f.key]: v === '_unmapped' ? undefined : v,
                  }))}
                >
                  <SelectTrigger className="flex-1 min-h-[44px] border-[#e8e2d8]">
                    <SelectValue placeholder="Επιλέξτε στήλη..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_unmapped">— Χωρίς αντιστοίχιση —</SelectItem>
                    {excelHeaders.map(h => (
                      <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {columnMapping[f.key] ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <AlertCircle className={`w-5 h-5 ${f.required ? 'text-red-500' : 'text-[#c4bfb8]'}`} />
                )}
              </div>
            ))}

            <div className="flex justify-between pt-4 border-t border-[#e8e2d8]">
              <Button variant="outline" onClick={() => setStep(1)} className="min-h-[44px] border-[#e8e2d8]">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Πίσω
              </Button>
              <Button
                onClick={() => setStep(3)}
                className="bg-[#1a3aa3] hover:bg-[#152e82] text-white min-h-[44px]"
              >
                Συνέχεια
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Confirm */}
      {step === 3 && (
        <Card className="border-[#e8e2d8]">
          <CardHeader>
            <CardTitle className="text-lg text-[#2a2520]">Επιβεβαίωση Δημιουργίας</CardTitle>
            <CardDescription>
              Θα δημιουργηθούν <strong>{excelRows.length}</strong> έγγραφα τύπου «{selectedTemplate?.title}».
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Preview first 5 rows */}
            <div className="overflow-x-auto mb-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#f8f5f0] border-b border-[#e8e2d8]">
                    <th className="px-3 py-2 text-left text-[#2a2520]">#</th>
                    {fields.filter(f => columnMapping[f.key]).map(f => (
                      <th key={f.key} className="px-3 py-2 text-left text-[#2a2520]">{f.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {excelRows.slice(0, 5).map((row, idx) => (
                    <tr key={idx} className="border-b border-[#e8e2d8]">
                      <td className="px-3 py-2 text-[#6b6560]">{idx + 1}</td>
                      {fields.filter(f => columnMapping[f.key]).map(f => (
                        <td key={f.key} className="px-3 py-2">{row[columnMapping[f.key]] || '—'}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {excelRows.length > 5 && (
              <p className="text-sm text-[#8a8580] mb-4">...και {excelRows.length - 5} ακόμα εγγραφές</p>
            )}

            <div className="flex justify-between pt-4 border-t border-[#e8e2d8]">
              <Button variant="outline" onClick={() => setStep(2)} className="min-h-[44px] border-[#e8e2d8]">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Πίσω
              </Button>
              <Button
                onClick={handleCreate}
                disabled={isCreating}
                className="bg-[#1a3aa3] hover:bg-[#152e82] text-white min-h-[44px] px-6"
              >
                <Upload className="w-4 h-4 mr-2" />
                {isCreating ? 'Δημιουργία...' : `Δημιουργία ${excelRows.length} Εγγράφων`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default BulkDocumentPage;
