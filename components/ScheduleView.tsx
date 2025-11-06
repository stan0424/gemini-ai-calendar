import React, { useMemo, useRef, useEffect } from 'react';
// FIX: Module '"date-fns"' has no exported member 'startOfMonth' or 'startOfDay'. Import these functions from their specific submodules to resolve the error.
import { format, endOfMonth, isBefore } from 'date-fns';
import startOfMonth from 'date-fns/startOfMonth';
import startOfDay from 'date-fns/startOfDay';
import type { CalendarEvent } from '../types';

interface ScheduleViewProps {
  currentDate: Date;
  events: CalendarEvent[];
}

export const ScheduleView: React.FC<ScheduleViewProps> = ({ currentDate, events }) => {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const todayRef = useRef<HTMLDivElement>(null);
  const todayKey = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    // Use a small timeout to ensure the DOM is painted before scrolling
    const timer = setTimeout(() => {
      if (todayRef.current) {
        todayRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [currentDate]); // Rerun when the month changes

  const groupedEvents = useMemo(() => {
    const eventsInMonth = events.filter(e => e.startTime >= monthStart && e.startTime <= monthEnd);
    
    // FIX: Removed generic from reduce call and added type assertion to initial value to fix compile error.
    return eventsInMonth.reduce((acc, event) => {
      const dayKey = format(event.startTime, 'yyyy-MM-dd');
      if (!acc[dayKey]) {
        acc[dayKey] = [];
      }
      acc[dayKey].push(event);
      return acc;
    }, {} as Record<string, CalendarEvent[]>);
  }, [events, monthStart, monthEnd]);

  const sortedGroupKeys = Object.keys(groupedEvents).sort();
  const now = useMemo(() => new Date(), []);
  const todayStart = useMemo(() => startOfDay(now), [now]);


  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <h2 className="text-2xl font-semibold text-gray-800 mb-6">{format(currentDate, 'MMMM yyyy')}</h2>
      {sortedGroupKeys.length > 0 ? (
        sortedGroupKeys.map(dayKey => {
          const day = new Date(dayKey + 'T00:00:00'); // Ensure correct date object
          const dayEvents = groupedEvents[dayKey].sort((a,b) => a.startTime.getTime() - b.startTime.getTime());
          const isToday = dayKey === todayKey;

          return (
            <div key={dayKey} ref={isToday ? todayRef : null} className="flex mb-6 scroll-mt-4">
              <div className="w-20 md:w-24 flex-shrink-0 text-right pr-4">
                <div className={`text-3xl font-light ${isToday ? 'text-blue-600' : 'text-gray-800'}`}>{format(day, 'd')}</div>
                <div className={`text-sm ${isToday ? 'text-blue-600' : 'text-gray-500'}`}>{format(day, 'EEE')}</div>
              </div>
              <div className="flex-1 border-l border-gray-300 pl-4">
                {dayEvents.map(event => {
                  const dayOfEvent = startOfDay(event.startTime);
                  const isPast = event.allDay 
                      ? isBefore(dayOfEvent, todayStart)
                      : isBefore(event.endTime, now);

                  return (
                    <div 
                      key={event.id} 
                      className={`mb-4 p-4 rounded-lg shadow-sm border transition-all duration-300 ${
                        isPast 
                          ? 'bg-gray-100 border-gray-200 opacity-70' 
                          : 'bg-white border-gray-200 hover:shadow-md'
                      }`}
                    >
                      <h3 className={`font-semibold ${isPast ? 'text-gray-600' : 'text-blue-700'}`}>{event.title}</h3>
                      <p className={`text-sm ${isPast ? 'text-gray-500' : 'text-gray-600'}`}>
                        {event.allDay ? '整日' : `${format(event.startTime, 'HH:mm')} - ${format(event.endTime, 'HH:mm')}`}
                      </p>
                      {event.description && <p className="text-sm text-gray-500 mt-1">{event.description}</p>}
                      {event.location && <p className="text-sm text-gray-500 mt-1">📍 {event.location}</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      ) : (
        <div className="text-center py-12 text-gray-500">
          <p>No events scheduled for {format(currentDate, 'MMMM')}.</p>
        </div>
      )}
    </div>
  );
};