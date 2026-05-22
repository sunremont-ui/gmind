---
title: Триангуляция Делоне
category: computational-geometry
tags: [триангуляция, делоне, сетка, МКЭ, воронова]
complexity: O(n log n)
sources: 0
updated: 2026-05-19
version: 1.0
---

# Триангуляция Делоне (Delaunay Triangulation)

Разбиение множества точек на треугольники, удовлетворяющие условию Делоне: никакая точка не лежит строго внутри описанной окружности любого треугольника.

## Условие Делоне

Для треугольника $ABC$: точка $D$ не должна лежать внутри описанной окружности.

Проверка через определитель:

$$\begin{vmatrix} x_A & y_A & x_A^2+y_A^2 & 1 \\ x_B & y_B & x_B^2+y_B^2 & 1 \\ x_C & y_C & x_C^2+y_C^2 & 1 \\ x_D & y_D & x_D^2+y_D^2 & 1 \end{vmatrix} > 0$$

## Алгоритм Боуэра-Уотсона (Bowyer-Watson)

Инкрементальный: добавляем точки по одной.

```pseudocode
function bowyer_watson(points):
    super_triangle = bigTriangle(points)
    triangles = {super_triangle}

    for p in points:
        # Найти все треугольники, чья описанная окружность содержит p:
        bad = {t for t in triangles if inCircumcircle(t, p)}

        # Найти граничный многоугольник (boundary polygon):
        boundary = outerEdges(bad)

        # Удалить плохие треугольники:
        triangles -= bad

        # Создать новые треугольники:
        for edge in boundary:
            triangles.add(Triangle(edge.p1, edge.p2, p))

    # Удалить треугольники, связанные с super_triangle:
    triangles = {t for t in triangles if not shareVertex(t, super_triangle)}
    return triangles
```

> 🔢 Сложность: $O(n \log n)$ среднее, $O(n^2)$ худший случай

## Двойственность с диаграммой Вороного

Триангуляция Делоне и диаграмма Вороного — двойственные структуры.  
Рёбра Вороного = перпендикулярные биссектрисы рёбер Делоне.

## Свойства (важно для МКЭ)

- Максимизирует минимальный угол среди всех триангуляций → равностороннее элементы
- Локальное условие: перестроить ребро (edge flip) если нарушено условие Делоне
- Плохие треугольники (acute angles < 30°) ухудшают обусловленность матрицы $\mathbf{K}$

## Улучшение сетки (Mesh Refinement)

**Алгоритм Рупперта (Ruppert):** вставлять точки в описанные окружности плохих треугольников.

```pseudocode
function ruppert_refine(triangulation, min_angle):
    while badTriangle = findBad(triangulation, min_angle):
        c = circumcenter(badTriangle)
        if encroaches(c, triangulation.boundary):
            splitBoundaryEdge(c)
        else:
            insertPoint(triangulation, c)
```

## Применение

> 📐 Применение: генерация сетки для МКЭ (см. [[concepts/numerical/fem-basics]]) по границе детали (контур зуба, профиль кулачка).

## Связанные страницы

- [[concepts/numerical/fem-basics]] — МКЭ требует качественной триангуляции
- [[concepts/computational-geometry/convex-hull]] — граница триангуляции = выпуклая оболочка
- [[concepts/computational-geometry/boolean-ops]] — триангуляция после булевых операций
