---
title: Выпуклая оболочка
category: computational-geometry
tags: [выпуклая-оболочка, graham, jarvis, quickhull, геометрия]
complexity: O(n log n) Graham/QuickHull; O(nh) Jarvis
sources: 0
updated: 2026-05-19
version: 1.0
---

# Выпуклая оболочка (Convex Hull)

Наименьший выпуклый многоугольник, содержащий все точки множества $S$.

## Алгоритм Грэхема (Graham Scan)

```pseudocode
function grahamScan(points):
    p0 = lowestPoint(points)      # нижняя-левая точка
    sorted = sortByAngle(points, p0)  # O(n log n)
    hull = [p0, sorted[0], sorted[1]]

    for p in sorted[2:]:
        while len(hull) >= 2 and crossProduct(hull[-2], hull[-1], p) <= 0:
            hull.pop()    # удалить правый поворот
        hull.push(p)

    return hull
```

> 🔢 Сложность: $O(n \log n)$ (доминирует сортировка)

## Алгоритм Джарвиса (Gift Wrapping / Jarvis March)

```pseudocode
function jarvisMarch(points):
    hull = []
    p = leftmost(points)
    repeat:
        hull.push(p)
        q = points[0]
        for r in points:
            if q == p or ccw(p, q, r) < 0:
                q = r
        p = q
    until p == hull[0]
    return hull
```

> 🔢 Сложность: $O(nh)$ где $h$ — число точек на оболочке. При $h = O(\log n)$ — оптимален.

## QuickHull

Принцип «разделяй и властвуй»:
1. Найти крайние точки $A$, $B$
2. Рекурсивно найти точки максимально удалённые от $AB$
3. Отбросить все точки внутри треугольника

> 🔢 Средняя сложность: $O(n \log n)$; худший случай: $O(n^2)$

## Применение в геометрии деталей

> 📐 Применение: выпуклая оболочка профиля шестерни (см. [[concepts/geometry/involute-gear]]) используется для:
> - Быстрой проверки столкновений (collision detection)
> - Нахождения габаритного прямоугольника
> - Первичной аппроксимации при маршрутизации инструмента в CAM

## Связанные страницы

- [[concepts/computational-geometry/triangulation]] — часто выпуклая оболочка = граница триангуляции
- [[concepts/computational-geometry/boolean-ops]] — пересечение выпуклых полигонов O(n+m)
- [[concepts/geometry/involute-gear]] — применение в проверке столкновений зубьев
