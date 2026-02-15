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
import { Calculator, Scale, AlertTriangle, TrendingUp, Gavel, FileText, Loader2 } from 'lucide-react';
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
  }, []);

  // Load sanctions for selected structure
  useEffect(() => {
    if (selectedStructure) {
      structuresApi.sanctions(selectedStructure)
        .then(r => setRecentSanctions(r.data))
        .catch(() => setRecentSanctions([]));
    }
  }, [selectedStructure]);

  const handleCalculate = useCallback(async () => {
    if (!selectedRule || !selectedStructure) {
      toast.error('\u0395\u03c0\u03b9\u03bb\u03ad\u03be\u03c4\u03b5 \u03c0\u03b1\u03c1\u03ac\u03b2\u03b1\u03c3\u03b7 \u03ba\u03b1\u03b9 \u03b4\u03bf\u03bc\u03ae');
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
      toast.error(err.response?.data?.error || '\u03a3\u03c6\u03ac\u03bb\u03bc\u03b1 \u03c5\u03c0\u03bf\u03bb\u03bf\u03b3\u03b9\u03c3\u03bc\u03bf\u03cd');
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
      toast.success('\u0397 \u03ba\u03cd\u03c1\u03c9\u03c3\u03b7 \u03ba\u03b1\u03c4\u03b1\u03c7\u03c9\u03c1\u03ae\u03b8\u03b7\u03ba\u03b5');
      setCalculation(null);
      // Refresh sanctions list
      const resp = await structuresApi.sanctions(selectedStructure);
      setRecentSanctions(resp.data);
    } catch (err) {
      toast.error('\u03a3\u03c6\u03ac\u03bb\u03bc\u03b1 \u03ba\u03b1\u03c4\u03b1\u03c7\u03ce\u03c1\u03b7\u03c3\u03b7\u03c2');
    } finally {
      setCreating(false);
    }
  }, [calculation, selectedStructure]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('el-GR', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '\u2014';
    return new Date(dateStr).toLocaleDateString('el-GR');
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-[#1a3aa3]/10 flex items-center justify-center">
            <Gavel className="w-5 h-5 text-[#1a3aa3]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#2a2520]" style={{ fontFamily: 'Literata, serif' }}>
              \u039a\u03c5\u03c1\u03ce\u03c3\u03b5\u03b9\u03c2 & \u03a0\u03c1\u03cc\u03c3\u03c4\u03b9\u03bc\u03b1
            </h1>
            <p className="text-sm text-[#6b6560]">\u03a5\u03c0\u03bf\u03bb\u03bf\u03b3\u03b9\u03c3\u03bc\u03cc\u03c2 \u03c0\u03c1\u03bf\u03c3\u03c4\u03af\u03bc\u03c9\u03bd \u03bc\u03b5 \u03b2\u03ac\u03c3\u03b7 \u03c4\u03bf\u03bd \u039d.4756/2020</p>
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
                \u03a5\u03c0\u03bf\u03bb\u03bf\u03b3\u03b9\u03c3\u03c4\u03ae\u03c2 \u03a0\u03c1\u03bf\u03c3\u03c4\u03af\u03bc\u03bf\u03c5
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Structure selector */}
              <div>
                <label className="block text-sm font-medium text-[#2a2520] mb-1">\u0394\u03bf\u03bc\u03ae</label>
                <Select value={selectedStructure} onValueChange={setSelectedStructure}>
                  <SelectTrigger className="border-[#e8e2d8]">
                    <SelectValue placeholder="\u0395\u03c0\u03b9\u03bb\u03ad\u03be\u03c4\u03b5 \u03b4\u03bf\u03bc\u03ae..." />
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
                <label className="block text-sm font-medium text-[#2a2520] mb-1">\u03a4\u03cd\u03c0\u03bf\u03c2 \u03a0\u03b1\u03c1\u03ac\u03b2\u03b1\u03c3\u03b7\u03c2</label>
                <Select value={selectedRule} onValueChange={setSelectedRule}>
                  <SelectTrigger className="border-[#e8e2d8]">
                    <SelectValue placeholder="\u0395\u03c0\u03b9\u03bb\u03ad\u03be\u03c4\u03b5 \u03c0\u03b1\u03c1\u03ac\u03b2\u03b1\u03c3\u03b7..." />
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
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> \u03a5\u03c0\u03bf\u03bb\u03bf\u03b3\u03b9\u03c3\u03bc\u03cc\u03c2...</>
                ) : (
                  <><Scale className="w-4 h-4 mr-2" /> \u03a5\u03c0\u03bf\u03bb\u03bf\u03b3\u03b9\u03c3\u03bc\u03cc\u03c2 \u03a0\u03c1\u03bf\u03c3\u03c4\u03af\u03bc\u03bf\u03c5</>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Calculation Result */}
          {calculation && (
            <Card className="border-[#1a3aa3]/30 bg-[#1a3aa3]/5">
              <CardContent className="pt-6 space-y-4">
                <div className="text-center">
                  <p className="text-sm text-[#6b6560] mb-1">\u03a4\u03b5\u03bb\u03b9\u03ba\u03cc \u03a0\u03c1\u03cc\u03c3\u03c4\u03b9\u03bc\u03bf</p>
                  <p className="text-4xl font-bold text-[#1a3aa3]" style={{ fontFamily: 'Literata, serif' }}>
                    {formatCurrency(calculation.final_amount)}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-white rounded-lg p-3 border border-[#e8e2d8]">
                    <p className="text-[#8a8580] text-xs">\u0392\u03b1\u03c3\u03b9\u03ba\u03cc \u03c0\u03c1\u03cc\u03c3\u03c4\u03b9\u03bc\u03bf</p>
                    <p className="font-semibold text-[#2a2520]">{formatCurrency(calculation.base_fine)}</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-[#e8e2d8]">
                    <p className="text-[#8a8580] text-xs">\u03a0\u03bf\u03bb\u03bb\u03b1\u03c0\u03bb\u03b1\u03c3\u03b9\u03b1\u03c3\u03c4\u03ae\u03c2</p>
                    <p className="font-semibold text-[#2a2520]">{calculation.multiplier}x</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-[#e8e2d8]">
                    <p className="text-[#8a8580] text-xs">\u03a5\u03c0\u03bf\u03c4\u03c1\u03bf\u03c0\u03ad\u03c2</p>
                    <p className="font-semibold text-[#2a2520]">
                      {calculation.recidivism_count}
                      {calculation.recidivism_count > 0 && (
                        <TrendingUp className="w-3 h-3 inline ml-1 text-orange-500" />
                      )}
                    </p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-[#e8e2d8]">
                    <p className="text-[#8a8580] text-xs">\u03a0\u03b1\u03c1\u03ac\u03b2\u03b1\u03c3\u03b7</p>
                    <p className="font-semibold text-[#2a2520] text-xs">{calculation.violation_name}</p>
                  </div>
                </div>

                {calculation.legal_basis && (
                  <div className="bg-white rounded-lg p-3 border border-[#e8e2d8]">
                    <div className="flex items-start gap-2">
                      <FileText className="w-4 h-4 text-[#1a3aa3] mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-[#8a8580]">\u039d\u03bf\u03bc\u03b9\u03ba\u03ae \u0392\u03ac\u03c3\u03b7</p>
                        <p className="text-sm text-[#2a2520]">{calculation.legal_basis}</p>
                      </div>
                    </div>
                  </div>
                )}

                {calculation.can_trigger_suspension && (
                  <div className="bg-orange-50 rounded-lg p-3 border border-orange-200 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-orange-600 mt-0.5 shrink-0" />
                    <p className="text-sm text-orange-800">
                      \u03a0\u03c1\u03bf\u03c3\u03bf\u03c7\u03ae: \u039f \u03b1\u03c1\u03b9\u03b8\u03bc\u03cc\u03c2 \u03c5\u03c0\u03bf\u03c4\u03c1\u03bf\u03c0\u03ce\u03bd \u03c5\u03c0\u03b5\u03c1\u03b2\u03b1\u03af\u03bd\u03b5\u03b9 \u03c4\u03bf \u03cc\u03c1\u03b9\u03bf \u03b3\u03b9\u03b1 \u03b1\u03bd\u03b1\u03c3\u03c4\u03bf\u03bb\u03ae \u03bb\u03b5\u03b9\u03c4\u03bf\u03c5\u03c1\u03b3\u03af\u03b1\u03c2.
                    </p>
                  </div>
                )}

                <Button
                  onClick={handleCreateSanction}
                  disabled={creating}
                  className="w-full bg-red-600 hover:bg-red-700 text-white"
                >
                  {creating ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> \u039a\u03b1\u03c4\u03b1\u03c7\u03ce\u03c1\u03b7\u03c3\u03b7...</>
                  ) : (
                    <><Gavel className="w-4 h-4 mr-2" /> \u0395\u03c0\u03b9\u03b2\u03bf\u03bb\u03ae \u039a\u03cd\u03c1\u03c9\u03c3\u03b7\u03c2</>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Rules reference table */}
          <Card className="border-[#e8e2d8]">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-[#2a2520]">\u039a\u03b1\u03bd\u03cc\u03bd\u03b5\u03c2 \u03a0\u03c1\u03bf\u03c3\u03c4\u03af\u03bc\u03c9\u03bd</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {rules.map(r => (
                  <div key={r.violation_code} className="flex items-center justify-between text-sm py-1.5 border-b border-[#e8e2d8] last:border-0">
                    <span className="text-[#2a2520]">{r.violation_name}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[#1a3aa3]">{formatCurrency(r.base_fine)}</span>
                      {r.can_trigger_suspension && (
                        <AlertTriangle className="w-3.5 h-3.5 text-orange-500" title="\u039c\u03c0\u03bf\u03c1\u03b5\u03af \u03bd\u03b1 \u03bf\u03b4\u03b7\u03b3\u03ae\u03c3\u03b5\u03b9 \u03c3\u03b5 \u03b1\u03bd\u03b1\u03c3\u03c4\u03bf\u03bb\u03ae" />
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
                \u03a0\u03c1\u03cc\u03c3\u03c6\u03b1\u03c4\u03b5\u03c2 \u039a\u03c5\u03c1\u03ce\u03c3\u03b5\u03b9\u03c2
                {selectedStructure && (
                  <Badge variant="outline" className="ml-2 text-xs">
                    {structures.find(s => String(s.id) === selectedStructure)?.name || ''}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!selectedStructure ? (
                <div className="text-center py-12 text-[#8a8580]">
                  <Scale className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>\u0395\u03c0\u03b9\u03bb\u03ad\u03be\u03c4\u03b5 \u03b4\u03bf\u03bc\u03ae \u03b3\u03b9\u03b1 \u03bd\u03b1 \u03b4\u03b5\u03af\u03c4\u03b5 \u03c4\u03b9\u03c2 \u03ba\u03c5\u03c1\u03ce\u03c3\u03b5\u03b9\u03c2 \u03c4\u03b7\u03c2</p>
                </div>
              ) : recentSanctions.length === 0 ? (
                <div className="text-center py-12 text-[#8a8580]">
                  <Scale className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>\u0394\u03b5\u03bd \u03c5\u03c0\u03ac\u03c1\u03c7\u03bf\u03c5\u03bd \u03ba\u03c5\u03c1\u03ce\u03c3\u03b5\u03b9\u03c2 \u03b3\u03b9\u03b1 \u03b1\u03c5\u03c4\u03ae \u03c4\u03b7 \u03b4\u03bf\u03bc\u03ae</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>\u03a4\u03cd\u03c0\u03bf\u03c2</TableHead>
                      <TableHead>\u03a0\u03bf\u03c3\u03cc</TableHead>
                      <TableHead>\u0397\u03bc\u03b5\u03c1\u03bf\u03bc\u03b7\u03bd\u03af\u03b1</TableHead>
                      <TableHead>\u039a\u03b1\u03c4\u03ac\u03c3\u03c4\u03b1\u03c3\u03b7</TableHead>
                      <TableHead>\u03a3\u03b7\u03bc\u03b5\u03b9\u03ce\u03c3\u03b5\u03b9\u03c2</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentSanctions.map(s => {
                      const statusInfo = SANCTION_STATUS[s.status] || { label: s.status, color: 'gray' };
                      return (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium capitalize">{s.type}</TableCell>
                          <TableCell>
                            {s.amount ? formatCurrency(s.amount) : '\u2014'}
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
                            {s.notes || '\u2014'}
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
