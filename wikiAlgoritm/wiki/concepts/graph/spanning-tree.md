---
title: Минимальное остовное дерево
category: graph
tags: [MST, kruskal, prim, граф, остовное-дерево]
complexity: O(E log E) Kruskal; O(E log V) Prim
sources: 0
updated: 2026-05-19
version: 1.0
---

# Минимальное остовное дерево (Minimum Spanning Tree)

Дерево, охватывающее все вершины графа с минимальной суммарной стоимостью рёбер.

## Алгоритм Крускала (Kruskal)

Жадный алгоритм: сортируем рёбра, добавляем не создающие цикл.

```pseudocode
function kruskal(graph):
    edges = sortByWeight(graph.edges)
    uf = UnionFind(graph.vertices)
    mst = []

    for (u, v, w) in edges:
        if uf.find(u) != uf.find(v):
            uf.union(u, v)
            mst.append((u, v, w))
            if len(mst) == V - 1: break

    return mst
```

> 🔢 Сложность: $O(E \log E)$ (сортировка рёбер)

## Алгоритм Прима (Prim)

Растёт от одной вершины, всегда добавляя минимальное ребро к дереву.

```pseudocode
function prim(graph, start):
    in_tree = {start}
    mst = []
    pq = MinHeap([(w, start, v) for (v, w) in graph.neighbors(start)])

    while pq not empty and len(in_tree) < V:
        w, u, v = pq.pop()
        if v in in_tree: continue
        in_tree.add(v)
        mst.append((u, v, w))
        for (next_v, next_w) in graph.neighbors(v):
            if next_v not in in_tree:
                pq.push((next_w, v, next_v))

    return mst
```

> 🔢 Сложность: $O(E \log V)$ с двоичной кучей

## Свойства MST

- Уникально если все веса рёбер различны
- Цикловое свойство: наибольшее ребро любого цикла не входит в MST
- Разрезовое свойство: наименьшее ребро любого разреза входит в MST

## Применение

> 📐 Применение: кластеризация точек облака (point cloud) при обратном проектировании деталей (reverse engineering). Построение оптимальных маршрутов сварочного робота между точками.

## Связанные страницы

- [[concepts/graph/shortest-path]] — другие задачи на графах
- [[concepts/computational-geometry/triangulation]] — триангуляция Делоне как граф — близко к MST по Евклиду
