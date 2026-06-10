insert into public.tags (name, type, sort_order) values
  ('清淡', 'taste', 10),
  ('下饭', 'taste', 20),
  ('酸甜', 'taste', 30),
  ('微辣', 'taste', 40),
  ('一人食', 'scenario', 10),
  ('两人餐', 'scenario', 20),
  ('宿舍', 'scenario', 30),
  ('懒人', 'scenario', 40),
  ('减脂', 'diet', 10),
  ('高蛋白', 'diet', 20),
  ('电饭煲', 'tool', 10),
  ('空气炸锅', 'tool', 20)
on conflict (name) do update
set type = excluded.type,
    sort_order = excluded.sort_order;

insert into public.recipes
  (title, description, budget_cents, cook_minutes, servings, difficulty, tags, ingredients, steps, tips, status)
values
  (
    '番茄肥牛饭',
    '15分钟的一人食下饭菜，酸甜开胃。',
    2200,
    15,
    1,
    'easy',
    array['一人食', '下饭', '酸甜'],
    '["肥牛卷150g", "番茄1个", "米饭1碗", "生抽1勺", "番茄酱1勺"]'::jsonb,
    '["番茄切块炒软", "加入番茄酱和少量水煮开", "放入肥牛煮熟", "淋在米饭上"]'::jsonb,
    '肥牛可以换成鸡蛋或豆腐。',
    'published'
  ),
  (
    '鸡蛋豆腐盖饭',
    '便宜、柔软、清淡，适合不想做复杂饭的时候。',
    1200,
    12,
    1,
    'easy',
    array['一人食', '清淡', '懒人'],
    '["鸡蛋2个", "嫩豆腐1盒", "米饭1碗", "生抽1勺", "葱花少量"]'::jsonb,
    '["鸡蛋打散", "豆腐切块下锅煎热", "倒入蛋液", "加生抽和少量水焖2分钟", "盖在米饭上"]'::jsonb,
    '想更香可以加一点香油。',
    'published'
  ),
  (
    '空气炸锅鸡腿排',
    '高蛋白、少油，适合减脂餐。',
    2600,
    25,
    1,
    'normal',
    array['高蛋白', '减脂', '空气炸锅'],
    '["去骨鸡腿1块", "黑胡椒", "生抽1勺", "蚝油半勺", "生菜适量"]'::jsonb,
    '["鸡腿用调料腌10分钟", "空气炸锅180度烤18分钟", "翻面再烤5分钟", "搭配生菜"]'::jsonb,
    '没有空气炸锅可以用平底锅小火煎熟。',
    'published'
  ),
  (
    '电饭煲香菇鸡肉饭',
    '把食材丢进电饭煲，适合两人吃。',
    3500,
    35,
    2,
    'easy',
    array['两人餐', '电饭煲', '懒人'],
    '["大米1.5杯", "鸡腿肉200g", "香菇4朵", "胡萝卜半根", "生抽2勺"]'::jsonb,
    '["米洗净加正常水量", "鸡肉和蔬菜切块", "所有食材加调料放入电饭煲", "按煮饭键"]'::jsonb,
    '煮好后焖5分钟再拌匀。',
    'published'
  )
on conflict (title) do update
set description = excluded.description,
    budget_cents = excluded.budget_cents,
    cook_minutes = excluded.cook_minutes,
    servings = excluded.servings,
    difficulty = excluded.difficulty,
    tags = excluded.tags,
    ingredients = excluded.ingredients,
    steps = excluded.steps,
    tips = excluded.tips,
    status = excluded.status;
