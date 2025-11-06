
import React, { useState, useCallback, useEffect } from 'react';
// FIX: Import functions with errors from their specific submodules to resolve module export errors.
import { addMonths, addWeeks, addDays } from 'date-fns';
import subMonths from 'date-fns/subMonths';
import subWeeks from 'date-fns/subWeeks';
import subDays from 'date-fns/subDays';
import { CalendarHeader } from './components/CalendarHeader';
import { MonthView } from './components/MonthView';
import { WeekView } from './components/WeekView';
import { DayView } from './components/DayView';
import { ThreeDayView } from './components/ThreeDayView';
import { ScheduleView } from './components/ScheduleView';
import { AiAssistantModal } from './components/AiAssistantModal';
import { SettingsModal } from './components/SettingsModal';
import type { CalendarEvent, ViewOption, AiConfig } from './types';
import { CreateIcon } from './components/icons/Icons';

const today = new Date();
const sampleEvents: CalendarEvent[] = [
  {
    id: '1',
    title: '專案啟動會議',
    startTime: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 10, 0),
    endTime: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 11, 30),
    allDay: false,
    description: '討論第一季專案目標。',
    location: '會議室 4',
  },
  {
    id: '2',
    title: '提交費用報告',
    startTime: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
    endTime: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
    allDay: true,
  },
];

const DEFAULT_AI_CONFIG: AiConfig = {
  provider: 'gemini',
  keys: {
    gemini: '',
    openai: '',
    custom: '',
  },
  models: {
    gemini: 'gemini-2.5-flash',
    openai: 'gpt-4o',
    custom: 'custom-model-name'
  },
  customUrl: '',
};


const App: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>(sampleEvents);
  const [currentView, setCurrentView] = useState<ViewOption>('Month');
  const [isAssistantModalOpen, setAssistantModalOpen] = useState(false);
  const [isSettingsModalOpen, setSettingsModalOpen] = useState(false);
  const [aiConfig, setAiConfig] = useState<AiConfig>(DEFAULT_AI_CONFIG);

  useEffect(() => {
    try {
      const storedConfig = localStorage.getItem('aiConfig');
      if (storedConfig) {
        const parsedConfig = JSON.parse(storedConfig);
        // Merge with defaults to prevent breakages if new fields are added
        setAiConfig(prev => ({ ...prev, ...parsedConfig }));
      }
    } catch (error) {
      console.error("Failed to load AI config from localStorage", error);
    }
  }, []);

  const handleAiConfigChange = (newConfig: AiConfig) => {
    setAiConfig(newConfig);
    try {
      localStorage.setItem('aiConfig', JSON.stringify(newConfig));
    } catch (error) {
       console.error("Failed to save AI config to localStorage", error);
    }
  };

  const handlePrev = useCallback(() => {
    switch (currentView) {
      case 'Month':
      case 'Schedule':
        setCurrentDate(prev => subMonths(prev, 1));
        break;
      case 'Week':
        setCurrentDate(prev => subWeeks(prev, 1));
        break;
      case 'Day':
        setCurrentDate(prev => subDays(prev, 1));
        break;
      case '3-Day':
        setCurrentDate(prev => subDays(prev, 3));
        break;
    }
  }, [currentView]);

  const handleNext = useCallback(() => {
    switch (currentView) {
      case 'Month':
      case 'Schedule':
        setCurrentDate(prev => addMonths(prev, 1));
        break;
      case 'Week':
        setCurrentDate(prev => addWeeks(prev, 1));
        break;
      case 'Day':
        setCurrentDate(prev => addDays(prev, 1));
        break;
      case '3-Day':
        setCurrentDate(prev => addDays(prev, 3));
        break;
    }
  }, [currentView]);

  const handleToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  const addEvent = (event: Omit<CalendarEvent, 'id'>) => {
    setEvents(prev => [...prev, { ...event, id: crypto.randomUUID() }]);
  };

  const renderView = () => {
    switch (currentView) {
      case 'Month':
        return <MonthView currentDate={currentDate} events={events} />;
      case 'Week':
        return <WeekView currentDate={currentDate} events={events} />;
      case 'Day':
        return <DayView currentDate={currentDate} events={events} />;
      case '3-Day':
        return <ThreeDayView currentDate={currentDate} events={events} />;
      case 'Schedule':
        return <ScheduleView currentDate={currentDate} events={events} />;
      default:
        return <MonthView currentDate={currentDate} events={events} />;
    }
  };

  return (
    <>
      <div className="flex flex-col h-screen font-sans bg-gray-100">
        <CalendarHeader
          currentDate={currentDate}
          currentView={currentView}
          onViewChange={setCurrentView}
          onPrev={handlePrev}
          onNext={handleNext}
          onToday={handleToday}
          onOpenSettings={() => setSettingsModalOpen(true)}
        />
        <main className="flex-1 overflow-y-auto">
          {renderView()}
        </main>
      </div>
      
      <button 
        onClick={() => setAssistantModalOpen(true)}
        className="fixed bottom-6 right-6 bg-blue-600 text-white p-4 rounded-full shadow-lg hover:bg-blue-700 transition-transform transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 z-40"
        aria-label="Open AI Assistant"
      >
        <CreateIcon />
      </button>

      {isAssistantModalOpen && (
        <AiAssistantModal
          isOpen={isAssistantModalOpen}
          onClose={() => setAssistantModalOpen(false)}
          onAddEvent={addEvent}
          aiConfig={aiConfig}
        />
      )}
      {isSettingsModalOpen && (
        <SettingsModal
          isOpen={isSettingsModalOpen}
          onClose={() => setSettingsModalOpen(false)}
          currentConfig={aiConfig}
          onConfigChange={handleAiConfigChange}
        />
      )}
    </>
  );
};

export default App;
