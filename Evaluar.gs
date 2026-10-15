/**
 * Función principal: Evaluar
 * Sincroniza checks, copia textos, crea evento y resetea tiempos.
 *
 * Cambios (versión 2):
 * - La meta (columna W) se escribe AL FINAL: W con dato = "día evaluado". Así, si algo falla antes,
 *   el día no queda marcado como evaluado a medias.
 * - Si una casilla o un texto no se pudo copiar a Cal, se detiene ANTES de limpiar EvaDi
 *   y avisa cuál fue. Nada se pierde: lo puedes volver a intentar.
 * - Si la meta sale vacía, escribe 0 (para que el día sí quede marcado como evaluado).
 * - Opciones que solo usa la app (AppEvaDi.gs):
 *     fila       = renglón de Cal donde se escribe (el de ayer, cuando no evaluaste a tiempo)
 *     diasAtras  = 1 si se evalúa ayer: el ejercicio se agenda para hoy, no para pasado mañana
 *     soloLimpiar = true para "Descartar": limpia EvaDi sin copiar nada a Cal ni crear eventos
 * - Devuelve una lista de avisos (por ejemplo, si no se pudo crear el evento de ejercicio).
 */
var EVALUAR_VERSION = 2;  // la app revisa este número antes de evaluar ayer o descartar

function Evaluar(opciones) {
  // Desde la casilla M18 puede llegar el evento de edición: solo se aceptan las opciones de la app
  const op = (opciones && opciones.evadi === true) ? opciones : {};
  const diasAtras = Number(op.diasAtras) || 0;
  const avisos = [];

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const evaDi = ss.getSheetByName('EvaDi');
  const cal = ss.getSheetByName('Cal');
  const TRIGGER_CELL = 'M18';

  // 1. Mantener M18 marcado mientras el script trabaja
  evaDi.getRange(TRIGGER_CELL).setValue(true);
  SpreadsheetApp.flush();

  // Celda de Cal que señala un puntero (ej. 'AK1' -> 'W309'); con op.fila, cambia el renglón (ej. 'W308')
  const destino = function (puntero) {
    let dir = String(cal.getRange(puntero).getValue()).trim();
    if (!/^[A-Z]+\d+$/.test(dir)) return '';
    if (op.fila) dir = dir.replace(/\d+$/, String(op.fila));
    return dir;
  };

  if (!op.soloLimpiar) {
    const fallas = [];

    // --- PARTE A: Sincronización de Checkboxes ---
    const mapeoChecks = [
      { origen: 'E3', puntero: 'AF1' },
      { origen: 'E4', puntero: 'AG1' },
      { origen: 'E5', puntero: 'AH1' },
      { origen: 'E6', puntero: 'AI1' },
      { origen: 'E7', puntero: 'AJ1' },
      { origen: 'M3', puntero: 'AE2' },
      { origen: 'M4', puntero: 'AF2' },
      { origen: 'M5', puntero: 'AG2' },
      { origen: 'M6', puntero: 'AH2' },
      { origen: 'M7', puntero: 'AI2' }
    ];

    mapeoChecks.forEach(item => {
      let valorOrigen = evaDi.getRange(item.origen).getValue();
      let estadoEspejo = (valorOrigen === true || valorOrigen === "VERDADERO");
      let direccionFinal = destino(item.puntero);

      if (direccionFinal === "") { fallas.push(item.origen); return; }
      try {
        cal.getRange(direccionFinal).setValue(estadoEspejo);
      } catch (e) {
        Logger.log("Error en Check: " + direccionFinal);
        fallas.push(item.origen);
      }
    });

    // --- PARTE B: Copiado de Texto (tiempo y Relevante; la meta va al final) ---
    const mapeoTexto = [
      { origen: 'N12', puntero: 'AL1' },
      { origen: 'M15', puntero: 'AM1' }
    ];

    mapeoTexto.forEach(item => {
      let contenidoACopiar = evaDi.getRange(item.origen).getValue();
      let direccionFinal = destino(item.puntero);

      if (direccionFinal === "") { fallas.push(item.origen); return; }
      try {
        cal.getRange(direccionFinal).setValue(contenidoACopiar);
      } catch (e) {
        Logger.log("Error en Texto: " + direccionFinal);
        fallas.push(item.origen);
      }
    });

    // Algo no llegó a Cal: se detiene sin limpiar EvaDi
    if (fallas.length) {
      evaDi.getRange(TRIGGER_CELL).setValue(false);
      throw new Error('No se pudo copiar a Cal: ' + fallas.join(', ') + '. EvaDi no se limpió; intenta de nuevo.');
    }

    // Meta al final: con esto el día queda marcado como evaluado
    let meta = evaDi.getRange('A8').getValue();
    if (meta === '' || meta === null) meta = 0;
    let dirMeta = destino('AK1');
    if (dirMeta === "") {
      evaDi.getRange(TRIGGER_CELL).setValue(false);
      throw new Error('No se pudo copiar a Cal: A8. EvaDi no se limpió; intenta de nuevo.');
    }
    try {
      cal.getRange(dirMeta).setValue(meta);
    } catch (e) {
      evaDi.getRange(TRIGGER_CELL).setValue(false);
      throw new Error('No se pudo copiar a Cal: A8. EvaDi no se limpió; intenta de nuevo.');
    }
    SpreadsheetApp.flush();

    // --- PARTE C: Creación de Evento en "🧕 Hábitos" ---
    try {
      let detalleEvento = evaDi.getRange('K7').getValue();
      if (detalleEvento !== "") {
        const calendariosSol = CalendarApp.getCalendarsByName("🧕 Hábitos");
        if (calendariosSol.length > 0) {
          let mañana = new Date();
          mañana.setDate(mañana.getDate() + 1 - diasAtras);
          mañana.setHours(6, 0, 0, 0);

          let finEvento = new Date(mañana);
          finEvento.setHours(6, 15, 0, 0);

          calendariosSol[0].createEvent(detalleEvento, mañana, finEvento);
        }
      }
    } catch (e) {
      Logger.log("Error en Calendario Sol: " + e.message);
      avisos.push('No se creó el evento de ejercicio: ' + e.message);
    }
  }

  // --- OTRAS ACCIONES ---

  // 1. Marcar como FALSO las casillas especificadas en EvaDi
  const casillasAFalso = [
    "D3", "D4", "D5", "D6", "D7",
    "E3", "E4", "E5", "E6", "E7",
    "L3", "L5", "L6", "L7",
    "M3", "M4", "M5", "M6", "M7"
  ];

  casillasAFalso.forEach(celda => {
    evaDi.getRange(celda).setValue(false);
  });

  // 2. Escribir un cero "0" en N1 de EvaDi
  evaDi.getRange("N1").setValue(0);

  // 3. Borrar el contenido de las casillas M15 y D10
  evaDi.getRange("M15").clearContent();
  evaDi.getRange("D10").clearContent();

  // 4. Finalizar: Desmarcar automáticamente M18
  evaDi.getRange(TRIGGER_CELL).setValue(false);

  return avisos;
}

/**
 * ACTIVADOR: miActivadorDeEdicion
 * Al marcar M18 en la hoja, evalúa por el mismo camino que la app (AppEvaDi.gs):
 * candado, no evalúa dos veces, evalúa ayer si se te pasó y agenda el ProMe de mañana.
 */
function miActivadorDeEdicion(e) {
  if (!e || !e.range) return;
  const range = e.range;
  const sheet = range.getSheet();
  const celdaA1 = range.getA1Notation();
  const valor = String(e.value).toUpperCase().trim();
  const fueMarcado = (valor === "TRUE" || valor === "VERDADERO" || e.value === true);

  if (sheet.getName() === 'EvaDi' && celdaA1 === 'M18' && fueMarcado) {
    if (typeof evadiAppEvaluarDesdeHoja === 'function') evadiAppEvaluarDesdeHoja();
    else Evaluar();
  }
}
