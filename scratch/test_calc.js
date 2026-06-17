const tasaEAaMensual = (tasaAnualPct) => {
  if (!tasaAnualPct || tasaAnualPct <= 0) return 0;
  return Math.pow(1 + tasaAnualPct / 100, 1 / 12) - 1;
};

const calcularCuota = (monto, tasaAnual, plazoMeses) => {
  if (!monto || !plazoMeses) return 0;
  if (!tasaAnual) return Math.round(monto / plazoMeses);
  const i = tasaEAaMensual(tasaAnual);
  return Math.round(monto * (i * Math.pow(1 + i, plazoMeses)) / (Math.pow(1 + i, plazoMeses) - 1));
};

const generarTablaAmortizacion = (monto, tasaAnual, plazo) => {
  const r = tasaEAaMensual(tasaAnual);
  const cuota = calcularCuota(monto, tasaAnual, plazo);
  const rows = [];
  let saldo = monto;
  for (let i = 1; i <= plazo; i++) {
    const interes = Math.round(saldo * r);
    const capital = Math.min(cuota - interes, saldo);
    saldo = Math.max(0, saldo - capital);
    rows.push({ numero: i, cuota, interes, capital, saldo });
  }
  return rows;
};

const calcularCuotaSimple = (monto, tasaAnual, plazoMeses) => {
  if (!monto || !plazoMeses) return 0;
  if (!tasaAnual) return Math.round(monto / plazoMeses);
  const i = tasaEAaMensual(tasaAnual);
  return Math.round(monto / plazoMeses + monto * i);
};

const generarTablaAmortizacionSimple = (monto, tasaAnual, plazo) => {
  const i = tasaEAaMensual(tasaAnual);
  const cuota = calcularCuotaSimple(monto, tasaAnual, plazo);
  const interesFijo = Math.round(monto * i);
  const capitalFijo = Math.round(monto / plazo);
  const rows = [];
  let saldo = monto;
  for (let k = 1; k <= plazo; k++) {
    const capital = k < plazo ? capitalFijo : saldo;
    saldo = Math.max(0, saldo - capital);
    rows.push({ numero: k, cuota, interes: interesFijo, capital, saldo });
  }
  return rows;
};

console.log("=== COMPUESTO (FRANCES) ===");
const tComp = generarTablaAmortizacion(120000, 5, 2);
console.log(tComp);
const totIntComp = tComp.reduce((s, r) => s + r.interes, 0);
console.log("Total Interés Compuesto:", totIntComp);

console.log("\n=== SIMPLE ===");
const tSimp = generarTablaAmortizacionSimple(120000, 5, 2);
console.log(tSimp);
const totIntSimp = tSimp.reduce((s, r) => s + r.interes, 0);
console.log("Total Interés Simple:", totIntSimp);
