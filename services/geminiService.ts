
import { GoogleGenAI, FunctionDeclaration, Type, GenerateContentResponse, Part, FunctionCall } from "@google/genai";
import { format } from 'date-fns';
import type { GeminiModel, AiServiceResponse } from '../types';

const createEventFunctionDeclaration: FunctionDeclaration = {
  name: "createCalendarEvent",
  description: "Creates a new calendar event with specified details.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: {
        type: Type.STRING,
        description: "The title of the event.",
      },
      startTime: {
        type: Type.STRING,
        description: "The start time of the event in ISO 8601 format (e.g., '2024-08-15T14:00:00Z'). For all-day events, this should be the start of the day (midnight).",
      },
      endTime: {
        type: Type.STRING,
        description: "The end time of the event in ISO 8601 format (e.g., '2024-08-15T15:00:00Z'). For all-day events, this should be the start of the same day.",
      },
      description: {
        type: Type.STRING,
        description: "A brief description of the event.",
      },
      location: {
        type: Type.STRING,
        description: "The location of the event.",
      },
      allDay: {
          type: Type.BOOLEAN,
          description: "Whether the event lasts for the entire day. This MUST be true if the user specifies a date but no time."
      }
    },
    required: ["title", "startTime", "endTime", "allDay"],
  },
};

const fileToGenerativePart = async (file: File): Promise<Part> => {
    const base64EncodedDataPromise = new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
      reader.readAsDataURL(file);
    });
    return {
      inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
    };
};

const normalizeResponse = (response: GenerateContentResponse): AiServiceResponse => {
    const functionCalls = response.functionCalls;
    const normalizedCalls = functionCalls ? functionCalls.map((call: FunctionCall) => ({
        name: call.name,
        args: call.args,
    })) : null;
    
    return {
        text: response.text ?? null,
        functionCalls: normalizedCalls,
    };
};

export const createEventFromPrompt = async (
    prompt: string, 
    image: File | null, 
    apiKey: string,
    model: GeminiModel
): Promise<AiServiceResponse> => {
  if (!apiKey) {
    throw new Error("Gemini API key not provided");
  }

  const ai = new GoogleGenAI({ apiKey });

  const parts: Part[] = [{ text: prompt }];

  if (image) {
    const imagePart = await fileToGenerativePart(image);
    parts.unshift(imagePart);
  }

  const systemInstruction = `You are an intelligent calendar assistant. Your primary function is to accurately parse user requests in Traditional Chinese (Taiwan) to create calendar events using the available tools.
- The current date is ${format(new Date(), 'yyyy-MM-dd')}. ALL date calculations MUST use this as the reference. Assume the user is in their local timezone (e.g., Taiwan, UTC+8).

**Date & Time Parsing Rules**
- Use the current date as the absolute reference for all relative calculations.
- '今天' (today): Use the current date.
- '明天' (tomorrow): Add 1 day to the current date.
- '後天' (the day after tomorrow): Add 2 days to the current date.
- '大後天' (three days from now): Add 3 days to the current date.
- '下週一' (next Monday): Find the date of the upcoming Monday.
- Phrases like '這個月的一三五' (Mondays, Wednesdays, and Fridays of this month) mean ALL Mondays, Wednesdays, and Fridays within the current calendar month.

**RULE 1: All-Day Events**
- If a user's request mentions a date but **DOES NOT** specify a time of day (e.g., '11/11上網搶購', '明天繳電話費'), you MUST create an all-day event.
- For all-day events, you MUST set the \`allDay\` parameter to \`true\`.
- The \`startTime\` and \`endTime\` should be set to the start of the specified day. For example, for November 11th, 2025, both should be based on '2025-11-11T00:00:00'.

**RULE 2: Timed Events**
- If a user specifies a specific time (e.g., '早上7點開會', '下午3點喝咖啡'), you MUST create a timed event. The \`allDay\` parameter must be \`false\`.
- If an end time is not provided for a timed event, you MUST infer a reasonable duration. Assume a default duration of 30 minutes for point-in-time events like reminders. For events that imply longer duration like meals or meetings, a 1-hour default is appropriate.

**RULE 3: Multiple Events Handling**
- If the user's request contains multiple distinct dates or times for the same type of event (e.g., '幫我 1 號跟 3 號都設定繳費提醒', '下週一跟下週三下午 2 點開會'), you MUST make multiple, separate calls to the \`createCalendarEvent\` function in a single turn, one for each specified date/time.
- For example, if the user says 'add a reminder for the 1st and 3rd', you should call \`createCalendarEvent\` once for the 1st and a second time for the 3rd.

**RULE 4: Recurring & Multiple Day Events Handling**
- If a user requests a recurring event (e.g., '每周三開會', '每個星期一和星期四健身') or an event on multiple days following a pattern (e.g., '這個月的一三五'), you MUST interpret this as a request to create multiple, individual events.
- For any weekly recurring event, you MUST generate separate \`createCalendarEvent\` function calls for each occurrence for the **next 12 weeks** from the current date.
- For a pattern within a defined period like '這個月的一三五', you MUST find all Mondays, Wednesdays, and Fridays in the current calendar month and generate a separate \`createCalendarEvent\` function call for each of those dates.
- Each function call must have the correct, distinct date.

**RULE 5: Ambiguity and Confirmation**
- **Act Decisively:** Once you have gathered enough information to fulfill a request, call the \`createCalendarEvent\` function.
- **Clarify When Uncertain:** If a user's request is ambiguous, incomplete, or you are not certain about the details (e.g., '下個月跟陳經理開會'), you MUST ask clarifying questions. DO NOT guess or invent details. Example question: '好的，請問您希望安排在下個月的哪一天？'
- **Summarize Actions:** After making all necessary function calls, you MUST provide a single, brief confirmation message in Traditional Chinese that summarizes the action taken. For example: "好的，已為您新增這個月每週一、三、五的補習班行程。" or "好的，已為您新增了明天的會議。" This message should be the final text part of your response.`;


  const response = await ai.models.generateContent({
    model: model,
    contents: [{ parts }],
    config: {
      systemInstruction: systemInstruction,
      tools: [{ functionDeclarations: [createEventFunctionDeclaration] }],
    },
  });

  return normalizeResponse(response);
};
