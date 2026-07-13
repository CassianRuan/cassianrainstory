import type { StoryNode } from '../schemas/story'

export function SceneBackdrop({ node }: { node: StoryNode }) {
  return (
    <div className={`scene-backdrop transition-${node.transition}`} key={node.id}>
      <img src={node.scene} alt="" aria-hidden="true" />
      <div className="scene-vignette" />
      {(node.transition === 'flash' || node.transition === 'blackout') && <span className="lightning-flash" />}
    </div>
  )
}
