import '@testing-library/jest-dom'

// jsdom в этой сборке отдаёт localStorage-заглушку без методов: любое
// обращение падает, и код, который на него опирается, в тестах не проверить.
// Ставим простое хранилище в памяти — общее для всех тестов, чистится самим
// тестом через removeItem/clear.
if (typeof globalThis.localStorage?.getItem !== 'function') {
  const memory = new Map<string, string>()
  const storage: Storage = {
    get length() { return memory.size },
    key: (index: number) => [...memory.keys()][index] ?? null,
    getItem: (key: string) => (memory.has(key) ? memory.get(key)! : null),
    setItem: (key: string, value: string) => { memory.set(key, String(value)) },
    removeItem: (key: string) => { memory.delete(key) },
    clear: () => { memory.clear() },
  }
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true })
}
