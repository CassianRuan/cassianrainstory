import type { Story, StoryIndex } from '../schemas/story'

export function StartScreen({ story, index, hasSave, onStart }: { story: Story; index: StoryIndex; hasSave: boolean; onStart: () => void }) {
  return (
    <main className="start-screen" style={{ backgroundImage: `url(${story.cover})` }}>
      <div className="start-shade" />
      <div className="start-content">
        <span className="eyebrow">互动悬疑故事 · {index.stories.length} 个故事</span>
        <h1>{story.title}</h1>
        <p>{story.subtitle}</p>
        <div className="ornament">◆</div>
        <button className="primary-button large" onClick={onStart}>{hasSave ? '继续故事' : '开始故事'}</button>
        <small>建议佩戴耳机 · 仅适配电脑浏览器</small>
      </div>
    </main>
  )
}
