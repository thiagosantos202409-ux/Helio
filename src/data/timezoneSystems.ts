import { TimezoneSystemMode } from '../types/solar';

export type TimezoneSystemCategory =
  | 'civil_political'
  | 'dst_calendars'
  | 'solar_astronomical'
  | 'nautical_military'
  | 'global_atomic'
  | 'custom';

export interface TimezoneSystemCatalogItem {
  id: TimezoneSystemMode;
  icon: string;
  name: string;
  shortName: string;
  category: TimezoneSystemCategory;
  categoryLabel: string;
  description: string;
  badgeHint: string;
  ianaZoneOverride?: string;
}

export const REGIONAL_SYSTEM_IANA_MAP: Partial<Record<TimezoneSystemMode, string>> = {
  cuba_havana: 'America/Havana',
  us_eastern_dst: 'America/New_York',
  cancun_fixed: 'America/Cancun',
  eu_london_dst: 'Europe/London',
  morocco_ramadan: 'Africa/Casablanca',
  egypt_dst: 'Africa/Cairo',
  israel_dst: 'Asia/Jerusalem',
  chile_austral_dst: 'America/Santiago',
  lord_howe_30m: 'Australia/Lord_Howe',
};

export function getIanaForSystemMode(mode?: TimezoneSystemMode): string | null {
  if (!mode) return null;
  return REGIONAL_SYSTEM_IANA_MAP[mode] || null;
}

export const TIMEZONE_SYSTEM_CATEGORIES: Array<{ id: 'all' | TimezoneSystemCategory; label: string }> = [
  { id: 'all', label: 'Todos (24)' },
  { id: 'civil_political', label: 'Civis & Políticos' },
  { id: 'dst_calendars', label: 'Calendários DST & Cuba' },
  { id: 'solar_astronomical', label: 'Solares & Astronômicos' },
  { id: 'nautical_military', label: 'Náuticos & Militares' },
  { id: 'global_atomic', label: 'Atômicos & Globais' },
  { id: 'custom', label: 'Manual' },
];

export const ALL_TIMEZONE_SYSTEMS: TimezoneSystemCatalogItem[] = [
  {
    id: 'noaa_official',
    icon: '🏛️',
    name: 'Fuso Oficial Civil (NOAA / IANA)',
    shortName: 'Oficial NOAA',
    category: 'civil_political',
    categoryLabel: 'Civil / Político',
    description:
      'Utiliza o fuso legal oficial vigente no território do local selecionado, aplicando regras históricas e Horário de Verão (DST) automáticos para a data.',
    badgeHint: 'Civil local com DST',
  },
  {
    id: 'cuba_havana',
    icon: '🇨🇺',
    name: 'Sistema Horário de Cuba (Havana CST/CDT UTC-5 / UTC-4)',
    shortName: 'Cuba (Havana)',
    category: 'dst_calendars',
    categoryLabel: 'DST Próprio · UTC-5',
    description:
      'Calendário de Cuba/Havana: mantém Horário de Verão Contínuo (CDT UTC-4) entre 08/03/2026 às 02:00 e 07/11/2027 às 02:00, retomando em seguida o ciclo anual normal (2º dom Março → 1º dom Novembro), além do período contínuo histórico de 2004–2006.',
    badgeHint: 'Contínuo 03/26→11/27 + ciclo normal',
    ianaZoneOverride: 'America/Havana',
  },
  {
    id: 'us_eastern_dst',
    icon: '🇺🇸',
    name: 'Calendário Leste EUA / Canadá (EST/EDT UTC-5 / UTC-4)',
    shortName: 'EUA EST/EDT',
    category: 'dst_calendars',
    categoryLabel: 'DST EUA · UTC-5',
    description:
      'Mesmo UTC-5 de Cuba e Colômbia, porém segue o Energy Policy Act (troca às 02:00 do 2º dom de Março ao 1º dom de Novembro).',
    badgeHint: 'UTC-5/-4 troca 02:00',
    ianaZoneOverride: 'America/New_York',
  },
  {
    id: 'cancun_fixed',
    icon: '🇲🇽',
    name: 'Caribe Leste / Cancún Fixo (UTC-5 Sem DST)',
    shortName: 'Cancún Fixo',
    category: 'dst_calendars',
    categoryLabel: 'UTC-5 Sem DST',
    description:
      'Mesma deslocação padrão UTC-5 de Cuba e Nova York, porém sem avanço de verão (desde 2015 permanece fixo em UTC-5 o ano todo).',
    badgeHint: 'UTC-5 Fixo o ano todo',
    ianaZoneOverride: 'America/Cancun',
  },
  {
    id: 'eu_london_dst',
    icon: '🇪🇺',
    name: 'Calendário União Europeia / Reino Unido (UTC+0 / UTC+1)',
    shortName: 'DST Europeu',
    category: 'dst_calendars',
    categoryLabel: 'DST UE · UTC+0/+1',
    description:
      'Mudança sincronizada à 01:00 UTC do último domingo de Março ao último domingo de Outubro.',
    badgeHint: 'Último dom Mar→Out',
    ianaZoneOverride: 'Europe/London',
  },
  {
    id: 'morocco_ramadan',
    icon: '🇲🇦',
    name: 'Calendário de Marrocos com Pausa no Ramadã (UTC+1 / UTC+0)',
    shortName: 'Marrocos Ramadã',
    category: 'dst_calendars',
    categoryLabel: 'Lunar / Ramadã · UTC+0/+1',
    description:
      'Sistema único no mundo na faixa UTC+0/+1: opera em UTC+1 durante quase todo o ano e recua 1 hora para UTC+0 exclusivamente durante o mês lunar do Ramadã.',
    badgeHint: 'Recua -1h no Ramadã',
    ianaZoneOverride: 'Africa/Casablanca',
  },
  {
    id: 'egypt_dst',
    icon: '🇪🇬',
    name: 'Calendário do Egito (UTC+2 / UTC+3 Sex Abr → Qui Out)',
    shortName: 'Egito DST',
    category: 'dst_calendars',
    categoryLabel: 'DST Próprio · UTC+2',
    description:
      'Mesmo UTC+2 da Grécia e África do Sul, mas muda na última sexta-feira de Abril até a última quinta-feira de Outubro (lei de 2023).',
    badgeHint: 'Sex Abr → Qui Out',
    ianaZoneOverride: 'Africa/Cairo',
  },
  {
    id: 'israel_dst',
    icon: '🇮🇱',
    name: 'Calendário de Israel (UTC+2 / UTC+3 Sexta Mar → Out)',
    shortName: 'Israel DST',
    category: 'dst_calendars',
    categoryLabel: 'DST Próprio · UTC+2',
    description:
      'Mesmo UTC+2 do Egito e Atenas, com início antecipado na sexta-feira anterior ao último domingo de Março e término alinhado ao calendário hebraico.',
    badgeHint: 'Sexta Mar → Out',
    ianaZoneOverride: 'Asia/Jerusalem',
  },
  {
    id: 'chile_austral_dst',
    icon: '🇨🇱',
    name: 'Verão Austral — Chile (UTC-4 / UTC-3 Set → Abr)',
    shortName: 'Chile Austral',
    category: 'dst_calendars',
    categoryLabel: 'Hemisfério Sul · UTC-4',
    description:
      'Calendário invertido de Hemisfério Sul: enquanto Caracas e Manaus permanecem em UTC-4 fixo, o Chile avança para UTC-3 de Setembro a Abril.',
    badgeHint: 'Set → Abr (Verão Sul)',
    ianaZoneOverride: 'America/Santiago',
  },
  {
    id: 'lord_howe_30m',
    icon: '🏝️',
    name: 'Ilha Lord Howe — Salto Único de 30 Minutos (UTC+10:30 / +11)',
    shortName: 'Lord Howe 30m',
    category: 'dst_calendars',
    categoryLabel: 'Salto 30m · Pacífico',
    description:
      'O único lugar habitado do planeta onde a mudança de Horário de Verão é de apenas +30 minutos (de UTC+10:30 para UTC+11:00).',
    badgeHint: 'Avanço de +30 min',
    ianaZoneOverride: 'Australia/Lord_Howe',
  },
  {
    id: 'railway_standard',
    icon: '🚂',
    name: 'Horário Padrão Ferroviário (Sem DST / Inverno Fixo)',
    shortName: 'Padrão Fixo',
    category: 'civil_political',
    categoryLabel: 'Civil / Histórico',
    description:
      'Sistema padrão clássico adotado na unificação ferroviária de 1883: mantém o fuso padrão fixo do local durante todo o ano, ignorando mudanças sazonais de Horário de Verão.',
    badgeHint: 'Fixo sem DST',
  },
  {
    id: 'permanent_dst',
    icon: '🌞',
    name: 'Horário de Verão Permanente (DST Contínuo +1h)',
    shortName: 'Verão +1h',
    category: 'civil_political',
    categoryLabel: 'Civil / Político',
    description:
      'Aplica permanentemente +1 hora sobre o fuso padrão local durante os 365 dias do ano (modelo adotado por países em horário de verão contínuo).',
    badgeHint: 'Padrão +1h contínuo',
  },
  {
    id: 'solar_lst',
    icon: '☀️',
    name: 'Tempo Solar Verdadeiro (LST / Relógio de Sol)',
    shortName: 'Solar LST',
    category: 'solar_astronomical',
    categoryLabel: 'Solar Real',
    description:
      'Hora solar aparente medida pela posição real do Sol com Equação do Tempo (EoT). O meio-dia no relógio marca exatamente 12:00:00 no ápice solar.',
    badgeHint: '12:00 = Zênite',
  },
  {
    id: 'lmt_mean',
    icon: '🧭',
    name: 'Tempo Solar Médio Local (LMT Pré-1883)',
    shortName: 'LMT Médio',
    category: 'solar_astronomical',
    categoryLabel: 'Solar / Histórico',
    description:
      'Sistema histórico usado pelas cidades antes da criação dos fusos horários: cada grau de longitude desloca exatamente 4 minutos em relação a Greenwich (sem EoT).',
    badgeHint: '4 min/grau puro',
  },
  {
    id: 'sidereal_time',
    icon: '🔭',
    name: 'Tempo Sideral Local (LMST - Relógio das Estrelas)',
    shortName: 'Sideral LMST',
    category: 'solar_astronomical',
    categoryLabel: 'Astronômico',
    description:
      'Escala astronômica usada por telescópios e observatórios: mede a rotação da Terra em relação às estrelas fixas (~23h56m04s por dia sideral) na longitude local.',
    badgeHint: 'Dia estelar 23h56m',
  },
  {
    id: 'french_decimal',
    icon: '📏',
    name: 'Tempo Decimal Francês (Revolucionário 10h/dia)',
    shortName: 'Decimal 10h',
    category: 'solar_astronomical',
    categoryLabel: 'Histórico / Decimal',
    description:
      'Sistema revolucionário francês de 1793: divide o dia solar local em 10 horas decimais de 100 minutos decimais e 100 segundos decimais (meio-dia = 05:00:00).',
    badgeHint: '10h · 100m · 100s',
  },
  {
    id: 'noaa_nautical',
    icon: '🌐',
    name: 'Meridiano Náutico NOAA (Faixas de 15°)',
    shortName: 'Meridiano 15°',
    category: 'nautical_military',
    categoryLabel: 'Náutico Geográfico',
    description:
      'Divisão matemática pura da Terra em 24 faixas oceânicas de 15° de longitude (sem fronteiras políticas). Padrão NOAA de navegação marítima.',
    badgeHint: 'Faixas de 15°',
  },
  {
    id: 'military_nato',
    icon: '🎖️',
    name: 'Sistema Militar / Aviação NATO (Alfa a Zulu)',
    shortName: 'NATO Militar',
    category: 'nautical_military',
    categoryLabel: 'Militar / Aviação',
    description:
      'Código alfabético padrão da OTAN e aviação: atribui letras de A (+1) a M (+12), N (-1) a Y (-12) e Z (UTC+0) conforme o meridiano do local.',
    badgeHint: 'Letra Z / A-Y',
  },
  {
    id: 'utc_standard',
    icon: '⏱️',
    name: 'Tempo Universal Coordenado (UTC+0 / GMT)',
    shortName: 'UTC+0',
    category: 'global_atomic',
    categoryLabel: 'Global Padrão',
    description:
      'Padrão civil mundial no Meridiano de Greenwich (0°). Referência base da aviação civil internacional, servidores e coordenadas globais.',
    badgeHint: 'Greenwich 0°',
  },
  {
    id: 'tai_atomic',
    icon: '⚛️',
    name: 'Tempo Atômico Internacional (TAI = UTC + 37s)',
    shortName: 'TAI Atômico',
    category: 'global_atomic',
    categoryLabel: 'Atômico / Física',
    description:
      'Escala contínua de altíssima precisão baseada em relógios atômicos de césio do BIPM, sem segundos bissextos (atualmente 37 segundos à frente do UTC).',
    badgeHint: 'UTC + 37s contínuo',
  },
  {
    id: 'terrestrial_time_tt',
    icon: '🛸',
    name: 'Tempo Terrestre / Efemérides NASA (TT = UTC + 69,2s)',
    shortName: 'TT Efemérides',
    category: 'global_atomic',
    categoryLabel: 'Espacial / JPL',
    description:
      'Escala dinâmica uniforme utilizada por NASA/JPL, cálculos orbitais, previsões de eclipses solares e tabelas astronômicas (TT = TAI + 32,184s).',
    badgeHint: 'UTC + 69,184s',
  },
  {
    id: 'swatch_beats',
    icon: '⌚',
    name: 'Swatch Internet Time (.beats @000–@999)',
    shortName: '@beats BMT',
    category: 'global_atomic',
    categoryLabel: 'Global Decimal',
    description:
      'Sistema universal sem fusos criado em 1998: divide o dia em 1000 ".beats" idênticos no planeta inteiro, ancorados em Biel Mean Time (UTC+1).',
    badgeHint: '1000 .beats / dia',
  },
  {
    id: 'manual_custom',
    icon: '⚙️',
    name: 'Fuso Manual / Personalizado (UTC-12 a UTC+14)',
    shortName: 'Fuso Manual',
    category: 'custom',
    categoryLabel: 'Personalizado',
    description:
      'Permite configurar livremente qualquer deslocamento em horas ou frações de 30 minutos entre UTC-12 e UTC+14 para simulações personalizadas.',
    badgeHint: 'Offset livre',
  },
];

export function getNatoZoneDetails(offsetHours: number): { letter: string; phonetic: string } {
  const rounded = Math.max(-12, Math.min(12, Math.round(offsetHours)));
  const map: Record<number, { letter: string; phonetic: string }> = {
    0: { letter: 'Z', phonetic: 'Zulu' },
    1: { letter: 'A', phonetic: 'Alfa' },
    2: { letter: 'B', phonetic: 'Bravo' },
    3: { letter: 'C', phonetic: 'Charlie' },
    4: { letter: 'D', phonetic: 'Delta' },
    5: { letter: 'E', phonetic: 'Echo' },
    6: { letter: 'F', phonetic: 'Foxtrot' },
    7: { letter: 'G', phonetic: 'Golf' },
    8: { letter: 'H', phonetic: 'Hotel' },
    9: { letter: 'I', phonetic: 'India' },
    10: { letter: 'K', phonetic: 'Kilo' },
    11: { letter: 'L', phonetic: 'Lima' },
    12: { letter: 'M', phonetic: 'Mike' },
    '-1': { letter: 'N', phonetic: 'November' },
    '-2': { letter: 'O', phonetic: 'Oscar' },
    '-3': { letter: 'P', phonetic: 'Papa' },
    '-4': { letter: 'Q', phonetic: 'Quebec' },
    '-5': { letter: 'R', phonetic: 'Romeo' },
    '-6': { letter: 'S', phonetic: 'Sierra' },
    '-7': { letter: 'T', phonetic: 'Tango' },
    '-8': { letter: 'U', phonetic: 'Uniform' },
    '-9': { letter: 'V', phonetic: 'Victor' },
    '-10': { letter: 'W', phonetic: 'Whiskey' },
    '-11': { letter: 'X', phonetic: 'X-ray' },
    '-12': { letter: 'Y', phonetic: 'Yankee' },
  };
  return map[rounded] || { letter: 'Z', phonetic: 'Zulu' };
}
