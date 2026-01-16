
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const extractDataFromPSP = async (subject: string, rawText: string) => {
  const prompt = `Actúa como un extractor de datos escolares.
  
  CONTEXTO:
  Se te entrega un informe PSP del año pasado.
  
  TU MISIÓN:
  1. Localizar específicamente la información de la materia: "${subject}".
  2. Extraer el contenido LITERAL.
  
  TEXTO:
  """
  ${rawText}
  """
  
  REGLA DE ORO:
  Si la materia "${subject}" (o un sinónimo evidente) NO aparece en el texto, devuelve todas las claves como "". 
  
  Devuelve un JSON:
  {
    "previousActions": "texto literal",
    "difficultiesStrengths": "texto literal",
    "unmetEvaluationCriteria": "texto literal"
  }`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        temperature: 0.1,
        responseMimeType: "application/json",
      }
    });

    const text = response.text;
    if (!text) return null;
    return JSON.parse(text.trim());
  } catch (e) {
    console.error("Error en extractDataFromPSP", e);
    return null;
  }
};

export const improveSingleField = async (fieldName: string, currentContent: string): Promise<string> => {
  const prompt = `Profesionaliza el siguiente apartado de un informe PRP: "${fieldName}".
  
  Contenido: "${currentContent}"
  
  Instrucciones:
  - Usa lenguaje docente formal y técnico.
  - No inventes datos.
  - Devuelve solo el texto mejorado.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        temperature: 0.7,
      }
    });

    const text = response.text;
    if (!text) throw new Error("No se pudo mejorar.");
    return text.trim();
  } catch (e) {
    console.error("Error en improveSingleField", e);
    throw e;
  }
};
