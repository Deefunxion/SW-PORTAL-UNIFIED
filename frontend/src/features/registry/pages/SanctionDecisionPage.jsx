import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Slider } from '@/components/ui/slider.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.jsx';
import {
  Gavel, ArrowLeft, ArrowRight, Calculator, FileText, User, Eye,
  Loader2, CheckCircle, Shield, Droplets, Users, AlertTriangle,
  Building2, Scale, Landmark, Send, Save,
} from 'lucide-react';
import { toast } from 'sonner';
import { sanctionsApi, structuresApi, decisionsApi } from '../lib/registryApi';
import { VIOLATION_CATEGORIES, SANCTION_DECISION_STATUSES } from '../lib/constants';

const STEPS = [
  { key: 'calculate', label: 'Υπολογισμός', icon: Calculator },
  { key: 'justification', label: 'Αιτιολογία', icon: FileText },
  { key: 'obligor', label: 'Υπόχρεος', icon: User },
  { key: 'preview', label: 'Προεπισκόπηση', icon: Eye },
];

const CATEGORY_ICONS = {
  safety: Shield, hygiene: Droplets, admin: FileText,
  staff: Users, general: AlertTriangle,
};

export default function SanctionDecisionPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = !!id;

  // Step navigation
  const [currentStep, setCurrentStep] = useState(0);

  // Calculator state (step 1)
  const [structures, setStructures] = useState([]);
  const [rules, setRules] = useState([]);
  const [selectedStructure, setSelectedStructure] = useState('');
  const [selectedRule, setSelectedRule] = useState('');
  const [customAmount, setCustomAmount] = useState(null);
  const [calculation, setCalculation] = useState(null);
  const [calculating, setCalculating] = useState(false);

  // Justification (step 2)
  const [justification, setJustification] = useState('');
  const [inspectionFinding, setInspectionFinding] = useState('');

  // Obligor details (step 3)
  const [obligor, setObligor] = useState({
    name: '', father_name: '', afm: '', doy: '', address: '',
  });

  // Submission
  const [saving, setSaving] = useState(false);
  const [existingDecision, setExistingDecision] = useState(null);

  // Load structures
  useEffect(() => {
    structuresApi.list({ per_page: 100 }).then(r => {
      setStructures(r.data.structures || r.data);
    }).catch(() => {});
  }, []);

  // Load existing decision if editing
  useEffect(() => {
    if (id) {
      decisionsApi.get(id).then(r => {
        const d = r.data;
        setExistingDecision(d);
        setSelectedStructure(String(d.structure_id));
        setSelectedRule(d.violation_code || '');
        setJustification(d.justification || '');
        setInspectionFinding(d.inspection_finding || '');
        setObligor({
          name: d.obligor_name || '',
          father_name: d.obligor_father_name || '',
          afm: d.obligor_afm || '',
          doy: d.obligor_doy || '',
          address: d.obligor_address || '',
        });
        if (d.final_amount) {
          setCalculation({
            final_amount: d.final_amount,
            calculated_amount: d.calculated_amount,
            violation_code: d.violation_code,
            amount_state: d.amount_state,
            amount_region: d.amount_region,
          });
        }
      }).catch(() => toast.error('Σφάλμα φόρτωσης απόφασης'));
    }
  }, [id]);

  // Selected structure object
  const selectedStructureObj = useMemo(
    () => structures.find(s => String(s.id) === selectedStructure),
    [structures, selectedStructure]
  );

  // Load rules filtered by structure type
  useEffect(() => {
    const typeId = selectedStructureObj?.type_id || selectedStructureObj?.type?.id;
    sanctionsApi.rules(typeId).then(r => setRules(r.data)).catch(() => {});
  }, [selectedStructureObj]);

  // Group rules by category
  const groupedRules = useMemo(() => {
    const groups = {};
    rules.forEach(r => {
      const cat = r.category || 'general';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(r);
    });
    return groups;
  }, [rules]);

  const currentRule = useMemo(
    () => rules.find(r => r.violation_code === selectedRule),
    [rules, selectedRule]
  );

  const hasRange = currentRule && currentRule.min_fine != null && currentRule.max_fine != null
    && currentRule.min_fine !== currentRule.max_fine;

  // Auto-fill obligor from structure representative
  useEffect(() => {
    if (selectedStructureObj && !obligor.name) {
      setObligor(prev => ({
        ...prev,
        name: selectedStructureObj.representative_name || '',
        afm: selectedStructureObj.representative_afm || '',
      }));
    }
  }, [selectedStructureObj]);

  const handleCalculate = useCallback(async () => {
    if (!selectedRule || !selectedStructure) {
      toast.error('Επιλέξτε παράβαση και δομή');
      return;
    }
    setCalculating(true);
    try {
      const payload = {
        violation_code: selectedRule,
        structure_id: parseInt(selectedStructure),
      };
      if (customAmount != null && hasRange) {
        payload.custom_amount = customAmount;
      }
      const resp = await sanctionsApi.calculate(payload);
      setCalculation(resp.data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Σφάλμα υπολογισμού');
    } finally {
      setCalculating(false);
    }
  }, [selectedRule, selectedStructure, customAmount, hasRange]);

  const handleSaveDraft = useCallback(async () => {
    if (!calculation) return;
    setSaving(true);
    try {
      const payload = {
        structure_id: parseInt(selectedStructure),
        violation_code: calculation.violation_code,
        calculated_amount: calculation.final_amount,
        final_amount: calculation.final_amount,
        justification,
        inspection_finding: inspectionFinding,
        obligor_name: obligor.name,
        obligor_father_name: obligor.father_name,
        obligor_afm: obligor.afm,
        obligor_doy: obligor.doy,
        obligor_address: obligor.address,
      };

      let resp;
      if (isEditing) {
        resp = await decisionsApi.update(id, payload);
        toast.success('Η απόφαση ενημερώθηκε');
      } else {
        resp = await decisionsApi.create(payload);
        toast.success('Η απόφαση δημιουργήθηκε ως προσχέδιο');
      }
      setExistingDecision(resp.data);
      navigate(`/sanctions/decisions/${resp.data.id}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Σφάλμα αποθήκευσης');
    } finally {
      setSaving(false);
    }
  }, [calculation, selectedStructure, justification, inspectionFinding, obligor, isEditing, id, navigate]);

  const handleSubmit = useCallback(async () => {
    if (!existingDecision) {
      await handleSaveDraft();
      return;
    }
    setSaving(true);
    try {
      // Update first, then submit
      await decisionsApi.update(existingDecision.id, {
        justification,
        inspection_finding: inspectionFinding,
        obligor_name: obligor.name,
        obligor_father_name: obligor.father_name,
        obligor_afm: obligor.afm,
        obligor_doy: obligor.doy,
        obligor_address: obligor.address,
      });
      await decisionsApi.submit(existingDecision.id);
      toast.success('Η απόφαση υποβλήθηκε για έγκριση');
      navigate('/sanctions');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Σφάλμα υποβολής');
    } finally {
      setSaving(false);
    }
  }, [existingDecision, justification, inspectionFinding, obligor, navigate, handleSaveDraft]);

  const formatCurrency = (amount) => {
    if (amount == null) return '—';
    return new Intl.NumberFormat('el-GR', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const canProceed = (step) => {
    if (step === 0) return !!calculation;
    if (step === 1) return !!justification.trim();
    if (step === 2) return !!obligor.name.trim() && !!obligor.afm.trim();
    return true;
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <Link to="/sanctions" className="inline-flex items-center gap-1 text-sm text-[#1a3aa3] hover:underline mb-4">
        <ArrowLeft className="w-4 h-4" />
        Κυρώσεις & Πρόστιμα
      </Link>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-[#1a3aa3]/10 flex items-center justify-center">
            <Gavel className="w-5 h-5 text-[#1a3aa3]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#2a2520]" style={{ fontFamily: 'Literata, serif' }}>
              {isEditing ? 'Επεξεργασία Απόφασης' : 'Νέα Απόφαση Κύρωσης'}
            </h1>
            <p className="text-sm text-[#6b6560]">
              {isEditing && existingDecision
                ? `Κατάσταση: ${SANCTION_DECISION_STATUSES[existingDecision.status]?.label || existingDecision.status}`
                : 'Δημιουργία νέας απόφασης επιβολής προστίμου'}
            </p>
          </div>
        </div>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          const isActive = i === currentStep;
          const isDone = i < currentStep;
          return (
            <button
              key={step.key}
              onClick={() => { if (isDone || isActive) setCurrentStep(i); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap
                ${isActive ? 'bg-[#1a3aa3] text-white' : ''}
                ${isDone ? 'bg-[#1a3aa3]/10 text-[#1a3aa3] cursor-pointer' : ''}
                ${!isActive && !isDone ? 'bg-gray-100 text-gray-400' : ''}
              `}
            >
              {isDone ? <CheckCircle className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
              {step.label}
            </button>
          );
        })}
      </div>

      {/* Step 1: Calculator */}
      {currentStep === 0 && (
        <Card className="border-[#e8e2d8]">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calculator className="w-5 h-5 text-[#1a3aa3]" />
              Υπολογισμός Προστίμου
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#2a2520] mb-1">Δομή</label>
              <Select value={selectedStructure} onValueChange={(val) => {
                setSelectedStructure(val);
                setSelectedRule('');
                setCustomAmount(null);
                setCalculation(null);
              }}>
                <SelectTrigger className="border-[#e8e2d8]">
                  <SelectValue placeholder="Επιλέξτε δομή..." />
                </SelectTrigger>
                <SelectContent>
                  {structures.map(s => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      <span className="flex items-center gap-2">
                        <Building2 className="w-3.5 h-3.5 text-[#8a8580]" />
                        {s.name}
                        <span className="text-[#8a8580] text-xs">({s.code})</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#2a2520] mb-1">Τύπος Παράβασης</label>
              <Select value={selectedRule} onValueChange={(val) => {
                setSelectedRule(val);
                setCustomAmount(null);
                setCalculation(null);
              }}>
                <SelectTrigger className="border-[#e8e2d8]">
                  <SelectValue placeholder="Επιλέξτε παράβαση..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(groupedRules).map(([cat, catRules]) => {
                    const CatIcon = CATEGORY_ICONS[cat] || AlertTriangle;
                    return catRules.map((r, i) => (
                      <SelectItem key={r.violation_code} value={r.violation_code}>
                        <span className="flex items-center gap-2">
                          {i === 0 && <CatIcon className="w-3.5 h-3.5 text-[#8a8580]" />}
                          {i > 0 && <span className="w-3.5" />}
                          <span className="truncate">{r.violation_name}</span>
                          <span className="text-[#8a8580] text-xs shrink-0">
                            {r.min_fine != null && r.min_fine !== r.max_fine
                              ? `${formatCurrency(r.min_fine)} — ${formatCurrency(r.max_fine)}`
                              : formatCurrency(r.base_fine)}
                          </span>
                        </span>
                      </SelectItem>
                    ));
                  })}
                </SelectContent>
              </Select>
            </div>

            {hasRange && (
              <div className="bg-blue-50/50 rounded-lg p-3 border border-blue-100 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#2a2520] font-medium">Ποσό Προστίμου</span>
                  <span className="text-xs text-[#8a8580]">
                    {formatCurrency(currentRule.min_fine)} — {formatCurrency(currentRule.max_fine)}
                  </span>
                </div>
                <Slider
                  value={[customAmount ?? currentRule.base_fine]}
                  onValueChange={([val]) => setCustomAmount(val)}
                  min={currentRule.min_fine}
                  max={currentRule.max_fine}
                  step={Math.max(100, Math.round((currentRule.max_fine - currentRule.min_fine) / 100))}
                  className="w-full"
                />
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={customAmount ?? currentRule.base_fine}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val)) setCustomAmount(val);
                    }}
                    min={currentRule.min_fine}
                    max={currentRule.max_fine}
                    className="border-blue-200 text-right font-semibold"
                  />
                  <span className="text-sm text-[#8a8580]">€</span>
                </div>
              </div>
            )}

            <Button
              onClick={handleCalculate}
              disabled={calculating || !selectedRule || !selectedStructure}
              className="w-full bg-[#1a3aa3] hover:bg-[#152e82] text-white"
            >
              {calculating ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Υπολογισμός...</>
              ) : (
                <><Scale className="w-4 h-4 mr-2" /> Υπολογισμός Προστίμου</>
              )}
            </Button>

            {calculation && (
              <div className="bg-[#1a3aa3]/5 rounded-lg p-4 border border-[#1a3aa3]/20 space-y-3">
                <div className="text-center">
                  <p className="text-sm text-[#6b6560]">Τελικό Πρόστιμο</p>
                  <p className="text-3xl font-bold text-[#1a3aa3]" style={{ fontFamily: 'Literata, serif' }}>
                    {formatCurrency(calculation.final_amount)}
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="bg-white rounded p-2 border border-[#e8e2d8]">
                    <p className="text-[#8a8580]">Βασικό</p>
                    <p className="font-semibold">{formatCurrency(calculation.base_fine)}</p>
                  </div>
                  <div className="bg-white rounded p-2 border border-[#e8e2d8]">
                    <p className="text-[#8a8580]">Πολλαπλ.</p>
                    <p className="font-semibold">{calculation.multiplier}x</p>
                  </div>
                  <div className="bg-white rounded p-2 border border-[#e8e2d8]">
                    <p className="text-[#8a8580]">Υποτροπές</p>
                    <p className="font-semibold">{calculation.recidivism_count}</p>
                  </div>
                </div>
                {calculation.revenue_split && (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-blue-50 rounded p-2">
                      <p className="text-[#8a8580]">Κρατικός Π/Υ ({calculation.revenue_split.state_pct}%)</p>
                      <p className="font-semibold">{formatCurrency(calculation.revenue_split.state_amount)}</p>
                      <p className="text-[10px] text-[#8a8580]">ΑΛΕ {calculation.revenue_split.state_ale}</p>
                    </div>
                    <div className="bg-green-50 rounded p-2">
                      <p className="text-[#8a8580]">Περιφέρεια ({calculation.revenue_split.region_pct}%)</p>
                      <p className="font-semibold">{formatCurrency(calculation.revenue_split.region_amount)}</p>
                      <p className="text-[10px] text-[#8a8580]">ΚΑΕ {calculation.revenue_split.region_kae}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2: Justification */}
      {currentStep === 1 && (
        <Card className="border-[#e8e2d8]">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#1a3aa3]" />
              Αιτιολογία Απόφασης
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#2a2520] mb-1">
                Αιτιολογία (υποχρεωτικό)
              </label>
              <Textarea
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                placeholder="Περιγράψτε αναλυτικά τους λόγους επιβολής του προστίμου..."
                rows={6}
                className="border-[#e8e2d8]"
              />
              <p className="text-xs text-[#8a8580] mt-1">
                Η αιτιολογία θα εμφανιστεί στην απόφαση επιβολής προστίμου
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#2a2520] mb-1">
                Ευρήματα ελέγχου (προαιρετικό)
              </label>
              <Textarea
                value={inspectionFinding}
                onChange={(e) => setInspectionFinding(e.target.value)}
                placeholder="Αναφορά σε ευρήματα του ελέγχου που οδήγησαν στην κύρωση..."
                rows={4}
                className="border-[#e8e2d8]"
              />
            </div>
            <div className="bg-amber-50 rounded-lg p-3 border border-amber-200 text-sm text-amber-800">
              <p className="font-medium mb-1">Νομική βάση</p>
              <p>{calculation?.legal_basis || currentRule?.legal_reference || 'Ν.5041/2023 αρ.100'}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Obligor details */}
      {currentStep === 2 && (
        <Card className="border-[#e8e2d8]">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="w-5 h-5 text-[#1a3aa3]" />
              Στοιχεία Υπόχρεου
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#2a2520] mb-1">
                  Ονοματεπώνυμο *
                </label>
                <Input
                  value={obligor.name}
                  onChange={(e) => setObligor({ ...obligor, name: e.target.value })}
                  placeholder="π.χ. Παπαδόπουλος Γεώργιος"
                  className="border-[#e8e2d8]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#2a2520] mb-1">
                  Πατρώνυμο
                </label>
                <Input
                  value={obligor.father_name}
                  onChange={(e) => setObligor({ ...obligor, father_name: e.target.value })}
                  placeholder="π.χ. Νικόλαος"
                  className="border-[#e8e2d8]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#2a2520] mb-1">
                  ΑΦΜ *
                </label>
                <Input
                  value={obligor.afm}
                  onChange={(e) => setObligor({ ...obligor, afm: e.target.value })}
                  placeholder="π.χ. 034538000"
                  maxLength={9}
                  className="border-[#e8e2d8]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#2a2520] mb-1">
                  ΔΟΥ
                </label>
                <Input
                  value={obligor.doy}
                  onChange={(e) => setObligor({ ...obligor, doy: e.target.value })}
                  placeholder="π.χ. Α' Αθηνών"
                  className="border-[#e8e2d8]"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#2a2520] mb-1">
                Διεύθυνση
              </label>
              <Input
                value={obligor.address}
                onChange={(e) => setObligor({ ...obligor, address: e.target.value })}
                placeholder="π.χ. Μάχης Κρήτης 11, Αγ. Ανάργυροι 13562"
                className="border-[#e8e2d8]"
              />
            </div>
            {selectedStructureObj && (
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-100 text-sm">
                <p className="text-[#8a8580] mb-1">Στοιχεία νόμιμου εκπροσώπου δομής:</p>
                <p className="font-medium">{selectedStructureObj.representative_name || '—'}</p>
                <p className="text-xs text-[#8a8580]">
                  ΑΦΜ: {selectedStructureObj.representative_afm || '—'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 4: Preview */}
      {currentStep === 3 && (
        <Card className="border-[#e8e2d8]">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Eye className="w-5 h-5 text-[#1a3aa3]" />
              Προεπισκόπηση Απόφασης
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Structure info */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <p className="text-xs text-[#8a8580] mb-1">Δομή</p>
              <p className="font-semibold text-[#2a2520]">
                {selectedStructureObj?.name || '—'}
              </p>
              <p className="text-xs text-[#8a8580]">
                Κωδικός: {selectedStructureObj?.code || '—'}
              </p>
            </div>

            {/* Violation and amount */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                <p className="text-xs text-[#8a8580] mb-1">Παράβαση</p>
                <p className="font-semibold text-[#2a2520] text-sm">{calculation?.violation_name || selectedRule}</p>
                <p className="text-xs text-[#8a8580] mt-1">{calculation?.violation_code}</p>
              </div>
              <div className="bg-[#1a3aa3]/5 rounded-lg p-4 border border-[#1a3aa3]/20 text-center">
                <p className="text-xs text-[#8a8580] mb-1">Ποσό Προστίμου</p>
                <p className="text-2xl font-bold text-[#1a3aa3]" style={{ fontFamily: 'Literata, serif' }}>
                  {formatCurrency(calculation?.final_amount)}
                </p>
              </div>
            </div>

            {/* Justification */}
            <div className="bg-white rounded-lg p-4 border border-[#e8e2d8]">
              <p className="text-xs text-[#8a8580] mb-1">Αιτιολογία</p>
              <p className="text-sm text-[#2a2520] whitespace-pre-wrap">{justification || '—'}</p>
            </div>

            {/* Obligor */}
            <div className="bg-white rounded-lg p-4 border border-[#e8e2d8]">
              <p className="text-xs text-[#8a8580] mb-2">Στοιχεία Υπόχρεου</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-[#8a8580]">Ονομ/μο:</span> {obligor.name}</div>
                <div><span className="text-[#8a8580]">Πατρώνυμο:</span> {obligor.father_name || '—'}</div>
                <div><span className="text-[#8a8580]">ΑΦΜ:</span> {obligor.afm}</div>
                <div><span className="text-[#8a8580]">ΔΟΥ:</span> {obligor.doy || '—'}</div>
                <div className="col-span-2"><span className="text-[#8a8580]">Διεύθυνση:</span> {obligor.address || '—'}</div>
              </div>
            </div>

            {/* Revenue split */}
            {calculation?.revenue_split && (
              <div className="bg-white rounded-lg p-4 border border-[#e8e2d8]">
                <div className="flex items-center gap-2 mb-2">
                  <Landmark className="w-4 h-4 text-[#1a3aa3]" />
                  <p className="text-xs font-medium text-[#2a2520]">Κατανομή Εσόδων</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-blue-50 rounded p-2">
                    <p className="text-[#8a8580]">Κρατικός Π/Υ ({calculation.revenue_split.state_pct}%)</p>
                    <p className="font-semibold">{formatCurrency(calculation.revenue_split.state_amount)}</p>
                    <p className="text-[10px] text-[#8a8580]">ΑΛΕ {calculation.revenue_split.state_ale}</p>
                  </div>
                  <div className="bg-green-50 rounded p-2">
                    <p className="text-[#8a8580]">Περιφέρεια ({calculation.revenue_split.region_pct}%)</p>
                    <p className="font-semibold">{formatCurrency(calculation.revenue_split.region_amount)}</p>
                    <p className="text-[10px] text-[#8a8580]">ΚΑΕ {calculation.revenue_split.region_kae}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Legal basis */}
            <div className="bg-amber-50 rounded-lg p-3 border border-amber-200 text-sm text-amber-800">
              <p className="font-medium">Νομική βάση: {calculation?.legal_basis || 'Ν.5041/2023 αρ.100'}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation buttons */}
      <div className="flex items-center justify-between mt-6">
        <Button
          variant="outline"
          onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
          disabled={currentStep === 0}
          className="border-[#e8e2d8]"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Προηγούμενο
        </Button>

        <div className="flex gap-2">
          {currentStep === 3 && (
            <>
              <Button
                variant="outline"
                onClick={handleSaveDraft}
                disabled={saving}
                className="border-[#1a3aa3] text-[#1a3aa3]"
              >
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Αποθήκευση Προσχεδίου
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={saving || !canProceed(1) || !canProceed(2)}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                Υποβολή για Έγκριση
              </Button>
            </>
          )}
          {currentStep < 3 && (
            <Button
              onClick={() => setCurrentStep(currentStep + 1)}
              disabled={!canProceed(currentStep)}
              className="bg-[#1a3aa3] hover:bg-[#152e82] text-white"
            >
              Επόμενο
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
