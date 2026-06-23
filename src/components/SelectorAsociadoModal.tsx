import { useState, useMemo } from 'react';
import { Search, Users, Check, X, Mail, Landmark } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from './ui/dialog';

interface SelectorAsociadoModalProps {
  open: boolean;
  onClose: () => void;
  asociados: any[];
  onSelect: (asociado: any) => void;
}

export default function SelectorAsociadoModal({
  open,
  onClose,
  asociados,
  onSelect,
}: SelectorAsociadoModalProps) {
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // Filtrado de asociados según la búsqueda
  const filteredAsociados = useMemo(() => {
    const term = search.toLowerCase().trim();
    if (!term) return asociados;
    return asociados.filter(
      (a) =>
        (a.nombre ?? '').toLowerCase().includes(term) ||
        (a.cedula ?? '').includes(term) ||
        (a.email ?? '').toLowerCase().includes(term)
    );
  }, [search, asociados]);

  // Paginación
  const totalPages = Math.ceil(filteredAsociados.length / itemsPerPage);
  const currentItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredAsociados.slice(start, start + itemsPerPage);
  }, [filteredAsociados, currentPage]);

  const handleSelect = (asociado: any) => {
    onSelect(asociado);
    setSearch('');
    setCurrentPage(1);
    onClose();
  };

  const handleClose = () => {
    setSearch('');
    setCurrentPage(1);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2 text-purple-700 dark:text-purple-400">
            <Users className="size-5" />
            Buscar y Seleccionar Asociado
          </DialogTitle>
          <DialogDescription>
            Visualiza y busca detalladamente entre los asociados registrados en la cooperativa.
          </DialogDescription>
        </DialogHeader>

        {/* Buscador */}
        <div className="relative my-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
          {search && (
            <button
              onClick={() => { setSearch(''); setCurrentPage(1); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-650"
            >
              <X className="size-4" />
            </button>
          )}
          <Input
            placeholder="Buscar por nombre, cédula o correo electrónico..."
            className="pl-10 pr-9 border-purple-200 focus-visible:ring-purple-200"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>

        {/* Listado de asociados */}
        <div className="flex-1 overflow-y-auto min-h-[300px] border border-slate-100 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/50 p-2 space-y-2">
          {currentItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Users className="size-10 text-slate-300 dark:text-slate-700 mb-2" />
              <p className="font-semibold text-slate-500">Sin resultados encontrados</p>
              <p className="text-xs text-slate-400">No encontramos ningún asociado que coincida con "{search}"</p>
            </div>
          ) : (
            currentItems.map((a) => (
              <div
                key={a.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-white dark:bg-slate-950 border border-slate-105 dark:border-slate-850 rounded-xl hover:shadow-sm transition-all"
              >
                <div className="space-y-1">
                  <p className="font-semibold text-slate-850 dark:text-slate-200 text-sm sm:text-base">
                    {a.nombre}
                  </p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Landmark className="size-3 text-slate-400" />
                      C.C. {a.cedula}
                    </span>
                    {a.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="size-3 text-slate-400" />
                        {a.email}
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  onClick={() => handleSelect(a)}
                  className="bg-purple-600 hover:bg-purple-700 text-white gap-1.5 shrink-0 w-full sm:w-auto"
                  size="sm"
                >
                  <Check className="size-4" />
                  Seleccionar
                </Button>
              </div>
            ))
          )}
        </div>

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
            <p className="text-xs text-slate-500">
              Página {currentPage} de {totalPages} · {filteredAsociados.length} asociados en total
            </p>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="h-8 text-xs"
              >
                Anterior
              </Button>
              <span className="text-xs font-semibold px-2">
                {currentPage}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p + 1))}
                disabled={currentPage === totalPages}
                className="h-8 text-xs"
              >
                Siguiente
              </Button>
            </div>
          </div>
        )}

        <DialogFooter className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button variant="outline" onClick={handleClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
