// dsh-taxscale —— 税衡 · 税务总监（DeepSeek Harness Host 半边）
//
// 三个技能（tax-diagnosis / tax-filing / tax-review）的**内容**一个字没动，全部在
// skills/<id>/SKILL.md 与各自的 references/、templates/ 里。这个文件只做一件事：
// 把它们注册进宿主真正的技能注册表。
//
// 为什么需要这一层：原包用 cordis.patch.yml 的 meta.skills 声明技能，但 DSH 的技能
// 只来自「文件系统 provider」或「插件自己 ctx.skills.register(...)」。meta 字段不会被
// 任何 provider 消费，照原样装上去会是空壳。这里用官方接口补上注册。
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const name = 'dsh-taxscale'

/** 声明依赖：不写这条，ctx.skills 会被 context proxy 拒绝。 */
export const inject = ['skills']

const packageRoot = fileURLToPath(new URL('.', import.meta.url))
const skillsDir = join(packageRoot, 'skills')

/** 取 frontmatter 里的单行字段（零依赖，只认 name/description）。 */
function frontmatterField(text, key) {
  const head = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---/.exec(text.replace(/^\uFEFF/, ''))
  if (head === null) return ''
  const line = new RegExp(`^${key}:[ \\t]*(.*)$`, 'm').exec(head[1] ?? '')
  if (line === null) return ''
  return (line[1] ?? '').trim().replace(/^["']|["']$/g, '')
}

/** 去掉 frontmatter，只留正文（技能内容）。 */
function skillBody(text) {
  const match = /^---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*\r?\n?/.exec(text.replace(/^\uFEFF/, ''))
  return match === null ? text : text.slice(match[0].length).trimStart()
}

/** 列出 skills/ 下的技能目录。 */
function listSkillDirs() {
  try {
    return readdirSync(skillsDir)
      .filter((entry) => {
        try {
          return statSync(join(skillsDir, entry)).isDirectory()
        } catch {
          return false
        }
      })
      .sort()
  } catch {
    return []
  }
}

export function apply(ctx) {
  const warn = (message) => {
    ctx.logger?.warn?.(message)
  }
  const disposers = []

  if (ctx.skills === undefined || typeof ctx.skills.register !== 'function') {
    warn('[taxscale] 宿主没有 skills 服务：技能无法注册，插件不会提供任何能力')
    return
  }

  for (const id of listSkillDirs()) {
    const dir = join(skillsDir, id)
    try {
      const raw = readFileSync(join(dir, 'SKILL.md'), 'utf8')
      const skillName = frontmatterField(raw, 'name') || id
      const description = frontmatterField(raw, 'description')
      const content = skillBody(raw)
      if (description === '' || content === '') {
        warn(`[taxscale] ${id}/SKILL.md 的 frontmatter 不完整，已跳过`)
        continue
      }
      disposers.push(
        ctx.skills.register({
          name: skillName,
          description,
          content,
          // references/ 与 templates/ 通过 resourceBase 暴露给技能加载方
          resourceBase: { kind: 'directory', path: dir },
          source: 'runtime',
        }),
      )
    } catch (error) {
      warn(`[taxscale] 技能 ${id} 注册失败：${error instanceof Error ? error.message : String(error)}`)
    }
  }

  ctx.on?.('dispose', () => {
    for (const dispose of disposers.reverse()) {
      try {
        dispose()
      } catch {
        // 卸载阶段不再上抛。
      }
    }
  })
}
