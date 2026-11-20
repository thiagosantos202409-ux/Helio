/**
 * Dicionário de Siglas Regionais, Nomes Oficiais e Pronúncia Fonética de Fusos Horários
 * Mapeia zonas IANA (e casos de Horário de Verão / Padrão) para a sigla usada no local
 * (ex.: BRT/BRST, AMT/AMST, ACT, FNT, CST/CDT, JST, BST, etc.) e como pronunciar.
 */

export interface TimezonePronunciationInfo {
  /** Sigla oficial usada no local (ex: "BRT", "BRST", "AMT", "CST", "JST") */
  abbrev: string;
  /** Nome completo em português (ex: "Horário Padrão de Brasília") */
  fullNamePt: string;
  /** Nome oficial / local original (ex: "Brasília Time", "Nippon Hyōjunji") */
  localOriginalName: string;
  /** Como pronunciar a sigla e o nome no Brasil / local */
  pronunciationGuide: string;
  /** Frase pronta para síntese de voz (Web Speech API em pt-BR) */
  speechText: string;
}

interface PronEntry {
  abbrev: string;
  fullNamePt: string;
  localOriginalName: string;
  pronunciationGuide: string;
}

const PRONUNCIATION_BY_ABBREV: Record<string, PronEntry> = {
  // BRASIL
  BRT: {
    abbrev: 'BRT',
    fullNamePt: 'Horário de Brasília',
    localOriginalName: 'Brasília Time',
    pronunciationGuide: '«Bê-Érre-Tê» · ou «Brazília Táim» (Horário de Brasília)',
  },
  BRST: {
    abbrev: 'BRST',
    fullNamePt: 'Horário de Verão de Brasília',
    localOriginalName: 'Brasília Summer Time',
    pronunciationGuide: '«Bê-Érre-Ésse-Tê» · ou «Brazília Sâmer Táim» (Verão de Brasília)',
  },
  AMT: {
    abbrev: 'AMT',
    fullNamePt: 'Horário do Amazonas',
    localOriginalName: 'Amazon Time',
    pronunciationGuide: '«Á-Éme-Tê» · ou «Émazon Táim» (Horário do Amazonas)',
  },
  AMST: {
    abbrev: 'AMST',
    fullNamePt: 'Horário de Verão do Amazonas',
    localOriginalName: 'Amazon Summer Time',
    pronunciationGuide: '«Á-Éme-Ésse-Tê» · ou «Émazon Sâmer Táim» (Verão do Amazonas)',
  },
  ACT: {
    abbrev: 'ACT',
    fullNamePt: 'Horário do Acre',
    localOriginalName: 'Acre Time',
    pronunciationGuide: '«Á-Cê-Tê» · ou «Êiker Táim» (Horário do Acre)',
  },
  FNT: {
    abbrev: 'FNT',
    fullNamePt: 'Horário de Fernando de Noronha',
    localOriginalName: 'Fernando de Noronha Time',
    pronunciationGuide: '«Éfe-Éne-Tê» · «Fernando de Noronha Táim»',
  },

  // AMÉRICA DO SUL
  ART: {
    abbrev: 'ART',
    fullNamePt: 'Horário da Argentina',
    localOriginalName: 'Argentina Time (Hora Oficial Argentina)',
    pronunciationGuide: '«Á-Érre-Tê» · ou «Ardjentína Táim»',
  },
  UYT: {
    abbrev: 'UYT',
    fullNamePt: 'Horário do Uruguai',
    localOriginalName: 'Uruguay Standard Time',
    pronunciationGuide: '«Ú-Ípsilon-Tê» · ou «Iuruguái Táim»',
  },
  UYST: {
    abbrev: 'UYST',
    fullNamePt: 'Horário de Verão do Uruguai',
    localOriginalName: 'Uruguay Summer Time',
    pronunciationGuide: '«Ú-Ípsilon-Ésse-Tê» · «Iuruguái Sâmer Táim»',
  },
  PYT: {
    abbrev: 'PYT',
    fullNamePt: 'Horário Padrão do Paraguai',
    localOriginalName: 'Paraguay Time',
    pronunciationGuide: '«Pê-Ípsilon-Tê» · «Páraguai Táim»',
  },
  PYST: {
    abbrev: 'PYST',
    fullNamePt: 'Horário de Verão do Paraguai',
    localOriginalName: 'Paraguay Summer Time',
    pronunciationGuide: '«Pê-Ípsilon-Ésse-Tê» · «Páraguai Sâmer Táim»',
  },
  CLT: {
    abbrev: 'CLT',
    fullNamePt: 'Horário Padrão do Chile',
    localOriginalName: 'Chile Standard Time',
    pronunciationGuide: '«Cê-Éle-Tê» · «Tchíli Táim»',
  },
  CLST: {
    abbrev: 'CLST',
    fullNamePt: 'Horário de Verão do Chile',
    localOriginalName: 'Chile Summer Time',
    pronunciationGuide: '«Cê-Éle-Ésse-Tê» · «Tchíli Sâmer Táim»',
  },
  EAST: {
    abbrev: 'EAST',
    fullNamePt: 'Horário da Ilha de Páscoa',
    localOriginalName: 'Easter Island Standard Time',
    pronunciationGuide: '«É-Á-Ésse-Tê» · «Íster Áiland Táim»',
  },
  EASST: {
    abbrev: 'EASST',
    fullNamePt: 'Horário de Verão da Ilha de Páscoa',
    localOriginalName: 'Easter Island Summer Time',
    pronunciationGuide: '«É-Á-Ésse-Ésse-Tê» · «Íster Áiland Sâmer Táim»',
  },
  VET: {
    abbrev: 'VET',
    fullNamePt: 'Horário Legal da Venezuela',
    localOriginalName: 'Venezuelan Standard Time (Hora Legal de Venezuela)',
    pronunciationGuide: '«Vê-É-Tê» · «Venezuélan Táim»',
  },
  COT: {
    abbrev: 'COT',
    fullNamePt: 'Horário da Colômbia',
    localOriginalName: 'Colombia Time',
    pronunciationGuide: '«Cê-Ó-Tê» · «Colômbia Táim»',
  },
  PET: {
    abbrev: 'PET',
    fullNamePt: 'Horário do Peru',
    localOriginalName: 'Peru Time',
    pronunciationGuide: '«Pê-É-Tê» · «Perú Táim»',
  },
  BOT: {
    abbrev: 'BOT',
    fullNamePt: 'Horário da Bolívia',
    localOriginalName: 'Bolivia Time',
    pronunciationGuide: '«Bê-Ó-Tê» · «Bolívia Táim»',
  },
  FKST: {
    abbrev: 'FKST',
    fullNamePt: 'Horário das Ilhas Malvinas / Falkland',
    localOriginalName: 'Falkland Islands Summer Time',
    pronunciationGuide: '«Éfe-Ká-Ésse-Tê» · «Fólklend Sâmer Táim»',
  },

  // CUBA, CARIBE E AMÉRICA DO NORTE
  CST: {
    abbrev: 'CST',
    fullNamePt: 'Horário Padrão Central / de Cuba',
    localOriginalName: 'Central / Cuba Standard Time',
    pronunciationGuide: '«Cê-Ésse-Tê» · «Sêntral / Kiúba Stândard Táim»',
  },
  CDT: {
    abbrev: 'CDT',
    fullNamePt: 'Horário de Verão Central / de Cuba',
    localOriginalName: 'Central / Cuba Daylight Time',
    pronunciationGuide: '«Cê-Dê-Tê» · «Sêntral / Kiúba Dêilait Táim»',
  },
  EST: {
    abbrev: 'EST',
    fullNamePt: 'Horário Padrão do Leste (EUA/Canadá)',
    localOriginalName: 'Eastern Standard Time',
    pronunciationGuide: '«É-Ésse-Tê» · «Ístern Stândard Táim»',
  },
  EDT: {
    abbrev: 'EDT',
    fullNamePt: 'Horário de Verão do Leste (EUA/Canadá)',
    localOriginalName: 'Eastern Daylight Time',
    pronunciationGuide: '«É-Dê-Tê» · «Ístern Dêilait Táim»',
  },
  MST: {
    abbrev: 'MST',
    fullNamePt: 'Horário Padrão das Montanhas',
    localOriginalName: 'Mountain Standard Time',
    pronunciationGuide: '«Éme-Ésse-Tê» · «Máunten Stândard Táim»',
  },
  MDT: {
    abbrev: 'MDT',
    fullNamePt: 'Horário de Verão das Montanhas',
    localOriginalName: 'Mountain Daylight Time',
    pronunciationGuide: '«Éme-Dê-Tê» · «Máunten Dêilait Táim»',
  },
  PST: {
    abbrev: 'PST',
    fullNamePt: 'Horário Padrão do Pacífico (EUA/Canadá)',
    localOriginalName: 'Pacific Standard Time',
    pronunciationGuide: '«Pê-Ésse-Tê» · «Pacífic Stândard Táim»',
  },
  PDT: {
    abbrev: 'PDT',
    fullNamePt: 'Horário de Verão do Pacífico (EUA/Canadá)',
    localOriginalName: 'Pacific Daylight Time',
    pronunciationGuide: '«Pê-Dê-Tê» · «Pacífic Dêilait Táim»',
  },
  AKST: {
    abbrev: 'AKST',
    fullNamePt: 'Horário Padrão do Alasca',
    localOriginalName: 'Alaska Standard Time',
    pronunciationGuide: '«Á-Ká-Ésse-Tê» · «Aláska Stândard Táim»',
  },
  AKDT: {
    abbrev: 'AKDT',
    fullNamePt: 'Horário de Verão do Alasca',
    localOriginalName: 'Alaska Daylight Time',
    pronunciationGuide: '«Á-Ká-Dê-Tê» · «Aláska Dêilait Táim»',
  },
  HST: {
    abbrev: 'HST',
    fullNamePt: 'Horário Padrão do Havaí',
    localOriginalName: 'Hawaii Standard Time',
    pronunciationGuide: '«Agá-Ésse-Tê» · «Rauái Stândard Táim»',
  },
  NST: {
    abbrev: 'NST',
    fullNamePt: 'Horário Padrão de Terra Nova',
    localOriginalName: 'Newfoundland Standard Time',
    pronunciationGuide: '«Éne-Ésse-Tê» · «Niúfaundlend Stândard Táim»',
  },
  NDT: {
    abbrev: 'NDT',
    fullNamePt: 'Horário de Verão de Terra Nova',
    localOriginalName: 'Newfoundland Daylight Time',
    pronunciationGuide: '«Éne-Dê-Tê» · «Niúfaundlend Dêilait Táim»',
  },
  WGT: {
    abbrev: 'WGT',
    fullNamePt: 'Horário da Groenlândia Ocidental',
    localOriginalName: 'West Greenland Time',
    pronunciationGuide: '«Dábliu-Gê-Tê» · «Uést Grínlend Táim»',
  },
  WGST: {
    abbrev: 'WGST',
    fullNamePt: 'Horário de Verão da Groenlândia',
    localOriginalName: 'West Greenland Summer Time',
    pronunciationGuide: '«Dábliu-Gê-Ésse-Tê» · «Uést Grínlend Sâmer Táim»',
  },

  // EUROPA & ÁFRICA
  GMT: {
    abbrev: 'GMT',
    fullNamePt: 'Tempo Médio de Greenwich',
    localOriginalName: 'Greenwich Mean Time',
    pronunciationGuide: '«Gê-Éme-Tê» · «Grínuitch Mín Táim»',
  },
  BST: {
    abbrev: 'BST',
    fullNamePt: 'Horário de Verão Britânico',
    localOriginalName: 'British Summer Time',
    pronunciationGuide: '«Bê-Ésse-Tê» · «Brítish Sâmer Táim»',
  },
  WET: {
    abbrev: 'WET',
    fullNamePt: 'Horário da Europa Ocidental',
    localOriginalName: 'Western European Time',
    pronunciationGuide: '«Dábliu-É-Tê» · «Uéstern Iuropían Táim»',
  },
  WEST: {
    abbrev: 'WEST',
    fullNamePt: 'Horário de Verão da Europa Ocidental',
    localOriginalName: 'Western European Summer Time',
    pronunciationGuide: '«Dábliu-É-Ésse-Tê» · «Uéstern Iuropían Sâmer Táim»',
  },
  CET: {
    abbrev: 'CET',
    fullNamePt: 'Horário da Europa Central',
    localOriginalName: 'Central European Time',
    pronunciationGuide: '«Cê-É-Tê» · «Sêntral Iuropían Táim»',
  },
  CEST: {
    abbrev: 'CEST',
    fullNamePt: 'Horário de Verão da Europa Central',
    localOriginalName: 'Central European Summer Time',
    pronunciationGuide: '«Cê-É-Ésse-Tê» · «Sêntral Iuropían Sâmer Táim»',
  },
  EET: {
    abbrev: 'EET',
    fullNamePt: 'Horário da Europa Oriental',
    localOriginalName: 'Eastern European Time',
    pronunciationGuide: '«É-É-Tê» · «Ístern Iuropían Táim»',
  },
  EEST: {
    abbrev: 'EEST',
    fullNamePt: 'Horário de Verão da Europa Oriental',
    localOriginalName: 'Eastern European Summer Time',
    pronunciationGuide: '«É-É-Ésse-Tê» · «Ístern Iuropían Sâmer Táim»',
  },
  MSK: {
    abbrev: 'MSK',
    fullNamePt: 'Horário de Moscou',
    localOriginalName: 'Moscow Time (Moskóvskoye Vrémya)',
    pronunciationGuide: '«Éme-Ésse-Ká» · «Móskou Táim» (Moskóvskoie Vrémya)',
  },
  TRT: {
    abbrev: 'TRT',
    fullNamePt: 'Horário da Turquia',
    localOriginalName: 'Turkey Time (Türkiye Saati)',
    pronunciationGuide: '«Tê-Érre-Tê» · «Târki Táim»',
  },
  SAST: {
    abbrev: 'SAST',
    fullNamePt: 'Horário Padrão da África do Sul',
    localOriginalName: 'South Africa Standard Time',
    pronunciationGuide: '«Ésse-Á-Ésse-Tê» · «Sáuf África Stândard Táim»',
  },

  // ORIENTE MÉDIO & ÁSIA
  IST: {
    abbrev: 'IST',
    fullNamePt: 'Horário Padrão da Índia / Israel / Irlanda',
    localOriginalName: 'Indian / Israel / Irish Standard Time',
    pronunciationGuide: '«Í-Ésse-Tê» · «Índian / Ízrael Stândard Táim»',
  },
  IDT: {
    abbrev: 'IDT',
    fullNamePt: 'Horário de Verão de Israel',
    localOriginalName: 'Israel Daylight Time',
    pronunciationGuide: '«Í-Dê-Tê» · «Ízrael Dêilait Táim»',
  },
  NPT: {
    abbrev: 'NPT',
    fullNamePt: 'Horário do Nepal (+5h45)',
    localOriginalName: 'Nepal Time',
    pronunciationGuide: '«Éne-Pê-Tê» · «Nepól Táim»',
  },
  IRST: {
    abbrev: 'IRST',
    fullNamePt: 'Horário Padrão do Irã (+3h30)',
    localOriginalName: 'Iran Standard Time',
    pronunciationGuide: '«Í-Érre-Ésse-Tê» · «Irán Stândard Táim»',
  },
  AFT: {
    abbrev: 'AFT',
    fullNamePt: 'Horário do Afeganistão (+4h30)',
    localOriginalName: 'Afghanistan Time',
    pronunciationGuide: '«Á-Éfe-Tê» · «Afgânistan Táim»',
  },
  MMT: {
    abbrev: 'MMT',
    fullNamePt: 'Horário de Mianmar (+6h30)',
    localOriginalName: 'Myanmar Time',
    pronunciationGuide: '«Éme-Éme-Tê» · «Miánmar Táim»',
  },
  GST: {
    abbrev: 'GST',
    fullNamePt: 'Horário Padrão do Golfo (Dubai)',
    localOriginalName: 'Gulf Standard Time',
    pronunciationGuide: '«Gê-Ésse-Tê» · «Gâlf Stândard Táim»',
  },
  JST: {
    abbrev: 'JST',
    fullNamePt: 'Horário Padrão do Japão',
    localOriginalName: 'Japan Standard Time (Nippon Hyōjunji)',
    pronunciationGuide: '«Jota-Ésse-Tê» · «Djêpen Stândard Táim» (Nipón Riódjundji)',
  },
  KST: {
    abbrev: 'KST',
    fullNamePt: 'Horário Padrão da Coreia',
    localOriginalName: 'Korea Standard Time (Hanguk Pyojunsi)',
    pronunciationGuide: '«Ká-Ésse-Tê» · «Koría Stândard Táim»',
  },
  SGT: {
    abbrev: 'SGT',
    fullNamePt: 'Horário de Singapura',
    localOriginalName: 'Singapore Time',
    pronunciationGuide: '«Ésse-Gê-Tê» · «Singapór Táim»',
  },

  // OCEANIA & PACÍFICO
  AWST: {
    abbrev: 'AWST',
    fullNamePt: 'Horário Ocidental Australiano',
    localOriginalName: 'Australian Western Standard Time',
    pronunciationGuide: '«Á-Dábliu-Ésse-Tê» · «Ostrêilian Uéstern Táim»',
  },
  ACST: {
    abbrev: 'ACST',
    fullNamePt: 'Horário Central Australiano (+9h30)',
    localOriginalName: 'Australian Central Standard Time',
    pronunciationGuide: '«Á-Cê-Ésse-Tê» · «Ostrêilian Sêntral Táim»',
  },
  ACDT: {
    abbrev: 'ACDT',
    fullNamePt: 'Horário de Verão Central Australiano (+10h30)',
    localOriginalName: 'Australian Central Daylight Time',
    pronunciationGuide: '«Á-Cê-Dê-Tê» · «Ostrêilian Sêntral Dêilait Táim»',
  },
  AEST: {
    abbrev: 'AEST',
    fullNamePt: 'Horário Padrão do Leste Australiano',
    localOriginalName: 'Australian Eastern Standard Time',
    pronunciationGuide: '«Á-É-Ésse-Tê» · «Ostrêilian Ístern Táim»',
  },
  AEDT: {
    abbrev: 'AEDT',
    fullNamePt: 'Horário de Verão do Leste Australiano',
    localOriginalName: 'Australian Eastern Daylight Time',
    pronunciationGuide: '«Á-É-Dê-Tê» · «Ostrêilian Ístern Dêilait Táim»',
  },
  LHST: {
    abbrev: 'LHST',
    fullNamePt: 'Horário Padrão da Ilha Lord Howe (+10h30)',
    localOriginalName: 'Lord Howe Standard Time',
    pronunciationGuide: '«Éle-Agá-Ésse-Tê» · «Lórd Ráu Stândard Táim»',
  },
  LHDT: {
    abbrev: 'LHDT',
    fullNamePt: 'Horário de Verão de Lord Howe (+11h)',
    localOriginalName: 'Lord Howe Daylight Time',
    pronunciationGuide: '«Éle-Agá-Dê-Tê» · «Lórd Ráu Dêilait Táim»',
  },
  NZST: {
    abbrev: 'NZST',
    fullNamePt: 'Horário Padrão da Nova Zelândia',
    localOriginalName: 'New Zealand Standard Time',
    pronunciationGuide: '«Éne-Zê-Ésse-Tê» · «Niú Zílend Stândard Táim»',
  },
  NZDT: {
    abbrev: 'NZDT',
    fullNamePt: 'Horário de Verão da Nova Zelândia',
    localOriginalName: 'New Zealand Daylight Time',
    pronunciationGuide: '«Éne-Zê-Dê-Tê» · «Niú Zílend Dêilait Táim»',
  },
  CHAST: {
    abbrev: 'CHAST',
    fullNamePt: 'Horário Padrão das Ilhas Chatham (+12h45)',
    localOriginalName: 'Chatham Standard Time',
    pronunciationGuide: '«Cê-Agá-Á-Ésse-Tê» · «Tchátam Stândard Táim»',
  },
  CHADT: {
    abbrev: 'CHADT',
    fullNamePt: 'Horário de Verão das Ilhas Chatham (+13h45)',
    localOriginalName: 'Chatham Daylight Time',
    pronunciationGuide: '«Cê-Agá-Á-Dê-Tê» · «Tchátam Dêilait Táim»',
  },
  MART: {
    abbrev: 'MART',
    fullNamePt: 'Horário das Ilhas Marquesas (-9h30)',
    localOriginalName: 'Marquesas Time',
    pronunciationGuide: '«Éme-Á-Érre-Tê» · «Markêsas Táim»',
  },
  LINT: {
    abbrev: 'LINT',
    fullNamePt: 'Horário das Ilhas da Linha (Kiritimati +14)',
    localOriginalName: 'Line Islands Time',
    pronunciationGuide: '«Éle-Í-Éne-Tê» · «Láin Áilands Táim»',
  },
  SST: {
    abbrev: 'SST',
    fullNamePt: 'Horário Padrão de Samoa (-11)',
    localOriginalName: 'Samoa Standard Time',
    pronunciationGuide: '«Ésse-Ésse-Tê» · «Samôa Stândard Táim»',
  },
  AoE: {
    abbrev: 'AoE',
    fullNamePt: 'Anywhere on Earth (UTC-12)',
    localOriginalName: 'Anywhere on Earth',
    pronunciationGuide: '«Á-Ó-É» · «Êniuer on Ârf» (Qualquer Lugar da Terra)',
  },

  // SISTEMAS GLOBAIS / FÍSICOS / SOLARES
  UTC: {
    abbrev: 'UTC',
    fullNamePt: 'Tempo Universal Coordenado',
    localOriginalName: 'Coordinated Universal Time',
    pronunciationGuide: '«Ú-Tê-Cê» · «Iú-Tí-Sí» (Tempo Universal Coordenado)',
  },
  LST: {
    abbrev: 'LST',
    fullNamePt: 'Tempo Solar Verdadeiro Local',
    localOriginalName: 'Local Solar Time',
    pronunciationGuide: '«Éle-Ésse-Tê» · «Lôucal Sôular Táim»',
  },
  LMT: {
    abbrev: 'LMT',
    fullNamePt: 'Tempo Médio Local do Meridiano',
    localOriginalName: 'Local Mean Time',
    pronunciationGuide: '«Éle-Éme-Tê» · «Lôucal Mín Táim»',
  },
  TAI: {
    abbrev: 'TAI',
    fullNamePt: 'Tempo Atômico Internacional',
    localOriginalName: 'Temps Atomique International',
    pronunciationGuide: '«Tê-Á-Í» · «Tãn Atomík Enternacionál»',
  },
  TT: {
    abbrev: 'TT',
    fullNamePt: 'Tempo Terrestre (Efemérides NASA)',
    localOriginalName: 'Terrestrial Time',
    pronunciationGuide: '«Tê-Tê» · «Terréstrial Táim»',
  },
};

const LETTER_PT: Record<string, string> = {
  A: 'Á',
  B: 'Bê',
  C: 'Cê',
  D: 'Dê',
  E: 'É',
  F: 'Éfe',
  G: 'Gê',
  H: 'Agá',
  I: 'Í',
  J: 'Jota',
  K: 'Ká',
  L: 'Éle',
  M: 'Éme',
  N: 'Éne',
  O: 'Ó',
  P: 'Pê',
  Q: 'Quê',
  R: 'Érre',
  S: 'Ésse',
  T: 'Tê',
  U: 'Ú',
  V: 'Vê',
  W: 'Dábliu',
  X: 'Xis',
  Y: 'Ípsilon',
  Z: 'Zê',
};

function spellAcronymPt(code: string): string {
  const clean = code.replace(/[^A-Za-z]/g, '').toUpperCase();
  if (!clean || clean.length > 6) return code;
  return clean
    .split('')
    .map((ch) => LETTER_PT[ch] || ch)
    .join('-');
}

const LONG_NAME_CACHE = new Map<string, string>();

function getIntlLongNamePt(timeZoneId: string, refDate?: Date): string {
  const key = `${timeZoneId}_${refDate ? refDate.getUTCMonth() : 0}`;
  const cached = LONG_NAME_CACHE.get(key);
  if (cached) return cached;
  try {
    const fmt = new Intl.DateTimeFormat('pt-BR', {
      timeZone: timeZoneId,
      timeZoneName: 'long',
    });
    const parts = fmt.formatToParts(refDate || new Date(Date.UTC(2026, 0, 15, 12, 0, 0)));
    const name = parts.find((p) => p.type === 'timeZoneName')?.value || '';
    if (name) LONG_NAME_CACHE.set(key, name);
    return name;
  } catch {
    return '';
  }
}

/**
 * Converte zona IANA + offset atual na sigla local correta (substituindo GMT-3 genérico por BRT/BRST, AMT, ACT, etc.)
 */
export function resolveRegionalTimezoneAbbrev(
  timeZoneId: string,
  offsetHours: number,
  rawIntlAbbrev?: string
): string {
  // Brasil — Horário de Brasília (BRT / BRST)
  if (
    timeZoneId === 'America/Sao_Paulo' ||
    timeZoneId === 'Brazil/East' ||
    timeZoneId === 'America/Recife' ||
    timeZoneId === 'America/Bahia' ||
    timeZoneId === 'America/Belem' ||
    timeZoneId === 'America/Fortaleza' ||
    timeZoneId === 'America/Maceio' ||
    timeZoneId === 'America/Santarem' ||
    timeZoneId === 'America/Araguaina'
  ) {
    if (Math.abs(offsetHours - -4) < 0.05) return 'AMT';
    if (Math.abs(offsetHours - -2) < 0.05) return 'BRST';
    return 'BRT';
  }

  // Brasil — Amazônia, MT & MS (AMT / AMST)
  if (
    timeZoneId === 'America/Manaus' ||
    timeZoneId === 'America/Cuiaba' ||
    timeZoneId === 'America/Campo_Grande' ||
    timeZoneId === 'America/Porto_Velho' ||
    timeZoneId === 'America/Boa_Vista' ||
    timeZoneId === 'Brazil/West'
  ) {
    if (Math.abs(offsetHours - -3) < 0.05) return 'AMST';
    return 'AMT';
  }

  // Brasil — Acre
  if (
    timeZoneId === 'America/Rio_Branco' ||
    timeZoneId === 'America/Eirunepe' ||
    timeZoneId === 'Brazil/Acre'
  ) {
    if (Math.abs(offsetHours - -4) < 0.05) return 'AMT';
    return 'ACT';
  }

  // Brasil — Fernando de Noronha
  if (timeZoneId === 'America/Noronha' || timeZoneId === 'Brazil/DeNoronha') {
    return 'FNT';
  }

  // Cuba / Havana
  if (timeZoneId === 'America/Havana' || timeZoneId === 'Cuba') {
    return Math.abs(offsetHours - -4) < 0.05 ? 'CDT' : 'CST';
  }

  // Outras regiões onde Intl devolve GMT±X em vez da sigla oficial local
  if (timeZoneId.startsWith('America/Argentina/')) return 'ART';
  if (timeZoneId === 'America/Montevideo') return Math.abs(offsetHours - -2) < 0.05 ? 'UYST' : 'UYT';
  if (timeZoneId === 'America/Asuncion') return Math.abs(offsetHours - -3) < 0.05 ? 'PYST' : 'PYT';
  if (timeZoneId === 'America/Santiago' || timeZoneId === 'America/Punta_Arenas') {
    return Math.abs(offsetHours - -3) < 0.05 ? 'CLST' : 'CLT';
  }
  if (timeZoneId === 'Pacific/Easter') return Math.abs(offsetHours - -5) < 0.05 ? 'EASST' : 'EAST';
  if (timeZoneId === 'America/Caracas') return 'VET';
  if (timeZoneId === 'America/Bogota') return 'COT';
  if (timeZoneId === 'America/Lima') return 'PET';
  if (timeZoneId === 'America/La_Paz') return 'BOT';
  if (timeZoneId === 'Atlantic/Stanley') return 'FKST';
  if (timeZoneId === 'America/Nuuk' || timeZoneId === 'America/Godthab') {
    return Math.abs(offsetHours - -1) < 0.05 ? 'WGST' : 'WGT';
  }
  if (timeZoneId === 'Europe/London' || timeZoneId === 'GB') {
    return Math.abs(offsetHours - 1) < 0.05 ? 'BST' : 'GMT';
  }
  if (timeZoneId === 'Europe/Lisbon' || timeZoneId === 'Atlantic/Canary') {
    return Math.abs(offsetHours - 1) < 0.05 ? 'WEST' : 'WET';
  }
  if (timeZoneId === 'Africa/Casablanca') {
    return Math.abs(offsetHours) < 0.05 ? 'WET' : 'WEST';
  }
  if (timeZoneId === 'Europe/Paris' || timeZoneId === 'Europe/Berlin' || timeZoneId === 'Europe/Madrid' || timeZoneId === 'Europe/Rome') {
    return Math.abs(offsetHours - 2) < 0.05 ? 'CEST' : 'CET';
  }
  if (timeZoneId === 'Europe/Athens' || timeZoneId === 'Africa/Cairo' || timeZoneId === 'Asia/Beirut') {
    return Math.abs(offsetHours - 3) < 0.05 ? 'EEST' : 'EET';
  }
  if (timeZoneId === 'Asia/Jerusalem' || timeZoneId === 'Israel') {
    return Math.abs(offsetHours - 3) < 0.05 ? 'IDT' : 'IST';
  }
  if (timeZoneId === 'Europe/Moscow' || timeZoneId === 'W-SU') return 'MSK';
  if (timeZoneId === 'Europe/Istanbul' || timeZoneId === 'Turkey') return 'TRT';
  if (timeZoneId === 'Africa/Johannesburg') return 'SAST';
  if (timeZoneId === 'Asia/Kolkata' || timeZoneId === 'Asia/Calcutta') return 'IST';
  if (timeZoneId === 'Asia/Kathmandu' || timeZoneId === 'Asia/Katmandu') return 'NPT';
  if (timeZoneId === 'Asia/Tehran' || timeZoneId === 'Iran') return 'IRST';
  if (timeZoneId === 'Asia/Kabul') return 'AFT';
  if (timeZoneId === 'Asia/Yangon' || timeZoneId === 'Asia/Rangoon') return 'MMT';
  if (timeZoneId === 'Asia/Dubai') return 'GST';
  if (timeZoneId === 'Asia/Tokyo' || timeZoneId === 'Japan') return 'JST';
  if (timeZoneId === 'Asia/Seoul' || timeZoneId === 'ROK') return 'KST';
  if (timeZoneId === 'Asia/Singapore' || timeZoneId === 'Singapore') return 'SGT';
  if (timeZoneId === 'Australia/Perth') return 'AWST';
  if (timeZoneId === 'Australia/Adelaide' || timeZoneId === 'Australia/Darwin') {
    return Math.abs(offsetHours - 10.5) < 0.05 ? 'ACDT' : 'ACST';
  }
  if (timeZoneId === 'Australia/Sydney' || timeZoneId === 'Australia/Melbourne' || timeZoneId === 'Australia/Brisbane') {
    return Math.abs(offsetHours - 11) < 0.05 ? 'AEDT' : 'AEST';
  }
  if (timeZoneId === 'Australia/Lord_Howe') {
    return Math.abs(offsetHours - 11) < 0.05 ? 'LHDT' : 'LHST';
  }
  if (timeZoneId === 'Pacific/Auckland' || timeZoneId === 'NZ') {
    return Math.abs(offsetHours - 13) < 0.05 ? 'NZDT' : 'NZST';
  }
  if (timeZoneId === 'Pacific/Chatham') {
    return Math.abs(offsetHours - 13.75) < 0.05 ? 'CHADT' : 'CHAST';
  }
  if (timeZoneId === 'Pacific/Marquesas') return 'MART';
  if (timeZoneId === 'Pacific/Kiritimati') return 'LINT';
  if (timeZoneId === 'Pacific/Pago_Pago') return 'SST';
  if (timeZoneId === 'Pacific/Honolulu') return 'HST';
  if (timeZoneId === 'Etc/GMT+12') return 'AoE';

  if (rawIntlAbbrev && !/^(GMT|UTC)[+-]\d/.test(rawIntlAbbrev)) {
    return rawIntlAbbrev;
  }

  return rawIntlAbbrev || `UTC${offsetHours >= 0 ? '+' : ''}${offsetHours}`;
}

/**
 * Retorna informações completas de pronúncia e nome local para qualquer fuso horário ativo.
 */
export function getTimezonePronunciation(
  timeZoneId: string,
  abbrevOrRaw: string,
  offsetHours?: number,
  refDate?: Date
): TimezonePronunciationInfo {
  const cleanAbbrev =
    offsetHours !== undefined
      ? resolveRegionalTimezoneAbbrev(timeZoneId, offsetHours, abbrevOrRaw)
      : abbrevOrRaw;

  const dictHit = PRONUNCIATION_BY_ABBREV[cleanAbbrev];
  if (dictHit) {
    // Ajuste contextual para CST em Havana vs EUA/México/China
    if (cleanAbbrev === 'CST' && (timeZoneId === 'America/Havana' || timeZoneId === 'Cuba')) {
      return {
        abbrev: 'CST',
        fullNamePt: 'Horário Padrão de Cuba',
        localOriginalName: 'Cuba Standard Time',
        pronunciationGuide: '«Cê-Ésse-Tê» · «Kiúba Stândard Táim» (Hora Estándar de Cuba)',
        speechText: 'Cê Ésse Tê, Horário Padrão de Cuba, Kiúba Stândard Táim',
      };
    }
    if (cleanAbbrev === 'CDT' && (timeZoneId === 'America/Havana' || timeZoneId === 'Cuba')) {
      return {
        abbrev: 'CDT',
        fullNamePt: 'Horário de Verão de Cuba',
        localOriginalName: 'Cuba Daylight Time',
        pronunciationGuide: '«Cê-Dê-Tê» · «Kiúba Dêilait Táim» (Horario de Verano de Cuba)',
        speechText: 'Cê Dê Tê, Horário de Verão de Cuba, Kiúba Dêilait Táim',
      };
    }
    if (cleanAbbrev === 'CST' && (timeZoneId === 'Asia/Shanghai' || timeZoneId === 'PRC')) {
      return {
        abbrev: 'CST',
        fullNamePt: 'Horário Padrão da China (Pequim)',
        localOriginalName: 'China Standard Time',
        pronunciationGuide: '«Cê-Ésse-Tê» · «Tcháina Stândard Táim»',
        speechText: 'Cê Ésse Tê, Horário Padrão da China',
      };
    }
    if (cleanAbbrev === 'IST' && (timeZoneId === 'Asia/Jerusalem' || timeZoneId === 'Israel')) {
      return {
        abbrev: 'IST',
        fullNamePt: 'Horário Padrão de Israel',
        localOriginalName: 'Israel Standard Time',
        pronunciationGuide: '«Í-Ésse-Tê» · «Ízrael Stândard Táim»',
        speechText: 'Í Ésse Tê, Horário Padrão de Israel',
      };
    }

    return {
      ...dictHit,
      speechText: `${dictHit.abbrev.split('').join(' ')}, ${dictHit.fullNamePt}`,
    };
  }

  // Fallback inteligente usando Intl.DateTimeFormat('pt-BR', { timeZoneName: 'long' }) + soletração PT-BR
  const intlLongPt = timeZoneId ? getIntlLongNamePt(timeZoneId, refDate) : '';
  const spelled = /^[A-Za-z]{2,6}$/.test(cleanAbbrev)
    ? `«${spellAcronymPt(cleanAbbrev)}»`
    : cleanAbbrev;
  const fullNamePt = intlLongPt || `Fuso ${cleanAbbrev}`;

  return {
    abbrev: cleanAbbrev,
    fullNamePt,
    localOriginalName: timeZoneId || cleanAbbrev,
    pronunciationGuide: `${spelled} · ${fullNamePt}`,
    speechText: `${spelled.replace(/[«»-]/g, ' ')}, ${fullNamePt}`,
  };
}

/**
 * Reproduz em voz alta (Web Speech API) a pronúncia da sigla e nome do fuso horário.
 */
export function speakTimezonePronunciation(info: TimezonePronunciationInfo): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(info.speechText);
    utter.lang = 'pt-BR';
    utter.rate = 0.95;
    window.speechSynthesis.speak(utter);
  } catch {
    // Ignore speech synthesis errors in restricted environments
  }
}
