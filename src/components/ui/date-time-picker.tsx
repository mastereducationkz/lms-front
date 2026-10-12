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
import { useT } from "../../lib/i18n/react"
import { isValidDate, withTime } from "../../lib/timeInput"
import "@/lib/i18n/catalogs/chatLive"

interface DateTimePickerProps {
  date?: Date
  setDate: (date: Date | undefined) => void
  placeholder?: string
}

export function DateTimePicker({ date: dateProp, setDate, placeholder }: DateTimePickerProps) {
  const t = useT()
  // An Invalid Date from a caller's bad string reads as «no date» instead of crashing `format`.
  const date = isValidDate(dateProp) ? dateProp : undefined
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
      // The time box can be empty mid-edit: then the day is picked at its own time, never at NaN.
      setDate(withTime(selectedDate, time) ?? selectedDate)
    } else {
      setDate(undefined)
    }
  }

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = e.target.value
    setTime(newTime)
    
    // A cleared or half-typed box ("" while editing) is not a time yet: show it, change nothing.
    // It used to become NaN, an Invalid Date, and a RangeError in the page (LMS-FRONT-E).
    const next = date ? withTime(date, newTime) : null
    if (next) setDate(next)
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
            {date ? format(date, "PPP") : <span>{placeholder || t("chatLive.ui.pickDate")}</span>}
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
