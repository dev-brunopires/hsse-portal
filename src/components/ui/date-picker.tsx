import * as React from 'react';
import { format, parse, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Clock3 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';

interface DatePickerProps {
  value?: string; // ISO date string YYYY-MM-DD
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  fromYear?: number;
  toYear?: number;
}

/**
 * Mask a raw digit string into dd/MM/yyyy progressively.
 */
function maskDate(input: string): string {
  const digits = input.replace(/\D/g, '').slice(0, 8);
  const parts: string[] = [];
  if (digits.length > 0) parts.push(digits.slice(0, 2));
  if (digits.length > 2) parts.push(digits.slice(2, 4));
  if (digits.length > 4) parts.push(digits.slice(4, 8));
  return parts.join('/');
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'dd/mm/aaaa',
  disabled = false,
  className,
  fromYear = 1950,
  toYear = 2050,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  // Convert ISO string to Date object
  const dateValue = React.useMemo(() => {
    if (!value) return undefined;
    const parsed = parse(value, 'yyyy-MM-dd', new Date());
    return isValid(parsed) ? parsed : undefined;
  }, [value]);

  // Local text state for typing
  const [text, setText] = React.useState<string>(
    dateValue ? format(dateValue, 'dd/MM/yyyy') : ''
  );

  // Sync external value -> text when not focused
  const inputRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setText(dateValue ? format(dateValue, 'dd/MM/yyyy') : '');
    }
  }, [dateValue]);

  const handleSelect = (date: Date | undefined) => {
    if (date && onChange) {
      onChange(format(date, 'yyyy-MM-dd'));
      setText(format(date, 'dd/MM/yyyy'));
    }
    setOpen(false);
  };

  const commitText = (raw: string) => {
    if (!raw) {
      onChange?.('');
      return;
    }
    const parsed = parse(raw, 'dd/MM/yyyy', new Date());
    if (isValid(parsed)) {
      const y = parsed.getFullYear();
      if (y >= fromYear && y <= toYear) {
        onChange?.(format(parsed, 'yyyy-MM-dd'));
        setText(format(parsed, 'dd/MM/yyyy'));
        return;
      }
    }
    // Invalid -> revert to last valid value
    setText(dateValue ? format(dateValue, 'dd/MM/yyyy') : '');
  };

  return (
    <div className={cn('relative w-full', className)}>
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        disabled={disabled}
        value={text}
        placeholder={placeholder}
        onChange={(e) => setText(maskDate(e.target.value))}
        onBlur={(e) => commitText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commitText((e.target as HTMLInputElement).value);
          }
        }}
        className={cn(
          'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
          !dateValue && 'text-muted-foreground'
        )}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled}
            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
            aria-label="Abrir calendário"
          >
            <CalendarIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            selected={dateValue}
            onSelect={handleSelect}
            initialFocus
            locale={ptBR}
            className={cn('p-3 pointer-events-auto')}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

// Form-compatible wrapper for react-hook-form
interface DatePickerFieldProps {
  value?: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  fromYear?: number;
  toYear?: number;
}

export const DatePickerField = React.forwardRef<HTMLButtonElement, DatePickerFieldProps>(
  ({ value, onChange, placeholder, disabled, className, fromYear, toYear }, _ref) => {
    return (
      <DatePicker
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        className={className}
        fromYear={fromYear}
        toYear={toYear}
      />
    );
  }
);

DatePickerField.displayName = 'DatePickerField';

interface DateTimePickerProps {
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

export function DateTimePicker({
  value,
  onChange,
  disabled = false,
  className,
}: DateTimePickerProps) {
  const [date = '', time = ''] = (value || '').split('T');
  const [hour = '00', minute = '00'] = time.split(':');
  const hours = React.useMemo(
    () => Array.from({ length: 24 }, (_, index) => String(index).padStart(2, '0')),
    [],
  );
  const minutes = React.useMemo(
    () => Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0')),
    [],
  );

  const emitValue = (nextDate: string, nextHour: string, nextMinute: string) => {
    onChange?.(nextDate ? `${nextDate}T${nextHour}:${nextMinute}` : '');
  };

  return (
    <div className={cn('flex w-full flex-col gap-2 sm:flex-row sm:items-center', className)}>
      <DatePicker
        value={date}
        onChange={(nextDate) => emitValue(nextDate, hour, minute)}
        disabled={disabled}
        className="min-w-0 flex-1"
      />
      <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
        <Select
          value={hour}
          onValueChange={(nextHour) => emitValue(date, nextHour, minute)}
          disabled={disabled}
        >
          <SelectTrigger aria-label="Hora" className="h-10 min-w-0 gap-2 px-3 sm:w-[74px]">
            <Clock3 className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 text-left tabular-nums">{hour}</span>
          </SelectTrigger>
          <SelectContent className="max-h-64">
            {hours.map((option) => (
              <SelectItem key={option} value={option}>{option} h</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={minute}
          onValueChange={(nextMinute) => emitValue(date, hour, nextMinute)}
          disabled={disabled}
        >
          <SelectTrigger aria-label="Minuto" className="h-10 min-w-0 px-3 sm:w-[82px]">
            <span className="min-w-0 flex-1 text-left tabular-nums">{minute}</span>
            <span className="ml-1 hidden text-xs text-muted-foreground sm:inline">min</span>
          </SelectTrigger>
          <SelectContent className="max-h-64">
            {minutes.map((option) => (
              <SelectItem key={option} value={option}>{option} min</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
