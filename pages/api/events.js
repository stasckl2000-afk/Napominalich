import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)

export default async function handler(req, res) {
  const { user_id, month } = req.query
  
  if (!user_id) {
    return res.status(400).json({ error: 'user_id required' })
  }
  
  try {
    // Получаем все события пользователя
    const { data: events, error } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', user_id)
    
    if (error) throw error
    
    // Если указан месяц - фильтруем
    if (month) {
      const [year, mon] = month.split('-')
      const startDate = `${year}-${mon}-01`
      const lastDay = new Date(year, mon, 0).getDate()
      const endDate = `${year}-${mon}-${lastDay}`
      
      const filtered = []
      const today = new Date().toISOString().split('T')[0]
      
      for (const event of events) {
        // Разовые события в этом месяце
        if (!event.repeat_rule) {
          if (event.event_date >= startDate && event.event_date <= endDate) {
            filtered.push({
              id: event.id,
              title: event.title,
              date: event.event_date,
              time: event.event_time,
              color: event.color
            })
          }
        }
        // Ежедневные - все дни месяца
        else if (event.repeat_rule === 'daily') {
          let d = new Date(startDate)
          const end = new Date(endDate)
          while (d <= end) {
            const dateStr = d.toISOString().split('T')[0]
            if (dateStr >= today) {
              filtered.push({
                id: event.id + '_' + dateStr,
                title: event.title,
                date: dateStr,
                time: event.event_time,
                color: event.color
              })
            }
            d.setDate(d.getDate() + 1)
          }
        }
        // Еженедельные
        else if (event.repeat_rule.startsWith('weekly_')) {
          const targetDay = event.repeat_rule.replace('weekly_', '')
          const dayMap = {'пн':1,'вт':2,'ср':3,'чт':4,'пт':5,'сб':6,'вс':0}
          const targetDayNum = dayMap[targetDay]
          
          let d = new Date(startDate)
          const end = new Date(endDate)
          while (d <= end) {
            if (d.getDay() === targetDayNum) {
              const dateStr = d.toISOString().split('T')[0]
              if (dateStr >= today) {
                filtered.push({
                  id: event.id + '_' + dateStr,
                  title: event.title,
                  date: dateStr,
                  time: event.event_time,
                  color: event.color
                })
              }
            }
            d.setDate(d.getDate() + 1)
          }
        }
        // Ежемесячные - один раз в месяц
        else if (event.repeat_rule === 'monthly') {
          if (event.event_date >= startDate && event.event_date <= endDate) {
            filtered.push({
              id: event.id + '_' + month,
              title: event.title,
              date: event.event_date,
              time: event.event_time,
              color: event.color
            })
          }
        }
      }
      
      return res.status(200).json(filtered)
    }
    
    // Без фильтра - все события
    res.status(200).json(events.map(e => ({
      id: e.id,
      title: e.title,
      date: e.event_date,
      time: e.event_time,
      color: e.color
    })))
    
  } catch (error) {
    console.error('Events error:', error)
    res.status(500).json({ error: error.message })
  }
}
