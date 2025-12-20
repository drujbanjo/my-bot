require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');
const fs = require('fs').promises;
const path = require('path');


// Конфигурация из переменных окружения
const BOT_TOKEN = process.env.BOT_TOKEN || 'YOUR_BOT_TOKEN_HERE';
const FORUM_CHAT_ID = process.env.FORUM_CHAT_ID || 'YOUR_FORUM_CHAT_ID';
const SCHEDULE_TOPIC_ID = 3;
const HOMEWORK_TOPIC_ID = 2;
const TIMEZONE = process.env.TIMEZONE || 'Asia/Tashkent';

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

const DATA_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH || __dirname;
const HOMEWORK_FILE = path.join(DATA_DIR, 'homework.json');
const LAST_SCHEDULE_FILE = path.join(DATA_DIR, 'last_schedule.json');

// Расписание по дням недели
const schedule = {
  'Понедельник': [
    { number: 1, subject: 'Классный час', time: '13:10-13:55' },
    { number: 2, subject: 'Алгебра', time: '14:00-14:45' },
    { number: 3, subject: 'Узбекский язык', time: '14:50-15:35' },
    { number: 4, subject: 'Химия', time: '15:40-16:25' },
    { number: 5, subject: 'Английский язык', time: '16:30-17:15' },
    { number: 6, subject: 'Физкультура', time: '17:20-18:05' }
  ],
  'Вторник': [
    { number: 1, subject: 'ОГП', time: '13:10-13:55' },
    { number: 2, subject: 'Биология', time: '14:00-14:45' },
    { number: 3, subject: 'Информатика', time: '14:50-15:35' },
    { number: 4, subject: 'Геометрия', time: '15:40-16:25' },
    { number: 5, subject: 'География', time: '16:30-17:15' },
    { number: 6, subject: 'Биология', time: '17:20-18:05' }
  ],
  'Среда': [
    { number: 1, subject: 'Физкультура', time: '13:10-13:55' },
    { number: 2, subject: 'Алгебра', time: '14:00-14:45' },
    { number: 3, subject: 'Узбекский язык', time: '14:50-15:35' },
    { number: 4, subject: 'Русский язык', time: '15:40-16:25' },
    { number: 5, subject: 'Английский язык', time: '16:30-17:15' },
    { number: 6, subject: 'Геометрия', time: '17:20-18:05' }
  ],
  'Четверг': [
    { number: 1, subject: 'Технология', time: '13:10-13:55' },
    { number: 2, subject: 'Химия', time: '14:00-14:45' },
    { number: 3, subject: 'Физика', time: '14:50-15:35' },
    { number: 4, subject: 'Литература', time: '15:40-16:25' },
    { number: 5, subject: 'История Узбекситана', time: '16:30-17:15' },
    { number: 6, subject: 'Английский язык', time: '17:20-18:05' }
  ],
  'Пятница': [
    { number: 1, subject: 'Физика', time: '13:10-13:55' },
    { number: 2, subject: 'Русский язык', time: '14:00-14:45' },
    { number: 3, subject: 'Всемирная история', time: '14:50-15:35' },
    { number: 4, subject: 'Литература', time: '15:40-16:25' },
    { number: 5, subject: 'Узбекский язык', time: '16:30-17:15' }
  ],
  'Суббота': [
    { number: 1, subject: 'Биология', time: '13:10-13:55' },
    { number: 2, subject: 'География/Экономика', time: '14:00-14:45' },
    { number: 3, subject: 'История Узбекистана', time: '14:50-15:35' },
    { number: 4, subject: 'Алгебра', time: '15:40-16:25' },
    { number: 5, subject: 'Черчение', time: '16:30-17:15' }
  ],
  'Воскресенье': []
};

// Склонение дней недели в винительный падеж (на что?)
const dayAccusativeCase = {
  'Понедельник': 'Понедельник',
  'Вторник': 'Вторник',
  'Среда': 'Среду',
  'Четверг': 'Четверг',
  'Пятница': 'Пятницу',
  'Суббота': 'Субботу',
  'Воскресенье': 'Воскресенье'
};

// Список всех предметов с вариациями написания
const subjectAliases = {
  'алгебра': 'Алгебра',
  'алгебре': 'Алгебра',
  'албебра': 'Алгебра',

  'геометрия': 'Геометрия',
  'геометрии': 'Геометрия',
  'геометри': 'Геометрия',

  'физика': 'Физика',
  'физике': 'Физика',
  'физик': 'Физика',

  'химия': 'Химия',
  'химии': 'Химия',
  'хими': 'Химия',

  'биология': 'Биология',
  'биологии': 'Биология',
  'биологи': 'Биология',

  'география': 'География',
  'географии': 'География',
  'географи': 'География',

  'история узбекистана': 'История Узбекистана',
  'истрия узбекистана': 'История Узбекистана',

  'всемирная история': 'Всемирная история',
  'всемирная истрия': 'Всемирная история',

  'русский': 'Русский язык',
  'русскый': 'Русский язык',
  'русски': 'Русский язык',

  'узбекский 1 группа': 'Узбекский язык 1 группа',
  'узбекски 2 группа': 'Узбекский язык 1 группа',
  'узбекский 2 группа': 'Узбекский язык 2 группа',
  'узбекски 2 группа': 'Узбекский язык 2 группа',

  'английский 1 группа': 'Английский язык 1 группа',
  'английскый 1 группа': 'Английский язык 1 группа',
  'английски 1 группа': 'Английский язык 1 группа',

  'английский 2 группа': 'Английский язык 2 группа',
  'английскый 2 группа': 'Английский язык 2 группа',
  'английски 2 группа': 'Английский язык 2 группа',

  'литература': 'Литература',
  'литературе': 'Литература',

  'информатика 1 группа': 'Информатика 1 группа',
  'информатике 1 группа': 'Информатика 1 группа',
  'информатик 1 группа': 'Информатика 1 группа',

  'информатика 2 группа': 'Информатика 2 группа',
  'информатике 2 группа': 'Информатика 2 группа',
  'информатик 2 группа': 'Информатика 2 группа',

  'огп': 'ОГП',

  'технология девочки': 'Технология Девочки',
  'технология девочк': 'Технология Девочки',
  'технология мальчики': 'Технология Мальчики',
  'технология мальчик': 'Технология Мальчики',

  'физкультура': 'Физкультура',
  'физра': 'Физкультура',

  'черчение': 'Черчение',
  'черчени': 'Черчение',

  'воспитание': 'Воспитание',
  'воспитани': 'Воспитание',

  'классный час': 'Классный час',
  'кл. час': 'Классный час',
  'час будушего': 'Классный час',
};

// Функция для загрузки домашних заданий из файла
async function loadHomework() {
  try {
    const data = await fs.readFile(HOMEWORK_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return {};
  }
}

// Функция для сохранения домашних заданий в файл
async function saveHomework(homework) {
  try {
    await fs.writeFile(HOMEWORK_FILE, JSON.stringify(homework, null, 2), 'utf8');
  } catch (error) {
    console.error('❌ Ошибка при сохранении ДЗ:', error);
  }
}

// Функция для загрузки ID последнего сообщения с расписанием
async function loadLastScheduleMessageId() {
  try {
    const data = await fs.readFile(LAST_SCHEDULE_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return null;
  }
}

// Функция для сохранения ID последнего сообщения с расписанием
async function saveLastScheduleMessageId(messageId) {
  try {
    await fs.writeFile(LAST_SCHEDULE_FILE, JSON.stringify({ messageId }, null, 2), 'utf8');
  } catch (error) {
    console.error('❌ Ошибка при сохранении ID сообщения:', error);
  }
}

// Функция для удаления предыдущего сообщения с расписанием
async function deletePreviousSchedule() {
  try {
    const lastMessage = await loadLastScheduleMessageId();
    if (lastMessage && lastMessage.messageId) {
      await bot.deleteMessage(FORUM_CHAT_ID, lastMessage.messageId);
      console.log(`🗑️ Удалено предыдущее расписание (message_id: ${lastMessage.messageId})`);
    }
  } catch (error) {
    console.error('❌ Ошибка при удалении предыдущего расписания:', error);
  }
}

// Функция для определения предмета из текста
function detectSubjectFromMessage(text) {
  const lowerText = text.toLowerCase();

  // Ищем паттерн "Предмет - задание" или "Предмет: задание"
  for (const [alias, subject] of Object.entries(subjectAliases)) {
    // Проверяем различные форматы
    const patterns = [
      new RegExp(`^${alias}\\s*[-:—]`, 'i'),
      new RegExp(`^${alias}\\s+`, 'i'),
      new RegExp(`\\b${alias}\\s*[-:—]`, 'i')
    ];

    for (const pattern of patterns) {
      if (pattern.test(lowerText)) {
        // Извлекаем текст после предмета
        const match = text.match(new RegExp(`${alias}\\s*[-:—]?\\s*(.+)`, 'i'));
        if (match) {
          return {
            subject: subject,
            homework: match[1].trim()
          };
        }
      }
    }
  }

  return null;
}

// Автоматическое сохранение ДЗ из топика 2
bot.on('message', async (msg) => {
  // Проверяем, что сообщение из форума и из топика с ДЗ
  if (msg.chat.id.toString() === FORUM_CHAT_ID &&
    msg.message_thread_id === HOMEWORK_TOPIC_ID &&
    msg.text) {

    const detected = detectSubjectFromMessage(msg.text);

    if (detected) {
      const homework = await loadHomework();
      homework[detected.subject] = {
        text: detected.homework,
        timestamp: new Date().toISOString(),
        message_id: msg.message_id,
        full_message: msg.text
      };
      await saveHomework(homework);
      console.log(`📝 Сохранено ДЗ: ${detected.subject} → ${detected.homework}`);
    }
  }
});

// Функция для получения названия следующего дня
function getNextDayName() {
  const days = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
  const today = new Date();
  const currentDayIndex = today.getDay(); // 0 = Вс, 6 = Сб

  // Если сегодня Воскресенье (0), отменяем отправку
  if (currentDayIndex === 0) {
    return null;
  }

  const nextDay = new Date(today);
  let daysToAdd = 1;

  // Если сегодня Суббота (6), отправляем на Понедельник (+2 дня)
  if (currentDayIndex === 6) {
    daysToAdd = 2;
  }
  // Для всех остальных дней (Пн-Пт) daysToAdd остается 1.

  nextDay.setDate(today.getDate() + daysToAdd);

  return {
    name: days[nextDay.getDay()],
    date: formatDate(nextDay)
  };
}

function formatDate(date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}.${month}`;
}

// Функция для форматирования сообщения с расписанием
function formatScheduleMessage(dayInfo) {
  const lessons = schedule[dayInfo.name];
  let message = `${dayInfo.date}\n`;

  if (lessons.length === 0) {
    message += 'Выходной! 🎉';
  } else {
    lessons.forEach((lesson) => {
      message += `${lesson.number}. <b>${lesson.subject}</b> <i>(${lesson.time})</i>\n`;
    });
  }

  return message;
}

// Функция для поиска всех вариантов предмета в ДЗ
function findRelatedHomework(subjectFromSchedule, allHomework) {
  const results = [];

  // Точное совпадение
  if (allHomework[subjectFromSchedule]) {
    results.push({
      subject: subjectFromSchedule,
      homework: allHomework[subjectFromSchedule]
    });
  }

  // Частичное совпадение (для Технология → Технология Девочки/Мальчики)
  Object.keys(allHomework).forEach(hwSubject => {
    if (hwSubject !== subjectFromSchedule) {
      // Если предмет из ДЗ начинается с предмета из расписания
      if (hwSubject.startsWith(subjectFromSchedule + ' ')) {
        results.push({
          subject: hwSubject,
          homework: allHomework[hwSubject]
        });
      }
      // Или если предмет из расписания содержится в предмете из ДЗ
      // Например: "История" найдет "Всемирная история"
      else if (hwSubject.includes(subjectFromSchedule)) {
        results.push({
          subject: hwSubject,
          homework: allHomework[hwSubject]
        });
      }
    }
  });

  return results;
}

// Обновленная функция для формирования сообщения с ДЗ
async function formatHomeworkMessage(dayInfo) {
  const lessons = schedule[dayInfo.name];
  const homework = await loadHomework();

  if (lessons.length === 0) {
    return null; // Воскресенье, нет ДЗ
  }

  let hasHomework = false;
  const dayAccusative = dayAccusativeCase[dayInfo.name];
  let message = `<b>ДЗ на ${dayAccusative} (${dayInfo.date})</b>\n`;

  lessons.forEach((lesson) => {
    const relatedHW = findRelatedHomework(lesson.subject, homework);

    if (relatedHW.length > 0) {
      relatedHW.forEach(hw => {
        message += `<b>${hw.subject} - </b>${hw.homework.text}\n`;
        hasHomework = true;
      });
    }
  });

  if (!hasHomework) {
    return null;
  }

  return message.trim();
}

// Функция для отправки расписания в топик 3
async function sendScheduleToTopic() {
  try {
    const nextDay = getNextDayName();

    if (!nextDay) {
      console.log('ℹ️ Сегодня Воскресенье, отправка расписания отменена.');
      return;
    }

    // Удаляем предыдущее расписание
    await deletePreviousSchedule();

    const message = formatScheduleMessage(nextDay);
    const sentMessage = await bot.sendMessage(FORUM_CHAT_ID, message, {
      message_thread_id: SCHEDULE_TOPIC_ID,
      parse_mode: 'HTML'
    });

    // Сохраняем ID отправленного сообщения
    await saveLastScheduleMessageId(sentMessage.message_id);

    console.log(`✅ Расписание на ${nextDay.name} (${nextDay.date}) отправлено в топик ${SCHEDULE_TOPIC_ID}`);
  } catch (error) {
    console.error('❌ Ошибка при отправке расписания:', error);
  }
}

// Функция для отправки домашнего задания в топик 2
async function sendHomeworkToTopic() {
  try {
    const nextDay = getNextDayName();
    if (!nextDay) {
      console.log('ℹ️ Сегодня Воскресенье, отправка ДЗ отменена.');
      return;
    }

    const message = await formatHomeworkMessage(nextDay);

    if (message) {
      await bot.sendMessage(FORUM_CHAT_ID, message, {
        message_thread_id: HOMEWORK_TOPIC_ID,
        parse_mode: 'HTML'
      });
      console.log(`✅ ДЗ на ${nextDay.name} (${nextDay.date}) отправлено в топик ${HOMEWORK_TOPIC_ID}`);
    } else {
      console.log(`ℹ️ Нет ДЗ на ${nextDay.name}`);
    }
  } catch (error) {
    console.error('❌ Ошибка при отправке ДЗ:', error);
  }
}

// Главная функция - отправка расписания и ДЗ
async function sendDailyUpdates() {
  await sendScheduleToTopic(); // Отправляет в топик 3
  // Небольшая задержка между отправками
  setTimeout(() => {
    sendHomeworkToTopic(); // Отправляет в топик 2
  }, 2000);
}

// Запуск cron задачи - каждый день в 18:00
cron.schedule('0 18 * * *', () => {
  console.log('⏰ Время отправки расписания и ДЗ (18:00)');
  sendDailyUpdates();
}, {
  timezone: TIMEZONE
});

// Команда для просмотра всех сохраненных ДЗ
bot.onText(/\/gethw/, async (msg) => {
  const chatId = msg.chat.id;
  const homework = await loadHomework();

  const subjects = Object.keys(homework);

  if (subjects.length === 0) {
    await bot.sendMessage(chatId, 'Домашние задания пока не сохранены', { message_thread_id: HOMEWORK_TOPIC_ID });
    return;
  }

  let message = '📚 <b>Все сохраненные ДЗ:</b>\n\n';
  subjects.forEach(subject => {
    const hw = homework[subject];
    const date = new Date(hw.timestamp).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
    message += `<b>${subject}</b> (${date}):\n${hw.text}\n\n`;
  });

  await bot.sendMessage(chatId, message, {
    message_thread_id: HOMEWORK_TOPIC_ID,
    parse_mode: 'HTML'
  });
});

// Команда для просмотра ДЗ на завтра
bot.onText(/\/homework/, async (msg) => {
  const chatId = msg.chat.id;
  const nextDay = getNextDayName();
  const message = await formatHomeworkMessage(nextDay);

  if (message) {
    await bot.sendMessage(chatId, message, {
      message_thread_id: HOMEWORK_TOPIC_ID,
      parse_mode: 'HTML'
    });
  } else {
    const dayAccusative = dayAccusativeCase[nextDay.name];
    await bot.sendMessage(chatId, `Нет ДЗ на ${dayAccusative} (${nextDay.date})`, { message_thread_id: HOMEWORK_TOPIC_ID });
  }
});

// Команда для удаления ДЗ по предмету
bot.onText(/\/delhw (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const subjectInput = match[1].trim().toLowerCase();

  const subject = subjectAliases[subjectInput];

  if (!subject) {
    await bot.sendMessage(chatId, '❌ Предмет не найден', { message_thread_id: HOMEWORK_TOPIC_ID });
    return;
  }

  const homework = await loadHomework();
  if (homework[subject]) {
    delete homework[subject];
    await saveHomework(homework);
    await bot.sendMessage(chatId, `✅ ДЗ по предмету "${subject}" удалено`, { message_thread_id: HOMEWORK_TOPIC_ID });
  } else {
    await bot.sendMessage(chatId, `ℹ️ ДЗ по предмету "${subject}" не найдено`, { message_thread_id: HOMEWORK_TOPIC_ID });
  }
});

// Команда для ручной проверки расписания
bot.onText(/\/schedule/, async (msg) => {
  const chatId = msg.chat.id;
  const nextDay = getNextDayName();
  const message = formatScheduleMessage(nextDay);
  await bot.sendMessage(chatId, message, {
    message_thread_id: SCHEDULE_TOPIC_ID,
    parse_mode: 'HTML'
  });
});

// Команда для теста отправки в топик
bot.onText(/\/test/, async (msg) => {
  const chatId = msg.chat.id;

  if (chatId.toString() === FORUM_CHAT_ID) {
    await sendDailyUpdates();
    await bot.sendMessage(chatId, '✅ Тестовая отправка выполнена!\n📋 Расписание → Топик 3\n📚 ДЗ → Топик 2');
  } else {
    await bot.sendMessage(chatId, 'Эта команда работает только в форуме!');
  }
});

// Команда старт
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId,
    '🤖 <b>Бот для расписания и домашних заданий</b>\n\n' +
    '📝 <b>Как добавить ДЗ:</b>\n' +
    'Просто напишите в топик ДЗ (топик 2):\n' +
    '• Алгебра - номера 100-102\n' +
    '• Физика: параграф 15, упр. 3\n' +
    '• Русский язык - стр. 45-50\n\n' +
    'Бот автоматически сохранит ДЗ ✅\n\n' +
    '⏰ <b>Автоматическая отправка в 18:00:</b>\n' +
    '1. Расписание на завтра → топик 3 (с удалением предыдущего)\n' +
    '2. ДЗ по предметам из расписания → топик 2\n\n' +
    '🔧 <b>Команды:</b>\n' +
    '/schedule - Расписание на завтра\n' +
    '/homework - ДЗ на завтра\n' +
    '/gethw - Все сохраненные ДЗ\n' +
    '/delhw предмет - Удалить ДЗ\n' +
    '/test - Тест отправки (только в форуме)',
    { parse_mode: 'HTML' }
  );
});

console.log('🤖 Бот запущен!');
console.log('⏰ Расписание и ДЗ будут отправляться каждый день в 18:00');
console.log(`📋 Расписание → Топик ${SCHEDULE_TOPIC_ID} (с автоудалением)`);
console.log(`📚 Домашнее задание → Топик ${HOMEWORK_TOPIC_ID}`);
console.log('👂 Слушаю топик ДЗ для автоматического сохранения по предметам...');
