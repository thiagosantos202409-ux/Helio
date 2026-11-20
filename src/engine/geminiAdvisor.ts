import { SolarCalculationResult, SolarInputParameters } from '../types/solar';

export interface GeminiAdvisorResult {
  text: string;
  sources?: Array<{ title: string; url: string }>;
}

export async function askGeminiSolarAdvisor(
  userQuery: string,
  params: SolarInputParameters,
  results: SolarCalculationResult
): Promise<GeminiAdvisorResult> {
  try {
    const response = await fetch('/api/solar-advisor', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userQuery,
        params: {
          ...params,
          referenceDate: params.referenceDate.toISOString(),
        },
        results,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Erro de servidor HTTP ${response.status}`);
    }

    const data = await response.json();
    return {
      text: data.text || 'Nenhuma resposta recebida do servidor.',
      sources: data.sources || [],
    };
  } catch (err: any) {
    console.error('Client API Call Error:', err);
    return {
      text: `ℹ️ Não foi possível conectar ao servidor Gemini: ${err.message || 'Erro de rede'}.

[Análise Local da Mecânica Solar]:
- Localização: Lat ${params.latitude}°, Lon ${params.longitude}°
- Fuso Civil: UTC${params.civilTimezoneOffset >= 0 ? '+' : ''}${params.civilTimezoneOffset}
- Elevação Solar (Altitude): ${results.solarAltitudeDeg}° (Zênite: ${results.solarZenithDeg}°)
- Azimute: ${results.solarAzimuthDeg}°
- Equação do Tempo (EoT): ${results.equationOfTimeMinutes.toFixed(2)} minutos
- Hora Solar Verdadeira (LST): ${results.lstLocalFormatted}
- Meio-Dia Solar Local: ${results.solarNoonLocalFormatted}
- Fase da Iluminação: ${results.twilightPhase}`,
      sources: [],
    };
  }
}

