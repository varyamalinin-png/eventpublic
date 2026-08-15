/**
 * Генерация финансовой модели iWent (Event App) в формате Excel.
 * Данные: docs/ACCELERATOR_PRESENTATION.md, технический стек, модель монетизации (бусты, комиссия, B2B, реклама).
 * Горизонт: 3 года. Валюта: ₽ (курс USD/RUB задаётся в допущениях).
 */

const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const OUT_DIR = path.join(__dirname, '../../docs');
const OUT_FILE = path.join(OUT_DIR, 'Financial_Model_iWent.xlsx');

function numFormula(f) {
  return { t: 'n', f, v: 0 };
}

function addSheet(wb, name, rows) {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const colWidths = rows[0] ? rows[0].map((_, i) => {
    const maxLen = Math.max(
      ...rows.map((r) => {
        const cell = r?.[i];
        const text =
          cell && typeof cell === 'object'
            ? String(cell.v ?? cell.f ?? '')
            : String(cell ?? '');
        return text.length;
      }),
      12,
    );
    return { wch: Math.min(maxLen + 2, 50) };
  }) : [];
  ws['!cols'] = colWidths;
  XLSX.utils.book_append_sheet(wb, ws, name);
}

function main() {
  const wb = XLSX.utils.book_new();

  // --- Лист: Допущения (все прочие листы должны ссылаться ТОЛЬКО сюда) ---
  // Важно: не менять строки/порядок без обновления ссылок ниже.
  addSheet(wb, 'Допущения', [
    ['Key (не менять)', 'Value', 'Unit', 'Notes'],
    ['USD_RUB', 100, '₽ за $', 'Курс для перевода $ → ₽'],
    ['MAU_Y1_END', 100000, 'users', 'Целевой MAU на конец года 1 (Q4)'],
    ['MAU_Y2_END', 350000, 'users', 'Целевой MAU на конец года 2'],
    ['MAU_Y3_END', 500000, 'users', 'Целевой MAU на конец года 3'],
    ['', '', '', ''],
    ['--- User boosts ---', '', '', 'Freemium: поднятие события в ленте'],
    ['BOOST_PRICE_USD', 1, '$', 'Цена 1 буста'],
    ['BOOST_BUY_RATE', 0.05, 'share', 'Доля MAU, покупающих бусты (5%)'],
    ['BOOST_PURCHASES_PER_PAYER_PER_YEAR', 2, 'count', 'Покупок на платящего в год'],
    ['BOOST_PRICE_RUB', numFormula("B8*$B$2"), '₽', 'Авто: цена буста в ₽'],
    ['', '', '', ''],
    ['--- B2B / Paid events ---', '', '', 'Бизнес-аккаунты + комиссия с билетов'],
    ['B2B_SHARE_OF_MAU', 0.002, 'share', 'Доля бизнес-аккаунтов от MAU (0.2%)'],
    ['COMMISSION_RATE', 0.05, 'share', 'Комиссия с транзакций (5%)'],
    ['B2B_TURNOVER_USD_AVG', 5500, '$/year', 'Средний оборот B2B аккаунта (1k–10k)'],
    ['B2B_TURNOVER_RUB_AVG', numFormula("B16*$B$2"), '₽/year', 'Авто: оборот в ₽'],
    ['B2B_SUB_USD_PER_YEAR', 100, '$/year', 'Подписка бизнес-аккаунта'],
    ['B2B_SUB_RUB_PER_YEAR', numFormula("B18*$B$2"), '₽/year', 'Авто: подписка в ₽'],
    ['', '', '', ''],
    ['--- Native ads ---', '', '', 'Нативная реклама в ленте'],
    ['ADS_CPM_USD_AVG', 20, '$', 'CPM (средний, диапазон 15–25)'],
    ['ADS_IMPRESSIONS_PER_MAU_PER_MONTH', 20, 'impr', 'Показов рекламы на MAU в месяц'],
    ['', '', '', ''],
    ['--- Unit economics ---', '', '', 'Из презентации (можно править)'],
    ['CAC_RUB', 35, '₽', 'Customer Acquisition Cost'],
    ['LTV_RUB', 179.7, '₽', 'Средний LTV'],
    ['', '', '', ''],
    ['--- Costs (inputs) ---', '', '', 'Разложение OPEX по годам (все правится здесь)'],
    ['GRANT_DEV_PAY_RUB', 650000, '₽', 'Оплата труда разработчиков (грант)'],
    ['GRANT_UIUX_RUB', 150000, '₽', 'Услуги дизайнера (грант)'],
    ['GRANT_INFRA_RUB', 100000, '₽', 'Облачная инфраструктура и хостинг (грант)'],
    ['GRANT_IP_RUB', 50000, '₽', 'Регистрация товарного знака и ПО'],
    ['GRANT_SOFTWARE_RUB', 50000, '₽', 'ПО и лицензии'],
    ['GRANT_TOTAL_RUB', numFormula('SUM(B30:B34)'), '₽', 'Авто: итого грант'],
    ['Y2_INFRA_RUB', 2000000, '₽/year', 'Инфраструктура и хостинг (год 2)'],
    ['Y2_MARKETING_RUB', 15000000, '₽/year', 'Маркетинг и привлечение (год 2)'],
    ['Y2_TEAM_RUB', 8000000, '₽/year', 'Команда / расширение (год 2)'],
    ['Y2_OTHER_RUB', 0, '₽/year', 'Прочее (год 2)'],
    ['Y2_OPEX_TOTAL_RUB', numFormula('SUM(B36:B39)'), '₽/year', 'Авто: итого OPEX год 2'],
    ['Y3_INFRA_RUB', 5000000, '₽/year', 'Инфраструктура и хостинг (год 3)'],
    ['Y3_MARKETING_RUB', 35000000, '₽/year', 'Маркетинг и привлечение (год 3)'],
    ['Y3_TEAM_RUB', 20000000, '₽/year', 'Команда / расширение (год 3)'],
    ['Y3_OTHER_RUB', 0, '₽/year', 'Прочее (год 3)'],
    ['Y3_OPEX_TOTAL_RUB', numFormula('SUM(B42:B45)'), '₽/year', 'Авто: итого OPEX год 3'],
    ['', '', '', ''],
    ['--- Investor targets ---', '', '', 'Цели из описания (год 2–3)'],
    ['TARGET_REV_MIN_RUB', 5000000000, '₽/year', 'Нижняя цель по выручке'],
    ['TARGET_REV_MAX_RUB', 7000000000, '₽/year', 'Верхняя цель по выручке'],
  ]);

  // --- Лист: Выручка по годам (3 года) ---
  const D = (row) => `'Допущения'!$B$${row}`;
  const MAU_Y1 = D(3);
  const MAU_Y2 = D(4);
  const MAU_Y3 = D(5);
  const USD_RUB = D(2);
  const BOOST_PRICE_USD = D(8);
  const BOOST_BUY_RATE = D(9);
  const BOOST_PER_PAYER = D(10);
  const B2B_SHARE = D(14);
  const COMMISSION_RATE = D(15);
  const B2B_TURNOVER_USD = D(16);
  const B2B_SUB_USD = D(18);
  const ADS_CPM_USD = D(22);
  const ADS_IMP_PER_MAU_MO = D(23);

  const b2bCount = (mauRef) => `ROUND(${mauRef}*${B2B_SHARE},0)`;
  const boostsRev = (mauRef) => `${mauRef}*${BOOST_BUY_RATE}*${BOOST_PER_PAYER}*${BOOST_PRICE_USD}*${USD_RUB}`;
  const commissionRev = (mauRef) => `${b2bCount(mauRef)}*${B2B_TURNOVER_USD}*${USD_RUB}*${COMMISSION_RATE}`;
  const b2bSubRev = (mauRef) => `${b2bCount(mauRef)}*${B2B_SUB_USD}*${USD_RUB}`;
  const adsRev = (mauRef) => `((${mauRef}*${ADS_IMP_PER_MAU_MO}*12)/1000)*${ADS_CPM_USD}*${USD_RUB}`;

  addSheet(wb, 'Выручка', [
    ['Статья выручки', 'Год 1, ₽', 'Год 2, ₽', 'Год 3, ₽'],
    ['Бусты (пользователи)', numFormula(boostsRev(MAU_Y1)), numFormula(boostsRev(MAU_Y2)), numFormula(boostsRev(MAU_Y3))],
    ['Комиссия с платных событий (B2B, 5%)', numFormula(commissionRev(MAU_Y1)), numFormula(commissionRev(MAU_Y2)), numFormula(commissionRev(MAU_Y3))],
    ['Подписки бизнес-аккаунтов (B2B)', numFormula(b2bSubRev(MAU_Y1)), numFormula(b2bSubRev(MAU_Y2)), numFormula(b2bSubRev(MAU_Y3))],
    ['Нативная реклама', numFormula(adsRev(MAU_Y1)), numFormula(adsRev(MAU_Y2)), numFormula(adsRev(MAU_Y3))],
    ['Итого выручка, ₽', numFormula('SUM(B2:B5)'), numFormula('SUM(C2:C5)'), numFormula('SUM(D2:D5)')],
    ['', '', '', ''],
    ['B2B аккаунты (кол-во)', numFormula(b2bCount(MAU_Y1)), numFormula(b2bCount(MAU_Y2)), numFormula(b2bCount(MAU_Y3))],
  ]);

  // --- Лист: Расходы ---
  addSheet(wb, 'Расходы', [
    ['Статья', 'Год 1, ₽', 'Год 2, ₽', 'Год 3, ₽'],
    ['Оплата труда разработчиков', numFormula(D(30)), '', ''],
    ['Дизайн (UI/UX)', numFormula(D(31)), '', ''],
    ['Инфраструктура и хостинг (грант)', numFormula(D(32)), '', ''],
    ['Регистрация товарного знака и ПО', numFormula(D(33)), '', ''],
    ['ПО и лицензии', numFormula(D(34)), '', ''],
    ['Итого грант (год 1)', numFormula(D(35)), '', ''],
    ['', '', '', ''],
    ['Инфраструктура и хостинг', 0, numFormula(D(36)), numFormula(D(41))],
    ['Маркетинг и привлечение', 0, numFormula(D(37)), numFormula(D(42))],
    ['Команда (расширение)', 0, numFormula(D(38)), numFormula(D(43))],
    ['Прочее', 0, numFormula(D(39)), numFormula(D(44))],
    ['Итого OPEX', numFormula(D(35)), numFormula(D(40)), numFormula(D(45))],
  ]);

  // --- Лист: P&L ---
  addSheet(wb, 'P&L', [
    ['', 'Год 1', 'Год 2', 'Год 3'],
    ['Выручка, ₽', numFormula("'Выручка'!$B$6"), numFormula("'Выручка'!$C$6"), numFormula("'Выручка'!$D$6")],
    ['Расходы, ₽', numFormula("'Расходы'!$B$13"), numFormula("'Расходы'!$C$13"), numFormula("'Расходы'!$D$13")],
    ['EBITDA, ₽', numFormula('B2-B3'), numFormula('C2-C3'), numFormula('D2-D3')],
    [''],
    ['MAU (конец периода)', numFormula(MAU_Y1), numFormula(MAU_Y2), numFormula(MAU_Y3)],
    ['Выручка на MAU, ₽/год', numFormula('B2/B5'), numFormula('C2/C5'), numFormula('D2/D5')],
  ]);

  // --- Лист: Unit-экономика ---
  addSheet(wb, 'Unit-экономика', [
    ['Метрика', 'Год 1', 'Год 2', 'Год 3', 'Комментарий'],
    ['ARPU, ₽/MAU/год', numFormula("'P&L'!$B$6"), numFormula("'P&L'!$C$6"), numFormula("'P&L'!$D$6"), 'Выручка / MAU'],
    ['CAC, ₽', numFormula(D(26)), numFormula(D(26)), numFormula(D(26)), 'Из допущений'],
    ['LTV, ₽', numFormula(D(27)), numFormula(D(27)), numFormula(D(27)), 'Из допущений'],
    ['LTV/CAC', numFormula('C3/C2'), numFormula('C3/C2'), numFormula('C3/C2'), 'Цель > 3'],
    [''],
    ['Бизнес-аккаунтов (кол-во)', numFormula("'Выручка'!$B$8"), numFormula("'Выручка'!$C$8"), numFormula("'Выручка'!$D$8"), 'ROUND(MAU * доля B2B)'],
    ['Выручка с B2B (подписка+комиссия), ₽', numFormula("'Выручка'!$B$3+'Выручка'!$B$4"), numFormula("'Выручка'!$C$3+'Выручка'!$C$4"), numFormula("'Выручка'!$D$3+'Выручка'!$D$4"), ''],    
  ]);

  // --- Лист: Этапы (из презентации и твоего сообщения) ---
  addSheet(wb, 'Этапы', [
    ['Этап', 'Период', 'Ключевые цели'],
    ['Этап 1: MVP', 'Ближайшие 8 мес', 'Алгоритмическая лента, управление событиями, чаты, карты'],
    ['Этап 2: Релиз и тесты', 'Год 1', 'Вывод на рынок, тесты ML, базовая монетизация, подтверждение Unit-экономики'],
    ['Этап 3: Масштабирование', 'Год 2–3', 'B2B-партнёры, новые города РФ, 500k MAU, выручка 5–7 млрд ₽'],
    [''],
    ['Ретроспектива (сделано)', '', 'Рабочий прототип iOS и Web, концепт и UX, аналитика рынка'],
  ]);

  // --- Лист: Целевая выручка 5–7 млрд ₽ ---
  addSheet(wb, 'Цели 5-7 млрд', [
    ['Цель инвестора: выручка 5–7 млрд ₽ (год 2–3)'],
    [''],
    ['Целевая выручка, мин, ₽', numFormula(D(48))],
    ['Целевая выручка, макс, ₽', numFormula(D(49))],
    [''],
    ['При текущем ARPU (год 3), ₽/MAU/год', numFormula("'P&L'!$D$6")],
    ['Требуемый MAU для 5 млрд', numFormula(`ROUND(${D(48)}/'P&L'!$D$6,0)`)],
    ['Требуемый MAU для 7 млрд', numFormula(`ROUND(${D(49)}/'P&L'!$D$6,0)`)],
    [''],
    ['Либо: рост ARPU при 500k MAU'],
    ['ARPU для 5 млрд при MAU_Y3_END, ₽', numFormula(`${D(48)}/${MAU_Y3}`)],
    ['ARPU для 7 млрд при MAU_Y3_END, ₽', numFormula(`${D(49)}/${MAU_Y3}`)],
  ]);

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  XLSX.writeFile(wb, OUT_FILE, { bookType: 'xlsx', type: 'buffer' });
  console.log('Файл сохранён:', OUT_FILE);
}

main();
