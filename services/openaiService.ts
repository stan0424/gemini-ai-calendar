
import { format } from 'date-fns';
import type { OpenAiModel, AiServiceResponse } from '../types';

const OPENAI_BASE_URL = 'https://api.openai.com/v1/chat/completions';

// Function declaration in OpenAI's format
const createEventFunctionDeclaration = {
  type: 'function',
  function: {
    name: "createCalendarEvent",
    description: "Creates a new calendar event with specified details.",
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: "The title of the event.",
        },
        startTime: {
          type: 'string',
          description: "The start time of the event in ISO 8601 format (e.g., '2024-08-15T14:00:00Z'). For all-day events, this should be the start of the day (midnight).",
        },
        endTime: {
          type: 'string',
          description: "The end time of the event in ISO 8601 format (e.g., '2024-08-15T15:00:00Z'). For all-day events, this should be the start of the same day.",
        },
        description: {
          type: 'string',
          description: "A brief description of the event.",
        },
        location: {
          type: 'string',
          description: "The location of the event.",
        },
        allDay: {
            type: 'boolean',
            description: "Whether the event lasts for the entire day. This MUST be true if the user specifies a date but no time."
        }
      },
      required: ["title", "startTime", "endTime", "allDay"],
    },
  }
};

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve((reader.result as string));
        reader.onerror = error => reject(error);
    });
};

const normalizeResponse = (apiResponse: any): AiServiceResponse => {
    const message = apiResponse.choices?.[0]?.message;
    if (!message) {
        return { text: 'An unknown error occurred.', functionCalls: null };
    }
    
    const functionCalls = message.tool_calls?.map((call: any) => ({
        name: call.function.name,
        // OpenAI nests arguments in a string, so we need to parse it
        args: JSON.parse(call.function.arguments),
    })) ?? null;
    
    return {
        text: message.content ?? null,
        functionCalls: functionCalls,
    };
};

export const createEventFromPrompt = async (
    prompt: string, 
    image: File | null, 
    apiKey: string,
    model: OpenAiModel | string,
    customUrl?: string
): Promise<AiServiceResponse> => {
  if (!apiKey) {
    throw new Error("OpenAI/Custom API key not provided");
  }

  const systemPrompt = `You are an intelligent calendar assistant. Your primary function is to accurately parse user requests in Traditional Chinese (Taiwan) to create calendar events using the available tools.
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

  const userContent: any[] = [{ type: 'text', text: prompt }];
  if (image) {
    const base64Image = await fileToBase64(image);
    userContent.unshift({
        type: 'image_url',
        image_url: { url: base64Image }
    });
  }

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userContent }
  ];

  const body = {
    model: model,
    messages: messages,
    tools: [createEventFunctionDeclaration],
    tool_choice: 'auto',
  };

  const response = await fetch(customUrl || OPENAI_BASE_URL, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`OpenAI API Error: ${errorData.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return normalizeResponse(data);
};
