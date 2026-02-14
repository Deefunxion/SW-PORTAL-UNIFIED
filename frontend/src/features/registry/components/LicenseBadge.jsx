import { Badge } from '@/components/ui/badge.jsx';
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react';

function monthsUntil(dateStr) {
  if (!dateStr) return null;
  const expiry = new Date(dateStr);
  const now = new Date();
  const diff = (expiry.getFullYear() - now.getFullYear()) * 12 +
    (expiry.getMonth() - now.getMonth());
  return diff;
}

export default function LicenseBadge({ expiryDate }) {
  if (!expiryDate) {
    return (
      <Badge variant="outline" className="text-[#8a8580] border-[#e8e2d8]">
        <Clock className="w-3 h-3 mr-1" />
        Χωρίς άδεια
      </Badge>
    );
  }

  const months = monthsUntil(expiryDate);

  if (months === null) return null;

  if (months < 0) {
    return (
      <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
        <AlertTriangle className="w-3 h-3 mr-1" />
        Ληγμένη
      </Badge>
    );
  }

  if (months < 3) {
    return (
      <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
        <AlertTriangle className="w-3 h-3 mr-1" />
        {months} μήν.
      </Badge>
    );
  }

  if (months < 6) {
    return (
      <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">
        <Clock className="w-3 h-3 mr-1" />
        {months} μήν.
      </Badge>
    );
  }

  return (
    <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
      <CheckCircle className="w-3 h-3 mr-1" />
      {new Date(expiryDate).toLocaleDateString('el-GR')}
    </Badge>
  );
}
