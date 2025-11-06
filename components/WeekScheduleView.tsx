import React, { useMemo, useRef, useEffect } from 'react';
// FIX: Module '"date-fns"' has no exported member 'startOfWeek' or 'startOfDay'. Import these functions from their specific submodules to resolve the error.
import { format, endOfWeek, eachDayOfInterval, isToday, isSameDay, isBefore } from 'date-fns';
import startOfWeek from 'date-fns/startOfWeek';
import startOfDay from 'date-fns/startOfDay';
import type { CalendarEvent } from '../types';

interface WeekScheduleViewProps {
  currentDate: Date;
  events: CalendarEvent[];
}

export const WeekScheduleView: React.FC<WeekScheduleViewProps> = ({ currentDate, events }) => {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const dayRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const containerRef = useRef<HTMLDivElement | null>(null);

  const scrollToDay = (day: Date) => {
    const dayKey = format(day, 'yyyy-MM-dd');
    const targetElement = dayRefs.current[dayKey];
    const container = containerRef.current;
    
    if (targetElement && container) {
       // The sticky header height is approx 68px, so we subtract that for offset
       const topPos = targetElement.offsetTop - 68;
       container.scrollTo({ top: topPos, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    const today = new Date();
    const todayKey = format(today, 'yyyy-MM-dd');
    
    // Check if today is in the current week view
    if (dayRefs.current[todayKey]) {
      const timer = setTimeout(() => {
        const targetElement = dayRefs.current[todayKey];
        const container = containerRef.current;

         if (targetElement && container) {
            const topPos = targetElement.offsetTop - 68;
            // On initial load, scroll instantly, not smoothly
            container.scrollTo({ top: topPos, behavior: 'auto' });
         }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [currentDate]); // Rerun when week changes

  const groupedEvents = useMemo(() => {
    const eventsInWeek = events.filter(e => {
        const eventTime = e.startTime.getTime();
        const weekStartTime = startOfDay(weekStart).getTime();
        const weekEndTime = endOfWeek(weekEnd).getTime();
        return eventTime >= weekStartTime && eventTime <= weekEndTime;
    });
    
    return eventsInWeek.reduce((acc, event) => {
      const dayKey = format(event.startTime, 'yyyy-MM-dd');
      if (!acc[dayKey]) acc[dayKey] = [];
      acc[dayKey].push(event);
      return acc;
    }, {} as Record<string, CalendarEvent[]>);
  }, [events, weekStart, weekEnd]);
  
  const now = useMemo(() => new Date(), []);
  const todayStart = useMemo(() => startOfDay(now), [now]);
  const hasAnyEvents = Object.keys(groupedEvents).length > 0;

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Sticky Day Header */}
      <div className="sticky top-0 bg-white shadow-sm z-20 flex-shrink-0">
        <div className="grid grid-cols-7">
          {days.map(day => (
            <button
              key={day.toString()}
              onClick={() => scrollToDay(day)}
              className="text-center py-2 flex flex-col items-center justify-center focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-400"
              aria-label={`Go to ${format(day, 'EEEE, MMMM d')}`}
            >
              <div className="text-xs font-medium text-gray-500">{format(day, 'EEE')}</div>
              <div className={`mt-1 text-lg font-medium flex items-center justify-center w-7 h-7 ${
                isToday(day) 
                  ? 'bg-blue-600 text-white rounded-full' 
                  : 'text-gray-800'
              }`}>
                {format(day, 'd')}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Events List */}
      <div className="overflow-y-auto flex-1" ref={containerRef}>
        <div className="p-4">
            {hasAnyEvents ? days.map(day => {
                const dayKey = format(day, 'yyyy-MM-dd');
                const dayEvents = (groupedEvents[dayKey] || []).sort((a, b) => {
                    if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
                    return a.startTime.getTime() - b.startTime.getTime();
                });
    
                if (dayEvents.length === 0) return null;
    
                return (
                <div key={dayKey} ref={el => (dayRefs.current[dayKey] = el)} className="mb-4">
                    <div className="flex items-baseline mb-3 sticky top-0 bg-gray-50 py-2 z-10">
                        <h3 className={`text-base font-semibold ${isToday(day) ? 'text-blue-600' : 'text-gray-900'}`}>{format(day, 'EEEE')}</h3>
                        <p className="ml-2 text-sm text-gray-500">{format(day, 'MMMM d')}</p>
                    </div>
                    <div className="space-y-3">
                    {dayEvents.map(event => {
                        const dayOfEvent = startOfDay(event.startTime);
                        const isPast = event.allDay 
                            ? isBefore(dayOfEvent, todayStart)
                            : isBefore(event.endTime, now);
                        
                        return (
                            <div 
                                key={event.id} 
                                className={`p-3 rounded-lg shadow-sm border flex ${
                                isPast 
                                    ? 'bg-gray-100 border-gray-200 opacity-70' 
                                    : 'bg-white border-gray-200'
                                }`}
                            >
                                <div className={`w-20 text-xs flex-shrink-0 flex flex-col justify-center ${isPast ? 'text-gray-500' : 'text-gray-700'}`}>
                                    {event.allDay ? '整日' : <div><p>{format(event.startTime, 'HH:mm')}</p><p className="my-1 text-gray-300">|</p><p>{format(event.endTime, 'HH:mm')}</p></div>}
                                </div>
                                <div className="flex-1 pl-3 border-l border-gray-200">
                                <h4 className={`font-semibold ${isPast ? 'text-gray-700' : 'text-blue-800'}`}>{event.title}</h4>
                                {event.description && <p className="text-sm text-gray-500 mt-1">{event.description}</p>}
                                {event.location && <p className="text-sm text-gray-500 mt-1">📍 {event.location}</p>}
                                </div>
                            </div>
                        );
                    })}
                    </div>
                </div>
                );
            }) : (
                <div className="text-center py-12 text-gray-500">
                    <p>No events scheduled for this week.</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};