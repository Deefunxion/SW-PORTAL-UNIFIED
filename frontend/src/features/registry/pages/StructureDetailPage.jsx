import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table.jsx';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select.jsx';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import {
  ArrowLeft, Edit, Building2, FileText, Shield, Scale, Clock,
  User, Phone, Mail, MapPin, Plus, Loader2, Send, CheckCircle, RotateCcw,
  ExternalLink, Download
} from 'lucide-react';
import { toast } from 'sonner';
import { structuresApi, inspectionsApi, committeesApi, oversightApi } from '../lib/registryApi';
import {
  STRUCTURE_STATUS, OWNERSHIP_TYPES, LICENSE_STATUS, SANCTION_STATUS,
  SANCTION_TYPES, INSPECTION_STATUS, INSPECTION_TYPES, INSPECTION_CONCLUSIONS,
  ADVISOR_REPORT_TYPES, REPORT_STATUS,
} from '../lib/constants';
import LicenseBadge from '../components/LicenseBadge';
import SanctionForm from '../components/SanctionForm';
import StructureTimeline from '../components/StructureTimeline';
import LegislationPanel from '../components/LegislationPanel';

function InfoRow({ label, value, icon: Icon }) {
  return (
    <div className="flex items-start gap-3 py-2">
      {Icon && <Icon className="w-4 h-4 text-[#8a8580] mt-0.5 shrink-0" />}
      <div>
        <dt className="text-xs text-[#8a8580] uppercase tracking-wide">{label}</dt>
        <dd className="text-[#2a2520] mt-0.5">{value || '—'}</dd>
      </div>
    </div>
  );
}

function StatusBadge({ status, map }) {
  const info = map[status] || { label: status, color: 'gray' };
  const colorClasses = {
    green: 'bg-green-100 text-green-800 border-green-200',
    orange: 'bg-orange-100 text-orange-800 border-orange-200',
    red: 'bg-red-100 text-red-800 border-red-200',
    blue: 'bg-blue-100 text-blue-800 border-blue-200',
    gray: 'bg-gray-100 text-gray-800 border-gray-200',
  };
  return (
    <Badge variant="outline" className={colorClasses[info.color] || colorClasses.gray}>
      {info.label}
    </Badge>
  );
}

// ---- Tab: Στοιχεία ----
function InfoTab({ structure }) {
  const s = structure;
  const statusInfo = STRUCTURE_STATUS[s.status] || { label: s.status, color: 'gray' };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card className="border-[#e8e2d8]">
        <CardHeader>
          <CardTitle className="text-lg text-[#2a2520]">Βασικά στοιχεία</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <InfoRow label="Κωδικός" value={s.code} icon={Building2} />
          <InfoRow label="Τύπος" value={s.type?.name} icon={FileText} />
          <InfoRow label="Κατάσταση" value={statusInfo.label} icon={Shield} />
          <InfoRow label="Ιδιοκτησία" value={OWNERSHIP_TYPES[s.ownership] || s.ownership} />
          <InfoRow label="Δυναμικότητα" value={s.capacity} />
          <InfoRow label="Περιφερειακή Ενότητα" value={s.peripheral_unit} icon={MapPin} />
          <InfoRow label="Αρ. Αδείας" value={s.license_number} />
        </CardContent>
      </Card>

      <Card className="border-[#e8e2d8]">
        <CardHeader>
          <CardTitle className="text-lg text-[#2a2520]">Νόμιμος Εκπρόσωπος</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <InfoRow label="Ονοματεπώνυμο" value={s.representative_name} icon={User} />
          <InfoRow label="ΑΦΜ" value={s.representative_afm} />
          <InfoRow label="Τηλέφωνο" value={s.representative_phone} icon={Phone} />
          <InfoRow label="Email" value={s.representative_email} icon={Mail} />
        </CardContent>
      </Card>

      <Card className="border-[#e8e2d8]">
        <CardHeader>
          <CardTitle className="text-lg text-[#2a2520]">Διεύθυνση</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <InfoRow label="Οδός" value={s.street} icon={MapPin} />
          <InfoRow label="Πόλη" value={s.city} />
          <InfoRow label="Τ.Κ." value={s.postal_code} />
        </CardContent>
      </Card>

      <Card className="border-[#e8e2d8]">
        <CardHeader>
          <CardTitle className="text-lg text-[#2a2520]">Κοινωνικός Σύμβουλος</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <InfoRow
            label="Σύμβουλος"
            value={s.advisor?.full_name || s.advisor?.username || '—'}
            icon={User}
          />
          {s.notes && <InfoRow label="Σημειώσεις" value={s.notes} />}
        </CardContent>
      </Card>

      {/* Legislation auto-tags from knowledge base */}
      <div className="md:col-span-2">
        <LegislationPanel structureTypeCode={s.type?.code} />
      </div>

      {/* Forum link for this structure type */}
      {s.type?.code && (
        <div className="md:col-span-2">
          <Card className="border-[#e8e2d8]">
            <CardContent className="py-4">
              <Link
                to={`/forum?category=${encodeURIComponent('Εποπτεία ' + (s.type?.code || ''))}`}
                className="inline-flex items-center gap-2 text-[#1a3aa3] hover:text-[#152e82] text-sm font-medium transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Συζήτηση στο Forum — Εποπτεία {s.type?.code}
              </Link>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// ---- Tab: Αδειοδότηση ----
function LicensesTab({ structureId }) {
  const [licenses, setLicenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const fetchLicenses = useCallback(() => {
    setLoading(true);
    structuresApi.licenses(structureId)
      .then(({ data }) => setLicenses(data))
      .catch(() => toast.error('Σφάλμα φόρτωσης αδειών'))
      .finally(() => setLoading(false));
  }, [structureId]);

  useEffect(() => { fetchLicenses(); }, [fetchLicenses]);

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-[#8a8580]">{licenses.length} άδειες</p>
        <Button
          onClick={() => setShowCreate(true)}
          className="bg-[#1a3aa3] hover:bg-[#152e82] text-white min-h-[40px]"
          size="sm"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Νέα Άδεια
        </Button>
      </div>

      {licenses.length === 0 ? (
        <EmptyState message="Δεν υπάρχουν καταγεγραμμένες άδειες." />
      ) : (
        <div className="rounded-xl border border-[#e8e2d8] overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#f5f2ec] hover:bg-[#f5f2ec]">
                <TableHead>Τύπος</TableHead>
                <TableHead>Αρ. Πρωτοκόλλου</TableHead>
                <TableHead>Ημ. Έκδοσης</TableHead>
                <TableHead>Λήξη</TableHead>
                <TableHead>Κατάσταση</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {licenses.map((lic) => (
                <TableRow key={lic.id}>
                  <TableCell className="font-medium">{lic.type}</TableCell>
                  <TableCell className="font-mono text-sm">{lic.protocol_number || '—'}</TableCell>
                  <TableCell>{formatDate(lic.issued_date)}</TableCell>
                  <TableCell><LicenseBadge expiryDate={lic.expiry_date} /></TableCell>
                  <TableCell><StatusBadge status={lic.status} map={LICENSE_STATUS} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CreateLicenseDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        structureId={structureId}
        onCreated={fetchLicenses}
      />
    </div>
  );
}

function CreateLicenseDialog({ open, onOpenChange, structureId, onCreated }) {
  const [type, setType] = useState('');
  const [protocolNumber, setProtocolNumber] = useState('');
  const [issuedDate, setIssuedDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [status, setStatus] = useState('active');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!type) { toast.error('Επιλέξτε τύπο αδείας.'); return; }
    setSaving(true);
    try {
      await structuresApi.createLicense(structureId, {
        type,
        protocol_number: protocolNumber || null,
        issued_date: issuedDate || null,
        expiry_date: expiryDate || null,
        status,
        notes: notes || null,
      });
      toast.success('Η άδεια δημιουργήθηκε.');
      onCreated();
      onOpenChange(false);
      setType(''); setProtocolNumber(''); setIssuedDate(''); setExpiryDate('');
      setStatus('active'); setNotes('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Σφάλμα δημιουργίας αδείας.');
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Νέα Άδεια</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <label className="text-sm font-medium text-[#2a2520]">Τύπος *</label>
            <Input
              value={type}
              onChange={(e) => setType(e.target.value)}
              placeholder="π.χ. Άδεια Ίδρυσης, Άδεια Λειτουργίας"
              className="mt-1 min-h-[44px] border-[#e8e2d8]"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-[#2a2520]">Αρ. Πρωτοκόλλου</label>
            <Input
              value={protocolNumber}
              onChange={(e) => setProtocolNumber(e.target.value)}
              className="mt-1 min-h-[44px] border-[#e8e2d8]"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-[#2a2520]">Ημ. Έκδοσης</label>
              <Input type="date" value={issuedDate} onChange={(e) => setIssuedDate(e.target.value)}
                className="mt-1 min-h-[44px] border-[#e8e2d8]" />
            </div>
            <div>
              <label className="text-sm font-medium text-[#2a2520]">Ημ. Λήξης</label>
              <Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)}
                className="mt-1 min-h-[44px] border-[#e8e2d8]" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-[#2a2520]">Κατάσταση</label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="mt-1 min-h-[44px] border-[#e8e2d8]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(LICENSE_STATUS).map(([key, { label }]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium text-[#2a2520]">Σημειώσεις</label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Προαιρετικές σημειώσεις..."
              className="mt-1 min-h-[44px] border-[#e8e2d8]" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-[#e8e2d8]">
            Ακύρωση
          </Button>
          <Button onClick={handleCreate} disabled={saving}
            className="bg-[#1a3aa3] hover:bg-[#152e82] text-white">
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Δημιουργία
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- Tab: Έλεγχοι ----
function InspectionsTab({ structureId }) {
  const navigate = useNavigate();
  const [inspections, setInspections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [committees, setCommittees] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newInspection, setNewInspection] = useState({
    type: 'regular',
    committee_id: '',
    scheduled_date: new Date().toISOString().split('T')[0],
    notes: '',
  });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    inspectionsApi.list({ structure_id: structureId })
      .then(({ data }) => setInspections(data.inspections || []))
      .catch(() => toast.error('Σφάλμα φόρτωσης ελέγχων'))
      .finally(() => setLoading(false));
  }, [structureId]);

  useEffect(() => {
    committeesApi.list()
      .then(({ data }) => setCommittees(data))
      .catch(() => {});
  }, []);

  const handleCreateInspection = async () => {
    if (!newInspection.committee_id) {
      toast.error('Επιλέξτε επιτροπή ελέγχου.');
      return;
    }
    setCreating(true);
    try {
      const { data } = await inspectionsApi.create({
        structure_id: structureId,
        ...newInspection,
        committee_id: parseInt(newInspection.committee_id),
      });
      toast.success('Ο έλεγχος δημιουργήθηκε.');
      setShowCreate(false);
      navigate(`/inspections/${data.id}/report`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Σφάλμα δημιουργίας.');
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div className="flex justify-between items-center">
        <p className="text-sm text-[#8a8580]">{inspections.length} έλεγχοι</p>
        <Button
          onClick={() => setShowCreate(true)}
          className="bg-[#1a3aa3] hover:bg-[#152e82] text-white min-h-[44px]"
        >
          <Plus className="w-4 h-4 mr-2" />
          Νέος Έλεγχος
        </Button>
      </div>

      {/* Inspections table or empty state */}
      {inspections.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-[#e8e2d8] rounded-xl bg-[#faf8f4]">
          <Shield className="w-12 h-12 text-[#8a8580] mx-auto mb-4" />
          <p className="text-[#6b6560] mb-4">Δεν υπάρχουν καταγεγραμμένοι έλεγχοι.</p>
          <Button
            onClick={() => setShowCreate(true)}
            className="bg-[#1a3aa3] hover:bg-[#152e82] text-white min-h-[48px] px-6"
          >
            <Plus className="w-4 h-4 mr-2" />
            Δημιουργία Πρώτου Ελέγχου
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border border-[#e8e2d8] overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#f5f2ec] hover:bg-[#f5f2ec]">
                <TableHead>Τύπος</TableHead>
                <TableHead>Ημ. Ελέγχου</TableHead>
                <TableHead>Κατάσταση</TableHead>
                <TableHead>Συμπέρασμα</TableHead>
                <TableHead className="w-36">Έκθεση</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inspections.map((insp) => (
                <TableRow key={insp.id}>
                  <TableCell className="font-medium">
                    {INSPECTION_TYPES[insp.type] || insp.type}
                  </TableCell>
                  <TableCell>{formatDate(insp.scheduled_date)}</TableCell>
                  <TableCell><StatusBadge status={insp.status} map={INSPECTION_STATUS} /></TableCell>
                  <TableCell>
                    {insp.conclusion
                      ? <StatusBadge status={insp.conclusion} map={INSPECTION_CONCLUSIONS} />
                      : <span className="text-[#8a8580]">—</span>
                    }
                  </TableCell>
                  <TableCell>
                    {insp.report ? (
                      <Link
                        to={`/inspections/${insp.id}/report`}
                        className="inline-flex items-center text-[#1a3aa3] hover:text-[#152e82] text-sm transition-colors"
                      >
                        <FileText className="w-3 h-3 mr-1" />
                        Προβολή
                      </Link>
                    ) : insp.status === 'scheduled' ? (
                      <Link
                        to={`/inspections/${insp.id}/report`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1a3aa3] text-white text-sm rounded-md hover:bg-[#152e82] transition-colors font-medium"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        Σύνταξη Έκθεσης
                      </Link>
                    ) : (
                      <span className="text-[#8a8580] text-sm">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create Inspection Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Νέος Έλεγχος</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Τύπος Ελέγχου *</Label>
              <Select
                value={newInspection.type}
                onValueChange={(v) => setNewInspection(prev => ({ ...prev, type: v }))}
              >
                <SelectTrigger className="min-h-[44px] border-[#e8e2d8]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(INSPECTION_TYPES).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Επιτροπή Ελέγχου *</Label>
              <Select
                value={newInspection.committee_id}
                onValueChange={(v) => setNewInspection(prev => ({ ...prev, committee_id: v }))}
              >
                <SelectTrigger className="min-h-[44px] border-[#e8e2d8]">
                  <SelectValue placeholder="Επιλέξτε επιτροπή..." />
                </SelectTrigger>
                <SelectContent>
                  {committees.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.decision_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Ημερομηνία Ελέγχου *</Label>
              <Input
                type="date"
                value={newInspection.scheduled_date}
                onChange={(e) => setNewInspection(prev => ({ ...prev, scheduled_date: e.target.value }))}
                className="min-h-[44px] border-[#e8e2d8]"
              />
            </div>
            <div>
              <Label>Σημειώσεις</Label>
              <Textarea
                value={newInspection.notes}
                onChange={(e) => setNewInspection(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Προαιρετικές σημειώσεις..."
                className="min-h-[44px] border-[#e8e2d8]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)} className="border-[#e8e2d8]">
              Ακύρωση
            </Button>
            <Button
              onClick={handleCreateInspection}
              disabled={creating}
              className="bg-[#1a3aa3] hover:bg-[#152e82] text-white"
            >
              {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Δημιουργία & Σύνταξη Έκθεσης
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---- Tab: Αναφορές Κ.Σ. (Κοινωνικού Συμβούλου) ----
function ReportsTab({ structureId }) {
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  const fetchReports = useCallback(() => {
    setLoading(true);
    structuresApi.advisorReports(structureId)
      .then(({ data }) => setReports(data))
      .catch(() => toast.error('Σφάλμα φόρτωσης αναφορών'))
      .finally(() => setLoading(false));
  }, [structureId]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  const handleSubmit = async (reportId) => {
    setActionLoading(reportId);
    try {
      await oversightApi.updateAdvisorReport(reportId, { status: 'submitted' });
      toast.success('Η έκθεση υποβλήθηκε.');
      fetchReports();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Σφάλμα υποβολής.');
    } finally { setActionLoading(null); }
  };

  const handleApprove = async (reportId) => {
    setActionLoading(reportId);
    try {
      await oversightApi.approveReport(reportId, 'approve');
      toast.success('Η έκθεση εγκρίθηκε.');
      fetchReports();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Σφάλμα έγκρισης.');
    } finally { setActionLoading(null); }
  };

  const handleReturn = async (reportId) => {
    setActionLoading(reportId);
    try {
      await oversightApi.approveReport(reportId, 'return');
      toast.success('Η έκθεση επιστράφηκε.');
      fetchReports();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Σφάλμα επιστροφής.');
    } finally { setActionLoading(null); }
  };

  const handleIridaExport = async (reportId) => {
    try {
      const response = await oversightApi.iridaExport('advisor_report', reportId);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `irida_advisor_report_${reportId}.zip`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Αρχείο Ίριδα εξήχθη.');
    } catch {
      toast.error('Σφάλμα εξαγωγής Ίριδα.');
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          onClick={() => navigate(`/registry/${structureId}/advisor-report`)}
          className="bg-[#1a3aa3] hover:bg-[#152e82] text-white min-h-[44px]"
        >
          <Plus className="w-4 h-4 mr-2" />
          Νέα Αναφορά Κ.Σ.
        </Button>
      </div>

      {reports.length === 0 ? (
        <EmptyState message="Δεν υπάρχουν αναφορές Κοινωνικού Συμβούλου." />
      ) : (
      <div className="rounded-xl border border-[#e8e2d8] overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-[#f5f2ec] hover:bg-[#f5f2ec]">
            <TableHead>Τύπος</TableHead>
            <TableHead>Ημερομηνία</TableHead>
            <TableHead>Κατάσταση</TableHead>
            <TableHead>Αξιολόγηση</TableHead>
            <TableHead className="w-40">Ενέργειες</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reports.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-medium">
                {ADVISOR_REPORT_TYPES[r.type] || r.type}
              </TableCell>
              <TableCell>{formatDate(r.drafted_date)}</TableCell>
              <TableCell><StatusBadge status={r.status} map={REPORT_STATUS} /></TableCell>
              <TableCell className="max-w-xs truncate text-[#6b6560]">
                {r.assessment || '—'}
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  {r.status === 'draft' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSubmit(r.id)}
                      disabled={actionLoading === r.id}
                      className="h-7 text-xs border-blue-200 text-blue-700 hover:bg-blue-50"
                    >
                      {actionLoading === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3 mr-1" />}
                      Υποβολή
                    </Button>
                  )}
                  {r.status === 'submitted' && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleApprove(r.id)}
                        disabled={actionLoading === r.id}
                        className="h-7 text-xs border-green-200 text-green-700 hover:bg-green-50"
                      >
                        {actionLoading === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3 mr-1" />}
                        Έγκριση
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReturn(r.id)}
                        disabled={actionLoading === r.id}
                        className="h-7 text-xs border-orange-200 text-orange-700 hover:bg-orange-50"
                      >
                        <RotateCcw className="w-3 h-3 mr-1" />
                        Επιστροφή
                      </Button>
                    </>
                  )}
                  {r.status === 'approved' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleIridaExport(r.id)}
                      className="h-7 text-xs border-purple-200 text-purple-700 hover:bg-purple-50"
                      title="Εξαγωγή για Ίριδα"
                    >
                      <Download className="w-3 h-3 mr-1" />
                      Ίριδα
                    </Button>
                  )}
                  {r.status === 'returned' && (
                    <span className="text-xs text-[#8a8580]">—</span>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
      )}
    </div>
  );
}

// ---- Tab: Κυρώσεις ----
function SanctionsTab({ structureId }) {
  const [sanctions, setSanctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  const fetchSanctions = useCallback(() => {
    setLoading(true);
    structuresApi.sanctions(structureId)
      .then(({ data }) => setSanctions(data))
      .catch(() => toast.error('Σφάλμα φόρτωσης κυρώσεων'))
      .finally(() => setLoading(false));
  }, [structureId]);

  useEffect(() => { fetchSanctions(); }, [fetchSanctions]);

  const handleStatusChange = async (sanctionId, newStatus) => {
    setActionLoading(sanctionId);
    try {
      await structuresApi.updateSanction(sanctionId, { status: newStatus });
      const statusLabels = { paid: 'εξοφληθείσα', appealed: 'σε ένσταση', cancelled: 'ακυρωθείσα' };
      toast.success(`Η κύρωση ενημερώθηκε σε ${statusLabels[newStatus] || newStatus}.`);
      fetchSanctions();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Σφάλμα ενημέρωσης κύρωσης.');
    } finally { setActionLoading(null); }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-[#8a8580]">{sanctions.length} κυρώσεις</p>
        <div className="flex gap-2">
          <Link to={`/sanctions?structure=${structureId}`}>
            <Button variant="outline" className="border-[#e8e2d8] min-h-[40px]" size="sm">
              <Scale className="w-4 h-4 mr-1.5" />
              Υπολογισμός Προστίμου
            </Button>
          </Link>
          <Button
            onClick={() => setShowCreate(true)}
            className="bg-[#1a3aa3] hover:bg-[#152e82] text-white min-h-[40px]"
            size="sm"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Νέα Κύρωση
          </Button>
        </div>
      </div>

      {sanctions.length === 0 ? (
        <EmptyState message="Δεν υπάρχουν καταγεγραμμένες κυρώσεις." />
      ) : (
        <div className="rounded-xl border border-[#e8e2d8] overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#f5f2ec] hover:bg-[#f5f2ec]">
                <TableHead>Τύπος</TableHead>
                <TableHead>Ποσό</TableHead>
                <TableHead>Ημ. Επιβολής</TableHead>
                <TableHead>Κατάσταση</TableHead>
                <TableHead>Αρ. Πρωτοκόλλου</TableHead>
                <TableHead className="w-44">Ενέργειες</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sanctions.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">
                    {SANCTION_TYPES[s.type] || s.type}
                  </TableCell>
                  <TableCell>
                    {s.amount ? `${s.amount.toLocaleString('el-GR')} €` : '—'}
                  </TableCell>
                  <TableCell>{formatDate(s.imposed_date)}</TableCell>
                  <TableCell><StatusBadge status={s.status} map={SANCTION_STATUS} /></TableCell>
                  <TableCell className="font-mono text-sm">{s.protocol_number || '—'}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {s.status === 'imposed' && (
                        <>
                          <Button
                            size="sm" variant="outline"
                            onClick={() => handleStatusChange(s.id, 'paid')}
                            disabled={actionLoading === s.id}
                            className="h-7 text-xs border-green-200 text-green-700 hover:bg-green-50"
                          >
                            {actionLoading === s.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3 mr-1" />}
                            Εξόφληση
                          </Button>
                          <Button
                            size="sm" variant="outline"
                            onClick={() => handleStatusChange(s.id, 'appealed')}
                            disabled={actionLoading === s.id}
                            className="h-7 text-xs border-orange-200 text-orange-700 hover:bg-orange-50"
                          >
                            Ένσταση
                          </Button>
                        </>
                      )}
                      {s.status === 'appealed' && (
                        <>
                          <Button
                            size="sm" variant="outline"
                            onClick={() => handleStatusChange(s.id, 'cancelled')}
                            disabled={actionLoading === s.id}
                            className="h-7 text-xs border-gray-200 text-gray-700 hover:bg-gray-50"
                          >
                            Ακύρωση
                          </Button>
                          <Button
                            size="sm" variant="outline"
                            onClick={() => handleStatusChange(s.id, 'imposed')}
                            disabled={actionLoading === s.id}
                            className="h-7 text-xs border-red-200 text-red-700 hover:bg-red-50"
                          >
                            Επιβολή
                          </Button>
                        </>
                      )}
                      {(s.status === 'paid' || s.status === 'cancelled') && (
                        <span className="text-xs text-[#8a8580]">—</span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <SanctionForm
        open={showCreate}
        onOpenChange={setShowCreate}
        structureId={structureId}
        onCreated={fetchSanctions}
      />
    </div>
  );
}

// ---- Tab: Timeline ----
function TimelineTab({ structureId }) {
  return <StructureTimeline structureId={structureId} />;
}

// ---- Helpers ----
function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('el-GR');
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1a3aa3]" />
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div className="text-center py-12">
      <p className="text-[#8a8580]">{message}</p>
    </div>
  );
}

// ---- Main Page ----
export default function StructureDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [structure, setStructure] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    structuresApi.get(id)
      .then(({ data }) => setStructure(data))
      .catch(() => {
        toast.error('Η δομή δεν βρέθηκε.');
        navigate('/registry');
      })
      .finally(() => setIsLoading(false));
  }, [id, navigate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1a3aa3]" />
      </div>
    );
  }

  if (!structure) return null;

  const statusInfo = STRUCTURE_STATUS[structure.status] || { label: structure.status, color: 'gray' };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/registry"
          className="inline-flex items-center text-[#1a3aa3] hover:text-[#152e82] text-sm mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Επιστροφή στο Μητρώο
        </Link>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-[#2a2520]" style={{ fontFamily: "'Literata', serif" }}>
                {structure.name}
              </h1>
              <StatusBadge status={structure.status} map={STRUCTURE_STATUS} />
            </div>
            <p className="text-[#6b6560] mt-1">
              {structure.code} — {structure.type?.name || 'Άγνωστος τύπος'}
              {structure.city && ` — ${structure.city}`}
            </p>
          </div>
          <Link to={`/registry/${id}/edit`}>
            <Button variant="outline" className="border-[#e8e2d8] min-h-[44px]">
              <Edit className="w-4 h-4 mr-2" />
              Επεξεργασία
            </Button>
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="info">
        <TabsList className="w-full justify-start bg-[#f5f2ec] p-1 rounded-lg flex-wrap h-auto gap-1">
          <TabsTrigger value="info" className="data-[state=active]:bg-white">
            <Building2 className="w-4 h-4 mr-1.5" />
            Στοιχεία
          </TabsTrigger>
          <TabsTrigger value="licenses" className="data-[state=active]:bg-white">
            <FileText className="w-4 h-4 mr-1.5" />
            Αδειοδότηση
          </TabsTrigger>
          <TabsTrigger value="inspections" className="data-[state=active]:bg-white">
            <Shield className="w-4 h-4 mr-1.5" />
            Έλεγχοι
          </TabsTrigger>
          <TabsTrigger value="reports" className="data-[state=active]:bg-white">
            <FileText className="w-4 h-4 mr-1.5" />
            Αναφορές Κ.Σ.
          </TabsTrigger>
          <TabsTrigger value="sanctions" className="data-[state=active]:bg-white">
            <Scale className="w-4 h-4 mr-1.5" />
            Κυρώσεις
          </TabsTrigger>
          <TabsTrigger value="timeline" className="data-[state=active]:bg-white">
            <Clock className="w-4 h-4 mr-1.5" />
            Timeline
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="info">
            <InfoTab structure={structure} />
          </TabsContent>
          <TabsContent value="licenses">
            <LicensesTab structureId={structure.id} />
          </TabsContent>
          <TabsContent value="inspections">
            <InspectionsTab structureId={structure.id} />
          </TabsContent>
          <TabsContent value="reports">
            <ReportsTab structureId={structure.id} />
          </TabsContent>
          <TabsContent value="sanctions">
            <SanctionsTab structureId={structure.id} />
          </TabsContent>
          <TabsContent value="timeline">
            <TimelineTab structureId={structure.id} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
