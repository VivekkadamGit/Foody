'use client'

import { CUISINES, DIETS, MEALS, TASTES } from '@/lib/taxonomy'
import { CATEGORY_GROUPS, tagLabel, type DishTags } from '@/lib/admin/dishTags'
import { Chip } from './ui'

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 font-anek text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
        {label}
        {hint && <span className="ml-1.5 font-medium normal-case tracking-normal text-muted/80">· {hint}</span>}
      </p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}

function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v]
}

/** Every option comes from lib/taxonomy.ts, so the admin can only write tags search understands. */
export default function TagPicker({ value, onChange }: { value: DishTags; onChange: (next: DishTags) => void }) {
  const set = (patch: Partial<DishTags>) => onChange({ ...value, ...patch })

  return (
    <div className="space-y-5">
      <Row label="Diet" hint="needed for search">
        {DIETS.map((d) => (
          <Chip key={d} selected={value.diet === d} onClick={() => set({ diet: value.diet === d ? null : d })}>
            {tagLabel('diet', d)}
          </Chip>
        ))}
      </Row>

      <div>
        <p className="mb-2 font-anek text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
          Category<span className="ml-1.5 font-medium normal-case tracking-normal text-muted/80">· needed for search</span>
        </p>
        <div className="space-y-2.5">
          {CATEGORY_GROUPS.map((g) => (
            <div key={g.parent} className="flex flex-wrap items-center gap-1.5">
              <span className="w-[68px] font-anek text-[12px] text-muted">{g.label}</span>
              {g.leaves.map((leaf) => (
                <Chip key={leaf} selected={value.category === leaf} onClick={() => set({ category: value.category === leaf ? null : leaf })}>
                  {tagLabel('category', leaf)}
                </Chip>
              ))}
            </div>
          ))}
        </div>
      </div>

      <Row label="Cuisine" hint="optional">
        {CUISINES.map((c) => (
          <Chip key={c} selected={value.cuisine === c} onClick={() => set({ cuisine: value.cuisine === c ? null : c })}>
            {tagLabel('cuisine', c)}
          </Chip>
        ))}
      </Row>

      <Row label="Taste" hint="pick any">
        {TASTES.map((t) => (
          <Chip key={t} selected={value.tastes.includes(t)} onClick={() => set({ tastes: toggle(value.tastes, t) })}>
            {tagLabel('taste', t)}
          </Chip>
        ))}
      </Row>

      <Row label="Meal" hint="pick any">
        {MEALS.map((m) => (
          <Chip key={m} selected={value.meals.includes(m)} onClick={() => set({ meals: toggle(value.meals, m) })}>
            {tagLabel('meal', m)}
          </Chip>
        ))}
      </Row>
    </div>
  )
}
