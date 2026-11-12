import { useState } from 'react';

const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

export function useCalendar() {
  const [calendarYear, setCalendarYear] = useState(() => new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(() => new Date().getMonth());

  const previousMonth = () => {
    if (calendarMonth === 0) { setCalendarYear(year => year - 1); setCalendarMonth(11); }
    else setCalendarMonth(month => month - 1);
  };

  const nextMonth = () => {
    if (calendarMonth === 11) { setCalendarYear(year => year + 1); setCalendarMonth(0); }
    else setCalendarMonth(month => month + 1);
  };

  return {
    calendarYear,
    calendarMonth,
    monthsNames: MONTHS,
    handlePrevMonth: previousMonth,
    handleNextMonth: nextMonth,
    getDaysInMonth: (year: number, month: number) => new Date(year, month + 1, 0).getDate(),
  };
}
