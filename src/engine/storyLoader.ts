import { storyIndexSchema, storySchema, type Story, type StoryIndex } from '../schemas/story'

async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`无法加载 ${url}（${response.status}）`)
  return response.json()
}

export async function loadStoryIndex(): Promise<StoryIndex> {
  const result = storyIndexSchema.safeParse(await getJson('/stories/index.json'))
  if (!result.success) throw new Error(`故事索引格式错误：${result.error.issues[0]?.message ?? '未知错误'}`)
  return result.data
}

export async function loadStory(configUrl: string): Promise<Story> {
  const result = storySchema.safeParse(await getJson(configUrl))
  if (!result.success) {
    const issue = result.error.issues[0]
    throw new Error(`故事配置错误（${issue?.path.join('.') || '根节点'}）：${issue?.message ?? '未知错误'}`)
  }
  return result.data
}

export function nodeIndex(story: Story, nodeId: string): number {
  return story.nodes.findIndex((node) => node.id === nodeId)
}

export function canVisitNode(story: Story, nodeId: string, furthestNodeIndex: number): boolean {
  const index = nodeIndex(story, nodeId)
  return index >= 0 && index <= furthestNodeIndex
}
