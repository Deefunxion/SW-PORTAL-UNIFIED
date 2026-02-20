import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Slider } from '@/components/ui/slider.jsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.jsx';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table.jsx';
import {
  Calculator, Scale, AlertTriangle, TrendingUp, Gavel, FileText,
  Loader2, ArrowLeft, Shield, Droplets, Users, Info, Landmark, Building2,
  ClipboardList, Download, ExternalLink, FileDown,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog.jsx';
import { sanctionsApi, structuresApi, decisionsApi } from '../lib/registryApi';
import { VIOLATION_CATEGORIES, SANCTION_DECISION_STATUSES } from '../lib/constants';

const CATEGORY_ICONS = {
  safety: Shield,
  hygiene: Droplets,
  admin: FileText,
  staff: Users,
  general: AlertTriangle,
};

export default function SanctionsPage() {
  const [searchParams] = useSearchParams();
  const preselectedStructure = searchParams.get('structure');

  // Data
  const [rules, setRules] = useState([]);
  const [structures, setStructures] = useState([]);
  const [decisions, setDecisions] = useState([]);

  // Calculator state
  const [selectedRule, setSelectedRule] = useState('');
  const [selectedStructure, setSelectedStructure] = useState(preselectedStructure || '');
  const [customAmount, setCustomAmount] = useState(null);
  const [calculation, setCalculation] = useState(null);
  const [calculating, setCalculating] = useState(false);
  const [opsExportDialog, setOpsExportDialog] = useState({ open: false, decisionId: null });

  // Get selected structure's type_id for filtering rules
  const selectedStructureObj = useMemo(
    () => structures.find(s => String(s.id) === selectedStructure),
    [structures, selectedStructure]
  );

  // Load structures once
  useEffect(() => {
    structuresApi.list({ per_page: 100 }).then(r => {
      setStructures(r.data.structures || r.data);
    }).catch(() => {});
  }, []);

  // Load rules filtered by selected structure's type
  useEffect(() => {
    const typeId = selectedStructureObj?.type_id || selectedStructureObj?.type?.id;
    sanctionsApi.rules(typeId).then(r => setRules(r.data)).catch(() => {});
    // Reset selection when structure changes
    setSelectedRule('');
    setCustomAmount(null);
    setCalculation(null);
  }, [selectedStructureObj]);

  // Load decisions
  useEffect(() => {
    const params = selectedStructure ? { structure_id: parseInt(selectedStructure) } : {};
    decisionsApi.list(params)
      .then(r => setDecisions(r.data))
      .catch(() => setDecisions([]));
  }, [selectedStructure]);

  const handleExportDecision = useCallback(async (decisionId) => {
    try {
      const resp = await decisionsApi.export(decisionId);
      const blob = new Blob([JSON.stringify(resp.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `decision-${decisionId}-ops-export.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Η εξαγωγή βεβαίωσης εσόδου ολοκληρώθηκε');
    } catch {
      toast.error('Σφάλμα εξαγωγής');
    }
  }, []);

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

  // Currently selected rule object
  const currentRule = useMemo(
    () => rules.find(r => r.violation_code === selectedRule),
    [rules, selectedRule]
  );

  const hasRange = currentRule && currentRule.min_fine != null && currentRule.max_fine != null
    && currentRule.min_fine !== currentRule.max_fine;

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
      setCalculation(null);
    } finally {
      setCalculating(false);
    }
  }, [selectedRule, selectedStructure, customAmount, hasRange]);

  const formatCurrency = (amount) => {
    if (amount == null) return '—';
    return new Intl.NumberFormat('el-GR', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('el-GR');
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <Link to="/registry" className="inline-flex items-center gap-1 text-sm text-[#1a3aa3] hover:underline mb-4">
        <ArrowLeft className="w-4 h-4" />
        Μητρώο Δομών
      </Link>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-[#1a3aa3]/10 flex items-center justify-center">
            <Gavel className="w-5 h-5 text-[#1a3aa3]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#2a2520]" style={{ fontFamily: 'Literata, serif' }}>
              Κυρώσεις & Πρόστιμα
            </h1>
            <p className="text-sm text-[#6b6560]">Υπολογισμός προστίμων — Ν.5041/2023, Άρθρο 100</p>
          </div>
          <Link to="/sanctions/decisions/new">
            <Button className="bg-[#1a3aa3] hover:bg-[#152e82] text-white">
              <Gavel className="w-4 h-4 mr-2" />
              Νέα Απόφαση
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left Column: Fine Calculator */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="border-[#e8e2d8]">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-[#2a2520] flex items-center gap-2">
                <Calculator className="w-5 h-5 text-[#1a3aa3]" />
                Υπολογιστής Προστίμου
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Structure selector */}
              <div>
                <label className="block text-sm font-medium text-[#2a2520] mb-1">Δομή</label>
                <Select value={selectedStructure} onValueChange={setSelectedStructure}>
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
                {selectedStructureObj?.type && (
                  <p className="text-xs text-[#8a8580] mt-1">
                    Τύπος: {selectedStructureObj.type.name}
                  </p>
                )}
              </div>

              {/* Violation type selector — grouped by category */}
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
                      const catInfo = VIOLATION_CATEGORIES[cat] || { label: cat };
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

              {/* Amount range slider (when rule has min ≠ max) */}
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
                  <p className="text-xs text-[#8a8580]">
                    Βασικό: {formatCurrency(currentRule.base_fine)} · Νομική βάση: {currentRule.legal_reference}
                  </p>
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
            </CardContent>
          </Card>

          {/* Calculation Result */}
          {calculation && (
            <Card className="border-[#1a3aa3]/30 bg-[#1a3aa3]/5">
              <CardContent className="pt-6 space-y-4">
                <div className="text-center">
                  <p className="text-sm text-[#6b6560] mb-1">Τελικό Πρόστιμο</p>
                  <p className="text-4xl font-bold text-[#1a3aa3]" style={{ fontFamily: 'Literata, serif' }}>
                    {formatCurrency(calculation.final_amount)}
                  </p>
                  {calculation.effective_min !== calculation.effective_max && (
                    <p className="text-xs text-[#8a8580] mt-1">
                      Εύρος: {formatCurrency(calculation.effective_min)} — {formatCurrency(calculation.effective_max)}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-white rounded-lg p-3 border border-[#e8e2d8]">
                    <p className="text-[#8a8580] text-xs">Βασικό πρόστιμο</p>
                    <p className="font-semibold text-[#2a2520]">{formatCurrency(calculation.base_fine)}</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-[#e8e2d8]">
                    <p className="text-[#8a8580] text-xs">Πολλαπλασιαστής</p>
                    <p className="font-semibold text-[#2a2520]">{calculation.multiplier}x</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-[#e8e2d8]">
                    <p className="text-[#8a8580] text-xs">Υποτροπές</p>
                    <p className="font-semibold text-[#2a2520]">
                      {calculation.recidivism_count}
                      {calculation.recidivism_count > 0 && (
                        <TrendingUp className="w-3 h-3 inline ml-1 text-orange-500" />
                      )}
                    </p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-[#e8e2d8]">
                    <p className="text-[#8a8580] text-xs">Κατηγορία</p>
                    <p className="font-semibold text-[#2a2520] text-xs">
                      {VIOLATION_CATEGORIES[calculation.category]?.label || calculation.category}
                    </p>
                  </div>
                </div>

                {/* Revenue split */}
                {calculation.revenue_split && (
                  <div className="bg-white rounded-lg p-3 border border-[#e8e2d8]">
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

                {/* Deadlines info */}
                <div className="bg-white rounded-lg p-3 border border-[#e8e2d8] flex gap-4 text-xs">
                  <div>
                    <p className="text-[#8a8580]">Προθεσμία πληρωμής</p>
                    <p className="font-semibold">{calculation.payment_deadline_days} ημέρες</p>
                  </div>
                  <div>
                    <p className="text-[#8a8580]">Προθεσμία ένστασης</p>
                    <p className="font-semibold">{calculation.appeal_deadline_days} ημέρες</p>
                  </div>
                </div>

                {calculation.legal_basis && (
                  <div className="bg-white rounded-lg p-3 border border-[#e8e2d8]">
                    <div className="flex items-start gap-2">
                      <FileText className="w-4 h-4 text-[#1a3aa3] mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-[#8a8580]">Νομική Βάση</p>
                        <p className="text-sm text-[#2a2520]">{calculation.legal_basis}</p>
                      </div>
                    </div>
                  </div>
                )}

                {calculation.can_trigger_suspension && (
                  <div className="bg-orange-50 rounded-lg p-3 border border-orange-200 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-orange-600 mt-0.5 shrink-0" />
                    <p className="text-sm text-orange-800">
                      Προσοχή: Ο αριθμός υποτροπών υπερβαίνει το όριο για αναστολή λειτουργίας.
                    </p>
                  </div>
                )}

                <Button asChild className="w-full bg-blue-700 hover:bg-blue-800 text-white">
                  <Link to={`/sanctions/decisions/new?structure=${selectedStructure}&rule=${selectedRule}&amount=${calculation.final_amount}`}>
                    <FileText className="w-4 h-4 mr-2" />
                    Συνέχεια σε Απόφαση
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Rules reference — grouped by category */}
          <Card className="border-[#e8e2d8]">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-[#2a2520] flex items-center gap-2">
                Κανόνες Προστίμων
                {selectedStructureObj?.type && (
                  <Badge variant="outline" className="text-xs ml-1">
                    {selectedStructureObj.type.name}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(groupedRules).map(([cat, catRules]) => {
                const catInfo = VIOLATION_CATEGORIES[cat] || { label: cat };
                const CatIcon = CATEGORY_ICONS[cat] || AlertTriangle;
                return (
                  <div key={cat}>
                    <div className="flex items-center gap-1.5 mb-2">
                      <CatIcon className="w-3.5 h-3.5 text-[#1a3aa3]" />
                      <span className="text-xs font-semibold text-[#1a3aa3] uppercase tracking-wide">
                        {catInfo.label}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {catRules.map(r => (
                        <div key={r.violation_code} className="flex items-center justify-between text-sm py-1.5 border-b border-[#e8e2d8]/50 last:border-0">
                          <span className="text-[#2a2520] truncate mr-2">{r.violation_name}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-semibold text-[#1a3aa3] text-xs">
                              {r.min_fine != null && r.min_fine !== r.max_fine
                                ? `${formatCurrency(r.min_fine)} — ${formatCurrency(r.max_fine)}`
                                : formatCurrency(r.base_fine)}
                            </span>
                            {r.can_trigger_suspension && (
                              <AlertTriangle className="w-3.5 h-3.5 text-orange-500" title="Μπορεί να οδηγήσει σε αναστολή" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              {rules.length === 0 && (
                <p className="text-center text-sm text-[#8a8580] py-4">
                  {selectedStructure ? 'Επιλέξτε δομή για εμφάνιση κανόνων' : 'Φόρτωση κανόνων...'}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Decisions */}
        <div className="lg:col-span-3 space-y-4">
          <Card className="border-[#e8e2d8]">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg text-[#2a2520] flex items-center gap-2">
                    <ClipboardList className="w-5 h-5 text-[#1a3aa3]" />
                    Αποφάσεις
                    <Badge variant="outline" className="ml-2 text-xs">
                      {selectedStructure
                        ? selectedStructureObj?.name || ''
                        : 'Όλες οι Δομές'}
                    </Badge>
                  </CardTitle>
                  <Link to="/sanctions/decisions">
                    <Button variant="outline" size="sm" className="border-[#e8e2d8] text-[#1a3aa3]">
                      <ExternalLink className="w-3.5 h-3.5 mr-1" />
                      Όλες
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {decisions.length === 0 ? (
                  <div className="text-center py-12 text-[#8a8580]">
                    <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>Δεν υπάρχουν αποφάσεις</p>
                    <Link to="/sanctions/decisions/new">
                      <Button size="sm" className="mt-3 bg-[#1a3aa3] hover:bg-[#152e82] text-white">
                        <Gavel className="w-3.5 h-3.5 mr-1" />
                        Δημιουργία
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        {!selectedStructure && <TableHead>Δομή</TableHead>}
                        <TableHead>Ποσό</TableHead>
                        <TableHead>Κατάσταση</TableHead>
                        <TableHead>Ημ/νία</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {decisions.map(d => {
                        const statusInfo = SANCTION_DECISION_STATUSES[d.status] || { label: d.status, className: '' };
                        return (
                          <TableRow key={d.id}>
                            <TableCell className="font-mono text-xs">{d.id}</TableCell>
                            {!selectedStructure && (
                              <TableCell className="text-sm font-medium">{d.structure_name || '—'}</TableCell>
                            )}
                            <TableCell className="font-semibold text-[#1a3aa3]">
                              {formatCurrency(d.final_amount)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={statusInfo.className}>
                                {statusInfo.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-[#8a8580]">
                              {formatDate(d.created_at)}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Link to={`/sanctions/decisions/${d.id}`}>
                                  <Button variant="ghost" size="sm" title="Προβολή">
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </Button>
                                </Link>
                                {d.status !== 'draft' && (
                                  <Button
                                    variant="ghost" size="sm"
                                    title="Λήψη PDF"
                                    onClick={async () => {
                                      try {
                                        const resp = await decisionsApi.pdf(d.id);
                                        const url = URL.createObjectURL(resp.data);
                                        window.open(url, '_blank');
                                      } catch {
                                        toast.error('Σφάλμα PDF');
                                      }
                                    }}
                                  >
                                    <FileDown className="w-3.5 h-3.5" />
                                  </Button>
                                )}
                                {['approved', 'notified', 'paid'].includes(d.status) && (
                                  <Button
                                    variant="ghost" size="sm"
                                    title="Εξαγωγή Βεβαίωσης Εσόδου"
                                    onClick={() => setOpsExportDialog({ open: true, decisionId: d.id })}
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
        </div>
      </div>

      {/* OPS Export Confirmation Dialog */}
      <AlertDialog open={opsExportDialog.open} onOpenChange={(open) => setOpsExportDialog({ open, decisionId: open ? opsExportDialog.decisionId : null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Εξαγωγή Βεβαίωσης Εσόδου</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  Θα εξαχθεί αρχείο JSON με τα στοιχεία της απόφασης για καταχώρηση
                  στο Ολοκληρωμένο Πληροφοριακό Σύστημα (TAXIS/ΑΑΔΕ).
                </p>
                <p className="text-sm">Το αρχείο περιλαμβάνει:</p>
                <ul className="text-sm list-disc pl-5 space-y-1">
                  <li>Αριθμό απόφασης & ημερομηνία έγκρισης</li>
                  <li>Στοιχεία υπόχρεου (ΑΦΜ, ΔΟΥ, διεύθυνση)</li>
                  <li>Ποσά ανά ΚΑΕ (κρατικός & περιφερειακός προϋπολογισμός)</li>
                  <li>Νομική βάση επιβολής</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Ακύρωση</AlertDialogCancel>
            <AlertDialogAction
              className="bg-[#1a3aa3] hover:bg-[#152e82] text-white"
              onClick={() => {
                handleExportDecision(opsExportDialog.decisionId);
                setOpsExportDialog({ open: false, decisionId: null });
              }}
            >
              Εξαγωγή
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
