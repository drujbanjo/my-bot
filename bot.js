require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const cron = require("node-cron");
const fs = require("fs").promises;
const path = require("path");

const BOT_TOKEN = process.env.BOT_TOKEN;
const FORUM_CHAT_ID = process.env.FORUM_CHAT_ID;
const SCHEDULE_TOPIC_ID = 3;
const HOMEWORK_TOPIC_ID = 2;

// Проверка обязательных переменных окружения
if (!BOT_TOKEN) {
  console.error("❌ BOT_TOKEN не найден в переменных окружения!");
  process.exit(1);
}

if (!FORUM_CHAT_ID) {
  console.error("❌ FORUM_CHAT_ID не найден в переменных окружения!");
  process.exit(1);
}

console.log(`✅ BOT_TOKEN: ${BOT_TOKEN.substring(0, 10)}...`);
console.log(`✅ FORUM_CHAT_ID: ${FORUM_CHAT_ID}`);

const bot = new TelegramBot(BOT_TOKEN, {
  polling: true,
  request: {
    agentOptions: {
      keepAlive: true,
      keepAliveMsecs: 10000,
    },
    proxy: process.env.HTTPS_PROXY || process.env.HTTP_PROXY,
  },
  webHook: false,
});

const DATA_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH || __dirname;
const HOMEWORK_FILE = path.join(DATA_DIR, "homework.json");
const LAST_SCHEDULE_FILE = path.join(DATA_DIR, "last_schedule.json");

const schedule = {
  Понедельник: [
    { number: 1, subject: "Классный час", time: "13:10-13:55" },
    { number: 2, subject: "Алгебра", time: "14:00-14:45" },
    { number: 3, subject: "Русский язык", time: "14:50-15:35" },
    { number: 4, subject: "Химия", time: "15:40-16:25" },
    { number: 5, subject: "Английский язык", time: "16:30-17:15" },
    { number: 6, subject: "Черчение", time: "17:20-18:05" },
  ],
  Вторник: [
    { number: 1, subject: "География", time: "13:10-13:55" },
    { number: 2, subject: "Химия", time: "14:00-14:45" },
    { number: 3, subject: "Биология", time: "14:50-15:35" },
    { number: 4, subject: "Английский язык", time: "15:40-16:25" },
    { number: 5, subject: "Геометрия", time: "16:30-17:15" },
  ],
  Среда: [
    { number: 1, subject: "Физкультура", time: "13:10-13:55" },
    { number: 2, subject: "Технология", time: "14:00-14:45" },
    { number: 3, subject: "Информатика", time: "14:50-15:35" },
    { number: 4, subject: "История Узбекистана", time: "15:40-16:25" },
    { number: 5, subject: "Узбекский язык", time: "16:30-17:15" },
    { number: 6, subject: "Алгебра", time: "17:20-18:05" },
  ],
  Четверг: [
    { number: 0, subject: "Английский язык", time: "12:15-13:00" },
    { number: 1, subject: "ОГП", time: "13:10-13:55" },
    { number: 2, subject: "Литература", time: "14:00-14:45" },
    { number: 3, subject: "Узбекский язык", time: "14:50-15:35" },
    { number: 4, subject: "Всемирная История", time: "15:40-16:25" },
  ],
  Пятница: [
    { number: 1, subject: "Узбекский язык", time: "13:10-13:55" },
    { number: 2, subject: "Биология", time: "14:00-14:45" },
    { number: 3, subject: "Геометрия", time: "14:50-15:35" },
    { number: 4, subject: "Воспитание", time: "15:40-16:25" },
    { number: 5, subject: "История Узбекистана", time: "16:30-17:15" },
    { number: 6, subject: "Физика", time: "17:20-18:05" },
  ],
  Суббота: [
    { number: 0, subject: "Физкультура", time: "12:15-13:00" },
    { number: 1, subject: "Алгебра", time: "13:10-13:55" },
    { number: 2, subject: "География/Экономика", time: "14:00-14:45" },
    { number: 3, subject: "Русский язык", time: "14:50-15:35" },
    { number: 4, subject: "Физика", time: "15:40-16:25" },
    { number: 5, subject: "Литература", time: "16:30-17:15" },
  ],
  Воскресенье: [],
};

const dayAccusativeCase = {
  Понедельник: "Понедельник",
  Вторник: "Вторник",
  Среда: "Среду",
  Четверг: "Четверг",
  Пятница: "Пятницу",
  Суббота: "Субботу",
  Воскресенье: "Воскресенье",
};

const subjectAliases = {
  алгебра: "Алгебра",
  алгебре: "Алгебра",
  албебра: "Алгебра",
  геометрия: "Геометрия",
  геометрии: "Геометрия",
  геометри: "Геометрия",
  физика: "Физика",
  физике: "Физика",
  физик: "Физика",
  химия: "Химия",
  химии: "Химия",
  хими: "Химия",
  биология: "Биология",
  биологии: "Биология",
  биологи: "Биология",
  география: "География",
  географии: "География",
  географи: "География",
  экономика: "Экономика",
  экономик: "Экономика",
  "история узбекистана": "История Узбекистана",
  "истрия узбекистана": "История Узбекистана",
  "всемирная история": "Всемирная история",
  "всемирная истрия": "Всемирная история",
  русский: "Русский язык",
  русскый: "Русский язык",
  русски: "Русский язык",
  "узбекский 1 группа": "Узбекский язык 1 группа",
  "узбекски 1 группа": "Узбекский язык 1 группа",
  "узбекский 2 группа": "Узбекский язык 2 группа",
  "узбекски 2 группа": "Узбекский язык 2 группа",
  узбекский: "Узбекский язык 2 группа",
  "английский 1 группа": "Английский язык 1 группа",
  "английскый 1 группа": "Английский язык 1 группа",
  "английски 1 группа": "Английский язык 1 группа",
  "английский 2 группа": "Английский язык 2 группа",
  "английскый 2 группа": "Английский язык 2 группа",
  "английски 2 группа": "Английский язык 2 группа",
  английский: "Английский язык 2 группа",
  литература: "Литература",
  литературе: "Литература",
  "информатика 1 группа": "Информатика 1 группа",
  "информатике 1 группа": "Информатика 1 группа",
  "информатик 1 группа": "Информатика 1 группа",
  "информатика 2 группа": "Информатика 2 группа",
  "информатике 2 группа": "Информатика 2 группа",
  "информатик 2 группа": "Информатика 2 группа",
  информатика: "Информатика 2 группа",
  огп: "ОГП",
  "технология девочки": "Технология Девочки",
  "технология девочк": "Технология Девочки",
  "технология мальчики": "Технология Мальчики",
  "технология мальчик": "Технология Мальчики",
  технология: "Технология Мальчики",
  физкультура: "Физкультура",
  физра: "Физкультура",
  черчение: "Черчение",
  черчени: "Черчение",
  воспитание: "Воспитание",
  воспитани: "Воспитание",
  "классный час": "Классный час",
  "кл. час": "Классный час",
  "час будушего": "Классный час",
};

function getTashkentTime() {
  return new Date().toLocaleString("ru-RU", {
    timeZone: "Asia/Tashkent",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function shouldSendNow() {
  const now = new Date();
  const tashkentTime = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Tashkent" }),
  );

  const hour = tashkentTime.getHours();
  const minute = tashkentTime.getMinutes();
  const day = tashkentTime.getDay();

  // Проверяем: 17:40 и НЕ воскресенье (0)
  return hour === 18 && minute === 10 && day !== 0;
}

async function initStorage() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });

    try {
      await fs.access(HOMEWORK_FILE);
    } catch {
      await fs.writeFile(HOMEWORK_FILE, JSON.stringify({}), "utf8");
      console.log("📄 Файл homework.json успешно создан");
    }

    try {
      await fs.access(LAST_SCHEDULE_FILE);
    } catch {
      await fs.writeFile(LAST_SCHEDULE_FILE, JSON.stringify({}), "utf8");
      console.log("📄 Файл last_schedule.json успешно создан");
    }

    console.log(`🕐 Текущее время сервера: ${new Date().toISOString()}`);
    console.log(`🕐 Текущее время в Ташкенте: ${getTashkentTime()}`);
  } catch (error) {
    console.error("❌ Ошибка при инициализации хранилища:", error);
  }
}

async function loadHomework() {
  try {
    const data = await fs.readFile(HOMEWORK_FILE, "utf8");
    return JSON.parse(data);
  } catch (error) {
    return {};
  }
}

async function saveHomework(homework) {
  try {
    await fs.writeFile(
      HOMEWORK_FILE,
      JSON.stringify(homework, null, 2),
      "utf8",
    );
  } catch (error) {
    console.error("❌ Ошибка при сохранении ДЗ:", error);
  }
}

async function loadLastScheduleMessageId() {
  try {
    const data = await fs.readFile(LAST_SCHEDULE_FILE, "utf8");
    return JSON.parse(data);
  } catch (error) {
    return null;
  }
}

async function saveLastScheduleMessageId(messageId) {
  try {
    await fs.writeFile(
      LAST_SCHEDULE_FILE,
      JSON.stringify({ messageId }, null, 2),
      "utf8",
    );
  } catch (error) {
    console.error("❌ Ошибка при сохранении ID сообщения:", error);
  }
}

async function deletePreviousSchedule() {
  try {
    const lastMessage = await loadLastScheduleMessageId();
    if (lastMessage && lastMessage.messageId) {
      try {
        await bot.deleteMessage(FORUM_CHAT_ID, lastMessage.messageId);
        console.log(
          `🗑️ Удалено предыдущее расписание (message_id: ${lastMessage.messageId})`,
        );
      } catch (deleteError) {
        if (deleteError.response && deleteError.response.body) {
          const errorCode = deleteError.response.body.error_code;
          const errorDesc = deleteError.response.body.description;
          if (
            errorCode === 400 &&
            errorDesc.includes("message to delete not found")
          ) {
            console.log(
              `ℹ️ Предыдущее сообщение уже удалено или не существует (message_id: ${lastMessage.messageId})`,
            );
          } else {
            console.error(`❌ Ошибка при удалении сообщения: ${errorDesc}`);
          }
        } else {
          console.error(
            "❌ Неизвестная ошибка при удалении:",
            deleteError.message,
          );
        }
      }
    } else {
      console.log("ℹ️ Нет сохраненного ID предыдущего расписания");
    }
  } catch (error) {
    console.error(
      "❌ Ошибка при загрузке ID предыдущего расписания:",
      error.message,
    );
  }
}

function detectSubjectFromMessage(text) {
  const lowerText = text.toLowerCase();
  for (const [alias, subject] of Object.entries(subjectAliases)) {
    if (lowerText.startsWith(alias.toLowerCase())) {
      const homeworkPart = text
        .slice(alias.length)
        .replace(/^[:\s\-—]+/, "")
        .trim();
      if (homeworkPart) {
        return {
          subject: subject,
          homework: homeworkPart,
        };
      }
    }
  }
  return null;
}

bot.on("message", async (msg) => {
  // Логирование для отладки
  console.log(
    `📨 Сообщение от: ${msg.chat.id}, тип: ${msg.chat.type}, топик: ${msg.message_thread_id || "основной"}`,
  );

  if (msg.message_thread_id == HOMEWORK_TOPIC_ID && msg.text) {
    const detected = detectSubjectFromMessage(msg.text);
    if (detected) {
      const homework = await loadHomework();
      homework[detected.subject] = {
        text: detected.homework,
        timestamp: new Date().toISOString(),
        message_id: msg.message_id,
        full_message: msg.text,
      };
      await saveHomework(homework);
      console.log(
        `📝 Сохранено ДЗ: ${detected.subject} → ${detected.homework}`,
      );
    }
  }
});

function getTodayDayName() {
  const days = [
    "Воскресенье",
    "Понедельник",
    "Вторник",
    "Среда",
    "Четверг",
    "Пятница",
    "Суббота",
  ];
  const now = new Date();
  const tashkentTime = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Tashkent" }),
  );
  return {
    name: days[tashkentTime.getDay()],
    date: formatDate(tashkentTime),
  };
}

function getNextDayName(forceMonday = false) {
  const days = [
    "Воскресенье",
    "Понедельник",
    "Вторник",
    "Среда",
    "Четверг",
    "Пятница",
    "Суббота",
  ];
  const now = new Date();
  const tashkentTime = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Tashkent" }),
  );
  const currentDayIndex = tashkentTime.getDay();

  // Если воскресенье и не принудительный понедельник - возвращаем null
  if (currentDayIndex === 0 && !forceMonday) {
    return null;
  }

  const nextDay = new Date(tashkentTime);
  let daysToAdd = 1;

  if (currentDayIndex === 6 || currentDayIndex === 0) {
    daysToAdd = currentDayIndex === 6 ? 2 : 1;
  }

  nextDay.setDate(tashkentTime.getDate() + daysToAdd);
  return {
    name: days[nextDay.getDay()],
    date: formatDate(nextDay),
  };
}

function formatDate(date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}`;
}

function formatScheduleMessage(dayInfo) {
  const lessons = schedule[dayInfo.name];
  let message = `${dayInfo.date}\n`;
  if (lessons.length === 0) {
    message += "Выходной! 🎉";
  } else {
    lessons.forEach((lesson) => {
      message += `${lesson.number}. <b>${lesson.subject}</b> <i>(${lesson.time})</i>\n`;
    });
  }
  return message;
}

function findRelatedHomework(subjectFromSchedule, allHomework) {
  const results = [];
  if (allHomework[subjectFromSchedule]) {
    results.push({
      subject: subjectFromSchedule,
      homework: allHomework[subjectFromSchedule],
    });
  }
  Object.keys(allHomework).forEach((hwSubject) => {
    if (hwSubject !== subjectFromSchedule) {
      if (hwSubject.startsWith(subjectFromSchedule + " ")) {
        results.push({
          subject: hwSubject,
          homework: allHomework[hwSubject],
        });
      } else if (hwSubject.includes(subjectFromSchedule)) {
        results.push({
          subject: hwSubject,
          homework: allHomework[hwSubject],
        });
      }
    }
  });
  return results;
}

async function formatHomeworkMessage(dayInfo) {
  const lessons = schedule[dayInfo.name];
  const homework = await loadHomework();
  if (lessons.length === 0) {
    return null;
  }
  let hasHomework = false;
  const dayAccusative = dayAccusativeCase[dayInfo.name];
  let message = `<b>ДЗ на ${dayAccusative} (${dayInfo.date})</b>\n`;
  lessons.forEach((lesson) => {
    const relatedHW = findRelatedHomework(lesson.subject, homework);
    if (relatedHW.length > 0) {
      relatedHW.forEach((hw) => {
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

async function sendWithRetry(sendFunction, maxRetries = 3, delay = 2000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await sendFunction();
    } catch (error) {
      console.error(
        `❌ Попытка ${i + 1}/${maxRetries} не удалась:`,
        error.message,
      );
      if (i < maxRetries - 1) {
        console.log(`⏳ Повтор через ${delay}мс...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
}

async function sendScheduleToTopic() {
  try {
    const nextDay = getNextDayName(); // Убрали true - теперь в воскресенье вернет null
    if (!nextDay) {
      console.log("ℹ️ Сегодня воскресенье, отправка расписания отменена.");
      return;
    }

    await deletePreviousSchedule();

    const message = formatScheduleMessage(nextDay);

    const sentMessage = await sendWithRetry(async () => {
      return await bot.sendMessage(FORUM_CHAT_ID, message, {
        message_thread_id: SCHEDULE_TOPIC_ID,
        parse_mode: "HTML",
      });
    });

    await saveLastScheduleMessageId(sentMessage.message_id);
    console.log(
      `✅ Расписание на ${nextDay.name} (${nextDay.date}) отправлено в топик ${SCHEDULE_TOPIC_ID} (message_id: ${sentMessage.message_id})`,
    );
  } catch (error) {
    console.error(
      "❌ Ошибка при отправке расписания после всех попыток:",
      error.message,
    );
    console.error("Детали ошибки:", {
      code: error.code,
      message: error.message,
      chatId: FORUM_CHAT_ID,
      topicId: SCHEDULE_TOPIC_ID,
    });
  }
}

async function sendHomeworkToTopic() {
  try {
    const nextDay = getNextDayName(); // Убрали true - теперь в воскресенье вернет null
    if (!nextDay) {
      console.log("ℹ️ Сегодня воскресенье, отправка ДЗ отменена.");
      return;
    }

    const message = await formatHomeworkMessage(nextDay);
    if (message) {
      await sendWithRetry(async () => {
        return await bot.sendMessage(FORUM_CHAT_ID, message, {
          message_thread_id: HOMEWORK_TOPIC_ID,
          parse_mode: "HTML",
        });
      });

      console.log(
        `✅ ДЗ на ${nextDay.name} (${nextDay.date}) отправлено в топик ${HOMEWORK_TOPIC_ID}`,
      );
    } else {
      console.log(`ℹ️ Нет ДЗ на ${nextDay.name}`);
    }
  } catch (error) {
    console.error(
      "❌ Ошибка при отправке ДЗ после всех попыток:",
      error.message,
    );
    console.error("Детали ошибки:", {
      code: error.code,
      message: error.message,
      chatId: FORUM_CHAT_ID,
      topicId: HOMEWORK_TOPIC_ID,
    });
  }
}

async function sendDailyUpdates() {
  console.log(`🕐 Попытка отправки в ${getTashkentTime()}`);
  await sendScheduleToTopic();
  await sendHomeworkToTopic();
}

cron.schedule("* * * * *", async () => {
  if (shouldSendNow()) {
    console.log("⏰ Время отправки расписания и ДЗ (17:40 Ташкент)");
    try {
      await sendDailyUpdates();
    } catch (error) {
      console.error("❌ Ошибка при выполнении автоотправки:", error);
    }
  }
});

setInterval(() => {
  console.log(`🕐 Heartbeat: ${getTashkentTime()}`);
}, 3600000);

bot.onText(/\/gethw/, async (msg) => {
  const chatId = msg.chat.id;
  const homework = await loadHomework();
  const subjects = Object.keys(homework);
  if (subjects.length === 0) {
    await bot.sendMessage(chatId, "Домашние задания пока не сохранены", {
      message_thread_id: HOMEWORK_TOPIC_ID,
    });
    return;
  }
  let message = "📚 <b>Все сохраненные ДЗ:</b>\n\n";
  subjects.forEach((subject) => {
    const hw = homework[subject];
    const date = new Date(hw.timestamp).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    message += `<b>${subject}</b> (${date}):\n${hw.text}\n\n`;
  });
  await bot.sendMessage(chatId, message, {
    message_thread_id: HOMEWORK_TOPIC_ID,
    parse_mode: "HTML",
  });
});

bot.onText(/\/homework/, async (msg) => {
  const chatId = msg.chat.id;
  const nextDay = getNextDayName(true);
  const message = await formatHomeworkMessage(nextDay);
  if (message) {
    await bot.sendMessage(chatId, message, {
      message_thread_id: HOMEWORK_TOPIC_ID,
      parse_mode: "HTML",
    });
  } else {
    const dayAccusative = dayAccusativeCase[nextDay.name];
    await bot.sendMessage(
      chatId,
      `Нет ДЗ на ${dayAccusative} (${nextDay.date})`,
      { message_thread_id: HOMEWORK_TOPIC_ID },
    );
  }
});

bot.onText(/\/delhw (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const subjectInput = match[1].trim().toLowerCase();
  const subject = subjectAliases[subjectInput];
  if (!subject) {
    await bot.sendMessage(chatId, "❌ Предмет не найден", {
      message_thread_id: HOMEWORK_TOPIC_ID,
    });
    return;
  }
  const homework = await loadHomework();
  if (homework[subject]) {
    delete homework[subject];
    await saveHomework(homework);
    await bot.sendMessage(chatId, `✅ ДЗ по предмету "${subject}" удалено`, {
      message_thread_id: HOMEWORK_TOPIC_ID,
    });
  } else {
    await bot.sendMessage(chatId, `ℹ️ ДЗ по предмету "${subject}" не найдено`, {
      message_thread_id: HOMEWORK_TOPIC_ID,
    });
  }
});

bot.onText(/\/schedule/, async (msg) => {
  const chatId = msg.chat.id;
  const nextDay = getNextDayName(true);
  const message = formatScheduleMessage(nextDay);
  await deletePreviousSchedule();
  const sentMessage = await bot.sendMessage(chatId, message, {
    message_thread_id: SCHEDULE_TOPIC_ID,
    parse_mode: "HTML",
  });
  await saveLastScheduleMessageId(sentMessage.message_id);
});

bot.onText(/\/today/, async (msg) => {
  const chatId = msg.chat.id;
  const today = getTodayDayName();
  let message = ``;
  message += formatScheduleMessage(today);
  await bot.sendMessage(chatId, message, {
    message_thread_id: msg.message_thread_id || SCHEDULE_TOPIC_ID,
    parse_mode: "HTML",
  });
});

bot.onText(/\/time/, async (msg) => {
  const chatId = msg.chat.id;
  const serverTime = new Date().toISOString();
  const tashkentTime = getTashkentTime();
  await bot.sendMessage(
    chatId,
    `🕐 Время сервера: ${serverTime}\n🕐 Время в Ташкенте: ${tashkentTime}`,
  );
});

bot.onText(/\/reset/, async (msg) => {
  const chatId = msg.chat.id;
  try {
    await fs.unlink(LAST_SCHEDULE_FILE);
    await bot.sendMessage(chatId, "✅ Сохраненный ID расписания сброшен");
    console.log("🔄 Сброшен ID последнего расписания");
  } catch (error) {
    await bot.sendMessage(chatId, "ℹ️ Нет сохраненного ID для сброса");
  }
});

bot.onText(/\/test/, async (msg) => {
  const chatId = msg.chat.id;
  if (chatId.toString() === FORUM_CHAT_ID) {
    await sendDailyUpdates();
    await bot.sendMessage(
      chatId,
      "✅ Тестовая отправка выполнена!\n📋 Расписание → Топик 3\n📚 ДЗ → Топик 2",
    );
  } else {
    await bot.sendMessage(chatId, "Эта команда работает только в форуме!");
  }
});

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const chatInfo = `
<b>Информация о чате:</b>
Chat ID: <code>${msg.chat.id}</code>
Chat Type: ${msg.chat.type}
Chat Title: ${msg.chat.title || "N/A"}
${msg.message_thread_id ? `Thread ID: ${msg.message_thread_id}` : ""}

<b>Конфигурация бота:</b>
FORUM_CHAT_ID: <code>${FORUM_CHAT_ID}</code>
SCHEDULE_TOPIC_ID: ${SCHEDULE_TOPIC_ID}
HOMEWORK_TOPIC_ID: ${HOMEWORK_TOPIC_ID}
  `;
  bot.sendMessage(chatId, chatInfo, { parse_mode: "HTML" });
});

bot.onText(/\/debug/, async (msg) => {
  const chatId = msg.chat.id;
  try {
    const testMessage = await bot.sendMessage(
      FORUM_CHAT_ID,
      "🔍 Тестовое сообщение",
      {
        message_thread_id: SCHEDULE_TOPIC_ID,
      },
    );
    await bot.sendMessage(
      chatId,
      `✅ Тест успешен! Message ID: ${testMessage.message_id}`,
    );
  } catch (error) {
    await bot.sendMessage(
      chatId,
      `❌ Тест не прошел:\n${error.message}\nКод: ${error.code}`,
    );
  }
});

(async () => {
  await initStorage();
  console.log("🤖 Бот запущен!");
  console.log(
    "⏰ Расписание и ДЗ будут отправляться каждый день в 17:40 (Пн-Сб)",
  );
  console.log("ℹ️ В воскресенье автоотправка отключена");
  console.log(`📋 Расписание → Топик ${SCHEDULE_TOPIC_ID} (с автоудалением)`);
  console.log(`📚 Домашнее задание → Топик ${HOMEWORK_TOPIC_ID}`);
  console.log(
    "👂 Слушаю топик ДЗ для автоматического сохранения по предметам...",
  );
})();
