---
title: Булевы операции над полигонами
category: computational-geometry
tags: [булевы-операции, пересечение, объединение, разность, клиппинг]
complexity: O((n+m+k) log(n+m))
sources: 0
updated: 2026-05-19
version: 1.0
---

# Булевы операции над полигонами (Polygon Boolean Operations)

Пересечение (∩), объединение (∪) и разность (−) плоских многоугольников. Фундаментальная задача в CAD, GIS, робототехнике.

## Операции

| Операция | Обозначение | Результат |
|----------|-------------|-----------|
| Пересечение | $A \cap B$ | Общая часть |
| Объединение | $A \cup B$ | Весь охваченный регион |
| Разность | $A \setminus B$ | $A$ без $B$ |
| Симметричная разность | $A \triangle B$ | Части только одного |

## Алгоритм Сазерленда-Ходжмана (для выпуклых)

Клиппинг многоугольника $S$ (subject) относительно $C$ (clip). Последовательно обрезать по каждому ребру $C$.

```pseudocode
function sutherlandHodgman(subject, clip):
    output = subject
    for edge in clip.edges:
        input = output
        output = []
        for i in 0..len(input)-1:
            current = input[i]
            previous = input[i-1]
            if inside(current, edge):
                if not inside(previous, edge):
                    output.append(intersect(previous, current, edge))
                output.append(current)
            elif inside(previous, edge):
                output.append(intersect(previous, current, edge))
    return output
```

> 🔢 Сложность: $O(n \cdot m)$ где $n$, $m$ — число вершин полигонов

## Алгоритм Гривса-Хортманна (для произвольных)

Общий случай (невыпуклые, с дырками). Основан на пометке пересечений и обходе.

1. Найти все пересечения рёбер двух полигонов → $O(n \cdot m)$, оптимально $O((n+m+k)\log(n+m))$ sweep line
2. Пометить каждое пересечение как «входящее» или «выходящее»
3. Обойти полигоны, переключаясь между ними на пересечениях

## Метод sweep line для нахождения пересечений

```pseudocode
function sweepLine(segments):
    events = []
    for s in segments:
        events.add(LeftEndpoint(s), RightEndpoint(s))

    events.sort()
    active = BST()  # активные отрезки упорядочены по y

    for event in events:
        if event.isLeft:
            active.insert(event.segment)
            checkIntersect(event.segment, active.above(event.segment))
            checkIntersect(event.segment, active.below(event.segment))
        else:
            checkIntersect(active.above(event.segment), active.below(event.segment))
            active.remove(event.segment)
```

> 🔢 Сложность: $O((n+k)\log n)$ где $k$ — число пересечений

## Применение в геометрии деталей

> 📐 Применение: вычисление перекрытия профилей зубьев шестерни при проверке зацепления. Пересечение контура зуба с эвольвентой (см. [[concepts/geometry/involute-gear]]). Вычисление области срезания при подрезании.

## Библиотеки реализации

- **Clipper2** (C++/C#/Python) — наиболее распространённая
- **CGAL** (C++) — вычислительная геометрия, точная арифметика
- **Shapely** (Python) — GIS-задачи, использует GEOS

## Связанные страницы

- [[concepts/computational-geometry/convex-hull]] — выпуклые пересечения O(n+m)
- [[concepts/computational-geometry/triangulation]] — триангуляция после операций
- [[concepts/geometry/involute-gear]] — профили зубьев
- [[concepts/geometry/cam-profile]] — проверка столкновений кулачка
