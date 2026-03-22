WITH RECURSIVE dep_tree AS (
    SELECT
        id,
        name,
        parent_id,
        name AS full_path,
        0 AS depth
    FROM modules
    WHERE parent_id IS NULL

    UNION ALL

    SELECT
        m.id,
        m.name,
        m.parent_id,
        dt.full_path || ' -> ' || m.name,
        dt.depth + 1
    FROM modules m
    JOIN dep_tree dt ON m.parent_id = dt.id
    WHERE dt.depth < 10
),

circular_check AS (
    SELECT id, name, full_path
    FROM dep_tree
    WHERE full_path LIKE '%' || name || '%' || name || '%'
),

stats AS (
    SELECT
        dt.name AS root_module,
        COUNT(*) AS total_deps,
        MAX(dt.depth) AS max_depth,
        SUM(m.size_kb) AS total_size_kb,
        ROUND(AVG(m.size_kb), 1) AS avg_dep_size
    FROM dep_tree dt
    JOIN modules m ON dt.id = m.id
    GROUP BY dt.name
    HAVING COUNT(*) > 1
)

SELECT
    s.root_module,
    s.total_deps,
    s.max_depth,
    s.total_size_kb || ' KB' AS total_size,
    s.avg_dep_size || ' KB' AS avg_size,
    CASE
        WHEN c.id IS NOT NULL THEN 'CIRCULAR'
        WHEN s.max_depth > 5 THEN 'DEEP'
        WHEN s.total_deps > 20 THEN 'HEAVY'
        ELSE 'OK'
    END AS health
FROM stats s
LEFT JOIN circular_check c ON s.root_module = c.name
ORDER BY s.total_deps DESC;
