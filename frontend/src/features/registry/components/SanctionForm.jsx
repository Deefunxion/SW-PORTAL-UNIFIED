import { useState } from 'react';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog.jsx';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select.jsx';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { structuresApi } from '../lib/registryApi';
import { SANCTION_TYPES } from '../lib/constants';

export default function SanctionForm({ open, onOpenChange, structureId, onCreated }) {
  const [type, setType] = useState('');
  const [amount, setAmount] = useState('');
  const [imposedDate, setImposedDate] = useState('');
  const [protocolNumber, setProtocolNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setType(''); setAmount(''); setImposedDate('');
    setProtocolNumber(''); setNotes('');
  };

  const handleCreate = async () => {
    if (!type) { toast.error('Επιλέξτε τύπο κύρωσης.'); return; }
    setSaving(true);
    try {
      await structuresApi.createSanction(structureId, {
        type,
        amount: amount ? parseFloat(amount) : null,
        imposed_date: imposedDate || null,
        protocol_number: protocolNumber || null,
        notes: notes || null,
      });
      toast.success('Η κύρωση καταχωρήθηκε.');
      onCreated();
      onOpenChange(false);
      resetForm();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Σφάλμα δημιουργίας κύρωσης.');
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Νέα Κύρωση</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <label className="text-sm font-medium text-[#2a2520]">Τύπος *</label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="mt-1 min-h-[44px] border-[#e8e2d8]">
                <SelectValue placeholder="Επιλέξτε τύπο" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SANCTION_TYPES).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-[#2a2520]">Ποσό (€)</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="π.χ. 5000"
                className="mt-1 min-h-[44px] border-[#e8e2d8]"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-[#2a2520]">Ημ. Επιβολής</label>
              <Input
                type="date"
                value={imposedDate}
                onChange={(e) => setImposedDate(e.target.value)}
                className="mt-1 min-h-[44px] border-[#e8e2d8]"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-[#2a2520]">Αρ. Πρωτοκόλλου</label>
            <Input
              value={protocolNumber}
              onChange={(e) => setProtocolNumber(e.target.value)}
              className="mt-1 min-h-[44px] border-[#e8e2d8]"
            />
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
          <Button onClick={handleCreate} disabled={saving}
            className="bg-[#1a3aa3] hover:bg-[#152e82] text-white">
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Καταχώρηση
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
