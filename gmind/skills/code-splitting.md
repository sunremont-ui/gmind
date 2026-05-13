# Skill: Code Splitting — Gmind

## Цель
Уменьшить размер бандла: динамический импорт тяжёлых библиотек (jspdf, html2canvas) и ленивая загрузка панелей.

## План

1. **Динамический импорт jspdf**
   ```typescript
   // frontend/src/utils/export.ts
   export async function exportPDF(svg: SVGSVGElement, filename: string) {
     const { default: jsPDF } = await import('jspdf')
     // ...
   }
   ```

2. **React.lazy для панелей**
   ```typescript
   // frontend/src/App.tsx
   const AIPanel = lazy(() => import('./components/AIPanel/AIPanel'))
   const AgentPanel = lazy(() => import('./components/AgentPanel/AgentPanel'))
   const QuickCapture = lazy(() => import('./components/QuickCapture/QuickCapture'))
   const CommandPalette = lazy(() => import('./components/CommandPalette/CommandPalette'))
   ```

3. **Suspense boundary**
   ```typescript
   <Suspense fallback={<div style={{ padding: 20, color: '#94a3b8' }}>Loading...</div>}>
     {showAIPanel && <AIPanel />}
   </Suspense>
   ```

4. **Route-based splitting** (если появятся страницы)
   - Главная → MindMap
   - Настройки → Settings
   - Агенты → AgentDashboard

5. **Webpack/Vite bundle analysis**
   ```bash
   npx vite-bundle-analyzer
   ```

## Файлы
- `frontend/src/App.tsx` — lazy imports + Suspense
- `frontend/src/utils/export.ts` — dynamic import jspdf
