import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import {
  Send, Loader2, CheckCircle, AlertCircle, Link2
} from 'lucide-react';
import { toast } from 'sonner';
import { oversightApi, iridaApi } from '../lib/registryApi';

export default function IridaSendSection({ report, structureName }) {
  const [roots, setRoots] = useState([]);
  const [selectedRecipient, setSelectedRecipient] = useState('');
  const [subject, setSubject] = useState('');
  const [sending, setSending] = useState(false);
  const [transaction, setTransaction] = useState(null);
  const [iridaConfigured, setIridaConfigured] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        const { data: profile } = await iridaApi.profileStatus();
        setIridaConfigured(profile.configured);

        if (profile.configured) {
          const { data: orgs } = await iridaApi.roots();
          const items = Array.isArray(orgs) ? orgs : (orgs.data || []);
          setRoots(items);
        }
      } catch {
        setIridaConfigured(false);
      } finally {
        setLoading(false);
      }
    };
    init();

    setSubject(
      `Αναφορά Κοιν. Συμβούλου — ${structureName || 'Δομή'}`
    );
  }, [structureName]);

  const handleSend = async () => {
    if (!selectedRecipient) {
      toast.error('Επιλέξτε αποδέκτη.');
      return;
    }
    setSending(true);
    try {
      const { data } = await oversightApi.sendToIrida(report.id, {
        recipients: [selectedRecipient],
        subject,
      });
      setTransaction(data.transaction);
      toast.success(data.message || 'Η αναφορά στάλθηκε στο ΙΡΙΔΑ!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Σφάλμα αποστολής.');
    } finally {
      setSending(false);
    }
  };

  if (!report || !['submitted', 'approved'].includes(report.status)) {
    return null;
  }

  if (loading) return null;

  if (transaction?.status === 'sent') {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
            <div>
              <p className="font-medium text-green-800">
                Κατατέθηκε στο ΙΡΙΔΑ
              </p>
              <p className="text-sm text-green-700">
                {transaction.irida_reg_no && `Αρ.Πρωτ: ${transaction.irida_reg_no} | `}
                {new Date(transaction.created_at).toLocaleString('el-GR')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!iridaConfigured) {
    return (
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <p className="text-amber-800">
                Ρυθμίστε τη σύνδεση ΙΡΙΔΑ στο{' '}
                <a href="/profile" className="underline font-medium">
                  προφίλ σας
                </a>.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-[#e8e2d8]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg text-[#2a2520]">
          <Link2 className="w-5 h-5" />
          Κατάθεση σε ΙΡΙΔΑ
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <Label>Αποδέκτης</Label>
          <Select value={selectedRecipient} onValueChange={setSelectedRecipient}>
            <SelectTrigger className="min-h-[44px] border-[#e8e2d8]">
              <SelectValue placeholder="Επιλέξτε οργανισμό..." />
            </SelectTrigger>
            <SelectContent>
              {roots.map((r) => (
                <SelectItem
                  key={r.id || r.Id}
                  value={String(r.id || r.Id)}
                >
                  {r.description || r.Description}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label>Θέμα</Label>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="border-[#e8e2d8]"
          />
        </div>

        <div className="text-sm text-[#8a8580]">
          Τύπος: Υπηρεσιακό Σημείωμα
        </div>

        <Button
          onClick={handleSend}
          disabled={sending || !selectedRecipient}
          className="w-full bg-[#1a3aa3] hover:bg-[#152e82] text-white min-h-[48px]"
        >
          {sending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Send className="w-4 h-4 mr-2" />
          )}
          Αποστολή σε ΙΡΙΔΑ
        </Button>
      </CardContent>
    </Card>
  );
}
