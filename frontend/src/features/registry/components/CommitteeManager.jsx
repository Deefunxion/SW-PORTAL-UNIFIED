import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Input } from '@/components/ui/input.jsx';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select.jsx';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog.jsx';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table.jsx';
import {
  Plus, Users, Trash2, UserPlus, Building2, Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { committeesApi } from '../lib/registryApi';
import { COMMITTEE_ROLES } from '../lib/constants';

// ---- Create Committee Dialog ----
function CreateCommitteeDialog({ open, onOpenChange, onCreated }) {
  const [decisionNumber, setDecisionNumber] = useState('');
  const [appointedDate, setAppointedDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!decisionNumber || !appointedDate) {
      toast.error('Αρ. Απόφασης και Ημ. Ορισμού είναι υποχρεωτικά.');
      return;
    }
    setSaving(true);
    try {
      await committeesApi.create({
        decision_number: decisionNumber,
        appointed_date: appointedDate,
        expiry_date: expiryDate || null,
        notes: notes || null,
      });
      toast.success('Η επιτροπή δημιουργήθηκε.');
      onCreated();
      onOpenChange(false);
      setDecisionNumber(''); setAppointedDate(''); setExpiryDate(''); setNotes('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Σφάλμα δημιουργίας.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Νέα Επιτροπή Ελέγχου</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <label className="text-sm font-medium text-[#2a2520]">Αρ. Απόφασης *</label>
            <Input
              value={decisionNumber}
              onChange={(e) => setDecisionNumber(e.target.value)}
              placeholder="π.χ. ΑΠ-2026/123"
              className="mt-1 min-h-[44px] border-[#e8e2d8]"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-[#2a2520]">Ημ. Ορισμού *</label>
              <Input
                type="date"
                value={appointedDate}
                onChange={(e) => setAppointedDate(e.target.value)}
                className="mt-1 min-h-[44px] border-[#e8e2d8]"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-[#2a2520]">Λήξη Θητείας</label>
              <Input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="mt-1 min-h-[44px] border-[#e8e2d8]"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-[#2a2520]">Σημειώσεις</label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Προαιρετικές σημειώσεις..."
              className="mt-1 min-h-[44px] border-[#e8e2d8]"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-[#e8e2d8]">
            Ακύρωση
          </Button>
          <Button
            onClick={handleCreate}
            disabled={saving}
            className="bg-[#1a3aa3] hover:bg-[#152e82] text-white"
          >
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Δημιουργία
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- Add Member Dialog ----
function AddMemberDialog({ open, onOpenChange, committeeId, onAdded }) {
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState('member');
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!userId) {
      toast.error('Εισάγετε ID χρήστη.');
      return;
    }
    setSaving(true);
    try {
      await committeesApi.addMember(committeeId, {
        user_id: parseInt(userId, 10),
        role,
      });
      toast.success('Το μέλος προστέθηκε.');
      onAdded();
      onOpenChange(false);
      setUserId(''); setRole('member');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Σφάλμα προσθήκης μέλους.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Προσθήκη Μέλους</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <label className="text-sm font-medium text-[#2a2520]">ID Χρήστη *</label>
            <Input
              type="number"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="π.χ. 2"
              className="mt-1 min-h-[44px] border-[#e8e2d8]"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-[#2a2520]">Ρόλος</label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="mt-1 min-h-[44px] border-[#e8e2d8]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(COMMITTEE_ROLES).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-[#e8e2d8]">
            Ακύρωση
          </Button>
          <Button
            onClick={handleAdd}
            disabled={saving}
            className="bg-[#1a3aa3] hover:bg-[#152e82] text-white"
          >
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Προσθήκη
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- Assign Structure Dialog ----
function AssignStructureDialog({ open, onOpenChange, committeeId, onAssigned }) {
  const [structureId, setStructureId] = useState('');
  const [saving, setSaving] = useState(false);

  const handleAssign = async () => {
    if (!structureId) {
      toast.error('Εισάγετε ID δομής.');
      return;
    }
    setSaving(true);
    try {
      await committeesApi.assignStructure(committeeId, {
        structure_id: parseInt(structureId, 10),
      });
      toast.success('Η δομή ανατέθηκε.');
      onAssigned();
      onOpenChange(false);
      setStructureId('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Σφάλμα ανάθεσης.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ανάθεση Δομής</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <label className="text-sm font-medium text-[#2a2520]">ID Δομής *</label>
            <Input
              type="number"
              value={structureId}
              onChange={(e) => setStructureId(e.target.value)}
              placeholder="π.χ. 1"
              className="mt-1 min-h-[44px] border-[#e8e2d8]"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-[#e8e2d8]">
            Ακύρωση
          </Button>
          <Button
            onClick={handleAssign}
            disabled={saving}
            className="bg-[#1a3aa3] hover:bg-[#152e82] text-white"
          >
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Ανάθεση
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- Committee Detail Card ----
function CommitteeDetail({ committee, onRefresh }) {
  const [showAddMember, setShowAddMember] = useState(false);
  const [showAssignStructure, setShowAssignStructure] = useState(false);
  const [removing, setRemoving] = useState(null);

  const handleRemoveMember = async (userId) => {
    setRemoving(userId);
    try {
      await committeesApi.removeMember(committee.id, userId);
      toast.success('Το μέλος αφαιρέθηκε.');
      onRefresh();
    } catch (err) {
      toast.error('Σφάλμα αφαίρεσης μέλους.');
    } finally {
      setRemoving(null);
    }
  };

  const isActive = committee.status === 'active';

  return (
    <Card className="border-[#e8e2d8]">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg text-[#2a2520] flex items-center gap-2">
              <Users className="w-5 h-5 text-[#1a3aa3]" />
              {committee.decision_number}
            </CardTitle>
            <p className="text-sm text-[#8a8580] mt-1">
              Ορισμός: {committee.appointed_date ? new Date(committee.appointed_date).toLocaleDateString('el-GR') : '—'}
              {committee.expiry_date && ` — Λήξη: ${new Date(committee.expiry_date).toLocaleDateString('el-GR')}`}
            </p>
          </div>
          <Badge variant="outline" className={
            isActive
              ? 'bg-green-100 text-green-800 border-green-200'
              : 'bg-gray-100 text-gray-800 border-gray-200'
          }>
            {isActive ? 'Ενεργή' : 'Ανενεργή'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Members */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <h4 className="text-sm font-semibold text-[#2a2520]">Μέλη ({committee.members?.length || 0})</h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAddMember(true)}
              className="text-[#1a3aa3] hover:text-[#152e82]"
            >
              <UserPlus className="w-4 h-4 mr-1" />
              Προσθήκη
            </Button>
          </div>
          {committee.members?.length > 0 ? (
            <div className="rounded-lg border border-[#e8e2d8] overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#f5f2ec] hover:bg-[#f5f2ec]">
                    <TableHead className="text-xs">Χρήστης</TableHead>
                    <TableHead className="text-xs">Ρόλος</TableHead>
                    <TableHead className="text-xs w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {committee.members.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="text-sm">
                        {m.user?.full_name || m.user?.username || `#${m.user_id}`}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {COMMITTEE_ROLES[m.role] || m.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveMember(m.user_id)}
                          disabled={removing === m.user_id}
                          className="text-[#8a8580] hover:text-red-600 h-8 w-8 p-0"
                        >
                          {removing === m.user_id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Trash2 className="w-3 h-3" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-[#8a8580]">Δεν έχουν οριστεί μέλη.</p>
          )}
        </div>

        {/* Assigned Structures */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <h4 className="text-sm font-semibold text-[#2a2520]">
              Δομές ({committee.structures?.length || 0})
            </h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAssignStructure(true)}
              className="text-[#1a3aa3] hover:text-[#152e82]"
            >
              <Building2 className="w-4 h-4 mr-1" />
              Ανάθεση
            </Button>
          </div>
          {committee.structures?.length > 0 ? (
            <div className="space-y-1">
              {committee.structures.map((a) => (
                <div key={a.id} className="flex items-center gap-2 text-sm p-2 bg-[#f5f2ec] rounded">
                  <Building2 className="w-3 h-3 text-[#8a8580]" />
                  <span className="text-[#2a2520]">
                    {a.structure?.name || `Δομή #${a.structure_id}`}
                  </span>
                  <span className="text-[#8a8580] text-xs">
                    ({a.assigned_date ? new Date(a.assigned_date).toLocaleDateString('el-GR') : '—'})
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[#8a8580]">Δεν έχουν ανατεθεί δομές.</p>
          )}
        </div>

        {committee.notes && (
          <p className="text-sm text-[#6b6560] italic">{committee.notes}</p>
        )}
      </CardContent>

      <AddMemberDialog
        open={showAddMember}
        onOpenChange={setShowAddMember}
        committeeId={committee.id}
        onAdded={onRefresh}
      />
      <AssignStructureDialog
        open={showAssignStructure}
        onOpenChange={setShowAssignStructure}
        committeeId={committee.id}
        onAssigned={onRefresh}
      />
    </Card>
  );
}

// ---- Main Component ----
export default function CommitteeManager({ committees, isLoading, onRefresh }) {
  const [showCreate, setShowCreate] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1a3aa3]" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <p className="text-[#6b6560]">{committees.length} επιτροπές</p>
        <Button
          onClick={() => setShowCreate(true)}
          className="bg-[#1a3aa3] hover:bg-[#152e82] text-white min-h-[44px]"
        >
          <Plus className="w-4 h-4 mr-2" />
          Νέα Επιτροπή
        </Button>
      </div>

      {committees.length === 0 ? (
        <div className="text-center py-16">
          <Users className="w-12 h-12 text-[#b0a99e] mx-auto mb-4" />
          <p className="text-[#8a8580] text-lg">Δεν υπάρχουν επιτροπές.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {committees.map((c) => (
            <CommitteeDetail key={c.id} committee={c} onRefresh={onRefresh} />
          ))}
        </div>
      )}

      <CreateCommitteeDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onCreated={onRefresh}
      />
    </div>
  );
}
