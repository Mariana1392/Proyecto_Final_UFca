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
  asociado: any;
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  onConfirm: () => void;
}

export function AsociadoDialogEditar({ open, onOpenChange, asociado, formData, setFormData, onConfirm }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar Información del Asociado</DialogTitle>
          <DialogDescription>
            Solo puedes actualizar: correo electrónico, teléfono y dirección. Los campos de identificación están bloqueados por seguridad.
          </DialogDescription>
        </DialogHeader>
        {asociado && (
          <div className="space-y-4 py-4">
            <div className="bg-blue-50 border-l-4 border-blue-600 p-4 rounded">
              <p className="text-sm text-blue-900">
                <strong>🔒 Campos Bloqueados:</strong> Nombre, Apellidos y Cédula no pueden ser modificados por razones de seguridad y trazabilidad.<br />
                <strong>✅ Campos Editables:</strong> Correo Electrónico, Teléfono y Dirección.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-nombre">Nombre completo * <span className="text-xs text-slate-500 font-normal">(🔒 Bloqueado)</span></Label>
                <Input id="edit-nombre" value={formData.nombre} disabled className="bg-slate-100 cursor-not-allowed text-slate-500" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-cedula">Cédula * <span className="text-xs text-slate-500 font-normal">(🔒 Bloqueado)</span></Label>
                <Input id="edit-cedula" value={formData.cedula} disabled className="bg-slate-100 cursor-not-allowed text-slate-500" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">Email * <span className="text-xs text-emerald-600 font-normal">(✅ Editable)</span></Label>
                <Input id="edit-email" type="email" value={formData.email}
                  onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
                  className="border-emerald-300 focus:ring-emerald-500" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-telefono">Teléfono * <span className="text-xs text-emerald-600 font-normal">(✅ Editable)</span></Label>
                <Input id="edit-telefono" value={formData.telefono}
                  onChange={e => setFormData(p => ({ ...p, telefono: e.target.value }))}
                  className="border-emerald-300 focus:ring-emerald-500" />
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="edit-direccion">Dirección * <span className="text-xs text-emerald-600 font-normal">(✅ Editable)</span></Label>
                <Input id="edit-direccion" value={formData.direccion}
                  onChange={e => setFormData(p => ({ ...p, direccion: e.target.value }))}
                  className="border-emerald-300 focus:ring-emerald-500" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-fechaIngreso">Fecha de ingreso * <span className="text-xs text-slate-500 font-normal">(🔒 Bloqueado)</span></Label>
                <Input id="edit-fechaIngreso" type="date" value={formData.fechaIngreso}
                  disabled className="bg-slate-100 cursor-not-allowed text-slate-500" />
              </div>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={onConfirm}>Actualizar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
