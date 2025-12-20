import * as React from "react";
import { ChevronLeft, ChevronRight, ChevronDown, Check } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3 pointer-events-auto", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center gap-2 mb-2",
        caption_label: "text-sm font-medium hidden",
        caption_dropdowns: "flex items-center gap-2 justify-center",
        dropdown_month: "relative",
        dropdown_year: "relative",
        dropdown: "hidden",
        vhidden: "sr-only",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 border-border",
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
        row: "flex w-full mt-2",
        cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
        day: cn(buttonVariants({ variant: "ghost" }), "h-9 w-9 p-0 font-normal aria-selected:opacity-100"),
        day_range_end: "day-range-end",
        day_selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        day_today: "bg-accent text-accent-foreground",
        day_outside:
          "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
        day_disabled: "text-muted-foreground opacity-50",
        day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ ..._props }) => <ChevronLeft className="h-4 w-4" />,
        IconRight: ({ ..._props }) => <ChevronRight className="h-4 w-4" />,
        Dropdown: ({ value, onChange, children, name }) => {
          const [open, setOpen] = React.useState(false);
          const options = React.Children.toArray(children) as React.ReactElement<React.HTMLProps<HTMLOptionElement>>[];
          const selected = options.find((child) => child.props.value === value);
          const isMonth = name === "months";
          
          const handleSelect = (optionValue: string | number | readonly string[] | undefined) => {
            const syntheticEvent = {
              target: { value: String(optionValue) },
            } as React.ChangeEvent<HTMLSelectElement>;
            onChange?.(syntheticEvent);
            setOpen(false);
          };

          const displayLabel = isMonth 
            ? String(selected?.props?.children).charAt(0).toUpperCase() + String(selected?.props?.children).slice(1)
            : selected?.props?.children;
          
          return (
            <Popover open={open} onOpenChange={setOpen} modal={true}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "inline-flex items-center justify-between gap-1 text-sm font-medium",
                    "h-8 px-3 rounded-md min-w-[90px]",
                    "bg-background border border-input",
                    "hover:bg-accent hover:text-accent-foreground",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    "transition-colors cursor-pointer",
                    isMonth && "min-w-[110px]"
                  )}
                >
                  <span>{displayLabel}</span>
                  <ChevronDown className={cn(
                    "h-4 w-4 opacity-50 transition-transform",
                    open && "rotate-180"
                  )} />
                </button>
              </PopoverTrigger>
              <PopoverContent 
                className="p-0 w-auto min-w-[140px]" 
                align="center"
                side="bottom"
                sideOffset={4}
                onOpenAutoFocus={(e) => e.preventDefault()}
              >
                <ScrollArea className="h-[220px]">
                  <div className="p-1">
                    {options.map((option, i) => {
                      const isSelected = option.props.value === value;
                      const label = isMonth
                        ? String(option.props.children).charAt(0).toUpperCase() + String(option.props.children).slice(1)
                        : option.props.children;
                      
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => handleSelect(option.props.value)}
                          className={cn(
                            "w-full flex items-center justify-between gap-2",
                            "px-3 py-2 text-sm rounded-md transition-colors",
                            "hover:bg-accent hover:text-accent-foreground",
                            "focus:outline-none focus:bg-accent focus:text-accent-foreground",
                            isSelected && "bg-primary/10 text-primary font-medium"
                          )}
                        >
                          <span>{label}</span>
                          {isSelected && <Check className="h-4 w-4" />}
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>
          );
        },
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
