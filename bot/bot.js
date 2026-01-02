require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');
const axios = require('axios');

// --- КОНФИГУРАЦИЯ ---
const BOT_TOKEN = process.env.BOT_TOKEN;
const FORUM_CHAT_ID = process.env.FORUM_CHAT_ID;
const SCHEDULE_TOPIC_ID = 3;
const HOMEWORK_TOPIC_ID = 2;
const TIMEZONE = process.env.TIMEZONE || 'Asia/Tashkent';

// ВАЖНО: используем имя сервиса Docker вместо localhost
const STORAGE_BASE_URL = 'http://nginx:9090';
const HOMEWORK_URL = `${STORAGE_BASE_URL}/homework.json`;
const LAST_SCHEDULE_URL = `${STORAGE_BASE_URL}/last_schedule.json`;

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// --- ФУНКЦИИ ДЛЯ РАБОТЫ С ДАННЫМИ ЧЕРЕЗ HTTP ---

async function loadHomework() {
  try {
    const response = await axios.get(HOMEWORK_URL);
    // Проверяем, что данные валидны
    if (response.data && typeof response.data === 'object') {
      return response.data;
    }
    console.log('⚠️ Получены невалидные данные ДЗ, возвращаем пустой объект');
    return {};
  } catch (error) {
    if (error.response && error.response.status === 404) {
      console.log('ℹ️ Файл homework.json не найден, создаём новый');
      await saveHomework({});
      return {};
    }
    console.error('⚠️ Ошибка загрузки ДЗ:', error.message);
    return {};
  }
}

async function saveHomework(homework) {
  try {
    await axios.put(HOMEWORK_URL, homework, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    console.log('✅ ДЗ успешно сохранено');
  } catch (error) {
    console.error('❌ Ошибка сохранения ДЗ на сервер:', error.message);
  }
}

async function loadLastScheduleMessageId() {
  try {
    const response = await axios.get(LAST_SCHEDULE_URL);
    if (response.data && response.data.messageId) {
      return response.data;
    }
    return null;
  } catch (error) {
    if (error.response && error.response.status === 404) {
      return null;
    }
    console.error('⚠️ Ошибка загрузки ID сообщения:', error.message);
    return null;
  }
}

async function saveLastScheduleMessageId(messageId) {
  try {
    await axios.put(LAST_SCHEDULE_URL, { messageId }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    console.log('✅ ID сообщения успешно сохранён');
  } catch (error) {
    console.error('❌ Ошибка сохранения ID сообщения на сервер:', error.message);
  }
}

// --- ДАННЫЕ БОТА (РАСПИСАНИЕ И АЛИАСЫ) ---

const schedule = {
  'понедельник': [
    { number: 1, subject: 'Классный час', time: '13:10-13:55' },
    { number: 2, subject: 'Алгебра', time: '14:00-14:45' },
    { number: 3, subject: 'Узбекский язык', time: '14:50-15:35' },
    { number: 4, subject: 'Химия', time: '15:40-16:25' },
    { number: 5, subject: 'Английский язык', time: '16:30-17:15' },
    { number: 6, subject: 'Физкультура', time: '17:20-18:05' }
  ],
  'вторник': [
    { number: 1, subject: 'ОГП', time: '13:10-13:55' },
    { number: 2, subject: 'Биология', time: '14:00-14:45' },
    { number: 3, subject: 'Информатика', time: '14:50-15:35' },
    { number: 4, subject: 'Геометрия', time: '15:40-16:25' },
    { number: 5, subject: 'География', time: '16:30-17:15' },
    { number: 6, subject: 'Биология', time: '17:20-18:05' }
  ],
  'среда': [
    { number: 1, subject: 'Физкультура', time: '13:10-13:55' },
    { number: 2, subject: 'Алгебра', time: '14:00-14:45' },
    { number: 3, subject: 'Узбекский язык', time: '14:50-15:35' },
    { number: 4, subject: 'Русский язык', time: '15:40-16:25' },
    { number: 5, subject: 'Английский язык', time: '16:30-17:15' },
    { number: 6, subject: 'Геометрия', time: '17:20-18:05' }
  ],
  'четверг': [
    { number: 1, subject: 'Технология', time: '13:10-13:55' },
    { number: 2, subject: 'Химия', time: '14:00-14:45' },
    { number: 3, subject: 'Физика', time: '14:50-15:35' },
    { number: 4, subject: 'Литература', time: '15:40-16:25' },
    { number: 5, subject: 'История Узбекистана', time: '16:30-17:15' },
    { number: 6, subject: 'Английский язык', time: '17:20-18:05' }
  ],
  'пятница': [
    { number: 1, subject: 'Физика', time: '13:10-13:55' },
    { number: 2, subject: 'Русский язык', time: '14:00-14:45' },
    { number: 3, subject: 'Всемирная история', time: '14:50-15:35' },
    { number: 4, subject: 'Литература', time: '15:40-16:25' },
    { number: 5, subject: 'Узбекский язык', time: '16:30-17:15' }
  ],
  'суббота': [
    { number: 1, subject: 'Биология', time: '13:10-13:55' },
    { number: 2, subject: 'География/Экономика', time: '14:00-14:45' },
    { number: 3, subject: 'История Узбекистана', time: '14:50-15:35' },
    { number: 4, subject: 'Алгебра', time: '15:40-16:25' },
    { number: 5, subject: 'Черчение', time: '16:30-17:15' }
  ],
  'воскресенье': []
};

const dayAccusativeCase = {
  'понедельник': 'понедельник', 'вторник': 'вторник', 'среда': 'среду',
  'четверг': 'четверг', 'пятница': 'пятницу', 'суббота': 'субботу', 'воскресенье': 'воскресенье'
};

const subjectAliases = {
  'алгебра': 'Алгебра', 'алгебре': 'Алгебра', 'албебра': 'Алгебра',
  'геометрия': 'Геометрия', 'геометрии': 'Геометрия', 'геометри': 'Геометрия',
  'физика': 'Физика', 'физике': 'Физика', 'физик': 'Физика',
  'химия': 'Химия', 'химии': 'Химия', 'хими': 'Химия',
  'биология': 'Биология', 'биологии': 'Биология', 'биологи': 'Биология',
  'география': 'География', 'географии': 'География', 'географи': 'География',
  'экономика': 'Экономика', 'экономик': 'Экономика',
  'история узбекистана': 'История Узбекистана', 'истрия узбекистана': 'История Узбекистана',
  'всемирная история': 'Всемирная история', 'всемирная истрия': 'Всемирная история',
  'русский': 'Русский язык', 'русскый': 'Русский язык', 'русски': 'Русский язык',
  'узбекский': 'Узбекский язык', 'узбекский язык': 'Узбекский язык',
  'английский': 'Английский язык', 'английский язык': 'Английский язык',
  'литература': 'Литература', 'литературе': 'Литература',
  'информатика': 'Информатика',
  'огп': 'ОГП', 'физкультура': 'Физкультура', 'физра': 'Физкультура',
  'черчение': 'Черчение', 'воспитание': 'Воспитание', 'классный час': 'Классный час', 'кл. час': 'Классный час',
  'технология': 'Технология'
};

// --- ВСПОМОГАТЕЛЬНАЯ ЛОГИКА ---

async function deletePreviousSchedule() {
  try {
    const lastMessage = await loadLastScheduleMessageId();
    if (lastMessage && lastMessage.messageId) {
      try {
        await bot.deleteMessage(FORUM_CHAT_ID, lastMessage.messageId);
        console.log(`🗑️ Удалено предыдущее расписание: ${lastMessage.messageId}`);
      } catch (err) {
        console.log(`ℹ️ Сообщение ${lastMessage.messageId} не найдено или уже удалено`);
      }
    }
  } catch (error) {
    console.error('❌ Ошибка при удалении сообщения:', error.message);
  }
}

function detectSubjectFromMessage(text) {
  const lowerText = text.toLowerCase();
  for (const [alias, subject] of Object.entries(subjectAliases)) {
    if (lowerText.startsWith(alias.toLowerCase())) {
      const homeworkPart = text.slice(alias.length).replace(/^[:\s\-—]+/, '').trim();
      if (homeworkPart) return { subject, homework: homeworkPart };
    }
  }
  return null;
}

function formatDate(date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}.${month}`;
}

function getNextDayName(forceMonday = false) {
  const days = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
  const today = new Date();
  const currentDayIndex = today.getDay();
  if (currentDayIndex === 0 && !forceMonday) return null;

  const nextDay = new Date(today);
  let daysToAdd = 1;
  if (currentDayIndex === 6) daysToAdd = 2;
  else if (currentDayIndex === 0) daysToAdd = 1;

  nextDay.setDate(today.getDate() + daysToAdd);
  return { name: days[nextDay.getDay()], date: formatDate(nextDay) };
}

function formatScheduleMessage(dayInfo) {
  const lessons = schedule[dayInfo.name];
  let message = `${dayInfo.date} (${dayInfo.name})\n`;
  if (!lessons || lessons.length === 0) {
    message += 'Выходной! 🎉';
  } else {
    lessons.forEach(l => {
      message += `${l.number}. <b>${l.subject}</b> <i>(${l.time})</i>\n`;
    });
  }
  return message;
}

function findRelatedHomework(subjectFromSchedule, allHomework) {
  const results = [];
  if (allHomework[subjectFromSchedule]) {
    results.push({ subject: subjectFromSchedule, homework: allHomework[subjectFromSchedule] });
  }
  Object.keys(allHomework).forEach(hwSubject => {
    if (hwSubject !== subjectFromSchedule && hwSubject.includes(subjectFromSchedule)) {
      results.push({ subject: hwSubject, homework: allHomework[hwSubject] });
    }
  });
  return results;
}

async function formatHomeworkMessage(dayInfo) {
  const lessons = schedule[dayInfo.name];
  const homework = await loadHomework();
  if (!lessons || lessons.length === 0) return null;

  let hasHomework = false;
  let message = `<b>ДЗ на ${dayAccusativeCase[dayInfo.name]} (${dayInfo.date})</b>\n`;

  lessons.forEach(lesson => {
    const relatedHw = findRelatedHomework(lesson.subject, homework);
    relatedHw.forEach(hw => {
      message += `<b>${hw.subject} - </b>${hw.homework.text}\n`;
      hasHomework = true;
    });
  });

  return hasHomework ? message.trim() : null;
}

// --- ОСНОВНЫЕ ФУНКЦИИ ОТПРАВКИ ---

async function sendScheduleToTopic() {
  const nextDay = getNextDayName();
  if (!nextDay) return;
  await deletePreviousSchedule();
  const message = formatScheduleMessage(nextDay);
  const sent = await bot.sendMessage(FORUM_CHAT_ID, message, { message_thread_id: SCHEDULE_TOPIC_ID, parse_mode: 'HTML' });
  await saveLastScheduleMessageId(sent.message_id);
}

async function sendHomeworkToTopic() {
  const nextDay = getNextDayName();
  if (!nextDay) return;
  const message = await formatHomeworkMessage(nextDay);
  if (message) {
    await bot.sendMessage(FORUM_CHAT_ID, message, { message_thread_id: HOMEWORK_TOPIC_ID, parse_mode: 'HTML' });
  }
}

async function sendDailyUpdates() {
  await sendScheduleToTopic();
  setTimeout(sendHomeworkToTopic, 2000);
}

// --- ОБРАБОТЧИКИ КОМАНД И СООБЩЕНИЙ ---

bot.on('message', async (msg) => {
  if (msg.message_thread_id == HOMEWORK_TOPIC_ID && msg.text) {
    const detected = detectSubjectFromMessage(msg.text);
    if (detected) {
      const homework = await loadHomework();
      homework[detected.subject] = {
        text: detected.homework,
        timestamp: new Date().toISOString()
      };
      await saveHomework(homework);
      console.log(`📝 ДЗ сохранено: ${detected.subject}`);
    }
  }
});

bot.onText(/\/gethw/, async (msg) => {
  const homework = await loadHomework();
  const subjects = Object.keys(homework);
  if (subjects.length === 0) return bot.sendMessage(msg.chat.id, 'ДЗ пока нет', { message_thread_id: HOMEWORK_TOPIC_ID });

  let message = '📚 <b>Все сохраненные ДЗ:</b>\n\n';
  subjects.forEach(s => {
    message += `<b>${s}</b>:\n${homework[s].text}\n\n`;
  });
  bot.sendMessage(msg.chat.id, message, { parse_mode: 'HTML', message_thread_id: HOMEWORK_TOPIC_ID });
});

bot.onText(/\/homework/, async (msg) => {
  const nextDay = getNextDayName(true);
  const message = await formatHomeworkMessage(nextDay);
  bot.sendMessage(msg.chat.id, message || `Нет ДЗ на ${nextDay.name}`, { parse_mode: 'HTML', message_thread_id: HOMEWORK_TOPIC_ID });
});

bot.onText(/\/delhw (.+)/, async (msg, match) => {
  const subjectInput = match[1].trim().toLowerCase();
  const subject = subjectAliases[subjectInput];
  if (!subject) return bot.sendMessage(msg.chat.id, 'Предмет не найден');

  const homework = await loadHomework();
  if (homework[subject]) {
    delete homework[subject];
    await saveHomework(homework);
    bot.sendMessage(msg.chat.id, `✅ ДЗ по "${subject}" удалено`);
  }
});

bot.onText(/\/schedule/, async (msg) => {
  const nextDay = getNextDayName(true);
  const message = formatScheduleMessage(nextDay);
  await deletePreviousSchedule();
  const sent = await bot.sendMessage(msg.chat.id, message, { message_thread_id: SCHEDULE_TOPIC_ID, parse_mode: 'HTML' });
  await saveLastScheduleMessageId(sent.message_id);
});

bot.onText(/\/test/, async (msg) => {
  await sendDailyUpdates();
  bot.sendMessage(msg.chat.id, '✅ Тест выполнен!');
});

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, '🤖 Бот активен. Хранилище: nginx:9090', { parse_mode: 'HTML' });
});

// --- ПЛАНИРОВЩИК (CRON) ---
cron.schedule('0 18 * * 1-6', () => {
  console.log('⏰ Время отправки (18:00)');
  sendDailyUpdates();
}, { timezone: TIMEZONE });

console.log('🤖 Бот запущен! Подключение к nginx:9090...');
