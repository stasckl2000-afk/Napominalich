import { useState, useEffect, useCallback } from 'react'

const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const monthNames = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
]

export default function CalendarApp() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [events, setEvents] = useState([])
  const [selectedDay, setSelectedDay] = useState(null)
  const [userId, setUserId] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Получаем userId из Telegram WebApp
    let tgUserId = null
    try {
      const tg = window?.Telegram?.WebApp
      if (tg && tg.initDataUnsafe?.user?.id) {
        tgUserId = tg.initDataUnsafe.user.id
        tg.ready()
        tg.expand()
      }
    } catch (e) {}
    
    setUserId(tgUserId)
    setLoading(false)
  }, [])

  const fetchEvents = useCallback(async (year, month) => {
    if (!userId) return
    const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`
    try {
      const res = await fetch(`/api/events?user_id=${userId}&month=${monthStr}`)
      const data = await res.json()
      setEvents(data || [])
    } catch (e) {
      console.error(e)
    }
  }, [userId])

  useEffect(() => {
    if (!userId) return
    fetchEvents(currentDate.getFullYear(), currentDate.getMonth())
  }, [currentDate, userId, fetchEvents])

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  // Первый день месяца
  const firstDay = new Date(year, month, 1)
  // Последний день месяца
  const lastDay = new Date(year, month + 1, 0)
  // День недели первого числа (0 - вс, 1 - пн, ..., 6 - сб)
  let firstDayOfWeek = firstDay.getDay() || 7 // Вс -> 7

  const daysInMonth = lastDay.getDate()
  const days = []

  // Пустые клетки до первого числа
  for (let i = 1; i < firstDayOfWeek; i++) {
    days.push(null)
  }

  // Дни месяца
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(d)
  }

  // Группируем по неделям
  const weeks = []
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7))
  }

  const getEventsForDay = (day) => {
    if (!day) return []
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return events.filter(e => e.date === dateStr)
  }

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1))
    setSelectedDay(null)
  }

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1))
    setSelectedDay(null)
  }

  if (loading) {
    return <div style={styles.loading}>Загрузка...</div>
  }

  if (!userId) {
    return (
      <div style={styles.loading}>
        <p>Откройте календарь через Telegram бота</p>
        <p style={{ fontSize: '14px', color: '#888' }}>Нажмите кнопку "📅 Календарь" в меню бота</p>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      {/* Заголовок */}
      <div style={styles.header}>
        <button onClick={prevMonth} style={styles.navBtn}>◀</button>
        <h2 style={styles.title}>{monthNames[month]} {year}</h2>
        <button onClick={nextMonth} style={styles.navBtn}>▶</button>
      </div>

      {/* Дни недели */}
      <div style={styles.weekDays}>
        {weekDays.map(d => (
          <div key={d} style={styles.weekDay}>{d}</div>
        ))}
      </div>

      {/* Сетка календаря */}
      <div style={styles.grid}>
        {weeks.map((week, wi) => (
          <div key={wi} style={styles.week}>
            {week.map((day, di) => {
              const dayEvents = getEventsForDay(day)
              const isToday = day === new Date().getDate() && 
                month === new Date().getMonth() && 
                year === new Date().getFullYear()
              const isSelected = selectedDay === day

              return (
                <div
                  key={di}
                  style={{
                    ...styles.day,
                    ...(isToday ? styles.today : {}),
                    ...(isSelected ? styles.selected : {}),
                    ...(!day ? styles.empty : {})
                  }}
                  onClick={() => day && setSelectedDay(day)}
                >
                  {day && (
                    <>
                      <span style={styles.dayNum}>{day}</span>
                      {dayEvents.length > 0 && (
                        <div style={styles.dots}>
                          {dayEvents.slice(0, 3).map((ev, i) => (
                            <div
                              key={i}
                              style={{
                                ...styles.dot,
                                backgroundColor: ev.color || '#4A90D9'
                              }}
                            />
                          ))}
                          {dayEvents.length > 3 && (
                            <span style={styles.moreDots}>+{dayEvents.length - 3}</span>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* События выбранного дня */}
      {selectedDay && (
        <div style={styles.eventsPanel}>
          <h3 style={styles.eventsTitle}>
            {selectedDay} {monthNames[month]} {year}
          </h3>
          {getEventsForDay(selectedDay).length === 0 ? (
            <p style={styles.noEvents}>Нет событий</p>
          ) : (
            getEventsForDay(selectedDay).map((ev, i) => (
              <div key={i} style={styles.eventItem}>
                <div style={{ ...styles.eventDot, backgroundColor: ev.color || '#4A90D9' }} />
                <div>
                  <div style={styles.eventTitle}>{ev.title}</div>
                  {ev.time && <div style={styles.eventTime}>🕐 {ev.time}</div>}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

const styles = {
  container: {
    maxWidth: '420px',
    margin: '0 auto',
    padding: '16px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    backgroundColor: '#fff',
    minHeight: '100vh',
    color: '#1a1a1a'
  },
  loading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    padding: '20px',
    textAlign: 'center'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px'
  },
  title: {
    fontSize: '20px',
    fontWeight: '600',
    margin: 0
  },
  navBtn: {
    background: '#f0f0f0',
    border: 'none',
    borderRadius: '10px',
    padding: '10px 16px',
    fontSize: '16px',
    cursor: 'pointer',
    color: '#333'
  },
  weekDays: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: '4px',
    marginBottom: '8px'
  },
  weekDay: {
    textAlign: 'center',
    fontSize: '13px',
    fontWeight: '600',
    color: '#888',
    padding: '8px 0'
  },
  grid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  week: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: '4px'
  },
  day: {
    aspectRatio: '1',
    borderRadius: '10px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
    padding: '4px',
    cursor: 'pointer',
    backgroundColor: '#f9f9f9',
    minHeight: '44px'
  },
  empty: {
    backgroundColor: 'transparent',
    cursor: 'default'
  },
  today: {
    backgroundColor: '#e8f0fe',
    border: '2px solid #4A90D9'
  },
  selected: {
    backgroundColor: '#d0e0f7',
    border: '2px solid #4A90D9'
  },
  dayNum: {
    fontSize: '14px',
    fontWeight: '500',
    marginTop: '2px'
  },
  dots: {
    display: 'flex',
    gap: '2px',
    marginTop: '2px',
    flexWrap: 'wrap',
    justifyContent: 'center'
  },
  dot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%'
  },
  moreDots: {
    fontSize: '8px',
    color: '#888'
  },
  eventsPanel: {
    marginTop: '20px',
    borderTop: '1px solid #eee',
    paddingTop: '16px'
  },
  eventsTitle: {
    fontSize: '16px',
    fontWeight: '600',
    marginBottom: '12px'
  },
  noEvents: {
    color: '#888',
    fontSize: '14px'
  },
  eventItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    padding: '10px',
    backgroundColor: '#f9f9f9',
    borderRadius: '10px',
    marginBottom: '8px'
  },
  eventDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    marginTop: '4px',
    flexShrink: 0
  },
  eventTitle: {
    fontSize: '15px',
    fontWeight: '500'
  },
  eventTime: {
    fontSize: '13px',
    color: '#666',
    marginTop: '2px'
  }
    }
