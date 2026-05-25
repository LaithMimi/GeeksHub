import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
    startOfMonth,
    endOfMonth,
    eachDayOfInterval,
    getDay,
    format,
    subMonths,
    addMonths,
    isToday,
    isSameMonth,
} from "date-fns";

export interface MiniCalendarProps {
    taskDates: Set<string>;
    selectedDate: string | null;
    onSelectDate: (date: string) => void;
}

export default function MiniCalendar({ taskDates, selectedDate, onSelectDate }: MiniCalendarProps) {
    const [currentMonth, setCurrentMonth] = useState(new Date());

    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

    const startDay = getDay(monthStart);
    const paddedDays = Array(startDay).fill(null).concat(days);

    return (
        <div className="liquid-glass rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-[15px] font-display font-bold text-white">
                    {format(currentMonth, "MMMM yyyy")}
                </h3>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setCurrentMonth(prev => subMonths(prev, 1))}
                        className="w-11 h-11 lg:w-7 lg:h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-all"
                        aria-label="Previous month"
                    >
                        <ChevronLeft className="h-5 w-5 lg:h-3.5 lg:w-3.5" />
                    </button>
                    <button
                        onClick={() => setCurrentMonth(prev => addMonths(prev, 1))}
                        className="w-11 h-11 lg:w-7 lg:h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-all"
                        aria-label="Next month"
                    >
                        <ChevronRight className="h-5 w-5 lg:h-3.5 lg:w-3.5" />
                    </button>
                </div>
            </div>
            <div className="grid grid-cols-7 gap-0.5 text-center">
                {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(d => (
                    <div key={d} className="text-[10px] font-display font-semibold text-white/25 py-1">{d}</div>
                ))}
            </div>
            <div className="grid grid-cols-7 gap-0.5">
                {paddedDays.map((day, i) => {
                    if (!day) return <div key={`pad-${i}`} />;
                    const dateStr = format(day, "yyyy-MM-dd");
                    const hasTask = taskDates.has(dateStr);
                    const isSelected = selectedDate === dateStr;
                    const isTodayDate = isToday(day);
                    const isThisMonth = isSameMonth(day, currentMonth);
                    return (
                        <button
                            key={dateStr}
                            onClick={() => onSelectDate(dateStr)}
                            className={`relative w-full aspect-square rounded-lg flex items-center justify-center text-[12px] transition-all ${isSelected
                                ? "bg-blue-500 text-white font-semibold shadow-[0_0_12px_rgba(37,99,235,0.4)]"
                                : isTodayDate
                                    ? "bg-white/[0.08] text-white font-semibold"
                                    : isThisMonth
                                        ? "text-white/60 hover:bg-white/[0.06]"
                                        : "text-white/20"
                                }`}
                        >
                            {format(day, "d")}
                            {hasTask && !isSelected && (
                                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-blue-400" />
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
