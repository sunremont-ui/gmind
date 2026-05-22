---
title: Кратчайший путь в графе
category: graph
tags: [dijkstra, a-star, bellman-ford, граф, маршрутизация]
complexity: O((V+E) log V) Dijkstra с heap
sources: 0
updated: 2026-05-19
version: 1.0
---

# Кратчайший путь (Shortest Path)

Нахождение пути минимального веса между вершинами графа.

## Алгоритм Дейкстры (Dijkstra)

Для графов с **неотрицательными** весами рёбер.

```pseudocode
function dijkstra(graph, source):
    dist = {v: INF for v in graph.vertices}
    dist[source] = 0
    pq = MinHeap([(0, source)])
    prev = {}

    while pq not empty:
        d, u = pq.pop()
        if d > dist[u]: continue   # устаревшая запись

        for (v, w) in graph.neighbors(u):
            if dist[u] + w < dist[v]:
                dist[v] = dist[u] + w
                prev[v] = u
                pq.push((dist[v], v))

    return dist, prev
```

> 🔢 Сложность: $O((V+E)\log V)$ с двоичной кучей

## Алгоритм A* (A-Star)

Дейкстра с эвристикой. Приоритет: $f(v) = g(v) + h(v)$.
- $g(v)$ — фактическая стоимость пути до $v$
- $h(v)$ — эвристическая оценка до цели (должна быть допустимой: $h(v) \leq h^*(v)$)

```pseudocode
function aStar(graph, source, target, heuristic):
    open = MinHeap([(h(source), source)])
    g = {source: 0}

    while open not empty:
        f, u = open.pop()
        if u == target: return reconstructPath(prev, target)

        for (v, w) in graph.neighbors(u):
            new_g = g[u] + w
            if new_g < g.get(v, INF):
                g[v] = new_g
                prev[v] = u
                open.push((new_g + heuristic(v), v))
```

Типичные эвристики: Евклидово расстояние, манхэттенское, диагональное.

## Алгоритм Беллмана-Форда

Работает с **отрицательными** рёбрами. Обнаруживает отрицательные циклы.

> 🔢 Сложность: $O(V \cdot E)$ — медленнее Дейкстры

## Флойд-Уоршалл (все пары)

Кратчайшие пути между **всеми парами** вершин:

$$d[i][j] = \min(d[i][j],\ d[i][k] + d[k][j])$$

> 🔢 Сложность: $O(V^3)$

## Применение

> 📐 Применение: нахождение оптимального маршрута инструмента в CAM-обработке по граф-структуре контуров детали. A* используется для обхода препятствий при 2D-раскладке деталей.

## Связанные страницы

- [[concepts/graph/spanning-tree]] — связанные задачи на графах
- [[concepts/computational-geometry/boolean-ops]] — построение графа видимости по полигонам
