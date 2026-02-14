import { useState, useEffect, useCallback } from 'react';
import { structuresApi } from '../lib/registryApi';

export function useStructures() {
  const [structures, setStructures] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [perPage] = useState(20);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [typeId, setTypeId] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');

  const fetchStructures = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = { page, per_page: perPage };
      if (typeId && typeId !== 'all') params.type_id = typeId;
      if (status && status !== 'all') params.status = status;
      if (search) params.search = search;

      const { data } = await structuresApi.list(params);
      setStructures(data.structures);
      setTotal(data.total);
      setPages(data.pages);
    } catch (err) {
      console.error('Failed to fetch structures:', err);
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [page, perPage, typeId, status, search]);

  useEffect(() => {
    fetchStructures();
  }, [fetchStructures]);

  // Reset to page 1 when filters change
  const updateFilter = useCallback((setter) => (value) => {
    setter(value);
    setPage(1);
  }, []);

  return {
    structures,
    total,
    page,
    pages,
    perPage,
    isLoading,
    error,
    setPage,
    typeId,
    setTypeId: updateFilter(setTypeId),
    status,
    setStatus: updateFilter(setStatus),
    search,
    setSearch: updateFilter(setSearch),
    refetch: fetchStructures,
  };
}
