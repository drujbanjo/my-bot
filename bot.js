require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');
const { Pool } = require('pg');

// Конфигурация из переменных окружения
const BOT_TOKEN = process.env.BOT_TOKEN || 'YOUR_BOT_TOKEN_HERE';
const FORUM_CHAT_ID = process.env.FORUM_CHAT_ID || 'YOUR_FORUM_CHAT_ID';
const SCHEDULE_TOPIC_ID = 3;
const HOMEWORK_TOPIC_ID = 2;
const TIMEZONE = process.env.TIMEZONE || 'Asia/Tashkent';

// Подключение к PostgreSQL (Neon via Vercel Storage)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  // Оптимальные настройки для Neon + Railway
  max: 10, // максимум подключений (для free tier достаточно)
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Проверка подключения при старте
pool.on('connect', () => {
  console.log('✅ Подключено к Neon PostgreSQL (Vercel Storage)');
});

pool.on('error', (err) => {
  console.error('❌ Ошибка подключения к БД:', err);
});

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

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

// Инициализация базы данных
async function initDatabase() {
  try {
    // Создаем таблицу для домашних заданий
    await pool.query(`
      CREATE TABLE IF NOT EXISTS homework (
        id SERIAL PRIMARY KEY,
        subject VARCHAR(255) UNIQUE NOT NULL,
        text TEXT NOT NULL,
        message_id INTEGER,
        full_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Создаем таблицу для хранения ID последнего расписания
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schedule_messages (
        id SERIAL PRIMARY KEY,
        message_id INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ База данных инициализирована');
  } catch (error) {
    console.error('❌ Ошибка при инициализации БД:', error);
  }
}

// Функция для сохранения/обновления ДЗ
async function saveHomework(subject, text, messageId, fullMessage) {
  try {
    await pool.query(`
      INSERT INTO homework (subject, text, message_id, full_message, updated_at)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
      ON CONFLICT (subject) 
      DO UPDATE SET 
        text = $2,
        message_id = $3,
        full_message = $4,
        updated_at = CURRENT_TIMESTAMP
    `, [subject, text, messageId, fullMessage]);

    console.log(`📝 Сохранено ДЗ: ${subject} → ${text}`);
  } catch (error) {
    console.error('❌ Ошибка при сохранении ДЗ:', error);
  }
}

// Функция для получения всех ДЗ
async function getAllHomework() {
  try {
    const result = await pool.query('SELECT * FROM homework ORDER BY subject');

    const homework = {};
    result.rows.forEach(row => {
      homework[row.subject] = {
        text: row.text,
        timestamp: row.updated_at.toISOString(),
        message_id: row.message_id,
        full_message: row.full_message
      };
    });

    return homework;
  } catch (error) {
    console.error('❌ Ошибка при получении ДЗ:', error);
    return {};
  }
}

// Функция для получения ДЗ по предмету
async function getHomeworkBySubject(subject) {
  try {
    const result = await pool.query(
      'SELECT * FROM homework WHERE subject = $1',
      [subject]
    );

    if (result.rows.length > 0) {
      const row = result.rows[0];
      return {
        text: row.text,
        timestamp: row.updated_at.toISOString(),
        message_id: row.message_id,
        full_message: row.full_message
      };
    }

    return null;
  } catch (error) {
    console.error('❌ Ошибка при получении ДЗ:', error);
    return null;
  }
}

// Функция для удаления ДЗ по предмету
async function deleteHomework(subject) {
  try {
    const result = await pool.query(
      'DELETE FROM homework WHERE subject = $1 RETURNING *',
      [subject]
    );

    return result.rowCount > 0;
  } catch (error) {
    console.error('❌ Ошибка при удалении ДЗ:', error);
    return false;
  }
}

// Функция для сохранения ID последнего расписания
async function saveLastScheduleMessageId(messageId) {
  try {
    // Удаляем все старые записи
    await pool.query('DELETE FROM schedule_messages');

    // Сохраняем новую
    await pool.query(
      'INSERT INTO schedule_messages (message_id) VALUES ($1)',
      [messageId]
    );

    console.log(`💾 Сохранен ID расписания: ${messageId}`);
  } catch (error) {
    console.error('❌ Ошибка при сохранении ID расписания:', error);
  }
}

// Функция для получения ID последнего расписания
async function getLastScheduleMessageId() {
  try {
    const result = await pool.query(
      'SELECT message_id FROM schedule_messages ORDER BY created_at DESC LIMIT 1'
    );

    if (result.rows.length > 0) {
      return result.rows[0].message_id;
    }

    return null;
  } catch (error) {
    console.error('❌ Ошибка при получении ID расписания:', error);
    return null;
  }
}

// Функция для удаления предыдущего сообщения с расписанием
async function deletePreviousSchedule() {
  try {
    const messageId = await getLastScheduleMessageId();

    if (messageId) {
      try {
        await bot.deleteMessage(FORUM_CHAT_ID, messageId);
        console.log(`🗑️ Удалено предыдущее расписание (message_id: ${messageId})`);
      } catch (deleteError) {
        if (deleteError.response && deleteError.response.body) {
          const errorCode = deleteError.response.body.error_code;
          const errorDesc = deleteError.response.body.description;

          if (errorCode === 400 && errorDesc.includes('message to delete not found')) {
            console.log(`ℹ️ Предыдущее сообщение уже удалено или не существует (message_id: ${messageId})`);
          } else {
            console.error(`❌ Ошибка при удалении сообщения: ${errorDesc}`);
          }
        } else {
          console.error('❌ Неизвестная ошибка при удалении:', deleteError.message);
        }
      }
    } else {
      console.log('ℹ️ Нет сохраненного ID предыдущего расписания');
    }
  } catch (error) {
    console.error('❌ Ошибка при загрузке ID предыдущего расписания:', error.message);
  }
}

// Функция для определения предмета из текста
function detectSubjectFromMessage(text) {
  const lowerText = text.toLowerCase();

  for (const [alias, subject] of Object.entries(subjectAliases)) {
    const patterns = [
      new RegExp(`^${alias}\\s*[-:—]`, 'i'),
      new RegExp(`^${alias}\\s+`, 'i'),
      new RegExp(`\\b${alias}\\s*[-:—]`, 'i')
    ];

    for (const pattern of patterns) {
      if (pattern.test(lowerText)) {
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
  if (msg.chat.id.toString() === FORUM_CHAT_ID &&
    msg.message_thread_id === HOMEWORK_TOPIC_ID &&
    msg.text) {

    const detected = detectSubjectFromMessage(msg.text);

    if (detected) {
      await saveHomework(
        detected.subject,
        detected.homework,
        msg.message_id,
        msg.text
      );
    }
  }
});

// Функция для получения названия следующего дня
function getNextDayName() {
  const days = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
  const today = new Date();
  const currentDayIndex = today.getDay();

  if (currentDayIndex === 0) {
    return null;
  }

  const nextDay = new Date(today);
  let daysToAdd = 1;

  if (currentDayIndex === 6) {
    daysToAdd = 2;
  }

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

  if (allHomework[subjectFromSchedule]) {
    results.push({
      subject: subjectFromSchedule,
      homework: allHomework[subjectFromSchedule]
    });
  }

  Object.keys(allHomework).forEach(hwSubject => {
    if (hwSubject !== subjectFromSchedule) {
      if (hwSubject.startsWith(subjectFromSchedule + ' ')) {
        results.push({
          subject: hwSubject,
          homework: allHomework[hwSubject]
        });
      } else if (hwSubject.includes(subjectFromSchedule)) {
        results.push({
          subject: hwSubject,
          homework: allHomework[hwSubject]
        });
      }
    }
  });

  return results;
}

// Функция для формирования сообщения с ДЗ
async function formatHomeworkMessage(dayInfo) {
  const lessons = schedule[dayInfo.name];
  const homework = await getAllHomework();

  if (lessons.length === 0) {
    return null;
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

    await deletePreviousSchedule();

    const message = formatScheduleMessage(nextDay);
    const sentMessage = await bot.sendMessage(FORUM_CHAT_ID, message, {
      message_thread_id: SCHEDULE_TOPIC_ID,
      parse_mode: 'HTML'
    });

    await saveLastScheduleMessageId(sentMessage.message_id);

    console.log(`✅ Расписание на ${nextDay.name} (${nextDay.date}) отправлено в топик ${SCHEDULE_TOPIC_ID} (message_id: ${sentMessage.message_id})`);
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
  await sendScheduleToTopic();
  setTimeout(() => {
    sendHomeworkToTopic();
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
  const homework = await getAllHomework();

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

  const deleted = await deleteHomework(subject);

  if (deleted) {
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

// Команда для экспорта всех ДЗ в JSON
bot.onText(/\/export/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    const homework = await getAllHomework();
    const scheduleId = await getLastScheduleMessageId();

    const backup = {
      homework: homework,
      lastScheduleMessageId: scheduleId,
      exportDate: new Date().toISOString()
    };

    const buffer = Buffer.from(JSON.stringify(backup, null, 2), 'utf-8');

    await bot.sendDocument(chatId, buffer, {}, {
      filename: `homework_backup_${new Date().toISOString().split('T')[0]}.json`,
      contentType: 'application/json'
    });

    console.log('📦 Создан экспорт данных');
  } catch (error) {
    console.error('❌ Ошибка при экспорте:', error);
    await bot.sendMessage(chatId, '❌ Ошибка при создании резервной копии');
  }
});

// Команда для сброса сохраненного ID расписания
bot.onText(/\/reset/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    await pool.query('DELETE FROM schedule_messages');
    await bot.sendMessage(chatId, '✅ Сохраненный ID расписания сброшен');
    console.log('🔄 Сброшен ID последнего расписания');
  } catch (error) {
    await bot.sendMessage(chatId, '❌ Ошибка при сбросе ID');
    console.error('❌ Ошибка при сбросе:', error);
  }
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
    'Бот автоматически сохранит ДЗ в PostgreSQL ✅\n\n' +
    '⏰ <b>Автоматическая отправка в 18:00:</b>\n' +
    '1. Расписание на завтра → топик 3 (с удалением предыдущего)\n' +
    '2. ДЗ по предметам из расписания → топик 2\n\n' +
    '🔧 <b>Команды:</b>\n' +
    '/schedule - Расписание на завтра\n' +
    '/homework - ДЗ на завтра\n' +
    '/gethw - Все сохраненные ДЗ\n' +
    '/delhw предмет - Удалить ДЗ\n' +
    '/export - Экспорт всех данных в JSON\n' +
    '/reset - Сбросить ID расписания\n' +
    '/test - Тест отправки (только в форуме)',
    { parse_mode: 'HTML' }
  );
});

// Запуск бота
async function start() {
  await initDatabase();
  console.log('🤖 Бот запущен с PostgreSQL!');
  console.log('⏰ Расписание и ДЗ будут отправляться каждый день в 18:00');
  console.log(`📋 Расписание → Топик ${SCHEDULE_TOPIC_ID} (с автоудалением)`);
  console.log(`📚 Домашнее задание → Топик ${HOMEWORK_TOPIC_ID}`);
  console.log('👂 Слушаю топик ДЗ для автоматического сохранения по предметам...');
}

start().catch(console.error);
