import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const triageIncomingTicket = async (description) => {
  const prompt = `
    Analyze the following customer support ticket description.
    You must classify it and return ONLY a raw, minified JSON object string. Do not include markdown formatting like \`\`\`json or \`\`\`. 
    Do not include any extra text before or after the JSON.

    The JSON must have the following exact keys:
    - category (Must be exactly one of: 'Bug', 'Billing', 'General')
    - priority (Must be exactly one of: 'Low', 'Medium', 'High')
    - tags (An array of 2-3 relevant short string keywords)

    Ticket Description: "${description}"
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: prompt,
      config: {
        temperature: 0.1, // Keep it deterministic
      }
    });

    const rawResponse = response.text;
    
    // Clean up any potential markdown formatting in case the model hallucinates it despite instructions
    const cleanedJSON = rawResponse.replace(/```json\s*|\s*```/g, '').trim();

    return JSON.parse(cleanedJSON);
  } catch (error) {
    console.error('Error during AI triage:', error);
    // Fallback if AI fails
    return {
      category: 'General',
      priority: 'Low',
      tags: ['triage-failed']
    };
  }
};
