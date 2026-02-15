import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select.jsx';
import {
  Plus, Search, Building2, ChevronLeft, ChevronRight,
  BarChart3, Gavel, Users, FileText,
} from 'lucide-react';
import { structuresApi } from '../lib/registryApi';
import { STRUCTURE_STATUS } from '../lib/constants';
import { useStructures } from '../hooks/useStructures';
import StructureTable from '../components/StructureTable';

export default function RegistryListPage() {
  const {
    structures, total, page, pages, isLoading,
    setPage, typeId, setTypeId, status, setStatus,
    search, setSearch,
  } = useStructures();

  const [structureTypes, setStructureTypes] = useState([]);
  const [searchInput, setSearchInput] = useState('');

  useEffect(() => {
    structuresApi.types()
      .then(({ data }) => setStructureTypes(data))
      .catch(() => {});
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#2a2520]" style={{ fontFamily: "'Literata', serif" }}>
            Μητρώο Δομών
          </h1>
          <p className="text-[#6b6560] mt-1">
            Δομές Κοινωνικής Φροντίδας — {total} εγγραφές
          </p>
        </div>
        <Link to="/registry/new">
          <Button className="bg-[#1a3aa3] hover:bg-[#152e82] text-white min-h-[48px] px-6">
            <Plus className="w-5 h-5 mr-2" />
            Νέα Δομή
          </Button>
        </Link>
      </div>

      {/* Sub-navigation */}
      <div className="flex flex-wrap gap-2 mb-6">
        <Link to="/oversight">
          <Button variant="outline" size="sm" className="border-[#e8e2d8] min-h-[36px]">
            <BarChart3 className="w-4 h-4 mr-1.5" />
            Πίνακας Εποπτείας
          </Button>
        </Link>
        <Link to="/sanctions">
          <Button variant="outline" size="sm" className="border-[#e8e2d8] min-h-[36px]">
            <Gavel className="w-4 h-4 mr-1.5" />
            Κυρώσεις
          </Button>
        </Link>
        <Link to="/committees">
          <Button variant="outline" size="sm" className="border-[#e8e2d8] min-h-[36px]">
            <Users className="w-4 h-4 mr-1.5" />
            Επιτροπές
          </Button>
        </Link>
        <Link to="/reports">
          <Button variant="outline" size="sm" className="border-[#e8e2d8] min-h-[36px]">
            <FileText className="w-4 h-4 mr-1.5" />
            Εκθέσεις
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <Card className="mb-6 border-[#e8e2d8]">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <form onSubmit={handleSearch} className="flex-1 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8a8580]" />
                <Input
                  placeholder="Αναζήτηση κωδικού ή επωνυμίας..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pl-10 min-h-[44px] border-[#e8e2d8]"
                />
              </div>
              <Button type="submit" variant="outline" className="min-h-[44px] border-[#e8e2d8]">
                <Search className="w-4 h-4" />
              </Button>
            </form>

            {/* Type filter */}
            <Select value={typeId} onValueChange={setTypeId}>
              <SelectTrigger className="w-full md:w-[200px] min-h-[44px] border-[#e8e2d8]">
                <SelectValue placeholder="Τύπος δομής" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Όλοι οι τύποι</SelectItem>
                {structureTypes.map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status filter */}
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-full md:w-[180px] min-h-[44px] border-[#e8e2d8]">
                <SelectValue placeholder="Κατάσταση" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Όλες</SelectItem>
                {Object.entries(STRUCTURE_STATUS).map(([key, { label }]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1a3aa3]" />
        </div>
      ) : (
        <>
          <StructureTable structures={structures} />

          {/* Pagination */}
          {pages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <p className="text-sm text-[#8a8580]">
                Σελίδα {page} από {pages} ({total} δομές)
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="border-[#e8e2d8]"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Προηγούμενη
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= pages}
                  onClick={() => setPage(page + 1)}
                  className="border-[#e8e2d8]"
                >
                  Επόμενη
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
