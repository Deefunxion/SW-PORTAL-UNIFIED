import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog.jsx';
import {
  Gavel, ArrowLeft, CheckCircle, XCircle, Eye, Loader2,
  ClipboardList, Send, Clock, Landmark, Bell, CreditCard, FileDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { decisionsApi } from '../lib/registryApi';
import { SANCTION_DECISION_STATUSES } from '../lib/constants';

export default function DecisionApprovalPage() {
  const [decisions, setDecisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedDecision, setSelectedDecision] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Approval dialog
  const [approvalDialog, setApprovalDialog] = useState({ open: false, action: null, decisionId: null });
  const [returnComments, setReturnComments] = useState('');
  const [processing, setProcessing] = useState(false);

  // Notification dialog
  const [notifyDialog, setNotifyDialog] = useState({ open: false, decisionId: null });
  const [notifyMethod, setNotifyMethod] = useState('personal_service');

  // Payment dialog
  const [paymentDialog, setPaymentDialog] = useState({ open: false, decisionId: null });
  const [paymentAction, setPaymentAction] = useState('paid');

  const loadDecisions = useCallback(async () => {
    setLoading(true);
    try {
      const params = statusFilter !== 'all' ? { status: statusFilter } : {};
      const resp = await decisionsApi.list(params);
      setDecisions(resp.data);
    } catch {
      toast.error('Σφάλμα φόρτωσης αποφάσεων');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { loadDecisions(); }, [loadDecisions]);

  const loadDetail = useCallback(async (id) => {
    setLoadingDetail(true);
    try {
      const resp = await decisionsApi.get(id);
      setDetailData(resp.data);
      setSelectedDecision(id);
    } catch {
      toast.error('Σφάλμα φόρτωσης λεπτομερειών');
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  const handleApproval = useCallback(async () => {
    const { decisionId, action } = approvalDialog;
    setProcessing(true);
    try {
      await decisionsApi.approve(decisionId, {
        action,
        comments: action === 'return' ? returnComments : undefined,
      });
      toast.success(action === 'approve' ? 'Η απόφαση εγκρίθηκε' : 'Η απόφαση επιστράφηκε');
      setApprovalDialog({ open: false, action: null, decisionId: null });
      setReturnComments('');
      setSelectedDecision(null);
      setDetailData(null);
      loadDecisions();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Σφάλμα');
    } finally {
      setProcessing(false);
    }
  }, [approvalDialog, returnComments, loadDecisions]);

  const handleNotify = useCallback(async () => {
    setProcessing(true);
    try {
      await decisionsApi.notify(notifyDialog.decisionId, { method: notifyMethod });
      toast.success('Η απόφαση κοινοποιήθηκε');
      setNotifyDialog({ open: false, decisionId: null });
      setSelectedDecision(null);
      setDetailData(null);
      loadDecisions();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Σφάλμα κοινοποίησης');
    } finally {
      setProcessing(false);
    }
  }, [notifyDialog, notifyMethod, loadDecisions]);

  const handlePayment = useCallback(async () => {
    setProcessing(true);
    try {
      await decisionsApi.payment(paymentDialog.decisionId, { action: paymentAction });
      toast.success(
        paymentAction === 'paid' ? 'Καταχωρήθηκε η πληρωμή' :
        paymentAction === 'appealed' ? 'Καταχωρήθηκε η ένσταση' :
        'Η απόφαση ακυρώθηκε'
      );
      setPaymentDialog({ open: false, decisionId: null });
      setSelectedDecision(null);
      setDetailData(null);
      loadDecisions();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Σφάλμα');
    } finally {
      setProcessing(false);
    }
  }, [paymentDialog, paymentAction, loadDecisions]);

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
      <Link to="/sanctions" className="inline-flex items-center gap-1 text-sm text-[#1a3aa3] hover:underline mb-4">
        <ArrowLeft className="w-4 h-4" />
        Κυρώσεις & Πρόστιμα
      </Link>

      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-[#1a3aa3]/10 flex items-center justify-center">
            <ClipboardList className="w-5 h-5 text-[#1a3aa3]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#2a2520]" style={{ fontFamily: 'Literata, serif' }}>
              Αποφάσεις Κυρώσεων
            </h1>
            <p className="text-sm text-[#6b6560]">Διαχείριση, έγκριση και παρακολούθηση αποφάσεων</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px] border-[#e8e2d8]">
            <SelectValue placeholder="Φίλτρο κατάστασης" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Όλες</SelectItem>
            {Object.entries(SANCTION_DECISION_STATUSES).map(([key, val]) => (
              <SelectItem key={key} value={key}>{val.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Link to="/sanctions/decisions/new">
          <Button className="bg-[#1a3aa3] hover:bg-[#152e82] text-white">
            <Gavel className="w-4 h-4 mr-2" />
            Νέα Απόφαση
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Decision list */}
        <div className="lg:col-span-3">
          <Card className="border-[#e8e2d8]">
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-[#1a3aa3]" />
                </div>
              ) : decisions.length === 0 ? (
                <div className="text-center py-12 text-[#8a8580]">
                  <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Δεν βρέθηκαν αποφάσεις</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Δομή</TableHead>
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
                        <TableRow
                          key={d.id}
                          className={selectedDecision === d.id ? 'bg-blue-50' : 'cursor-pointer hover:bg-gray-50'}
                          onClick={() => loadDetail(d.id)}
                        >
                          <TableCell className="font-mono text-xs">{d.id}</TableCell>
                          <TableCell className="text-sm font-medium">{d.structure_name || '—'}</TableCell>
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
                            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); loadDetail(d.id); }}>
                              <Eye className="w-4 h-4" />
                            </Button>
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

        {/* Detail panel */}
        <div className="lg:col-span-2">
          {loadingDetail ? (
            <Card className="border-[#e8e2d8]">
              <CardContent className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-[#1a3aa3]" />
              </CardContent>
            </Card>
          ) : detailData ? (
            <Card className="border-[#e8e2d8]">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>Απόφαση #{detailData.id}</span>
                  <Badge variant="outline" className={
                    SANCTION_DECISION_STATUSES[detailData.status]?.className || ''
                  }>
                    {SANCTION_DECISION_STATUSES[detailData.status]?.label || detailData.status}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[#8a8580]">Δομή</span>
                    <span className="font-medium">{detailData.structure_name || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#8a8580]">Παράβαση</span>
                    <span className="font-medium text-xs">{detailData.violation_code}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#8a8580]">Ποσό</span>
                    <span className="font-bold text-[#1a3aa3]">{formatCurrency(detailData.final_amount)}</span>
                  </div>
                  {detailData.protocol_number && (
                    <div className="flex justify-between">
                      <span className="text-[#8a8580]">Αρ. Πρωτοκόλλου</span>
                      <span className="font-mono text-xs">{detailData.protocol_number}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-[#8a8580]">Συντάκτης</span>
                    <span>{detailData.drafter_name || '—'}</span>
                  </div>
                  {detailData.approver_name && (
                    <div className="flex justify-between">
                      <span className="text-[#8a8580]">Εγκρίθηκε από</span>
                      <span>{detailData.approver_name}</span>
                    </div>
                  )}
                </div>

                {/* Obligor */}
                <div className="bg-gray-50 rounded-lg p-3 text-xs space-y-1">
                  <p className="font-medium text-[#2a2520]">Υπόχρεος</p>
                  <p>{detailData.obligor_name || '—'}</p>
                  <p className="text-[#8a8580]">ΑΦΜ: {detailData.obligor_afm || '—'} · ΔΟΥ: {detailData.obligor_doy || '—'}</p>
                </div>

                {/* Justification */}
                {detailData.justification && (
                  <div className="bg-amber-50 rounded-lg p-3 text-xs border border-amber-200">
                    <p className="font-medium text-amber-800 mb-1">Αιτιολογία</p>
                    <p className="text-amber-900 whitespace-pre-wrap">{detailData.justification}</p>
                  </div>
                )}

                {/* Return comments */}
                {detailData.return_comments && (
                  <div className="bg-orange-50 rounded-lg p-3 text-xs border border-orange-200">
                    <p className="font-medium text-orange-800 mb-1">Σχόλια επιστροφής</p>
                    <p className="text-orange-900">{detailData.return_comments}</p>
                  </div>
                )}

                {/* Revenue split */}
                {detailData.amount_state != null && (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-blue-50 rounded p-2">
                      <p className="text-[#8a8580]">Κρατικός Π/Υ</p>
                      <p className="font-semibold">{formatCurrency(detailData.amount_state)}</p>
                    </div>
                    <div className="bg-green-50 rounded p-2">
                      <p className="text-[#8a8580]">Περιφέρεια</p>
                      <p className="font-semibold">{formatCurrency(detailData.amount_region)}</p>
                    </div>
                  </div>
                )}

                {/* Deadlines */}
                {detailData.payment_deadline && (
                  <div className="flex gap-3 text-xs">
                    <div>
                      <span className="text-[#8a8580]">Πληρωμή: </span>
                      <span className="font-medium">{formatDate(detailData.payment_deadline)}</span>
                    </div>
                    <div>
                      <span className="text-[#8a8580]">Ένσταση: </span>
                      <span className="font-medium">{formatDate(detailData.appeal_deadline)}</span>
                    </div>
                  </div>
                )}

                {/* PDF download (available for any non-draft decision) */}
                {detailData.status !== 'draft' && (
                  <Button
                    variant="outline"
                    className="w-full border-[#1a3aa3] text-[#1a3aa3]"
                    onClick={async () => {
                      try {
                        const resp = await decisionsApi.pdf(detailData.id);
                        const url = URL.createObjectURL(resp.data);
                        window.open(url, '_blank');
                      } catch {
                        toast.error('Σφάλμα δημιουργίας PDF');
                      }
                    }}
                  >
                    <FileDown className="w-4 h-4 mr-2" />
                    Λήψη PDF
                  </Button>
                )}

                {/* Actions based on status */}
                <div className="pt-2 space-y-2">
                  {detailData.status === 'draft' && (
                    <Link to={`/sanctions/decisions/${detailData.id}`} className="block">
                      <Button variant="outline" className="w-full border-[#1a3aa3] text-[#1a3aa3]">
                        <Gavel className="w-4 h-4 mr-2" />
                        Επεξεργασία
                      </Button>
                    </Link>
                  )}
                  {detailData.status === 'submitted' && (
                    <div className="flex gap-2">
                      <Button
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => setApprovalDialog({ open: true, action: 'approve', decisionId: detailData.id })}
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Έγκριση
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1 border-orange-300 text-orange-600 hover:bg-orange-50"
                        onClick={() => setApprovalDialog({ open: true, action: 'return', decisionId: detailData.id })}
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        Επιστροφή
                      </Button>
                    </div>
                  )}
                  {detailData.status === 'approved' && (
                    <Button
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                      onClick={() => setNotifyDialog({ open: true, decisionId: detailData.id })}
                    >
                      <Bell className="w-4 h-4 mr-2" />
                      Κοινοποίηση
                    </Button>
                  )}
                  {(detailData.status === 'notified' || detailData.status === 'overdue') && (
                    <Button
                      className="w-full bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => setPaymentDialog({ open: true, decisionId: detailData.id })}
                    >
                      <CreditCard className="w-4 h-4 mr-2" />
                      Ενημέρωση Πληρωμής
                    </Button>
                  )}
                  {detailData.status === 'returned' && (
                    <Link to={`/sanctions/decisions/${detailData.id}`} className="block">
                      <Button variant="outline" className="w-full border-orange-300 text-orange-600">
                        <Gavel className="w-4 h-4 mr-2" />
                        Διόρθωση & Επανυποβολή
                      </Button>
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-[#e8e2d8]">
              <CardContent className="text-center py-12 text-[#8a8580]">
                <Eye className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Επιλέξτε μια απόφαση για προβολή</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Approval dialog */}
      <Dialog open={approvalDialog.open} onOpenChange={(open) => {
        if (!open) setApprovalDialog({ open: false, action: null, decisionId: null });
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {approvalDialog.action === 'approve' ? 'Έγκριση Απόφασης' : 'Επιστροφή Απόφασης'}
            </DialogTitle>
          </DialogHeader>
          {approvalDialog.action === 'approve' ? (
            <p className="text-sm text-[#6b6560]">
              Θα εγκριθεί η απόφαση και θα εκδοθεί αυτόματα αριθμός πρωτοκόλλου. Συνέχεια;
            </p>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-[#6b6560]">
                Η απόφαση θα επιστραφεί στον συντάκτη για διορθώσεις.
              </p>
              <Textarea
                value={returnComments}
                onChange={(e) => setReturnComments(e.target.value)}
                placeholder="Σχόλια / λόγοι επιστροφής..."
                rows={4}
                className="border-[#e8e2d8]"
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setApprovalDialog({ open: false, action: null, decisionId: null })}>
              Ακύρωση
            </Button>
            <Button
              onClick={handleApproval}
              disabled={processing || (approvalDialog.action === 'return' && !returnComments.trim())}
              className={approvalDialog.action === 'approve'
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-orange-500 hover:bg-orange-600 text-white'}
            >
              {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {approvalDialog.action === 'approve' ? 'Έγκριση' : 'Επιστροφή'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Notify dialog */}
      <Dialog open={notifyDialog.open} onOpenChange={(open) => {
        if (!open) setNotifyDialog({ open: false, decisionId: null });
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Κοινοποίηση Απόφασης</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-[#6b6560]">
              Επιλέξτε τρόπο κοινοποίησης. Θα υπολογιστούν αυτόματα οι προθεσμίες πληρωμής και ένστασης.
            </p>
            <Select value={notifyMethod} onValueChange={setNotifyMethod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="personal_service">Επίδοση (αυτοπροσώπως)</SelectItem>
                <SelectItem value="registered_mail">Συστημένη επιστολή</SelectItem>
                <SelectItem value="email">Ηλεκτρονικό ταχυδρομείο</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotifyDialog({ open: false, decisionId: null })}>
              Ακύρωση
            </Button>
            <Button
              onClick={handleNotify}
              disabled={processing}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Κοινοποίηση
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment dialog */}
      <Dialog open={paymentDialog.open} onOpenChange={(open) => {
        if (!open) setPaymentDialog({ open: false, decisionId: null });
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ενημέρωση Κατάστασης Πληρωμής</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={paymentAction} onValueChange={setPaymentAction}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="paid">Εξοφλήθηκε</SelectItem>
                <SelectItem value="appealed">Υποβλήθηκε ένσταση</SelectItem>
                <SelectItem value="cancelled">Ακυρώθηκε</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialog({ open: false, decisionId: null })}>
              Ακύρωση
            </Button>
            <Button
              onClick={handlePayment}
              disabled={processing}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Καταχώρηση
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
