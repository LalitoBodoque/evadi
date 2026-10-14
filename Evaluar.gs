/**
 * Función principal: Evaluar
 * Sincroniza checks, copia textos, crea evento y resetea tiempos.
 */
function Evaluar() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const evaDi = ss.getSheetByName('EvaDi');
  const cal = ss.getSheetByName('Cal');
  const TRIGGER_CELL = 'M18';

  // 1. Mantener M18 marcado mientras el script trabaja
  evaDi.getRange(TRIGGER_CELL).setValue(true);
  SpreadsheetApp.flush();

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
    let direccionFinal = cal.getRange(item.puntero).getValue();
    
    if (direccionFinal !== "") {
      try {
        cal.getRange(direccionFinal).setValue(estadoEspejo);
      } catch (e) {
        Logger.log("Error en Check: " + direccionFinal);
      }
    }
  });

  // --- PARTE B: Copiado de Texto ---
  const mapeoTexto = [
    { origen: 'A8',  puntero: 'AK1' },
    { origen: 'N12', puntero: 'AL1' },
    { origen: 'M15', puntero: 'AM1' }
  ];

  mapeoTexto.forEach(item => {
    let contenidoACopiar = evaDi.getRange(item.origen).getValue();
    let direccionFinal = cal.getRange(item.puntero).getValue();
    
    if (direccionFinal !== "") {
      try {
        cal.getRange(direccionFinal).setValue(contenidoACopiar);
      } catch (e) {
        Logger.log("Error en Texto: " + direccionFinal);
      }
    }
  });

  // --- PARTE C: Creación de Evento en "🧕 Hábitos" ---
  try {
    let detalleEvento = evaDi.getRange('K7').getValue();
    if (detalleEvento !== "") {
      const calendariosSol = CalendarApp.getCalendarsByName("🧕 Hábitos");
      if (calendariosSol.length > 0) {
        let mañana = new Date();
        mañana.setDate(mañana.getDate() + 1);
        mañana.setHours(6, 0, 0, 0); 
        
        let finEvento = new Date(mañana);
        finEvento.setHours(6, 15, 0, 0); 
        
        calendariosSol[0].createEvent(detalleEvento, mañana, finEvento);
      }
    }
  } catch (e) {
    Logger.log("Error en Calendario Sol: " + e.message);
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
}

/**
 * ACTIVADOR: miActivadorDeEdicion
 */
function miActivadorDeEdicion(e) {
  if (!e || !e.range) return;
  const range = e.range;
  const sheet = range.getSheet();
  const celdaA1 = range.getA1Notation();
  const valor = String(e.value).toUpperCase().trim();
  const fueMarcado = (valor === "TRUE" || valor === "VERDADERO" || e.value === true);

  if (sheet.getName() === 'EvaDi' && celdaA1 === 'M18' && fueMarcado) {
    Evaluar();
  }
}
