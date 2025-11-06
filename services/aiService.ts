
import { createEventFromPrompt as createEventGemini } from './geminiService';
import { createEventFromPrompt as createEventOpenAI } from './openaiService';
import type { AiConfig, AiServiceResponse } from '../types';

export const createEventViaAi = (
    prompt: string,
    image: File | null,
    config: AiConfig
): Promise<AiServiceResponse> => {
    
    switch (config.provider) {
        case 'gemini':
            return createEventGemini(
                prompt,
                image,
                config.keys.gemini,
                config.models.gemini
            );
        case 'openai':
            return createEventOpenAI(
                prompt,
                image,
                config.keys.openai,
                config.models.openai
            );
        case 'custom':
             return createEventOpenAI(
                prompt,
                image,
                config.keys.custom,
                config.models.custom,
                config.customUrl
            );
        default:
            return Promise.reject(new Error(`Unknown AI provider: ${config.provider}`));
    }
};
