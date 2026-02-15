import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
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
import { Calculator, Scale, AlertTriangle, TrendingUp, Gavel, FileText, Loader2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { sanctionsApi, structuresApi } from '../lib/registryApi';
import { SANCTION_STATUS } from '../lib/constants';

export default function SanctionsPage() {
  const [searchParams] = useSearchParams();
  const preselectedStructure = searchParams.get('structure');

  // Data
  const [rules, setRules] = useState([]);
  const [structures, setStructures] = useState([]);
  const [recentSanctions, setRecentSanctions] = useState([]);

  // Calculator state
  const [selectedRule, setSelectedRule] = useState('');
  const [selectedStructure, setSelectedStructure] = useState(preselectedStructure || '');
  const [calculation, setCalculation] = useState(null);
  const [calculating, setCalculating] = useState(false);
  const [creating, setCreating] = useState(false);

  // Load initial data
  useEffect(() => {
    sanctionsApi.rules().then(r => setRules(r.data)).catch(() => {});
    structuresApi.list({ per_page: 100 }).then(r => {
      setStructures(r.data.structures || r.data);
    }).catch(() => {});
    // Load all sanctions initially
    sanctionsApi.list()
      .then(r => setRecentSanctions(r.data))
      .catch(() => {});
  }, []);

  // Load sanctions for selected structure (or all if none selected)
  useEffect(() => {
    if (selectedStructure) {
      structuresApi.sanctions(selectedStructure)
        .then(r => setRecentSanctions(r.data))
        .catch(() => setRecentSanctions([]));
    } else {
      sanctionsApi.list()
        .then(r => setRecentSanctions(r.data))
        .catch(() => setRecentSanctions([]));
    }
  }, [selectedStructure]);

  const handleCalculate = useCallback(async () => {
    if (!selectedRule || !selectedStructure) {
      toast.error('Επιλέξτε παράβαση και δομή');
      return;
    }
    setCalculating(true);
    try {
      const resp = await sanctionsApi.calculate({
        violation_code: selectedRule,
        structure_id: parseInt(selectedStructure),
      });
      setCalculation(resp.data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Σφάλμα υπολογισμού');
      setCalculation(null);
    } finally {
      setCalculating(false);
    }
  }, [selectedRule, selectedStructure]);

  const handleCreateSanction = useCallback(async () => {
    if (!calculation || !selectedStructure) return;
    setCreating(true);
    try {
      await structuresApi.createSanction(selectedStructure, {
        type: 'fine',
        amount: calculation.final_amount,
        notes: `violation_code:${calculation.violation_code} | ${calculation.violation_name} | ${calculation.legal_basis || ''}`,
        status: 'imposed',
      });
      toast.success('Η κύρωση καταχωρήθηκε');
      setCalculation(null);
      // Refresh sanctions list
      const resp = await structuresApi.sanctions(selectedStructure);
      setRecentSanctions(resp.data);
    } catch (err) {
      toast.error('Σφάλμα καταχώρησης');
    } finally {
      setCreating(false);
    }
  }, [calculation, selectedStructure]);

  const formatCurrency = (amount) => {
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
            <p className="text-sm text-[#6b6560]">Υπολογισμός προστίμων με βάση τον Ν.4756/2020</p>
          </div>
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
                        {s.name} ({s.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Violation type selector */}
              <div>
                <label className="block text-sm font-medium text-[#2a2520] mb-1">Τύπος Παράβασης</label>
                <Select value={selectedRule} onValueChange={setSelectedRule}>
                  <SelectTrigger className="border-[#e8e2d8]">
                    <SelectValue placeholder="Επιλέξτε παράβαση..." />
                  </SelectTrigger>
                  <SelectContent>
                    {rules.map(r => (
                      <SelectItem key={r.violation_code} value={r.violation_code}>
                        {r.violation_name} ({formatCurrency(r.base_fine)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

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
                    <p className="text-[#8a8580] text-xs">Παράβαση</p>
                    <p className="font-semibold text-[#2a2520] text-xs">{calculation.violation_name}</p>
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

                <Button
                  onClick={handleCreateSanction}
                  disabled={creating}
                  className="w-full bg-red-600 hover:bg-red-700 text-white"
                >
                  {creating ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Καταχώρηση...</>
                  ) : (
                    <><Gavel className="w-4 h-4 mr-2" /> Επιβολή Κύρωσης</>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Rules reference table */}
          <Card className="border-[#e8e2d8]">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-[#2a2520]">Κανόνες Προστίμων</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {rules.map(r => (
                  <div key={r.violation_code} className="flex items-center justify-between text-sm py-1.5 border-b border-[#e8e2d8] last:border-0">
                    <span className="text-[#2a2520]">{r.violation_name}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[#1a3aa3]">{formatCurrency(r.base_fine)}</span>
                      {r.can_trigger_suspension && (
                        <AlertTriangle className="w-3.5 h-3.5 text-orange-500" title="Μπορεί να οδηγήσει σε αναστολή" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Recent Sanctions */}
        <div className="lg:col-span-3">
          <Card className="border-[#e8e2d8]">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-[#2a2520] flex items-center gap-2">
                <Scale className="w-5 h-5 text-[#1a3aa3]" />
                Πρόσφατες Κυρώσεις
                <Badge variant="outline" className="ml-2 text-xs">
                  {selectedStructure
                    ? structures.find(s => String(s.id) === selectedStructure)?.name || ''
                    : 'Όλες οι Δομές'}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentSanctions.length === 0 ? (
                <div className="text-center py-12 text-[#8a8580]">
                  <Scale className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Δεν υπάρχουν κυρώσεις για αυτή τη δομή</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      {!selectedStructure && <TableHead>Δομή</TableHead>}
                      <TableHead>Τύπος</TableHead>
                      <TableHead>Ποσό</TableHead>
                      <TableHead>Ημερομηνία</TableHead>
                      <TableHead>Κατάσταση</TableHead>
                      <TableHead>Σημειώσεις</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentSanctions.map(s => {
                      const statusInfo = SANCTION_STATUS[s.status] || { label: s.status, color: 'gray' };
                      return (
                        <TableRow key={s.id}>
                          {!selectedStructure && (
                            <TableCell className="text-sm font-medium">
                              {s.structure_name || structures.find(st => st.id === s.structure_id)?.name || '—'}
                            </TableCell>
                          )}
                          <TableCell className="font-medium capitalize">{s.type}</TableCell>
                          <TableCell>
                            {s.amount ? formatCurrency(s.amount) : '—'}
                          </TableCell>
                          <TableCell className="text-sm">{formatDate(s.imposed_date)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={
                              statusInfo.color === 'red' ? 'bg-red-50 text-red-700 border-red-200' :
                              statusInfo.color === 'green' ? 'bg-green-50 text-green-700 border-green-200' :
                              statusInfo.color === 'orange' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                              'bg-gray-50 text-gray-700 border-gray-200'
                            }>
                              {statusInfo.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-[#6b6560] max-w-[200px] truncate">
                            {s.notes || '—'}
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
    </div>
  );
}
