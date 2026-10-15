/**
 * ProMe — un solo resultado
 * Al palomear la casilla B13 de la hoja "ProMe", crea el evento de hoy
 * en el calendario "🧕 Hábitos" usando el texto del resultado (D13),
 * con el ícono del hábito al inicio (❗) y en color morado (Uva). El ícono es lo que lo identifica.
 * Luego regresa la casilla a FALSE.
 *
 * El ícono hace que el evento cuente como el hábito "❗ Hacer ProMe" en EvaDí:
 * borrarlo = palomita, [C] en CalenGoo = X, sin tocar = pendiente.
 * Al crearlo, también se anota el texto en el registro ProMeLog (si AppEvaDi.gs está en el proyecto).
 */

// ---------- Configuración ----------
var PROME_HOJA        = "ProMe";   // nombre de la pestaña
var PROME_FILA        = 13;        // fila de la casilla
var PROME_COL_CASILLA = 2;         // columna B
var PROME_COL_TEXTO   = 4;         // columna D, donde vive el resultado
var PROME_HORA        = 6;         // hora de inicio
var PROME_MIN         = 30;        // minuto de inicio
var PROME_DURACION    = 15;        // duración en minutos
var PROME_ETIQUETA    = "[wpro]";  // ya no se agrega al título; solo sirve para reconocer eventos viejos
var PROME_ICONO       = "❗";       // ícono del hábito en EvaDi (C5): va al inicio del título y lo identifica
var PROME_COLOR       = "3";       // color del evento en Google Calendar: 3 = Uva (morado)

// Calendario "🧕 Hábitos" (antes era el calendario propio de Eventos ProMe:
// c126d209e000f66e72ffe0b857146e6e86e5053d05bbc4fb3ba5d7904fe76a1b@group.calendar.google.com)
// Se usa el ID y no el nombre, porque el emoji del nombre no coincide al copiarlo
var PROME_CALENDARIO_ID = "91ca38be8b5e74d65dc02bdc5d4b300f9c647c545983e538ea7953153a181b84@group.calendar.google.com";
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
 * Crea el evento de ProMe de un día (hoy si no se indica), con el ícono al inicio y en color morado.
 * Además lo anota en el registro ProMeLog y en la lista de eventos que usa el disparador de 🧕 Hábitos
 * (así, si lo borras enseguida, igual cuenta como palomita).
 */
function crearEventoProMe(titulo, dia) {
  var cal = CalendarApp.getCalendarById(PROME_CALENDARIO_ID);

  if (!cal) {
    Logger.log("No se encontró el calendario con ese ID.");
    return;
  }

  var base = dia instanceof Date ? dia : new Date();
  var inicio = new Date(base.getFullYear(), base.getMonth(), base.getDate(), PROME_HORA, PROME_MIN, 0);
  var fin = new Date(inicio.getTime() + PROME_DURACION * 60 * 1000);

  var tituloFinal = PROME_ICONO + " " + titulo;

  var ev = cal.createEvent(tituloFinal, inicio, fin);
  ev.setColor(PROME_COLOR);
  Logger.log("Evento creado: " + tituloFinal + " a las " + inicio);

  // Registro para la sesión semanal y lista del disparador (viven en AppEvaDi.gs)
  if (typeof evadiAppProMeRegistrar === "function") evadiAppProMeRegistrar(inicio, titulo);
  if (typeof evadiAppHabListaAgregar === "function") evadiAppHabListaAgregar(ev);
  return ev;
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

  cal.createEvent("PRUEBA ProMe", inicio, fin);
  Logger.log("Evento de prueba creado en: " + cal.getName());
}
