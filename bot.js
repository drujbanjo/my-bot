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

// Путь к файлу с домашними заданиями
const HOMEWORK_FILE = path.join(__dirname, 'homework.json');

// Расписание по дням недели
const schedule = {
  'Понедельник': [
    { number: 1, subject: 'Физкультура', time: '13:10-13:50' },
    { number: 2, subject: 'Алгебра', time: '13:55-14:35' },
    { number: 3, subject: 'Узбекский язык', time: '14:40-15:20' },
    { number: 4, subject: 'Химия', time: '15:25-16:05' },
    { number: 5, subject: 'Английский язык', time: '16:10-16:50' },
    { number: 6, subject: 'Классный час', time: '16:55-17:35' }
  ],
  'Вторник': [
    { number: 0, subject: 'География', time: '12:30-13:05' },
    { number: 1, subject: 'ОГП', time: '13:10-13:50' },
    { number: 2, subject: 'Биология', time: '13:55-14:35' },
    { number: 3, subject: 'Информатика', time: '14:40-15:20' },
    { number: 4, subject: 'Геометрия', time: '15:25-16:05' }
  ],
  'Среда': [
    { number: 1, subject: 'Физкультура', time: '13:10-13:50' },
    { number: 2, subject: 'Алгебра', time: '13:55-14:35' },
    { number: 3, subject: 'Узбекский язык', time: '14:40-15:20' },
    { number: 4, subject: 'Русский язык', time: '15:25-16:05' },
    { number: 5, subject: 'Английский язык', time: '16:10-16:50' },
    { number: 6, subject: 'Геометрия', time: '16:55-17:35' }
  ],
  'Четверг': [
    { number: 0, subject: 'Химия', time: '12:30-13:05' },
    { number: 1, subject: 'Технология', time: '13:10-13:50' },
    { number: 2, subject: 'История Узбекистана', time: '13:55-14:35' },
    { number: 3, subject: 'Литература', time: '14:40-15:20' },
    { number: 4, subject: 'Физика', time: '15:25-16:05' },
    { number: 5, subject: 'Английский язык', time: '16:10-16:50' }
  ],
  'Пятница': [
    { number: 0, subject: 'Узбекский язык', time: '12:30-13:05' },
    { number: 1, subject: 'Физика', time: '13:10-13:50' },
    { number: 2, subject: 'Русский язык', time: '13:55-14:35' },
    { number: 3, subject: 'Всемирная история', time: '14:40-15:20' },
    { number: 4, subject: 'Литература', time: '15:25-16:05' },
    { number: 5, subject: 'Воспитание', time: '16:10-16:50' }
  ],
  'Суббота': [
    { number: 2, subject: 'Биология', time: '13:55-14:35' },
    { number: 3, subject: 'География', time: '14:40-15:20' },
    { number: 4, subject: 'История Узбекистана', time: '15:25-16:05' },
    { number: 5, subject: 'Алгебра', time: '16:10-16:50' },
    { number: 6, subject: 'Черчение', time: '16:55-17:35' }
  ],
  'Воскресенье': []
};

// Список всех предметов с вариациями написания
const subjectAliases = {
  'алгебра': 'Алгебра',
  'алгебре': 'Алгебра',
  'геометрия': 'Геометрия',
  'геометрии': 'Геометрия',
  'физика': 'Физика',
  'физике': 'Физика',
  'химия': 'Химия',
  'химии': 'Химия',
  'биология': 'Биология',
  'биологии': 'Биология',
  'география': 'География',
  'географии': 'География',
  'история': 'История Узбекистана',
  'история узбекистана': 'История Узбекистана',
  'всемирная история': 'Всемирная история',
  'русский': 'Русский язык',
  'русский язык': 'Русский язык',
  'узбекский': 'Узбекский язык',
  'узбекский язык': 'Узбекский язык',
  'английский': 'Английский язык',
  'английский язык': 'Английский язык',
  'литература': 'Литература',
  'литературе': 'Литература',
  'информатика': 'Информатика',
  'информатике': 'Информатика',
  'огп': 'ОГП',
  'технология': 'Технология',
  'физкультура': 'Физкультура',
  'черчение': 'Черчение',
  'воспитание': 'Воспитание',
  'классный час': 'Классный час'
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
  const tomorrow = new Date(today);

  if (today.getDay() === 6) {
    tomorrow.setDate(today.getDate() + 2);
    return {
      name: 'Понедельник',
      date: formatDate(tomorrow)
    };
  }

  if (today.getDay() === 0) {
    tomorrow.setDate(today.getDate() + 1);
    return {
      name: 'Понедельник',
      date: formatDate(tomorrow)
    };
  }

  tomorrow.setDate(today.getDate() + 1);
  return {
    name: days[tomorrow.getDay()],
    date: formatDate(tomorrow)
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

// Функция для формирования сообщения с ДЗ на основе расписания
async function formatHomeworkMessage(dayInfo) {
  const lessons = schedule[dayInfo.name];
  const homework = await loadHomework();

  if (lessons.length === 0) {
    return null; // Воскресенье, нет ДЗ
  }

  let hasHomework = false;
  let message = `<b>ДЗ на ${dayInfo.name} (${dayInfo.date})</b>\n`;

  lessons.forEach((lesson) => {
    const hw = homework[lesson.subject];
    if (hw) {
      message += `<b>${lesson.subject} - </b>${hw.text}\n`;
      hasHomework = true;
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
    const message = formatScheduleMessage(nextDay);
    await bot.sendMessage(FORUM_CHAT_ID, message, {
      message_thread_id: SCHEDULE_TOPIC_ID, // Топик 3
      parse_mode: 'HTML'
    });
    console.log(`✅ Расписание на ${nextDay.name} (${nextDay.date}) отправлено в топик ${SCHEDULE_TOPIC_ID}`);
  } catch (error) {
    console.error('❌ Ошибка при отправке расписания:', error);
  }
}

// Функция для отправки домашнего задания в топик 2
async function sendHomeworkToTopic() {
  try {
    const nextDay = getNextDayName();
    const message = await formatHomeworkMessage(nextDay);

    if (message) {
      await bot.sendMessage(FORUM_CHAT_ID, message, {
        message_thread_id: HOMEWORK_TOPIC_ID, // Топик 2
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
    await bot.sendMessage(chatId, 'Домашние задания пока не сохранены');
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

  await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
});

// Команда для просмотра ДЗ на завтра
bot.onText(/\/homework/, async (msg) => {
  const chatId = msg.chat.id;
  const nextDay = getNextDayName();
  const message = await formatHomeworkMessage(nextDay);

  if (message) {
    // ИСПРАВЛЕНО: убран message_thread_id, ответ идет в тот же чат где была команда
    await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
  } else {
    await bot.sendMessage(chatId, `Нет ДЗ на ${nextDay.name} (${nextDay.date})`);
  }
});

// Команда для удаления ДЗ по предмету
bot.onText(/\/delhw (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const subjectInput = match[1].trim().toLowerCase();

  const subject = subjectAliases[subjectInput];

  if (!subject) {
    await bot.sendMessage(chatId, '❌ Предмет не найден');
    return;
  }

  const homework = await loadHomework();
  if (homework[subject]) {
    delete homework[subject];
    await saveHomework(homework);
    await bot.sendMessage(chatId, `✅ ДЗ по предмету "${subject}" удалено`);
  } else {
    await bot.sendMessage(chatId, `ℹ️ ДЗ по предмету "${subject}" не найдено`);
  }
});

// Команда для ручной проверки расписания
bot.onText(/\/schedule/, async (msg) => {
  const chatId = msg.chat.id;
  const nextDay = getNextDayName();
  const message = formatScheduleMessage(nextDay);
  await bot.sendMessage(chatId, message, {
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
    '1. Расписание на завтра → топик 3\n' +
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
console.log(`📋 Расписание → Топик ${SCHEDULE_TOPIC_ID}`);
console.log(`📚 Домашнее задание → Топик ${HOMEWORK_TOPIC_ID}`);
console.log('👂 Слушаю топик ДЗ для автоматического сохранения по предметам...');
