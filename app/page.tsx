'use client';

import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';


interface DataRow {
  ФИО: string;
  СНИЛС: string; // В первой версии не используется, но сохранена для совместимости
  СУММА: number;
}

interface FullReportRow {
  ФИО: string;
  СУММА: number;
}

interface ComparisonResult {
  ФИО: string;
  Разница: number;
  Статус: string;
}

const CompareTables = () => {
  const [registryText, setRegistryText] = useState<string>('');
  const [fullReportText, setFullReportText] = useState<string>('');
  const [differences, setDifferences] = useState<ComparisonResult[]>([]);
  const [error, setError] = useState<string>('');
  const [filterMatches, setFilterMatches] = useState<boolean>(false);
  const [filterTerminated, setFilterTerminated] = useState<boolean>(false);
  const [sessionId, setSessionId] = useState<string>('');
  const [isVersionTwo, setIsVersionTwo] = useState<boolean>(false); // false = версия 1 (9 колонок реестра), true = версия 2 (2 или 3 колонки реестра)

  // Генерация уникального ID сессии при первой загрузке
  useEffect(() => {
    const storedSessionId = localStorage.getItem('current_session_id');
    if (storedSessionId) {
      setSessionId(storedSessionId);
    } else {
      const newSessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('current_session_id', newSessionId);
      setSessionId(newSessionId);
    }
  }, []);

  // Создаем префикс для ключей localStorage, включающий ID сессии
  const getStorageKey = (key: string) => {
    return `${sessionId}_${key}`;
  };
  const extractFIO = (text: string): string => {
    // Предположим, что ФИО — это первые три слова (Фамилия Имя Отчество)
    const words = text.trim().split(/\s+/);
    return cleanFIO(words.slice(0, 3).join(' '));
  };

  // Загрузка данных из localStorage при первом рендеринге и при изменении sessionId
  useEffect(() => {
    if (!sessionId) return;

    const savedRegistryText = localStorage.getItem(getStorageKey('registryText'));
    const savedFullReportText = localStorage.getItem(getStorageKey('fullReportText'));
    const savedFilterMatches = localStorage.getItem(getStorageKey('filterMatches'));
    const savedFilterTerminated = localStorage.getItem(getStorageKey('filterTerminated'));
    const savedIsVersionTwo = localStorage.getItem(getStorageKey('isVersionTwo'));

    if (savedRegistryText) setRegistryText(savedRegistryText);
    if (savedFullReportText) setFullReportText(savedFullReportText);
    if (savedFilterMatches) setFilterMatches(savedFilterMatches === 'true');
    if (savedFilterTerminated) setFilterTerminated(savedFilterTerminated === 'true');
    if (savedIsVersionTwo) setIsVersionTwo(savedIsVersionTwo === 'true');

    // Если есть сохраненные данные, автоматически запускаем сравнение
    if (savedRegistryText && savedFullReportText) {
      const savedDifferences = localStorage.getItem(getStorageKey('differences'));
      if (savedDifferences) {
        setDifferences(JSON.parse(savedDifferences));
      } else {
        // Если результаты не сохранены, но есть данные, запускаем сравнение
        setTimeout(() => compareData(), 100);
      }
    }
  }, [sessionId]);

  // Сохранение данных в localStorage при их изменении
  useEffect(() => {
    if (!sessionId) return;

    localStorage.setItem(getStorageKey('registryText'), registryText);
    localStorage.setItem(getStorageKey('fullReportText'), fullReportText);
    localStorage.setItem(getStorageKey('filterMatches'), String(filterMatches));
    localStorage.setItem(getStorageKey('filterTerminated'), String(filterTerminated));
    localStorage.setItem(getStorageKey('isVersionTwo'), String(isVersionTwo));

    // Сохраняем результаты сравнения
    if (differences.length > 0) {
      localStorage.setItem(getStorageKey('differences'), JSON.stringify(differences));
    }
  }, [registryText, fullReportText, differences, filterMatches, filterTerminated, sessionId, isVersionTwo]);

  // Обработчик изменения версии
  const handleVersionChange = () => {
    // Сначала меняем версию
    setIsVersionTwo(!isVersionTwo);

    // Очищаем результаты сравнения при смене версии
    setDifferences([]);
    localStorage.removeItem(getStorageKey('differences'));

    // Запускаем перерасчет, если есть данные
    if (registryText.trim() && fullReportText.trim()) {
      // Используем setTimeout для обеспечения обновления isVersionTwo перед вызовом compareData
      setTimeout(() => compareData(), 100);
    }
  };

  const cleanFIO = (fio: string) => fio.replace(/\s+/g, ' ').trim();


  const parseRegistryText = (text: string, isVersionTwo: boolean): DataRow[] => {
    try {
      const rows = text
        .trim()
        .split('\n')
        .map((line, index) => {
          const parts = line.split('\t');
          if (!isVersionTwo) { // Версия 1: 9 колонок (ФИО + 8 других колонок)
            // Здесь сравнивается 1-я колонка (ФИО) и 9-я колонка (Сумма)
            if (parts.length !== 9) {
              throw new Error(`Ошибка в строке ${index + 1} реестра: неверный формат данных для версии 1. Ожидается 9 колонок.`);
            }
            const fio = cleanFIO(parts[0]);
            const sum = parseSum(parts[8].trim()); // Берем сумму из 9-й колонки (индекс 8)
            return {
              ФИО: fio,
              СНИЛС: '', // Не используется
              СУММА: sum,
            };
          } else { // Версия 2: 2 или 3 колонки (ФИО + СНИЛС + Сумма) или (ФИО + Сумма)
            // Здесь сравнивается 1-я колонка (ФИО) и 8-я колонка (Сумма)
            if (parts.length < 8) { // Должно быть минимум 8 колонок для версии 2, чтобы взять 8-ю колонку
                throw new Error(`Ошибка в строке ${index + 1} реестра: неверный формат данных для версии 2. Ожидается минимум 8 колонок.`);
            }
            const fio = cleanFIO(parts[0]); // ФИО из 1-й колонки
            const sum = parseSum(parts[7].trim()); // Берем сумму из 8-й колонки (индекс 7)
            return {
              ФИО: fio,
              СНИЛС: '', // СНИЛС здесь не используется, если берем 8-ю колонку как сумму
              СУММА: sum,
            };
          }
        });

      // Логика для суммирования ФИО, если в версии 2 ФИО не уникальны и реестр состоит из 2-х колонок (ФИО, Сумма)
      // Эта часть кода может быть пересмотрена, так как теперь мы ориентируемся на 8 колонок для V2
      // Если V2 всегда будет иметь 8+ колонок, то этот блок может быть не нужен или должен быть адаптирован
      if (isVersionTwo) { // Если мы во второй версии, и есть дубликаты ФИО, то их суммы складываются
        const mergedRows: Map<string, DataRow> = new Map();
        rows.forEach(row => {
          if (mergedRows.has(row.ФИО)) {
            const existingRow = mergedRows.get(row.ФИО)!;
            existingRow.СУММА += row.СУММА;
          } else {
            mergedRows.set(row.ФИО, { ...row });
          }
        });
        return Array.from(mergedRows.values());
      }

      return rows;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка при обработке данных реестра');
      return [];
    }
  };


  const parseFullReportText = (text: string): FullReportRow[] => {
    try {
      return text
        .trim()
        .split('\n')
        .map((line, index) => {
          const parts = line.split('\t').map((part) => part.trim());
          if (parts.length !== 2) {
            throw new Error(`Ошибка в строке ${index + 1} полного свода: неверный формат данных. Ожидаются 2 колонки.`);
          }
          return {
            ФИО: cleanFIO(parts[0]), // Убираем лишние пробелы в ФИО
            СУММА: parseSum(parts[1]),
          };
        });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка при обработке данных полного свода');
      return [];
    }
  };

  const parseSum = (sumString: string): number => {
    if (!sumString) {
      return 0;
    }
    const formattedSum = sumString.replace(/\s+/g, '').replace(',', '.');
    return parseFloat(formattedSum);
  };

  const compareData = (): void => {
    setError('');
    if (!registryText.trim() || !fullReportText.trim()) {
      setError('Пожалуйста, заполните оба поля данных');
      return;
    }

    try {
      // Важно: передаем текущее значение isVersionTwo в функцию парсинга
      const registry = parseRegistryText(registryText, isVersionTwo);
      const fullReport = parseFullReportText(fullReportText);

      if (!registry.length || !fullReport.length) {
        return;
      }

      const registryMap = new Map<string, number>();
      registry.forEach((row) => {
        registryMap.set(row.ФИО, row.СУММА);
      });

      const results: ComparisonResult[] = [];

      // Сравнение Полного свода с Реестром
      fullReport.forEach((row) => {
        const sumRegistry = registryMap.get(row.ФИО);
        let difference = 0;
        let status = '';

        if (sumRegistry === undefined) {
          // ФИО есть в Полном своде, но нет в Реестре
          difference = row.СУММА;
          status = 'Нет в Реестре';
        } else {
          difference = row.СУММА - sumRegistry;
          status = row.СУММА === sumRegistry ? 'Совпадает' : 'Различается';
        }

        results.push({
          ФИО: row.ФИО,
          Разница: difference,
          Статус: status,
        });
      });

      // Проверка ФИО, которые есть в Реестре, но нет в Полном своде
      registry.forEach((row) => {
        const fioInFullReport = fullReport.some(frRow => cleanFIO(frRow.ФИО) === cleanFIO(row.ФИО));
        if (!fioInFullReport) {
          results.push({
            ФИО: row.ФИО,
            Разница: -row.СУММА, // Сумма из реестра со знаком минус
            Статус: 'Нет в Своде',
          });
        }
      });


      setDifferences(results);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Произошла ошибка при сравнении данных');
    }
  };

  // Очистка реестра
  const clearRegistry = () => {
    setRegistryText('');
    localStorage.removeItem(getStorageKey('registryText'));
    if (!fullReportText.trim()) {
      setDifferences([]);
      localStorage.removeItem(getStorageKey('differences'));
    }
  };

  // Очистка полного свода
  const clearFullReport = () => {
    setFullReportText('');
    localStorage.removeItem(getStorageKey('fullReportText'));
    if (!registryText.trim()) {
      setDifferences([]);
      localStorage.removeItem(getStorageKey('differences'));
    }
  };

  // Очистка всех данных
  const clearAll = () => {
    setRegistryText('');
    setFullReportText('');
    setDifferences([]);
    setError('');
    localStorage.removeItem(getStorageKey('registryText'));
    localStorage.removeItem(getStorageKey('fullReportText'));
    localStorage.removeItem(getStorageKey('differences'));
  };

  // Создание новой сессии (для работы с новыми данными)
  const createNewSession = () => {
    const newSessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('current_session_id', newSessionId);
    setSessionId(newSessionId);
    clearAll();
  };

  const getSumTotal = () => {
    return differences
      .filter(
        (row) =>
          (!filterMatches || row.Статус !== 'Совпадает') &&
          (!filterTerminated || (row.Статус !== 'Нет в Реестре' && row.Статус !== 'Нет в Своде'))
      )
      .reduce((total, row) => total + row.Разница, 0)
      .toFixed(2);
  };

  // Функция для экспорта данных в Excel
  const exportToExcel = () => {
    try {
      // Фильтруем данные согласно текущим фильтрам
      const filteredData = differences.filter(
        (row) =>
          (!filterMatches || row.Статус !== 'Совпадает') &&
          (!filterTerminated || (row.Статус !== 'Нет в Реестре' && row.Статус !== 'Нет в Своде'))
      );

      // Формируем данные для Excel
      const excelData = filteredData.map(row => ({
        'ФИО': row.ФИО,
        'Разница': row.Разница,
        'Статус': row.Статус
      }));

      // Добавляем итоговую строку
      excelData.push({
        'ФИО': 'Итоговая сумма разницы:',
        'Разница': parseFloat(getSumTotal()),
        'Статус': ''
      });

      // Создаем рабочую книгу и лист
      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Сравнение');

      // Задаем ширину колонок
      const columnWidths = [
        { wch: 40 }, // ФИО
        { wch: 15 }, // Разница
        { wch: 25 }, // Статус
      ];
      worksheet['!cols'] = columnWidths;

      // Генерируем имя файла с текущей датой
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const fileName = `Сравнение_${dateStr}.xlsx`;

      // Экспортируем файл
      XLSX.writeFile(workbook, fileName);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка при экспорте в Excel');
    }
  };

  return (
    <div className="container py-4">
      <h1 className="mb-4">Сравнение Реестра и Полного свода</h1>

      {error && (
        <div className="alert alert-danger mb-4" role="alert">
          {error}
        </div>
      )}

      <div className="mb-4">
        <button
          className="btn btn-outline-secondary mb-2"
          onClick={handleVersionChange}
        >
          Переключить на {isVersionTwo ? 'Версия 1 (Реестр: ФИО + 8 колонок, Сумма в 9-й)' : 'Версия 2 (Реестр: ФИО в 1-й, Сумма в 8-й колонке)'}
        </button>
      </div>

      <div className="row mb-4">
        <div className="col-md-6">
          <div className="form-group">
            <label className="mb-2">Реестр:</label>
            <div className="d-flex mb-2">
              <button
                className="btn btn-outline-secondary btn-sm me-2"
                onClick={clearRegistry}
              >
                Очистить реестр
              </button>
            </div>
            <textarea
              className="form-control"
              rows={6}
              placeholder={`Вставьте текст Реестра (${isVersionTwo ? 'ФИО[Tab]...[Tab]Сумма (всего от 8 колонок, ФИО - 1-я, Сумма - 8-я)' : 'ФИО[Tab]...[Tab]Сумма (всего 9 колонок, ФИО - 1-я, Сумма - 9-я)'})`}
              value={registryText}
              onChange={(e) => setRegistryText(e.target.value)}
            />
            <small className="form-text text-muted">
              Формат: {isVersionTwo ? 'Для версии 2: ФИО - 1-я колонка, Сумма - 8-я колонка. Минимум 8 колонок.' : 'Для версии 1: ФИО - 1-я колонка, Сумма - 9-я колонка. Всего 9 колонок.'}
            </small>
          </div>
        </div>

        <div className="col-md-6">
          <div className="form-group">
            <label className="mb-2">Полный свод:</label>
            <div className="d-flex mb-2">
              <button
                className="btn btn-outline-secondary btn-sm me-2"
                onClick={clearFullReport}
              >
                Очистить полный свод
              </button>
            </div>
            <textarea
              className="form-control"
              rows={6}
              placeholder="Вставьте текст Полного свода (ФИО[Tab]Сумма)"
              value={fullReportText}
              onChange={(e) => setFullReportText(e.target.value)}
            />
            <small className="form-text text-muted">
              Формат: ФИО[Tab]Сумма
            </small>
          </div>
        </div>
      </div>

      <div className="mb-4 d-flex flex-wrap">
        <button
          className="btn btn-primary me-2 mb-2"
          onClick={compareData}
          disabled={!registryText.trim() || !fullReportText.trim()}
        >
          Сравнить данные
        </button>

        <button
          className="btn btn-outline-danger me-2 mb-2"
          onClick={clearAll}
        >
          Очистить все
        </button>

        <button
          className="btn btn-outline-info me-2 mb-2"
          onClick={createNewSession}
          title="Создать новую сессию для работы с другими данными"
        >
          Новая сессия
        </button>

        {/* Новая кнопка для экспорта в Excel */}
        <button
          className="btn btn-success mb-2"
          onClick={exportToExcel}
          disabled={differences.length === 0}
          title="Сохранить результаты в Excel файл"
        >
          <i className="bi bi-file-earmark-excel me-1"></i>
          Экспорт в Excel
        </button>
      </div>

      <div className="mb-4">
        <button
          className="btn btn-secondary me-2 mb-2"
          onClick={() => setFilterMatches(!filterMatches)}
        >
          {filterMatches ? 'Показать совпадения' : 'Скрыть совпадения'}
        </button>
        <button
          className="btn btn-danger mb-2"
          onClick={() => setFilterTerminated(!filterTerminated)}
        >
          {filterTerminated ? 'Показать отсутствующие' : 'Скрыть отсутствующие'}
        </button>
      </div>

      {differences.length > 0 && (
        <div className="table-responsive">
          <table className="table table-striped table-bordered">
            <thead className="table-dark">
              <tr>
                <th>ФИО</th>
                <th>Разница</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {differences
                .filter(
                  (row) =>
                    (!filterMatches || row.Статус !== 'Совпадает') &&
                    (!filterTerminated || (row.Статус !== 'Нет в Реестре' && row.Статус !== 'Нет в Своде'))
                )
                .map((row, index) => (
                  <tr
                    key={index}
                    className={row.Статус === 'Нет в Реестре' || row.Статус === 'Нет в Своде' ? 'table-danger' : row.Разница === 0 ? 'table-success' : 'table-warning'}
                  >
                    <td>
                      <input
                        type="text"
                        value={row.ФИО}
                        readOnly
                        className="form-control"
                        onClick={(e) => (e.target as HTMLInputElement).select()}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={row.Разница.toFixed(2)}
                        readOnly
                        className="form-control"
                        onClick={(e) => (e.target as HTMLInputElement).select()}
                      />
                    </td>
                    <td>{row.Статус}</td>
                  </tr>
                ))}
            </tbody>
            <tfoot>
              <tr className="table-info">
                <td>
                  <strong>Всего записей:</strong>
                </td>
                <td colSpan={2}>
                  {differences.filter(
                    (row) =>
                      (!filterMatches || row.Статус !== 'Совпадает') &&
                      (!filterTerminated || (row.Статус !== 'Нет в Реестре' && row.Статус !== 'Нет в Своде'))
                  ).length}
                </td>
              </tr>
              <tr className="table-danger">
                <td>
                  <strong>Итоговая сумма разницы:</strong>
                </td>
                <td colSpan={2}>
                  {getSumTotal()}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
};

export default CompareTables;