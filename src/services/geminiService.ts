import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const generateNotebookContent = async (
  prompt: string,
  sources: { type: 'text' | 'image'; content: string; mimeType?: string }[]
) => {
  const model = "gemini-3-flash-preview";
  
  const contents = sources.map(source => {
    if (source.type === 'image') {
      return {
        inlineData: {
          data: source.content.split(',')[1], // Remove data:image/png;base64,
          mimeType: source.mimeType || "image/png"
        }
      };
    }
    return { text: source.content };
  });

  // Add the user prompt at the end
  contents.push({ text: prompt });

  const response: GenerateContentResponse = await ai.models.generateContent({
    model,
    contents: { parts: contents as any },
  });

  return response.text;
};

export const chatWithNotebook = async (
  history: { role: 'user' | 'model'; parts: { text: string }[] }[],
  message: string,
  sources: { type: 'text' | 'image'; content: string; mimeType?: string }[]
) => {
  const model = "gemini-3-flash-preview";
  
  const chat = ai.chats.create({
    model,
    config: {
      systemInstruction: `You are a helpful AI assistant for a Notebook application. 
      You have access to the following sources provided by the user. 
      Answer questions based on these sources. 
      If the answer is not in the sources, say you don't know based on the provided material, but offer general knowledge if appropriate.
      
      Sources:
      ${sources.filter(s => s.type === 'text').map(s => s.content).join('\n\n')}
      `
    }
  });

  // We handle images by prepending them to the first message if needed, 
  // but for simplicity in this notebook, we'll focus on text context in system instructions
  // and handle image parts in the current message if they are new.
  
  const response = await chat.sendMessage({ message });
  return response.text;
};
