// config/business.js
// Datos y reglas del negocio Javotecocina — editá este archivo para actualizar configuración.

export const BUSINESS = {
  nombre:   'Javo Te Cocina',
  telefono: '+543874105902',
  email:    'javoelizalde2001@gmail.com',
  zona:     'Argentina',

  // 0=domingo 1=lunes 2=martes 3=miércoles 4=jueves 5=viernes 6=sábado
  diasNoLaborales: [1, 2, 3],

  duracionDefaultHs: 5,

  servicios: [
    'Asado / Parrilla',
    'Disco',
    'Catering completo',
    'Bandejeo',
    'Autoservicio / Buffet',
    'Cocina en vivo',
    'Menú emplatado',
    'Experiencia gastronómica',
    'Campaña de redes',
    'Clase de cocina',
  ],

  pago: {
    alias:         'javiermelizalde',
    cuil:          '24-43549743-4',
    instrucciones: 'Transferencia bancaria vía Alias',
  },

  // Minutos antes de que venza una reserva provisoria sin seña
  reservaVencimientoMinutos: 60,

  waDerivacion: '+543874105902',
};

export const NOMBRES_DIAS = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
export const NOMBRES_MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

export function esDiaLaboral(fecha) {
  const d = new Date(fecha + 'T12:00:00');
  return !BUSINESS.diasNoLaborales.includes(d.getDay());
}

export function formatFecha(fechaStr) {
  const [y, m, d] = fechaStr.split('-');
  return `${parseInt(d)} de ${NOMBRES_MESES[parseInt(m) - 1]} de ${y}`;
}
