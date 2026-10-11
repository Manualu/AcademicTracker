// Área de cada materia, para sesgar el sorteo de piezas hacia máquinas afines.
// FIUBA tiene casi mil materias distintas entre todas las carreras y planes, así que en vez de
// una tabla se usan reglas por palabras clave (sin tildes, en minúscula).
// Lo que no coincide con nada queda como "general".

export type Area = "energia" | "electro" | "proba" | "materiales" | "gestion" | "quimica" | "digital" | "general";

export const AREA_LABEL: Record<Area | "historia", string> = {
  energia: "Energía, térmica y fluidos",
  electro: "Electricidad, electrónica y control",
  proba: "Matemática, probabilidad y estadística",
  materiales: "Mecánica, materiales, estructuras y obra",
  gestion: "Economía, gestión y organización",
  quimica: "Química, procesos, alimentos y bio",
  digital: "Computación, datos y sistemas",
  general: "Cualquier materia",
  historia: "Cualquier materia (reliquia)",
};

export const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

// [área, palabras]. Cada palabra es un prefijo de palabra: "termo" coincide con "termodinamica".
// El orden de las áreas solo desempata palabras del mismo largo.
const RULES: [Area, string[]][] = [
  // Primero lo más específico, para que "Economía de la energía" o "Química de alimentos" caigan bien
  ["gestion", ["eco", "estructura economica", "agrimensura legal", "derecho para agrimensura", "aplicacion legal", "normativa", "circuitos de informacion", "negociacion", "conflicto", "empresas", "innovacion", "regulacion", "servicios publicos", "microeconom", "macroeconom", "humanistic", "seminario de ingenieria industrial", "operaciones i", "introduccion a la ingenieria industrial", "principios de ingenieria industrial", "ingenieria industrial", "analisis de casos", "ordenamiento", "urbanismo", "territorial", "econom", "costo", "finanz", "contab", "gestion", "administra", "organizacion", "marketing", "comercializ", "negocio", "emprend",
    "legislacion", "legal", "derecho", "etic", "logistic", "cadena de valor", "cadena de suministro", "supply", "calidad total", "proyecto",
    "planeamiento", "planificacion", "evaluacion de proyectos", "recursos humanos", "capital humano", "mercado", "estrategi", "conocimiento de la sociedad",
    "sociedad", "politica", "historia", "comunicacion oral", "comunicacion escrita", "ingles", "idioma", "ejercicio profesional", "seguros", "valuac",
    "tasacion", "catastro", "relaciones laborales", "trabajo profesional", "practica profesional", "pensamiento cientifico", "metodolog", "filosofia", "sustentab", "desarrollo sostenible"]],
  ["digital", ["algo", "estructuras de datos", "arquitectura de software", "arquitecturas paralelas", "organizacion de computadoras", "organizacion del computador", "bioinformatica", "control numerico computarizado", "geodesia astronomica", "aprendizaje", "redes", "neuron", "teoria de la informacion", "sistemas inteligentes", "concurrencia", "criptoanal", "ciberseguridad", "computabilidad", "teoria de lenguaje", "interfaces", "mainframe", "internet", "sistemas graficos", "multimedia", "almacenamiento", "desarrollo de aplicaciones", "desarrollo con nuevas tecnologias", "modelos de proceso", "implantacion de sistemas", "auditoria de sistemas", "resolucion de problemas", "sistemas complejos", "procesamiento del habla", "tecnologias de informacion", "geoespacial", "sistemas de coordenadas", "levantamientos", "microgeodesia", "informacion rural", "produccion flexible", "navegacion", "algoritm", "programacion", "computacion", "computacional", "computador", "informatica", "software", "datos", "base de datos", "bases de datos",
    "sistemas operativos", "sistemas distribuidos", "sistemas de informacion", "redes de computadoras", "redes de datos", "inteligencia artificial",
    "aprendizaje automatico", "machine", "ciencia de datos", "taller de programacion", "lenguajes", "compilador", "paradigmas", "seguridad informatica",
    "criptograf", "teoria de la computacion", "estructura de las organizaciones de datos", "organizacion de datos", "analisis de la informacion",
    "modelos y optimizacion", "simulacion", "industrias digitales", "digital", "robotica", "automatizacion", "cnc", "manufactura", "gis", "sistemas de informacion geografica",
    "teledeteccion", "fotogrametria", "cartograf", "geomatica", "topograf", "geodes", "agrimensura", "mensura", "georreferenc", "posicionamiento", "sensores remotos", "imagenes"]],
  ["proba", ["proba", "am1", "am2", "am3", "am 1", "am 2", "am 3", "am i", "am ii", "am iii", "estadistica para bioingenieria", "analisis funcional", "tensorial", "geoestadistica", "seis sigma", "diseno de experimentos", "probabilidad", "estadistic", "analisis matematico", "matematica", "algebra", "calculo", "numeric", "ecuaciones diferenciales", "geometria",
    "investigacion operativa", "optimizacion", "series", "variable compleja", "funciones", "analisis numerico", "metodos numericos", "control de calidad",
    "calidad", "estocastic", "procesos estocasticos", "teoria de errores", "ajuste", "muestreo", "matematica discreta", "logica"]],
  ["electro", ["ece", "energia electrica", "diagnosticos electricos", "instalaciones electricas", "baja tension", "materiales electricos", "productos de electronica", "fisica ii", "microelectr", "optoelectr", "microcomputador", "luminotecnia", "audio", "propagacion", "inalambric", "teoria de comunicacion", "deteccion y estimacion", "estaciones transformadoras", "dinamica de sep", "accionamientos", "metrolog", "electr", "electro", "magnetismo", "circuito", "senales", "senal", "control", "automatico", "comunicaciones", "telecomunic", "antena",
    "microondas", "microprocesador", "microcontrol", "instrumentacion", "medicion", "medidas", "potencia", "maquinas electricas", "transmision de energia",
    "distribucion de energia", "sistemas de potencia", "protecciones", "dispositivos", "semiconduct", "fotonic", "optica", "laser", "acustica",
    "procesamiento de senales", "sistemas embebidos", "embebid", "vlsi", "biomedic", "bioelectric", "imagenes medicas", "radio", "electrotecnia"]],
  ["quimica", ["qui", "industrias alimentari", "industrias alimentic", "industrias de la alimentacion", "industrias quimicas", "industrias petroquimicas", "industrias petrol", "industrias de celulosa", "industrias textiles", "industrias plasticas", "industrias extractivas", "pozo", "electroquimica", "genomica", "proteomica", "celular", "tejidos", "neurocien", "moleculares", "clinica", "hospitalaria", "protesis", "tecnologia de asistencia", "sanitaria", "saneamiento", "hidrocarburo", "pozos", "formaciones", "offshore", "gas y condensados", "geofisica", "geomagnetismo", "subproductos", "agroalimentari", "agricola", "envaes", "emisiones", "quimic", "bioquim", "biolog", "bio", "alimento", "microbiolog", "fermenta", "procesos", "operaciones unitarias", "fenomenos de transporte",
    "reactor", "catalisis", "polimer", "petroquim", "refinacion", "petroleo", "gas natural", "yacimiento", "reservorio", "perforacion", "produccion de petroleo",
    "geolog", "mineral", "farmac", "tecnologia de los alimentos", "envases", "cosmetic", "toxicolog", "ambiental", "efluentes", "tratamiento de aguas",
    "agua", "medio ambiente", "contaminacion", "fisicoquimica", "corrosion", "celulosa", "papel", "textil", "curtiembre", "agroindustri", "bioingenier", "biomateriales", "fisiolog", "anatomia"]],
  ["energia", ["mecanica de fluidos", "mecanica de los fluidos", "transporte de fluidos", "instalaciones termicas", "fisica iii", "tecnologia del frio", "frio", "energia", "energetic", "termodinamica", "termo", "termica", "termico", "calor", "fluido", "fluidos", "hidraulic", "hidrolog", "maquinas termicas",
    "turbomaquin", "motores de combustion", "combustion", "refrigeracion", "climatizacion", "aire acondicionado", "renovable", "solar", "eolic", "nuclear",
    "centrales", "transformacion de la energia", "conversion de la energia", "propulsion", "aerodinamic", "gasodinamic", "vapor", "caldera", "transferencia de calor", "transmision del calor"]],
  ["materiales", ["proyecto de buques", "proyecto de maquinas", "tratamientos termicos", "elementos finitos", "tensiones", "fractura", "sismic", "aeropuerto", "presas", "transito", "habitabilidad", "sistemas constructivos", "astillero", "artefactos oceanicos", "medios de representacion", "tecnologia de los componentes", "taller", "ingenieria inversa", "tecnicas de diseno", "diseno de producto", "industria automotriz", "introduccion a la ingenieria civil", "ingenieria civil", "hidrografic", "material", "mecanica", "mecanismo", "estructura", "estatica", "resistencia", "elasticidad", "plasticidad", "hormigon", "acero", "metal", "soldadura",
    "siderurg", "fundicion", "tecnologia mecanica", "maquinas herramienta", "mecanizado", "diseno mecanico", "elementos de maquinas", "maquinas", "dibujo", "sistemas de representacion",
    "representacion grafica", "construccion", "construcciones", "obra", "edificio", "arquitectura", "suelo", "geotecnia", "cimentaciones", "fundaciones",
    "puente", "camino", "vial", "transporte", "ferrocarril", "puerto", "naval", "buque", "embarcacion", "casco", "estabilidad", "vibraciones",
    "fisica", "ondas", "tribolog", "ensayos", "transformacion de materiales", "procesos de fabricacion", "fabricacion", "industrias", "planta", "instalaciones", "mantenimiento",
    "seguridad e higiene", "higiene y seguridad", "ergonom", "aeronautic", "aeroespacial", "vehiculo", "automotor"]],
];

// Cada palabra clave se compila a una expresión que busca palabras que empiezan con ese prefijo.
// Si coinciden varias áreas gana la de la palabra más larga (la más específica): así
// "Organización de Datos" va a computación y no a gestión, y "Proyecto de Estructuras" a obra.
const COMPILED: [Area, string, RegExp][] = RULES.flatMap(([a, words]) => words.map((w) => [a, w, new RegExp(`(^| )${norm(w)}`)] as [Area, string, RegExp]));

// Excepciones explícitas: materias cuyo nombre engaña a las reglas
const OVERRIDES: Record<string, Area> = {
  "fisica i": "materiales",
  "fisica ii": "electro",
  "fisica iii": "energia",
  "fisica de los sistemas de particulas": "materiales",
  "estatica y resistencia de materiales": "materiales",
  "introduccion al pensamiento cientifico": "general",
  "introduccion al conocimiento de la sociedad y el estado": "gestion",
};

const cache = new Map<string, Area>();

export function areaOf(subjectName: string): Area {
  const n = norm(subjectName);
  const hit = cache.get(n);
  if (hit) return hit;
  let area: Area = "general";
  if (OVERRIDES[n]) area = OVERRIDES[n];
  else {
    let best = 0;
    for (const [a, w, re] of COMPILED) if (w.length > best && re.test(n)) { best = w.length; area = a; }
  }
  cache.set(n, area);
  return area;
}
