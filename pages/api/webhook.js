import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import TelegramBot from 'node-telegram-bot-api'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const bot = new TelegramBot(process.env.BOT_TOKEN)

function getTodayDate() {
  const now = new Date()
  return now.toISOString().split('T')[0]
}

function getTomorrowDate() {
  const now = new Date()
  now.setDate(now.getDate() + 1)
  return now.toISOString().split('T')[0]
}

function addDays(dateStr, days) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function getWeekdayRussian(dateStr) {
  const days = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота']
  const d = new Date(dateStr)
  return days[d.getDay()]
}

async function parseWithGPT(text) {
  const today = getTodayDate()
  const tomorrow = getTomorrowDate()
  
  const prompt = `Сегодня ${today} (${getWeekdayRussian(today)}). Завтра ${tomorrow} (${getWeekdayRussian(tomorrow)}).

Извлеки из сообщения пользователя информацию о событии. Верни ТОЛЬКО JSON, без пояснений.

{
  "title": "название события",
  "date": "YYYY-MM-DD",
  "time": "ЧЧ:ММ или null",
  "repeat": "daily, weekly_пн, weekly_вт, weekly_ср, weekly_чт, weekly_пт, weekly_сб, weekly_вс, monthly, yearly или null"
}

Правила:
- "завтра" = ${tomorrow}, "сегодня" = ${today}, "послезавтра" = ${addDays(today, 2)}
- "каждый вторник" = weekly_вт, "каждый день" = daily, "каждый месяц" = monthly
- Если дата не указана, используй ${today}
- Если время не указано, time = null
- repeat = null если событие разовое

Сообщение: "${text}"`

  const response = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0,
    max_tokens: 200
  })

  const content = response.choices[0].message.content.trim()
  const cleaned = content.replace(/```json\n?/g, '').replace(/```/g, '').trim()
  return JSON.parse(cleaned)
}

async function saveEvent(userId, event) {
  await supabase.from('events').insert({
    user_id: userId,
    title: event.title,
    event_date: event.date,
    event_time: event.time,
    repeat_rule: event.repeat,
    color: '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).json({ ok: true })
  
  try {
    const body = req.body
    if (!body?.message?.text) return res.status(200).json({ ok: true })
    
    const chatId = body.message.chat.id
    const userId = body.message.from.id
    const text = body.message.text

    if (text === '/start') {
      await bot.sendMessage(chatId,
        '👋 Привет! Я умный календарь.\n\n' +
        'Просто напиши, что и когда запланировать:\n' +
        '• Завтра встреча в 15:00\n' +
        '• Каждый вторник йога 19:00\n' +
        '• 5 апреля день рождения Кати\n\n' +
        'Нажми кнопку "📅 Календарь" в меню, чтобы посмотреть все события.'
      )
      return res.status(200).json({ ok: true })
    }

    try {
      const event = await parseWithGPT(text)
      await saveEvent(userId, event)
      
      let response = `✅ Добавлено: ${event.title}`
      response += `\n📅 ${event.date}`
      if (event.time) response += ` в ${event.time}`
      if (event.repeat) {
        const repeatLabels = {
          'daily': '🔄 Каждый день',
          'weekly_пн': '🔄 Каждый понедельник',
          'weekly_вт': '🔄 Каждый вторник',
          'weekly_ср': '🔄 Каждую среду',
          'weekly_чт': '🔄 Каждый четверг',
          'weekly_пт': '🔄 Каждую пятницу',
          'weekly_сб': '🔄 Каждую субботу',
          'weekly_вс': '🔄 Каждое воскресенье',
          'monthly': '🔄 Каждый месяц',
          'yearly': '🔄 Каждый год'
        }
        response += `\n${repeatLabels[event.repeat] || '🔄 ' + event.repeat}`
      }
      
      await bot.sendMessage(chatId, response)
    } catch (parseError) {
      await bot.sendMessage(chatId, '😕 Не смог понять. Попробуй:\n"Завтра встреча в 15:00"\n"Каждый вторник йога 19:00"')
    }

    res.status(200).json({ ok: true })
  } catch (error) {
    console.error('Webhook error:', error)
    res.status(200).json({ ok: true })
  }
}
