---
title: 3D-рендеринг
category: visualization
tags: [3d, рендеринг, z-buffer, ray-tracing, wireframe, проекция, растеризация]
complexity: растеризация O(n·m); трассировка лучей O(n·log n) с BVH
sources: 0
updated: 2026-05-19
version: 2.0
---

# 3D-рендеринг (3D Rendering)

## Зачем нужен и какие задачи решает

3D-рендеринг — преобразование математического описания 3D-сцены (геометрия + материалы + источники света + камера) в 2D-изображение. Это не одна задача, а семейство алгоритмов с разными компромиссами скорость/реализм.

**Зачем это нужно в инженерии:**
- Визуализация CAD-моделей деталей до изготовления
- Проверка геометрии зацепления шестерён (нет ли пересечений?)
- Документация: технические иллюстрации, сборочные чертежи
- Симуляция: как деталь будет выглядеть после обработки поверхности

**Зачем в науке и медицине:**
- Визуализация МКЭ-результатов (карты напряжений, деформаций)
- Медицинские изображения: МРТ/КТ-реконструкции в 3D
- Молекулярная визуализация

## Два главных подхода

### Растеризация (Rasterization)
Идёт от треугольника к пикселю: для каждого треугольника находим покрытые пиксели.
- Скорость: миллиарды треугольников/сек на GPU
- Реализм: ограничен (тени, отражения — аппроксимации)
- Применение: игры, CAD-просмотровщики, реалтайм

### Трассировка лучей (Ray Tracing)
Идёт от пикселя к сцене: для каждого пикселя пускаем луч, находим пересечение.
- Скорость: секунды-минуты на кадр (оффлайн), ~30fps с RTX-ускорением
- Реализм: физически корректные тени, отражения, преломления
- Применение: кино, реклама, промышленная визуализация

## Конвейер растеризации

```
Геометрия (3D) → Вершинный шейдер → Клиппинг → Перспективное деление
    → Растеризация → Интерполяция атрибутов → Фрагментный шейдер → Фреймбуфер
```

### Шаг 1: Проекции

**Ортогональная проекция** — параллельные лучи:
$$x' = x, \quad y' = y$$

Применение: **технические чертежи, CAD-виды** (вид спереди, сверху, сбоку). Сохраняет реальные размеры → можно измерять на экране. Обязательна для проверки зазоров между деталями.

**Перспективная проекция** — схождение в точку схода:
$$x' = f \cdot x / z, \quad y' = f \cdot y / z$$

Применение: **реалистичная визуализация**, игры, архитектурные рендеры. Воспроизводит работу человеческого глаза (и камеры).

**Аксонометрия** (изометрия, диметрия): компромисс — параллельные лучи, но под углом. Применение: **технические иллюстрации, чертежи сборок**; популярно в стратегических играх (изометрический вид).

### Шаг 2: Алгоритм Z-буфера

Решает **задачу видимости** (hidden surface removal): какой треугольник виден в каждом пикселе?

```pseudocode
// Инициализация:
zbuffer[w][h] = fill(+INF)
framebuffer[w][h] = background_color

for each triangle T in scene:
    for each pixel (x, y) covered by T:
        z = interpolate_depth(T, x, y)      // линейная интерполяция 1/z
        if z < zbuffer[x][y]:
            zbuffer[x][y] = z
            framebuffer[x][y] = shade(T, x, y)
```

**Почему Z-буфер победил** все альтернативы (BSP-деревья, алгоритм художника):
- Прост в реализации на GPU (параллельный per-pixel тест)
- Не требует предобработки и сортировки геометрии
- Обрабатывает любые пересекающиеся геометрии

**Ограничения:**
- Артефакт z-fighting: два треугольника на одинаковой глубине мерцают. Решение: polygon offset, reversed-Z буфер с float.
- Прозрачность требует специальной обработки (OIT — order-independent transparency)

> 🔢 Сложность: $O(n \cdot \bar{m})$, где $n$ — треугольников, $\bar{m}$ — среднее пикселей на треугольник

### Шаг 3: Растеризация треугольника

Какие пиксели лежат внутри треугольника? Классический метод — барицентрические координаты:

```pseudocode
function rasterize(v0, v1, v2):
    // Ограничивающий прямоугольник:
    xmin, xmax = min/max(v0.x, v1.x, v2.x)
    ymin, ymax = min/max(v0.y, v1.y, v2.y)

    for y = ymin to ymax:
        for x = xmin to xmax:
            // Барицентрические координаты:
            w0 = edgeFunction(v1, v2, (x,y))
            w1 = edgeFunction(v2, v0, (x,y))
            w2 = edgeFunction(v0, v1, (x,y))
            if w0 >= 0 and w1 >= 0 and w2 >= 0:
                // Пиксель внутри треугольника
                // Интерполяция атрибутов (цвет, нормаль, UV):
                attr = (w0*a0 + w1*a1 + w2*a2) / (w0+w1+w2)
                fragment_shader(x, y, attr)
```

### Шаг 4: Wireframe-рендеринг

Отображение только рёбер — стандарт в CAD-просмотровщиках для деталей.

**Алгоритм Брезенхема (Bresenham line)** — растеризация отрезка целочисленной арифметикой:
```pseudocode
function bresenham(x0, y0, x1, y1):
    dx = abs(x1-x0), sx = sign(x1-x0)
    dy = -abs(y1-y0), sy = sign(y1-y0)
    err = dx + dy
    while true:
        plot(x0, y0)
        if x0==x1 and y0==y1: break
        e2 = 2*err
        if e2 >= dy: err += dy; x0 += sx
        if e2 <= dx: err += dx; y0 += sy
```

Применяется в: встроенных системах, CNC-контроллерах для отображения G-кода, простых CAD-утилитах без GPU.

## Трассировка лучей (Ray Tracing)

### Прямая трассировка

```pseudocode
for each pixel (px, py):
    ray = generateRay(camera, px, py)
    hit = findClosestIntersection(ray, scene)
    if hit:
        color = shade(hit.point, hit.normal, hit.material, lights)
    else:
        color = background
```

### Рекурсивная (Whitted) трассировка

Каждый луч порождает вторичные лучи: отражение, преломление, тень.

```pseudocode
function trace(ray, depth):
    if depth > MAX_DEPTH: return black
    hit = intersect(ray, scene)
    if not hit: return background

    // Тень: луч к каждому источнику света
    color = ambient + diffuse_illumination(hit, lights, scene)

    // Отражение:
    if hit.material.reflective:
        reflect_ray = reflect(ray.dir, hit.normal)
        color += hit.material.reflectivity * trace(reflect_ray, depth+1)

    // Преломление:
    if hit.material.transparent:
        refract_ray = refract(ray.dir, hit.normal, hit.material.ior)
        color += hit.material.transparency * trace(refract_ray, depth+1)

    return color
```

### Ускорение: BVH (Bounding Volume Hierarchy)

Наивный перебор всех треугольников — $O(n)$ на луч. BVH сводит к $O(\log n)$.

```pseudocode
// Построение: рекурсивно делим AABB, сортируем треугольники
// Обход: если луч не пересекает AABB узла — пропускаем поддерево

function intersectBVH(node, ray):
    if not ray.hits(node.bounds): return None
    if node.isLeaf():
        return intersectTriangles(node.triangles, ray)
    left  = intersectBVH(node.left, ray)
    right = intersectBVH(node.right, ray)
    return closer(left, right)
```

> 🔢 Сложность с BVH: $O(\log n)$ на луч при хорошем дереве; построение $O(n \log n)$

### Path Tracing (Монте-Карло трассировка)

Вместо аналитического расчёта освещения — случайная выборка направлений:

```pseudocode
function pathTrace(ray, depth):
    hit = intersect(ray, scene)
    if not hit or depth > MAX: return hit.material.emission

    // Случайное направление отражения (по BRDF):
    next_dir = sampleBRDF(hit.normal, hit.material)
    next_ray = Ray(hit.point, next_dir)

    return hit.material.emission +
           hit.material.albedo * pathTrace(next_ray, depth+1)
```

Требует тысячи лучей на пиксель для сходимости (шум). Зато: глобальное освещение, каустики, объёмное рассеяние — всё «бесплатно».

## Модели освещения

### Phong
$$I = I_a k_a + I_d k_d (\mathbf{n} \cdot \mathbf{l}) + I_s k_s (\mathbf{r} \cdot \mathbf{v})^\alpha$$

Применение: CAD-просмотровщики, технические иллюстрации. Быстро, предсказуемо.

### PBR (Physically Based Rendering)
Использует функцию BRDF (Bidirectional Reflectance Distribution Function), уравнение рендеринга:

$$L_o(\omega_o) = L_e(\omega_o) + \int_\Omega f_r(\omega_i, \omega_o) L_i(\omega_i) (\mathbf{n} \cdot \omega_i) \, d\omega_i$$

Применение: кино, реклама промышленных продуктов (фото-реализм), игры AAA-класса. Металл, стекло, кожа, ткань — все материалы одним аппаратом.

## Применение по областям

### Машиностроение и CAD
- **Проверка геометрии**: wireframe + hidden line removal показывает пересечения деталей
- **Проверка зазоров**: z-буфер-тест: если две детали занимают один пиксель с одинаковым z — пересечение
- **Техническая документация**: shaded ортогональные виды с Phong-освещением → иллюстрации к руководствам
- **Анализ МКЭ**: окраска поверхности по значению напряжений (false-color mapping)

### Медицинская визуализация
- **Volume rendering**: МРТ/КТ — стек 2D-срезов → 3D. Метод Direct Volume Rendering (DVR) трассирует лучи через 3D-текстуру, интегрируя непрозрачность
- **Изоповерхности**: алгоритм Marching Cubes извлекает поверхность из объёмных данных (например, кость из КТ с порогом плотности Хаунсфилда)
- **Хирургическое планирование**: интерактивный 3D с разрезами, прозрачными органами

### Геология и ГИС
- **Terrain rendering**: LOD (Level of Detail) — больше треугольников рядом, меньше вдали. Алгоритмы ROAM, геоморфинг
- **Сейсмические данные**: volume rendering 3D-сейсмических кубов для поиска залежей нефти

### Архитектура
- **BIM (Building Information Modeling)**: реалтайм 3D планировки. Аmbient occlusion — мягкие тени в углах без full ray tracing
- **Дневной свет**: Path tracing с физически корректным небом (Nishita sky model)

### Кино и VFX
- **Offline rendering**: Arnold, RenderMan, V-Ray — path tracing с тысячами сэмплов, дни рендеринга для одного кадра
- **Volumetric effects**: дым, огонь, туман — объёмные эффекты через participating media
- **Subsurface scattering**: кожа, воск, мрамор — свет проникает внутрь и рассеивается

## Алгоритмы скрытых линий для чертежей

В CAD-чертежах нужны не закрашенные поверхности, а линии — видимые сплошные, невидимые пунктирные.

**Алгоритм Appel**: трассировка лучей вдоль рёбер. Медленно, но точно.

**Алгоритм на основе BSP-дерева**: предобработка разбивает полигоны на дерево пространственных разбиений → обход от ближнего к дальнему → видимость каждого ребра.

> 📐 Применение: ГОСТ-чертежи деталей редукторов требуют именно этого: видимые рёбра сплошной линией, невидимые — тонким пунктиром.

## Связанные страницы

- [[concepts/visualization/bezier-curves]] — адаптивная тесселяция кривых для рендеринга
- [[concepts/visualization/spline-interpolation]] — тесселяция NURBS-поверхностей
- [[concepts/computational-geometry/triangulation]] — триангуляция поверхности перед рендерингом
- [[concepts/numerical/interpolation]] — интерполяция атрибутов в шейдерах
- [[concepts/geometry/involute-gear]] — wireframe-визуализация зубчатых передач
