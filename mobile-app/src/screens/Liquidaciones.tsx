

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';

export default function LiquidacionesScreen() {
  return (
    <div className="space-y-4 animate-fade-in pb-4">
      <Card>
        <CardHeader>
          <CardTitle>Liquidaciones</CardTitle>
          <CardDescription>Visualiza el estado de tus liquidaciones</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground bg-muted/20 rounded-xl border border-dashed border-border">
            <p className="text-sm">Vista de liquidaciones en construcción...</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
