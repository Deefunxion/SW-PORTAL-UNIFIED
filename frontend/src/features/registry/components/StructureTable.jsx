import { useNavigate } from 'react-router-dom';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { STRUCTURE_STATUS } from '../lib/constants';
import LicenseBadge from './LicenseBadge';

export default function StructureTable({ structures }) {
  const navigate = useNavigate();

  if (!structures || structures.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-[#8a8580] text-lg">Δεν βρέθηκαν δομές.</p>
        <p className="text-[#b0a99e] text-sm mt-1">Δοκιμάστε να αλλάξετε τα φίλτρα αναζήτησης.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#e8e2d8] overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-[#f5f2ec] hover:bg-[#f5f2ec]">
            <TableHead className="font-semibold text-[#2a2520]">Κωδικός</TableHead>
            <TableHead className="font-semibold text-[#2a2520]">Επωνυμία</TableHead>
            <TableHead className="font-semibold text-[#2a2520]">Τύπος</TableHead>
            <TableHead className="font-semibold text-[#2a2520]">Κατάσταση</TableHead>
            <TableHead className="font-semibold text-[#2a2520]">Λήξη Άδειας</TableHead>
            <TableHead className="font-semibold text-[#2a2520]">Κοιν. Σύμβουλος</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {structures.map((s) => {
            const statusInfo = STRUCTURE_STATUS[s.status] || { label: s.status, color: 'gray' };
            return (
              <TableRow
                key={s.id}
                className="cursor-pointer hover:bg-[#faf8f4] transition-colors"
                onClick={() => navigate(`/registry/${s.id}`)}
              >
                <TableCell className="font-mono text-sm text-[#1a3aa3]">{s.code}</TableCell>
                <TableCell className="font-medium text-[#2a2520]">{s.name}</TableCell>
                <TableCell className="text-[#6b6560]">{s.type?.name || '—'}</TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={`
                      ${statusInfo.color === 'green' ? 'bg-green-100 text-green-800 border-green-200' : ''}
                      ${statusInfo.color === 'orange' ? 'bg-orange-100 text-orange-800 border-orange-200' : ''}
                      ${statusInfo.color === 'red' ? 'bg-red-100 text-red-800 border-red-200' : ''}
                      ${statusInfo.color === 'gray' ? 'bg-gray-100 text-gray-800 border-gray-200' : ''}
                    `}
                  >
                    {statusInfo.label}
                  </Badge>
                </TableCell>
                <TableCell>
                  <LicenseBadge expiryDate={s.license_expiry} />
                </TableCell>
                <TableCell className="text-[#6b6560]">
                  {s.advisor?.full_name || s.advisor?.username || '—'}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
