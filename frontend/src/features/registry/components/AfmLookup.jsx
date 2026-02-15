import { useState } from 'react';
import { Input } from '@/components/ui/input.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Search, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { interopApi } from '../lib/registryApi';

/**
 * AFM lookup field that queries the AADE interop service.
 * Props:
 *  - value: current AFM string
 *  - onChange: (afm: string) => void
 *  - onResult: (data: { name, address, legal_form, ... } | null) => void
 *  - className: optional wrapper class
 */
export default function AfmLookup({ value, onChange, onResult, className = '' }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const isValidAfm = value && /^\d{9}$/.test(value);

  const handleLookup = async () => {
    if (!isValidAfm) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const { data } = await interopApi.aadeLookup(value);
      setResult(data);
      if (data.found) {
        onResult?.(data);
      } else {
        setError('Δεν βρέθηκε στο μητρώο ΑΑΔΕ.');
        onResult?.(null);
      }
    } catch {
      setError('Σφάλμα σύνδεσης με ΑΑΔΕ.');
      onResult?.(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={className}>
      <div className="flex gap-2">
        <Input
          value={value || ''}
          onChange={(e) => {
            onChange(e.target.value);
            // Clear previous result when AFM changes
            if (result || error) {
              setResult(null);
              setError(null);
            }
          }}
          placeholder="9 ψηφία"
          maxLength={9}
          className="min-h-[44px] border-[#e8e2d8] flex-1"
        />
        <Button
          type="button"
          variant="outline"
          onClick={handleLookup}
          disabled={!isValidAfm || loading}
          className="min-h-[44px] border-[#e8e2d8] px-3 shrink-0"
          title="Αναζήτηση στο ΑΑΔΕ"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
        </Button>
      </div>

      {/* Result feedback */}
      {result?.found && (
        <div className="mt-2 flex items-start gap-2 p-2 rounded-md bg-green-50 border border-green-200">
          <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
          <div className="text-xs text-green-800">
            <p className="font-medium">{result.name}</p>
            <p className="text-green-600">{result.legal_form} — {result.address}</p>
          </div>
          <Badge variant="outline" className="ml-auto text-[10px] bg-green-100 text-green-700 border-green-200 shrink-0">
            ΑΑΔΕ
          </Badge>
        </div>
      )}
      {error && (
        <div className="mt-2 flex items-center gap-2 p-2 rounded-md bg-red-50 border border-red-200">
          <XCircle className="w-4 h-4 text-red-500 shrink-0" />
          <span className="text-xs text-red-700">{error}</span>
        </div>
      )}
    </div>
  );
}
