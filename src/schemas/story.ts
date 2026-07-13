import { z } from 'zod'

const regionSchema = z.object({
  id: z.string().min(1),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().positive().max(1),
  height: z.number().positive().max(1),
  label: z.string().min(1),
  feedback: z.string().optional(),
})

const lineSchema = z.object({
  character: z.string().min(1),
  text: z.string().min(1),
  pauseAfterMs: z.number().nonnegative().default(450),
  sfx: z.string().optional(),
})

const baseNodeSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  nextNodeId: z.string().nullable(),
  scene: z.string().min(1),
  music: z.string().optional(),
  ambience: z.string().optional(),
  enterSfx: z.array(z.string()).default([]),
  transition: z.enum(['fade', 'push', 'flash', 'blackout']).default('fade'),
})

const narrativeNodeSchema = baseNodeSchema.extend({
  type: z.literal('narrative'),
  lines: z.array(lineSchema).min(1),
})

const gameRulesSchema = z.object({
  timeLimitSec: z.number().int().positive().default(60),
  maxMistakes: z.number().int().positive().default(3),
})

const objectHuntNodeSchema = baseNodeSchema.extend({
  type: z.literal('object-hunt'),
  intro: z.string().min(1),
  rules: gameRulesSchema,
  regions: z.array(regionSchema).min(1),
})

const spotDifferenceNodeSchema = baseNodeSchema.extend({
  type: z.literal('spot-difference'),
  intro: z.string().min(1),
  leftImage: z.string().min(1),
  rightImage: z.string().min(1),
  rules: gameRulesSchema,
  regions: z.array(regionSchema).min(1),
})

const qteNoteSchema = z.object({
  key: z.string().length(1),
  atMs: z.number().nonnegative(),
})

const qteNodeSchema = baseNodeSchema.extend({
  type: z.literal('keyboard-qte'),
  intro: z.string().min(1),
  rules: gameRulesSchema,
  travelMs: z.number().int().positive().default(2400),
  hitWindowMs: z.number().int().positive().default(600),
  notes: z.array(qteNoteSchema).min(1),
})

const runnerObstacleSchema = z.object({
  id: z.string().min(1),
  lane: z.number().int().min(0).max(2),
  at: z.number().positive(),
  kind: z.enum(['barrier', 'rock', 'fallen-tree']).default('barrier'),
})

const runnerNodeSchema = baseNodeSchema.extend({
  type: z.literal('road-runner'),
  intro: z.string().min(1),
  rules: gameRulesSchema,
  goalDistance: z.number().positive(),
  obstacles: z.array(runnerObstacleSchema).min(1),
})

const quizOptionSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
})

const quizNodeSchema = baseNodeSchema.extend({
  type: z.literal('quiz'),
  intro: z.string().min(1),
  question: z.string().min(1),
  options: z.array(quizOptionSchema).min(2),
  correctOptionId: z.string().min(1),
  wrongMessage: z.string().min(1),
  successMessage: z.string().min(1),
})

const endingNodeSchema = baseNodeSchema.extend({
  type: z.literal('ending'),
  message: z.string().min(1),
  lines: z.array(lineSchema).default([]),
})

export const storyNodeSchema = z.discriminatedUnion('type', [
  narrativeNodeSchema,
  objectHuntNodeSchema,
  spotDifferenceNodeSchema,
  qteNodeSchema,
  runnerNodeSchema,
  quizNodeSchema,
  endingNodeSchema,
])

const characterSchema = z.object({
  name: z.string().min(1),
  voiceHints: z.array(z.string()).default(['zh-CN']),
  rate: z.number().min(0.5).max(2).default(1),
  pitch: z.number().min(0).max(2).default(1),
})

const audioEntrySchema = z.object({
  id: z.string().min(1),
  src: z.string().min(1),
  loop: z.boolean().default(false),
  volume: z.number().min(0).max(1).default(1),
})

export const storySchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  title: z.string().min(1),
  subtitle: z.string().default(''),
  cover: z.string().min(1),
  startNodeId: z.string().min(1),
  characters: z.record(z.string(), characterSchema),
  audio: z.object({
    music: z.array(audioEntrySchema),
    ambience: z.array(audioEntrySchema),
    sfx: z.array(audioEntrySchema),
  }),
  nodes: z.array(storyNodeSchema).min(1),
}).superRefine((story, context) => {
  const ids = new Set(story.nodes.map((node) => node.id))
  if (!ids.has(story.startNodeId)) {
    context.addIssue({ code: 'custom', path: ['startNodeId'], message: '起始节点不存在' })
  }
  story.nodes.forEach((node, index) => {
    if (node.nextNodeId && !ids.has(node.nextNodeId)) {
      context.addIssue({ code: 'custom', path: ['nodes', index, 'nextNodeId'], message: `后续节点 ${node.nextNodeId} 不存在` })
    }
    if (node.type === 'quiz' && !node.options.some((option) => option.id === node.correctOptionId)) {
      context.addIssue({ code: 'custom', path: ['nodes', index, 'correctOptionId'], message: '正确答案必须存在于选项中' })
    }
  })
})

export const storyIndexSchema = z.object({
  stories: z.array(z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    description: z.string(),
    cover: z.string().min(1),
    config: z.string().min(1),
  })).min(1),
})

export type Story = z.infer<typeof storySchema>
export type StoryNode = z.infer<typeof storyNodeSchema>
export type NarrativeNode = Extract<StoryNode, { type: 'narrative' }>
export type ObjectHuntNode = Extract<StoryNode, { type: 'object-hunt' }>
export type SpotDifferenceNode = Extract<StoryNode, { type: 'spot-difference' }>
export type QteNode = Extract<StoryNode, { type: 'keyboard-qte' }>
export type RunnerNode = Extract<StoryNode, { type: 'road-runner' }>
export type QuizNode = Extract<StoryNode, { type: 'quiz' }>
export type EndingNode = Extract<StoryNode, { type: 'ending' }>
export type Region = z.infer<typeof regionSchema>
export type StoryIndex = z.infer<typeof storyIndexSchema>
