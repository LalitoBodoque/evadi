/**
 * ProMe — un solo resultado
 * Al palomear la casilla B13 de la hoja "ProMe", crea el evento de hoy
 * en el calendario de Eventos ProMe usando el texto del resultado (D13),
 * con la etiqueta [wpro] al final para poder buscarlo después.
 * Luego regresa la casilla a FALSE.
 */

// ---------- Configuración ----------
var PROME_HOJA        = "ProMe";   // nombre de la pestaña
var PROME_FILA        = 13;        // fila de la casilla
var PROME_COL_CASILLA = 2;         // columna B
var PROME_COL_TEXTO   = 4;         // columna D, donde vive el resultado
var PROME_HORA        = 6;         // hora de inicio
var PROME_MIN         = 30;        // minuto de inicio
var PROME_DURACION    = 15;        // duración en minutos
var PROME_ETIQUETA    = "[wpro]";  // etiqueta que se agrega al final del título

// Se usa el ID y no el nombre, porque el emoji del nombre no coincide al copiarlo
var PROME_CALENDARIO_ID = "c126d209e000f66e72ffe0b857146e6e86e5053d05bbc4fb3ba5d7904fe76a1b@group.calendar.google.com";
// -----------------------------------

function disparadorProMe(e) {
  if (!e || !e.range) return;

  var range = e.range;
  var hoja = range.getSheet();

  // Solo reacciona a la casilla exacta B13 de la hoja ProMe
  if (hoja.getName() !== PROME_HOJA) return;
  if (range.getRow() !== PROME_FILA) return;
  if (range.getColumn() !== PROME_COL_CASILLA) return;

  // Solo cuando se palomea, no cuando se despalomea
  var palomeada = (e.value === true || String(e.value).toUpperCase() === "TRUE");
  if (!palomeada) return;

  // El título sale del texto del resultado
  var titulo = String(hoja.getRange(PROME_FILA, PROME_COL_TEXTO).getValue()).trim();

  // La casilla se destilda siempre, haya texto o no
  range.setValue(false);

  if (titulo === "") {
    Logger.log("El resultado está vacío. No se creó ningún evento.");
    return;
  }

  crearEventoProMe(titulo);
}

/**
 * Crea el evento de hoy en el calendario de ProMe, con la etiqueta al final.
 */
function crearEventoProMe(titulo) {
  var cal = CalendarApp.getCalendarById(PROME_CALENDARIO_ID);

  if (!cal) {
    Logger.log("No se encontró el calendario con ese ID.");
    return;
  }

  var hoy = new Date();
  var inicio = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), PROME_HORA, PROME_MIN, 0);
  var fin = new Date(inicio.getTime() + PROME_DURACION * 60 * 1000);

  var tituloFinal = titulo + " " + PROME_ETIQUETA;

  cal.createEvent(tituloFinal, inicio, fin);
  Logger.log("Evento creado: " + tituloFinal + " a las " + inicio);
}

/**
 * Prueba manual. Crea un evento dentro de 5 minutos para verlo de inmediato.
 * Bórralo a mano cuando confirmes que funciona.
 */
function pruebaEventoProMe() {
  var cal = CalendarApp.getCalendarById(PROME_CALENDARIO_ID);

  if (!cal) {
    Logger.log("No se encontró el calendario con ese ID.");
    return;
  }

  var inicio = new Date(new Date().getTime() + 5 * 60 * 1000);
  var fin = new Date(inicio.getTime() + 15 * 60 * 1000);

  cal.createEvent("PRUEBA ProMe " + PROME_ETIQUETA, inicio, fin);
  Logger.log("Evento de prueba creado en: " + cal.getName());
}
