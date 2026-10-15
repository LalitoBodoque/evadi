/**
 * API DE EVADÍ
 * Recibe las peticiones de la PWA (GitHub Pages) y lee/escribe la pestaña EvaDi de DEP 3.0.
 * - Todo entra por doPost, protegido con una clave guardada en Propiedades del script.
 * - Los cambios llegan en lote (la fila de pendientes del cel) y se aplican en orden.
 * - Cada cambio trae un id: si llega repetido por un reintento, se ignora (no se suma dos veces).
 * - Los cambios de un día que ya no es el de EvaDi se descartan (menos "Hoy tomé" y ProMe, que traen su fecha).
 * - ProMe: la casilla agenda (crearEventoProMe) o quita el evento de hoy, y la escalera se puede editar.
 * - Los botones llaman a tus scripts existentes (Evaluar, Exentar, ejercicio, etc.).
 * - El botón "Check hábitos" (se llamó "Clockify" un tiempo):
 *   1) Revisa los eventos de HOY del calendario "🧕 Hábitos" para los demás hábitos (todos menos TikTok):
 *      sin evento hoy (lo borraste) = palomita; evento con [C] al final = X; evento sin [C] = las dos vacías.
 *   2) Lee Clockify: si "TikTok afiliado" lleva 30 min o más hoy, palomea el hábito de TikTok (C7);
 *      si no, deja desmarcadas sus dos casillas (hecho E7 y fallé D7).
 *   Ya no llama a checkHabitos(): usa la misma regla que el disparador del calendario.
 * - Nunca toca D10 (lo escribe n8n desde Clockify): los ajustes de tiempo van a N1/N2 o a Cal.
 * - Lleva un número de versión de los cambios: el cel y la PC lo revisan cada 5 s y se actualizan si cambió.
 * - Los hábitos se pueden renombrar y su nota se puede editar desde la app.
 * - Avisa si el día ya se evaluó (la celda de hoy en Cal que señala Cal!AK1 ya tiene dato).
 * - Después de evaluar: muestra el día desde Cal (palomitas, tiempo, meta, Relevante) y las X desde una foto;
 *   lo que corrijas va directo a Cal. No deja evaluar dos veces el mismo día.
 * - Al evaluar, agenda el ProMe de mañana con el texto de ProMe Hoy.
 * - Calendario "🧕 Hábitos": al borrar un evento de HOY, palomea el hábito cuyo ícono coincide
 *   con el primer "palabra" del título (disparador de calendario + servicio avanzado de Calendar).
 *   Si el título de un evento de HOY termina en [C] (lo marcaste como hecho en CalenGoo = no me dio tiempo),
 *   le pone X; si le quitas el [C], o si el evento vuelve a aparecer hoy, regresa a pendiente.
 *   Los hábitos de EVADIAPP_HAB_AL_REVES (hoy ninguno) funcionan al revés: borrar = X; si vuelve = pendiente.
 * - Link del Rosario (para el documento donde se reza): doGet con ?accion=rosario&t=<contraseña del link>.
 *   Pide confirmar con un botón; al confirmar borra el evento del Rosario de HOY en "🧕 Hábitos"
 *   y palomea el Rosario en EvaDi (o en Cal si el día ya se evaluó). La contraseña del link es aparte
 *   de la clave de la app (EVADI_ROSARIO_TOKEN) y solo sirve para esto.
 * - Día anterior sin evaluar: si ayer no se evaluó (su W en Cal está vacío) y hoy tampoco,
 *   EvaDi todavía tiene los datos de ayer. La app muestra una franja con dos salidas:
 *   "Evaluar" (copia EvaDi al renglón de ayer) o "Descartar" (limpia EvaDi y ayer se queda vacío).
 *   Mientras tanto, el botón Evaluar también evalúa ayer (así, evaluar a las 12:30 cae en su día),
 *   Check hábitos y Tiempo hoy se apagan, y el calendario y el link del Rosario no marcan nada.
 *   Si lo resuelves de las 5:00 en adelante, la app vuelve a leer tu calendario de hoy (como Check hábitos).
 * - Evaluar desde la casilla M18 de la hoja pasa por aquí (evadiAppEvaluarDesdeHoja): mismo candado y mismas reglas.
 * - Exentar también quita las X de los hábitos que quedan palomeados.
 * - ProMe: el evento vive en "🧕 Hábitos" con el ícono ❗ y color morado (EventosProMe.gs) y cuenta como el hábito "❗ Hacer ProMe".
 *   El ícono es lo que lo identifica (la etiqueta [wpro] ya no se usa; solo se reconoce en eventos viejos).
 *   Registro en la hoja oculta "ProMeLog" (Fecha | ProMe | Resultado | Hora) para la sesión semanal:
 *   el texto se anota al crear el evento; Resultado y Hora cuando cambia la casilla del hábito;
 *   al evaluar se cierra el día ("No se hizo" si quedó pendiente).
 *   El renglón de arriba se pone verde si hoy hay ProMe en el registro (aunque ya hayas borrado el evento).
 *   Desmarcarlo quita el evento y el registro de hoy sin contarlo como palomita; si el hábito ya está marcado, no deja.
 * Todas las funciones llevan el prefijo "evadiApp" para no chocar con tus otros archivos.
 */

// ID de DEP 3.0 (respaldo por si getActiveSpreadsheet no responde en la app web)
var EVADIAPP_ID_LIBRO = '1CL6RYyW0V0MCGk7Xf6ASw2FyuF9Qi6V6ZHnfN_0UEzY';

// Nombre de la propiedad donde vive la clave
var EVADIAPP_PROP_CLAVE = 'EVADI_CLAVE';

// Link del Rosario: su propia contraseña (no es la clave de la app) y la celda del hábito en EvaDi
var EVADIAPP_PROP_ROSARIO = 'EVADI_ROSARIO_TOKEN';
var EVADIAPP_ROSARIO_CELDA = 'C6';

// Clockify: la API key vive en Propiedades del script (nunca en el código)
var EVADIAPP_PROP_CLOCKIFY = 'CLOCKIFY_API_KEY';
var EVADIAPP_PROP_CLOCKIFY_WS = 'CLOCKIFY_WORKSPACE';  // se llena sola la primera vez (tu espacio de trabajo activo)
var EVADIAPP_PROP_CLOCKIFY_USER = 'CLOCKIFY_USER_ID';  // se llena sola la primera vez
// Plan gratis de Clockify: 30 consultas por hora entre todas tus claves. Cada toque al botón Check hábitos gasta 1.

// Hábito de TikTok que se revisa con Clockify al tocar el botón Check hábitos
var EVADIAPP_TIKTOK = {
  celda: 'C7',                // celda del nombre del hábito en EvaDi (ᕷ [30] Proyecto TikTok Afiliado)
  buscar: 'tiktok afiliado',  // se busca en el proyecto, la tarea o la descripción del registro de Clockify
  minutos: 30                 // a partir de cuántos minutos se palomea
};

// Calendario "🧕 Hábitos": borrar un evento de hoy = palomita en el hábito con el mismo ícono
// Se usa el ID y no el nombre, porque el emoji del nombre no coincide al copiarlo
var EVADIAPP_CAL_HABITOS = '91ca38be8b5e74d65dc02bdc5d4b300f9c647c545983e538ea7953153a181b84@group.calendar.google.com';
var EVADIAPP_PROP_HAB_TOKEN = 'EVADI_HAB_TOKEN';  // marca de "hasta aquí ya revisé" que da Calendar
var EVADIAPP_PROP_HAB_LISTA = 'EVADI_HAB_LISTA';  // eventos de hoy y mañana (id -> título y fecha)
// Hábitos "al revés" (celda del nombre): borrar su evento de hoy = X; si vuelve a aparecer = pendiente
// Hoy no hay ninguno: todos funcionan igual (borrar = palomita, [C] = X). Ej. para usarlo: ['K3']
var EVADIAPP_HAB_AL_REVES = [];

// Día anterior sin evaluar
var EVADIAPP_CORTE = 5;  // hora (0-23): antes de esta hora sigue siendo "tu noche" y no se relee el calendario de hoy
var EVADIAPP_PROP_DESCARTADO = 'EVADI_AYER_DESCARTADO';  // fecha (aaaa-mm-dd) del último día que descartaste
var EVADIAPP_MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
var EVADIAPP_DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
var EVADIAPP_DIAS_CORTO = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

// Registro de ProMe (hoja oculta, se crea sola)
var EVADIAPP_HOJA_PROMELOG = 'ProMeLog';
var EVADIAPP_PROME_IDX = null;  // índice del hábito de ProMe (se calcula una vez por ejecución)

var EVADIAPP = {
  hoja: 'EvaDi',
  hojaCal: 'Cal',
  hojaSobriedad: 'Sobriedad',
  // Orden en pantalla: primero lo religioso, luego social, mente y cuerpo.
  // texto = celda con el nombre del hábito, hecho = casilla de hecho, falle = casilla de la X
  // alerta = celda que vale "1" cuando hoy sería el tercer día sin hacerlo (la calcula la hoja desde Cal)
  habitos: [
    // Se acomodan por renglón: izquierda, derecha, izquierda, derecha...
    // cal = celda de Cal!AE1:AJ2 que dice dónde queda ese hábito en el renglón de hoy (igual que en Evaluar.gs)
    { texto: 'C4', hecho: 'E4', falle: 'D4', alerta: 'B4', cal: 'AG1' },  // Izq 1: SACoCA
    { texto: 'K5', hecho: 'M5', falle: 'L5', alerta: 'J5', cal: 'AG2' },  // Der 1: Audio / dormir
    { texto: 'C6', hecho: 'E6', falle: 'D6', alerta: 'B6', cal: 'AI1' },  // Izq 2: Rosario
    { texto: 'K7', hecho: 'M7', falle: 'L7', alerta: 'J7', cal: 'AI2' },  // Der 2: Ejercicio (lista desplegable)
    { texto: 'K4', hecho: 'M4', falle: null, alerta: 'J4', cal: 'AF2' },  // Izq 3: Santa Brígida (sin casilla de fallé)
    { texto: 'C3', hecho: 'E3', falle: 'D3', alerta: 'B3', cal: 'AF1' },  // Der 3: TAMIS
    { texto: 'K3', hecho: 'M3', falle: 'L3', alerta: 'J3', cal: 'AE2' },  // Izq 4: 🐟 (antes Pes)
    { texto: 'C7', hecho: 'E7', falle: 'D7', alerta: 'B7', cal: 'AJ1' },  // Der 4: TikTok
    { texto: 'K6', hecho: 'M6', falle: 'L6', alerta: 'J6', cal: 'AH2' },  // Izq 5: Comida (lista desplegable)
    { texto: 'C5', hecho: 'E5', falle: 'D5', alerta: 'B5', cal: 'AH1' }   // Der 5: Hacer ProMe (antes Anki)
  ]
};

/* ==================== ENTRADA ==================== */

/**
 * La pantalla vive en GitHub Pages. Aquí solo:
 * - ?accion=rosario: el link del documento del Rosario.
 * - Cualquier otra cosa: responde que está viva.
 */
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.accion === 'rosario') return evadiApp_rosarioGet_(p);
  return evadiApp_json_({ ok: true, app: 'EvaDí API' });
}

/**
 * Única puerta de entrada de la PWA.
 * Recibe: { clave, ops: [cambios pendientes], boton: '' | 'check' | 'evaluar' | ... }
 * Devuelve: { ok: true, estado } o { ok: false, error }
 */
function doPost(e) {
  var datos = {};
  try {
    datos = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return evadiApp_json_({ ok: false, error: 'Petición no válida.' });
  }

  if (!evadiApp_claveValida_(datos.clave)) {
    return evadiApp_json_({ ok: false, error: 'clave' });
  }

  // Revisión rápida: solo pregunta si hubo cambios desde la app (no lee la hoja)
  if (datos.soloVer === true) {
    return evadiApp_json_({ ok: true, ver: evadiApp_ver_() });
  }

  try {
    var ops = Array.isArray(datos.ops) ? datos.ops : [];
    var estado = evadiApp_sincronizar_(ops, String(datos.boton || ''), datos.fresco === true);
    return evadiApp_json_({ ok: true, estado: estado });
  } catch (err) {
    return evadiApp_json_({ ok: false, error: String((err && err.message) || err) });
  }
}

/* ==================== CLAVE ==================== */

/**
 * Córrela UNA vez desde el editor. Crea la clave y la muestra en el registro de ejecución.
 * Si la vuelves a correr, la clave cambia y tendrás que escribir la nueva en el cel.
 */
function evadiAppCrearClave() {
  var clave = Utilities.getUuid().replace(/-/g, '');
  PropertiesService.getScriptProperties().setProperty(EVADIAPP_PROP_CLAVE, clave);
  CacheService.getScriptCache().put('evadiClave', clave, 21600);  // la copia rápida también cambia
  Logger.log('Tu clave de EvaDí: ' + clave);
}

/**
 * Revisa que la clave que manda el cel sea la guardada.
 */
function evadiApp_claveValida_(clave) {
  // Copia rápida en la caché (6 horas) para no leer Propiedades en cada revisión
  var cache = CacheService.getScriptCache();
  var guardada = cache.get('evadiClave');
  if (!guardada) {
    guardada = PropertiesService.getScriptProperties().getProperty(EVADIAPP_PROP_CLAVE);
    if (guardada) cache.put('evadiClave', guardada, 21600);
  }
  return !!guardada && typeof clave === 'string' && clave === guardada;
}

/* ==================== ROSARIO DESDE EL DOCUMENTO ==================== */

/**
 * Córrela UNA vez desde el editor. Crea la contraseña del link del Rosario y muestra en el registro
 * el final del link. El link completo = tu URL /exec + ese final.
 * Si la vuelves a correr, el link viejo deja de servir y tienes que poner el nuevo en el documento.
 */
function evadiAppCrearLinkRosario() {
  var token = Utilities.getUuid().replace(/-/g, '');
  PropertiesService.getScriptProperties().setProperty(EVADIAPP_PROP_ROSARIO, token);
  Logger.log('Pega esto justo después de tu URL que termina en /exec:');
  Logger.log('?accion=rosario&t=' + token);
}

/**
 * ¿La contraseña del link es la guardada?
 */
function evadiApp_rosarioTokenValido_(t) {
  var guardado = PropertiesService.getScriptProperties().getProperty(EVADIAPP_PROP_ROSARIO);
  return !!guardado && typeof t === 'string' && t === guardado;
}

/**
 * Abre el link del Rosario.
 * Sin ok=1: muestra el botón para confirmar (así una vista previa del link no marca nada).
 * Con ok=1: borra el evento de hoy y palomea el Rosario.
 */
function evadiApp_rosarioGet_(p) {
  var t = String(p.t || '');
  if (!evadiApp_rosarioTokenValido_(t)) {
    return evadiApp_pagina_('Link no válido', '<p>Este link ya no sirve. Crea uno nuevo con evadiAppCrearLinkRosario.</p>', false);
  }

  if (p.ok !== '1') {
    var url = ScriptApp.getService().getUrl() + '?accion=rosario&t=' + encodeURIComponent(t) + '&ok=1';
    return evadiApp_pagina_('Rosario',
      '<p>¿Ya terminaron el Rosario?</p>' +
      '<a class="btn" href="' + url + '" target="_top">Sí, marcar hecho</a>', false);
  }

  var resultado;
  try {
    resultado = evadiApp_rosarioHecho_();
  } catch (err) {
    return evadiApp_pagina_('No se pudo', '<p>' + evadiApp_html_(String((err && err.message) || err)) + '</p>', false);
  }
  return evadiApp_pagina_('Rosario hecho', '<p>' + evadiApp_html_(resultado) + '</p>', true);
}

/**
 * Palomea el Rosario y borra su evento de HOY en "🧕 Hábitos".
 * Primero palomea (si el calendario falla, la palomita ya quedó). Se puede repetir sin problema.
 * El disparador del calendario también verá el borrado y volverá a palomear: no pasa nada.
 */
function evadiApp_rosarioHecho_() {
  var candado = LockService.getScriptLock();
  if (!candado.tryLock(25000)) throw new Error('La hoja está ocupada. Intenta de nuevo en un momento.');
  try {
    var ss = evadiApp_libro_();
    var hoja = ss.getSheetByName(EVADIAPP.hoja);
    if (!hoja) throw new Error('No encontré la pestaña EvaDi.');

    var indice = -1;
    EVADIAPP.habitos.forEach(function (h, i) { if (h.texto === EVADIAPP_ROSARIO_CELDA) indice = i; });
    if (indice < 0) throw new Error('No encontré el hábito del Rosario en la configuración.');

    // EvaDi todavía tiene el día anterior: la palomita de hoy caería en ese día
    var ayerPend = evadiApp_ayer_(ss);
    if (ayerPend) throw new Error('Primero evalúa o descarta el ' + ayerPend.texto + ' en EvaDí. Luego vuelve a abrir este link.');

    // 1) Palomita (si el día ya se evaluó, va a Cal)
    evadiApp_marcar_(ss, hoja, indice, 'hecho', true);
    SpreadsheetApp.flush();
    evadiApp_subirVer_();  // el cel y la PC se actualizan en segundos

    // 2) Borrar el evento (o eventos) del Rosario de hoy
    var tz = ss.getSpreadsheetTimeZone();
    var hoy = evadiApp_hoy_(ss);
    var buscar = evadiApp_buscadorIconos_(hoja);
    var borrados = 0;
    try {
      var inicio = new Date(Utilities.formatDate(new Date(), tz, "yyyy-MM-dd'T'00:00:00XXX"));
      var fin = new Date(inicio.getTime() + 24 * 60 * 60 * 1000);
      var r = Calendar.Events.list(EVADIAPP_CAL_HABITOS, {
        timeMin: inicio.toISOString(),
        timeMax: fin.toISOString(),
        singleEvents: true,
        maxResults: 250
      });
      (r.items || []).forEach(function (it) {
        if (!it || !it.id || it.status === 'cancelled') return;
        if (evadiApp_habCalFecha_(it.start, tz) !== hoy) return;
        if (buscar(String(it.summary || '')) !== indice) return;
        Calendar.Events.remove(EVADIAPP_CAL_HABITOS, it.id);
        borrados++;
      });
    } catch (err) {
      return 'Palomita puesta, pero no pude borrar el evento: ' + String((err && err.message) || err);
    }

    return borrados
      ? 'Palomita puesta y evento de hoy borrado.'
      : 'Palomita puesta. No había evento del Rosario hoy.';
  } finally {
    candado.releaseLock();
  }
}

/**
 * Página sencilla para el link del Rosario (se ve bien en el cel).
 */
function evadiApp_pagina_(titulo, cuerpo, ok) {
  var color = ok ? '#173404' : '#1F1F1D';
  var fondo = ok ? '#C0DD97' : '#E6F1FB';
  var html =
    '<style>' +
    'body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:' + fondo + ';color:' + color + '}' +
    '.c{max-width:420px;margin:0 auto;padding:40px 20px;text-align:center}' +
    'h1{font-size:24px;margin:0 0 16px}' +
    'p{font-size:18px;line-height:1.5;margin:0 0 20px}' +
    '.btn{display:inline-block;background:#185FA5;color:#FFFFFF;text-decoration:none;font-size:18px;font-weight:600;padding:14px 24px;border-radius:10px}' +
    '</style>' +
    '<div class="c"><h1>' + evadiApp_html_(titulo) + '</h1>' + cuerpo + '</div>';
  return HtmlService.createHtmlOutput(html)
    .setTitle('EvaDí · ' + titulo)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Escapa texto para meterlo en HTML.
 */
function evadiApp_html_(t) {
  return String(t || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ==================== SINCRONIZAR ==================== */

/**
 * Aplica los cambios pendientes, corre el botón (si hay) y devuelve el estado nuevo.
 * Todo bajo candado para que dos peticiones no se pisen.
 */
function evadiApp_sincronizar_(ops, boton, fresco) {
  var candado = LockService.getScriptLock();
  if (!candado.tryLock(25000)) throw new Error('La hoja está ocupada. Intenta de nuevo.');
  try {
    var ss = evadiApp_libro_();
    var hoja = ss.getSheetByName(EVADIAPP.hoja);
    if (!hoja) throw new Error('No encontré la pestaña EvaDi.');
    var avisos = [];

    // 1) Cambios de la fila de pendientes, en el orden en que se hicieron
    if (ops.length) evadiApp_aplicarCola_(ss, hoja, ops, avisos);

    // 2) Botón, ya con los cambios escritos
    if (boton) {
      SpreadsheetApp.flush();
      var msg = evadiApp_boton_(ss, hoja, boton);
      if (msg) avisos.push(msg);
    }

    // 3) Estado fresco
    SpreadsheetApp.flush();
    if (ops.length || boton) evadiApp_subirVer_();  // avisa a los otros aparatos que hubo cambios
    var estado = evadiAppEstado(fresco);
    estado.aviso = avisos.join(' · ');
    estado.ver = evadiApp_ver_();
    return estado;
  } finally {
    candado.releaseLock();
  }
}

/**
 * Aplica cada cambio una sola vez (por id) y junta los avisos.
 */
function evadiApp_aplicarCola_(ss, hoja, ops, avisos) {
  var cache = CacheService.getScriptCache();
  var claves = ops.map(function (op) { return 'evadiOp_' + String((op && op.id) || ''); });
  var vistas = cache.getAll(claves) || {};
  var nuevas = {};
  var diaHoja = evadiApp_diaHoja_(hoja);
  var descartadas = 0;
  var ayerPend = null, ayerLeido = false;

  try {
    ops.forEach(function (op, i) {
      var k = claves[i];
      // Sin id, o ya aplicado en un intento anterior: se salta
      if (!op || !op.id || vistas[k] || nuevas[k]) return;
      nuevas[k] = '1';

      // Cambio hecho cuando EvaDi mostraba otro día: no se aplica...
      if (op.tipo !== 'tome' && op.tipo !== 'prome' && op.tipo !== 'escalera' && op.tipo !== 'nota' && op.dia && op.dia !== diaHoja) {
        // ...salvo que sea de ayer y ayer siga sin evaluar (EvaDi todavía tiene ese día)
        if (!ayerLeido) { ayerPend = evadiApp_ayer_(ss); ayerLeido = true; }
        if (!(ayerPend && op.ymd && op.ymd === ayerPend.fecha)) { descartadas++; return; }
      }

      try {
        var aviso = evadiApp_aplicarOp_(ss, hoja, op);
        if (aviso) avisos.push(aviso);
      } catch (err) {
        avisos.push('No se guardó un cambio (' + op.tipo + '): ' + String((err && err.message) || err));
      }
    });
  } finally {
    // Se recuerdan 6 horas (lo máximo que permite CacheService)
    if (Object.keys(nuevas).length) cache.putAll(nuevas, 21600);
  }

  if (descartadas) {
    avisos.push('Se descartaron ' + descartadas + (descartadas === 1 ? ' cambio' : ' cambios') + ' de otro día.');
  }
}

/**
 * Aplica un solo cambio. Devuelve un aviso (texto) o ''.
 */
function evadiApp_aplicarOp_(ss, hoja, op) {
  switch (op.tipo) {
    case 'marcar': return evadiApp_marcar_(ss, hoja, op.indice, op.campo, op.valor);
    case 'opcion': return evadiApp_opcion_(hoja, op.indice, op.texto);
    case 'rac':    return evadiApp_rac_(ss, hoja, op.texto);
    case 'meta':   return evadiApp_meta_(ss, hoja, op.minutos);
    case 'tiempo':
      return op.modo === 'total'
        ? evadiApp_tiempoTotal_(ss, hoja, op.total)
        : evadiApp_tiempoDif_(ss, hoja, op.dif);
    case 'tome':   return evadiApp_tome_(ss, op.fecha, op.valor);
    case 'prome':  return op.valor === false ? evadiApp_promeQuitar_(ss, op.fecha) : evadiApp_prome_(ss, op.fecha);
    case 'escalera': return evadiApp_escalera_(ss, op.textos);
    case 'nota':   return evadiApp_nota_(hoja, op.indice, op.texto, op.nota);
    default: throw new Error('Cambio desconocido.');
  }
}

/* ==================== VERSIÓN DE CAMBIOS ==================== */

/**
 * Número que cambia cada vez que la app escribe algo. Vive en la caché del script (6 horas).
 * Si la caché se borra, el número cambia a '0' y los aparatos solo hacen una actualización de más.
 */
function evadiApp_ver_() {
  return CacheService.getScriptCache().get('evadiVer') || '0';
}

function evadiApp_subirVer_() {
  CacheService.getScriptCache().put('evadiVer', String(Date.now()), 21600);
}

/* ==================== LECTURA ==================== */

/**
 * Devuelve todo lo que la app necesita para pintarse.
 */
function evadiAppEstado(fresco) {
  var ss = evadiApp_libro_();
  var hoja = ss.getSheetByName(EVADIAPP.hoja);
  if (!hoja) throw new Error('No encontré la pestaña EvaDi.');

  var rango = hoja.getRange('A1:N18');
  var valores = rango.getValues();
  var visibles = rango.getDisplayValues();
  var notas = rango.getNotes();
  var reglas = rango.getDataValidations();

  var val = function (a1) { var p = evadiApp_pos_(a1); return valores[p.r][p.c]; };
  var vis = function (a1) { var p = evadiApp_pos_(a1); return visibles[p.r][p.c]; };
  var nota = function (a1) { var p = evadiApp_pos_(a1); return notas[p.r][p.c]; };

  // Día ya evaluado: palomitas, tiempo, meta y Relevante salen de Cal; las X, de la foto tomada al evaluar
  var dc = evadiApp_diaCal_(ss);
  var foto = dc.evaluado ? evadiApp_foto_(ss) : null;
  var ayer = evadiApp_ayer_(ss, dc);  // día anterior sin evaluar (EvaDi todavía lo tiene) o null

  var habitos = EVADIAPP.habitos.map(function (h, i) {
    var texto = String(val(h.texto) || '').trim();
    var emoji = texto.split(' ')[0] || '•';
    var opciones = [];
    var pos = evadiApp_pos_(h.texto);
    var regla = reglas[pos.r][pos.c];
    if (regla && regla.getCriteriaType() === SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST) {
      opciones = (regla.getCriteriaValues()[0] || []).map(String);
    }
    return {
      indice: i,
      celda: h.texto,
      texto: texto,
      emoji: emoji,
      nombre: texto.slice(emoji.length).trim(),
      nota: String(nota(h.texto) || ''),
      opciones: opciones,
      hecho: dc.evaluado ? dc.valor(h.cal) === true : val(h.hecho) === true,
      falle: !h.falle ? null : (dc.evaluado ? !!(foto && foto.falle[i] && dc.valor(h.cal) !== true) : val(h.falle) === true),
      tieneFalle: !!h.falle,
      alerta: h.alerta ? String(val(h.alerta)).trim() === '1' : false
    };
  });

  return {
    // Huella del día que muestra EvaDi: si cambia, los pendientes viejos se descartan
    dia: vis('E2') + '|' + vis('H2') + '|' + vis('L2'),
    fecha: { dia: vis('E2'), numero: vis('H2'), mes: vis('L2') },
    habitos: habitos,
    tiempo: dc.evaluado ? (Math.round(Number(dc.valor('AL1'))) || 0) : (Math.round(Number(val('J10')) * 60 + Number(val('L10'))) || 0),
    meta: dc.evaluado ? (Math.round(Number(dc.valor('AK1'))) || 0) : (Math.round(Number(val('A8'))) || 0),
    mes: {
      habitos: Number(val('A7')) || 0,
      tiempo: Number(val('A12')) || 0,
      total: Number(val('A13')) || 0,
      global: Number(val('A14')) || 0
    },
    rac: String((dc.evaluado ? dc.valor('AM1') : val('M15')) || ''),
    sobriedad: evadiApp_sobriedad_(ss),
    evaluado: dc.evaluado,
    ayer: ayer ? { fecha: ayer.fecha, texto: ayer.texto, corto: ayer.corto } : null,
    prome: evadiApp_promeEstado_(ss, fresco === true),
    aviso: ''
  };
}

/**
 * La misma huella de día, leída directo de la hoja.
 */
function evadiApp_diaHoja_(hoja) {
  return [
    hoja.getRange('E2').getDisplayValue(),
    hoja.getRange('H2').getDisplayValue(),
    hoja.getRange('L2').getDisplayValue()
  ].join('|');
}

/* ==================== ESCRITURA ==================== */

/**
 * Marca o desmarca la casilla de hecho o de fallé de un hábito.
 * Si marcas una, la otra se desmarca.
 */
function evadiApp_marcar_(ss, hoja, indice, campo, valor) {
  var h = EVADIAPP.habitos[Number(indice)];
  if (!h) throw new Error('Hábito no válido.');
  valor = valor === true;

  // Día ya evaluado: la corrección va directo a Cal (EvaDi ya está limpio para mañana)
  var dc = evadiApp_diaCal_(ss);
  if (dc.evaluado) {
    if (campo !== 'hecho' && !(campo === 'falle' && h.falle)) throw new Error('Casilla no válida.');
    var celda = dc.celda(h.cal);
    if (!celda) throw new Error('No encontré la celda de hoy en Cal.');
    if (campo === 'hecho') celda.setValue(valor);
    else if (valor) celda.setValue(false);
    var foto = evadiApp_foto_(ss) || evadiApp_fotoVacia_(ss);
    var i = Number(indice);
    if (campo === 'falle') foto.falle[i] = valor;
    else if (valor) foto.falle[i] = false;
    evadiApp_escribirFoto_(foto);
    if (i === evadiApp_promeIndice_(hoja)) {
      var hechoCal = celda.getValue() === true;
      evadiApp_promeLogMarca_(ss, dc, hechoCal, !hechoCal && foto.falle[i] === true);
    }
    return '';
  }

  if (campo === 'hecho') {
    hoja.getRange(h.hecho).setValue(valor);
    if (valor && h.falle) hoja.getRange(h.falle).setValue(false);
  } else if (campo === 'falle' && h.falle) {
    hoja.getRange(h.falle).setValue(valor);
    if (valor) hoja.getRange(h.hecho).setValue(false);
  } else {
    throw new Error('Casilla no válida.');
  }
  if (Number(indice) === evadiApp_promeIndice_(hoja)) {
    evadiApp_promeLogMarca_(ss, dc,
      hoja.getRange(h.hecho).getValue() === true,
      h.falle ? hoja.getRange(h.falle).getValue() === true : false);
  }
  return '';
}

/**
 * Cambia el nombre de un hábito y/o su nota.
 * El nombre no se toca en los hábitos con lista desplegable (ahí se elige de la lista).
 * La nota de la hoja es texto simple: las negritas y tamaños viajan como marcas (**negritas**, # título).
 */
function evadiApp_nota_(hoja, indice, texto, nota) {
  var h = EVADIAPP.habitos[Number(indice)];
  if (!h) throw new Error('Hábito no válido.');
  var celda = hoja.getRange(h.texto);
  if (typeof texto === 'string') {
    var t = texto.trim().slice(0, 200);
    var regla = celda.getDataValidation();
    var esLista = regla && regla.getCriteriaType() === SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST;
    if (t && !esLista) celda.setValue(t);
  }
  if (typeof nota === 'string') celda.setNote(nota.slice(0, 5000));
  return '';
}

/**
 * ¿Ya se evaluó hoy? Cal!AK1 dice qué celda de Cal es la de hoy (ej. W306);
 * si esa celda ya tiene algo, Evaluar ya pasó por aquí. Es la misma regla que usa el formato de EvaDi.
 */
function evadiApp_evaluado_(ss) {
  return evadiApp_diaCal_(ss).evaluado;
}

/**
 * Cambia la opción de un hábito con lista desplegable (comida o ejercicio).
 */
function evadiApp_opcion_(hoja, indice, texto) {
  var h = EVADIAPP.habitos[Number(indice)];
  if (!h) throw new Error('Hábito no válido.');
  var celda = hoja.getRange(h.texto);
  var regla = celda.getDataValidation();
  if (!regla || regla.getCriteriaType() !== SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST) {
    throw new Error('Ese hábito no tiene opciones.');
  }
  var opciones = (regla.getCriteriaValues()[0] || []).map(String);
  if (opciones.indexOf(String(texto)) < 0) throw new Error('Opción no válida.');
  celda.setValue(String(texto));
  return '';
}

/**
 * Guarda el texto de "Relevante, agradecer y chistoso" en M15.
 */
function evadiApp_rac_(ss, hoja, texto) {
  // Un solo renglón: los saltos de línea agrandan la fila de hoy en Cal
  texto = String(texto || '').replace(/\s*[\r\n]+\s*/g, ' ').trim().slice(0, 2000);
  var dc = evadiApp_diaCal_(ss);
  var celda = dc.evaluado ? dc.celda('AM1') : null;
  if (celda) celda.setValue(texto);       // día evaluado: directo a Cal
  else hoja.getRange('M15').setValue(texto);
  return '';
}

/**
 * Cambia la meta de tiempo de hoy (J12 horas, L12 minutos).
 */
function evadiApp_meta_(ss, hoja, minutos) {
  var m = Math.round(Number(minutos));
  if (isNaN(m) || m < 0 || m > 1439) throw new Error('Meta no válida.');
  var dc = evadiApp_diaCal_(ss);
  var celda = dc.evaluado ? dc.celda('AK1') : null;
  if (celda) { celda.setValue(m); return ''; }  // día evaluado: directo a Cal
  hoja.getRange('J12').setValue(Math.floor(m / 60));
  hoja.getRange('L12').setValue(m % 60);
  return '';
}

/**
 * Tiempo de hoy que se ve en EvaDi (J10 horas, L10 minutos), en minutos.
 */
function evadiApp_tiempoActual_(ss, hoja) {
  SpreadsheetApp.flush(); // que J10/L10 ya reflejen ajustes anteriores del mismo lote
  var dc = evadiApp_diaCal_(ss);
  if (dc.evaluado) return Math.round(Number(dc.valor('AL1'))) || 0;  // día evaluado: el tiempo vive en Cal
  return Math.round(Number(hoja.getRange('J10').getValue()) * 60 + Number(hoja.getRange('L10').getValue())) || 0;
}

/**
 * Deja el tiempo de hoy en el valor que escribiste (se usa cuando hay señal).
 */
function evadiApp_tiempoTotal_(ss, hoja, minutos) {
  var objetivo = Math.round(Number(minutos));
  if (isNaN(objetivo) || objetivo < 0 || objetivo > 1439) throw new Error('Tiempo no válido.');
  return evadiApp_tiempoDif_(ss, hoja, objetivo - evadiApp_tiempoActual_(ss, hoja));
}

/**
 * Suma o resta minutos al tiempo de hoy (se usa con lo que hiciste sin señal).
 * No toca D10 (donde escribe Clockify): guarda la diferencia como ajuste,
 * igual que hacían Sumar/Restar (N1 y N2), o en la celda de Cal si el día ya se evaluó.
 */
function evadiApp_tiempoDif_(ss, hoja, dif) {
  dif = Math.round(Number(dif));
  if (isNaN(dif) || Math.abs(dif) > 1439) throw new Error('Ajuste de tiempo no válido.');
  if (dif === 0) return '';

  var actual = evadiApp_tiempoActual_(ss, hoja);
  var aviso = '';
  var cal = ss.getSheetByName(EVADIAPP.hojaCal);
  var puntero = cal ? String(cal.getRange('AL1').getValue()).trim() : '';
  var celdaCal = puntero ? cal.getRange(puntero) : null;

  if (celdaCal && celdaCal.getValue() !== '' && celdaCal.getValue() !== null) {
    // El día ya se evaluó: el tiempo sale de Cal
    var nuevoCal = Number(celdaCal.getValue()) + dif;
    if (nuevoCal < 0) { nuevoCal = 0; aviso = 'No puede quedar abajo de 0:00.'; }
    celdaCal.setValue(nuevoCal);
  } else {
    // Día abierto: el ajuste vive en N1 (y N2 como hacía Sumar/Restar)
    var n1 = Number(hoja.getRange('N1').getValue()) || 0;
    var n2 = Number(hoja.getRange('N2').getValue()) || 0;
    var nuevoN1 = n1 + dif;
    if (nuevoN1 < 0) {
      aviso = 'Clockify ya registró más tiempo: lo más bajo posible es ' + evadiApp_hm_(actual - n1) + '.';
      nuevoN1 = 0;
    }
    hoja.getRange('N1').setValue(nuevoN1);
    hoja.getRange('N2').setValue(Math.max(0, n2 + dif));
  }
  return aviso;
}

/**
 * Marca o desmarca "Tomé" en la hoja Sobriedad para la fecha indicada (aaaa-mm-dd).
 * La fecha viene del cel, así un cambio hecho sin señal cae en el día correcto.
 */
function evadiApp_tome_(ss, fecha, valor) {
  var sh = evadiApp_hojaSobriedad_(ss);
  var hoy = evadiApp_hoy_(ss);
  fecha = String(fecha || hoy);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new Error('Fecha no válida.');
  if (fecha > hoy) fecha = hoy; // por si el reloj del cel va adelantado

  var ultima = sh.getLastRow();
  var filas = ultima > 1 ? sh.getRange(2, 1, ultima - 1, 2).getDisplayValues() : [];
  var filaDia = -1;
  for (var i = 0; i < filas.length; i++) {
    if (String(filas[i][0]).trim() === fecha && String(filas[i][1]).trim() === 'Tomé') { filaDia = i + 2; break; }
  }
  if (valor === true && filaDia < 0) {
    sh.appendRow([fecha, 'Tomé']);
  } else if (valor !== true && filaDia > 0) {
    sh.deleteRow(filaDia);
  }
  return '';
}

/* ==================== PROME ==================== */
// Usa la configuración de EventosProMe.gs (PROME_HOJA, PROME_FILA, PROME_CALENDARIO_ID, etc.)

/**
 * Propósito, texto de Hoy, escalera completa y si el evento de hoy ya está en el calendario.
 * Si EventosProMe.gs no está en el proyecto, devuelve null y la app no muestra el renglón.
 * fresco = true consulta el calendario sin usar lo recordado (al abrir la app o tocar ↻).
 */
function evadiApp_promeEstado_(ss, fresco) {
  if (typeof PROME_HOJA === 'undefined' || typeof PROME_FILA === 'undefined') return null;
  var sh = ss.getSheetByName(PROME_HOJA);
  if (!sh) return null;

  // Propósito: B2:D4, cada pedazo en su celda, se une en un solo texto
  var proposito = sh.getRange('B2:D4').getDisplayValues()
    .map(function (f) { return f.join(' '); })
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Columnas B:D, de "Algún día" (5 renglones arriba) hasta "Hoy"
  var filas = sh.getRange(PROME_FILA - 5, 2, 6, 3).getDisplayValues();
  var escalera = filas.map(function (f) {
    return { nivel: String(f[1] || f[0]).trim(), texto: String(f[2]).trim() };
  });

  return {
    proposito: proposito,
    texto: escalera[escalera.length - 1].texto,
    escalera: escalera,
    agendado: evadiApp_promeAgendado_(ss, fresco === true)
  };
}

/**
 * Guarda la escalera editada desde la app en ProMe (columna D, de "Algún día" a "Hoy").
 */
function evadiApp_escalera_(ss, textos) {
  if (typeof PROME_HOJA === 'undefined') throw new Error('No encontré EventosProMe.gs en el proyecto.');
  if (!Array.isArray(textos) || textos.length !== 6) throw new Error('Escalera no válida.');
  var sh = ss.getSheetByName(PROME_HOJA);
  var valores = textos.map(function (t) { return [String(t || '').trim().slice(0, 500)]; });
  sh.getRange(PROME_FILA - 5, PROME_COL_TEXTO, 6, 1).setValues(valores);
  return '';
}

/**
 * Quita del calendario los eventos de hoy con la etiqueta [wpro] (al desmarcar en la app).
 */
function evadiApp_promeQuitar_(ss, fecha) {
  var hoy = evadiApp_hoy_(ss);
  if (String(fecha || '') !== hoy) return 'El ProMe de otro día no se quitó.';

  // Si el hábito ya está marcado, quitarlo borraría el registro de que sí lo hiciste
  var reg = evadiApp_promeLogLeer_(ss, hoy);
  if (reg && reg.resultado) return 'Primero quítale la palomita o la X al hábito de ProMe: hoy ya está marcado (' + reg.resultado + ').';

  // Hoy ya no hay ProMe planeado: se borra su renglón del registro
  if (reg) {
    var sh = evadiApp_promeLogHoja_(ss);
    sh.getRange(reg.fila, 1, 1, 4).clearContent();
    try { sh.deleteRow(reg.fila); } catch (err) { /* si no se puede borrar, queda vacío y no cuenta */ }
  }

  // Se recuerdan los eventos que quitaste aquí: el disparador del calendario no los cuenta como palomita
  var cache = CacheService.getScriptCache();
  var quitados = evadiApp_promeQuitados_();
  evadiApp_promeEventosHoy_().forEach(function (ev) {
    quitados.push(String(ev.getId()).replace(/@google\.com$/, ''));
    ev.deleteEvent();
  });
  cache.put('evadiProMeQuitados', JSON.stringify(quitados.slice(-50)), 21600);
  cache.put('evadiProMe_' + hoy, '0', 120);
  return '';
}

/** Ids de los eventos de ProMe que quitaste desde el renglón de arriba (6 horas). */
function evadiApp_promeQuitados_() {
  try {
    var l = JSON.parse(CacheService.getScriptCache().get('evadiProMeQuitados') || '[]');
    return Array.isArray(l) ? l : [];
  } catch (err) {
    return [];
  }
}

/** ¿Es un evento de ProMe? Por el ícono al inicio (o la etiqueta [wpro] de los eventos viejos). */
function evadiApp_esEventoProMe_(titulo) {
  var t = String(titulo || '');
  if (typeof PROME_ETIQUETA !== 'undefined' && t.indexOf(PROME_ETIQUETA) >= 0) return true;
  return typeof PROME_ICONO !== 'undefined' && evadiApp_icono_(t) === evadiApp_icono_(PROME_ICONO);
}

/**
 * Agrega un evento recién creado a la lista que usa el disparador de 🧕 Hábitos
 * (Calendar no dice el título de un evento borrado; si lo borras antes de que el disparador lo vea, así sí cuenta).
 */
function evadiAppHabListaAgregar(ev) {
  try {
    var ss = evadiApp_libro_();
    var lista = evadiApp_habCalLeerLista_();
    var id = String(ev.getId()).replace(/@google\.com$/, '');
    lista[id] = {
      t: String(ev.getTitle()).slice(0, 80),
      f: Utilities.formatDate(ev.getStartTime(), ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd')
    };
    PropertiesService.getScriptProperties().setProperty(EVADIAPP_PROP_HAB_LISTA, JSON.stringify(lista));
  } catch (err) {
    Logger.log('No se agregó el evento a la lista de hábitos: ' + err);
  }
}

/**
 * Eventos de ProMe de hoy (los que empiezan con el ícono ❗).
 */
function evadiApp_promeEventosHoy_() {
  var cal = CalendarApp.getCalendarById(PROME_CALENDARIO_ID);
  if (!cal) throw new Error('No encontré el calendario de ProMe.');
  return cal.getEventsForDay(new Date()).filter(function (ev) {
    return evadiApp_esEventoProMe_(ev.getTitle());
  });
}

/** Texto del ProMe dentro del título de su evento (sin el ícono ni la etiqueta vieja). */
function evadiApp_promeTextoEvento_(titulo) {
  var t = String(titulo || '');
  if (typeof PROME_ETIQUETA !== 'undefined') t = t.replace(PROME_ETIQUETA, '');
  if (typeof PROME_ICONO !== 'undefined') t = t.replace(PROME_ICONO, '');
  return t.replace(/[\uFE0E\uFE0F]/g, '').trim();
}

/**
 * ¿Ya hay un evento de hoy con la etiqueta [wpro] en el calendario de ProMe?
 * Se recuerda 2 minutos para no consultar el calendario en cada actualización automática.
 */
function evadiApp_promeAgendado_(ss, fresco) {
  var cache = CacheService.getScriptCache();
  var clave = 'evadiProMe_' + evadiApp_hoy_(ss);
  if (!fresco) {
    var guardado = cache.get(clave);
    if (guardado !== null) return guardado === '1';
  }
  var si = false;
  try {
    // Hay ProMe de hoy en el registro (aunque ya hayas borrado el evento al hacerlo)
    var reg = evadiApp_promeLogLeer_(ss, evadiApp_hoy_(ss));
    if (reg && String(reg.texto).trim()) {
      cache.put(clave, '1', 120);
      return true;
    }
    var cal = CalendarApp.getCalendarById(PROME_CALENDARIO_ID);
    if (cal) {
      si = cal.getEventsForDay(new Date()).some(function (ev) {
        return evadiApp_esEventoProMe_(ev.getTitle());
      });
    }
  } catch (err) {
    si = false;
  }
  cache.put(clave, si ? '1' : '0', 120);
  return si;
}

/**
 * Agenda el evento de ProMe de hoy con tu función crearEventoProMe.
 * Solo si el cambio es de hoy (si llegó tarde desde el cel, de otro día, no se agenda)
 * y si todavía no hay uno, para no duplicarlo.
 */
function evadiApp_prome_(ss, fecha) {
  if (typeof crearEventoProMe !== 'function') throw new Error('No encontré EventosProMe.gs en el proyecto.');
  var hoy = evadiApp_hoy_(ss);
  if (String(fecha || '') !== hoy) return 'El ProMe de otro día no se agendó.';
  var cache = CacheService.getScriptCache();

  // Ya hay evento hoy: no se duplica, solo se asegura que esté en el registro
  var eventos = evadiApp_promeEventosHoy_();
  if (eventos.length) {
    var reg = evadiApp_promeLogLeer_(ss, hoy);
    if (!reg || !String(reg.texto).trim()) evadiAppProMeRegistrar(hoy, evadiApp_promeTextoEvento_(eventos[0].getTitle()));
    cache.put('evadiProMe_' + hoy, '1', 120);
    return 'ProMe ya estaba agendado hoy.';
  }

  var sh = ss.getSheetByName(PROME_HOJA);
  var titulo = String(sh.getRange(PROME_FILA, PROME_COL_TEXTO).getValue()).trim();
  if (titulo === '') return 'El resultado de Hoy en ProMe está vacío.';

  crearEventoProMe(titulo);  // también lo anota en el registro
  cache.put('evadiProMe_' + hoy, '1', 120);
  return 'ProMe de hoy agendado: ' + titulo;
}

/**
 * Ejecuta uno de los botones de EvaDi llamando a tus scripts existentes.
 */
function evadiApp_boton_(ss, hoja, nombre) {
  try {
    // Día anterior sin evaluar: EvaDi todavía tiene ese día
    var ayer = evadiApp_ayer_(ss);
    if (nombre === 'evaluar' && ayer) nombre = 'evaluarAyer';  // evaluar a las 12:30 cae en su día
    if ((nombre === 'evaluarAyer' || nombre === 'descartarAyer') && !ayer) {
      return 'No hay un día anterior pendiente de evaluar.';
    }
    if (ayer && (nombre === 'check' || nombre === 'tiempoHoy')) {
      return 'Primero evalúa o descarta el ' + ayer.texto + '.';
    }

    // Con el día evaluado, estos botones moverían EvaDi (que ya es de mañana) o volverían a evaluar
    if (['check', 'tiempoHoy', 'exentar', 'evaluar'].indexOf(nombre) >= 0 && evadiApp_evaluado_(ss)) {
      return 'Hoy ya está evaluado: ese botón no se ejecutó.';
    }
    switch (nombre) {
      case 'check':
        // Botón "Check hábitos": primero los demás hábitos desde el calendario, luego TikTok desde Clockify
        var avisoCal = evadiApp_habitosCalHoy_(ss, hoja);
        var avisoTik = evadiApp_tiktokClockify_(ss, hoja);
        return avisoCal + ' · ' + avisoTik;
      case 'tiempoHoy':
        calcularTiempoHoy();
        return 'Meta de hoy calculada';
      case 'tiempoManana':
        calcularTiempoCalendario();
        return 'Meta de mañana calculada';
      case 'ejercicio':
        hoja.getRange('M16').setValue(true);
        SpreadsheetApp.flush();
        ejercicio({
          source: { getActiveSheet: function () { return hoja; } },
          range: hoja.getRange('M16'),
          value: 'TRUE'
        });
        return 'Evento de ejercicio creado';
      case 'exentar':
        disparadorExentar({ source: ss, range: hoja.getRange('G16'), value: 'TRUE' });
        evadiApp_quitarX_(hoja);  // que no quede palomita y X al mismo tiempo
        return 'Día exentado';
      case 'evaluar':
        return evadiApp_evaluar_(ss, hoja, null);
      case 'evaluarAyer':
        return evadiApp_evaluar_(ss, hoja, ayer);
      case 'descartarAyer':
        if (!evadiApp_evaluarNuevo_()) return 'Error: falta pegar el Evaluar.gs nuevo en Apps Script.';
        Evaluar({ evadi: true, soloLimpiar: true });  // limpia EvaDi sin copiar nada a Cal
        PropertiesService.getScriptProperties().setProperty(EVADIAPP_PROP_DESCARTADO, ayer.fecha);
        var relDesc = ayer.bloquea ? evadiApp_habitosCalHoy_(ss, hoja) : '';
        return 'Se descartó el ' + ayer.texto + (relDesc ? ' · ' + relDesc : '');
      default:
        throw new Error('Botón desconocido.');
    }
  } catch (err) {
    // Si algo falla, dejar las casillas de los botones en FALSO
    ['G16', 'G18', 'M16', 'M18'].forEach(function (c) { hoja.getRange(c).setValue(false); });
    var msg = String((err && err.message) || err);
    if (/getUi/i.test(msg)) return 'No se encontró el calendario que usa este botón.';
    return 'Error: ' + msg;
  }
}

/* ==================== EVALUAR ==================== */

/**
 * Evalúa con tu Evaluar(). ayer = null evalúa hoy; con ayer, escribe en el renglón de ayer.
 * Evaluar() se detiene sin limpiar EvaDi si algo no llegó a Cal (el error sale en la app).
 */
function evadiApp_evaluar_(ss, hoja, ayer) {
  if (ayer && !evadiApp_evaluarNuevo_()) return 'Error: falta pegar el Evaluar.gs nuevo en Apps Script.';

  // Relevante sin saltos de línea, para que la fila del día en Cal no se haga más alta
  var celdaRac = hoja.getRange('M15');
  var textoRac = String(celdaRac.getValue() || '');
  if (/[\r\n]/.test(textoRac)) celdaRac.setValue(textoRac.replace(/\s*[\r\n]+\s*/g, ' ').trim());

  if (!ayer) evadiApp_guardarFoto_(ss, hoja);  // las X de hoy, para seguir viéndolas después de evaluar
  evadiApp_promeLogCerrar_(ss, hoja, ayer ? ayer.fecha : evadiApp_hoy_(ss));  // Resultado final de ProMe

  var avisos = Evaluar(ayer ? { evadi: true, fila: ayer.fila, diasAtras: 1 } : { evadi: true });
  var partes = [ayer ? 'Se evaluó el ' + ayer.texto : 'Día evaluado'];
  if (Array.isArray(avisos)) partes = partes.concat(avisos);

  // ProMe: el que sigue al día evaluado (si evaluaste ayer, es el de hoy)
  var avisoProMe = evadiApp_promeManana_(ss, ayer ? 1 : 0);
  if (avisoProMe) partes.push(avisoProMe);

  // Ya de día: EvaDi quedó limpio, se vuelven a leer los hábitos de hoy desde el calendario
  if (ayer && ayer.bloquea) partes.push(evadiApp_habitosCalHoy_(ss, hoja));
  return partes.join(' · ');
}

/** ¿Está pegado el Evaluar.gs que acepta opciones (renglón de ayer y descartar)? */
function evadiApp_evaluarNuevo_() {
  return typeof EVALUAR_VERSION !== 'undefined' && EVALUAR_VERSION >= 2;
}

/**
 * Evaluar desde la casilla M18 de la hoja (lo llama miActivadorDeEdicion de Evaluar.gs).
 * Mismo camino que el botón de la app: candado, no evalúa dos veces, evalúa ayer si se te pasó,
 * agenda el ProMe y avisa a la app. El resultado sale como aviso abajo a la derecha de la hoja.
 */
function evadiAppEvaluarDesdeHoja() {
  var ss = evadiApp_libro_();
  var hoja = ss.getSheetByName(EVADIAPP.hoja);
  if (!hoja) return;
  var candado = LockService.getScriptLock();
  if (!candado.tryLock(25000)) {
    hoja.getRange('M18').setValue(false);
    ss.toast('La hoja está ocupada. Vuelve a marcar Evaluar en un momento.', 'EvaDí', 8);
    return;
  }
  var msg = '';
  try {
    SpreadsheetApp.flush();
    msg = evadiApp_boton_(ss, hoja, 'evaluar');
    hoja.getRange('M18').setValue(false);
    SpreadsheetApp.flush();
    evadiApp_subirVer_();  // el cel y la PC se actualizan en segundos
  } finally {
    candado.releaseLock();
  }
  ss.toast(msg, 'EvaDí', 8);
}

/**
 * Quita la X de los hábitos que tienen palomita (Exentar palomea pero no quita las X).
 */
function evadiApp_quitarX_(hoja) {
  SpreadsheetApp.flush();
  var valores = hoja.getRange('A1:N18').getValues();
  EVADIAPP.habitos.forEach(function (h) {
    if (!h.falle) return;
    var ph = evadiApp_pos_(h.hecho), pf = evadiApp_pos_(h.falle);
    if (valores[ph.r][ph.c] === true && valores[pf.r][pf.c] === true) hoja.getRange(h.falle).setValue(false);
  });
}

/**
 * Día anterior sin evaluar.
 * Es "pendiente" si: hoy no está evaluado, el renglón de ayer en Cal tiene W vacío
 * y no lo descartaste. En ese caso EvaDi todavía tiene los datos de ayer.
 * Devuelve { fecha, fila, texto: 'martes 14', corto: 'Mar 14 de oct', bloquea } o null.
 * bloquea = ya son las 5:00 o más (al resolverlo se relee el calendario de hoy).
 */
function evadiApp_ayer_(ss, dc) {
  dc = dc || evadiApp_diaCal_(ss);
  if (!dc.fila || dc.evaluado) return null;

  var hoy = evadiApp_hoy_(ss);
  var fecha = evadiApp_restarDia_(hoy);
  if (PropertiesService.getScriptProperties().getProperty(EVADIAPP_PROP_DESCARTADO) === fecha) return null;

  var p = fecha.split('-').map(Number);
  var etiqueta = (p[2] < 10 ? '0' : '') + p[2] + '-' + EVADIAPP_MESES[p[1] - 1];  // como en Cal: 14-octubre

  // Ayer está arriba de hoy; el día 1 hay que brincar el renglón de totales y el vacío
  var colW = evadiApp_pos_(dc.dir('AK1')).c + 1;
  var desde = Math.max(1, dc.fila - 3);
  var n = dc.fila - desde;
  if (n < 1) return null;
  var cal = ss.getSheetByName(EVADIAPP.hojaCal);
  var datos = cal.getRange(desde, 1, n, colW).getDisplayValues();
  for (var i = n - 1; i >= 0; i--) {
    if (evadiApp_normal_(datos[i][0]) !== etiqueta) continue;
    if (String(datos[i][colW - 1]).trim() !== '') return null;  // ayer sí se evaluó
    var dSem = new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay();
    var hora = Number(Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), 'H'));
    return {
      fecha: fecha,
      fila: desde + i,
      texto: EVADIAPP_DIAS[dSem] + ' ' + p[2],
      corto: EVADIAPP_DIAS_CORTO[dSem] + ' ' + p[2] + ' de ' + EVADIAPP_MESES[p[1] - 1].slice(0, 3),
      bloquea: hora >= EVADIAPP_CORTE
    };
  }
  return null;
}

/* ==================== REGISTRO DE PROME ==================== */
// Hoja oculta "ProMeLog": Fecha | ProMe | Resultado | Hora. Un renglón por día.
// Resultado: Hecho, No me dio tiempo o No se hizo (este último lo pone Evaluar). Vacío = pendiente.

/**
 * Anota el texto del ProMe de un día (lo llama crearEventoProMe de EventosProMe.gs y el ProMe de mañana).
 * fecha = Date o 'aaaa-mm-dd'. Si el día ya tenía resultado, lo respeta.
 */
function evadiAppProMeRegistrar(fecha, texto) {
  try {
    var ss = evadiApp_libro_();
    var f = fecha instanceof Date ? Utilities.formatDate(fecha, ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd') : String(fecha);
    evadiApp_promeLogEscribir_(ss, f, { texto: String(texto || '').trim() });
    CacheService.getScriptCache().remove('evadiProMe_' + f);  // el renglón de arriba se recalcula
  } catch (err) {
    Logger.log('No se anotó el ProMe en el registro: ' + err);
  }
}

/** Hoja del registro. Se crea sola, oculta. */
function evadiApp_promeLogHoja_(ss) {
  var sh = ss.getSheetByName(EVADIAPP_HOJA_PROMELOG);
  if (!sh) {
    sh = ss.insertSheet(EVADIAPP_HOJA_PROMELOG, ss.getSheets().length);
    sh.getRange('A:A').setNumberFormat('@');
    sh.getRange('D:D').setNumberFormat('@');
    sh.getRange('A1:D1').setValues([['Fecha', 'ProMe', 'Resultado', 'Hora']]).setFontWeight('bold');
    sh.setFrozenRows(1);
    sh.hideSheet();
  }
  return sh;
}

/** Renglón del registro para una fecha (aaaa-mm-dd), o -1. */
function evadiApp_promeLogFila_(sh, fecha) {
  var ultima = sh.getLastRow();
  if (ultima < 2) return -1;
  var fechas = sh.getRange(2, 1, ultima - 1, 1).getDisplayValues();
  for (var i = fechas.length - 1; i >= 0; i--) {
    if (String(fechas[i][0]).trim() === fecha) return i + 2;
  }
  return -1;
}

/** { fila, texto, resultado, hora } de una fecha, o null. */
function evadiApp_promeLogLeer_(ss, fecha) {
  var sh = ss.getSheetByName(EVADIAPP_HOJA_PROMELOG);
  if (!sh) return null;
  var f = evadiApp_promeLogFila_(sh, fecha);
  if (f < 0) return null;
  var v = sh.getRange(f, 1, 1, 4).getDisplayValues()[0];
  return { fila: f, texto: v[1], resultado: v[2], hora: v[3] };
}

/**
 * Crea o actualiza el renglón de una fecha. cambios = { texto, resultado, hora } (lo que no venga, no se toca).
 * Los renglones quedan en orden de fecha.
 */
function evadiApp_promeLogEscribir_(ss, fecha, cambios) {
  var sh = evadiApp_promeLogHoja_(ss);
  var f = evadiApp_promeLogFila_(sh, fecha);
  var fila = f > 0 ? sh.getRange(f, 1, 1, 4).getDisplayValues()[0] : [fecha, '', '', ''];
  fila[0] = fecha;
  if (cambios.texto !== undefined) fila[1] = cambios.texto;
  if (cambios.resultado !== undefined) fila[2] = cambios.resultado;
  if (cambios.hora !== undefined) fila[3] = cambios.hora;
  if (f > 0) {
    sh.getRange(f, 1, 1, 4).setValues([fila]);
    return;
  }
  var ultima = sh.getLastRow();
  var anterior = ultima >= 2 ? String(sh.getRange(ultima, 1).getDisplayValue()).trim() : '';
  sh.getRange(ultima + 1, 1, 1, 4).setValues([fila]);
  if (anterior && anterior > fecha) sh.getRange(2, 1, ultima, 4).sort(1);  // llegó un día anterior: reordenar
}

/** Índice del hábito de ProMe (el que empieza con PROME_ICONO), o -1. */
function evadiApp_promeIndice_(hoja) {
  if (EVADIAPP_PROME_IDX !== null) return EVADIAPP_PROME_IDX;
  EVADIAPP_PROME_IDX = -1;
  if (typeof PROME_ICONO === 'undefined') return -1;
  var ic = evadiApp_icono_(PROME_ICONO);
  var valores = hoja.getRange('A1:N18').getValues();
  EVADIAPP.habitos.forEach(function (h, i) {
    var p = evadiApp_pos_(h.texto);
    if (evadiApp_icono_(valores[p.r][p.c]) === ic) EVADIAPP_PROME_IDX = i;
  });
  return EVADIAPP_PROME_IDX;
}

/**
 * Cambió la casilla del hábito de ProMe: anota Resultado y Hora en el día que corresponde
 * (hoy, o ayer si EvaDi todavía tiene ese día sin evaluar). Pendiente = Resultado y Hora vacíos.
 */
function evadiApp_promeLogMarca_(ss, dc, hecho, falle) {
  try {
    var fecha = evadiApp_hoy_(ss);
    if (!dc.evaluado) {
      var ay = evadiApp_ayer_(ss, dc);
      if (ay) fecha = ay.fecha;
    }
    var res = hecho ? 'Hecho' : (falle ? 'No me dio tiempo' : '');
    if (!res && !evadiApp_promeLogLeer_(ss, fecha)) return;  // pendiente y sin renglón: nada que anotar
    var hora = res ? Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), 'HH:mm') : '';
    evadiApp_promeLogEscribir_(ss, fecha, { resultado: res, hora: hora });
  } catch (err) {
    Logger.log('No se anotó el resultado de ProMe: ' + err);
  }
}

/**
 * Al evaluar: Resultado final del día según EvaDi. Si quedó pendiente, "No se hizo".
 * La hora se queda como estaba.
 */
function evadiApp_promeLogCerrar_(ss, hoja, fecha) {
  var i = evadiApp_promeIndice_(hoja);
  if (i < 0) return;
  try {
    var h = EVADIAPP.habitos[i];
    var hecho = hoja.getRange(h.hecho).getValue() === true;
    var falle = h.falle ? hoja.getRange(h.falle).getValue() === true : false;
    evadiApp_promeLogEscribir_(ss, fecha, { resultado: hecho ? 'Hecho' : (falle ? 'No me dio tiempo' : 'No se hizo') });
  } catch (err) {
    Logger.log('No se cerró el día de ProMe en el registro: ' + err);
  }
}

/* ==================== CLOCKIFY: TIKTOK ==================== */

/**
 * Lee en Clockify cuánto lleva hoy "TikTok afiliado".
 * 30 min o más: palomita en el hábito de TikTok (y la X se quita).
 * Menos de 30: sus dos casillas (hecho y fallé) quedan desmarcadas.
 * Si Clockify no responde, no toca nada y devuelve el aviso.
 */
function evadiApp_tiktokClockify_(ss, hoja) {
  var indice = -1;
  EVADIAPP.habitos.forEach(function (h, i) { if (h.texto === EVADIAPP_TIKTOK.celda) indice = i; });
  if (indice < 0) return 'TikTok: no encontré el hábito en la configuración.';

  var minutos;
  try {
    minutos = evadiApp_minutosClockify_(ss, EVADIAPP_TIKTOK.buscar);
  } catch (err) {
    return 'TikTok sin revisar: ' + String((err && err.message) || err);
  }

  if (minutos >= EVADIAPP_TIKTOK.minutos) {
    evadiApp_marcar_(ss, hoja, indice, 'hecho', true);   // palomita (y quita la X)
    return 'TikTok ' + evadiApp_hm_(minutos) + ': palomita';
  }
  evadiApp_marcar_(ss, hoja, indice, 'hecho', false);    // sin palomita
  evadiApp_marcar_(ss, hoja, indice, 'falle', false);    // sin X
  return 'TikTok ' + evadiApp_hm_(minutos) + ': sin marcar';
}

/**
 * Minutos de hoy (zona horaria de la hoja) en los registros de Clockify cuyo proyecto,
 * tarea o descripción contenga el texto buscado. Incluye el cronómetro que esté corriendo.
 */
function evadiApp_minutosClockify_(ss, buscar) {
  var props = PropertiesService.getScriptProperties();
  var apiKey = props.getProperty(EVADIAPP_PROP_CLOCKIFY);
  if (!apiKey) throw new Error('falta CLOCKIFY_API_KEY en Propiedades del script.');

  var base = 'https://api.clockify.me/api/v1';
  var opciones = { method: 'get', headers: { 'X-Api-Key': apiKey }, muteHttpExceptions: true };
  var leer = function (url) {
    var r = UrlFetchApp.fetch(url, opciones);
    var codigo = r.getResponseCode();
    if (codigo === 401 || codigo === 403) throw new Error('Clockify no aceptó la API key.');
    if (codigo === 429) throw new Error('se acabaron las 30 consultas de esta hora en Clockify.');
    if (codigo !== 200) throw new Error('Clockify respondió ' + codigo + '.');
    return JSON.parse(r.getContentText());
  };

  // Tu usuario y espacio de trabajo se piden una sola vez y se guardan en Propiedades del script
  var uid = props.getProperty(EVADIAPP_PROP_CLOCKIFY_USER);
  var ws = props.getProperty(EVADIAPP_PROP_CLOCKIFY_WS);
  if (!uid || !ws) {
    var yo = leer(base + '/user');
    uid = yo.id;
    ws = ws || yo.activeWorkspace || yo.defaultWorkspace;
    if (!ws || !uid) throw new Error('no encontré tu espacio de trabajo de Clockify.');
    props.setProperty(EVADIAPP_PROP_CLOCKIFY_USER, uid);
    props.setProperty(EVADIAPP_PROP_CLOCKIFY_WS, ws);
  }

  // Medianoche de hoy en la zona horaria de la hoja
  var tz = ss.getSpreadsheetTimeZone();
  var ahora = new Date();
  var inicio = new Date(Utilities.formatDate(ahora, tz, "yyyy-MM-dd'T'00:00:00XXX"));
  var iso = function (d) { return d.toISOString().replace(/\.\d{3}Z$/, 'Z'); };

  var objetivo = evadiApp_normal_(buscar);
  var vistos = {};
  var totalMs = 0;
  var sumar = function (te) {
    if (!te || !te.id || vistos[te.id]) return;
    vistos[te.id] = true;
    var textos = [te.description, te.project && te.project.name, te.task && te.task.name].map(evadiApp_normal_);
    if (!textos.some(function (t) { return t && t.indexOf(objetivo) >= 0; })) return;
    var ti = te.timeInterval || {};
    var a = new Date(ti.start);
    var b = ti.end ? new Date(ti.end) : ahora;  // sin fin = cronómetro corriendo
    if (a < inicio) a = inicio;
    if (b > a) totalMs += b - a;
  };

  var raiz = base + '/workspaces/' + ws + '/user/' + uid + '/time-entries?hydrated=true';

  // Registros de hoy, incluido el cronómetro que esté corriendo: 1 consulta
  // (solo pide otra página si hoy hay más de 200 registros)
  for (var pag = 1; pag <= 10; pag++) {
    var lista = leer(raiz + '&start=' + encodeURIComponent(iso(inicio)) + '&page=' + pag + '&page-size=200');
    if (!Array.isArray(lista) || !lista.length) break;
    lista.forEach(sumar);
    if (lista.length < 200) break;
  }

  return Math.floor(totalMs / 60000);
}

/**
 * Texto en minúsculas, sin acentos y con espacios sencillos, para comparar nombres.
 */
function evadiApp_normal_(t) {
  return String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Prueba manual desde el editor: dice cuánto lleva hoy TikTok afiliado sin marcar nada.
 * Córrela una vez para dar el permiso de conectarse a Clockify.
 */
function evadiAppProbarTikTok() {
  var ss = evadiApp_libro_();
  var minutos = evadiApp_minutosClockify_(ss, EVADIAPP_TIKTOK.buscar);
  Logger.log('TikTok afiliado hoy: ' + evadiApp_hm_(minutos) + ' (' + minutos + ' min). No se marcó nada.');
}

/* ==================== CALENDARIO 🧕 HÁBITOS ==================== */
// Necesita el servicio avanzado "Google Calendar API" (identificador: Calendar) prendido en el editor.

/**
 * Córrela UNA vez desde el editor (y otra vez si algún día cambias el calendario).
 * Crea el disparador del calendario, la primera marca de "hasta aquí ya revisé" y la lista de eventos.
 * Si ya existía, lo reemplaza (y quita la revisión diaria de una versión anterior, si quedó).
 */
function evadiAppInstalarHabitosCal() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    var f = t.getHandlerFunction();
    if (f === 'evadiAppHabitoBorrado' || f === 'evadiAppRevisarAlReves') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('evadiAppHabitoBorrado')
    .forUserCalendar(EVADIAPP_CAL_HABITOS)
    .onEventUpdated()
    .create();

  var ss = evadiApp_libro_();
  PropertiesService.getScriptProperties().setProperty(EVADIAPP_PROP_HAB_TOKEN, evadiApp_habCalTokenNuevo_());
  var n = Object.keys(evadiApp_habCalGuardarLista_(ss)).length;
  Logger.log('Listo: disparador creado y ' + n + ' eventos de hoy y mañana guardados.');
}

/**
 * Botón "Check hábitos": revisa de una vez todos los hábitos (menos TikTok) contra los eventos de HOY
 * del calendario "🧕 Hábitos". Misma regla que el disparador:
 * - Sin evento hoy (lo borraste): palomita (y se quita la X).
 * - Evento con [C] al final (CalenGoo = no me dio tiempo): X. Santa Brígida no tiene X: queda sin palomita.
 * - Evento sin [C]: pendiente (las dos casillas vacías).
 * Si un hábito tiene varios eventos hoy (ej. ejercicio): con uno sin [C] basta para dejarlo pendiente.
 * Los hábitos al revés (EVADIAPP_HAB_AL_REVES) van al revés: sin evento = X; con evento = pendiente.
 * Lee el calendario directo (no la lista guardada) para ver los títulos completos.
 */
function evadiApp_habitosCalHoy_(ss, hoja) {
  var tz = ss.getSpreadsheetTimeZone();
  var hoy = evadiApp_hoy_(ss);
  var buscar = evadiApp_buscadorIconos_(hoja);
  var alReves = evadiApp_habAlReves_();

  // Eventos de hoy (repeticiones ya separadas; los borrados no vienen)
  var eventos = [];
  try {
    var inicio = new Date(Utilities.formatDate(new Date(), tz, "yyyy-MM-dd'T'00:00:00XXX"));
    var fin = new Date(inicio.getTime() + 24 * 60 * 60 * 1000);
    var pagina = null;
    do {
      var opc = { timeMin: inicio.toISOString(), timeMax: fin.toISOString(), singleEvents: true, maxResults: 250 };
      if (pagina) opc.pageToken = pagina;
      var r = Calendar.Events.list(EVADIAPP_CAL_HABITOS, opc);
      eventos = eventos.concat(r.items || []);
      pagina = r.nextPageToken;
    } while (pagina);
  } catch (err) {
    return 'Error al leer el calendario de hábitos: ' + String((err && err.message) || err);
  }

  // Por hábito: 0 = sin evento hoy, 1 = solo eventos con [C], 2 = algún evento sin [C]
  var estado = {};
  eventos.forEach(function (it) {
    if (!it || it.status === 'cancelled') return;
    if (evadiApp_habCalFecha_(it.start, tz) !== hoy) return;  // empezó otro día
    var titulo = String(it.summary || '');
    var i = buscar(titulo);
    if (i < 0) return;  // no es de un hábito (ej. la línea -----)
    var s = evadiApp_tieneC_(titulo) ? 1 : 2;
    if (!(estado[i] >= s)) estado[i] = s;
  });

  // ProMe: "sin evento" solo es palomita si hoy sí había ProMe planeado (está en el registro)
  var promeIdx = evadiApp_promeIndice_(hoja);
  var promeReg = promeIdx >= 0 ? evadiApp_promeLogLeer_(ss, hoy) : null;
  var promePlaneado = !!(promeReg && String(promeReg.texto).trim());

  var palomitas = 0, equis = 0, pendientes = 0;
  EVADIAPP.habitos.forEach(function (h, i) {
    if (h.texto === EVADIAPP_TIKTOK.celda) return;  // TikTok lo decide Clockify
    var s = estado[i] || 0;
    if (i === promeIdx && s === 0 && !promePlaneado) {
      evadiApp_marcar_(ss, hoja, i, 'hecho', false);
      if (h.falle) evadiApp_marcar_(ss, hoja, i, 'falle', false);
      pendientes++;
      return;
    }
    if (alReves[i]) {
      if (s === 0) { evadiApp_marcar_(ss, hoja, i, 'falle', true); equis++; }
      else { evadiApp_marcar_(ss, hoja, i, 'hecho', false); evadiApp_marcar_(ss, hoja, i, 'falle', false); pendientes++; }
      return;
    }
    if (s === 0) {
      evadiApp_marcar_(ss, hoja, i, 'hecho', true);   // palomita (y quita la X)
      palomitas++;
    } else if (s === 1) {
      if (h.falle) evadiApp_marcar_(ss, hoja, i, 'falle', true);   // X (y quita la palomita)
      else evadiApp_marcar_(ss, hoja, i, 'hecho', false);          // Santa Brígida: solo sin palomita
      equis++;
    } else {
      evadiApp_marcar_(ss, hoja, i, 'hecho', false);
      if (h.falle) evadiApp_marcar_(ss, hoja, i, 'falle', false);
      pendientes++;
    }
  });

  var partes = [];
  if (palomitas) partes.push(palomitas + (palomitas === 1 ? ' palomita' : ' palomitas'));
  if (equis) partes.push(equis + ' X');
  if (pendientes) partes.push(pendientes + (pendientes === 1 ? ' pendiente' : ' pendientes'));
  return 'Hábitos: ' + (partes.join(', ') || 'sin cambios');
}

/**
 * Para cada hábito al revés: si hoy ya no existe su evento, X; si existe, pendiente (sin palomita ni X).
 * Devuelve qué marcó.
 */
function evadiApp_revisarAlReves_(ss, hoja, indices, lista, buscar) {
  var hoy = evadiApp_hoy_(ss);
  var marcados = [];
  indices.forEach(function (k) {
    var indice = Number(k);
    var existe = Object.keys(lista).some(function (id) {
      return lista[id].f === hoy && buscar(lista[id].t) === indice;
    });
    var nombre = hoja.getRange(EVADIAPP.habitos[indice].texto).getValue();
    if (existe) {
      evadiApp_marcar_(ss, hoja, indice, 'hecho', false);
      evadiApp_marcar_(ss, hoja, indice, 'falle', false);
      marcados.push('pendiente: ' + nombre);
    } else {
      evadiApp_marcar_(ss, hoja, indice, 'falle', true);
      marcados.push('X: ' + nombre);
    }
  });
  return marcados;
}

/**
 * Disparador del calendario "🧕 Hábitos". Se activa con cualquier cambio en ese calendario.
 * - Hábito normal: si se borró su evento de HOY, le pone palomita.
 *   Si a su evento de HOY se le agregó [C] al final (CalenGoo), le pone X; si se le quitó, pendiente.
 *   Si su evento vuelve a aparecer hoy (restaurado, creado o movido a hoy), regresa a pendiente.
 *   (Santa Brígida no tiene X: con [C] solo se le quita la palomita.)
 * - Hábito al revés (Pes): si su evento de hoy se creó, se borró o se movió, revisa si hoy
 *   existe: no = X; sí = pendiente.
 * Si el día ya se evaluó, la marca va a Cal (lo hace evadiApp_marcar_).
 */
function evadiAppHabitoBorrado(e) {
  var candado = LockService.getScriptLock();
  if (!candado.tryLock(30000)) return;  // ocupado: los cambios se revisan en el siguiente disparo
  try {
    var ss = evadiApp_libro_();
    var hoja = ss.getSheetByName(EVADIAPP.hoja);
    if (!hoja) return;
    var tz = ss.getSpreadsheetTimeZone();
    var hoy = evadiApp_hoy_(ss);
    var buscar = evadiApp_buscadorIconos_(hoja);
    var alReves = evadiApp_habAlReves_();
    var lista = evadiApp_habCalLeerLista_();
    var cambios = evadiApp_habCalCambios_();

    // EvaDi todavía tiene el día anterior sin evaluar: no se marca nada
    // (al evaluarlo o descartarlo de día, la app vuelve a leer el calendario de hoy)
    if (evadiApp_ayer_(ss)) {
      evadiApp_habCalGuardarLista_(ss);
      Logger.log('Calendario de hábitos en pausa: falta evaluar o descartar el día anterior.');
      return;
    }

    var padres = {};
    var marcados = [];
    var promeIdx = evadiApp_promeIndice_(hoja);
    var quitados = {};  // eventos de ProMe que quitaste desde el renglón de arriba
    evadiApp_promeQuitados_().forEach(function (id) { quitados[id] = true; });
    var revisar = {};  // hábitos al revés que hay que volver a revisar

    cambios.forEach(function (it) {
      if (!it || !it.id) return;
      var borrado = it.status === 'cancelled';
      var guardado = lista[it.id] || null;

      // Título: del evento si sigue vivo; si se borró, de la lista guardada o de la serie ("papá")
      var titulo = !borrado && it.summary ? String(it.summary) : (guardado ? guardado.t : '');
      if (!titulo && it.recurringEventId) {
        if (!(it.recurringEventId in padres)) {
          try {
            padres[it.recurringEventId] = String(Calendar.Events.get(EVADIAPP_CAL_HABITOS, it.recurringEventId).summary || '');
          } catch (err) {
            padres[it.recurringEventId] = '';
          }
        }
        titulo = padres[it.recurringEventId];
      }
      if (!titulo) return;

      var indice = buscar(titulo);
      if (indice < 0) return;  // no es de un hábito (ej. la línea -----)

      // Fecha de la repetición borrada o, si no es repetición, la que tenía en la lista
      var fechaVieja = it.originalStartTime ? evadiApp_habCalFecha_(it.originalStartTime, tz) : (guardado ? guardado.f : '');
      var fechaNueva = !borrado && it.start && !it.recurrence ? evadiApp_habCalFecha_(it.start, tz) : '';

      if (alReves[indice]) {
        // Se creó, se borró o se movió algo de hoy: al final se revisa si existe
        if (fechaVieja === hoy || fechaNueva === hoy) revisar[indice] = true;
        return;
      }
      if (borrado) {
        if (fechaVieja !== hoy) return;  // solo cuenta borrar un evento de hoy
        if (quitados[it.id]) return;  // lo quitaste desde el renglón de ProMe: no es palomita
        evadiApp_marcar_(ss, hoja, indice, 'hecho', true);
        marcados.push('palomita: ' + titulo);
        return;
      }

      // Evento vivo de hoy: ¿se le agregó o se le quitó el [C] de CalenGoo?
      if (fechaNueva !== hoy && fechaVieja !== hoy) return;
      var conC = evadiApp_tieneC_(titulo);
      var antesC = guardado ? evadiApp_tieneC_(guardado.t) : false;
      var tieneX = !!EVADIAPP.habitos[indice].falle;
      if (conC && !antesC) {
        if (tieneX) evadiApp_marcar_(ss, hoja, indice, 'falle', true);
        else evadiApp_marcar_(ss, hoja, indice, 'hecho', false);
        marcados.push((tieneX ? 'X: ' : 'sin palomita: ') + titulo);
      } else if (!conC && antesC) {
        if (tieneX) evadiApp_marcar_(ss, hoja, indice, 'falle', false);
        marcados.push('pendiente: ' + titulo);
      } else if (!conC && fechaNueva === hoy && (!guardado || guardado.f !== hoy)) {
        // El evento volvió a aparecer hoy (lo restauraste, lo creaste o lo moviste a hoy): deshace el borrado
        evadiApp_marcar_(ss, hoja, indice, 'hecho', false);
        if (tieneX) evadiApp_marcar_(ss, hoja, indice, 'falle', false);
        marcados.push('pendiente (volvió): ' + titulo);
      }
    });

    // Lista nueva de hoy y mañana (sirve para el próximo borrado y para los hábitos al revés)
    var nueva = evadiApp_habCalGuardarLista_(ss);

    marcados = marcados.concat(evadiApp_revisarAlReves_(ss, hoja, Object.keys(revisar), nueva, buscar));

    if (marcados.length) {
      SpreadsheetApp.flush();
      evadiApp_subirVer_();  // el cel y la PC se actualizan en segundos
      Logger.log('Calendario de hábitos: ' + marcados.join(' | '));
    }
  } finally {
    candado.releaseLock();
  }
}

/**
 * Índices de los hábitos al revés ({ 6: true }).
 */
function evadiApp_habAlReves_() {
  var s = {};
  EVADIAPP.habitos.forEach(function (h, i) {
    if (EVADIAPP_HAB_AL_REVES.indexOf(h.texto) >= 0) s[i] = true;
  });
  return s;
}

/**
 * Pide a Calendar lo que cambió desde la última revisión (incluye borrados).
 * Si la marca venció, saca una nueva y esa vez no revisa nada.
 */
function evadiApp_habCalCambios_() {
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty(EVADIAPP_PROP_HAB_TOKEN);
  if (!token) {
    props.setProperty(EVADIAPP_PROP_HAB_TOKEN, evadiApp_habCalTokenNuevo_());
    return [];
  }
  var items = [];
  var pagina = null;
  var r = null;
  try {
    do {
      var opc = { syncToken: token, showDeleted: true, maxResults: 250 };
      if (pagina) opc.pageToken = pagina;
      r = Calendar.Events.list(EVADIAPP_CAL_HABITOS, opc);
      items = items.concat(r.items || []);
      pagina = r.nextPageToken;
    } while (pagina);
  } catch (err) {
    if (/sync token|410|full sync/i.test(String((err && err.message) || err))) {
      props.setProperty(EVADIAPP_PROP_HAB_TOKEN, evadiApp_habCalTokenNuevo_());
      Logger.log('La marca de Calendar venció; se sacó una nueva.');
      return [];
    }
    throw err;
  }
  if (r && r.nextSyncToken) props.setProperty(EVADIAPP_PROP_HAB_TOKEN, r.nextSyncToken);
  return items;
}

/**
 * Revisión completa (desde ayer) solo para obtener la marca de "hasta aquí ya revisé".
 */
function evadiApp_habCalTokenNuevo_() {
  var desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  var pagina = null;
  var r = null;
  do {
    var opc = { timeMin: desde, showDeleted: true, maxResults: 250 };
    if (pagina) opc.pageToken = pagina;
    r = Calendar.Events.list(EVADIAPP_CAL_HABITOS, opc);
    pagina = r.nextPageToken;
  } while (pagina);
  if (!r || !r.nextSyncToken) throw new Error('Calendar no devolvió la marca de sincronización.');
  return r.nextSyncToken;
}

/**
 * Guarda los eventos de hoy y mañana (id -> título y fecha). Calendar no dice el título
 * de un evento borrado, solo su id; por eso se guarda antes. Incluye mañana para que el
 * ejercicio que crea Evaluar en la noche ya esté en la lista al día siguiente.
 */
function evadiApp_habCalGuardarLista_(ss) {
  var tz = ss.getSpreadsheetTimeZone();
  var inicio = new Date(Utilities.formatDate(new Date(), tz, "yyyy-MM-dd'T'00:00:00XXX"));
  var fin = new Date(inicio.getTime() + 2 * 24 * 60 * 60 * 1000);
  var r = Calendar.Events.list(EVADIAPP_CAL_HABITOS, {
    timeMin: inicio.toISOString(),
    timeMax: fin.toISOString(),
    singleEvents: true,
    maxResults: 250
  });
  var lista = {};
  (r.items || []).forEach(function (it) {
    if (!it.id || it.status === 'cancelled') return;
    lista[it.id] = { t: String(it.summary || '').slice(0, 80), f: evadiApp_habCalFecha_(it.start, tz) };
  });
  PropertiesService.getScriptProperties().setProperty(EVADIAPP_PROP_HAB_LISTA, JSON.stringify(lista));
  return lista;
}

function evadiApp_habCalLeerLista_() {
  try {
    var l = JSON.parse(PropertiesService.getScriptProperties().getProperty(EVADIAPP_PROP_HAB_LISTA) || '{}');
    return l && typeof l === 'object' ? l : {};
  } catch (err) {
    return {};
  }
}

/**
 * Fecha aaaa-mm-dd de un inicio de Calendar ({date} o {dateTime}) en la zona horaria de la hoja.
 */
function evadiApp_habCalFecha_(t, tz) {
  if (!t) return '';
  if (t.date) return String(t.date).slice(0, 10);
  if (t.dateTime) return Utilities.formatDate(new Date(t.dateTime), tz, 'yyyy-MM-dd');
  return '';
}

/**
 * ¿El título termina en [C]? (lo que agrega CalenGoo al marcar un evento como hecho)
 */
function evadiApp_tieneC_(t) {
  return /\[C\]$/i.test(String(t || '').replace(/[\uFE0E\uFE0F\u200B-\u200D\u2060]/g, '').trim());
}

/**
 * Ícono = primer "palabra" del texto, sin los caracteres invisibles que traen algunos emojis.
 */
function evadiApp_icono_(t) {
  return String(t || '').replace(/[\uFE0E\uFE0F\u200B-\u200D\u2060]/g, '').trim().split(/\s+/)[0] || '';
}

/**
 * Índice del hábito cuyo ícono coincide con el del título, o -1.
 * Compara con el nombre actual del hábito y, en los de lista desplegable (comida y ejercicio),
 * también con el ícono de cada opción de la lista: así atina aunque cambies la opción.
 */
function evadiApp_habitoPorIcono_(hoja, titulo) {
  return evadiApp_buscadorIconos_(hoja)(titulo);
}

/**
 * Lee EvaDi una sola vez y devuelve una función titulo -> índice del hábito (o -1).
 */
function evadiApp_buscadorIconos_(hoja) {
  var rango = hoja.getRange('A1:N18');
  var valores = rango.getValues();
  var reglas = rango.getDataValidations();
  var mapa = {};  // ícono -> índice
  EVADIAPP.habitos.forEach(function (h, i) {
    var p = evadiApp_pos_(h.texto);
    var textos = [valores[p.r][p.c]];
    var regla = reglas[p.r][p.c];
    if (regla && regla.getCriteriaType() === SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST) {
      textos = textos.concat(regla.getCriteriaValues()[0] || []);
    }
    textos.forEach(function (t) {
      var ic = evadiApp_icono_(t);
      if (ic && !(ic in mapa)) mapa[ic] = i;
    });
  });
  return function (titulo) {
    var ic = evadiApp_icono_(titulo);
    return ic && (ic in mapa) ? mapa[ic] : -1;
  };
}

/**
 * Prueba manual desde el editor: dice qué hábito le toca a cada evento de hoy, sin marcar nada.
 */
function evadiAppProbarHabitosCal() {
  var ss = evadiApp_libro_();
  var hoja = ss.getSheetByName(EVADIAPP.hoja);
  var hoy = evadiApp_hoy_(ss);
  var buscar = evadiApp_buscadorIconos_(hoja);
  var alReves = evadiApp_habAlReves_();
  var lista = evadiApp_habCalGuardarLista_(ss);
  Object.keys(lista).forEach(function (id) {
    var ev = lista[id];
    if (ev.f !== hoy) return;
    var i = buscar(ev.t);
    var destino = i < 0 ? '(ninguno)' : hoja.getRange(EVADIAPP.habitos[i].texto).getValue() + (alReves[i] ? ' (al revés)' : '');
    Logger.log(ev.t + '  ->  ' + destino);
  });
}

/* ==================== DÍA EVALUADO ==================== */

/**
 * Lee de una sola vez el renglón de hoy en Cal (el que señalan los punteros AE1:AM2).
 * Devuelve { evaluado, valor(puntero), celda(puntero) }.
 */
function evadiApp_diaCal_(ss) {
  var nada = { evaluado: false, fila: 0, dir: function () { return ''; }, valor: function () { return ''; }, celda: function () { return null; } };
  var cal = ss.getSheetByName(EVADIAPP.hojaCal);
  if (!cal) return nada;
  var punteros = cal.getRange('AE1:AM2').getDisplayValues();
  var dir = function (p) {  // 'AK1' -> 'W306'
    var pos = evadiApp_pos_(p);
    return String(punteros[pos.r][pos.c - 30] || '').trim();  // AE es la columna 31
  };
  var meta = dir('AK1');
  if (!/^[A-Z]+\d+$/.test(meta)) return nada;
  var fila = Number(/\d+$/.exec(meta)[0]);
  var renglon = cal.getRange(fila, 1, 1, cal.getLastColumn()).getValues()[0];
  var valor = function (p) {
    var d = dir(p);
    if (!/^[A-Z]+\d+$/.test(d)) return '';
    var pos = evadiApp_pos_(d);
    if (pos.r !== fila - 1) return cal.getRange(d).getValue();
    return renglon[pos.c];
  };
  var w = valor('AK1');
  return {
    evaluado: w !== '' && w !== null,
    fila: fila,
    dir: dir,
    valor: valor,
    celda: function (p) { var d = dir(p); return /^[A-Z]+\d+$/.test(d) ? cal.getRange(d) : null; }
  };
}

/**
 * Foto de las X (fallé) de hoy, tomada justo antes de evaluar. Vive en Propiedades del script.
 */
function evadiApp_guardarFoto_(ss, hoja) {
  var valores = hoja.getRange('A1:N18').getValues();
  var foto = evadiApp_fotoVacia_(ss);
  EVADIAPP.habitos.forEach(function (h, i) {
    if (!h.falle) return;
    var p = evadiApp_pos_(h.falle);
    foto.falle[i] = valores[p.r][p.c] === true;
  });
  evadiApp_escribirFoto_(foto);
}

function evadiApp_fotoVacia_(ss) {
  return { fecha: evadiApp_hoy_(ss), falle: EVADIAPP.habitos.map(function () { return false; }) };
}

function evadiApp_escribirFoto_(foto) {
  PropertiesService.getScriptProperties().setProperty('EVADI_FOTO', JSON.stringify(foto));
}

/** La foto solo vale el mismo día en que se tomó. */
function evadiApp_foto_(ss) {
  try {
    var f = JSON.parse(PropertiesService.getScriptProperties().getProperty('EVADI_FOTO') || 'null');
    return f && f.fecha === evadiApp_hoy_(ss) && Array.isArray(f.falle) ? f : null;
  } catch (err) {
    return null;
  }
}

/**
 * Agenda el ProMe de mañana con el texto de ProMe Hoy (misma hora, duración y etiqueta que EventosProMe.gs).
 * Si mañana ya hay uno con la etiqueta, no lo duplica.
 * diasAtras = 1 cuando se evaluó ayer: entonces el que sigue es el de hoy.
 */
function evadiApp_promeManana_(ss, diasAtras) {
  diasAtras = Number(diasAtras) || 0;
  var cual = diasAtras ? 'de hoy' : 'de mañana';
  if (typeof PROME_HOJA === 'undefined' || typeof PROME_CALENDARIO_ID === 'undefined') return '';
  try {
    var sh = ss.getSheetByName(PROME_HOJA);
    if (!sh) return '';
    var titulo = String(sh.getRange(PROME_FILA, PROME_COL_TEXTO).getValue()).trim();
    if (!titulo) return 'ProMe ' + cual + ' sin texto: no se agendó.';
    var cal = CalendarApp.getCalendarById(PROME_CALENDARIO_ID);
    if (!cal) return 'No encontré el calendario de ProMe.';
    var hoy = new Date();
    var dia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 1 - diasAtras);
    var yaEsta = cal.getEventsForDay(dia).some(function (ev) {
      return evadiApp_esEventoProMe_(ev.getTitle());
    });
    if (yaEsta) return 'ProMe ' + cual + ' ya estaba agendado.';
    crearEventoProMe(titulo, dia);  // ícono, color morado, registro y lista del disparador
    if (diasAtras) CacheService.getScriptCache().put('evadiProMe_' + evadiApp_hoy_(ss), '1', 120);  // renglón ProMe en verde
    return 'ProMe ' + cual + ' agendado';
  } catch (err) {
    return 'No se agendó el ProMe ' + cual + ': ' + String((err && err.message) || err);
  }
}

/* ==================== APOYO ==================== */

/**
 * Respuesta JSON para la PWA.
 */
function evadiApp_json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Libro DEP 3.0.
 */
function evadiApp_libro_() {
  var ss = null;
  try { ss = SpreadsheetApp.getActiveSpreadsheet(); } catch (e) { ss = null; }
  return ss || SpreadsheetApp.openById(EVADIAPP_ID_LIBRO);
}

/**
 * Convierte "M15" en índices de fila y columna (empezando en 0).
 */
function evadiApp_pos_(a1) {
  var m = /^([A-Z]+)(\d+)$/.exec(a1);
  var col = 0;
  for (var i = 0; i < m[1].length; i++) col = col * 26 + (m[1].charCodeAt(i) - 64);
  return { r: Number(m[2]) - 1, c: col - 1 };
}

/**
 * Fecha de hoy como texto aaaa-mm-dd en la zona horaria de la hoja.
 */
function evadiApp_hoy_(ss) {
  return Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd');
}

/**
 * Días entre dos fechas aaaa-mm-dd.
 */
function evadiApp_dias_(a, b) {
  var pa = a.split('-'), pb = b.split('-');
  var ta = Date.UTC(Number(pa[0]), Number(pa[1]) - 1, Number(pa[2]));
  var tb = Date.UTC(Number(pb[0]), Number(pb[1]) - 1, Number(pb[2]));
  return Math.round((tb - ta) / 86400000);
}

/**
 * Minutos a texto h:mm.
 */
function evadiApp_hm_(min) {
  min = Math.max(0, Math.round(min));
  var m = min % 60;
  return Math.floor(min / 60) + ':' + (m < 10 ? '0' : '') + m;
}

/**
 * Hoja oculta "Sobriedad". Se crea sola la primera vez, con el inicio del contador en hoy.
 */
function evadiApp_hojaSobriedad_(ss) {
  var sh = ss.getSheetByName(EVADIAPP.hojaSobriedad);
  if (!sh) {
    sh = ss.insertSheet(EVADIAPP.hojaSobriedad, ss.getSheets().length);
    sh.getRange('A:A').setNumberFormat('@');
    sh.getRange('A1:B2').setValues([['Fecha', 'Tipo'], [evadiApp_hoy_(ss), 'Inicio']]);
    sh.hideSheet();
  }
  return sh;
}

/**
 * Calcula días sin tomar, mejor racha y si hoy está marcado.
 */
function evadiApp_sobriedad_(ss) {
  var sh = evadiApp_hojaSobriedad_(ss);
  var hoy = evadiApp_hoy_(ss);
  var ultima = sh.getLastRow();
  var filas = ultima > 1 ? sh.getRange(2, 1, ultima - 1, 2).getDisplayValues() : [];
  var inicio = hoy;
  var tomas = [];

  filas.forEach(function (f) {
    var d = String(f[0]).trim();
    var t = String(f[1]).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
    if (t === 'Inicio' && d < inicio) inicio = d;
    if (t === 'Tomé' && tomas.indexOf(d) < 0) tomas.push(d);
  });
  tomas.sort();

  // Cada racha va de "previo" (día de inicio o del último trago) a un día final
  var previo = inicio;
  var mejor = 0;
  var mejorDe = inicio, mejorA = inicio;
  tomas.forEach(function (d) {
    if (d <= inicio || d > hoy) return;
    var fin = evadiApp_restarDia_(d);
    var racha = evadiApp_dias_(previo, fin);
    if (racha > mejor) { mejor = racha; mejorDe = previo; mejorA = fin; }
    previo = d;
  });
  var actual = Math.max(0, evadiApp_dias_(previo, hoy));
  if (actual >= mejor) { mejor = actual; mejorDe = previo; mejorA = hoy; }

  return {
    dias: actual,
    mejor: Math.max(0, mejor),
    tomeHoy: tomas.indexOf(hoy) >= 0,
    actualYmd: evadiApp_ymd_(previo, hoy),
    mejorYmd: evadiApp_ymd_(mejorDe, mejorA)
  };
}

/**
 * Día anterior a una fecha aaaa-mm-dd.
 */
function evadiApp_restarDia_(f) {
  var p = f.split('-');
  var d = new Date(Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2]) - 1));
  return Utilities.formatDate(d, 'UTC', 'yyyy-MM-dd');
}

/**
 * Diferencia en años, meses y días de calendario entre dos fechas aaaa-mm-dd.
 */
function evadiApp_ymd_(a, b) {
  if (!a || !b || b <= a) return { a: 0, m: 0, d: 0 };
  var pa = a.split('-').map(Number), pb = b.split('-').map(Number);
  // Meses completos entre las dos fechas
  var total = (pb[0] - pa[0]) * 12 + (pb[1] - pa[1]);
  if (pb[2] < pa[2]) total--;
  // Fecha de "a" movida esos meses (si el mes es más corto, se queda en su último día)
  var mesIdx = (pa[1] - 1) + total;
  var anioAncla = pa[0] + Math.floor(mesIdx / 12);
  var mesAncla = ((mesIdx % 12) + 12) % 12;
  var ultimoDia = new Date(Date.UTC(anioAncla, mesAncla + 1, 0)).getUTCDate();
  var ancla = Date.UTC(anioAncla, mesAncla, Math.min(pa[2], ultimoDia));
  var dias = Math.round((Date.UTC(pb[0], pb[1] - 1, pb[2]) - ancla) / 86400000);
  return { a: Math.floor(total / 12), m: total % 12, d: dias };
}