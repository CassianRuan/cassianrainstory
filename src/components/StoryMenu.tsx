import type { Story, StoryIndex } from '../schemas/story'

interface Props {
  open: boolean
  index: StoryIndex
  story: Story
  currentNodeId: string
  furthestNodeIndex: number
  onToggle: () => void
  onSelectNode: (nodeId: string) => void
}

export function StoryMenu(props: Props) {
  return (
    <>
      <button className="story-menu-button" onClick={props.onToggle} aria-expanded={props.open} aria-label="选择故事">☰ <span>故事</span></button>
      {props.open && (
        <aside className="story-menu-panel">
          <header><span className="eyebrow">故事档案</span><h2>选择故事</h2></header>
          {props.index.stories.map((item) => (
            <article className="story-option active" key={item.id}>
              <img src={item.cover} alt="" />
              <div><strong>{item.title}</strong><p>{item.description}</p></div>
            </article>
          ))}
          <div className="node-list">
            <h3>剧情回溯</h3>
            {props.story.nodes.map((node, index) => (
              <button key={node.id} disabled={index > props.furthestNodeIndex} className={node.id === props.currentNodeId ? 'current' : ''} onClick={() => props.onSelectNode(node.id)}>
                <span>{String(index + 1).padStart(2, '0')}</span>{node.title}{index > props.furthestNodeIndex && <i>锁定</i>}
              </button>
            ))}
          </div>
        </aside>
      )}
    </>
  )
}
