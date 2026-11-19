/**
 * 自检：`node --test test/smoke.mjs`（纯 JS，无需构建）。
 *
 * 验证三件事：
 *   1. 三个技能都能从 skills/<id>/SKILL.md 读出来并注册；
 *   2. 注册内容就是原文（frontmatter 已剥离、正文完整、description 一致）；
 *   3. 缺 skills 服务时只告警，不抛错。
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const plugin = await import('../index.js')

function fakeContext() {
  const skills = []
  const warnings = []
  const ctx = {
    skills: { register(skill) { skills.push(skill); return () => {} } },
    logger: { warn(message) { warnings.push(message) } },
    on() {},
  }
  return { ctx, skills, warnings }
}

function countMarkdown(dir) {
  try {
    return readdirSync(dir).filter((file) => file.endsWith('.md')).length
  } catch {
    return 0
  }
}

test('注册三个技能，且顺序稳定', () => {
  const { ctx, skills, warnings } = fakeContext()
  plugin.apply(ctx)
  assert.equal(skills.length, 3, `实际注册 ${skills.length} 个：${warnings.join(' | ')}`)
  assert.deepEqual(skills.map((s) => s.name), ['tax-diagnosis', 'tax-filing', 'tax-review'])
})

test('技能内容就是原文：frontmatter 剥离、正文齐全、资源目录指向自己', () => {
  const { ctx, skills } = fakeContext()
  plugin.apply(ctx)
  for (const skill of skills) {
    const raw = readFileSync(join(root, 'skills', skill.name, 'SKILL.md'), 'utf8')
    assert.ok(!skill.content.startsWith('---'), `${skill.name} 的 frontmatter 没剥掉`)
    assert.ok(skill.content.includes('##'), `${skill.name} 正文异常`)
    assert.ok(skill.content.length > 800, `${skill.name} 正文过短（${skill.content.length}）`)
    assert.ok(raw.includes(skill.description), `${skill.name} 的 description 与原文不一致`)
    assert.equal(skill.resourceBase.kind, 'directory')
    assert.ok(skill.resourceBase.path.endsWith(join('skills', skill.name)))
  }
})

test('references 与 templates 都随包存在', () => {
  const expectations = {
    'tax-diagnosis': { references: 9, templates: 3 },
    'tax-filing': { references: 2, templates: 3 },
    'tax-review': { references: 1, templates: 1 },
  }
  for (const [name, want] of Object.entries(expectations)) {
    for (const [kind, count] of Object.entries(want)) {
      const actual = countMarkdown(join(root, 'skills', name, kind))
      assert.equal(actual, count, `${name}/${kind} 应为 ${count}，实际 ${actual}`)
    }
  }
})

test('缺 skills 服务时只告警，不抛错', () => {
  const warnings = []
  const ctx = { logger: { warn(message) { warnings.push(message) } }, on() {} }
  assert.doesNotThrow(() => plugin.apply(ctx))
  assert.equal(warnings.length, 1)
})
