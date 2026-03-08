const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');

dayjs.extend(utc);
dayjs.extend(timezone);

const PH_TZ = 'Asia/Manila';

/**
 * Get current date/time in Philippine timezone.
 * @returns {dayjs.Dayjs}
 */
function now() {
  return dayjs().tz(PH_TZ);
}

/**
 * Parse a date (string or Date) into Philippine timezone.
 * @param {string|Date} value
 * @returns {dayjs.Dayjs}
 */
function parse(value) {
  return dayjs(value).tz(PH_TZ);
}

/**
 * Format a date value as 'YYYY-MM-DD' in Philippine timezone.
 * @param {string|Date} value
 * @returns {string}
 */
function toDateStr(value) {
  return parse(value).format('YYYY-MM-DD');
}

/**
 * Get the day-of-week name (e.g. 'MONDAY') for a date in Philippine timezone.
 * @param {string|Date} value
 * @returns {string}
 */
function dayOfWeek(value) {
  const names = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  return names[parse(value).day()];
}

/**
 * Get today's date as 'YYYY-MM-DD' in Philippine timezone.
 * @returns {string}
 */
function todayStr() {
  return now().format('YYYY-MM-DD');
}

/**
 * Get last day of a given month (1-indexed) in a given year.
 * @param {number} year
 * @param {number} month  1-12
 * @returns {number}
 */
function lastDayOfMonth(year, month) {
  return dayjs.tz(`${year}-${String(month).padStart(2, '0')}-01`, PH_TZ).daysInMonth();
}

module.exports = { PH_TZ, now, parse, toDateStr, dayOfWeek, todayStr, lastDayOfMonth, dayjs };
