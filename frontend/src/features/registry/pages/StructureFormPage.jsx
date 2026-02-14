import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select.jsx';
import {
  Form, FormField, FormItem, FormLabel, FormControl, FormMessage
} from '@/components/ui/form.jsx';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { structuresApi } from '../lib/registryApi';
import { STRUCTURE_STATUS, OWNERSHIP_TYPES } from '../lib/constants';

const structureSchema = z.object({
  code: z.string().min(1, 'Υποχρεωτικό πεδίο'),
  name: z.string().min(1, 'Υποχρεωτικό πεδίο'),
  type_id: z.string().min(1, 'Επιλέξτε τύπο δομής'),
  street: z.string().optional(),
  city: z.string().optional(),
  postal_code: z.string().optional(),
  representative_name: z.string().optional(),
  representative_afm: z.string().optional(),
  representative_phone: z.string().optional(),
  representative_email: z.string().email('Μη έγκυρο email').optional().or(z.literal('')),
  capacity: z.string().optional(),
  status: z.string().optional(),
  ownership: z.string().optional(),
  license_number: z.string().optional(),
  license_date: z.string().optional(),
  license_expiry: z.string().optional(),
  notes: z.string().optional(),
});

export default function StructureFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [structureTypes, setStructureTypes] = useState([]);
  const [isLoading, setIsLoading] = useState(isEdit);
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm({
    resolver: zodResolver(structureSchema),
    defaultValues: {
      code: '', name: '', type_id: '',
      street: '', city: '', postal_code: '',
      representative_name: '', representative_afm: '',
      representative_phone: '', representative_email: '',
      capacity: '', status: 'active', ownership: '',
      license_number: '', license_date: '', license_expiry: '',
      notes: '',
    },
  });

  // Load structure types
  useEffect(() => {
    structuresApi.types()
      .then(({ data }) => setStructureTypes(data))
      .catch(() => toast.error('Σφάλμα φόρτωσης τύπων δομών'));
  }, []);

  // Load existing structure for edit
  useEffect(() => {
    if (!isEdit) return;
    structuresApi.get(id)
      .then(({ data }) => {
        form.reset({
          code: data.code || '',
          name: data.name || '',
          type_id: String(data.type_id || ''),
          street: data.street || '',
          city: data.city || '',
          postal_code: data.postal_code || '',
          representative_name: data.representative_name || '',
          representative_afm: data.representative_afm || '',
          representative_phone: data.representative_phone || '',
          representative_email: data.representative_email || '',
          capacity: data.capacity ? String(data.capacity) : '',
          status: data.status || 'active',
          ownership: data.ownership || '',
          license_number: data.license_number || '',
          license_date: data.license_date || '',
          license_expiry: data.license_expiry || '',
          notes: data.notes || '',
        });
      })
      .catch(() => {
        toast.error('Η δομή δεν βρέθηκε.');
        navigate('/registry');
      })
      .finally(() => setIsLoading(false));
  }, [id, isEdit, form, navigate]);

  const onSubmit = async (values) => {
    setIsSaving(true);
    try {
      const payload = {
        ...values,
        type_id: parseInt(values.type_id, 10),
        capacity: values.capacity ? parseInt(values.capacity, 10) : null,
        license_date: values.license_date || null,
        license_expiry: values.license_expiry || null,
        representative_email: values.representative_email || null,
      };

      if (isEdit) {
        await structuresApi.update(id, payload);
        toast.success('Η δομή ενημερώθηκε.');
        navigate(`/registry/${id}`);
      } else {
        const { data } = await structuresApi.create(payload);
        toast.success('Η δομή δημιουργήθηκε.');
        navigate(`/registry/${data.id}`);
      }
    } catch (err) {
      const msg = err.response?.data?.error || 'Σφάλμα αποθήκευσης.';
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1a3aa3]" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <Link
        to={isEdit ? `/registry/${id}` : '/registry'}
        className="inline-flex items-center text-[#1a3aa3] hover:text-[#152e82] text-sm mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        {isEdit ? 'Επιστροφή στη δομή' : 'Επιστροφή στο Μητρώο'}
      </Link>

      <h1 className="text-3xl font-bold text-[#2a2520] mb-8" style={{ fontFamily: "'Literata', serif" }}>
        {isEdit ? 'Επεξεργασία Δομής' : 'Νέα Δομή'}
      </h1>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Info */}
          <Card className="border-[#e8e2d8]">
            <CardHeader>
              <CardTitle className="text-lg text-[#2a2520]">Βασικά στοιχεία</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Κωδικός *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="π.χ. MFH-ATT-001" className="min-h-[44px] border-[#e8e2d8]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="type_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Τύπος δομής *</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="min-h-[44px] border-[#e8e2d8]">
                            <SelectValue placeholder="Επιλέξτε τύπο" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {structureTypes.map((t) => (
                            <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Επωνυμία *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Πλήρης επωνυμία δομής" className="min-h-[44px] border-[#e8e2d8]" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Κατάσταση</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="min-h-[44px] border-[#e8e2d8]">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(STRUCTURE_STATUS).map(([key, { label }]) => (
                            <SelectItem key={key} value={key}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="ownership"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ιδιοκτησία</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="min-h-[44px] border-[#e8e2d8]">
                            <SelectValue placeholder="Επιλέξτε..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(OWNERSHIP_TYPES).map(([key, label]) => (
                            <SelectItem key={key} value={key}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="capacity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Δυναμικότητα</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" placeholder="π.χ. 50" className="min-h-[44px] border-[#e8e2d8]" />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Address */}
          <Card className="border-[#e8e2d8]">
            <CardHeader>
              <CardTitle className="text-lg text-[#2a2520]">Διεύθυνση</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="street"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Οδός</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Οδός & αριθμός" className="min-h-[44px] border-[#e8e2d8]" />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="postal_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Τ.Κ.</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="π.χ. 10434" className="min-h-[44px] border-[#e8e2d8]" />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Πόλη</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="π.χ. Αθήνα" className="min-h-[44px] border-[#e8e2d8]" />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Representative */}
          <Card className="border-[#e8e2d8]">
            <CardHeader>
              <CardTitle className="text-lg text-[#2a2520]">Νόμιμος Εκπρόσωπος</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="representative_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ονοματεπώνυμο</FormLabel>
                      <FormControl>
                        <Input {...field} className="min-h-[44px] border-[#e8e2d8]" />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="representative_afm"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ΑΦΜ</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="9 ψηφία" className="min-h-[44px] border-[#e8e2d8]" />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="representative_phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Τηλέφωνο</FormLabel>
                      <FormControl>
                        <Input {...field} type="tel" className="min-h-[44px] border-[#e8e2d8]" />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="representative_email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" className="min-h-[44px] border-[#e8e2d8]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* License Info */}
          <Card className="border-[#e8e2d8]">
            <CardHeader>
              <CardTitle className="text-lg text-[#2a2520]">Στοιχεία Άδειας</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="license_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Αρ. Αδείας</FormLabel>
                      <FormControl>
                        <Input {...field} className="min-h-[44px] border-[#e8e2d8]" />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="license_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ημ. Έκδοσης</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" className="min-h-[44px] border-[#e8e2d8]" />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="license_expiry"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Λήξη Αδείας</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" className="min-h-[44px] border-[#e8e2d8]" />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card className="border-[#e8e2d8]">
            <CardHeader>
              <CardTitle className="text-lg text-[#2a2520]">Σημειώσεις</CardTitle>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea
                        {...field}
                        rows={4}
                        placeholder="Πρόσθετες σημειώσεις..."
                        className="border-[#e8e2d8]"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Link to={isEdit ? `/registry/${id}` : '/registry'}>
              <Button type="button" variant="outline" className="min-h-[48px] px-6 border-[#e8e2d8]">
                Ακύρωση
              </Button>
            </Link>
            <Button
              type="submit"
              disabled={isSaving}
              className="bg-[#1a3aa3] hover:bg-[#152e82] text-white min-h-[48px] px-8"
            >
              {isSaving ? (
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <Save className="w-5 h-5 mr-2" />
              )}
              {isEdit ? 'Αποθήκευση' : 'Δημιουργία'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
