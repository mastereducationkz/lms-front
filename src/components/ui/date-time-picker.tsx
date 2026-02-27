import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon, Clock } from "lucide-react"

import { cn } from "../../lib/utils"
import { Button } from "./button"
import { Calendar } from "./calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./popover"
import { Input } from "./input"

interface DateTimePickerProps {
  date?: Date
  setDate: (date: Date | undefined) => void
  placeholder?: string
}

export function DateTimePicker({ date, setDate, placeholder }: DateTimePickerProps) {
  const [time, setTime] = React.useState<string>(
    date ? format(date, "HH:mm") : "00:00"
  )

  React.useEffect(() => {
    if (date) {
      setTime(format(date, "HH:mm"))
    } else {
      setTime("00:00")
    }
  }, [date])

  const handleDateSelect = (selectedDate: Date | undefined) => {
    if (selectedDate) {
      const [hours, minutes] = time.split(":")
      selectedDate.setHours(parseInt(hours), parseInt(minutes))
      setDate(selectedDate)
    } else {
      setDate(undefined)
    }
  }

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = e.target.value
    setTime(newTime)
    
    if (date) {
      const [hours, minutes] = newTime.split(":")
      const newDate = new Date(date)
      newDate.setHours(parseInt(hours), parseInt(minutes))
      setDate(newDate)
    }
  }

  return (
    <div className="flex gap-2">
      {/* Date Picker */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant={"outline"}
            className={cn(
              "flex-1 justify-start text-left font-normal",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date ? format(date, "PPP") : <span>{placeholder || "Pick a date"}</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={handleDateSelect}
            initialFocus
          />
        </PopoverContent>
      </Popover>
      
      {/* Time Input */}
      <div className="flex items-center gap-2 border rounded-md px-3 w-32">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <Input
          type="time"
          value={time}
          onChange={handleTimeChange}
          className="border-0 p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0"
        />
      </div>
    </div>
  )
}
