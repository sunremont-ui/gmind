---
title: Решение СЛАУ
category: numerical
tags: [СЛАУ, LU-разложение, QR, итерационные-методы, разрежённые-матрицы]
complexity: O(n³) прямые; O(n·k) итерационные
sources: 0
updated: 2026-05-19
version: 1.0
---

# Решение СЛАУ (Solving Linear Systems)

Система линейных алгебраических уравнений: $\mathbf{A}\mathbf{x} = \mathbf{b}$.

## Прямые методы

### LU-разложение

$\mathbf{A} = \mathbf{L}\mathbf{U}$ (нижне- и верхнетреугольные матрицы).

```pseudocode
function LU(A):
    n = len(A)
    L, U = identity(n), copy(A)
    for k in 0..n-2:
        for i in k+1..n-1:
            L[i][k] = U[i][k] / U[k][k]
            U[i] -= L[i][k] * U[k]
    return L, U

function solve(L, U, b):
    y = forwardSubst(L, b)   # Ly = b
    x = backSubst(U, y)      # Ux = y
    return x
```

> 🔢 Сложность: $O(n^3)$ разложение, $O(n^2)$ подстановка

### Разложение Холецкого (симметричные положительно определённые)

$\mathbf{A} = \mathbf{L}\mathbf{L}^T$ — вдвое быстрее LU. Применяется для матриц жёсткости в МКЭ.

### QR-разложение

$\mathbf{A} = \mathbf{Q}\mathbf{R}$ ($\mathbf{Q}$ ортогональна, $\mathbf{R}$ верхнетреугольная).  
Предпочтительнее LU для переопределённых систем (МНК).

## Итерационные методы

Для разрежённых матриц большой размерности (типично в МКЭ):

### Метод Якоби

$$x_i^{(k+1)} = \frac{1}{a_{ii}}\left(b_i - \sum_{j \neq i} a_{ij} x_j^{(k)}\right)$$

Сходится при диагональном преобладании.

### Метод Гаусса-Зейделя

Использует обновлённые значения немедленно:

$$x_i^{(k+1)} = \frac{1}{a_{ii}}\left(b_i - \sum_{j<i} a_{ij} x_j^{(k+1)} - \sum_{j>i} a_{ij} x_j^{(k)}\right)$$

### Метод сопряжённых градиентов (CG)

Для симметричных положительно определённых матриц. Сходится за $n$ шагов теоретически, практически — за $O(\sqrt{\kappa})$ шагов при числе обусловленности $\kappa$.

```pseudocode
function conjugateGradient(A, b, tol):
    x = zeros(n)
    r = b - A @ x
    p = copy(r)
    for iter in 0..max_iter:
        Ap = A @ p
        alpha = dot(r, r) / dot(p, Ap)
        x = x + alpha * p
        r_new = r - alpha * Ap
        if norm(r_new) < tol: break
        beta = dot(r_new, r_new) / dot(r, r)
        p = r_new + beta * p
        r = r_new
    return x
```

> 🔢 Сложность: $O(n \cdot k)$ где $k$ — число итераций, каждая итерация $O(nnz)$ (ненулевые элементы)

## Разрежённые форматы хранения

| Формат | Расшифровка | Применение |
|--------|-------------|-----------|
| CSR | Compressed Sparse Row | Умножение матрица-вектор |
| CSC | Compressed Sparse Column | Прямые методы |
| COO | Coordinate | Сборка матрицы в МКЭ |

## Связанные страницы

- [[concepts/numerical/fem-basics]] — матрица жёсткости $\mathbf{K}\mathbf{u} = \mathbf{f}$
- [[concepts/numerical/interpolation]] — система уравнений для коэффициентов сплайна
