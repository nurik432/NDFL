'use client';

import { useState, useEffect } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import * as XLSX from 'xlsx';

interface DataRow {
  ФИО: string;
  СНИЛС: string;
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
  const [isVersionTwo, setIsVersionTwo] = useState<boolean>(false); // Для переключения версии

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

  
  const parseRegistryText = (text: string, version: boolean): DataRow[] => {
    try {
      const rows = text
        .trim()
        .split('\n')
        .map((line, index) => {
          const parts = line.split('\t');
          if (parts.length !== (version ? 2 : 3)) {
            throw new Error(`Ошибка в строке ${index + 1}: неверный формат данных. Ожидаются ${version ? 2 : 3} колонки.`);
          }
          return {
            ФИО: version ? extractFIO(parts[0]) : cleanFIO(parts[0]),
            СНИЛС: version ? '' : parts[1].trim(),
            СУММА: parseSum(parts[version ? 1 : 2].trim()) || 0,
          };
        });
  
      if (version) {
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
      setError(e instanceof Error ? e.message : 'Ошибка при обработке данных');
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
            throw new Error(`Ошибка в строке ${index + 1}: неверный формат данных. Ожидаются 2 колонки.`);
          }
          return {
            ФИО: cleanFIO(parts[0]), // Убираем лишние пробелы в ФИО
            СУММА: parseSum(parts[1]),
          };
        });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка при обработке данных');
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

      const results = fullReport.map((row) => {
        const sumRegistry = registryMap.get(row.ФИО);
        let difference = 0;
        let status = '';

        if (sumRegistry === undefined) {
          difference = row.СУММА;
          status = 'Уволен или работает по ГПХ';
        } else {
          difference = row.СУММА - sumRegistry;
          status = row.СУММА === sumRegistry ? 'Совпадает' : 'Различается';
        }

        return {
          ФИО: row.ФИО,
          Разница: difference,
          Статус: status,
        };
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
          (!filterTerminated || row.Статус !== 'Уволен или работает по ГПХ')
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
          (!filterTerminated || row.Статус !== 'Уволен или работает по ГПХ')
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
          Переключить на {isVersionTwo ? 'версию с 3 колонками' : 'версию с 2 колонками'}
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
              placeholder={`Вставьте текст Реестра (${isVersionTwo ? 'ФИО[Tab]Сумма' : 'ФИО[Tab]СНИЛС[Tab]Сумма'})`}
              value={registryText}
              onChange={(e) => setRegistryText(e.target.value)}
            />
            <small className="form-text text-muted">
              Формат: {isVersionTwo ? 'ФИО[Tab]Сумма' : 'ФИО[Tab]СНИЛС[Tab]Сумма'}
              {isVersionTwo && ' (при дублирующихся ФИО суммы складываются)'}
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
          {filterTerminated ? 'Показать уволенных' : 'Скрыть уволенных'}
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
                    (!filterTerminated || row.Статус !== 'Уволен или работает по ГПХ')
                )
                .map((row, index) => (
                  <tr
                    key={index}
                    className={row.Статус === 'Уволен или работает по ГПХ' ? 'table-danger' : row.Разница === 0 ? 'table-success' : 'table-warning'}
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
                      (!filterTerminated || row.Статус !== 'Уволен или работает по ГПХ')
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