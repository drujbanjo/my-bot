require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const cron = require("node-cron");
const fs = require("fs").promises;
const path = require("path");

const BOT_TOKEN = process.env.BOT_TOKEN;
const FORUM_CHAT_ID = process.env.FORUM_CHAT_ID;
const SCHEDULE_TOPIC_ID = 3;
const HOMEWORK_TOPIC_ID = 2;

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
    agentOptions: { keepAlive: true, keepAliveMsecs: 10000 },
    proxy: process.env.HTTPS_PROXY || process.env.HTTP_PROXY,
  },
  webHook: false,
});

const DATA_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH || __dirname;
const HOMEWORK_FILE = path.join(DATA_DIR, "homework.json");
const LAST_SCHEDULE_FILE = path.join(DATA_DIR, "last_schedule.json");

const GROUP_SUBJECTS = {
  "Английский язык": ["Английский язык 1 группа", "Английский язык 2 группа"],
  "Узбекский язык": ["Узбекский язык 1 группа", "Узбекский язык 2 группа"],
  Информатика: ["Информатика 1 группа", "Информатика 2 группа"],
  Технология: ["Технология Мальчики", "Технология Девочки"],
};

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
    { number: 4, subject: "Всемирная история", time: "15:40-16:25" },
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

const sendTimeByDay = (() => {
  const result = {};
  for (const [day, lessons] of Object.entries(schedule)) {
    if (!lessons.length) continue;
    const lastLesson = lessons[lessons.length - 1];
    const endStr = lastLesson.time.split("-")[1];
    let [h, m] = endStr.split(":").map(Number);
    m += 5;
    if (m >= 60) {
      h += 1;
      m -= 60;
    }
    result[day] = { hour: h, minute: m };
  }
  return result;
})();

for (const [day, t] of Object.entries(sendTimeByDay)) {
  const hh = String(t.hour).padStart(2, "0");
  const mm = String(t.minute).padStart(2, "0");
  console.log(`📅 ${day}: отправка в ${hh}:${mm} (Ташкент)`);
}

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
  литература: "Литература",
  литературе: "Литература",
  огп: "ОГП",
  физкультура: "Физкультура",
  физра: "Физкультура",
  черчение: "Черчение",
  черчени: "Черчение",
  воспитание: "Воспитание",
  воспитани: "Воспитание",
  "классный час": "Классный час",
  "кл. час": "Классный час",
  "час будушего": "Классный час",

  "английский 1 группа": "Английский язык 1 группа",
  "английскый 1 группа": "Английский язык 1 группа",
  "английски 1 группа": "Английский язык 1 группа",
  "английский язык 1 группа": "Английский язык 1 группа",
  "английский 2 группа": "Английский язык 2 группа",
  "английскый 2 группа": "Английский язык 2 группа",
  "английски 2 группа": "Английский язык 2 группа",
  "английский язык 2 группа": "Английский язык 2 группа",
  английский: "Английский язык",
  английскый: "Английский язык",
  английски: "Английский язык",
  "английский язык": "Английский язык",

  "узбекский 1 группа": "Узбекский язык 1 группа",
  "узбекски 1 группа": "Узбекский язык 1 группа",
  "узбекский язык 1 группа": "Узбекский язык 1 группа",
  "узбекский 2 группа": "Узбекский язык 2 группа",
  "узбекски 2 группа": "Узбекский язык 2 группа",
  "узбекский язык 2 группа": "Узбекский язык 2 группа",
  узбекский: "Узбекский язык",
  узбекски: "Узбекский язык",
  "узбекский язык": "Узбекский язык",

  "информатика 1 группа": "Информатика 1 группа",
  "информатике 1 группа": "Информатика 1 группа",
  "информатик 1 группа": "Информатика 1 группа",
  "информатика 2 группа": "Информатика 2 группа",
  "информатике 2 группа": "Информатика 2 группа",
  "информатик 2 группа": "Информатика 2 группа",
  информатика: "Информатика",
  информатике: "Информатика",
  информатик: "Информатика",

  "технология девочки": "Технология Девочки",
  "технология девочк": "Технология Девочки",
  "технология мальчики": "Технология Мальчики",
  "технология мальчик": "Технология Мальчики",
  технология: "Технология",
};

function resolveSubjectsToSave(canonical) {
  return GROUP_SUBJECTS[canonical] ?? [canonical];
}

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
  const t = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Tashkent" }),
  );
  const days = [
    "Воскресенье",
    "Понедельник",
    "Вторник",
    "Среда",
    "Четверг",
    "Пятница",
    "Суббота",
  ];
  const todayName = days[t.getDay()];
  const sendTime = sendTimeByDay[todayName];
  if (!sendTime) return false;
  return t.getHours() === sendTime.hour && t.getMinutes() === sendTime.minute;
}

async function initStorage() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    for (const [file, init] of [
      [HOMEWORK_FILE, "{}"],
      [LAST_SCHEDULE_FILE, "{}"],
    ]) {
      try {
        await fs.access(file);
      } catch {
        await fs.writeFile(file, init, "utf8");
        console.log(`📄 Создан ${path.basename(file)}`);
      }
    }
    console.log(`🕐 Время сервера: ${new Date().toISOString()}`);
    console.log(`🕐 Время в Ташкенте: ${getTashkentTime()}`);
  } catch (e) {
    console.error("❌ Ошибка инициализации хранилища:", e);
  }
}

async function loadHomework() {
  try {
    return JSON.parse(await fs.readFile(HOMEWORK_FILE, "utf8"));
  } catch {
    return {};
  }
}

async function saveHomework(hw) {
  try {
    await fs.writeFile(HOMEWORK_FILE, JSON.stringify(hw, null, 2), "utf8");
  } catch (e) {
    console.error("❌ Ошибка сохранения ДЗ:", e);
  }
}

async function loadLastScheduleMessageId() {
  try {
    return JSON.parse(await fs.readFile(LAST_SCHEDULE_FILE, "utf8"));
  } catch {
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
  } catch (e) {
    console.error("❌ Ошибка сохранения ID сообщения:", e);
  }
}

async function deletePreviousSchedule() {
  try {
    const last = await loadLastScheduleMessageId();
    if (!last?.messageId) {
      console.log("ℹ️ Нет сохраненного ID расписания");
      return;
    }
    try {
      await bot.deleteMessage(FORUM_CHAT_ID, last.messageId);
      console.log(`🗑️ Удалено предыдущее расписание (id: ${last.messageId})`);
    } catch (e) {
      const desc = e.response?.body?.description || e.message;
      if (desc.includes("message to delete not found")) {
        console.log(`ℹ️ Сообщение уже удалено (id: ${last.messageId})`);
      } else {
        console.error(`❌ Ошибка удаления: ${desc}`);
      }
    }
  } catch (e) {
    console.error("❌ Ошибка загрузки ID расписания:", e.message);
  }
}

function detectSubjectFromMessage(text) {
  const lower = text.toLowerCase();
  const sortedAliases = Object.entries(subjectAliases).sort(
    ([a], [b]) => b.length - a.length,
  );
  for (const [alias, canonical] of sortedAliases) {
    if (lower.startsWith(alias)) {
      const hwPart = text
        .slice(alias.length)
        .replace(/^[:\s\-—]+/, "")
        .trim();
      if (hwPart)
        return { subjects: resolveSubjectsToSave(canonical), homework: hwPart };
    }
  }
  return null;
}

bot.on("message", async (msg) => {
  console.log(
    `📨 Chat: ${msg.chat.id}, тип: ${msg.chat.type}, топик: ${msg.message_thread_id ?? "основной"}`,
  );
  if (msg.message_thread_id == HOMEWORK_TOPIC_ID && msg.text) {
    const detected = detectSubjectFromMessage(msg.text);
    if (detected) {
      const hw = await loadHomework();
      const ts = new Date().toISOString();
      for (const subj of detected.subjects) {
        hw[subj] = {
          text: detected.homework,
          timestamp: ts,
          message_id: msg.message_id,
          full_message: msg.text,
        };
        console.log(`📝 Сохранено ДЗ: ${subj} → ${detected.homework}`);
      }
      await saveHomework(hw);
      if (detected.subjects.length > 1) {
        console.log(
          `ℹ️ ДЗ сохранено для ${detected.subjects.length} групп: ${detected.subjects.join(", ")}`,
        );
      }
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
  const t = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Tashkent" }),
  );
  return { name: days[t.getDay()], date: formatDate(t) };
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
  const t = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Tashkent" }),
  );
  const idx = t.getDay();
  if (idx === 0 && !forceMonday) return null;
  const next = new Date(t);
  next.setDate(t.getDate() + (idx === 6 ? 2 : idx === 0 ? 1 : 1));
  return { name: days[next.getDay()], date: formatDate(next) };
}

function formatDate(d) {
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatScheduleMessage(dayInfo) {
  const lessons = schedule[dayInfo.name];
  let msg = `${dayInfo.date}\n`;
  if (!lessons.length) return msg + "Выходной! 🎉";
  lessons.forEach((l) => {
    msg += `${l.number}. <b>${l.subject}</b> <i>(${l.time})</i>\n`;
  });
  return msg;
}

function findRelatedHomework(scheduleSubject, allHomework) {
  const results = [],
    seen = new Set();
  const scheduleLower = scheduleSubject.toLowerCase();
  const add = (subj) => {
    if (!seen.has(subj) && allHomework[subj]) {
      seen.add(subj);
      results.push({ subject: subj, homework: allHomework[subj] });
    }
  };
  Object.keys(allHomework).forEach((hwSubj) => {
    const hwLower = hwSubj.toLowerCase();
    if (hwLower === scheduleLower) {
      add(hwSubj);
    } else if (scheduleLower.includes("/")) {
      const parts = scheduleLower.split("/").map((p) => p.trim());
      if (parts.includes(hwLower)) add(hwSubj);
    } else if (hwLower.includes(scheduleLower)) {
      add(hwSubj);
    }
  });
  if (GROUP_SUBJECTS[scheduleSubject])
    GROUP_SUBJECTS[scheduleSubject].forEach(add);
  for (const [base, variants] of Object.entries(GROUP_SUBJECTS)) {
    if (
      variants.includes(scheduleSubject) ||
      variants.some((v) => v.toLowerCase() === scheduleLower)
    )
      add(base);
  }
  return results;
}

async function formatHomeworkMessage(dayInfo) {
  const lessons = schedule[dayInfo.name];
  if (!lessons.length) return null;
  const hw = await loadHomework();
  const dayAcc = dayAccusativeCase[dayInfo.name];
  let msg = `<b>ДЗ на ${dayAcc} (${dayInfo.date})</b>\n`;
  let hasAny = false;
  lessons.forEach((l) => {
    findRelatedHomework(l.subject, hw).forEach(({ subject, homework }) => {
      msg += `<b>${subject} - </b>${homework.text}\n`;
      hasAny = true;
    });
  });
  return hasAny ? msg.trim() : null;
}

async function sendWithRetry(fn, retries = 3, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (e) {
      console.error(`❌ Попытка ${i + 1}/${retries}:`, e.message);
      if (i < retries - 1) await new Promise((r) => setTimeout(r, delay));
      else throw e;
    }
  }
}

async function sendScheduleToTopic() {
  try {
    const nextDay = getNextDayName();
    if (!nextDay) {
      console.log("ℹ️ Воскресенье, расписание не отправляется");
      return;
    }
    await deletePreviousSchedule();
    const sent = await sendWithRetry(() =>
      bot.sendMessage(FORUM_CHAT_ID, formatScheduleMessage(nextDay), {
        message_thread_id: SCHEDULE_TOPIC_ID,
        parse_mode: "HTML",
      }),
    );
    await saveLastScheduleMessageId(sent.message_id);
    console.log(
      `✅ Расписание на ${nextDay.name} (${nextDay.date}) → топик ${SCHEDULE_TOPIC_ID} (id: ${sent.message_id})`,
    );
  } catch (e) {
    console.error("❌ Ошибка отправки расписания:", e.message);
  }
}

async function sendHomeworkToTopic() {
  try {
    const nextDay = getNextDayName();
    if (!nextDay) {
      console.log("ℹ️ Воскресенье, ДЗ не отправляется");
      return;
    }
    const msg = await formatHomeworkMessage(nextDay);
    if (msg) {
      await sendWithRetry(() =>
        bot.sendMessage(FORUM_CHAT_ID, msg, {
          message_thread_id: HOMEWORK_TOPIC_ID,
          parse_mode: "HTML",
        }),
      );
      console.log(
        `✅ ДЗ на ${nextDay.name} (${nextDay.date}) → топик ${HOMEWORK_TOPIC_ID}`,
      );
    } else {
      console.log(`ℹ️ Нет ДЗ на ${nextDay.name}`);
    }
  } catch (e) {
    console.error("❌ Ошибка отправки ДЗ:", e.message);
  }
}

async function sendDailyUpdates() {
  console.log(`🕐 Попытка отправки в ${getTashkentTime()}`);
  await sendScheduleToTopic();
  await sendHomeworkToTopic();
}

// ─── FIX: флаг защиты от повторной отправки в одну минуту ───────────────────
let lastSentMinute = null;

cron.schedule("* * * * *", async () => {
  if (shouldSendNow()) {
    const days = [
      "Воскресенье",
      "Понедельник",
      "Вторник",
      "Среда",
      "Четверг",
      "Пятница",
      "Суббота",
    ];
    const t = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Tashkent" }),
    );
    const todayName = days[t.getDay()];
    const st = sendTimeByDay[todayName];
    const minuteKey = `${todayName}-${st.hour}:${st.minute}`;

    if (lastSentMinute === minuteKey) {
      console.log(`⏭️ Уже отправлено в эту минуту (${minuteKey}), пропуск`);
      return;
    }
    lastSentMinute = minuteKey;

    console.log(
      `⏰ Время отправки (${String(st.hour).padStart(2, "0")}:${String(st.minute).padStart(2, "0")} Ташкент — конец уроков + 5 мин)`,
    );
    try {
      await sendDailyUpdates();
    } catch (e) {
      console.error("❌ Ошибка автоотправки:", e);
      lastSentMinute = null; // сброс чтобы попробовать снова
    }
  }
});

setInterval(() => console.log(`🕐 Heartbeat: ${getTashkentTime()}`), 3600000);

// ─── Команды ─────────────────────────────────────────────────────────────────

bot.onText(/\/gethw/, async (msg) => {
  const hw = await loadHomework();
  const keys = Object.keys(hw);
  if (!keys.length) {
    await bot.sendMessage(msg.chat.id, "Домашние задания пока не сохранены", {
      ...(msg.message_thread_id
        ? { message_thread_id: msg.message_thread_id }
        : {}),
    });
    return;
  }
  let text = "📚 <b>Все сохраненные ДЗ:</b>\n\n";
  keys.forEach((subj) => {
    const { text: t, timestamp } = hw[subj];
    const date = new Date(timestamp).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    text += `<b>${subj}</b> (${date}):\n${t}\n\n`;
  });
  await bot.sendMessage(msg.chat.id, text, {
    parse_mode: "HTML",
    ...(msg.message_thread_id
      ? { message_thread_id: msg.message_thread_id }
      : {}),
  });
});

bot.onText(/\/homework/, async (msg) => {
  const nextDay = getNextDayName(true);
  const text = await formatHomeworkMessage(nextDay);
  const reply =
    text || `Нет ДЗ на ${dayAccusativeCase[nextDay.name]} (${nextDay.date})`;
  try {
    await bot.sendMessage(msg.chat.id, reply, {
      ...(text ? { parse_mode: "HTML" } : {}),
      ...(msg.message_thread_id
        ? { message_thread_id: msg.message_thread_id }
        : {}),
    });
  } catch (e) {
    console.error("❌ Ошибка /homework:", e.message);
  }
});

bot.onText(/\/schedule/, async (msg) => {
  const nextDay = getNextDayName(true);
  await deletePreviousSchedule();
  try {
    const sent = await bot.sendMessage(
      msg.chat.id,
      formatScheduleMessage(nextDay),
      {
        parse_mode: "HTML",
        ...(msg.message_thread_id
          ? { message_thread_id: msg.message_thread_id }
          : {}),
      },
    );
    await saveLastScheduleMessageId(sent.message_id);
  } catch (e) {
    console.error("❌ Ошибка /schedule:", e.message);
  }
});

bot.onText(/\/today/, async (msg) => {
  const today = getTodayDayName();
  const threadOpts = msg.message_thread_id
    ? { message_thread_id: msg.message_thread_id }
    : {};

  try {
    // Расписание
    await bot.sendMessage(msg.chat.id, formatScheduleMessage(today), {
      parse_mode: "HTML",
      ...threadOpts,
    });

    // ДЗ на сегодня
    const hwText = await formatHomeworkMessage(today);
    const hwReply =
      hwText || `Нет ДЗ на ${dayAccusativeCase[today.name]} (${today.date})`;
    await bot.sendMessage(msg.chat.id, hwReply, {
      ...(hwText ? { parse_mode: "HTML" } : {}),
      ...threadOpts,
    });
  } catch (e) {
    console.error("❌ Ошибка /today:", e.message);
  }
});
bot.onText(/\/test/, async (msg) => {
  if (msg.chat.id.toString() === FORUM_CHAT_ID) {
    await sendDailyUpdates();
    await bot.sendMessage(
      msg.chat.id,
      "✅ Тестовая отправка!\n📋 Расписание → Топик 3\n📚 ДЗ → Топик 2",
    );
  } else {
    await bot.sendMessage(msg.chat.id, "Эта команда работает только в форуме!");
  }
});

bot.onText(/\/start/, (msg) => {
  const info = `
<b>Информация о чате:</b>
Chat ID: <code>${msg.chat.id}</code>
Chat Type: ${msg.chat.type}
Chat Title: ${msg.chat.title || "N/A"}
${msg.message_thread_id ? `Thread ID: ${msg.message_thread_id}` : ""}

<b>Конфигурация бота:</b>
FORUM_CHAT_ID: <code>${FORUM_CHAT_ID}</code>
SCHEDULE_TOPIC_ID: ${SCHEDULE_TOPIC_ID}
HOMEWORK_TOPIC_ID: ${HOMEWORK_TOPIC_ID}
  `.trim();
  bot.sendMessage(msg.chat.id, info, { parse_mode: "HTML" });
});
(async () => {
  await initStorage();
  console.log("🤖 Бот запущен!");
  console.log(
    "⏰ Автоотправка через 5 мин после конца последнего урока (Пн-Сб)",
  );
  console.log("ℹ️ В воскресенье автоотправка отключена");
  console.log(`📋 Расписание → Топик ${SCHEDULE_TOPIC_ID} (с автоудалением)`);
  console.log(`📚 Домашнее задание → Топик ${HOMEWORK_TOPIC_ID}`);
  console.log("👂 Слушаю топик ДЗ...");
  console.log(
    "📌 Предметы с группами:",
    Object.keys(GROUP_SUBJECTS).join(", "),
  );
})();
