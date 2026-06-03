import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';

interface FormData {
  nombre: string; cedula: string; telefono: string;
  email: string; direccion: string; fechaIngreso: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  onConfirm: () => void;
}

export function AsociadoDialogCrear({ open, onOpenChange, formData, setFormData, onConfirm }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Registrar Nuevo Asociado</DialogTitle>
          <DialogDescription>Completa la información del nuevo asociado</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre completo *</Label>
            <Input id="nombre" placeholder="Ej: María González Pérez"
              value={formData.nombre}
              onChange={e => setFormData(p => ({ ...p, nombre: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cedula">Cédula *</Label>
            <Input id="cedula" placeholder="1.123.456.789"
              value={formData.cedula}
              onChange={e => setFormData(p => ({ ...p, cedula: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input id="email" type="email" placeholder="maria@email.com"
              value={formData.email}
              onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="telefono">Teléfono *</Label>
            <Input id="telefono" placeholder="+57 300 123 4567"
              value={formData.telefono}
              onChange={e => setFormData(p => ({ ...p, telefono: e.target.value }))} />
          </div>
          <div className="col-span-2 space-y-2">
            <Label htmlFor="direccion">Dirección *</Label>
            <Input id="direccion" placeholder="Calle 123 #45-67"
              value={formData.direccion}
              onChange={e => setFormData(p => ({ ...p, direccion: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fechaIngreso">Fecha de ingreso *</Label>
            <Input id="fechaIngreso" type="date"
              value={formData.fechaIngreso}
              onChange={e => setFormData(p => ({ ...p, fechaIngreso: e.target.value }))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={onConfirm}>
            Registrar asociado
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
