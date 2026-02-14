import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { committeesApi } from '../lib/registryApi';
import CommitteeManager from '../components/CommitteeManager';

export default function CommitteesPage() {
  const [committees, setCommittees] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCommittees = useCallback(async () => {
    try {
      // Fetch all committees with full details (members + structures)
      const { data } = await committeesApi.list();
      // For each committee, fetch full details
      const detailed = await Promise.all(
        data.map(async (c) => {
          try {
            const { data: full } = await committeesApi.get(c.id);
            return full;
          } catch {
            return c;
          }
        })
      );
      setCommittees(detailed);
    } catch {
      toast.error('Σφάλμα φόρτωσης επιτροπών.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCommittees();
  }, [fetchCommittees]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#2a2520]" style={{ fontFamily: "'Literata', serif" }}>
          Επιτροπές Ελέγχου
        </h1>
        <p className="text-[#6b6560] mt-1">
          Διαχείριση επιτροπών ελέγχου, μελών και ανάθεσης δομών
        </p>
      </div>

      <CommitteeManager
        committees={committees}
        isLoading={isLoading}
        onRefresh={fetchCommittees}
      />
    </div>
  );
}
