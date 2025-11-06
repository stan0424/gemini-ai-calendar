
import React, { useState, useRef, useEffect } from 'react';
import { createEventViaAi } from '../services/aiService';
import type { CalendarEvent, AiConfig, Message } from '../types';
import { ImageIcon, SendIcon, CloseIcon, BotIcon, UserIcon, MicIcon } from './icons/Icons';

interface AiAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddEvent: (event: Omit<CalendarEvent, 'id'>) => void;
  aiConfig: AiConfig;
}

// Check for SpeechRecognition API vendor prefixes
// FIX: Cast window to `any` to access non-standard SpeechRecognition properties.
const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

export const AiAssistantModal: React.FC<AiAssistantModalProps> = ({ isOpen, onClose, onAddEvent, aiConfig }) => {
  const [prompt, setPrompt] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  // FIX: `SpeechRecognition` is a value (variable), not a type here. Using `any` to hold the instance.
  const recognitionRef = useRef<any | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  useEffect(() => {
    if (!SpeechRecognition) {
      console.warn("Speech recognition not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'zh-TW'; // Set language to Traditional Chinese

    recognition.onresult = (event) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setPrompt(transcript);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error', event.error);
      setIsRecording(false);
    };
    
    recognition.onend = () => {
      setIsRecording(false);
    };
    
    recognitionRef.current = recognition;

    return () => {
      recognitionRef.current?.stop();
    };
  }, []);


  if (!isOpen) return null;
  
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImage(e.target.files[0]);
    }
  };
  
  const handleToggleRecording = () => {
    const recognition = recognitionRef.current;
    if (!recognition) return;

    if (isRecording) {
      recognition.stop();
    } else {
      setPrompt(''); // Clear prompt before starting new recording
      recognition.start();
      setIsRecording(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isRecording) {
        recognitionRef.current?.stop();
    }
    if (!prompt.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: prompt };
    setMessages(prev => [...prev, userMessage]);
    setPrompt('');
    setImage(null);
    setIsLoading(true);

    try {
      const response = await createEventViaAi(prompt, image, aiConfig);
      const functionCalls = response.functionCalls;
      
      let eventsCreatedCount = 0;

      if (functionCalls && functionCalls.length > 0) {
        functionCalls.forEach((call) => {
            if (call.name === 'createCalendarEvent') {
                try {
                    const eventDetails = call.args;
                    const newEvent = {
                      title: eventDetails.title,
                      startTime: new Date(eventDetails.startTime),
                      endTime: new Date(eventDetails.endTime),
                      allDay: eventDetails.allDay || false,
                      description: eventDetails.description,
                      location: eventDetails.location,
                    };
                    onAddEvent(newEvent);
                    eventsCreatedCount++;
                } catch (error) {
                    console.error("Error parsing event data from function call:", error);
                    setMessages(prev => [...prev, { role: 'bot', content: `抱歉，建立行程 '${call.args.title}' 時發生錯誤。` }]);
                }
            }
        });
      }

      // Add the single confirmation/response message from the model.
      if (response.text) {
        const botMessage: Message = { role: 'bot', content: response.text };
        setMessages(prev => [...prev, botMessage]);
      } else if (eventsCreatedCount > 0) {
          // Fallback if model creates events but provides no summary text.
          const fallbackMessage = `好的，已為您新增 ${eventsCreatedCount} 個行程。`;
          setMessages(prev => [...prev, { role: 'bot', content: fallbackMessage }]);
      }

    } catch (error) {
      console.error("Error calling AI Service:", error);
      const errorMessageContent = error instanceof Error ? error.message : "抱歉，我遇到了一些問題，請稍後再試。";
      const errorMessage: Message = { role: 'bot', content: errorMessageContent };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-25 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl h-[80vh] flex flex-col">
        <header className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2"><BotIcon/> AI Assistant</h2>
          <button onClick={onClose} className="p-1 rounded-full text-gray-500 hover:bg-gray-100">
            <CloseIcon />
          </button>
        </header>

        <div className="flex-1 p-4 overflow-y-auto space-y-4">
          {messages.map((msg, index) => (
            <div key={index} className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
              {msg.role !== 'user' && msg.role !== 'function-result' && <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0"><BotIcon/></div>}
              {msg.role === 'user' && <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0"><UserIcon/></div>}
              
              <div className={`max-w-md p-3 rounded-lg ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}
           {isLoading && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0"><BotIcon/></div>
                <div className="max-w-md p-3 rounded-lg bg-gray-100 text-gray-800">
                  <div className="animate-pulse flex space-x-2">
                      <div className="rounded-full bg-gray-400 h-2 w-2"></div>
                      <div className="rounded-full bg-gray-400 h-2 w-2"></div>
                      <div className="rounded-full bg-gray-400 h-2 w-2"></div>
                  </div>
                </div>
              </div>
            )}
          <div ref={messagesEndRef} />
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200 bg-white">
            {image && (
              <div className="mb-2 flex items-center gap-2 p-2 bg-gray-100 rounded-md">
                <img src={URL.createObjectURL(image)} alt="Preview" className="w-12 h-12 object-cover rounded" />
                <span className="text-sm text-gray-700">{image.name}</span>
                <button type="button" onClick={() => setImage(null)} className="ml-auto p-1 rounded-full hover:bg-gray-200">
                  <CloseIcon className="w-4 h-4" />
                </button>
              </div>
            )}
          <div className="relative">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder="e.g., Schedule a meeting with Alex tomorrow at 2pm to discuss the Q3 report"
              className="w-full p-3 pr-32 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 resize-none bg-white text-gray-900"
              rows={2}
              disabled={isLoading}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageChange} className="hidden" />
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isLoading} className="p-2 rounded-full text-gray-500 hover:bg-gray-100">
                <ImageIcon />
              </button>
              <button type="button" onClick={handleToggleRecording} disabled={isLoading || !SpeechRecognition} className={`p-2 rounded-full transition-colors ${isRecording ? 'text-red-500 bg-red-100' : 'text-gray-500 hover:bg-gray-100'} disabled:text-gray-300 disabled:bg-transparent`}>
                <MicIcon />
              </button>
              <button type="submit" disabled={!prompt.trim() || isLoading} className="p-2 rounded-full text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed">
                <SendIcon />
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
