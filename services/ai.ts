import { GoogleGenAI, Type } from '@google/genai';

// API Key is handled by the environment as per guidelines
const API_KEY = process.env.API_KEY;
if (!API_KEY) {
    // This case should not happen in the target environment, but it's good practice.
    console.error("API_KEY environment variable not set.");
}
const ai = new GoogleGenAI({ apiKey: API_KEY! });

const responseSchema = {
    type: Type.OBJECT,
    properties: {
        description: {
            type: Type.STRING,
            description: 'A detailed, helpful description for the task. Use Markdown for formatting if needed.',
        },
        subtasks: {
            type: Type.ARRAY,
            description: 'A list of actionable subtasks or a checklist to complete the main task.',
            items: {
                type: Type.STRING,
            },
        },
    },
    required: ['description', 'subtasks'],
};


export const generateTaskSuggestions = async (taskTitle: string): Promise<{ description: string; subtasks: string[] }> => {
    try {
        const prompt = `You are an expert project manager. A user has provided a task title: "${taskTitle}". Your job is to expand this into a more detailed task. Provide a clear, concise description of what the task entails and then a list of actionable subtasks or a checklist to help the user complete the task.`;
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema,
            }
        });

        const jsonStr = response.text.trim();
        const suggestions = JSON.parse(jsonStr);
        
        // Basic validation
        if (typeof suggestions.description !== 'string' || !Array.isArray(suggestions.subtasks)) {
             throw new Error('Invalid response format from AI.');
        }

        return suggestions;
    } catch (error) {
        console.error('Error calling Gemini API:', error);
        throw new Error('Failed to get suggestions from AI.');
    }
};
