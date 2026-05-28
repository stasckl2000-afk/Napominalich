import { createClient } from '@supabase/supabase-js'
import TelegramBot from 'node-telegram-bot-api'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)
const bot = new TelegramBot(process.env.BOT_TOKEN)

function getTomorrowDate() {
  const now = new Date()
  now.setDate(now.getDate() + 1)
  return now.toISOString().split('T')[0]
}

function getWeekdayEnglish(dateStr) {
  const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
  const d = new Date(dateStr)
  return days[d.getDay()]
}

function getWeekdayRussian(dateStr) {
  const days = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота']
  const d = new Date(dateStr)
  return days[d.getDay()]
}

function getRepeatKey(repeatRule) {
  if (!repeatRule) return null
  if (repeatRule === 'daily') return 'daily'
  if (repeatRule === 'monthly') return 'monthly'
  if (repeatRule === 'yearly') return 'yearly'
  if (repeatRule.startsWith('weekly_')) {
    return 'weekly_' + getWeekdayEnglish(getTomorrowDate())
  }
  return null
}

export default async function handler(req, res) {
  try {
    const tomorrow = getTomorrowDate()
    const weekday = getWeekdayRussian(tomorrow)
    const weekdayEn = getWeekdayEnglish(tomorrow)
    
    // Разовые события на завтра
    const { data: oneTimeEvents } = await supabase
      .from('events')
      .select('*')
      .eq('event_date', tomorrow)
      .is('repeat_rule', null)
    
    // Повторяющиеся: daily, weekly на этот день недели, monthly
    const { data: repeatEvents } = await supabase
      .from('events')
      .select('*')
      .or(`repeat_rule.eq.daily,repeat_rule.eq.weekly_${weekdayEn},repeat_rule.eq.monthly`)
    
    const allEvents = [...(oneTimeEvents || []), ...(repeatEvents || [])]
    
    // Группируем по пользователям
    const byUser = {}
    for (const event of allEvents) {
      if (!byUser[event.user_id]) byUser[event.user_id] = []
      byUser[event.user_id].push(event)
    }
    
    // Отправляем напоминания
    for (const [userId, events] of Object.entries(byUser)) {
      let message = `🔔 Напоминание: завтра ${tomorrow} (${weekday})\n\n`
      for (const event of events) {
        message += `• ${event.title}`
        if (event.event_time) message += ` в ${event.event_time}`
        message += '\n'
      }
      
      try {
        await bot.sendMessage(userId, message)
      } catch (e) {
        console.error(`Failed to send to ${userId}:`, e.message)
      }
    }
    
    res.status(200).json({ ok: true, reminded: allEvents.length })
  } catch (error) {
    console.error('Cron error:', error)
    res.status(200).json({ ok: true })
  }
}
