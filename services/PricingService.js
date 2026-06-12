// services/PricingService.js
import { calcularCotizacion, formatPrecio } from '../config/pricing.js';

export class PricingService {
  static cotizar({ personas, tipoServicio, duracionHs, provincia } = {}) {
    return calcularCotizacion({ personas, tipoServicio, duracionHs, provincia });
  }

  static formatear(cotizacion) {
    if (!cotizacion || cotizacion.error) return cotizacion;
    return {
      ...cotizacion,
      precioTotalFmt: formatPrecio(cotizacion.precioTotal),
      seniaFmt:       formatPrecio(cotizacion.senia),
      saldoFmt:       formatPrecio(cotizacion.saldo),
    };
  }
}
