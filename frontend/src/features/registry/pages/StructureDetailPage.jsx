import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table.jsx';
import {
  ArrowLeft, Edit, Building2, FileText, Shield, Scale, Clock,
  User, Phone, Mail, MapPin, AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { structuresApi, inspectionsApi } from '../lib/registryApi';
import {
  STRUCTURE_STATUS, OWNERSHIP_TYPES, LICENSE_STATUS, SANCTION_STATUS,
  SANCTION_TYPES, INSPECTION_STATUS, INSPECTION_TYPES, INSPECTION_CONCLUSIONS,
  ADVISOR_REPORT_TYPES, REPORT_STATUS,
} from '../lib/constants';
import LicenseBadge from '../components/LicenseBadge';

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
    </div>
  );
}

// ---- Tab: Αδειοδότηση ----
function LicensesTab({ structureId }) {
  const [licenses, setLicenses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    structuresApi.licenses(structureId)
      .then(({ data }) => setLicenses(data))
      .catch(() => toast.error('Σφάλμα φόρτωσης αδειών'))
      .finally(() => setLoading(false));
  }, [structureId]);

  if (loading) return <LoadingSpinner />;

  if (licenses.length === 0) {
    return <EmptyState message="Δεν υπάρχουν καταγεγραμμένες άδειες." />;
  }

  return (
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
  );
}

// ---- Tab: Έλεγχοι ----
function InspectionsTab({ structureId }) {
  const [inspections, setInspections] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    inspectionsApi.list({ structure_id: structureId })
      .then(({ data }) => setInspections(data.inspections || []))
      .catch(() => toast.error('Σφάλμα φόρτωσης ελέγχων'))
      .finally(() => setLoading(false));
  }, [structureId]);

  if (loading) return <LoadingSpinner />;

  if (inspections.length === 0) {
    return <EmptyState message="Δεν υπάρχουν καταγεγραμμένοι έλεγχοι." />;
  }

  return (
    <div className="rounded-xl border border-[#e8e2d8] overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-[#f5f2ec] hover:bg-[#f5f2ec]">
            <TableHead>Τύπος</TableHead>
            <TableHead>Ημ. Ελέγχου</TableHead>
            <TableHead>Κατάσταση</TableHead>
            <TableHead>Συμπέρασμα</TableHead>
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
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ---- Tab: Εκθέσεις ----
function ReportsTab({ structureId }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    structuresApi.advisorReports(structureId)
      .then(({ data }) => setReports(data))
      .catch(() => toast.error('Σφάλμα φόρτωσης εκθέσεων'))
      .finally(() => setLoading(false));
  }, [structureId]);

  if (loading) return <LoadingSpinner />;

  if (reports.length === 0) {
    return <EmptyState message="Δεν υπάρχουν εκθέσεις κοινωνικού συμβούλου." />;
  }

  return (
    <div className="rounded-xl border border-[#e8e2d8] overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-[#f5f2ec] hover:bg-[#f5f2ec]">
            <TableHead>Τύπος</TableHead>
            <TableHead>Ημερομηνία</TableHead>
            <TableHead>Κατάσταση</TableHead>
            <TableHead>Αξιολόγηση</TableHead>
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
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ---- Tab: Κυρώσεις ----
function SanctionsTab({ structureId }) {
  const [sanctions, setSanctions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    structuresApi.sanctions(structureId)
      .then(({ data }) => setSanctions(data))
      .catch(() => toast.error('Σφάλμα φόρτωσης κυρώσεων'))
      .finally(() => setLoading(false));
  }, [structureId]);

  if (loading) return <LoadingSpinner />;

  if (sanctions.length === 0) {
    return <EmptyState message="Δεν υπάρχουν καταγεγραμμένες κυρώσεις." />;
  }

  return (
    <div className="rounded-xl border border-[#e8e2d8] overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-[#f5f2ec] hover:bg-[#f5f2ec]">
            <TableHead>Τύπος</TableHead>
            <TableHead>Ποσό</TableHead>
            <TableHead>Ημ. Επιβολής</TableHead>
            <TableHead>Κατάσταση</TableHead>
            <TableHead>Αρ. Πρωτοκόλλου</TableHead>
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
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ---- Tab: Timeline (placeholder) ----
function TimelineTab() {
  return (
    <div className="text-center py-16">
      <Clock className="w-12 h-12 text-[#b0a99e] mx-auto mb-4" />
      <p className="text-[#8a8580] text-lg">Χρονολόγιο</p>
      <p className="text-[#b0a99e] text-sm mt-1">
        Η ενοποιημένη χρονολογική προβολή θα υλοποιηθεί στη Φάση 3.
      </p>
    </div>
  );
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
            Εκθέσεις
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
            <TimelineTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
